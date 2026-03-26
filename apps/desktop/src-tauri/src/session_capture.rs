use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Captured session data from the login webview.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct CapturedSession {
    pub provider: String,
    pub cookies: String,
    pub local_storage: String,
    pub user_agent: String,
    pub captured_at: String,
}

/// Global store for captured session data (one per provider).
static CAPTURED: Mutex<Option<CapturedSession>> = Mutex::new(None);

/// JS initialization script injected into the login webview BEFORE page JS runs.
/// It overrides fetch/XHR to capture auth tokens from request headers,
/// and reads document.cookie + localStorage after login.
const CAPTURE_INIT_SCRIPT: &str = r#"
(function() {
    // Store captured auth data
    window.__fusio_captured = { tokens: {}, headers: {} };

    // Intercept fetch to capture auth headers
    const origFetch = window.fetch;
    window.fetch = function(input, init) {
        try {
            const headers = init?.headers;
            if (headers) {
                const h = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
                for (const [k, v] of Object.entries(h)) {
                    const lower = k.toLowerCase();
                    if (lower === 'authorization' || lower === 'x-api-key' || lower === 'cookie') {
                        window.__fusio_captured.headers[lower] = v;
                    }
                }
            }
        } catch (e) { /* ignore */ }
        return origFetch.apply(this, arguments);
    };

    // Intercept XMLHttpRequest to capture auth headers
    const origOpen = XMLHttpRequest.prototype.open;
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function() {
        this._fusioHeaders = {};
        return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        const lower = name.toLowerCase();
        if (lower === 'authorization' || lower === 'x-api-key' || lower === 'cookie') {
            window.__fusio_captured.headers[lower] = value;
        }
        return origSetHeader.apply(this, arguments);
    };
})();
"#;

/// JS to extract session data from the page after login success.
const EXTRACT_SESSION_JS: &str = r#"
(function() {
    var data = {
        cookies: document.cookie || '',
        localStorage: '{}',
        userAgent: navigator.userAgent || '',
        capturedHeaders: JSON.stringify(window.__fusio_captured?.headers || {})
    };
    try {
        data.localStorage = JSON.stringify(
            Object.fromEntries(
                Object.keys(localStorage).map(function(k) { return [k, localStorage.getItem(k)]; })
            )
        );
    } catch(e) {}

    // Post the data to the Tauri IPC if available
    if (window.__TAURI_INTERNALS__) {
        window.__TAURI_INTERNALS__.invoke('receive_session_data', data);
    }
})();
"#;

/// Tauri command: receive session data from the injected JS.
#[tauri::command]
pub fn receive_session_data(
    cookies: Option<String>,
    local_storage: Option<String>,
    user_agent: Option<String>,
    captured_headers: Option<String>,
) -> Result<(), String> {
    // Merge cookies from document.cookie and captured auth headers
    let mut all_cookies = cookies.unwrap_or_default();

    // If we captured authorization headers, include them
    if let Some(headers_json) = captured_headers {
        if !headers_json.is_empty() && headers_json != "{}" {
            // Append captured headers as a separate field in the cookie string
            if !all_cookies.is_empty() {
                all_cookies.push_str("; ");
            }
            all_cookies.push_str("__fusio_captured_headers=");
            all_cookies.push_str(&headers_json);
        }
    }

    let session = CapturedSession {
        provider: String::new(), // Will be set by check_login_status
        cookies: all_cookies,
        local_storage: local_storage.unwrap_or_else(|| "{}".to_string()),
        user_agent: user_agent.unwrap_or_default(),
        captured_at: chrono_now(),
    };

    if let Ok(mut guard) = CAPTURED.lock() {
        *guard = Some(session);
    }

    Ok(())
}

/// Tauri command: open a browser login window for the given provider.
#[tauri::command]
pub async fn open_login_window(app: AppHandle, provider: String) -> Result<String, String> {
    let url = match provider.as_str() {
        "claude" => "https://claude.ai/login",
        "openai" => "https://auth0.openai.com/u/login",
        _ => return Err(format!("Unknown provider: {}", provider)),
    };

    let label = format!("login-{}", provider);

    // Close existing login window if any
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.close();
        // Brief wait for cleanup
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    }

    // Clear any previously captured data
    if let Ok(mut guard) = CAPTURED.lock() {
        *guard = None;
    }

    let title = if provider == "claude" {
        "Log in to Claude"
    } else {
        "Log in to ChatGPT"
    };

    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::External(url.parse().map_err(|e| format!("Bad URL: {}", e))?),
    )
    .title(title)
    .inner_size(1024.0, 768.0)
    .center()
    .initialization_script(CAPTURE_INIT_SCRIPT)
    .build()
    .map_err(|e| format!("Failed to open login window: {}", e))?;

    Ok(label)
}

/// Tauri command: check if login was successful by inspecting the webview URL.
/// Returns the captured session if login is detected, None otherwise.
#[tauri::command]
pub async fn check_login_status(
    app: AppHandle,
    provider: String,
) -> Result<Option<CapturedSession>, String> {
    let label = format!("login-{}", provider);

    let window = match app.get_webview_window(&label) {
        Some(w) => w,
        None => return Ok(None), // Window was closed
    };

    // Get current URL
    let url = window
        .url()
        .map_err(|e| format!("Failed to get URL: {}", e))?;
    let url_str = url.as_str();

    // Check if URL indicates successful login
    let success = match provider.as_str() {
        "claude" => {
            (url_str.contains("claude.ai") && !url_str.contains("/login"))
                && (url_str.contains("/new")
                    || url_str.contains("/chat")
                    || url_str.contains("/recents")
                    || url_str.ends_with("claude.ai/"))
        }
        "openai" => {
            (url_str.contains("chat.openai.com") || url_str.contains("chatgpt.com"))
                && !url_str.contains("/auth/")
                && !url_str.contains("auth0.openai.com")
        }
        _ => false,
    };

    if !success {
        return Ok(None);
    }

    // Login detected — extract session data via JS injection
    let _ = window.eval(EXTRACT_SESSION_JS);

    // Give the JS a moment to execute and call receive_session_data
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // Check if we received data via IPC
    let mut session = if let Ok(mut guard) = CAPTURED.lock() {
        guard.take()
    } else {
        None
    };

    // If IPC didn't work (external domain may not have __TAURI_INTERNALS__),
    // fall back to extracting via eval + title hack
    if session.is_none() {
        // Use a fallback: set document.title to the data, then read it
        let extract_via_title = r#"
            (function() {
                var d = {
                    c: document.cookie || '',
                    l: '{}',
                    u: navigator.userAgent || ''
                };
                try {
                    d.l = JSON.stringify(
                        Object.fromEntries(
                            Object.keys(localStorage).map(function(k) { return [k, localStorage.getItem(k)]; })
                        )
                    );
                } catch(e) {}
                document.title = 'FUSIO_SESSION:' + btoa(unescape(encodeURIComponent(JSON.stringify(d))));
            })();
        "#;
        let _ = window.eval(extract_via_title);
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;

        // Read the title
        if let Ok(title) = window.title() {
            if let Some(encoded) = title.strip_prefix("FUSIO_SESSION:") {
                if let Ok(decoded_bytes) = base64_decode(encoded) {
                    if let Ok(json_str) = String::from_utf8(decoded_bytes) {
                        if let Ok(parsed) =
                            serde_json::from_str::<serde_json::Value>(&json_str)
                        {
                            session = Some(CapturedSession {
                                provider: provider.clone(),
                                cookies: parsed["c"].as_str().unwrap_or("").to_string(),
                                local_storage: parsed["l"]
                                    .as_str()
                                    .unwrap_or("{}")
                                    .to_string(),
                                user_agent: parsed["u"].as_str().unwrap_or("").to_string(),
                                captured_at: chrono_now(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Set the provider on the session
    if let Some(ref mut s) = session {
        s.provider = provider;
    }

    // Close the login window
    let _ = window.close();

    Ok(session)
}

/// Tauri command: close a login window.
#[tauri::command]
pub async fn close_login_window(app: AppHandle, provider: String) -> Result<(), String> {
    let label = format!("login-{}", provider);
    if let Some(window) = app.get_webview_window(&label) {
        window
            .close()
            .map_err(|e| format!("Failed to close: {}", e))?;
    }
    Ok(())
}

/// Simple base64 decode (standard alphabet).
fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    // Simple base64 decoding
    const TABLE: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let input = input.trim_end_matches('=');
    let mut output = Vec::with_capacity(input.len() * 3 / 4);

    let mut buf: u32 = 0;
    let mut bits: u32 = 0;

    for &byte in input.as_bytes() {
        let val = TABLE
            .iter()
            .position(|&b| b == byte)
            .ok_or_else(|| format!("Invalid base64 char: {}", byte as char))?
            as u32;
        buf = (buf << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }

    Ok(output)
}

/// Get current time as ISO string without pulling in the chrono crate.
fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Simple ISO-ish format: just the unix timestamp for now
    format!("{}", secs)
}

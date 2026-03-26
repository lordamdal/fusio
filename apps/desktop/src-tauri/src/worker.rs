use serde::Serialize;
use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::net::UdpSocket;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Instant;

struct ProcessHandle {
    child: Child,
    started_at: Instant,
}

struct ServiceState {
    nats: Option<ProcessHandle>,
    orchestrator: Option<ProcessHandle>,
    worker: Option<ProcessHandle>,
}

/// Ring buffer of recent log lines from worker + orchestrator
static LOG_BUFFER: Mutex<VecDeque<String>> = Mutex::new(VecDeque::new());
const MAX_LOG_LINES: usize = 200;

static SERVICES: Mutex<Option<ServiceState>> = Mutex::new(None);

#[derive(Serialize)]
pub struct WorkerStatus {
    pub running: bool,
    pub active_job: Option<String>,
    pub uptime_ms: u64,
    pub nats_running: bool,
    pub orchestrator_running: bool,
}

fn push_log(line: String) {
    if let Ok(mut buf) = LOG_BUFFER.lock() {
        if buf.len() >= MAX_LOG_LINES {
            buf.pop_front();
        }
        buf.push_back(line);
    }
}

/// Spawn a background thread that reads lines from a child's stdout/stderr and pushes to log buffer.
fn capture_output(child: &mut Child, label: &str) {
    let tag = label.to_string();
    if let Some(stdout) = child.stdout.take() {
        let t = tag.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(l) = line {
                    push_log(format!("[{}] {}", t, l));
                }
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let t = tag.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(l) = line {
                    push_log(format!("[{}/err] {}", t, l));
                }
            }
        });
    }
}

/// Search common locations for a binary that macOS GUI apps can't find via PATH.
fn find_binary(name: &str) -> Option<PathBuf> {
    // 1. Bundled inside .app bundle: Fusio.app/Contents/Resources/bin/<name>
    if let Ok(exe) = std::env::current_exe() {
        if let Some(macos_dir) = exe.parent() {
            let bundled = macos_dir
                .parent()
                .map(|contents| contents.join("Resources/bin").join(name));
            if let Some(ref p) = bundled {
                if p.exists() {
                    // Remove macOS quarantine flag on bundled binaries
                    let _ = Command::new("xattr")
                        .args(["-dr", "com.apple.quarantine"])
                        .arg(p)
                        .stdout(Stdio::null())
                        .stderr(Stdio::null())
                        .output();
                    return Some(p.clone());
                }
            }
        }
    }

    // 2. System paths
    let search_dirs = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
    ];

    for dir in &search_dirs {
        let candidate = PathBuf::from(dir).join(name);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // nvm: scan ~/.nvm/versions/node/*/bin/
    if name == "node" {
        if let Some(home) = dirs::home_dir() {
            let nvm_dir = home.join(".nvm/versions/node");
            if nvm_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                    let mut versions: Vec<PathBuf> = entries
                        .filter_map(|e| e.ok())
                        .map(|e| e.path())
                        .collect();
                    versions.sort();
                    versions.reverse();
                    for v in versions {
                        let candidate = v.join("bin/node");
                        if candidate.exists() {
                            return Some(candidate);
                        }
                    }
                }
            }
        }
    }

    None
}

/// Find a script in the monorepo by walking up from the executable.
fn find_repo_script(relative_path: &str) -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.clone();
        for _ in 0..10 {
            dir.pop();
            let candidate = dir.join(relative_path);
            if candidate.exists() {
                return candidate;
            }
        }
    }
    PathBuf::from(format!(
        "/Users/lordamdal/Documents/fusio/fusio-space/fusio/{}",
        relative_path
    ))
}

fn is_alive(handle: &mut Option<ProcessHandle>) -> bool {
    if let Some(ref mut h) = handle {
        match h.child.try_wait() {
            Ok(Some(_)) => {
                *handle = None;
                false
            }
            Ok(None) => true,
            Err(_) => {
                *handle = None;
                false
            }
        }
    } else {
        false
    }
}

fn kill_handle(handle: &mut Option<ProcessHandle>) {
    if let Some(ref mut h) = handle {
        let _ = h.child.kill();
        let _ = h.child.wait();
    }
    *handle = None;
}

/// Auto-detect this machine's LAN IP by opening a UDP socket to a public address.
/// No data is actually sent — we just read which local interface the OS would use.
fn get_local_ip() -> String {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            socket.connect("8.8.8.8:80")?;
            socket.local_addr()
        })
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}

fn is_port_open(port: u16) -> bool {
    std::net::TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
}

/// Kill any stale process occupying a port (from a previous app session).
fn kill_port(port: u16) {
    let _ = Command::new("lsof")
        .args(["-ti", &format!(":{}", port)])
        .output()
        .and_then(|output| {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid in pids.split_whitespace() {
                if let Ok(p) = pid.parse::<i32>() {
                    push_log(format!("[cleanup] Killing stale process on port {} (pid: {})", port, p));
                    let _ = Command::new("kill").arg("-9").arg(&p.to_string()).output();
                }
            }
            Ok(())
        });
    // Brief wait for the port to be released
    std::thread::sleep(std::time::Duration::from_millis(300));
}

#[tauri::command]
pub async fn start_worker(
    orchestrator_url: String,
    nats_url: Option<String>,
    local_ip: Option<String>,
) -> Result<String, String> {
    let node_bin = find_binary("node")
        .ok_or("Node.js not found. Install Node.js (https://nodejs.org) and restart the app.")?;

    let nats_addr = nats_url.unwrap_or_else(|| "nats://localhost:4222".to_string());
    let mut messages: Vec<String> = Vec::new();

    // Clear log buffer on fresh start
    if let Ok(mut buf) = LOG_BUFFER.lock() {
        buf.clear();
    }

    let mut guard = SERVICES.lock().map_err(|e| format!("Lock error: {}", e))?;
    let state = guard.get_or_insert_with(|| ServiceState {
        nats: None,
        orchestrator: None,
        worker: None,
    });

    // --- 1. Ensure NATS is running ---
    if !is_port_open(4222) && !is_alive(&mut state.nats) {
        if let Some(nats_bin) = find_binary("nats-server") {
            let child = Command::new(&nats_bin)
                .arg("-p")
                .arg("4222")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| format!("Failed to start NATS: {}", e))?;
            let msg = format!("Started NATS (pid: {})", child.id());
            push_log(format!("[nats] {}", msg));
            messages.push(msg);
            state.nats = Some(ProcessHandle {
                child,
                started_at: Instant::now(),
            });
            std::thread::sleep(std::time::Duration::from_millis(500));
        } else {
            return Err(
                "NATS server not found. Install it: brew install nats-server".to_string(),
            );
        }
    } else {
        messages.push("NATS already running".to_string());
    }

    // --- 2. Ensure Orchestrator is running ---
    if !is_port_open(3000) && !is_alive(&mut state.orchestrator) {
        let orch_script = find_repo_script("services/orchestrator/dist/index.js");
        if orch_script.exists() {
            let orch_dir = orch_script
                .parent()
                .and_then(|p| p.parent())
                .ok_or("Cannot determine orchestrator directory")?;
            let mut child = Command::new(&node_bin)
                .arg(&orch_script)
                .current_dir(orch_dir)
                .env("PORT", "3000")
                .env("NATS_URL", &nats_addr)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to start orchestrator: {}", e))?;
            let msg = format!("Started orchestrator (pid: {})", child.id());
            push_log(format!("[orchestrator] {}", msg));
            messages.push(msg);
            capture_output(&mut child, "orchestrator");
            state.orchestrator = Some(ProcessHandle {
                child,
                started_at: Instant::now(),
            });
            std::thread::sleep(std::time::Duration::from_millis(1000));
        } else {
            return Err(format!(
                "Orchestrator not found at {}. Run: cd services/orchestrator && npm run build",
                orch_script.display()
            ));
        }
    } else {
        messages.push("Orchestrator already running".to_string());
    }

    // --- 3. Start Worker ---
    kill_handle(&mut state.worker);

    // Kill any stale process on worker port from a previous app session
    if is_port_open(3001) {
        push_log("[worker] Port 3001 in use — killing stale process".to_string());
        kill_port(3001);
    }

    let worker_script = find_repo_script("services/worker-node/dist/index.js");
    if !worker_script.exists() {
        return Err(format!(
            "Worker script not found at {}. Run: cd services/worker-node && npm run build",
            worker_script.display()
        ));
    }

    let worker_dir = worker_script
        .parent()
        .and_then(|p| p.parent())
        .ok_or("Cannot determine worker directory")?;

    let mut child = Command::new(&node_bin)
        .arg(&worker_script)
        .current_dir(worker_dir)
        .env("ORCHESTRATOR_URL", &orchestrator_url)
        .env("NATS_URL", &nats_addr)
        .env("WORKER_PORT", "3001")
        .env("FUSIO_KEY_PASSPHRASE", "local-test-passphrase")
        .env("DATA_DIR", "./data")
        .env("LOCAL_IP", {
            let ip = local_ip.as_deref()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .unwrap_or_else(get_local_ip);
            push_log(format!("[worker] Local IP: {}", ip));
            ip
        }.as_str())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start worker: {}", e))?;

    let msg = format!("Started worker (pid: {})", child.id());
    push_log(format!("[worker] {}", msg));
    messages.push(msg);
    capture_output(&mut child, "worker");

    state.worker = Some(ProcessHandle {
        child,
        started_at: Instant::now(),
    });

    Ok(messages.join("; "))
}

#[tauri::command]
pub async fn stop_worker() -> Result<String, String> {
    let mut guard = SERVICES.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(ref mut state) = *guard {
        kill_handle(&mut state.worker);
        kill_handle(&mut state.orchestrator);
        kill_handle(&mut state.nats);
    }
    *guard = None;

    push_log("[system] All services stopped".to_string());
    Ok("stopped".to_string())
}

#[tauri::command]
pub async fn get_worker_status() -> Result<WorkerStatus, String> {
    let mut guard = SERVICES.lock().map_err(|e| format!("Lock error: {}", e))?;

    match guard.as_mut() {
        Some(state) => {
            let nats_ok = is_port_open(4222) || is_alive(&mut state.nats);
            let orch_ok = is_port_open(3000) || is_alive(&mut state.orchestrator);
            let worker_ok = is_alive(&mut state.worker);

            if !worker_ok {
                let was_running = state.worker.is_some();
                kill_handle(&mut state.worker);
                if was_running {
                    push_log("[worker] Process exited unexpectedly".to_string());
                    return Ok(WorkerStatus {
                        running: false,
                        active_job: None,
                        uptime_ms: 0,
                        nats_running: nats_ok,
                        orchestrator_running: orch_ok,
                    });
                }
            }

            let uptime = state
                .worker
                .as_ref()
                .map(|w| w.started_at.elapsed().as_millis() as u64)
                .unwrap_or(0);

            Ok(WorkerStatus {
                running: worker_ok,
                active_job: None,
                uptime_ms: uptime,
                nats_running: nats_ok,
                orchestrator_running: orch_ok,
            })
        }
        None => Ok(WorkerStatus {
            running: false,
            active_job: None,
            uptime_ms: 0,
            nats_running: is_port_open(4222),
            orchestrator_running: is_port_open(3000),
        }),
    }
}

#[tauri::command]
pub async fn get_worker_logs() -> Result<Vec<String>, String> {
    let buf = LOG_BUFFER.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(buf.iter().cloned().collect())
}

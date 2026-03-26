import { useState, useCallback, useRef, useEffect } from 'react';

export type WebSessionProvider = 'claude' | 'openai';

export interface WebSession {
  provider: WebSessionProvider;
  status: 'active' | 'expired' | 'none';
  expiresAt?: string;
  capturedAt?: string;
}

const WEB_SESSIONS_KEY = 'fusio_web_sessions';

interface StoredSession {
  provider: WebSessionProvider;
  cookies: string;
  localStorage: string;
  userAgent: string;
  capturedAt: string;
  expiresAt: string;
}

function loadSessions(): StoredSession[] {
  try {
    const stored = localStorage.getItem(WEB_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: StoredSession[]) {
  localStorage.setItem(WEB_SESSIONS_KEY, JSON.stringify(sessions));
}

function getSessionStatus(session: StoredSession): WebSession {
  const isExpired = new Date(session.expiresAt) < new Date();
  return {
    provider: session.provider,
    status: isExpired ? 'expired' : 'active',
    expiresAt: session.expiresAt,
    capturedAt: session.capturedAt,
  };
}

interface CapturedSession {
  provider: string;
  cookies: string;
  local_storage: string;
  user_agent: string;
  captured_at: string;
}

export function useWebSession() {
  const [sessions, setSessions] = useState<WebSession[]>(() => {
    return loadSessions().map(getSessionStatus);
  });
  const [loginInProgress, setLoginInProgress] = useState<WebSessionProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getSession = useCallback((provider: WebSessionProvider): WebSession | undefined => {
    return sessions.find((s) => s.provider === provider);
  }, [sessions]);

  const storeSession = useCallback((provider: WebSessionProvider, captured: CapturedSession) => {
    const now = new Date();
    const expiryDays = provider === 'claude' ? 14 : 30;
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    const session: StoredSession = {
      provider,
      cookies: captured.cookies,
      localStorage: captured.local_storage || '{}',
      userAgent: captured.user_agent || navigator.userAgent,
      capturedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const existing = loadSessions().filter((s) => s.provider !== provider);
    saveSessions([...existing, session]);
    setSessions([...existing.map(getSessionStatus), getSessionStatus(session)]);

    // Also store in Vault (best-effort)
    const vaultUrl = localStorage.getItem('fusio_vault_url') || 'http://localhost:8201';
    const walletId = localStorage.getItem('fusio_wallet')?.slice(0, 16) || 'local';
    fetch(`${vaultUrl}/credentials/web-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: walletId,
        provider,
        cookies: captured.cookies,
        localStorage: captured.local_storage || '{}',
        userAgent: captured.user_agent || navigator.userAgent,
      }),
    }).catch(() => { /* best-effort */ });
  }, []);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLogin = useCallback(async (provider: WebSessionProvider) => {
    setLoginInProgress(provider);
    setError(null);
    cleanup();

    try {
      if (window.__TAURI_INTERNALS__) {
        // ---- Tauri Desktop: use Rust-backed login window ----
        const { invoke } = await import('@tauri-apps/api/core');

        // Open the login window (Rust creates a webview with init scripts)
        await invoke('open_login_window', { provider });

        // Poll for login completion via Rust command
        pollRef.current = setInterval(async () => {
          try {
            const result = await invoke<CapturedSession | null>('check_login_status', { provider });

            if (result) {
              // Login successful — session captured
              cleanup();
              storeSession(provider, result);
              setLoginInProgress(null);
            }
          } catch (err: any) {
            // If window was closed by user, check_login_status returns null
            if (err?.toString()?.includes('not found')) {
              cleanup();
              setLoginInProgress(null);
            }
          }
        }, 2000);

        // Auto-timeout after 5 minutes
        timeoutRef.current = setTimeout(async () => {
          cleanup();
          try {
            const { invoke: inv } = await import('@tauri-apps/api/core');
            await inv('close_login_window', { provider });
          } catch { /* ignore */ }
          setLoginInProgress(null);
          setError('Login timed out. Please try again.');
        }, 5 * 60 * 1000);

      } else {
        // ---- Browser fallback: popup window ----
        const loginUrl = provider === 'claude'
          ? 'https://claude.ai/login'
          : 'https://auth0.openai.com/u/login';

        const popup = window.open(loginUrl, `fusio-login-${provider}`, 'width=1024,height=768');

        if (!popup) {
          setError('Failed to open login window. Please allow popups.');
          setLoginInProgress(null);
          return;
        }

        const successPatterns = provider === 'claude'
          ? ['claude.ai/new', 'claude.ai/chat', 'claude.ai/recents']
          : ['chat.openai.com', 'chatgpt.com'];

        pollRef.current = setInterval(() => {
          try {
            if (popup.closed) {
              cleanup();
              setLoginInProgress(null);
              return;
            }

            const currentUrl = popup.location.href;
            if (currentUrl && successPatterns.some((p) => currentUrl.includes(p))) {
              cleanup();

              // Cross-origin: can't extract cookies from popup.
              // Store with what we can access.
              storeSession(provider, {
                provider,
                cookies: '',
                local_storage: '{}',
                user_agent: navigator.userAgent,
                captured_at: new Date().toISOString(),
              });

              setLoginInProgress(null);
              popup.close();
            }
          } catch {
            // Cross-origin access blocked — expected while on login domain
          }
        }, 2000);

        timeoutRef.current = setTimeout(() => {
          cleanup();
          if (!popup.closed) popup.close();
          setLoginInProgress(null);
          setError('Login timed out. Please try again.');
        }, 5 * 60 * 1000);
      }
    } catch (err: any) {
      cleanup();
      setError(err.message || 'Login failed. Check console for details.');
      setLoginInProgress(null);
    }
  }, [cleanup, storeSession]);

  const removeSession = useCallback(async (provider: WebSessionProvider) => {
    const updated = loadSessions().filter((s) => s.provider !== provider);
    saveSessions(updated);
    setSessions(updated.map(getSessionStatus));

    // Also remove from Vault (best-effort)
    const vaultUrl = localStorage.getItem('fusio_vault_url') || 'http://localhost:8201';
    const walletId = localStorage.getItem('fusio_wallet')?.slice(0, 16) || 'local';
    fetch(`${vaultUrl}/credentials/web-session/${walletId}/${provider}`, {
      method: 'DELETE',
    }).catch(() => { /* best-effort */ });
  }, []);

  const refreshSession = useCallback((provider: WebSessionProvider) => {
    removeSession(provider);
    startLogin(provider);
  }, [removeSession, startLogin]);

  return {
    sessions,
    loginInProgress,
    error,
    getSession,
    startLogin,
    removeSession,
    refreshSession,
  };
}

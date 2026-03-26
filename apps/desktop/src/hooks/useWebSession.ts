import { useState, useCallback } from 'react';

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

export function useWebSession() {
  const [sessions, setSessions] = useState<WebSession[]>(() => {
    return loadSessions().map(getSessionStatus);
  });
  const [loginInProgress, setLoginInProgress] = useState<WebSessionProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getSession = useCallback((provider: WebSessionProvider): WebSession | undefined => {
    return sessions.find((s) => s.provider === provider);
  }, [sessions]);

  const startLogin = useCallback(async (provider: WebSessionProvider) => {
    setLoginInProgress(provider);
    setError(null);

    try {
      const loginUrl = provider === 'claude'
        ? 'https://claude.ai/login'
        : 'https://chat.openai.com/auth/login';

      // Detect login completion URLs
      const successPatterns = provider === 'claude'
        ? ['claude.ai/new', 'claude.ai/chats', 'claude.ai/chat']
        : ['chat.openai.com/c/', 'chat.openai.com/?', 'chatgpt.com'];

      if (window.__TAURI_INTERNALS__) {
        // Tauri: open a webview window for login
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        const loginWindow = new WebviewWindow(`login-${provider}`, {
          url: loginUrl,
          title: `Log in to ${provider === 'claude' ? 'Claude' : 'ChatGPT'}`,
          width: 1024,
          height: 768,
          center: true,
        });

        // Listen for navigation events to detect successful login
        const unlisten = await loginWindow.onCloseRequested(async () => {
          // Window closed by user — check if we got cookies
          setLoginInProgress(null);
          unlisten();
        });

        // Poll for URL changes (Tauri webview approach)
        const pollInterval = setInterval(async () => {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const currentUrl = await invoke<string>('get_webview_url', { label: `login-${provider}` }).catch(() => '');

            if (currentUrl && successPatterns.some((p) => currentUrl.includes(p))) {
              clearInterval(pollInterval);

              // Extract cookies from webview
              const cookies = await invoke<string>('get_webview_cookies', { label: `login-${provider}` }).catch(() => '[]');

              const now = new Date();
              const expiryDays = provider === 'claude' ? 14 : 30;
              const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

              const session: StoredSession = {
                provider,
                cookies,
                localStorage: '{}',
                userAgent: navigator.userAgent,
                capturedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
              };

              // Store locally
              const existing = loadSessions().filter((s) => s.provider !== provider);
              saveSessions([...existing, session]);
              setSessions([...existing.map(getSessionStatus), getSessionStatus(session)]);

              // Also store in Vault if orchestrator URL is available
              const vaultUrl = localStorage.getItem('fusio_vault_url') || 'http://localhost:8201';
              const walletId = localStorage.getItem('fusio_wallet')?.slice(0, 16) || 'local';
              try {
                await fetch(`${vaultUrl}/credentials/web-session`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    agentId: walletId,
                    provider,
                    cookies,
                    localStorage: '{}',
                    userAgent: navigator.userAgent,
                  }),
                });
              } catch {
                // Vault storage is best-effort in dev
              }

              setLoginInProgress(null);
              loginWindow.close();
            }
          } catch {
            // polling error, continue
          }
        }, 2000);

        // Auto-cleanup after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (loginInProgress === provider) {
            setLoginInProgress(null);
            setError('Login timed out. Please try again.');
          }
        }, 5 * 60 * 1000);
      } else {
        // Browser fallback: open in a popup window
        const popup = window.open(loginUrl, `fusio-login-${provider}`, 'width=1024,height=768');

        if (!popup) {
          setError('Failed to open login window. Please allow popups.');
          setLoginInProgress(null);
          return;
        }

        // Poll for popup URL changes
        const pollInterval = setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(pollInterval);
              setLoginInProgress(null);
              return;
            }

            const currentUrl = popup.location.href;
            if (currentUrl && successPatterns.some((p) => currentUrl.includes(p))) {
              clearInterval(pollInterval);

              // In browser context, we can't easily extract cookies from cross-origin popups.
              // Store a placeholder session — the user will need to use API keys in browser mode.
              const now = new Date();
              const expiryDays = provider === 'claude' ? 14 : 30;
              const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

              const session: StoredSession = {
                provider,
                cookies: '[]',
                localStorage: '{}',
                userAgent: navigator.userAgent,
                capturedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
              };

              const existing = loadSessions().filter((s) => s.provider !== provider);
              saveSessions([...existing, session]);
              setSessions([...existing.map(getSessionStatus), getSessionStatus(session)]);
              setLoginInProgress(null);
              popup.close();
            }
          } catch {
            // Cross-origin access blocked — expected until redirect completes
          }
        }, 2000);

        setTimeout(() => {
          clearInterval(pollInterval);
          if (!popup.closed) popup.close();
          if (loginInProgress === provider) {
            setLoginInProgress(null);
            setError('Login timed out. Please try again.');
          }
        }, 5 * 60 * 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoginInProgress(null);
    }
  }, [loginInProgress]);

  const removeSession = useCallback((provider: WebSessionProvider) => {
    const updated = loadSessions().filter((s) => s.provider !== provider);
    saveSessions(updated);
    setSessions(updated.map(getSessionStatus));
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

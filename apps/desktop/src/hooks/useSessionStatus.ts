import { useState, useEffect, useCallback } from 'react';

export interface SessionNotification {
  id: string;
  provider: 'claude' | 'openai';
  type: 'expired' | 'captcha' | 'rate_limit';
  message: string;
  timestamp: number;
  dismissed: boolean;
}

const NOTIFICATIONS_KEY = 'fusio_session_notifications';

export function useSessionStatus() {
  const [notifications, setNotifications] = useState<SessionNotification[]>([]);

  // Load persisted notifications
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SessionNotification[];
        // Only show notifications from last 24 hours
        const recent = parsed.filter(
          (n) => Date.now() - n.timestamp < 24 * 60 * 60 * 1000 && !n.dismissed,
        );
        setNotifications(recent);
      }
    } catch {
      // ignore
    }
  }, []);

  // Poll for session status changes from NATS (via orchestrator relay)
  useEffect(() => {
    const orchestratorUrl = localStorage.getItem('fusio_orchestrator_url') || 'http://localhost:3000';
    const walletId = localStorage.getItem('fusio_wallet')?.slice(0, 16) || '';

    if (!walletId) return;

    const pollInterval = setInterval(async () => {
      try {
        const vaultUrl = localStorage.getItem('fusio_vault_url') || 'http://localhost:8201';
        for (const provider of ['claude', 'openai'] as const) {
          const res = await fetch(`${vaultUrl}/credentials/web-session/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: walletId, provider }),
          });
          if (res.ok) {
            const data = await res.json();
            if (!data.valid && data.reason === 'expired') {
              addNotification(provider, 'expired', `Your ${provider === 'claude' ? 'Claude' : 'ChatGPT'} session has expired. Log in again to continue.`);
            }
          }
        }
      } catch {
        // Vault not reachable — skip
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(pollInterval);
  }, []);

  const addNotification = useCallback((
    provider: 'claude' | 'openai',
    type: SessionNotification['type'],
    message: string,
  ) => {
    setNotifications((prev) => {
      // Don't duplicate
      const exists = prev.some(
        (n) => n.provider === provider && n.type === type && !n.dismissed,
      );
      if (exists) return prev;

      const notification: SessionNotification = {
        id: crypto.randomUUID(),
        provider,
        type,
        message,
        timestamp: Date.now(),
        dismissed: false,
      };
      const updated = [...prev, notification];
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n,
      );
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
      return updated.filter((n) => !n.dismissed);
    });
  }, []);

  const dismissAll = useCallback(() => {
    const updated = notifications.map((n) => ({ ...n, dismissed: true }));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    setNotifications([]);
  }, [notifications]);

  const activeNotifications = notifications.filter((n) => !n.dismissed);

  return {
    notifications: activeNotifications,
    addNotification,
    dismissNotification,
    dismissAll,
    hasNotifications: activeNotifications.length > 0,
  };
}

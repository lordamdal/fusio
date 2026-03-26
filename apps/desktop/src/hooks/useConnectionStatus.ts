import { useState, useEffect, useCallback } from 'react';

interface ConnectionStatus {
  connected: boolean;
  version: string | null;
  activeJobs: number;
  registeredWorkers: number;
}

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    version: null,
    activeJobs: 0,
    registeredWorkers: 0,
  });

  const check = useCallback(async () => {
    const baseUrl = localStorage.getItem('fusio_orchestrator_url') || 'http://localhost:3000';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('Not OK');
      const data = await res.json();
      setStatus({
        connected: data.status === 'ok',
        version: data.version ?? null,
        activeJobs: data.activeJobs ?? 0,
        registeredWorkers: data.registeredWorkers ?? 0,
      });
    } catch {
      setStatus({ connected: false, version: null, activeJobs: 0, registeredWorkers: 0 });
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [check]);

  return status;
}

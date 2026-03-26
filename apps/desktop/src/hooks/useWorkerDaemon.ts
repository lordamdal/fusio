import { useState, useCallback, useEffect, useRef } from 'react';

interface WorkerStatus {
  running: boolean;
  activeJob: string | null;
  uptimeMs: number;
  natsRunning: boolean;
  orchestratorRunning: boolean;
}

export function useWorkerDaemon() {
  const [status, setStatus] = useState<WorkerStatus>({
    running: false,
    activeJob: null,
    uptimeMs: 0,
    natsRunning: false,
    orchestratorRunning: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getStatus = useCallback(async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const s = await invoke<{
          running: boolean;
          active_job: string | null;
          uptime_ms: number;
          nats_running: boolean;
          orchestrator_running: boolean;
        }>('get_worker_status');
        setStatus((prev) => {
          if (prev.running && !s.running) {
            setError('Worker process exited unexpectedly. Check the console for details.');
          }
          return {
            running: s.running,
            activeJob: s.active_job,
            uptimeMs: s.uptime_ms,
            natsRunning: s.nats_running,
            orchestratorRunning: s.orchestrator_running,
          };
        });
      }
    } catch {
      // Keep current state in dev mode
    }
  }, []);

  const startWorker = useCallback(async (orchestratorUrl: string) => {
    setLoading(true);
    setError(null);
    const natsUrl = localStorage.getItem('fusio_nats_url') || 'nats://localhost:4222';
    const localIp = localStorage.getItem('fusio_local_ip') || '';
    try {
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const msg = await invoke<string>('start_worker', { orchestratorUrl, natsUrl, localIp: localIp || null });
        console.log('[fusio]', msg);
      }
      // Don't set running=true manually — let the poll confirm it
      await getStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getStatus]);

  const stopWorker = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('stop_worker');
      }
      setStatus({ running: false, activeJob: null, uptimeMs: 0, natsRunning: false, orchestratorRunning: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll status every 3s when worker is running
  useEffect(() => {
    if (status.running) {
      pollRef.current = setInterval(getStatus, 3000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [status.running, getStatus]);

  // Check initial status on mount
  useEffect(() => {
    getStatus();
  }, [getStatus]);

  return { status, loading, error, startWorker, stopWorker, getStatus };
}

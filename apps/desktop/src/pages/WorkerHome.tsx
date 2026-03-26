import { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkerDaemon } from '../hooks/useWorkerDaemon';
import EarningsWidget from '../components/EarningsWidget';
import DependencyPanel from '../components/DependencyPanel';

interface CompletedJob {
  id: string;
  purpose: string;
  completedAt: string;
  reward: number;
  duration: string;
}

export default function WorkerHome() {
  const { status, loading, error, startWorker, stopWorker } = useWorkerDaemon();
  const orchestratorUrl = localStorage.getItem('fusio_orchestrator_url') || 'http://localhost:3000';
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [earnings, setEarnings] = useState({ today: 0, week: 0, allTime: 0 });
  const [showConsole, setShowConsole] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [depsReady, setDepsReady] = useState(false);

  // Poll logs when console is open
  useEffect(() => {
    if (!showConsole) return;
    const fetchLogs = async () => {
      try {
        if (window.__TAURI_INTERNALS__) {
          const { invoke } = await import('@tauri-apps/api/core');
          const lines = await invoke<string[]>('get_worker_logs');
          setLogs(lines);
        }
      } catch {
        // ignore
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [showConsole]);

  // Auto-scroll logs only if user is near the bottom
  useEffect(() => {
    const container = logsContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
    if (isNearBottom) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const fetchCompletedJobs = useCallback(async () => {
    try {
      const res = await fetch(`${orchestratorUrl}/jobs`);
      if (!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.jobs ?? []);

      const completed: CompletedJob[] = arr
        .filter((j: Record<string, unknown>) => j.status === 'completed')
        .map((j: Record<string, unknown>) => {
          const manifest = (j.manifest ?? {}) as Record<string, unknown>;
          const createdAt = j.createdAt as number;
          const completedAt = j.completedAt as number;
          const durationMs = completedAt && createdAt ? completedAt - createdAt : 0;
          const mins = Math.floor(durationMs / 60000);
          const secs = Math.floor((durationMs % 60000) / 1000);

          return {
            id: j.jobId as string,
            purpose: (manifest.declaredPurpose ?? 'Untitled') as string,
            completedAt: completedAt ? new Date(completedAt).toLocaleString() : 'Unknown',
            reward: (manifest.maxPriceAgr ?? 0) as number,
            duration: `${mins}m ${secs.toString().padStart(2, '0')}s`,
          };
        })
        .slice(0, 10);

      setCompletedJobs(completed);

      const now = Date.now();
      const oneDayAgo = now - 86400000;
      const oneWeekAgo = now - 604800000;
      let today = 0, week = 0, allTime = 0;
      for (const j of arr) {
        if (j.status !== 'completed') continue;
        const reward = ((j.manifest as Record<string, unknown>)?.maxPriceAgr ?? 0) as number;
        const t = j.completedAt as number;
        allTime += reward;
        if (t >= oneWeekAgo) week += reward;
        if (t >= oneDayAgo) today += reward;
      }
      setEarnings({ today, week, allTime });
    } catch {
      // Orchestrator not reachable
    }
  }, [orchestratorUrl]);

  useEffect(() => {
    fetchCompletedJobs();
    const interval = setInterval(fetchCompletedJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchCompletedJobs]);

  const handleToggle = async () => {
    if (status.running) {
      await stopWorker();
    } else {
      await startWorker(orchestratorUrl);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Worker Node</h1>
          <p className="text-sm text-slate-400 mt-1">Earn FUS by running browser automation tasks</p>
        </div>
        <button
          onClick={() => setShowConsole(!showConsole)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showConsole
              ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Console
          {logs.length > 0 && (
            <span className="bg-slate-700 text-slate-300 rounded-full px-1.5 py-0.5 text-[10px]">
              {logs.length}
            </span>
          )}
        </button>
      </div>

      {/* Console Panel */}
      {showConsole && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
            <span className="text-xs text-slate-400 font-mono">Service Logs</span>
            <div className="flex items-center gap-2">
              {logs.length > 0 && (
                <span className="text-[10px] text-slate-600">{logs.length} lines</span>
              )}
            </div>
          </div>
          <div ref={logsContainerRef} className="max-h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed scrollbar-thin">
            {logs.length === 0 ? (
              <p className="text-slate-600">No logs yet. Start the worker to see output.</p>
            ) : (
              logs.map((line, i) => {
                let color = 'text-slate-400';
                if (line.includes('/err]') || line.includes('error') || line.includes('Fatal') || line.includes('failed')) {
                  color = 'text-red-400';
                } else if (line.includes('Connected') || line.includes('Registered') || line.includes('ready') || line.includes('Ready')) {
                  color = 'text-emerald-400';
                } else if (line.includes('[cleanup]') || line.includes('[system]')) {
                  color = 'text-amber-400';
                } else if (line.includes('Started')) {
                  color = 'text-cyan-400';
                }
                return (
                  <div key={i} className={`${color} whitespace-pre-wrap break-all`}>
                    {line}
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* System Requirements */}
      <DependencyPanel onAllReady={setDepsReady} />

      {/* Worker Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              status.running ? 'bg-emerald-400/10' : 'bg-slate-800'
            }`}>
              <svg className={`w-6 h-6 ${status.running ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-50">
                {status.running ? 'Worker Active' : 'Worker Idle'}
              </h3>
              <p className="text-sm text-slate-400">
                {loading
                  ? 'Starting services...'
                  : status.running
                    ? status.activeJob
                      ? `Processing job ${status.activeJob.slice(0, 8)}...`
                      : 'Ready — listening for jobs on the network'
                    : 'Toggle to start accepting jobs'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={loading || (!depsReady && !status.running)}
            title={!depsReady && !status.running ? 'Install all dependencies first' : undefined}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              loading ? 'bg-amber-400 animate-pulse' :
              status.running ? 'bg-emerald-400' :
              !depsReady ? 'bg-slate-800 opacity-40 cursor-not-allowed' : 'bg-slate-700'
            }`}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
              status.running || loading ? 'translate-x-7' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {status.running && (
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
              <p className="text-sm font-medium mt-1">
                {status.activeJob ? (
                  <span className="text-cyan-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Processing
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Ready
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Uptime</p>
              <p className="text-sm font-mono text-slate-200 mt-1">
                {Math.floor(status.uptimeMs / 60000)}m {Math.floor((status.uptimeMs % 60000) / 1000)}s
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">NATS</p>
              <p className="text-sm font-medium mt-1">
                <span className={`flex items-center gap-1.5 ${status.natsRunning ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.natsRunning ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {status.natsRunning ? 'Connected' : 'Down'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Orchestrator</p>
              <p className="text-sm font-medium mt-1">
                <span className={`flex items-center gap-1.5 ${status.orchestratorRunning ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.orchestratorRunning ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {status.orchestratorRunning ? 'Connected' : 'Down'}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      <EarningsWidget today={earnings.today} week={earnings.week} allTime={earnings.allTime} />

      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Recent Completed Jobs</h2>
        <div className="space-y-3">
          {completedJobs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-500">No completed jobs yet. Start the worker to begin earning FUS.</p>
            </div>
          ) : (
            completedJobs.map((job) => (
              <div key={job.id} className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{job.purpose}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{job.completedAt}</span>
                    <span>{job.duration}</span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-semibold text-emerald-400">+{job.reward.toFixed(2)} FUS</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

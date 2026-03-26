import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrchestrator } from '../hooks/useOrchestrator';
import StatusBadge from '../components/StatusBadge';
import LiveSessionView from '../components/LiveSessionView';
import type { Job } from '../components/JobCard';

interface ActionLogEntry {
  timestamp: string;
  action: string;
  detail?: string;
}

function buildActionLog(job: Job): ActionLogEntry[] {
  const entries: ActionLogEntry[] = [];

  if (job.createdAt) {
    entries.push({
      timestamp: job.createdAt,
      action: 'Job submitted',
      detail: job.purpose,
    });
  }

  if (job.assignedAt) {
    entries.push({
      timestamp: new Date(job.assignedAt).toISOString(),
      action: 'Worker assigned',
      detail: job.workerId ? `Worker ${job.workerId.slice(0, 12)}...` : undefined,
    });
  }

  if (job.steps && job.steps > 0) {
    entries.push({
      timestamp: job.assignedAt
        ? new Date(job.assignedAt + 1000).toISOString()
        : new Date().toISOString(),
      action: 'Browser launched',
      detail: `${job.steps} steps executed`,
    });
  }

  if (job.status === 'completed' && job.completedAt) {
    entries.push({
      timestamp: new Date(job.completedAt).toISOString(),
      action: 'Job completed',
    });
  }

  if (job.status === 'failed') {
    entries.push({
      timestamp: job.completedAt
        ? new Date(job.completedAt).toISOString()
        : new Date().toISOString(),
      action: 'Job failed',
      detail: job.failReason ?? 'Unknown error',
    });
  }

  return entries;
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getJob } = useOrchestrator();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;

    const poll = async () => {
      const j = await getJob(id);
      if (!active) return;
      if (j) setJob(j);
      setLoading(false);
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [id, getJob]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-400">Job not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 rounded-lg bg-slate-800 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  const isActive = job.status === 'active' || job.status === 'running';
  const actionLog = buildActionLog(job);
  const cost = job.maxPriceAgr ?? 0;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/')}
            className="mt-1 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-50">{job.purpose}</h1>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={job.status} />
              {job.category && (
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">{job.category}</span>
              )}
              <span className="text-xs text-slate-500 font-mono">{id?.slice(0, 8)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Live Session - 2 cols */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Live Session</h2>
          <LiveSessionView jobId={id!} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Action Log */}
          <h2 className="text-sm font-semibold text-slate-300">Action Log</h2>
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 space-y-3 max-h-80 overflow-y-auto">
            {actionLog.length === 0 ? (
              <p className="text-xs text-slate-500">Waiting for events...</p>
            ) : (
              actionLog.map((entry, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${i === actionLog.length - 1 && isActive ? 'bg-cyan-400 animate-pulse' : entry.action.includes('failed') ? 'bg-red-400' : entry.action.includes('completed') ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    {i < actionLog.length - 1 && <div className="w-px flex-1 bg-slate-700 mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm text-slate-300">{entry.action}</p>
                    {entry.detail && <p className="text-xs text-slate-500 mt-0.5">{entry.detail}</p>}
                    <p className="text-[10px] text-slate-600 mt-0.5 font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Receipt panel */}
          {(job.status === 'completed' || job.status === 'failed') && (
            <>
              <h2 className="text-sm font-semibold text-slate-300 pt-2">Receipt</h2>
              <div className={`${job.status === 'completed' ? 'bg-emerald-400/5 border-emerald-400/20' : 'bg-red-400/5 border-red-400/20'} border rounded-xl p-4 space-y-2`}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Job ID</span>
                  <span className="text-slate-200 font-mono text-xs">{id?.slice(0, 12)}</span>
                </div>
                {job.agentId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Agent ID</span>
                    <span className="text-slate-200 font-mono text-xs">{job.agentId.slice(0, 12)}...</span>
                  </div>
                )}
                {job.workerId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Worker ID</span>
                    <span className="text-slate-200 font-mono text-xs">{job.workerId.slice(0, 12)}...</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Steps</span>
                  <span className="text-slate-200">{job.steps ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Duration</span>
                  <span className="text-slate-200">{job.elapsedMs ? `${Math.round(job.elapsedMs / 1000)}s` : '--'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Outcome</span>
                  <span className={job.status === 'completed' ? 'text-emerald-400' : 'text-red-400'}>
                    {job.status === 'completed' ? 'Completed' : 'Failed'}
                  </span>
                </div>
                {job.failReason && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Fault Class</span>
                    <span className="text-red-400 text-xs">{job.failReason}</span>
                  </div>
                )}
                <div className="border-t border-slate-700/50 pt-2 mt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Cost</span>
                    <span className={`font-semibold ${job.status === 'completed' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {cost.toFixed(2)} FUS
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

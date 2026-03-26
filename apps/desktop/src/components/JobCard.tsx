import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';

export interface Job {
  id: string;
  purpose: string;
  status: 'active' | 'completed' | 'failed' | 'pending' | 'running';
  category?: string;
  url?: string;
  createdAt: string;
  steps?: number;
  elapsedMs?: number;
  maxPriceAgr?: number;
  assignedAt?: number;
  completedAt?: number;
  failReason?: string;
  workerId?: string;
  agentId?: string;
}

interface JobCardProps {
  job: Job;
}

function formatElapsed(ms?: number): string {
  if (!ms) return '--';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function JobCard({ job }: JobCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/job/${job.id}`)}
      className="w-full text-left bg-slate-800 hover:bg-slate-750 border border-slate-700/50 rounded-xl p-4 transition-all hover:border-cyan-400/30 hover:shadow-lg hover:shadow-cyan-400/5 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate group-hover:text-slate-50">
            {job.purpose}
          </p>
          {job.url && (
            <p className="text-xs text-slate-500 truncate mt-1">{job.url}</p>
          )}
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        {job.category && (
          <span className="bg-slate-700/50 px-2 py-0.5 rounded-md">{job.category}</span>
        )}
        <span>{formatElapsed(job.elapsedMs)} elapsed</span>
        <span>{job.steps ?? 0} steps</span>
        <span className="ml-auto">{timeAgo(job.createdAt)}</span>
      </div>
    </button>
  );
}

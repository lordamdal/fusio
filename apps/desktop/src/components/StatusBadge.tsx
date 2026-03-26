interface StatusBadgeProps {
  status: 'active' | 'completed' | 'failed' | 'pending' | 'running';
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: { bg: 'bg-cyan-400/10', text: 'text-cyan-400', dot: 'bg-cyan-400', label: 'Active' },
  running: { bg: 'bg-cyan-400/10', text: 'text-cyan-400', dot: 'bg-cyan-400', label: 'Running' },
  completed: { bg: 'bg-emerald-400/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Completed' },
  failed: { bg: 'bg-red-400/10', text: 'text-red-400', dot: 'bg-red-400', label: 'Failed' },
  pending: { bg: 'bg-amber-400/10', text: 'text-amber-400', dot: 'bg-amber-400', label: 'Pending' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === 'active' || status === 'running' ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  );
}

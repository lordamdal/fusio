import { useState } from 'react';
import { useDependencyCheck } from '../hooks/useDependencyCheck';
import type { DependencyStatus } from '../hooks/useDependencyCheck';

interface Props {
  onAllReady?: (ready: boolean) => void;
}

function DepRow({
  label,
  dep,
  installing,
  onInstall,
  onDownload,
}: {
  label: string;
  dep: DependencyStatus['node'];
  installing: boolean;
  onInstall?: () => void;
  onDownload?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dep.installed ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{label}</span>
            {dep.installed && dep.version && (
              <span className="text-[10px] font-mono text-slate-500 truncate">{dep.version}</span>
            )}
          </div>
          {!dep.installed && dep.installHint && (
            <p className="text-[11px] text-slate-500 mt-0.5">{dep.installHint}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {dep.installed ? (
          <span className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-medium">Ready</span>
        ) : installing ? (
          <span className="text-[10px] text-amber-400 flex items-center gap-1.5">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Installing...
          </span>
        ) : onDownload ? (
          <button
            onClick={onDownload}
            className="text-[11px] px-2.5 py-1 bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 rounded-md hover:bg-cyan-400/20 transition-colors"
          >
            Download
          </button>
        ) : onInstall ? (
          <button
            onClick={onInstall}
            className="text-[11px] px-2.5 py-1 bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 rounded-md hover:bg-cyan-400/20 transition-colors"
          >
            {label === 'Browser Image' ? 'Build' : 'Install'}
          </button>
        ) : (
          <span className="text-[10px] text-red-400/70 uppercase tracking-wider font-medium">Missing</span>
        )}
      </div>
    </div>
  );
}

export default function DependencyPanel({ onAllReady }: Props) {
  const { status, checking, installing, installDep, openDockerDownload, checkDeps } = useDependencyCheck();
  const [expanded, setExpanded] = useState(true);

  // Notify parent of readiness
  if (onAllReady) {
    onAllReady(status.allReady);
  }

  if (checking) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Checking system requirements...
        </div>
      </div>
    );
  }

  // Collapsed state when all ready
  if (status.allReady && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full bg-emerald-400/5 border border-emerald-400/20 rounded-xl px-4 py-3 flex items-center justify-between hover:bg-emerald-400/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm text-emerald-400 font-medium">All system requirements met</span>
        </div>
        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">System Requirements</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={checkDeps}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            Refresh
          </button>
          {status.allReady && (
            <button
              onClick={() => setExpanded(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-1 divide-y divide-slate-800/50">
        <DepRow
          label="Node.js"
          dep={status.node}
          installing={installing === 'node'}
          onInstall={!status.node.installed ? () => installDep('node') : undefined}
        />
        <DepRow
          label="NATS Server"
          dep={status.nats}
          installing={installing === 'nats'}
          onInstall={!status.nats.installed ? () => installDep('nats') : undefined}
        />
        <DepRow
          label="Docker Desktop"
          dep={status.docker}
          installing={false}
          onDownload={!status.docker.installed ? openDockerDownload : undefined}
        />
        <DepRow
          label="Browser Image"
          dep={status.dockerImage}
          installing={installing === 'docker_image'}
          onInstall={!status.dockerImage.installed && status.docker.installed ? () => installDep('docker_image') : undefined}
        />
      </div>

      {!status.allReady && (
        <div className="px-4 py-3 bg-slate-800/30 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">
            {!status.docker.installed
              ? 'Docker Desktop is required for browser automation. Download and launch it to continue.'
              : !status.dockerImage.installed
                ? 'Click "Build" to create the browser container image (~1-2 min download).'
                : 'Install missing dependencies to enable the worker.'}
          </p>
        </div>
      )}
    </div>
  );
}

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
  optional,
  onInstall,
}: {
  label: string;
  dep: DependencyStatus['node'];
  installing: boolean;
  optional?: boolean;
  onInstall?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          dep.installed ? 'bg-emerald-400' : optional ? 'bg-amber-400' : 'bg-red-400'
        }`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{label}</span>
            {optional && <span className="text-[9px] text-slate-600 uppercase">optional</span>}
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
        ) : onInstall ? (
          <button
            onClick={onInstall}
            className="text-[11px] px-2.5 py-1 bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 rounded-md hover:bg-cyan-400/20 transition-colors"
          >
            {label === 'Browser Image' ? 'Build' : 'Install'}
          </button>
        ) : (
          <span className={`text-[10px] uppercase tracking-wider font-medium ${optional ? 'text-amber-400/70' : 'text-red-400/70'}`}>
            {optional ? 'Not installed' : 'Missing'}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DependencyPanel({ onAllReady }: Props) {
  const { status, checking, installing, installError, installDep, checkDeps, setupAll } = useDependencyCheck();
  const [expanded, setExpanded] = useState(true);

  // Notify parent — worker can start with just Node + NATS
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

  // Collapsed when core deps ready
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
          <span className="text-sm text-emerald-400 font-medium">
            Worker ready
            {(!status.docker.installed || !status.dockerImage.installed) && (
              <span className="text-amber-400 ml-2 text-xs font-normal">(Docker optional — needed for browser jobs)</span>
            )}
          </span>
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

      {/* Required */}
      <div className="px-4 py-1 divide-y divide-slate-800/50">
        <DepRow
          label="Node.js"
          dep={status.node}
          installing={installing === 'node' || installing === 'all'}
          onInstall={!status.node.installed ? () => installDep('node') : undefined}
        />
        <DepRow
          label="NATS Server"
          dep={status.nats}
          installing={installing === 'nats' || installing === 'all'}
          onInstall={!status.nats.installed ? () => installDep('nats') : undefined}
        />
      </div>

      {/* Optional — for browser jobs */}
      <div className="px-4 pt-1 pb-1 border-t border-slate-800/50">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider pt-1">Browser Jobs</p>
      </div>
      <div className="px-4 py-1 divide-y divide-slate-800/50">
        <DepRow
          label="Docker Desktop"
          dep={status.docker}
          installing={installing === 'docker' || installing === 'all'}
          optional
          onInstall={!status.docker.installed ? () => installDep('docker') : undefined}
        />
        <DepRow
          label="Browser Image"
          dep={status.dockerImage}
          installing={installing === 'docker_image' || installing === 'all'}
          optional
          onInstall={!status.dockerImage.installed && status.docker.installed ? () => installDep('docker_image') : undefined}
        />
      </div>

      {installError && (
        <div className="mx-4 mt-2 mb-1 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 text-[11px] text-red-400 font-mono break-all">
          {installError}
        </div>
      )}

      {!status.allReady && (
        <div className="px-4 py-3 bg-slate-800/30 border-t border-slate-800 space-y-3">
          <button
            onClick={setupAll}
            disabled={installing === 'all'}
            className="w-full py-2.5 rounded-lg bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {installing === 'all' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Setting up... this may take a few minutes
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Install Everything Automatically
              </>
            )}
          </button>
          <p className="text-[10px] text-slate-600 text-center">
            Installs all missing dependencies automatically (including Homebrew if needed)
          </p>
        </div>
      )}
    </div>
  );
}

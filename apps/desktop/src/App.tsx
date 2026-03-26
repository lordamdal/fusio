import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import RequesterHome from './pages/RequesterHome';
import Onboarding from './pages/Onboarding';
import JobDetail from './pages/JobDetail';
import WorkerHome from './pages/WorkerHome';
import Credentials from './pages/Credentials';
import Settings from './pages/Settings';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useWallet } from './hooks/useWallet';

function ProtocolPrimitives({ connected, hasWallet, workerCount }: { connected: boolean; hasWallet: boolean; workerCount: number }) {
  const primitives = [
    { label: 'Identity', ok: hasWallet },
    { label: 'Routing', ok: connected && workerCount > 0 },
    { label: 'Settlement', ok: connected },
    { label: 'Accountability', ok: true },
  ];

  return (
    <div className="px-4 py-3 border-t border-slate-800">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Protocol Primitives</p>
      <div className="grid grid-cols-2 gap-1.5">
        {primitives.map((p) => (
          <div key={p.label} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${p.ok ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span className={`text-[10px] ${p.ok ? 'text-slate-400' : 'text-slate-600'}`}>{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sidebar() {
  const connection = useConnectionStatus();
  const { wallet } = useWallet();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-cyan-400/10 text-cyan-400'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
    }`;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-50 tracking-tight">Fusio</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Protocol</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Requester
        </p>
        <NavLink to="/" className={linkClass} end>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          New Job
        </NavLink>

        <div className="pt-3">
          <p className="px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Worker
          </p>
          <NavLink to="/worker" className={linkClass}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Worker Node
          </NavLink>
        </div>

        <div className="pt-3">
          <p className="px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Account
          </p>
          <NavLink to="/credentials" className={linkClass}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Credentials
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </NavLink>
        </div>
      </nav>

      {/* Protocol Primitives */}
      <ProtocolPrimitives
        connected={connection.connected}
        hasWallet={wallet.hasKeypair}
        workerCount={connection.registeredWorkers}
      />

      {/* Connection Status */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connection.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-xs text-slate-500">
              {connection.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {connection.connected && connection.registeredWorkers > 0 && (
            <span className="text-[10px] text-slate-500">
              {connection.registeredWorkers} worker{connection.registeredWorkers !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {connection.version && (
          <p className="text-[10px] text-slate-600 mt-1">v{connection.version}</p>
        )}
      </div>
    </aside>
  );
}

function AppRoutes() {
  const location = useLocation();
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('fusio_onboarded') === 'true');

  useEffect(() => {
    // Re-check on route change (onboarding sets this)
    setOnboarded(localStorage.getItem('fusio_onboarded') === 'true');
  }, [location.pathname]);

  if (!onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<RequesterHome />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/job/:id" element={<JobDetail />} />
      <Route path="/worker" element={<WorkerHome />} />
      <Route path="/credentials" element={<Credentials />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-slate-950">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <AppRoutes />
        </main>
      </div>
    </BrowserRouter>
  );
}

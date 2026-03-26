import { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';

export default function Settings() {
  const [orchestratorUrl, setOrchestratorUrl] = useState('http://localhost:3000');
  const [natsUrl, setNatsUrl] = useState('nats://localhost:4222');
  const [localIp, setLocalIp] = useState('');
  const [cpuLimit, setCpuLimit] = useState(50);
  const [ramLimit, setRamLimit] = useState(50);
  const [saved, setSaved] = useState(false);
  const [appVersion, setAppVersion] = useState('0.1.0');
  const [detectedIp, setDetectedIp] = useState('');
  const { wallet, generateKeypair } = useWallet();

  useEffect(() => {
    setOrchestratorUrl(localStorage.getItem('fusio_orchestrator_url') ?? 'http://localhost:3000');
    setNatsUrl(localStorage.getItem('fusio_nats_url') ?? 'nats://localhost:4222');
    setLocalIp(localStorage.getItem('fusio_local_ip') ?? '');
    setCpuLimit(parseInt(localStorage.getItem('fusio_cpu_limit') ?? '50'));
    setRamLimit(parseInt(localStorage.getItem('fusio_ram_limit') ?? '50'));

    (async () => {
      try {
        if (window.__TAURI_INTERNALS__) {
          const { invoke } = await import('@tauri-apps/api/core');
          const v = await invoke<string>('get_app_version');
          setAppVersion(v);
          const ip = await invoke<string>('get_local_ip_address');
          setDetectedIp(ip);
        }
      } catch {
        // Keep defaults
      }
    })();
  }, []);

  function handleSave() {
    localStorage.setItem('fusio_orchestrator_url', orchestratorUrl);
    localStorage.setItem('fusio_nats_url', natsUrl);
    localStorage.setItem('fusio_local_ip', localIp);
    localStorage.setItem('fusio_cpu_limit', String(cpuLimit));
    localStorage.setItem('fusio_ram_limit', String(ramLimit));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function copyWalletAddress() {
    if (wallet.address) navigator.clipboard.writeText(wallet.address);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure your Fusio desktop application</p>
      </div>

      {saved && (
        <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Settings saved successfully
        </div>
      )}

      {/* This Device */}
      {detectedIp && detectedIp !== '127.0.0.1' && (
        <div className="bg-cyan-400/5 border border-cyan-400/20 rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">This Device</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">LAN IP:</span>
            <code className="text-sm font-mono text-slate-50 bg-slate-800 px-3 py-1 rounded">{detectedIp}</code>
          </div>
          <div className="mt-3 bg-slate-900/50 rounded-lg p-4 space-y-2">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">To connect another device to this machine, use:</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-slate-500">Orchestrator URL</p>
                <code className="text-xs font-mono text-cyan-400">{`http://${detectedIp}:3000`}</code>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">NATS URL</p>
                <code className="text-xs font-mono text-cyan-400">{`nats://${detectedIp}:4222`}</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Network Config */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Network</h3>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Orchestrator URL</label>
          <input
            type="text"
            value={orchestratorUrl}
            onChange={(e) => setOrchestratorUrl(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-50 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">NATS URL</label>
          <input
            type="text"
            value={natsUrl}
            onChange={(e) => setNatsUrl(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-50 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Local IP (Worker)</label>
          <input
            type="text"
            value={localIp}
            onChange={(e) => setLocalIp(e.target.value)}
            placeholder={detectedIp ? `Auto-detected: ${detectedIp}` : 'Auto-detect (leave empty)'}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-50 font-mono text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400"
          />
          <p className="text-xs text-slate-500 mt-1">Your LAN IP for cross-machine communication. Leave empty to auto-detect.</p>
        </div>
      </div>

      {/* Worker Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Worker Resources</h3>
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">CPU Limit</span>
            <span className="text-cyan-400 font-mono">{cpuLimit}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={cpuLimit}
            onChange={(e) => setCpuLimit(parseInt(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">RAM Limit</span>
            <span className="text-cyan-400 font-mono">{ramLimit}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={ramLimit}
            onChange={(e) => setRamLimit(parseInt(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>
      </div>

      {/* Wallet */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Wallet</h3>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Wallet Address</label>
          <div className="flex gap-2">
            <code className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 font-mono text-sm truncate">
              {wallet.address ?? 'Not generated yet'}
            </code>
            {wallet.address ? (
              <button
                onClick={copyWalletAddress}
                className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors text-sm"
              >
                Copy
              </button>
            ) : (
              <button
                onClick={generateKeypair}
                className="px-4 py-2.5 bg-cyan-400 text-slate-950 rounded-lg text-sm font-semibold hover:bg-cyan-300 transition-colors"
              >
                Generate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full py-3 bg-cyan-400 text-slate-950 rounded-lg font-semibold hover:bg-cyan-300 transition-colors"
      >
        Save Settings
      </button>

      {/* App Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">App Version</p>
          <p className="text-sm font-mono text-slate-200">{appVersion}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Protocol</p>
          <p className="text-sm text-slate-200">fusio.space</p>
        </div>
      </div>
    </div>
  );
}

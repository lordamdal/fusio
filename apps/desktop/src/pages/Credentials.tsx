import { useState, useEffect } from 'react';

interface Credential {
  id: string;
  service: string;
  keyPreview: string;
  addedAt: string;
}

const STORAGE_KEY = 'fusio_credentials';

function loadCredentials(): Credential[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCredentials(creds: Credential[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export default function Credentials() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newService, setNewService] = useState('');
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    setCredentials(loadCredentials());
  }, []);

  const handleAdd = () => {
    if (!newService.trim() || !newKey.trim()) return;
    const cred: Credential = {
      id: crypto.randomUUID(),
      service: newService.trim(),
      keyPreview: newKey.slice(0, 6) + '...' + newKey.slice(-4),
      addedAt: new Date().toLocaleDateString(),
    };
    const updated = [...credentials, cred];
    setCredentials(updated);
    saveCredentials(updated);
    setNewService('');
    setNewKey('');
    setShowForm(false);
  };

  const handleRemove = (id: string) => {
    const updated = credentials.filter((c) => c.id !== id);
    setCredentials(updated);
    saveCredentials(updated);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Credentials</h1>
          <p className="text-sm text-slate-400 mt-1">Manage API keys for connected services</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add API Key
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">Add New API Key</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Service Name</label>
              <input
                type="text"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                placeholder="e.g., OpenAI, Anthropic"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-50 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">API Key</label>
              <input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-50 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newService.trim() || !newKey.trim()}
              className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-50"
            >
              Save Key
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {credentials.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No API keys configured. Add one to get started.</p>
          </div>
        ) : (
          credentials.map((cred) => (
            <div key={cred.id} className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{cred.service}</p>
                  <p className="text-xs text-slate-500 font-mono">{cred.keyPreview}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600">{cred.addedAt}</span>
                <button
                  onClick={() => handleRemove(cred.id)}
                  className="p-1.5 rounded-lg hover:bg-red-400/10 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500">
          API keys are stored locally on your device and are never transmitted to Fusio servers.
          In production, keys are injected into worker VMs via scoped proxy tokens from the Vault.
        </p>
      </div>
    </div>
  );
}

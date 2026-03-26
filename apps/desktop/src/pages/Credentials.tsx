import { useState, useEffect } from 'react';
import { useWebSession, type WebSessionProvider } from '../hooks/useWebSession';

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
  const [showWarning, setShowWarning] = useState(false);
  const { sessions, loginInProgress, error: webSessionError, startLogin, removeSession, refreshSession, getSession } = useWebSession();

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

      {/* Connect Web Account Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Web Account Sessions</h2>
            <p className="text-sm text-slate-400 mt-1">Use your existing Claude or ChatGPT subscription</p>
          </div>
        </div>

        {/* Warning banner */}
        <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
          <button
            onClick={() => setShowWarning(!showWarning)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm font-medium text-amber-400">Your subscription is cheaper, but...</span>
            </div>
            <svg className={`w-4 h-4 text-amber-400 transition-transform ${showWarning ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showWarning && (
            <div className="mt-3 text-xs text-slate-400 space-y-2">
              <p>Web session proxy is <strong className="text-slate-300">10-100x slower</strong> than API calls (30-60s per response vs instant).</p>
              <p>Sessions may <strong className="text-slate-300">break when providers update their UI</strong> and may violate provider Terms of Service. Your account could be restricted.</p>
              <p><strong className="text-slate-300">API keys are recommended</strong> for production use.</p>
            </div>
          )}
        </div>

        {webSessionError && (
          <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-3">
            <p className="text-sm text-red-400">{webSessionError}</p>
          </div>
        )}

        {/* Provider cards */}
        <div className="grid grid-cols-2 gap-4">
          {(['claude', 'openai'] as WebSessionProvider[]).map((provider) => {
            const session = getSession(provider);
            const isLoggingIn = loginInProgress === provider;
            const providerName = provider === 'claude' ? 'Claude' : 'ChatGPT';
            const providerColor = provider === 'claude' ? 'text-orange-400' : 'text-emerald-400';
            const providerBg = provider === 'claude' ? 'bg-orange-400/10' : 'bg-emerald-400/10';

            return (
              <div key={provider} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${providerBg} flex items-center justify-center`}>
                    <span className={`text-lg font-bold ${providerColor}`}>{providerName[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{providerName}</p>
                    {session?.status === 'active' && (
                      <p className="text-xs text-emerald-400">Connected</p>
                    )}
                    {session?.status === 'expired' && (
                      <p className="text-xs text-amber-400">Session expired</p>
                    )}
                    {(!session || session.status === 'none') && (
                      <p className="text-xs text-slate-500">Not connected</p>
                    )}
                  </div>
                </div>

                {/* Status-specific warnings */}
                {session?.status === 'active' && (
                  <p className="text-xs text-slate-500">Responses may take 30-60s vs instant with API keys</p>
                )}
                {session?.status === 'expired' && (
                  <p className="text-xs text-amber-400/80">Log in again to continue using your subscription</p>
                )}

                <div className="flex gap-2">
                  {(!session || session.status === 'none' || session.status === 'expired') ? (
                    <button
                      onClick={() => startLogin(provider)}
                      disabled={isLoggingIn}
                      className="flex-1 px-3 py-2 rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      title="Use your existing subscription instead of paying for API access. Cheaper but slower and less reliable."
                    >
                      {isLoggingIn ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Logging in...
                        </>
                      ) : (
                        session?.status === 'expired' ? 'Reconnect' : 'Log In'
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => refreshSession(provider)}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        Refresh Session
                      </button>
                      <button
                        onClick={() => removeSession(provider)}
                        className="px-3 py-2 rounded-lg hover:bg-red-400/10 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                {session?.capturedAt && (
                  <p className="text-xs text-slate-600">
                    Connected {new Date(session.capturedAt).toLocaleDateString()}
                    {session.expiresAt && ` · Expires ${new Date(session.expiresAt).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500">
          API keys are stored locally on your device and are never transmitted to Fusio servers.
          In production, keys are injected into worker VMs via scoped proxy tokens from the Vault.
          Web sessions are stored securely and used to proxy requests through the provider's web interface.
        </p>
      </div>
    </div>
  );
}

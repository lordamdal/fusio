import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';

type Role = 'requester' | 'worker' | null;

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>(null);
  const [apiKey, setApiKey] = useState('');
  const [walletGenerated, setWalletGenerated] = useState(false);
  const navigate = useNavigate();
  const { generateKeypair } = useWallet();

  const handleGetStarted = async () => {
    // Generate wallet if not already done
    if (!walletGenerated) {
      await generateKeypair();
      setWalletGenerated(true);
    }

    // Save role
    if (role) {
      localStorage.setItem('fusio_role', role);
    }

    // Save API key as credential if requester
    if (role === 'requester' && apiKey.trim()) {
      const cred = {
        id: crypto.randomUUID(),
        service: 'OpenAI',
        keyPreview: apiKey.slice(0, 6) + '...' + apiKey.slice(-4),
        addedAt: new Date().toLocaleDateString(),
      };
      const existing = JSON.parse(localStorage.getItem('fusio_credentials') || '[]');
      localStorage.setItem('fusio_credentials', JSON.stringify([...existing, cred]));
    }

    // Mark onboarding complete
    localStorage.setItem('fusio_onboarded', 'true');

    navigate(role === 'worker' ? '/worker' : '/');
  };

  // Generate keypair when entering step 2
  const handleContinueToReady = async () => {
    if (!walletGenerated) {
      await generateKeypair();
      setWalletGenerated(true);
    }
    setStep(2);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i <= step ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-500'
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 rounded ${i < step ? 'bg-cyan-400' : 'bg-slate-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-2xl">F</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-50">Welcome to Fusio</h2>
              <p className="text-slate-400 mt-2">Decentralized AI agent orchestration. Choose how you want to start.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setRole('requester'); setStep(1); }}
                className={`p-6 rounded-xl border-2 transition-all text-left ${
                  role === 'requester'
                    ? 'border-cyan-400 bg-cyan-400/5'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-50 mb-1">Run AI Tasks</h3>
                <p className="text-xs text-slate-400">Submit browser automation jobs to the Fusio network</p>
              </button>

              <button
                onClick={() => { setRole('worker'); setStep(1); }}
                className={`p-6 rounded-xl border-2 transition-all text-left ${
                  role === 'worker'
                    ? 'border-cyan-400 bg-cyan-400/5'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-400/10 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-50 mb-1">Earn FUS</h3>
                <p className="text-xs text-slate-400">Run a worker node and earn tokens for completing tasks</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Setup */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-50">
                {role === 'requester' ? 'Connect Your API Key' : 'Configure Worker'}
              </h2>
              <p className="text-slate-400 mt-2">
                {role === 'requester'
                  ? 'Enter your AI model API key to power agents on the network.'
                  : 'Your machine will run browser tasks and earn FUS tokens.'}
              </p>
            </div>

            {role === 'requester' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">API Key (optional)</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-50 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400"
                  />
                  <p className="text-xs text-slate-500 mt-2">Stored locally on your device. You can add this later in Credentials.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Platform</span>
                    <span className="text-sm font-mono text-cyan-400">macOS (Apple Silicon)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Docker Required</span>
                    <span className="text-sm font-mono text-cyan-400">Yes</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Browser Container</span>
                    <span className="text-sm font-mono text-cyan-400">fusio-browser:latest</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="px-6 py-2.5 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleContinueToReady}
                className="flex-1 px-6 py-2.5 rounded-lg bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Ready */}
        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-50">You're All Set!</h2>
              <p className="text-slate-400 mt-2">
                {role === 'requester'
                  ? 'Start submitting AI jobs to the Fusio network.'
                  : 'Your worker node is ready to start earning FUS.'}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${walletGenerated ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className="text-sm text-slate-300">
                  {walletGenerated ? 'Wallet generated (Ed25519 keypair)' : 'Generating wallet...'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-slate-300">
                  {role === 'requester'
                    ? apiKey ? 'API key configured' : 'API key skipped (add later)'
                    : 'Worker configured'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-slate-300">Ready to connect to orchestrator</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleGetStarted}
                className="flex-1 px-6 py-2.5 rounded-lg bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

interface LiveSessionViewProps {
  jobId: string;
  orchestratorUrl?: string;
}

export default function LiveSessionView({ jobId, orchestratorUrl = 'http://localhost:3000' }: LiveSessionViewProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchScreenshot = async () => {
      try {
        const res = await fetch(`${orchestratorUrl}/jobs/${jobId}`);
        if (!res.ok) throw new Error('Failed to fetch job');
        const data = await res.json();

        if (!active) return;

        if (data.latestScreenshot) {
          setScreenshot(data.latestScreenshot);
          setError(null);
        }
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Connection error');
        setLoading(false);
      }
    };

    fetchScreenshot();
    const interval = setInterval(fetchScreenshot, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [jobId, orchestratorUrl]);

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 mt-3">Connecting to session...</p>
        </div>
      </div>
    );
  }

  if (error && !screenshot) {
    return (
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center mx-auto">
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400 mt-3">No live session available</p>
          <p className="text-xs text-slate-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <span className="text-[11px] text-slate-500 font-mono">Live Session</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[11px] text-cyan-400">Live</span>
        </div>
      </div>
      {screenshot ? (
        <img
          src={screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`}
          alt="Live session screenshot"
          className="w-full h-auto"
        />
      ) : (
        <div className="aspect-video bg-slate-900 flex items-center justify-center">
          <p className="text-sm text-slate-600">Waiting for screenshot...</p>
        </div>
      )}
    </div>
  );
}

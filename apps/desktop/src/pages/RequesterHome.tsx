import { useState, useRef, useEffect } from 'react';
import { useOrchestrator } from '../hooks/useOrchestrator';
import type { JobCategory } from '../hooks/useOrchestrator';
import { useWallet } from '../hooks/useWallet';
import LiveSessionView from '../components/LiveSessionView';
import StatusBadge from '../components/StatusBadge';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  jobId?: string;
  jobStatus?: string;
}

function inferCategory(text: string): JobCategory {
  const lower = text.toLowerCase();
  if (lower.includes('scrape') || lower.includes('extract') || lower.includes('price') || lower.includes('data'))
    return 'data.scrape';
  if (lower.includes('monitor') || lower.includes('watch') || lower.includes('track') || lower.includes('alert'))
    return 'data.monitor';
  if (lower.includes('write') || lower.includes('create') || lower.includes('generate') || lower.includes('draft'))
    return 'content.creation';
  if (lower.includes('publish') || lower.includes('post') || lower.includes('upload'))
    return 'content.publish';
  if (lower.includes('test') || lower.includes('ping') || lower.includes('check'))
    return 'test.ping';
  return 'content.research';
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function RequesterHome() {
  const { jobs, submitJob } = useOrchestrator();
  const { wallet } = useWallet();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: 'What do you need done? Describe the task and I\'ll dispatch it to a worker node on the Fusio network.',
      timestamp: Date.now(),
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track active job completion
  const activeJob = activeJobId ? jobs.find((j) => j.id === activeJobId) : null;

  useEffect(() => {
    if (!activeJob || !activeJobId) return;
    if (activeJob.status !== 'completed' && activeJob.status !== 'failed') return;

    const alreadyNotified = messages.some(
      (m) => m.jobId === activeJobId && (m.content.includes('completed') || m.content.includes('failed'))
    );
    if (alreadyNotified) return;

    if (activeJob.status === 'completed') {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          content: `Job completed. ${activeJob.steps ?? 0} steps, ${activeJob.elapsedMs ? Math.round(activeJob.elapsedMs / 1000) + 's' : '--'}. Cost: ${(activeJob.maxPriceAgr ?? 0).toFixed(2)} FUS.`,
          timestamp: Date.now(),
          jobId: activeJobId,
          jobStatus: 'completed',
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          content: `Job failed: ${activeJob.failReason ?? 'Unknown error'}`,
          timestamp: Date.now(),
          jobId: activeJobId,
          jobStatus: 'failed',
        },
      ]);
    }
    setActiveJobId(null);
  }, [activeJob, activeJobId, messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || submitting) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() },
    ]);
    setInput('');
    setSubmitting(true);

    const jobId = crypto.randomUUID();
    const agentId = wallet.address ?? 'anonymous-agent';
    const agentSignature = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const category = inferCategory(text);

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'agent',
        content: `Routing job to network... [${category}]`,
        timestamp: Date.now(),
      },
    ]);

    const job = await submitJob({
      jobId,
      agentId,
      agentSignature,
      capability: 'browser.full',
      estimatedMinutes: 5,
      maxPriceAgr: 1.0,
      browser: 'chromium',
      declaredPurpose: text,
      category,
      memoryPolicy: 'ephemeral',
      failoverPolicy: 'migrate',
      createdAt: Date.now(),
    });

    if (job) {
      setActiveJobId(job.id);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          content: 'Worker assigned. Browser session starting...',
          timestamp: Date.now(),
          jobId: job.id,
          jobStatus: 'active',
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          content: 'No workers available. Start the orchestrator and connect a worker node.',
          timestamp: Date.now(),
          jobStatus: 'failed',
        },
      ]);
    }

    setSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[70%] bg-slate-800 border border-slate-700 rounded-2xl rounded-br-sm px-4 py-3">
                  <p className="text-sm text-slate-100 whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-[10px] text-slate-600 mt-1.5 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-start gap-3 max-w-[85%]">
                <div className="w-7 h-7 rounded-lg bg-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-slate-950 font-bold text-[10px]">F</span>
                </div>
                <div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-sm px-4 py-3">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{msg.content}</p>
                    {msg.jobStatus && (
                      <div className="mt-2">
                        <StatusBadge status={msg.jobStatus as 'active' | 'completed' | 'failed'} />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1 ml-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}

            {/* Live session inline for active jobs */}
            {msg.jobId && msg.jobStatus === 'active' && activeJobId === msg.jobId && (
              <div className="ml-10 mt-3 max-w-[80%]">
                <LiveSessionView jobId={msg.jobId} />
              </div>
            )}
          </div>
        ))}

        {submitting && (
          <div className="flex justify-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-400 flex items-center justify-center flex-shrink-0">
              <span className="text-slate-950 font-bold text-[10px]">F</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-slate-500">Routing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Jobs bar */}
      {jobs.length > 0 && (
        <div className="px-6 py-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider whitespace-nowrap font-medium">Jobs</span>
            {jobs.slice(0, 6).map((job) => (
              <button
                key={job.id}
                onClick={() => {
                  if (job.status === 'active' || job.status === 'running') {
                    setActiveJobId(job.id);
                  }
                }}
                className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg px-2.5 py-1 hover:border-cyan-400/30 transition-colors whitespace-nowrap group"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${
                  job.status === 'active' || job.status === 'running' ? 'bg-cyan-400 animate-pulse' :
                  job.status === 'completed' ? 'bg-emerald-400' :
                  job.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                }`} />
                <span className="text-[11px] text-slate-400 truncate max-w-[120px] group-hover:text-slate-200">{job.purpose}</span>
                <span className="text-[10px] text-slate-600">{timeAgo(new Date(job.createdAt).getTime())}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-slate-800 bg-slate-950">
        {/* Error feedback is shown inline in chat messages */}
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the task..."
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 focus:border-cyan-400/40 resize-none max-h-32"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || submitting}
            className="w-10 h-10 rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center hover:bg-cyan-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-slate-600 text-center mt-2">
          Jobs run on decentralized worker nodes via the Fusio Protocol
        </p>
      </div>
    </div>
  );
}

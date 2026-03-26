import { useState, useEffect, useCallback } from 'react';
import type { Job } from '../components/JobCard';

export type JobCategory =
  | 'content.research'
  | 'content.creation'
  | 'content.publish'
  | 'data.scrape'
  | 'data.monitor'
  | 'form.submit'
  | 'test.ping';

export type MemoryPolicy = 'ephemeral' | 'persistent';
export type FailoverPolicy = 'abort' | 'migrate';

export interface JobManifest {
  jobId: string;
  agentId: string;
  agentSignature: string;
  capability: string;
  estimatedMinutes: number;
  maxPriceAgr: number;
  browser: 'chromium' | 'firefox' | 'webkit';
  declaredPurpose: string;
  category: JobCategory;
  memoryPolicy: MemoryPolicy;
  failoverPolicy: FailoverPolicy;
  createdAt: number;
  url?: string;
}

interface UseOrchestratorOptions {
  baseUrl?: string;
  pollInterval?: number;
}

function mapJobRecord(j: Record<string, unknown>): Job {
  const manifest = (j.manifest ?? {}) as Record<string, unknown>;
  const createdAt = j.createdAt as number | undefined;
  const completedAt = j.completedAt as number | undefined;
  const assignedAt = j.assignedAt as number | undefined;

  let elapsedMs: number | undefined;
  if (createdAt) {
    const endTime = completedAt ?? Date.now();
    elapsedMs = endTime - createdAt;
  }

  return {
    id: (j.jobId ?? j.id ?? '') as string,
    purpose: (manifest.declaredPurpose ?? j.purpose ?? j.description ?? 'Untitled') as string,
    status: (j.status ?? 'pending') as Job['status'],
    category: (manifest.category ?? j.category) as string | undefined,
    url: (manifest.url ?? j.url) as string | undefined,
    createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
    steps: (j.stepCount ?? j.steps ?? 0) as number,
    elapsedMs,
    maxPriceAgr: (manifest.maxPriceAgr ?? j.maxPriceAgr) as number | undefined,
    assignedAt: assignedAt,
    completedAt: completedAt,
    failReason: j.failReason as string | undefined,
    workerId: j.workerId as string | undefined,
    agentId: (manifest.agentId ?? j.agentId) as string | undefined,
  };
}

export function useOrchestrator(options: UseOrchestratorOptions = {}) {
  const {
    baseUrl = localStorage.getItem('fusio_orchestrator_url') || 'http://localhost:3000',
    pollInterval = 3000,
  } = options;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getJobs = useCallback(async (): Promise<Job[]> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${baseUrl}/jobs`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.jobs ?? []);
      const fetched: Job[] = arr.map((j: Record<string, unknown>) => mapJobRecord(j));
      setJobs(fetched);
      setError(null);
      return fetched;
    } catch {
      // Don't show error for connection failures — the sidebar already shows disconnected status
      return [];
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const getJob = useCallback(async (id: string): Promise<Job | null> => {
    try {
      const res = await fetch(`${baseUrl}/jobs/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      return mapJobRecord(j as Record<string, unknown>);
    } catch {
      return null;
    }
  }, [baseUrl]);

  const submitJob = useCallback(async (manifest: JobManifest): Promise<Job | null> => {
    try {
      const res = await fetch(`${baseUrl}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifest),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const j = await res.json();
      return {
        id: j.jobId ?? manifest.jobId,
        purpose: manifest.declaredPurpose,
        status: (j.status ?? 'active') as Job['status'],
        category: manifest.category,
        url: manifest.url,
        createdAt: new Date(manifest.createdAt).toISOString(),
        steps: 0,
        maxPriceAgr: manifest.maxPriceAgr,
        assignedAt: j.assignedAt,
        workerId: j.workerId,
        agentId: manifest.agentId,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit job');
      return null;
    }
  }, [baseUrl]);

  useEffect(() => {
    getJobs();
    const interval = setInterval(getJobs, pollInterval);
    return () => clearInterval(interval);
  }, [getJobs, pollInterval]);

  return { jobs, loading, error, submitJob, getJobs, getJob };
}

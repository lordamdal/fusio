import type { JobManifest } from '@fusio/protocol-types';

export type JobStatus = 'pending' | 'active' | 'completed' | 'failed' | 'aborted';

export interface JobRecord {
  jobId: string;
  manifest: JobManifest;
  status: JobStatus;
  workerId?: string;
  assignedAt?: number;
  completedAt?: number;
  stepCount: number;
  createdAt: number;
  lastHeartbeat?: number;
  failReason?: string;
}

const jobs = new Map<string, JobRecord>();

export function createJob(manifest: JobManifest): JobRecord {
  const record: JobRecord = {
    jobId: manifest.jobId,
    manifest,
    status: 'pending',
    stepCount: 0,
    createdAt: Date.now(),
  };
  jobs.set(manifest.jobId, record);
  return record;
}

export function assignWorker(jobId: string, workerId: string): JobRecord | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  job.status = 'active';
  job.workerId = workerId;
  job.assignedAt = Date.now();
  job.lastHeartbeat = Date.now();
  return job;
}

export function markCompleted(jobId: string): JobRecord | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  job.status = 'completed';
  job.completedAt = Date.now();
  return job;
}

export function markFailed(jobId: string, reason: string): JobRecord | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  job.status = 'failed';
  job.completedAt = Date.now();
  job.failReason = reason;
  return job;
}

export function updateHeartbeat(jobId: string): void {
  const job = jobs.get(jobId);
  if (job) {
    job.lastHeartbeat = Date.now();
  }
}

export function getJob(jobId: string): JobRecord | undefined {
  return jobs.get(jobId);
}

export function getAllJobs(): JobRecord[] {
  return Array.from(jobs.values());
}

export function getActiveJobs(): JobRecord[] {
  return Array.from(jobs.values()).filter((j) => j.status === 'active');
}

export function clear(): void {
  jobs.clear();
}

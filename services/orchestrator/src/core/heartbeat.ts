import { HEARTBEAT_TIMEOUT_MS } from '@fusio/protocol-types';
import * as jobStore from '../db/jobs.js';
import * as registry from './registry.js';
import * as ledger from './ledger.js';
import type { Logger } from 'pino';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startHeartbeatMonitor(logger: Logger, intervalMs = 5000): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    checkHeartbeats(logger);
  }, intervalMs);
}

export function stopHeartbeatMonitor(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export function checkHeartbeats(logger: Logger): void {
  const now = Date.now();
  const activeJobs = jobStore.getActiveJobs();

  for (const job of activeJobs) {
    if (!job.workerId || !job.lastHeartbeat) continue;

    const elapsed = now - job.lastHeartbeat;
    if (elapsed > HEARTBEAT_TIMEOUT_MS) {
      logger.warn(
        `[HEARTBEAT] Worker ${job.workerId} timed out for job ${job.jobId} (${elapsed}ms since last heartbeat)`
      );
      jobStore.markFailed(job.jobId, 'worker_fault: heartbeat timeout');
      ledger.returnEscrow(job.jobId);
      registry.markOffline(job.workerId);
    }
  }
}

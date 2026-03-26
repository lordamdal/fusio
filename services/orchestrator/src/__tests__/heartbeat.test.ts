import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as jobStore from '../db/jobs.js';
import * as registry from '../core/registry.js';
import * as ledger from '../core/ledger.js';
import { checkHeartbeats } from '../core/heartbeat.js';
import { generateKeypair, createManifest, HEARTBEAT_TIMEOUT_MS } from '@fusio/protocol-types';
import { pino } from 'pino';

const logger = pino({ level: 'silent' });

describe('Heartbeat monitor', () => {
  beforeEach(() => {
    jobStore.clear();
    registry.clear();
    ledger.clearAll();
    ledger.seedBalance('requester', 100);
  });

  it('should mark job failed and worker offline on heartbeat timeout', () => {
    const keypair = generateKeypair();
    const manifest = createManifest(
      {
        agentId: keypair.identity.agentId,
        capability: 'browse',
        estimatedMinutes: 5,
        maxPriceAgr: 1,
        browser: 'chromium',
        declaredPurpose: 'test',
        category: 'test.ping',
        memoryPolicy: 'ephemeral',
        failoverPolicy: 'abort',
      },
      keypair
    );

    // Setup worker and job
    registry.register('w1', 'tok', ['browse']);
    ledger.lockEscrow(manifest.jobId, manifest.agentId, 'w1', 1);
    jobStore.createJob(manifest);
    jobStore.assignWorker(manifest.jobId, 'w1');
    registry.markBusy('w1', manifest.jobId);

    // Simulate timeout by setting lastHeartbeat far in the past
    const job = jobStore.getJob(manifest.jobId)!;
    job.lastHeartbeat = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;

    checkHeartbeats(logger);

    const updated = jobStore.getJob(manifest.jobId)!;
    expect(updated.status).toBe('failed');
    expect(updated.failReason).toContain('worker_fault');

    const worker = registry.get('w1')!;
    expect(worker.status).toBe('offline');

    // Escrow should be returned
    expect(ledger.getEscrow(manifest.jobId)).toBeUndefined();
  });
});

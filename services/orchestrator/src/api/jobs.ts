import type { FastifyInstance } from 'fastify';
import type { NatsConnection } from 'nats';
import { StringCodec } from 'nats';
import {
  type JobManifest,
  JobManifestSchema,
  PROHIBITED_CATEGORIES,
  MOCK_AGR_ESCROW_AMOUNT,
} from '@fusio/protocol-types';
import * as jobStore from '../db/jobs.js';
import * as ledger from '../core/ledger.js';
import { findWorker } from '../core/matcher.js';
import * as registry from '../core/registry.js';
import { SUBJECTS } from '../messaging/subjects.js';

interface JobParams {
  id: string;
}

export function registerJobRoutes(app: FastifyInstance, nc: NatsConnection | null): void {
  const sc = StringCodec();

  app.post<{ Body: JobManifest }>('/jobs', async (request, reply) => {
    const manifest = request.body;

    // Validate schema
    const parsed = JobManifestSchema.safeParse(manifest);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid manifest',
        details: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    // Check prohibited categories
    if (PROHIBITED_CATEGORIES.includes(manifest.category)) {
      return reply.status(400).send({
        error: `Category '${manifest.category}' is prohibited`,
      });
    }

    // Find a worker
    const worker = findWorker(manifest.capability);
    if (!worker) {
      return reply.status(503).send({ error: 'No workers available' });
    }

    // Lock escrow
    const escrowAmount = manifest.maxPriceAgr || MOCK_AGR_ESCROW_AMOUNT;
    const locked = ledger.lockEscrow(
      manifest.jobId,
      manifest.agentId,
      worker.workerId,
      escrowAmount
    );
    if (!locked) {
      return reply.status(400).send({ error: 'Insufficient balance or escrow already locked' });
    }

    // Create job record
    const job = jobStore.createJob(manifest);
    jobStore.assignWorker(manifest.jobId, worker.workerId);
    registry.markBusy(worker.workerId, manifest.jobId);

    // Publish to NATS if connected
    if (nc) {
      try {
        nc.publish(
          SUBJECTS.JOB_ASSIGNED(worker.workerId),
          sc.encode(JSON.stringify(manifest))
        );
      } catch {
        // NATS publish failure is non-fatal
      }
    }

    return reply.status(201).send({
      jobId: manifest.jobId,
      status: 'active',
      workerId: worker.workerId,
      assignedAt: job.assignedAt,
    });
  });

  app.get<{ Params: JobParams }>('/jobs/:id', async (request, reply) => {
    const { id } = request.params;
    const job = jobStore.getJob(id);
    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    return job;
  });

  app.get('/jobs', async () => {
    return jobStore.getAllJobs();
  });
}

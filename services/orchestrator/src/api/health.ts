import type { FastifyInstance } from 'fastify';
import { PROTOCOL_VERSION, HEARTBEAT_TIMEOUT_MS } from '@fusio/protocol-types';
import * as jobStore from '../db/jobs.js';
import * as registry from '../core/registry.js';

const startTime = Date.now();

/** Workers are considered alive if they heartbeated within 2x the timeout. */
const WORKER_ALIVE_WINDOW_MS = HEARTBEAT_TIMEOUT_MS * 2;

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/health', async () => {
    return {
      status: 'ok',
      version: PROTOCOL_VERSION,
      activeJobs: jobStore.getActiveJobs().length,
      registeredWorkers: registry.getAlive(WORKER_ALIVE_WINDOW_MS).length,
      uptimeMs: Date.now() - startTime,
    };
  });
}

import type { FastifyInstance } from 'fastify';
import { PROTOCOL_VERSION } from '@fusio/protocol-types';
import * as jobStore from '../db/jobs.js';
import * as registry from '../core/registry.js';

const startTime = Date.now();

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/health', async () => {
    return {
      status: 'ok',
      version: PROTOCOL_VERSION,
      activeJobs: jobStore.getActiveJobs().length,
      registeredWorkers: registry.getAll().length,
      uptimeMs: Date.now() - startTime,
    };
  });
}

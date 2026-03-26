import type { FastifyInstance } from 'fastify';
import type { NatsConnection } from 'nats';
import { registerHealthRoutes } from './health.js';
import { registerJobRoutes } from './jobs.js';
import { registerWorkerRoutes } from './workers.js';

export function registerRoutes(app: FastifyInstance, nc: NatsConnection | null): void {
  registerHealthRoutes(app);
  registerJobRoutes(app, nc);
  registerWorkerRoutes(app);
}

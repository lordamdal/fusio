import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pino } from 'pino';
import { NATS_DEFAULT_URL, ORCHESTRATOR_HTTP_PORT } from '@fusio/protocol-types';
import { connectNats } from './messaging/nats.js';
import { registerRoutes } from './api/routes.js';
import { startHeartbeatMonitor } from './core/heartbeat.js';
import * as ledger from './core/ledger.js';

const port = parseInt(process.env['ORCHESTRATOR_PORT'] || String(ORCHESTRATOR_HTTP_PORT), 10);
const natsUrl = process.env['NATS_URL'] || NATS_DEFAULT_URL;
const logLevel = process.env['LOG_LEVEL'] || 'info';
const mockRequesterBalance = parseFloat(process.env['MOCK_REQUESTER_BALANCE'] || '100');
const mockWorkerBalance = parseFloat(process.env['MOCK_WORKER_BALANCE'] || '0');

const logger = pino({ level: logLevel });

async function main(): Promise<void> {
  // Seed mock balances
  ledger.seedBalance('requester', mockRequesterBalance);
  ledger.seedBalance('worker', mockWorkerBalance);

  // Connect to NATS (non-fatal if unavailable)
  const nc = await connectNats(natsUrl, logger, 5);

  // Create Fastify app
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  // Register routes
  registerRoutes(app, nc);

  // Start heartbeat monitor
  startHeartbeatMonitor(logger);

  // Start server
  await app.listen({ port, host: '0.0.0.0' });
  logger.info(`[ORCHESTRATOR] Fusio orchestrator v0.1.0-local-test ready on port ${port}`);
}

main().catch((err) => {
  logger.error(err, '[ORCHESTRATOR] Fatal error');
  process.exit(1);
});

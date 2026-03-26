import { StringCodec } from 'nats';
import {
  loadOrCreateKeypair,
  HEARTBEAT_INTERVAL_MS,
  WORKER_HTTP_PORT,
  type JobManifest,
} from '@fusio/protocol-types';
import { connectNats } from './messaging/nats.js';
import { SUBJECTS } from './messaging/subjects.js';
import { handleJob, state } from './runner.js';
import { startHealthServer } from './health.js';
import { pino } from 'pino';

const logger = pino({ name: 'worker', level: process.env['LOG_LEVEL'] ?? 'info' });
const sc = StringCodec();

async function registerWithOrchestrator(
  orchestratorUrl: string,
  workerId: string,
  localIp: string,
  workerPort: number
): Promise<string> {
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(`${orchestratorUrl}/workers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          capabilities: ['browser.full'],
          maxConcurrentJobs: 1,
          workerUrl: `http://${localIp}:${workerPort}`,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Registration failed: ${resp.status} ${resp.statusText}`);
      }

      const data = await resp.json() as { token: string };
      logger.info({ orchestratorUrl, workerId: workerId.substring(0, 12) }, 'Registered with orchestrator');
      return data.token;
    } catch (err) {
      logger.warn({ attempt, maxRetries, err: (err as Error).message }, 'Registration attempt failed');
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  throw new Error(`Failed to register with orchestrator after ${maxRetries} attempts`);
}

async function main() {
  const orchestratorUrl = process.env['ORCHESTRATOR_URL'];
  if (!orchestratorUrl) {
    logger.fatal('ORCHESTRATOR_URL environment variable is required');
    process.exit(1);
  }

  const natsUrl = process.env['NATS_URL'] ?? 'nats://localhost:4222';
  const workerPort = parseInt(process.env['WORKER_PORT'] ?? String(WORKER_HTTP_PORT), 10);
  const localIp = process.env['LOCAL_IP'] ?? '127.0.0.1';
  const dataDir = process.env['DATA_DIR'] ?? './data';

  // Load or create worker keypair
  const keypair = loadOrCreateKeypair(`${dataDir}/keys/worker.key`);
  const workerId = keypair.identity.agentId;
  logger.info({ workerId: workerId.substring(0, 12) }, 'Worker keypair loaded');

  // Connect to NATS
  const nc = await connectNats(natsUrl);

  // Register with orchestrator
  const sessionToken = await registerWithOrchestrator(orchestratorUrl, workerId, localIp, workerPort);

  // Subscribe to job assignments
  const sub = nc.subscribe(SUBJECTS.JOB_ASSIGNED(workerId));
  logger.info({ subject: SUBJECTS.JOB_ASSIGNED(workerId) }, 'Listening for job assignments');

  // Start health server
  const startTime = Date.now();
  await startHealthServer(workerPort, () => ({
    workerId,
    activeJob: state.activeJobId,
    uptimeMs: Date.now() - startTime,
  }));

  // Start heartbeat loop
  const heartbeatInterval = setInterval(async () => {
    try {
      await fetch(`${orchestratorUrl}/workers/${workerId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: state.activeJobId,
          step: state.currentStep,
          status: state.activeJobId ? 'active' : 'idle',
        }),
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Heartbeat failed');
    }
  }, HEARTBEAT_INTERVAL_MS);

  logger.info({ workerId: workerId.substring(0, 12), orchestratorUrl, workerPort }, '[WORKER] Worker ready');

  // Process job assignments
  for await (const msg of sub) {
    const manifest: JobManifest = JSON.parse(sc.decode(msg.data));
    // Handle one job at a time
    await handleJob(manifest, nc, keypair);
  }

  clearInterval(heartbeatInterval);
  await nc.close();
}

main().catch(err => {
  console.error('[WORKER] Fatal error:', err);
  process.exit(1);
});

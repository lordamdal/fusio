import Fastify from 'fastify';
import { pino } from 'pino';

const logger = pino({ name: 'worker-health' });

export async function startHealthServer(
  port: number,
  getStatus: () => { workerId: string; activeJob: string | null; uptimeMs: number }
) {
  const app = Fastify({ logger: false });

  app.get('/health', async () => {
    const status = getStatus();
    return {
      status: 'ok',
      workerId: status.workerId,
      activeJob: status.activeJob,
      uptimeMs: status.uptimeMs,
    };
  });

  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'Health endpoint ready');
  return app;
}

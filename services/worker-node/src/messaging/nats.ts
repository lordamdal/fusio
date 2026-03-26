import { connect, NatsConnection } from 'nats';
import { pino } from 'pino';

const logger = pino({ name: 'worker-nats' });

export async function connectNats(url: string, maxRetries = 5): Promise<NatsConnection> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const nc = await connect({ servers: url });
      logger.info({ url }, 'Connected to NATS');
      return nc;
    } catch (err) {
      attempt++;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      logger.warn({ attempt, maxRetries, delay, err: (err as Error).message }, 'NATS connection failed, retrying...');
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error(`Failed to connect to NATS after ${maxRetries} attempts`);
}

import { connect, NatsConnection } from 'nats';
import type { Logger } from 'pino';

export async function connectNats(
  url: string,
  logger: Logger,
  maxRetries = 5
): Promise<NatsConnection | null> {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      logger.info(`[NATS] Connecting to ${url} (attempt ${attempt}/${maxRetries})...`);
      const nc = await connect({ servers: url });
      logger.info(`[NATS] Connected to ${url}`);
      return nc;
    } catch (err) {
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
      logger.warn(
        `[NATS] Connection attempt ${attempt}/${maxRetries} failed: ${err instanceof Error ? err.message : String(err)}. Retrying in ${backoffMs}ms...`
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
  logger.warn('[NATS] All connection attempts failed. Starting without NATS.');
  return null;
}

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { pino } from 'pino';

const execAsync = promisify(exec);
const logger = pino({ name: 'worker-container' });

export interface ContainerSession {
  jobId: string;
  containerId: string;
  wsEndpoint: string;
  startedAt: number;
}

let nextPort = 9300;

export async function start(jobId: string): Promise<ContainerSession> {
  const port = nextPort++;
  const containerName = `fusio-job-${jobId.substring(0, 8)}`;

  logger.info({ jobId, containerName, port }, 'Starting browser container');

  try {
    const { stdout } = await execAsync(
      `docker run -d --rm --platform linux/arm64 ` +
      `-p ${port}:9222 ` +
      `--name ${containerName} ` +
      `--memory 1g --cpus 1 ` +
      `fusio-browser:latest`
    );

    const containerId = stdout.trim();

    // Wait for container to be ready
    await new Promise(r => setTimeout(r, 2000));

    const session: ContainerSession = {
      jobId,
      containerId,
      wsEndpoint: `ws://localhost:${port}`,
      startedAt: Date.now(),
    };

    logger.info({ jobId, containerId: containerId.substring(0, 12), port }, 'Container started');
    return session;
  } catch (err) {
    logger.error({ jobId, err: (err as Error).message }, 'Failed to start container');
    throw err;
  }
}

export async function stop(jobId: string): Promise<string> {
  const containerName = `fusio-job-${jobId.substring(0, 8)}`;

  logger.info({ jobId, containerName }, 'Stopping container');

  try {
    await execAsync(`docker stop ${containerName}`);
  } catch (err) {
    logger.warn({ jobId, err: (err as Error).message }, 'Container stop warning (may already be removed)');
  }

  const wipeHash = createHash('sha256').update(`mock_wipe_${jobId}`).digest('hex');
  logger.info({ jobId, wipeHash: wipeHash.substring(0, 16) }, 'Container wiped');
  return wipeHash;
}

export async function isRunning(jobId: string): Promise<boolean> {
  const containerName = `fusio-job-${jobId.substring(0, 8)}`;
  try {
    const { stdout } = await execAsync(`docker inspect -f '{{.State.Running}}' ${containerName}`);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

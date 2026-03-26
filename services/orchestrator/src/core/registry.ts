export interface WorkerRecord {
  workerId: string;
  token: string;
  capabilities: string[];
  status: 'idle' | 'busy' | 'offline';
  lastHeartbeat: number;
  registeredAt: number;
  currentJobId?: string;
}

const workers = new Map<string, WorkerRecord>();

export function register(workerId: string, token: string, capabilities: string[]): WorkerRecord {
  const record: WorkerRecord = {
    workerId,
    token,
    capabilities,
    status: 'idle',
    lastHeartbeat: Date.now(),
    registeredAt: Date.now(),
  };
  workers.set(workerId, record);
  return record;
}

/** 30s window — workers must have heartbeated recently to be considered available. */
const AVAILABLE_TIMEOUT_MS = 30_000;

export function getAvailable(capability: string): WorkerRecord | undefined {
  const now = Date.now();
  for (const worker of workers.values()) {
    if (
      worker.status === 'idle' &&
      worker.capabilities.includes(capability) &&
      now - worker.lastHeartbeat < AVAILABLE_TIMEOUT_MS
    ) {
      return worker;
    }
  }
  return undefined;
}

export function markBusy(workerId: string, jobId: string): void {
  const worker = workers.get(workerId);
  if (worker) {
    worker.status = 'busy';
    worker.currentJobId = jobId;
  }
}

export function markIdle(workerId: string): void {
  const worker = workers.get(workerId);
  if (worker) {
    worker.status = 'idle';
    worker.currentJobId = undefined;
  }
}

export function markOffline(workerId: string): void {
  const worker = workers.get(workerId);
  if (worker) {
    worker.status = 'offline';
    worker.currentJobId = undefined;
  }
}

export function updateHeartbeat(workerId: string): boolean {
  const worker = workers.get(workerId);
  if (!worker) return false;
  worker.lastHeartbeat = Date.now();
  return true;
}

export function getAll(): WorkerRecord[] {
  return Array.from(workers.values());
}

/** Return only workers whose last heartbeat is within the timeout window. */
export function getAlive(timeoutMs: number): WorkerRecord[] {
  const now = Date.now();
  return Array.from(workers.values()).filter(
    (w) => w.status !== 'offline' && now - w.lastHeartbeat < timeoutMs
  );
}

export function get(workerId: string): WorkerRecord | undefined {
  return workers.get(workerId);
}

export function clear(): void {
  workers.clear();
}

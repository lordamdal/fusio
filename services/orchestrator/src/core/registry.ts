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

export function getAvailable(capability: string): WorkerRecord | undefined {
  for (const worker of workers.values()) {
    if (worker.status === 'idle' && worker.capabilities.includes(capability)) {
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

export function get(workerId: string): WorkerRecord | undefined {
  return workers.get(workerId);
}

export function clear(): void {
  workers.clear();
}

import { getAvailable } from './registry.js';
import type { WorkerRecord } from './registry.js';

export function findWorker(capability: string): WorkerRecord | null {
  return getAvailable(capability) ?? null;
}

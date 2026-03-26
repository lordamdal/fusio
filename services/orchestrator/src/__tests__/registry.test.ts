import { describe, it, expect, beforeEach } from 'vitest';
import * as registry from '../core/registry.js';

describe('Registry', () => {
  beforeEach(() => {
    registry.clear();
  });

  it('should register a worker and list it', () => {
    registry.register('w1', 'token1', ['browse']);
    const all = registry.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].workerId).toBe('w1');
    expect(all[0].status).toBe('idle');
  });

  it('should mark worker busy and idle', () => {
    registry.register('w1', 'token1', ['browse']);
    registry.markBusy('w1', 'job-1');
    expect(registry.get('w1')?.status).toBe('busy');
    expect(registry.get('w1')?.currentJobId).toBe('job-1');

    registry.markIdle('w1');
    expect(registry.get('w1')?.status).toBe('idle');
    expect(registry.get('w1')?.currentJobId).toBeUndefined();
  });

  it('should return only idle workers with matching capability', () => {
    registry.register('w1', 'token1', ['browse']);
    registry.register('w2', 'token2', ['compute']);
    registry.register('w3', 'token3', ['browse']);
    registry.markBusy('w1', 'job-1');

    const available = registry.getAvailable('browse');
    expect(available).toBeDefined();
    expect(available!.workerId).toBe('w3');
  });

  it('should return undefined when no worker matches', () => {
    registry.register('w1', 'token1', ['compute']);
    const available = registry.getAvailable('browse');
    expect(available).toBeUndefined();
  });
});

import { describe, it, expect, vi } from 'vitest';

// Mock child_process before importing
vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd: string, cb: Function) => {
    if (cmd.includes('docker run')) {
      cb(null, { stdout: 'abc123containerid\n', stderr: '' });
    } else if (cmd.includes('docker stop')) {
      cb(null, { stdout: '', stderr: '' });
    } else if (cmd.includes('docker inspect')) {
      cb(null, { stdout: 'true\n', stderr: '' });
    } else {
      cb(null, { stdout: '', stderr: '' });
    }
  }),
}));

import * as container from '../browser/container.js';

describe('container', () => {
  it('starts a container with correct Docker flags', async () => {
    const { exec } = await import('node:child_process');
    const session = await container.start('test-job-id');

    expect(session.jobId).toBe('test-job-id');
    expect(session.containerId).toBe('abc123containerid');
    expect(session.wsEndpoint).toMatch(/^ws:\/\/localhost:\d+$/);
    expect(session.startedAt).toBeGreaterThan(0);

    // Verify docker run was called with correct flags
    const callArgs = (exec as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(callArgs).toContain('--platform linux/arm64');
    expect(callArgs).toContain('--memory 1g');
    expect(callArgs).toContain('--cpus 1');
    expect(callArgs).toContain('fusio-browser:latest');
  });

  it('stops a container and returns wipe hash', async () => {
    const wipeHash = await container.stop('test-job-id');
    expect(wipeHash).toBeTruthy();
    expect(wipeHash.length).toBe(64); // SHA-256 hex
  });

  it('checks if container is running', async () => {
    const running = await container.isRunning('test-job-id');
    expect(running).toBe(true);
  });
});

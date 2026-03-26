import { describe, it, expect, vi } from 'vitest';
import { execute } from '../browser/actions.js';
import type { ActionPacket } from '@fusio/protocol-types';

function createMockPage() {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    mouse: {
      click: vi.fn().mockResolvedValue(undefined),
      wheel: vi.fn().mockResolvedValue(undefined),
      move: vi.fn().mockResolvedValue(undefined),
    },
    keyboard: {
      type: vi.fn().mockResolvedValue(undefined),
      press: vi.fn().mockResolvedValue(undefined),
    },
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
  } as unknown as import('playwright').Page;
}

function makePacket(overrides: Partial<ActionPacket>): ActionPacket {
  return {
    jobId: 'test-job',
    step: 0,
    action: 'navigate',
    target: {},
    signedBy: 'test-agent',
    signature: 'test-sig',
    sentAt: Date.now(),
    ...overrides,
  };
}

describe('actions', () => {
  it('executes navigate action', async () => {
    const page = createMockPage();
    await execute(makePacket({ action: 'navigate', target: { url: 'https://example.com' } }), page);
    expect(page.goto).toHaveBeenCalledWith('https://example.com', { waitUntil: 'domcontentloaded' });
  });

  it('executes click action', async () => {
    const page = createMockPage();
    await execute(makePacket({ action: 'click', target: { x: 100, y: 200 } }), page);
    expect(page.mouse.click).toHaveBeenCalledWith(100, 200);
  });

  it('executes type action', async () => {
    const page = createMockPage();
    await execute(makePacket({ action: 'type', value: 'hello' }), page);
    expect(page.keyboard.type).toHaveBeenCalledWith('hello');
  });

  it('executes scroll action', async () => {
    const page = createMockPage();
    await execute(makePacket({ action: 'scroll', value: 'down' }), page);
    expect(page.mouse.wheel).toHaveBeenCalledWith(0, 300);
  });

  it('executes key action', async () => {
    const page = createMockPage();
    await execute(makePacket({ action: 'key', value: 'Enter' }), page);
    expect(page.keyboard.press).toHaveBeenCalledWith('Enter');
  });

  it('executes hover action', async () => {
    const page = createMockPage();
    await execute(makePacket({ action: 'hover', target: { x: 50, y: 75 } }), page);
    expect(page.mouse.move).toHaveBeenCalledWith(50, 75);
  });

  it('executes wait action', async () => {
    const page = createMockPage();
    await execute(makePacket({ action: 'wait', value: '2000' }), page);
    expect(page.waitForTimeout).toHaveBeenCalledWith(2000);
  });

  it('screenshot action is a no-op', async () => {
    const page = createMockPage();
    await execute(makePacket({ action: 'screenshot' }), page);
    // No Playwright calls should be made
    expect(page.goto).not.toHaveBeenCalled();
    expect(page.mouse.click).not.toHaveBeenCalled();
  });
});

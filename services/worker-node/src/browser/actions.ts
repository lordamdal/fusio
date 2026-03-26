import type { Page } from 'playwright';
import type { ActionPacket } from '@fusio/protocol-types';
import { pino } from 'pino';

const logger = pino({ name: 'worker-actions' });

export async function execute(packet: ActionPacket, page: Page): Promise<void> {
  logger.info({ jobId: packet.jobId, step: packet.step, action: packet.action }, 'Executing action');

  try {
    switch (packet.action) {
      case 'navigate':
        if (!packet.target.url) throw new Error('Navigate requires target.url');
        await page.goto(packet.target.url, { waitUntil: 'domcontentloaded' });
        break;

      case 'click':
        if (packet.target.x === undefined || packet.target.y === undefined) {
          throw new Error('Click requires target.x and target.y');
        }
        await page.mouse.click(packet.target.x, packet.target.y);
        break;

      case 'type':
        if (!packet.value) throw new Error('Type requires value');
        await page.keyboard.type(packet.value);
        break;

      case 'scroll': {
        const delta = packet.value === 'down' ? 300 : -300;
        await page.mouse.wheel(0, delta);
        break;
      }

      case 'screenshot':
        // No Playwright action needed — screenshot is captured after every action
        break;

      case 'wait': {
        const ms = parseInt(packet.value ?? '1000', 10);
        await page.waitForTimeout(ms);
        break;
      }

      case 'key':
        if (!packet.value) throw new Error('Key requires value');
        await page.keyboard.press(packet.value);
        break;

      case 'select': {
        if (packet.target.x === undefined || packet.target.y === undefined) {
          throw new Error('Select requires target coordinates');
        }
        // Click on the select element first, then use keyboard
        await page.mouse.click(packet.target.x, packet.target.y);
        if (packet.value) {
          await page.keyboard.type(packet.value);
          await page.keyboard.press('Enter');
        }
        break;
      }

      case 'hover':
        if (packet.target.x === undefined || packet.target.y === undefined) {
          throw new Error('Hover requires target.x and target.y');
        }
        await page.mouse.move(packet.target.x, packet.target.y);
        break;

      default:
        throw new Error(`Unknown action type: ${packet.action}`);
    }

    logger.info({ jobId: packet.jobId, step: packet.step, action: packet.action }, 'Action executed');
  } catch (err) {
    logger.error({ jobId: packet.jobId, step: packet.step, action: packet.action, err: (err as Error).message }, 'Action failed');
    throw err;
  }
}

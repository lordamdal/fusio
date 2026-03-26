import { chromium, Browser, Page } from 'playwright';
import { pino } from 'pino';

const logger = pino({ name: 'worker-playwright' });

export async function connectBrowser(wsEndpoint: string): Promise<{ browser: Browser; page: Page }> {
  logger.info({ wsEndpoint }, 'Connecting to browser via CDP');

  const browser = await chromium.connect(wsEndpoint);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  logger.info('Browser connected, page created');
  return { browser, page };
}

export async function captureScreenshot(page: Page): Promise<string> {
  const buffer = await page.screenshot({ type: 'png' });
  return buffer.toString('base64');
}

export async function captureDomSummary(page: Page): Promise<string> {
  const title = await page.title();
  const url = page.url();

  const counts = await page.evaluate(() => {
    const links = document.querySelectorAll('a:not([hidden])').length;
    const buttons = document.querySelectorAll('button:not([hidden]), input[type="button"]:not([hidden]), input[type="submit"]:not([hidden])').length;
    const inputs = document.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([hidden]), textarea:not([hidden]), select:not([hidden])').length;
    return { links, buttons, inputs };
  });

  return `Title: ${title} | URL: ${url} | Links: ${counts.links} | Buttons: ${counts.buttons} | Inputs: ${counts.inputs}`;
}

export async function disconnectBrowser(browser: Browser): Promise<void> {
  try {
    await browser.close();
    logger.info('Browser disconnected');
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Browser disconnect warning');
  }
}

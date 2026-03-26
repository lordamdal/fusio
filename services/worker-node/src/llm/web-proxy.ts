import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { pino } from 'pino';
import type { LLMRequest, LLMResponse, WebSessionData } from './interface.js';
import { SessionExpiredError, CaptchaError, RateLimitError } from './interface.js';

const logger = pino({ name: 'llm-web-proxy' });

interface ProviderAdapter {
  navigateToChat(page: Page): Promise<void>;
  sendMessage(page: Page, prompt: string): Promise<void>;
  waitForResponse(page: Page): Promise<string>;
  detectSessionExpired(page: Page): Promise<boolean>;
  detectCaptcha(page: Page): Promise<boolean>;
  detectRateLimit(page: Page): Promise<boolean>;
}

// ------- Claude Web Adapter -------

const claudeAdapter: ProviderAdapter = {
  async navigateToChat(page: Page): Promise<void> {
    await page.goto('https://claude.ai/new', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
  },

  async sendMessage(page: Page, prompt: string): Promise<void> {
    // Claude uses a contenteditable div for input
    const inputSelector = '[contenteditable="true"]';
    await page.waitForSelector(inputSelector, { timeout: 15000 });
    await page.click(inputSelector);
    await page.fill(inputSelector, prompt);

    // Press Enter to send (or click send button)
    const sendButton = page.locator('button[aria-label="Send Message"]');
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
  },

  async waitForResponse(page: Page): Promise<string> {
    // Wait for the streaming to start, then wait for it to finish
    // Detect completion by waiting for the "stop" button to disappear
    const stopButtonSelector = 'button[aria-label="Stop Response"]';

    // Wait for streaming to begin (stop button appears)
    try {
      await page.waitForSelector(stopButtonSelector, { timeout: 15000 });
    } catch {
      // Stop button may not appear for very fast responses
    }

    // Wait for streaming to end (stop button disappears)
    await page.waitForSelector(stopButtonSelector, { state: 'hidden', timeout: 120000 });

    // Extra pause for DOM to settle
    await page.waitForTimeout(1000);

    // Extract the last assistant message
    const responseText = await page.evaluate(() => {
      const messages = document.querySelectorAll('[data-is-streaming="false"]');
      const last = messages[messages.length - 1];
      return last?.textContent?.trim() ?? '';
    });

    // Fallback: try getting from the last message container
    if (!responseText) {
      const fallback = await page.evaluate(() => {
        const containers = document.querySelectorAll('.font-claude-message');
        const last = containers[containers.length - 1];
        return last?.textContent?.trim() ?? '';
      });
      return fallback;
    }

    return responseText;
  },

  async detectSessionExpired(page: Page): Promise<boolean> {
    const url = page.url();
    return url.includes('/login') || url.includes('/sign-in');
  },

  async detectCaptcha(page: Page): Promise<boolean> {
    const content = await page.content();
    return content.includes('captcha') || content.includes('Cloudflare');
  },

  async detectRateLimit(page: Page): Promise<boolean> {
    const content = await page.textContent('body') ?? '';
    return content.includes('too many') || content.includes('rate limit') || content.includes('usage limit');
  },
};

// ------- OpenAI Web Adapter -------

const openaiAdapter: ProviderAdapter = {
  async navigateToChat(page: Page): Promise<void> {
    await page.goto('https://chat.openai.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
  },

  async sendMessage(page: Page, prompt: string): Promise<void> {
    const inputSelector = '#prompt-textarea';
    await page.waitForSelector(inputSelector, { timeout: 15000 });
    await page.click(inputSelector);
    await page.fill(inputSelector, prompt);

    const sendButton = page.locator('button[data-testid="send-button"]');
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
  },

  async waitForResponse(page: Page): Promise<string> {
    const stopButtonSelector = 'button[data-testid="stop-button"]';

    try {
      await page.waitForSelector(stopButtonSelector, { timeout: 15000 });
    } catch {
      // May not appear for fast responses
    }

    await page.waitForSelector(stopButtonSelector, { state: 'hidden', timeout: 120000 });
    await page.waitForTimeout(1000);

    const responseText = await page.evaluate(() => {
      const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
      const last = messages[messages.length - 1];
      return last?.textContent?.trim() ?? '';
    });

    return responseText;
  },

  async detectSessionExpired(page: Page): Promise<boolean> {
    const url = page.url();
    return url.includes('/auth/login') || url.includes('login.microsoftonline');
  },

  async detectCaptcha(page: Page): Promise<boolean> {
    const content = await page.content();
    return content.includes('captcha') || content.includes('Cloudflare');
  },

  async detectRateLimit(page: Page): Promise<boolean> {
    const content = await page.textContent('body') ?? '';
    return content.includes('too many requests') || content.includes('rate limit');
  },
};

// ------- Provider Registry -------

const adapters: Record<string, ProviderAdapter> = {
  claude: claudeAdapter,
  openai: openaiAdapter,
};

// ------- Main Entry Point -------

let proxyBrowser: Browser | null = null;

async function getOrCreateBrowser(): Promise<Browser> {
  if (proxyBrowser && proxyBrowser.isConnected()) {
    return proxyBrowser;
  }
  logger.info('Launching headless browser for web proxy');
  proxyBrowser = await chromium.launch({ headless: true });
  return proxyBrowser;
}

async function createSessionContext(
  browser: Browser,
  session: WebSessionData,
): Promise<BrowserContext> {
  const cookies = JSON.parse(session.cookies);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: session.userAgent || undefined,
  });
  await context.addCookies(cookies);

  // Inject localStorage if provided
  if (session.localStorage && session.localStorage !== '{}') {
    const storageEntries = JSON.parse(session.localStorage);
    const domain = session.provider === 'claude' ? 'https://claude.ai' : 'https://chat.openai.com';
    const storageState = Object.entries(storageEntries).map(([name, value]) => ({
      name,
      value: String(value),
    }));

    if (storageState.length > 0) {
      const page = await context.newPage();
      await page.goto(domain, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.evaluate((entries) => {
        for (const { name, value } of entries) {
          window.localStorage.setItem(name, value);
        }
      }, storageState);
      await page.close();
    }
  }

  return context;
}

export async function completeViaWebProxy(
  request: LLMRequest,
  session: WebSessionData,
): Promise<LLMResponse> {
  const adapter = adapters[request.provider];
  if (!adapter) {
    throw new Error(`No web proxy adapter for provider: ${request.provider}`);
  }

  const browser = await getOrCreateBrowser();
  const context = await createSessionContext(browser, session);
  const page = await context.newPage();

  try {
    // Navigate to chat
    await adapter.navigateToChat(page);

    // Check for session expiry
    if (await adapter.detectSessionExpired(page)) {
      throw new SessionExpiredError(request.provider);
    }

    // Check for CAPTCHA
    if (await adapter.detectCaptcha(page)) {
      throw new CaptchaError(request.provider);
    }

    // Build prompt from messages
    const prompt = request.messages
      .map((m) => {
        if (m.role === 'system') return `[System]: ${m.content}`;
        if (m.role === 'user') return m.content;
        return `[Assistant]: ${m.content}`;
      })
      .join('\n\n');

    // Send message
    await adapter.sendMessage(page, prompt);

    // Check for rate limiting after sending
    if (await adapter.detectRateLimit(page)) {
      throw new RateLimitError(request.provider);
    }

    // Wait for and extract response
    const content = await adapter.waitForResponse(page);

    if (!content) {
      throw new Error(`Empty response from ${request.provider} web proxy`);
    }

    logger.info({ provider: request.provider, contentLength: content.length }, 'Web proxy response received');

    return {
      content,
      model: request.model ?? `${request.provider}-web`,
      finishReason: 'stop',
      source: 'web-proxy',
    };
  } finally {
    await page.close();
    await context.close();
  }
}

export async function closeProxyBrowser(): Promise<void> {
  if (proxyBrowser) {
    await proxyBrowser.close();
    proxyBrowser = null;
  }
}

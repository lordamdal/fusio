import { pino } from 'pino';

const logger = pino({ name: 'llm-interface' });

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  provider: 'claude' | 'openai';
  model?: string;
  messages: LLMMessage[];
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  finishReason: string;
  source: 'api' | 'web-proxy';
}

export interface CredentialSet {
  apiKey?: string;
  webSession?: WebSessionData;
}

export interface WebSessionData {
  provider: 'claude' | 'openai';
  cookies: string;
  localStorage: string;
  userAgent: string;
  capturedAt: string;
  expiresAt: string;
}

export class SessionExpiredError extends Error {
  constructor(provider: string) {
    super(`Web session expired for ${provider}. Please log in again.`);
    this.name = 'SessionExpiredError';
  }
}

export class CaptchaError extends Error {
  constructor(provider: string) {
    super(`CAPTCHA detected on ${provider}. Try again later or switch to API keys.`);
    this.name = 'CaptchaError';
  }
}

export class RateLimitError extends Error {
  constructor(provider: string) {
    super(`Rate limit hit on ${provider}. Try again later or switch to API keys.`);
    this.name = 'RateLimitError';
  }
}

export async function completeLLM(
  request: LLMRequest,
  credentials: CredentialSet,
): Promise<LLMResponse> {
  // Prefer API key when both are available (faster, more reliable)
  if (credentials.apiKey) {
    logger.info({ provider: request.provider }, 'Using API key for LLM request');
    return completeViaApi(request, credentials.apiKey);
  }

  if (credentials.webSession) {
    logger.info({ provider: request.provider }, 'Using web session proxy for LLM request');
    const { completeViaWebProxy } = await import('./web-proxy.js');
    return completeViaWebProxy(request, credentials.webSession);
  }

  throw new Error(`No credentials available for ${request.provider}. Add an API key or connect your web account.`);
}

async function completeViaApi(
  request: LLMRequest,
  apiKey: string,
): Promise<LLMResponse> {
  if (request.provider === 'openai') {
    return completeOpenAiApi(request, apiKey);
  }
  if (request.provider === 'claude') {
    return completeClaudeApi(request, apiKey);
  }
  throw new Error(`Unknown provider: ${request.provider}`);
}

async function completeOpenAiApi(
  request: LLMRequest,
  apiKey: string,
): Promise<LLMResponse> {
  const model = request.model ?? 'gpt-4o';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const json = await res.json() as any;
  const choice = json.choices?.[0];

  return {
    content: choice?.message?.content ?? '',
    model: json.model ?? model,
    finishReason: choice?.finish_reason ?? 'unknown',
    source: 'api',
  };
}

async function completeClaudeApi(
  request: LLMRequest,
  apiKey: string,
): Promise<LLMResponse> {
  const model = request.model ?? 'claude-sonnet-4-20250514';

  // Separate system message from conversation messages
  const systemMessage = request.messages.find((m) => m.role === 'system');
  const conversationMessages = request.messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    messages: conversationMessages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: request.maxTokens ?? 4096,
  };
  if (systemMessage) {
    body.system = systemMessage.content;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const respBody = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${respBody}`);
  }

  const json = await res.json() as any;
  const textBlock = json.content?.find((b: any) => b.type === 'text');

  return {
    content: textBlock?.text ?? '',
    model: json.model ?? model,
    finishReason: json.stop_reason ?? 'unknown',
    source: 'api',
  };
}

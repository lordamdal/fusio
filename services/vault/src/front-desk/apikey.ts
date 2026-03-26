import { pino } from "pino";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info", name: "apikey-validator" });

export interface ValidationResult {
  valid: boolean;
  message: string;
}

type Validator = (apiKey: string) => Promise<ValidationResult>;

const validators: Record<string, Validator> = {
  openai: async (apiKey: string): Promise<ValidationResult> => {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        return { valid: true, message: "OpenAI API key is valid" };
      }
      return { valid: false, message: `OpenAI validation failed: ${res.status}` };
    } catch (err: any) {
      return { valid: false, message: `OpenAI validation error: ${err.message}` };
    }
  },

  anthropic: async (apiKey: string): Promise<ValidationResult> => {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      // Any status other than 401 means the key is recognized
      if (res.status !== 401) {
        return { valid: true, message: "Anthropic API key is valid" };
      }
      return { valid: false, message: "Anthropic API key is invalid (401)" };
    } catch (err: any) {
      return { valid: false, message: `Anthropic validation error: ${err.message}` };
    }
  },

  generic: async (_apiKey: string): Promise<ValidationResult> => {
    logger.warn("Using generic validator - key accepted without verification");
    return { valid: true, message: "Key accepted (unverified)" };
  },
};

export async function validateApiKey(
  service: string,
  apiKey: string,
): Promise<ValidationResult> {
  const validator = validators[service] ?? validators.generic;
  return validator(apiKey);
}

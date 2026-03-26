import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { AgentKeypair } from './identity.js';
import { signPayload, verifySignature, fromBase58 } from './identity.js';

export type JobCategory =
  | 'content.research'
  | 'content.creation'
  | 'content.publish'
  | 'data.scrape'
  | 'data.monitor'
  | 'form.submit'
  | 'test.ping';

export type MemoryPolicy = 'ephemeral' | 'persistent';
export type FailoverPolicy = 'abort' | 'migrate';

export interface JobManifest {
  jobId: string;
  agentId: string;
  agentSignature: string;
  capability: string;
  estimatedMinutes: number;
  maxPriceAgr: number;
  browser: 'chromium' | 'firefox' | 'webkit';
  declaredPurpose: string;
  category: JobCategory;
  memoryPolicy: MemoryPolicy;
  failoverPolicy: FailoverPolicy;
  createdAt: number;
  url?: string;
}

export const JobCategorySchema = z.enum([
  'content.research',
  'content.creation',
  'content.publish',
  'data.scrape',
  'data.monitor',
  'form.submit',
  'test.ping',
]);

export const MemoryPolicySchema = z.enum(['ephemeral', 'persistent']);
export const FailoverPolicySchema = z.enum(['abort', 'migrate']);

export const JobManifestSchema = z.object({
  jobId: z.string().uuid(),
  agentId: z.string().min(1),
  agentSignature: z.string().min(1),
  capability: z.string().min(1),
  estimatedMinutes: z.number().positive(),
  maxPriceAgr: z.number().nonnegative(),
  browser: z.enum(['chromium', 'firefox', 'webkit']),
  declaredPurpose: z.string().min(1),
  category: JobCategorySchema,
  memoryPolicy: MemoryPolicySchema,
  failoverPolicy: FailoverPolicySchema,
  createdAt: z.number().positive(),
  url: z.string().url().optional(),
});

export const PROHIBITED_CATEGORIES: JobCategory[] = ['form.submit'];

export function createManifest(
  params: Omit<JobManifest, 'jobId' | 'agentSignature' | 'createdAt'>,
  keypair: AgentKeypair
): JobManifest {
  const jobId = uuidv4();
  const createdAt = Date.now();

  const manifestWithoutSig = {
    jobId,
    ...params,
    createdAt,
  };

  const signed = signPayload(manifestWithoutSig, keypair);

  return {
    ...manifestWithoutSig,
    agentSignature: signed.signature,
  };
}

export function validateManifest(manifest: JobManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Schema validation
  const parsed = JobManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    errors.push(...parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
  }

  // Prohibited category check
  if (PROHIBITED_CATEGORIES.includes(manifest.category)) {
    errors.push(`Category '${manifest.category}' is prohibited`);
  }

  // Signature verification
  if (errors.length === 0) {
    try {
      const { agentSignature, ...manifestWithoutSig } = manifest;
      const publicKey = fromBase58(manifest.agentId);
      const valid = verifySignature(
        {
          payload: JSON.stringify(manifestWithoutSig),
          signature: agentSignature,
          agentId: manifest.agentId,
          signedAt: manifest.createdAt,
        },
        publicKey
      );
      if (!valid) {
        errors.push('Invalid agent signature');
      }
    } catch (e) {
      errors.push(`Signature verification failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

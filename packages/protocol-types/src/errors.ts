import { z } from 'zod';

export enum FusioErrorCode {
  // Manifest errors
  INVALID_MANIFEST = 'INVALID_MANIFEST',
  PROHIBITED_CATEGORY = 'PROHIBITED_CATEGORY',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',

  // Routing errors
  NO_WORKERS_AVAILABLE = 'NO_WORKERS_AVAILABLE',
  WORKER_CAPABILITY_MISMATCH = 'WORKER_CAPABILITY_MISMATCH',

  // Execution errors
  JOB_TIMEOUT = 'JOB_TIMEOUT',
  WORKER_DISCONNECTED = 'WORKER_DISCONNECTED',
  BROWSER_LAUNCH_FAILED = 'BROWSER_LAUNCH_FAILED',
  ACTION_FAILED = 'ACTION_FAILED',
  CREDENTIAL_EXPIRED = 'CREDENTIAL_EXPIRED',

  // Receipt errors
  RECEIPT_SIGNATURE_INVALID = 'RECEIPT_SIGNATURE_INVALID',
  DUPLICATE_JOB_ID = 'DUPLICATE_JOB_ID',
}

export const FusioErrorCodeSchema = z.nativeEnum(FusioErrorCode);

export interface FusioError {
  code: FusioErrorCode;
  message: string;
  jobId?: string;
  step?: number;
  timestamp: number;
}

export const FusioErrorSchema = z.object({
  code: FusioErrorCodeSchema,
  message: z.string(),
  jobId: z.string().optional(),
  step: z.number().optional(),
  timestamp: z.number(),
});

export const FUSIO_ERROR_CODES: Record<FusioErrorCode, string> = {
  [FusioErrorCode.INVALID_MANIFEST]: 'INVALID_MANIFEST',
  [FusioErrorCode.PROHIBITED_CATEGORY]: 'PROHIBITED_CATEGORY',
  [FusioErrorCode.INSUFFICIENT_BALANCE]: 'INSUFFICIENT_BALANCE',
  [FusioErrorCode.INVALID_SIGNATURE]: 'INVALID_SIGNATURE',
  [FusioErrorCode.NO_WORKERS_AVAILABLE]: 'NO_WORKERS_AVAILABLE',
  [FusioErrorCode.WORKER_CAPABILITY_MISMATCH]: 'WORKER_CAPABILITY_MISMATCH',
  [FusioErrorCode.JOB_TIMEOUT]: 'JOB_TIMEOUT',
  [FusioErrorCode.WORKER_DISCONNECTED]: 'WORKER_DISCONNECTED',
  [FusioErrorCode.BROWSER_LAUNCH_FAILED]: 'BROWSER_LAUNCH_FAILED',
  [FusioErrorCode.ACTION_FAILED]: 'ACTION_FAILED',
  [FusioErrorCode.CREDENTIAL_EXPIRED]: 'CREDENTIAL_EXPIRED',
  [FusioErrorCode.RECEIPT_SIGNATURE_INVALID]: 'RECEIPT_SIGNATURE_INVALID',
  [FusioErrorCode.DUPLICATE_JOB_ID]: 'DUPLICATE_JOB_ID',
};

export function createFusioError(
  code: FusioErrorCode,
  message: string,
  jobId?: string,
  step?: number
): FusioError {
  return { code, message, jobId, step, timestamp: Date.now() };
}

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// ed25519 requires sha512 for hashing
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

export interface AgentIdentity {
  agentId: string;
  publicKey: Uint8Array;
  createdAt: number;
}

export interface AgentKeypair {
  identity: AgentIdentity;
  privateKey: Uint8Array;
}

export interface SignedPayload {
  payload: string;
  signature: string;
  agentId: string;
  signedAt: number;
}

export const AgentIdentitySchema = z.object({
  agentId: z.string(),
  publicKey: z.instanceof(Uint8Array),
  createdAt: z.number(),
});

export const SignedPayloadSchema = z.object({
  payload: z.string(),
  signature: z.string(),
  agentId: z.string(),
  signedAt: z.number(),
});

// Base58 alphabet (Bitcoin style)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function toBase58(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  for (const byte of bytes) {
    if (byte !== 0) break;
    result += BASE58_ALPHABET[0];
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

export function fromBase58(str: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of str) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index < 0) throw new Error(`Invalid base58 character: ${char}`);
    let carry = index;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char !== BASE58_ALPHABET[0]) break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function generateKeypair(): AgentKeypair {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  const agentId = toBase58(publicKey);

  return {
    identity: {
      agentId,
      publicKey,
      createdAt: Date.now(),
    },
    privateKey,
  };
}

export function signPayload(payload: object, keypair: AgentKeypair): SignedPayload {
  const payloadStr = JSON.stringify(payload);
  const messageBytes = new TextEncoder().encode(payloadStr);
  const signature = ed.sign(messageBytes, keypair.privateKey);

  return {
    payload: payloadStr,
    signature: bytesToHex(signature),
    agentId: keypair.identity.agentId,
    signedAt: Date.now(),
  };
}

export function verifySignature(signed: SignedPayload, publicKey: Uint8Array): boolean {
  try {
    const messageBytes = new TextEncoder().encode(signed.payload);
    const signatureBytes = hexToBytes(signed.signature);
    return ed.verify(signatureBytes, messageBytes, publicKey);
  } catch {
    return false;
  }
}

function encryptKey(data: Uint8Array, passphrase: string): Buffer {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

function decryptKey(data: Buffer, passphrase: string): Uint8Array {
  const salt = data.subarray(0, 16);
  const iv = data.subarray(16, 28);
  const authTag = data.subarray(28, 44);
  const encrypted = data.subarray(44);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return new Uint8Array(decrypted);
}

export function loadOrCreateKeypair(keyfilePath: string): AgentKeypair {
  const passphrase = process.env['FUSIO_KEY_PASSPHRASE'];
  if (!passphrase) {
    throw new Error('FUSIO_KEY_PASSPHRASE environment variable is required');
  }

  if (fs.existsSync(keyfilePath)) {
    const encryptedData = fs.readFileSync(keyfilePath);
    const privateKey = decryptKey(encryptedData, passphrase);
    const publicKey = ed.getPublicKey(privateKey);
    const agentId = toBase58(publicKey);
    return {
      identity: { agentId, publicKey, createdAt: fs.statSync(keyfilePath).mtimeMs },
      privateKey,
    };
  }

  const keypair = generateKeypair();
  const dir = path.dirname(keyfilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const encrypted = encryptKey(keypair.privateKey, passphrase);
  fs.writeFileSync(keyfilePath, encrypted, { mode: 0o600 });
  return keypair;
}

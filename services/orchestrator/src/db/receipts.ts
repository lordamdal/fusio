import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CompletionReceipt } from '@fusio/protocol-types';

let dataDir = process.env['DATA_DIR'] || './data';

export function setDataDir(dir: string): void {
  dataDir = dir;
}

export function appendReceipt(receipt: CompletionReceipt): void {
  const filePath = path.join(dataDir, 'receipts.jsonl');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(filePath, JSON.stringify(receipt) + '\n');
}

// engine/src/agreement/ingest.ts
import { sha256 } from '../schema/hash.ts';

export interface AgreementSnapshot {
  rawSha256: string;
  textSha256: string;
  text: string;
}

export function ingestAgreement(raw: string | Uint8Array): AgreementSnapshot {
  const bytes = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : Buffer.from(raw);
  const text = bytes.toString('utf8').replace(/\r\n?/g, '\n');
  return { rawSha256: sha256(bytes), textSha256: sha256(text), text };
}

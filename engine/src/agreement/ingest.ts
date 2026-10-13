import { sha256 } from '../schema/hash.ts';

export interface AgreementSnapshot {
  rawSha256: string;
  textSha256: string;
  text: string;
}

export function ingestAgreement(raw: string | Uint8Array): AgreementSnapshot {
  const bytes = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : Buffer.from(raw);
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error('agreement is not valid UTF-8');
  }
  // Offsets refer to the text without a leading BOM; rawSha256 still covers the original bytes.
  const text = (decoded.startsWith('﻿') ? decoded.slice(1) : decoded).replace(/\r\n?/g, '\n');
  return { rawSha256: sha256(bytes), textSha256: sha256(text), text };
}

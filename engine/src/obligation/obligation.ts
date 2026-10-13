// engine/src/obligation/obligation.ts
import type { AgreementSnapshot } from '../agreement/ingest.ts';
import { registryProviderIds, type PolicyCard } from '../policy/card.ts';
import { canonicalize } from '../schema/canonical.ts';
import { sha256 } from '../schema/hash.ts';

export type Applicability = 'applies' | 'not-applicable' | 'needs-counsel' | 'unsupported';

export interface ObligationInput {
  agreementTextSha256: string;
  quote: string;
  range: { start: number; end: number };
  policyCardId: string;
  policyCardVersion: string;
  applicability: Applicability;
  allowlist: string[];
  approver: string;
  approvedAt: string;
  exception?: string;
}

export interface Obligation extends ObligationInput {
  id: string;
}

const APPLICABILITY: Applicability[] = ['applies', 'not-applicable', 'needs-counsel', 'unsupported'];
const REQUIRED_KEYS = [
  'agreementTextSha256',
  'quote',
  'range',
  'policyCardId',
  'policyCardVersion',
  'applicability',
  'allowlist',
  'approver',
  'approvedAt',
];
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function checkShape(raw: unknown, withId: boolean): Record<string, unknown> {
  if (!isPlainObject(raw)) throw new Error('obligation must be a plain object');
  const allowed = new Set([...REQUIRED_KEYS, 'exception', ...(withId ? ['id'] : [])]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) throw new Error(`obligation has unexpected field "${key}"`);
  }
  if (withId && (typeof raw.id !== 'string' || !/^[0-9a-f]{64}$/.test(raw.id))) {
    throw new Error('obligation id must be a 64-character lowercase hex string');
  }
  for (const key of ['agreementTextSha256', 'quote', 'policyCardId', 'policyCardVersion', 'approver', 'approvedAt']) {
    if (typeof raw[key] !== 'string') throw new Error(`obligation ${key} must be a string`);
  }
  if (raw.exception !== undefined && typeof raw.exception !== 'string') {
    throw new Error('obligation exception must be a string');
  }
  const range = raw.range;
  if (
    !isPlainObject(range) ||
    Object.keys(range).sort().join(',') !== 'end,start' ||
    !Number.isSafeInteger(range.start) ||
    !Number.isSafeInteger(range.end)
  ) {
    throw new Error('obligation range must be { start, end } with safe integer values');
  }
  if (!Array.isArray(raw.allowlist) || raw.allowlist.some((p) => typeof p !== 'string')) {
    throw new Error('obligation allowlist must be an array of strings');
  }
  if (!APPLICABILITY.includes(raw.applicability as Applicability)) {
    throw new Error(`unknown applicability "${String(raw.applicability)}"`);
  }
  return raw;
}

export function assertObligationShape(raw: unknown): asserts raw is ObligationInput {
  checkShape(raw, false);
}

function pickInput(i: ObligationInput): ObligationInput {
  const out: ObligationInput = {
    agreementTextSha256: i.agreementTextSha256,
    quote: i.quote,
    range: { start: i.range.start, end: i.range.end },
    policyCardId: i.policyCardId,
    policyCardVersion: i.policyCardVersion,
    applicability: i.applicability,
    allowlist: [...i.allowlist],
    approver: i.approver,
    approvedAt: i.approvedAt,
  };
  if (i.exception !== undefined) out.exception = i.exception;
  return out;
}

export function locateQuote(text: string, quote: string): { start: number; end: number } {
  if (quote.trim() === '') throw new Error('quote must not be empty');
  const first = text.indexOf(quote);
  if (first === -1) throw new Error('quote not found in the agreement text');
  if (text.indexOf(quote, first + 1) !== -1) {
    throw new Error('quote appears more than once; pass an explicit start offset');
  }
  return { start: first, end: first + quote.length };
}

export function confirmObligation(input: ObligationInput, agreement: AgreementSnapshot, card: PolicyCard): Obligation {
  assertObligationShape(input);
  if (input.quote.trim() === '') throw new Error('quote must not be empty');
  if (input.agreementTextSha256 !== agreement.textSha256) {
    throw new Error('obligation does not reference the supplied agreement text');
  }
  const { start, end } = input.range;
  if (start < 0 || end <= start || end > agreement.text.length) {
    throw new Error('obligation range is outside the agreement text');
  }
  if (agreement.text.slice(start, end) !== input.quote) {
    throw new Error('quote does not match the agreement text at the given range');
  }
  if (input.policyCardId !== card.id || input.policyCardVersion !== card.version) {
    throw new Error('obligation names a different policy card or version');
  }
  if (input.approver.trim() === '') throw new Error('a named approver is required');
  if (!ISO_8601.test(input.approvedAt) || Number.isNaN(Date.parse(input.approvedAt))) {
    throw new Error('approvedAt must be an ISO 8601 timestamp with a timezone, e.g. 2026-10-13T09:00:00Z');
  }
  if (input.applicability === 'applies' && input.allowlist.length === 0) {
    throw new Error('an allowlist of provider ids is required when the obligation applies');
  }
  if (input.allowlist.length > 0) {
    const known = registryProviderIds(card);
    const unknown = input.allowlist.filter((p) => !known.includes(p));
    if (unknown.length > 0) {
      throw new Error(`allowlist contains providers not in the registry: ${unknown.join(', ')} (known: ${known.join(', ')})`);
    }
    const dup = input.allowlist.find((p, idx) => input.allowlist.indexOf(p) !== idx);
    if (dup !== undefined) throw new Error(`allowlist contains a duplicate provider: ${dup}`);
  }
  const picked = pickInput(input);
  return { ...picked, id: sha256(canonicalize(picked)) };
}

export function verifyObligation(obligation: Obligation): void {
  if (!isPlainObject(obligation)) throw new Error('obligation must be a plain object');
  const { id, ...input } = obligation;
  if (sha256(canonicalize(input)) !== id) throw new Error('obligation id does not match its content (tampered or edited)');
}

export function parseObligation(raw: unknown, agreement: AgreementSnapshot, card: PolicyCard): Obligation {
  const checked = checkShape(raw, true);
  const { id, ...content } = checked;
  const confirmed = confirmObligation(content as unknown as ObligationInput, agreement, card);
  const result: Obligation = { ...confirmed };
  if (result.id !== id) throw new Error('obligation id does not match its content (tampered or edited)');
  verifyObligation(result);
  return result;
}

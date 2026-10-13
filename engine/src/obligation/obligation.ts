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

export function locateQuote(text: string, quote: string): { start: number; end: number } {
  if (quote === '') throw new Error('quote must not be empty');
  const first = text.indexOf(quote);
  if (first === -1) throw new Error('quote not found in the agreement text');
  if (text.indexOf(quote, first + 1) !== -1) {
    throw new Error('quote appears more than once; pass an explicit start offset');
  }
  return { start: first, end: first + quote.length };
}

export function confirmObligation(input: ObligationInput, agreement: AgreementSnapshot, card: PolicyCard): Obligation {
  if (input.agreementTextSha256 !== agreement.textSha256) {
    throw new Error('obligation does not reference the supplied agreement text');
  }
  const { start, end } = input.range;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > agreement.text.length) {
    throw new Error('obligation range is outside the agreement text');
  }
  if (agreement.text.slice(start, end) !== input.quote) {
    throw new Error('quote does not match the agreement text at the given range');
  }
  if (input.policyCardId !== card.id || input.policyCardVersion !== card.version) {
    throw new Error('obligation names a different policy card or version');
  }
  if (input.approver.trim() === '') throw new Error('a named approver is required');
  if (Number.isNaN(Date.parse(input.approvedAt))) throw new Error('approvedAt must be a valid ISO timestamp');
  if (!APPLICABILITY.includes(input.applicability)) throw new Error(`unknown applicability "${input.applicability}"`);
  if (input.applicability === 'applies') {
    if (input.allowlist.length === 0) throw new Error('an allowlist of provider ids is required when the obligation applies');
    const known = registryProviderIds(card);
    const unknown = input.allowlist.filter((p) => !known.includes(p));
    if (unknown.length > 0) {
      throw new Error(`allowlist contains providers not in the registry: ${unknown.join(', ')} (known: ${known.join(', ')})`);
    }
  }
  return { ...input, id: sha256(canonicalize(input)) };
}

export function verifyObligation(obligation: Obligation): void {
  const { id, ...input } = obligation;
  if (sha256(canonicalize(input)) !== id) throw new Error('obligation id does not match its content (tampered or edited)');
}

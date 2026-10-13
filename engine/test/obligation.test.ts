// engine/test/obligation.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { ingestAgreement } from '../src/agreement/ingest.ts';
import { confirmObligation, locateQuote, verifyObligation, type ObligationInput } from '../src/obligation/obligation.ts';
import { loadCard, type PolicyCard } from '../src/policy/card.ts';
import { CARD_PATH } from './helpers.ts';

let card: PolicyCard;
beforeAll(async () => {
  card = (await loadCard(CARD_PATH)).card;
});

const QUOTE = 'Provider will only use Anthropic.';
const TEXT = `# Addendum\r\n\r\n${QUOTE}\r\n`;

function input(overrides: Partial<ObligationInput> = {}): { input: ObligationInput; agreement: ReturnType<typeof ingestAgreement> } {
  const agreement = ingestAgreement(TEXT);
  const range = locateQuote(agreement.text, QUOTE);
  return {
    agreement,
    input: {
      agreementTextSha256: agreement.textSha256,
      quote: QUOTE,
      range,
      policyCardId: card.id,
      policyCardVersion: card.version,
      applicability: 'applies',
      allowlist: ['anthropic'],
      approver: 'Test Reviewer',
      approvedAt: '2026-10-13T09:00:00.000Z',
      ...overrides,
    },
  };
}

describe('ingestAgreement', () => {
  it('normalizes line endings and hashes raw bytes and normalized text separately', () => {
    const a = ingestAgreement('a\r\nb');
    expect(a.text).toBe('a\nb');
    expect(a.rawSha256).not.toBe(a.textSha256);
    expect(ingestAgreement('a\nb').textSha256).toBe(a.textSha256);
  });
});

describe('locateQuote', () => {
  it('finds a unique quote', () => {
    const a = ingestAgreement(TEXT);
    const r = locateQuote(a.text, QUOTE);
    expect(a.text.slice(r.start, r.end)).toBe(QUOTE);
  });

  it('rejects a missing or ambiguous quote', () => {
    expect(() => locateQuote('abc', 'zzz')).toThrow(/not found/);
    expect(() => locateQuote('aa aa', 'aa')).toThrow(/more than once/);
  });

  it('keeps offsets correct after astral characters (review focus 4)', () => {
    const a = ingestAgreement(`😀 intro\n\n${QUOTE}\n`);
    const r = locateQuote(a.text, QUOTE);
    expect(r.start).toBeGreaterThan(2);
    expect(a.text.slice(r.start, r.end)).toBe(QUOTE);
    const { input: i } = input();
    expect(() => confirmObligation({ ...i, agreementTextSha256: a.textSha256, range: r }, a, card)).not.toThrow();
  });
});

describe('confirmObligation', () => {
  it('returns an obligation with a content-derived id', () => {
    const { input: i, agreement } = input();
    const o = confirmObligation(i, agreement, card);
    expect(o.id).toMatch(/^[0-9a-f]{64}$/);
    expect(() => verifyObligation(o)).not.toThrow();
  });

  it('rejects a quote that does not match the range', () => {
    const { input: i, agreement } = input();
    expect(() => confirmObligation({ ...i, quote: 'something else' }, agreement, card)).toThrow(/quote/);
  });

  it('rejects an agreement hash mismatch', () => {
    const { input: i, agreement } = input({ agreementTextSha256: 'f'.repeat(64) });
    expect(() => confirmObligation(i, agreement, card)).toThrow(/agreement/);
  });

  it('rejects a different policy card version', () => {
    const { input: i, agreement } = input({ policyCardVersion: '9.9.9' });
    expect(() => confirmObligation(i, agreement, card)).toThrow(/policy card/);
  });

  it('requires a named approver and a valid timestamp', () => {
    const a = input({ approver: '  ' });
    expect(() => confirmObligation(a.input, a.agreement, card)).toThrow(/approver/);
    const b = input({ approvedAt: 'yesterday-ish' });
    expect(() => confirmObligation(b.input, b.agreement, card)).toThrow(/approvedAt/);
  });

  it('requires an allowlist of registry provider ids when the obligation applies', () => {
    const empty = input({ allowlist: [] });
    expect(() => confirmObligation(empty.input, empty.agreement, card)).toThrow(/allowlist/);
    const unknown = input({ allowlist: ['acme-ai'] });
    expect(() => confirmObligation(unknown.input, unknown.agreement, card)).toThrow(/acme-ai/);
  });

  it('does not require an allowlist when a human records not-applicable', () => {
    const n = input({ applicability: 'not-applicable', allowlist: [] });
    expect(() => confirmObligation(n.input, n.agreement, card)).not.toThrow();
  });

  it('detects a tampered obligation', () => {
    const { input: i, agreement } = input();
    const o = confirmObligation(i, agreement, card);
    expect(() => verifyObligation({ ...o, allowlist: ['openai'] })).toThrow(/tampered|does not match/);
  });
});

// engine/test/obligation.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { ingestAgreement } from '../src/agreement/ingest.ts';
import { assertObligationShape, confirmObligation, locateQuote, parseObligation, verifyObligation, type Obligation, type ObligationInput } from '../src/obligation/obligation.ts';
import { sha256 } from '../src/schema/hash.ts';
import { canonicalize } from '../src/schema/canonical.ts';
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

  it('rejects overlapping matches as ambiguous', () => {
    expect(() => locateQuote('aaa', 'aa')).toThrow(/more than once/);
  });

  it('rejects empty and whitespace-only quotes', () => {
    expect(() => locateQuote('a b', '')).toThrow(/quote must not be empty/);
    expect(() => locateQuote('a b', ' ')).toThrow(/quote must not be empty/);
  });

  it('keeps offsets correct after astral characters (review focus 4)', () => {
    const prefix = '😀 intro\n\n';
    const a = ingestAgreement(`${prefix}${QUOTE}\n`);
    const r = locateQuote(a.text, QUOTE);
    expect(r.start).toBe(prefix.length);
    expect(r.end).toBe(prefix.length + QUOTE.length);
    const { input: i } = input({ agreementTextSha256: a.textSha256, range: r });
    expect(() => confirmObligation(i, a, card)).not.toThrow();
  });
});

describe('ingestAgreement edge cases', () => {
  it('strips one leading BOM from the text but hashes the original bytes', () => {
    const withBom = ingestAgreement('﻿hello');
    const plain = ingestAgreement('hello');
    expect(withBom.text).toBe('hello');
    expect(withBom.textSha256).toBe(plain.textSha256);
    expect(withBom.rawSha256).not.toBe(plain.rawSha256);
    expect(ingestAgreement('﻿﻿x').text).toBe('﻿x');
  });

  it('rejects invalid UTF-8', () => {
    expect(() => ingestAgreement(new Uint8Array([0xff, 0xfe, 0x41]))).toThrow(/agreement is not valid UTF-8/);
  });

  it('allows empty input', () => {
    expect(ingestAgreement('').text).toBe('');
    expect(ingestAgreement(new Uint8Array()).text).toBe('');
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
    expect(() => confirmObligation({ ...i, quote: 'something else' }, agreement, card)).toThrow(
      /quote does not match the agreement text/,
    );
  });

  it('rejects empty and whitespace-only quotes', () => {
    const { input: i, agreement } = input();
    expect(() => confirmObligation({ ...i, quote: '   ' }, agreement, card)).toThrow(/quote must not be empty/);
    expect(() => confirmObligation({ ...i, quote: '' }, agreement, card)).toThrow(/quote must not be empty/);
  });

  it('rejects bad ranges', () => {
    const { input: i, agreement } = input();
    const bad = [
      { start: 5, end: 5 },
      { start: 6, end: 2 },
      { start: -1, end: 4 },
      { start: 0, end: agreement.text.length + 1 },
      { start: 0.5, end: 4 },
    ];
    for (const range of bad) {
      expect(() => confirmObligation({ ...i, range }, agreement, card)).toThrow(/range/);
    }
  });

  it('rejects an agreement hash mismatch', () => {
    const { input: i, agreement } = input({ agreementTextSha256: 'f'.repeat(64) });
    expect(() => confirmObligation(i, agreement, card)).toThrow(/does not reference the supplied agreement text/);
  });

  it('rejects a different policy card version', () => {
    const { input: i, agreement } = input({ policyCardVersion: '9.9.9' });
    expect(() => confirmObligation(i, agreement, card)).toThrow(/different policy card or version/);
  });

  it('requires a named approver', () => {
    const a = input({ approver: '  ' });
    expect(() => confirmObligation(a.input, a.agreement, card)).toThrow(/a named approver is required/);
  });

  it('requires strict ISO 8601 timestamps with a timezone', () => {
    for (const approvedAt of ['yesterday-ish', '1', '2026', 'Mon Oct 13', '10/13/2026', '2026-10-13', '2026-10-13T09:00:00']) {
      const x = input({ approvedAt });
      expect(() => confirmObligation(x.input, x.agreement, card)).toThrow(/approvedAt/);
    }
    for (const approvedAt of ['2026-10-13T09:00:00Z', '2026-10-13T09:00:00.123+01:00', '2026-10-13T09:00:00-05:30']) {
      const x = input({ approvedAt });
      expect(() => confirmObligation(x.input, x.agreement, card)).not.toThrow();
    }
    const nan = input({ approvedAt: '2026-13-45T99:00:00Z' });
    expect(() => confirmObligation(nan.input, nan.agreement, card)).toThrow(/approvedAt/);
  });

  it('requires an allowlist of registry provider ids when the obligation applies', () => {
    const empty = input({ allowlist: [] });
    expect(() => confirmObligation(empty.input, empty.agreement, card)).toThrow(/an allowlist of provider ids is required/);
    const unknown = input({ allowlist: ['acme-ai'] });
    expect(() => confirmObligation(unknown.input, unknown.agreement, card)).toThrow(/acme-ai/);
  });

  it('does not require an allowlist when a human records not-applicable', () => {
    const n = input({ applicability: 'not-applicable', allowlist: [] });
    expect(() => confirmObligation(n.input, n.agreement, card)).not.toThrow();
  });

  it('validates a non-empty allowlist whatever the applicability', () => {
    const n = input({ applicability: 'not-applicable', allowlist: ['acme-ai'] });
    expect(() => confirmObligation(n.input, n.agreement, card)).toThrow(/acme-ai/);
  });

  it('keeps allowlist normalization strict and rejects duplicates', () => {
    for (const bad of ['Anthropic', ' anthropic', 'anthropic ']) {
      const x = input({ allowlist: [bad] });
      expect(() => confirmObligation(x.input, x.agreement, card)).toThrow(/not in the registry/);
    }
    const d = input({ allowlist: ['anthropic', 'anthropic'] });
    expect(() => confirmObligation(d.input, d.agreement, card)).toThrow(/duplicate.*anthropic/);
  });

  it('hashes and returns only the declared fields', () => {
    const { input: i, agreement } = input();
    const o = confirmObligation({ ...i, exception: undefined }, agreement, card);
    expect('exception' in o).toBe(false);
    const withEx = confirmObligation({ ...i, exception: 'legacy' }, agreement, card);
    expect(withEx.exception).toBe('legacy');
    expect(() => verifyObligation(withEx)).not.toThrow();
  });

  it('fails with a named error, never a TypeError, on malformed input', () => {
    const { input: i, agreement } = input();
    const cases: unknown[] = [
      null,
      'x',
      [],
      { ...i, allowlist: 'anthropic' },
      { ...i, range: { start: '0', end: '3' } },
      { ...i, approver: undefined },
      { ...i, extra: 1 },
      { ...i, applicability: 'maybe' },
    ];
    for (const c of cases) {
      let err: unknown;
      try {
        confirmObligation(c as ObligationInput, agreement, card);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(TypeError);
    }
  });
});

describe('verifyObligation', () => {
  it('detects a tampered obligation', () => {
    const { input: i, agreement } = input();
    const o = confirmObligation(i, agreement, card);
    expect(() => verifyObligation({ ...o, allowlist: ['openai'] })).toThrow(/obligation id does not match its content/);
  });

  it('detects a tampered id', () => {
    const { input: i, agreement } = input();
    const o = confirmObligation(i, agreement, card);
    expect(() => verifyObligation({ ...o, id: 'a'.repeat(64) })).toThrow(/obligation id does not match its content/);
  });

  it('throws a clean error for a non-object', () => {
    for (const v of [null, undefined, 'x', 3, []]) {
      expect(() => verifyObligation(v as unknown as Obligation)).toThrow(/obligation must be a plain object/);
    }
  });
});

describe('parseObligation', () => {
  function valid(): { raw: Record<string, unknown>; agreement: ReturnType<typeof ingestAgreement> } {
    const { input: i, agreement } = input();
    return { raw: JSON.parse(JSON.stringify(confirmObligation(i, agreement, card))), agreement };
  }

  it('accepts a JSON round-tripped obligation', () => {
    const { raw, agreement } = valid();
    expect(parseObligation(raw, agreement, card).id).toBe(raw.id);
  });

  it('rejects each malformed shape, naming the field', () => {
    const { raw, agreement } = valid();
    const cases: Array<[string, unknown, RegExp]> = [
      ['not an object', 'x', /obligation must be a plain object/],
      ['null', null, /obligation must be a plain object/],
      ['array', [], /obligation must be a plain object/],
      ['string allowlist', { ...raw, allowlist: 'anthropic' }, /allowlist must be an array of strings/],
      ['non-string allowlist member', { ...raw, allowlist: [1] }, /allowlist must be an array of strings/],
      ['string range fields', { ...raw, range: { start: '0', end: '3' } }, /range must be/],
      ['range extra key', { ...raw, range: { start: 0, end: 3, x: 1 } }, /range must be/],
      ['unknown applicability', { ...raw, applicability: 'maybe' }, /unknown applicability "maybe"/],
      ['missing approver', { ...raw, approver: undefined }, /approver must be a string/],
      ['numeric quote', { ...raw, quote: 5 }, /quote must be a string/],
      ['extra key', { ...raw, role: 'admin' }, /unexpected field "role"/],
      ['missing id', { ...raw, id: undefined }, /id must be/],
      ['short id', { ...raw, id: 'abc' }, /id must be/],
      ['uppercase id', { ...raw, id: String(raw.id).toUpperCase() }, /id must be/],
      ['non-string exception', { ...raw, exception: 3 }, /exception must be a string/],
    ];
    for (const [name, bad, re] of cases) {
      expect(() => parseObligation(bad, agreement, card), name).toThrow(re);
    }
  });

  it('catches a tampered range on a re-hashed object via the quote check', () => {
    const { raw, agreement } = valid();
    const { id: _id, ...content } = raw;
    const forged = { ...content, range: { start: 0, end: 5 } };
    const reHashed = { ...forged, id: sha256(canonicalize(forged)) };
    expect(() => parseObligation(reHashed, agreement, card)).toThrow(/quote does not match the agreement text/);
  });

  it('catches a content edit with a stale id', () => {
    const { raw, agreement } = valid();
    expect(() => parseObligation({ ...raw, allowlist: ['openai'] }, agreement, card)).toThrow(
      /obligation id does not match its content/,
    );
  });

  it('runs the confirm checks (registry membership)', () => {
    const { raw, agreement } = valid();
    const { id: _id, ...content } = raw;
    const forged = { ...content, allowlist: ['acme-ai'] };
    const reHashed = { ...forged, id: sha256(canonicalize(forged)) };
    expect(() => parseObligation(reHashed, agreement, card)).toThrow(/acme-ai/);
  });
});

describe('assertObligationShape', () => {
  it('rejects an id on input-shaped data and accepts a clean input', () => {
    const { input: i } = input();
    expect(() => assertObligationShape(i)).not.toThrow();
    expect(() => assertObligationShape({ ...i, id: 'a'.repeat(64) })).toThrow(/unexpected field "id"/);
  });
});

import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/schema/canonical.ts';
import { sha256 } from '../src/schema/hash.ts';
import { HEX64, compareStrings, findingId, hashOf, isPlainObject, isPlainObjectOrNullProto, normalizeNewlines } from '../src/schema/hashing.ts';

describe('hashing primitives', () => {
  it('hashOf is sha256 of the canonical form, independent of key order', () => {
    expect(hashOf({ b: 1, a: 2 })).toBe(sha256(canonicalize({ a: 2, b: 1 })));
    expect(hashOf({ b: 1, a: 2 })).toBe(hashOf({ a: 2, b: 1 }));
  });
  it('findingId hashes exactly the six identity fields', () => {
    const parts = { ruleId: 'r', ruleVersion: '1', path: 'a.ts', start: 1, end: 2, matched: 'm' };
    expect(findingId(parts)).toBe(hashOf(parts));
    expect(findingId({ ...parts, extra: 'ignored' } as typeof parts)).toBe(findingId(parts));
    expect(findingId({ ...parts, end: 3 })).not.toBe(findingId(parts));
  });
  it('HEX64 accepts only 64 lowercase hex characters', () => {
    expect(HEX64.test('a'.repeat(64))).toBe(true);
    expect(HEX64.test('A'.repeat(64))).toBe(false);
    expect(HEX64.test('a'.repeat(63))).toBe(false);
  });
  it('normalizeNewlines converts CRLF and lone CR to LF', () => {
    expect(normalizeNewlines('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });
  it('compareStrings uses code-unit order', () => {
    expect(['a', 'B', 'a_b', 'a-b'].sort(compareStrings)).toEqual(['B', 'a', 'a-b', 'a_b']);
    expect(compareStrings('a', 'a')).toBe(0);
  });
  it('the two plain-object checks differ only on null-prototype objects', () => {
    const nullProto = Object.create(null) as Record<string, unknown>;
    class C {}
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(nullProto)).toBe(false);
    expect(isPlainObjectOrNullProto(nullProto)).toBe(true);
    for (const f of [isPlainObject, isPlainObjectOrNullProto]) {
      expect(f({})).toBe(true);
      expect(f([])).toBe(false);
      expect(f(null)).toBe(false);
      expect(f('x')).toBe(false);
      expect(f(new C())).toBe(false);
    }
  });
});

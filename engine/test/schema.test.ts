import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/schema/canonical.ts';
import { sha256 } from '../src/schema/hash.ts';

describe('canonicalize', () => {
  it('sorts keys recursively', () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}',
    );
  });

  it('does not depend on insertion order', () => {
    expect(canonicalize({ x: 1, y: 2 })).toBe(canonicalize({ y: 2, x: 1 }));
  });

  it('rejects non-integer numbers', () => {
    expect(() => canonicalize({ a: 1.5 })).toThrow(/non-integer/);
  });

  it('omits undefined members', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('keeps non-ASCII text as-is', () => {
    expect(canonicalize({ s: 'é😀' })).toBe('{"s":"é😀"}');
  });

  it('throws on NaN and Infinity', () => {
    expect(() => canonicalize({ a: NaN })).toThrow();
    expect(() => canonicalize({ a: Infinity })).toThrow();
  });

  it('throws on bigint', () => {
    expect(() => canonicalize({ a: 1n })).toThrow();
  });

  it('throws on Date and Map instead of hashing them as {}', () => {
    expect(() => canonicalize({ d: new Date(0) })).toThrow(/unsupported object/);
    expect(() => canonicalize({ m: new Map([['k', 1]]) })).toThrow(/unsupported object/);
  });

  it('throws on undefined inside an array', () => {
    expect(() => canonicalize([1, undefined])).toThrow();
  });

  it('throws on integers outside the safe range', () => {
    expect(() => canonicalize({ a: 2 ** 60 })).toThrow(/unsafe/);
  });

  it('keeps an own __proto__ key', () => {
    const parsed = JSON.parse('{"__proto__":1}') as Record<string, unknown>;
    const out = canonicalize(parsed);
    expect(out).toBe('{"__proto__":1}');
    expect(out).toContain('__proto__');
  });

  it('accepts nested objects with a null prototype', () => {
    const inner = Object.create(null) as Record<string, unknown>;
    inner.b = 2;
    inner.a = 1;
    expect(canonicalize({ x: inner })).toBe('{"x":{"a":1,"b":2}}');
  });
});

describe('sha256', () => {
  it('matches the known vector for "abc"', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

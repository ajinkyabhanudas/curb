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
});

describe('sha256', () => {
  it('matches the known vector for "abc"', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

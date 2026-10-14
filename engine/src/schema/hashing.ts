// engine/src/schema/hashing.ts
// Small primitives shared by the schema, snapshot, evaluator, store and workflow modules.
import { canonicalize } from './canonical.ts';
import { sha256 } from './hash.ts';

export const HEX64 = /^[0-9a-f]{64}$/;

/** sha256 of the canonical JSON form of a value. */
export function hashOf(value: unknown): string {
  return sha256(canonicalize(value));
}

export interface FindingIdParts {
  ruleId: string;
  ruleVersion: string;
  path: string;
  start: number;
  end: number;
  matched: string;
}

export function findingId(p: FindingIdParts): string {
  return hashOf({ ruleId: p.ruleId, ruleVersion: p.ruleVersion, path: p.path, start: p.start, end: p.end, matched: p.matched });
}

/** CRLF and lone CR become LF. */
export function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, '\n');
}

/** Code-unit order, never locale order. */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** An object whose prototype is Object.prototype (what JSON.parse produces). Null-prototype objects are rejected. */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

/** Like isPlainObject but also accepts null-prototype objects. */
export function isPlainObjectOrNullProto(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

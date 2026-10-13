// engine/src/policy/card.ts
import { readFile } from 'node:fs/promises';
import { canonicalize } from '../schema/canonical.ts';
import { sha256 } from '../schema/hash.ts';
import type { Severity } from '../schema/types.ts';

export interface PolicyCard {
  id: string;
  version: string;
  status: string;
  owner: string;
  reviewDate: string;
  severity: Severity;
  interpretation: string;
  approvedTextPatterns: string[];
  requiredFacts: string[];
  prerequisites: string[];
  falsePositiveExamples: string[];
  falseNegativeRisks: string[];
  evidenceBoundaries: string[];
  nonClaims: string[];
  exclusions: { dirs: string[]; files: string[] };
  registry: {
    packages: Record<string, string>;
    hosts: Record<string, string>;
    gatewayPrefixes: Record<string, string>;
  };
  modelConstructors: string[];
  testCases: string[];
}

const STRING_FIELDS = ['id', 'version', 'status', 'owner', 'reviewDate', 'interpretation'] as const;
const LIST_FIELDS = [
  'approvedTextPatterns',
  'requiredFacts',
  'prerequisites',
  'falsePositiveExamples',
  'falseNegativeRisks',
  'evidenceBoundaries',
  'nonClaims',
  'modelConstructors',
  'testCases',
] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'];

function isStringList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isStringMap(v: unknown): v is Record<string, string> {
  return (
    typeof v === 'object' && v !== null && !Array.isArray(v) &&
    Object.values(v).every((x) => typeof x === 'string')
  );
}

export function validateCard(raw: unknown): PolicyCard {
  if (typeof raw !== 'object' || raw === null) throw new Error('policy card must be an object');
  const r = raw as Record<string, unknown>;
  for (const f of STRING_FIELDS) {
    if (typeof r[f] !== 'string' || r[f] === '') throw new Error(`policy card field "${f}" must be a non-empty string`);
  }
  for (const f of LIST_FIELDS) {
    if (!isStringList(r[f])) throw new Error(`policy card field "${f}" must be a list of strings`);
  }
  if (typeof r.severity !== 'string' || !SEVERITIES.includes(r.severity)) {
    throw new Error('policy card field "severity" must be critical, high, medium or low');
  }
  const ex = r.exclusions as Record<string, unknown> | undefined;
  if (!ex || !isStringList(ex.dirs) || !isStringList(ex.files)) {
    throw new Error('policy card field "exclusions" must have string lists "dirs" and "files"');
  }
  const reg = r.registry as Record<string, unknown> | undefined;
  if (!reg || !isStringMap(reg.packages) || !isStringMap(reg.hosts) || !isStringMap(reg.gatewayPrefixes)) {
    throw new Error('policy card field "registry" must have string maps packages, hosts and gatewayPrefixes');
  }
  return raw as PolicyCard;
}

export async function loadCard(file: string): Promise<{ card: PolicyCard; hash: string }> {
  const card = validateCard(JSON.parse(await readFile(file, 'utf8')));
  return { card, hash: sha256(canonicalize(card)) };
}

export function registryProviderIds(card: PolicyCard): string[] {
  const { packages, hosts, gatewayPrefixes } = card.registry;
  return [...new Set([...Object.values(packages), ...Object.values(hosts), ...Object.values(gatewayPrefixes)])].sort();
}

export function own<T>(map: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

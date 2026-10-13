// engine/src/schema/result.ts
// Strict validation of a result file read from disk. It is untrusted input: every field is checked.
import { canonicalize } from './canonical.ts';
import { sha256 } from './hash.ts';
import type { ResultFile, UnknownReason } from './types.ts';

const STATES = ['pass', 'fail', 'unknown', 'not-applicable', 'error'];
const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const REASONS: UnknownReason[] = ['parse-error', 'minified', 'generated', 'unsupported-language', 'too-large', 'symlink', 'unreadable'];
const HEX64 = /^[0-9a-f]{64}$/;

class ResultShapeError extends Error {
  constructor(where: string, why: string) {
    super(`--result file is not a valid result: ${where} ${why}`);
  }
}

type Rec = Record<string, unknown>;

function obj(v: unknown, where: string, keys: string[]): Rec {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new ResultShapeError(where, 'must be an object');
  for (const k of Object.keys(v)) if (!keys.includes(k)) throw new ResultShapeError(`${where}.${k}`, 'is not an allowed field');
  for (const k of keys) if (!Object.hasOwn(v, k)) throw new ResultShapeError(`${where}.${k}`, 'is missing');
  return v as Rec;
}
function str(v: unknown, where: string): string {
  if (typeof v !== 'string') throw new ResultShapeError(where, 'must be a string');
  return v;
}
function hex(v: unknown, where: string): string {
  if (typeof v !== 'string' || !HEX64.test(v)) throw new ResultShapeError(where, 'must be a 64-character lowercase hex string');
  return v;
}
function int(v: unknown, where: string, min = Number.MIN_SAFE_INTEGER): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min) throw new ResultShapeError(where, 'must be a safe integer' + (min >= 0 ? ' >= 0' : ''));
  return v;
}
function oneOf(v: unknown, where: string, allowed: string[]): string {
  if (typeof v !== 'string' || !allowed.includes(v)) throw new ResultShapeError(where, `must be one of ${allowed.join(', ')}`);
  return v;
}
function arr(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) throw new ResultShapeError(where, 'must be an array');
  return v;
}

export function parseResultFile(raw: unknown): ResultFile {
  const top = obj(raw, 'result', ['body', 'envelope']);
  const b = obj(top.body, 'body', [
    'schemaVersion', 'ruleId', 'ruleVersion', 'evaluatorVersion', 'policyCardHash', 'treeHash', 'agreementHash',
    'obligationHash', 'state', 'findings', 'unknownFiles', 'filesEvaluated', 'exclusions', 'notes',
  ]);
  if (b.schemaVersion !== '1') throw new ResultShapeError('body.schemaVersion', "must be '1'");
  for (const k of ['ruleId', 'ruleVersion', 'evaluatorVersion']) str(b[k], `body.${k}`);
  for (const k of ['policyCardHash', 'treeHash', 'agreementHash', 'obligationHash']) hex(b[k], `body.${k}`);
  oneOf(b.state, 'body.state', STATES);
  arr(b.findings, 'body.findings').forEach((f, i) => {
    const w = `body.findings[${i}]`;
    const o = obj(f, w, ['id', 'ruleId', 'ruleVersion', 'severity', 'providerId', 'matched', 'evidence']);
    hex(o.id, `${w}.id`);
    for (const k of ['ruleId', 'ruleVersion', 'providerId', 'matched']) str(o[k], `${w}.${k}`);
    oneOf(o.severity, `${w}.severity`, SEVERITIES);
    const e = obj(o.evidence, `${w}.evidence`, ['path', 'fileSha256', 'start', 'end', 'line', 'column', 'excerpt', 'reason']);
    for (const k of ['path', 'excerpt', 'reason']) str(e[k], `${w}.evidence.${k}`);
    hex(e.fileSha256, `${w}.evidence.fileSha256`);
    for (const k of ['start', 'end', 'line', 'column']) int(e[k], `${w}.evidence.${k}`, 0);
  });
  arr(b.unknownFiles, 'body.unknownFiles').forEach((u, i) => {
    const o = obj(u, `body.unknownFiles[${i}]`, ['path', 'reason']);
    str(o.path, `body.unknownFiles[${i}].path`);
    oneOf(o.reason, `body.unknownFiles[${i}].reason`, REASONS);
  });
  int(b.filesEvaluated, 'body.filesEvaluated', 0);
  for (const k of ['exclusions', 'notes']) arr(b[k], `body.${k}`).forEach((s, i) => str(s, `body.${k}[${i}]`));

  const env = obj(top.envelope, 'envelope', ['resultHash', 'startedAt', 'finishedAt', 'operator', 'tenantId']);
  hex(env.resultHash, 'envelope.resultHash');
  for (const k of ['startedAt', 'finishedAt', 'operator', 'tenantId']) str(env[k], `envelope.${k}`);
  return raw as ResultFile;
}

/** Recompute the result hash and every finding id; a mismatch means the file was edited after the scan. */
export function verifyResultIntegrity(file: ResultFile): void {
  if (sha256(canonicalize(file.body)) !== file.envelope.resultHash) {
    throw new Error('result hash does not match its body: the file was edited');
  }
  file.body.findings.forEach((f, i) => {
    const id = sha256(
      canonicalize({ ruleId: f.ruleId, ruleVersion: f.ruleVersion, path: f.evidence.path, start: f.evidence.start, end: f.evidence.end, matched: f.matched }),
    );
    if (id !== f.id) throw new Error(`finding id does not match its content: body.findings[${i}] was edited`);
  });
}

// The value lists are the single source of truth: the unions derive from them and the result validator reads them.
export const RESULT_STATES = ['pass', 'fail', 'unknown', 'not-applicable', 'error'] as const;
export type ResultState = (typeof RESULT_STATES)[number];
export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Evidence {
  path: string;
  fileSha256: string;
  // UTF-16 code unit offsets into the line-ending-normalized file text
  start: number;
  end: number;
  line: number;
  column: number;
  excerpt: string;
  reason: string;
}

export interface Finding {
  id: string;
  ruleId: string;
  ruleVersion: string;
  severity: Severity;
  providerId: string;
  matched: string;
  evidence: Evidence;
}

export const UNKNOWN_REASONS = [
  'parse-error',
  'minified',
  'generated',
  'unsupported-language',
  'too-large',
  'symlink',
  'unreadable',
] as const;
export type UnknownReason = (typeof UNKNOWN_REASONS)[number];

export interface UnknownFile {
  path: string;
  reason: UnknownReason;
}

export interface ResultBody {
  schemaVersion: '1';
  ruleId: string;
  ruleVersion: string;
  evaluatorVersion: string;
  policyCardHash: string;
  treeHash: string;
  agreementHash: string;
  obligationHash: string;
  state: ResultState;
  findings: Finding[];
  unknownFiles: UnknownFile[];
  filesEvaluated: number;
  exclusions: string[];
  notes: string[];
}

export interface RunEnvelope {
  resultHash: string;
  startedAt: string;
  finishedAt: string;
  operator: string;
  tenantId: string;
}

export interface ResultFile {
  body: ResultBody;
  envelope: RunEnvelope;
}

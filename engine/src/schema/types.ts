export type ResultState = 'pass' | 'fail' | 'unknown' | 'not-applicable' | 'error';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

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

export type UnknownReason =
  | 'parse-error'
  | 'minified'
  | 'generated'
  | 'unsupported-language'
  | 'too-large'
  | 'symlink'
  | 'unreadable';

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

// engine/src/report/delta.ts
import type { Finding, ResultBody, ResultState, UnknownFile } from '../schema/types.ts';
import { cell } from './markdown.ts';

export interface Delta {
  before: ResultState;
  after: ResultState;
  beforeTreeHash: string;
  afterTreeHash: string;
  fixed: Finding[];
  added: Finding[];
  unchanged: Finding[];
  afterUnknownFiles: UnknownFile[];
}

export function diffResults(before: ResultBody, after: ResultBody): Delta {
  const keys = ['ruleId', 'ruleVersion', 'policyCardHash', 'agreementHash', 'obligationHash'] as const;
  const mismatched = keys.filter((k) => before[k] !== after[k]);
  if (mismatched.length > 0) {
    throw new Error(`results are not comparable: ${mismatched.join(', ')} differ`);
  }
  const beforeIds = new Set(before.findings.map((f) => f.id));
  const afterIds = new Set(after.findings.map((f) => f.id));
  return {
    before: before.state,
    after: after.state,
    beforeTreeHash: before.treeHash,
    afterTreeHash: after.treeHash,
    fixed: before.findings.filter((f) => !afterIds.has(f.id)),
    added: after.findings.filter((f) => !beforeIds.has(f.id)),
    unchanged: after.findings.filter((f) => beforeIds.has(f.id)),
    afterUnknownFiles: after.unknownFiles,
  };
}

function section(title: string, findings: Finding[]): string[] {
  const out = [`## ${title} (${findings.length})`, ''];
  if (findings.length === 0) out.push('None.', '');
  for (const f of findings) {
    const e = f.evidence;
    out.push(`- ${cell(`${e.path}:${e.line}:${e.column}`)} ${cell(f.providerId)} ${cell(e.excerpt)}`);
  }
  if (findings.length > 0) out.push('');
  return out;
}

/** What the after-state means. Only `pass` may speak of a fix; every other state says what it is not. */
function afterMeaning(d: Delta): string {
  const gone = d.fixed.length;
  switch (d.after) {
    case 'pass':
      return "No references outside the allowlist were found in the evaluated files, within this rule's scope only. This does not establish compliance.";
    case 'fail':
      return 'At least one reference outside the allowlist is still reported in the after result.';
    case 'unknown':
      return gone > 0
        ? `${gone} finding(s) from the before result are no longer reported, but the after result is UNKNOWN: the rule could not establish a result for the whole scope. This is not a pass.`
        : 'The after result is UNKNOWN: the rule could not establish a result for the whole scope. This is not a pass.';
    case 'error':
      return 'The after result is an evaluator error. It is not a verdict and must not be read as a pass.';
    case 'not-applicable':
      return 'A named human recorded that this commitment does not apply. No scan verdict was produced.';
  }
}

export function renderDeltaMarkdown(d: Delta): string {
  const out: string[] = [
    '# Curb rerun delta',
    '',
    'This compares two scoped Curb results from the same control set. It is not a compliance statement, legal advice or a certification.',
    '',
    `State: **${d.before.toUpperCase()}** to **${d.after.toUpperCase()}**`,
    '',
    afterMeaning(d),
    '',
    `- Before tree hash: ${cell(d.beforeTreeHash)}`,
    `- After tree hash: ${cell(d.afterTreeHash)}`,
    '',
    'Findings are matched by rule, path, byte range and matched value. Moving code changes its range, so a moved reference appears as one removed and one added finding.',
    '',
    ...section(d.after === 'pass' ? 'Fixed' : 'No longer reported', d.fixed),
    ...section('Added', d.added),
    ...section('Unchanged', d.unchanged),
  ];
  if (d.afterUnknownFiles.length > 0) {
    out.push(`## Unknown files in the after result (${d.afterUnknownFiles.length})`, '');
    for (const u of d.afterUnknownFiles) out.push(`- ${cell(u.path)}: ${cell(u.reason)}`);
    out.push('');
  }
  return out.join('\n');
}

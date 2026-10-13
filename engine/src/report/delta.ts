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
  const keys = ['ruleId', 'ruleVersion', 'evaluatorVersion', 'policyCardHash', 'agreementHash', 'obligationHash'] as const;
  const mismatched = keys.filter((k) => before[k] !== after[k]);
  if (mismatched.length > 0) {
    const hint = mismatched.includes('evaluatorVersion') ? '; re-run the earlier scan with the current evaluator' : '';
    throw new Error(`results are not comparable: ${mismatched.join(', ')} differ${hint}`);
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

const NO_COMPLIANCE = "within this rule's scope only. This does not establish compliance.";

/** What the pair of states means. Only an after-state of pass may speak of a fix; no other state is described as a pass. */
function stateMeaning(d: Delta): string[] {
  const out: string[] = [];
  if (d.before === 'not-applicable' && d.after !== 'not-applicable') {
    out.push('The before result was NOT-APPLICABLE (a human recorded that the commitment does not apply, so no scan verdict was produced); there is nothing to compare against.');
  }
  const gone = d.fixed.length;
  switch (d.after) {
    case 'pass':
      if (d.before === 'fail') out.push(`No references outside the allowlist were found in the evaluated files, ${NO_COMPLIANCE}`);
      else if (d.before === 'pass') out.push(`Both results are PASS ${NO_COMPLIANCE}`);
      else if (d.before !== 'not-applicable') out.push(`The after result is PASS (the before result was ${d.before.toUpperCase()}) ${NO_COMPLIANCE}`);
      else out.push(`The after result is PASS ${NO_COMPLIANCE}`);
      break;
    case 'fail':
      if (d.before === 'pass') {
        out.push(`Regression: a previously passing result now has findings (${d.added.length} new).`);
      } else if (d.before === 'fail') {
        out.push(`Some findings remain: ${d.unchanged.length} unchanged, ${d.added.length} new, ${gone} no longer reported.`);
      } else {
        out.push(`The after result has findings (${d.added.length} new); the before result was ${d.before.toUpperCase()}.`);
      }
      break;
    case 'unknown':
      out.push(
        gone > 0
          ? `${gone} finding(s) from the before result are no longer reported, but the after result is UNKNOWN: the rule could not establish a result for the whole scope. This is not a pass.`
          : 'The after result is UNKNOWN: the rule could not establish a result for the whole scope. This is not a pass.',
      );
      break;
    case 'error':
      out.push(
        gone > 0
          ? `${gone} finding(s) from the before result are not reported because the after result is an evaluator error. It is not a verdict and is not a pass.`
          : 'The after result is an evaluator error. It is not a verdict and is not a pass.',
      );
      break;
    case 'not-applicable':
      out.push('The after result is NOT-APPLICABLE: a named human recorded that this commitment does not apply. No scan verdict was produced.');
      break;
  }
  return out;
}

export function renderDeltaMarkdown(d: Delta, notes: string[] = []): string {
  const out: string[] = [
    '# Curb rerun delta',
    '',
    'This compares two scoped Curb results from the same control set. It is not a compliance statement, legal advice or a certification.',
    '',
    ...notes.flatMap((n) => [n, '']),
    `State: **${d.before.toUpperCase()}** to **${d.after.toUpperCase()}**`,
    '',
    ...stateMeaning(d).flatMap((l) => [l, '']),
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

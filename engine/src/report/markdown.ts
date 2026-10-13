// engine/src/report/markdown.ts
import type { Obligation } from '../obligation/obligation.ts';
import type { PolicyCard } from '../policy/card.ts';
import type { ResultFile, ResultState } from '../schema/types.ts';
import { safeText } from '../terminal.ts';

export interface ReportInput {
  file: ResultFile;
  card: PolicyCard;
  obligation: Obligation;
}

const MEANING: Record<ResultState, string> = {
  pass: "No references outside the allowlist were found in the evaluated files, within this rule's scope only. This does not establish compliance.",
  fail: 'At least one reference to a provider outside the allowlist was found. See the findings table for exact locations.',
  unknown: 'The rule could not establish a result for the whole scope. See the unknown files and notes below; this is not a pass.',
  error: 'The evaluator failed. This is not a verdict and must not be read as a pass.',
  'not-applicable': 'A named human recorded that this commitment does not apply. No scan verdict was produced.',
};

const MAX_CELL = 300;

/** Escape untrusted text for use inside a Markdown table cell, as a single code span on one line. */
export function cell(text: string): string {
  if (text.trim() === '') return '`(empty)`';
  let flat = safeText(text).replace(/`/g, "'").replace(/\|/g, '\\u007c');
  if (flat.length > MAX_CELL) {
    let cut = flat.slice(0, MAX_CELL);
    if (/[\ud800-\udbff]$/.test(cut)) cut = cut.slice(0, -1);
    flat = `${cut}…[truncated]`;
  }
  return `\`${flat}\``;
}

export function renderMarkdown({ file, card, obligation }: ReportInput): string {
  const { body, envelope } = file;
  const out: string[] = [];
  out.push('# Curb control verification report', '');
  // card.status and card.nonClaims come from the user's own trusted policy file, so safeText (terminal-safety only) is enough.
  out.push(`> Policy card status: **${safeText(card.status)}**`, '');

  out.push('## Scope and non-claims', '');
  out.push(
    'This report checks configured engineering evidence against one human-confirmed contract commitment. It is not legal advice, a legal conclusion or a compliance certification.',
    '',
  );
  for (const n of card.nonClaims) out.push(`- ${safeText(n)}`);
  out.push('');

  out.push('## Result', '');
  out.push(`**${body.state.toUpperCase()}**: ${MEANING[body.state]}`, '');
  out.push(`Rule: ${cell(body.ruleId)} v${cell(body.ruleVersion)}. Files evaluated: ${Number(body.filesEvaluated)}.`, '');

  out.push('## Confirmed obligation', '');
  out.push(`- Quote: ${cell(obligation.quote)}`);
  out.push(`- Approved by: ${cell(obligation.approver)} at ${cell(obligation.approvedAt)}`);
  out.push(`- Applicability: ${cell(obligation.applicability)}`);
  out.push(`- Provider allowlist: ${obligation.allowlist.length ? obligation.allowlist.map(cell).join(', ') : 'none recorded'}`);
  if (obligation.exception) out.push(`- Exception: ${cell(obligation.exception)}`);
  out.push('');

  out.push('## Findings', '');
  if (body.findings.length === 0) out.push('None.', '');
  else {
    out.push('| Provider | Location | Excerpt | Finding ID |', '|---|---|---|---|');
    for (const f of body.findings) {
      const e = f.evidence;
      out.push(`| ${cell(f.providerId)} | ${cell(`${e.path}:${e.line}:${e.column}`)} | ${cell(e.excerpt)} | ${cell(f.id.slice(0, 12))} |`);
    }
    out.push('');
  }

  out.push('## Unknown files and notes', '');
  if (body.unknownFiles.length === 0 && body.notes.length === 0) out.push('None.', '');
  else {
    for (const u of body.unknownFiles) out.push(`- ${cell(u.path)}: ${cell(u.reason)}`);
    for (const n of body.notes) out.push(`- note: ${cell(n)}`);
    out.push('');
  }

  out.push('## Exclusions', '');
  for (const x of body.exclusions) out.push(`- ${cell(x)}`);
  out.push('');

  out.push('## Inputs and hashes', '');
  out.push(`- Result hash: ${cell(envelope.resultHash)}`);
  out.push(`- Tree hash: ${cell(body.treeHash)}`);
  out.push(`- Agreement text hash: ${cell(body.agreementHash)}`);
  out.push(`- Obligation id: ${cell(body.obligationHash)}`);
  out.push(`- Policy card hash: ${cell(body.policyCardHash)}`);
  out.push(`- Evaluator version: ${cell(body.evaluatorVersion)}`, '');

  out.push('## Run', '');
  out.push(`- Started: ${cell(envelope.startedAt)}`);
  out.push(`- Finished: ${cell(envelope.finishedAt)}`);
  out.push(`- Operator: ${cell(envelope.operator)}`);
  out.push(`- Tenant: ${cell(envelope.tenantId)}`, '');
  return out.join('\n');
}

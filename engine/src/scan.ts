// engine/src/scan.ts
import type { AgreementSnapshot } from './agreement/ingest.ts';
import { EVALUATOR_VERSION, evaluate, type EvaluationOutput } from './evaluator/evaluate.ts';
import { verifyObligation, type Obligation } from './obligation/obligation.ts';
import type { PolicyCard } from './policy/card.ts';
import { canonicalize } from './schema/canonical.ts';
import { sha256 } from './schema/hash.ts';
import type { ResultBody } from './schema/types.ts';
import { takeSnapshot } from './snapshot/snapshot.ts';

export class ObligationNotActiveError extends Error {}

export interface ScanInput {
  repoPath: string;
  card: PolicyCard;
  cardHash: string;
  agreement: AgreementSnapshot;
  obligation: Obligation;
}

export async function runScan(
  input: ScanInput,
  evaluateFn: typeof evaluate = evaluate,
): Promise<{ body: ResultBody; resultHash: string }> {
  const { card, cardHash, agreement, obligation } = input;
  verifyObligation(obligation);
  if (obligation.policyCardId !== card.id || obligation.policyCardVersion !== card.version) {
    throw new Error('obligation was confirmed against a different policy card or version');
  }
  if (obligation.agreementTextSha256 !== agreement.textSha256) {
    throw new Error('obligation does not match the supplied agreement');
  }
  if (obligation.applicability !== 'applies' && obligation.applicability !== 'not-applicable') {
    throw new ObligationNotActiveError(
      `obligation applicability is "${obligation.applicability}"; a scan needs a human decision of "applies" or "not-applicable"`,
    );
  }

  const snapshot = await takeSnapshot(input.repoPath, { skipDirs: card.exclusions.dirs });
  let outcome: EvaluationOutput;
  if (obligation.applicability === 'not-applicable') {
    outcome = { state: 'not-applicable', findings: [], unknownFiles: [], filesEvaluated: 0, notes: ['human-recorded-not-applicable'] };
  } else {
    try {
      outcome = evaluateFn({ snapshot, card, allowlist: obligation.allowlist });
    } catch {
      outcome = { state: 'error', findings: [], unknownFiles: [], filesEvaluated: 0, notes: ['evaluator-exception'] };
    }
  }

  const body: ResultBody = {
    schemaVersion: '1',
    ruleId: card.id,
    ruleVersion: card.version,
    evaluatorVersion: EVALUATOR_VERSION,
    policyCardHash: cardHash,
    treeHash: snapshot.treeHash,
    agreementHash: agreement.textSha256,
    obligationHash: obligation.id,
    state: outcome.state,
    findings: outcome.findings,
    unknownFiles: outcome.unknownFiles,
    filesEvaluated: outcome.filesEvaluated,
    exclusions: [...card.exclusions.dirs.map((d) => `dir:${d}`), ...card.exclusions.files.map((f) => `file:${f}`)].sort(),
    notes: outcome.notes,
  };
  return { body, resultHash: sha256(canonicalize(body)) };
}

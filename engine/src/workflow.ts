// engine/src/workflow.ts
import { ingestAgreement } from './agreement/ingest.ts';
import {
  confirmObligation,
  locateQuote,
  type Applicability,
  type Obligation,
} from './obligation/obligation.ts';
import type { PolicyCard } from './policy/card.ts';
import type { ResultFile, ResultState } from './schema/types.ts';
import type { evaluate } from './evaluator/evaluate.ts';
import { sha256 } from './schema/hash.ts';
import { HEX64 } from './schema/hashing.ts';
import { runScan } from './scan.ts';
import type { AuditLog, BlobStore, TenantContext } from './store/types.ts';

export interface Deps {
  ctx: TenantContext;
  blobs: BlobStore;
  audit: AuditLog;
  now?: () => Date; // test-only seam: a fixed clock for reproducible envelopes
}

export interface ConfirmFields {
  quote: string;
  start?: number;
  applicability: Applicability;
  allowlist: string[];
  approver: string;
  approvedAt: string;
  exception?: string;
}

export async function confirmAndRecord(
  deps: Deps,
  agreementRaw: Uint8Array,
  card: PolicyCard,
  fields: ConfirmFields,
): Promise<Obligation> {
  const agreement = ingestAgreement(agreementRaw);
  if (fields.start !== undefined && !Number.isInteger(fields.start)) {
    throw new Error('start must be an integer');
  }
  const range =
    fields.start === undefined
      ? locateQuote(agreement.text, fields.quote)
      : { start: fields.start, end: fields.start + fields.quote.length };
  const obligation = confirmObligation(
    {
      agreementTextSha256: agreement.textSha256,
      quote: fields.quote,
      range,
      policyCardId: card.id,
      policyCardVersion: card.version,
      applicability: fields.applicability,
      allowlist: fields.allowlist,
      approver: fields.approver,
      approvedAt: fields.approvedAt,
      exception: fields.exception,
    },
    agreement,
    card,
  );
  await deps.blobs.put(deps.ctx, agreementRaw);
  await deps.audit.append(deps.ctx, 'obligation.confirmed', {
    obligationId: obligation.id,
    agreementRawSha256: agreement.rawSha256,
    approver: obligation.approver,
  });
  return obligation;
}

export function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Best effort: records that a scan was refused or failed before producing a result. Never throws. */
export async function recordRefusal(deps: Deps, raw: unknown, reason: string): Promise<void> {
  try {
    const data: Record<string, string> = { reason: reason.slice(0, 200) };
    const id = typeof raw === 'object' && raw !== null ? (raw as { id?: unknown }).id : undefined;
    if (typeof id === 'string' && HEX64.test(id)) data.obligationId = id;
    await deps.audit.append(deps.ctx, 'scan.refused', data);
  } catch {
    // The caller rethrows the original error; a failed audit write must not replace it.
  }
}

export function exitCodeFor(state: ResultState): number {
  return state === 'error' ? 3 : 0;
}

export async function scanAndRecord(
  deps: Deps,
  a: { repoPath: string; agreementRaw: Uint8Array; card: PolicyCard; cardHash: string; obligation: Obligation },
  evaluateFn?: typeof evaluate, // test-only seam: lets tests inject an evaluator failure
): Promise<ResultFile & { diagnostics: string[] }> {
  const now = deps.now ?? (() => new Date());
  const startedAt = now().toISOString();
  let scanned;
  try {
    const agreement = ingestAgreement(a.agreementRaw);
    scanned = await runScan(
      {
        repoPath: a.repoPath,
        card: a.card,
        cardHash: a.cardHash,
        agreement,
        obligation: a.obligation,
      },
      evaluateFn,
    );
  } catch (e) {
    await recordRefusal(deps, a.obligation, reasonOf(e));
    throw e;
  }
  const file: ResultFile = {
    body: scanned.body,
    envelope: {
      resultHash: scanned.resultHash,
      startedAt,
      finishedAt: now().toISOString(),
      operator: deps.ctx.actor,
      tenantId: deps.ctx.tenantId,
    },
  };
  try {
    const stored = JSON.stringify(file, null, 2);
    const sha = await deps.blobs.put(deps.ctx, stored);
    const back = await deps.blobs.get(deps.ctx, sha);
    if (back === null || sha256(back) !== sha) throw new Error('stored result blob did not read back intact');
    await deps.audit.append(deps.ctx, 'scan.completed', {
      resultHash: file.envelope.resultHash,
      state: file.body.state,
      treeHash: file.body.treeHash,
    });
  } catch (e) {
    throw new Error(
      `scan completed with result sha256:${file.envelope.resultHash} but recording failed: ${reasonOf(e)}`,
      { cause: e },
    );
  }
  return { ...file, diagnostics: scanned.diagnostics };
}

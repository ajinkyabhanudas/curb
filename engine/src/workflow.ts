// engine/src/workflow.ts
import { ingestAgreement } from './agreement/ingest.ts';
import {
  confirmObligation,
  locateQuote,
  type Applicability,
  type Obligation,
} from './obligation/obligation.ts';
import type { PolicyCard } from './policy/card.ts';
import type { ResultFile } from './schema/types.ts';
import { ObligationNotActiveError, runScan } from './scan.ts';
import type { AuditLog, BlobStore, TenantContext } from './store/types.ts';

export interface Deps {
  ctx: TenantContext;
  blobs: BlobStore;
  audit: AuditLog;
  now?: () => Date;
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

export async function scanAndRecord(
  deps: Deps,
  a: { repoPath: string; agreementRaw: Uint8Array; card: PolicyCard; cardHash: string; obligation: Obligation },
): Promise<ResultFile> {
  const now = deps.now ?? (() => new Date());
  const agreement = ingestAgreement(a.agreementRaw);
  const startedAt = now().toISOString();
  let scanned;
  try {
    scanned = await runScan({
      repoPath: a.repoPath,
      card: a.card,
      cardHash: a.cardHash,
      agreement,
      obligation: a.obligation,
    });
  } catch (e) {
    if (e instanceof ObligationNotActiveError) {
      await deps.audit.append(deps.ctx, 'scan.refused', { obligationId: a.obligation.id, reason: e.message });
    }
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
  await deps.blobs.put(deps.ctx, JSON.stringify(file, null, 2));
  await deps.audit.append(deps.ctx, 'scan.completed', {
    resultHash: file.envelope.resultHash,
    state: file.body.state,
    treeHash: file.body.treeHash,
  });
  return file;
}

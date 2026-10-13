import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCard } from '../src/policy/card.ts';
import { FsAuditLog, FsBlobStore } from '../src/store/fs.ts';
import { confirmAndRecord, scanAndRecord, type Deps } from '../src/workflow.ts';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CARD_PATH = path.join(ROOT, 'policies/unapproved-provider-reference.v1.json');

export async function makeRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'curb-repo-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
  return dir;
}

export const AGREEMENT_PATH = path.join(ROOT, 'fixtures/agreement/synthetic-ai-addendum.md');
export const QUOTE =
  'Provider will route Customer Content for model inference only to the following model providers: Anthropic.';
export const FIXED_NOW = () => new Date('2026-10-13T09:00:00.000Z');

export async function fixtureDeps(): Promise<Deps> {
  const store = await mkdtemp(path.join(tmpdir(), 'curb-store-'));
  return {
    ctx: { tenantId: 'demo', actor: 'test-reviewer' },
    blobs: new FsBlobStore(store),
    audit: new FsAuditLog(store, FIXED_NOW),
    now: FIXED_NOW,
  };
}

export async function confirmFixture(deps: Deps) {
  const { card, hash } = await loadCard(CARD_PATH);
  const agreementRaw = await readFile(AGREEMENT_PATH);
  const obligation = await confirmAndRecord(deps, agreementRaw, card, {
    quote: QUOTE,
    applicability: 'applies',
    allowlist: ['anthropic'],
    approver: 'Test Reviewer',
    approvedAt: '2026-10-13T09:00:00.000Z',
  });
  return { card, cardHash: hash, agreementRaw, obligation };
}

export async function scanFixture(
  deps: Deps,
  confirmed: Awaited<ReturnType<typeof confirmFixture>>,
  repo: string,
) {
  return scanAndRecord(deps, {
    repoPath: path.join(ROOT, 'fixtures/repos', repo),
    agreementRaw: confirmed.agreementRaw,
    card: confirmed.card,
    cardHash: confirmed.cardHash,
    obligation: confirmed.obligation,
  });
}

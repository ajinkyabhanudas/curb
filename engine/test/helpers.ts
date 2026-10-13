import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize } from '../src/schema/canonical.ts';
import { sha256 } from '../src/schema/hash.ts';
import type { ResultBody, ResultFile } from '../src/schema/types.ts';
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

const run = promisify(execFile);
export const cli = (args: string[]) => run('node', ['src/cli.ts', ...args], { cwd: ROOT });

/** Rewrite a result file's body and re-hash it, as a forger would. Finding ids are left as given. */
export function forge(file: ResultFile, mutate: (body: ResultBody) => void): ResultFile {
  const copy = structuredClone(file);
  mutate(copy.body);
  copy.envelope.resultHash = sha256(canonicalize(copy.body));
  return copy;
}

/** Confirm once through the CLI, then offer a scan helper that writes result files into the same temp dir. */
export async function cliSetup(applicability = 'applies') {
  const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
  const ob = path.join(dir, 'ob.json');
  await cli([
    'confirm', '--agreement', AGREEMENT_PATH, '--card', CARD_PATH, '--quote', QUOTE, '--allow', 'anthropic',
    '--approver', 'Test Reviewer', '--at', '2026-10-13T09:00:00.000Z', '--store', dir, '--out', ob,
    '--applicability', applicability,
  ]);
  const scan = async (repo: string, out: string, extra: string[] = []) => {
    const repoPath = path.isAbsolute(repo) ? repo : path.join(ROOT, 'fixtures/repos', repo);
    await cli([
      'scan', '--repo', repoPath, '--card', CARD_PATH, '--agreement', AGREEMENT_PATH,
      '--obligation', ob, '--store', dir, '--out', out, ...extra,
    ]).catch((e: { code: number }) => {
      if (e.code !== 1) throw e;
    });
  };
  const reportArgs = (res: string) => ['report', '--result', res, '--card', CARD_PATH, '--agreement', AGREEMENT_PATH, '--obligation', ob];
  return { dir, ob, scan, reportArgs };
}

export async function readResult(p: string): Promise<ResultFile> {
  return JSON.parse(await readFile(p, 'utf8')) as ResultFile;
}

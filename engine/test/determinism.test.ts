import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ingestAgreement } from '../src/agreement/ingest.ts';
import { runScan } from '../src/scan.ts';
import { scanAndRecord } from '../src/workflow.ts';
import { ROOT, confirmFixture, fixtureDeps } from './helpers.ts';

async function copyTree(src: string, transform: (s: string) => string, reverse: boolean): Promise<string> {
  const dst = await mkdtemp(path.join(tmpdir(), 'curb-copy-'));
  const rels: string[] = [];
  for (const rel of await readdir(src, { recursive: true })) {
    if ((await stat(path.join(src, rel))).isFile()) rels.push(rel);
  }
  if (reverse) rels.reverse();
  for (const rel of rels) {
    await mkdir(path.dirname(path.join(dst, rel)), { recursive: true });
    await writeFile(path.join(dst, rel), transform(await readFile(path.join(src, rel), 'utf8')));
  }
  return dst;
}

describe('determinism', () => {
  it('gives one result hash across path, line endings and file creation order', async () => {
    const confirmed = await confirmFixture(await fixtureDeps());
    const agreement = ingestAgreement(confirmed.agreementRaw);
    const src = path.join(ROOT, 'fixtures/repos/mutated');
    const variants = [
      src,
      await copyTree(src, (s) => s, false),
      await copyTree(src, (s) => s.replace(/\n/g, '\r\n'), false),
      await copyTree(src, (s) => s, true),
    ];
    const hashes: string[] = [];
    for (const repoPath of variants) {
      const { resultHash } = await runScan({
        repoPath, card: confirmed.card, cardHash: confirmed.cardHash, agreement, obligation: confirmed.obligation,
      });
      hashes.push(resultHash);
    }
    expect(new Set(hashes).size).toBe(1);
  });

  it('gives one result hash for a different actor and clock', async () => {
    const depsA = await fixtureDeps();
    const confirmed = await confirmFixture(depsA);
    const depsB = { ...(await fixtureDeps()), ctx: { tenantId: 'other', actor: 'someone-else' }, now: () => new Date('2030-01-01T00:00:00.000Z') };
    const input = {
      repoPath: path.join(ROOT, 'fixtures/repos/mutated'),
      agreementRaw: confirmed.agreementRaw,
      card: confirmed.card,
      cardHash: confirmed.cardHash,
      obligation: confirmed.obligation,
    };
    const a = await scanAndRecord(depsA, input);
    const b = await scanAndRecord(depsB, input);
    expect(b.envelope.operator).toBe('someone-else');
    expect(b.envelope.startedAt).not.toBe(a.envelope.startedAt);
    expect(b.envelope.resultHash).toBe(a.envelope.resultHash);
  });
});

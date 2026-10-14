import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { EVALUATOR_VERSION } from '../src/evaluator/evaluate.ts';
import { BlobIntegrityError } from '../src/store/fs.ts';
import type { BlobStore } from '../src/store/types.ts';
import { scanAndRecord } from '../src/workflow.ts';
import { ROOT, confirmFixture, fixtureDeps, scanFixture } from './helpers.ts';

async function scanWith(blobs: (real: BlobStore) => BlobStore) {
  const deps = await fixtureDeps();
  const confirmed = await confirmFixture(deps);
  const wrapped = { ...deps, blobs: blobs(deps.blobs) };
  return scanAndRecord(wrapped, {
    repoPath: path.join(ROOT, 'fixtures/repos/fixed'),
    agreementRaw: confirmed.agreementRaw,
    card: confirmed.card,
    cardHash: confirmed.cardHash,
    obligation: confirmed.obligation,
  });
}

describe('scanAndRecord reads the stored result back', () => {
  it('succeeds when the blob reads back intact', async () => {
    await expect(scanWith((b) => b)).resolves.toMatchObject({ body: { state: 'pass' } });
  });
  it('fails as a recording failure when the blob reads back different bytes', async () => {
    await expect(scanWith((b) => ({ put: (c, d) => b.put(c, d), get: async () => new Uint8Array([1, 2, 3]) }))).rejects.toThrow(/recording failed/);
  });
  it('fails when the blob is missing after put', async () => {
    await expect(scanWith((b) => ({ put: (c, d) => b.put(c, d), get: async () => null }))).rejects.toThrow(/recording failed/);
  });
  it('fails when the store reports an integrity error', async () => {
    await expect(
      scanWith((b) => ({
        put: (c, d) => b.put(c, d),
        get: async () => {
          throw new BlobIntegrityError('bad');
        },
      })),
    ).rejects.toThrow(/recording failed/);
  });
});

describe('evaluator version', () => {
  it('records the TypeScript version so a parser upgrade changes the result hash', async () => {
    const s = { deps: await fixtureDeps() };
    const confirmed = await confirmFixture(s.deps);
    const r = await scanFixture(s.deps, confirmed, 'fixed');
    expect(r.body.evaluatorVersion).toBe(`${EVALUATOR_VERSION}+typescript-${ts.version}`);
  });
});

describe('policy card', () => {
  it('lists template-literal URLs ending at or inside the host as a false-negative risk', async () => {
    const card = JSON.parse(await readFile(path.join(ROOT, 'policies/unapproved-provider-reference.v1.json'), 'utf8'));
    const hit = card.falseNegativeRisks.filter((r: string) => r.includes('https://api.openai.com${path}') && r.includes(':${port}'));
    expect(hit).toHaveLength(1);
  });
});

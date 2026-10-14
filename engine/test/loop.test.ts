import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffResults } from '../src/report/delta.ts';
import { confirmAndRecord, scanAndRecord } from '../src/workflow.ts';
import { QUOTE, ROOT, confirmFixture, fixtureDeps, scanFixture } from './helpers.ts';

describe('seeded-fix loop (M2)', () => {
  it('mutation fails, fix passes, rerun is reproducible, and only the intended finding flips', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);

    const failing = await scanFixture(deps, confirmed, 'mutated');
    expect(failing.body.state).toBe('fail');
    expect(failing.body.findings).toHaveLength(1);

    const fixed = await scanFixture(deps, confirmed, 'fixed');
    expect(fixed.body.state).toBe('pass');
    expect(fixed.body.filesEvaluated).toBe(2);

    const rerun = await scanFixture(deps, confirmed, 'fixed');
    expect(rerun.envelope.resultHash).toBe(fixed.envelope.resultHash);

    const delta = diffResults(failing.body, fixed.body);
    expect(delta.fixed.map((f) => f.id)).toEqual(failing.body.findings.map((f) => f.id));
    expect(delta.added).toEqual([]);
    expect(await deps.audit.verify(deps.ctx)).toBe(true);

    // the stored blobs round-trip: each is addressed by its own hash and parses back to the scanned file
    for (const f of [failing, fixed]) {
      const { diagnostics: _d, ...file } = f;
      const stored = await deps.blobs.get(deps.ctx, createHash('sha256').update(JSON.stringify(file, null, 2)).digest('hex'));
      expect(stored).not.toBeNull();
      expect(JSON.parse(Buffer.from(stored!).toString('utf8'))).toEqual(file);
    }
  });
});

describe('model catalog held in literals, reached through a variable (real-repo gap)', () => {
  const CATALOG = path.join(ROOT, 'fixtures/repos/catalog');

  async function confirmWith(allowlist: string[]) {
    const deps = await fixtureDeps();
    const base = await confirmFixture(deps);
    const obligation = await confirmAndRecord(deps, base.agreementRaw, base.card, {
      quote: QUOTE,
      applicability: 'applies',
      allowlist,
      approver: 'Test Reviewer',
      approvedAt: '2026-10-13T09:00:00.000Z',
    });
    const scan = (repoPath: string) =>
      scanAndRecord(deps, { repoPath, agreementRaw: base.agreementRaw, card: base.card, cardHash: base.cardHash, obligation });
    return { deps, scan };
  }

  it('fails with exactly the three catalog entries outside an anthropic-only allowlist', async () => {
    const { scan } = await confirmWith(['anthropic']);
    const out = await scan(CATALOG);
    expect(out.body.state).toBe('fail');
    expect(out.body.filesEvaluated).toBe(2);
    expect(out.body.unknownFiles).toEqual([]);
    expect(out.body.findings.map((f) => `${f.evidence.path}:${f.evidence.line} ${f.providerId} ${f.matched}`)).toEqual([
      'lib/ai/models.ts:11 openai openai/gpt-5-mini',
      'lib/ai/models.ts:12 xai xai/grok-4.1-fast',
      'lib/ai/models.ts:13 deepseek deepseek/deepseek-v3.2',
    ]);
  });

  it('passes when every catalog provider is allowed', async () => {
    const { scan } = await confirmWith(['anthropic', 'openai', 'xai', 'deepseek']);
    const out = await scan(CATALOG);
    expect(out.body.state).toBe('pass');
    expect(out.body.findings).toEqual([]);
  });

  it('removing the three entries flips FAIL to PASS with three fixed findings', async () => {
    const { scan } = await confirmWith(['anthropic']);
    const before = await scan(CATALOG);
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-catalog-'));
    await cp(CATALOG, dir, { recursive: true });
    const models = path.join(dir, 'lib/ai/models.ts');
    const kept = (await readFile(models, 'utf8'))
      .split('\n')
      .filter((l) => !/'(openai|xai|deepseek)\//.test(l))
      .join('\n');
    await writeFile(models, kept);
    const after = await scan(dir);
    expect(`${before.body.state} -> ${after.body.state}`).toBe('fail -> pass');
    const delta = diffResults(before.body, after.body);
    expect(delta.fixed.map((f) => f.providerId)).toEqual(['openai', 'xai', 'deepseek']);
    expect(delta.added).toEqual([]);
    expect(delta.unchanged).toEqual([]);
  });
});

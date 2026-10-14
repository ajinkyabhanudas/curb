import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { diffResults } from '../src/report/delta.ts';
import { confirmFixture, fixtureDeps, scanFixture } from './helpers.ts';

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

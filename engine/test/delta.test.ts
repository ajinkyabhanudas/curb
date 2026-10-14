import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffResults, renderDeltaMarkdown } from '../src/report/delta.ts';
import type { ResultBody } from '../src/schema/types.ts';
import { scanAndRecord } from '../src/workflow.ts';
import { CARD_PATH, ROOT, cli, cliSetup, confirmFixture, fixtureDeps, forge, readResult, scanFixture } from './helpers.ts';

const GOLDENS = ['delta-fixed.md', 'delta-unknown.md', 'delta-regression.md'].map((f) => path.join(ROOT, 'test/golden', f));
// Evaluated at import time, before any snapshot can be written, so a deleted golden fails instead of regenerating.
const GOLDEN_EXISTED = GOLDENS.map((g) => existsSync(g));

describe('delta golden files', () => {
  it('exist on disk before the suite runs', () => {
    expect(GOLDEN_EXISTED).toEqual(GOLDENS.map(() => true));
  });
});

async function setup() {
  const deps = await fixtureDeps();
  const confirmed = await confirmFixture(deps);
  return { deps, confirmed };
}
type Setup = Awaited<ReturnType<typeof setup>>;

async function scanDir(s: Setup, repoPath: string, evaluateFn?: Parameters<typeof scanAndRecord>[2]) {
  return scanAndRecord(
    s.deps,
    { repoPath, agreementRaw: s.confirmed.agreementRaw, card: s.confirmed.card, cardHash: s.confirmed.cardHash, obligation: s.confirmed.obligation },
    evaluateFn,
  );
}

/** A temp copy of the fixed fixture plus the given extra files. */
async function fixedPlus(extra: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'curb-var-'));
  await cp(path.join(ROOT, 'fixtures/repos/fixed'), dir, { recursive: true });
  for (const [rel, content] of Object.entries(extra)) await writeFile(path.join(dir, rel), content);
  return dir;
}

const STATUS = 'draft, pending counsel approval';
const NEVER_PASS = /\bfixed\b|\bpass(ing|ed)?\b/;
const scrub = (md: string) => md.replace(/not a pass/g, '').toLowerCase();

describe('diffResults', () => {
  it('reports the single fixed finding between mutated and fixed', async () => {
    const s = await setup();
    const before = (await scanFixture(s.deps, s.confirmed, 'mutated')).body;
    const after = (await scanFixture(s.deps, s.confirmed, 'fixed')).body;
    const d = diffResults(before, after);
    expect(d.before).toBe('fail');
    expect(d.after).toBe('pass');
    expect(d.fixed).toHaveLength(1);
    expect(d.added).toHaveLength(0);
    expect(d.unchanged).toHaveLength(0);
    const md = renderDeltaMarkdown(d, STATUS);
    expect(md).toContain(`\`${before.treeHash}\``);
    expect(md).toContain(`\`${after.treeHash}\``);
    expect(md).toMatch(/not a compliance statement/);
    // the card status sits right under the heading, followed by the non-claims line (final review B1)
    expect(md.split('\n').slice(0, 5)).toEqual([
      '# Curb rerun delta',
      '',
      `> Policy card status: **${STATUS}**`,
      '',
      'This compares two scoped Curb results from the same control set. It is not a compliance statement, legal advice or a certification.',
    ]);
    await expect(md).toMatchFileSnapshot('./golden/delta-fixed.md');
  });

  it('treats identical results as all unchanged', async () => {
    const s = await setup();
    const a = (await scanFixture(s.deps, s.confirmed, 'mutated')).body;
    const d = diffResults(a, a);
    expect(d.unchanged).toHaveLength(1);
    expect(d.fixed).toHaveLength(0);
  });

  it('refuses to compare results from different control sets', async () => {
    const s = await setup();
    const a = (await scanFixture(s.deps, s.confirmed, 'mutated')).body;
    for (const k of ['ruleId', 'ruleVersion', 'policyCardHash', 'agreementHash', 'obligationHash'] as const) {
      expect(() => diffResults(a, { ...a, [k]: 'x' })).toThrow(new RegExp(`not comparable: ${k} differ`));
    }
    expect(() => diffResults(a, { ...a, evaluatorVersion: '9.9.9' })).toThrow(
      'results are not comparable: evaluatorVersion differ; re-run the earlier scan with the current evaluator',
    );
  });

  it('never calls an unknown after-state fixed or passing when findings disappear', async () => {
    const s = await setup();
    const before = (await scanFixture(s.deps, s.confirmed, 'mutated')).body;
    const afterFile = await scanDir(s, await fixedPlus({ 'vendor.min.js': 'var a=1;\n' }));
    expect(afterFile.body.state).toBe('unknown');
    expect(afterFile.body.findings).toHaveLength(0);
    const d = diffResults(before, afterFile.body);
    expect(d.fixed).toHaveLength(1);
    const md = renderDeltaMarkdown(d, STATUS);
    expect(md).toContain('no longer reported');
    expect(md).toContain('not a pass');
    expect(scrub(md)).not.toMatch(NEVER_PASS);
    await expect(md).toMatchFileSnapshot('./golden/delta-unknown.md');
  });

  it('pass to fail reads as a regression', async () => {
    const s = await setup();
    const pass = (await scanFixture(s.deps, s.confirmed, 'fixed')).body;
    const fail = (await scanFixture(s.deps, s.confirmed, 'mutated')).body;
    const d = diffResults(pass, fail);
    expect(d.added).toHaveLength(1);
    const md = renderDeltaMarkdown(d, STATUS);
    expect(md).toContain('a previously passing result now has findings');
    expect(md).not.toContain('## Fixed');
    expect(md.toLowerCase()).not.toMatch(/\bfixed\b/);
    await expect(md).toMatchFileSnapshot('./golden/delta-regression.md');
  });

  it('fail to fail says findings remain and which are new', async () => {
    const s = await setup();
    const before = (await scanFixture(s.deps, s.confirmed, 'mutated')).body;
    // different finding: the old openai import is gone, a new one sits in another file
    const after = (await scanDir(s, await fixedPlus({ 'extra.ts': "import { openai } from '@ai-sdk/openai';\n" }))).body;
    expect(after.state).toBe('fail');
    const d = diffResults(before, after);
    expect(d.fixed).toHaveLength(1);
    expect(d.added).toHaveLength(1);
    const md = renderDeltaMarkdown(d, STATUS);
    expect(md).toContain('Some findings remain');
    expect(md).toContain('1 new');
    expect(md).not.toContain('## Fixed');
    expect(md.toLowerCase()).not.toMatch(/\bfixed\b/);
  });

  it('fail to error never says fixed or passing', async () => {
    const s = await setup();
    const before = (await scanFixture(s.deps, s.confirmed, 'mutated')).body;
    const after = (await scanDir(s, path.join(ROOT, 'fixtures/repos/fixed'), () => {
      throw new Error('boom');
    })).body;
    expect(after.state).toBe('error');
    const md = renderDeltaMarkdown(diffResults(before, after), STATUS);
    expect(md).toContain('not a verdict');
    expect(scrub(md)).not.toMatch(NEVER_PASS);
  });

  it('pass to pass is stated plainly', async () => {
    const s = await setup();
    const a = (await scanFixture(s.deps, s.confirmed, 'fixed')).body;
    const md = renderDeltaMarkdown(diffResults(a, a), STATUS);
    expect(md).toContain('Both results are PASS');
    expect(md).toContain('does not establish compliance');
  });

  it('unknown to pass is stated plainly', async () => {
    const s = await setup();
    const unknown = (await scanDir(s, await fixedPlus({ 'vendor.min.js': 'var a=1;\n' }))).body;
    const pass = (await scanFixture(s.deps, s.confirmed, 'fixed')).body;
    const md = renderDeltaMarkdown(diffResults(unknown, pass), STATUS);
    expect(md).toContain('before result was UNKNOWN');
    expect(md).toContain('does not establish compliance');
  });

  it('gives not-applicable its own sentence on either side', async () => {
    const s = await setup();
    const pass = (await scanFixture(s.deps, s.confirmed, 'fixed')).body;
    const na: ResultBody = { ...pass, state: 'not-applicable', findings: [], unknownFiles: [], filesEvaluated: 0, notes: ['human-recorded-not-applicable'] };
    const toNa = renderDeltaMarkdown(diffResults(pass, na), STATUS);
    expect(toNa).toContain('NOT-APPLICABLE: a named human recorded that this commitment does not apply');
    expect(scrub(toNa)).not.toMatch(/\bfixed\b/);
    const fromNa = renderDeltaMarkdown(diffResults(na, pass), STATUS);
    expect(fromNa).toContain('before result was NOT-APPLICABLE');
  });

  it('neutralises untrusted text in findings and unknown paths', async () => {
    const s = await setup();
    const a = (await scanFixture(s.deps, s.confirmed, 'mutated')).body;
    const evil = structuredClone(a);
    evil.findings[0]!.evidence.excerpt = 'x | `y` <b>\x1b[31m‮';
    evil.findings[0]!.evidence.path = 'p|\nq.ts';
    evil.state = 'unknown';
    evil.unknownFiles = [{ path: 'u\x1b[31m|.ts', reason: 'parse-error' }];
    const md = renderDeltaMarkdown(diffResults(evil, { ...evil, findings: [] }), STATUS);
    expect(md).not.toMatch(/[\u001b‮]/);
    expect(md).not.toMatch(/\|/);
  });
});

describe('curb diff CLI', () => {
  async function pair() {
    const c = await cliSetup();
    const before = path.join(c.dir, 'before.json');
    const after = path.join(c.dir, 'after.json');
    await c.scan('mutated', before);
    await c.scan('fixed', after);
    return { ...c, before, after };
  }

  it('prints the delta and writes --out, refusing to overwrite without --force', async () => {
    const { dir, before, after } = await pair();
    const { stdout } = await cli(['diff', '--card', CARD_PATH, '--before', before, '--after', after]);
    expect(stdout).toContain('**FAIL** to **PASS**');
    const out = path.join(dir, 'delta.md');
    await cli(['diff', '--card', CARD_PATH, '--before', before, '--after', after, '--out', out]);
    expect(await readFile(out, 'utf8')).toBe(stdout);
    await expect(cli(['diff', '--card', CARD_PATH, '--before', before, '--after', after, '--out', out])).rejects.toMatchObject({
      code: 2, stderr: expect.stringContaining('--force'),
    });
    await cli(['diff', '--card', CARD_PATH, '--before', before, '--after', after, '--out', out, '--force']);
  });

  it('refuses an edited or malformed result file', async () => {
    const { dir, before, after } = await pair();
    const f = await readResult(before);
    f.body.state = 'pass';
    f.body.findings = [];
    const edited = path.join(dir, 'edited.json');
    await writeFile(edited, JSON.stringify(f));
    await expect(cli(['diff', '--card', CARD_PATH, '--before', edited, '--after', after])).rejects.toMatchObject({
      code: 2, stderr: expect.stringMatching(/result hash does not match its body/),
    });
    await expect(cli(['diff', '--card', CARD_PATH, '--before', before, '--after', edited])).rejects.toMatchObject({ code: 2 });
    const bad = path.join(dir, 'bad.json');
    await writeFile(bad, JSON.stringify({ body: { state: 'great' }, envelope: {} }));
    await expect(cli(['diff', '--card', CARD_PATH, '--before', bad, '--after', after])).rejects.toMatchObject({
      code: 2, stderr: expect.stringMatching(/not a valid result/),
    });
  });

  it('refuses results from different control sets', async () => {
    const { dir, before, after } = await pair();
    const other = path.join(dir, 'other.json');
    await writeFile(other, JSON.stringify(forge(await readResult(after), (b) => void (b.ruleVersion = '9.9.9'))));
    await expect(cli(['diff', '--card', CARD_PATH, '--before', before, '--after', other])).rejects.toMatchObject({
      code: 2, stderr: expect.stringContaining('not comparable: ruleVersion differ'),
    });
  });

  it('refuses the same result passed twice', async () => {
    const { dir, before } = await pair();
    await expect(cli(['diff', '--card', CARD_PATH, '--before', before, '--after', before])).rejects.toMatchObject({
      code: 2, stderr: expect.stringContaining('both files are the same result'),
    });
    // a copy with a different envelope but the same hash is still the same result
    const copy = await readResult(before);
    copy.envelope.startedAt = '2030-01-01T00:00:00.000Z';
    const copyPath = path.join(dir, 'copy.json');
    await writeFile(copyPath, JSON.stringify(copy));
    await expect(cli(['diff', '--card', CARD_PATH, '--before', before, '--after', copyPath])).rejects.toMatchObject({ code: 2 });
  });

  it('requires --card and prints its status under the heading (final review B1)', async () => {
    const { before, after } = await pair();
    await expect(cli(['diff', '--before', before, '--after', after])).rejects.toMatchObject({
      code: 2, stderr: expect.stringContaining('--card'),
    });
    const { stdout } = await cli(['diff', '--card', CARD_PATH, '--before', before, '--after', after]);
    expect(stdout.split('\n')[2]).toBe(`> Policy card status: **${STATUS}**`);
  });

  it('refuses a --card that is not the card both results were produced with', async () => {
    const { dir, before, after } = await pair();
    const card = JSON.parse(await readFile(CARD_PATH, 'utf8')) as Record<string, unknown>;
    card.status = 'approved by counsel';
    const other = path.join(dir, 'card2.json');
    await writeFile(other, JSON.stringify(card));
    await expect(cli(['diff', '--card', other, '--before', before, '--after', after])).rejects.toMatchObject({
      code: 2,
      stdout: '',
      stderr: expect.stringContaining('--card does not match the policy card hash recorded in the results'),
    });
  });

  it('notes when the before run started after the after run', async () => {
    const { before, after } = await pair();
    const { stdout: ordered } = await cli(['diff', '--card', CARD_PATH, '--before', before, '--after', after]);
    expect(ordered).not.toContain('check the argument order');
    const { stdout } = await cli(['diff', '--card', CARD_PATH, '--before', after, '--after', before]);
    expect(stdout).toContain("Note: the 'before' run started after the 'after' run; check the argument order");
  });
});

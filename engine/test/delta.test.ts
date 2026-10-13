import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { diffResults, renderDeltaMarkdown } from '../src/report/delta.ts';
import type { ResultFile } from '../src/schema/types.ts';
import { scanAndRecord } from '../src/workflow.ts';
import { AGREEMENT_PATH, CARD_PATH, QUOTE, ROOT, confirmFixture, fixtureDeps, scanFixture } from './helpers.ts';

const GOLDENS = ['delta-fixed.md', 'delta-unknown.md'].map((f) => path.join(ROOT, 'test/golden', f));
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

/** Scan a temp copy of the fixed fixture that also holds a minified file, so the rule cannot analyse it. */
async function scanFixedWithMinified(s: Awaited<ReturnType<typeof setup>>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'curb-unk-'));
  await cp(path.join(ROOT, 'fixtures/repos/fixed'), dir, { recursive: true });
  await writeFile(path.join(dir, 'vendor.min.js'), 'var a=1;\n');
  return scanAndRecord(s.deps, {
    repoPath: dir,
    agreementRaw: s.confirmed.agreementRaw,
    card: s.confirmed.card,
    cardHash: s.confirmed.cardHash,
    obligation: s.confirmed.obligation,
  });
}

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
    const md = renderDeltaMarkdown(d);
    expect(md).toContain(`\`${before.treeHash}\``);
    expect(md).toContain(`\`${after.treeHash}\``);
    expect(md).toMatch(/not a compliance statement/);
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
  });

  it('never calls an unknown after-state fixed or passing when findings disappear', async () => {
    const s = await setup();
    const before = (await scanFixture(s.deps, s.confirmed, 'mutated')).body;
    const afterFile = await scanFixedWithMinified(s);
    expect(afterFile.body.state).toBe('unknown');
    expect(afterFile.body.findings).toHaveLength(0);
    const d = diffResults(before, afterFile.body);
    expect(d.fixed).toHaveLength(1);
    const md = renderDeltaMarkdown(d);
    expect(md).toContain('no longer reported');
    expect(md).toContain('not a pass');
    const stripped = md.replace(/not a pass/g, '').toLowerCase();
    expect(stripped).not.toMatch(/\bfixed\b|\bpass(ing|ed)?\b/);
    await expect(md).toMatchFileSnapshot('./golden/delta-unknown.md');
  });

  it('neutralises untrusted text in findings and unknown paths', async () => {
    const s = await setup();
    const a = (await scanFixture(s.deps, s.confirmed, 'mutated')).body;
    const evil = structuredClone(a);
    evil.findings[0]!.evidence.excerpt = 'x | `y` <b>\x1b[31m‮';
    evil.findings[0]!.evidence.path = 'p|\nq.ts';
    evil.state = 'unknown';
    evil.unknownFiles = [{ path: 'u\x1b[31m|.ts', reason: 'parse-error' }];
    const md = renderDeltaMarkdown(diffResults(evil, { ...evil, findings: [] }));
    expect(md).not.toMatch(/[\u001b‮]/);
    expect(md).not.toMatch(/\|/);
  });
});

const run = promisify(execFile);
const cli = (args: string[]) => run('node', ['src/cli.ts', ...args], { cwd: ROOT });

async function cliResults() {
  const dir = await mkdtemp(path.join(tmpdir(), 'curb-diff-'));
  const ob = path.join(dir, 'ob.json');
  await cli([
    'confirm', '--agreement', AGREEMENT_PATH, '--card', CARD_PATH, '--quote', QUOTE, '--allow', 'anthropic',
    '--approver', 'Test Reviewer', '--at', '2026-10-13T09:00:00.000Z', '--store', dir, '--out', ob,
  ]);
  const scan = (repo: string, out: string) =>
    cli([
      'scan', '--repo', path.join(ROOT, 'fixtures/repos', repo), '--card', CARD_PATH, '--agreement', AGREEMENT_PATH,
      '--obligation', ob, '--store', dir, '--out', out,
    ]).catch((e: { code: number }) => {
      if (e.code !== 1) throw e;
    });
  const before = path.join(dir, 'before.json');
  const after = path.join(dir, 'after.json');
  await scan('mutated', before);
  await scan('fixed', after);
  return { dir, before, after };
}

describe('curb diff CLI', () => {
  it('prints the delta and writes --out, refusing to overwrite without --force', async () => {
    const { dir, before, after } = await cliResults();
    const { stdout } = await cli(['diff', '--before', before, '--after', after]);
    expect(stdout).toContain('**FAIL** to **PASS**');
    const out = path.join(dir, 'delta.md');
    await cli(['diff', '--before', before, '--after', after, '--out', out]);
    expect(await readFile(out, 'utf8')).toBe(stdout);
    await expect(cli(['diff', '--before', before, '--after', after, '--out', out])).rejects.toMatchObject({
      code: 2, stderr: expect.stringContaining('--force'),
    });
    await cli(['diff', '--before', before, '--after', after, '--out', out, '--force']);
  });

  it('refuses an edited or malformed result file', async () => {
    const { dir, before, after } = await cliResults();
    const f = JSON.parse(await readFile(before, 'utf8')) as ResultFile;
    f.body.state = 'pass';
    f.body.findings = [];
    const edited = path.join(dir, 'edited.json');
    await writeFile(edited, JSON.stringify(f));
    await expect(cli(['diff', '--before', edited, '--after', after])).rejects.toMatchObject({
      code: 2, stderr: expect.stringMatching(/result hash does not match its body/),
    });
    await expect(cli(['diff', '--before', before, '--after', edited])).rejects.toMatchObject({ code: 2 });
    const bad = path.join(dir, 'bad.json');
    await writeFile(bad, JSON.stringify({ body: { state: 'great' }, envelope: {} }));
    await expect(cli(['diff', '--before', bad, '--after', after])).rejects.toMatchObject({
      code: 2, stderr: expect.stringMatching(/not a valid result/),
    });
  });

  it('refuses results from different control sets', async () => {
    const { dir, before, after } = await cliResults();
    const f = JSON.parse(await readFile(after, 'utf8')) as ResultFile;
    f.body.ruleVersion = '9.9.9';
    const { sha256 } = await import('../src/schema/hash.ts');
    const { canonicalize } = await import('../src/schema/canonical.ts');
    f.envelope.resultHash = sha256(canonicalize(f.body));
    const other = path.join(dir, 'other.json');
    await writeFile(other, JSON.stringify(f));
    await expect(cli(['diff', '--before', before, '--after', other])).rejects.toMatchObject({
      code: 2, stderr: expect.stringContaining('not comparable: ruleVersion differ'),
    });
  });
});

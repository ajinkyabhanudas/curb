import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { cell, renderMarkdown } from '../src/report/markdown.ts';
import type { ResultFile } from '../src/schema/types.ts';
import { canonicalize } from '../src/schema/canonical.ts';
import { sha256 } from '../src/schema/hash.ts';
import { parseResultFile } from '../src/schema/result.ts';
import { confirmAndRecord, scanAndRecord } from '../src/workflow.ts';
import { AGREEMENT_PATH, CARD_PATH, QUOTE, ROOT, confirmFixture, fixtureDeps, makeRepo, scanFixture } from './helpers.ts';

const GOLDENS = ['report-fail.md', 'report-pass.md', 'report-unknown.md'].map((f) => path.join(ROOT, 'test/golden', f));
// Evaluated at import time, before any snapshot can be written, so a deleted golden fails instead of regenerating.
const GOLDEN_EXISTED = GOLDENS.map((g) => existsSync(g));

describe('golden files', () => {
  it('exist on disk before the suite runs', () => {
    expect(GOLDEN_EXISTED).toEqual(GOLDENS.map(() => true));
  });
});

async function failReport() {
  const deps = await fixtureDeps();
  const confirmed = await confirmFixture(deps);
  const file = await scanFixture(deps, confirmed, 'mutated');
  return { file, card: confirmed.card, obligation: confirmed.obligation, deps };
}

describe('renderMarkdown', () => {
  it('matches the reviewed golden report', async () => {
    const md = renderMarkdown(await failReport());
    await expect(md).toMatchFileSnapshot('./golden/report-fail.md');
  });

  it('puts the card status and the non-claims before the result', async () => {
    const md = renderMarkdown(await failReport());
    const status = md.indexOf('draft, pending counsel approval');
    const nonClaims = md.indexOf('Does not establish which provider receives data at runtime');
    const result = md.indexOf('## Result');
    expect(status).toBeGreaterThan(-1);
    expect(status).toBeLessThan(result);
    expect(nonClaims).toBeGreaterThan(-1);
    expect(nonClaims).toBeLessThan(result);
  });

  it('states the result in words, not only colour or symbols', async () => {
    expect(renderMarkdown(await failReport())).toMatch(/\*\*FAIL\*\*/);
  });

  it('never calls the repository compliant', async () => {
    expect(renderMarkdown(await failReport()).toLowerCase()).not.toMatch(/\bis compliant\b|\bcertified\b/);
  });

  it('is byte-identical across runs and contains no absolute store or repo path', async () => {
    const a = await failReport();
    const b = await failReport();
    const mdA = renderMarkdown(a);
    expect(renderMarkdown(b)).toBe(mdA);
    expect(mdA).not.toContain(ROOT);
    expect(mdA).not.toContain(tmpdir());
  });

  it('keeps hostile repo text inside one code span per table row, with no raw control or bidi characters', async () => {
    const r = await failReport();
    const hostile = 'a|b `c` <script>x</script> [x](javascript:alert(1))\nnext \x1b[2K evil\u202eevil';
    const f0 = r.file.body.findings[0]!;
    const file: ResultFile = {
      ...r.file,
      body: {
        ...r.file.body,
        findings: [
          {
            ...f0,
            providerId: 'p|\u202e\nq',
            evidence: { ...f0.evidence, path: 'a\u202eb|c`d\ne.ts', excerpt: hostile },
          },
        ],
        unknownFiles: [{ path: 'u\x1b[31m|\u202e.ts', reason: 'parse-error' }],
        notes: ['n\x1b\u202e|\nx'],
      },
      envelope: { ...r.file.envelope, operator: 'op\u202e\n|', tenantId: 'te\x1bn|ant' },
    };
    const md = renderMarkdown({ ...r, file, obligation: { ...r.obligation, quote: 'q\x1b\u202e|`\nz', approver: 'ap\u202e\n' } });
    expect(md).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff\u2028\u2029]/);
    const rows = md.split('\n').filter((l) => l.includes('javascript:alert'));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.startsWith('| ')).toBe(true);
    // header has 4 columns; the row must split into exactly 4 cells on unescaped pipes
    expect(row.split('|').length).toBe(6);
    const excerptCell = row.split('|')[3]!.trim();
    expect(excerptCell.startsWith('`') && excerptCell.endsWith('`')).toBe(true);
    expect(excerptCell.slice(1, -1)).not.toContain('`');
    expect(excerptCell).toContain('<script>');
    expect(excerptCell).toContain('\\u202e');
    expect(excerptCell).toContain('\\x1b');
    expect(md).toContain('\\x0a');
  });
});

async function reportFor(files: Record<string, string>, opts: { applicability?: 'applies' | 'not-applicable'; evaluateFn?: never } = {}, evaluateFn?: Parameters<typeof scanAndRecord>[2]) {
  const deps = await fixtureDeps();
  const base = await confirmFixture(deps);
  let obligation = base.obligation;
  if (opts.applicability === 'not-applicable') {
    obligation = await confirmAndRecord(deps, base.agreementRaw, base.card, {
      quote: QUOTE, applicability: 'not-applicable', allowlist: ['anthropic'], approver: 'Test Reviewer', approvedAt: '2026-10-13T09:00:00.000Z',
    });
  }
  const repo = await makeRepo(files);
  const file = await scanAndRecord(
    deps,
    { repoPath: repo, agreementRaw: base.agreementRaw, card: base.card, cardHash: base.cardHash, obligation },
    evaluateFn,
  );
  return { file, card: base.card, obligation };
}

describe('renderMarkdown for every result state', () => {
  it('pass: scope-limited wording, golden', async () => {
    const r = await reportFor({ 'a.ts': 'export const x = 1;\n' });
    expect(r.file.body.state).toBe('pass');
    const md = renderMarkdown(r);
    expect(md).toContain('within this rule');
    expect(md).toContain('does not establish compliance');
    await expect(md).toMatchFileSnapshot('./golden/report-pass.md');
  });
  it('unknown: lists the unknown file and note, golden', async () => {
    const r = await reportFor({ 'broken.ts': 'const = = ;;; {{{\n', 'ok.ts': 'export {};\n' });
    expect(r.file.body.state).toBe('unknown');
    const md = renderMarkdown(r);
    expect(md).toMatch(/\*\*UNKNOWN\*\*/);
    expect(md).toContain('`broken.ts`');
    expect(md).toContain('this is not a pass');
    await expect(md).toMatchFileSnapshot('./golden/report-unknown.md');
  });
  it('error: says it is not a verdict', async () => {
    const r = await reportFor({ 'a.ts': 'export {};\n' }, {}, () => {
      throw new Error('boom');
    });
    expect(r.file.body.state).toBe('error');
    expect(renderMarkdown(r)).toContain('must not be read as a pass');
  });
  it('not-applicable: says a human recorded it', async () => {
    const r = await reportFor({ 'a.ts': 'export {};\n' }, { applicability: 'not-applicable' });
    expect(r.file.body.state).toBe('not-applicable');
    const md = renderMarkdown(r);
    expect(md).toContain('A named human recorded that this commitment does not apply');
    expect(md).not.toContain('**PASS**');
  });
});

describe('every result-file value is escaped', () => {
  const PAYLOAD = '# heading [x](javascript:alert(1)) <img onerror=1> `tick`\n## second\n- item\n| a | b |';
  const BENIGN = 'benign';
  async function build(v: string) {
    const r = await failReport();
    const b = r.file.body;
    const file: ResultFile = {
      body: {
        ...b,
        ruleId: v, ruleVersion: v, evaluatorVersion: v,
        notes: [v], exclusions: [v],
        unknownFiles: [{ path: v, reason: v as never }],
        findings: [{ ...b.findings[0]!, providerId: v, id: v }],
      },
      envelope: { ...r.file.envelope, startedAt: v, finishedAt: v, operator: v, tenantId: v },
    };
    return renderMarkdown({ ...r, file });
  }
  const shape = (md: string) => ({
    headings: md.split('\n').filter((l) => l.startsWith('#')).length,
    rows: md.split('\n').filter((l) => l.startsWith('|')).length,
    items: md.split('\n').filter((l) => l.startsWith('- ')).length,
    lines: md.split('\n').length,
  });
  it('changes no document structure and leaves no raw markup outside a code span', async () => {
    const hostile = await build(PAYLOAD);
    expect(shape(hostile)).toEqual(shape(await build(BENIGN)));
    expect(hostile).not.toMatch(/^\s*(##? second|- item)/m);
    // outside code spans nothing hostile remains
    const outside = hostile.replace(/`[^`]*`/g, '');
    expect(outside).not.toMatch(/javascript:|<img|\[x\]/);
  });
});

describe('cell limits', () => {
  it('renders empty and whitespace-only text as (empty)', () => {
    expect(cell('')).toBe('`(empty)`');
    expect(cell('  \t ')).toBe('`(empty)`');
  });
  it('caps long text and marks the truncation', () => {
    const out = cell('x'.repeat(1000));
    expect(out).toBe(`\`${'x'.repeat(300)}…[truncated]\``);
  });
});

describe('cell', () => {
  it('neutralises pipes, backticks, newlines and HTML in untrusted source text', () => {
    const out = cell('a | b `c` <script>alert(1)</script>\nnext');
    expect(out).not.toMatch(/\n/);
    expect(out).not.toContain('|');
    expect(out.startsWith('`') && out.endsWith('`')).toBe(true);
    expect(out.slice(1, -1)).not.toContain('`');
  });
  it('escapes control and bidi characters', () => {
    const out = cell('x\x1b\u202ey\r\n');
    expect(out).not.toMatch(/[\u0000-\u001f\u202e]/);
  });
});

const run = promisify(execFile);
const cli = (args: string[]) => run('node', ['src/cli.ts', ...args], { cwd: ROOT });

async function cliFixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'curb-rep-'));
  const ob = path.join(dir, 'ob.json');
  const res = path.join(dir, 'res.json');
  await cli([
    'confirm', '--agreement', AGREEMENT_PATH, '--card', CARD_PATH, '--quote', QUOTE, '--allow', 'anthropic',
    '--approver', 'Test Reviewer', '--at', '2026-10-13T09:00:00.000Z', '--store', dir, '--out', ob,
  ]);
  await cli([
    'scan', '--repo', path.join(ROOT, 'fixtures/repos/mutated'), '--card', CARD_PATH, '--agreement', AGREEMENT_PATH,
    '--obligation', ob, '--store', dir, '--out', res,
  ]).catch((e: { code: number }) => {
    if (e.code !== 1) throw e;
  });
  const args = ['report', '--result', res, '--card', CARD_PATH, '--agreement', AGREEMENT_PATH, '--obligation', ob];
  return { dir, ob, res, args };
}

describe('curb report CLI', () => {
  it('renders Markdown, and refuses to overwrite without --force', async () => {
    const { dir, args } = await cliFixture();
    const out = path.join(dir, 'report.md');
    await cli([...args, '--out', out]);
    expect(await readFile(out, 'utf8')).toMatch(/\*\*FAIL\*\*/);
    await expect(cli([...args, '--out', out])).rejects.toMatchObject({ code: 2, stderr: expect.stringMatching(/--force/) });
    await cli([...args, '--out', out, '--force']);
  });

  it('refuses a result produced for a different obligation, agreement, card or rule', async () => {
    const { dir, res, args } = await cliFixture();
    const original = JSON.parse(await readFile(res, 'utf8')) as ResultFile;
    for (const field of ['obligationHash', 'agreementHash', 'policyCardHash', 'ruleId', 'ruleVersion'] as const) {
      const tampered = structuredClone(original);
      tampered.body[field] = field.endsWith('Hash') ? 'f'.repeat(64) : 'other';
      tampered.envelope.resultHash = sha256(canonicalize(tampered.body)); // keep the file self-consistent so only the input check can fire
      const file = path.join(dir, `t-${field}.json`);
      await writeFile(file, JSON.stringify(tampered));
      const a = [...args];
      a[a.indexOf('--result') + 1] = file;
      await expect(cli(a)).rejects.toMatchObject({ code: 2, stderr: expect.stringContaining(field) });
    }
    // a different agreement file
    const other = path.join(dir, 'other.md');
    await writeFile(other, '# Other\n');
    const a = [...args];
    a[a.indexOf('--agreement') + 1] = other;
    await expect(cli(a)).rejects.toMatchObject({ code: 2 });
  });

  it('refuses a result file with the wrong shape', async () => {
    const { dir, args } = await cliFixture();
    const bad = path.join(dir, 'bad.json');
    for (const body of [{ state: 'great', findings: [] }, { state: 'pass', findings: 'x' }]) {
      await writeFile(bad, JSON.stringify({ body, envelope: {} }));
      const a = [...args];
      a[a.indexOf('--result') + 1] = bad;
      await expect(cli(a)).rejects.toMatchObject({ code: 2, stderr: expect.stringMatching(/result/) });
    }
  });
});

describe('curb report CLI integrity and mismatches', () => {
  it('--format json also refuses a mismatched obligation', async () => {
    const { dir, ob, args } = await cliFixture();
    const o = JSON.parse(await readFile(ob, 'utf8')) as Record<string, unknown>;
    o.allowlist = ['openai'];
    const other = path.join(dir, 'ob2.json');
    await writeFile(other, JSON.stringify(o));
    const a = [...args, '--format', 'json'];
    a[a.indexOf('--obligation') + 1] = other;
    await expect(cli(a)).rejects.toMatchObject({ code: 2 });
  });

  it('refuses a mismatched --card', async () => {
    const { dir, args } = await cliFixture();
    const card = JSON.parse(await readFile(CARD_PATH, 'utf8')) as Record<string, unknown>;
    card.owner = 'someone else';
    const other = path.join(dir, 'card2.json');
    await writeFile(other, JSON.stringify(card));
    const a = [...args];
    a[a.indexOf('--card') + 1] = other;
    await expect(cli(a)).rejects.toMatchObject({ code: 2 });
  });

  it('refuses a result whose body was edited but whose hash was not', async () => {
    const { dir, res, args } = await cliFixture();
    const f = JSON.parse(await readFile(res, 'utf8')) as ResultFile;
    f.body.state = 'pass';
    f.body.findings = [];
    const edited = path.join(dir, 'edited.json');
    await writeFile(edited, JSON.stringify(f));
    const a = [...args];
    a[a.indexOf('--result') + 1] = edited;
    await expect(cli(a)).rejects.toMatchObject({ code: 2, stderr: expect.stringMatching(/result hash does not match its body: the file was edited/) });
    await expect(cli([...a, '--format', 'json'])).rejects.toMatchObject({ code: 2 });
  });

  it('refuses an edited finding id', async () => {
    const { dir, res, args } = await cliFixture();
    const f = JSON.parse(await readFile(res, 'utf8')) as ResultFile;
    f.body.findings[0]!.id = 'a'.repeat(64);
    // keep the result hash consistent so only the id check can fire
    f.envelope.resultHash = sha256(canonicalize(f.body));
    const edited = path.join(dir, 'edited-id.json');
    await writeFile(edited, JSON.stringify(f));
    const a = [...args];
    a[a.indexOf('--result') + 1] = edited;
    await expect(cli(a)).rejects.toMatchObject({ code: 2, stderr: expect.stringMatching(/finding id does not match/) });
  });
});

describe('parseResultFile', () => {
  async function valid(): Promise<Record<string, any>> {
    const { body, envelope } = (await failReport()).file;
    return JSON.parse(JSON.stringify({ body, envelope }));
  }
  const cases: Array<[string, (f: Record<string, any>) => void, RegExp]> = [
    ['missing unknownFiles', (f) => delete f.body.unknownFiles, /body\.unknownFiles/],
    ['non-object finding', (f) => (f.body.findings = ['x']), /body\.findings\[0\]/],
    ['bad state', (f) => (f.body.state = 'great'), /body\.state/],
    ['wrong schemaVersion', (f) => (f.body.schemaVersion = '2'), /body\.schemaVersion/],
    ['unknown body key', (f) => (f.body.extra = 1), /body\.extra/],
    ['unknown top key', (f) => (f.extra = 1), /result\.extra/],
    ['short hash', (f) => (f.body.treeHash = 'abc'), /body\.treeHash/],
    ['bad severity', (f) => (f.body.findings[0].severity = 'urgent'), /severity/],
    ['missing evidence', (f) => delete f.body.findings[0].evidence, /evidence/],
    ['float line', (f) => (f.body.findings[0].evidence.line = 1.5), /evidence\.line/],
    ['negative filesEvaluated', (f) => (f.body.filesEvaluated = -1), /filesEvaluated/],
    ['bad unknown reason', (f) => (f.body.unknownFiles = [{ path: 'a', reason: 'weird' }]), /unknownFiles\[0\]\.reason/],
    ['non-string note', (f) => (f.body.notes = [1]), /body\.notes\[0\]/],
    ['bad envelope hash', (f) => (f.envelope.resultHash = 'zz'), /envelope\.resultHash/],
    ['missing operator', (f) => delete f.envelope.operator, /envelope\.operator/],
  ];
  for (const [name, mutate, re] of cases) {
    it(`rejects ${name}`, async () => {
      const f = await valid();
      mutate(f);
      expect(() => parseResultFile(f)).toThrow(re);
      expect(() => parseResultFile(f)).toThrow(/^--result file is not a valid result: /);
    });
  }
  it('accepts a real result, including a symlink unknown file', async () => {
    const f = await valid();
    f.body.unknownFiles = [{ path: 'l', reason: 'symlink' }];
    expect(parseResultFile(f)).toBe(f);
    expect(() => parseResultFile(null)).toThrow(/result/);
  });
});

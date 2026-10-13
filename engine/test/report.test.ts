import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { cell, renderMarkdown } from '../src/report/markdown.ts';
import type { ResultFile } from '../src/schema/types.ts';
import { AGREEMENT_PATH, CARD_PATH, QUOTE, ROOT, confirmFixture, fixtureDeps, scanFixture } from './helpers.ts';

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
    const { dir, ob, res, args } = await cliFixture();
    const original = JSON.parse(await readFile(res, 'utf8')) as ResultFile;
    for (const field of ['obligationHash', 'agreementHash', 'policyCardHash', 'ruleId', 'ruleVersion'] as const) {
      const tampered = structuredClone(original);
      tampered.body[field] = 'f'.repeat(8);
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
    void ob;
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

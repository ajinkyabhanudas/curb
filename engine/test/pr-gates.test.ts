import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers.ts';

const run = promisify(execFile);
const SCRIPT = path.join(ROOT, 'scripts/check-pr-gates.sh');

interface Case {
  branch?: string;
  title?: string;
  body?: string;
  files?: string;
}

async function gate(c: Case): Promise<{ code: number; out: string }> {
  const env = {
    PATH: process.env.PATH ?? '',
    PR_BRANCH: c.branch ?? 'CURB-35-pr-gates',
    PR_TITLE: c.title ?? 'CURB-35: Add the PR gates',
    PR_BODY: c.body ?? '',
    CHANGED_FILES: c.files ?? 'docs/x.md',
  };
  try {
    const { stdout, stderr } = await run('sh', [SCRIPT], { env });
    return { code: 0, out: stdout + stderr };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, out: (err.stdout ?? '') + (err.stderr ?? '') };
  }
}

const REVIEW = 'Independent review: feature-dev:code-reviewer, no blocking findings';

describe('PR gates: ticket key', () => {
  it('passes a branch and a title that carry a CURB key', async () => {
    expect((await gate({})).code).toBe(0);
  });

  it('fails a branch without a CURB key', async () => {
    const r = await gate({ branch: 'my-fix' });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/branch/);
  });

  it('fails a branch with an invented prefix such as KAN-6', async () => {
    expect((await gate({ branch: 'KAN-6-thing' })).code).toBe(1);
  });

  it('fails a title without a CURB key', async () => {
    const r = await gate({ title: 'Fix the thing' });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/title/);
  });

  it('does not accept a key in the middle of the branch name', async () => {
    expect((await gate({ branch: 'fix/CURB-35-pr-gates' })).code).toBe(1);
  });
});

describe('PR gates: independent review on high-risk paths', () => {
  const HIGH = [
    'engine/src/evaluator/evaluate.ts',
    'engine/src/snapshot/snapshot.ts',
    'engine/src/store/fs.ts',
    'engine/src/schema/result.ts',
    'engine/policies/unapproved-provider-reference.v1.json',
  ];

  for (const file of HIGH) {
    it(`fails a change to ${file} with no review line`, async () => {
      const r = await gate({ files: `docs/x.md\n${file}\n`, body: 'Summary only.' });
      expect(r.code).toBe(1);
      expect(r.out).toMatch(/Independent review/);
    });

    it(`passes a change to ${file} with a review line`, async () => {
      expect((await gate({ files: file, body: `Summary.\n\n${REVIEW}\n` })).code).toBe(0);
    });
  }

  it('does not ask for a review line when only tests, docs or workflow files change', async () => {
    const r = await gate({ files: 'engine/test/evaluator.test.ts\ndocs/curb/charter.md\n.github/workflows/ci.yml\nengine/src/cli.ts' });
    expect(r.code).toBe(0);
  });

  it('rejects placeholder review lines', async () => {
    for (const value of ['none', 'None', 'n/a', 'N/A', 'TODO', 'tbd', 'pending', '-', '', '   ']) {
      const r = await gate({ files: HIGH[0], body: `Independent review: ${value}\n` });
      expect(r.code, `value "${value}"`).toBe(1);
    }
  });

  it('accepts a review line in a GitHub body with CRLF line endings', async () => {
    const body = `Summary.\r\n\r\n${REVIEW}\r\n\r\nMore text.\r\n`;
    expect((await gate({ files: HIGH[0], body })).code).toBe(0);
  });

  // GitHub sends bodies with CRLF; a stray CR must not turn a placeholder into a "real" value.
  it('rejects a placeholder review line in a CRLF body', async () => {
    for (const value of ['none', 'N/A', 'TODO']) {
      const r = await gate({ files: HIGH[0], body: `Summary.\r\nIndependent review: ${value}\r\n` });
      expect(r.code, `value "${value}"`).toBe(1);
    }
  });

  it('does not take a review line that is only quoted inside other text', async () => {
    const r = await gate({ files: HIGH[0], body: `We will add an Independent review: later.\n` });
    expect(r.code).toBe(1);
  });

  it('treats shell syntax in the body and title as plain text', async () => {
    const body = `$(touch /tmp/pr-gates-pwned) \`id\`\n${REVIEW}\n`;
    const r = await gate({ files: HIGH[0], body, title: 'CURB-35: "quoted" $(id)' });
    expect(r.code).toBe(0);
  });
});

describe('PR gates: the script and the workflow profile agree', () => {
  it('lists exactly the high-risk paths named in docs/workflow/profile.md', async () => {
    const profile = await readFile(path.join(ROOT, '../docs/workflow/profile.md'), 'utf8');
    const line = profile.split('\n').find((l) => l.startsWith('Independent whole-branch review'));
    expect(line).toBeDefined();
    const fromProfile = line!.split(':')[1].split(',').map((s) => s.trim()).filter(Boolean).sort();
    const script = await readFile(SCRIPT, 'utf8');
    const fromScript = [...script.matchAll(/^\s*HIGH_RISK_PATHS="([^"]+)"/gm)].flatMap((m) => m[1].split(/\s+/)).sort();
    expect(fromScript).toEqual(fromProfile);
  });
});

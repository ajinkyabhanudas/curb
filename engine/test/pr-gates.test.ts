import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { ROOT } from './helpers.ts';

const run = promisify(execFile);
const SCRIPT = path.join(ROOT, 'scripts/check-pr-gates.sh');

const GIT = ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false'];
const git = (cwd: string, ...args: string[]) => run('git', [...GIT, ...args], { cwd });
const tempDirs: string[] = [];
afterAll(async () => {
  for (const d of tempDirs) await rm(d, { recursive: true, force: true });
});

// Paths that exist on the base branch, so a pull request can modify, rename or delete them.
const BASE_FILES = [
  'docs/x.md',
  'engine/src/evaluator/evaluate.ts',
  'engine/src/snapshot/snapshot.ts',
  'engine/src/store/fs.ts',
  'engine/src/schema/result.ts',
  'engine/policies/unapproved-provider-reference.v1.json',
  'engine/src/cli.ts',
  'engine/scripts/check-pr-gates.sh',
  '.github/workflows/ci.yml',
  'docs/workflow/profile.md',
];

interface Change {
  edit?: string[];
  add?: string[];
  remove?: string[];
  rename?: [string, string][];
  // Files edited on main after the branch point, as when the base branch has moved on.
  baseMovesOn?: string[];
}

async function repoWithChange(change: Change): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'curb-gates-'));
  tempDirs.push(dir);
  await git(dir, 'init', '-q', '-b', 'main');
  for (const f of BASE_FILES) {
    await mkdir(path.dirname(path.join(dir, f)), { recursive: true });
    await writeFile(path.join(dir, f), `base ${f}\n`);
  }
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '-q', '-m', 'base');
  await git(dir, 'switch', '-q', '-c', 'feature');
  for (const f of change.edit ?? []) await writeFile(path.join(dir, f), `edited ${f}\n`);
  for (const f of change.add ?? []) {
    await mkdir(path.dirname(path.join(dir, f)), { recursive: true });
    await writeFile(path.join(dir, f), 'new\n');
  }
  for (const f of change.remove ?? []) await rm(path.join(dir, f));
  for (const [from, to] of change.rename ?? []) {
    await mkdir(path.dirname(path.join(dir, to)), { recursive: true });
    await rename(path.join(dir, from), path.join(dir, to));
  }
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '-q', '-m', 'change', '--allow-empty');
  if (change.baseMovesOn) {
    await git(dir, 'switch', '-q', 'main');
    for (const f of change.baseMovesOn) await writeFile(path.join(dir, f), `moved on ${f}\n`);
    await git(dir, 'add', '-A');
    await git(dir, 'commit', '-q', '-m', 'main moves on');
    await git(dir, 'switch', '-q', 'feature');
  }
  return dir;
}

interface Case {
  branch?: string;
  title?: string;
  body?: string;
  change?: Change;
  base?: string | null;
}

async function gate(c: Case): Promise<{ code: number; out: string }> {
  const dir = await repoWithChange(c.change ?? { edit: ['docs/x.md'] });
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    PR_BRANCH: c.branch ?? 'CURB-35-pr-gates',
    PR_TITLE: c.title ?? 'CURB-35: Add the PR gates',
    PR_BODY: c.body ?? '',
  };
  if (c.base !== null) env.BASE_REVISION = c.base ?? 'main';
  try {
    const { stdout, stderr } = await run('sh', [SCRIPT], { env, cwd: dir });
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

describe('PR gates: independent review on high-risk and gate paths', () => {
  const HIGH = [
    'engine/src/evaluator/evaluate.ts',
    'engine/src/snapshot/snapshot.ts',
    'engine/src/store/fs.ts',
    'engine/src/schema/result.ts',
    'engine/policies/unapproved-provider-reference.v1.json',
  ];
  const GATE = ['engine/scripts/check-pr-gates.sh', '.github/workflows/ci.yml', 'docs/workflow/profile.md'];

  for (const file of [...HIGH, ...GATE]) {
    it(`fails a change to ${file} with no review line`, async () => {
      const r = await gate({ change: { edit: [file] }, body: 'Summary only.' });
      expect(r.code).toBe(1);
      expect(r.out).toMatch(/Independent review/);
    });

    it(`passes a change to ${file} with a review line`, async () => {
      expect((await gate({ change: { edit: [file] }, body: `Summary.\n\n${REVIEW}\n` })).code).toBe(0);
    });
  }

  it('sees a file moved out of a high-risk path (a rename shows only the new name by default)', async () => {
    const change = { rename: [['engine/src/evaluator/evaluate.ts', 'engine/src/eval2/evaluate.ts']] as [string, string][] };
    const r = await gate({ change, body: 'Summary only.' });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/engine\/src\/evaluator\/evaluate\.ts/);
  });

  it('sees a deleted high-risk file', async () => {
    expect((await gate({ change: { remove: ['engine/src/snapshot/snapshot.ts'] }, body: '' })).code).toBe(1);
  });

  it('sees new files with non-ASCII names, spaces or quotes in a high-risk directory (git quotes such names)', async () => {
    for (const name of ['engine/src/evaluator/é.ts', 'engine/src/evaluator/with space.ts', 'engine/src/evaluator/q"uote.ts']) {
      const r = await gate({ change: { add: [name] }, body: '' });
      expect(r.code, name).toBe(1);
    }
  });

  it('does not ask for a review line when only tests, docs or other source change', async () => {
    const r = await gate({ change: { add: ['engine/test/new.test.ts', 'docs/curb/new.md'], edit: ['engine/src/cli.ts'] } });
    expect(r.code).toBe(0);
  });

  it('compares with the branch point, so changes that landed on the base branch later do not count', async () => {
    const r = await gate({ change: { edit: ['docs/x.md'], baseMovesOn: ['engine/src/evaluator/evaluate.ts'] }, body: '' });
    expect(r.code).toBe(0);
  });

  it('fails when the base revision is not given or does not exist', async () => {
    expect((await gate({ base: null })).code).toBe(1);
    const unknown = await gate({ base: 'no-such-branch' });
    expect(unknown.code).toBe(128); // git's own fatal exit status, not a missing tool
    expect(unknown.out).toMatch(/no-such-branch/);
  });

  it('refuses a base revision that starts with a dash instead of passing it to git as an option', async () => {
    const r = await gate({ base: '--output=/tmp/pr-gates-option' });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/must not start with/);
  });

  it('rejects placeholder review lines', async () => {
    const change = { edit: [HIGH[0]] };
    for (const value of ['none', 'None', 'no', 'n/a', 'N/A', 'TODO', 'tbd', 'pending', '-', 'none yet', 'not done', '<reviewer and verdict>', '', '   ']) {
      const r = await gate({ change, body: `Independent review: ${value}\n` });
      expect(r.code, `value "${value}"`).toBe(1);
    }
  });

  it('accepts a review line in a GitHub body with CRLF line endings', async () => {
    const body = `Summary.\r\n\r\n${REVIEW}\r\n\r\nMore text.\r\n`;
    expect((await gate({ change: { edit: [HIGH[0]] }, body })).code).toBe(0);
  });

  // GitHub sends bodies with CRLF; a stray CR must not turn a placeholder into a "real" value.
  it('rejects a placeholder review line in a CRLF body', async () => {
    for (const value of ['none', 'N/A', 'TODO']) {
      const r = await gate({ change: { edit: [HIGH[0]] }, body: `Summary.\r\nIndependent review: ${value}\r\n` });
      expect(r.code, `value "${value}"`).toBe(1);
    }
  });

  it('does not take a review line that is only quoted inside other text', async () => {
    const r = await gate({ change: { edit: [HIGH[0]] }, body: `We will add an Independent review: later.\n` });
    expect(r.code).toBe(1);
  });

  it('treats shell syntax in the body and title as plain text', async () => {
    const body = `$(touch /tmp/pr-gates-pwned) \`id\`\n${REVIEW}\n`;
    const r = await gate({ change: { edit: [HIGH[0]] }, body, title: 'CURB-35: "quoted" $(id)' });
    expect(r.code).toBe(0);
  });
});

describe('PR gates: the script, the profile and the repository agree', () => {
  it('lists exactly the high-risk paths named in docs/workflow/profile.md', async () => {
    const profile = await readFile(path.join(ROOT, '../docs/workflow/profile.md'), 'utf8');
    const line = profile.split('\n').find((l) => l.startsWith('Independent whole-branch review'));
    expect(line).toBeDefined();
    const fromProfile = line!.split(':')[1].split(',').map((s) => s.trim()).filter(Boolean).sort();
    const script = await readFile(SCRIPT, 'utf8');
    const fromScript = [...script.matchAll(/^\s*HIGH_RISK_PATHS="([^"]+)"/gm)].flatMap((m) => m[1].split(/\s+/)).sort();
    expect(fromScript).toEqual(fromProfile);
  });

  it('protects the gate script, the workflow directory and the profile, and they exist', async () => {
    const script = await readFile(SCRIPT, 'utf8');
    const gatePaths = [...script.matchAll(/^\s*GATE_PATHS="([^"]+)"/gm)].flatMap((m) => m[1].split(/\s+/)).sort();
    expect(gatePaths).toEqual(['.github/workflows/', 'docs/workflow/profile.md', 'engine/scripts/check-pr-gates.sh']);
    for (const p of gatePaths) await readFile(path.join(ROOT, '..', p.endsWith('/') ? p + 'ci.yml' : p), 'utf8');
  });
});

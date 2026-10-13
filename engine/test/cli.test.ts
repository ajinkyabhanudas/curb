import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/schema/canonical.ts';
import { sha256 } from '../src/schema/hash.ts';
import { AGREEMENT_PATH, CARD_PATH, QUOTE, ROOT, makeRepo } from './helpers.ts';

const run = promisify(execFile);
const cli = (args: string[]) => run('node', ['src/cli.ts', ...args], { cwd: ROOT });

describe('curb CLI (M1)', () => {
  it('confirm then scan prints FAIL with file:line evidence and a result hash', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    const obligationFile = path.join(dir, 'obligation.json');
    const resultFile = path.join(dir, 'result.json');
    await cli([
      'confirm', '--agreement', AGREEMENT_PATH, '--card', CARD_PATH, '--quote', QUOTE,
      '--allow', 'anthropic', '--approver', 'Test Reviewer', '--at', '2026-10-13T09:00:00.000Z',
      '--store', dir, '--out', obligationFile,
    ]);
    const { stdout } = await cli([
      'scan', '--repo', path.join(ROOT, 'fixtures/repos/mutated'), '--card', CARD_PATH,
      '--agreement', AGREEMENT_PATH, '--obligation', obligationFile, '--store', dir, '--out', resultFile,
    ]);
    expect(stdout).toMatch(/^FAIL/m);
    expect(stdout).toMatch(/lib\/ai\/providers\.ts:2:\d+\s+openai/);
    expect(stdout).toMatch(/result sha256:[0-9a-f]{64}/);
    const saved = JSON.parse(await readFile(resultFile, 'utf8'));
    expect(saved.body.state).toBe('fail');
  });

  it('exits non-zero with a readable message for a missing repo', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    await expect(
      cli(['scan', '--repo', '/nope', '--card', CARD_PATH, '--agreement', AGREEMENT_PATH, '--obligation', '/nope.json', '--store', dir]),
    ).rejects.toMatchObject({ code: 2 });
  });

  it('names the option when --start is not an integer', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    await expect(
      cli([
        'confirm', '--agreement', AGREEMENT_PATH, '--card', CARD_PATH, '--quote', QUOTE,
        '--allow', 'anthropic', '--approver', 'T', '--start', 'abc', '--store', dir,
      ]),
    ).rejects.toMatchObject({ code: 2, stderr: expect.stringMatching(/--start/) });
  });
});

const MUTATED = path.join(ROOT, 'fixtures/repos/mutated');

async function confirmTo(dir: string, extra: string[] = [], file = 'obligation.json') {
  const out = path.join(dir, file);
  await cli([
    'confirm', '--agreement', AGREEMENT_PATH, '--card', CARD_PATH, '--quote', QUOTE,
    '--approver', 'Test Reviewer', '--at', '2026-10-13T09:00:00.000Z', '--store', dir, '--out', out,
    ...extra,
  ]);
  return out;
}

async function rewrite(file: string, edit: (o: Record<string, unknown>) => void, rehash: boolean) {
  const o = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  edit(o);
  if (rehash) {
    const { id: _id, ...rest } = o;
    o.id = sha256(canonicalize(rest));
  }
  await writeFile(file, JSON.stringify(o));
}

async function auditTypes(dir: string): Promise<string[]> {
  const text = await readFile(path.join(dir, 'demo', 'audit.jsonl'), 'utf8');
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l).type);
}

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

describe('curb scan gates through the CLI', () => {
  async function expectRefused(dir: string, args: string[], resultFile: string, message: RegExp) {
    const err = await cli(['scan', ...args, '--store', dir, '--out', resultFile]).then(
      () => {
        throw new Error('scan unexpectedly succeeded');
      },
      (e: { code: number; stderr: string }) => e,
    );
    expect(err.code).toBe(2);
    expect(err.stderr).toMatch(/^curb: /);
    expect(err.stderr).toMatch(message);
    expect(await exists(resultFile)).toBe(false);
    const types = await auditTypes(dir);
    expect(types).toContain('scan.refused');
    expect(types).not.toContain('scan.completed');
  }

  const base = (obligation: string, agreement = AGREEMENT_PATH) => [
    '--repo', MUTATED, '--card', CARD_PATH, '--agreement', agreement, '--obligation', obligation,
  ];

  it('refuses a tampered allowlist that was not re-hashed', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    const ob = await confirmTo(dir, ['--allow', 'anthropic']);
    await rewrite(ob, (o) => (o.allowlist = ['openai']), false);
    await expectRefused(dir, base(ob), path.join(dir, 'r.json'), /does not match its content/);
  });

  it('refuses a re-hashed forged quote', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    const ob = await confirmTo(dir, ['--allow', 'anthropic']);
    await rewrite(ob, (o) => (o.quote = 'Provider may use any model provider it likes.'), true);
    await expectRefused(dir, base(ob), path.join(dir, 'r.json'), /^curb: .+/);
  });

  it('refuses a re-hashed range that does not match the agreement', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    const ob = await confirmTo(dir, ['--allow', 'anthropic']);
    await rewrite(ob, (o) => (o.range = { start: 0, end: (o.quote as string).length }), true);
    await expectRefused(dir, base(ob), path.join(dir, 'r.json'), /^curb: .+/);
  });

  it('refuses a wrong policy card version', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    const ob = await confirmTo(dir, ['--allow', 'anthropic']);
    await rewrite(ob, (o) => (o.policyCardVersion = '99.0.0'), true);
    await expectRefused(dir, base(ob), path.join(dir, 'r.json'), /^curb: .+/);
  });

  it('refuses a different agreement file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    const ob = await confirmTo(dir, ['--allow', 'anthropic']);
    const other = path.join(dir, 'other.md');
    await writeFile(other, '# Other agreement\n');
    await expectRefused(dir, base(ob, other), path.join(dir, 'r.json'), /^curb: .+/);
  });

  for (const applicability of ['needs-counsel', 'unsupported']) {
    it(`refuses a ${applicability} obligation`, async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
      const ob = await confirmTo(dir, ['--applicability', applicability]);
      await expectRefused(dir, base(ob), path.join(dir, 'r.json'), /applicability/);
    });
  }
});

describe('curb CLI terminal safety and store placement', () => {
  it('neutralises control characters from the scanned repo in stdout', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    const ob = await confirmTo(dir, ['--allow', 'anthropic']);
    const repo = await makeRepo({
      'evil\nname.ts': "import { openai } from '@ai-sdk/openai'; // \x1b[2K\rPASS\n",
    });
    const { stdout } = await cli([
      'scan', '--repo', repo, '--card', CARD_PATH, '--agreement', AGREEMENT_PATH, '--obligation', ob, '--store', dir,
    ]);
    expect(stdout).not.toMatch(/[\x1b\r]/);
    expect(stdout.split('\n').filter(Boolean)).toHaveLength(5);
    expect(stdout).toMatch(/^store: .+  tenant: demo$/m);
  });

  it('refuses a store inside the scanned repo', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    const ob = await confirmTo(dir, ['--allow', 'anthropic']);
    const repo = await makeRepo({ 'a.ts': 'export {};\n' });
    for (const store of [repo, path.join(repo, '.curb')]) {
      await expect(
        cli(['scan', '--repo', repo, '--card', CARD_PATH, '--agreement', AGREEMENT_PATH, '--obligation', ob, '--store', store]),
      ).rejects.toMatchObject({ code: 2, stderr: expect.stringMatching(/--store.*outside the repo/) });
    }
    expect(await exists(path.join(repo, '.curb'))).toBe(false);
  });
});

describe('curb CLI --out, --force and --start', () => {
  it('refuses to overwrite an existing --out unless --force', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    const ob = await confirmTo(dir, ['--allow', 'anthropic']);
    await expect(confirmTo(dir, ['--allow', 'anthropic'])).rejects.toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/already exists.*--force/),
    });
    await confirmTo(dir, ['--allow', 'anthropic', '--force']);
    const scanArgs = [
      'scan', '--repo', MUTATED, '--card', CARD_PATH, '--agreement', AGREEMENT_PATH, '--obligation', ob,
      '--store', dir, '--out', path.join(dir, 'r.json'),
    ];
    await cli(scanArgs);
    await expect(cli(scanArgs)).rejects.toMatchObject({ code: 2, stderr: expect.stringMatching(/--force/) });
    await cli([...scanArgs, '--force']);
  });

  it('rejects a --start that is not plain digits', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    await mkdir(dir, { recursive: true });
    for (const bad of ['1e2', '-1', '0x10', '1.0', ' 5']) {
      await expect(
        cli([
          'confirm', '--agreement', AGREEMENT_PATH, '--card', CARD_PATH, '--quote', QUOTE,
          '--allow', 'anthropic', '--approver', 'T', `--start=${bad}`, '--store', dir,
        ]),
      ).rejects.toMatchObject({ code: 2, stderr: expect.stringMatching(/--start/) });
    }
  });
});

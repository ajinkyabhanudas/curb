import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { AGREEMENT_PATH, CARD_PATH, QUOTE, ROOT } from './helpers.ts';

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

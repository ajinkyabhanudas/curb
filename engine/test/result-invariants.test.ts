import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseResultFile } from '../src/schema/result.ts';
import type { ResultFile } from '../src/schema/types.ts';
import { CARD_PATH, cli, cliSetup, forge, readResult } from './helpers.ts';

async function files() {
  const c = await cliSetup();
  const failPath = path.join(c.dir, 'fail.json');
  const passPath = path.join(c.dir, 'pass.json');
  await c.scan('mutated', failPath);
  await c.scan('fixed', passPath);
  return { ...c, failPath, passPath, fail: await readResult(failPath), pass: await readResult(passPath) };
}

const refused = (re: RegExp) => ({ code: 2, stderr: expect.stringMatching(re) });

describe('state invariants in parseResultFile', () => {
  it('accepts the genuine results', async () => {
    const f = await files();
    expect(() => parseResultFile(f.fail)).not.toThrow();
    expect(() => parseResultFile(f.pass)).not.toThrow();
  });

  it('refuses each inconsistent state/body pair', async () => {
    const f = await files();
    const cases: Array<[string, ResultFile]> = [
      ['pass with findings', forge(f.fail, (b) => void (b.state = 'pass'))],
      ['pass with unknown files', forge(f.pass, (b) => void (b.unknownFiles = [{ path: 'a.ts', reason: 'parse-error' }]))],
      ['pass with no files evaluated', forge(f.pass, (b) => void (b.filesEvaluated = 0))],
      ['fail without findings', forge(f.pass, (b) => void (b.state = 'fail'))],
      ['unknown with nothing unknown', forge(f.pass, (b) => void (b.state = 'unknown'))],
      ['not-applicable with findings', forge(f.fail, (b) => { b.state = 'not-applicable'; b.filesEvaluated = 0; })],
      ['not-applicable with files evaluated', forge(f.pass, (b) => void (b.state = 'not-applicable'))],
      ['not-applicable with unknown files', forge(f.pass, (b) => { b.state = 'not-applicable'; b.filesEvaluated = 0; b.unknownFiles = [{ path: 'a.ts', reason: 'minified' }]; })],
      ['error with findings', forge(f.fail, (b) => { b.state = 'error'; b.filesEvaluated = 0; })],
      ['error with files evaluated', forge(f.pass, (b) => void (b.state = 'error'))],
    ];
    for (const [name, file] of cases) {
      expect(() => parseResultFile(file), name).toThrow(/inconsistent with the body/);
    }
  });

  it('accepts the consistent unknown, not-applicable and error shapes', async () => {
    const f = await files();
    const ok = [
      forge(f.pass, (b) => { b.state = 'unknown'; b.filesEvaluated = 0; b.notes = ['no-evaluable-files']; }),
      forge(f.pass, (b) => { b.state = 'unknown'; b.unknownFiles = [{ path: 'a.ts', reason: 'minified' }]; }),
      forge(f.pass, (b) => { b.state = 'not-applicable'; b.filesEvaluated = 0; }),
      forge(f.pass, (b) => { b.state = 'error'; b.filesEvaluated = 0; b.unknownFiles = []; }),
    ];
    for (const file of ok) expect(() => parseResultFile(file)).not.toThrow();
  });
});

describe('forged results are refused by the CLI', () => {
  it('report and diff refuse a re-hashed PASS that still lists findings', async () => {
    const f = await files();
    const forged = path.join(f.dir, 'forged.json');
    await writeFile(forged, JSON.stringify(forge(f.fail, (b) => void (b.state = 'pass'))));
    await expect(cli(f.reportArgs(forged))).rejects.toMatchObject(refused(/inconsistent with the body/));
    await expect(cli(['diff', '--card', CARD_PATH, '--before', f.failPath, '--after', forged])).rejects.toMatchObject(refused(/inconsistent with the body/));
    await expect(cli(['diff', '--card', CARD_PATH, '--before', forged, '--after', f.passPath])).rejects.toMatchObject(refused(/inconsistent with the body/));
  });

  it('report refuses a not-applicable result against an obligation that applies', async () => {
    const f = await files();
    const forged = path.join(f.dir, 'na.json');
    await writeFile(forged, JSON.stringify(forge(f.pass, (b) => { b.state = 'not-applicable'; b.filesEvaluated = 0; })));
    await expect(cli(f.reportArgs(forged))).rejects.toMatchObject(refused(/not-applicable.*applies/));
  });

  it('report refuses a verdict against an obligation recorded as not-applicable', async () => {
    const c = await cliSetup('not-applicable');
    const res = path.join(c.dir, 'res.json');
    await c.scan('fixed', res);
    const genuine = await readResult(res);
    expect(genuine.body.state).toBe('not-applicable');
    await cli(c.reportArgs(res));
    const forged = path.join(c.dir, 'pass.json');
    await writeFile(forged, JSON.stringify(forge(genuine, (b) => { b.state = 'pass'; b.filesEvaluated = 1; })));
    await expect(cli(c.reportArgs(forged))).rejects.toMatchObject(refused(/state is pass.*not-applicable/));
  });
});

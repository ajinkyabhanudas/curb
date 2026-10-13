import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stringifyForOutput } from '../src/terminal.ts';
import { AGREEMENT_PATH, CARD_PATH, QUOTE, cli, cliSetup, makeRepo, readResult } from './helpers.ts';

const DANGEROUS = /[\u007f-\u009f\u2028\u2029\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/;
const NASTY = 'a\u007fb\u009bc\u2028d\u2029e\u061cf\u200eg\u200fh\u202ai\u202ej\u2066k\u2069l\ufeffm\n"q"\\';

describe('stringifyForOutput', () => {
  it('round-trips through JSON.parse and leaves no raw dangerous code point', () => {
    const value = { s: NASTY, nested: [{ [NASTY]: NASTY }], n: 1, b: true, z: null };
    for (const space of [undefined, 2]) {
      const out = stringifyForOutput(value, space);
      expect(out).not.toMatch(DANGEROUS);
      expect(JSON.parse(out)).toEqual(value);
    }
    expect(stringifyForOutput('\u009b')).toBe('"\\u009b"');
  });
  it('matches JSON.stringify for safe input', () => {
    const v = { a: [1, 'two', { three: 3 }] };
    expect(stringifyForOutput(v, 2)).toBe(JSON.stringify(v, null, 2));
  });
});

describe('CLI JSON is terminal safe', () => {
  it('scan --out, report --format json and confirm stdout escape hostile code points', async () => {
    const c = await cliSetup();
    const repo = await makeRepo({ 'a.ts': "import { openai } from '@ai-sdk/openai'; // \u202e\u009b evil\n" });
    const res = path.join(c.dir, 'res.json');
    await c.scan(repo, res);
    const raw = await readFile(res, 'utf8');
    expect(raw).not.toMatch(DANGEROUS);
    const parsed = await readResult(res);
    expect(parsed.body.findings[0]!.evidence.excerpt).toContain('\u202e\u009b');

    const { stdout } = await cli([...c.reportArgs(res), '--format', 'json']);
    expect(stdout).not.toMatch(DANGEROUS);
    expect(JSON.parse(stdout)).toEqual(parsed);

    const confirmed = await cli([
      'confirm', '--agreement', AGREEMENT_PATH, '--card', CARD_PATH, '--quote', QUOTE, '--allow', 'anthropic',
      '--approver', 'Test Reviewer', '--at', '2026-10-13T09:00:00.000Z', '--store', c.dir, '--exception', 'x\u009b\u202ey',
    ]);
    expect(confirmed.stdout).not.toMatch(DANGEROUS);
    expect(JSON.parse(confirmed.stdout).exception).toBe('x\u009b\u202ey');
  });
});

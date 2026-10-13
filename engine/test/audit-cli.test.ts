import { appendFile, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, cliSetup } from './helpers.ts';

describe('curb audit', () => {
  it('reports an intact chain with its entry count', async () => {
    const c = await cliSetup();
    const { stdout } = await cli(['audit', '--store', c.dir, '--tenant', 'demo']);
    expect(stdout).toContain('entries: 1');
    expect(stdout).toContain('audit chain OK');
  });

  it('reports CORRUPT with exit 2 when the log was edited', async () => {
    const c = await cliSetup();
    const file = path.join(c.dir, 'demo', 'audit.jsonl');
    await writeFile(file, (await readFile(file, 'utf8')).replace('Test Reviewer', 'Someone Else'));
    await expect(cli(['audit', '--store', c.dir, '--tenant', 'demo'])).rejects.toMatchObject({
      code: 2, stdout: expect.stringContaining('audit chain CORRUPT'),
    });
    await appendFile(file, 'not json\n');
    await expect(cli(['audit', '--store', c.dir, '--tenant', 'demo'])).rejects.toMatchObject({
      code: 2, stdout: expect.stringContaining('audit chain CORRUPT'),
    });
  });

  it('treats a missing log as zero entries and OK', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-empty-'));
    const { stdout } = await cli(['audit', '--store', dir, '--tenant', 'demo']);
    expect(stdout).toContain('entries: 0');
    expect(stdout).toContain('audit chain OK');
  });

  it('requires --store', async () => {
    await expect(cli(['audit'])).rejects.toMatchObject({ code: 2, stderr: expect.stringContaining('--store') });
  });
});

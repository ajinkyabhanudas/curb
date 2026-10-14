import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

  it('exits 2 when the store does not exist (final review B2)', async () => {
    const dir = path.join(await mkdtemp(path.join(tmpdir(), 'curb-empty-')), 'no-such-store');
    await expect(cli(['audit', '--store', dir, '--tenant', 'demo'])).rejects.toMatchObject({
      code: 2,
      stdout: '',
      stderr: `curb: no audit log found for tenant "demo" in store "${dir}"\n`,
    });
  });

  it('exits 2 when the tenant has no log in an existing store', async () => {
    const c = await cliSetup();
    await expect(cli(['audit', '--store', c.dir, '--tenant', 'demo2'])).rejects.toMatchObject({
      code: 2, stderr: expect.stringContaining('no audit log found for tenant "demo2"'),
    });
    const empty = await mkdtemp(path.join(tmpdir(), 'curb-empty-'));
    await expect(cli(['audit', '--store', empty])).rejects.toMatchObject({
      code: 2, stderr: expect.stringContaining('no audit log found for tenant "demo"'),
    });
  });

  it('treats an existing empty log as zero entries and OK', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-empty-'));
    await mkdir(path.join(dir, 'demo'));
    await writeFile(path.join(dir, 'demo', 'audit.jsonl'), '');
    const { stdout } = await cli(['audit', '--store', dir, '--tenant', 'demo']);
    expect(stdout).toBe('tenant: demo  entries: 0\naudit chain OK\n');
  });

  it('prints entries: unknown when the log cannot be parsed', async () => {
    const c = await cliSetup();
    await appendFile(path.join(c.dir, 'demo', 'audit.jsonl'), 'not json\n');
    await expect(cli(['audit', '--store', c.dir, '--tenant', 'demo'])).rejects.toMatchObject({
      code: 2, stdout: 'tenant: demo  entries: unknown\naudit chain CORRUPT\n',
    });
  });

  it('requires --store', async () => {
    await expect(cli(['audit'])).rejects.toMatchObject({ code: 2, stderr: expect.stringContaining('--store') });
  });
});

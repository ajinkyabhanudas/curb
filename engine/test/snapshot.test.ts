import { stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/schema/hash.ts';
import { takeSnapshot } from '../src/snapshot/snapshot.ts';
import { makeRepo } from './helpers.ts';

describe('takeSnapshot', () => {
  it('hashes files and sorts paths', async () => {
    const dir = await makeRepo({ 'b.ts': 'export const b = 1;\n', 'a/z.ts': 'z', 'a/a.ts': 'a' });
    const snap = await takeSnapshot(dir);
    expect(snap.files.map((f) => f.path)).toEqual(['a/a.ts', 'a/z.ts', 'b.ts']);
    expect(snap.files[2].sha256).toBe(sha256('export const b = 1;\n'));
  });

  it('gives the same tree hash for CRLF and LF content', async () => {
    const lf = await takeSnapshot(await makeRepo({ 'a.ts': 'one\ntwo\n' }));
    const crlf = await takeSnapshot(await makeRepo({ 'a.ts': 'one\r\ntwo\r\n' }));
    expect(crlf.treeHash).toBe(lf.treeHash);
  });

  it('gives different tree hashes when content differs', async () => {
    const a = await takeSnapshot(await makeRepo({ 'a.ts': 'one' }));
    const b = await takeSnapshot(await makeRepo({ 'a.ts': 'two' }));
    expect(a.treeHash).not.toBe(b.treeHash);
  });

  it('does not follow symlinks to files or directories', async () => {
    const outside = await makeRepo({ 'secret.ts': 'TOP SECRET' });
    const dir = await makeRepo({ 'ok.ts': '1' });
    await symlink(outside, path.join(dir, 'link'));
    await symlink(path.join(outside, 'secret.ts'), path.join(dir, 'file-link.ts'));
    const snap = await takeSnapshot(dir);
    expect(snap.files.find((f) => f.path === 'link')?.status).toBe('symlink');
    expect(snap.files.find((f) => f.path === 'file-link.ts')?.status).toBe('symlink');
    expect(snap.files.some((f) => f.content?.includes('TOP SECRET'))).toBe(false);
  });

  it('changes the tree hash when a symlink is retargeted', async () => {
    const dir = await makeRepo({ 'ok.ts': '1' });
    await symlink('/tmp/one', path.join(dir, 'link'));
    const before = await takeSnapshot(dir);
    await unlink(path.join(dir, 'link'));
    await symlink('/tmp/two', path.join(dir, 'link'));
    const after = await takeSnapshot(dir);
    expect(after.treeHash).not.toBe(before.treeHash);
  });

  it('changes the tree hash when an over-cap file grows', async () => {
    const dir = await makeRepo({ 'big.ts': 'x'.repeat(2000) });
    const before = await takeSnapshot(dir, { maxFileBytes: 1000 });
    await writeFile(path.join(dir, 'big.ts'), 'x'.repeat(3000));
    const after = await takeSnapshot(dir, { maxFileBytes: 1000 });
    expect(after.treeHash).not.toBe(before.treeHash);
  });

  it('marks oversized files without reading them', async () => {
    const dir = await makeRepo({ 'big.ts': 'x'.repeat(2000) });
    const snap = await takeSnapshot(dir, { maxFileBytes: 1000 });
    expect(snap.files[0]).toMatchObject({ status: 'too-large', content: null, sha256: null });
  });

  it('marks binary files without content', async () => {
    const dir = await makeRepo({ 'img.png': 'abc\u0000def' });
    const snap = await takeSnapshot(dir);
    expect(snap.files[0]).toMatchObject({ status: 'binary', content: null });
  });

  it('skips .git and configured directories and records them', async () => {
    const dir = await makeRepo({ 'src/a.ts': '1', 'node_modules/x/i.js': '2', '.git/config': '3' });
    const snap = await takeSnapshot(dir, { skipDirs: ['node_modules'] });
    expect(snap.files.map((f) => f.path)).toEqual(['src/a.ts']);
    expect(snap.skippedDirs).toEqual(['.git', 'node_modules']);
  });

  it('never executes package scripts or git hooks', async () => {
    const marker = path.join(tmpdir(), `curb-marker-${process.pid}-${Date.now()}`);
    const dir = await makeRepo({
      'package.json': JSON.stringify({ scripts: { postinstall: `touch ${marker}` } }),
      '.git/hooks/post-checkout': `#!/bin/sh\ntouch ${marker}\n`,
    });
    await takeSnapshot(dir);
    await expect(stat(marker)).rejects.toThrow();
  });

  it('keeps hostile file names inside the root', async () => {
    const dir = await makeRepo({ '..%2Fevil.ts': 'x', 'a\\..\\b.ts': 'y' });
    const snap = await takeSnapshot(dir);
    for (const f of snap.files) {
      expect(path.resolve(dir, f.path).startsWith(path.resolve(dir) + path.sep)).toBe(true);
    }
  });

  it('fails clearly for a missing root', async () => {
    await expect(takeSnapshot('/definitely/not/here')).rejects.toThrow(/snapshot root/);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { takeSnapshot } from '../src/snapshot/snapshot.ts';
import { makeRepo } from './helpers.ts';

// Directory order is the file system's choice. Many file systems return entries unsorted, but the machines the other
// tests ran on return them sorted, so only a stub can show that the snapshot sorts for itself (CURB-45).
const order = vi.hoisted(() => ({ mode: 'asis' as 'asis' | 'reversed' }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const readdir = async (...args: unknown[]) => {
    const entries = await (actual.readdir as (...a: unknown[]) => Promise<unknown[]>)(...args);
    return order.mode === 'reversed' ? [...entries].reverse() : entries;
  };
  return { ...actual, default: { ...actual, readdir }, readdir };
});

describe('takeSnapshot: directory order', () => {
  it('returns the same files in the same order, and the same tree hash, whatever order the file system lists entries', async () => {
    const dir = await makeRepo({ 'b.ts': '2\n', 'a.ts': '1\n', 'c/d.ts': '4\n', 'c/a.ts': '3\n', 'z.md': '5\n' });
    order.mode = 'asis';
    const normal = await takeSnapshot(dir);
    order.mode = 'reversed';
    const reversed = await takeSnapshot(dir);
    order.mode = 'asis';
    expect(reversed.files.map((f) => f.path)).toEqual(['a.ts', 'b.ts', 'c/a.ts', 'c/d.ts', 'z.md']);
    expect(reversed.files.map((f) => f.path)).toEqual(normal.files.map((f) => f.path));
    expect(reversed.treeHash).toBe(normal.treeHash);
  });

  it('sorts the skipped directories too', async () => {
    const dir = await makeRepo({ 'node_modules/x.js': '1\n', 'dist/y.js': '2\n', 'a.ts': '3\n' });
    order.mode = 'reversed';
    const snap = await takeSnapshot(dir, { skipDirs: ['node_modules', 'dist'] });
    order.mode = 'asis';
    expect(snap.skippedDirs).toEqual(['dist', 'node_modules']);
  });
});

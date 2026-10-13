import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/schema/hash.ts';
import { FsAuditLog, FsBlobStore } from '../src/store/fs.ts';
import type { TenantContext } from '../src/store/types.ts';

const A: TenantContext = { tenantId: 'tenant-a', actor: 'alice' };
const B: TenantContext = { tenantId: 'tenant-b', actor: 'bob' };
const tmp = () => mkdtemp(path.join(tmpdir(), 'curb-store-'));

describe('FsBlobStore', () => {
  it('stores content addressed and immutable', async () => {
    const store = new FsBlobStore(await tmp());
    const sha = await store.put(A, 'hello');
    expect(sha).toBe(sha256('hello'));
    expect(Buffer.from((await store.get(A, sha)) as Uint8Array).toString()).toBe('hello');
    expect(await store.put(A, 'hello')).toBe(sha);
  });

  it('isolates tenants', async () => {
    const store = new FsBlobStore(await tmp());
    const sha = await store.put(A, 'secret');
    expect(await store.get(B, sha)).toBeNull();
  });

  it('rejects traversal in tenant ids and hashes (review focus 5)', async () => {
    const store = new FsBlobStore(await tmp());
    await expect(store.put({ tenantId: '../other', actor: 'x' }, 'x')).rejects.toThrow(/tenant/);
    await expect(store.get(A, '../../etc/passwd')).rejects.toThrow(/hash/);
  });
});

describe('FsAuditLog', () => {
  const fixed = () => new Date('2026-10-13T09:00:00.000Z');

  it('chains entries and verifies', async () => {
    const log = new FsAuditLog(await tmp(), fixed);
    const e1 = await log.append(A, 'one', { n: 1 });
    const e2 = await log.append(A, 'two', { n: 2 });
    expect(e1.seq).toBe(0);
    expect(e2.prevHash).toBe(e1.hash);
    expect((await log.list(A)).map((e) => e.type)).toEqual(['one', 'two']);
    expect(await log.verify(A)).toBe(true);
  });

  it('isolates tenants', async () => {
    const log = new FsAuditLog(await tmp(), fixed);
    await log.append(A, 'one', {});
    expect(await log.list(B)).toEqual([]);
  });

  it('detects tampering', async () => {
    const root = await tmp();
    const log = new FsAuditLog(root, fixed);
    await log.append(A, 'one', { n: 1 });
    await log.append(A, 'two', { n: 2 });
    const file = path.join(root, 'tenant-a', 'audit.jsonl');
    await writeFile(file, (await readFile(file, 'utf8')).replace('"n":1', '"n":9'));
    expect(await log.verify(A)).toBe(false);
  });

  it('rejects non-JSON data and leaves the audit file unchanged', async () => {
    const root = await tmp();
    const log = new FsAuditLog(root, fixed);
    await log.append(A, 'one', { n: 1 });
    const file = path.join(root, 'tenant-a', 'audit.jsonl');
    const before = await readFile(file, 'utf8');
    await expect(log.append(A, 'bad', { when: new Date() })).rejects.toThrow();
    await expect(log.append(A, 'bad', { fn: () => 1 })).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe(before);
    expect(await log.verify(A)).toBe(true);
    expect(await log.list(A)).toHaveLength(1);
  });
});

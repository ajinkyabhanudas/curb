import { mkdtemp, readFile, readdir, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/schema/hash.ts';
import { AuditCorruptError, BlobIntegrityError, FsAuditLog, FsBlobStore } from '../src/store/fs.ts';
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

describe('FsBlobStore integrity', () => {
  const blobPath = (root: string, sha: string) => path.join(root, 'tenant-a', 'blobs', sha);

  it('throws BlobIntegrityError after overwrite', async () => {
    const root = await tmp();
    const store = new FsBlobStore(root);
    const sha = await store.put(A, 'hello');
    await writeFile(blobPath(root, sha), 'evil');
    await expect(store.get(A, sha)).rejects.toThrow(BlobIntegrityError);
    await expect(store.get(A, sha)).rejects.toThrow(sha);
  });

  it('throws BlobIntegrityError after truncation', async () => {
    const root = await tmp();
    const store = new FsBlobStore(root);
    const sha = await store.put(A, 'hello world');
    await truncate(blobPath(root, sha), 3);
    await expect(store.get(A, sha)).rejects.toThrow(BlobIntegrityError);
  });

  it('put repairs a corrupted blob', async () => {
    const root = await tmp();
    const store = new FsBlobStore(root);
    const sha = await store.put(A, 'hello');
    await writeFile(blobPath(root, sha), 'evil');
    expect(await store.put(A, 'hello')).toBe(sha);
    expect(Buffer.from((await store.get(A, sha)) as Uint8Array).toString()).toBe('hello');
  });

  it('leaves no temp file after put', async () => {
    const root = await tmp();
    const store = new FsBlobStore(root);
    const sha = await store.put(A, 'hello');
    await store.put(A, 'hello');
    expect(await readdir(path.join(root, 'tenant-a', 'blobs'))).toEqual([sha]);
  });

  it('returns null for an unknown well-formed hash', async () => {
    const store = new FsBlobStore(await tmp());
    expect(await store.get(A, sha256('nothing'))).toBeNull();
  });
});

describe('FsAuditLog corruption', () => {
  const fixed = () => new Date('2026-10-13T09:00:00.000Z');
  const setup = async () => {
    const root = await tmp();
    const log = new FsAuditLog(root, fixed);
    await log.append(A, 'one', { n: 1 });
    await log.append(A, 'two', { n: 2 });
    const file = path.join(root, 'tenant-a', 'audit.jsonl');
    const lines = (await readFile(file, 'utf8')).split('\n').filter(Boolean);
    return { root, log, file, lines };
  };
  const badField = (line: string) => JSON.stringify({ ...JSON.parse(line), seq: '0' });

  const variants: Array<[string, (l: string[]) => string]> = [
    ['torn last line', (l) => `${l[0]}\n${(l[1] as string).slice(0, 20)}`],
    ['non-JSON line', (l) => `${l[0]}\nnot json\n`],
    ['null line', (l) => `${l[0]}\nnull\n`],
    ['array line', (l) => `${l[0]}\n[1]\n`],
    ['wrong field type', (l) => `${badField(l[0] as string)}\n${l[1]}\n`],
    ['blank line mid-file', (l) => `${l[0]}\n\n${l[1]}\n`],
  ];

  for (const [name, make] of variants) {
    it(`${name}: verify false, list throws, append refuses`, async () => {
      const { log, file, lines } = await setup();
      await writeFile(file, make(lines));
      const before = await readFile(file, 'utf8');
      expect(await log.verify(A)).toBe(false);
      await expect(log.list(A)).rejects.toThrow(AuditCorruptError);
      await expect(log.append(A, 'x', {})).rejects.toThrow(AuditCorruptError);
      expect(await readFile(file, 'utf8')).toBe(before);
    });
  }

  it('data that cannot be canonicalized fails verify without throwing', async () => {
    const { log, file, lines } = await setup();
    const e = JSON.parse(lines[1] as string);
    await writeFile(file, `${lines[0]}\n${JSON.stringify(e).replace('"n":2', '"n":1e300')}\n`);
    expect(await log.verify(A)).toBe(false);
  });

  it('names the 1-based line number', async () => {
    const { log, file, lines } = await setup();
    await writeFile(file, `${lines[0]}\nnot json\n`);
    await expect(log.list(A)).rejects.toThrow(/line 2/);
  });

  it('reordered entries fail verify and refuse append', async () => {
    const { log, file, lines } = await setup();
    await writeFile(file, `${lines[1]}\n${lines[0]}\n`);
    expect(await log.verify(A)).toBe(false);
    await expect(log.append(A, 'x', {})).rejects.toThrow(AuditCorruptError);
  });

  it('wrong prevHash fails verify', async () => {
    const { log, file, lines } = await setup();
    const e = { ...JSON.parse(lines[1] as string), prevHash: 'f'.repeat(64) };
    await writeFile(file, `${lines[0]}\n${JSON.stringify(e)}\n`);
    expect(await log.verify(A)).toBe(false);
  });

  it('rejects traversal tenant ids on list, append and verify', async () => {
    const log = new FsAuditLog(await tmp(), fixed);
    const bad = { tenantId: '../other', actor: 'x' };
    await expect(log.list(bad)).rejects.toThrow(/tenant/);
    await expect(log.append(bad, 't', {})).rejects.toThrow(/tenant/);
    await expect(log.verify(bad)).rejects.toThrow(/tenant/);
  });
});

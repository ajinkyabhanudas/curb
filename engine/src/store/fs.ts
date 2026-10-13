import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalize } from '../schema/canonical.ts';
import { sha256 } from '../schema/hash.ts';
import type { AuditEntry, AuditLog, BlobStore, TenantContext } from './types.ts';

const TENANT_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const GENESIS = '0'.repeat(64);

function tenantDir(root: string, ctx: TenantContext): string {
  if (!TENANT_RE.test(ctx.tenantId)) throw new Error(`invalid tenant id: ${JSON.stringify(ctx.tenantId)}`);
  return path.join(root, ctx.tenantId);
}

export class FsBlobStore implements BlobStore {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async put(ctx: TenantContext, data: string | Uint8Array): Promise<string> {
    const dir = path.join(tenantDir(this.root, ctx), 'blobs');
    await mkdir(dir, { recursive: true });
    const sha = sha256(data);
    await writeFile(path.join(dir, sha), data, { flag: 'wx' }).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'EEXIST') throw e;
    });
    return sha;
  }

  async get(ctx: TenantContext, sha: string): Promise<Uint8Array | null> {
    const dir = path.join(tenantDir(this.root, ctx), 'blobs');
    if (!HASH_RE.test(sha)) throw new Error('invalid blob hash');
    try {
      return await readFile(path.join(dir, sha));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }
}

export class FsAuditLog implements AuditLog {
  readonly root: string;
  private readonly now: () => Date;

  constructor(root: string, now: () => Date = () => new Date()) {
    this.root = root;
    this.now = now;
  }

  private file(ctx: TenantContext): string {
    return path.join(tenantDir(this.root, ctx), 'audit.jsonl');
  }

  async list(ctx: TenantContext): Promise<AuditEntry[]> {
    try {
      const text = await readFile(this.file(ctx), 'utf8');
      return text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as AuditEntry);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  async append(ctx: TenantContext, type: string, data: Record<string, unknown>): Promise<AuditEntry> {
    const entries = await this.list(ctx);
    const prev = entries[entries.length - 1];
    const base = {
      seq: entries.length,
      at: this.now().toISOString(),
      actor: ctx.actor,
      type,
      data,
      prevHash: prev ? prev.hash : GENESIS,
    };
    // Fully build and hash the entry (canonicalize throws on non-JSON data) before any write.
    const entry: AuditEntry = { ...base, hash: sha256(canonicalize(base)) };
    const line = `${JSON.stringify(entry)}\n`;
    await mkdir(tenantDir(this.root, ctx), { recursive: true });
    await appendFile(this.file(ctx), line);
    return entry;
  }

  async verify(ctx: TenantContext): Promise<boolean> {
    let prevHash = GENESIS;
    let seq = 0;
    for (const entry of await this.list(ctx)) {
      const { hash, ...base } = entry;
      if (entry.seq !== seq || entry.prevHash !== prevHash || sha256(canonicalize(base)) !== hash) return false;
      prevHash = hash;
      seq++;
    }
    return true;
  }
}

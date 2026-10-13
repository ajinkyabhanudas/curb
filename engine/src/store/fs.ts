import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalize } from '../schema/canonical.ts';
import { sha256 } from '../schema/hash.ts';
import type { AuditEntry, AuditLog, BlobStore, TenantContext } from './types.ts';

const TENANT_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const GENESIS = '0'.repeat(64);

export class AuditCorruptError extends Error {}
export class BlobIntegrityError extends Error {}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function parseEntry(line: string, lineNo: number): AuditEntry {
  const bad = (why: string) => new AuditCorruptError(`audit log corrupt at line ${lineNo}: ${why}`);
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    throw bad('not valid JSON');
  }
  if (!isPlainObject(v)) throw bad('not a JSON object');
  if (typeof v.seq !== 'number' || !Number.isSafeInteger(v.seq)) throw bad('seq must be an integer');
  if (typeof v.at !== 'string') throw bad('at must be a string');
  if (typeof v.actor !== 'string') throw bad('actor must be a string');
  if (typeof v.type !== 'string') throw bad('type must be a string');
  if (!isPlainObject(v.data)) throw bad('data must be an object');
  if (typeof v.prevHash !== 'string' || !HASH_RE.test(v.prevHash)) throw bad('prevHash must be 64 hex chars');
  if (typeof v.hash !== 'string' || !HASH_RE.test(v.hash)) throw bad('hash must be 64 hex chars');
  return v as unknown as AuditEntry;
}

function chainValid(entries: AuditEntry[]): boolean {
  let prevHash = GENESIS;
  let seq = 0;
  for (const entry of entries) {
    const { hash, ...base } = entry;
    if (entry.seq !== seq || entry.prevHash !== prevHash) return false;
    try {
      if (sha256(canonicalize(base)) !== hash) return false;
    } catch {
      return false; // data that cannot be canonicalized cannot match its hash
    }
    prevHash = hash;
    seq++;
  }
  return true;
}

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
    const final = path.join(dir, sha);
    const tmpFile = `${final}.tmp-${randomUUID()}`;
    try {
      await writeFile(tmpFile, data, { flag: 'wx' });
      await rename(tmpFile, final);
    } catch (e) {
      await unlink(tmpFile).catch(() => {});
      throw e;
    }
    return sha;
  }

  async get(ctx: TenantContext, sha: string): Promise<Uint8Array | null> {
    const dir = path.join(tenantDir(this.root, ctx), 'blobs');
    if (!HASH_RE.test(sha)) throw new Error('invalid blob hash');
    let bytes: Uint8Array;
    try {
      bytes = await readFile(path.join(dir, sha));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
    if (sha256(bytes) !== sha) throw new BlobIntegrityError(`blob ${sha} failed integrity check`);
    return bytes;
  }
}

// Known residuals (not mitigated here):
// - Tail truncation is not detectable by the hash chain alone.
// - One writer per tenant is assumed (append reads, then writes).
// - The whole file is read on every append (O(n)).
// - A pre-planted symlinked tenant directory is followed.
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
      const lines = text.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      return lines.map((l, i) => parseEntry(l, i + 1));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  async append(ctx: TenantContext, type: string, data: Record<string, unknown>): Promise<AuditEntry> {
    const entries = await this.list(ctx);
    if (!chainValid(entries)) throw new AuditCorruptError('audit log failed verification; refusing to append');
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
    try {
      return chainValid(await this.list(ctx));
    } catch (e) {
      if (e instanceof AuditCorruptError) return false;
      throw e;
    }
  }
}

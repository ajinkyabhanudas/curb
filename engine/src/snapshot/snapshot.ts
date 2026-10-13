import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { canonicalize } from '../schema/canonical.ts';
import { sha256 } from '../schema/hash.ts';

export type FileStatus = 'ok' | 'symlink' | 'too-large' | 'unreadable' | 'binary';

export interface SnapshotFile {
  path: string;
  status: FileStatus;
  sha256: string | null;
  size: number;
  content: string | null;
}

export interface Snapshot {
  treeHash: string;
  files: SnapshotFile[];
  skippedDirs: string[];
}

export interface SnapshotOptions {
  skipDirs?: string[];
  maxFileBytes?: number;
}

const DEFAULT_MAX_FILE_BYTES = 1_048_576;

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function takeSnapshot(root: string, options: SnapshotOptions = {}): Promise<Snapshot> {
  const absRoot = path.resolve(root);
  const rootInfo = await stat(absRoot).catch(() => null);
  if (!rootInfo?.isDirectory()) throw new Error(`snapshot root is not a readable directory: ${root}`);

  const skip = new Set(['.git', ...(options.skipDirs ?? [])]);
  const maxBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const files: SnapshotFile[] = [];
  const skippedDirs: string[] = [];

  async function walk(dir: string, rel: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        files.push({ path: relPath, status: 'symlink', sha256: null, size: 0, content: null });
      } else if (entry.isDirectory()) {
        if (skip.has(entry.name)) skippedDirs.push(relPath);
        else await walk(abs, relPath);
      } else if (entry.isFile()) {
        files.push(await readEntry(abs, relPath, maxBytes));
      }
    }
  }

  await walk(absRoot, '');
  files.sort((a, b) => compare(a.path, b.path));
  skippedDirs.sort(compare);
  const treeHash = sha256(
    canonicalize({
      files: files.map((f) => ({ path: f.path, status: f.status, sha256: f.sha256, size: f.size })),
      skippedDirs,
    }),
  );
  return { treeHash, files, skippedDirs };
}

async function readEntry(abs: string, relPath: string, maxBytes: number): Promise<SnapshotFile> {
  try {
    const info = await lstat(abs);
    if (info.size > maxBytes) {
      return { path: relPath, status: 'too-large', sha256: null, size: 0, content: null };
    }
    const raw = await readFile(abs);
    if (raw.subarray(0, 8192).includes(0)) {
      return { path: relPath, status: 'binary', sha256: sha256(raw), size: raw.length, content: null };
    }
    const content = raw.toString('utf8').replace(/\r\n?/g, '\n');
    return { path: relPath, status: 'ok', sha256: sha256(content), size: Buffer.byteLength(content), content };
  } catch {
    return { path: relPath, status: 'unreadable', sha256: null, size: 0, content: null };
  }
}

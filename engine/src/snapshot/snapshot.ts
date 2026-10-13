import { lstat, readdir, readFile, readlink, stat } from 'node:fs/promises';
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
  maxFileBytes?: number; // test-only seam: small caps keep size tests fast
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
        files.push(await readLink(abs, relPath));
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
    // The cap applies to the normalized text, so CRLF and LF forms of one file get one verdict. CRLF to LF
    // never shrinks a file by more than half, so a raw size above twice the cap is too large in either form.
    // Too-large entries keep the raw lstat size (growth detection); converting an already too-large file
    // between CRLF and LF may therefore change treeHash, but the file is `unknown` either way.
    const tooLarge = (): SnapshotFile => ({ path: relPath, status: 'too-large', sha256: null, size: info.size, content: null });
    if (info.size > 2 * maxBytes) return tooLarge();
    const raw = await readFile(abs);
    if (raw.subarray(0, 8192).includes(0)) {
      if (raw.length > maxBytes) return tooLarge(); // binaries are not normalized, so the raw cap applies as before
      return { path: relPath, status: 'binary', sha256: sha256(raw), size: raw.length, content: null };
    }
    const content = raw.toString('utf8').replace(/\r\n?/g, '\n');
    if (Buffer.byteLength(content) > maxBytes) return tooLarge();
    return { path: relPath, status: 'ok', sha256: sha256(content), size: Buffer.byteLength(content), content };
  } catch {
    return { path: relPath, status: 'unreadable', sha256: null, size: 0, content: null };
  }
}

// Records the link text (not the target's content) so retargeting a link changes the tree hash.
async function readLink(abs: string, relPath: string): Promise<SnapshotFile> {
  try {
    const target = await readlink(abs);
    return { path: relPath, status: 'symlink', sha256: sha256(target), size: 0, content: null };
  } catch {
    return { path: relPath, status: 'unreadable', sha256: null, size: 0, content: null };
  }
}

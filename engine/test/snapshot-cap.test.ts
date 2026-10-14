import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { takeSnapshot } from '../src/snapshot/snapshot.ts';

async function dirWith(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'curb-cap-'));
  await writeFile(path.join(dir, name), content);
  return dir;
}

describe('size cap applies to normalized text', () => {
  const CAP = 100;
  const lf = 'ab\n'.repeat(30); // 90 bytes
  const crlf = lf.replace(/\n/g, '\r\n'); // 120 bytes raw, 90 normalized

  it('gives the same status, treeHash and content for LF and CRLF forms near the cap', async () => {
    const a = await takeSnapshot(await dirWith('a.ts', lf), { maxFileBytes: CAP });
    const b = await takeSnapshot(await dirWith('a.ts', crlf), { maxFileBytes: CAP });
    expect(a.files[0]!.status).toBe('ok');
    expect(b.files[0]!.status).toBe('ok');
    expect(b.treeHash).toBe(a.treeHash);
    expect(b.files[0]!.content).toBe(a.files[0]!.content);
  });

  it('is too-large in both forms when the normalized text exceeds the cap', async () => {
    const big = 'ab\n'.repeat(40); // 120 bytes LF, 160 CRLF (<= 2 * cap)
    for (const text of [big, big.replace(/\n/g, '\r\n')]) {
      const s = await takeSnapshot(await dirWith('a.ts', text), { maxFileBytes: CAP });
      expect(s.files[0]!.status).toBe('too-large');
      expect(s.files[0]!.content).toBeNull();
      expect(s.files[0]!.size).toBe(Buffer.byteLength(text)); // raw lstat size, for growth detection
    }
  });

  it('treats a raw size above twice the cap as too-large without reading it', async () => {
    const s = await takeSnapshot(await dirWith('a.ts', 'x'.repeat(201)), { maxFileBytes: CAP });
    expect(s.files[0]!.status).toBe('too-large');
    expect(s.files[0]!.size).toBe(201);
  });
});

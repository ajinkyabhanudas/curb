# Curb V1 Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A TypeScript engine and CLI that takes a human-confirmed contract commitment, scans a repository snapshot with one deterministic rule, and emits evidence, a report and a rerun delta.

**Architecture:** `engine/` is a standalone Node package with a pure core (snapshot, agreement, obligation, evaluator, report, diff) and storage behind small interfaces with filesystem adapters. No LLM, network or code execution in the verdict path. Existing `frontend/` is untouched.

**Tech Stack:** Node 24 (native TypeScript type stripping, no build step), TypeScript 5.9 compiler API for the evaluator, vitest 5 for tests. No other runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-curb-v1-vertical-slice-design.md` (read it first; this plan implements it).

## Global Constraints

- Node >= 24. Source is `.ts`, run with `node src/cli.ts`; relative imports use the `.ts` extension.
- `erasableSyntaxOnly` is on: no enums, no namespaces, no constructor parameter properties.
- Runtime dependency: `typescript` only. Dev dependencies: `vitest`, `@types/node`, `typescript`.
- Result states are exactly `pass | fail | unknown | not-applicable | error`; precedence `error > fail > unknown > pass`; the evaluator never emits `not-applicable`.
- Canonical JSON: sorted keys, UTF-8, integers only, no timestamps inside the hashed result body, paths relative to the snapshot root with `/` separators.
- Text files are line-ending normalized (CRLF and CR become LF) before hashing and evaluation; offsets refer to the normalized text, in UTF-16 code units.
- Nothing in `engine/src` imports `node:http`, `node:https`, `node:net`, `node:dns`, `node:child_process` or `node:worker_threads` (only `scripts/` may use `child_process`).
- Fixtures are synthetic. No real customer agreement, code or credential enters the repo.
- Every report shows the policy card status near the top. The shipped card status is `draft, pending counsel approval`.
- Commits: one concept each, plain-English body, ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Run `npm run typecheck && npm test` in `engine/` before every commit. Never push without being asked.
- Any unexpected failure: stop and invoke superpowers:systematic-debugging before changing code.

## Review Focus

Failure modes the spec implies but the main tasks would not hit by default. Each is pinned by a test in the named task.

1. Inherited-property keys used as hosts or gateway prefixes (`http://constructor/`, `gateway("__proto__/x")`) must not crash or match a provider (Task 4).
2. A repository with no evaluable source files must be `unknown`, never `pass` (Task 4).
3. A source file with a UTF-8 BOM and CRLF line endings must parse and be evaluated, not land in `unknown` (Task 4).
4. Astral characters (emoji) before a quote in the agreement must not break quote offsets (Task 5).
5. A tenant id such as `../other` must be rejected, not resolved to a path (Task 6).

## Milestones

- **M1** (end of Task 7): `curb confirm` then `curb scan` on the mutated fixture prints FAIL with file:line evidence and a stable result hash.
- **M2** (end of Task 9): report, seeded fix, rerun, delta, determinism suite. This is the sub-project exit.

## File Structure

```
engine/
  package.json, tsconfig.json, vitest.config.ts, README.md
  policies/unapproved-provider-reference.v1.json
  src/schema/{hash,canonical,types}.ts
  src/snapshot/snapshot.ts
  src/policy/card.ts
  src/evaluator/evaluate.ts
  src/agreement/ingest.ts
  src/obligation/obligation.ts
  src/store/{types,fs}.ts
  src/scan.ts            runScan: gate checks + evaluation + result body
  src/workflow.ts        confirmAndRecord, scanAndRecord (store + audit wiring)
  src/report/{markdown,delta}.ts   (delta.ts also holds diffResults)
  src/cli.ts             thin arg parsing over workflow/report
  scripts/source-manifest.ts
  fixtures/agreement/synthetic-ai-addendum.md
  fixtures/repos/{mutated,fixed}/...
  test/*.test.ts, test/helpers.ts, test/golden/*.md
docs/curb/{charter.md,source-manifest.json,prototype-audit.md,adr-001-result-schema.md,threat-model-v1.md,policy-card-template.md}
```

---

### Task 0: Branch and scaffold

**Files:**
- Create: `engine/package.json`, `engine/tsconfig.json`, `engine/vitest.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm test`, `npm run typecheck`, `npm run curb -- <cmd>` inside `engine/`.

- [ ] **Step 1: Create the working branch**

```bash
cd /Users/ajinkya/Desktop/curb
git fetch origin
git log origin/main --oneline -3
```
If `git ls-tree -r origin/main --name-only | grep -q frontend/src/components/Workspace.tsx` succeeds, run `git switch -c kan-6-engine-vertical-slice origin/main`. Otherwise (the prototype PR is not merged) run `git switch -c kan-6-engine-vertical-slice` from the current branch. Untracked `docs/` and `test_plan` carry over.

- [ ] **Step 2: Write `engine/package.json`**

```json
{
  "name": "curb-engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "curb": "node src/cli.ts"
  },
  "dependencies": {
    "typescript": "^5.9.3"
  },
  "devDependencies": {
    "@types/node": "^24.19.2",
    "vitest": "^5.0.4"
  }
}
```

- [ ] **Step 3: Write `engine/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "types": ["node"]
  },
  "include": ["src", "test", "scripts"]
}
```

- [ ] **Step 4: Write `engine/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], testTimeout: 20000 },
});
```

- [ ] **Step 5: Ignore runtime artifacts**

```bash
grep -qx 'engine/node_modules/' .gitignore || printf '\n# ---- Curb engine ----\nengine/node_modules/\n.curb/\n' >> .gitignore
cd engine && npm install
```
Expected: installs without error and creates `engine/package-lock.json`.

- [ ] **Step 6: Verify the toolchain runs (no tests yet)**

Run: `cd engine && npx vitest run --passWithNoTests && npx tsc --noEmit`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
cd /Users/ajinkya/Desktop/curb
git add .gitignore engine/package.json engine/package-lock.json engine/tsconfig.json engine/vitest.config.ts docs/superpowers
git commit -m "Scaffold the Curb engine package and add the V1 spec and plan" -m "Adds an isolated engine/ package (Node 24, TypeScript, vitest) next to the existing frontend, plus the approved design spec and implementation plan. Runtime artifacts (.curb/) and engine/node_modules are gitignored." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Canonical JSON, hashing and result types

**Files:**
- Create: `engine/src/schema/hash.ts`, `engine/src/schema/canonical.ts`, `engine/src/schema/types.ts`
- Test: `engine/test/schema.test.ts`

**Interfaces:**
- Produces: `sha256(data: string | Uint8Array): string` (hex); `canonicalize(value: unknown): string`; the types `ResultState`, `Severity`, `Evidence`, `Finding`, `UnknownReason`, `UnknownFile`, `ResultBody`, `RunEnvelope`, `ResultFile`.

- [ ] **Step 1: Write the failing test**

```ts
// engine/test/schema.test.ts
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/schema/canonical.ts';
import { sha256 } from '../src/schema/hash.ts';

describe('canonicalize', () => {
  it('sorts keys recursively', () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}',
    );
  });

  it('does not depend on insertion order', () => {
    expect(canonicalize({ x: 1, y: 2 })).toBe(canonicalize({ y: 2, x: 1 }));
  });

  it('rejects non-integer numbers', () => {
    expect(() => canonicalize({ a: 1.5 })).toThrow(/non-integer/);
  });

  it('omits undefined members', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('keeps non-ASCII text as-is', () => {
    expect(canonicalize({ s: 'é😀' })).toBe('{"s":"é😀"}');
  });
});

describe('sha256', () => {
  it('matches the known vector for "abc"', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd engine && npx vitest run test/schema.test.ts`
Expected: FAIL, cannot resolve `../src/schema/canonical.ts`.

- [ ] **Step 3: Implement**

```ts
// engine/src/schema/hash.ts
import { createHash } from 'node:crypto';

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}
```

```ts
// engine/src/schema/canonical.ts
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`canonicalize: non-integer number ${value}`);
    return value;
  }
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue;
      out[key] = sortValue(source[key]);
    }
    return out;
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}
```

```ts
// engine/src/schema/types.ts
export type ResultState = 'pass' | 'fail' | 'unknown' | 'not-applicable' | 'error';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Evidence {
  path: string;
  fileSha256: string;
  start: number;
  end: number;
  line: number;
  column: number;
  excerpt: string;
  reason: string;
}

export interface Finding {
  id: string;
  ruleId: string;
  ruleVersion: string;
  severity: Severity;
  providerId: string;
  matched: string;
  evidence: Evidence;
}

export type UnknownReason =
  | 'parse-error'
  | 'minified'
  | 'generated'
  | 'unsupported-language'
  | 'too-large'
  | 'unreadable';

export interface UnknownFile {
  path: string;
  reason: UnknownReason;
}

export interface ResultBody {
  schemaVersion: '1';
  ruleId: string;
  ruleVersion: string;
  evaluatorVersion: string;
  policyCardHash: string;
  treeHash: string;
  agreementHash: string;
  obligationHash: string;
  state: ResultState;
  findings: Finding[];
  unknownFiles: UnknownFile[];
  filesEvaluated: number;
  exclusions: string[];
  notes: string[];
}

export interface RunEnvelope {
  resultHash: string;
  startedAt: string;
  finishedAt: string;
  operator: string;
  tenantId: string;
}

export interface ResultFile {
  body: ResultBody;
  envelope: RunEnvelope;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd engine && npx vitest run test/schema.test.ts && npx tsc --noEmit`
Expected: 6 tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add engine/src/schema engine/test/schema.test.ts
git commit -m "Add canonical JSON, SHA-256 helper and result types" -m "Defines the hashed result body: sorted keys, integers only, undefined omitted. Timestamps and operator identity live in a separate envelope type so the result hash stays reproducible." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Read-only repository snapshot

**Files:**
- Create: `engine/src/snapshot/snapshot.ts`, `engine/test/helpers.ts` (first version)
- Test: `engine/test/snapshot.test.ts`

**Interfaces:**
- Consumes: `sha256`, `canonicalize` from Task 1.
- Produces:
  - `type FileStatus = 'ok' | 'symlink' | 'too-large' | 'unreadable' | 'binary'`
  - `interface SnapshotFile { path: string; status: FileStatus; sha256: string | null; size: number; content: string | null }`
  - `interface Snapshot { treeHash: string; files: SnapshotFile[]; skippedDirs: string[] }`
  - `takeSnapshot(root: string, options?: { skipDirs?: string[]; maxFileBytes?: number }): Promise<Snapshot>`
  - test helper `makeRepo(files: Record<string, string>): Promise<string>`

- [ ] **Step 1: Write the helper and the failing tests**

```ts
// engine/test/helpers.ts
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function makeRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'curb-repo-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
  return dir;
}
```

```ts
// engine/test/snapshot.test.ts
import { stat, symlink } from 'node:fs/promises';
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd engine && npx vitest run test/snapshot.test.ts`
Expected: FAIL, cannot resolve `../src/snapshot/snapshot.ts`.

- [ ] **Step 3: Implement**

```ts
// engine/src/snapshot/snapshot.ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd engine && npx vitest run test/snapshot.test.ts && npx tsc --noEmit`
Expected: 10 tests PASS. If the hostile-name test fails on a filesystem that rejects the names, stop and use systematic-debugging; do not delete the test.

- [ ] **Step 5: Commit**

```bash
git add engine/src/snapshot engine/test/helpers.ts engine/test/snapshot.test.ts
git commit -m "Add a read-only repository snapshot" -m "Walks a directory without following symlinks, executing anything or reading .git. Records per-file hashes (line-ending normalized), marks oversized, binary and unreadable files, and derives a stable tree hash." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Policy card and provider registry

**Files:**
- Create: `engine/policies/unapproved-provider-reference.v1.json`, `engine/src/policy/card.ts`
- Test: `engine/test/card.test.ts`

**Interfaces:**
- Consumes: `canonicalize`, `sha256`, `Severity`.
- Produces:
  - `interface PolicyCard` (fields below)
  - `validateCard(raw: unknown): PolicyCard`
  - `loadCard(file: string): Promise<{ card: PolicyCard; hash: string }>` (hash is `sha256(canonicalize(card))`)
  - `registryProviderIds(card: PolicyCard): string[]` (sorted, unique)
  - `own<T>(map: Record<string, T>, key: string): T | undefined` (own-property lookup only)

- [ ] **Step 1: Write the card JSON**

```json
{
  "id": "unapproved-provider-reference",
  "version": "1.0.0",
  "status": "draft, pending counsel approval",
  "owner": "unassigned (to be named by the product owner)",
  "reviewDate": "2026-10-13",
  "severity": "high",
  "interpretation": "When a confirmed commitment limits the model providers that may receive customer content, any import, URL literal or gateway model identifier in scanned source that resolves to a registered provider outside the customer's allowlist is a finding.",
  "approvedTextPatterns": [
    "Provider will route Customer Content for model inference only to the following model providers: <list>."
  ],
  "requiredFacts": [
    "The customer allowlist, as normalized provider IDs from the registry",
    "A human-confirmed obligation citing the exact agreement text"
  ],
  "prerequisites": [
    "Source is TypeScript or JavaScript",
    "Files are readable, under the size cap and not minified or generated"
  ],
  "falsePositiveExamples": [
    "A provider import in a test-only file that never ships",
    "A provider referenced in code that is never executed"
  ],
  "falseNegativeRisks": [
    "A provider that is not in the registry is not flagged",
    "Dynamic specifiers such as require(name) or template literals with substitutions",
    "Model identifiers held in variables or environment files",
    "A proxy or wrapper module that hides the real provider",
    "Configuration and environment files are not scanned in V1"
  ],
  "evidenceBoundaries": [
    "Findings show where source references a provider, not where traffic goes at runtime"
  ],
  "nonClaims": [
    "Does not establish which provider receives data at runtime",
    "Does not establish provider conduct, retention or training use",
    "Does not detect dead code or proxy rerouting",
    "Does not establish that the allowlist matches the signed agreement; a named human confirms that",
    "Is not legal advice or a compliance certification"
  ],
  "exclusions": {
    "dirs": ["node_modules", ".next", "dist"],
    "files": ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]
  },
  "registry": {
    "packages": {
      "openai": "openai",
      "@ai-sdk/openai": "openai",
      "@anthropic-ai/sdk": "anthropic",
      "@ai-sdk/anthropic": "anthropic",
      "@ai-sdk/google": "google",
      "@google/generative-ai": "google",
      "@ai-sdk/xai": "xai",
      "@ai-sdk/mistral": "mistral",
      "@mistralai/mistralai": "mistral"
    },
    "hosts": {
      "api.openai.com": "openai",
      "api.anthropic.com": "anthropic",
      "generativelanguage.googleapis.com": "google",
      "api.x.ai": "xai",
      "api.mistral.ai": "mistral"
    },
    "gatewayPrefixes": {
      "openai": "openai",
      "anthropic": "anthropic",
      "google": "google",
      "xai": "xai",
      "mistral": "mistral"
    }
  },
  "modelConstructors": ["gateway", "gateway.languageModel"],
  "testCases": ["engine/test/evaluator.test.ts", "engine/test/loop.test.ts"]
}
```

- [ ] **Step 2: Write the failing test**

```ts
// engine/test/card.test.ts
import { describe, expect, it } from 'vitest';
import { loadCard, own, registryProviderIds, validateCard } from '../src/policy/card.ts';
import { CARD_PATH } from './helpers.ts';

describe('policy card', () => {
  it('loads the shipped card with a stable hash and a draft status', async () => {
    const a = await loadCard(CARD_PATH);
    const b = await loadCard(CARD_PATH);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.card.status).toMatch(/draft/);
  });

  it('lists normalized provider ids from the registry', async () => {
    const { card } = await loadCard(CARD_PATH);
    expect(registryProviderIds(card)).toEqual(['anthropic', 'google', 'mistral', 'openai', 'xai']);
  });

  it('rejects a card with a missing registry', async () => {
    const { card } = await loadCard(CARD_PATH);
    const broken: Record<string, unknown> = { ...card };
    delete broken.registry;
    expect(() => validateCard(broken)).toThrow(/registry/);
  });

  it('rejects an unknown severity', async () => {
    const { card } = await loadCard(CARD_PATH);
    expect(() => validateCard({ ...card, severity: 'catastrophic' })).toThrow(/severity/);
  });

  it('own() ignores inherited properties', () => {
    expect(own({ a: 'x' }, 'a')).toBe('x');
    expect(own({ a: 'x' }, 'constructor')).toBeUndefined();
    expect(own({ a: 'x' }, '__proto__')).toBeUndefined();
  });
});
```

Add the shared constants to `engine/test/helpers.ts` (append):

```ts
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CARD_PATH = path.join(ROOT, 'policies/unapproved-provider-reference.v1.json');
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd engine && npx vitest run test/card.test.ts`
Expected: FAIL, cannot resolve `../src/policy/card.ts`.

- [ ] **Step 4: Implement**

```ts
// engine/src/policy/card.ts
import { readFile } from 'node:fs/promises';
import { canonicalize } from '../schema/canonical.ts';
import { sha256 } from '../schema/hash.ts';
import type { Severity } from '../schema/types.ts';

export interface PolicyCard {
  id: string;
  version: string;
  status: string;
  owner: string;
  reviewDate: string;
  severity: Severity;
  interpretation: string;
  approvedTextPatterns: string[];
  requiredFacts: string[];
  prerequisites: string[];
  falsePositiveExamples: string[];
  falseNegativeRisks: string[];
  evidenceBoundaries: string[];
  nonClaims: string[];
  exclusions: { dirs: string[]; files: string[] };
  registry: {
    packages: Record<string, string>;
    hosts: Record<string, string>;
    gatewayPrefixes: Record<string, string>;
  };
  modelConstructors: string[];
  testCases: string[];
}

const STRING_FIELDS = ['id', 'version', 'status', 'owner', 'reviewDate', 'interpretation'] as const;
const LIST_FIELDS = [
  'approvedTextPatterns',
  'requiredFacts',
  'prerequisites',
  'falsePositiveExamples',
  'falseNegativeRisks',
  'evidenceBoundaries',
  'nonClaims',
  'modelConstructors',
  'testCases',
] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'];

function isStringList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isStringMap(v: unknown): v is Record<string, string> {
  return (
    typeof v === 'object' && v !== null && !Array.isArray(v) &&
    Object.values(v).every((x) => typeof x === 'string')
  );
}

export function validateCard(raw: unknown): PolicyCard {
  if (typeof raw !== 'object' || raw === null) throw new Error('policy card must be an object');
  const r = raw as Record<string, unknown>;
  for (const f of STRING_FIELDS) {
    if (typeof r[f] !== 'string' || r[f] === '') throw new Error(`policy card field "${f}" must be a non-empty string`);
  }
  for (const f of LIST_FIELDS) {
    if (!isStringList(r[f])) throw new Error(`policy card field "${f}" must be a list of strings`);
  }
  if (typeof r.severity !== 'string' || !SEVERITIES.includes(r.severity)) {
    throw new Error('policy card field "severity" must be critical, high, medium or low');
  }
  const ex = r.exclusions as Record<string, unknown> | undefined;
  if (!ex || !isStringList(ex.dirs) || !isStringList(ex.files)) {
    throw new Error('policy card field "exclusions" must have string lists "dirs" and "files"');
  }
  const reg = r.registry as Record<string, unknown> | undefined;
  if (!reg || !isStringMap(reg.packages) || !isStringMap(reg.hosts) || !isStringMap(reg.gatewayPrefixes)) {
    throw new Error('policy card field "registry" must have string maps packages, hosts and gatewayPrefixes');
  }
  return raw as PolicyCard;
}

export async function loadCard(file: string): Promise<{ card: PolicyCard; hash: string }> {
  const card = validateCard(JSON.parse(await readFile(file, 'utf8')));
  return { card, hash: sha256(canonicalize(card)) };
}

export function registryProviderIds(card: PolicyCard): string[] {
  const { packages, hosts, gatewayPrefixes } = card.registry;
  return [...new Set([...Object.values(packages), ...Object.values(hosts), ...Object.values(gatewayPrefixes)])].sort();
}

export function own<T>(map: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd engine && npx vitest run test/card.test.ts && npx tsc --noEmit`
Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add engine/policies engine/src/policy engine/test/card.test.ts engine/test/helpers.ts
git commit -m "Add the unapproved-provider-reference policy card" -m "Ships card v1.0.0 with its provider registry, exclusions, non-claims and false-negative risks, plus a validator and a stable content hash. Status is draft until counsel approves it; every report will print that." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Deterministic evaluator

**Files:**
- Create: `engine/src/evaluator/evaluate.ts`
- Test: `engine/test/evaluator.test.ts`

**Interfaces:**
- Consumes: `Snapshot`, `SnapshotFile`, `takeSnapshot` (Task 2); `PolicyCard`, `own` (Task 3); `Finding`, `UnknownFile`, `UnknownReason`, `ResultState`, `sha256`, `canonicalize`.
- Produces:
  - `const EVALUATOR_VERSION = '0.1.0'`
  - `interface EvaluationInput { snapshot: Snapshot; card: PolicyCard; allowlist: string[] }`
  - `interface EvaluationOutput { state: ResultState; findings: Finding[]; unknownFiles: UnknownFile[]; filesEvaluated: number; notes: string[] }`
  - `evaluate(input: EvaluationInput): EvaluationOutput`

- [ ] **Step 1: Write the failing tests**

```ts
// engine/test/evaluator.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { evaluate } from '../src/evaluator/evaluate.ts';
import { loadCard, type PolicyCard } from '../src/policy/card.ts';
import { takeSnapshot } from '../src/snapshot/snapshot.ts';
import { CARD_PATH, makeRepo } from './helpers.ts';

let card: PolicyCard;
beforeAll(async () => {
  card = (await loadCard(CARD_PATH)).card;
});

async function run(files: Record<string, string>, allowlist = ['anthropic']) {
  const snapshot = await takeSnapshot(await makeRepo(files), { skipDirs: card.exclusions.dirs });
  return evaluate({ snapshot, card, allowlist });
}

describe('evaluate: findings', () => {
  it('fails on an import of a provider outside the allowlist, with exact evidence', async () => {
    const src = "import { openai } from '@ai-sdk/openai';\n";
    const out = await run({ 'a.ts': src });
    expect(out.state).toBe('fail');
    expect(out.findings).toHaveLength(1);
    const f = out.findings[0];
    expect(f.providerId).toBe('openai');
    expect(f.matched).toBe('@ai-sdk/openai');
    expect(f.evidence.path).toBe('a.ts');
    expect(f.evidence.start).toBe(src.indexOf("'@ai-sdk/openai'"));
    expect(f.evidence.line).toBe(1);
    expect(f.evidence.column).toBe(src.indexOf("'@ai-sdk/openai'") + 1);
    expect(f.evidence.excerpt).toBe("import { openai } from '@ai-sdk/openai';");
  });

  it('passes when every referenced provider is allowed', async () => {
    const out = await run({ 'a.ts': "import { anthropic } from '@ai-sdk/anthropic';\n" });
    expect(out.state).toBe('pass');
    expect(out.filesEvaluated).toBe(1);
  });

  it('catches require and dynamic import', async () => {
    const out = await run({ 'a.js': "const o = require('openai');\nconst p = await import('openai');\n" });
    expect(out.findings).toHaveLength(2);
  });

  it('catches provider URL literals but not look-alike URLs', async () => {
    const hit = await run({ 'a.ts': "fetch('https://api.openai.com/v1/chat');\n" });
    expect(hit.state).toBe('fail');
    const miss = await run({ 'a.ts': "fetch('https://example.com/openai');\n" });
    expect(miss.state).toBe('pass');
  });

  it('checks gateway model identifiers by provider prefix', async () => {
    expect((await run({ 'a.ts': "gateway('openai/gpt-5');\n" })).state).toBe('fail');
    expect((await run({ 'a.ts': "gateway.languageModel('openai/gpt-5');\n" })).state).toBe('fail');
    expect((await run({ 'a.ts': "gateway('anthropic/claude');\n" })).state).toBe('pass');
    expect((await run({ 'a.ts': "gateway('unregistered/model');\n" })).state).toBe('pass');
  });

  it('ignores comments, plain strings, variable names and unregistered look-alike packages', async () => {
    const src = [
      "// we used openai('gpt-4o') once",
      "const openai = 'openai is a word';",
      "import tools from 'openai-tools';",
      '',
    ].join('\n');
    expect((await run({ 'a.ts': src })).state).toBe('pass');
  });

  it('does not crash or match on inherited-property keys (review focus 1)', async () => {
    const src = [
      "fetch('http://constructor/x');",
      "gateway('constructor/x');",
      "gateway('__proto__/x');",
      "fetch('http://__proto__/x');",
      '',
    ].join('\n');
    const out = await run({ 'a.ts': src });
    expect(out.state).toBe('pass');
  });

  it('sorts findings by path then offset and de-duplicates', async () => {
    const out = await run({
      'z.ts': "import a from 'openai';\n",
      'a.ts': "import b from 'openai';\nimport c from '@ai-sdk/openai';\n",
    });
    expect(out.findings.map((f) => `${f.evidence.path}:${f.evidence.line}`)).toEqual(['a.ts:1', 'a.ts:2', 'z.ts:1']);
  });
});

describe('evaluate: unknown, scope and exclusions', () => {
  it('reports unknown for a parse error', async () => {
    const out = await run({ 'a.ts': 'const = ;\n' });
    expect(out.state).toBe('unknown');
    expect(out.unknownFiles).toEqual([{ path: 'a.ts', reason: 'parse-error' }]);
  });

  it('keeps fail when another file is unknown, and still lists the unknown file', async () => {
    const out = await run({ 'a.ts': "import a from 'openai';\n", 'b.ts': 'const = ;\n' });
    expect(out.state).toBe('fail');
    expect(out.unknownFiles).toHaveLength(1);
  });

  it('reports unknown for minified and generated files', async () => {
    const out = await run({
      'bundle.min.js': 'var a=1;',
      'long.js': `var s="${'x'.repeat(1200)}";`,
      'gen.ts': '// @generated by tool\nexport const a = 1;\n',
    });
    expect(out.unknownFiles.map((u) => `${u.path}:${u.reason}`)).toEqual([
      'bundle.min.js:minified',
      'gen.ts:generated',
      'long.js:minified',
    ]);
    expect(out.state).toBe('unknown');
  });

  it('reports unknown for unsupported languages', async () => {
    const out = await run({ 'tool.py': 'import openai\n' });
    expect(out.unknownFiles).toEqual([{ path: 'tool.py', reason: 'unsupported-language' }]);
    expect(out.state).toBe('unknown');
  });

  it('ignores excluded directories and lockfiles', async () => {
    const out = await run({
      'node_modules/openai/index.js': "require('openai');\n",
      'ok.ts': 'export const a = 1;\n',
    });
    expect(out.state).toBe('pass');
    expect(out.filesEvaluated).toBe(1);
  });

  it('is unknown, never pass, when there are no evaluable files (review focus 2)', async () => {
    const out = await run({ 'README.md': '# hi\n', 'package.json': '{}' });
    expect(out.state).toBe('unknown');
    expect(out.notes).toEqual(['no-evaluable-files']);
  });

  it('evaluates a file with a BOM and CRLF endings (review focus 3)', async () => {
    const out = await run({ 'a.ts': "﻿import x from 'openai';\r\nexport const y = 1;\r\n" });
    expect(out.unknownFiles).toEqual([]);
    expect(out.state).toBe('fail');
    expect(out.findings).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd engine && npx vitest run test/evaluator.test.ts`
Expected: FAIL, cannot resolve `../src/evaluator/evaluate.ts`.

- [ ] **Step 3: Implement**

```ts
// engine/src/evaluator/evaluate.ts
import path from 'node:path';
import ts from 'typescript';
import { own, type PolicyCard } from '../policy/card.ts';
import { canonicalize } from '../schema/canonical.ts';
import { sha256 } from '../schema/hash.ts';
import type { Finding, ResultState, UnknownFile, UnknownReason } from '../schema/types.ts';
import type { Snapshot, SnapshotFile } from '../snapshot/snapshot.ts';

export const EVALUATOR_VERSION = '0.1.0';

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const OTHER_LANG_EXT = new Set(['.py', '.go', '.rs', '.java', '.rb', '.php', '.cs', '.kt', '.swift']);
const MAX_LINE_LENGTH = 1000;

export interface EvaluationInput {
  snapshot: Snapshot;
  card: PolicyCard;
  allowlist: string[];
}

export interface EvaluationOutput {
  state: ResultState;
  findings: Finding[];
  unknownFiles: UnknownFile[];
  filesEvaluated: number;
  notes: string[];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function evaluate({ snapshot, card, allowlist }: EvaluationInput): EvaluationOutput {
  const findings = new Map<string, Finding>();
  const unknownFiles: UnknownFile[] = [];
  let filesEvaluated = 0;

  for (const file of snapshot.files) {
    if (isExcluded(file.path, card)) continue;
    const ext = path.posix.extname(file.path).toLowerCase();
    if (OTHER_LANG_EXT.has(ext)) {
      unknownFiles.push({ path: file.path, reason: 'unsupported-language' });
      continue;
    }
    if (!SOURCE_EXT.has(ext)) continue;
    const problem = fileProblem(file);
    if (problem) {
      unknownFiles.push({ path: file.path, reason: problem });
      continue;
    }
    for (const finding of scanFile(file.path, file.sha256 as string, file.content as string, card, allowlist)) {
      findings.set(finding.id, finding);
    }
    filesEvaluated++;
  }

  const sorted = [...findings.values()].sort(
    (a, b) =>
      compare(a.evidence.path, b.evidence.path) || a.evidence.start - b.evidence.start || compare(a.id, b.id),
  );
  unknownFiles.sort((a, b) => compare(a.path, b.path));

  const notes: string[] = [];
  let state: ResultState;
  if (sorted.length > 0) state = 'fail';
  else if (unknownFiles.length > 0) state = 'unknown';
  else if (filesEvaluated === 0) {
    state = 'unknown';
    notes.push('no-evaluable-files');
  } else state = 'pass';

  return { state, findings: sorted, unknownFiles, filesEvaluated, notes };
}

function isExcluded(filePath: string, card: PolicyCard): boolean {
  const segments = filePath.split('/');
  const base = segments[segments.length - 1];
  return card.exclusions.files.includes(base) || segments.slice(0, -1).some((s) => card.exclusions.dirs.includes(s));
}

function fileProblem(file: SnapshotFile): UnknownReason | undefined {
  if (file.status === 'too-large') return 'too-large';
  if (file.status !== 'ok' || file.content === null || file.sha256 === null) return 'unreadable';
  if (looksMinified(file.path, file.content)) return 'minified';
  if (looksGenerated(file.content)) return 'generated';
  if (hasParseError(file.path, file.content)) return 'parse-error';
  return undefined;
}

function looksMinified(filePath: string, content: string): boolean {
  return /\.min\.(js|mjs|cjs)$/.test(filePath) || content.split('\n').some((l) => l.length > MAX_LINE_LENGTH);
}

function looksGenerated(content: string): boolean {
  return content
    .split('\n')
    .slice(0, 5)
    .some((l) => /@generated|auto-?generated|do not edit/i.test(l));
}

function hasParseError(filePath: string, content: string): boolean {
  const out = ts.transpileModule(content, {
    fileName: filePath,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext, allowJs: true },
  });
  return (out.diagnostics ?? []).some((d) => d.category === ts.DiagnosticCategory.Error);
}

function scanFile(filePath: string, fileSha: string, content: string, card: PolicyCard, allowlist: string[]): Finding[] {
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.ESNext, true);
  const lines = content.split('\n');
  const out: Finding[] = [];

  function packageProvider(spec: string): string | undefined {
    for (const name of Object.keys(card.registry.packages)) {
      if (spec === name || spec.startsWith(`${name}/`)) return card.registry.packages[name];
    }
    return undefined;
  }

  function hostProvider(text: string): string | undefined {
    if (!/^https?:\/\//i.test(text)) return undefined;
    try {
      return own(card.registry.hosts, new URL(text).hostname.toLowerCase());
    } catch {
      return undefined;
    }
  }

  function gatewayProvider(text: string): string | undefined {
    const slash = text.indexOf('/');
    return slash > 0 ? own(card.registry.gatewayPrefixes, text.slice(0, slash)) : undefined;
  }

  function check(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral, providerId: string | undefined, what: string) {
    if (!providerId || allowlist.includes(providerId)) return;
    const start = node.getStart(sf);
    const end = node.getEnd();
    const { line, character } = sf.getLineAndCharacterOfPosition(start);
    out.push({
      id: sha256(
        canonicalize({ ruleId: card.id, ruleVersion: card.version, path: filePath, start, end, matched: node.text }),
      ),
      ruleId: card.id,
      ruleVersion: card.version,
      severity: card.severity,
      providerId,
      matched: node.text,
      evidence: {
        path: filePath,
        fileSha256: fileSha,
        start,
        end,
        line: line + 1,
        column: character + 1,
        excerpt: (lines[line] ?? '').trim().slice(0, 160),
        reason: `${what} "${node.text}" resolves to provider "${providerId}", which is not in the allowlist`,
      },
    });
  }

  const isLiteral = (n: ts.Node | undefined): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
    n !== undefined && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

  function visit(node: ts.Node): void {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && isLiteral(node.moduleSpecifier)) {
      check(node.moduleSpecifier, packageProvider(node.moduleSpecifier.text), 'import of package');
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const arg = node.arguments[0];
      if (isLiteral(arg)) {
        const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
        if (isRequire || callee.kind === ts.SyntaxKind.ImportKeyword) {
          check(arg, packageProvider(arg.text), 'load of package');
        } else if (card.modelConstructors.includes(callee.getText(sf))) {
          check(arg, gatewayProvider(arg.text), 'model identifier');
        }
      }
    }
    if (isLiteral(node)) check(node, hostProvider(node.text), 'URL');
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd engine && npx vitest run test/evaluator.test.ts && npx tsc --noEmit`
Expected: all evaluator tests PASS. If any fails, invoke systematic-debugging; do not loosen the assertion. Known risk: `ts.transpileModule` diagnostics for a BOM or `.js` files; the BOM test exists to catch it.

- [ ] **Step 5: Checkpoint review (feature-dev and simplifier)**

Dispatch `feature-dev:code-reviewer` on `engine/src/evaluator/evaluate.ts` and `engine/src/snapshot/snapshot.ts` with the prompt: "Review for correctness bugs, determinism risks (anything that depends on machine, time, locale or iteration order), and false-pass paths that could produce `pass` when a file was not actually analyzed." Fix confirmed findings with a test each. Then dispatch `code-simplifier:code-simplifier` on the same two files and apply only changes that keep all tests green.

- [ ] **Step 6: Commit**

```bash
git add engine/src/evaluator engine/test/evaluator.test.ts
git commit -m "Add the deterministic provider-reference evaluator" -m "Uses the TypeScript compiler API to find imports, requires, provider URL literals and gateway model identifiers that resolve to a registered provider outside the allowlist. Unparseable, minified, generated, oversized and unsupported files yield unknown instead of pass, and an empty scope is unknown too." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Agreement ingest and obligation record

**Files:**
- Create: `engine/src/agreement/ingest.ts`, `engine/src/obligation/obligation.ts`
- Test: `engine/test/obligation.test.ts`

**Interfaces:**
- Consumes: `sha256`, `canonicalize`, `PolicyCard`, `registryProviderIds`.
- Produces:
  - `interface AgreementSnapshot { rawSha256: string; textSha256: string; text: string }`
  - `ingestAgreement(raw: string | Uint8Array): AgreementSnapshot`
  - `type Applicability = 'applies' | 'not-applicable' | 'needs-counsel' | 'unsupported'`
  - `interface ObligationInput { agreementTextSha256: string; quote: string; range: { start: number; end: number }; policyCardId: string; policyCardVersion: string; applicability: Applicability; allowlist: string[]; approver: string; approvedAt: string; exception?: string }`
  - `interface Obligation extends ObligationInput { id: string }` (id = `sha256(canonicalize(input))`)
  - `locateQuote(text: string, quote: string): { start: number; end: number }` (throws unless exactly one match)
  - `confirmObligation(input: ObligationInput, agreement: AgreementSnapshot, card: PolicyCard): Obligation`
  - `verifyObligation(o: Obligation): void` (throws if `id` does not match content)

- [ ] **Step 1: Write the failing tests**

```ts
// engine/test/obligation.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { ingestAgreement } from '../src/agreement/ingest.ts';
import { confirmObligation, locateQuote, verifyObligation, type ObligationInput } from '../src/obligation/obligation.ts';
import { loadCard, type PolicyCard } from '../src/policy/card.ts';
import { CARD_PATH } from './helpers.ts';

let card: PolicyCard;
beforeAll(async () => {
  card = (await loadCard(CARD_PATH)).card;
});

const QUOTE = 'Provider will only use Anthropic.';
const TEXT = `# Addendum\r\n\r\n${QUOTE}\r\n`;

function input(overrides: Partial<ObligationInput> = {}): { input: ObligationInput; agreement: ReturnType<typeof ingestAgreement> } {
  const agreement = ingestAgreement(TEXT);
  const range = locateQuote(agreement.text, QUOTE);
  return {
    agreement,
    input: {
      agreementTextSha256: agreement.textSha256,
      quote: QUOTE,
      range,
      policyCardId: card.id,
      policyCardVersion: card.version,
      applicability: 'applies',
      allowlist: ['anthropic'],
      approver: 'Test Reviewer',
      approvedAt: '2026-10-13T09:00:00.000Z',
      ...overrides,
    },
  };
}

describe('ingestAgreement', () => {
  it('normalizes line endings and hashes raw bytes and normalized text separately', () => {
    const a = ingestAgreement('a\r\nb');
    expect(a.text).toBe('a\nb');
    expect(a.rawSha256).not.toBe(a.textSha256);
    expect(ingestAgreement('a\nb').textSha256).toBe(a.textSha256);
  });
});

describe('locateQuote', () => {
  it('finds a unique quote', () => {
    const a = ingestAgreement(TEXT);
    const r = locateQuote(a.text, QUOTE);
    expect(a.text.slice(r.start, r.end)).toBe(QUOTE);
  });

  it('rejects a missing or ambiguous quote', () => {
    expect(() => locateQuote('abc', 'zzz')).toThrow(/not found/);
    expect(() => locateQuote('aa aa', 'aa')).toThrow(/more than once/);
  });

  it('keeps offsets correct after astral characters (review focus 4)', () => {
    const a = ingestAgreement(`😀 intro\n\n${QUOTE}\n`);
    const r = locateQuote(a.text, QUOTE);
    expect(r.start).toBeGreaterThan(2);
    expect(a.text.slice(r.start, r.end)).toBe(QUOTE);
    const { input: i, agreement } = input();
    expect(() => confirmObligation({ ...i, agreementTextSha256: a.textSha256, range: r }, a, card)).not.toThrow();
    expect(agreement.text.slice(i.range.start, i.range.end)).toBe(QUOTE);
  });
});

describe('confirmObligation', () => {
  it('returns an obligation with a content-derived id', () => {
    const { input: i, agreement } = input();
    const o = confirmObligation(i, agreement, card);
    expect(o.id).toMatch(/^[0-9a-f]{64}$/);
    expect(() => verifyObligation(o)).not.toThrow();
  });

  it('rejects a quote that does not match the range', () => {
    const { input: i, agreement } = input();
    expect(() => confirmObligation({ ...i, quote: 'something else' }, agreement, card)).toThrow(/quote/);
  });

  it('rejects an agreement hash mismatch', () => {
    const { input: i, agreement } = input({ agreementTextSha256: 'f'.repeat(64) });
    expect(() => confirmObligation(i, agreement, card)).toThrow(/agreement/);
  });

  it('rejects a different policy card version', () => {
    const { input: i, agreement } = input({ policyCardVersion: '9.9.9' });
    expect(() => confirmObligation(i, agreement, card)).toThrow(/policy card/);
  });

  it('requires a named approver and a valid timestamp', () => {
    const a = input({ approver: '  ' });
    expect(() => confirmObligation(a.input, a.agreement, card)).toThrow(/approver/);
    const b = input({ approvedAt: 'yesterday-ish' });
    expect(() => confirmObligation(b.input, b.agreement, card)).toThrow(/approvedAt/);
  });

  it('requires an allowlist of registry provider ids when the obligation applies', () => {
    const empty = input({ allowlist: [] });
    expect(() => confirmObligation(empty.input, empty.agreement, card)).toThrow(/allowlist/);
    const unknown = input({ allowlist: ['acme-ai'] });
    expect(() => confirmObligation(unknown.input, unknown.agreement, card)).toThrow(/acme-ai/);
  });

  it('does not require an allowlist when a human records not-applicable', () => {
    const n = input({ applicability: 'not-applicable', allowlist: [] });
    expect(() => confirmObligation(n.input, n.agreement, card)).not.toThrow();
  });

  it('detects a tampered obligation', () => {
    const { input: i, agreement } = input();
    const o = confirmObligation(i, agreement, card);
    expect(() => verifyObligation({ ...o, allowlist: ['openai'] })).toThrow(/tampered|does not match/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd engine && npx vitest run test/obligation.test.ts`
Expected: FAIL, cannot resolve `../src/agreement/ingest.ts`.

- [ ] **Step 3: Implement**

```ts
// engine/src/agreement/ingest.ts
import { sha256 } from '../schema/hash.ts';

export interface AgreementSnapshot {
  rawSha256: string;
  textSha256: string;
  text: string;
}

export function ingestAgreement(raw: string | Uint8Array): AgreementSnapshot {
  const bytes = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : Buffer.from(raw);
  const text = bytes.toString('utf8').replace(/\r\n?/g, '\n');
  return { rawSha256: sha256(bytes), textSha256: sha256(text), text };
}
```

```ts
// engine/src/obligation/obligation.ts
import type { AgreementSnapshot } from '../agreement/ingest.ts';
import { registryProviderIds, type PolicyCard } from '../policy/card.ts';
import { canonicalize } from '../schema/canonical.ts';
import { sha256 } from '../schema/hash.ts';

export type Applicability = 'applies' | 'not-applicable' | 'needs-counsel' | 'unsupported';

export interface ObligationInput {
  agreementTextSha256: string;
  quote: string;
  range: { start: number; end: number };
  policyCardId: string;
  policyCardVersion: string;
  applicability: Applicability;
  allowlist: string[];
  approver: string;
  approvedAt: string;
  exception?: string;
}

export interface Obligation extends ObligationInput {
  id: string;
}

const APPLICABILITY: Applicability[] = ['applies', 'not-applicable', 'needs-counsel', 'unsupported'];

export function locateQuote(text: string, quote: string): { start: number; end: number } {
  if (quote === '') throw new Error('quote must not be empty');
  const first = text.indexOf(quote);
  if (first === -1) throw new Error('quote not found in the agreement text');
  if (text.indexOf(quote, first + 1) !== -1) {
    throw new Error('quote appears more than once; pass an explicit start offset');
  }
  return { start: first, end: first + quote.length };
}

export function confirmObligation(input: ObligationInput, agreement: AgreementSnapshot, card: PolicyCard): Obligation {
  if (input.agreementTextSha256 !== agreement.textSha256) {
    throw new Error('obligation does not reference the supplied agreement text');
  }
  const { start, end } = input.range;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > agreement.text.length) {
    throw new Error('obligation range is outside the agreement text');
  }
  if (agreement.text.slice(start, end) !== input.quote) {
    throw new Error('quote does not match the agreement text at the given range');
  }
  if (input.policyCardId !== card.id || input.policyCardVersion !== card.version) {
    throw new Error('obligation names a different policy card or version');
  }
  if (input.approver.trim() === '') throw new Error('a named approver is required');
  if (Number.isNaN(Date.parse(input.approvedAt))) throw new Error('approvedAt must be a valid ISO timestamp');
  if (!APPLICABILITY.includes(input.applicability)) throw new Error(`unknown applicability "${input.applicability}"`);
  if (input.applicability === 'applies') {
    if (input.allowlist.length === 0) throw new Error('an allowlist of provider ids is required when the obligation applies');
    const known = registryProviderIds(card);
    const unknown = input.allowlist.filter((p) => !known.includes(p));
    if (unknown.length > 0) {
      throw new Error(`allowlist contains providers not in the registry: ${unknown.join(', ')} (known: ${known.join(', ')})`);
    }
  }
  return { ...input, id: sha256(canonicalize(input)) };
}

export function verifyObligation(obligation: Obligation): void {
  const { id, ...input } = obligation;
  if (sha256(canonicalize(input)) !== id) throw new Error('obligation id does not match its content (tampered or edited)');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd engine && npx vitest run test/obligation.test.ts && npx tsc --noEmit`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/src/agreement engine/src/obligation engine/test/obligation.test.ts
git commit -m "Add agreement ingest and the human-confirmed obligation record" -m "Markdown agreements are hashed raw and normalized, with offsets in the normalized text. An obligation must carry an exact quote at a verified range, a named approver, a valid timestamp, and an allowlist drawn from the card registry. The id is derived from the content so edits are detectable." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tenant-scoped blob store and audit log

**Files:**
- Create: `engine/src/store/types.ts`, `engine/src/store/fs.ts`
- Test: `engine/test/store.test.ts`

**Interfaces:**
- Consumes: `sha256`, `canonicalize`.
- Produces:
  - `interface TenantContext { tenantId: string; actor: string }`
  - `interface AuditEntry { seq: number; at: string; actor: string; type: string; data: Record<string, unknown>; prevHash: string; hash: string }`
  - `interface BlobStore { put(ctx, data: string | Uint8Array): Promise<string>; get(ctx, sha256: string): Promise<Uint8Array | null> }`
  - `interface AuditLog { append(ctx, type: string, data: Record<string, unknown>): Promise<AuditEntry>; list(ctx): Promise<AuditEntry[]>; verify(ctx): Promise<boolean> }`
  - `class FsBlobStore(root: string)`, `class FsAuditLog(root: string, now?: () => Date)`

- [ ] **Step 1: Write the failing tests**

```ts
// engine/test/store.test.ts
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
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd engine && npx vitest run test/store.test.ts`
Expected: FAIL, cannot resolve `../src/store/fs.ts`.

- [ ] **Step 3: Implement**

```ts
// engine/src/store/types.ts
export interface TenantContext {
  tenantId: string;
  actor: string;
}

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  type: string;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface BlobStore {
  put(ctx: TenantContext, data: string | Uint8Array): Promise<string>;
  get(ctx: TenantContext, sha256: string): Promise<Uint8Array | null>;
}

export interface AuditLog {
  append(ctx: TenantContext, type: string, data: Record<string, unknown>): Promise<AuditEntry>;
  list(ctx: TenantContext): Promise<AuditEntry[]>;
  verify(ctx: TenantContext): Promise<boolean>;
}
```

```ts
// engine/src/store/fs.ts
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
    const entry: AuditEntry = { ...base, hash: sha256(canonicalize(base)) };
    await mkdir(tenantDir(this.root, ctx), { recursive: true });
    await appendFile(this.file(ctx), `${JSON.stringify(entry)}\n`);
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd engine && npx vitest run test/store.test.ts && npx tsc --noEmit`
Expected: all PASS. Note: the log assumes a single writer per tenant; concurrent writers are a Phase 2+ concern and are recorded in the threat model (Task 10).

- [ ] **Step 5: Commit**

```bash
git add engine/src/store engine/test/store.test.ts
git commit -m "Add tenant-scoped blob store and hash-chained audit log" -m "Filesystem adapters behind BlobStore and AuditLog interfaces. Tenant ids and blob hashes are validated so they cannot escape the store root, tenants cannot read each other's data, and the audit chain detects edits." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Scan orchestration, workflow and CLI (M1)

**Files:**
- Create: `engine/src/scan.ts`, `engine/src/workflow.ts`, `engine/src/cli.ts`
- Create: `engine/fixtures/agreement/synthetic-ai-addendum.md`, `engine/fixtures/repos/mutated/{package.json,lib/ai/providers.ts,app/api/chat/route.ts}`
- Modify: `engine/test/helpers.ts` (append shared fixture helpers)
- Test: `engine/test/scan.test.ts`, `engine/test/cli.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 to 6.
- Produces:
  - `class ObligationNotActiveError extends Error`
  - `interface ScanInput { repoPath: string; card: PolicyCard; cardHash: string; agreement: AgreementSnapshot; obligation: Obligation }`
  - `runScan(input: ScanInput, evaluateFn?: typeof evaluate): Promise<{ body: ResultBody; resultHash: string }>`
  - `interface Deps { ctx: TenantContext; blobs: BlobStore; audit: AuditLog; now?: () => Date }`
  - `interface ConfirmFields { quote: string; start?: number; applicability: Applicability; allowlist: string[]; approver: string; approvedAt: string; exception?: string }`
  - `confirmAndRecord(deps: Deps, agreementRaw: Uint8Array, card: PolicyCard, fields: ConfirmFields): Promise<Obligation>`
  - `scanAndRecord(deps: Deps, a: { repoPath: string; agreementRaw: Uint8Array; card: PolicyCard; cardHash: string; obligation: Obligation }): Promise<ResultFile>`
  - CLI: `curb confirm`, `curb scan` (report and diff arrive in Tasks 8 and 9)

- [ ] **Step 1: Create the fixtures**

`engine/fixtures/agreement/synthetic-ai-addendum.md`:

```markdown
# Synthetic AI Services Addendum (Curb test fixture)

This document is a synthetic fixture written for Curb's automated tests. It is not a Common Paper template, has no legal effect, and must not be presented as a real agreement.

## 1. Definitions

"Customer Content" means the inputs a customer submits to the AI Services and the outputs returned to it.

## 2. Model providers

2.1 Provider will route Customer Content for model inference only to the following model providers: Anthropic.

2.2 Provider will give Customer written notice before adding a model provider to this list.
```

`engine/fixtures/repos/mutated/package.json`:

```json
{
  "name": "fixture-chat-app",
  "private": true,
  "dependencies": { "ai": "^5.0.0", "@ai-sdk/anthropic": "^2.0.0", "@ai-sdk/openai": "^2.0.0" }
}
```

`engine/fixtures/repos/mutated/lib/ai/providers.ts` (line 2 is the seeded mutation):

```ts
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export const chatModel = openai('gpt-4o');
export const titleModel = anthropic('claude-haiku-4-5');
```

`engine/fixtures/repos/mutated/app/api/chat/route.ts` (contains near-misses that must not trigger):

```ts
import { streamText, gateway } from 'ai';
import { chatModel } from '@/lib/ai/providers';

// We evaluated openai('gpt-4o') early on; this comment must not trigger a finding.
const openai = 'just a variable name, not a provider reference';

export async function POST(request: Request) {
  const { messages } = await request.json();
  const result = streamText({ model: chatModel, messages });
  const fallback = gateway('anthropic/claude-sonnet-4-5');
  return result.toTextStreamResponse({ headers: { 'x-fallback': String(Boolean(fallback)), 'x-note': openai } });
}
```

- [ ] **Step 2: Append shared helpers to `engine/test/helpers.ts`**

```ts
import { readFile } from 'node:fs/promises';
import { loadCard } from '../src/policy/card.ts';
import { FsAuditLog, FsBlobStore } from '../src/store/fs.ts';
import { confirmAndRecord, scanAndRecord, type Deps } from '../src/workflow.ts';

export const AGREEMENT_PATH = path.join(ROOT, 'fixtures/agreement/synthetic-ai-addendum.md');
export const QUOTE =
  'Provider will route Customer Content for model inference only to the following model providers: Anthropic.';
export const FIXED_NOW = () => new Date('2026-10-13T09:00:00.000Z');

export async function fixtureDeps(): Promise<Deps> {
  const store = await mkdtemp(path.join(tmpdir(), 'curb-store-'));
  return {
    ctx: { tenantId: 'demo', actor: 'test-reviewer' },
    blobs: new FsBlobStore(store),
    audit: new FsAuditLog(store, FIXED_NOW),
    now: FIXED_NOW,
  };
}

export async function confirmFixture(deps: Deps) {
  const { card, hash } = await loadCard(CARD_PATH);
  const agreementRaw = await readFile(AGREEMENT_PATH);
  const obligation = await confirmAndRecord(deps, agreementRaw, card, {
    quote: QUOTE,
    applicability: 'applies',
    allowlist: ['anthropic'],
    approver: 'Test Reviewer',
    approvedAt: '2026-10-13T09:00:00.000Z',
  });
  return { card, cardHash: hash, agreementRaw, obligation };
}

export async function scanFixture(
  deps: Deps,
  confirmed: Awaited<ReturnType<typeof confirmFixture>>,
  repo: string,
) {
  return scanAndRecord(deps, {
    repoPath: path.join(ROOT, 'fixtures/repos', repo),
    agreementRaw: confirmed.agreementRaw,
    card: confirmed.card,
    cardHash: confirmed.cardHash,
    obligation: confirmed.obligation,
  });
}
```
(Move the new `import` lines to the top of the file with the existing imports.)

- [ ] **Step 3: Write the failing tests**

```ts
// engine/test/scan.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { ingestAgreement } from '../src/agreement/ingest.ts';
import { confirmObligation, locateQuote, type Applicability } from '../src/obligation/obligation.ts';
import { loadCard } from '../src/policy/card.ts';
import { ObligationNotActiveError, runScan } from '../src/scan.ts';
import { CARD_PATH, QUOTE, confirmFixture, fixtureDeps, makeRepo, scanFixture } from './helpers.ts';

describe('workflow on the mutated fixture', () => {
  it('produces a fail with one finding at providers.ts line 2 and records an audit trail', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const file = await scanFixture(deps, confirmed, 'mutated');
    expect(file.body.state).toBe('fail');
    expect(file.body.findings).toHaveLength(1);
    expect(file.body.findings[0].evidence.path).toBe('lib/ai/providers.ts');
    expect(file.body.findings[0].evidence.line).toBe(2);
    expect(file.body.filesEvaluated).toBe(2);
    expect(file.envelope.resultHash).toMatch(/^[0-9a-f]{64}$/);
    const types = (await deps.audit.list(deps.ctx)).map((e) => e.type);
    expect(types).toEqual(['obligation.confirmed', 'scan.completed']);
    expect(await deps.audit.verify(deps.ctx)).toBe(true);
  });

  it('gives the same result hash on a second run', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const a = await scanFixture(deps, confirmed, 'mutated');
    const b = await scanFixture(deps, confirmed, 'mutated');
    expect(b.envelope.resultHash).toBe(a.envelope.resultHash);
  });
});

describe('runScan gates', () => {
  async function setup(applicability: Applicability) {
    const { card, hash } = await loadCard(CARD_PATH);
    const agreement = ingestAgreement(`# A\n\n${QUOTE}\n`);
    const obligation = confirmObligation(
      {
        agreementTextSha256: agreement.textSha256,
        quote: QUOTE,
        range: locateQuote(agreement.text, QUOTE),
        policyCardId: card.id,
        policyCardVersion: card.version,
        applicability,
        allowlist: applicability === 'applies' ? ['anthropic'] : [],
        approver: 'Test Reviewer',
        approvedAt: '2026-10-13T09:00:00.000Z',
      },
      agreement,
      card,
    );
    const repoPath = await makeRepo({ 'a.ts': "import x from 'openai';\n" });
    return { input: { repoPath, card, cardHash: hash, agreement, obligation } };
  }

  it('refuses needs-counsel and unsupported obligations', async () => {
    for (const a of ['needs-counsel', 'unsupported'] as const) {
      const { input } = await setup(a);
      await expect(runScan(input)).rejects.toBeInstanceOf(ObligationNotActiveError);
    }
  });

  it('returns not-applicable only from a human not-applicable record', async () => {
    const { input } = await setup('not-applicable');
    const { body } = await runScan(input);
    expect(body.state).toBe('not-applicable');
    expect(body.findings).toEqual([]);
  });

  it('refuses a tampered obligation', async () => {
    const { input } = await setup('applies');
    const tampered = { ...input.obligation, allowlist: ['openai'] };
    await expect(runScan({ ...input, obligation: tampered })).rejects.toThrow(/does not match its content/);
  });

  it('refuses an agreement that differs from the one confirmed', async () => {
    const { input } = await setup('applies');
    await expect(runScan({ ...input, agreement: ingestAgreement('# Other\n') })).rejects.toThrow(/agreement/);
  });

  it('returns error, not pass, when the evaluator throws', async () => {
    const { input } = await setup('applies');
    const { body } = await runScan(input, () => {
      throw new Error('boom');
    });
    expect(body.state).toBe('error');
    expect(body.notes).toEqual(['evaluator-exception']);
  });

  it('does not touch the network during a scan', async () => {
    const { input } = await setup('applies');
    const net = await import('node:net');
    const http = await import('node:http');
    const dns = await import('node:dns');
    const guard = () => {
      throw new Error('network access attempted');
    };
    const originals = [net.Socket.prototype.connect, http.request, dns.lookup] as const;
    net.Socket.prototype.connect = guard as never;
    (http as { request: unknown }).request = guard;
    (dns as { lookup: unknown }).lookup = guard;
    try {
      const { body } = await runScan(input);
      expect(body.state).toBe('fail');
    } finally {
      net.Socket.prototype.connect = originals[0];
      (http as { request: unknown }).request = originals[1];
      (dns as { lookup: unknown }).lookup = originals[2];
    }
  });
});
```

```ts
// engine/test/cli.test.ts
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { AGREEMENT_PATH, CARD_PATH, QUOTE, ROOT } from './helpers.ts';

const run = promisify(execFile);
const cli = (args: string[]) => run('node', ['src/cli.ts', ...args], { cwd: ROOT });

describe('curb CLI (M1)', () => {
  it('confirm then scan prints FAIL with file:line evidence and a result hash', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    const obligationFile = path.join(dir, 'obligation.json');
    const resultFile = path.join(dir, 'result.json');
    await cli([
      'confirm', '--agreement', AGREEMENT_PATH, '--card', CARD_PATH, '--quote', QUOTE,
      '--allow', 'anthropic', '--approver', 'Test Reviewer', '--at', '2026-10-13T09:00:00.000Z',
      '--store', dir, '--out', obligationFile,
    ]);
    const { stdout } = await cli([
      'scan', '--repo', path.join(ROOT, 'fixtures/repos/mutated'), '--card', CARD_PATH,
      '--agreement', AGREEMENT_PATH, '--obligation', obligationFile, '--store', dir, '--out', resultFile,
    ]);
    expect(stdout).toMatch(/^FAIL/m);
    expect(stdout).toMatch(/lib\/ai\/providers\.ts:2:\d+\s+openai/);
    expect(stdout).toMatch(/result sha256:[0-9a-f]{64}/);
    const saved = JSON.parse(await readFile(resultFile, 'utf8'));
    expect(saved.body.state).toBe('fail');
  });

  it('exits non-zero with a readable message for a missing repo', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'curb-cli-'));
    await expect(
      cli(['scan', '--repo', '/nope', '--card', CARD_PATH, '--agreement', AGREEMENT_PATH, '--obligation', '/nope.json', '--store', dir]),
    ).rejects.toMatchObject({ code: 2 });
  });
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `cd engine && npx vitest run test/scan.test.ts test/cli.test.ts`
Expected: FAIL, cannot resolve `../src/workflow.ts` / `../src/scan.ts`.

- [ ] **Step 5: Implement `scan.ts`**

```ts
// engine/src/scan.ts
import type { AgreementSnapshot } from './agreement/ingest.ts';
import { EVALUATOR_VERSION, evaluate, type EvaluationOutput } from './evaluator/evaluate.ts';
import { verifyObligation, type Obligation } from './obligation/obligation.ts';
import type { PolicyCard } from './policy/card.ts';
import { canonicalize } from './schema/canonical.ts';
import { sha256 } from './schema/hash.ts';
import type { ResultBody } from './schema/types.ts';
import { takeSnapshot } from './snapshot/snapshot.ts';

export class ObligationNotActiveError extends Error {}

export interface ScanInput {
  repoPath: string;
  card: PolicyCard;
  cardHash: string;
  agreement: AgreementSnapshot;
  obligation: Obligation;
}

export async function runScan(
  input: ScanInput,
  evaluateFn: typeof evaluate = evaluate,
): Promise<{ body: ResultBody; resultHash: string }> {
  const { card, cardHash, agreement, obligation } = input;
  verifyObligation(obligation);
  if (obligation.policyCardId !== card.id || obligation.policyCardVersion !== card.version) {
    throw new Error('obligation was confirmed against a different policy card or version');
  }
  if (obligation.agreementTextSha256 !== agreement.textSha256) {
    throw new Error('obligation does not match the supplied agreement');
  }
  if (obligation.applicability !== 'applies' && obligation.applicability !== 'not-applicable') {
    throw new ObligationNotActiveError(
      `obligation applicability is "${obligation.applicability}"; a scan needs a human decision of "applies" or "not-applicable"`,
    );
  }

  const snapshot = await takeSnapshot(input.repoPath, { skipDirs: card.exclusions.dirs });
  let outcome: EvaluationOutput;
  if (obligation.applicability === 'not-applicable') {
    outcome = { state: 'not-applicable', findings: [], unknownFiles: [], filesEvaluated: 0, notes: ['human-recorded-not-applicable'] };
  } else {
    try {
      outcome = evaluateFn({ snapshot, card, allowlist: obligation.allowlist });
    } catch {
      outcome = { state: 'error', findings: [], unknownFiles: [], filesEvaluated: 0, notes: ['evaluator-exception'] };
    }
  }

  const body: ResultBody = {
    schemaVersion: '1',
    ruleId: card.id,
    ruleVersion: card.version,
    evaluatorVersion: EVALUATOR_VERSION,
    policyCardHash: cardHash,
    treeHash: snapshot.treeHash,
    agreementHash: agreement.textSha256,
    obligationHash: obligation.id,
    state: outcome.state,
    findings: outcome.findings,
    unknownFiles: outcome.unknownFiles,
    filesEvaluated: outcome.filesEvaluated,
    exclusions: [...card.exclusions.dirs.map((d) => `dir:${d}`), ...card.exclusions.files.map((f) => `file:${f}`)].sort(),
    notes: outcome.notes,
  };
  return { body, resultHash: sha256(canonicalize(body)) };
}
```

- [ ] **Step 6: Implement `workflow.ts`**

```ts
// engine/src/workflow.ts
import { ingestAgreement } from './agreement/ingest.ts';
import {
  confirmObligation,
  locateQuote,
  type Applicability,
  type Obligation,
} from './obligation/obligation.ts';
import type { PolicyCard } from './policy/card.ts';
import type { ResultFile } from './schema/types.ts';
import { ObligationNotActiveError, runScan } from './scan.ts';
import type { AuditLog, BlobStore, TenantContext } from './store/types.ts';

export interface Deps {
  ctx: TenantContext;
  blobs: BlobStore;
  audit: AuditLog;
  now?: () => Date;
}

export interface ConfirmFields {
  quote: string;
  start?: number;
  applicability: Applicability;
  allowlist: string[];
  approver: string;
  approvedAt: string;
  exception?: string;
}

export async function confirmAndRecord(
  deps: Deps,
  agreementRaw: Uint8Array,
  card: PolicyCard,
  fields: ConfirmFields,
): Promise<Obligation> {
  const agreement = ingestAgreement(agreementRaw);
  const range =
    fields.start === undefined
      ? locateQuote(agreement.text, fields.quote)
      : { start: fields.start, end: fields.start + fields.quote.length };
  const obligation = confirmObligation(
    {
      agreementTextSha256: agreement.textSha256,
      quote: fields.quote,
      range,
      policyCardId: card.id,
      policyCardVersion: card.version,
      applicability: fields.applicability,
      allowlist: fields.allowlist,
      approver: fields.approver,
      approvedAt: fields.approvedAt,
      exception: fields.exception,
    },
    agreement,
    card,
  );
  await deps.blobs.put(deps.ctx, agreementRaw);
  await deps.audit.append(deps.ctx, 'obligation.confirmed', {
    obligationId: obligation.id,
    agreementRawSha256: agreement.rawSha256,
    approver: obligation.approver,
  });
  return obligation;
}

export async function scanAndRecord(
  deps: Deps,
  a: { repoPath: string; agreementRaw: Uint8Array; card: PolicyCard; cardHash: string; obligation: Obligation },
): Promise<ResultFile> {
  const now = deps.now ?? (() => new Date());
  const agreement = ingestAgreement(a.agreementRaw);
  const startedAt = now().toISOString();
  let scanned;
  try {
    scanned = await runScan({
      repoPath: a.repoPath,
      card: a.card,
      cardHash: a.cardHash,
      agreement,
      obligation: a.obligation,
    });
  } catch (e) {
    if (e instanceof ObligationNotActiveError) {
      await deps.audit.append(deps.ctx, 'scan.refused', { obligationId: a.obligation.id, reason: e.message });
    }
    throw e;
  }
  const file: ResultFile = {
    body: scanned.body,
    envelope: {
      resultHash: scanned.resultHash,
      startedAt,
      finishedAt: now().toISOString(),
      operator: deps.ctx.actor,
      tenantId: deps.ctx.tenantId,
    },
  };
  await deps.blobs.put(deps.ctx, JSON.stringify(file, null, 2));
  await deps.audit.append(deps.ctx, 'scan.completed', {
    resultHash: file.envelope.resultHash,
    state: file.body.state,
    treeHash: file.body.treeHash,
  });
  return file;
}
```

- [ ] **Step 7: Implement `cli.ts` (confirm and scan; report and diff are added later)**

```ts
#!/usr/bin/env node
// engine/src/cli.ts
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadCard } from './policy/card.ts';
import type { Applicability, Obligation } from './obligation/obligation.ts';
import { FsAuditLog, FsBlobStore } from './store/fs.ts';
import { confirmAndRecord, scanAndRecord, type Deps } from './workflow.ts';

type Values = Record<string, string | boolean | undefined>;

function need(values: Values, name: string): string {
  const v = values[name];
  if (typeof v !== 'string' || v === '') throw new Error(`missing required option --${name}`);
  return v;
}

function makeDeps(values: Values, actor: string): Deps {
  const store = String(values.store ?? '.curb');
  return {
    ctx: { tenantId: String(values.tenant ?? 'demo'), actor },
    blobs: new FsBlobStore(store),
    audit: new FsAuditLog(store),
  };
}

async function output(text: string, out: unknown): Promise<void> {
  if (typeof out === 'string') await writeFile(out, text);
  else process.stdout.write(text);
}

async function confirm(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      agreement: { type: 'string' }, card: { type: 'string' }, quote: { type: 'string' }, start: { type: 'string' },
      applicability: { type: 'string', default: 'applies' }, allow: { type: 'string', default: '' },
      approver: { type: 'string' }, at: { type: 'string' }, exception: { type: 'string' },
      out: { type: 'string' }, store: { type: 'string' }, tenant: { type: 'string' },
    },
  });
  const approver = need(values, 'approver');
  const { card } = await loadCard(need(values, 'card'));
  const obligation = await confirmAndRecord(
    makeDeps(values, approver),
    await readFile(need(values, 'agreement')),
    card,
    {
      quote: need(values, 'quote'),
      start: values.start === undefined ? undefined : Number(values.start),
      applicability: String(values.applicability) as Applicability,
      allowlist: String(values.allow).split(',').map((s) => s.trim()).filter(Boolean),
      approver,
      approvedAt: values.at ?? new Date().toISOString(),
      exception: values.exception,
    },
  );
  await output(`${JSON.stringify(obligation, null, 2)}\n`, values.out);
}

async function scan(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      repo: { type: 'string' }, card: { type: 'string' }, agreement: { type: 'string' },
      obligation: { type: 'string' }, out: { type: 'string' }, store: { type: 'string' },
      tenant: { type: 'string' }, actor: { type: 'string', default: 'cli' },
    },
  });
  const { card, hash } = await loadCard(need(values, 'card'));
  const obligation = JSON.parse(await readFile(need(values, 'obligation'), 'utf8')) as Obligation;
  const file = await scanAndRecord(makeDeps(values, String(values.actor)), {
    repoPath: need(values, 'repo'),
    agreementRaw: await readFile(need(values, 'agreement')),
    card,
    cardHash: hash,
    obligation,
  });
  const { body, envelope } = file;
  const lines = [
    `${body.state.toUpperCase()}  ${body.findings.length} finding(s), ${body.unknownFiles.length} unknown file(s), ${body.filesEvaluated} file(s) evaluated`,
    ...body.findings.map((f) => `  ${f.evidence.path}:${f.evidence.line}:${f.evidence.column}  ${f.providerId}  ${f.evidence.excerpt}`),
    ...body.unknownFiles.map((u) => `  unknown: ${u.path} (${u.reason})`),
    `policy card status: ${card.status}`,
    `result sha256:${envelope.resultHash}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  if (typeof values.out === 'string') await writeFile(values.out, `${JSON.stringify(file, null, 2)}\n`);
}

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = { confirm, scan };

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const handler = command === undefined ? undefined : Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
  if (!handler) throw new Error(`usage: curb <${Object.keys(COMMANDS).join('|')}> [options]`);
  await handler(rest);
}

main().catch((e: unknown) => {
  process.stderr.write(`curb: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
});
```

- [ ] **Step 8: Run to verify they pass**

Run: `cd engine && npm run typecheck && npm test`
Expected: all tests across Tasks 1 to 7 PASS. In `cli.test.ts`, `execFile` rejection carries `code: 2` for the missing-repo case. If the network-guard test fails because ESM namespace objects are frozen (assignment throws), stop and use systematic-debugging; the likely fix is to stub through `vi.spyOn` on the CommonJS module objects (`require('node:http')` via `createRequire`).

- [ ] **Step 9: M1 demo (run it, do not skip)**

```bash
cd /Users/ajinkya/Desktop/curb/engine
npm run curb -- confirm --agreement fixtures/agreement/synthetic-ai-addendum.md \
  --card policies/unapproved-provider-reference.v1.json \
  --quote "Provider will route Customer Content for model inference only to the following model providers: Anthropic." \
  --allow anthropic --approver "Demo Reviewer" --out /tmp/curb-obligation.json
npm run curb -- scan --repo fixtures/repos/mutated --card policies/unapproved-provider-reference.v1.json \
  --agreement fixtures/agreement/synthetic-ai-addendum.md --obligation /tmp/curb-obligation.json --out /tmp/curb-result-mutated.json
```
Expected output of the scan: first line `FAIL  1 finding(s), 0 unknown file(s), 2 file(s) evaluated`, then `lib/ai/providers.ts:2:24  openai  import { openai } from '@ai-sdk/openai';`, then the card status line, then `result sha256:<64 hex>`. Run the scan a second time and confirm the hash is identical. Show this output to the user: this is milestone M1.

- [ ] **Step 10: Commit**

```bash
git add engine/src/scan.ts engine/src/workflow.ts engine/src/cli.ts engine/fixtures engine/test
git commit -m "Add scan orchestration, workflow wiring and the confirm/scan CLI (M1)" -m "A scan refuses to run without a verified, human-confirmed obligation, and returns error rather than pass if the evaluator throws. The CLI confirms an obligation then scans the mutated fixture, printing FAIL with file:line evidence and a reproducible result hash. Every step is written to the tenant's audit chain." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Report

**Files:**
- Create: `engine/src/report/markdown.ts`
- Modify: `engine/src/cli.ts` (add `report`)
- Test: `engine/test/report.test.ts`, golden file `engine/test/golden/report-fail.md` (generated once, reviewed by eye)

**Interfaces:**
- Consumes: `ResultFile`, `PolicyCard`, `Obligation`.
- Produces:
  - `interface ReportInput { file: ResultFile; card: PolicyCard; obligation: Obligation }`
  - `renderMarkdown(input: ReportInput): string`
  - `cell(text: string): string` (escapes untrusted text for a Markdown table cell inside a code span)
  - CLI: `curb report --result r.json --card c.json --obligation o.json [--format md|json]`

- [ ] **Step 1: Write the failing tests**

```ts
// engine/test/report.test.ts
import { describe, expect, it } from 'vitest';
import { cell, renderMarkdown } from '../src/report/markdown.ts';
import { confirmFixture, fixtureDeps, scanFixture } from './helpers.ts';

async function failReport() {
  const deps = await fixtureDeps();
  const confirmed = await confirmFixture(deps);
  const file = await scanFixture(deps, confirmed, 'mutated');
  return { file, card: confirmed.card, obligation: confirmed.obligation };
}

describe('renderMarkdown', () => {
  it('matches the reviewed golden report', async () => {
    const md = renderMarkdown(await failReport());
    await expect(md).toMatchFileSnapshot('./golden/report-fail.md');
  });

  it('puts the card status and the non-claims before the result', async () => {
    const md = renderMarkdown(await failReport());
    const status = md.indexOf('draft, pending counsel approval');
    const nonClaims = md.indexOf('Does not establish which provider receives data at runtime');
    const result = md.indexOf('## Result');
    expect(status).toBeGreaterThan(-1);
    expect(status).toBeLessThan(result);
    expect(nonClaims).toBeLessThan(result);
  });

  it('states the result in words, not only colour or symbols', async () => {
    expect(renderMarkdown(await failReport())).toMatch(/\*\*FAIL\*\*/);
  });

  it('never calls the repository compliant', async () => {
    expect(renderMarkdown(await failReport()).toLowerCase()).not.toMatch(/\bis compliant\b|\bcertified\b/);
  });
});

describe('cell', () => {
  it('neutralises pipes, backticks, newlines and HTML in untrusted source text', () => {
    const out = cell("a | b `c` <script>alert(1)</script>\nnext");
    expect(out).not.toMatch(/\n/);
    expect(out).not.toContain('|');
    expect(out.startsWith('`') && out.endsWith('`')).toBe(true);
    expect(out.slice(1, -1)).not.toContain('`');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd engine && npx vitest run test/report.test.ts`
Expected: FAIL, cannot resolve `../src/report/markdown.ts`.

- [ ] **Step 3: Implement**

```ts
// engine/src/report/markdown.ts
import type { Obligation } from '../obligation/obligation.ts';
import type { PolicyCard } from '../policy/card.ts';
import type { ResultFile, ResultState } from '../schema/types.ts';

export interface ReportInput {
  file: ResultFile;
  card: PolicyCard;
  obligation: Obligation;
}

const MEANING: Record<ResultState, string> = {
  pass: 'No references outside the allowlist were found in the evaluated files, within this rule\'s scope only. This does not establish compliance.',
  fail: 'At least one reference to a provider outside the allowlist was found. See the findings table for exact locations.',
  unknown: 'The rule could not establish a result for the whole scope. See the unknown files and notes below; this is not a pass.',
  error: 'The evaluator failed. This is not a verdict and must not be read as a pass.',
  'not-applicable': 'A named human recorded that this commitment does not apply. No scan verdict was produced.',
};

export function cell(text: string): string {
  const flat = text.replace(/[\r\n]+/g, ' ').replace(/`/g, "'").replace(/\|/g, '\\u007c');
  return `\`${flat}\``;
}

export function renderMarkdown({ file, card, obligation }: ReportInput): string {
  const { body, envelope } = file;
  const out: string[] = [];
  out.push('# Curb control verification report', '');
  out.push(`> Policy card status: **${card.status}**`, '');

  out.push('## Scope and non-claims', '');
  out.push(
    'This report checks configured engineering evidence against one human-confirmed contract commitment. It is not legal advice, a legal conclusion or a compliance certification.',
    '',
  );
  for (const n of card.nonClaims) out.push(`- ${n}`);
  out.push('');

  out.push('## Result', '');
  out.push(`**${body.state.toUpperCase()}**: ${MEANING[body.state]}`, '');
  out.push(`Rule: \`${body.ruleId}\` v${body.ruleVersion}. Files evaluated: ${body.filesEvaluated}.`, '');

  out.push('## Confirmed obligation', '');
  out.push(`- Quote: ${cell(obligation.quote)}`);
  out.push(`- Approved by: ${cell(obligation.approver)} at ${obligation.approvedAt}`);
  out.push(`- Applicability: ${obligation.applicability}`);
  out.push(`- Provider allowlist: ${obligation.allowlist.length ? obligation.allowlist.map(cell).join(', ') : 'none recorded'}`);
  if (obligation.exception) out.push(`- Exception: ${cell(obligation.exception)}`);
  out.push('');

  out.push('## Findings', '');
  if (body.findings.length === 0) out.push('None.', '');
  else {
    out.push('| Provider | Location | Excerpt | Finding ID |', '|---|---|---|---|');
    for (const f of body.findings) {
      const e = f.evidence;
      out.push(`| ${f.providerId} | ${cell(`${e.path}:${e.line}:${e.column}`)} | ${cell(e.excerpt)} | ${f.id.slice(0, 12)} |`);
    }
    out.push('');
  }

  out.push('## Unknown files and notes', '');
  if (body.unknownFiles.length === 0 && body.notes.length === 0) out.push('None.', '');
  else {
    for (const u of body.unknownFiles) out.push(`- ${cell(u.path)}: ${u.reason}`);
    for (const n of body.notes) out.push(`- note: ${n}`);
    out.push('');
  }

  out.push('## Exclusions', '');
  for (const x of body.exclusions) out.push(`- ${x}`);
  out.push('');

  out.push('## Inputs and hashes', '');
  out.push(`- Result hash: \`${envelope.resultHash}\``);
  out.push(`- Tree hash: \`${body.treeHash}\``);
  out.push(`- Agreement text hash: \`${body.agreementHash}\``);
  out.push(`- Obligation id: \`${body.obligationHash}\``);
  out.push(`- Policy card hash: \`${body.policyCardHash}\``);
  out.push(`- Evaluator version: ${body.evaluatorVersion}`, '');

  out.push('## Run', '');
  out.push(`- Started: ${envelope.startedAt}`);
  out.push(`- Finished: ${envelope.finishedAt}`);
  out.push(`- Operator: ${cell(envelope.operator)}`);
  out.push(`- Tenant: ${cell(envelope.tenantId)}`, '');
  return out.join('\n');
}
```
(`\\u007c` keeps a visible, harmless stand-in for the pipe. If you prefer a plain `/`, change it and the test still holds.)

- [ ] **Step 4: Add `report` to the CLI**

Add to `engine/src/cli.ts`:

```ts
import { renderMarkdown } from './report/markdown.ts';
import type { ResultFile } from './schema/types.ts';

async function report(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      result: { type: 'string' }, card: { type: 'string' }, obligation: { type: 'string' },
      format: { type: 'string', default: 'md' }, out: { type: 'string' },
    },
  });
  const file = JSON.parse(await readFile(need(values, 'result'), 'utf8')) as ResultFile;
  if (values.format === 'json') return output(`${JSON.stringify(file, null, 2)}\n`, values.out);
  const { card } = await loadCard(need(values, 'card'));
  const obligation = JSON.parse(await readFile(need(values, 'obligation'), 'utf8')) as Obligation;
  await output(renderMarkdown({ file, card, obligation }), values.out);
}
```
and change the table to `const COMMANDS = { confirm, scan, report };`.

- [ ] **Step 5: Generate the golden file, then review it by eye**

Run: `cd engine && npx vitest run test/report.test.ts`
Expected first run: tests PASS and `test/golden/report-fail.md` is created. Open it and confirm: draft status banner is near the top, non-claims precede the result, the finding row shows `lib/ai/providers.ts:2:24`, no wording claims compliance. Fix the renderer if anything is off, delete the golden file, rerun to regenerate, review again. Then run `npm test` and expect green on the second run.

- [ ] **Step 6: Commit**

```bash
git add engine/src/report engine/src/cli.ts engine/test/report.test.ts engine/test/golden
git commit -m "Add the Markdown report and curb report command" -m "The report leads with the policy card status and non-claims, states results in words, and escapes untrusted source text so repository content cannot inject Markdown into a report. A reviewed golden file pins the exact output." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Rerun delta, determinism suite and the seeded-fix loop (M2)

**Files:**
- Create: `engine/src/report/delta.ts`, `engine/fixtures/repos/fixed/{package.json,lib/ai/providers.ts,app/api/chat/route.ts}`
- Modify: `engine/src/cli.ts` (add `diff`)
- Test: `engine/test/delta.test.ts`, `engine/test/determinism.test.ts`, `engine/test/loop.test.ts`

**Interfaces:**
- Consumes: `ResultBody`, `Finding`, `ResultState`; helpers from Task 7.
- Produces:
  - `interface Delta { before: ResultState; after: ResultState; fixed: Finding[]; added: Finding[]; unchanged: Finding[] }`
  - `diffResults(before: ResultBody, after: ResultBody): Delta` (throws if rule, rule version, policy card, agreement or obligation differ)
  - `renderDeltaMarkdown(d: Delta): string`
  - CLI: `curb diff --before a.json --after b.json`

- [ ] **Step 1: Create the fixed fixture**

`engine/fixtures/repos/fixed/package.json`:

```json
{
  "name": "fixture-chat-app",
  "private": true,
  "dependencies": { "ai": "^5.0.0", "@ai-sdk/anthropic": "^2.0.0" }
}
```

`engine/fixtures/repos/fixed/lib/ai/providers.ts`:

```ts
import { anthropic } from '@ai-sdk/anthropic';

export const chatModel = anthropic('claude-sonnet-4-5');
export const titleModel = anthropic('claude-haiku-4-5');
```

`engine/fixtures/repos/fixed/app/api/chat/route.ts`: copy the file from `fixtures/repos/mutated/app/api/chat/route.ts` unchanged (`cp`).

- [ ] **Step 2: Write the failing tests**

```ts
// engine/test/delta.test.ts
import { describe, expect, it } from 'vitest';
import { diffResults, renderDeltaMarkdown } from '../src/report/delta.ts';
import { confirmFixture, fixtureDeps, scanFixture } from './helpers.ts';

describe('diffResults', () => {
  it('reports the single fixed finding between mutated and fixed', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const before = (await scanFixture(deps, confirmed, 'mutated')).body;
    const after = (await scanFixture(deps, confirmed, 'fixed')).body;
    const d = diffResults(before, after);
    expect(d.before).toBe('fail');
    expect(d.after).toBe('pass');
    expect(d.fixed).toHaveLength(1);
    expect(d.added).toHaveLength(0);
    expect(d.unchanged).toHaveLength(0);
    await expect(renderDeltaMarkdown(d)).toMatchFileSnapshot('./golden/delta-fixed.md');
  });

  it('treats identical results as all unchanged', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const a = (await scanFixture(deps, confirmed, 'mutated')).body;
    const d = diffResults(a, a);
    expect(d.unchanged).toHaveLength(1);
    expect(d.fixed).toHaveLength(0);
  });

  it('refuses to compare results from different control sets', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const a = (await scanFixture(deps, confirmed, 'mutated')).body;
    expect(() => diffResults(a, { ...a, ruleVersion: '2.0.0' })).toThrow(/not comparable/);
    expect(() => diffResults(a, { ...a, obligationHash: 'x' })).toThrow(/not comparable/);
  });
});
```

```ts
// engine/test/determinism.test.ts
import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ingestAgreement } from '../src/agreement/ingest.ts';
import { runScan } from '../src/scan.ts';
import { ROOT, confirmFixture, fixtureDeps } from './helpers.ts';

async function copyTree(src: string, transform: (s: string) => string, reverse: boolean): Promise<string> {
  const dst = await mkdtemp(path.join(tmpdir(), 'curb-copy-'));
  const rels: string[] = [];
  for (const rel of await readdir(src, { recursive: true })) {
    if ((await stat(path.join(src, rel))).isFile()) rels.push(rel);
  }
  if (reverse) rels.reverse();
  for (const rel of rels) {
    await mkdir(path.dirname(path.join(dst, rel)), { recursive: true });
    await writeFile(path.join(dst, rel), transform(await readFile(path.join(src, rel), 'utf8')));
  }
  return dst;
}

describe('determinism', () => {
  it('gives one result hash across path, line endings and file creation order', async () => {
    const confirmed = await confirmFixture(await fixtureDeps());
    const agreement = ingestAgreement(confirmed.agreementRaw);
    const src = path.join(ROOT, 'fixtures/repos/mutated');
    const variants = [
      src,
      await copyTree(src, (s) => s, false),
      await copyTree(src, (s) => s.replace(/\n/g, '\r\n'), false),
      await copyTree(src, (s) => s, true),
    ];
    const hashes: string[] = [];
    for (const repoPath of variants) {
      const { resultHash } = await runScan({
        repoPath, card: confirmed.card, cardHash: confirmed.cardHash, agreement, obligation: confirmed.obligation,
      });
      hashes.push(resultHash);
    }
    expect(new Set(hashes).size).toBe(1);
  });
});
```

```ts
// engine/test/loop.test.ts
import { describe, expect, it } from 'vitest';
import { diffResults } from '../src/report/delta.ts';
import { confirmFixture, fixtureDeps, scanFixture } from './helpers.ts';

describe('seeded-fix loop (M2)', () => {
  it('mutation fails, fix passes, rerun is reproducible, and only the intended finding flips', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);

    const failing = await scanFixture(deps, confirmed, 'mutated');
    expect(failing.body.state).toBe('fail');
    expect(failing.body.findings).toHaveLength(1);

    const fixed = await scanFixture(deps, confirmed, 'fixed');
    expect(fixed.body.state).toBe('pass');
    expect(fixed.body.filesEvaluated).toBe(2);

    const rerun = await scanFixture(deps, confirmed, 'fixed');
    expect(rerun.envelope.resultHash).toBe(fixed.envelope.resultHash);

    const delta = diffResults(failing.body, fixed.body);
    expect(delta.fixed.map((f) => f.id)).toEqual(failing.body.findings.map((f) => f.id));
    expect(delta.added).toEqual([]);
    expect(await deps.audit.verify(deps.ctx)).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd engine && npx vitest run test/delta.test.ts test/determinism.test.ts test/loop.test.ts`
Expected: FAIL, cannot resolve `../src/report/delta.ts`.

- [ ] **Step 4: Implement**

```ts
// engine/src/report/delta.ts
import type { Finding, ResultBody, ResultState } from '../schema/types.ts';
import { cell } from './markdown.ts';

export interface Delta {
  before: ResultState;
  after: ResultState;
  fixed: Finding[];
  added: Finding[];
  unchanged: Finding[];
}

export function diffResults(before: ResultBody, after: ResultBody): Delta {
  const keys = ['ruleId', 'ruleVersion', 'policyCardHash', 'agreementHash', 'obligationHash'] as const;
  const mismatched = keys.filter((k) => before[k] !== after[k]);
  if (mismatched.length > 0) {
    throw new Error(`results are not comparable: ${mismatched.join(', ')} differ`);
  }
  const beforeIds = new Set(before.findings.map((f) => f.id));
  const afterIds = new Set(after.findings.map((f) => f.id));
  return {
    before: before.state,
    after: after.state,
    fixed: before.findings.filter((f) => !afterIds.has(f.id)),
    added: after.findings.filter((f) => !beforeIds.has(f.id)),
    unchanged: after.findings.filter((f) => beforeIds.has(f.id)),
  };
}

function section(title: string, findings: Finding[]): string[] {
  const out = [`## ${title} (${findings.length})`, ''];
  if (findings.length === 0) out.push('None.', '');
  for (const f of findings) {
    const e = f.evidence;
    out.push(`- ${cell(`${e.path}:${e.line}:${e.column}`)} ${f.providerId} ${cell(e.excerpt)}`);
  }
  if (findings.length > 0) out.push('');
  return out;
}

export function renderDeltaMarkdown(d: Delta): string {
  return [
    '# Curb rerun delta',
    '',
    `State: **${d.before.toUpperCase()}** to **${d.after.toUpperCase()}**`,
    '',
    'Findings are matched by rule, path, byte range and matched value. Moving code changes its range, so a moved reference appears as one fixed and one added finding.',
    '',
    ...section('Fixed', d.fixed),
    ...section('Added', d.added),
    ...section('Unchanged', d.unchanged),
  ].join('\n');
}
```

Add to `engine/src/cli.ts`:

```ts
import { diffResults, renderDeltaMarkdown } from './report/delta.ts';

async function diff(args: string[]): Promise<void> {
  const { values } = parseArgs({ args, options: { before: { type: 'string' }, after: { type: 'string' }, out: { type: 'string' } } });
  const read = async (name: string) => (JSON.parse(await readFile(need(values, name), 'utf8')) as ResultFile).body;
  await output(`${renderDeltaMarkdown(diffResults(await read('before'), await read('after')))}\n`, values.out);
}
```
and set `const COMMANDS = { confirm, scan, report, diff };`.

- [ ] **Step 5: Run the full suite and review the delta golden**

Run: `cd engine && npm run typecheck && npm test`
Expected: all PASS; `test/golden/delta-fixed.md` created on first run. Open it and confirm it shows `FAIL` to `PASS`, one fixed finding at `lib/ai/providers.ts:2`, none added. If the determinism test fails, stop and use systematic-debugging; do not weaken it.

- [ ] **Step 6: M2 demo (run it, do not skip)**

```bash
cd /Users/ajinkya/Desktop/curb/engine
npm run curb -- scan --repo fixtures/repos/fixed --card policies/unapproved-provider-reference.v1.json \
  --agreement fixtures/agreement/synthetic-ai-addendum.md --obligation /tmp/curb-obligation.json --out /tmp/curb-result-fixed.json
npm run curb -- diff --before /tmp/curb-result-mutated.json --after /tmp/curb-result-fixed.json
npm run curb -- report --result /tmp/curb-result-mutated.json --card policies/unapproved-provider-reference.v1.json --obligation /tmp/curb-obligation.json
```
Expected: the fixed scan prints `PASS`; the diff shows `FAIL to PASS` with one fixed finding; the report prints with the draft status banner first. Show all three outputs to the user: this is milestone M2.

- [ ] **Step 7: Checkpoint review (feature-dev and simplifier)**

Dispatch `feature-dev:code-reviewer` over `engine/src` with the prompt: "Check against the spec at docs/superpowers/specs/2026-10-13-curb-v1-vertical-slice-design.md section 5 and 7. Report any place a state can be `pass` without analysis, any nondeterminism, any untrusted text reaching a report unescaped, and any import of network or process modules in engine/src." Fix confirmed issues test-first. Then dispatch `code-simplifier:code-simplifier` over `engine/src` and apply only behavior-preserving changes with the suite green.

- [ ] **Step 8: Commit**

```bash
git add engine/src/report/delta.ts engine/src/cli.ts engine/fixtures/repos/fixed engine/test
git commit -m "Add rerun delta, determinism suite and the seeded-fix loop (M2)" -m "diff compares two results from the same control set and lists fixed, added and unchanged findings. Tests prove one result hash across absolute path, CRLF and file creation order, and that fixing the seeded mutation flips exactly the intended finding." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Phase 0 documents (can run in parallel with Tasks 1 to 9)

**Files:**
- Create: `engine/scripts/source-manifest.ts`, `docs/curb/source-manifest.json`, `docs/curb/charter.md`, `docs/curb/prototype-audit.md`, `docs/curb/adr-001-result-schema.md`, `docs/curb/threat-model-v1.md`, `docs/curb/policy-card-template.md`

This task is documentation and capture. It is independent of the engine code, so it suits a parallel subagent. Every document is drafted unsigned: each carries a first line `Status: DRAFT, unsigned. Needs <role> sign-off.` and does not claim approval.

- [ ] **Step 1: Write the source-manifest script**

```ts
// engine/scripts/source-manifest.ts
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { sha256 } from '../src/schema/hash.ts';

const repo = process.argv[2] ?? 'vercel/chatbot';
const out = process.argv[3] ?? '../docs/curb/source-manifest.json';

function gh(args: string[]): string {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
}

const commitSha = gh(['api', `repos/${repo}/commits/HEAD`, '--jq', '.sha']).trim();
const spdx = gh(['api', `repos/${repo}/license`, '--jq', '.license.spdx_id']).trim();

const files = ['LICENSE', 'NOTICE', 'package.json', 'pnpm-lock.yaml'].map((p) => {
  try {
    const raw = gh(['api', `repos/${repo}/contents/${p}?ref=${commitSha}`, '-H', 'Accept: application/vnd.github.raw']);
    return { path: p, present: true, sha256: sha256(raw), bytes: Buffer.byteLength(raw) };
  } catch {
    return { path: p, present: false, sha256: null, bytes: 0 };
  }
});

const manifest = {
  retrievedAt: new Date().toISOString(),
  repo,
  commitSha,
  spdxLicense: spdx,
  files,
  attribution: `Reference fixture derived from ${repo} at ${commitSha}, licensed ${spdx}. Not an assertion about the upstream project's practices. No endorsement implied.`,
  status: 'DRAFT, unsigned. Needs source and license review sign-off before any redistribution.',
};
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`wrote ${out} for ${repo}@${commitSha}\n`);
```

- [ ] **Step 2: Run it**

```bash
cd /Users/ajinkya/Desktop/curb/engine && mkdir -p ../docs/curb && node scripts/source-manifest.ts
```
Expected: prints `wrote ../docs/curb/source-manifest.json for vercel/chatbot@<40 hex>`. The manifest must show `spdxLicense` `Apache-2.0` and a `present: true` LICENSE entry. If `gh` is unauthenticated or offline, stop and ask the user to run `! gh auth login`; do not invent values.

- [ ] **Step 3: Prototype audit**

Write `docs/curb/prototype-audit.md` with the header line, a one-paragraph summary (client-only Next 16 and React 19 app, no backend, database, auth, uploads or deployment; commits `35295a2` and `e4513d8`), and this table, then record the secret-scan command and its output:

| Module | Function | Tests | Fit with V1 | Decision | Rollback point |
|---|---|---|---|---|---|
| `frontend/src/lib/assessment/*` (evaluate, requirements, defaults, options, helpers, types) | Maps form answers to framework requirements | `evaluate.test.ts` | Form-to-PDF model, no snapshots, evidence or rules | Archive read-only | tag `prototype-form-to-pdf` |
| `frontend/src/lib/assessment/pdf.ts` | jsPDF export | `pdf.test.ts` | Presentation only | Archive | same tag |
| `frontend/src/components/*` | Form and live document UI | `Workspace.test.tsx` | Candidate shell for M3 | Retain; adapt behind an adapter at M3 | same tag |
| `frontend/` Next config, app layout, styles | App shell | none | Reusable | Retain | same tag |
| `templates/`, `catalog.json` | Common Paper templates (CC BY 4.0, attributed) | none | Illustrative clause vocabulary | Retain | tag |

Secret scan (record output verbatim in the document):

```bash
cd /Users/ajinkya/Desktop/curb && git grep -nEi '(api[_-]?key|secret|token|password|BEGIN (RSA|EC|OPENSSH) PRIVATE)' -- . ':!templates' ':!frontend/package-lock.json' ':!engine/package-lock.json' ':!docs' | head -40
```
Triage each hit (most will be words in UI copy or requirement text). Then create the archive tag locally: `git tag prototype-form-to-pdf e4513d8`. Do not push the tag.

- [ ] **Step 4: Charter**

Write `docs/curb/charter.md` (one page) with sections: Target user (developer asked to substantiate an AI or data-handling commitment; secondary: legal reviewer); Single workflow (confirm obligation, scan, evidence, fix, rerun); Supported repo type (TypeScript and JavaScript, static analysis of a local snapshot); Non-claims (copy the card's nonClaims plus "not a runtime monitor"); Success hypothesis (M2 loop works on synthetic and one pinned real repo with zero false passes on unsupported cases); Owners table with rows Product, Technical, Security, Legal/policy each marked `unassigned, to be named`; Stop conditions (no authority over a source, no human owner for obligation approval). End with a signature block left empty.

- [ ] **Step 5: ADR for the result schema**

Write `docs/curb/adr-001-result-schema.md` using the repo's ADR style (use the `adr` skill's format): Context (verdicts must be reproducible and auditable); Decision (five states, precedence, hashed body excludes timestamps, canonical JSON rules from Global Constraints, CRLF normalization, finding id definition); Rejected alternatives (boolean pass/fail: hides unknown; timestamps inside the hash: breaks reproducibility; evaluator-emitted not-applicable: moves human accountability into code); Consequences (moved code shows as fixed plus added; guard against the hash covering raw bytes).

- [ ] **Step 6: Threat model v1**

Write `docs/curb/threat-model-v1.md` covering only the vertical slice, as a table of threat, V1 control, test that verifies it, and residual risk. Rows: hostile repository (symlink, oversized, hooks, postinstall; snapshot tests); path or tenant traversal (tenant id and hash validation; store tests); report injection from repository text (cell escaping; report test); evidence or audit tampering (hash chain; tamper test; residual: no signing yet, single writer assumed); false pass (unknown semantics; evaluator tests); rule tampering (residual: card is unsigned in V1); network egress (stubbed in test only; residual: container egress denial deferred to Phase 2); evaluator timeout (residual: not implemented in V1, the evaluator is synchronous and bounded only by the size cap; a worker with a timeout is a Phase 2 item); concurrent writers on the audit log (residual). State plainly that prompt injection and LLM risks do not apply because V1 has no LLM.

- [ ] **Step 7: Policy card template**

Write `docs/curb/policy-card-template.md` listing the fields of `PolicyCard` from `engine/src/policy/card.ts` with a one-line description each, plus the rule: a card ships as `draft, pending counsel approval` until a named counsel and a security reviewer sign.

- [ ] **Step 8: Commit**

```bash
git add docs/curb engine/scripts
git commit -m "Add Phase 0 documents: source manifest, prototype audit, charter, ADR, threat model" -m "Pins the Vercel Chatbot fixture source with license and lockfile hashes, records the reuse/archive decision for the form-to-PDF prototype, and drafts the charter, result-schema ADR, V1 threat model and policy-card template. All are unsigned drafts that name the human sign-offs still required." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Engine README, final verification and handoff

**Files:**
- Create: `engine/README.md`
- Modify: `README.md` (replace the TODO placeholders)

- [ ] **Step 1: Write `engine/README.md`**

Include: what the engine does and does not claim; requirements (Node 24); `npm install`, `npm test`, `npm run typecheck`; the exact M1 and M2 demo commands from Tasks 7 and 9; the result-state table; the layout from File Structure; a link to the spec and the plan; a note that the shipped card is a draft.

- [ ] **Step 2: Update the root `README.md`**

Replace the one-line description and the Status, Setup and Usage TODOs with: one sentence on Curb's purpose, a status line (`V1 vertical slice in progress: engine/ is the verifier, frontend/ is the archived form-to-PDF prototype shell`), setup (`cd engine && npm install`), and a pointer to `engine/README.md`. Keep the license section.

- [ ] **Step 3: Full verification (superpowers:verification-before-completion)**

```bash
cd /Users/ajinkya/Desktop/curb/engine && npm run typecheck && npm test
cd ../frontend && npm test 2>&1 | tail -5
cd .. && git grep -nE "from 'node:(http|https|net|dns|child_process|worker_threads)'" -- engine/src
git status --short
```
Expected: typecheck clean; engine tests green; frontend tests still green (untouched); the `git grep` prints nothing; `git status` shows no stray files (no `.curb/` directory tracked). Run the Spec Coverage check below and report any gap instead of claiming completion.

- [ ] **Step 4: Wiring check**

Confirm every new module is reachable from the CLI path: `cli.ts` imports `workflow.ts`, `report/markdown.ts`, `report/delta.ts`, `policy/card.ts`, `store/fs.ts`; `workflow.ts` imports `scan.ts`, `agreement/ingest.ts`, `obligation/obligation.ts`; `scan.ts` imports `snapshot`, `evaluator`. The M1 and M2 demo commands in Steps 9 (Task 7) and 6 (Task 9) already exercised every path; paste their output in the final summary.

- [ ] **Step 5: Commit**

```bash
git add engine/README.md README.md
git commit -m "Document the engine and replace the README placeholders" -m "Adds usage for the confirm, scan, report and diff commands, the result-state table and the two milestone demos, and removes the TODOs from the root README." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand back to the user**

Report: what ran, the M1 and M2 outputs, test counts, the unsigned human gates (owners, counsel approval of the card, source and license review), the deferred items (evaluator timeout, container egress denial, M3 decision), and the question "M3 now or later?". Then invoke superpowers:finishing-a-development-branch.

---

## Spec Coverage Check

| Spec section | Task |
|---|---|
| 1 Purpose and success | 7, 9 (M1, M2) |
| 2 Milestones | 7, 9 |
| 3 Prototype decision | 10 (audit, tag), 11 (README) |
| 4 Architecture, interfaces, deviation | 0 to 7 |
| 5 Result semantics, canonical JSON | 1, 4, 7 |
| 6 Policy card | 3, 4 |
| 7 Tests (unit, evaluator cases, determinism, malicious fixture, no-network, tenant isolation, golden, seeded-fix) | 1, 2, 4, 6, 7, 8, 9 |
| 8 Phase 0 artifacts | 10 |
| 9 Risks | 10 (threat model), 11 |

Deviations from the spec that this plan makes explicit (the spec is amended to match): the CLI has `confirm | scan | report | diff` because snapshot and ingest run inside confirm and scan; text is line-ending normalized before hashing so the CRLF determinism test is satisfiable; evaluator timeout is deferred to Phase 2 (V1 is bounded by the size cap), so `error` in V1 means evaluator exception.

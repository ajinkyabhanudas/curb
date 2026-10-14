// engine/scripts/source-manifest.ts
// Pins an upstream fixture source (commit SHA, SPDX licence, file hashes) via the GitHub CLI.
// This is the only place in the engine package that may use node:child_process.
//
// usage: node scripts/source-manifest.ts [repo] [outPath] [commitSha]
// With commitSha the commit is pinned (and checked to exist) instead of resolving HEAD.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { sha256 } from '../src/schema/hash.ts';

const repo = process.argv[2] ?? 'vercel/chatbot';
const out = process.argv[3] ?? '../docs/curb/source-manifest.json';
const pinned = process.argv[4];

class GhError extends Error {
  readonly notFound: boolean;
  constructor(message: string, notFound: boolean) {
    super(message);
    this.notFound = notFound;
  }
}

function gh(args: string[]): string {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string | Buffer };
    if (err.code === 'ENOENT') {
      throw new GhError('the GitHub CLI (gh) is not installed or not on PATH; install it and run `gh auth login`', false);
    }
    const first = String(err.stderr ?? err.message).split('\n')[0]?.trim() ?? '';
    return fail(first, /\bHTTP 404\b/.test(String(err.stderr ?? '')));
  }
}

function fail(firstLine: string, notFound: boolean): never {
  throw new GhError(firstLine, notFound);
}

function die(message: string): never {
  process.stderr.write(`source-manifest: ${message}\n`);
  process.exit(1);
}

if (pinned !== undefined && !/^[0-9a-f]{40}$/.test(pinned)) die(`commitSha must be 40 lowercase hex characters, got "${pinned}"`);

let commitSha: string;
let spdx: string;
let files: Array<{ path: string; present: boolean; sha256: string | null; bytes: number }>;
try {
  commitSha = (
    pinned === undefined
      ? gh(['api', `repos/${repo}/commits/HEAD`, '--jq', '.sha'])
      : gh(['api', `repos/${repo}/commits/${pinned}`, '--jq', '.sha'])
  ).trim();
  if (pinned !== undefined && commitSha !== pinned) die(`the API returned ${commitSha} for pinned commit ${pinned}`);
  spdx = gh(['api', `repos/${repo}/license?ref=${commitSha}`, '--jq', '.license.spdx_id']).trim();
  files = ['LICENSE', 'NOTICE', 'package.json', 'pnpm-lock.yaml'].map((p) => {
    try {
      const raw = gh(['api', `repos/${repo}/contents/${p}?ref=${commitSha}`, '-H', 'Accept: application/vnd.github.raw']);
      return { path: p, present: true, sha256: sha256(raw), bytes: Buffer.byteLength(raw) };
    } catch (e) {
      if (e instanceof GhError && e.notFound) return { path: p, present: false, sha256: null, bytes: 0 };
      throw new GhError(`could not fetch ${p}: ${e instanceof Error ? e.message : String(e)}`, false);
    }
  });
} catch (e) {
  die(e instanceof Error ? e.message : String(e));
}

const licenseBytes = files.find((f) => f.path === 'LICENSE')?.bytes ?? 0;
const attribution =
  spdx === 'NOASSERTION'
    ? `Reference fixture derived from ${repo} at ${commitSha}. GitHub reports no recognised SPDX licence (NOASSERTION); the LICENSE file at this commit has ${licenseBytes} bytes and must be reviewed by the source reviewer before any redistribution. Not an assertion about the upstream project's practices. No endorsement implied.`
    : `Reference fixture derived from ${repo} at ${commitSha}, licence ${spdx}. Not an assertion about the upstream project's practices. No endorsement implied.`;

const manifest = {
  retrievedAt: new Date().toISOString(),
  repo,
  commitSha,
  commitPinnedByArgument: pinned !== undefined,
  spdxLicense: spdx,
  files,
  attribution,
  status: 'DRAFT, unsigned. Needs source and license review sign-off before any redistribution.',
};
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`wrote ${out} for ${repo}@${commitSha}\n`);

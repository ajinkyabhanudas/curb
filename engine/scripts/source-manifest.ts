// engine/scripts/source-manifest.ts
// Pins an upstream fixture source (commit SHA, SPDX licence, file hashes) via the GitHub CLI.
// This is the only place in the engine package that may use node:child_process.
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

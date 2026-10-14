# Curb engine

A TypeScript library and CLI that checks one human-confirmed contract commitment against a local source tree, using one deterministic rule. It produces evidence (file, line, hash), a Markdown or JSON report, and a delta between two runs. No LLM and no network access are involved in the verdict.

Current rule: `unapproved-provider-reference` version 1.0.1 (is any AI model provider referenced in TypeScript or JavaScript source that is not on the customer's allowlist).

## What this does not claim

- It is not legal advice and not a compliance certification.
- `pass` is scope-limited evidence: every analyzed file parsed and no reference outside the allowlist was found by this one rule. It does not mean the commitment is met.
- The shipped policy card has status `draft, pending counsel approval`. That status prints on every scan summary (second line), at the top of every Markdown report and delta, and in the JSON report, until a human changes it. No output of this engine can be presented as counsel-approved.
- The engine does not decide what an agreement means. A named human supplies the quote, the allowlist and whether the commitment applies; the engine records that and scans against it.
- Owners, counsel approval of the card, and source and license review are unsigned human gates. See `docs/curb/`.

## Requirements

Node >= 24 (the CLI runs `.ts` files directly; there is no build step).

```
cd engine
npm install
npm test            # vitest, 313 tests
npm run typecheck   # tsc --noEmit
```

CLI entry point: `npm run -s curb -- <command> [options]` (the `-s` keeps npm's banner out of the output).

## Commands

| Command | Purpose | Options |
|---|---|---|
| `confirm` | Record a human-confirmed obligation and print it as JSON | `--agreement` `--card` `--quote` `--approver` (required); `--start` `--applicability` (default `applies`) `--allow` (comma-separated provider IDs) `--at` (ISO time, default now) `--exception` `--out` `--force` `--store` `--tenant` |
| `scan` | Scan a repo against the obligation and print the verdict | `--repo` `--card` `--agreement` `--obligation` (required); `--out` `--force` `--store` (default `.curb`) `--tenant` (default `demo`) `--actor` (default `cli`) |
| `report` | Render a saved result as Markdown or JSON | `--result` `--card` `--agreement` `--obligation` (required); `--format md\|json` (default `md`) `--out` `--force` |
| `diff` | Compare two saved results (fixed, added, unchanged) | `--before` `--after` `--card` (required); `--out` `--force` |
| `audit` | Verify the hash-chained audit log of a store | `--store` (required); `--tenant` (default `demo`) |

`--out` refuses to overwrite an existing file unless `--force` is given. `--start` is the character offset of the quote in the agreement; if omitted, the quote is located in the text (it must be found exactly once).

`diff --card` must be the policy card both results were produced with: its hash has to equal `policyCardHash` in both, otherwise `diff` refuses with exit code 2. The card supplies the status line printed under the delta heading.

`report --format json` prints a report, not a result file: `{ "policyCard": { "id", "version", "status", "hash" }, "nonClaims": [...], "result": <the verified result file> }`. Pass the original result file, not this output, to `report` or `diff`; they reject the wrapper.

`audit` exits 2 with `no audit log found for tenant "<id>" in store "<path>"` when the tenant has no `audit.jsonl` (a mistyped `--store` or `--tenant` never reads as a verified log). An existing empty log is OK with 0 entries. A log that cannot be parsed prints `entries: unknown` and `audit chain CORRUPT`, exit 2.

Exit codes: `0` for any verdict (pass, fail, unknown, not-applicable) and for successful `confirm`, `report`, `diff` and a clean `audit`; `2` for usage errors, refusals, unreadable or inconsistent inputs, a missing audit log and a corrupt audit chain; `3` for the `error` state (the evaluator failed; this is not a verdict). A failure inside one file's analysis marks that file `unknown` (`parse-error`) instead, so `error` is reached only if evaluation fails outside per-file analysis.

## Worked demo

All commands run from `engine/`. The store is kept outside the repository being scanned (the CLI refuses a `--store` inside `--repo`), so use a scratch directory. `--at` pins the approval time: `approvedAt` is part of the hashed obligation, so without it each `confirm` hashes differently and the result hash changes between runs. With `--at`, the hashes below reproduce exactly.

```
W=$(mktemp -d)
CARD=policies/unapproved-provider-reference.v1.json
AGR=fixtures/agreement/synthetic-ai-addendum.md
Q="Provider will route Customer Content for model inference only to the following model providers: Anthropic."
```

1. Confirm the obligation (a named approver records the quote and the allowlist):

```
npm run -s curb -- confirm --card $CARD --agreement $AGR --quote "$Q" --allow anthropic \
  --approver demo-approver --at 2026-10-13T09:00:00Z --store $W/store --out $W/obligation.json
```

The obligation id is `3d96566b1e43ef3b56b9b6fd16b3f1938411a273568c3f420ea843d8d85119ea`; the quote sits at range 384 to 490 of the normalized agreement text.

2. Scan the mutated fixture (imports `@ai-sdk/openai`):

```
npm run -s curb -- scan --card $CARD --agreement $AGR --obligation $W/obligation.json \
  --repo fixtures/repos/mutated --store $W/store --out $W/before.json
```
```
FAIL  1 finding(s), 0 unknown file(s), 2 file(s) evaluated
policy card status: draft, pending counsel approval
  lib/ai/providers.ts:2:24  openai  import { openai } from '@ai-sdk/openai';
store: $W/store  tenant: demo
result sha256:5f8eaba23320a1a9fc72879713b931e8b4d7bc394e89584272b0a15ce4af85b9
```

Exit code 0: a finding is a successful run with a result.

3. Scan the fixed fixture:

```
npm run -s curb -- scan --card $CARD --agreement $AGR --obligation $W/obligation.json \
  --repo fixtures/repos/fixed --store $W/store --out $W/after.json
```
```
PASS  0 finding(s), 0 unknown file(s), 2 file(s) evaluated
policy card status: draft, pending counsel approval
store: $W/store  tenant: demo
result sha256:b9f84b3f5e380a9fdf9810b4e8303baebaf3af6cc3220d221e15696a3ade26fc
```

4. Diff the two runs:

```
npm run -s curb -- diff --card $CARD --before $W/before.json --after $W/after.json
```
```
# Curb rerun delta

> Policy card status: **draft, pending counsel approval**

This compares two scoped Curb results from the same control set. It is not a compliance statement, legal advice or a certification.

State: **FAIL** to **PASS**
...
## Fixed (1)

- `lib/ai/providers.ts:2:24` `openai` `import { openai } from '@ai-sdk/openai';`

## Added (0)
## Unchanged (0)
```

5. Report on the failing run (scope and non-claims come first):

```
npm run -s curb -- report --card $CARD --agreement $AGR --obligation $W/obligation.json --result $W/before.json
```
```
# Curb control verification report

> Policy card status: **draft, pending counsel approval**

## Scope and non-claims
...
## Result

**FAIL**: At least one reference to a provider outside the allowlist was found. See the findings table for exact locations.

Rule: `unapproved-provider-reference` v`1.0.1`. Files evaluated: 2.
...
| Provider | Location | Excerpt | Finding ID |
|---|---|---|---|
| `openai` | `lib/ai/providers.ts:2:24` | `import { openai } from '@ai-sdk/openai';` | `39cdc58dd2b5` |
```

The report also lists the confirmed obligation, exclusions and every input hash (result, tree, agreement, obligation, policy card, evaluator version), then the run envelope (start and finish time, operator, tenant). The envelope is outside the hash, so those times differ between runs.

6. Verify the audit log:

```
npm run -s curb -- audit --store $W/store
```
```
tenant: demo  entries: 3
audit chain OK
```

A store or tenant with no log is refused rather than reported as an empty, verified chain:

```
npm run -s curb -- audit --store $W/stor
```
```
curb: no audit log found for tenant "demo" in store "$W/stor"
```
(exit code 2)

Pointing `--store` inside the scanned repo is refused with exit code 2:

```
curb: --store (fixtures/repos/fixed/.curb) is inside the scanned repo (fixtures/repos/fixed); pass --store outside the repo
```

## Result states

Precedence for an evaluated scan: `error > fail > unknown > pass`.

| State | Meaning | Evidence required in the result |
|---|---|---|
| `pass` | Every in-scope file parsed, at least one file was evaluated, and no reference outside the allowlist was found. Scope-limited evidence, not compliance. | no findings, no unknown files, at least one file evaluated |
| `fail` | At least one reference to a registered provider outside the allowlist. One finding per occurrence. | at least one finding |
| `unknown` | Something could not be checked and nothing failed: a non-excluded file is a symlink, unparseable, generated or minified, of a file type that is neither analyzed nor on the ignorable list, or over the size cap; or no file could be evaluated (note `no-evaluable-files`). Affected files are listed. | at least one unknown file, or the note `no-evaluable-files` |
| `not-applicable` | A named human recorded applicability `not-applicable` on the obligation. The evaluator never returns this state; the scan skips evaluation and notes `human-recorded-not-applicable`. | no findings, no unknown files, zero files evaluated |
| `error` | The evaluator threw outside per-file analysis (a failure inside one file makes that file `unknown`). Not a verdict and never a pass. The exception text goes to stderr only, not into the result file. V1 has no evaluator timeout; the per-file size cap bounds work. | no findings, zero files evaluated |

`report` refuses a `not-applicable` result for an obligation that applies, and a verdict for an obligation recorded as not-applicable. Reasoning: `docs/curb/adr-001-result-schema.md`.

## What the evaluator checks

Using the TypeScript compiler API on `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts` and `.cts` files (extension matched case-insensitively, declaration files included), it flags:

1. Import, `require`, `require.resolve`, dynamic `import()` and import-type (`typeof import('openai')`, `import('openai').T`) specifiers of registered provider packages (for example `openai`, `@anthropic-ai/sdk`, `@ai-sdk/*`).
2. URL literals with any `scheme://` (https, wss and others) whose host is a registered provider host, ignoring case and one trailing dot; and template URLs whose literal head contains the whole host followed by `/`, `?` or `#`.
3. The first string-literal argument of a declared model-constructor call (`gateway`, `gateway.languageModel`) whose prefix, in any case, resolves to a registered provider.

Which files are looked at:

- Only the TypeScript and JavaScript extensions above are analyzed.
- These types are never scanned (an allowlist of non-code files): `.md` `.markdown` `.txt` `.rst` `.json` `.jsonc` `.yaml` `.yml` `.toml` `.ini` `.cfg` `.conf` `.env` `.lock` `.log` `.csv` `.tsv` `.xml` `.svg` `.png` `.jpg` `.jpeg` `.gif` `.webp` `.avif` `.ico` `.bmp` `.tiff` `.woff` `.woff2` `.ttf` `.otf` `.eot` `.pdf` `.zip` `.gz` `.tar` `.tgz` `.map` `.css` `.scss` `.sass` `.less` `.sql` `.graphql` `.gql` `.prisma`, the suffix-like `.local` `.example` `.sample` `.template` `.dist` (so `.env.local` is skipped), and the compiled and media types `.wasm` `.node` `.so` `.dll` `.dylib` `.exe` `.bin` `.jar` `.class` `.o` `.a` `.pyc` `.db` `.sqlite` `.sqlite3` `.mp3` `.mp4` `.mov` `.webm` `.ogg` `.wav` `.flac` `.avi` `.psd` `.icns` `.heic`. Their size, readability and content do not matter. The list lives in one place, `IGNORABLE_EXT` in `src/evaluator/evaluate.ts`.
- Every other extension (`.py`, `.ps1`, `.coffee`, `.vue`, `.svelte`, ...) makes the file `unknown` (`unsupported-language`, or `unreadable` if its content is binary), so an unlisted language can never read as a pass. An extensionless file is `unknown` only if it starts with `#!` (after an optional BOM); `Makefile`, `LICENSE` and dotfiles such as `.env` are skipped.
- Binary content (a NUL byte in the first 8 KiB, which includes UTF-16 text) is never analyzed. It is skipped for never-scanned types and for files with no extension; under any other extension (`.ts`, `.sh`, `.py`, `.ps1`, ...) the file is `unknown` (`unreadable`), because it may be a script. An extensionless file over the size cap is `unknown` (`too-large`) since it is never read; this is deliberately conservative.
- A symlink is `unknown` whatever its name. A file over the 1 MiB cap or unreadable is `unknown` unless its type is on the never-scanned list.

A registry in the card maps package, host and model prefix to a provider ID; the allowlist is a set of those IDs. Exclusions (`.git` at any depth, plus the card's `node_modules`, `.next`, `dist` and lockfiles) are recorded in every report.

It does not check, and the card lists these as non-claims: which provider receives data at runtime, provider conduct, retention or training use, dead code, proxy rerouting, or whether the allowlist matches the signed agreement.

False-negative classes (full list in `policies/unapproved-provider-reference.v1.json`): providers missing from the registry; dynamic specifiers (`require(name)`); model identifiers held in variables or environment files; wrapper modules hiding the real provider; URLs built by concatenation or template literals; hosts without a scheme or as subdomains; model IDs passed anywhere but the first literal argument of a declared constructor; aliased constructors; code inside never-scanned file types; `createRequire(...)('openai')`; `declare module 'openai'`; tagged-template constructor calls; test mocks such as `vi.mock('openai')`; path or bundler aliases that rename a package; anything inside a `.git` directory. Known false positives: provider imports in test-only or never-executed code.

## Trust model

- Result files carry a SHA-256 checksum, not a signature. Anyone who can edit a result can recompute the hash. Consistency checks reject results whose state contradicts their findings, but a careful forgery is possible. Signing is future work.
- Text from scanned repositories and agreements is untrusted. It is escaped before it reaches the terminal (control and escape characters are neutralized) and before it reaches Markdown tables.
- The store (content-addressed blobs and a hash-chained audit log) must live outside the scanned repo, so a scan cannot read or modify its own records. The CLI refuses otherwise.
- Every store call carries a tenant ID; one tenant cannot read another's blobs or audit entries.
- The scan reads files without following symlinks and does not execute anything in the repo. The engine source imports no network or child-process modules; a test stubs `net`, `http` and `dns` during a scan. Real egress denial is deferred to a container runner.
- Determinism: line endings are normalized before hashing, timestamps and operator identity sit outside the hashed body, and the same inputs give the same result hash across runs, file orders and absolute paths.

## Layout of `engine/src`

```
cli.ts         command-line entry: confirm, scan, report, diff, audit
workflow.ts    confirm and scan orchestration, audit recording, exit codes
scan.ts        snapshot + evaluator -> canonical result
terminal.ts    output escaping
schema/        result types, invariants, canonical JSON, hashing
snapshot/      read-only tree walk: per-file SHA-256, tree hash, size cap
agreement/     Markdown ingest, normalized text, hashes
obligation/    the confirmed obligation record and quote location
policy/        policy card loading and validation
evaluator/     TypeScript-compiler-API rule evaluation
report/        Markdown report and rerun delta
store/         BlobStore and AuditLog interfaces, filesystem adapters
```

Other directories: `engine/policies/` (the card), `engine/fixtures/` (synthetic agreement, `mutated` and `fixed` repos), `engine/test/`, `engine/scripts/` (source manifest tooling).

## Documents

- Spec: [`docs/superpowers/specs/2026-10-13-curb-v1-vertical-slice-design.md`](../docs/superpowers/specs/2026-10-13-curb-v1-vertical-slice-design.md)
- Plan: [`docs/superpowers/plans/2026-10-13-curb-v1-vertical-slice.md`](../docs/superpowers/plans/2026-10-13-curb-v1-vertical-slice.md)
- Charter: [`docs/curb/charter.md`](../docs/curb/charter.md)
- Threat model: [`docs/curb/threat-model-v1.md`](../docs/curb/threat-model-v1.md)
- ADR 001, result schema and hashing: [`docs/curb/adr-001-result-schema.md`](../docs/curb/adr-001-result-schema.md)
- Prototype audit: [`docs/curb/prototype-audit.md`](../docs/curb/prototype-audit.md)
- Source manifest: [`docs/curb/source-manifest.md`](../docs/curb/source-manifest.md)
- Policy card template: [`docs/curb/policy-card-template.md`](../docs/curb/policy-card-template.md)
- Original product plan: [`test_plan`](../test_plan)

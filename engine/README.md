# Curb engine

A TypeScript library and CLI that checks one human-confirmed contract commitment against a local source tree, using one deterministic rule. It produces evidence (file, line, hash), a Markdown or JSON report, and a delta between two runs. No LLM and no network access are involved in the verdict.

Current rule: `unapproved-provider-reference` version 1.3.0, evaluator 0.5.0 (is any AI model provider referenced in TypeScript or JavaScript source that is not on the customer's allowlist).

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
npm test            # vitest, 364 tests
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

The obligation id is `18f764e1ca82bd7a2631e9fdb341a73770f3a2f72de1425119e7135e2eb83c2e`; the quote sits at range 384 to 490 of the normalized agreement text.

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
result sha256:48751d9e670a0fc5ff33379c92417d61adfde44d3bb0e041b4ca6f29bc025da6
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
result sha256:22ff719e2859b58ba8c9bf735bb50eb077b44a8a6373771e5b518955ef9fccc8
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

Rule: `unapproved-provider-reference` v`1.3.0`. Files evaluated: 2.
...
| Provider | Location | Excerpt | Finding ID |
|---|---|---|---|
| `openai` | `lib/ai/providers.ts:2:24` | `import { openai } from '@ai-sdk/openai';` | `04edcb8a7d76` |
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
| `unknown` | Something could not be checked and nothing failed: a non-excluded file is a symlink, unparseable, generated, minified or catalog-shaped (a list of bare model ids), of a file type that is neither analyzed nor on the ignorable list, or over the size cap; or no file could be evaluated (note `no-evaluable-files`). Affected files are listed. | at least one unknown file, or the note `no-evaluable-files` |
| `not-applicable` | A named human recorded applicability `not-applicable` on the obligation. The evaluator never returns this state; the scan skips evaluation and notes `human-recorded-not-applicable`. | no findings, no unknown files, zero files evaluated |
| `error` | The evaluator threw outside per-file analysis (a failure inside one file makes that file `unknown`). Not a verdict and never a pass. The exception text goes to stderr only, not into the result file. V1 has no evaluator timeout; the per-file size cap bounds work. | no findings, zero files evaluated |

`report` refuses a `not-applicable` result for an obligation that applies, and a verdict for an obligation recorded as not-applicable. Reasoning: `docs/curb/adr-001-result-schema.md`.

## What the evaluator checks

Using the TypeScript compiler API on `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts` and `.cts` files (extension matched case-insensitively, declaration files included), it flags:

1. Import, `require`, `require.resolve`, dynamic `import()` and import-type (`typeof import('openai')`, `import('openai').T`) specifiers of registered provider packages (for example `openai`, `@anthropic-ai/sdk`, `@ai-sdk/openai`; each package is listed by name, so `@ai-sdk/react` is not a provider).
2. URL literals with any `scheme://` (https, wss and others) whose host is a registered provider host, ignoring case and one trailing dot; and template URLs whose literal head contains the whole host followed by `/`, `?` or `#`.
3. The first string-literal argument of a declared model-constructor call (`gateway`, `gateway.languageModel`) whose prefix, in any case, resolves to a registered provider.
4. Model-identifier literals anywhere in source (since card 1.1.0): a string literal or no-substitution template whose whole text is `<prefix>/<slug>`, where the prefix (any case) is a registered gateway prefix, the slug is `[a-z0-9][a-z0-9._:-]*` with no further `/`, and the slug contains a digit or hyphen. This catches catalogs such as `{ id: "openai/gpt-5-mini" }` that reach a constructor through a variable. `google/fonts` and `meta/robots` are not flagged (no digit or hyphen). Module names in imports, `require`, `import()`, import types and `declare module` are left to rule 1, object, interface, destructuring and computed keys are skipped, and a literal that is also a declared-constructor argument is reported once, by rule 3.
5. Provider assignments (since card 1.3.0): a string literal assigned to a name that ends in `provider` or `providerId` (ignoring case and separators: `provider`, `modelProvider`, `LLM_PROVIDER`, `llm-provider`) and equals a registered provider ID. Targets are object properties, class fields, JSX attributes, variable declarations, parameter defaults and assignments (`=`, `||=`, `??=`, `&&=`, `x.provider`, `x["provider"]`), looking through `as`, `satisfies`, parentheses, `!`, `<const>`, `??`, `||`, `&&` (right side only) and the branches of a ternary. Not examined: shorthand `{ provider }`, values from variables, comparisons, `switch` cases, enum values, arrays of names. Login and UI choices (`signInWithOAuth({ provider: "google" })`, `<AuthButton provider="azure" />`) and cloud, identity or framework names (`cloudProvider: "azure"`, `identityProvider: "google"`, `dataProvider: "groq"`) are flagged too; the card lists them as known false positives.

Which files are looked at:

- Only the TypeScript and JavaScript extensions above are analyzed.
- These types are never scanned (an allowlist of non-code files): `.md` `.markdown` `.txt` `.rst` `.json` `.jsonc` `.yaml` `.yml` `.toml` `.ini` `.cfg` `.conf` `.env` `.lock` `.log` `.csv` `.tsv` `.xml` `.svg` `.png` `.jpg` `.jpeg` `.gif` `.webp` `.avif` `.ico` `.bmp` `.tiff` `.woff` `.woff2` `.ttf` `.otf` `.eot` `.pdf` `.zip` `.gz` `.tar` `.tgz` `.map` `.css` `.scss` `.sass` `.less` `.sql` `.graphql` `.gql` `.prisma` `.mdc`, the suffix-like `.local` `.example` `.sample` `.template` `.dist` (so `.env.local` is skipped), and the compiled and media types `.wasm` `.node` `.so` `.dll` `.dylib` `.exe` `.bin` `.jar` `.class` `.o` `.a` `.pyc` `.db` `.sqlite` `.sqlite3` `.mp3` `.mp4` `.mov` `.webm` `.ogg` `.wav` `.flac` `.avi` `.psd` `.icns` `.heic`. Their size, readability and content do not matter. The list lives in one place, `IGNORABLE_EXT` in `src/evaluator/evaluate.ts`.
- Every other extension (`.py`, `.ps1`, `.coffee`, `.vue`, `.svelte`, ...) makes the file `unknown` (`unsupported-language`, or `unreadable` if its content is binary), so an unlisted language can never read as a pass. An extensionless file is `unknown` only if it starts with `#!` (after an optional BOM); `Makefile`, `LICENSE` and dotfiles such as `.env` are skipped.
- Binary content (a NUL byte in the first 8 KiB, which includes UTF-16 text) is never analyzed. It is skipped for never-scanned types and for files with no extension; under any other extension (`.ts`, `.sh`, `.py`, `.ps1`, ...) the file is `unknown` (`unreadable`), because it may be a script. An extensionless file over the size cap is `unknown` (`too-large`) since it is never read; this is deliberately conservative.
- A symlink is `unknown` whatever its name. A file over the 1 MiB cap or unreadable is `unknown` unless its type is on the never-scanned list.
- A file is `unknown` (`minified`) when its name ends in `.min.js`, `.min.mjs` or `.min.cjs`, or when more than half of its bytes sit in lines longer than 1000 characters. In a `.tsx` or `.jsx` file, single-line JSX attribute strings (such as SVG `d="..."` path data) do not count towards that share, so a small icon component is evaluated; every other string still counts. One long line (an SVG path or a long class string) in an otherwise ordinary file does not make it minified. A file whose first five lines say `@generated`, `auto-generated` or `do not edit` is `unknown` (`generated`).
- A file is `unknown` (`catalog`) when at least 6 of its string values are bare model ids from known families (for example `llama3-8b-8192`) and they make up at least 20% of its string literals. Keys, type literals and module specifiers count towards neither side of the share. The file is still scanned and can still produce findings; the reason is listed in addition. The thresholds rest on one real repository.

A registry in the card maps package, host and model prefix to a provider ID; the allowlist is a set of those IDs. Card 1.3.0 registers 22 provider IDs: alibaba, amazon, anthropic, azure, bedrock, cohere, deepinfra, deepseek, fireworks, google, groq, meta, minimax, mistral, moonshotai, nvidia, openai, openrouter, perplexity, togetherai, xai, zai. Some (bedrock, fireworks, deepinfra, groq, togetherai, azure) are known only by package or host, not by gateway prefix. Exclusions (`.git` at any depth, plus the card's `node_modules`, `.next`, `dist` and lockfiles) are recorded in every report.

It does not check, and the card lists these as non-claims: which provider receives data at runtime, provider conduct, retention or training use, dead code, proxy rerouting, or whether the allowlist matches the signed agreement.

False-negative classes (full list in `policies/unapproved-provider-reference.v1.json`): providers missing from the registry, including model-id literals with an unregistered prefix; dynamic specifiers (`require(name)`); model identifiers assembled at runtime, read from environment or config files, or built from non-literals; model-id literals whose slug has no digit or hyphen; provider names held as bare strings (arrays such as `gatewayOrder: ["fireworks", "bedrock"]`, `providerOptions` keys, display-name maps); wrapper modules hiding the real provider, including the Vercel AI Gateway host `ai-gateway.vercel.sh`, which is a proxy, not a provider; URLs built by concatenation or template literals; hosts without a scheme or as subdomains; template literals with substitutions passed to constructors, aliases or tagged templates; code inside never-scanned file types; `createRequire(...)('openai')`; `declare module 'openai'`; test mocks such as `vi.mock('openai')`; path or bundler aliases that rename a package; anything inside a `.git` directory. Known false positives: provider imports in test-only or never-executed code.

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

Other directories: `engine/policies/` (the card), `engine/fixtures/` (synthetic agreement, `mutated`, `fixed` and `catalog` repos), `engine/test/`, `engine/scripts/` (source manifest tooling).

## Documents

- Spec: [`docs/superpowers/specs/2026-10-13-curb-v1-vertical-slice-design.md`](../docs/superpowers/specs/2026-10-13-curb-v1-vertical-slice-design.md)
- Plan: [`docs/superpowers/plans/2026-10-13-curb-v1-vertical-slice.md`](../docs/superpowers/plans/2026-10-13-curb-v1-vertical-slice.md)
- Charter: [`docs/curb/charter.md`](../docs/curb/charter.md)
- Threat model: [`docs/curb/threat-model-v1.md`](../docs/curb/threat-model-v1.md)
- ADR 001, result schema and hashing: [`docs/curb/adr-001-result-schema.md`](../docs/curb/adr-001-result-schema.md)
- Prototype audit: [`docs/curb/prototype-audit.md`](../docs/curb/prototype-audit.md)
- Source manifest: [`docs/curb/source-manifest.md`](../docs/curb/source-manifest.md)
- First real-repository measurement: [`docs/curb/real-repo-measurement-001.md`](../docs/curb/real-repo-measurement-001.md)
- Policy card template: [`docs/curb/policy-card-template.md`](../docs/curb/policy-card-template.md)
- Original product plan: [`test_plan`](../test_plan)

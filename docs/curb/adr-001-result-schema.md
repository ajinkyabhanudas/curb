Status: DRAFT, unsigned. Needs technical owner sign-off.

# ADR 001: Result schema and hashing

Date: 2026-10-14. Applies to `engine/src/schema/*`, `engine/src/scan.ts`, `engine/src/evaluator/evaluate.ts`.

## Context

A Curb verdict will be read by a developer and possibly by a lawyer. It must be reproducible (same inputs, same bytes) and auditable (every input is named by hash). A verdict that hides what could not be checked, or that changes with the clock or the machine, cannot support either use.

## Decision

### Five states and precedence

`pass`, `fail`, `unknown`, `not-applicable`, `error`. For an evaluated scan the precedence is `error > fail > unknown > pass`. In code: an evaluator exception outside per-file analysis gives `error` (an exception while parsing or walking one file marks only that file `unknown` with reason `parse-error`, so `error` is reachable only outside per-file analysis); otherwise any finding gives `fail`; otherwise any unknown file gives `unknown`; otherwise zero evaluated files gives `unknown` with the note `no-evaluable-files`; otherwise `pass`. `pass` is scope-limited evidence, never compliance.

### State invariants

A state must be consistent with the evidence in the same body. `parseResultFile` enforces:

| State | Required |
|---|---|
| pass | no findings, no unknown files, at least one file evaluated |
| fail | at least one finding |
| unknown | at least one unknown file, or the note `no-evaluable-files` |
| not-applicable | no findings, no unknown files, zero files evaluated |
| error | no findings, zero files evaluated |

This stops a re-hashed forgery from claiming PASS while listing findings.

### Hashed body versus envelope

The result file has a `body` and an `envelope`. The result hash is `sha256(canonical(body))`. The body holds schema version, rule id and version, evaluator version, policy-card hash, tree hash, agreement hash, obligation hash, state, findings, unknown files, files evaluated, exclusions and notes. `exclusions` always lists `dir:.git` (the snapshot skips `.git` at any depth) alongside the card's directory and file exclusions, sorted. Timestamps, operator and tenant id live in the envelope, outside the hash. Evaluator diagnostics (exception text) are printed to stderr and never enter the file or the hash.

### Canonical JSON

`canonicalize` sorts object keys recursively (code-unit order), drops `undefined` members, and throws on anything it cannot represent identically: non-integer numbers, unsafe integers, NaN, Infinity, bigint, `undefined` in arrays, and any non-plain object (Date, Map, class instances). Only plain objects (and null-prototype objects) are accepted. Own `__proto__` keys are kept via `defineProperty`. Paths are relative with `/` separators.

### Newline normalization

CRLF and lone CR become LF before hashing and evaluation (`normalizeNewlines`). Offsets are UTF-16 code units of the normalized text. A file's `sha256` is the hash of the normalized text. The snapshot size cap applies to the normalized size, so CRLF and LF forms of a file get the same verdict. Binary files are hashed raw and never normalized. Text is decoded as UTF-8, and invalid UTF-8 sequences decode to U+FFFD replacement characters, so two different non-UTF-8 files can share a content hash. The verdict is unaffected: such files decode to the same text, which is all the evaluator sees.

### Finding id

`findingId = sha256(canonical({ ruleId, ruleVersion, path, start, end, matched }))`. It does not include line, column, excerpt or file hash. The same reference at the same offset in the same file gets the same id across runs; the id is recomputed when a result file is verified.

### evaluatorVersion

`<EVALUATOR_VERSION>+typescript-<ts.version>`, for example `0.5.0+typescript-5.9.3`. The TypeScript compiler decides parse-error verdicts, so a compiler upgrade can change results and therefore changes the hash. `diff` refuses to compare results across evaluator versions.

Evaluator version history:

- `0.1.0`: first vertical slice (imports, URL literals, declared-constructor arguments).
- `0.2.0`: detection and the file-type rule changed in the final review (any URL scheme, template heads, `require.resolve`, import types, an allowlist of never-scanned types, every other type `unknown`).
- `0.3.0`: model-identifier literals anywhere in source are flagged (card 1.1.0); a file is `minified` only when more than half its bytes sit in lines over 1000 characters, or by `.min.js` name, instead of whenever any one line is that long; `.mdc` is never scanned. Driven by the first real-repository measurement (`docs/curb/real-repo-measurement-001.md`).
- `0.4.0` (CURB-21): in a `.tsx` or `.jsx` file, single-line JSX attribute strings do not count towards the long-line share, so small SVG icon components are no longer `minified`. Other strings still count; `.min.js` names and all other file types are unchanged. Found by the second real-repository measurement (`docs/curb/real-repo-measurement-002.md`). The policy card is unchanged (1.2.0).
- `0.5.0` (CURB-19, card 1.3.0): the string value of a provider-named property (`provider`, `providerId`, `provider_id`, `*_provider`) that is a registered provider id is a finding; a new unknown reason `catalog` marks a file holding at least 6 bare model-id values that make up at least 20% of its string literals (the file is still scanned). Found by the false-pass probe in `docs/curb/real-repo-measurement-002.md`.

### Obligation time

`approvedAt` is part of the obligation, so it is part of the obligation hash, so it reaches the result hash. `curb confirm` defaults it to the current time unless `--at` is passed. A reproducible demo must pass `--at`.

### Why `not-applicable` is human-only

The evaluator never returns `not-applicable`. It appears only when a named human records applicability `not-applicable` on the obligation; the scan then skips evaluation and notes `human-recorded-not-applicable`. Letting code decide that a commitment does not apply would move a legal judgement, and its accountability, into software. `report` also refuses a `not-applicable` result for an obligation that applies, and a verdict for an obligation recorded as not-applicable.

### Why `error` exits 3 while verdicts exit 0

`error` means the evaluator failed; it is not a verdict and must not be read as a pass. The CLI exits 0 for pass, fail, unknown and not-applicable, because a finding is a successful run with a result, and the result is in the output. It exits 3 only for `error`, so scripts cannot confuse a crash with a clean run. Exit 2 is reserved for usage errors, refusals and a corrupt audit chain.

## Rejected alternatives

- Boolean pass/fail. Hides `unknown`: a file that could not be parsed would read as clean.
- Timestamps inside the hashed body. Two runs of the same inputs would hash differently, which breaks reproducibility checks.
- Evaluator-emitted `not-applicable`. Moves human accountability into code (see above).
- Hashing raw file bytes. Line-ending differences would change tree and result hashes for identical content; the hash covers normalized text.
- Floats and non-plain objects in canonical JSON. They have several textual forms or no stable one.

## Consequences

- Moved or renamed code shows as one finding fixed and one added, because the finding id includes path and offsets. Rerun deltas report it that way.
- Any change to the TypeScript version, card text, obligation or tree changes the result hash. That is intended.
- A guard is needed so nobody changes the hash to cover raw bytes; the CRLF/LF determinism tests (`determinism.test.ts`, `snapshot-cap.test.ts`) are that guard.
- The result hash is a checksum, not a signature. Anyone who can edit a result can recompute the hash and the finding ids. State invariants catch inconsistent forgeries only. Signing is future work.

## Known discrepancies

- The spec (section 5) describes evidence ranges and finding ids as "byte range". The code uses UTF-16 code-unit offsets into the normalized text (`engine/src/schema/types.ts`). This ADR follows the code.
- The spec says `error` "never blocks anything". The CLI exits 3 on `error`. This ADR follows the CLI.

Sign-off: ______________________ (name, role, date)

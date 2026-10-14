# Curb V1 Sub-project 1: vertical slice (engine)

Date: 2026-10-13. Status: draft for review. Source plan: `test_plan` (Phases 0 and 1).
Not legal advice or a compliance certification.

## 1. Purpose and scope

Build a TypeScript engine and CLI that takes a confirmed contract commitment, scans a pinned repository snapshot with one deterministic rule, and emits evidence, a report and a rerun delta.

In scope: plan Phase 0 (charter, source capture, prototype audit, one policy card) and Phase 1 (snapshot, agreement ingest, obligation record, one evaluator, report, rerun).

Out of scope for this sub-project, each getting its own spec later: Curb Bench harness (Phase 2), PDF/DOCX/LLM intake (Phase 3), GitHub App and CI (Phase 4), production hardening and pilots (Phase 5), Postgres/queue/object store, any UI.

Success (Phase 1 exit): synthetic agreement -> confirmed obligation -> deterministic finding on a mutated fixture -> seeded fix -> rerun -> delta report. Same inputs give byte-identical canonical JSON. No LLM is used or permitted anywhere in the verdict path.

## 2. Milestones

| ID | Deliverable |
|---|---|
| M1 | `curb scan` on a fixture with a seeded mutation prints FAIL with file:line evidence and a stable result hash. Needs schema, snapshot, evaluator, minimal obligation record. |
| M2 | Full loop: agreement fixture, confirm, scan, Markdown/JSON report (scope and non-claims first), seeded fix, rerun, delta. This is the sub-project exit. |
| M3 (follow-on, decided after M2) | Reviewer page in the existing Next app rendering the report and the side-by-side confirm step. No engine rework. |

The implementation plan sequences tasks as vertical slices so M1 appears first. M1 uses a small synthetic TS repo until the Vercel Chatbot SHA and license are captured (needs network).

## 3. Prototype decision

Audit of `frontend/` (client-only Next 16 / React 19 form-to-PDF app; no backend, database, auth, uploads or deployed environment; no secrets or customer data found in listed files, secret scan still to run).

- Assessment engine, requirement maps, PDF export: archive as a tagged read-only reference (`prototype-form-to-pdf`). Not extended as the core.
- Next/Tailwind shell: retain; candidate for M3 behind an adapter.
- `templates/` and `catalog.json`: retain with the existing CC BY 4.0 attribution.
- New code lives in `engine/`. No irreversible change to existing files.

## 4. Architecture

`engine/` is a TypeScript package with a CLI. The core is pure functions. Storage and identity sit behind interfaces.

```
engine/src/
  schema/      result states, Finding, Evidence, RunManifest, canonical JSON
  snapshot/    read-only tree walk of a local path: per-file SHA-256, tree hash, language inventory
  agreement/   Markdown ingest, offset-preserving text, SHA-256, immutable raw copy
  obligation/  quote + range + policy card + applicability + approver + time (+ exception)
  policy/      versioned policy cards; unapproved-provider-reference v1
  evaluator/   TypeScript compiler API rule evaluation
  report/      JSON + Markdown from approved inputs only
  store/       BlobStore, AuditLog, TenantContext interfaces + filesystem adapters
  cli.ts       curb confirm | scan | report | diff   (snapshot and ingest run inside confirm and scan)
engine/fixtures/   synthetic agreement, mini TS repo, seeded mutations, malicious-fixture repo
```

Flow: `snapshot + agreement -> confirm (human record) -> scan (policy card + evaluator version) -> canonical result -> report`. A rerun on a new snapshot produces a delta: fixed, new, unchanged.

Deviation from the plan: no Postgres, queue or object store in Phase 1. A content-addressed filesystem `BlobStore` and an append-only hash-chained JSONL `AuditLog` satisfy the exit criteria. Reversible: later adapters implement the same interfaces.

Enforced by types and checks:
- `scan` refuses to run without a confirmed obligation linked to an agreement hash.
- Evaluator output is `pass` only when all card preconditions hold.
- The evaluator receives no case names or oracle files.
- Every store call requires a `TenantContext`.

## 5. Result semantics

States: `pass`, `fail`, `unknown`, `not-applicable`, `error`. Overall precedence: `error > fail > unknown > pass`.

- `pass`: every in-scope file parsed, at least one file evaluated, zero references outside the allowlist. Scope-limited evidence, never legal compliance.
- `fail`: at least one reference to a provider outside the allowlist; one finding per occurrence.
- `unknown`: any non-excluded file is unparseable, generated or minified, in an unsupported language, or over the size cap, and there is no `fail`. Affected files listed in evidence.
- `error`: evaluator exception. Never a verdict; never treated as pass; never blocks anything. Timeouts are deferred to the Phase 2 runner; V1 is bounded by the per-file size cap.
- `not-applicable`: never emitted by the evaluator. Comes only from the human applicability answer on the obligation.

Finding ID: `sha256(rule id, rule version, relative path, byte range, matched value)`. Evidence: relative path, file SHA-256, byte range, line and column, short excerpt, trigger reason.

Text files are line-ending normalized (CRLF and CR to LF) before hashing and evaluation, and offsets are UTF-16 code units of the normalized text. Canonical JSON: sorted keys, UTF-8, LF, integers only, defined array sort keys, relative paths. Timestamps and operator identity live in a run envelope outside the hashed body. The result hash is the SHA-256 of the body, which includes the tree, agreement, obligation, policy-card and evaluator-version hashes.

## 6. Policy card: `unapproved-provider-reference` v1

Flags:
1. Import/require specifiers of known provider packages (e.g. `openai`, `@anthropic-ai/sdk`, `@ai-sdk/*`).
2. URL literals whose host is in the provider registry.
3. String-literal arguments to a declared list of model-constructor calls.

A versioned registry in the card maps package, host and model prefix to a normalized provider ID. The customer allowlist is a set of those IDs. Providers not in the registry are not flagged (documented false-negative risk).

Default exclusions: `node_modules`, lockfiles, build output (`.next`, `dist`). Recorded in every report.

Non-claims: dead code, proxy rerouting, runtime network destination, provider conduct, whether the allowlist matches the contract.

Card fields (per plan section 7): approved text patterns, interpretation, contextual facts, prerequisites, false-positive examples, false-negative risks, evidence boundaries, severity, owner, review date, test cases. Status ships as `draft, pending counsel approval`; the status prints at the top of every report until a human changes it.

## 7. Tests

Runner: vitest.

- Unit: canonical JSON, hashes and offsets, quote equals `text[range]`, audit hash chain, tamper detection.
- Evaluator cases: positive, negative, near-miss (name in comment, string or variable), irrelevant lookalike, parse failure, minified/generated, unsupported language.
- Determinism: run twice; shuffle file order; CRLF vs LF; different absolute path. All give identical result hash.
- Malicious fixture: escaping symlink, path-traversal names, oversized file, `postinstall` scripts, `.git` hooks. Snapshot reads without following symlinks or executing; oversized files become `unknown`.
- No-network: `net`, `http`, `dns` stubbed to throw during scan. Real egress denial is a container concern deferred to Phase 2.
- Tenant isolation: tenant A cannot read tenant B blobs or audit entries.
- Golden report test.
- Seeded-fix loop: mutation fails, fix passes, delta shows exactly one finding fixed.

Debugging policy: any failing test goes through systematic-debugging before a fix; no patch-and-retry.

## 8. Phase 0 artifacts (in `docs/curb/`)

Charter, `source-manifest.json` (pinned Vercel Chatbot SHA, license, NOTICE, lockfile hash, retrieval time), prototype audit table, ADR for the result schema, policy-card template plus the card above, threat model v1.

Human gates: named owners, policy-card approval, and source/license review are decisions for the product owner or counsel. These documents are drafted unsigned and say so.

## 9. Risks

- Provider registry coverage drives false negatives; documented, not hidden.
- TypeScript compiler API parse cost on large repos; size caps yield `unknown`, performance measured at M2.
- A draft policy card means no M2 report can be presented as counsel-approved.
- The Vercel fixture needs network access and license review before redistribution.

## 10. Open items

- Branch name and branch-off point (new branch from `main`).
- M3 go/no-go, decided after M2.

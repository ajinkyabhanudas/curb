Status: DRAFT, unsigned. Needs product owner sign-off.

# Curb V1 charter

Curb is not legal advice and does not certify compliance.

## Target user

A developer who has been asked to substantiate an AI or data-handling commitment in a customer agreement against a code repository. Secondary user: a legal reviewer who confirms what the agreement text commits to.

## Single workflow

Confirm obligation, scan, evidence, fix, rerun.

1. A named human confirms an obligation: exact quote and range from the agreement text, a policy card, applicability, and an allowlist.
2. `curb scan` evaluates one pinned local snapshot with one deterministic rule.
3. The report shows the evidence for each finding, plus unknown files and non-claims.
4. A developer fixes the code.
5. A rerun produces a delta against the earlier result.

## Supported repository type

TypeScript and JavaScript. Static analysis of a local snapshot only. Only TypeScript and JavaScript files are analyzed; a fixed list of non-code file types (docs, data, config, images, fonts, archives, styles, SQL, GraphQL, compiled and media artifacts; `IGNORABLE_EXT` in `engine/src/evaluator/evaluate.ts`) is not scanned; every other file type, including other languages, embedding formats and binary or UTF-16 content under those extensions, yields `unknown`, never `pass`.

## Non-claims

From the shipped policy card (`unapproved-provider-reference` 1.3.0):

- Does not establish which provider receives data at runtime.
- Does not establish provider conduct, retention or training use.
- Does not detect dead code or proxy rerouting.
- Does not establish that the allowlist matches the signed agreement; a named human confirms that.
- Is not legal advice or a compliance certification.

Added by this charter: Curb is not a runtime monitor.

## Success hypotheses

These are hypotheses to test, not results.

- H1: the M2 loop (confirm, scan, report, seeded fix, rerun, delta) works end to end on the synthetic fixtures and on one pinned real repository. Status: a first real-repository measurement is done, against a synthetic obligation, on `vercel/chatbot` at `c2f8235e1f3ea903ad8b7f61447c4f74164b5c58` (`real-repo-measurement-001.md`). Confirm and scan ran end to end and reproduced the same hash on rerun; the seeded-fix and delta half of the loop was exercised on synthetic fixtures only. The first scan found a false-pass gap (model ids held in a catalog) and three false `minified` verdicts, both fixed in card 1.1.0 and evaluator 0.3.0. This is still one repository: 4 unknown files out of 156 before the fix and 0 after is an observation on that repository, not an `unknown` rate.
- H2: across the unsupported, ambiguous and near-miss cases in scope, the engine produces zero false passes (an unsupported case must give `unknown`, not `pass`).
- H3: the same inputs give the same result hash on repeated runs and on different machines. Today the determinism tests vary path, line endings, file creation order, actor and clock on one machine only; cross-machine reproduction is untested.

What exists today: H1 and the single-machine part of H3 are exercised on synthetic fixtures by the engine test suite, and one real repository, `vercel/chatbot` (see `source-manifest.md`), has been scanned from a local read-only clone (`real-repo-measurement-001.md`). Nothing from it is copied into this repository; its licence question for redistribution is still open.

## Owners

| Role | Owner |
|---|---|
| Product | unassigned, to be named |
| Technical | unassigned, to be named |
| Security | unassigned, to be named |
| Legal/policy | unassigned, to be named |

## Stop conditions

Stop work on a scan, report or release if either holds:

- There is no authority over the source (repository or agreement) being used.
- There is no human owner to approve the obligation.

## Human gates still open

Nothing below has been done. Each needs a named human.

1. Named owners for Product, Technical, Security and Legal/policy.
2. Counsel approval of the `unapproved-provider-reference` policy card (it ships as `draft, pending counsel approval`).
3. Source and licence review of the `vercel/chatbot` fixture source before any copy or redistribution.
4. Security review of the engine and its threat model before any production tenant is onboarded.

## Signatures

| Role | Name | Date | Signature |
|---|---|---|---|
| Product | | | |
| Technical | | | |
| Security | | | |
| Legal/policy | | | |

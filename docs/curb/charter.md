Status: DRAFT v2, unsigned. Needs product owner sign-off. Replaces the V1 charter (single confirm-and-scan workflow). Scope below follows `docs/discovery/prd-draft.md`; where they disagree, resolve it before signing.

# Curb charter

Curb is not legal advice and does not certify compliance.

## Target user

Primary: a builder who owns product decisions on an AI-enabled product, works alone or in a very small team, and knows their code better than privacy, AI-governance or procurement terms. First user and first validator: the product owner, on their own projects.

Secondary: a reviewer (a customer's security reviewer, or counsel) who receives the evidence pack and does not operate the tool.

Earlier charter target, kept as a supported case: a developer asked to substantiate an AI or data-handling commitment in a customer agreement against a repository.

## Modes

One local CLI with a shared evidence model and three modes.

1. **Claim.** A named human confirms a claim: an exact quote and where it was made, an owner, a policy card, applicability and an allowlist. `curb scan` evaluates one pinned local snapshot with one deterministic rule. The report shows evidence per finding, unknown files and non-claims. A rerun produces a delta. This is the shipped engine.
2. **Discover** (not built). An observe-only scan, with no obligation, lists what the repo shows (providers, hosts, model ids, dependencies) and what it could not scan. A versioned, owned question bank maps those signals to ranked questions. The user answers, says "I don't know", or marks not applicable. An answer can become a claim for Claim mode.
3. **Controls** (not built). `curb controls` runs deterministic checks that the build controls the user says they follow are in force. Each reports pass, fail or unknown from a script or exit code.

All modes can produce one evidence pack: Markdown canonical, PDF derived from the same model.

## Evidence model

Every statement carries one class: `observed`, `declared`, `external_evidence`, `derived`, `question`, `reviewed` (a named human recorded a conclusion) or `unknown`. A declaration or uploaded document never becomes an observed fact.

## Supported repository type

TypeScript and JavaScript. Static analysis of a local snapshot only. Only TypeScript and JavaScript files are analyzed; a fixed list of non-code file types (docs, data, config, images, fonts, archives, styles, SQL, GraphQL, compiled and media artifacts; `IGNORABLE_EXT` in `engine/src/evaluator/evaluate.ts`) is not scanned; every other file type, including other languages, embedding formats and binary or UTF-16 content under those extensions, yields `unknown`, never `pass`.

## Non-claims

From the shipped policy card (`unapproved-provider-reference` 1.3.0):

- Does not establish which provider receives data at runtime.
- Does not establish provider conduct, retention or training use.
- Does not detect dead code or proxy rerouting.
- Does not establish that the allowlist matches the signed agreement; a named human confirms that.
- Is not legal advice or a compliance certification.

Added by this charter:

- Curb is not a runtime monitor.
- Not found in the scanned scope is not does not exist. Every output says what was and was not scanned.
- A question is a prompt for a decision or evidence. It is not a finding and not a statement that a problem exists.
- The question bank is a curated judgement about what matters, not a legal or regulatory determination.
- A controls check that passes means the check ran and exited cleanly. It does not mean the control is adequate.

## Invariants

- No LLM in any verdict, ranking or suppression.
- `unknown` is never turned into `pass`. A missing source, parse failure or unsupported pattern gives `unknown`.
- Text found in a scanned repository (comments, READMEs, strings) is data, never proof or instruction.
- Output does not use "compliant", "legal", "safe" or "verified" without a defined authority.
- Scanned code is never executed.
- A capability is not done until it is wired into the live path and tested.

## Success hypotheses

These are hypotheses to test, not results.

- H1: the M2 loop (confirm, scan, report, seeded fix, rerun, delta) works end to end on the synthetic fixtures and on one pinned real repository. Status: a first real-repository measurement is done, against a synthetic obligation, on `vercel/chatbot` at `c2f8235e1f3ea903ad8b7f61447c4f74164b5c58` (`real-repo-measurement-001.md`). Confirm and scan ran end to end and reproduced the same hash on rerun; the seeded-fix and delta half of the loop was exercised on synthetic fixtures only. The first scan found a false-pass gap (model ids held in a catalog) and three false `minified` verdicts, both fixed in card 1.1.0 and evaluator 0.3.0. Two further repositories have since been measured (`real-repo-measurement-002.md`, `-003.md`). Each is one repository: counts on it are observations, not rates.
- H2: across the unsupported, ambiguous and near-miss cases in scope, the engine produces zero false passes (an unsupported case must give `unknown`, not `pass`). Status: falsified once on a real repository. In measurement 003 a copy without one vendored file returned PASS while nine files imported `@langchain/openai` and eight used `gpt-4o-mini`; the registry does not cover `@langchain/*` packages (CURB-24, CURB-25). H2 stays open until that is fixed and rerun.
- H3: the same inputs give the same result hash on repeated runs and on different machines. Today the determinism tests vary path, line endings, file creation order, actor and clock on one machine only; cross-machine reproduction is untested (CURB-15).
- H4: in Discover mode, a builder who does not know this area finds at least some of the ranked questions worth acting on, and can tell observed from declared from unknown without coaching. Tested first on paper (phase 2), then by use.
- H5: the product owner reopens Curb on their own project after a repository change, without being prompted. Tested in phase 7.
- H6: Controls checks fail on a seeded violation and never pass on missing evidence. Tested in phase 8.

What exists today: H1 and the single-machine part of H3 are exercised on synthetic fixtures by the engine test suite, and three real repositories have been scanned from local read-only clones (`real-repo-measurement-001.md`, `-002.md`, `-003.md`; `source-manifest.md` covers `vercel/chatbot` only). Nothing from them is copied into this repository; the licence question for redistribution of the `vercel/chatbot` fixture is still open. H4, H5 and H6 are untested.

## Phases

Each phase ends in an artifact a person can inspect and a go or no-go. A later phase does not start on an unmet gate. Work under the engine's high-risk paths (`engine/src/evaluator/`, `snapshot/`, `store/`, `schema/`, `engine/policies/`) needs a code-explorer pass first and an independent review before merge.

| Phase | Deliverable | Gate |
|---|---|---|
| 0. Decide and ground | Charter and PRD approved; Jira restructured to match | Product owner signs scope |
| 1. Gates on this repo | CI with required checks; review and ticket gates as scripts | Each gate fails on a seeded break |
| 2. Paper test of Discover | Hand-written discover output for `vercel/chatbot`, then the owner's private project, no code | Owner can name questions they would act on |
| 3. Detection hardening | `@langchain/*` registered (CURB-24); bare model id policy decided (CURB-25) | Measurement 003 rerun no longer returns a false pass |
| 4. Observe mode and question engine | Observe-only scan, question bank v0, fixed ranker | Golden outputs; identical hashes on two machines; adversarial cases give `unknown` |
| 5. Claims, answers, delta | Answers feed claims; engine rerun | Seeded fix and delta work end to end |
| 6. Evidence pack | Markdown and PDF from one model | An outside reader tells observed, declared and unknown apart |
| 7. Dogfood on the owner's private project | Real run, with the owner's authorisation | Owner records a decision, change or customer answer from it |
| 8. Controls mode | `curb controls` | Each control fails on a seeded violation |
| 9. External validation | 2-3 outside builders run the golden scenario | Decision rule fixed in advance |

## Owners

| Role | Owner |
|---|---|
| Product | unassigned, to be named |
| Technical | unassigned, to be named |
| Security | unassigned, to be named |
| Legal/policy | unassigned, to be named |
| Question bank content | unassigned, to be named |

## Stop conditions

Stop work on a scan, report or release if any holds:

- There is no authority over the source (repository or agreement) being used.
- There is no human owner to approve a claim or obligation. Open decision: whether the builder may be the sole owner of their own claim. Until decided, a claim needs a named owner who is a person, and the product owner is a person.
- A phase gate is unmet and the next phase depends on it.

## Human gates still open

Nothing below has been done. Each needs a named human.

1. Named owners for Product, Technical, Security, Legal/policy and Question bank content.
2. Counsel approval of the `unapproved-provider-reference` policy card (it ships as `draft, pending counsel approval`), and of the question bank wording before it is used outside the product owner's own projects.
3. Source and licence review of the `vercel/chatbot` fixture source before any copy or redistribution.
4. Security review of the engine and its threat model before any production tenant is onboarded, and an update to the threat model before a loopback review UI or network-using controls ship.
5. Authorisation to scan the owner's private project, with a repository path.

## Signatures

| Role | Name | Date | Signature |
|---|---|---|---|
| Product | | | |
| Technical | | | |
| Security | | | |
| Legal/policy | | | |

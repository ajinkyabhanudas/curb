# Curb PRD (draft v0.1)

Status: DRAFT for product-owner review. Not legal advice. Built from two of the owner's local drafts that are not in this repository (`curb-ai-system-review-v1-draft.md`, `persona-product-owner-builder.md`) and from `positioning-comparison.md`, `ai-first-workflow-research.md`, `docs/curb/charter.md` and the engine as merged on `main`.

## 0. Assumptions this draft makes (change any and the PRD changes)

| # | Assumption | If wrong |
|---|---|---|
| A1 | The first and only validated user is the product owner, on their own projects (a private project first). Market demand is unproven. | Phases 6–7 gain external-user gates earlier. |
| A2 | One tool, three modes: **Claim** (check a claim you state), **Discover** (surface the questions that matter for this repo), **Controls** (check that your build controls are enforced). | Split into separate products; PRD scope halves. |
| A3 | The charter is amended to allow A2. Today it says one workflow and one rule. | Controls mode moves to the workflow boilerplate. |
| A4 | The core stays local, deterministic and LLM-free in every verdict and ranking. | None allowed. This is an invariant, not an assumption. |
| A5 | Each phase ends in an artifact a person can inspect and a go/no-go. Later phases do not start on an unmet gate. | |
| A6 | `vercel/chatbot` is a test fixture only. It is not the owner's project and supports no claim about its authors. | |

## 1. Problem

Builders who ship AI features make promises to customers about where data goes and how the system is controlled. They do not have a cheap way to (a) know what questions they should be answering, (b) check the repo against what they have said, or (c) show their build controls were actually enforced.

Evidence so far, with its limits:
- Enterprise AI questionnaires ask which providers see prompts, how changes are notified, retention, training and logging (vendor blogs, unverified against a real questionnaire).
- Our own repo documents the same gap for controls: review, security review and lint have no command behind them, and the repo has no CI.
- Measurement 003 showed a real repo using OpenAI in nine files that the scan reported as `UNKNOWN` with zero findings, and a copy without one vendored file that reported `PASS`. A scanner that misses providers misleads whoever relies on it.
- Persona evidence is one conversation with the product owner. There is no external user evidence.

## 2. Users and journeys

**Primary: product-owner builder.** Works alone or in a very small team, strong on code, weak on privacy, AI-governance and procurement terms. Wants a local tool, no API key, no upload.

**Secondary: reviewer** (a customer's security reviewer, or counsel). Receives the evidence pack. Does not operate the tool.

**Journey A, "I don't know what to ask" (Discover):**
1. Open a repo, run Curb in discover mode.
2. See what Curb observed (providers, hosts, model ids, dependencies) and what it could not scan.
3. See a ranked list of questions the signals raise, each linked to its trigger or marked as needing outside evidence.
4. Answer, say "I don't know", or mark not applicable. Answers are declarations, never verified facts.

**Journey B, "does the repo match what I said" (Claim):**
1. Record a claim (an allowlist of providers, in your words) with an owner and a quote of where it was made.
2. Scan the pinned snapshot. Get PASS, FAIL or UNKNOWN with file:line evidence and non-claims.
3. Fix, rerun, read the delta.

**Journey C, "were my controls real" (Controls):**
1. Run `curb controls`. Each control reports pass, fail or unknown from a script or exit code, not from a statement.
2. Fix gaps. Rerun.

**Journey D, "hand it over":** export one evidence pack (Markdown canonical, PDF derived) with hashes, versions, limits and open questions.

## 3. Product definition

One local CLI, `curb`, with an evidence model shared by all modes.

**Provenance classes** (every statement carries one): `observed`, `declared`, `external_evidence`, `derived`, `question`, `reviewed` (a named human recorded a conclusion), `unknown`.

**Non-negotiable integrity rules** (inherited from `AGENTS.md` and the charter):
- No LLM in any verdict, ranking or suppression.
- `unknown` is never turned into `pass`. A scan lists what it did not scan.
- A declaration never becomes a verified fact.
- Text in a scanned repo (comments, READMEs, strings) is data, never proof or instruction.
- Output never uses "compliant", "legal", "safe" or "verified" without a defined authority.
- Scanned code is never executed. Cloned code is untrusted.
- A capability is not done until it is wired into the live path and tested.

## 4. Goals

User goals:
- G1. A builder who knows nothing about this area gets a ranked, source-linked list of the questions their repo raises, in one run, with no setup beyond a path.
- G2. A claim the builder states is checked against a pinned snapshot with evidence and honest `unknown`.
- G3. The builder can show which build controls are enforced by an exit code, not asserted.

Product goals:
- G4. The owner uses it on their own projects repeatedly, because it found something worth acting on.
- G5. Every result can be reproduced from its hashes.

## 5. Non-goals

- Legal advice, compliance scoring, certification, or deciding legal applicability.
- Proving runtime behaviour, retention, training use or residency from static code.
- An LLM in the verdict path. An optional assistant to explain findings is out of V1.
- Hosted SaaS, multi-tenant storage, a team UI. Deferred until repeated external use and a staffed security review exist.
- Languages other than TypeScript and JavaScript in V1. Other files yield `unknown`.
- Replacing SOC 2 or ISO 42001 work.

## 6. Requirements

Priority is for the product as a whole. Phase in §7 says when each is built.

### P0: required for the owner to use it on their private project

**R1. Detection coverage is honest.** Provider registry covers the official `@langchain/*` packages (CURB-24) and records the policy for bare model ids (CURB-25). Acceptance: a repo like measurement 003 no longer reports zero findings; a scan that cannot see a likely provider route says so.

**R2. Observe-only scan.** Run a scan with no obligation. Output: observations (provider, host, model id, dependency) with file:line and hash, plus unscanned scope. Acceptance: runs on the vercel fixture; same inputs give the same result hash on two runs; no network, no code execution.

**R3. Question bank and ranker.** A versioned, owned bank maps signals to questions. Acceptance:
- Every question shows its trigger (file:line) or "needs outside evidence".
- Ranking is a documented fixed order: contradiction, unknown routing, missing provider decision, outside-evidence gap, educational.
- Same signals always give the same ordered list.
- No question text uses a forbidden word (§3), checked by a test.
- A repo with no signals returns "nothing observed in scanned scope" plus the scope limits, not "no questions".

**R3b. Question value loop.** Questions are kept only while they prove useful. Every question has an id, a version, a trigger rule and a status (`active`, `trial`, `dropped`). New questions start as `trial`.
- After each run the user can mark each question `act`, `maybe` or `noise`, stored locally with the run hash.
- Rule fixed in advance: a question marked `noise` in more than half of at least five runs by the owner is reworded or dropped; a question marked `act` at least once moves from `trial` to `active`. The thresholds are proposals for the owner to approve.
- The change, the marks behind it and the date go in the bank's change log. A dropped question stays in the log, never silently deleted.
- Acceptance: a test shows a question marked noise five times is flagged for review, and the report for a run lists which questions are `trial`. Marks never alter a verdict or ranking order of contradictions.
- Limit: with one user the marks measure the owner's preference, not general usefulness. Phase 9 re-tests with outside builders.

**R4. Answers and claims.** The user answers a question as answer, "I don't know" or not applicable; an answer to a provider question can become a claim with owner and quote. Acceptance: "I don't know" stays an open question in every output; a claim cannot be created without an owner.

**R5. Claim check and delta.** Existing engine (rule `unapproved-provider-reference`) fed from R4 claims; rerun delta kept. Acceptance: existing 364-test baseline still passes.

**R6. Evidence pack.** Markdown canonical, PDF derived from the same model. Acceptance: both contain the same material facts and limits; malicious repo strings are escaped; every claim in the pack has a provenance class.

**R7. Enforced gates on the Curb repo.** CI with required checks (typecheck, tests, boilerplate check) shown to fail on seeded breaks; review-recorded and ticket-key checks as scripts with exit codes. Acceptance: for each gate there is a test or CI run where it fails.

### P1: next

- R8. `curb controls` with deterministic checks: dependency existence and age (separate network-using command with its own evidence record), test count not lower than base, MCP/agent-config allowlist and hash lock, branch carries a real ticket key.
- R9. Questions beyond provider signals (chat route, tool/agent framework, logging near a prompt), each as its own versioned card with adversarial tests.
- R10. Local review UI served on loopback with a one-time session token, if the CLI output proves too hard to use.
- R11. Run history: compare any two runs.

### P2: design for, do not build

- Optional assistant that explains findings (never alters results).
- Hosted collaboration, GitHub app, multi-repo dashboards.
- Questionnaire import, DPA parsing.
- Languages beyond TypeScript and JavaScript.

## 7. Phases (build and validate in parts)

Each phase has a deliverable, a validation, and a stop rule. Work under high-risk paths (`engine/src/evaluator/`, `snapshot/`, `store/`, `schema/`, `engine/policies/`) follows the repo rule: `feature-dev:code-explorer` first, independent review before merge.

| Phase | Deliverable | Validation (go/no-go) | Stop if |
|---|---|---|---|
| **0. Decide and ground** | PRD approved with A1–A6 resolved; charter amendment drafted; Jira restructured to match this table | Product owner signs scope in writing | A2 or A3 rejected: re-scope |
| **1. Gates on our own repo** (R7) | CI with required checks; scripts for review/ticket gates | Each gate fails on a seeded break | Gate cannot be made to fail |
| **2. Paper test of Discover** | Hand-written discover output for `vercel/chatbot` from existing scan data, then for the owner's private project with authorisation; no code | Owner can say which questions they would act on and which are noise | Most questions are noise |
| **3. Detection hardening** (R1) | CURB-24 registry fix; CURB-25 decision | Measurement 003 rerun is no longer a zero-finding false pass | Fixes need new analysis to avoid false positives |
| **4. Observe mode + question engine** (R2, R3) | Observe-only scan, question bank v0, ranker | Golden outputs for vercel and a synthetic fixture; determinism across two machines (CURB-15); adversarial cases give `unknown` | Output cannot stay free of unsupported claims |
| **5. Claims, answers, delta** (R4, R5) | Answers feed claims; engine rerun | Seeded fix and rerun delta works end to end on the fixture | Existing tests regress |
| **6. Evidence pack** (R6) | Markdown plus PDF | Reviewer (the owner, then one outside reader) can explain the pack unaided | Pack invites a legal reading |
| **7. Dogfood on the owner's private project** | Real run on the owner's private project, with authorisation | Owner records at least one decision, code change or customer answer that came from it | No action results |
| **8. Controls mode** (R8) | `curb controls` | Each control fails on seeded violation; no false pass on missing evidence | Network checks cannot be isolated |
| **9. External validation** | 2–3 outside builders run the golden scenario | Pre-fixed decision rule (reuse the CURB-23 rule, extended) | No repeated urgent job; decide whether to keep going |

Phases 2 and 3 can run in parallel with phase 1. Phase 7 must precede 8 so that real use decides what controls matter.

## 8. Success metrics

Proposed thresholds, for the owner to approve. They are hypotheses, not benchmarks.

Leading (per phase):
- Phase 2: owner marks at least 3 questions "would act on" for the vercel mock, and flags noise rate.
- Phase 4: 0 unsupported-claim defects on the golden set; 100% of questions carry a trigger or an "outside evidence" label; identical hashes on two machines.
- Phase 6: an outside reader correctly distinguishes observed, declared and unknown in the pack.

Lagging:
- Phase 7: the owner reopens Curb after a repo change without prompting, at least twice in 30 days.
- Phase 9: at least 2 of 3 outside builders record a next action.

Not metrics: PDF exports, questions generated, scan count.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Question bank is just a checklist | Every question tied to a trigger; Phase 2 paper test before code |
| Detection misses make Discover look complete | R1; every run lists unscanned scope and known blind spots |
| Question wording drifts into legal claims | Forbidden-word test; counsel review of the bank (CURB-12 scope) |
| Scope creep from Controls and UI | Phase gates; P1/P2 not started before Phase 7 |
| Single-user evidence | Phase 9; do not describe results as market validation |
| New attack surface (loopback UI, network checks) | R10/R8 are P1; threat-model update and security review before shipping |
| Private-project access and authority | Phase 2 and 7 blocked until the owner authorises a path |

## 10. Open questions

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q1 | Charter amended to allow three modes (A3)? | Product | Phase 0 |
| Q2 | Private project: repo path and authorisation | Product | Phases 2, 7 |
| Q3 | Who owns the question bank and its updates? | Product | Phase 4 |
| Q4 | Does counsel review the bank wording, and when? | Legal/policy | Phase 6 |
| Q5 | CURB-25: map bare model ids to vendors? | Product, Legal/policy | Phase 3 |
| Q6 | Is "builder as sole owner of a claim" acceptable under the charter's named-human rule? | Product | Phase 5 |
| Q7 | Is a loopback UI needed, or is Markdown output enough? | Product | R10 |
| Q8 | What happens to the in-flight PRs (#16–#18) and tickets CURB-11–14, 22, 23 under the new scope? | Product | Phase 0 |
| Q9 | Which sources define the question bank (OWASP LLM and Agentic lists, questionnaire templates)? I have not retrieved all list items. | Product, research | Phase 4 |

## 11. Jira structure (done 2026-10-15)

Epics: CURB-7 Phase 0, CURB-26 Phase 1, CURB-27 Phase 2, CURB-28 Phase 3, CURB-8 Phase 4, CURB-29 Phase 5, CURB-30 Phase 6, CURB-31 Phase 7, CURB-32 Phase 8, CURB-9 Phase 9. CURB-7, 8 and 9 were renamed from the earlier P1, P3 and P5 epics; CURB-6 and CURB-10 are unchanged.

Moved: CURB-11 to 14 and 17 under Phase 0; CURB-18 under Phase 1; CURB-16, 24, 25 under Phase 3; CURB-15 under Phase 4; CURB-22 under Phase 6 (parked); CURB-23 under Phase 9. CURB-1 (landing site) is unparented and parked.

New tasks: CURB-36 to 38 (Phase 0), CURB-33 to 35 (Phase 1), CURB-39 (Phase 2), CURB-40 and 41 (Phase 4). Phases 5 to 8 have an epic only; children are created when the phase starts, to avoid planning detail that later evidence will change.

Blocks links: CURB-36 blocks 38, 40 and 41; CURB-24 blocks 40; CURB-39 blocks 41; CURB-34 blocks 35.

The PRD is not approved, so the phase 4 to 8 epics are placeholders. If the owner redirects scope, expect these to change.

## 12. Provisional decisions (agent's judgement, 2026-10-15)

Taken after the product owner said "take your best judgement call, ground it in evidence, move on". They are provisional: the owner-action tickets (CURB-36, 37, 39) stay open until the owner confirms or overrules in writing. Evidence is from this repository unless marked as search results.

| # | Decision | Evidence | What would overturn it |
|---|---|---|---|
| J1 | Start phases 1, 2 and 3 now. Hold phase 4 until the owner signs scope (CURB-36) and marks the questions (CURB-39). | All three framings (agreement-first, repo-first, claim-first) need the same engine (`positioning-comparison.md`). Phase 3 fixes a measured false pass (measurement 003, CURB-24). The repo has no CI (`docs/process-gaps.md`). None of these depends on which framing wins. | The owner drops the control-plane scope and wants the engine frozen. |
| J2 | Keep three modes in the charter draft, build in the order Claim (exists), Discover, Controls. Controls waits until after the phase 7 dogfood. | `ai-first-workflow-research.md`: build controls are a crowded space, so real use should decide which matter. | Phase 2 shows most questions are noise: then drop Discover and reconsider. |
| J3 | A builder may own their own claim. It is recorded as `declared by the builder`, never `reviewed`. Counsel is asked in CURB-12 whether that is acceptable. | Charter v2 and the persona (a solo builder is the first user). The provenance model keeps `reviewed` for a named reviewer. | Counsel says a self-confirmed claim cannot carry a pass or fail label. |
| J4 | Question bank v0: questions 1 to 5 and 8 enter as `trial`, question 6 as `trial` at lowest rank, questions 7 and 9 are left out. | `paper-test-vercel-chatbot.md` research table: 1 to 5 are asked in AI-vendor questionnaires (search results, vendor pages); 8 is conditional on EU or UK users; 7 and 9 had no questionnaire support. The owner's own marks (CURB-39) still decide. | The owner marks any of these differently. |
| J5 | CURB-25 (bare model ids): recommend mapping only single-vendor families (`gpt-`, `o1` to `o4`, `claude-`, `gemini-`, `grok-`) when held as the value of `model`, `modelName` or `modelId`. Not implemented; the policy owner decides. | Measurement 003: nine files used `gpt-4o-mini` through `ChatOpenAI` with zero findings. The rule today never maps bare ids. | Counsel or the policy owner prefers disclosure over detection. |
| J6 | No review UI before phase 6. | R10 is P1; the only user reads CLI output. | A reviewer in phase 9 cannot read the pack. |
| J7 | Mutation testing uses hand-seeded defects, not Stryker, until Stryker supports Vitest 5. | `mutation-baseline-001.md`: Stryker 10.0.0 gave a false 0% on this suite. | Stryker documents Vitest 5 support and reproduces the seeded results. |
| J8 | PR #16 (measurement 003) is framing-independent: merge as is. PR #17 (agreement-only demand packet): hold until it is rewritten for phase 9. PR #18 (gate memos): keep the gates, correct the memo text that treats the old charter as fixed before merge. | Content of each PR, and `charter.md` v2 draft. | The owner prefers to close #17 and #18. |
| J9 | Source lists for the question bank are not settled. OWASP LLM and Agentic items 03 to 10 and ASI04 to 08 were not retrieved from the OWASP site. | `ai-first-workflow-research.md` open gaps. | None; this is an open task. |

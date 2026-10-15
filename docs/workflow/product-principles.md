# Product and AI principles

Status: DRAFT. The five-line summary is in `AGENTS.md`. This file holds the reasoning, the evidence, and the limits of each tool. Evidence comes from web search results (vendor posts, preprints, practitioner pages) and is unverified unless stated.

## 1. No fluff, no overengineering

Rule: a feature, check, report section or document names the decision or action it changes for a named user. If it names none, do not build it. No abstraction, option or setting until its second real use.

How we check it: the PRD (`docs/discovery/prd-draft.md`) requires each phase to end in a go/no-go that a person can inspect, and the paper test (`paper-test-vercel-chatbot.md`) asks "would you act on this" before any code. Both are human judgements; no script enforces them.

Why: a July 2026 benchmark on out-of-scope actions describes coding agents that routinely exceed what was asked ([OverEager summary](https://themodelwire.com/article/overeager-coding-agents-measuring-out-of-scope-actions-on-benign-tasks-01KRZCG9GN1R65CW7VRNFD2EES)). I found no figure for gold-plating itself, so scope control relies on the rule and review, not on a number.

## 2. AI is positively constrained

Allowed: explain a finding, draft questions, propose a fix, summarise. Not allowed: set a verdict, rank findings, suppress or downgrade `unknown`, create an `observed` fact, or sit between a scan and its result. This matches the OWASP agentic framing of goal hijack and tool misuse (ASI01, ASI02) as the risks to bound ([Cycode](https://cycode.com/blog/owasp-top-10-agentic-applications/)), and AWS's split of controls into deterministic, non-deterministic and human ([AWS](https://aws.amazon.com/blogs/security/balancing-speed-and-safety-a-control-framework-for-ai-coding-agents/)): only the deterministic ones block.

## 3. Hallucination: prevent, then detect

Sources agree no single technique is enough; they layer the following ([overview posts, vendor-authored](https://futureagi.com/blog/taming-hallucination-beast-strategies-reliable-llms/)):

| Layer | What we do |
|---|---|
| Ground | AI sees only a selected evidence packet with provenance labels, not the repo. |
| Constrain output | Schema-validated output; every statement carries a source id; anything else is rejected. |
| Abstain | "unknown" and "I don't know" are valid outputs, and cost less than a wrong answer. |
| Verify | Code resolves each cited file:line against the snapshot hash. A well-formed citation that does not resolve is a failure. One source warns a structural check misses fabricated citations that look valid, so resolvability is the check, not format. |
| Judge | An LLM judge, if ever used, covers only subjective quality and never overrides a deterministic result. |

Names the AI invents are a separate risk: packages ([slopsquatting](https://labs.cloudsecurityalliance.org/research/csa-research-note-slopsquatting-ai-supply-chain-20260419-csa/); a 2025 study put non-existent package recommendations at 19.7%) and library APIs. Check packages against the registry and APIs through Context7 before using them.

Headline reduction figures in these sources (for example "60–80%") have no primary source I could verify. We do not quote them.

## 4. Determinism where it matters

Verdicts, hashes, rankings and the question order are code and reproduce byte for byte. Where AI output is used, treat it as non-deterministic: pin the model and parameters, store input and output, and never gate a decision on one sample.

## 5. Evaluations that can fail

The failure we are guarding against is tests that pass but protect nothing.

- Coverage alone says little. The classic point: a test can reach 100% coverage while checking nothing ([fuzzingbook](https://fuzzingbook.org/html/MutationAnalysis.html)). A Google study of about 15 million mutants found mutants coupled with real high-priority faults ([arXiv 2103.07189](https://www.arxiv.org/pdf/2103.07189)).
- Agent-written tests: a 204,673-file study found assertion strength roughly comparable to human tests (85.4% vs 88.1% strong) but more flakiness risk ([arXiv 2607.12068](https://arxiv.org/pdf/2607.12068)). A second benchmark reports agents write tests with weak assertions that also pass on broken code and rarely test what must not change ([SWE Atlas](https://arxiv.org/pdf/2605.08366)). Treat both as indications, not settled.
- Build evals from observed failures. Husain and Shankar advise against writing evaluators for imagined failures and for error analysis on real outputs, with early evals only for hard constraints ([FAQ](https://hamel.dev/blog/posts/evals-faq/should-i-practice-eval-driven-development.html)). Our equivalent: real-repo measurements, review findings and escaped bugs become regression cases. The false pass in measurement 003 is the model example.

Rules we apply:
1. Every test or eval names the user-visible failure it guards (one line in the test).
2. It is shown to fail on a seeded defect. For a rule change that means the rerun of the previously wrong case, which is already our gate (`gates.md`). For new checks, seed the defect by hand or with a mutation tool.
3. Review is not a substitute: a reviewer's claim is checked against the code (delegation rule).
4. Do not set a numeric mutation-score target until we have measured our own baseline; the common "about 80%" figure is a convention from blogs, not a validated threshold.

## 6. Tools and plugins we can use, and their limits

Only the first four are used so far. The rest are candidates; none is installed or relied on yet.

| Tool | Use | Limit |
|---|---|---|
| Context7 MCP | Current docs for libraries before writing against them | Docs can lag or be wrong; it does not verify behaviour. Say "docs not fetched" if down. |
| `feature-dev:code-explorer` and `code-reviewer` | Map dependents; independent review | LLM agents with no shell: cannot run tests or time anything, and can state wrong facts. Verify their claims. |
| Our own checks | `tsc`, `vitest`, `scripts/check-boilerplate.sh`, golden outputs | Mechanical but only as good as what they assert. See §5. |
| GitHub MCP | Find and read public repos | Search shows public repos only. |
| Mutation testing (Stryker 10.0.0) | Measures whether tests fail when code is broken | Tried 2026-10-15 (CURB-33): did not work with Vitest 5.0.4. Its default type-check header injection altered our fixtures; after disabling that, every mutant showed as survived with 0 tests run, while a hand-made defect failed 49 tests. Result discarded, tool removed. Retry only when its Vitest runner states support for Vitest 5. |
| Hand-seeded defects (`engine/scripts/seeded-defects.py`, added by CURB-33) | Replaces one string in the evaluator at a time and checks the suite fails | Defects are chosen by hand, so it shows gaps in what was seeded and nothing about the rest. About 10 minutes for 35 defects. Not enforced by any gate. Result: `docs/curb/mutation-baseline-001.md`. |
| `golden-set-curator`, `stress-test`, `adversary-loop`, `overengineering-auditor`, `verify` skills | May help with fixtures, attack cases and scope review | I have not read them. Read each before relying on it and record its limits here. |
| `superpowers:test-driven-development`, `verification-before-completion` | Process nudges | Advisory only. |
| youk MCP hooks | Deliberately not relied on in this repo | Their gates and nudges have not been shown to add product value here. |

## 7. What has no check yet

- Nothing enforces "names a user decision" (§1). It is a review question.
- No mutation or seeded-defect check exists for the existing 364 tests. We do not know how many would fail if the evaluator were broken.
- No CI runs any of this (see `ai-first-workflow-research.md`).

Logged in `docs/process-gaps.md`.

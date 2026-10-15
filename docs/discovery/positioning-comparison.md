# Curb positioning comparison

Status: DRAFT, desk research only, 14 October 2026. Not market validation. Every external claim below comes from vendor or commentary pages found by web search; none was checked against a primary source unless stated.

## Question

Which framing of Curb has more market appeal and relevance:

- **A. Agreement-first** (current charter). A named human confirms a commitment from a customer agreement; Curb checks a pinned repo snapshot against it and reports pass, fail or unknown.
- **B. System-first** (`curb-ai-system-review-v1-draft.md`). Curb reads a repo, shows observed AI providers and routes, asks only what code cannot answer, and produces a technical review pack.
- **C. Claim-first** (new, from this research). The unit is a customer-facing claim the builder confirms: a questionnaire answer, a subprocessor list, a DPA clause. Curb checks the repo against it and reports drift. It uses A's engine and B's front door.

## Evidence for relevance (the trigger exists)

- Enterprise AI security questionnaires ask which model providers touch prompts and how much notice customers get when that list changes ([Reco](https://www.reco.ai/ciso-hub/ai-vendor-security-questionnaire)), plus training on data, retention, residency and logging ([CloudEagle](https://www.cloudeagle.ai/blogs/ai-vendor-security-questionnaire)).
- Secondary sources say the Article 50 chatbot disclosure duty has applied since 2 August 2026 and the omnibus delayed only high-risk rules ([Elevate](https://elevateconsult.com/insights/eu-ai-act-article-50-icp-impact/)). Not checked against EUR-Lex.
- AI restrictions are often split between the main agreement and the DPA, and one source says the DPA usually controls ([CloudEagle](https://www.cloudeagle.ai/blogs/ai-contract-clauses)). This supports a "which document is the claim" step.

## Competitive landscape

| Group | Examples | What they do | Gap relative to Curb |
|---|---|---|---|
| Free AIBOM/provider scanners | [aibom-scanner](https://pypi.org/project/aibom-scanner/) (Apache-2.0, 61 patterns, 30+ providers, CI fail, maps to NIST/ISO 42001/EU AI Act), [AIROM](https://pkg.go.dev/github.com/airomhq/airom@v0.3.4) (file:line evidence), [arkna-scan](https://cdn.jsdelivr.net/npm/arkna-scan@1.4.0/README.md) (MIT, `npx`, Python/TS/JS/Ruby/Go, confidence labels) | List AI providers and frameworks in a repo | Inventory only. No agreement or claim input, no contradiction verdict. |
| Privacy code scanners | [HoundDog](https://hounddog.ai/) (free JS/TS CLI, paid about $200 per developer per year per the vendor) | Sensitive data flows to sinks | Data-flow focus, not provider-vs-commitment. |
| Compliance platforms | Vanta, Drata | ISO 42001 frameworks, model inventory, risk classification. One 2026 comparison says Drata has shadow-AI/agent discovery and Vanta does not ([source](https://www.stackscout.net/articles/cc_20260618_171523.html)). Prices unpublished; estimates run from about $7.5k to $60k a year. | Inventory is declared in a platform, not derived from a repo snapshot. Priced above an indie builder's budget. |
| Enterprise shadow-AI vendors | [Scrut](https://www.scrut.io/post/introducing-shadow-ai-governance), Airia, Obsidian, Holistic AI | SSO, endpoint and cloud discovery | Targets buyers' IT, not the vendor shipping the feature. |
| Contract-lifecycle vendors | [Sirion](https://www.sirion.ai/library/contract-insights/contract-systems-ai-data-governance/) | "Compliance-in-action" pitch | No technical detail found; no code-to-clause check found. |

## What the fetched scanner pages do and do not say

- arkna-scan's README names confidence labels but no "unknown" category, no comment/string handling, and no behaviour when its 50,000-file or 500 MB cap is hit. Its method (regex or AST) is not stated.
- aibom-scanner's PyPI page says nothing about comments, false positives or unscanned files. Its PyPI page returned a bot challenge to my fetch, so the details above come from search snippets.
- AIROM's pages describe output only.
- I did not run or read the source of any of them. How well they detect on our measurement repos is unknown.

Reading: the free tools already cover "list the providers", and I found no evidence they report unscanned scope or refuse to say "pass". That is Curb's strongest differentiator across all three framings, and it is unverified here.

## Comparison

| | A. Agreement-first | B. System-first | C. Claim-first |
|---|---|---|---|
| Trigger match | Customer contract clause | Pre-launch or questionnaire, vague | Questionnaire or DPA answer, specific |
| Direct competitors found | None found | Several free, mature-looking scanners; Vanta and Drata for the paid slot | None found for claim-vs-repo; free scanners cover the inventory half |
| Input burden on a small builder | High: counsel-confirmed obligation | Low: point at a repo | Medium: builder confirms a claim they already wrote |
| Moat | Engine plus gates | Provenance discipline and review pack | Engine plus provenance, aimed at an existing workflow |
| Depends on unfixed detection gaps | Verdicts can say unknown | Inventory implies completeness; CURB-24 and CURB-25 gaps hurt most | Same as A |
| Build cost from today | Lowest (it exists) | Highest (ReviewRecord, observe-only mode, local UI server, pack) | Medium (claim input, drift report, pack) |
| Legal-gate load | Heavy (CURB-12 counsel) | Lighter on text, but self-confirmation conflicts with the charter | Medium: builder confirms their own claim; no legal reading |

## Weakest points in this analysis

- No willingness-to-pay evidence. The only price anchors are HoundDog's low ceiling and Vanta/Drata's high one, with nothing between them.
- No buyer interview. The persona is one product-owner conversation.
- All source pages are vendor-authored and mostly under six months old.
- C is inferred from search results and not tested with anyone.
- "No competitor found" for A and C is a search result, not a market fact.

## Proposed test (replaces the CURB-23 framing; not yet applied to the packet)

Use one synthetic repo and one real consenting builder repo, with the same output quality. Show each of 2–3 reviewers three one-page outputs and ask the existing five questions per output:

1. A: report against a counsel-style obligation.
2. B: provider inventory plus open questions.
3. C: "your subprocessor/questionnaire answer says X; the repo shows Y".

Fix the decision rule in advance, as the existing packet does. Randomise order. Record which one the reviewer would take to a customer, and what they would pay for in plain numbers.

Add a control: show the same reviewer the output of a free scanner on the same repo, to test whether Curb's output is distinguishable at all.

## Open decisions for the product owner

1. Is the first audience the builder shipping the feature (B, C) or a person checking a contract (A)?
2. Will the product owner be test subject zero on their own repo, with the authorisation the draft says is missing?
3. Which of the three outputs should the sample reports be rewritten to first?

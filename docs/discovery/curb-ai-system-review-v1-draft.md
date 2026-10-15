# Curb AI System Review: discovery and V1 plan

Status: DRAFT for product-owner review. This is not `plan.md`, not a PRD, and not legal advice.

Prepared: 14 October 2026 (Europe/London)

## 1. Decision requested

Approve or redirect this product boundary before implementation:

> Curb is a local-first AI System Review for UK/EU application builders. It turns repository observations, builder declarations and supplied external evidence into a traceable technical review pack. It helps a user identify the decisions, safeguards and open questions that their AI feature creates. It does not give legal advice, determine legal applicability or certify compliance.

The first supported system is a customer-facing TypeScript/JavaScript AI chatbot. The current provider-reference scanner remains one evidence module inside the review, not the entire product.

### The user persona used to validate V1

The first candidate user is an indie or small-team B2B application builder adding an AI chatbot to a product. They know their code better than privacy, AI-governance or procurement terminology. The first candidate trigger is an enterprise customer, security questionnaire or pre-launch review that asks where customer prompts can go. The builder needs a concise, technically defensible answer quickly. This is a hypothesis to test before implementation, not a buyer claim.

The user mentioned a product named Stencil. No Stencil repository, architecture or user flow is available in this workspace. This plan therefore uses a **Stencil-like customer-facing application with an AI chatbot** only as a scenario, not as a factual claim about Stencil. Before implementation, replace the scenario assumptions with an authorised repository walk-through.

### The opening problem

The user does not start with a contract. They start with a system:

> “Help me understand the promises an AI application should consider, then show me what my repository appears to support, contradict, or leave unanswered.”

The product’s value is a useful, evidence-backed discovery. It must identify at least one material unrecorded decision, conflicting technical signal or missing evidence source that changes what the builder does next. A generic checklist, a legal-sounding score, or a static PDF does not meet this bar.

## 2. Current-state handoff

### What works today

- `engine/` is a local TypeScript CLI with a deterministic snapshot, agreement/obligation record, one provider-allowlist rule, evidence locations, report/delta output, content hashes and append-only audit log.
- The evaluator does not execute scanned code, does not use an LLM or network in its verdict path, avoids symlinks, bounds file size and returns `unknown` rather than `pass` for unsupported/incomplete scope.
- The shipped rule, `unapproved-provider-reference` v1.3.0, detects registered AI-provider package references, hosts, selected model identifiers and some provider-named assignments outside a human-confirmed allowlist.
- `frontend/` is a client-only Next.js prototype: a questionnaire mapped to EU AI Act, GDPR, NIST AI RMF and ISO 42001-oriented content, with a live document view and local PDF generation.

### Verification performed for this draft

- [x] `cd engine && npm test`: 19 files, 364 tests passed.
- [x] `cd engine && npm run typecheck`: passed.
- [x] `cd frontend && npm test`: 3 files, 32 tests passed.
- [x] `cd frontend && npm run typecheck`: passed.

### What does not exist

- [ ] No bridge from the frontend to the repository-scanning engine.
- [ ] No canonical model separating observed evidence, builder declarations, external documents, questions and legal decisions.
- [ ] No AI System Review workflow, repository picker, activity view, evidence import, local workspace persistence or review-pack schema.
- [ ] No adversarial evaluation corpus for a guided review or assistant feature.
- [ ] No backend, authentication, tenant isolation, deployment, secure worker sandbox, release signing or production onboarding path.
- [ ] No named product, technical, security or legal/policy owners; counsel and security gates remain unsigned.

### What to retain and what to retire

| Asset | Decision | Reason |
|---|---|---|
| Deterministic engine, hashes, unknown state, audit/report foundation | Retain and harden | This is Curb’s credibility core. |
| Provider-reference rule | Retain as the first technical evidence module | It supports a concrete discovery: unrecorded providers, fallback routes and provider drift. |
| Frontend shell, progressive steps, live document pane, PDF utility | Retain and adapt | These are a useful local-first interaction shell. |
| Form answers producing `no_gap` | Retire | A self-report is a declaration, never verified evidence. |
| Broad framework checklist as first experience | Retire as the front door | It is too abstract for the builder and too close to unsupported legal assessment. |
| Global/enterprise SaaS architecture | Defer | It is inappropriate before local product pull and security capacity exist. |

## 3. Trust and evidence model

Curb must never blend different kinds of information. Each material statement has one provenance class, source reference and scope.

| Provenance class | Example | What Curb may say |
|---|---|---|
| `observed` | An `@ai-sdk/openai` import at a file/line/hash | “OpenAI SDK reference observed in the scanned snapshot.” |
| `declared` | Builder selects “Customer prompts may reach Anthropic.” | “The builder recorded this decision.” |
| `external_evidence` | Provider DPA, account-setting export, signed contract | “This document was attached; reviewer must assess its meaning.” |
| `derived` | A deterministic rule maps a provider reference outside the recorded allowlist | “This defined technical control found a contradiction.” |
| `question` | “Where are prompt logs retained?” | “This requires a decision or evidence.” |
| `legal_review` | Named counsel records a conclusion | “A named reviewer recorded this decision.” |
| `unknown` | Dynamic route/config cannot be evaluated | “Curb cannot determine this from the reviewed inputs.” |

### Non-negotiable integrity rules

- [ ] Untrusted repository text, including comments, READMEs, string literals and prompt-like content, never becomes proof of a practice.
- [ ] A declaration or uploaded document never becomes a verified technical fact merely because it agrees with a desired outcome.
- [ ] Every output sentence about the system links to source evidence, declares its provenance, or is visibly phrased as an unresolved question.
- [ ] No LLM is allowed to alter a deterministic scan result, suppress an `unknown`, activate a legal commitment or produce an untraceable finding.
- [ ] A missing source, parser failure, unsupported pattern or conflict results in `unknown`, `conflicting evidence`, or `external evidence required`, not a reassuring status.
- [ ] The review pack carries the scanned commit/tree hash, rule version, policy-pack version, document hashes and generation time.
- [ ] User-facing prose distinguishes “not found in the scanned scope” from “does not exist.”

## 4. The V1 user journey

### Scenario: Curb’s chatbot fixture and a Stencil-like application

The user points Curb at a local TypeScript chatbot repository. In Curb’s existing example, an approved-provider decision allows Anthropic while a fixture imports an OpenAI provider. In a Stencil-like product, the same experience should surface a repository-backed provider inventory before asking the builder to make policy or legal choices.

1. **Start locally.** The user chooses “Review this AI feature,” selects a local directory and sees a plain privacy boundary: Curb does not execute project code or upload the repository.
2. **Observe.** Curb snapshots supported files and reports activity: indexed files, source types, skipped scope and discovered AI signals. The first useful screen names observed packages, hosts, model identifiers and routing/configuration signals.
3. **Clarify only what evidence cannot answer.** The user is asked focused questions: what data could reach the feature, whether it is customer-facing, intended providers, whether logs are retained, and who owns decisions. “I do not know” creates a tracked question.
4. **Review.** Curb renders an AI System Review organized around observed facts, declarations, external-evidence requests, contradictions and unknowns. It does not calculate a legal-compliance score.
5. **Act.** Each review finding has one bounded next action: record approved providers, inspect logging, attach provider terms/settings, add a user disclosure, or take a question to counsel.
6. **Export.** The user can create an “AI System Technical Review Pack” PDF/Markdown with evidence, limitations, open questions, owners and a dedicated legal-review section.
7. **Maintain.** Once a user records a concrete technical decision, Curb can use the existing deterministic engine to warn when a future repository revision contradicts it.

### Visible analysis activity

The UI exposes actual work, not hidden reasoning or decorative loading:

```text
Repository snapshot        ✓ 184 files indexed; 7 excluded; code never executed
AI integration discovery   ✓ OpenAI package; ✓ Anthropic host; • checking routes
Evidence assessment        • mapping observed signals to review topics
Integrity checks           ✓ comments excluded as evidence; ✓ hashes recorded
```

Each line links to evidence or scope limits. The user can cancel and inspect completed findings while an analysis is still running.

## 5. Initial UK/EU review coverage

V1 is an educational and technical-review product for UK/EU context, not an engine that decides whether a law applies. It records jurisdiction scope (`UK`, `EU`, `both`, `undecided`), organisation role (`unknown`, `controller`, `processor`, `deployer`, `provider`) and relevant users/data. Curb uses these to select questions and to say “may need review,” never “you are required to comply.”

### Initial findings: deliberately limited to five

| ID | Trigger/evidence | Finding produced | Safe boundary |
|---|---|---|---|
| `provider-inventory` | Registered packages, hosts and model IDs in supported source | Provider(s) observed, with exact locations | Does not prove runtime recipients. |
| `provider-decision` | Observed provider has no recorded allowlist/owner | Provider use is unrecorded; ask for an approved-provider decision | Does not infer contractual permission. |
| `provider-drift` | A later scan finds an unapproved provider reference | Defined control contradiction, with evidence | Only applies after a human records the decision. |
| `routing-complexity` | Proxy/fallback/multiple provider signals | Route/fallback evidence needs review | Does not infer actual proxy behavior. |
| `external-evidence-gap` | Builder wants a retention/training/residency statement without attachment | Explain that repository evidence cannot substantiate the statement | Does not assess provider terms or account settings. |
| `customer-transparency-question` | Builder declares a customer-facing AI interaction | Ask whether users are clearly informed and attach UI evidence | Requires human/UI review; no legal conclusion. |

The coverage reflects current UK/EU guidance that organisations should document AI data-processing risks and mitigations, and that AI governance includes inventories, third-party components, roles and monitoring. It is not a restatement of every legal obligation. Source material for later PRD work: ICO, “Guidance on AI and data protection”; EDPB Opinion 28/2024; Regulation (EU) 2024/1689; NIST AI RMF/Generative AI Profile. Re-verify all sources before release.

`prompt-logging-signal` is deliberately deferred. It is a potentially valuable discovery, but static detection of logging/data flow is too easy to overstate. Add it only through a separate versioned policy card with supported framework patterns, a narrow syntax/data-flow boundary, a labelled adversarial corpus and demonstrated user value.

### Finding order and one-person ownership

The workspace shows one primary action at a time. Ordering is deterministic: defined contradiction first, then unknown routing, then missing provider decision/owner, then external-evidence gap, then educational question. V1 treats the builder as the initial decision owner; a review date is a reminder, not a legal approval or a claim of organisational governance.

## 6. AI feature constraint: no API keys

### Decision

V1 must work without an API key. Curb’s deterministic scan, review findings and export must not depend on any model service. This preserves a useful product for users without a paid ChatGPT plan and provides an honest fallback during model outages or usage limits.

OpenAI’s current official “Sign in with ChatGPT” documentation describes an optional supported route for open-source, locally hosted apps: eligible Plus/Pro users may authorize an app to use their plan for eligible AI requests, without giving the app their API key. This is not a general SaaS backend: commercial hosted access is currently a limited/selected-partner path. Curb may evaluate this route after V1, but it is not part of the V1 launch path or the basis for trusted results.

### V1 design

- [ ] All scan, classification, review findings and report generation are deterministic and local.
- [ ] Education is curated, source-cited decision content and branching questions when no assistant is connected.
- [ ] The UX labels structured questions as questions, never as legal advice.
- [ ] No API key, browser automation, copied session token, account scraping or credential-sharing workaround is permitted.

### Post-V1 assistant boundary and guardrails

The optional assistant has exactly three allowed jobs: explain a source-backed finding in plain language, turn a selected unresolved item into questions for the builder, and draft a lawyer-review question from selected sources. It cannot scan the repository, browse, execute tools, determine legal applicability, create a verified fact, change a deterministic result, or write directly into the canonical review record.

- [ ] Curb sends only a user-selected, structured evidence packet: provenance labels, finding IDs, quoted ranges/locations approved for sharing, scope limitations and the relevant curated guidance excerpt.
- [ ] It does not send the repository tree, arbitrary source files, secrets, comments or external documents by default.
- [ ] The response is schema-validated into `assistant_draft` fields with source-finding IDs. Invalid, uncited or out-of-scope content is rejected.
- [ ] Every draft is visibly labelled as assistance, editable by the user and stored separately from observed/derived evidence.
- [ ] Prompt injection in selected text is treated as untrusted content; the assistant is instructed to ignore embedded directions and Curb renders it as data, not authority.
- [ ] The assistant uses no external retrieval. Legal/source guidance is a versioned local content pack selected by jurisdiction, and every assisted answer names that pack/version.
- [ ] An adversarial test suite proves the assistant cannot cause a pass, erase an unknown, manufacture a citation or turn a comment into evidence.

### Post-V1 gate

Only evaluate the optional assistant after Phase 5 coverage/release gates pass and Phase 6 users ask for it. If it is unavailable, the user declines permission, their plan is ineligible, or a request fails, Curb stays fully usable. It shows deterministic observations, curated guidance and structured questions; it never blocks a review or degrades a result to an invented answer.

## 7. Phased implementation plan

Each phase ends in a reviewable artifact and a decision. A later phase cannot make claims that an earlier integrity gate has not earned.

### Phase 0 — evidence of an urgent job

**Goal:** decide whether the candidate segment has a repeatable problem worth solving before building a new review system.

- [ ] Interview or observe 5–8 authorised UK/EU B2B builders in one segment, beginning with the product owner where possible.
- [ ] Collect 2–3 real, authorised and sanitised scenarios: customer question, upcoming launch, provider change, or questionnaire. Do not collect source code or contracts without explicit authority.
- [ ] For each scenario, record trigger, current workaround, time spent, exact desired output, next action, frequency, buyer/budget owner and willingness-to-pay signal.
- [ ] Produce a one-page wedge decision: chosen user, buyer, trigger, competing workflow, single first-run artifact, measurable action and stop condition.
- [ ] Build the golden scenario from public/synthetic code: intended Anthropic-only routing, an overlooked OpenAI fallback, a dynamic-routing `unknown`, owner/date, a fixed revision and a delta.
- [ ] Stop or revise if no repeated urgent job, concrete action or credible adoption signal appears.

**Discovery exit criteria**

- [ ] At least three target users independently say the same specific output would help them at a defined moment.
- [ ] The golden scenario demonstrates a result that a generic questionnaire cannot produce: unexpected provider evidence plus an honest `unknown`.
- [ ] The product owner chooses one buyer and one trigger, rather than combining indie education, counsel handoff, security review and SaaS collaboration into V1.

### Phase 1 — product boundary and evidence specification

**Goal:** turn this discovery draft into an approved product contract before code changes.

- [ ] Replace Stencil scenario assumptions with verified facts only if the owner authorises access.
- [ ] Define the review-record schema and provenance classes in an ADR/spec.
- [ ] Write the exact wording rules for observed, declared, external, derived, legal-review and unknown items.
- [ ] Define the five initial findings, their evidence prerequisites, non-claims and expected actions.
- [ ] Write the first activity-view content and empty/error/cancel states.
- [ ] Decide the review-pack format: Markdown canonical source plus local PDF export.
- [ ] Write acceptance examples for the Curb chatbot fixture: Anthropic decision, OpenAI reference, expected contradiction and evidence links.
- [ ] Define supported V1 scope: macOS with Node 24, a local Git working tree, TypeScript/JavaScript files only, 1 MiB per-file cap inherited from the engine, no code execution and no source upload.
- [ ] Define evidence-content governance: named content owner, source/version/citation fields, update cadence, stale-content review trigger and removal process for UK/EU guidance.

**Integrity exit criteria**

- [ ] Every proposed user-facing statement has a provenance class and a safe fallback.
- [ ] No item uses “compliant,” “legal,” “safe,” “verified,” or equivalent wording without a defined authority/source.
- [ ] A product owner approves the scope; this approval does not substitute for legal/policy approval.

### Phase 2 — local AI System Review foundation

**Goal:** make the current deterministic engine produce a structured observation bundle that a local UI can consume.

- [ ] Add a versioned `ReviewRecord` schema without changing existing scan-result semantics.
- [ ] Add an observation adapter around the existing snapshot/evaluator output: providers, locations, exclusions, unknown files and hashes.
- [ ] Add explicit provenance metadata to every observation and derive no system practice from comments.
- [ ] Add a local workspace format that keeps raw source out of reports by default and records only user-approved excerpts/locations.
- [ ] Implement deterministic review finding generation for `provider-inventory`, `provider-decision`, `provider-drift` and `routing-complexity`.
- [ ] Add fixtures for the current mutated/fixed/catalog chatbot cases and a Stencil-like generic chatbot fixture, with no real Stencil code copied in.
- [ ] Make reports say “not found in scanned scope” and list exclusions/unknowns.
- [ ] Specify local data handling: workspace path outside the reviewed repository, restrictive file permissions, redacted report defaults, explicit delete command, no document ingestion/OCR in V1, and no automatic scanning of lockfiles, binaries, `.env` files or secret-bearing artifacts.

**Security and evaluation gates**

- [ ] Test that misleading comments and READMEs cannot create an observation or pass.
- [ ] Test conflicting declaration versus observed provider evidence.
- [ ] Test dynamic/unsupported input becomes unknown rather than a negative assertion.
- [ ] Test all result text links to a location/hash or is visibly a declaration/question.
- [ ] Run engine typecheck/tests; add independent review because engine paths are high risk.

### Phase 3 — professional local-first frontend

**Goal:** evolve the existing prototype into an evidence-first review workspace, without a server or source upload.

- [ ] Replace framework-picker-first onboarding with “Review this AI feature.”
- [ ] Deliver V1 as a local Node CLI that scans and writes a local review bundle outside the repository, then starts/opens a loopback-only review UI with a one-time session token. Do not claim a browser alone can recursively scan arbitrary directories.
- [ ] Clearly disclose the supported runtime, local workspace location, permissions, no-upload boundary, offline behaviour and delete-workspace action.
- [ ] Add the persistent Analysis activity panel with truthful progress, counts, exclusions, cancellation and partial results.
- [ ] Render source-backed observations separately from builder declarations and external-evidence requests.
- [ ] Add guided, evidence-linked questions for data categories, customer-facing interaction, intended providers, logging/retention question and named owner.
- [ ] Keep “I do not know” as a first-class answer and open question.
- [ ] Add accessibility, keyboard navigation, narrow-screen states and non-deceptive loading/error states.
- [ ] Update frontend README and product copy so it no longer presents a generic framework assessor.
- [ ] Preserve a clean extension point for post-V1 assistance, but ship no model-connected UI in V1.

**UX and integrity gates**

- [ ] A first-time user can identify one observed provider and one unresolved question in under five minutes on the fixture.
- [ ] The UI never displays self-report as verified evidence.
- [ ] The UI never offers a compliance score or a definitive legal conclusion.
- [ ] A user can inspect sources and scope limits for every material finding.
- [ ] Frontend tests/typecheck pass; visual/manual accessibility review is recorded.

### Phase 4 — review pack and maintained decisions

**Goal:** turn the review into a useful handoff and a living engineering control.

- [ ] Define the canonical Markdown review pack: scope, system purpose, observations, declarations, evidence inventory, findings, questions, owners, decisions, limitations and legal-review section.
- [ ] Generate PDF only from the canonical review model; render/inspect the result before release.
- [ ] Add source citations, commit/tree hash, policy/rule versions, document hashes and generation metadata.
- [ ] Let a user record an approved-provider decision with an explicit owner and review date.
- [ ] Connect that decision to the existing deterministic scan/delta workflow for a later snapshot.
- [ ] Add a CI-friendly local command that produces observe-only warnings first; blocking is an explicit user-controlled later setting.

**Review-pack gates**

- [ ] PDF and Markdown contain the same material facts and limitations.
- [ ] Every exported evidence claim is traceable; unresolved items stay unresolved in exports.
- [ ] Generated output is tested against malicious repository/document strings for escaping and source attribution.
- [ ] Curb chatbot fixture demonstrates: observe provider, record Anthropic-only decision, find OpenAI contradiction, fix, rerun and show delta.

### Phase 5 — assurance coverage and adversarial evaluation program

**Goal:** prove that the product fails safely and has a disciplined update path.

- [ ] Publish an internal coverage catalogue for every finding/control: source types, preconditions, known blind spots, non-claims, owner and version.
- [ ] Build an adversarial corpus: misleading comments, prompt-injection strings, Unicode/bidi text, aliases/wrappers, dynamic configuration, proxies, generated/minified code, malformed files, oversized files, conflicting evidence and resource-exhaustion probes.
- [ ] Add test oracles requiring `unknown`, `conflicting evidence` or `external evidence required` where confidence is unjustified.
- [ ] Define metrics: unsupported-claim rate, provenance completeness, false-negative disclosures, false-positive triage rate, time-to-first-action and repeat-review completion.
- [ ] Establish a change protocol: issue → minimal reproduction → policy/rule proposal → regression test → independent review → version bump → release note → coverage-catalogue update.
- [ ] Add supply-chain/dependency scanning, reproducible release metadata and a security review plan.

**Release gates**

- [ ] No material generated statement lacks provenance or a visible uncertainty label.
- [ ] New bypasses cannot be marked fixed without a regression test and documented residual risk.
- [ ] Rules/policy packs are versioned and old reports remain interpretable.
- [ ] Independent security review is complete before any external repository/document onboarding claim.

### Phase 6 — evidence of product pull and commercial decision

**Goal:** decide whether Curb should become a hosted SaaS.

- [ ] Require at least three target users to complete the golden scenario independently, correctly distinguish observed from declared evidence, and take a recorded next action without facilitator explanation.
- [ ] Run the local workflow with at least three authorised builders who have an AI feature; record whether each found a previously unrecorded decision/evidence gap and what action followed.
- [ ] Observe whether the resulting decision record helps answer a customer/security/legal question or changes a code/configuration decision.
- [ ] Measure repeat use after a real repository change, not just first-session enthusiasm or PDF export.
- [ ] Test willingness to pay for one clearly stated offer: local review/CI control, rather than a general governance platform.
- [ ] Compare three commercial paths: paid local CLI/desktop, team CI with customer-managed storage, or hosted collaboration. Choose only if user evidence supports it.
- [ ] Decide whether users actually request assisted explanation/drafting; do not treat initial curiosity as product pull.

**Product gate**

- [ ] Do not call Curb SaaS-ready or build multi-tenant storage until repeated external use demonstrates demand, a buyer accepts the data boundary and the security design is staffed/reviewed.

### Phase 7 — hosted SaaS, only after Phase 6

**Goal:** safely add collaboration and hosted convenience without weakening the local trust model.

- [ ] Write a separate hosted threat model, privacy/data-retention design, incident plan and deletion/export process.
- [ ] Implement authentication, authorization, tenant isolation, encrypted storage, scoped secrets, audit logs, backups and monitoring.
- [ ] Use isolated, resource-bounded workers with enforced egress restrictions; scanned code is never executed.
- [ ] Add consented GitHub integration with minimum read-only permissions and pinned commits.
- [ ] Sign releases/evidence where appropriate and implement verification/export controls.
- [ ] Complete legal/privacy/security review before onboarding customer repositories or agreements.

### Phase 8 — optional subscription-backed local assistant, only after Phase 5 and Phase 6

**Goal:** evaluate assisted explanation/drafting without weakening the deterministic product.

- [ ] Re-verify OpenAI’s current Sign in with ChatGPT availability, open-source/local distribution conditions and permitted request scopes.
- [ ] Build it only for a local/open-source distribution, with the user’s explicit permission; never use a subscription/account workaround or claim hosted-SaaS eligibility.
- [ ] Keep OAuth/profile/token handling outside the browser UI, use PKCE/state/nonce validation and protected local credential storage, and add sign-out/revocation handling.
- [ ] Limit assistance to the three allowed jobs: explain a source-backed finding, turn a selected unresolved item into questions, and draft a lawyer-review question from selected sources.
- [ ] Validate every response against a narrow schema before rendering it as an `assistant_draft`; never permit it to alter observed/derived results or the canonical review record.
- [ ] Run assistant adversarial tests proving prompt-injection strings, conflicting comments and unsupported legal questions cannot create a verified fact, result or citation.

**Assistant gate**

- [ ] Ship only if users demonstrate that assistance improves comprehension or action without lowering their ability to distinguish observed, declared and unknown information.

## 8. Explicit anti-toy constraints

- The product cannot infer retention, training use, data residency or runtime routing merely from an SDK import.
- It cannot call a raw source-comment statement proof, even if the statement says it is compliant.
- It cannot transform “I do not know” into a green status.
- It cannot hide unknown files/exclusions to make a scan look clean.
- It cannot use an LLM to decide legal applicability or create a trusted result.
- It cannot claim that a document means what a lawyer has not reviewed.
- It cannot be a hosted repository/document product without the dedicated security and privacy work in Phase 7.

## 9. PRD-ready questions for product-owner validation

Answer these after reading the draft; the answers become inputs to a PRD, not assumptions coded into the product.

1. What is the first real AI feature to review: Curb’s fixture, Stencil, or another authorised repository?
2. For the first user, is the urgent moment “before launch,” “during enterprise sales,” “after a customer security question,” or “before adding another provider”?
3. Which one result would make the session worth repeating: a provider inventory, logging discovery, review pack, CI drift warning, or another outcome?
4. Is local-only operation a hard requirement for the first release?
5. Which UK/EU user context should be first: customer-support chatbot, content generation, internal assistant, or another narrow use case?
6. What external evidence can the user realistically attach or record without needing a lawyer: provider terms URL, DPA, settings screenshot/export, privacy notice, architecture diagram?
7. Does the user want Curb to recommend an action, draft a question for counsel, or both? What wording would feel helpful without overclaiming?
8. What outcome would prove the product is not fluff: a code change, a recorded product decision, a customer answer, a lawyer review, or paid repeat usage?

## 10. Approval and next action

On approval, convert this draft into the repository’s canonical `plan.md` or an agreed replacement, create a matching `CURB` ticket before implementation, and break Phase 0 into independently reviewable tasks. No production, legal or SaaS-readiness claim is authorized by approval of this document.

## References to re-check before PRD/release

- [ICO, Guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/what-are-the-accountability-and-governance-implications-of-ai/): accountability/governance and DPIA guidance.
- [European Data Protection Board, Opinion 28/2024](https://www.edpb.europa.eu/documents/opinion-of-the-board-art-64/opinion-282024-on-certain-data-protection-aspects-related-to_ga): personal data in AI models.
- [Regulation (EU) 2024/1689](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689): EU AI Act, especially Articles 4 and 50; applicability must be assessed case by case.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) and [Generative AI Profile](https://airc.nist.gov/docs/NIST.AI.600-1.GenAI-Profile.ipd.pdf): voluntary risk-management guidance.
- [OpenAI Developers, Sign in with ChatGPT quickstart](https://developers.openai.com/siwc/quickstart) and [open-source/local plan-usage overview](https://developers.openai.com/siwc/token-sharing-open-source): verify availability and the current integration conditions before implementation.


# Persona brief: product-owner builder

Status: DRAFT for PRD discovery. Built from one product-owner conversation on 14 October 2026. It is not market research, legal advice or a claim about all indie developers.

## Purpose

This brief provides the initial persona for Curb’s local-first V1. A future PRD may use it as a starting point, but must preserve the distinction between direct evidence, working hypotheses and unanswered questions.

## Persona summary

**Working name:** Product-owner builder

**Role:** An application builder who owns product decisions and is building or evolving an AI-enabled product. The current reference product is Stencil, but no repository or system detail has been supplied to this workspace.

**Environment:** Initially works alone or as a very small team. Wants a local app before a hosted SaaS. Has a ChatGPT subscription but no API key budget/configuration for a product backend.

**Core need:** Build an AI feature responsibly while understanding the decisions, evidence and questions it creates. Be more prepared to answer customers or seek legal advice later, without being told that the product is legally compliant.

**Success condition:** Uses Curb repeatedly on their own application because it exposes a useful gap, decision or code drift at the moment their AI system changes.

## Direct evidence from the product-owner conversation

| Statement or preference | Product implication |
|---|---|
| “Help me understand the promises a system like this should be making, versus what my system is making currently based on the repo.” | Start with repository-backed discovery and explain the decision space; do not require a contract as the first input. |
| Wants a professional app, not theatrical headings or decorative progress. | Use precise, neutral labels, source-linked results and truthful analysis activity. |
| Wants output that can go to a lawyer later. | Produce a technical evidence/review pack with limitations and open questions, not a legal opinion. |
| Wants Curb to make them a more enabled builder. | Explain why a finding matters and offer one bounded next action. |
| Cares strongly about LLM grounding and hostile inputs. | Separate observed facts, declarations, external evidence, questions and unknowns; keep LLMs out of trusted verdicts. |
| Wants UK/EU as the first regional boundary. | Use UK/EU content packs and jurisdiction fields, but do not decide legal applicability. |
| Has no API keys and wants subscription-based AI features where possible. | V1 must work without a model service; evaluate a supported local Sign in with ChatGPT route only after deterministic controls and evals are mature. |
| Wants a portfolio-quality product that may become SaaS. | Make the local product coherent and falsifiable first; defer hosted SaaS until repeated use and security capacity exist. |
| “We need to win myself as a repeat user first.” | V1’s primary outcome is repeat use on the owner’s own AI application, not customer acquisition or legal-review volume. |

## Jobs to be done

### Functional jobs

1. When adding or changing an AI feature, help me see which AI providers, routes and technical signals exist in my repository.
2. Help me record the intended decisions, such as approved providers and an owner, without claiming that my declaration is verified.
3. Show where repository evidence contradicts a recorded technical decision or where Curb cannot determine the answer.
4. Help me identify what requires external evidence, product/UI review or legal advice rather than another code scan.
5. Give me a concise, traceable local review pack I can revisit or take to a lawyer/customer later.

### Emotional jobs

1. Feel informed rather than intimidated by AI/privacy/governance terminology.
2. Avoid making customer-facing claims that the system cannot support.
3. Trust that the product is not inventing certainty, hiding uncertainty or using AI theatrically.
4. Feel that the time spent using Curb improves the product, not just its paperwork.

## Primary journey

```text
AI feature changes
        ↓
Open local Curb review
        ↓
See repository-backed AI/provider observations and scope limits
        ↓
Answer only the questions code cannot answer
        ↓
Record a decision, evidence request or open question
        ↓
Make a code/configuration/product change if needed
        ↓
Re-run after a later change and see a useful delta
```

## Product principles for this persona

- **Local before hosted.** Repository and review data stay local in V1; Curb never executes scanned code.
- **Evidence before prose.** The UI leads with observed locations, hashes and scope limits, then gives explanation.
- **Questions before claims.** If Curb cannot establish retention, training use or runtime routing, it asks for evidence or records `unknown`.
- **One useful next action.** A finding should lead to a specific decision, source to gather, code/config change or review question.
- **Visible work, no fake certainty.** Activity states report actual scanning, parsing, exclusions and integrity checks, not hidden reasoning.
- **No legal impersonation.** Curb prepares technical context for review; it does not decide compliance or legal applicability.
- **No LLM trust escalation.** Any future assistant can explain selected evidence and draft questions, but cannot create verified facts or change deterministic results.

## Design characteristics

| Characteristic | Design response |
|---|---|
| Technically curious, but not expected to know legal frameworks | Use plain language with expandable source/citation detail. Avoid framework-picker-first onboarding. |
| Values robust systems and adversarial thinking | Surface provenance, exclusions, adversarial coverage and uncertainty in a concise, inspectable form. |
| Needs practical progress | Show activity and partial findings while scans run; make cancellation and scope visible. |
| Wants a professional artifact | Use an “AI System Technical Review Pack” with consistent Markdown/PDF facts, not a generic checklist export. |
| Is cost/API-key constrained | Ensure the core review is deterministic and offline. Treat model assistance as a separate, optional later layer. |
| Is evaluating both portfolio and SaaS potential | Make the first scenario runnable, demonstrable and repeatable before adding multi-tenant infrastructure. |

## Pain points to validate

These are plausible but unproven until Curb is used on the owner’s actual repository.

- A provider SDK, proxy, fallback or model configuration may be present outside the builder’s immediate mental model.
- Existing customer-facing statements may be stronger than the available technical evidence.
- Repository code, vendor terms, account settings and product UI may be disconnected when the builder needs to answer a question.
- A generic framework checklist may be less useful than a repository-specific discovery.
- A review pack may be useful only if it leads to a real action or conversation, rather than merely creating documentation.

## Non-goals for V1

- Replace legal advice, a DPO, security review or vendor due diligence.
- Score legal compliance or declare an application safe.
- Prove provider retention, training use, data residency or runtime routing from static code alone.
- Force a user through a broad governance questionnaire before showing repository value.
- Require a ChatGPT account, API key, external upload or hosted account for the core workflow.

## Questions the PRD must answer

1. Which exact Stencil AI feature and repository path is the first authorised review target?
2. What event should trigger repeat use: a provider change, release, customer question, new feature, or scheduled review?
3. What is the smallest first-run result that would justify five minutes of the builder’s time?
4. What result would make the owner trust Curb enough to record a decision or make a change?
5. What information can be safely retained locally, exported, or redacted by default?
6. Which product wording feels helpful and professional without becoming legal-sounding or alarmist?
7. What concrete evidence would demonstrate repeat value after the first review?

## Validation signals

- The owner can correctly distinguish observed evidence, a builder declaration, external evidence needed and `unknown` without coaching.
- The owner finds one previously unrecorded provider/routing decision or evidence gap.
- The owner records a decision, attaches a source reference, changes code/configuration, or prepares a question for review.
- The owner voluntarily reopens Curb after a meaningful repository change.
- The owner would miss Curb if it were removed from their local workflow.


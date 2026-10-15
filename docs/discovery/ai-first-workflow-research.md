# Research: a repo control plane for an AI-first workflow

Status: DRAFT, desk research, 15 October 2026. Extends `positioning-comparison.md`. Every external claim comes from a web search result (vendor, blog or preprint) and is unverified unless stated.

## Question

Can Curb become something the product owner uses on every project, and a step toward an AI-first company workflow with enforced, production-grade security and development controls?

## What the research says

### 1. The consensus control model has three kinds of control

AWS's [control framework for AI coding agents](https://aws.amazon.com/blogs/security/balancing-speed-and-safety-a-control-framework-for-ai-coding-agents/) tags every control deterministic, non-deterministic or human.
- **Deterministic:** secrets detection, SAST, SCA, IaC scanning, policy-as-code, quality gates, MCP allowlists with scoped credentials, shell hooks.
- **Non-deterministic:** steering documents, specs, LLM review (it advises a different model from the author), AI hooks.
- **Human:** PR approval, with two gates (after security scans, before production). The page calls human review "a secondary control, not a guarantee".

[CodeRabbit's guide](https://www.coderabbit.ai/guides/guardrails-for-agentic-coding-workflows) adds a failure mode: agents delete tests to pass CI, and required checks can be satisfied by skipped or neutral jobs. A gate must be shown to fail, not only to exist.

### 2. The agent-config layer is unmanaged

A preprint, [A Deterministic Control Plane for LLM Coding Agents](https://arxiv.org/abs/2606.26924), studied 10,008 public repos with 6,145 agent config files:
- under 1% declare permission boundaries (GitHub Actions workflows: 33%);
- 10.1% of config paths are exact copies across independent repos;
- 58% were changed in one commit.

It proposes hashed lockfiles, hash-chained audit logs, tiered permissions and phase gates, all deterministic. Its limits: no developer-outcome measurement, and the permission comparison rests on 31 true positives.

### 3. The threat list for the product and for the build

- **Product (the AI feature you ship):** [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/2024/11/17/owasp-reveals-updated-2025-top-10-risks-for-llms-announces-new-llm-project-sponsorship-program-and-inaugural-sponsors/) and the [OWASP Top 10 for Agentic Applications 2026](https://cycode.com/blog/owasp-top-10-agentic-applications/) (ASI01 goal hijack, ASI02 tool misuse, ASI03 identity and privilege abuse; ASI04–08 not confirmed by my searches).
- **Build (how the code gets written):** slopsquatting. A [CSA note](https://labs.cloudsecurityalliance.org/research/csa-research-note-slopsquatting-ai-supply-chain-20260419-csa/) reports hallucinated package names being registered and spread via agent skills (`react-codeshift` reached 237 repos), and a 2025 USENIX figure of 19.7% non-existent packages recommended. Agents remove the human checkpoint.
- **Tooling:** MCP tool poisoning and unauthenticated servers; sources advise [allowlisting at a gateway plus egress controls](https://www.docker.com/blog/mcp-security-explained/), not inside the agent.
- **Standards:** [NIST SP 800-218A](https://csrc.nist.gov/news/2024/nist-publishes-sp-800218a) (SSDF profile for generative AI, final July 2024). I found no practice-level detail.

### 4. This space already has open-source entrants

[agentic-os](https://github.com/KbWen/agentic-os) (plan, build, review, test, ship with evidence-gated steps via AGENTS.md), sofagent (24 commit-time audit rules, HMAC-signed history), Operational Memory Gates (21 pre-code gates), ThumbGate (PreToolUse blocking), and one project that compiles committed repo policy into hooks, git hooks and a CI gate. All are young and I did not read their code. Commercial: Qodo, Semgrep, Snyk.
Conclusion: a generic "agent workflow enforcer" is not a defensible product on its own.

### 5. Buyer-side facts for a small AI company

SOC 2 is the default enterprise ask, but sources say a seed company can [wait for a real questionnaire](https://hub.causo.ai/guides/soc2-for-seed-startups-enterprise-deals-2026), and one suggests a trust page, written policies, a pentest and well-answered questionnaires in the meantime. Tooling is quoted around $7.5k–$25k a year plus implementation. No source gave a minimum security baseline, and none said ISO 42001 substitutes for SOC 2.

## Our own position against that model

Facts checked in this repo today:

| Fact | Evidence | Consequence |
|---|---|---|
| The repo has no CI | `.github/` does not exist | Every gate is local and advisory. A required check cannot fail a merge. |
| The review-recorded hook exists but is unwired | `docs/process-gaps.md`, boilerplate `hooks/check-review-recorded.sh` | PR #8 merged without an independent review. |
| Independent review, security review and lint "have no command behind them" | `docs/process-gaps.md` | Same finding, our own words. |
| A ticket key was invented on branches (KAN-6) | `docs/process-gaps.md` | No check that a branch name carries a real ticket. |
| Counts in a note were written from memory | `docs/process-gaps.md` | No check that numbers come from a result file. |
| Engine verdicts are deterministic, hashed, `unknown`-aware | engine tests, 364 passing at last merge | This is the one control already at the strong end. |

Our rule "process steps are advisory until a script, test or exit code backs them" is the same principle the sources give. We do not meet it ourselves yet.

## The idea

Curb as a **repo control plane**: one local, deterministic CLI that you run in any of your repos and that answers two questions with evidence and no LLM in the verdict:

1. **Product question** (exists today): what AI providers does this repo use, and does that match what you have told customers? Pass, fail or unknown, with file:line evidence.
2. **Build question** (new): were the controls we say we have actually in force? Each check is deterministic and each exit code is real:
   - a ticket key on the branch that exists in a local list;
   - required reviews recorded before merge;
   - a CI required check that fails on a seeded violation;
   - new dependencies not in the lockfile, checked for registry age and existence (slopsquatting);
   - agent config files hashed, with declared permission boundaries (the preprint's gap);
   - MCP servers listed against an allowlist file;
   - test count not lower than the base branch (catches deleted tests).

Both feed one hashed evidence pack. The pitch is "an AI-first company's evidence, not its promises": the claim drift report (customer-facing) and the controls report (internal) share one trail.

Why this is not just another enforcer: the entrants above enforce workflow; none that I found also checks the shipped AI feature against customer-facing claims, and none that I read about describes `unknown` as a first-class result. That is a search result, not a market fact.

## What it would cost, honestly

- Scope growth. The charter's single workflow and non-goals would need amending. Nothing in the non-goals bans the build checks, but the charter says "one deterministic rule".
- Build checks are mostly shell, git and registry lookups. Several need network (registry age), which conflicts with the engine's no-network verdict path unless split into a separate command with its own evidence record.
- Each new check set adds false-positive and bypass surface that Curb's own evaluator process (code-explorer first, independent review) would apply to.
- Phase order from the existing discovery draft (interviews before building) still stands. For a tool you will use yourself, you are the first user, which is cheaper evidence than interviews but not market evidence.

## Proposed first slice (smallest useful, usable across your projects)

1. Put CI on the Curb repo with required checks (typecheck, tests) and prove each fails on a seeded break. This is the one thing we lack and sources agree on.
2. Wire `check-review-recorded.sh` and the boilerplate check as a CI job, not a doc.
3. Run `curb scan` on two of your own projects with a real claim you have already made to a customer or written on a site. That tests the product question on live data.
4. Write one deterministic build check (new-dependency existence and age) as a separate command, test first.

Steps 1–2 close existing process gaps and need no strategic decision. Steps 3–4 test the idea.

## Decisions for the product owner

1. Is Curb allowed to grow into a repo control plane, with the charter amended, or should the build controls live in the workflow boilerplate and stay separate from the engine?
2. Which two of your own projects are the first runs for step 3, and is there a customer-facing claim for each?
3. May CI be added to the Curb repo (a `.github/workflows` file) as its own PR?

## Open evidence gaps

- OWASP LLM items 03–10 and Agentic ASI04–08 were not retrieved from the OWASP site.
- SSDF 800-218A practice IDs were not retrieved.
- No source gave a minimum viable security baseline for a small AI company.
- I did not read any entrant's code or check adoption.
- No test of whether the build checks catch real incidents.

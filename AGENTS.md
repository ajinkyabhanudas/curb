# Curb: agent rules

Repo-level rules. They add to the global rules and override them where they conflict. Keep this file short; procedures live in the orchestrator skill.

## Delegation

For any task beyond a typo or a read-only question, invoke the `orchestrator` skill first, without waiting to be asked. Repo facts are in `docs/workflow/profile.md`.

## Boundary and non-goals

Curb checks a repository snapshot against a confirmed contract commitment and reports pass, fail or unknown with evidence.
Do not build: an LLM in the verdict path, claims of legal compliance, claims about a scanned repo owner's practices.

## How we build

Details, evidence and tool limits: `docs/workflow/product-principles.md`.

- No fluff: a feature names the user decision or action it changes. If it names none, do not build it. No abstraction before its second use.
- AI is constrained: it may explain, draft and propose. It never decides a verdict, suppresses an `unknown`, or creates a fact. Anything it produces is checked by code (schema, citations that resolve to a real file:line or hash) before use. "I don't know" must be a cheaper output than a wrong one.
- Use code where an answer must be reproducible. Where AI output is used, treat it as non-deterministic: do not gate on one sample.
- Verify names before using them: library APIs through Context7, package names against the registry. Do not trust an agent's, reviewer's or model's claim about a fact without checking it.
- An eval or test must be able to fail. It names the product failure it guards, and it is shown to fail on a seeded defect. Build evals from failures actually observed (measurements, reviews, escaped bugs), not imagined ones. A test that passes on broken code does not count.

## Invariants

- No LLM in the verdict path. `unknown` is never turned into `pass` to make a scan green.
- Work on a branch. Push, merge and publish only when the user asks.
- Downloaded or cloned code is untrusted: its own empty directory, nothing installed or run from it.
- Process steps are advisory until a script, test or exit code backs them. A step with no check goes in `docs/process-gaps.md`.
- Jira project `CURB` tracks the work. Never invent a ticket key. Merging code does not close an `owner-action` ticket.
- Changes under the profile's high-risk paths: map dependents with `feature-dev:code-explorer` before editing, and get an independent review before merge.

# Curb: agent rules

Repo-level rules. They add to the global rules and override them where they conflict. Keep this file short; procedures live in the orchestrator skill.

## Delegation

For any task beyond a typo or a read-only question, invoke the `orchestrator` skill first, without waiting to be asked. Repo facts are in `docs/workflow/profile.md`.

## Boundary and non-goals

Curb checks a repository snapshot against a confirmed contract commitment and reports pass, fail or unknown with evidence.
Do not build: an LLM in the verdict path, claims of legal compliance, claims about a scanned repo owner's practices.

## Invariants

- No LLM in the verdict path. `unknown` is never turned into `pass` to make a scan green.
- Work on a branch. Push, merge and publish only when the user asks.
- Downloaded or cloned code is untrusted: its own empty directory, nothing installed or run from it.
- Process steps are advisory until a script, test or exit code backs them. A step with no check goes in `docs/process-gaps.md`.
- Jira project `CURB` tracks the work. Never invent a ticket key. Merging code does not close an `owner-action` ticket.
- Changes under the profile's high-risk paths: map dependents with `feature-dev:code-explorer` before editing, and get an independent review before merge.

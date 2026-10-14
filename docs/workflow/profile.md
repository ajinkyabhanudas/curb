# Workflow profile

Facts about this repo. The orchestrator reads this file. Facts only, no procedure.

## Repo
name: curb
boundary: deterministic verifier that checks a repository snapshot against a confirmed contract commitment
non-goals: LLM in the verdict path, legal compliance claims, claims about a scanned repo owner's practices

## Tracker
system: jira
site: https://circaid.atlassian.net
project key: CURB
epics: CURB-6 engine; CURB-7 discovery and human gates; CURB-8 capability delivery; CURB-9 validation and release

## Checks
kind: mechanical = exit code decides; advisory = no check backs it, log in docs/process-gaps.md.
| gate | command | kind |
|---|---|---|
| typecheck | cd engine && npx tsc --noEmit | mechanical |
| tests | cd engine && npx vitest run | mechanical |
| lint | none | advisory |
| independent review | none | advisory |
| security review | none | advisory |

## High-risk paths
Independent whole-branch review and security review before merge: engine/src/evaluator/, engine/src/snapshot/, engine/src/store/, engine/src/schema/, engine/policies/

## Git
default branch: main
feature branches merge into: main
merge and push: only when the user asks

## MCPs
| server | used for | if down |
|---|---|---|
| atlassian | find the CURB ticket, comment, transition | user runs /mcp to reconnect; give the comment text |
| github or gh | PRs and checks | use gh |
| context7 | TypeScript compiler API, vitest docs | say docs were not fetched |

## Invariants
- No LLM in the verdict path. Results are deterministic.
- unknown is never turned into pass to make a scan green.
- A policy card change bumps the card version; evaluator behaviour change bumps EVALUATOR_VERSION.
- Scanning a third-party repo: pinned commit, own scratch directory, install and run nothing from it, write docs/curb/real-repo-measurement-NNN.md, no claims about the owner's practices.

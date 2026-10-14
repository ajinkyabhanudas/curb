# Process gaps

Friction, escaped defects and uncovered steps in how this repo is built. One line each. Review at the close of every phase.

Format: `[date] [stage] what happened | what would help (unknown is fine) | seen: N | decision: open|promote|hold|revert`

When a bug or review finding gets through, record the stage that should have caught it.
Promote a gap to a rule, test, script or skill when seen twice. Delete one with no recurrence after five phases.
A change to the workflow itself (skills, hooks, rules) also gets a line: the signal, the one hypothesis, the check, the decision.

- [2026-10-14] [review] PR #8 (detection fix) merged with no independent review; only the author's own checks | a check that fails a merge when no approving review exists (boilerplate hooks/check-review-recorded.sh) | seen: 1 | decision: open
- [2026-10-14] [merge] #6 merged into main before #8 merged into its base, so the fix missed main and needed #9 | merge stacked PRs bottom first; confirm with git log origin/main | seen: 1 | decision: open
- [2026-10-14] [tracker] Branches and a PR used KAN-6, a key that did not exist | require a CURB ticket key before a branch is created | seen: 1 | decision: open
- [2026-10-14] [workflow] Independent review, security review and lint have no command behind them (advisory) | CI job or script per gate | seen: 1 | decision: open
- [2026-10-14] [workflow] First real task (CURB-16 second-repo scan): the new orchestrator could not be invoked as a skill because the session had loaded the old skill list; SKILL.md was followed by hand | restart the session after adding a skill, then confirm it triggers unprompted | seen: 1 | decision: open
- [2026-10-14] [workflow] Same task: no skill covers a third-party scan; the steps live only as a profile invariant | decide whether a measurement path belongs in the generic skill or the profile | seen: 1 | decision: open
- [2026-10-14] [review] Measurement 002 note has no independent reviewer; its counts were first drafted from memory and two were wrong (fixed after grepping the routes) | require counts in a note to come from the result file, not recollection | seen: 1 | decision: open

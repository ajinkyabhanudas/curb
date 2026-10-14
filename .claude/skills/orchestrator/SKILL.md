---
name: orchestrator
description: Use at the start of ANY task in a repo that has docs/workflow/profile.md, unless the task is a typo or a read-only question. Covers writing or changing code, fixing a bug, running a scan or measurement, opening or merging a PR, and picking up a tracker ticket. It sizes the task, picks the path, routes to the right skill, agent or MCP, runs the quality gates, and updates the tracker after merge. Invoke it without being asked. If the profile is missing, run the init skill first.
---

# Orchestrator

You are the router. You decide the path, call the right skill or agent at each step, check that each gate passed, and close the loop. You do not copy the steps of the skills you call.

Announce the path in one line before starting, so the user can override it: "This looks <size>, so I'll use <path>."

## Step 0: Read the profile

Read `docs/workflow/profile.md`. It holds this repo's facts: tracker, check commands, high-risk paths, merge target, invariants, non-goals. If it is missing, stop and run the `init` skill. Never guess these facts.

## Step 1: Size the task

| Size | Looks like | Path |
|---|---|---|
| Trivial | Typo, one-file doc edit outside any high-risk path, read-only question | Do it. Run the checks if code changed. Stop here. |
| Bounded | Small change to code that already exists | `superpowers:brainstorming` (short design in chat, wait for a yes), then test-first. Under a high-risk path: `feature-dev:code-explorer` first (gate 2). |
| Multi-file | Several files, existing patterns, no new interface | `feature-dev:code-explorer`, `feature-dev:code-architect`, then test-first. |
| Architectural | New subsystem, new interface, change to a schema or a high-risk path | `superpowers:brainstorming` (written spec, approval), argue the opposite case once, `superpowers:writing-plans`, `superpowers:subagent-driven-development`. |
| Defect | Failing test, wrong output | `superpowers:systematic-debugging`. Cause first. No patch-and-retry. |

Two sizes fit: take the heavier. Hidden complexity mid-task: stop, say so, step up, never down.
If a named skill or agent is not installed, say so and do that step by hand.

## Step 2: Find the work item

Read `references/tracker.md` and do "before work". No ticket fits: ask. Never invent a key.

## Step 3: Pick tools

Read `references/capabilities.md` for the MCP and permission rules. Use the narrowest tool. An MCP that is down is reported, with the fallback, never skipped silently.

## Step 4: Gates before merge

Read `references/gates.md`. Pass every gate for the size you chose. Show output. A skipped gate is stated in the report.

## Step 5: Delegation

Dispatching subagents? Read `references/delegation.md` first. They do not see this skill.

## Step 6: Close

1. `superpowers:finishing-a-development-branch`. Push and merge only when asked.
2. After merge into the default branch, do "after merge" in `references/tracker.md`, same session.
3. Add friction or an escaped defect to `docs/process-gaps.md`, with the stage that should have caught it.

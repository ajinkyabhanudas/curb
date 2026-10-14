# Delegating to subagents

Subagents start cold. They do not see AGENTS.md, the orchestrator or the conversation. Put what they need in a brief file and pass its path.

Every brief carries:
- The task and the files it owns.
- The invariants and non-goals from the profile.
- The check commands, and the report-file path to write to.
- For downloaded or cloned code: untrusted. Own empty directory, nothing installed or run from it, scripts kept elsewhere.
- Scratch work goes in the session scratchpad, not the repo.

Rules:
- Name the model. Cheapest tier for transcription from complete plan text, mid tier for prose specs, the most capable for architecture and the whole-branch review.
- One writer at a time on the same files.
- Reviewers get the diff as a file and the spec, not the implementer's account.
- The implementer never dispatches its own reviewer. The orchestrator does.
- A subagent's "done" is a claim. Re-run the checks before relaying it, and verify its factual claims (hosts, package names, line numbers) before editing from them.
- Point reviewers at a committed range and do not edit the tree while one is reading it; give them real inputs as read-only paths.
- Explorers and some reviewers have no shell, so they cannot run tests or time anything. Say so in the brief and run those checks yourself.

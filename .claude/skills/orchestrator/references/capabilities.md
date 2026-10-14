# MCP servers and permissions

Pick the narrowest tool. Load an MCP tool's schema with ToolSearch only when needed. Every MCP can be down: report it, give the fallback, never skip the step silently. The profile's MCP table lists which servers this repo uses.

| Server | Use for | If down |
|---|---|---|
| Tracker (Jira, Confluence, GitHub issues) | Find the ticket, comment, transition. See `tracker.md`. | User reconnects with `/mcp`. Give the comment text to paste. |
| GitHub, or the `gh` CLI | Branches, PRs, PR state, checks. Read the PR template first. | Use `gh`. Else give the commands. |
| context7 | Current docs for any library or CLI. Resolve the library id first. | Say the docs were not fetched. Do not answer from memory as if they were. |
| Browser (claude-in-chrome) | Only browser-only work. | Not connected: report, stop after 2 to 3 tries, ask. |
| Artifact, Docs | A report others will read, only when the user asks. | A markdown file in `docs/`. |

## Permissions

- A permission block (for example on `gh pr merge`) is the user's decision. Do not find another route to the same action. Say what you were trying to do and let the user run it, e.g. `! gh pr merge <n> --merge`.
- Push, merge, publish and anything visible to others needs a clear yes for that action.

## Handoffs

- Ticket key goes in the branch name and PR title. PR numbers and check results go back into the ticket comment.
- Evidence from one tool (test output, PR state) is re-checked before another tool relies on it.

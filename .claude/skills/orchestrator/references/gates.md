# Quality gates

The profile's Checks table gives the commands and says which gates are `mechanical` (a command's exit code decides) and which are `advisory`. Run mechanical ones and show the output. For an advisory gate, say it has no check behind it and add a line to `docs/process-gaps.md`.

Trivial tasks need gate 1 only, when code changed.

1. **Checks.** Typecheck, tests, lint from the profile. New behaviour: failing test first.
2. **Blast radius.** Before changing a shared symbol, constant or schema, grep for dependents. Bump the version of anything versioned (schema, rules, evaluator). Under a high-risk path, whatever the task size, run `feature-dev:code-explorer` first to map dependents, tests, fixtures and docs that quote the thing you are changing, and read its report before editing.
3. **Simplify.** After tests pass, before review: `code-simplifier:code-simplifier` on the changed files. Same behaviour, tests still green.
4. **Independent review.** The author's verification does not count. Small change: `feature-dev:code-reviewer`. Anything under a high-risk path, or a large branch: a fresh whole-branch reviewer on the most capable model.
5. **Security review.** Required for code that parses untrusted input, handles file paths, auth, storage or permissions.
6. **Real-input check.** A change to detection or parsing logic runs on at least one real input outside the fixtures. A rule tuned on one input is not independently tested.

Report each gate's result. Never write "done" for a capability that is not wired into the live path and exercised by a test.

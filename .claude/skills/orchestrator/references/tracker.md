# Tracker procedure

Tracker system, site and project key come from the profile's Tracker section. Never invent a key. If no ticket fits, ask whether to create one.

If the tracker connection is down, say so, give the comment text for the user to paste, and ask them to reconnect. Do not skip the update silently.

## Before work

1. Search open work for the project. Request only summary, status and labels, to keep output small.
2. Pick the matching ticket. Read its outcome, acceptance criteria and dependencies.
3. Put the key in the branch name and PR title.
4. Tickets that need a named human decision (owners, counsel, licence, security sign-off) are not closed by merging code.

## After merge

"Merged" means merged into the default branch. For stacked PRs, confirm every PR in the stack reached it (`git log origin/<default>`), not only the base of the stack.

1. Comment: PR numbers, what shipped, checks run with results, known limits, what is still open.
2. Move the ticket only if its own acceptance criteria are met. Not an epic while its linked human-decision tickets are open.
3. Update any follow-up or decision ticket the work came from.
4. Do this in the same session, before reporting the work finished.

# Tracker procedure

Tracker system, site and project key come from the profile's Tracker section. Never invent a key. If no ticket fits, ask whether to create one.

If the tracker connection is down, say so, give the comment text for the user to paste, and ask them to reconnect. Do not skip the update silently.

## Before work

1. Search open work for the project. Request only summary, status and labels, to keep output small.
2. Pick the matching ticket. Read its outcome, acceptance criteria and dependencies.
3. Put the key in the branch name and PR title.
4. Move the ticket to In Progress now, and move its parent epic too if it is still To Do. A ticket with work under way that sits in To Do makes the board wrong.
5. Tickets that need a named human decision (owners, counsel, licence, security sign-off) are not closed by merging code.

## When a PR opens

Comment on the ticket with the PR link, checks run and known gaps. Keep it In Progress until the merge. Re-read the board at the end of any session in which several tickets moved, and fix any that disagree with the work.

## After merge

"Merged" means merged into the default branch. For stacked PRs, confirm every PR in the stack reached it (`git log origin/<default>`), not only the base of the stack.

1. Comment: PR numbers, what shipped, checks run with results, known limits, what is still open.
2. Move the ticket only if its own acceptance criteria are met. Not an epic while its linked human-decision tickets are open.
3. Update any follow-up or decision ticket the work came from.
4. Do this in the same session, before reporting the work finished.

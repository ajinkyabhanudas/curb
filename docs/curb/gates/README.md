Status: DRAFT memos prepared by Claude. Each decision belongs to the named human; nothing here is signed or approved.

# Human gates: decision memos

The charter lists four gates that only people can close (`docs/curb/charter.md`, "Human gates still open"). Each memo says what must be decided, why it blocks, the facts in this repository, the options, a drafted recommendation, and where to record the answer.

| Memo | Ticket | Who decides | Blocks |
|---|---|---|---|
| `11-owners.md` | CURB-11 | Whoever owns the product | Every stop condition in the charter; the other three gates need named people |
| `12-counsel-approval.md` | CURB-12 | Counsel or the Legal/policy owner | Dropping "draft, pending counsel approval" from every report, together with gate 4 (the template needs counsel and a security reviewer to both sign) |
| `13-licence-review.md` | CURB-13 | A named reviewer (legal or engineering lead) | Copying or redistributing any scanned third-party source |
| `14-security-review.md` | CURB-14 | The Security owner or an independent reviewer | Onboarding any production tenant |

Suggested order: 11 first (the others need a named person), then 12 and 14 in parallel, then 13 (it only matters if you want a fixture copied).

Rules these memos follow: a recommendation is marked as a drafted recommendation, facts carry a file reference, and no memo claims an approval that has not happened.

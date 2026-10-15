Status: DRAFT memo for CURB-11. The decision is the product owner's.

# Gate 1: name the owners

## Decision needed
Name one person for each role in the charter's Owners table: Product, Technical, Security, Legal/policy. One person may hold more than one role, but each role needs a name.

## Why it blocks
- The charter's stop conditions: stop work on a scan, report or release if there is "no human owner to approve the obligation" (`charter.md`, "Stop conditions").
- Every `confirm` records a named approver. The synthetic demos use a placeholder approver.
- The policy card's `owner` field reads "unassigned (to be named by the product owner)" (`engine/policies/unapproved-provider-reference.v1.json`).
- The other three gates need a person: counsel (CURB-12), a licence reviewer (CURB-13), a security reviewer (CURB-14).

## Facts
- Owners table: all four rows say "unassigned, to be named" (`charter.md`, "Owners").
- Signatures table: empty. The charter Status line stays DRAFT until it is completed (CURB-11 acceptance criteria).
- Any change to card text, including the `owner` field, changes the card hash and needs a version bump (`policy-card-template.md`, "Version history"). Naming an owner in the card is therefore a card release (and obligations bound to the old version must be confirmed again).

## Options
1. **One person holds all four roles.** Fast; works for a solo pilot. Weakness: the same person approves and reviews their own work, so Security and Legal/policy sign-offs carry little independent weight.
2. **Product and Technical held by the builder; Security and Legal/policy held by other people** (a security reviewer, a lawyer or contracts lead). Slower; the sign-offs mean something.
3. **Name owners only for the roles needed now** (Product, Technical) and leave Security and Legal/policy as named gaps with a date. Honest but leaves the charter unsigned.

## Drafted recommendation
Option 2, with the Security and Legal/policy owners chosen first because gates 2 and 4 depend on them. If no independent person exists yet, use option 3 and write the date by which they will be named, rather than naming the builder as their own reviewer.

## Record the answer
- Fill the Owners table in `docs/curb/charter.md`.
- Change the card `owner` field only together with the next card change (it needs a version bump anyway).
- Fill the Signatures table only when gates 2 to 4 are closed; then change the Status line from DRAFT.
- Update CURB-11 with the names and dates.

## What Claude will not do
Choose the people, sign for anyone, or change the Status line.

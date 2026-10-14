Status: DRAFT packet for CURB-23. Not a product claim.

# Demand test packet

Goal: learn whether people who review AI-vendor contracts would use Curb's output, and what they would change. This answers "should the reviewer view (CURB-22) be built, changed or dropped" before any interface is built.

## What is here

| File | Use |
|---|---|
| `explainer.md` | One page to hand over or read out. What Curb is, input, process, output, what it does not claim. |
| `sample-report-fail.md` | The report for a synthetic repository that references an unapproved provider. |
| `sample-report-pass.md` | The report after the seeded fix. |
| `sample-delta.md` | The rerun comparison (fixed, new, unchanged). |
| `questions.md` | Five questions, in order, with follow-ups. |
| `answers-template.md` | One copy per reviewer. Fill in verbatim. |

All three samples come from the synthetic fixtures (`engine/fixtures`) and a synthetic agreement. No real company, repository or contract appears in them. Do not swap in a scan of a real third-party repository: the measurement notes say nothing about any owner's practices, and a shared report that names one would read as if they did.

## Who to ask (a person decides this, not Claude)

Two or three people who have reviewed an AI-related vendor agreement or security questionnaire in the last year: for example a commercial lawyer, a security or compliance reviewer, a procurement lead. Prefer people who have not seen Curb. Ask for 20 minutes. Record names and roles in `answers-template.md`.

## How to run a session (20 minutes)

1. Read or hand over `explainer.md` (3 min). Say plainly that the example is synthetic and the tool is a draft.
2. Ask Q1 before showing any report (5 min). Their own process comes first, so the sample does not shape it.
3. Show `sample-report-fail.md`, then ask Q2 to Q5 (12 min). Show `sample-delta.md` only if asked what happens after a fix.
4. Do not defend the tool, explain away a confusing line, or suggest answers. Write down what they say and where they hesitate.

## Decision rule (fixed before the sessions)

- **Build the reviewer view** if at least two of three reviewers (a) describe a real, recent instance of the check in Q1, (b) correctly state at least two of the "does not establish" lines in Q2 without prompting, and (c) name a concrete situation where they would use the output in Q5.
- **Change direction** if the reviewers say the hard part is something this output does not touch (reading the clause, vendor attestations, runtime evidence) or that they would not trust a static scan at all. Write down what they said the hard part is.
- **Stop** if none would use it.
- Anything in between: record it and do not build until a further round.

## After the sessions

Record the three answer files and the decision in `docs/curb/demand-test/results.md`, update CURB-23, and attach the quotes that most changed the decision. Do not summarise away disagreement.

# Curb control verification report

> Policy card status: **draft, pending counsel approval**

## Scope and non-claims

This report checks configured engineering evidence against one human-confirmed contract commitment. It is not legal advice, a legal conclusion or a compliance certification.

- Does not establish which provider receives data at runtime
- Does not establish provider conduct, retention or training use
- Does not detect dead code or proxy rerouting
- Does not establish that the allowlist matches the signed agreement; a named human confirms that
- Is not legal advice or a compliance certification

## Result

**PASS**: No references outside the allowlist were found in the evaluated files, within this rule's scope only. This does not establish compliance.

Rule: `unapproved-provider-reference` v`1.0.1`. Files evaluated: 1.

## Confirmed obligation

- Quote: `Provider will route Customer Content for model inference only to the following model providers: Anthropic.`
- Approved by: `Test Reviewer` at `2026-10-13T09:00:00.000Z`
- Applicability: `applies`
- Provider allowlist: `anthropic`

## Findings

None.

## Unknown files and notes

None.

## Exclusions

- `dir:.git`
- `dir:.next`
- `dir:dist`
- `dir:node_modules`
- `file:package-lock.json`
- `file:pnpm-lock.yaml`
- `file:yarn.lock`

## Inputs and hashes

- Result hash: `8b20d92a7e49cbf8a4b9dc71d1aea095efe8b47c401a1f321a076dcb70b2be80`
- Tree hash: `f21bc9824224ad088504e3091f036c446a5fa32963e17ed4e1832ee329c86018`
- Agreement text hash: `21a6dde011355c9acc49dc090d49f11a816c4fc94fde255dda5c7156e35e0bfe`
- Obligation id: `a47aee5897722ecc6ecb1b1c5e1f88b7ef8abe26421d51cccb49287ad200b5c1`
- Policy card hash: `540aa49a9711d48e1d43a62b91c811bf15b05e09b9a1d4d34f6b3941e649d7b7`
- Evaluator version: `0.2.0+typescript-5.9.3`

## Run

- Started: `2026-10-13T09:00:00.000Z`
- Finished: `2026-10-13T09:00:00.000Z`
- Operator: `test-reviewer`
- Tenant: `demo`

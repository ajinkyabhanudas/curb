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

Rule: `unapproved-provider-reference` v`1.4.0`. Files evaluated: 1.

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

- Result hash: `288e7cfbf6d241f3c2f9a8bd754d9ee1c6cbe12b75c5a44cea442b6c2dfb4b2a`
- Tree hash: `f21bc9824224ad088504e3091f036c446a5fa32963e17ed4e1832ee329c86018`
- Agreement text hash: `21a6dde011355c9acc49dc090d49f11a816c4fc94fde255dda5c7156e35e0bfe`
- Obligation id: `eae15021a19375298afaf142d88c02ad7cb4c649d601e1fe5d1865f43e471fd9`
- Policy card hash: `61c214038e1b6f75a37118931b26632c92a2999ee7aaca8f5a9314d6715c133c`
- Evaluator version: `0.5.0+typescript-5.9.3`

## Run

- Started: `2026-10-13T09:00:00.000Z`
- Finished: `2026-10-13T09:00:00.000Z`
- Operator: `test-reviewer`
- Tenant: `demo`

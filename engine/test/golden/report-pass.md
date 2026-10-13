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

Rule: `unapproved-provider-reference` v`1.0.0`. Files evaluated: 1.

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

- `dir:.next`
- `dir:dist`
- `dir:node_modules`
- `file:package-lock.json`
- `file:pnpm-lock.yaml`
- `file:yarn.lock`

## Inputs and hashes

- Result hash: `1327b5362b6d8abb5e8ed5b2df336b6e04367a642afba21cb0be90fd1ece36de`
- Tree hash: `f21bc9824224ad088504e3091f036c446a5fa32963e17ed4e1832ee329c86018`
- Agreement text hash: `21a6dde011355c9acc49dc090d49f11a816c4fc94fde255dda5c7156e35e0bfe`
- Obligation id: `6dd1e295a6eb82d905b226ffb567eb6ced72259de89f42a877c42d8d1fbc520e`
- Policy card hash: `a76c2d5aa5f0aa43ad7f0d36fe6237d498f2a46475a3dd7d7ef1264582b9e8d9`
- Evaluator version: `0.1.0`

## Run

- Started: `2026-10-13T09:00:00.000Z`
- Finished: `2026-10-13T09:00:00.000Z`
- Operator: `test-reviewer`
- Tenant: `demo`

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

**UNKNOWN**: The rule could not establish a result for the whole scope. See the unknown files and notes below; this is not a pass.

Rule: `unapproved-provider-reference` v`1.0.0`. Files evaluated: 1.

## Confirmed obligation

- Quote: `Provider will route Customer Content for model inference only to the following model providers: Anthropic.`
- Approved by: `Test Reviewer` at `2026-10-13T09:00:00.000Z`
- Applicability: `applies`
- Provider allowlist: `anthropic`

## Findings

None.

## Unknown files and notes

- `broken.ts`: `parse-error`

## Exclusions

- `dir:.next`
- `dir:dist`
- `dir:node_modules`
- `file:package-lock.json`
- `file:pnpm-lock.yaml`
- `file:yarn.lock`

## Inputs and hashes

- Result hash: `c494b32c505c0ae205e448e3d7f53106ebf2d553700cb452b5beb3b2e45c3d22`
- Tree hash: `2892a1cdc75fa706b206b4c9866e4d23e192236644e7acce002789d70311ab09`
- Agreement text hash: `21a6dde011355c9acc49dc090d49f11a816c4fc94fde255dda5c7156e35e0bfe`
- Obligation id: `6dd1e295a6eb82d905b226ffb567eb6ced72259de89f42a877c42d8d1fbc520e`
- Policy card hash: `a76c2d5aa5f0aa43ad7f0d36fe6237d498f2a46475a3dd7d7ef1264582b9e8d9`
- Evaluator version: `0.1.0`

## Run

- Started: `2026-10-13T09:00:00.000Z`
- Finished: `2026-10-13T09:00:00.000Z`
- Operator: `test-reviewer`
- Tenant: `demo`

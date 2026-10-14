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

Rule: `unapproved-provider-reference` v`1.0.1`. Files evaluated: 1.

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

- `dir:.git`
- `dir:.next`
- `dir:dist`
- `dir:node_modules`
- `file:package-lock.json`
- `file:pnpm-lock.yaml`
- `file:yarn.lock`

## Inputs and hashes

- Result hash: `523d8528b34f8f9c92b3182d497fcf66d477832cb9670f3f18178edd4a79a22d`
- Tree hash: `2892a1cdc75fa706b206b4c9866e4d23e192236644e7acce002789d70311ab09`
- Agreement text hash: `21a6dde011355c9acc49dc090d49f11a816c4fc94fde255dda5c7156e35e0bfe`
- Obligation id: `a47aee5897722ecc6ecb1b1c5e1f88b7ef8abe26421d51cccb49287ad200b5c1`
- Policy card hash: `40443c33a8fbe506502642e6b4914274bd2c4cf065acb450b348dde85b0ca5c8`
- Evaluator version: `0.2.0+typescript-5.9.3`

## Run

- Started: `2026-10-13T09:00:00.000Z`
- Finished: `2026-10-13T09:00:00.000Z`
- Operator: `test-reviewer`
- Tenant: `demo`

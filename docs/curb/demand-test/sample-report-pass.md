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

Rule: `unapproved-provider-reference` v`1.3.0`. Files evaluated: 2.

## Confirmed obligation

- Quote: `Provider will route Customer Content for model inference only to the following model providers: Anthropic.`
- Approved by: `Example approver (synthetic)` at `2026-10-13T09:00:00Z`
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

- Result hash: `62c3b2ae095677e1432c53834c96594f5a79dc67699780f3f5e681459377267b`
- Tree hash: `55f01cafe6356f66e8d7e678b48d85c2ea6e8db17ff7951c48f76ed47a3a4f93`
- Agreement text hash: `21a6dde011355c9acc49dc090d49f11a816c4fc94fde255dda5c7156e35e0bfe`
- Obligation id: `a5613bcb27352384145f83825348ea57c7b2b962bc5ec199c55678f19f2a8e5d`
- Policy card hash: `51ab09fbce197a64102809d9a06fe9e464225aa2dedbd376194c94086a684f62`
- Evaluator version: `0.5.0+typescript-5.9.3`

## Run

- Started: `2026-10-14T19:45:52.447Z`
- Finished: `2026-10-14T19:45:52.499Z`
- Operator: `cli`
- Tenant: `demo`

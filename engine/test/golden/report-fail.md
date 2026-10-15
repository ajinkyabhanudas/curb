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

**FAIL**: At least one reference to a provider outside the allowlist was found. See the findings table for exact locations.

Rule: `unapproved-provider-reference` v`1.4.0`. Files evaluated: 2.

## Confirmed obligation

- Quote: `Provider will route Customer Content for model inference only to the following model providers: Anthropic.`
- Approved by: `Test Reviewer` at `2026-10-13T09:00:00.000Z`
- Applicability: `applies`
- Provider allowlist: `anthropic`

## Findings

| Provider | Location | Excerpt | Finding ID |
|---|---|---|---|
| `openai` | `lib/ai/providers.ts:2:24` | `import { openai } from '@ai-sdk/openai';` | `0e81593eb006` |

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

- Result hash: `7c6efb2d37ac5c31cc4e441666fcc80a87f6f3cd4beb975f354a0ac9d3356234`
- Tree hash: `9cf346fceb7264551aeadba1b384b650cf93a1d3f04c012707873bee1f85fdb8`
- Agreement text hash: `21a6dde011355c9acc49dc090d49f11a816c4fc94fde255dda5c7156e35e0bfe`
- Obligation id: `eae15021a19375298afaf142d88c02ad7cb4c649d601e1fe5d1865f43e471fd9`
- Policy card hash: `61c214038e1b6f75a37118931b26632c92a2999ee7aaca8f5a9314d6715c133c`
- Evaluator version: `0.5.0+typescript-5.9.3`

## Run

- Started: `2026-10-13T09:00:00.000Z`
- Finished: `2026-10-13T09:00:00.000Z`
- Operator: `test-reviewer`
- Tenant: `demo`

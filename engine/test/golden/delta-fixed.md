# Curb rerun delta

> Policy card status: **draft, pending counsel approval**

This compares two scoped Curb results from the same control set. It is not a compliance statement, legal advice or a certification.

State: **FAIL** to **PASS**

No references outside the allowlist were found in the evaluated files, within this rule's scope only. This does not establish compliance.

- Before tree hash: `9cf346fceb7264551aeadba1b384b650cf93a1d3f04c012707873bee1f85fdb8`
- After tree hash: `55f01cafe6356f66e8d7e678b48d85c2ea6e8db17ff7951c48f76ed47a3a4f93`

Findings are matched by rule, path, byte range and matched value. Moving code changes its range, so a moved reference appears as one removed and one added finding.

## Fixed (1)

- `lib/ai/providers.ts:2:24` `openai` `import { openai } from '@ai-sdk/openai';`

## Added (0)

None.

## Unchanged (0)

None.

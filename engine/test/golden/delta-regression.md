# Curb rerun delta

This compares two scoped Curb results from the same control set. It is not a compliance statement, legal advice or a certification.

State: **PASS** to **FAIL**

Regression: a previously passing result now has findings (1 new).

- Before tree hash: `55f01cafe6356f66e8d7e678b48d85c2ea6e8db17ff7951c48f76ed47a3a4f93`
- After tree hash: `9cf346fceb7264551aeadba1b384b650cf93a1d3f04c012707873bee1f85fdb8`

Findings are matched by rule, path, byte range and matched value. Moving code changes its range, so a moved reference appears as one removed and one added finding.

## No longer reported (0)

None.

## Added (1)

- `lib/ai/providers.ts:2:24` `openai` `import { openai } from '@ai-sdk/openai';`

## Unchanged (0)

None.

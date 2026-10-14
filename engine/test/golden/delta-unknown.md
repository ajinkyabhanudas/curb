# Curb rerun delta

> Policy card status: **draft, pending counsel approval**

This compares two scoped Curb results from the same control set. It is not a compliance statement, legal advice or a certification.

State: **FAIL** to **UNKNOWN**

1 finding(s) from the before result are no longer reported, but the after result is UNKNOWN: the rule could not establish a result for the whole scope. This is not a pass.

- Before tree hash: `9cf346fceb7264551aeadba1b384b650cf93a1d3f04c012707873bee1f85fdb8`
- After tree hash: `bbd4d12fe6ba340e1cb8867ce7b6c77e36d68fda4d20ebd4c0a96910e59d4c98`

Findings are matched by rule, path, byte range and matched value. Moving code changes its range, so a moved reference appears as one removed and one added finding.

## No longer reported (1)

- `lib/ai/providers.ts:2:24` `openai` `import { openai } from '@ai-sdk/openai';`

## Added (0)

None.

## Unchanged (0)

None.

## Unknown files in the after result (1)

- `vendor.min.js`: `minified`

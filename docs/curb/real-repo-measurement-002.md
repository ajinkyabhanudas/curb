Status: DRAFT, unsigned. Not a verdict on any third party.

# Real-repository measurement 002: mckaywrigley/chatbot-ui

This measures the Curb engine against a synthetic obligation on a second public repository. The obligation (allowlist `anthropic`) was invented for the measurement; no agreement between any parties is implied. Findings say where the source names a provider outside that invented allowlist. They make no statement about the upstream project's practices, its providers, or what it sends where.

## Inputs

| Item | Value |
|---|---|
| Repository | `mckaywrigley/chatbot-ui`, shallow clone into its own scratch directory, read-only (nothing in it was installed, run or modified) |
| Commit | `81328b61d2a4ab597a7a057be70e785cf756d9f8` (2024-06-22, "add anthropic sonnet 3.5 model (#1794)") |
| Licence | MIT per GitHub. Nothing was copied into this repository. |
| Tree hash | `06126342fb144587d17ff3c318f9d2c60879d9ecb0bf627b9d550607a55ab8a7` |
| Card / evaluator | policy card 1.1.0, evaluator 0.3.0 (unchanged from measurement 001) |
| Agreement, quote, allowlist | same synthetic obligation as measurement 001 (allowlist `anthropic`), `--at 2026-10-13T09:00:00Z` |
| Machine | one macOS laptop, Node 24 |

This repository differs from the first: it calls provider SDKs and HTTP endpoints from API routes and keeps its model catalogs as per-provider lists with bare model ids, not `provider/model` strings.

## Result

`FAIL`, 22 findings in 14 files, 3 unknown files, 260 files evaluated, about 1.5 s. Two runs gave the same result hash `01d37ac3c540d6863c5ac6891f275782a146668a6b4d86e256316e8572b349be`; the files differ only in the run envelope timestamps, which sit outside the hashed body.

All 22 findings are real references to a provider outside the allowlist:
- 18 imports of `openai` or `openai/resources/...` (several routes use the OpenAI client against another provider's endpoint).
- 1 import of `@google/generative-ai`.
- 3 base-URL literals: `api.groq.com`, `api.mistral.ai`, `api.perplexity.ai`.

I read each finding's file, line and excerpt in the result file. I found no false positive among the 22.

Missed references in the original scan, found by grepping the routes:
- `app/api/chat/openrouter/route.ts:24` sets `baseURL: "https://openrouter.ai/api/v1"`. The host is not in the registry, so it was not flagged (the file was flagged only for its `openai` import).
- `app/api/chat/azure/route.ts` and `custom/route.ts` build the base URL at runtime from an environment variable and a database value. A static scan cannot see the destination.

## Unknown files (3)

| File | Reason | Fair? |
|---|---|---|
| `.husky/pre-commit` | unsupported-language | Yes. An extensionless script cannot be parsed. |
| `components/icons/anthropic-svg.tsx` | minified | No. SVG path data on very long lines, not generated code. |
| `components/icons/openai-svg.tsx` | minified | No. Same cause. |

Unknown rate: 3 of 263 files (1.1%), 2 of them avoidable. The 50% long-line rule from card 1.1.0 still misclassifies SVG icon components.

## False-pass probe

To test whether `PASS` can be reached with provider references still in the source, I copied the clone (scratch directory, not committed) and deleted files in two steps.

| Copy | Result |
|---|---|
| Original | FAIL, 22 findings |
| Minus the 14 files with findings | UNKNOWN, 0 findings, 3 unknown files |
| Also minus the 3 unknown files | **PASS**, 0 findings, 0 unknown, 246 files evaluated |

The last copy still contains per-provider model catalogs, for example `lib/models/llm/groq-llm-list.ts`, which has `modelId: "llama3-8b-8192"`, `provider: "groq"` and `platformLink: "https://groq.com/"`. The same pattern exists for Mistral, Perplexity and others, plus `*_API_KEY` names in `types/valid-keys.ts`. None of this is detected, because it is bare model ids, a bare `provider:` property, a homepage host and environment variable names. The rule only recognises imports, registry hosts and `provider/model` literals.

This is a deliberately constructed case, since I removed the files that triggered. It still shows the engine can return `PASS` for a repo whose catalogs name providers outside the allowlist. A real repo that reaches providers through a gateway, an environment-configured base URL or a catalog file would behave like the last copy.

## What this says about hypothesis H2

H2 asks whether unsupported or ambiguous cases give `unknown`, not `pass`. On this repository, one run (the original) behaved well: real references were found and no file was wrongly cleared. The probe shows a false-pass path that the first measurement had only disclosed: bare provider names and bare model ids.

## Proposed follow-ups (not done here)

1. Bug: bare `provider:` property values and bare model ids are not references. Decide whether to detect them or to make a repo containing recognised catalog shapes `unknown`.
2. Bug: SVG icon components classed `minified` (CURB-16 follow-up). Consider ignoring `*-svg.tsx` path data or raising the long-line threshold for files with only JSX.
3. Add `openrouter.ai` to the registry. A missing registry entry is the simplest false negative, and the measurement found one on the first pass.
4. Environment-variable names (`OPENAI_API_KEY`) are weak evidence on their own; decide whether they count.
5. Scan a third repository before calling any rule general.

## Limits of this measurement

- Two repositories, both TypeScript, both chat applications. Not a sample.
- One synthetic obligation and one allowlist.
- The probe removed files by hand. It shows a path to `PASS`, not how often it occurs.
- Counsel has not approved the policy card; nothing here is a compliance statement.

## Follow-up (CURB-20)

Card 1.2.0 registers `openrouter.ai`. Rescanning the same commit with the same synthetic obligation gives 24 findings (was 22): the `openrouter.ai` base URL in `app/api/chat/openrouter/route.ts:24`, and a second `openrouter.ai` fetch in `lib/models/fetch-models.ts:84` that the first scan did not report. The false-pass probe above still returns `PASS` once the files with findings and the unknown files are removed (CURB-19 is open). This note is otherwise left as the record of the 1.1.0 scan.

Status: DRAFT, unsigned. Not a verdict on any third party.

# Real-repository measurement 003: langchain-ai/langchain-nextjs-template

This measures the Curb engine against a synthetic obligation on a third public repository. The obligation (allowlist `anthropic`) was invented for the measurement; no agreement between any parties is implied. Findings below say where the source names a provider outside that invented allowlist. They make no statement about the upstream project's practices, its providers, or what it sends where.

## Inputs

| Item | Value |
|---|---|
| Repository | `langchain-ai/langchain-nextjs-template`, shallow clone into its own scratch directory, read-only (nothing in it was installed, run or modified) |
| Commit | `fd4f2cd74e9d3b3f43b73a6429f25185d7be237b` (2026-10-12, merge of PR #151) |
| Licence | MIT per GitHub. Nothing was copied into this repository. |
| Tree hash | `51790d8df9cf0a1f96fa2b2ffcd7ae60644cedad9fb7c2244c5c5c376cd158c7` |
| Card / evaluator | policy card 1.3.0, evaluator 0.5.0 |
| Agreement, quote, allowlist | same synthetic obligation as measurements 001 and 002 (allowlist `anthropic`), `--at 2026-10-13T09:00:00Z` |
| Machine | one macOS laptop, Node 24 |

This repository differs from the first two: it is a Next.js template that reaches models through a framework wrapper (`@langchain/openai`) rather than the provider's own SDK or an `ai` provider package.

## Result

`UNKNOWN`, 0 findings, 1 unknown file, 42 files evaluated. Two runs gave the same result hash `b197bf77ca0d1ea11a06cb6c971347f258b012db797c9fdbf6332d67380ff8c6` and an identical result body.

The one unknown file is `.yarn/releases/yarn-3.5.1.cjs` (2,226,448 bytes, `too-large`), a vendored package-manager release that the repository commits. It has nothing to do with model providers.

## What the scan missed

Reading the source by hand (grep, not the engine), the repository uses OpenAI directly:

- 9 files import `ChatOpenAI` or `OpenAIEmbeddings` from `@langchain/openai`: `app/ai_sdk/agent/action.ts`, `app/ai_sdk/tools/action.ts`, `app/api/chat/agents/route.ts`, `app/api/chat/retrieval/route.ts`, `app/api/chat/retrieval_agents/route.ts`, `app/api/chat/route.ts`, `app/api/chat/structured_output/route.ts`, `app/api/retrieval/ingest/route.ts` and `app/langgraph/agent/agent.ts`.
- 8 files pass `model: "gpt-4o-mini"` to those constructors.
- `app/api/chat/route.ts` carries a commented-out `@langchain/anthropic` example (a comment, not code).

The engine reported none of this. No `@langchain/*` provider package is in the registry (card 1.3.0), and a bare model id such as `"gpt-4o-mini"` is never mapped to a provider.

## False-pass probe

| Copy | Result |
|---|---|
| Original | UNKNOWN, 0 findings, 1 unknown file |
| Without `.yarn/releases/yarn-3.5.1.cjs` | **PASS**, 0 findings, 0 unknown files, 42 files evaluated |

Unlike the constructed probe in measurement 002, this copy removes nothing that references a provider. The only edit is deleting a vendored, 2 MB package-manager file. The original result was `UNKNOWN` only because of that file. If a repository does not carry such a file, the same code returns `PASS` while nine files call OpenAI.

## What this says about hypothesis H2

H2 asks whether unsupported or ambiguous cases give `unknown`, not `pass`. Here the case that should have been caught (a provider reached through a framework wrapper) gave neither a finding nor an `unknown` entry, so H2 fails on this repository. Across the three repositories: measurement 001 found a model catalog missed, 002 found a missed host and bare-id catalogs, and 003 finds a missing package family and bare ids in constructor arguments. Each time the cause was a coverage gap in the registry or the rules, never a wrong `PASS` or `FAIL` on a file the engine did examine.

## Follow-ups (filed, none made here)

1. CURB-24: register the official `@langchain/*` provider packages (verified on npm on 2026-10-14: `openai`, `anthropic`, `google-genai`, `groq`, `mistralai`, `cohere`, `deepseek`, `xai`, `aws`, all MIT from `langchain-ai/langchainjs`) and decide `google-vertexai`, `ollama`, `community` and the legacy `langchain/embeddings/*` paths.
2. CURB-25: decide whether a bare model id from a single-vendor family (`gpt-`, `claude-`, `gemini-`, `grok-`) held as a `model` value counts as a reference to that vendor.
3. Consider treating a committed vendored file above the size cap as a reason to report, but not as a reason a scan may rely on to avoid `PASS`. The current behaviour (`too-large` gives `unknown`) is the safe default; the finding is that it was the only safeguard here.

## Limits of this measurement

- Three repositories, all TypeScript web applications about AI. Not a sample.
- One synthetic obligation and one allowlist.
- The "what the scan missed" list comes from grep, so it is a lower bound, not a complete audit.
- Counsel has not approved the policy card; nothing here is a compliance statement.

## Follow-up (CURB-24)

Card 1.4.0 registers the official `@langchain/*` provider packages (openai, anthropic, google-genai, google-vertexai, groq, mistralai, cohere, deepseek, xai, aws). Evaluator unchanged (0.5.0). Card hash `73da837e4bb9deea247ed7b46c749cb18b594e52224973641b308839fbf2fdce`. Same synthetic obligation text, allowlist `anthropic`, `--at 2026-10-13T09:00:00Z`, newly confirmed because the card version changed (a 1.3.0 obligation is refused).

| Input | Card 1.3.0 | Card 1.4.0 |
|---|---|---|
| `langchain-ai/langchain-nextjs-template` at `fd4f2cd74e9d3b3f43b73a6429f25185d7be237b` (tree `51790d8d…`) | UNKNOWN, 0 findings, 1 unknown file | **FAIL**, 9 findings, 1 unknown file (the over-cap vendored yarn file), result `847f8b0d…` |
| the same tree without that file | **PASS**, 0 findings | **FAIL**, 9 findings, 0 unknown files, result `759b33f4…` |
| `vercel/chatbot` at `c2f8235e` | FAIL, 13 findings | FAIL, 13 findings |
| `mckaywrigley/chatbot-ui` at `81328b61` | FAIL, 53 findings, 7 unknown | FAIL, 53 findings, 7 unknown, same list |

The 9 findings are the 9 files that import `@langchain/openai` (`app/ai_sdk/agent/action.ts`, `app/ai_sdk/tools/action.ts`, `app/api/chat/agents/route.ts`, `app/api/chat/retrieval/route.ts`, `app/api/chat/retrieval_agents/route.ts`, `app/api/chat/route.ts`, `app/api/chat/structured_output/route.ts`, `app/api/retrieval/ingest/route.ts`, `app/langgraph/agent/agent.ts`). Reruns of both langchain scans gave identical result hashes. The earlier "6 catalog unknown" for chatbot-ui was a count of the catalog files only; the unknown list is 6 catalog files plus `.husky/pre-commit` (unsupported-language), and it is the same under 1.3.0 and 1.4.0.

What this closes: the false pass in this note. The scan now reports OpenAI use in this repo whether or not the vendored file is present. What it does not close: the 8 uses of the bare id `gpt-4o-mini` are still not mapped to a vendor by themselves (CURB-25), and a repo that reaches a provider through `@langchain/ollama`, `@langchain/community` or the legacy `langchain/*` subpaths is still not flagged (disclosed in the card's false-negative risks). Hypothesis H2 had one real-repository counterexample; it is now fixed for this case, and still rests on three repositories.

Status: DRAFT, unsigned. Not a verdict on any third party.

# Real-repository measurement 001: vercel/chatbot

This measures the Curb engine against a synthetic obligation on one public repository. The obligation (allowlist `anthropic`) was invented for the measurement; no agreement between any parties is implied. Findings below say where the source names a provider outside that invented allowlist. They make no statement about the upstream project's practices, its providers, or what it sends where.

## Inputs

| Item | Value |
|---|---|
| Repository | `vercel/chatbot`, local clone, read-only (nothing in it was run or modified) |
| Commit | `c2f8235e1f3ea903ad8b7f61447c4f74164b5c58` (the SHA pinned in `source-manifest.md`) |
| Tree hash recorded by Curb | `4b324be21c3e1a6aace21f32629fb1d965a121ede70e17fde0e8869c8ddb0504` (identical before and after, so the clone did not change) |
| Agreement | `engine/fixtures/agreement/synthetic-ai-addendum.md` (synthetic) |
| Quote | `Provider will route Customer Content for model inference only to the following model providers: Anthropic.` |
| Allowlist | `anthropic` |
| Approver | `Real-repo measurement (synthetic obligation)`, `--at 2026-10-14T00:40:00Z` |
| Machine | one macOS laptop, Node 24, TypeScript 5.9.3 |

Stores and result files were written to a scratch directory outside both the clone and this repository. Below, `$S` is that scratch directory's `real/` folder, which holds `chatbot/` (the clone) and `chatbot-trimmed/` (a copy with the four files reported unknown removed). All commands run from `engine/` with:

```
CARD=policies/unapproved-provider-reference.v1.json
AGR=fixtures/agreement/synthetic-ai-addendum.md
Q="Provider will route Customer Content for model inference only to the following model providers: Anthropic."
```

## Before: card 1.0.1, evaluator 0.2.0 (commit 740a092)

```
npm run -s curb -- confirm --card $CARD --agreement $AGR --quote "$Q" --allow anthropic \
  --approver "Real-repo measurement (synthetic obligation)" --at 2026-10-14T00:40:00Z \
  --store $S/before/store --out $S/before/obligation.json
```

Obligation id `f5927fd9f58895ee8272a4879d5478cf53a1050d53658ddab09919b0a92a4933`.

```
/usr/bin/time -p npm run -s curb -- scan --card $CARD --agreement $AGR --obligation $S/before/obligation.json \
  --repo $S/chatbot --store $S/before/store --out $S/before/r1.json      # and again to r2.json
```
```
UNKNOWN  0 finding(s), 4 unknown file(s), 152 file(s) evaluated
policy card status: draft, pending counsel approval
  unknown: .cursor/rules/ultracite.mdc (unsupported-language)
  unknown: components/chat/icons.tsx (minified)
  unknown: components/ui/input-group.tsx (minified)
  unknown: components/ui/sheet.tsx (minified)
result sha256:6eff08e247133bf86df4506a3d8e46e9c2598afbfe2dff8628ae2bc438ef45d7
real 0.58
```

Both runs gave the same result hash. Wall time 0.58 s each (but see the note on timing below).

Why each file was unknown:

| File | Reason | Measured |
|---|---|---|
| `.cursor/rules/ultracite.mdc` | `unsupported-language`: `.mdc` was on neither the source nor the never-scanned list | A 332-line Markdown rules file for an editor, with YAML front matter. Not code. |
| `components/chat/icons.tsx` | `minified`: some line over 1000 characters | 1,130 lines, 54,033 bytes, 5 lines over 1000 characters (longest 2,579), holding 16.6% of the bytes. SVG path data. |
| `components/ui/input-group.tsx` | `minified` | 156 lines, 5,102 bytes, 1 line over 1000 characters (1,151), 22.6% of the bytes. A long class string. |
| `components/ui/sheet.tsx` | `minified` | 145 lines, 4,640 bytes, 1 line over 1000 characters (1,232), 26.6% of the bytes. A long class string. |

A real minified bundle has close to 100% of its bytes in long lines. These are hand-written components.

The trimmed copy (the same tree minus those four files) shows the false pass:

```
/usr/bin/time -p npm run -s curb -- scan --card $CARD --agreement $AGR --obligation $S/before/obligation.json \
  --repo $S/chatbot-trimmed --store $S/before/store --out $S/before/trimmed.json
```
```
PASS  0 finding(s), 0 unknown file(s), 152 file(s) evaluated
policy card status: draft, pending counsel approval
result sha256:a7aa61cd531c7924efbb1778ece07055afa175228224e5e1e29fe8e949bbdcff
real 0.59
```

### The gap behind that PASS

`lib/ai/models.ts` holds a model catalog as string literals:

```
lib/ai/models.ts:1   export const DEFAULT_CHAT_MODEL = "moonshotai/kimi-k2.5";
lib/ai/models.ts:6     id: "moonshotai/kimi-k2.5",
lib/ai/models.ts:30    id: "deepseek/deepseek-v3.2",
lib/ai/models.ts:37    id: "moonshotai/kimi-k2.5",
lib/ai/models.ts:44    id: "openai/gpt-oss-20b",
lib/ai/models.ts:52    id: "openai/gpt-oss-120b",
lib/ai/models.ts:60    id: "xai/grok-4.1-fast-non-reasoning",
```

`lib/ai/providers.ts:25` calls `gateway.languageModel(modelId)` and `lib/ai/providers.ts:32` calls `gateway.languageModel(titleModel.id)`, both with a non-literal argument. Card 1.0.1 checked only a string literal passed directly to a declared constructor, so none of these ids was examined. `openai` and `xai` were registered providers outside the allowlist, so this was a false pass by the rule's own intent. `deepseek` and `moonshotai` were not in the registry at all.

The same file also names providers as bare strings, `gatewayOrder: ["fireworks", "bedrock"]` (lines 5, 29, 36, 43, 51, 59, naming fireworks, bedrock, deepinfra, groq and xai), which `app/(chat)/actions.ts:33` and `app/(chat)/api/chat/route.ts:299` pass as `providerOptions.gateway.order`. Those are not detected (see below).

## Change

Card 1.1.0 and evaluator 0.3.0 (commit `c31e6d1`), approved by the policy owner as a widening of the interpretation:

- Any whole string literal `<prefix>/<slug>` in TypeScript or JavaScript source is a finding when the prefix is a registered gateway prefix, the slug has a digit or hyphen, and the provider is not allowed.
- Gateway prefixes added: deepseek, moonshotai, meta, cohere, perplexity, alibaba, minimax, zai, amazon, nvidia. Packages and hosts added for deepseek, cohere, perplexity, groq, bedrock, fireworks, deepinfra, togetherai and azure.
- Minified now means `.min.js` by name, or more than half the file's bytes in lines over 1000 characters.
- `.mdc` is never scanned.

## After: card 1.1.0, evaluator 0.3.0

The card version changed, so the 1.0.1 obligation is refused and a new one was confirmed:

```
npm run -s curb -- confirm --card $CARD --agreement $AGR --quote "$Q" --allow anthropic \
  --approver "Real-repo measurement (synthetic obligation)" --at 2026-10-14T00:40:00Z \
  --store $S/after/store --out $S/after/obligation.json
```

Obligation id `0f61458e7932342ac5f43aa701ec88d8423f92d1ee8265032c6096d94ba86e14` (`policyCardVersion` `1.1.0`).

```
/usr/bin/time -p npm run -s curb -- scan --card $CARD --agreement $AGR --obligation $S/after/obligation.json \
  --repo $S/chatbot --store $S/after/store --out $S/after/r1.json      # and again to r2.json
```
```
FAIL  7 finding(s), 0 unknown file(s), 155 file(s) evaluated
policy card status: draft, pending counsel approval
  lib/ai/models.ts:1:35  moonshotai  export const DEFAULT_CHAT_MODEL = "moonshotai/kimi-k2.5";
  lib/ai/models.ts:6:7  moonshotai  id: "moonshotai/kimi-k2.5",
  lib/ai/models.ts:30:9  deepseek  id: "deepseek/deepseek-v3.2",
  lib/ai/models.ts:37:9  moonshotai  id: "moonshotai/kimi-k2.5",
  lib/ai/models.ts:44:9  openai  id: "openai/gpt-oss-20b",
  lib/ai/models.ts:52:9  openai  id: "openai/gpt-oss-120b",
  lib/ai/models.ts:60:9  xai  id: "xai/grok-4.1-fast-non-reasoning",
result sha256:35ce42b2c89e146608c66b1f0374848e33f1b2d990d2b5833b6e6f0d8301eed8
real 1.12      (second run: same hash, real 1.21)
```

Both result bodies are byte-identical. `curb audit --store $S/after/store` reports `entries: 4`, `audit chain OK`.

| Measure | Before | After |
|---|---|---|
| State | `unknown` | `fail` |
| Files evaluated | 152 | 155 (the three components are now analyzed; the `.mdc` file is skipped) |
| Unknown files | 4 | 0 |
| Findings | 0 | 7 |
| Result hash, rerun | same | same |

Findings, as `path:line  provider  literal`:

```
lib/ai/models.ts:1   moonshotai  moonshotai/kimi-k2.5
lib/ai/models.ts:6   moonshotai  moonshotai/kimi-k2.5
lib/ai/models.ts:30  deepseek    deepseek/deepseek-v3.2
lib/ai/models.ts:37  moonshotai  moonshotai/kimi-k2.5
lib/ai/models.ts:44  openai      openai/gpt-oss-20b
lib/ai/models.ts:52  openai      openai/gpt-oss-120b
lib/ai/models.ts:60  xai         xai/grok-4.1-fast-non-reasoning
```

By provider: moonshotai 3, openai 2, deepseek 1, xai 1. One finding per occurrence, so the same id in two places is two findings. All seven are catalog entries in one file; none comes from the three components that are now analyzed. A grep of the clone for any registered prefix followed by `/` found no other candidate literals, so there is no sign of findings the precision gate (digit or hyphen) suppressed on this repository. No `@ai-sdk/*` package the repository imports (`@ai-sdk/otel`, `@ai-sdk/provider`, `@ai-sdk/react`) is in the registry, and none was flagged.

The trimmed copy no longer passes:

```
/usr/bin/time -p npm run -s curb -- scan --card $CARD --agreement $AGR --obligation $S/after/obligation.json \
  --repo $S/chatbot-trimmed --store $S/after/store --out $S/after/trimmed.json
```
```
FAIL  7 finding(s), 0 unknown file(s), 152 file(s) evaluated
result sha256:8b910b35fa1fd6fe16d380d9a3df241bdacfa6e27331e643002a1c2e63c77192
real 1.26
```

### Note on timing

Wall time went from 0.58 s to about 1.2 s between the two sessions, which looked like a regression. Timed again interleaved on the same machine, three runs each, the old engine (`git archive 740a092`) took 1.02, 1.02 and 1.07 s and the new engine 1.06, 1.06 and 1.05 s. The difference was machine load between the sessions, not the change. Single-run wall times on a laptop are not a benchmark.

## Still not detected on this repository

- `gatewayOrder` arrays of bare provider names (`"fireworks"`, `"bedrock"`, `"deepinfra"`, `"groq"`, `"xai"`) and the `providerOptions.gateway.order` they feed. A bare name such as `"bedrock"` is not examined; matching every string that equals a provider id would flag display text and keys everywhere. These name the hosting providers the gateway is told to try, which for an allowlist commitment may matter as much as the model's maker.
- `providerOptions` keys and display-name maps (for example a `provider: "moonshotai"` field) are not examined.
- `https://ai-gateway.vercel.sh/...` (lines 73, 126 and 211 of `lib/ai/models.ts`). It is the Vercel AI Gateway, a proxy, not a model provider, so it is not in the registry. Which provider receives traffic through it is decided at runtime.
- `getAllGatewayModels()` reads the gateway's model list at runtime and builds ids from the response (`m.id`). Ids that exist only at runtime are not seen.
- Providers outside the registry. moonshotai and deepseek are now registered (and found here). fireworks, bedrock, deepinfra and groq are registered now only by package and host, not as gateway prefixes, so a literal such as `"groq/llama-3"` would not be flagged; on this repository they appear only as bare names, which are not examined anyway.
- `lib/ai/providers.ts` loads `./models.mock` through `require` in test mode; the module is local and holds no registered package, so nothing is missed there, but a mock that wraps a real provider would be.

## Limits of this measurement

- One repository at one commit, one synthetic obligation, one machine. Zero unknown files out of 155 evaluated here says nothing about the `unknown` rate on other repositories.
- The rule changed in response to this repository. The after-scan is therefore not an independent test of the new rule; the synthetic catalog fixture (`engine/fixtures/repos/catalog/`) and the evaluator tests are the regression guard, and a second repository is needed to measure it fairly.
- The findings show where source names a provider outside an invented allowlist. They do not show runtime traffic, provider conduct, or anything about the upstream project's obligations.
- The licence question for redistributing this repository is open (`source-manifest.md`); nothing from it is copied into this repository.

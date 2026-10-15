# Phase 2 paper test: Discover mode on vercel/chatbot

Status: DRAFT. Hand-written by an agent, not produced by Curb. Tests whether the question idea is useful before any code is built (PRD phase 2).

Subject: `vercel/chatbot` at `c2f8235e1f3ea903ad8b7f61447c4f74164b5c58`, a public MIT template, local read-only clone, nothing run. It is not the product owner's project. Nothing here is a statement about its authors' practices. Questions are written as if a builder had shipped this template as their own product.

## How this was produced

- **Curb-detected** signals come from the existing scan (`real-repo-measurement-001.md`, card 1.3.0, evaluator 0.5.0: 13 findings in `lib/ai/models.ts`).
- **Grep-observed** signals come from `grep` and directory listings of the clone by the agent. Curb has no detector for them. A grep with no match means not found by that grep, not that the thing does not exist.
- The questions and their order are the agent's draft of what a question bank would produce. The order follows the PRD rule: unknown routing, missing provider decision, outside-evidence gap, educational.

## Observed (what the repo shows)

| Signal | Where | Source |
|---|---|---|
| Model ids for moonshotai, deepseek, openai, xai in a catalog | `lib/ai/models.ts` lines 1, 6, 30, 37, 44, 52, 60 | Curb |
| `provider:` values naming the same vendors | `lib/ai/models.ts` | Curb |
| Requests go through `gateway.languageModel(...)` | `lib/ai/providers.ts:25`, `:32` | Curb (host `ai-gateway.vercel.sh` is not a registered provider) |
| `gatewayOrder` names fireworks, bedrock, deepinfra, groq, xai and is passed as `providerOptions.gateway.order` | `lib/ai/models.ts`, `app/(chat)/actions.ts:33`, `app/(chat)/api/chat/route.ts:299` | Measurement 001, not detected by Curb |
| Model ids can also come from the gateway at runtime (`getAllGatewayModels()`) | `lib/ai/models.ts` | Measurement 001, not detected by Curb |
| Chats and messages are saved to Postgres; routes exist to delete one chat and all chats for a user | `route.ts` (`saveChat`, `saveMessages`, `deleteChatById`), `app/(chat)/api/history/route.ts` | grep |
| OpenTelemetry registered; model-call telemetry is enabled when `isProductionEnvironment` | `instrumentation.ts:6`, `route.ts:308` | grep |
| Model tools: `createDocument`, `getWeather`, `requestSuggestions` (plus edit/update document files) | `route.ts:310-318`, `lib/ai/tools/` | grep |
| File storage via `@vercel/blob`; attachments handled in the chat route | `package.json`, `route.ts` | grep |
| Per-IP rate limit and per-hour message entitlements by user type; `botid` dependency | `lib/ratelimit.ts`, `lib/ai/entitlements.ts`, `route.ts:101,110` | grep |
| Auth via `next-auth` | `package.json` | grep |
| No user-facing text such as "AI-generated" or "can make mistakes" found in `app`, `components`, `lib` | | grep, absence only |

## Ranked questions

| # | Question | Why it is raised | Trigger | Class | Curb detects today? | Would you act on it? (fill in) |
|---|---|---|---|---|---|---|
| 1 | Which providers can actually receive customer prompts through the gateway, including the hosting providers in `gatewayOrder`? Who approved that list? | A proxy and a runtime model list mean the repo cannot show the final recipient | `providers.ts:25`, `models.ts` | unknown routing | Partly: vendors in the catalog yes; `gatewayOrder` and runtime ids no | |
| 2 | Is there a recorded list of approved providers, and does it match what you tell customers? | Four vendors are named in source with no recorded decision | 13 findings in `models.ts` | provider decision missing | Yes | |
| 3 | What do the gateway and each provider retain, and may they train on prompts? | Not visible from code | none | needs outside evidence (provider terms, account settings) | n/a | |
| 4 | How long are chats and messages kept, are backups included, and what happens on account closure? | Chats are persisted; delete routes exist; no retention period is visible | `saveChat`, `deleteAllChatsByUserId` | needs outside evidence | No | |
| 5 | What does production telemetry record, and does it include prompt or response text? | Telemetry is enabled in production | `route.ts:308`, `instrumentation.ts` | needs reading config and outside evidence | No | |
| 6 | What can each model tool reach, and does any send user content to a third party? | Three tools are exposed to the model | `lib/ai/tools/` | educational / needs review | No | |
| 7 | Are uploaded files sent to a model provider? | Attachments and blob storage both appear | `route.ts`, `package.json` | needs outside evidence | No | |
| 8 | Do users see that they are talking to an AI? | No disclosure text found by grep | grep, absence only | needs UI review | No | |
| 9 | What stops a user from running up model cost? | Rate limits exist; their sufficiency is not visible | `ratelimit.ts`, `entitlements.ts` | educational | No | |

## Research signal per question (agent's provisional read, not the owner's answer)

Sources are web search results, mostly vendor and commentary pages, unverified against primary documents. "Signal" means someone else asks or warns about it. It does not mean it matters for any particular product.

| # | Signal | Provisional | Basis |
|---|---|---|---|
| 1 | Strong | act | AI questionnaires ask which model providers touch prompts and how much notice customers get when that list changes ([Reco](https://www.reco.ai/ciso-hub/ai-vendor-security-questionnaire)); proxies are a named MCP/gateway risk area ([Docker](https://www.docker.com/blog/mcp-security-explained/)) |
| 2 | Strong | act | Same questionnaire question; subprocessor lists and DPAs are standard asks ([CloudEagle](https://www.cloudeagle.ai/blogs/ai-vendor-security-questionnaire)) |
| 3 | Strong | act, but outside evidence | Training-on-data is called an essential question; a contract term versus a UI setting is the difference buyers probe ([CloudEagle](https://www.cloudeagle.ai/blogs/ai-vendor-security-questionnaire)) |
| 4 | Strong | act | Questionnaires ask how long prompts, outputs and embeddings persist and whether derived artifacts are deleted on termination ([Reco](https://www.reco.ai/ciso-hub/ai-vendor-security-questionnaire)) |
| 5 | Strong | act | "Are prompts and responses logged, and for how long" is a listed question (same source) |
| 6 | Medium | maybe | Newer questionnaires ask what agents and connectors can access; OWASP lists tool misuse (ASI02) and excessive agency ([Cycode](https://cycode.com/blog/owasp-top-10-agentic-applications/)). On a template with a weather tool it may be low value. |
| 7 | None found | noise candidate | No search result raised uploads specifically. Partly covered by 3 and 4. |
| 8 | Medium | act if EU/UK users | Secondary sources say the Article 50 chatbot disclosure duty has applied since 2 August 2026 ([Elevate](https://elevateconsult.com/insights/eu-ai-act-article-50-icp-impact/)); not checked against EUR-Lex. Needs UI review, not code. |
| 9 | Weak for trust review | noise candidate | OWASP LLM lists unbounded consumption, but it is a cost and availability risk, not something the buyer questionnaires in the results asked about. |

Provisional tally: 5 act (1 to 5), 1 conditional (8), 1 maybe (6), 2 noise candidates (7, 9). Two things to note:
- The research supports the questions. It does not show Curb's answer helps. Whether the builder would act is still the owner's call.
- The strong questions (3, 4, 5) are the ones Curb can least answer from code. If those are the valuable ones, the product is mostly a prompt to gather evidence, plus a provider check. That bears on how much detector work (PRD R9) is worth doing.

## Owner decision (2026-10-15)

The product owner accepted the provisional ratings above as approved for now, without reviewing them, and asked that their validity come out through testing and that questions be retired if they are not useful afterwards. So questions 1 to 5 and 8 are `trial` questions and 6 is a `trial` at lowest rank; 7 and 9 stay out of v0. These are not owner marks: nobody has yet said which question they would act on and why.

How validity gets tested: each run records act, maybe or noise per question (CURB-41, requirement R3b in the PRD). Retire rule, proposed and not yet approved: a question marked noise in more than half of at least five of the owner's runs is reworded or dropped; the marks and the decision go in the question bank's change log. With one user this measures the owner's preference, not general usefulness; phase 9 re-tests with outside builders.

## What the test shows so far

- Only questions 1 and 2 have a detector today, and 1 only partly. The other seven need new detectors (PRD R9) or are always "needs outside evidence".
- Two risks to check with the owner: questions 6 and 9 may read as noise on a template, and questions 3 to 5 depend on documents or settings Curb cannot see.
- A repo with no AI-provider signal at all would still raise questions 3, 4 and 8 only if their detectors existed. The empty-state rule in R3 (say what was scanned and what was not) still applies.
- The ranking is a judgement. Nothing here says question 1 outranks 4 for a real builder.

## What would count as a pass for this paper test

The product owner marks each question "act", "maybe" or "noise". The PRD proposes at least 3 "act" and a stated noise rate. If most questions are noise, or the owner cannot say why they would act, stop and rethink the question bank before building the observe-only scan.

## Limits

- One repo, one commit, one reader. The agent chose the signals it looked for, so a signal it did not think of is missing.
- No detector was run for questions 3 to 9; their evidence is `grep`.
- Not reviewed independently.

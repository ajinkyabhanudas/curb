Status: DRAFT memo for CURB-12. Not legal advice. The decision is counsel's or the Legal/policy owner's.

# Gate 2: counsel review of the policy card

## Decision needed
Approve, approve with changes, or reject policy card `unapproved-provider-reference` version 1.4.0, which ships as "draft, pending counsel approval". Record the approver's name and date.

## What approval would and would not mean
The card defines what Curb counts as an unapproved provider reference. Approval would mean counsel agrees with that definition, its non-claims and its stated limits. It would not make any report a compliance certification and it would not assess any vendor. The reports already say so.

## Why it blocks
Every report prints "draft, pending counsel approval" at the top. Per `policy-card-template.md`, the status may change only after a named counsel and a security reviewer both sign, and only by a human. So this approval alone does not remove the draft banner: it also needs gate 4 (CURB-14). Changing the status is a card text change, so it needs a version bump.

## What to read (quoted from the card)

### Interpretation
When a confirmed commitment limits the model providers that may receive customer content, any import, URL literal, gateway model identifier passed to a declared model constructor, or model-identifier literal anywhere in scanned source (a whole string of the form <prefix>/<model> whose model part contains a digit or hyphen, for example "openai/gpt-5") or a string value assigned to a provider-named target (a property, class field, JSX attribute, variable declaration, parameter default or assignment target whose name ends in provider or providerId, ignoring case and separators, for example provider, modelProvider, LLM_PROVIDER or llm-provider) that is a registered provider id, that resolves to a registered provider outside the customer's allowlist is a finding.

### Approved quote pattern (no approval has been given for it)
- Provider will route Customer Content for model inference only to the following model providers: <list>.

### Non-claims (printed in every report)
- Does not establish which provider receives data at runtime
- Does not establish provider conduct, retention or training use
- Does not detect dead code or proxy rerouting
- Does not establish that the allowlist matches the signed agreement; a named human confirms that
- Is not legal advice or a compliance certification

### Known false-positive examples
- A provider-named target that is a login method, a UI choice or a cloud, identity or framework provider, not a model recipient, for example signInWithOAuth({ provider: "google" }), <AuthButton provider="azure" />, authProvider: "google", cloudProvider: "azure", identityProvider: "google" or dataProvider: "groq", or a provider id in a test fixture
- A provider import in a test-only file that never ships
- A provider referenced in code that is never executed

### Known false-negative risks (28 listed, quoted in full)
- A provider that is not in the registry is not flagged
- Dynamic specifiers such as require(name) or template literals with substitutions
- Model identifiers assembled at runtime, read from environment or configuration files, or built from non-literals (string concatenation, template literals with substitutions, values computed in code); string literals holding a whole model identifier are now examined anywhere in TypeScript and JavaScript source
- A proxy or wrapper module that hides the real provider
- Configuration and environment files are not scanned in V1
- URLs assembled by string concatenation, split new URL(...) arguments, or template literals whose provider host is not in the literal head
- Template-literal URLs whose literal head ends at or inside the provider host, for example `https://api.openai.com${path}` or `https://api.openai.com:${port}/v1`
- Hosts written without a scheme (api.openai.com) or as a subdomain of a registered host
- Template literals with substitutions outside the first argument of a declared constructor, for example generateText({ model: `openai/${m}` }); whole string literals such as generateText({ model: 'openai/gpt-5' }) are flagged by the model-identifier literal check
- Template literals with substitutions passed to aliased constructors (const g = gateway), element access (gateway['languageModel']) or createGateway()(...); a whole string literal in those positions is flagged by the model-identifier literal check
- Files whose extension is not TypeScript or JavaScript: the embedding formats reported unknown are covered, but .md, .json, .yaml and .env files are not scanned
- Exclusion directories are matched by name at any depth, so a directory named like an exclusion is skipped wherever it sits
- Code inside a never-scanned file type (for example a provider URL in .sql, .graphql or a config file) is not flagged
- Binary content is never analyzed: an extensionless binary file is skipped, a text file with an unlisted extension yields unknown, and never-scanned types are not analyzed whatever their content
- createRequire(...)('openai') and other loaders reached through a created require function
- declare module 'openai' blocks in declaration files
- Tagged-template constructor calls with substitutions such as gateway`openai/${m}`; gateway`openai/gpt-5` without substitutions is flagged by the model-identifier literal check
- Test mocks such as vi.mock('openai') and jest.mock('openai')
- A TypeScript path alias or bundler alias that rewrites a package to another name
- .git directories are skipped at every depth, so source placed inside any directory named .git is not scanned
- Provider names held as bare strings are examined only when assigned to a name ending in provider or providerId (through as, satisfies, parentheses, !, <const>, ??, || and && or the branches of a ternary). Not examined: provider-name arrays such as gatewayOrder: ['fireworks', 'bedrock'], providerOptions keys, display-name maps such as { openai: 'OpenAI' }, shorthand { provider }, values read from variables or built by concatenation or substitution, comparisons (kind === 'groq'), switch cases, enum values, and names that do not end in provider (vendor, backend, llm)
- Model-identifier literals whose model part (slug) is without a digit or hyphen (for example 'openai/chatgpt') are not flagged; this keeps paths such as google/fonts and meta/robots out
- Model-identifier literals for providers not in the registry (a prefix missing from registry.gatewayPrefixes) are not flagged
- Object keys, interface member names, destructuring keys and computed keys that hold a model identifier are not flagged
- Bare model ids without a provider prefix (llama3-8b-8192) are never mapped to a provider. A catalog file is marked unknown only at 6 or more such values from the listed model families making up 20% or more of its string values (keys, type literals and module specifiers are not counted), so a catalog split into files of 5 or fewer ids, one padded with other strings, one of an unlisted family, or one with built or uppercase ids is neither flagged nor marked, and a formatting change alone can move a file across the threshold. The thresholds rest on a single real repository. A catalog that lists only allowed models is still marked unknown
- The Vercel AI Gateway host (ai-gateway.vercel.sh) is a proxy, not a provider: URLs to it are not flagged, and the provider it routes to is decided at runtime
- OpenRouter (openrouter.ai) is registered as its own provider id because it receives the request content: an allowlist must include openrouter to permit it. The providers it then routes to are decided at runtime and are not visible to the scan
- Hosts not verified against vendor documentation are not in the registry. api.together.xyz is the default in some third-party integrations while Together's own docs give api.together.ai; api.moonshot.cn was found only on third-party pages. Azure and Bedrock hosts are per-region subdomains and cannot be matched because host matching is exact

### Evidence boundaries
- Findings show where source references a provider, not where traffic goes at runtime

The registry (package, host and model-prefix mappings to provider ids) is in `engine/policies/unapproved-provider-reference.v1.json` under `registry`.

## Questions counsel should answer
These came up in reviews of the card (CURB-12 comments, CURB-24, CURB-25):
1. Do routers and gateways count as recipients that must be on an allowlist? Today OpenRouter is its own provider id while the Vercel AI Gateway host is treated as a proxy and not flagged. Pick one rule.
2. A call to `openai/gpt-4o` through OpenRouter reports `openai` as well as `openrouter`. With an allowlist of only `openrouter` it fails on `openai`. Intended?
3. Hosts not verified against vendor documentation (`api.together.xyz`, `api.moonshot.cn`, per-region Azure and Bedrock) are not matched. Acceptable as disclosed gaps?
4. A catalog file that lists only allowed models is reported `unknown`, so a vendor that keeps a model list cannot reach PASS. Accept, or exempt allowed families?
5. Should a missed catalog ever produce PASS? The catalog check (6 ids, 20% of string values) is a heuristic tuned on one repository; `unknown` for every file with many model-like strings is the stricter alternative.
6. Who owns the model-family list the catalog check uses, and how often is it reviewed?
7. Login and UI choices (`provider: "google"`, `<AuthButton provider="azure" />`) and cloud, identity or framework names are flagged. Accept the false positives, or exclude known libraries?
8. (CURB-25) Should a bare model id from a single-vendor family (`gpt-`, `claude-`, `gemini-`, `grok-`) held as a `model` value count as a reference to that vendor?
9. (CURB-24) Card 1.4.0 treats the official wrapper packages `@langchain/openai`, `anthropic`, `google-genai`, `google-vertexai`, `groq`, `mistralai`, `cohere`, `deepseek`, `xai` and `aws` as references to the provider behind them (`aws` maps to `bedrock`, `google-vertexai` to `google`). It does not register `@langchain/ollama` (a local runtime), `@langchain/community` or the legacy `langchain/*` subpaths. Does counsel accept that a wrapper import counts as a reference, and that `google` covers Google Cloud Vertex AI as well as the Gemini API?

## Options
1. **Approve as written**, with the questions above recorded as accepted limits.
2. **Approve with changes**: counsel's answers to 1 to 9 become card changes (each a version bump), then re-review.
3. **Reject** and say what the card must do instead.

## Drafted recommendation
Option 2. Questions 1, 4, 5 and 8 change what counts as a finding, so they should be settled before counsel signs a version, not after. Ask counsel to sign a specific version and hash, and to treat any later wording change as a new review.

## Record the answer
Counsel's name, date and the approved version and hash in the card version log (`policy-card-template.md`) and on CURB-12. The card `status` field changes later, once gate 4 is also signed (a human change, with a version bump).

## What Claude will not do
Change the card status, sign for counsel, or answer the questions.

Status: DRAFT, unsigned. Needs counsel and security reviewer sign-off.

# Policy card template

Source of truth: the `PolicyCard` interface in `engine/src/policy/card.ts`. The shipped card is `engine/policies/unapproved-provider-reference.v1.json`. `validateCard` requires every field below; strings must be non-empty and lists must hold strings only.

## Fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Stable rule identifier. Obligations and results name it. |
| `version` | string | Card version. An obligation is bound to one id and version; a mismatch is refused. |
| `status` | string | Review state. Printed at the top of every Markdown report and rerun delta, as the second line of the scan summary, and in the `policyCard` block of the JSON report. |
| `owner` | string | Named person or role responsible for the card. |
| `reviewDate` | string | Date of the last review. |
| `severity` | `critical`, `high`, `medium` or `low` | Severity given to every finding of this rule. |
| `interpretation` | string | One-sentence statement of what the rule treats as a finding. |
| `approvedTextPatterns` | string[] | Agreement wording the card is approved to map to. |
| `requiredFacts` | string[] | Facts that must be supplied or confirmed before the rule can run (here: the allowlist and a human-confirmed obligation). |
| `prerequisites` | string[] | Conditions on the source and files under which a result is meaningful. |
| `falsePositiveExamples` | string[] | Known ways the rule flags something that is not a problem. |
| `falseNegativeRisks` | string[] | Known ways the rule misses a real problem. Reproduced for the reader of the report. |
| `evidenceBoundaries` | string[] | What a finding does and does not show. |
| `nonClaims` | string[] | What the rule and its report do not establish. Printed before the result in every report. |
| `exclusions` | `{ dirs: string[]; files: string[] }` | Directory names (matched at any depth) and file base names skipped by the snapshot and evaluator. Recorded in every result. |
| `registry.packages` | map string to string | Package name to normalized provider id. |
| `registry.hosts` | map string to string | URL host to provider id. |
| `registry.gatewayPrefixes` | map string to string | Model identifier prefix (for example `openai` in `openai/gpt-5`) to provider id. |
| `modelConstructors` | string[] | Callee names whose first string argument is a model identifier. |
| `testCases` | string[] | Test files that exercise the card. |

The provider ids in the three registry maps are the only ids an obligation allowlist may name. The card hash is `sha256` of the canonical JSON of the whole card and is recorded in every result as `policyCardHash`.

## Review rule

A card ships with status `draft, pending counsel approval` until a named counsel and a security reviewer both sign. Only then may the status be changed, by a human. Any change to card text, including wording, registry entries or exclusions, changes the card hash and therefore requires a version bump, so that old results and obligations remain tied to the text they were produced under.

## Version history of the shipped card

The shipped card `unapproved-provider-reference` was edited after its first commit without a version bump: it was added in `d8e6e8a` and changed in `cb0e418` and `05dac51` while still `1.0.0`. The final branch review bumped it to `1.0.1`, adding the file-type prerequisites and new false-negative disclosures at the same time. That bump resolves the earlier unversioned edits: `1.0.1` names one text, and any result or obligation made under an earlier `1.0.0` text carries a different version as well as a different card hash. Status stays `draft, pending counsel approval`; no approved text has been altered because no approval has been given.

After the bump, a scoped re-review changed the binary-file rule, and the `1.0.1` text was edited in place (the never-scanned list in `prerequisites` gained compiled and media types, and the binary lines in `prerequisites` and `falseNegativeRisks` were corrected) without a second bump. This is deliberate: `1.0.1` has not left the development branch, so no result or obligation outside it was made against the earlier `1.0.1` text. From the first release of `1.0.1` onward, any text change needs a new version.

Version `1.1.0` (2026-10-14) widens the interpretation, so it is a minor bump rather than a patch. A first scan of a real repository (`docs/curb/real-repo-measurement-001.md`) showed that a model catalog holding ids such as `"openai/gpt-oss-20b"` in object literals, handed to `gateway.languageModel` through a variable, was not flagged, and a copy of the repository without its four unknown files scanned as `pass`. The product owner approved counting model-identifier literals as references. `1.1.0` therefore changes: `interpretation` (model-identifier literals anywhere in source are findings), the registry (packages for deepseek, cohere, perplexity, groq, bedrock, fireworks, deepinfra, togetherai and azure, and hosts for deepseek, cohere, perplexity and groq only, each checked against npm or the provider's public documentation; gateway prefixes for deepseek, moonshotai, meta, cohere, perplexity, alibaba, minimax, zai, amazon and nvidia), `prerequisites` (`.mdc` joins the never-scanned list), and `falseNegativeRisks` (the line on model identifiers in variables now says what the literal check still misses; the constructor, alias and tagged-template lines now cover only template literals with substitutions; new lines disclose bare provider-name arrays such as `gatewayOrder`, `providerOptions` keys and display-name maps, slugs without a digit or hyphen, model ids for unregistered providers, object and destructuring keys, and the Vercel AI Gateway host as a proxy). `approvedTextPatterns` is unchanged: no approval was given, so none was added. Status stays `draft, pending counsel approval`. An obligation confirmed against `1.0.1` is refused by `scan` under `1.1.0` and must be confirmed again.

Version `1.2.0` (2026-10-14, CURB-20) is a data-only minor bump; no evaluator code changed, so `EVALUATOR_VERSION` stayed `0.3.0` for this card (it moved to `0.4.0` later, with CURB-21, without a card change). A scan of `mckaywrigley/chatbot-ui` (`docs/curb/real-repo-measurement-002.md`) missed `baseURL: "https://openrouter.ai/api/v1"` because the host was not registered. `1.2.0` adds the provider id `openrouter` (packages `@openrouter/ai-sdk-provider`, `@openrouter/sdk`, `@openrouter/agent`, host `openrouter.ai`) and the vendor-documented hosts `api.together.ai`, `api.fireworks.ai`, `api.deepinfra.com` and `api.moonshot.ai`, each checked against the vendor's documentation or the npm registry. It also corrects `1.1.0`: that version registered packages, not hosts, for fireworks, deepinfra and togetherai. `falseNegativeRisks` gains two lines: OpenRouter is its own provider id, so an allowlist must include `openrouter` to permit it, while the Vercel AI Gateway host stays unflagged (an open policy question for the owner); and hosts not verified against vendor documentation (`api.together.xyz`, `api.moonshot.cn`, per-region Azure and Bedrock) are not registered. Status stays `draft, pending counsel approval`. An obligation or result produced under `1.1.0` is refused by `scan`, `report` and `diff` under `1.2.0`; confirm and scan again. Finding ids change because they include the rule version.

Version `1.3.0` (2026-10-14, CURB-19) pairs with evaluator `0.5.0`. The `chatbot-ui` scan (`docs/curb/real-repo-measurement-002.md`) showed that a copy with every flagged and unknown file removed scanned as `pass` while per-provider model catalogs (`provider: "groq"`, `modelId: "llama3-8b-8192"`) remained. `1.3.0` changes: `interpretation` (a string assigned to a provider-named target, meaning a variable, property, class field, JSX attribute, parameter default or assignment with a name ending in `provider` or `providerId`, that is a registered provider id is a finding), `prerequisites` (a file of at least 6 bare model-id values making up at least 20% of its string literals is scanned and also reported unknown as `catalog`), `falsePositiveExamples` (login objects, UI choices and cloud, identity or framework names such as `signInWithOAuth({ provider: "google" })`, `<AuthButton provider="azure" />` and `cloudProvider: "azure"`), and `falseNegativeRisks` (bare string examination now limited to values assigned to names ending in provider or providerId, with the remaining misses listed; bare model ids are never mapped to a provider; the catalog thresholds are small and rest on one repository). The registry is unchanged. Status stays `draft, pending counsel approval`. An obligation or result produced under `1.2.0` is refused by `scan`, `report` and `diff` under `1.3.0`; confirm and scan again.

Obligations bind the card id and version, not its hash, so a future edit without a bump would again be accepted by `scan` and visible only as a changed `policyCardHash` in results. The review rule above (every text change bumps the version) is the control.

## Known discrepancies

- The spec and plan list a card field called "contextual facts". The code field is `requiredFacts`.
- The card has no field for approvers or sign-off dates. Approval is tracked outside the card (this document and the charter), and the `status` string is the only in-card marker.

Counsel sign-off: ______________________ (name, date)
Security reviewer sign-off: ______________________ (name, date)

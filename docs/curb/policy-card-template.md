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

Obligations bind the card id and version, not its hash, so a future edit without a bump would again be accepted by `scan` and visible only as a changed `policyCardHash` in results. The review rule above (every text change bumps the version) is the control.

## Known discrepancies

- The spec and plan list a card field called "contextual facts". The code field is `requiredFacts`.
- The card has no field for approvers or sign-off dates. Approval is tracked outside the card (this document and the charter), and the `status` string is the only in-card marker.

Counsel sign-off: ______________________ (name, date)
Security reviewer sign-off: ______________________ (name, date)

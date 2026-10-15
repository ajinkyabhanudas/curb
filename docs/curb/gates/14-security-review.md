Status: DRAFT review brief for CURB-14. The verdict belongs to the Security owner or an independent reviewer.

# Gate 4: security review of the engine and its threat model

## Decision needed
A recorded verdict against `docs/curb/threat-model-v1.md`: safe, safe with notes, or blocked, before any production tenant is onboarded. Each finding needs a follow-up ticket or an accepted-risk note.

## Scope (from CURB-14)
File-path handling, parsing of untrusted repository content, tenant isolation, and the audit log.

## What the engine reads and writes
- **Untrusted input:** the repository snapshot (names, symlinks, sizes, file bytes, parsed with the TypeScript compiler), the agreement text, the obligation and result JSON files, and the `--store` path.
- **Output:** result, report and obligation files, a content-addressed blob store and a hash-chained audit log per tenant.
- **Runtime dependency:** `typescript` only. No network access in `engine/src` (threat-model row 11).
- Entry point: `engine/src/cli.ts` (`confirm`, `scan`, `report`, `diff`, `audit`).

## Where the threat model is honest about gaps
| Row | Gap |
|---|---|
| 11 Network egress | Static grep plus a test that patches four entry points. Not a real egress denial; container-level denial is deferred. |
| 12 Evaluator timeout | None. The evaluator is synchronous, bounded by the per-file size cap (1 MiB). No file-count or total-size limit. Deep expression chains throw and become `parse-error`. |
| 14, 19, 20 Coverage | False negatives are possible and disclosed in the card (wrappers, arrays of names, `providerOptions`, comparisons, catalogs under the thresholds). A wrong PASS is the worst failure mode. |
| 15 Concurrent writers | Single-writer assumption: two concurrent appends can race and break the chain; this is detected afterwards as CORRUPT and `append` then refuses. |
| 17 LLM risks | Not applicable: no LLM anywhere. Re-open before any LLM-assisted intake. |

## Review history so far (all AI-assisted, none a substitute for this gate)
Independent AI reviews on the evaluator changes (CURB-19 to CURB-21) found, and the author fixed: a U+2028/U+2029 line-number mismatch, a quadratic per-attribute lookup (about 57 s on a 1 MiB file), and a wrong PASS from quoted keys diluting the catalog share. They also timed 1 MiB worst-case inputs (about +0.1 to +0.35 s). These are inputs to a human review, not a verdict.

## Evidence to reproduce
`cd engine && npx tsc --noEmit && npx vitest run` (364 tests at the time of writing). Real-repository scans are in `real-repo-measurement-001` to `-003`.

## Questions for the reviewer
1. Snapshot and store path handling: can a hostile repository or `--store` / `--out` value write or read outside the intended directories (symlinks, `..`, case, Unicode)?
2. Parsing: is running the TypeScript compiler over attacker-controlled files acceptable without a timeout or sandbox? What limits would you require (worker with timeout, file-count cap, container)?
3. Tenant isolation: do the tenant checks hold for every store call?
4. Result and obligation files: is the validation strict enough that a forged or edited file cannot produce a PASS?
5. Is "no real egress denial" acceptable for the first tenant, or must container-level denial exist first?
6. Which findings block onboarding, and which are accepted risk?

## Drafted recommendation
Do not onboard a production tenant until (a) the evaluator runs under a timeout or resource limit, and (b) scans run in an environment with real egress denial. Both are the deferred Phase 2 items. Run the engine on untrusted repositories only in an isolated environment until then.

## Record the answer
A short verdict file in `docs/curb/` (verdict, reviewer, date, findings with ticket links or accepted-risk notes), the threat-model rows it changes, and CURB-14.

## What Claude will not do
Sign the verdict. Claude can fix findings once they exist.

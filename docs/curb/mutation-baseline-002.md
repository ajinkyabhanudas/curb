Status: DRAFT, unsigned. Not independently reviewed. Measures the tests, not the product.

# Seeded-defect baseline 002: snapshot, hashing, canonical JSON, scan and obligation code

Question: if the code that builds the snapshot, hashes results, runs the scan and validates the obligation were broken in a way that could change a verdict or break tamper evidence, would the existing tests notice? `mutation-baseline-001.md` asked this of `evaluate.ts`; this note covers the other high-risk paths named in `docs/workflow/profile.md` (snapshot, schema) and the code that feeds them (`scan.ts`, `obligation.ts`). The store (`engine/src/store/fs.ts`) is not covered.

## Result

40 hand-seeded defects, applied one at a time to `main` at `35d4f12` (card 1.4.0, evaluator 0.5.0), each followed by the full suite (`vitest run --bail 1`, 373 tests on the clean tree).

| File | Defects | Caught | Survived |
|---|---|---|---|
| `src/snapshot/snapshot.ts` | 13 | 10 | 3 |
| `src/schema/hashing.ts` | 4 | 4 | 0 |
| `src/schema/canonical.ts` | 4 | 4 | 0 |
| `src/scan.ts` | 8 | 7 | 1 |
| `src/obligation/obligation.ts` | 11 | 10 | 1 |
| **Total** | **40** | **35** | **5** |

By what the defect could do: 14 could turn a fail, unknown or error into a pass (13 caught, 1 survived); 16 could break tamper evidence or hash determinism (15 caught, 1 survived); 10 could produce wrong output otherwise (7 caught, 3 survived).

## The 5 survivors

| Id | Defect | Verdict |
|---|---|---|
| S10 | `takeSnapshot` stops sorting its files | **Real test gap (CURB-45).** The tree hash would depend on the order the file system returns entries. The test machines return sorted entries, so nothing fails. By reading and from the surviving defect; not demonstrated on a file system that returns unsorted entries. |
| N02 | `runScan` drops the card-version clause of its card check | **Real test gap (CURB-46), defence in depth.** No test matches the scan-level error text. In the live CLI path `confirmObligation` rejects a mismatched version first, so this is not a reachable false pass today; by reading, not shown through the CLI. |
| S03 | Remove the raw `2 * maxBytes` pre-check in `readEntry` | Equivalent in output: the later normalised-size check marks the same file too-large with the same recorded size. It guards memory (a huge file is not read), and no test checks that. Accepted. |
| S13 | Raise that pre-check from `2 *` to `200 *` the cap | Same as S03. |
| O07 | `end <= start` becomes `end < start` in the range check | Equivalent: an empty range gives an empty slice, which cannot equal the non-empty quote that an earlier check requires. |

Equivalence of S03, S13 and O07 is by reading, not proven.

## How it was run

- Script: `engine/scripts/seeded-defects-other-paths.py`. The 40 defects are listed in it with their id, file, class and the exact string replaced. It restores each file after every run; a string that did not match exactly once would be reported `NOT_APPLIED`, and none were.
- A disposable git worktree was used; `git diff` was empty afterwards.
- Defects were chosen by hand from reading the files, not randomly and not exhaustively. 35 of 40 is not a mutation score and says nothing about code not seeded.
- `--bail 1` stops at the first failing test, so how many tests catch each defect is not recorded.

## Limits

- One commit, one person choosing the defects; the same agent family that wrote much of the code chose them. An independent reviewer should check that the list is fair.
- `src/store/fs.ts`, `src/schema/result.ts`, `src/policy/card.ts`, `workflow.ts` and the CLI were not seeded.
- A survivor in a defence-in-depth check (N02) is a test gap, not proof that the live path is exposed.

## Follow-ups

- CURB-45 and CURB-46: write the two missing tests, check they fail on the defects, get an independent review.
- Seed the store, result schema, card loader and CLI exit-code code in a later baseline.
- Rerun both scripts when the evaluator, snapshot or scan code changes; nothing enforces that.

Status: DRAFT, unsigned. Not independently reviewed. Measures the tests, not the product.

# Mutation baseline 001: engine/src/evaluator/evaluate.ts

Question: if the evaluator were broken in a way that could change a verdict, would the existing tests notice?

## Result

35 hand-seeded defects, applied one at a time to `engine/src/evaluator/evaluate.ts` at commit `1527ec7` (main after PR #15; evaluator 0.5.0), each followed by the full suite (`vitest run --bail 1`, 364 tests on the clean tree).

| Outcome | Count |
|---|---|
| Caught (suite failed) | 31 |
| Survived (suite still passed) | 4 |

24 of the 27 defects that could turn a fail or unknown into a pass were caught; 3 survived. 7 of the 8 other defects were caught; 1 survived.

The 4 survivors:

| Id | Defect | Verdict |
|---|---|---|
| D07 | Remove `if (file.status !== 'ok') return 'unreadable';` | **Real test gap.** An extensionless file with status `unreadable` is then ignored, and `evaluate()` on a two-file snapshot returns `pass` instead of `unknown`. Checked by running both versions. Ticket CURB-42. |
| D25 | Remove `.toLowerCase()` on a provider-named property value | **Real test gap.** `{ provider: "OpenAI" }` gives 1 finding on the real code and 0 with the defect. Checked by calling `scanFile`. Ticket CURB-43. |
| D14 | Remove the final sort of `unknownFiles` | Probably equivalent. `snapshotDir` already sorts files with the same comparator (`snapshot.ts:55`), so the order is unchanged for any real snapshot. Not equivalent for a hand-built unsorted snapshot passed to `evaluate()`. Not proven. |
| D32 | `slash > 0` to `slash >= 0` in the gateway prefix check | Equivalent by reading: a leading `/` gives an empty prefix, which is not in the registry. Not proven by a test. |

Neither production code path is wrong today. The two real gaps are missing tests that would let a future edit introduce a silent false pass.

## How it was run

- Script: `engine/scripts/seeded-defects.py` (uncommitted). It replaces one exact string in `evaluate.ts`, runs `npx vitest run --bail 1`, and restores the file in a `finally` block. A string that matches other than once is reported `NOT_APPLIED`; none were.
- A disposable git worktree was used. After the run `git diff -- src` was empty.
- Defects were chosen by hand, in two groups: the verdict logic and file-type gates that decide `unknown` versus `pass` (D01 to D16), and the provider matching (D17 to D35). They are not random and not exhaustive, so the 31 of 35 is not a mutation score. It says nothing about code I did not seed.
- Result file: scratchpad only, not kept in the repo.

## Why not Stryker

The planned tool, Stryker 10.0.0 with its Vitest runner (declared peer range `vitest >=2.0.0`), was installed and tried against Vitest 5.0.4. Two things went wrong:

1. Stryker's default `disableTypeChecks` pattern matches `lib/**/*.ts`, which includes `fixtures/repos/*/lib/ai/providers.ts`. It prepended `// @ts-nocheck` to the fixtures, which moved a finding from line 2 to line 3 and changed tree hashes, so the dry run failed. Setting `"disableTypeChecks": false` fixed this.
2. After that, the dry run passed but every mutant, including the ones on the verdict lines, was reported as survived with "0.00 tests per mutant". A control (changing `state = 'fail'` to `'pass'` by hand and running plain Vitest) made 49 of 364 tests fail, so the suite was sensitive and the Stryker result was a harness fault. The 0% score was discarded as a failed measurement. Cause not confirmed; the likely reason is the runner not driving Vitest 5.

Stryker was uninstalled from the worktree. No dependency was added.

## Limits

- One file, one commit, one person choosing the defects. The author of the defects is the same agent family that reviews the code; an independent reviewer should check that the defect list is fair.
- `--bail 1` stops at the first failing test, so how many tests catch each defect is not recorded.
- Equivalent-mutant judgements (D14, D32) are by reading only.
- Tests that live outside `engine/test/` (none known) were not considered.
- This does not test the policy card, the snapshot code or the store, which are also high-risk paths.

## Follow-ups

- CURB-42 and CURB-43: write the two missing tests, check they fail on the defects, get an independent review.
- Decide whether to rerun this script as a gate when the evaluator changes (it takes about 10 minutes). No script enforces it today.
- Revisit Stryker when its Vitest runner states support for Vitest 5, then compare its report with this one.

Status: DRAFT, unsigned. Evidence for hypothesis H3 on two synthetic fixtures only.

# H3 cross-machine check 001: same inputs, same result hash

Hypothesis H3: the same inputs give the same result hash on repeated runs and on different machines. Before this note the determinism tests varied path, line endings, file creation order, actor and clock on one machine only.

## What was run

`engine/scripts/h3-probe.sh` confirms one obligation and scans two fixtures with every input fixed: the synthetic agreement, the shipped card (1.3.0), the quote, allowlist `anthropic`, approver `Hash probe`, and `--at 2026-10-13T09:00:00.000Z`. The commit was `bf7a8fc` (main after PR #18). The same script ran in three environments:

| Environment | OS and CPU | Node |
|---|---|---|
| The author's laptop | macOS, arm64 | 24.15.0 |
| GitHub Actions `ubuntu-latest` | Linux, x86_64 | 24.21.0 |
| GitHub Actions `macos-latest` | macOS, arm64 | 24.20.0 |

The GitHub runs were one workflow run (id 38718498498) on a throwaway branch; the workflow file was removed afterwards and is not in the repository.

## Result

| Output | Hash in all three environments |
|---|---|
| `fixtures/repos/mutated` result | `a21e75c83b498baa3851ad9eac05f81c82926fc3e99a8c68bc59a1294c27a037` |
| `fixtures/repos/fixed` result | `ce08aa5927fdc8e924b9ce370ea0e2b2b097edb134dbda11d56b8d4964fb7f03` |
| Obligation id | `192164d8997bf59ba3dcae0a2d6b64e58d47a0b218de359292a446cc4c126215` |

All three outputs were identical in all three environments.

## What this does and does not show

- It shows that, for these two small fixtures, a different OS, CPU architecture and Node minor version did not change the result hash.
- It does not cover real repositories, which is where cross-OS differences are likelier: symlinks, CRLF line endings, executable bits, very large files, case-insensitive file systems and non-ASCII path names. None of the three environments was Windows (the supported scope is macOS with Node 24).
- Two fixtures are a small sample. The check says nothing about the 1.4.0 card (CURB-24), which has a different card hash and therefore different result hashes.
- The three runs used one commit and one script written by the same author. Nobody else has run it.

## Re-running

`sh engine/scripts/h3-probe.sh <empty-output-dir>` on any machine prints the same three lines when the hashes hold. A change to the card, the evaluator, the fixtures or the report format changes them; update this note when that happens.

## Follow-up

- Extend to a pinned real repository cloned read-only on the other machine (nothing installed or run from it), starting with `vercel/chatbot` at `c2f8235e`.
- Update the charter's H3 line once this note and the charter v2 draft are both merged.

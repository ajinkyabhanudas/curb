Status: DRAFT memo for CURB-13. Not legal advice. The decision is a named reviewer's.

# Gate 3: source and licence review of the scanned repositories

## Decision needed
State what, if anything, may be copied into this repository or redistributed from third-party source used for measurement, starting with `vercel/chatbot` at `c2f8235e1f3ea903ad8b7f61447c4f74164b5c58`.

## Why it blocks
The source manifest says: "No fixture derived from `vercel/chatbot` may be copied into the repo or redistributed until a named reviewer signs off" (`docs/curb/source-manifest.md`, last section). Nothing is copied today.

## Facts
- `vercel/chatbot`: GitHub reports the licence as `NOASSERTION` ("Other"). The upstream `LICENSE` is 552 bytes: a copyright line ("Copyright 2024 Vercel, Inc.") followed by what appears to be the Apache License 2.0 notice header, not the full licence text. There is no `NOTICE` file at the pinned SHA (HTTP 404). See `source-manifest.md`, rows for LICENSE and NOTICE, and notes 1 to 3.
- Two later measurement subjects are reported by GitHub as MIT: `mckaywrigley/chatbot-ui` at `81328b61d2a4ab597a7a057be70e785cf756d9f8` and `langchain-ai/langchain-nextjs-template` at `fd4f2cd74e9d3b3f43b73a6429f25185d7be237b`. Both were read from shallow clones in a scratch directory; nothing was copied into this repository. (Licence per GitHub's metadata; the licence files themselves have not been read by a reviewer.)
- The measurement notes (`real-repo-measurement-001`, `-002`, `-003`) quote file paths, line numbers and single-line excerpts (for example an import statement) from these repositories. They make no claim about the owners' practices.
- The demand-test samples (`docs/curb/demand-test/`) use only the synthetic fixtures, not third-party source.
- `templates/` holds Common Paper agreements under CC BY 4.0, attributed in `templates/LICENSE.txt`. That is separate from this gate.

## Options
1. **Read-only measurement subjects only (current practice).** Keep cloning to a scratch directory, never copy files into this repository, quote only short excerpts. Decide that short excerpts and file paths in the notes are acceptable.
2. **Allow a fixture copy of an MIT-licensed repository** after a reviewer reads its actual `LICENSE` and records the attribution required.
3. **Write synthetic fixtures only.** No third-party source ever enters the repository. The measurement notes would then name repositories and numbers without excerpts.

## Drafted recommendation
Option 1 now, plus a reviewer confirming that the single-line excerpts in the three notes are acceptable (or asking for them to be removed). Treat `vercel/chatbot` as not copyable until its licence is clarified (for example by asking the upstream maintainers), and prefer an MIT-licensed repository if a fixture copy is ever wanted.

## Record the answer
`docs/curb/source-manifest.md` (decision, reviewer name, date), the excerpt decision in each measurement note's limits, and CURB-13.

## What Claude will not do
Interpret the licence, grant permission to copy, or sign off.

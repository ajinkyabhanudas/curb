Status: DRAFT, unsigned. Needs source and license review sign-off.

# Source manifest note

This note explains `source-manifest.json`, which is produced by `engine/scripts/source-manifest.ts`. The script calls the GitHub CLI (`gh`) and hashes what it receives. Nothing in the JSON was typed by hand.

## What was captured

Command (final, committed run): `cd engine && node scripts/source-manifest.ts vercel/chatbot ../docs/curb/source-manifest.json c2f8235e1f3ea903ad8b7f61447c4f74164b5c58`. The third argument pins an explicit commit SHA; the script checks through the API that the commit exists and the JSON records `commitPinnedByArgument: true`. The SHA itself was first resolved from the default-branch HEAD on 2026-10-13 and then re-used as the pin, so the manifest can be regenerated reproducibly. Without the third argument the script resolves HEAD at run time.

The script treats only an HTTP 404 from `gh` as "file absent". Any other failure (rate limit, auth, network, 5xx) aborts with a message naming the file and the first line of the `gh` error. A missing `gh` binary aborts with an install message.

| Field | Value as printed by the run |
|---|---|
| Repo | `vercel/chatbot` |
| Upstream commit (HEAD at retrieval) | `c2f8235e1f3ea903ad8b7f61447c4f74164b5c58` (committed 2026-07-08T21:55:00Z) |
| Retrieved at | 2026-10-14T00:00:29.348Z (pinned re-run; the first run was 2026-10-13T23:55:20.846Z and returned identical hashes) |
| SPDX licence reported by the GitHub API | `NOASSERTION` (API licence name "Other") |

Files hashed at that commit (sha256 of the raw file text as received):

| Path | Present | Bytes | sha256 |
|---|---|---|---|
| LICENSE | yes | 552 | `5809eb2eab284b24fc53b21484398fd264c6f929d3b32ecdc7108a89f037e943` |
| NOTICE | no (HTTP 404 from the contents API at the pinned SHA) | 0 | none |
| package.json | yes | 3439 | `b1ca1259ccaf3ec22abfc534c954a64d2749357db583789d8f9aa10ff8ed548c` |
| pnpm-lock.yaml | yes | 344525 | `89755153970535ec19f68306395b907ec9c43d0fa9d6420f74560d79e8280970` |

## Known discrepancies

1. The task brief expected `spdxLicense` to be `Apache-2.0`. The API returned `NOASSERTION`. The upstream `LICENSE` file is 552 bytes: a copyright line ("Copyright 2024 Vercel, Inc.") followed by the Apache License 2.0 notice header ("Licensed under the Apache License, Version 2.0 ..."), not the full licence text. GitHub's detector does not recognise that as a licence, which is the likely reason for `NOASSERTION`. This is a fact about the file as retrieved, not a legal conclusion. The manifest keeps the API value unaltered. Whether the notice is enough to rely on Apache-2.0 for redistribution is a question for the source and license reviewer.
2. The brief expected a `LICENSE` entry with `present: true`. That holds. `NOTICE` is absent upstream, so there is no NOTICE text to carry over. Absence was established by an HTTP 404 from the contents API at the pinned SHA, not by a generic failure. Re-verify with:
   `gh api 'repos/vercel/chatbot/contents/NOTICE?ref=c2f8235e1f3ea903ad8b7f61447c4f74164b5c58'` (expect `gh: Not Found (HTTP 404)`).
3. The `attribution` string in the JSON no longer says "licensed NOASSERTION". When GitHub reports `NOASSERTION` it states that no recognised SPDX licence was reported, gives the LICENSE byte count and says the source reviewer must review it before any redistribution.

## Common Paper templates already in the repo

`templates/` holds Common Paper agreements (AI Addendum, CSA, DPA, SLA). They are covered by CC BY 4.0, attributed in `templates/LICENSE.txt` and the repository README. They are separate from the Vercel fixture source and are not part of this manifest.

## Open human gate

No fixture derived from `vercel/chatbot` may be copied into the repo or redistributed until a named reviewer signs off on the source and licence question above. This note does not give that sign-off.

Sign-off: ______________________ (name, role, date)

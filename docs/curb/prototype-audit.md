Status: DRAFT, unsigned. Needs product owner and security reviewer sign-off.

# Prototype audit: form-to-PDF assessment app

## Summary

`frontend/` is a client-only Next 16.4.0 and React 19.3.0 app (jsPDF for export) built in two commits: `35295a2` (prototype generator) and `e4513d8` (form beside a live document). It has no backend, database, authentication, uploads or deployment configuration: the tracked tree has no server routes, no `.env` files, no Dockerfile, no Vercel or CI configuration. The frontend sits on branch `kan-5-live-document-ui` (open PR #6) and is not on `main`; this engine branch was cut from it and carries the same files. The root README still says the repository has no source code, which is out of date.

Method: `git ls-files frontend` for the inventory, `npm test` in `frontend/` for the test counts, and the secret grep below. No dependency CVE scan was run (it needs the network and a package registry call); that remains open.

## Inventory and decision

Tracked files under `frontend/` (`git ls-files frontend`): 32, including `package-lock.json`, the favicon and AGENTS.md/README.md.

| Module | Function | Tests | Fit with V1 | Decision | Rollback point |
|---|---|---|---|---|---|
| `frontend/src/lib/assessment/*` (evaluate, requirements/*, defaults, options, helpers, types) | Maps form answers to framework requirements (EU AI Act, GDPR, NIST AI RMF, ISO 42001) | `evaluate.test.ts` (20 tests) | Form-to-PDF model: no snapshots, evidence or rules | Archive read-only | tag `prototype-form-to-pdf` |
| `frontend/src/lib/assessment/pdf.ts` | jsPDF export | `pdf.test.ts` (2 tests) | Presentation only | Archive | same tag |
| `frontend/src/components/*` (Workspace, StepForm, DocumentView, fields) | Form and live document UI | `Workspace.test.tsx` (10 tests) | Candidate shell for M3 | Retain; adapt behind an adapter at M3 | same tag |
| `frontend/src/app/*`, `next.config.ts`, styles, tsconfig, eslint | App shell | none | Reusable | Retain | same tag |
| `templates/`, `catalog.json` (repo root) | Common Paper templates (CC BY 4.0, attributed in `templates/LICENSE.txt`) | none | Illustrative clause vocabulary | Retain | same tag |

Named owner for each decision: unassigned (to be named). The decision column is a proposal until a product owner signs.

## Tests

Command: `cd frontend && npm test` (dependencies were already installed; no `npm install` was run). Result: 3 test files passed, 32 tests passed, 0 failed (Workspace.test.tsx 10, evaluate.test.ts 20, pdf.test.ts 2).

## Secret scan

Command, run from the repo root:

```
git grep -nEi '(api[_-]?key|secret|token|password|BEGIN (RSA|EC|OPENSSH) PRIVATE)' -- . ':!templates' ':!frontend/package-lock.json' ':!engine/package-lock.json' ':!docs' | head -40
```

Result: 23 hits, fewer than the 40-line cap, so the list is complete. Hits by file: `.gitignore` 1, `engine/test/snapshot.test.ts` 3, `engine/test/store.test.ts` 1, `test_plan` 18. There are no hits in `frontend/`.

| Hit | Triage |
|---|---|
| `.gitignore:70` | Comment heading "Environment and secrets". Benign. |
| `engine/test/snapshot.test.ts:30,33,37` | Test fixture named `secret.ts` containing the literal `TOP SECRET`, used to prove symlinks are not followed. Synthetic. Benign. |
| `engine/test/store.test.ts:24` | The string `'secret'` as dummy blob content. Benign. |
| `test_plan` (18 lines: 64, 88, 99, 102, 129, 150, 155, 156, 163, 227, 244, 324, 332, 338, 340, 348, 378, 382) | Prose in the planning document: the words "secret", "token" and "secrets manager" in requirements and threat text. No credential values. Benign. |

No real key, token, password or private key was found by this pattern. The grep is a keyword filter, not a secret scanner; it does not detect high-entropy strings without those words. A dedicated scanner (for example gitleaks) over full history is not run here and remains an open item.

## Archive tag

Local tag created: `git tag prototype-form-to-pdf e4513d8`, resolving to `e4513d8383b67f153b65802499cd08dc9219934a`. It has not been pushed. Pushing it is a human decision.

## Data and credential exposure

The tracked tree shows no customer data, production credentials, analytics SDKs or deployed environments. This is a statement about the tracked files at this commit, not about any deployment outside the repository, which this audit cannot see. The product owner should confirm there was none.

## Open items

- Name an owner for each row.
- Dependency licence and CVE review of `frontend/package-lock.json` (not done).
- History-wide secret scan with a dedicated tool (not done).
- Push or not push the `prototype-form-to-pdf` tag.
- Confirm no deployment of the prototype exists.

Sign-off: ______________________ (name, role, date)

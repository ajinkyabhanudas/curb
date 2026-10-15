#!/bin/sh
# Same inputs on every machine: fixed agreement, card, quote, approver and time. Prints the result hash of each fixture.
set -eu
cd "$(dirname "$0")/.."
OUT="${1:?output dir}"
rm -rf "$OUT"; mkdir -p "$OUT/store"
Q="Provider will route Customer Content for model inference only to the following model providers: Anthropic."
node src/cli.ts confirm --agreement fixtures/agreement/synthetic-ai-addendum.md --card policies/unapproved-provider-reference.v1.json --quote "$Q" --allow anthropic --approver "Hash probe" --at 2026-10-13T09:00:00.000Z --store "$OUT/store" --out "$OUT/obligation.json" > /dev/null
for repo in mutated fixed; do
  node src/cli.ts scan --repo "fixtures/repos/$repo" --card policies/unapproved-provider-reference.v1.json --agreement fixtures/agreement/synthetic-ai-addendum.md --obligation "$OUT/obligation.json" --store "$OUT/store" --out "$OUT/$repo.json" > "$OUT/$repo.txt"
  echo "$repo $(grep -o 'result sha256:[0-9a-f]*' "$OUT/$repo.txt")"
done
node -e "const o=require('fs').readFileSync(process.argv[1],'utf8');const j=JSON.parse(o);console.log('obligation id',j.id||j.body?.id)" "$OUT/obligation.json" 2>/dev/null || true

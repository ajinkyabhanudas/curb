#!/bin/sh
# PR gates (CURB-35). Reads the pull request from environment variables, never from interpolated shell text:
#   PR_BRANCH, PR_TITLE, PR_BODY, CHANGED_FILES (one path per line)
# Exit 0 if every gate holds, 1 otherwise, with one message per failed gate.
#
# 1. The branch and the title carry a CURB ticket key.
# 2. A pull request that changes a high-risk path has an "Independent review: <text>" line in its body.
#
# Limits: gate 1 checks the format of the key, not that the ticket exists in Jira. Gate 2 checks that a review is
# claimed, not that it happened or what it found; it rejects placeholder values only.
set -eu

# Keep in step with "High-risk paths" in docs/workflow/profile.md (a test compares the two).
HIGH_RISK_PATHS="engine/src/evaluator/ engine/src/snapshot/ engine/src/store/ engine/src/schema/ engine/policies/"

fail=0
problem() {
  printf 'FAIL: %s\n' "$1" >&2
  fail=1
}

branch="${PR_BRANCH-}"
title="${PR_TITLE-}"
body="$(printf '%s' "${PR_BODY-}" | tr -d '\r')"
files="${CHANGED_FILES-}"

if ! printf '%s\n' "$branch" | grep -Eq '^CURB-[0-9]+(-|$)'; then
  problem "branch name must start with a CURB ticket key such as CURB-35-short-name (got: $branch)"
fi
if ! printf '%s\n' "$title" | grep -Eq '^CURB-[0-9]+: '; then
  problem "pull request title must start with a CURB ticket key and a colon, such as 'CURB-35: Add the gates' (got: $title)"
fi

touches_high_risk=0
for p in $HIGH_RISK_PATHS; do
  if printf '%s\n' "$files" | awk -v p="$p" 'index($0, p) == 1 { found = 1 } END { exit !found }'; then
    touches_high_risk=1
    hit="$p"
    break
  fi
done

if [ "$touches_high_risk" -eq 1 ]; then
  # A line that starts with the label, with a value that is not a placeholder.
  if ! printf '%s\n' "$body" | awk '
    index($0, "Independent review:") == 1 {
      v = substr($0, length("Independent review:") + 1)
      gsub(/^[ \t]+|[ \t]+$/, "", v)
      l = tolower(v)
      if (v != "" && l != "none" && l != "n/a" && l != "na" && l != "todo" && l != "tbd" && l != "pending" && l != "-") ok = 1
    }
    END { exit !ok }'; then
    problem "this pull request changes $hit (a high-risk path); its body needs a line 'Independent review: <reviewer and verdict>' with a real value"
  fi
fi

if [ "$fail" -eq 0 ]; then
  echo "PR gates: ok"
fi
exit "$fail"

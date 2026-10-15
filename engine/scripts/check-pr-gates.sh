#!/bin/sh
# PR gates (CURB-35). Reads the pull request from environment variables, never from interpolated shell text:
#   PR_BRANCH, PR_TITLE, PR_BODY, BASE_REVISION (the revision the pull request is compared with, e.g. origin/main)
# and asks git which protected paths the pull request changes, so renames, quoted names and odd characters cannot hide one.
# Exit 0 if every gate holds, 1 otherwise, with one message per failed gate.
#
# 1. The branch and the title carry a CURB ticket key.
# 2. A pull request that changes a high-risk path, or the gate itself, has an "Independent review: <text>" line in its body.
#
# Limits: gate 1 checks the format of the key, not that the ticket exists in Jira. Gate 2 checks that a review is
# claimed, not that it happened or what it found; it rejects placeholder values only, so a line inside a code fence or
# an HTML comment still counts. The gate files are protected paths too. In CI the workflow runs the base branch's copy of
# this script, so editing the script inside a PR cannot switch the check off. Editing the workflow can: only a required
# status check plus branch protection or CODEOWNERS on .github/ (owner settings in GitHub) closes that.
set -eu

# Keep in step with "High-risk paths" in docs/workflow/profile.md (a test compares the two).
HIGH_RISK_PATHS="engine/src/evaluator/ engine/src/snapshot/ engine/src/store/ engine/src/schema/ engine/policies/"
# The gate and its configuration are protected the same way.
GATE_PATHS="engine/scripts/check-pr-gates.sh .github/workflows/ docs/workflow/profile.md"

fail=0
problem() {
  printf 'FAIL: %s\n' "$1" >&2
  fail=1
}

branch="${PR_BRANCH-}"
title="${PR_TITLE-}"
body="$(printf '%s' "${PR_BODY-}" | tr -d '\r')"
base="${BASE_REVISION-}"

if ! printf '%s\n' "$branch" | grep -Eq '^CURB-[0-9]+(-|$)'; then
  problem "branch name must start with a CURB ticket key such as CURB-35-short-name (got: $branch)"
fi
if ! printf '%s\n' "$title" | grep -Eq '^CURB-[0-9]+: '; then
  problem "pull request title must start with a CURB ticket key and a colon, such as 'CURB-35: Add the gates' (got: $title)"
fi

changed=""
if [ -z "$base" ]; then
  problem "BASE_REVISION is not set, so the changed paths cannot be checked"
elif [ "${base#-}" != "$base" ]; then
  problem "BASE_REVISION must not start with '-' (got: $base)"
else
  # The pathspec makes git do the matching, and -z keeps unusual names intact. --no-renames and core.quotePath=false are
  # redundant with those two today (seeded defects that remove either are not caught); they are kept so that a rename
  # out of a protected path and a quoted name stay visible if the pathspec or -z ever change. The output goes to a file first because a pipeline in plain sh reports only the last
  # command's status, which would hide a git failure; with `set -e` a failing git stops the script.
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' EXIT
  # shellcheck disable=SC2086
  git -c core.quotePath=false diff --no-renames --name-only -z "$base...HEAD" -- $HIGH_RISK_PATHS $GATE_PATHS > "$tmp"
  changed="$(tr '\0' '\n' < "$tmp")"
fi
hit="$(printf '%s\n' "$changed" | head -n 1)"

if [ -n "$changed" ]; then
  # A line that starts with the label, with a value that is not a placeholder.
  if ! printf '%s\n' "$body" | awk '
    index($0, "Independent review:") == 1 {
      v = substr($0, length("Independent review:") + 1)
      gsub(/^[ \t]+|[ \t]+$/, "", v)
      l = tolower(v)
      if (v != "" && substr(v, 1, 1) != "<" && l != "none" && l != "no" && l != "n/a" && l != "na" && l != "todo" && l != "tbd" && l != "pending" && l != "-" && l != "none yet" && l != "not done") ok = 1
    }
    END { exit !ok }'; then
    problem "this pull request changes $hit (a high-risk or gate path); its body needs a line 'Independent review: <reviewer and verdict>' with a real value"
  fi
fi

if [ "$fail" -eq 0 ]; then
  echo "PR gates: ok"
fi
exit "$fail"

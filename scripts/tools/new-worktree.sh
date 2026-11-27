#!/usr/bin/env bash
# Create a worktree ../AI27-<topic> on a new branch <topic>, with node_modules as a JUNCTION to the
# main checkout's node_modules (no npm ci: instant, no extra disk; removal is instant too).
#
# Usage: new-worktree.sh <topic> [base-ref]          (base defaults to master)
#        new-worktree.sh <topic> [base-ref] --own-modules   (real npm ci: use only when the branch changes package.json)
#
# Remove later with scripts/tools/clean-worktrees.sh once merged (or by hand: cmd /c rmdir <dir>\node_modules first).
set -eu
TOPIC="${1:?usage: new-worktree.sh <topic> [base-ref] [--own-modules]}"
BASE="master"; OWN=0
shift
for a in "$@"; do case "$a" in --own-modules) OWN=1 ;; *) BASE="$a" ;; esac; done

MAIN=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
DIR="$(dirname "$MAIN")/$(basename "$MAIN")-$TOPIC"
[ -e "$DIR" ] && { echo "$DIR already exists"; exit 1; }
[ -d "$MAIN/node_modules" ] || { echo "main checkout has no node_modules (run npm ci there first)"; exit 1; }

git -C "$MAIN" worktree add "$DIR" -b "$TOPIC" "$BASE"
if [ $OWN -eq 1 ]; then
  (cd "$DIR" && npm ci)
else
  cmd //c mklink //J "$(cygpath -w "$DIR/node_modules")" "$(cygpath -w "$MAIN/node_modules")" >/dev/null
  # a branch that changes dependencies must not share modules with master
  if ! git -C "$MAIN" diff --quiet "$BASE" master -- package.json package-lock.json 2>/dev/null; then
    echo "WARNING: package.json/lock differ between $BASE and master; consider --own-modules"
  fi
fi
echo "ready: $DIR (branch $TOPIC, base $BASE)"

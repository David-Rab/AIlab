#!/usr/bin/env bash
# Remove merged git worktrees (and their branches) safely on Windows.
#
# Usage: clean-worktrees.sh [--apply] [--scratch-ok] [--limit N] [worktree-dir ...]
#   no dirs      -> consider every worktree; with dirs -> only those (names like AI27-mk5 or full paths)
#   --apply      -> actually remove (default is a dry run)
#   --scratch-ok -> also remove worktrees whose only changes are UNTRACKED files (scratch);
#                   modified/staged tracked files always block removal
#   --limit N    -> at most N removals per run (default 8), 3 s pause between them
#
# Guards (all must hold): not the main checkout, not locked, HEAD is an ancestor of master and not
# master's tip (a fresh branch at master may be a session just starting), no tracked changes.
#
# node_modules: git worktree remove FOLLOWS junctions (it emptied the main checkout's node_modules on
# 2026-11-27). So a link is detached with `rmdir` (link only), a real directory is deleted with
# `rmdir /s /q`, and git worktree remove runs only if nothing named node_modules remains.
# After every removal the main checkout's node_modules is re-counted; any change aborts the run.
# Branches are deleted with `git branch -d` (git refuses if unmerged).
set -u
APPLY=0; SCRATCH=0; LIMIT=8; DONE=0; ONLY=()
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --scratch-ok) SCRATCH=1 ;;
    --limit) shift; LIMIT="${1:?--limit needs a number}" ;;
    -*) echo "unknown option $1"; exit 2 ;;
    *) ONLY+=("$1") ;;
  esac
  shift
done
MAIN=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$MAIN" || exit 1
PARENT=$(dirname "$MAIN")
MASTER=$(git rev-parse master)
NM_COUNT=$(ls -A "$MAIN/node_modules" 2>/dev/null | wc -l)
[ "$NM_COUNT" -gt 0 ] || { echo "main checkout node_modules is empty; run npm ci there first"; exit 1; }

wanted() {  # is this path in the explicit list (or is there no list)?
  [ ${#ONLY[@]} -eq 0 ] && return 0
  local w
  for w in "${ONLY[@]}"; do
    case "$w" in */*|*:*) [ "$1" = "$w" ] && return 0 ;; *) [ "$1" = "$PARENT/$w" ] && return 0 ;; esac
  done
  return 1
}

git worktree list --porcelain | tr -d '\r' | awk -v RS= -F'\n' '{
  p="";b="";l="";
  for(i=1;i<=NF;i++){ if($i~/^worktree /)p=substr($i,10); if($i~/^branch /)b=substr($i,8); if($i~/^locked/)l="1"; if($i~/^prunable/)l="2" }
  print p "|" b "|" l }' > /tmp/clean-worktrees.list

while IFS='|' read -r path ref locked; do
  [ "$path" = "$MAIN" ] && continue
  wanted "$path" || continue
  if [ $DONE -ge $LIMIT ]; then echo "LIMIT  $LIMIT reached; run again for more"; break; fi
  branch="${ref#refs/heads/}"
  why=""; force=""
  if [ -n "$locked" ]; then why="locked/prunable"
  elif [ ! -d "$path" ]; then why="directory missing (run git worktree prune)"
  else
    head=$(git -C "$path" rev-parse HEAD 2>/dev/null) || why="cannot read HEAD"
    if [ -z "$why" ]; then
      st=$(git -C "$path" status --porcelain 2>/dev/null)
      if [ "$head" = "$MASTER" ]; then why="at master tip (possibly a new session)"
      elif ! git merge-base --is-ancestor "$head" "$MASTER"; then why="NOT merged"
      elif [ -n "$st" ]; then
        if echo "$st" | grep -qv '^??'; then why="tracked changes"
        elif [ $SCRATCH -eq 1 ]; then force="--force"
        else why="untracked files (use --scratch-ok if scratch)"
        fi
      fi
    fi
  fi
  if [ -n "$why" ]; then echo "SKIP    $path [${branch:-detached}]: $why"; continue; fi
  DONE=$((DONE+1))
  if [ $APPLY -eq 0 ]; then echo "WOULD   remove $path [${branch:-detached}]${force:+ (discarding untracked)}"; continue; fi

  nm="$path/node_modules"; nmw=$(cygpath -w "$nm")
  if [ -L "$nm" ] || cmd //c dir //AL //B "$(cygpath -w "$path")" 2>/dev/null | tr -d '\r' | grep -qx node_modules; then
    cmd //c rmdir "$nmw" >/dev/null 2>&1                   # link only, never the target
  elif [ -d "$nm" ]; then
    cmd //c rmdir //s //q "$nmw" >/dev/null 2>&1           # real directory
  fi
  if [ -e "$nm" ] || [ -L "$nm" ]; then
    echo "FAILED  $path: node_modules still present; not running git worktree remove"; continue
  fi
  if git worktree remove $force "$path"; then
    [ -n "$branch" ] && git branch -d "$branch" >/dev/null 2>&1
    echo "REMOVED $path [${branch:-detached}]"
  else
    echo "FAILED  $path [${branch:-detached}]: git worktree remove refused"
  fi
  now=$(ls -A "$MAIN/node_modules" 2>/dev/null | wc -l)
  if [ "$now" -ne "$NM_COUNT" ]; then
    echo "ABORT   main node_modules changed ($NM_COUNT -> $now) after $path; run npm ci in $MAIN"; exit 1
  fi
  sleep 3
done < /tmp/clean-worktrees.list

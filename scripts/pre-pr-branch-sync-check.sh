#!/usr/bin/env bash
# Ensures the current branch contains origin/main before opening a PR.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Fetching origin/main..."
git fetch origin main

if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "FAIL: branch is behind origin/main — merge or rebase main first." >&2
  exit 1
fi

echo "OK: branch includes origin/main."
npm run lint
npm run test

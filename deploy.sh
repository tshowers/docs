#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

unset ELECTRON_RUN_AS_NODE || true
trap 'echo "Deploy aborted - nothing was deployed." >&2' ERR

echo "Running Docs production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Step 1/5: Building the production Docs bundle..."
npm run build

echo "Step 2/5: Running unit and end-to-end tests..."
npm run test:ci
npm run e2e

echo "Step 3/5: Committing changes..."
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "Deploy Docs $(date +'%Y-%m-%d %H:%M:%S')"
else
  echo "No changes to commit - working tree is clean."
fi

echo "Step 4/5: Deploying Docs to Firebase Hosting site todd-docs..."
firebase deploy --project taliferrotech --only hosting:todd-docs

echo "Step 5/5: Pushing to GitHub..."
git push -u origin HEAD || echo "WARNING: deployed, but git push failed - push manually." >&2

echo "Docs hosting deploy complete."

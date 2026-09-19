#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

unset ELECTRON_RUN_AS_NODE || true
trap 'echo "Deploy aborted - nothing was deployed." >&2' ERR

echo "Running Docs production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Step 1/4: Building the production Docs bundle..."
npm run build

echo "Step 2/4: Running unit and end-to-end tests..."
npm run test:ci
npm run e2e

echo "Step 3/4: Committing changes..."
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "Deploy Docs $(date +'%Y-%m-%d %H:%M:%S')"
else
  echo "No changes to commit - working tree is clean."
fi

echo "Step 4/4: Deploying Docs to Firebase Hosting site todd-docs..."
firebase deploy --project taliferrotech --only hosting:todd-docs

echo "Docs hosting deploy complete."

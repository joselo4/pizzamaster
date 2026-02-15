#!/usr/bin/env bash
set -o errexit
set -o pipefail

echo "== Render build: forcing clean deps =="
rm -rf node_modules
rm -f package-lock.json

npm install

echo "== Vite version used =="
node -e "try{console.log('VITE_VERSION=' + require('vite/package.json').version)}catch(e){console.error('VITE_NOT_FOUND'); process.exit(1)}"

npm run build

echo "== Verify dist/index.html is real HTML =="
if [[ ! -f dist/index.html ]]; then
  echo "ERROR: dist/index.html not found"; exit 1
fi

head -n 3 dist/index.html

# Fail fast if index.html is the bad JS export
if grep -q "^export default "/assets/" dist/index.html; then
  echo "ERROR: dist/index.html is NOT HTML (contains export default).";
  echo "This means the build is still wrong. Check that Render used this script and that Vite is official.";
  exit 1
fi

# Fail if doctype missing (quirks)
if ! grep -qi "<!doctype html>" dist/index.html; then
  echo "ERROR: dist/index.html missing DOCTYPE"; exit 1
fi

echo "OK: dist/index.html looks correct"

#!/usr/bin/env sh
set -e

echo "== Render build: clean install =="
rm -rf node_modules
rm -f package-lock.json

npm install

echo "== Vite version =="
node -p "'VITE_VERSION=' + require('vite/package.json').version"

npm run build

echo "== Verify dist/index.html =="
[ -f dist/index.html ] || { echo "ERROR: dist/index.html not found"; exit 1; }

# show first lines
head -n 3 dist/index.html || true

# fail if it's the JS export stub
if grep -q '^export default "/assets/' dist/index.html; then
  echo "ERROR: dist/index.html is NOT HTML (contains export default).";
  exit 1
fi

# fail if doctype missing
if ! grep -qi '<!doctype html' dist/index.html; then
  echo "ERROR: dist/index.html missing DOCTYPE";
  exit 1
fi

echo "OK: dist/index.html is HTML"

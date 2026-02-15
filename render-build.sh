#!/usr/bin/env bash
set -o errexit
set -o pipefail

# Render: evita lockfile viejo que forzaba rolldown-vite
rm -f package-lock.json
npm install
npm run build

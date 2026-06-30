#!/usr/bin/env bash
# Build wrapper for NTFS drives where native binaries can't be executed.
# Copies the project to /tmp, runs the build there, then syncs dist/ back.

set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
TMP=/tmp/sg-ext-build
ENGINE_SRC="$(cd "$SRC/../remura-engine" && pwd)"

echo "→ Copying extension source to $TMP …"
rm -rf "$TMP"
mkdir -p "$TMP"
rsync -a --exclude=node_modules --exclude=dist --exclude=popup/popup.js \
  "$SRC/" "$TMP/"

# Make engine source available alongside the extension in /tmp
mkdir -p "$TMP/../sg-engine-src"
rsync -a --exclude=node_modules "$ENGINE_SRC/" /tmp/rm-engine-src/

echo "→ Installing dependencies …"
npm install --prefix "$TMP" 2>&1 | tail -3

echo "→ Generating icons …"
node "$TMP/scripts/generate-icons.js"
cp -r "$TMP/icons/"* "$SRC/icons/"

echo "→ Building TypeScript …"
node "$TMP/node_modules/tsup/dist/cli-main.js" \
  --config "$TMP/tsup.config.ts" 2>&1

echo "→ Syncing build output back …"
rsync -a "$TMP/dist/"  "$SRC/dist/"
rsync -a "$TMP/popup/" "$SRC/popup/"

echo "✓ Build complete. Load the extension from: $SRC"

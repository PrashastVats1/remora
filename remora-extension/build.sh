#!/usr/bin/env bash
# Build wrapper for NTFS drives where native binaries can't be executed.
# Copies the project to /tmp, runs the build there, then syncs dist/ back.

set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
TMP=/tmp/sg-ext-build
ENGINE_SRC="$(cd "$SRC/../remora-engine" && pwd)"

echo "→ Copying extension source to $TMP …"
rm -rf "$TMP"
mkdir -p "$TMP"
rsync -a --exclude=node_modules --exclude=dist --exclude=popup/popup.js \
  "$SRC/" "$TMP/"

# tsup.config.ts aliases 'remora-engine' to '../remora-engine/src/index.ts'
# resolved relative to itself — i.e. a sibling of $TMP. Must land there exactly.
echo "→ Copying engine source to $(dirname "$TMP")/remora-engine …"
rm -rf "$(dirname "$TMP")/remora-engine"
rsync -a --exclude=node_modules "$ENGINE_SRC/" "$(dirname "$TMP")/remora-engine/"

echo "→ Installing dependencies …"
npm install --prefix "$TMP" 2>&1 | tail -3

echo "→ Generating icons …"
node "$TMP/scripts/generate-icons.js"
cp -r "$TMP/icons/"* "$SRC/icons/"

echo "→ Building TypeScript …"
(cd "$TMP" && "$TMP/node_modules/.bin/tsup" --config "$TMP/tsup.config.ts")

echo "→ Syncing build output back …"
rsync -a "$TMP/dist/"  "$SRC/dist/"
rsync -a "$TMP/popup/" "$SRC/popup/"

echo "✓ Build complete. Load the extension from: $SRC"

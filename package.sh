#!/usr/bin/env bash
# package.sh — build a Chrome-Web-Store-shaped zip from extension/
# Usage: ./package.sh
# Output: dist/htmlvault-<version>.zip
#
# The zip's root must be the extension's contents directly (manifest.json at
# the top level), NOT wrapped in an extra folder — Chrome's "Load unpacked"
# and the Web Store both expect this layout.

set -euo pipefail

cd "$(dirname "$0")"

EXT_DIR="extension"
DIST_DIR="dist"

if [[ ! -f "$EXT_DIR/manifest.json" ]]; then
  echo "error: $EXT_DIR/manifest.json not found" >&2
  exit 1
fi

# Pull version from manifest so the zip is self-identifying.
VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$EXT_DIR/manifest.json" \
  | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
if [[ -z "$VERSION" ]]; then
  echo "error: could not read version from manifest.json" >&2
  exit 1
fi

mkdir -p "$DIST_DIR"
OUT="$DIST_DIR/htmlvault-$VERSION.zip"
rm -f "$OUT"

# Zip from inside extension/ so paths inside the archive start with manifest.json,
# not extension/manifest.json. Exclude OS / editor cruft defensively.
(
  cd "$EXT_DIR"
  zip -r -q "../$OUT" . \
    -x "*.DS_Store" \
    -x "__MACOSX/*" \
    -x "*.swp" \
    -x "*~" \
    -x ".git/*" \
    -x ".gitignore"
)

echo "built: $OUT"
echo "size:  $(du -h "$OUT" | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Test locally: unzip to a fresh dir and Load unpacked in chrome://extensions"
echo "  2. Create a GitHub release and attach this zip"
echo "     gh release create v$VERSION $OUT --title 'HTMLVault v$VERSION' --notes 'see CHANGELOG'"

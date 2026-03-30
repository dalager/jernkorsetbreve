#!/usr/bin/env bash
# Lint: detect Unicode escapes and HTML entities for Danish characters in TSX files.
# These should be replaced with actual æøåÆØÅ characters.
#
# Usage: npm run lint:danish
#        scripts/lint-danish-chars.sh [directory]

set -euo pipefail

DIR="${1:-apps/website/src}"

PATTERNS=(
  # Unicode escapes for æøå
  '\\u00e6' '\\u00f8' '\\u00e5'
  '\\u00c6' '\\u00d8' '\\u00c5'
  # HTML entities for Danish chars
  '&aelig;' '&oslash;' '&aring;'
  '&Aelig;' '&Oslash;' '&Aring;'
  # Common HTML entities that should be literal
  '&mdash;' '&ndash;' '&laquo;' '&raquo;'
  '&minus;' '&hellip;' '&rarr;'
)

FOUND=0

for pat in "${PATTERNS[@]}"; do
  MATCHES=$(grep -rn --include='*.tsx' --include='*.ts' "$pat" "$DIR" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    if [ "$FOUND" -eq 0 ]; then
      echo "❌ Found escaped Danish characters or HTML entities that should be literal:"
      echo ""
    fi
    echo "$MATCHES"
    FOUND=1
  fi
done

if [ "$FOUND" -eq 0 ]; then
  echo "✅ No escaped Danish characters found."
  exit 0
else
  echo ""
  echo "Fix: Replace with actual characters (æøåÆØÅ—–«»…→)"
  exit 1
fi

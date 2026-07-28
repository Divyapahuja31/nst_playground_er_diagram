#!/bin/bash
# setup.sh — Downloads and builds the Bliss graph-isomorphism binary.
# Run from inside the backend/ directory: bash setup.sh
# Creates: backend/vendor/bliss/bliss  (the compiled binary)
#          backend/vendor/paths.json   (path registry read by app/validator/engine/native.py)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENDOR_DIR="$SCRIPT_DIR/vendor"

[ -d "$VENDOR_DIR" ] || mkdir -p "$VENDOR_DIR"
cd "$VENDOR_DIR"

if [ ! -d bliss ]; then
  echo "Cloning bliss..."
  git clone --depth 1 https://github.com/digraphs/bliss
fi

if [ ! -f bliss/bliss ]; then
  echo "Building bliss..."
  make -C bliss
fi

# Write the path registry (valid JSON — no trailing comma)
cat > paths.json << EOF
{
  "bliss": "$VENDOR_DIR/bliss/bliss"
}
EOF

echo "OK:"
echo "  bliss -> $VENDOR_DIR/bliss/bliss"

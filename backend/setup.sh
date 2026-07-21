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

  # Ensure cmake is available
  if ! command -v cmake &>/dev/null; then
    echo "cmake not found. Attempting to install via Homebrew..."
    if command -v brew &>/dev/null; then
      brew install cmake
    else
      echo "ERROR: cmake is required but not installed, and Homebrew is not available."
      echo "Install cmake manually: https://cmake.org/download/"
      exit 1
    fi
  fi

  # Clean old build cache to avoid CMake source directory conflicts
  rm -rf bliss/build
  mkdir -p bliss/build

  cmake -S bliss -B bliss/build -DCMAKE_BUILD_TYPE=Release
  cmake --build bliss/build

  # The binary may be named bliss or bliss_cli depending on cmake config
  BUILT_BIN=""
  for candidate in bliss/build/bliss bliss/build/bliss_cli bliss/build/src/bliss; do
    if [ -f "$candidate" ]; then
      BUILT_BIN="$candidate"
      break
    fi
  done

  if [ -z "$BUILT_BIN" ]; then
    echo "ERROR: Could not find compiled bliss binary. Files in build dir:"
    find bliss/build -type f | head -20
    exit 1
  fi

  cp "$BUILT_BIN" bliss/bliss
  echo "Binary copied from $BUILT_BIN"
fi

# Write the path registry (valid JSON — no trailing comma)
cat > paths.json << EOF
{
  "bliss": "$VENDOR_DIR/bliss/bliss"
}
EOF

echo "OK:"
echo "  bliss -> $VENDOR_DIR/bliss/bliss"

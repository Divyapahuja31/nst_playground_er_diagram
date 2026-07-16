#!/bin/bash
set -euo pipefail
[ -d vendor ] || mkdir vendor
cd "$(dirname "$0")/vendor"

[ -d saucy ] || git clone --depth 1 https://github.com/hrbrmstr/saucy
[ -d bliss ] || git clone --depth 1 https://github.com/digraphs/bliss



cat > paths.json <<EOF
{
  "bliss": "$(pwd)/bliss/bliss",
  "saucy": "$(pwd)/saucy_bin"
}
EOF

echo "OK:"
echo "  bliss -> $(pwd)/bliss/bliss"
echo "  saucy -> $(pwd)/saucy_bin"

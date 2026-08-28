#!/bin/zsh
set -euo pipefail
PACKAGE_DIR="${0:A:h}"
exec "$PACKAGE_DIR/runtime/node" "$PACKAGE_DIR/start-local.mjs"

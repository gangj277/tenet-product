#!/usr/bin/env bash
set -euo pipefail

# Lumen local bootstrap
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/gangj277/tenet-product/main/scripts/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/gangj277/tenet-product/main/scripts/install.sh | bash -s -- my-lumen-dir

REPO_URL="https://github.com/gangj277/tenet-product.git"
TARGET_DIR="${1:-lumen}"

echo ""
echo "  ╭──────────────────────────────────────────────╮"
echo "  │  Lumen — open-source research workspace     │"
echo "  ╰──────────────────────────────────────────────╯"
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is required." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js 20+ is required." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required." >&2
  exit 1
fi

if [ -e "$TARGET_DIR" ]; then
  echo "Error: target path '$TARGET_DIR' already exists." >&2
  exit 1
fi

echo "  Cloning ${REPO_URL} into ${TARGET_DIR}..."
git clone "$REPO_URL" "$TARGET_DIR"

cd "$TARGET_DIR"

echo "  Installing dependencies..."
npm install

echo ""
echo "  ✓ Lumen is ready locally."
echo ""
echo "  Next steps:"
echo "    1. Run: npx codex login"
echo "    2. Run: npm run electron:local"
echo ""

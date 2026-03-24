#!/usr/bin/env bash
set -euo pipefail

# Lumen — AI-native research workspace
# Install script: curl -fsSL https://raw.githubusercontent.com/gangj277/tenet-product/main/scripts/install.sh | bash

REPO="gangj277/tenet-product"
APP_NAME="Lumen"
LATEST_URL="https://github.com/${REPO}/releases/latest"

# ── Detect OS and architecture ──

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)  PLATFORM="mac" ;;
  Linux)   PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  *) echo "Unsupported OS: $OS" >&2; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64)  ARCH_LABEL="x64" ;;
  arm64|aarch64) ARCH_LABEL="arm64" ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

# ── Resolve download URL ──

case "$PLATFORM" in
  mac)
    ASSET_NAME="${APP_NAME}.dmg"
    ;;
  linux)
    ASSET_NAME="${APP_NAME}.AppImage"
    ;;
  windows)
    ASSET_NAME="${APP_NAME}-Setup.exe"
    ;;
esac

DOWNLOAD_URL="${LATEST_URL}/download/${ASSET_NAME}"

echo ""
echo "  ╭─────────────────────────────────────╮"
echo "  │  ${APP_NAME} — AI Research Workspace      │"
echo "  ╰─────────────────────────────────────╯"
echo ""
echo "  Platform:  ${PLATFORM} (${ARCH_LABEL})"
echo "  Asset:     ${ASSET_NAME}"
echo ""

# ── Download ──

TMPDIR="${TMPDIR:-/tmp}"
DOWNLOAD_PATH="${TMPDIR}/${ASSET_NAME}"

echo "  Downloading ${APP_NAME}..."
if command -v curl &>/dev/null; then
  curl -fSL --progress-bar -o "$DOWNLOAD_PATH" "$DOWNLOAD_URL"
elif command -v wget &>/dev/null; then
  wget -q --show-progress -O "$DOWNLOAD_PATH" "$DOWNLOAD_URL"
else
  echo "Error: curl or wget is required" >&2
  exit 1
fi

echo ""

# ── Install ──

case "$PLATFORM" in
  mac)
    echo "  Mounting DMG..."
    MOUNT_DIR=$(hdiutil attach "$DOWNLOAD_PATH" -nobrowse -quiet | tail -1 | awk '{print $3}')

    if [ -d "${MOUNT_DIR}/${APP_NAME}.app" ]; then
      echo "  Installing to /Applications..."

      # Remove existing installation if present
      if [ -d "/Applications/${APP_NAME}.app" ]; then
        rm -rf "/Applications/${APP_NAME}.app"
      fi

      cp -R "${MOUNT_DIR}/${APP_NAME}.app" /Applications/
      hdiutil detach "$MOUNT_DIR" -quiet
      rm -f "$DOWNLOAD_PATH"

      echo "  Repairing app signature..."
      codesign --force --deep --sign - "/Applications/${APP_NAME}.app"
      xattr -cr "/Applications/${APP_NAME}.app"

      echo ""
      echo "  ✓ ${APP_NAME} installed to /Applications/${APP_NAME}.app"
      echo ""
      echo "  Next steps:"
      echo "    1. Run: npx codex login"
      echo "    2. Open ${APP_NAME} from Applications"
      echo ""
    else
      hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
      echo "  DMG downloaded to: ${DOWNLOAD_PATH}"
      echo "  Open it manually to install."
    fi
    ;;

  linux)
    INSTALL_DIR="${HOME}/.local/bin"
    mkdir -p "$INSTALL_DIR"
    mv "$DOWNLOAD_PATH" "${INSTALL_DIR}/${APP_NAME}.AppImage"
    chmod +x "${INSTALL_DIR}/${APP_NAME}.AppImage"

    echo "  ✓ ${APP_NAME} installed to ${INSTALL_DIR}/${APP_NAME}.AppImage"
    echo ""
    echo "  Next steps:"
    echo "    1. Run: npx codex login"
    echo "    2. Run: ${APP_NAME}.AppImage"
    echo ""

    if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
      echo "  Note: Add ${INSTALL_DIR} to your PATH if not already:"
      echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
      echo ""
    fi
    ;;

  windows)
    echo "  Installer downloaded to: ${DOWNLOAD_PATH}"
    echo "  Run it to install ${APP_NAME}."
    echo ""
    echo "  Next steps:"
    echo "    1. Run: npx codex login"
    echo "    2. Run the installer: ${DOWNLOAD_PATH}"
    echo ""
    ;;
esac

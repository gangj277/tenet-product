#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-}"
DMG_PATH="${2:-}"

if [[ -z "$APP_PATH" ]]; then
  APP_PATH="$(find release -maxdepth 3 -name 'Lumen.app' | head -n 1)"
fi

if [[ -z "$DMG_PATH" ]]; then
  DMG_PATH="$(find release -maxdepth 1 -name '*.dmg' | head -n 1)"
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Missing app bundle. Pass the .app path as the first argument." >&2
  exit 1
fi

echo "Checking signature metadata..."
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | sed -n '1,40p'

echo ""
echo "Verifying code signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo ""
echo "Assessing app with Gatekeeper..."
spctl -a -vvv --type execute "$APP_PATH"

echo ""
echo "Validating notarization ticket on app..."
xcrun stapler validate "$APP_PATH"

if [[ -n "$DMG_PATH" && -f "$DMG_PATH" ]]; then
  echo ""
  echo "Assessing DMG with Gatekeeper..."
  spctl -a -vvv --type open "$DMG_PATH"

  echo ""
  echo "Validating notarization ticket on DMG..."
  xcrun stapler validate "$DMG_PATH"
fi

# macOS Release Signing and Notarization

## Why Gatekeeper is blocking Lumen

Gatekeeper will reject a release build if the shipped app is ad-hoc signed, unsigned, or not notarized by Apple.

For `Lumen`, a valid external release must satisfy all of these:

1. Signed with a `Developer ID Application` certificate
2. Built with hardened runtime enabled
3. Submitted to Apple notarization
4. Stapled after notarization

## Required credentials

Use one of these authentication modes for notarization:

- `APPLE_KEYCHAIN_PROFILE`
- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

You also need the `Developer ID Application` signing identity installed in the local keychain or provided through Electron Builder signing configuration.

## Build and verify

```bash
npm run electron:build:mac
npm run electron:verify:mac
```

`electron:verify:mac` checks:

- `codesign --verify --deep --strict`
- `spctl --type execute` for the app
- `xcrun stapler validate` for the app
- `spctl --type open` for the DMG
- `xcrun stapler validate` for the DMG

## Important

Do not ad-hoc re-sign the installed app after copy. That destroys the original Developer ID signature and invalidates notarization.

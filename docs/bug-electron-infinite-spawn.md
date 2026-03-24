# Bug: Electron Packaged App Spawns Infinite Windows

## Symptom
Opening `Lumen.app` from `/Applications` causes unlimited Electron windows to spawn, filling the Dock and freezing the system.

## Root Cause
In `electron/main.ts:161`, the production server spawn uses:

```ts
process.execPath.replace(/electron/i, "node")
```

In a **packaged** app, `process.execPath` is:
```
/Applications/Lumen.app/Contents/MacOS/Lumen
```

The string "electron" doesn't appear in this path, so `.replace()` is a no-op. The app **spawns itself** as the "server process", which is another full Electron instance, which spawns itself again → infinite loop.

## Where
- **File**: `electron/main.ts`, line ~161 (inside `startServer()`, the `else` branch for production)
- **Code**:
  ```ts
  serverProcess = spawn(process.execPath.replace(/electron/i, "node"), [serverPath], { ... });
  ```

## Fix
Replace the broken `process.execPath` substitution with a proper Node.js binary lookup:

```ts
// Option A: Bundle node binary with the app (most reliable)
const nodeBin = path.join(process.resourcesPath, "node");

// Option B: Use system node (requires user to have Node installed)
const nodeBin = "node";

// Option C: Use Electron's bundled node (works without system node)
const nodeBin = path.join(
  path.dirname(process.execPath),
  "..",
  "Frameworks",
  "Electron Framework.framework",
  "Versions",
  "Current",
  "Helpers",
  "chrome_crashpad_handler" // not right — see below
);
```

**Recommended approach**: Use Electron's own Node.js fork via the `ELECTRON_RUN_AS_NODE` env var:

```ts
// In production startServer():
serverProcess = spawn(process.execPath, [serverPath], {
  env: {
    ...env,
    ELECTRON_RUN_AS_NODE: "1",  // Makes Electron behave as plain Node.js
    NEXT_STATIC_DIR: path.join(process.resourcesPath, "static"),
  },
  cwd: path.join(process.resourcesPath, "standalone"),
  stdio: "pipe",
});
```

`ELECTRON_RUN_AS_NODE=1` tells the Electron binary to act as a Node.js runtime instead of launching a GUI app. This is the standard pattern for Electron apps that need to spawn server processes.

## Secondary Issue: Code Signing
After copying `Lumen.app` to `/Applications`, the code signature breaks because the main binary and `Electron Framework.framework` get different ad-hoc Team IDs. Fix by re-signing after copy:

```bash
codesign --force --deep --sign - /Applications/Lumen.app
xattr -cr /Applications/Lumen.app
```

The install script (`scripts/install.sh`) should include this step.

## Additional Notes
- The `waitForServer()` function has a 30s timeout, but the infinite spawn happens before the timeout because each spawned instance immediately spawns another
- `app.requestSingleInstanceLock()` should be added to prevent multiple instances as a safety net
- The `isDev` branch (line 153) works correctly because it spawns `next` from `node_modules/.bin/`, not `process.execPath`

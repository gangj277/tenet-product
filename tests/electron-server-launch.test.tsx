import assert from "node:assert/strict";
import test from "node:test";

import { getProductionServerLaunchConfig } from "../electron/server-launch";

test("packaged server launch uses the Electron binary in node mode", () => {
  const launch = getProductionServerLaunchConfig({
    env: {
      PORT: "4123",
      ELECTRON: "1",
    },
    execPath: "/Applications/Lumen.app/Contents/MacOS/Lumen",
    resourcesPath: "/Applications/Lumen.app/Contents/Resources",
  });

  assert.equal(
    launch.command,
    "/Applications/Lumen.app/Contents/MacOS/Lumen"
  );
  assert.deepEqual(launch.args, [
    "/Applications/Lumen.app/Contents/Resources/standalone/server.js",
  ]);
  assert.equal(
    launch.cwd,
    "/Applications/Lumen.app/Contents/Resources/standalone"
  );
  assert.equal(launch.env.ELECTRON_RUN_AS_NODE, "1");
  assert.equal(
    launch.env.NEXT_STATIC_DIR,
    "/Applications/Lumen.app/Contents/Resources/static"
  );
});

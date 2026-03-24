import assert from "node:assert/strict";
import test from "node:test";

import {
  getLocalProductionServerLaunchConfig,
  getProductionServerLaunchConfig,
} from "../electron/server-launch";

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

test("local production server launch uses the repo standalone build in node mode", () => {
  const launch = getLocalProductionServerLaunchConfig({
    env: {
      PORT: "4123",
      ELECTRON: "1",
    },
    execPath: "/usr/local/bin/node",
    projectDir: "/Users/tester/src/lumen",
  });

  assert.equal(launch.command, "/usr/local/bin/node");
  assert.deepEqual(launch.args, [
    "/Users/tester/src/lumen/.next/standalone/server.js",
  ]);
  assert.equal(launch.cwd, "/Users/tester/src/lumen/.next/standalone");
  assert.equal(launch.env.ELECTRON_RUN_AS_NODE, "1");
  assert.equal(
    launch.env.NEXT_STATIC_DIR,
    "/Users/tester/src/lumen/.next/static"
  );
});

#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const electronBinary = path.join(
  projectDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron.cmd" : "electron"
);

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectDir,
      stdio: "inherit",
      env: {
        ...process.env,
        ...extraEnv,
      },
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function main() {
  await run(npmCommand, ["run", "electron:compile"]);
  await run(npmCommand, ["run", "build"]);
  if (process.env.LUMEN_ELECTRON_LOCAL_SKIP_LAUNCH === "1") {
    return;
  }
  await run(electronBinary, ["."], {
    LUMEN_ELECTRON_MODE: "local",
  });
}

main().catch((error) => {
  console.error(
    `[lumen] Failed to start local Electron build: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exit(1);
});

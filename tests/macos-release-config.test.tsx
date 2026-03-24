import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("macOS releases require real code signing", () => {
  const config = fs.readFileSync(
    path.join(repoRoot, "electron-builder.yml"),
    "utf8"
  );

  assert.match(config, /forceCodeSigning:\s*true/);
});

test("installer does not ad-hoc re-sign the installed app", () => {
  const installScript = fs.readFileSync(
    path.join(repoRoot, "scripts", "install.sh"),
    "utf8"
  );

  assert.doesNotMatch(installScript, /codesign\s+--force\s+--deep\s+--sign\s+-/);
  assert.doesNotMatch(installScript, /xattr\s+-cr\s+"\/Applications\/\$\{APP_NAME\}\.app"/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function makeAssetRoot(parentDir: string, folderName: string) {
  const root = path.join(parentDir, folderName);
  fs.mkdirSync(path.join(root, "cmaps"), { recursive: true });
  fs.mkdirSync(path.join(root, "standard_fonts"), { recursive: true });
  fs.writeFileSync(path.join(root, "cmaps", "Adobe-Japan1-0.bcmap"), "");
  fs.writeFileSync(path.join(root, "standard_fonts", "LiberationSans-Regular.ttf"), "");
  return root;
}

test("resolvePdfJsAssetPaths prefers the env override over public or package fallbacks", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdfjs-assets-env-"));
  const envRoot = makeAssetRoot(tempDir, "env-root");
  const cwd = path.join(tempDir, "workspace");
  const publicRoot = makeAssetRoot(path.join(cwd, "public"), "pdfjs");
  const packageRoot = makeAssetRoot(tempDir, "package-root");

  const loadedModule = await import("../lib/pdf/pdfjs-assets.ts");
  const resolved = loadedModule.resolvePdfJsAssetPaths({
    cwd,
    env: {
      ...process.env,
      PDFJS_ASSET_ROOT: envRoot,
    },
    packageAssetRoot: packageRoot,
  });

  assert.equal(resolved.assetRoot, envRoot);
  assert.equal(resolved.cMapDir, `${path.join(envRoot, "cmaps")}${path.sep}`);
  assert.equal(
    resolved.standardFontDir,
    `${path.join(envRoot, "standard_fonts")}${path.sep}`
  );
  assert.equal(publicRoot.includes("public"), true);
});

test("resolvePdfJsAssetPaths falls back to public/pdfjs before package assets", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdfjs-assets-public-"));
  const cwd = path.join(tempDir, "workspace");
  const publicRoot = makeAssetRoot(path.join(cwd, "public"), "pdfjs");
  const packageRoot = makeAssetRoot(tempDir, "package-root");

  const loadedModule = await import("../lib/pdf/pdfjs-assets.ts");
  const resolved = loadedModule.resolvePdfJsAssetPaths({
    cwd,
    env: { ...process.env, PDFJS_ASSET_ROOT: "" },
    packageAssetRoot: packageRoot,
  });

  assert.equal(resolved.assetRoot, publicRoot);
  assert.equal(resolved.source, "public");
});

test("resolvePdfJsAssetPaths falls back to the installed package assets when env and public are missing", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdfjs-assets-package-"));
  const cwd = path.join(tempDir, "workspace");
  const packageRoot = makeAssetRoot(tempDir, "package-root");

  const loadedModule = await import("../lib/pdf/pdfjs-assets.ts");
  const resolved = loadedModule.resolvePdfJsAssetPaths({
    cwd,
    env: { ...process.env, PDFJS_ASSET_ROOT: "" },
    packageAssetRoot: packageRoot,
  });

  assert.equal(resolved.assetRoot, packageRoot);
  assert.equal(resolved.source, "package");
});

test("buildPdfJsServerOptions hardens server-side pdf.js with deterministic asset and font flags", async () => {
  const loadedModule = await import("../lib/pdf/pdfjs-assets.ts");
  const options = loadedModule.buildPdfJsServerOptions({
    data: new Uint8Array([1, 2, 3]),
    assetPaths: {
      assetRoot: "/tmp/pdfjs",
      cMapDir: "/tmp/pdfjs/cmaps/",
      standardFontDir: "/tmp/pdfjs/standard_fonts/",
      source: "env",
    },
    verbosity: 0,
  });

  assert.deepEqual(options.data, new Uint8Array([1, 2, 3]));
  assert.equal(options.cMapUrl, "/tmp/pdfjs/cmaps/");
  assert.equal(options.cMapPacked, true);
  assert.equal(options.standardFontDataUrl, "/tmp/pdfjs/standard_fonts/");
  assert.equal(options.useWorkerFetch, false);
  assert.equal(options.disableFontFace, true);
  assert.equal(options.useSystemFonts, false);
  assert.equal(options.verbosity, 0);
});

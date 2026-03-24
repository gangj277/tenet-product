import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const PDFJS_ASSET_ROOT_ENV = "PDFJS_ASSET_ROOT";
const PDFJS_PUBLIC_ROOT = path.join("public", "pdfjs");

const requireFromHere = createRequire(import.meta.url);

export interface PdfJsAssetPaths {
  assetRoot: string;
  cMapDir: string;
  standardFontDir: string;
  source: "env" | "public" | "package";
}

const globalForPdfJsAssets = globalThis as typeof globalThis & {
  __lumenPdfJsAssetPaths?: PdfJsAssetPaths;
};

export function resolvePdfJsAssetPaths(options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  packageAssetRoot?: string;
} = {}): PdfJsAssetPaths {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  if (!options.cwd && !options.env && !options.packageAssetRoot) {
    if (globalForPdfJsAssets.__lumenPdfJsAssetPaths) {
      return globalForPdfJsAssets.__lumenPdfJsAssetPaths;
    }
  }

  const packageAssetRoot =
    options.packageAssetRoot ?? path.dirname(requireFromHere.resolve("pdfjs-dist/package.json"));

  const candidates: Array<{ root: string | undefined; source: PdfJsAssetPaths["source"] }> = [
    { root: env[PDFJS_ASSET_ROOT_ENV]?.trim() || undefined, source: "env" },
    { root: path.join(cwd, PDFJS_PUBLIC_ROOT), source: "public" },
    { root: packageAssetRoot, source: "package" },
  ];

  for (const candidate of candidates) {
    if (!candidate.root || !hasRequiredPdfJsAssets(candidate.root)) {
      continue;
    }

    const resolved = buildResolvedPaths(candidate.root, candidate.source);
    if (!options.cwd && !options.env && !options.packageAssetRoot) {
      globalForPdfJsAssets.__lumenPdfJsAssetPaths = resolved;
    }
    return resolved;
  }

  throw new Error(
    "Unable to locate pdf.js runtime assets. Run `npm run prepare:pdfjs-assets` or set PDFJS_ASSET_ROOT."
  );
}

export function buildPdfJsServerOptions(params: {
  data: Uint8Array;
  assetPaths: PdfJsAssetPaths;
  verbosity: number;
}) {
  return {
    data: params.data,
    cMapUrl: params.assetPaths.cMapDir,
    cMapPacked: true,
    standardFontDataUrl: params.assetPaths.standardFontDir,
    useWorkerFetch: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: params.verbosity,
  };
}

function buildResolvedPaths(
  assetRoot: string,
  source: PdfJsAssetPaths["source"]
): PdfJsAssetPaths {
  return {
    assetRoot,
    cMapDir: ensureTrailingSeparator(path.join(assetRoot, "cmaps")),
    standardFontDir: ensureTrailingSeparator(path.join(assetRoot, "standard_fonts")),
    source,
  };
}

function hasRequiredPdfJsAssets(assetRoot: string): boolean {
  return (
    fs.existsSync(path.join(assetRoot, "cmaps")) &&
    fs.existsSync(path.join(assetRoot, "standard_fonts"))
  );
}

function ensureTrailingSeparator(value: string) {
  return value.endsWith(path.sep) ? value : `${value}${path.sep}`;
}

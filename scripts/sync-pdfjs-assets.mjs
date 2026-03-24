import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(requireFromHere.resolve("pdfjs-dist/package.json"));
const sourceRoot = path.join(pdfjsRoot);
const targetRoot = path.join(process.cwd(), "public", "pdfjs");

fs.mkdirSync(targetRoot, { recursive: true });
fs.cpSync(path.join(sourceRoot, "cmaps"), path.join(targetRoot, "cmaps"), {
  recursive: true,
  force: true,
});
fs.cpSync(
  path.join(sourceRoot, "standard_fonts"),
  path.join(targetRoot, "standard_fonts"),
  {
    recursive: true,
    force: true,
  }
);

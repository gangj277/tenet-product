import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("loadAppEnv prefers .env.local over .env defaults", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-env-"));
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  fs.writeFileSync(path.join(tempDir, ".env"), "DATABASE_URL=postgresql://localhost:5432/local\n");
  fs.writeFileSync(
    path.join(tempDir, ".env.local"),
    "DATABASE_URL=postgresql://remote.example.com:5432/remote\n"
  );

  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = "development";

  try {
    const { loadAppEnv } = await import("../electron/load-env");
    const env = loadAppEnv(tempDir);

    assert.equal(
      env.DATABASE_URL,
      "postgresql://remote.example.com:5432/remote"
    );
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadAppEnv lets process env override file values", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-env-override-"));
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  fs.writeFileSync(
    path.join(tempDir, ".env.local"),
    "DATABASE_URL=postgresql://remote.example.com:5432/remote\n"
  );

  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL = "postgresql://process.example.com:5432/process";

  try {
    const { loadAppEnv } = await import("../electron/load-env");
    const env = loadAppEnv(tempDir);

    assert.equal(
      env.DATABASE_URL,
      "postgresql://process.example.com:5432/process"
    );
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

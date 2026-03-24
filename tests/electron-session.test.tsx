import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const requireFrom = createRequire(import.meta.url);

function reloadModule<T>(modulePath: string): T {
  const resolved = requireFrom.resolve(modulePath);
  delete requireFrom.cache[resolved];
  return requireFrom(modulePath) as T;
}

function withEnv<T>(values: Record<string, string | undefined>, fn: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("getSession returns a stable local session in Electron mode", async () => {
  await withEnv(
    {
      ELECTRON: "1",
    },
    async () => {
      const sessionModule = reloadModule<typeof import("../lib/auth/session")>(
        "../lib/auth/session.ts"
      );

      const session = await sessionModule.getSession();

      assert.deepEqual(session, {
        userId: "00000000-0000-0000-0000-000000000001",
        email: "local@lumen.app",
      });
    }
  );
});

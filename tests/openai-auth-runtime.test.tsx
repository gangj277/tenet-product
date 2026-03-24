import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const requireFrom = createRequire(import.meta.url);

function reloadModule<T>(modulePath: string): T {
  const resolved = requireFrom.resolve(modulePath);
  delete requireFrom.cache[resolved];
  return requireFrom(modulePath) as T;
}

function clearModule(modulePath: string) {
  const resolved = requireFrom.resolve(modulePath);
  delete requireFrom.cache[resolved];
}

function patchModule(modulePath: string, exports: unknown): () => void {
  const resolved = requireFrom.resolve(modulePath);
  const original = requireFrom.cache[resolved];

  if (!original) {
    requireFrom(modulePath);
  }

  const cachedModule = requireFrom.cache[resolved];
  if (!cachedModule) {
    throw new Error(`Module cache missing for ${modulePath}`);
  }

  cachedModule.exports = exports;

  return () => {
    if (original) {
      requireFrom.cache[resolved] = original;
      return;
    }

    delete requireFrom.cache[resolved];
  };
}

function withEnv<T>(values: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return fn().finally(() => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

test("createProviderForUser rejects users without OpenAI auth credentials", async () => {
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      getLLMCredentials: async () => null,
    }),
    resetStorageForTests: () => {},
  });

  try {
    clearModule("../lib/llm/provider-factory.ts");
    const loadedModule = reloadModule<typeof import("../lib/llm/provider-factory")>(
      "../lib/llm/provider-factory.ts"
    );

    await assert.rejects(
      () => loadedModule.createProviderForUser("user-1"),
      /Connect your OpenAI account/i
    );
  } finally {
    restoreStorage();
  }
});

test("OAuth callback refuses to create a session when provider validation fails", async () => {
  const upsertedCredentials: Array<Record<string, unknown>> = [];
  let sessionCreated = false;

  const restoreCookies = patchModule("next/headers", {
    cookies: async () => ({
      get: () => ({
        value: JSON.stringify({
          verifier: "verifier-1",
          state: "state-1",
        }),
      }),
      delete: () => {},
    }),
  });
  const restoreOAuth = patchModule("../lib/auth/openai-oauth.ts", {
    exchangeCodeForTokens: async () => ({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
      id_token: "id-token",
    }),
    decodeJwtPayload: (token: string) => {
      if (token === "id-token") {
        return { email: "researcher@example.com", name: "Researcher" };
      }
      return { sub: "account-1", email: "researcher@example.com", name: "Researcher" };
    },
  });
  const restoreOpenAIConnection = patchModule("../lib/llm/openai-connection.ts", {
    validateOpenAIConnection: async () => ({
      ok: false,
      status: "invalid",
      capabilities: {
        basic: false,
        json: false,
        streaming: false,
        toolCalling: false,
        liteModel: false,
      },
      lastErrorCode: 403,
      lastErrorMessage: "permission error",
    }),
  });
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      upsertUser: async (value: { email: string; name: string }) => ({
        id: "user-1",
        email: value.email,
        name: value.name,
        organization: null,
        authProvider: "openai_auth" as const,
      }),
      upsertLLMCredentials: async (_userId: string, value: Record<string, unknown>) => {
        upsertedCredentials.push(value);
      },
    }),
    resetStorageForTests: () => {},
  });
  const restoreSession = patchModule("../lib/auth/session.ts", {
    createSession: async () => {
      sessionCreated = true;
      return "session-token";
    },
    setSessionCookie: async () => {
      sessionCreated = true;
    },
  });

  try {
    clearModule("../lib/auth/openai-account.ts");
    clearModule("../app/api/auth/openai/callback/route.ts");
    const route = reloadModule<
      typeof import("../app/api/auth/openai/callback/route")
    >("../app/api/auth/openai/callback/route.ts");

    const response = await route.GET(
      new Request("http://localhost/api/auth/openai/callback?code=code-1&state=state-1") as never
    );

    assert.equal(response.status, 307);
    assert.equal(sessionCreated, false);
    assert.equal(upsertedCredentials.length, 1);
    assert.equal(upsertedCredentials[0].kind, "openai_auth");
    assert.equal(
      (upsertedCredentials[0].validation as { status?: string }).status,
      "invalid"
    );
    assert.match(response.headers.get("location") ?? "", /error=/i);
  } finally {
    restoreSession();
    restoreStorage();
    restoreOpenAIConnection();
    restoreOAuth();
    restoreCookies();
  }
});

test("OAuth callback merges an existing email user and creates a session only after validation succeeds", async () => {
  const upsertedCredentials: Array<Record<string, unknown>> = [];
  const upsertedUsers: Array<Record<string, unknown>> = [];
  const createdSessions: Array<Record<string, unknown>> = [];

  const restoreCookies = patchModule("next/headers", {
    cookies: async () => ({
      get: () => ({
        value: JSON.stringify({
          verifier: "verifier-1",
          state: "state-1",
        }),
      }),
      delete: () => {},
    }),
  });
  const restoreOAuth = patchModule("../lib/auth/openai-oauth.ts", {
    exchangeCodeForTokens: async () => ({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
      id_token: "id-token",
    }),
    decodeJwtPayload: (token: string) => {
      if (token === "id-token") {
        return { email: "existing@example.com", name: "Existing User" };
      }
      return { sub: "account-1", email: "existing@example.com", name: "Existing User" };
    },
  });
  const restoreOpenAIConnection = patchModule("../lib/llm/openai-connection.ts", {
    validateOpenAIConnection: async () => ({
      ok: true,
      status: "valid",
      capabilities: {
        basic: true,
        json: true,
        streaming: true,
        toolCalling: true,
        liteModel: true,
      },
      validatedAt: "2026-03-23T00:00:00.000Z",
    }),
  });
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      upsertUser: async (value: Record<string, unknown>) => {
        upsertedUsers.push(value);
        return {
          id: "user-existing",
          email: String(value.email),
          name: String(value.name),
          organization: null,
          authProvider: "openai_auth" as const,
        };
      },
      upsertLLMCredentials: async (_userId: string, value: Record<string, unknown>) => {
        upsertedCredentials.push(value);
      },
    }),
    resetStorageForTests: () => {},
  });
  const restoreSession = patchModule("../lib/auth/session.ts", {
    createSession: async (value: Record<string, unknown>) => {
      createdSessions.push(value);
      return "session-token";
    },
    setSessionCookie: async () => {},
  });
  try {
    clearModule("../lib/auth/openai-account.ts");
    clearModule("../app/api/auth/openai/callback/route.ts");
    const route = reloadModule<
      typeof import("../app/api/auth/openai/callback/route")
    >("../app/api/auth/openai/callback/route.ts");

    const response = await route.GET(
      new Request("http://localhost/api/auth/openai/callback?code=code-1&state=state-1") as never
    );

    assert.equal(response.status, 307);
    assert.match(response.headers.get("location") ?? "", /\/dashboard$/);
    assert.equal(upsertedUsers.length, 1);
    assert.equal(upsertedUsers[0].authProvider, "openai_auth");
    assert.equal(upsertedCredentials.length, 1);
    assert.equal(upsertedCredentials[0].kind, "openai_auth");
    assert.equal(createdSessions.length, 1);
    assert.equal(createdSessions[0].userId, "user-existing");
  } finally {
    restoreSession();
    restoreStorage();
    restoreOpenAIConnection();
    restoreOAuth();
    restoreCookies();
  }
});

test("OpenAI login imports a local Codex session instead of redirecting to remote OAuth", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-codex-auth-"));
  const authFile = path.join(tempDir, "auth.json");
  const createdSessions: Array<Record<string, unknown>> = [];
  const upsertedCredentials: Array<Record<string, unknown>> = [];
  const originalAuthFile = process.env.CODEX_AUTH_FILE;

  process.env.CODEX_AUTH_FILE = authFile;
  fs.writeFileSync(
    authFile,
    JSON.stringify({
      auth_mode: "chatgpt",
      OPENAI_API_KEY: null,
      tokens: {
        id_token: [
          "header",
          Buffer.from(
            JSON.stringify({
              email: "local@example.com",
              name: "Local User",
            })
          ).toString("base64url"),
          "sig",
        ].join("."),
        access_token: [
          "header",
          Buffer.from(
            JSON.stringify({
              sub: "account-1",
              exp: Math.floor(Date.now() / 1000) + 3600,
            })
          ).toString("base64url"),
          "sig",
        ].join("."),
        refresh_token: "refresh-token",
        account_id: "account-1",
      },
      last_refresh: new Date().toISOString(),
    })
  );

  const restoreOpenAIConnection = patchModule("../lib/llm/openai-connection.ts", {
    validateOpenAIConnection: async () => ({
      ok: true,
      status: "valid",
      capabilities: {
        basic: true,
        json: true,
        streaming: true,
        toolCalling: true,
        liteModel: true,
      },
      validatedAt: "2026-03-23T00:00:00.000Z",
      lastErrorCode: null,
      lastErrorMessage: null,
    }),
  });
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      upsertUser: async (value: { email: string; name: string }) => ({
        id: "user-local",
        email: value.email,
        name: value.name,
        organization: null,
        authProvider: "openai_auth" as const,
      }),
      upsertLLMCredentials: async (_userId: string, value: Record<string, unknown>) => {
        upsertedCredentials.push(value);
      },
    }),
    resetStorageForTests: () => {},
  });
  const restoreSession = patchModule("../lib/auth/session.ts", {
    createSession: async (value: Record<string, unknown>) => {
      createdSessions.push(value);
      return "session-token";
    },
    setSessionCookie: async () => {},
  });
  const restoreCookies = patchModule("next/headers", {
    cookies: async () => ({
      set: () => {},
    }),
  });

  try {
    clearModule("../lib/auth/openai-account.ts");
    clearModule("../lib/auth/openai-oauth.ts");
    clearModule("../app/api/auth/openai/route.ts");
    const route = reloadModule<
      typeof import("../app/api/auth/openai/route")
    >("../app/api/auth/openai/route.ts");

    const response = await route.GET(
      new Request("http://localhost/api/auth/openai") as never
    );

    assert.equal(response.status, 307);
    assert.match(response.headers.get("location") ?? "", /\/dashboard$/);
    assert.equal(createdSessions.length, 1);
    assert.equal(createdSessions[0].userId, "user-local");
    assert.equal(upsertedCredentials.length, 1);
    assert.equal(upsertedCredentials[0].kind, "openai_auth");
  } finally {
    restoreCookies();
    restoreSession();
    restoreStorage();
    restoreOpenAIConnection();
    clearModule("../app/api/auth/openai/route.ts");
    if (originalAuthFile === undefined) {
      delete process.env.CODEX_AUTH_FILE;
    } else {
      process.env.CODEX_AUTH_FILE = originalAuthFile;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("OpenAI login shows an actionable error when no local Codex session exists", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-codex-auth-missing-"));
  const missingAuthFile = path.join(tempDir, "missing-auth.json");
  const originalAuthFile = process.env.CODEX_AUTH_FILE;

  process.env.CODEX_AUTH_FILE = missingAuthFile;
  const restoreCookies = patchModule("next/headers", {
    cookies: async () => ({
      set: () => {},
    }),
  });

  try {
    await withEnv({ ELECTRON: "1" }, async () => {
      clearModule("../lib/auth/openai-oauth.ts");
      clearModule("../app/api/auth/openai/route.ts");
      const route = reloadModule<
        typeof import("../app/api/auth/openai/route")
      >("../app/api/auth/openai/route.ts");

      const response = await route.GET(
        new Request("http://localhost/api/auth/openai") as never
      );

      assert.equal(response.status, 307);
      assert.match(response.headers.get("location") ?? "", /\/auth\/login\?error=/);
      assert.match(
        decodeURIComponent(response.headers.get("location") ?? ""),
        /codex login/i
      );
    });
  } finally {
    restoreCookies();
    clearModule("../app/api/auth/openai/route.ts");
    if (originalAuthFile === undefined) {
      delete process.env.CODEX_AUTH_FILE;
    } else {
      process.env.CODEX_AUTH_FILE = originalAuthFile;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

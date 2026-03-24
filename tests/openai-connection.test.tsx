import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = global.fetch;

test("validateOpenAIConnection includes instructions in both validation probes", async () => {
  const calls: Array<Record<string, unknown>> = [];

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    const { validateOpenAIConnection } = await import("../lib/llm/openai-connection");

    const result = await validateOpenAIConnection({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 60_000,
      accountId: "account-1",
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.equal(typeof calls[0].instructions, "string");
    assert.equal(typeof calls[1].instructions, "string");
    assert.equal(calls[0].stream, true);
    assert.equal(calls[1].stream, true);
    assert.match(String(calls[0].instructions), /reply with the single word ok/i);
    assert.match(String(calls[1].instructions), /reply with the single word ok/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test("validateOpenAIConnection extracts detail messages from JSON error bodies", async () => {
  global.fetch = (async () =>
    new Response(JSON.stringify({ detail: "Instructions are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    const { validateOpenAIConnection } = await import("../lib/llm/openai-connection");

    const result = await validateOpenAIConnection({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 60_000,
      accountId: "account-1",
    });

    assert.equal(result.ok, false);
    assert.equal(result.lastErrorCode, 400);
    assert.equal(result.lastErrorMessage, "Instructions are required");
  } finally {
    global.fetch = originalFetch;
  }
});

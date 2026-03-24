import assert from "node:assert/strict";
import test from "node:test";

test("chat auto-scroll only sticks when the user is near the bottom", async () => {
  const chatModule = await import(
    "../app/dashboard/[runId]/_components/chat/agent-chat.tsx"
  );

  const isNearBottom =
    chatModule.isChatScrolledNearBottom ??
    chatModule.default?.isChatScrolledNearBottom;

  assert.equal(typeof isNearBottom, "function");

  assert.equal(
    isNearBottom({
      scrollTop: 760,
      clientHeight: 200,
      scrollHeight: 1000,
    }),
    true
  );

  assert.equal(
    isNearBottom({
      scrollTop: 640,
      clientHeight: 200,
      scrollHeight: 1000,
    }),
    false
  );
});

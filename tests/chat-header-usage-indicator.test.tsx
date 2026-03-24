import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

test("chat header usage indicator renders warning usage details", async () => {
  const chatModule = await import(
    "../app/dashboard/[runId]/_components/chat/agent-chat.tsx"
  );

  const ChatUsageIndicator =
    chatModule.ChatUsageIndicator ?? chatModule.default.ChatUsageIndicator;

  const Indicator = ChatUsageIndicator as unknown as (props: {
    usage: {
      estimatedLiveContextTokens: number;
      compactionThresholdTokens: number;
      compactionStatus: "idle" | "near_limit" | "compacting" | "recently_compacted";
      lastCompactedAt?: number;
    };
  }) => JSX.Element;

  const html = renderToStaticMarkup(
    <Indicator
      usage={{
        estimatedLiveContextTokens: 210000,
        compactionThresholdTokens: 250000,
        compactionStatus: "near_limit",
        lastCompactedAt: Date.parse("2026-03-24T09:00:00.000Z"),
      }}
    />
  );

  assert.match(html, /210,000/i);
  assert.match(html, /250,000/i);
  assert.match(html, /84%/i);
  assert.match(html, /Near limit/i);
  assert.match(html, /Last compacted/i);
});

test("chat header usage indicator renders compacting state with a spinner label", async () => {
  const chatModule = await import(
    "../app/dashboard/[runId]/_components/chat/agent-chat.tsx"
  );

  const ChatUsageIndicator =
    chatModule.ChatUsageIndicator ?? chatModule.default.ChatUsageIndicator;

  const Indicator = ChatUsageIndicator as unknown as (props: {
    usage: {
      estimatedLiveContextTokens: number;
      compactionThresholdTokens: number;
      compactionStatus: "idle" | "near_limit" | "compacting" | "recently_compacted";
    };
  }) => JSX.Element;

  const html = renderToStaticMarkup(
    <Indicator
      usage={{
        estimatedLiveContextTokens: 180000,
        compactionThresholdTokens: 250000,
        compactionStatus: "compacting",
      }}
    />
  );

  assert.match(html, /Compacting context/i);
  assert.match(html, /activity-spinner|animate-spin/i);
});

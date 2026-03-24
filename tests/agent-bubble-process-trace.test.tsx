import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

test("agent bubble renders a readable process trace card", async () => {
  const bubbleModule = await import(
    "../app/dashboard/[runId]/_components/chat/message/agent-bubble.tsx"
  );

  const AgentBubble =
    bubbleModule.AgentBubble ?? bubbleModule.default.AgentBubble;

  const html = renderToStaticMarkup(
    <AgentBubble
      message={{
        id: "message-1",
        role: "agent",
        text: "I found the strongest evidence and drafted an edit.",
        timestamp: 1,
        processTrace: [
          {
            id: "step-1",
            kind: "tool",
            label: "Reading files",
            detail: "Overview, Claims",
            status: "completed",
          },
          {
            id: "step-2",
            kind: "tool",
            label: "Searching workspace",
            detail: '"effect size", "sample size" in Claims',
            status: "active",
          },
        ],
      }}
    />
  );

  assert.match(html, /Agent Work/i);
  assert.match(html, /Reading files/i);
  assert.match(html, /Overview, Claims/i);
  assert.match(html, /Searching workspace/i);
});

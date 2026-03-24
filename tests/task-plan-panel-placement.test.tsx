import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

test("agent chat renders the task plan rail between transcript and composer", async () => {
  const chatModule = await import(
    "../app/dashboard/[runId]/_components/chat/agent-chat.tsx"
  );

  const AgentChat = chatModule.AgentChat ?? chatModule.default.AgentChat;

  const html = renderToStaticMarkup(
    <AgentChat
      ref={null}
      messages={[
        {
          id: "agent-1",
          role: "agent",
          text: "Rendered bubble body",
          timestamp: 1,
        },
      ]}
      agentTyping={false}
      collapsed={false}
      onToggle={() => {}}
      onSend={() => {}}
      onToggleHistory={() => {}}
      onSelectSession={() => {}}
      onNewSession={() => {}}
      onDeleteSession={() => {}}
      onRenameSession={() => {}}
      sessions={[]}
      activeSessionId={null}
      showHistory={false}
      files={[]}
      folderPaths={[]}
      activeTaskPlan={[
        { id: "task-1", objective: "Gather evidence", status: "completed" },
        { id: "task-2", objective: "Assess methodology", status: "active" },
        { id: "task-3", objective: "Draft synthesis", status: "pending" },
      ]}
      onDismissTaskPlan={() => {}}
      usage={{
        estimatedLiveContextTokens: 0,
        compactionThresholdTokens: 250000,
        compactionStatus: "idle",
      }}
    />
  );

  const transcriptIndex = html.indexOf("Rendered bubble body");
  const taskRailIndex = html.indexOf("Assess methodology");
  const composerIndex = html.indexOf("Ask anything");

  assert.ok(transcriptIndex >= 0, "expected transcript content");
  assert.ok(taskRailIndex >= 0, "expected task rail content");
  assert.ok(composerIndex >= 0, "expected composer content");
  assert.ok(
    transcriptIndex < taskRailIndex && taskRailIndex < composerIndex,
    "task rail should sit between transcript and composer"
  );
});

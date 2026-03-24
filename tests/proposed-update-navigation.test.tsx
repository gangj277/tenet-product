import assert from "node:assert/strict";
import test from "node:test";

type ReactNodeLike = {
  type?: unknown;
  props?: {
    children?: unknown;
    [key: string]: unknown;
  };
};

function findElementByType(node: unknown, targetType: unknown): ReactNodeLike | null {
  if (!node) return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElementByType(child, targetType);
      if (match) return match;
    }
    return null;
  }

  if (typeof node !== "object") return null;

  const maybeElement = node as ReactNodeLike;
  if (maybeElement.type === targetType) {
    return maybeElement;
  }

  return findElementByType(maybeElement.props?.children, targetType);
}

test("agent bubbles wire proposed edit cards to open the edited file", async () => {
  const bubbleModule = await import(
    "../app/dashboard/[runId]/_components/chat/message/agent-bubble.tsx"
  );
  const cardModule = await import(
    "../app/dashboard/[runId]/_components/chat/message/proposed-update-card.tsx"
  );

  const AgentBubble =
    bubbleModule.AgentBubble ?? bubbleModule.default.AgentBubble;
  const ProposedUpdateCard =
    cardModule.ProposedUpdateCard ?? cardModule.default.ProposedUpdateCard;

  let openedKey: string | null = null;

  const tree = AgentBubble({
    message: {
      id: "message-1",
      role: "agent",
      text: "I have an update.",
      timestamp: 1,
      proposedUpdates: [
        {
          id: "update-1",
          type: "edit",
          key: "synthesis",
          label: "Synthesis",
          content: "Revised synthesis",
          summary: "Rewrite synthesis",
          status: "pending",
        },
      ],
    },
    getContent: () => "Current synthesis",
    onOpenProposal: (key: string) => {
      openedKey = key;
    },
  });

  const card = findElementByType(tree, ProposedUpdateCard);

  assert.ok(card, "expected AgentBubble to render a ProposedUpdateCard");
  assert.equal(typeof card.props?.onOpen, "function");

  (card.props?.onOpen as () => void)();

  assert.equal(openedKey, "synthesis");
});

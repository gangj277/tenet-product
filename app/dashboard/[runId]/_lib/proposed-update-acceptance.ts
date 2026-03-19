import type { ChatMessage, ProposedUpdate } from "./workspace-types";

export function updateProposedUpdateStatusInMessages(
  messages: ChatMessage[],
  messageId: string,
  updateId: string,
  status: ProposedUpdate["status"]
): {
  nextMessages: ChatMessage[];
  updatedMessage?: ChatMessage;
  updatedUpdate?: ProposedUpdate;
} {
  let updatedMessage: ChatMessage | undefined;
  let updatedUpdate: ProposedUpdate | undefined;

  const nextMessages = messages.map((message) => {
    if (message.id !== messageId || !message.proposedUpdates?.length) {
      return message;
    }

    let changed = false;
    const nextUpdates = message.proposedUpdates.map((update) => {
      if (update.id !== updateId) {
        return update;
      }

      changed = true;
      updatedUpdate = { ...update, status };
      return updatedUpdate;
    });

    if (!changed) {
      return message;
    }

    updatedMessage = { ...message, proposedUpdates: nextUpdates };
    return updatedMessage;
  });

  return updatedMessage
    ? { nextMessages, updatedMessage, updatedUpdate }
    : { nextMessages: messages };
}

export function acceptProposedUpdateInMessages(
  messages: ChatMessage[],
  messageId: string,
  updateId: string
): {
  nextMessages: ChatMessage[];
  updatedMessage?: ChatMessage;
  appliedUpdate?: ProposedUpdate;
} {
  const { nextMessages, updatedMessage, updatedUpdate } =
    updateProposedUpdateStatusInMessages(
      messages,
      messageId,
      updateId,
      "accepted"
    );

  return updatedUpdate
    ? { nextMessages, updatedMessage, appliedUpdate: updatedUpdate }
    : { nextMessages: messages };
}

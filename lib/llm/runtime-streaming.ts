export type {
  StreamChunk,
  AccumulatedToolCall,
  StreamingLLMOptions,
} from "./types";

import type { StreamingLLMOptions, StreamChunk } from "./types";
import { createProviderForUser } from "./provider-factory";
import { getSession } from "@/lib/auth/session";

export async function* callLLMStreaming(
  options: StreamingLLMOptions
): AsyncGenerator<StreamChunk> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const provider = await createProviderForUser(session.userId);
  yield* provider.callLLMStreaming(options);
}

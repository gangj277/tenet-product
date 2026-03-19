import { memoryStore } from "@/lib/storage/memory-store";
import type { AskUserAnswer, AskUserQuestion, AskUserOption } from "../state";

interface AskUserArgs {
  question: string;
  options: AskUserOption[];
  allow_custom?: boolean;
}

export function executeAskUser(
  args: AskUserArgs,
  runId: string
): { question: AskUserQuestion; answerPromise: Promise<AskUserAnswer> } {
  const questionId = crypto.randomUUID();

  const question: AskUserQuestion = {
    id: questionId,
    question: args.question,
    options: args.options,
    allowCustom: args.allow_custom ?? true,
  };

  const answerPromise = memoryStore.registerPendingQuestion(runId, questionId);

  return { question, answerPromise };
}

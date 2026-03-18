import { callLLMJson } from "@/lib/llm/openrouter";
import { MODEL_LITE } from "@/lib/llm/models";

const FOLDER_SCHEMA = {
  name: "source_folder_assignment",
  schema: {
    type: "object" as const,
    properties: {
      folder: {
        type: "string" as const,
        description: "The folder name to assign (existing or new)",
      },
    },
    required: ["folder"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You assign a research source to a thematic folder in a sidebar file explorer.

Rules:
- If one of the existing folders fits, return that exact folder name.
- If no existing folder fits, create a short new folder name (2-4 words, title-cased).
- Return exactly one folder name.`;

/**
 * Classify a single source into an existing or new folder via a lightweight LLM call.
 * Returns the folder name, or undefined on failure (graceful degradation).
 */
export async function classifySourceIntoFolder(params: {
  sourceName: string;
  existingFolders: string[];
}): Promise<string | undefined> {
  const { sourceName, existingFolders } = params;

  try {
    const { data } = await callLLMJson<{ folder: string }>({
      model: MODEL_LITE,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            sourceName,
            existingFolders,
          }),
        },
      ],
      temperature: 0.1,
      maxTokens: 128,
      jsonSchema: FOLDER_SCHEMA,
    });

    const folder = data.folder?.trim();
    return folder || undefined;
  } catch {
    // Graceful degradation — source stays ungrouped
    return undefined;
  }
}

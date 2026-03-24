import type { InitRunState, InitRunUpdate } from "../state";
import { callLLMJson } from "@/lib/llm/runtime";
import { MODEL_LITE } from "@/lib/llm/models";
import { memoryStore } from "@/lib/storage/memory-store";

const MIN_SOURCES_FOR_FOLDERS = 4;

const FOLDER_SCHEMA = {
  name: "source_folder_classification",
  schema: {
    type: "object" as const,
    properties: {
      folders: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            folderName: { type: "string" as const },
            sourceIds: {
              type: "array" as const,
              items: { type: "string" as const },
            },
          },
          required: ["folderName", "sourceIds"],
          additionalProperties: false,
        },
      },
    },
    required: ["folders"],
    additionalProperties: false,
  },
};

interface FolderClassification {
  folders: Array<{ folderName: string; sourceIds: string[] }>;
}

const SYSTEM_PROMPT = `You organize research sources into thematic folders for a sidebar file explorer.

Rules:
- Create 2-5 folders with short, descriptive names (2-4 words each, title-cased).
- Every source must be assigned to exactly one folder.
- Group by topic/theme, not by source type (PDF vs web).
- If sources are too diverse to group meaningfully, use broad categories like "Background", "Core Analysis", "Supporting Data".

Return a JSON object with a "folders" array. Each folder has a "folderName" and a "sourceIds" array containing the exact sourceId strings provided.`;

export async function classifySourceFolders(
  state: InitRunState
): Promise<InitRunUpdate> {
  const { runId, parsedSources, perspective } = state;

  if (!parsedSources || parsedSources.length < MIN_SOURCES_FOR_FOLDERS) {
    memoryStore.updateProgress(runId, "classify_source_folders", {
      status: "completed",
      detail: "Skipped (few sources)",
    });
    return { currentStep: "classify_source_folders" };
  }

  memoryStore.updateProgress(runId, "classify_source_folders", {
    status: "running",
    detail: `Classifying ${parsedSources.length} sources into folders...`,
  });

  try {
    const sourceList = parsedSources.map((s) => ({
      sourceId: s.sourceId,
      name: s.name,
    }));

    const researchContext = perspective
      ? `Research question: ${perspective.briefSummary}\nIntent: ${perspective.interpretedIntent}\nFrame: ${perspective.inferredResearchFrame}`
      : "";

    const { data } = await callLLMJson<FolderClassification>({
      model: MODEL_LITE,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({ researchContext, sources: sourceList }, null, 2),
        },
      ],
      temperature: 0.1,
      maxTokens: 1024,
      jsonSchema: FOLDER_SCHEMA,
    });

    const sourceFolders: Record<string, string[]> = {};
    for (const folder of data.folders) {
      if (folder.folderName && folder.sourceIds?.length) {
        sourceFolders[folder.folderName] = folder.sourceIds;
      }
    }

    memoryStore.updateProgress(runId, "classify_source_folders", {
      status: "completed",
      detail: `Organized into ${Object.keys(sourceFolders).length} folders`,
    });

    return {
      sourceFolders,
      currentStep: "classify_source_folders",
    };
  } catch (err) {
    memoryStore.updateProgress(runId, "classify_source_folders", {
      status: "completed",
      detail: "Skipped (classification failed)",
    });

    return {
      currentStep: "classify_source_folders",
      errors: [
        {
          step: "classify_source_folders",
          message: (err as Error).message,
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}

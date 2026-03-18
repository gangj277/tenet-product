import { estimateTokens } from "./document-quality";
import type { SourceChunk } from "@/lib/engine/state";

export const MAX_CHUNK_TOKENS = 2_500;

export function chunkDocument(params: {
  sourceId: string;
  sourceName: string;
  normalizedBlobKeyPrefix: string;
  text: string;
  maxChunkTokens?: number;
}): Array<SourceChunk & { content: string }> {
  const {
    sourceId,
    sourceName,
    normalizedBlobKeyPrefix,
    text,
    maxChunkTokens = MAX_CHUNK_TOKENS,
  } = params;

  const blocks = text
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean);

  const chunks: Array<SourceChunk & { content: string }> = [];
  const headingStack: string[] = [];
  let currentLines: string[] = [];
  let currentHeading = "Document";

  function flushChunk() {
    const content = currentLines.join("\n\n").trim();
    if (!content) return;
    const chunkIndex = chunks.length;
    chunks.push({
      sourceId,
      sourceName,
      chunkIndex,
      headingPath: currentHeading,
      tokenEstimate: estimateTokens(content),
      charCount: content.length,
      blobKey: `${normalizedBlobKeyPrefix}/chunks/${String(chunkIndex).padStart(4, "0")}.md`,
      content,
    });
    currentLines = [];
  }

  for (const block of blocks) {
    const headingMatch = block.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flushChunk();
      const depth = headingMatch[1].length - 1;
      headingStack.splice(depth);
      headingStack[depth] = headingMatch[2].trim();
      currentHeading = headingStack.filter(Boolean).join(" > ") || "Document";
      currentLines.push(block);
      continue;
    }

    const candidate = [...currentLines, block].join("\n\n");
    if (
      currentLines.length > 0 &&
      estimateTokens(candidate) > maxChunkTokens
    ) {
      flushChunk();
    }

    currentLines.push(block);
  }

  flushChunk();
  return chunks;
}

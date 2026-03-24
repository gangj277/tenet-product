import { formatPaperQualitySummary } from "@/lib/discovery/paper-quality";
import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import type { AddedSource } from "../state";
import type { SearchQuery, ExtractionResult, FailedSource } from "./search-external-types";

/** Format results as metadata-only (no extraction). */
export function formatMetadataOnly(searches: SearchQuery[], sources: DiscoveredSource[]): string {
  const queryLabel = searches.map((s) => `"${s.query}" (${s.intent})`).join(", ");
  const formatted = sources
    .map((s, i) => {
      const date = s.publishedDate
        ? ` (${s.publishedDate.slice(0, 10)})`
        : "";
      const author = s.author ? ` — ${s.author}` : "";
      const qualitySummary = formatPaperQualitySummary(s.paperQuality);
      const quality = qualitySummary ? `\n   ${qualitySummary}` : "";
      return `${i + 1}. ${s.title}${date}${author}${quality}\n   ${s.url}`;
    })
    .join("\n\n");

  return `Found ${sources.length} external sources for ${queryLabel}:\n\n${formatted}`;
}

/** Format deep search results with extractions, failures, and remaining sources. */
export function formatDeepSearchResults(params: {
  searches: SearchQuery[];
  extractionGoal: string;
  extractions: ExtractionResult[];
  failed: FailedSource[];
  remaining: DiscoveredSource[];
  addedSources?: AddedSource[];
}): string {
  const { searches, extractionGoal, extractions, failed, remaining, addedSources } = params;
  const parts: string[] = [];

  const queryLabel = searches.map((s) => `"${s.query}" (${s.intent})`).join(", ");
  parts.push(
    `Deep search: ${queryLabel}\nExtraction goal: ${extractionGoal}\n` +
    `Analyzed ${extractions.length} source${extractions.length !== 1 ? "s" : ""}.`
  );

  // Build lookup from source title → workspace key
  const sourceKeyMap = new Map<string, string>();
  if (addedSources) {
    for (const a of addedSources) {
      sourceKeyMap.set(a.label, a.key);
    }
  }

  if (addedSources?.length) {
    parts.push(
      `\nThese sources have been added to the workspace. ` +
      `Use [Source: <key>, section] citations to reference them.`
    );
  }

  for (let i = 0; i < extractions.length; i++) {
    const { source, extraction } = extractions[i];
    const qualitySummary = formatPaperQualitySummary(source.paperQuality);
    const workspaceKey = sourceKeyMap.get(source.title);

    let section = `\n═══ Source ${i + 1}: ${source.title} ═══`;
    if (workspaceKey) section += `\nWorkspace key: ${workspaceKey}`;
    section += `\n${source.url}`;
    if (qualitySummary) section += `\n${qualitySummary}`;
    section += `\n\nSummary: ${extraction.summary}`;

    if (extraction.findings.length > 0) {
      section += "\n\nFindings:";
      for (let j = 0; j < extraction.findings.length; j++) {
        const f = extraction.findings[j];
        const tag = f.relevance.toUpperCase();
        section += `\n  ${j + 1}. [${tag}] ${f.claim}`;
        section += `\n     "${f.quote}"`;
        if (f.section) section += `\n     (Section: ${f.section})`;
      }
    } else {
      section += "\n\nNo relevant findings extracted from this source.";
    }

    if (extraction.limitations) {
      section += `\n\nLimitations: ${extraction.limitations}`;
    }

    parts.push(section);
  }

  if (failed.length > 0) {
    let section = "\n── Could not analyze ──";
    for (const f of failed) {
      section += `\n- ${f.source.title}: ${f.reason}`;
    }
    parts.push(section);
  }

  if (remaining.length > 0) {
    let section = "\n── Additional sources found (metadata only) ──";
    for (const s of remaining) {
      const date = s.publishedDate ? ` (${s.publishedDate.slice(0, 10)})` : "";
      const author = s.author ? ` — ${s.author}` : "";
      section += `\n- ${s.title}${date}${author}\n  ${s.url}`;
    }
    parts.push(section);
  }

  return parts.join("\n");
}

/** Truncate a title for progress messages. */
export function truncateTitle(title: string, maxLen = 40): string {
  return title.length > maxLen ? title.slice(0, maxLen - 1) + "\u2026" : title;
}

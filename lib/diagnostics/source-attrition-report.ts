import type { PdfParseAttempt } from "@/lib/engine/state";

export interface FetchAttempt {
  url: string;
  status: "ok" | "failed";
  contentType?: string;
  bytes?: number;
  durationMs: number;
  error?: string;
}

export interface SourceDiagnostic {
  index: number;
  title: string;
  url: string;
  pdfUrl?: string;
  providers: string[];
  fetchAttempts: FetchAttempt[];
  finalStatus: "parsed" | "failed";
  parseStatus?: "parsed" | "failed" | "pending";
  parseEngine?: string;
  parseQuality?: string;
  resolvedUrl?: string;
  chunkCount?: number;
  charCount?: number;
  parseDiagnostics?: PdfParseAttempt[];
  winnerStage?: PdfParseAttempt["stage"];
  failurePhase?: "fetch" | "pdf-parse" | "validate" | "ingest" | "unknown";
  failureReason?: string;
}

export interface AttritionReport {
  generatedAt: string;
  userId: string;
  query?: string;
  directUrls?: string[];
  discoveredCount: number;
  parsedCount: number;
  failedCount: number;
  byPhase: Record<string, number>;
  byParseEngine: Record<string, number>;
  byParseQuality: Record<string, number>;
  byWinnerStage: Record<string, number>;
  byWinnerFamily: Record<string, number>;
  sources: SourceDiagnostic[];
}

export function buildSourceAttritionReport(params: {
  userId: string;
  query?: string;
  directUrls?: string[];
  diagnostics: SourceDiagnostic[];
}): AttritionReport {
  const byPhase: Record<string, number> = {};
  const byParseEngine: Record<string, number> = {};
  const byParseQuality: Record<string, number> = {};
  const byWinnerStage: Record<string, number> = {};
  const byWinnerFamily: Record<string, number> = {};

  for (const source of params.diagnostics) {
    if (source.failurePhase) {
      byPhase[source.failurePhase] = (byPhase[source.failurePhase] ?? 0) + 1;
    }
    if (source.parseEngine) {
      byParseEngine[source.parseEngine] =
        (byParseEngine[source.parseEngine] ?? 0) + 1;
    }
    if (source.parseQuality) {
      byParseQuality[source.parseQuality] =
        (byParseQuality[source.parseQuality] ?? 0) + 1;
    }
    if (source.winnerStage) {
      byWinnerStage[source.winnerStage] = (byWinnerStage[source.winnerStage] ?? 0) + 1;
      const family = classifyWinnerFamily(source.winnerStage);
      byWinnerFamily[family] = (byWinnerFamily[family] ?? 0) + 1;
    }
  }

  const parsedCount = params.diagnostics.filter(
    (source) => source.finalStatus === "parsed"
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    userId: params.userId,
    query: params.query,
    directUrls: params.directUrls,
    discoveredCount: params.diagnostics.length,
    parsedCount,
    failedCount: params.diagnostics.length - parsedCount,
    byPhase,
    byParseEngine,
    byParseQuality,
    byWinnerStage,
    byWinnerFamily,
    sources: params.diagnostics,
  };
}

export function classifyFailurePhase(
  message?: string
): SourceDiagnostic["failurePhase"] {
  const normalized = (message ?? "").toLowerCase();

  if (!normalized) return "unknown";
  if (normalized.includes("source fetch")) return "fetch";
  if (normalized.includes("fetch failed")) return "fetch";
  if (normalized.includes(" 403 ")) return "fetch";
  if (normalized.includes("timed out")) return "fetch";
  if (normalized.includes("worker")) return "pdf-parse";
  if (normalized.includes("pdf")) return "pdf-parse";
  if (normalized.includes("binary")) return "validate";
  if (normalized.includes("normalized document")) return "validate";
  if (normalized.includes("raw pdf")) return "validate";
  return "ingest";
}

function classifyWinnerFamily(stage: NonNullable<SourceDiagnostic["winnerStage"]>) {
  if (stage === "direct_bytes" || stage === "direct_url") {
    return "direct";
  }
  return "local";
}

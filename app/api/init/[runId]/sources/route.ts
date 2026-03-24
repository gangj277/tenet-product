import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/auth/session";
import {
  fetchSourceBytes,
  sniffMimeType,
  ingestSourceFromBytes,
} from "@/lib/ingest/source-ingestion";
import { classifySourceIntoFolder } from "@/lib/ingest/classify-source-folder";
import { blobStore } from "@/lib/storage/blob-store";
import { syncAddedSourcesToWorkspaceCache } from "@/lib/workspace/source-cache";
import type { SourceEntry } from "@/lib/engine/state";
import { getStorage } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storage = await getStorage();
    const ownedRun = await storage.getOwnedResearchRun(session.userId, runId);
    if (!ownedRun) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    let buffer: Buffer;
    let filename: string;
    let sourceUrl: string;
    let resolvedUrl: string;
    let httpContentType: string | undefined;

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      // ── Upload mode ──
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      filename = file.name || "upload.pdf";
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      sourceUrl = filename;
      resolvedUrl = filename;
      httpContentType = file.type || undefined;
    } else {
      // ── URL mode ──
      const body = await request.json();
      const url = body?.url;
      if (!url || typeof url !== "string") {
        return NextResponse.json({ error: "No URL provided" }, { status: 400 });
      }

      try {
        const result = await fetchSourceBytes(url);
        buffer = result.buffer;
        sourceUrl = url;
        resolvedUrl = result.resolvedUrl;
        httpContentType = result.contentType || undefined;
        const urlPath = new URL(url).pathname;
        filename = urlPath.split("/").pop() || "source.pdf";
      } catch (err) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${(err as Error).message}` },
          { status: 400 }
        );
      }
    }

    // Pre-validate it's a PDF before running the full pipeline
    const mimeType = sniffMimeType(buffer, resolvedUrl, httpContentType);
    if (mimeType !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    const sourceId = crypto.randomUUID();
    const label = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "Uploaded PDF";

    // Build a SourceEntry and run the same pipeline as project init
    const sourceEntry: SourceEntry = {
      sourceId,
      name: label,
      origin: "uploaded",
      mimeType: httpContentType || "application/octet-stream",
      checksum: "",
      storageUrl: "",
      parseStatus: "pending",
    };

    const result = await ingestSourceFromBytes({
      source: sourceEntry,
      rawBuffer: buffer,
      sourceUrl,
      resolvedUrl,
      httpContentType,
    });

    if (result.source.parseStatus === "failed") {
      const reason = result.warnings[0] || "PDF could not be parsed";
      return NextResponse.json({ error: reason }, { status: 422 });
    }

    // Read normalized text back from blob store (written by ingestSourceFromBytes)
    const normalizedBlobKey = result.source.metadata?.normalizedBlobKey;
    const summaryContent = normalizedBlobKey
      ? await blobStore.getText(normalizedBlobKey)
      : "";

    // Classify into folder
    const existingMeta = await storage.getSourceMetadataForRun(runId);
    const existingFolders = [
      ...new Set(
        Object.values(existingMeta)
          .map((m) => m.folder)
          .filter((f): f is string => !!f)
      ),
    ];
    const folder = await classifySourceIntoFolder({
      sourceName: label,
      existingFolders,
    });

    const metadata = {
      ...((result.source.metadata ?? {}) as unknown as Record<string, unknown>),
      ...(folder ? { folder } : {}),
    };

    // Insert into DB (source row + source_summary artifact)
    await storage.addAgentDiscoveredSource({
      runId,
      sourceId,
      name: label,
      origin: "uploaded",
      mimeType: "application/pdf",
      storagePath: result.source.storageUrl,
      metadata,
      sourceChunks: result.sourceChunks,
      summaryContent,
    });

    await syncAddedSourcesToWorkspaceCache(runId, [
      {
        sourceId,
        key: `source:${sourceId}`,
        label,
        content: summaryContent,
        ...(resolvedUrl ? { sourceUrl: resolvedUrl } : {}),
        ...(folder ? { folder } : {}),
      },
    ]);

    return NextResponse.json({
      sourceId,
      key: `source:${sourceId}`,
      label,
      content: summaryContent,
      ...(folder ? { folder } : {}),
    });
  } catch (err) {
    console.error("Failed to add source:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

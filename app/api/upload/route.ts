import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/utils/id";
import { computeChecksum } from "@/lib/utils/checksum";
import { blobStore } from "@/lib/storage/blob-store";
import type { SourceEntry } from "@/lib/engine/state";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files uploaded" },
        { status: 400 }
      );
    }

    const sources: SourceEntry[] = [];

    for (const file of files) {
      if (file.type !== "application/pdf") {
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const sourceId = generateId();
      const checksum = computeChecksum(buffer);
      const storageKey = `sources/${sourceId}/raw.pdf`;

      await blobStore.putBuffer(storageKey, buffer, file.type);

      sources.push({
        sourceId,
        name: file.name,
        origin: "uploaded",
        mimeType: file.type,
        checksum,
        storageUrl: storageKey,
        parseStatus: "pending",
        metadata: {
          sourceKind: "pdf",
          sourceUrl: file.name,
          resolvedUrl: file.name,
          httpContentType: file.type,
          sniffedMimeType: file.type,
          rawBlobKey: storageKey,
          byteSize: buffer.length,
        },
      });
    }

    return NextResponse.json({ sources });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

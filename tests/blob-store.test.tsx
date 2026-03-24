import assert from "node:assert/strict";
import test from "node:test";

import type { BlobStore } from "../lib/storage/blob-store";

test("FallbackBlobStore degrades to the fallback store when R2 reports a missing bucket", async () => {
  const { FallbackBlobStore } = await import("../lib/storage/blob-store.ts");

  const primaryWrites: string[] = [];
  const fallbackWrites: string[] = [];
  const fallbackBuffers = new Map<string, Buffer>();

  const primary: BlobStore = {
    async putBuffer(key: string) {
      primaryWrites.push(key);
      throw new Error("The specified bucket does not exist.");
    },
    async putText(key: string) {
      primaryWrites.push(key);
      throw new Error("The specified bucket does not exist.");
    },
    async getBuffer() {
      throw new Error("The specified bucket does not exist.");
    },
    async getText() {
      throw new Error("The specified bucket does not exist.");
    },
  };

  const fallback: BlobStore = {
    async putBuffer(key: string, buffer: Buffer) {
      fallbackWrites.push(key);
      fallbackBuffers.set(key, buffer);
      return key;
    },
    async putText(key: string, text: string) {
      fallbackWrites.push(key);
      fallbackBuffers.set(key, Buffer.from(text, "utf8"));
      return key;
    },
    async getBuffer(key: string) {
      const value = fallbackBuffers.get(key);
      if (!value) {
        throw new Error(`missing fallback blob: ${key}`);
      }
      return value;
    },
    async getText(key: string) {
      return (await this.getBuffer(key)).toString("utf8");
    },
  };

  const store = new FallbackBlobStore(primary, fallback);

  await store.putBuffer("sources/test/raw.pdf", Buffer.from("pdf"), "application/pdf");
  await store.putText("sources/test/normalized.md", "# normalized");

  assert.equal(
    (await store.getBuffer("sources/test/raw.pdf")).toString("utf8"),
    "pdf"
  );
  assert.equal(
    await store.getText("sources/test/normalized.md"),
    "# normalized"
  );

  assert.deepEqual(primaryWrites, ["sources/test/raw.pdf"]);
  assert.deepEqual(fallbackWrites, [
    "sources/test/raw.pdf",
    "sources/test/normalized.md",
  ]);
});

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export interface BlobStore {
  putBuffer(key: string, buffer: Buffer, contentType: string): Promise<string>;
  putText(key: string, text: string, contentType?: string): Promise<string>;
  getBuffer(key: string): Promise<Buffer>;
  getText(key: string): Promise<string>;
}

export class LocalBlobStore implements BlobStore {
  constructor(private readonly rootDir: string) {}

  async putBuffer(
    key: string,
    buffer: Buffer,
    _contentType: string
  ): Promise<string> {
    const fullPath = this.resolvePath(key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    return key;
  }

  async putText(
    key: string,
    text: string,
    _contentType = "text/plain; charset=utf-8"
  ): Promise<string> {
    await this.putBuffer(key, Buffer.from(text, "utf8"), _contentType);
    return key;
  }

  async getBuffer(key: string): Promise<Buffer> {
    return readFile(this.resolvePath(key));
  }

  async getText(key: string): Promise<string> {
    return (await this.getBuffer(key)).toString("utf8");
  }

  private resolvePath(key: string) {
    return path.join(this.rootDir, key.replace(/^\/+/, ""));
  }
}

export class FallbackBlobStore implements BlobStore {
  private degradedToFallback = false;
  private warned = false;

  constructor(
    private readonly primary: BlobStore,
    private readonly fallback: BlobStore
  ) {}

  async putBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    return this.runWithFallback(
      () => this.primary.putBuffer(key, buffer, contentType),
      () => this.fallback.putBuffer(key, buffer, contentType)
    );
  }

  async putText(
    key: string,
    text: string,
    contentType?: string
  ): Promise<string> {
    return this.runWithFallback(
      () => this.primary.putText(key, text, contentType),
      () => this.fallback.putText(key, text, contentType)
    );
  }

  async getBuffer(key: string): Promise<Buffer> {
    return this.runWithFallback(
      () => this.primary.getBuffer(key),
      () => this.fallback.getBuffer(key)
    );
  }

  async getText(key: string): Promise<string> {
    return this.runWithFallback(
      () => this.primary.getText(key),
      () => this.fallback.getText(key)
    );
  }

  private async runWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>
  ): Promise<T> {
    if (this.degradedToFallback) {
      return fallbackOperation();
    }

    try {
      return await primaryOperation();
    } catch (error) {
      if (!shouldFallbackToLocalBlobStore(error)) {
        throw error;
      }

      this.degradedToFallback = true;
      if (!this.warned) {
        this.warned = true;
        console.warn(
          `[blob-store] Primary blob store unavailable. Falling back to local storage: ${getErrorMessage(error)}`
        );
      }
      return fallbackOperation();
    }
  }
}

class R2BlobStore implements BlobStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clientPromise: Promise<any> | null = null;

  constructor(private readonly bucket: string) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 credentials are not configured");
    }

    void accountId;
    void accessKeyId;
    void secretAccessKey;
  }

  async putBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    const { client, PutObjectCommand } = await this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return key;
  }

  async putText(
    key: string,
    text: string,
    contentType = "text/plain; charset=utf-8"
  ): Promise<string> {
    return this.putBuffer(key, Buffer.from(text, "utf8"), contentType);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const { client, GetObjectCommand } = await this.getClient();
    const response = (await client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    )) as {
      Body?: {
        transformToByteArray?: () => Promise<Uint8Array>;
      };
    };

    const body = response.Body;
    if (!body || typeof body.transformToByteArray !== "function") {
      throw new Error(`Blob not found: ${key}`);
    }

    return Buffer.from(await body.transformToByteArray());
  }

  async getText(key: string): Promise<string> {
    return (await this.getBuffer(key)).toString("utf8");
  }

  private async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = import("@aws-sdk/client-s3").then((module) => {
        const accountId = process.env.R2_ACCOUNT_ID;
        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

        if (!accountId || !accessKeyId || !secretAccessKey) {
          throw new Error("R2 credentials are not configured");
        }

        const client = new module.S3Client({
          region: "auto",
          endpoint:
            process.env.R2_ENDPOINT ??
            `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });

        return {
          client,
          GetObjectCommand: module.GetObjectCommand,
          PutObjectCommand: module.PutObjectCommand,
        };
      });
    }

    return this.clientPromise!;
  }
}

const globalForBlobStore = globalThis as typeof globalThis & {
  __lumenBlobStore?: BlobStore & { __lumenBlobStoreVersion?: string };
};

type VersionedBlobStore = BlobStore & { __lumenBlobStoreVersion?: string };

function createBlobStore(): BlobStore {
  const rootDir =
    process.env.LOCAL_BLOB_ROOT ??
    path.join(process.cwd(), ".lumen-blob-store");
  const localStore = new LocalBlobStore(rootDir);

  const bucket = process.env.R2_BUCKET;
  const hasR2Credentials =
    !!process.env.R2_ACCOUNT_ID &&
    !!process.env.R2_ACCESS_KEY_ID &&
    !!process.env.R2_SECRET_ACCESS_KEY;

  if (bucket && hasR2Credentials) {
    try {
      return new FallbackBlobStore(new R2BlobStore(bucket), localStore);
    } catch (error) {
      console.warn(
        `[blob-store] Failed to initialize R2 storage. Using local storage instead: ${getErrorMessage(error)}`
      );
      return localStore;
    }
  }

  return localStore;
}

function isCurrentBlobStore(
  value: BlobStore | VersionedBlobStore | undefined
): value is BlobStore & { __lumenBlobStoreVersion: string } {
  if (!value || !("__lumenBlobStoreVersion" in value)) {
    return false;
  }

  return value.__lumenBlobStoreVersion === "2";
}

function markBlobStore(store: BlobStore) {
  return Object.assign(store, { __lumenBlobStoreVersion: "2" as const });
}

export const blobStore = isCurrentBlobStore(globalForBlobStore.__lumenBlobStore)
  ? globalForBlobStore.__lumenBlobStore
  : (globalForBlobStore.__lumenBlobStore = markBlobStore(createBlobStore()));

function shouldFallbackToLocalBlobStore(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const name =
    typeof error === "object" && error && "name" in error
      ? String(error.name).toLowerCase()
      : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code).toLowerCase()
      : "";

  return (
    name.includes("nosuchbucket") ||
    code.includes("nosuchbucket") ||
    message.includes("bucket does not exist") ||
    message.includes("specified bucket does not exist") ||
    message.includes("r2 credentials are not configured")
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

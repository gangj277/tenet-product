import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export interface BlobStore {
  putBuffer(key: string, buffer: Buffer, contentType: string): Promise<string>;
  putText(key: string, text: string, contentType?: string): Promise<string>;
  getBuffer(key: string): Promise<Buffer>;
  getText(key: string): Promise<string>;
}

class LocalBlobStore implements BlobStore {
  constructor(private readonly rootDir: string) {}

  async putBuffer(key: string, buffer: Buffer, _contentType?: string): Promise<string> {
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
  __lumenBlobStore?: BlobStore;
};

function createBlobStore(): BlobStore {
  const bucket = process.env.R2_BUCKET;
  const hasR2Credentials =
    !!process.env.R2_ACCOUNT_ID &&
    !!process.env.R2_ACCESS_KEY_ID &&
    !!process.env.R2_SECRET_ACCESS_KEY;

  if (bucket && hasR2Credentials) {
    return new R2BlobStore(bucket);
  }

  const rootDir =
    process.env.LOCAL_BLOB_ROOT ??
    path.join(process.cwd(), ".lumen-blob-store");

  return new LocalBlobStore(rootDir);
}

export const blobStore =
  globalForBlobStore.__lumenBlobStore ??
  (globalForBlobStore.__lumenBlobStore = createBlobStore());

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const globalForLocks = globalThis as typeof globalThis & {
  __lumenFsLocks?: Map<string, Promise<void>>;
};

function getLocks(): Map<string, Promise<void>> {
  if (!globalForLocks.__lumenFsLocks) {
    globalForLocks.__lumenFsLocks = new Map();
  }
  return globalForLocks.__lumenFsLocks;
}

export async function withFileLock<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const locks = getLocks();
  const previous = locks.get(key) ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = previous.then(() => current);
  locks.set(key, chain);

  await previous;

  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === chain) {
      locks.delete(key);
    }
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function readJsonFile<T>(
  filePath: string,
  fallback: T
): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

export async function readTextFile(
  filePath: string,
  fallback = ""
): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

export async function atomicWriteText(
  filePath: string,
  contents: string
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(16).slice(2)}`;
  await writeFile(tmpPath, contents, "utf8");
  await rename(tmpPath, filePath);
}

export async function atomicWriteJson(
  filePath: string,
  data: unknown
): Promise<void> {
  await atomicWriteText(filePath, JSON.stringify(data, null, 2));
}

export async function removePath(filePath: string): Promise<void> {
  await rm(filePath, { recursive: true, force: true });
}

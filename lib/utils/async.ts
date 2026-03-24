export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class RetryableRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableRequestError";
  }
}

export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  const controller = new AbortController();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeoutPromise]);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError(timeoutMessage);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function retryAsync<T>({
  operation,
  retries,
  shouldRetry,
  getDelayMs,
}: {
  operation: (attempt: number) => Promise<T>;
  retries: number;
  shouldRetry: (error: unknown) => boolean;
  getDelayMs: (attempt: number) => number;
}): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }

      attempt += 1;
      await sleep(getDelayMs(attempt));
    }
  }
}

export async function allSettledWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      try {
        const value = await mapper(items[currentIndex], currentIndex);
        results[currentIndex] = { status: "fulfilled", value };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);

  return results;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createConcurrencyLimiter(limit: number) {
  const normalizedLimit = Math.max(1, Math.floor(limit));
  let active = 0;
  const queue: Array<() => void> = [];

  return async function withConcurrencyLimit<T>(operation: () => Promise<T>): Promise<T> {
    if (active >= normalizedLimit) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }

    active += 1;

    try {
      return await operation();
    } finally {
      active -= 1;
      queue.shift()?.();
    }
  };
}

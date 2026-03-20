/**
 * Per-user daily cost budget tracker.
 * In-memory, globalThis singleton (same pattern as memory-store.ts).
 */

const DAILY_BUDGET_USD = Number(process.env.USER_DAILY_BUDGET_USD ?? "20");

interface UserDayEntry {
  date: string; // "2026-03-19" — resets daily
  costUsd: number;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getOrCreateEntry(
  tracker: Map<string, UserDayEntry>,
  userId: string
): UserDayEntry {
  const today = todayUTC();
  const existing = tracker.get(userId);
  if (existing && existing.date === today) return existing;
  // New day or new user — evict old entry
  const entry: UserDayEntry = { date: today, costUsd: 0 };
  tracker.set(userId, entry);
  return entry;
}

function getTracker(): Map<string, UserDayEntry> {
  const g = globalThis as typeof globalThis & {
    __lumenUserCostTracker?: Map<string, UserDayEntry>;
  };
  if (!g.__lumenUserCostTracker) {
    g.__lumenUserCostTracker = new Map();
  }
  return g.__lumenUserCostTracker;
}

export function checkUserBudget(userId: string): {
  allowed: boolean;
  spentUsd: number;
  limitUsd: number;
} {
  const entry = getOrCreateEntry(getTracker(), userId);
  return {
    allowed: entry.costUsd < DAILY_BUDGET_USD,
    spentUsd: entry.costUsd,
    limitUsd: DAILY_BUDGET_USD,
  };
}

export function recordUserCost(userId: string, costUsd: number): void {
  if (costUsd <= 0) return;
  const entry = getOrCreateEntry(getTracker(), userId);
  entry.costUsd += costUsd;
}

export function getUserCostSnapshot(userId: string): {
  spentUsd: number;
  limitUsd: number;
  date: string;
} {
  const entry = getOrCreateEntry(getTracker(), userId);
  return {
    spentUsd: entry.costUsd,
    limitUsd: DAILY_BUDGET_USD,
    date: entry.date,
  };
}

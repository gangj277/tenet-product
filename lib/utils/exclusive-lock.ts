const globalForLocks = globalThis as typeof globalThis & {
  __lumenExclusiveLocks?: Set<string>;
};

function getLockStore(): Set<string> {
  return (
    globalForLocks.__lumenExclusiveLocks ??
    (globalForLocks.__lumenExclusiveLocks = new Set<string>())
  );
}

export function acquireExclusiveLock(key: string): (() => void) | null {
  const locks = getLockStore();
  if (locks.has(key)) {
    return null;
  }

  locks.add(key);

  return () => {
    locks.delete(key);
  };
}

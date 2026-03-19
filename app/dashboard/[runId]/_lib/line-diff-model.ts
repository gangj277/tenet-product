interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
}

export interface LineDiffModel {
  changedCount: number;
  hiddenChanges: number;
  visibleEntries: Array<DiffLine | "separator">;
}

function computeLineDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "unchanged", text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", text: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: "removed", text: oldLines[i - 1] });
      i--;
    }
  }
  result.reverse();
  return result;
}

export function buildLineDiffModel({
  oldText,
  newText,
  expanded,
  maxVisibleChanges = 60,
}: {
  oldText: string;
  newText: string;
  expanded: boolean;
  maxVisibleChanges?: number;
}): LineDiffModel {
  const diff = computeLineDiff(oldText.split("\n"), newText.split("\n"));
  const changedCount = diff.filter((line) => line.type !== "unchanged").length;

  if (changedCount === 0) {
    return { changedCount, hiddenChanges: 0, visibleEntries: [] };
  }

  const isChanged = diff.map((line) => line.type !== "unchanged");
  const contextLines = diff.map((line, idx) => {
    if (line.type !== "unchanged") return true;
    for (let k = Math.max(0, idx - 2); k <= Math.min(diff.length - 1, idx + 2); k++) {
      if (isChanged[k]) return true;
    }
    return false;
  });

  const visibleEntries: Array<DiffLine | "separator"> = [];
  let changesSoFar = 0;
  let lastShown = -1;

  for (let idx = 0; idx < diff.length; idx++) {
    if (!contextLines[idx]) continue;

    if (!expanded && diff[idx].type !== "unchanged") {
      changesSoFar++;
      if (changesSoFar > maxVisibleChanges) continue;
    }

    if (lastShown >= 0 && idx - lastShown > 1) {
      visibleEntries.push("separator");
    }
    visibleEntries.push(diff[idx]);
    lastShown = idx;
  }

  const hiddenChanges = changedCount - Math.min(changedCount, maxVisibleChanges);

  return { changedCount, hiddenChanges, visibleEntries };
}

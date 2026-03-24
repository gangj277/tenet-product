/** Utility functions for search filter state inspection. */

import type { SearchFilterConfig } from "@/lib/discovery/search-filters";

export function hasActiveSearchFilters(filters?: SearchFilterConfig): boolean {
  if (!filters) return false;
  return Boolean(
    filters.venues?.length ||
      (filters.publicationType && filters.publicationType !== "all") ||
      filters.minCitationCount ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.openAccessOnly
  );
}

export function countActiveSearchFilters(filters?: SearchFilterConfig): number {
  if (!filters) return 0;
  let count = 0;
  if (filters.venues?.length) count++;
  if (filters.publicationType && filters.publicationType !== "all") count++;
  if (filters.minCitationCount) count++;
  if (filters.dateFrom || filters.dateTo) count++;
  if (filters.openAccessOnly) count++;
  return count;
}

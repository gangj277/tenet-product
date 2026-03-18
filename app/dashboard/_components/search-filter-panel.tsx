"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";

/* ── Venue Registry ── */

interface VenueOption {
  value: string;
  label: string;
  category: string;
}

const VENUE_REGISTRY: VenueOption[] = [
  // AI / ML
  { value: "NeurIPS", label: "NeurIPS", category: "AI / ML" },
  { value: "ICML", label: "ICML", category: "AI / ML" },
  { value: "ICLR", label: "ICLR", category: "AI / ML" },
  { value: "AAAI", label: "AAAI", category: "AI / ML" },
  { value: "IJCAI", label: "IJCAI", category: "AI / ML" },
  // NLP
  { value: "ACL", label: "ACL", category: "NLP" },
  { value: "EMNLP", label: "EMNLP", category: "NLP" },
  { value: "NAACL", label: "NAACL", category: "NLP" },
  { value: "COLING", label: "COLING", category: "NLP" },
  // Vision
  { value: "CVPR", label: "CVPR", category: "Vision" },
  { value: "ICCV", label: "ICCV", category: "Vision" },
  { value: "ECCV", label: "ECCV", category: "Vision" },
  // Systems
  { value: "OSDI", label: "OSDI", category: "Systems" },
  { value: "SOSP", label: "SOSP", category: "Systems" },
  { value: "NSDI", label: "NSDI", category: "Systems" },
  { value: "SIGCOMM", label: "SIGCOMM", category: "Systems" },
  // Data / IR
  { value: "KDD", label: "KDD", category: "Data / IR" },
  { value: "SIGIR", label: "SIGIR", category: "Data / IR" },
  { value: "WWW", label: "WWW", category: "Data / IR" },
  { value: "WSDM", label: "WSDM", category: "Data / IR" },
  // HCI
  { value: "CHI", label: "CHI", category: "HCI" },
  { value: "UIST", label: "UIST", category: "HCI" },
  // Journals
  { value: "Nature", label: "Nature", category: "Journals" },
  { value: "Science", label: "Science", category: "Journals" },
  { value: "PNAS", label: "PNAS", category: "Journals" },
  { value: "Cell", label: "Cell", category: "Journals" },
  { value: "JMLR", label: "JMLR", category: "Journals" },
  { value: "TACL", label: "TACL", category: "Journals" },
  { value: "IEEE TPAMI", label: "IEEE TPAMI", category: "Journals" },
  // Preprint
  { value: "arXiv", label: "arXiv", category: "Preprint" },
  { value: "bioRxiv", label: "bioRxiv", category: "Preprint" },
  { value: "medRxiv", label: "medRxiv", category: "Preprint" },
];

const VENUE_CATEGORIES = Array.from(
  new Set(VENUE_REGISTRY.map((v) => v.category))
);

/* ── Publication Types ── */

const PUBLICATION_TYPES: Array<{
  value: SearchFilterConfig["publicationType"] | "all";
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "journal-article", label: "Journal" },
  { value: "conference", label: "Conference" },
  { value: "review", label: "Review" },
  { value: "preprint", label: "Preprint" },
];

/* ── Date Presets ── */

const DATE_PRESETS: Array<{ label: string; years: number | null }> = [
  { label: "Any", years: null },
  { label: "2y", years: 2 },
  { label: "5y", years: 5 },
  { label: "10y", years: 10 },
];

/* ── Citation Presets ── */

const CITATION_PRESETS: Array<{ label: string; value: number | undefined }> = [
  { label: "Any", value: undefined },
  { label: "10+", value: 10 },
  { label: "50+", value: 50 },
  { label: "100+", value: 100 },
  { label: "500+", value: 500 },
];

/* ── Props ── */

interface SearchFilterPanelProps {
  filters: SearchFilterConfig;
  onChange: (filters: SearchFilterConfig) => void;
  compact?: boolean;
}

/* ── Component ── */

export function SearchFilterPanel({
  filters,
  onChange,
  compact = false,
}: SearchFilterPanelProps) {
  const [venueSearch, setVenueSearch] = useState("");
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false);
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const venueContainerRef = useRef<HTMLDivElement>(null);
  const venueInputRef = useRef<HTMLInputElement>(null);

  const update = useCallback(
    (patch: Partial<SearchFilterConfig>) => {
      onChange({ ...filters, ...patch });
    },
    [filters, onChange]
  );

  // Close venue dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        venueContainerRef.current &&
        !venueContainerRef.current.contains(e.target as Node)
      ) {
        setVenueDropdownOpen(false);
        setVenueSearch("");
      }
    }
    if (venueDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [venueDropdownOpen]);

  // Detect if a custom date range is active (not matching any preset)
  const activeDatePreset = useMemo(() => {
    if (!filters.dateFrom && !filters.dateTo) return null; // "Any"
    const now = new Date();
    for (const p of DATE_PRESETS) {
      if (p.years === null) continue;
      const cutoff = new Date(
        now.getFullYear() - p.years,
        now.getMonth(),
        now.getDate()
      );
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      if (filters.dateFrom === cutoffStr && !filters.dateTo) return p.years;
    }
    return "custom";
  }, [filters.dateFrom, filters.dateTo]);

  // Filter venue options by search
  const filteredVenues = useMemo(() => {
    const selected = new Set(
      (filters.venues ?? []).map((v) => v.toLowerCase())
    );
    const q = venueSearch.toLowerCase().trim();
    return VENUE_REGISTRY.filter(
      (v) =>
        !selected.has(v.value.toLowerCase()) &&
        (q === "" ||
          v.value.toLowerCase().includes(q) ||
          v.label.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q))
    );
  }, [venueSearch, filters.venues]);

  // Group filtered venues by category
  const groupedVenues = useMemo(() => {
    const groups = new Map<string, VenueOption[]>();
    for (const v of filteredVenues) {
      const arr = groups.get(v.category) ?? [];
      arr.push(v);
      groups.set(v.category, arr);
    }
    return groups;
  }, [filteredVenues]);

  /* ── Venue actions ── */

  function toggleVenue(venue: string) {
    const existing = filters.venues ?? [];
    const idx = existing.findIndex(
      (v) => v.toLowerCase() === venue.toLowerCase()
    );
    if (idx >= 0) {
      const next = [...existing];
      next.splice(idx, 1);
      update({ venues: next.length > 0 ? next : undefined });
    } else {
      update({ venues: [...existing, venue] });
    }
  }

  function addCustomVenue() {
    const name = venueSearch.trim();
    if (!name) return;
    const existing = filters.venues ?? [];
    if (existing.some((v) => v.toLowerCase() === name.toLowerCase())) return;
    update({ venues: [...existing, name] });
    setVenueSearch("");
  }

  function removeVenue(index: number) {
    const next = [...(filters.venues ?? [])];
    next.splice(index, 1);
    update({ venues: next.length > 0 ? next : undefined });
  }

  /* ── Date preset handler ── */

  function applyDatePreset(years: number | null) {
    if (years === null) {
      update({ dateFrom: undefined, dateTo: undefined });
      setCustomDateOpen(false);
    } else {
      const now = new Date();
      const cutoff = new Date(
        now.getFullYear() - years,
        now.getMonth(),
        now.getDate()
      );
      update({
        dateFrom: cutoff.toISOString().slice(0, 10),
        dateTo: undefined,
      });
      setCustomDateOpen(false);
    }
  }

  /* ── Shared styles ── */

  const labelCls = compact
    ? "font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-dim"
    : "font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-dim";

  const gap = compact ? "space-y-3" : "space-y-4";

  const chipBase =
    "inline-flex items-center justify-center rounded-md text-[11px] font-medium transition-all duration-150 cursor-pointer select-none";

  const chipIdle =
    "border border-edge/40 text-dim hover:text-sub hover:border-edge/60 hover:bg-edge/5";

  const chipActive =
    "border border-accent/30 bg-accent-fill/10 text-accent";

  return (
    <div className={gap}>
      {/* ── Venues ── */}
      <div ref={venueContainerRef} className="relative">
        <label className={`${labelCls} block mb-1.5`}>Venues</label>

        {/* Selected venue chips */}
        {(filters.venues?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {(filters.venues ?? []).map((venue, i) => (
              <span
                key={`${venue}-${i}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-accent bg-accent-fill/10 border border-accent-fill/20"
              >
                {venue}
                <button
                  onClick={() => removeVenue(i)}
                  className="ml-0.5 text-accent/40 hover:text-accent transition-colors cursor-pointer"
                  aria-label={`Remove ${venue}`}
                >
                  <svg
                    className="w-2.5 h-2.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <div
          className={`flex items-center gap-1.5 bg-transparent border rounded-lg px-2.5 py-1.5 transition-colors ${
            venueDropdownOpen
              ? "border-accent/40"
              : "border-edge/40 hover:border-edge/60"
          }`}
          onClick={() => {
            setVenueDropdownOpen(true);
            venueInputRef.current?.focus();
          }}
        >
          {/* Search icon */}
          <svg
            className="w-3 h-3 text-dim shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={venueInputRef}
            type="text"
            value={venueSearch}
            onChange={(e) => {
              setVenueSearch(e.target.value);
              if (!venueDropdownOpen) setVenueDropdownOpen(true);
            }}
            onFocus={() => setVenueDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // If there's exactly one match, select it; otherwise add custom
                if (filteredVenues.length === 1) {
                  toggleVenue(filteredVenues[0].value);
                  setVenueSearch("");
                } else if (venueSearch.trim()) {
                  addCustomVenue();
                }
              }
              if (e.key === "Escape") {
                setVenueDropdownOpen(false);
                setVenueSearch("");
              }
            }}
            placeholder={
              filters.venues?.length
                ? "Search or add more..."
                : "Search venues, conferences..."
            }
            className="flex-1 bg-transparent text-[12px] text-body placeholder:text-dim/40 outline-none"
          />
        </div>

        {/* Dropdown */}
        {venueDropdownOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-panel border border-edge/40 rounded-lg shadow-lg max-h-[240px] overflow-y-auto overscroll-contain">
            {/* Custom entry hint */}
            {venueSearch.trim() &&
              !VENUE_REGISTRY.some(
                (v) =>
                  v.value.toLowerCase() === venueSearch.trim().toLowerCase()
              ) && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-sub hover:bg-edge/10 transition-colors cursor-pointer border-b border-edge/20"
                  onClick={() => {
                    addCustomVenue();
                  }}
                >
                  <svg
                    className="w-3 h-3 text-accent shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      d="M12 5v14M5 12h14"
                    />
                  </svg>
                  <span>
                    Add &ldquo;
                    <span className="text-accent font-medium">
                      {venueSearch.trim()}
                    </span>
                    &rdquo;
                  </span>
                </button>
              )}

            {filteredVenues.length === 0 && !venueSearch.trim() && (
              <div className="px-3 py-3 text-[11px] text-mute text-center">
                All venues selected
              </div>
            )}

            {filteredVenues.length === 0 && venueSearch.trim() && (
              <div className="px-3 py-2 text-[11px] text-mute text-center">
                No matching venues
              </div>
            )}

            {/* Grouped venue options */}
            {Array.from(groupedVenues.entries()).map(
              ([category, venues]) => (
                <div key={category}>
                  <div className="px-3 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-mute">
                    {category}
                  </div>
                  <div className="px-2 pb-1.5 flex flex-wrap gap-1">
                    {venues.map((v) => (
                      <button
                        key={v.value}
                        onClick={() => {
                          toggleVenue(v.value);
                          setVenueSearch("");
                          venueInputRef.current?.focus();
                        }}
                        className={`${chipBase} px-2 py-0.5 ${chipIdle} text-[10.5px]`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Publication Type ── */}
      <div>
        <label className={`${labelCls} block mb-1.5`}>Type</label>
        <div className="flex flex-wrap gap-1">
          {PUBLICATION_TYPES.map((t) => {
            const isActive =
              t.value === "all"
                ? !filters.publicationType ||
                  filters.publicationType === "all"
                : filters.publicationType === t.value;
            return (
              <button
                key={t.value}
                onClick={() =>
                  update({
                    publicationType:
                      t.value === "all" ? undefined : (t.value as SearchFilterConfig["publicationType"]),
                  })
                }
                className={`${chipBase} px-2.5 py-1 ${
                  isActive ? chipActive : chipIdle
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Date Range ── */}
      <div>
        <label className={`${labelCls} block mb-1.5`}>Published</label>
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => {
            const isActive =
              p.years === null
                ? activeDatePreset === null
                : activeDatePreset === p.years;
            return (
              <button
                key={p.label}
                onClick={() => applyDatePreset(p.years)}
                className={`${chipBase} px-2.5 py-1 ${
                  isActive ? chipActive : chipIdle
                }`}
              >
                {p.label === "Any" ? "Any time" : `Last ${p.label}`}
              </button>
            );
          })}
          <button
            onClick={() => setCustomDateOpen(!customDateOpen)}
            className={`${chipBase} px-2.5 py-1 ${
              activeDatePreset === "custom" ? chipActive : chipIdle
            }`}
          >
            Custom
          </button>
        </div>

        {/* Custom date inputs */}
        {(customDateOpen || activeDatePreset === "custom") && (
          <div
            className={`grid grid-cols-2 gap-2 mt-2`}
          >
            <div>
              <input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) =>
                  update({ dateFrom: e.target.value || undefined })
                }
                className="w-full bg-transparent border border-edge/40 rounded-lg px-2.5 py-1.5 text-[11px] text-body focus:outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
              />
              <span className="text-[9px] text-mute mt-0.5 block">From</span>
            </div>
            <div>
              <input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) =>
                  update({ dateTo: e.target.value || undefined })
                }
                className="w-full bg-transparent border border-edge/40 rounded-lg px-2.5 py-1.5 text-[11px] text-body focus:outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
              />
              <span className="text-[9px] text-mute mt-0.5 block">To</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Min Citations ── */}
      <div>
        <label className={`${labelCls} block mb-1.5`}>Citations</label>
        <div className="flex flex-wrap gap-1">
          {CITATION_PRESETS.map((p) => {
            const isActive = filters.minCitationCount === p.value;
            return (
              <button
                key={p.label}
                onClick={() => update({ minCitationCount: p.value })}
                className={`${chipBase} px-2.5 py-1 ${
                  isActive ? chipActive : chipIdle
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Open Access ── */}
      <div>
        <button
          onClick={() => update({ openAccessOnly: !filters.openAccessOnly })}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 cursor-pointer select-none border ${
            filters.openAccessOnly
              ? "border-accent/30 bg-accent-fill/10 text-accent"
              : "border-edge/40 text-dim hover:text-sub hover:border-edge/60 hover:bg-edge/5"
          }`}
        >
          {/* Lock icon */}
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            {filters.openAccessOnly ? (
              <>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </>
            ) : (
              <>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </>
            )}
          </svg>
          Open access only
        </button>
      </div>

      {/* ── Active filter summary ── */}
      {hasActiveFilters(filters) && (
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] text-sub">
            {describeActiveFilters(filters)}
          </span>
          <button
            onClick={() => {
              onChange({});
              setCustomDateOpen(false);
            }}
            className="text-[10px] text-dim hover:text-accent transition-colors cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */

function hasActiveFilters(f: SearchFilterConfig): boolean {
  return Boolean(
    f.venues?.length ||
      (f.publicationType && f.publicationType !== "all") ||
      f.minCitationCount ||
      f.dateFrom ||
      f.dateTo ||
      f.openAccessOnly
  );
}

function describeActiveFilters(f: SearchFilterConfig): string {
  const parts: string[] = [];
  if (f.venues?.length)
    parts.push(
      `${f.venues.length} venue${f.venues.length > 1 ? "s" : ""}`
    );
  if (f.publicationType && f.publicationType !== "all")
    parts.push(f.publicationType);
  if (f.minCitationCount) parts.push(`${f.minCitationCount}+ cites`);
  if (f.dateFrom || f.dateTo) parts.push("date range");
  if (f.openAccessOnly) parts.push("open access");
  return parts.join(" \u00b7 ");
}

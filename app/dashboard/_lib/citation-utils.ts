/** Minimal shape needed from source file entries for citation resolution. */
export interface SourceRef {
  key: string; // e.g. "source:4e1a6192-..."
  label: string; // human-readable name
  group: string; // "core" | "source"
}

/** A range of lines within a source file. */
export interface LineRange {
  start: number;
  end: number;
}

/** Parsed result from a `#source:key:L12-45` href. */
export interface ParsedSourceHref {
  sourceKey: string;
  lineRange?: LineRange;
}

/**
 * Parse a source citation href like `#source:KEY:L12-45` into its parts.
 * KEY is the full file key (e.g. `source:UUID` for source files, `synthesis`
 * for core files). The `:L{start}-{end}` suffix is optional.
 */
export function parseSourceHref(href: string): ParsedSourceHref | null {
  const m = href.match(/^#source:(.+?)(?::L(\d+)(?:-(\d+))?)?$/);
  if (!m) return null;
  const sourceKey = m[1]; // full file key as encoded by linkifyCitations
  const lineRange =
    m[2] != null
      ? { start: Number(m[2]), end: m[3] != null ? Number(m[3]) : Number(m[2]) }
      : undefined;
  return { sourceKey, lineRange };
}

/** Matches any `[Source: ...]` citation, including `\[Source: ...\]` with escaped brackets. */
const CITE_RE = /\\?\[Source:\s*([^\]]+?)\\?\]/gi;

/**
 * Build a lookup map from various citation identifier forms
 * to the canonical source file key (e.g. "source:{uuid}").
 */
export function buildSourceLookup(files: SourceRef[]): Map<string, string> {
  const lookup = new Map<string, string>();
  const sources = files.filter((f) => f.group === "source");

  sources.forEach((file, index) => {
    const sourceId = file.key.slice(7); // strip "source:" prefix → UUID
    const n = index + 1; // 1-indexed

    // Full key with prefix (e.g. "source:UUID") — agent citations often use this form
    lookup.set(file.key.toLowerCase(), file.key);
    // Full UUID (without prefix)
    lookup.set(sourceId.toLowerCase(), file.key);
    // Truncated UUID (first 8 chars)
    lookup.set(sourceId.slice(0, 8).toLowerCase(), file.key);
    // SOURCE N / source_N (1-indexed)
    lookup.set(`source ${n}`, file.key);
    lookup.set(`source_${n}`, file.key);
    // Full label (case-insensitive)
    lookup.set(file.label.toLowerCase(), file.key);
  });

  // Also register prefixed keys for notes, papers, and experiments so agent citations resolve
  for (const file of files) {
    if (
      file.group === "note" ||
      file.group === "paper" ||
      file.group === "experiment"
    ) {
      lookup.set(file.key.toLowerCase(), file.key);
      lookup.set(file.label.toLowerCase(), file.key);
    }
  }

  // Also add core file keys so the agent can cite them
  for (const file of files) {
    if (file.group === "core") {
      lookup.set(file.key.toLowerCase(), file.key);
      lookup.set(file.label.toLowerCase(), file.key);
    }
  }

  return lookup;
}

/**
 * Resolve a citation identifier string to a file key.
 */
export function resolveSource(
  id: string,
  lookup: Map<string, string>
): string | undefined {
  const lower = id.toLowerCase().trim();

  // Exact match (UUID, SOURCE N, source_N, full label, core key)
  const exact = lookup.get(lower);
  if (exact) return exact;

  // Prefix match on labels (handles truncated or partial titles)
  for (const [key, fileKey] of lookup) {
    if (key.length > 12 && key.startsWith(lower)) return fileKey;
    if (lower.length > 12 && lower.startsWith(key)) return fileKey;
  }

  return undefined;
}

/**
 * Preprocess markdown to convert `[Source: identifier, section]` citations
 * into clickable markdown links: `[§ label](#source:key)`.
 */
/** Strip markdown inline formatting (bold/italic markers, trailing backslashes). */
function stripInlineFormatting(s: string): string {
  return s.replace(/^\*+|\*+$/g, "").replace(/\\+$/, "").trim();
}

export function linkifyCitations(
  md: string,
  lookup: Map<string, string>
): string {
  return md.replace(CITE_RE, (match, inner: string) => {
    // Split by commas and categorize each field
    const parts = inner.split(",").map((p) => p.trim());
    let identifier = stripInlineFormatting(parts[0]);
    let section: string | undefined;
    let lineRangeSuffix = "";

    for (let i = 1; i < parts.length; i++) {
      const part = stripInlineFormatting(
        parts[i].replace(/^Section:\s*/i, "")
      );
      const lineMatch = part.match(/^L(\d+)(?:-(\d+))?$/);
      if (lineMatch) {
        lineRangeSuffix = `:${part}`;
      } else {
        section = part;
      }
    }

    const fileKey = resolveSource(identifier, lookup);
    if (!fileKey) return match; // unresolvable → leave as-is

    // Encode the full file key in the href so parseSourceHref can return it as-is
    const label = section || identifier;
    return `[§ ${label}](#source:${fileKey}${lineRangeSuffix})`;
  });
}

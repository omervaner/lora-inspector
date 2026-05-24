// Normalize kohya-ss `ss_tag_frequency` into a flat ranked list.
// Input shape: { folder: { tag: count } } — one entry per training subfolder.
// We sum counts across folders so the same tag in two folders stacks correctly.

export interface RankedTag {
  tag: string
  count: number
}

export function flattenTagFrequency(
  raw: Record<string, Record<string, number>> | undefined,
): RankedTag[] {
  if (!raw || typeof raw !== 'object') return []

  const totals: Record<string, number> = {}
  for (const folder of Object.values(raw)) {
    if (!folder || typeof folder !== 'object') continue
    for (const [tag, count] of Object.entries(folder)) {
      const n = typeof count === 'number' ? count : Number(count)
      if (!Number.isFinite(n)) continue
      totals[tag] = (totals[tag] ?? 0) + n
    }
  }

  return Object.entries(totals)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

// Map a count to a font-size step (1..6) using log scaling so a single dominant
// tag doesn't flatten everything else.
export function fontSizeBucket(count: number, max: number): number {
  if (max <= 0) return 1
  const ratio = Math.log1p(count) / Math.log1p(max)
  return Math.max(1, Math.min(6, Math.ceil(ratio * 6)))
}

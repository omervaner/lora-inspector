import type { TensorEntry } from './safetensors'

// Derive LoRA rank from tensor shapes. ai-toolkit (and many trainers) don't
// write rank into metadata, but every LoRA has `*lora_A.weight` tensors whose
// smaller dimension IS the rank by construction.
//
// Returns the most common rank across all `lora_A` tensors, plus how many
// distinct ranks were seen (>1 = mixed-rank LoRA, worth surfacing).
export interface RankStats {
  rank: number | null
  mixed: boolean
  perRankCounts: Record<number, number>
}

export function deriveRank(tensors: TensorEntry[]): RankStats {
  const counts: Record<number, number> = {}

  for (const t of tensors) {
    if (!/lora_a\.weight$/i.test(t.name)) continue
    if (!t.shape || t.shape.length === 0) continue
    const r = Math.min(...t.shape)
    counts[r] = (counts[r] ?? 0) + 1
  }

  const entries = Object.entries(counts)
  if (entries.length === 0) return { rank: null, mixed: false, perRankCounts: {} }

  entries.sort((a, b) => b[1] - a[1])
  return {
    rank: Number(entries[0][0]),
    mixed: entries.length > 1,
    perRankCounts: counts,
  }
}

// Tensor dtype breakdown — what mix of precisions are stored.
export function dtypeBreakdown(tensors: TensorEntry[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of tensors) {
    out[t.dtype] = (out[t.dtype] ?? 0) + 1
  }
  return out
}

// Heuristic use-case classifier based on rank + steps + epochs combo.
// Rules are Ömer's, derived empirically from 4 real Civitai LoRAs (2026-05-24).
// See memory/project_use_case_heuristics.md and ARCHITECTURE.md field findings.
// Returning null = no confident verdict; the caller must hide the line entirely
// (silence beats confident-wrong).
export interface UseCaseVerdict {
  verdict: string
}

export function classifyUseCase(
  rank: number | null | undefined,
  steps: number | undefined,
  epochs: number | undefined,
): UseCaseVerdict | null {
  if (rank == null || steps == null || epochs == null) return null
  if (rank <= 8 && steps <= 200) return { verdict: 'slider' }
  if (epochs >= 100 && rank <= 16) return { verdict: 'small-dataset style training' }
  if (rank >= 24 && steps >= 1000 && steps <= 6000) return { verdict: 'character / identity training' }
  if (rank >= 16 && steps >= 3000) return { verdict: 'style / concept training' }
  return null
}

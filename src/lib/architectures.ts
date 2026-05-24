// Architecture overlays for known model families.
// Detection runs against the universal TensorStructure (see ./tensor-analysis.ts).
// Critically, detection MUST NOT trust `ss_base_model_version` to distinguish
// variants — ai-toolkit reports both FLUX 2 Dev/Klein as "flux2" and (likely)
// both Qwen Image variants as "qwen_image". Hidden-dim is the disambiguator.

import type { TensorStructure } from './tensor-analysis'

export interface ComponentGroup {
  id: string
  label: string
  test: (leafPath: string) => boolean
}

export interface FamilyLabel {
  name: string // raw family name (matches BlockFamily.name)
  label: string // display label
}

export interface Architecture {
  id: string
  displayName: string
  // Render order for families — primary family listed first.
  families: FamilyLabel[]
  components: ComponentGroup[]
  // Detector keys on structure only.
  detect: (s: TensorStructure) => boolean
}

const FLUX2_COMPONENTS: ComponentGroup[] = [
  // Double-block components
  { id: 'img-attn-qkv', label: 'Image attention (QKV)', test: (p) => p === 'img_attn.qkv' },
  { id: 'img-attn-out', label: 'Image attention out', test: (p) => p === 'img_attn.proj' },
  { id: 'txt-attn-qkv', label: 'Text attention (QKV)', test: (p) => p === 'txt_attn.qkv' },
  { id: 'txt-attn-out', label: 'Text attention out', test: (p) => p === 'txt_attn.proj' },
  { id: 'img-mlp', label: 'Image MLP', test: (p) => /^img_mlp\.\d+$/.test(p) },
  { id: 'txt-mlp', label: 'Text MLP', test: (p) => /^txt_mlp\.\d+$/.test(p) },
  // Single-block components (the joined stream)
  { id: 'single-linear', label: 'Single-block linear', test: (p) => /^linear[12]$/.test(p) },
  // Norms / modulation if they appear
  { id: 'norm', label: 'Norm / modulation', test: (p) => p.includes('norm') || p.includes('modulation') },
]

const ARCHITECTURES: Architecture[] = [
  // ---- FLUX 2 Dev ----
  {
    id: 'flux2-dev',
    displayName: 'FLUX 2 Dev',
    families: [
      { name: 'double_blocks', label: 'double blocks' },
      { name: 'single_blocks', label: 'single blocks' },
    ],
    components: FLUX2_COMPONENTS,
    detect: (s) => s.families.has('double_blocks') && s.hiddenDim === 6144,
  },

  // ---- FLUX 2 Klein 9B ----
  {
    id: 'flux2-klein',
    displayName: 'FLUX 2 Klein 9B',
    families: [
      { name: 'double_blocks', label: 'double blocks' },
      { name: 'single_blocks', label: 'single blocks' },
    ],
    components: FLUX2_COMPONENTS,
    detect: (s) => s.families.has('double_blocks') && s.hiddenDim === 4096,
  },

  // ---- Qwen Image 2512 ----
  // MMDiT joint-stream — distinguished by add_q_proj component on transformer_blocks.
  {
    id: 'qwen-image-2512',
    displayName: 'Qwen Image 2512',
    families: [{ name: 'transformer_blocks', label: 'transformer blocks' }],
    components: [
      { id: 'img-attn-qkv', label: 'Image attention (Q/K/V)', test: (p) => /^attn\.to_[qkv]$/.test(p) },
      { id: 'img-attn-out', label: 'Image attention out', test: (p) => p === 'attn.to_out.0' },
      { id: 'txt-attn-qkv', label: 'Text-stream attention (Q/K/V)', test: (p) => /^attn\.add_[qkv]_proj$/.test(p) },
      { id: 'txt-attn-out', label: 'Text-stream attention out', test: (p) => p === 'attn.to_add_out' },
      { id: 'img-mlp', label: 'Image MLP', test: (p) => p.startsWith('img_mlp.') },
      { id: 'txt-mlp', label: 'Text MLP', test: (p) => p.startsWith('txt_mlp.') },
      { id: 'norm', label: 'Norm', test: (p) => p.includes('norm') },
    ],
    detect: (s) => {
      const fam = s.families.get('transformer_blocks')
      if (!fam || s.hiddenDim !== 3072) return false
      // Signature: add_q_proj only present in MMDiT joint-stream models.
      for (const p of fam.leafPaths) {
        if (p.includes('add_q_proj')) return true
      }
      return false
    },
  },

  // ---- Z-Image Turbo ----
  // LLaMA-style: `layers` family, SwiGLU MLP (w1/w2/w3), adaLN modulation.
  {
    id: 'z-image-turbo',
    displayName: 'Z-Image Turbo',
    families: [{ name: 'layers', label: 'layers' }],
    components: [
      { id: 'attn-qkv', label: 'Attention (Q/K/V)', test: (p) => /^attention\.to_[qkv]$/.test(p) },
      { id: 'attn-out', label: 'Attention out', test: (p) => p === 'attention.to_out.0' },
      { id: 'ff-gate', label: 'MLP gate (SwiGLU w1)', test: (p) => p === 'feed_forward.w1' },
      { id: 'ff-up', label: 'MLP up (SwiGLU w3)', test: (p) => p === 'feed_forward.w3' },
      { id: 'ff-down', label: 'MLP down (SwiGLU w2)', test: (p) => p === 'feed_forward.w2' },
      { id: 'adaln', label: 'adaLN modulation', test: (p) => p.startsWith('adaLN_modulation') },
    ],
    detect: (s) => {
      const fam = s.families.get('layers')
      if (!fam || s.hiddenDim !== 3840) return false
      for (const p of fam.leafPaths) {
        if (p.startsWith('feed_forward.w')) return true
      }
      return false
    },
  },
]

export function detectArchitecture(s: TensorStructure): Architecture | null {
  for (const arch of ARCHITECTURES) {
    if (arch.detect(s)) return arch
  }
  return null
}

// ---- Per-family component coverage --------------------------------------

export interface ComponentCoverage {
  id: string
  label: string
  blockCount: number // how many distinct blocks include this component
}

// For a given family, count how many of its blocks include each known component.
// Unrecognized leaf paths are bucketed under "Other".
export function coverageForFamily(
  s: TensorStructure,
  arch: Architecture,
  familyName: string,
): { groups: ComponentCoverage[]; otherLeafPaths: string[] } {
  // Walk modules belonging to this family. For each (component, blockIndex) pair, record presence.
  const groupBlocks: Map<string, Set<number>> = new Map()
  const unknownPaths = new Set<string>()

  for (const m of s.modules) {
    if (m.family !== familyName || m.blockIndex === undefined || !m.leafPath) continue
    let matched = false
    for (const g of arch.components) {
      if (g.test(m.leafPath)) {
        matched = true
        let set = groupBlocks.get(g.id)
        if (!set) {
          set = new Set()
          groupBlocks.set(g.id, set)
        }
        set.add(m.blockIndex)
      }
    }
    if (!matched) unknownPaths.add(m.leafPath)
  }

  const groups: ComponentCoverage[] = arch.components
    .map((g) => ({
      id: g.id,
      label: g.label,
      blockCount: groupBlocks.get(g.id)?.size ?? 0,
    }))
    .filter((g) => g.blockCount > 0)

  return { groups, otherLeafPaths: Array.from(unknownPaths) }
}

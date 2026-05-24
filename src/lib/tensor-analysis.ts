// Universal tensor structural analysis — architecture-agnostic.
// Parses LoRA tensor names into modules, groups them by block family,
// and extracts the structural facts that any arch overlay can label.

import type { TensorEntry } from './safetensors'

// Recognized LoRA weight suffixes. Standard kohya/diffusers convention is
// .lora_A.weight / .lora_B.weight (also .alpha for the scaling scalar).
// Older kohya scripts used .lora_down.weight / .lora_up.weight.
const LORA_SUFFIX_RE = /\.(lora_A|lora_B|lora_down|lora_up|alpha)(\.weight)?$/

export interface TensorModule {
  modulePath: string // e.g. "diffusion_model.double_blocks.0.img_attn.qkv"
  family?: string // e.g. "double_blocks"
  blockIndex?: number // e.g. 0
  leafPath?: string // e.g. "img_attn.qkv"
  rank?: number
  hasA: boolean
  hasB: boolean
  inputDim?: number // from lora_A.shape[1]
  outputDim?: number // from lora_B.shape[0]
}

export interface BlockFamily {
  name: string
  blockIndices: number[] // sorted ascending, unique
  leafPaths: Set<string>
  moduleCount: number
}

export interface TensorStructure {
  modules: TensorModule[]
  families: Map<string, BlockFamily>
  hiddenDim: number | null
  totalLoraParams: number
  topPrefix: string
  loraTensorCount: number
}

function parseModulePath(modulePath: string): {
  family?: string
  blockIndex?: number
  leafPath?: string
} {
  // Walk segments left-to-right; the first purely-numeric segment is the block index.
  // The segment immediately before it is the block family. Everything after is the leaf.
  const segments = modulePath.split('.')
  for (let i = 0; i < segments.length; i++) {
    if (/^\d+$/.test(segments[i])) {
      return {
        family: i > 0 ? segments[i - 1] : undefined,
        blockIndex: Number(segments[i]),
        leafPath: segments.slice(i + 1).join('.'),
      }
    }
  }
  return {}
}

export function analyzeTensors(tensors: TensorEntry[]): TensorStructure {
  const moduleMap = new Map<string, TensorModule>()
  let loraTensorCount = 0

  for (const t of tensors) {
    const m = t.name.match(LORA_SUFFIX_RE)
    if (!m || m.index === undefined) continue
    loraTensorCount++

    const modulePath = t.name.slice(0, m.index)
    const weightType = m[1]

    let mod = moduleMap.get(modulePath)
    if (!mod) {
      const parsed = parseModulePath(modulePath)
      mod = {
        modulePath,
        family: parsed.family,
        blockIndex: parsed.blockIndex,
        leafPath: parsed.leafPath,
        hasA: false,
        hasB: false,
      }
      moduleMap.set(modulePath, mod)
    }

    if (weightType === 'lora_A' || weightType === 'lora_down') {
      mod.hasA = true
      // lora_A shape = [rank, input_dim]
      if (t.shape.length >= 2) {
        mod.rank = mod.rank === undefined ? t.shape[0] : Math.min(mod.rank, t.shape[0])
        mod.inputDim = t.shape[1]
      }
    } else if (weightType === 'lora_B' || weightType === 'lora_up') {
      mod.hasB = true
      // lora_B shape = [output_dim, rank]
      if (t.shape.length >= 2) {
        mod.rank = mod.rank === undefined ? t.shape[1] : Math.min(mod.rank, t.shape[1])
        mod.outputDim = t.shape[0]
      }
    }
  }

  const modules = Array.from(moduleMap.values())

  // Top-level prefix = most common first segment of modulePath.
  const prefixCounts: Record<string, number> = {}
  for (const m of modules) {
    const dot = m.modulePath.indexOf('.')
    const prefix = dot === -1 ? '' : m.modulePath.slice(0, dot)
    prefixCounts[prefix] = (prefixCounts[prefix] ?? 0) + 1
  }
  const topPrefix =
    Object.entries(prefixCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

  // Group into block families.
  const families = new Map<string, BlockFamily>()
  for (const m of modules) {
    if (!m.family) continue
    let fam = families.get(m.family)
    if (!fam) {
      fam = {
        name: m.family,
        blockIndices: [],
        leafPaths: new Set(),
        moduleCount: 0,
      }
      families.set(m.family, fam)
    }
    if (m.leafPath) fam.leafPaths.add(m.leafPath)
    fam.moduleCount++
  }
  // Collect distinct block indices per family, sorted.
  const familyBlockSets = new Map<string, Set<number>>()
  for (const m of modules) {
    if (!m.family || m.blockIndex === undefined) continue
    let s = familyBlockSets.get(m.family)
    if (!s) {
      s = new Set()
      familyBlockSets.set(m.family, s)
    }
    s.add(m.blockIndex)
  }
  for (const [name, set] of familyBlockSets) {
    const fam = families.get(name)
    if (fam) fam.blockIndices = Array.from(set).sort((a, b) => a - b)
  }

  // Hidden dim = mode of inputDim across modules.
  const dimCounts: Record<number, number> = {}
  for (const m of modules) {
    if (m.inputDim !== undefined) {
      dimCounts[m.inputDim] = (dimCounts[m.inputDim] ?? 0) + 1
    }
  }
  const hiddenDimEntry = Object.entries(dimCounts).sort((a, b) => b[1] - a[1])[0]
  const hiddenDim = hiddenDimEntry ? Number(hiddenDimEntry[0]) : null

  // Total LoRA params = sum of shape products across all LoRA tensors.
  let totalLoraParams = 0
  for (const t of tensors) {
    if (!LORA_SUFFIX_RE.test(t.name)) continue
    if (t.shape.length === 0) continue
    totalLoraParams += t.shape.reduce((a, b) => a * b, 1)
  }

  return {
    modules,
    families,
    hiddenDim,
    totalLoraParams,
    topPrefix,
    loraTensorCount,
  }
}

// Tiny helper for the UI: format a param count human-friendly.
export function formatParams(n: number): string {
  if (n < 1_000) return n.toString()
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  return `${(n / 1_000_000_000).toFixed(2)}B`
}

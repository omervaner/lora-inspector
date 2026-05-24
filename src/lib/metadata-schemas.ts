// Single source of truth for metadata key→display mappings.
// Primary convention: ai-toolkit (ostris). Secondary: kohya-ss.
// Also: modelspec.*, OneTrainer. Unknown keys go to the Raw section, never hidden.

import type { ParsedLora, TensorEntry } from './safetensors'
import { deriveRank, type RankStats } from './lora-stats'

export type Convention = 'ai-toolkit' | 'kohya-ss' | 'modelspec' | 'onetrainer' | 'unknown'

export interface SoftwareInfo {
  name: string
  version?: string
  repo?: string
}

export interface TrainingProgress {
  steps?: number
  epochs?: number
}

export interface NormalizedLora {
  fileName: string
  fileSize: number
  convention: Convention

  // Identity
  name?: string
  version?: string
  software?: SoftwareInfo
  baseModel?: string // pretty label
  baseModelRaw?: string // original value
  outputName?: string
  format?: string

  // Training
  progress?: TrainingProgress
  learningRate?: string
  unetLR?: string
  textEncoderLR?: string
  optimizer?: string
  scheduler?: string
  seed?: string
  mixedPrecision?: string
  clipSkip?: string
  trainingComment?: string

  // Dataset
  numImages?: number
  resolution?: string
  tagFrequency?: Record<string, Record<string, number>>
  datasetDirs?: unknown

  // Derived from tensors
  rank?: RankStats
  tensorCount: number
  dtypeBreakdown: Record<string, number>
  tensors: TensorEntry[] // full tensor index, preserved for analysis + UI peek

  // Hashes
  modelHash?: string
  legacyHash?: string

  // The full decoded metadata for the Raw section (JSON-strings already parsed)
  decodedMetadata: Record<string, unknown>

  // Anything we didn't have a schema rule for — preserved for the Raw view
  unknownKeys: string[]
}

// ----- Convention detection ---------------------------------------------------

export function detectConvention(metadata: Record<string, string>): Convention {
  // ai-toolkit always writes a `software` JSON blob with name="ai-toolkit"
  const sw = metadata.software
  if (sw && typeof sw === 'string') {
    try {
      const parsed = JSON.parse(sw) as { name?: string }
      if (parsed?.name === 'ai-toolkit') return 'ai-toolkit'
    } catch {
      // fall through
    }
  }
  if (metadata.training_info && metadata.format) return 'ai-toolkit'

  const keys = Object.keys(metadata)
  if (keys.some((k) => k.startsWith('ss_') && k !== 'ss_base_model_version' && k !== 'ss_output_name')) {
    return 'kohya-ss'
  }
  if (keys.some((k) => k.startsWith('modelspec.'))) return 'modelspec'
  if (keys.some((k) => k.startsWith('ot_'))) return 'onetrainer'
  return 'unknown'
}

// ----- JSON-in-string auto-decode --------------------------------------------

// Opportunistically parse strings that look like JSON objects/arrays.
// Leaves everything else as-is.
export function decodeJsonStrings(metadata: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(metadata)) {
    out[k] = tryDecode(v)
  }
  return out
}

function tryDecode(value: string): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value
  const first = trimmed[0]
  if (first !== '{' && first !== '[') return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

// ----- Base model pretty label ------------------------------------------------

const BASE_MODEL_LABELS: Record<string, string> = {
  flux2: 'FLUX 2',
  'flux.1-dev': 'FLUX.1 [dev]',
  'flux.1-schnell': 'FLUX.1 [schnell]',
  sdxl: 'SDXL 1.0',
  'sdxl 1.0': 'SDXL 1.0',
  sd1: 'SD 1.5',
  sd15: 'SD 1.5',
  'sd 1.5': 'SD 1.5',
  sd2: 'SD 2.x',
  'sd 2.x': 'SD 2.x',
  sd3: 'SD 3',
  qwen_image: 'Qwen Image',
  'qwen-image': 'Qwen Image',
  'qwen image': 'Qwen Image',
  wan: 'Wan 2.x',
  hidream: 'HiDream',
}

export function prettyBaseModel(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  return BASE_MODEL_LABELS[raw.trim().toLowerCase()] ?? raw
}

// ----- Number / value formatters ---------------------------------------------

export function formatInt(value: unknown): string | undefined {
  const n = toNumber(value)
  if (n === undefined) return undefined
  return n.toLocaleString('en-US')
}

export function formatLR(value: unknown): string | undefined {
  const n = toNumber(value)
  if (n === undefined) return undefined
  if (n === 0) return '0'
  // Scientific for very small / very large, else fixed
  if (Math.abs(n) < 0.001 || Math.abs(n) > 9999) {
    return n.toExponential(2).replace('e', 'e').replace('+0', '+').replace('-0', '-')
  }
  return n.toString()
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return typeof value === 'string' ? value : String(value)
}

// ----- Main normalization -----------------------------------------------------

export function normalize(parsed: ParsedLora): NormalizedLora {
  const decoded = decodeJsonStrings(parsed.metadata)
  const convention = detectConvention(parsed.metadata)
  const rank = deriveRank(parsed.tensors)
  const dtype = breakdownDtypes(parsed.tensors)

  // Identity (convention-aware)
  const software = extractSoftware(decoded)
  const name =
    asString(decoded.name) ??
    asString(decoded.ss_output_name) ??
    asString(decoded['modelspec.title'])

  const baseModelRaw =
    asString(decoded.ss_base_model_version) ??
    asString(decoded['modelspec.architecture']) ??
    asString(decoded.base_model)
  const baseModel = prettyBaseModel(baseModelRaw)

  // Training progress
  const progress = extractProgress(decoded)

  // Known keys (anything we touch goes here so we can compute "unknownKeys")
  const known = new Set<string>([
    'software',
    'name',
    'version',
    'format',
    'training_info',
    'sshs_model_hash',
    'sshs_legacy_hash',
    'ss_base_model_version',
    'ss_output_name',
    'ss_network_dim',
    'ss_network_alpha',
    'ss_sd_model_name',
    'ss_learning_rate',
    'ss_unet_lr',
    'ss_text_encoder_lr',
    'ss_max_train_steps',
    'ss_num_epochs',
    'ss_num_train_images',
    'ss_resolution',
    'ss_optimizer',
    'ss_lr_scheduler',
    'ss_seed',
    'ss_clip_skip',
    'ss_mixed_precision',
    'ss_training_comment',
    'ss_tag_frequency',
    'ss_dataset_dirs',
  ])

  const unknownKeys = Object.keys(decoded).filter((k) => !known.has(k))

  return {
    fileName: parsed.fileName,
    fileSize: parsed.fileSize,
    convention,

    name,
    version: asString(decoded.version),
    software,
    baseModel,
    baseModelRaw,
    outputName: asString(decoded.ss_output_name),
    format: asString(decoded.format),

    progress,
    learningRate: formatLR(decoded.ss_learning_rate),
    unetLR: formatLR(decoded.ss_unet_lr),
    textEncoderLR: formatLR(decoded.ss_text_encoder_lr),
    optimizer: asString(decoded.ss_optimizer),
    scheduler: asString(decoded.ss_lr_scheduler),
    seed: asString(decoded.ss_seed),
    mixedPrecision: asString(decoded.ss_mixed_precision),
    clipSkip: asString(decoded.ss_clip_skip),
    trainingComment: asString(decoded.ss_training_comment),

    numImages: toNumber(decoded.ss_num_train_images),
    resolution: asString(decoded.ss_resolution),
    tagFrequency: decoded.ss_tag_frequency as Record<string, Record<string, number>> | undefined,
    datasetDirs: decoded.ss_dataset_dirs,

    rank,
    tensorCount: parsed.tensors.length,
    dtypeBreakdown: dtype,
    tensors: parsed.tensors,

    modelHash: asString(decoded.sshs_model_hash),
    legacyHash: asString(decoded.sshs_legacy_hash),

    decodedMetadata: decoded,
    unknownKeys,
  }
}

function extractSoftware(decoded: Record<string, unknown>): SoftwareInfo | undefined {
  const sw = decoded.software
  if (sw && typeof sw === 'object' && !Array.isArray(sw)) {
    const obj = sw as Record<string, unknown>
    const name = asString(obj.name)
    if (!name) return undefined
    return { name, version: asString(obj.version), repo: asString(obj.repo) }
  }
  if (typeof sw === 'string') return { name: sw }
  return undefined
}

function extractProgress(decoded: Record<string, unknown>): TrainingProgress | undefined {
  // ai-toolkit nests inside training_info
  const ti = decoded.training_info
  if (ti && typeof ti === 'object' && !Array.isArray(ti)) {
    const o = ti as Record<string, unknown>
    const steps = toNumber(o.step) ?? toNumber(o.steps)
    const epochs = toNumber(o.epoch) ?? toNumber(o.epochs)
    if (steps !== undefined || epochs !== undefined) return { steps, epochs }
  }
  // kohya-ss flat keys
  const ks = toNumber(decoded.ss_max_train_steps)
  const ke = toNumber(decoded.ss_num_epochs)
  if (ks !== undefined || ke !== undefined) return { steps: ks, epochs: ke }
  return undefined
}

function breakdownDtypes(tensors: { dtype: string }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of tensors) out[t.dtype] = (out[t.dtype] ?? 0) + 1
  return out
}

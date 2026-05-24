// Safetensors file layout:
//   [ 8 bytes: little-endian uint64 = header length N ]
//   [ N bytes: UTF-8 JSON header ]
//   [ tensor data — ignored ]
//
// We read only the first (8 + N) bytes via File.slice — never touch the tensor payload.

export interface TensorEntry {
  name: string
  dtype: string
  shape: number[]
}

export interface ParsedLora {
  metadata: Record<string, string>
  tensors: TensorEntry[]
  fileSize: number
  fileName: string
  headerLength: number
}

const MAX_HEADER_BYTES = 100 * 1024 * 1024 // 100 MB sanity cap

export async function parseLoraMetadata(file: File): Promise<ParsedLora> {
  if (file.size < 8) {
    throw new Error('File too small to be a safetensors file (under 8 bytes).')
  }

  const lengthBytes = await file.slice(0, 8).arrayBuffer()
  const headerLengthBig = new DataView(lengthBytes).getBigUint64(0, true)

  if (headerLengthBig > BigInt(MAX_HEADER_BYTES)) {
    throw new Error(
      `Header length ${headerLengthBig} exceeds sanity cap (${MAX_HEADER_BYTES}). File may be corrupt or not a safetensors file.`,
    )
  }
  const headerLength = Number(headerLengthBig)

  if (8 + headerLength > file.size) {
    throw new Error(
      `Declared header length (${headerLength}) exceeds file size (${file.size}). File may be truncated.`,
    )
  }

  const headerText = await file.slice(8, 8 + headerLength).text()

  let parsed: unknown
  try {
    parsed = JSON.parse(headerText)
  } catch (err) {
    throw new Error(
      `Header is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Header JSON did not decode to an object.')
  }

  const headerObj = parsed as Record<string, unknown>
  const rawMetadata = headerObj.__metadata__
  const metadata: Record<string, string> = {}

  if (rawMetadata && typeof rawMetadata === 'object') {
    for (const [k, v] of Object.entries(rawMetadata as Record<string, unknown>)) {
      // kohya-ss serializes everything as strings; coerce defensively.
      metadata[k] = typeof v === 'string' ? v : JSON.stringify(v)
    }
  }

  const tensors: TensorEntry[] = []
  for (const [name, entry] of Object.entries(headerObj)) {
    if (name === '__metadata__') continue
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const dtype = typeof e.dtype === 'string' ? e.dtype : 'unknown'
    const shape = Array.isArray(e.shape) ? (e.shape as number[]) : []
    tensors.push({ name, dtype, shape })
  }

  return {
    metadata,
    tensors,
    fileSize: file.size,
    fileName: file.name,
    headerLength,
  }
}

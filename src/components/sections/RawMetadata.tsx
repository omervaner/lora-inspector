import { useState } from 'react'
import type { TensorEntry } from '../../lib/safetensors'
import { Card, CardBody, CardHeader, CardTitle } from '../ui/Card'

interface Props {
  decoded: Record<string, unknown>
  unknownKeys: string[]
  tensors: TensorEntry[]
}

const TENSOR_PEEK_DEFAULT = 30

export function RawMetadata({ decoded, unknownKeys, tensors }: Props) {
  const [openMeta, setOpenMeta] = useState(false)
  const [openTensors, setOpenTensors] = useState(false)
  const [showAllTensors, setShowAllTensors] = useState(false)

  const keyCount = Object.keys(decoded).length
  const shownTensors = showAllTensors ? tensors : tensors.slice(0, TENSOR_PEEK_DEFAULT)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Raw metadata</CardTitle>
          <button
            onClick={() => setOpenMeta((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            <span className="font-mono tabular">
              {keyCount} keys
              {unknownKeys.length > 0 && (
                <span className="text-[var(--color-dim)]"> · {unknownKeys.length} unmapped</span>
              )}
            </span>
            <Chevron open={openMeta} />
          </button>
        </CardHeader>
        {openMeta && (
          <CardBody>
            <pre className="font-mono text-xs leading-relaxed text-[var(--color-text)] max-h-[600px] overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(decoded, null, 2)}
            </pre>
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tensor index</CardTitle>
          <button
            onClick={() => setOpenTensors((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            <span className="font-mono tabular">{tensors.length.toLocaleString()} tensors</span>
            <Chevron open={openTensors} />
          </button>
        </CardHeader>
        {openTensors && (
          <CardBody>
            <div className="font-mono text-xs leading-relaxed max-h-[600px] overflow-auto">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-dim)]">
                  name
                </div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-dim)]">
                  dtype
                </div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-dim)]">
                  shape
                </div>
                {shownTensors.map((t) => (
                  <TensorRow key={t.name} tensor={t} />
                ))}
              </div>
              {tensors.length > TENSOR_PEEK_DEFAULT && (
                <button
                  onClick={() => setShowAllTensors((v) => !v)}
                  className="mt-4 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
                >
                  {showAllTensors
                    ? `show first ${TENSOR_PEEK_DEFAULT}`
                    : `show all ${tensors.length.toLocaleString()}`}
                </button>
              )}
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  )
}

function TensorRow({ tensor }: { tensor: TensorEntry }) {
  return (
    <>
      <div className="text-[var(--color-text)] break-all">{tensor.name}</div>
      <div className="text-[var(--color-muted)]">{tensor.dtype}</div>
      <div className="text-[var(--color-muted)] tabular whitespace-nowrap">
        [{tensor.shape.join(', ')}]
      </div>
    </>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={['size-4 transition-transform', open ? 'rotate-180' : ''].join(' ')}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

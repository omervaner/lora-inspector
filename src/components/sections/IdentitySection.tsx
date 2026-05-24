import { useState } from 'react'
import type { NormalizedLora } from '../../lib/metadata-schemas'
import { formatFileSize } from '../../lib/metadata-schemas'
import { Card, CardBody } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Stat } from '../ui/Stat'

interface Props {
  lora: NormalizedLora
  archDisplayName?: string
}

export function IdentitySection({ lora, archDisplayName }: Props) {
  const displayName = lora.name ?? lora.outputName ?? lora.fileName.replace(/\.safetensors$/i, '')

  return (
    <Card>
      <CardBody className="space-y-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)] break-all">
              {displayName}
            </h1>
            <div className="text-xs font-mono text-[var(--color-dim)] truncate">
              {lora.fileName}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {(archDisplayName ?? lora.baseModel) && (
              <Badge variant="accent">{archDisplayName ?? lora.baseModel}</Badge>
            )}
            {lora.software ? (
              <SoftwareBadge name={lora.software.name} version={lora.software.version} repo={lora.software.repo} />
            ) : (
              <ConventionBadge convention={lora.convention} />
            )}
          </div>
        </div>

        {/* Headline numerics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 pt-2 border-t border-[var(--color-border)]">
          <Stat
            label="Rank"
            accent
            value={
              lora.rank?.rank !== null && lora.rank?.rank !== undefined ? (
                <span>
                  {lora.rank.rank}
                  {lora.rank.mixed && (
                    <span
                      className="ml-1.5 text-[10px] text-[var(--color-muted)] uppercase"
                      title={`Mixed-rank LoRA: ${Object.entries(lora.rank.perRankCounts)
                        .map(([r, n]) => `${r}×${n}`)
                        .join(', ')}`}
                    >
                      mixed
                    </span>
                  )}
                </span>
              ) : undefined
            }
            title="Derived from the inner dimension of *lora_A.weight tensors"
          />
          <Stat label="Steps" accent value={lora.progress?.steps?.toLocaleString('en-US')} />
          <Stat label="Epochs" accent value={lora.progress?.epochs?.toLocaleString('en-US')} />
          <Stat label="Tensors" value={lora.tensorCount.toLocaleString('en-US')} />

          <Stat label="File size" value={formatFileSize(lora.fileSize)} />
          <Stat label="Format" value={lora.format} />
          <Stat
            label="Precision"
            value={
              Object.keys(lora.dtypeBreakdown).length > 0
                ? Object.entries(lora.dtypeBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([dt]) => dt)
                    .join(' / ')
                : undefined
            }
          />
          <HashStat legacyHash={lora.legacyHash} modelHash={lora.modelHash} />
        </div>
      </CardBody>
    </Card>
  )
}

function SoftwareBadge({
  name,
  version,
  repo,
}: {
  name: string
  version?: string
  repo?: string
}) {
  const label = version ? `${name} v${version}` : name
  if (repo) {
    return (
      <a
        href={repo}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
      >
        {label}
        <ExternalIcon className="size-3" />
      </a>
    )
  }
  return <Badge>{label}</Badge>
}

function ConventionBadge({ convention }: { convention: NormalizedLora['convention'] }) {
  if (convention === 'unknown') {
    return <Badge variant="outline">no recognized schema</Badge>
  }
  return <Badge variant="outline">{convention}</Badge>
}

function HashStat({ legacyHash, modelHash }: { legacyHash?: string; modelHash?: string }) {
  const short = legacyHash ?? modelHash?.slice(0, 10)
  const full = modelHash ?? legacyHash
  const [copied, setCopied] = useState(false)

  if (!short) {
    return <Stat label="Content hash" value={undefined} />
  }

  async function copy() {
    if (!full) return
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard may be unavailable in non-secure contexts; ignore
    }
  }

  const tooltip = `Content hash of the LoRA tensors — same algorithm used by Civitai etc. for matching files across systems.${full ? `\n\nFull: ${full}\n(click to copy)` : ''}`

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-dim)] flex items-center gap-1.5">
        Content hash
        <InfoIcon className="size-3 text-[var(--color-dim)]" />
      </div>
      <button
        type="button"
        onClick={copy}
        title={tooltip}
        className="text-left font-mono tabular text-base text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
      >
        {copied ? <span className="text-[var(--color-accent)]">copied</span> : short}
      </button>
    </div>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

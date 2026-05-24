import type { NormalizedLora } from '../../lib/metadata-schemas'
import {
  analyzeTensors,
  formatParams,
  type TensorStructure,
  type BlockFamily,
} from '../../lib/tensor-analysis'
import {
  detectArchitecture,
  coverageForFamily,
  type Architecture,
} from '../../lib/architectures'
import { classifyUseCase } from '../../lib/lora-stats'
import { Card, CardBody, CardHeader, CardTitle } from '../ui/Card'

interface Props {
  lora: NormalizedLora
}

export function TensorAnalysis({ lora }: Props) {
  const structure = analyzeTensors(lora.tensors)
  if (structure.loraTensorCount === 0) return null

  const arch = detectArchitecture(structure)
  const useCase = classifyUseCase(lora.rank?.rank, lora.progress?.steps, lora.progress?.epochs)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tensor analysis</CardTitle>
        <div className="text-xs font-mono tabular text-[var(--color-muted)]">
          {arch ? arch.displayName : 'unknown architecture'}
          {' · '}
          <span className="text-[var(--color-accent)]">
            {formatParams(structure.totalLoraParams)}
          </span>{' '}
          params
          {structure.hiddenDim !== null && (
            <span className="text-[var(--color-dim)]"> · dim {structure.hiddenDim}</span>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        {useCase && <QuickRead verdict={useCase.verdict} />}
        {arch ? (
          <KnownArchView structure={structure} arch={arch} />
        ) : (
          <UnknownArchView structure={structure} />
        )}
      </CardBody>
    </Card>
  )
}

function QuickRead({ verdict }: { verdict: string }) {
  return (
    <div className="flex items-baseline gap-3 pb-4 border-b border-[var(--color-border)]">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-dim)] shrink-0">
        Quick read
      </div>
      <div className="text-base text-[var(--color-muted)]">
        Looks like a <span className="text-[var(--color-accent)] font-medium">{verdict}</span>.
      </div>
    </div>
  )
}

function KnownArchView({
  structure,
  arch,
}: {
  structure: TensorStructure
  arch: Architecture
}) {
  return (
    <>
      {arch.families.map((famLabel) => {
        const fam = structure.families.get(famLabel.name)
        if (!fam || fam.blockIndices.length === 0) return null
        const { groups, otherLeafPaths } = coverageForFamily(structure, arch, famLabel.name)
        return (
          <FamilySection
            key={famLabel.name}
            label={famLabel.label}
            family={fam}
            componentGroups={groups}
            unknownLeafPaths={otherLeafPaths}
          />
        )
      })}
    </>
  )
}

function FamilySection({
  label,
  family,
  componentGroups,
  unknownLeafPaths,
}: {
  label: string
  family: BlockFamily
  componentGroups: ReturnType<typeof coverageForFamily>['groups']
  unknownLeafPaths: string[]
}) {
  // Block range: assume max blockIndex+1 is the total count. (For full coverage this
  // matches the actual architecture; for partial coverage it's the highest touched +1,
  // which is the most we can know from the LoRA alone.)
  const blockSet = new Set(family.blockIndices)
  const minIdx = family.blockIndices[0]
  const maxIdx = family.blockIndices[family.blockIndices.length - 1]
  const probableTotal = maxIdx + 1
  const isContiguous = family.blockIndices.length === probableTotal && minIdx === 0
  const coveredCount = family.blockIndices.length

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
          {label}
        </div>
        <div className="text-xs font-mono tabular">
          {isContiguous ? (
            <span className="text-[var(--color-muted)]">{coveredCount} blocks</span>
          ) : (
            <>
              <span className="text-[var(--color-accent)]">{coveredCount}</span>
              <span className="text-[var(--color-muted)]">
                {' '}of {probableTotal}+ blocks · partial
              </span>
            </>
          )}
        </div>
      </div>

      {/* Block coverage strip */}
      <BlockStrip total={probableTotal} covered={blockSet} />

      {/* Component breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
        {componentGroups.map((g) => (
          <ComponentRow
            key={g.id}
            label={g.label}
            blockCount={g.blockCount}
            totalBlocks={probableTotal}
          />
        ))}
      </div>

      {unknownLeafPaths.length > 0 && (
        <div className="text-[10px] font-mono text-[var(--color-dim)]">
          unmapped components: {unknownLeafPaths.slice(0, 4).join(', ')}
          {unknownLeafPaths.length > 4 && ` (+${unknownLeafPaths.length - 4})`}
        </div>
      )}
    </div>
  )
}

function BlockStrip({ total, covered }: { total: number; covered: Set<number> }) {
  // Fixed-width squares wrapped — visually shows coverage pattern at a glance.
  const cells = []
  for (let i = 0; i < total; i++) {
    const on = covered.has(i)
    cells.push(
      <span
        key={i}
        title={`block ${i}${on ? '' : ' — not modified'}`}
        className={[
          'inline-block size-3 rounded-[3px]',
          on ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]',
        ].join(' ')}
      />,
    )
  }
  return <div className="flex flex-wrap gap-1">{cells}</div>
}

function ComponentRow({
  label,
  blockCount,
  totalBlocks,
}: {
  label: string
  blockCount: number
  totalBlocks: number
}) {
  const isFull = blockCount === totalBlocks
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <div className="text-[var(--color-text)]">{label}</div>
      <div className="font-mono tabular text-xs">
        {isFull ? (
          <span className="text-[var(--color-muted)]">all</span>
        ) : (
          <>
            <span className="text-[var(--color-accent)]">{blockCount}</span>
            <span className="text-[var(--color-dim)]"> / {totalBlocks}</span>
          </>
        )}
      </div>
    </div>
  )
}

function UnknownArchView({ structure }: { structure: TensorStructure }) {
  // Fallback view: list families with raw block counts + the distinct leaf paths.
  if (structure.families.size === 0) {
    return (
      <div className="text-sm text-[var(--color-muted)]">
        No block structure detected. Top-level prefix:{' '}
        <code className="font-mono text-[var(--color-text)]">{structure.topPrefix || '∅'}</code>.
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="text-xs text-[var(--color-muted)]">
        Unknown architecture — showing raw structure. Add an overlay to{' '}
        <code className="font-mono">src/lib/architectures.ts</code> once we confirm naming.
      </div>
      {Array.from(structure.families.entries()).map(([name, fam]) => (
        <div key={name} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
              {name}
            </div>
            <div className="font-mono tabular text-xs text-[var(--color-muted)]">
              <span className="text-[var(--color-accent)]">{fam.blockIndices.length}</span> blocks ·{' '}
              {fam.leafPaths.size} components
            </div>
          </div>
          <div className="text-[11px] font-mono text-[var(--color-dim)] break-all">
            {Array.from(fam.leafPaths).sort().slice(0, 12).join(' · ')}
            {fam.leafPaths.size > 12 && ` (+${fam.leafPaths.size - 12})`}
          </div>
        </div>
      ))}
    </div>
  )
}

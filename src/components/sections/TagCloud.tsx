import { useMemo, useState } from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '../ui/Card'
import { flattenTagFrequency, fontSizeBucket } from '../../lib/tag-frequency'

interface Props {
  tagFrequency: Record<string, Record<string, number>> | undefined
}

const DEFAULT_TOP = 50

// Font-size class per bucket (1..6). Increasing but not explosive.
const SIZE_CLASSES = [
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'text-xl',
  'text-2xl',
]

export function TagCloud({ tagFrequency }: Props) {
  const all = useMemo(() => flattenTagFrequency(tagFrequency), [tagFrequency])
  const [showAll, setShowAll] = useState(false)

  // Hide entirely when there's no tag data (most ai-toolkit LoRAs).
  if (all.length === 0) return null

  const shown = showAll ? all : all.slice(0, DEFAULT_TOP)
  const max = all[0]?.count ?? 0
  const totalUses = all.reduce((sum, t) => sum + t.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag cloud</CardTitle>
        <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] font-mono tabular">
          <span>
            {all.length.toLocaleString()} tags · {totalUses.toLocaleString()} uses
          </span>
          {all.length > DEFAULT_TOP && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              {showAll ? `show top ${DEFAULT_TOP}` : `show all ${all.length}`}
            </button>
          )}
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 leading-relaxed">
          {shown.map(({ tag, count }, i) => {
            const bucket = fontSizeBucket(count, max)
            const isTop = i === 0
            return (
              <span
                key={tag}
                title={`${tag} — used ${count.toLocaleString()} time${count === 1 ? '' : 's'}`}
                className={[
                  SIZE_CLASSES[bucket - 1],
                  isTop ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]',
                  'hover:text-[var(--color-accent)] transition-colors cursor-default',
                  'font-medium',
                ].join(' ')}
              >
                {tag}
                <span className="ml-1 text-[10px] text-[var(--color-dim)] font-mono tabular">
                  {count}
                </span>
              </span>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}

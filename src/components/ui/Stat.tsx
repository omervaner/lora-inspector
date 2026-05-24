import type { ReactNode } from 'react'

interface Props {
  label: string
  value: ReactNode
  accent?: boolean
  mono?: boolean
  title?: string
}

// One key-value cell. Yellow accent reserved for the headline numerics (rank, steps, LR).
export function Stat({ label, value, accent = false, mono = true, title }: Props) {
  return (
    <div className="flex flex-col gap-1" title={title}>
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-dim)]">
        {label}
      </div>
      <div
        className={[
          'text-base leading-snug tabular',
          mono ? 'font-mono' : 'font-medium',
          accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]',
        ].join(' ')}
      >
        {value === undefined || value === null || value === '' ? (
          <span className="text-[var(--color-dim)]">—</span>
        ) : (
          value
        )}
      </div>
    </div>
  )
}

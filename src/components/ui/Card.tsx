// Minimal card primitive — explicit Tailwind, no shadcn dep yet.
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={[
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]',
        'shadow-[0_1px_0_rgba(255,255,255,0.02)_inset]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: CardProps) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-3 px-5 py-3.5',
        'border-b border-[var(--color-border)]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: CardProps) {
  return (
    <h2
      className={[
        'text-[11px] font-semibold uppercase tracking-[0.16em]',
        'text-[var(--color-muted)]',
        className,
      ].join(' ')}
    >
      {children}
    </h2>
  )
}

export function CardBody({ children, className = '' }: CardProps) {
  return <div className={['p-5', className].join(' ')}>{children}</div>
}

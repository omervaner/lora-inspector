import type { ReactNode } from 'react'

type Variant = 'default' | 'accent' | 'outline'

interface Props {
  children: ReactNode
  variant?: Variant
  mono?: boolean
  className?: string
  title?: string
}

export function Badge({ children, variant = 'default', mono = false, className = '', title }: Props) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md whitespace-nowrap'
  const variants: Record<Variant, string> = {
    default:
      'bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)]',
    accent:
      'bg-[rgba(250,204,21,0.08)] text-[var(--color-accent)] border border-[rgba(250,204,21,0.25)]',
    outline:
      'bg-transparent text-[var(--color-muted)] border border-[var(--color-border)]',
  }
  return (
    <span
      title={title}
      className={[base, variants[variant], mono ? 'font-mono' : 'font-medium', className].join(' ')}
    >
      {children}
    </span>
  )
}

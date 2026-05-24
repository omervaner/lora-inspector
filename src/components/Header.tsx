interface Props {
  onReset?: () => void
  showReset?: boolean
}

export function Header({}: Props) {
  return (
    <header className="w-full">
      <div className="max-w-5xl mx-auto px-6 pt-8 pb-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Logo />
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">LoRA Inspector</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-dim)]">
              client-side · zero upload
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function Logo() {
  // Inspection-tape square in yellow + black. Small but distinctive.
  return (
    <div
      aria-hidden
      className="size-8 rounded-md tape-stripes border border-[var(--color-border-strong)] shrink-0"
    />
  )
}

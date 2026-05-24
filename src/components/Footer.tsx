const PROJECTS = [
  { name: 'Lookout', tagline: "a SQL IDE that doesn't suck", href: 'https://github.com/omervaner/SqlVersionControl' },
  { name: 'MediaHive', tagline: 'visual media browser', href: 'https://github.com/omervaner/MediaHive' },
]

export function Footer() {
  return (
    <footer className="w-full mt-16 border-t border-[var(--color-border)]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-dim)] mb-4">
          made by Ömer Vaner · other projects
        </div>
        <ul className="space-y-2">
          {PROJECTS.map((p) => (
            <li key={p.name}>
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-baseline gap-3 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <span className="text-[var(--color-accent)] group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
                <span className="font-medium text-[var(--color-text)]">{p.name}</span>
                <span className="text-[var(--color-muted)]">— {p.tagline}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}

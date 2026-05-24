import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  compact?: boolean
  loading?: boolean
}

export function Dropzone({ onFile, compact = false, loading = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  if (compact) {
    return (
      <button
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-accent)] border border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-md transition-colors"
      >
        <UploadIcon className="size-4" />
        Inspect another
        <input
          ref={inputRef}
          type="file"
          accept=".safetensors"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
      </button>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={[
        'relative flex flex-col items-center justify-center',
        'w-full max-w-3xl mx-auto',
        'min-h-[440px] px-8 py-16',
        'rounded-xl cursor-pointer select-none',
        'transition-all duration-200',
        'bg-[var(--color-surface)]',
        dragOver
          ? 'border-2 border-solid border-[var(--color-accent)] shadow-[0_0_0_8px_rgba(250,204,21,0.08)]'
          : 'border-2 border-dashed border-[var(--color-border-strong)] hover:border-[var(--color-accent-dim)]',
      ].join(' ')}
    >
      {/* Inspection-tape header strip — purely decorative */}
      <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-xl tape-stripes opacity-60" />

      <div
        className={[
          'flex flex-col items-center text-center gap-5',
          loading ? 'opacity-50' : '',
        ].join(' ')}
      >
        <div
          className={[
            'flex items-center justify-center size-20 rounded-full',
            'bg-[var(--color-bg)] border',
            dragOver ? 'border-[var(--color-accent)]' : 'border-[var(--color-border-strong)]',
            'transition-colors',
          ].join(' ')}
        >
          {loading ? (
            <Spinner />
          ) : (
            <UploadIcon className="size-9 text-[var(--color-accent)]" />
          )}
        </div>

        <div className="space-y-2">
          <div className="text-2xl font-semibold tracking-tight">
            {loading ? 'Inspecting' : dragOver ? 'Release to inspect' : 'Drop a .safetensors file'}
          </div>
          <div className="text-sm text-[var(--color-muted)] max-w-md">
            Header is parsed in your browser — the file never leaves this page. Tensor data is skipped entirely.
          </div>
        </div>

        {!loading && (
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[var(--color-dim)]">
            <span>or</span>
            <span className="text-[var(--color-muted)]">click to select</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".safetensors"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-9 text-[var(--color-accent)] animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  )
}

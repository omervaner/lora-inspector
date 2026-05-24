import { useState } from 'react'
import { parseLoraMetadata } from './lib/safetensors'
import { normalize, type NormalizedLora } from './lib/metadata-schemas'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { Dropzone } from './components/Dropzone'
import { LoraCard } from './components/LoraCard'

export default function App() {
  const [lora, setLora] = useState<NormalizedLora | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    setLoading(true)
    try {
      const parsed = await parseLoraMetadata(file)
      setLora(normalize(parsed))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLora(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 w-full px-6 pb-16">
        {!lora ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Dropzone onFile={handleFile} loading={loading} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
              <div className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--color-dim)]">
                inspection report
              </div>
              <Dropzone onFile={handleFile} compact loading={loading} />
            </div>
            <LoraCard lora={lora} />
          </div>
        )}

        {error && (
          <div className="max-w-3xl mx-auto mt-6 px-4 py-3 rounded-md border border-red-900/60 bg-red-950/40 text-sm text-red-300 font-mono">
            <div className="text-[10px] uppercase tracking-[0.16em] text-red-400/70 mb-1">
              parse error
            </div>
            {error}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

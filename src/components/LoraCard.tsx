import type { NormalizedLora } from '../lib/metadata-schemas'
import { analyzeTensors } from '../lib/tensor-analysis'
import { detectArchitecture } from '../lib/architectures'
import { IdentitySection } from './sections/IdentitySection'
import { TensorAnalysis } from './sections/TensorAnalysis'
import { TagCloud } from './sections/TagCloud'
import { RawMetadata } from './sections/RawMetadata'

interface Props {
  lora: NormalizedLora
}

export function LoraCard({ lora }: Props) {
  // Run structural analysis once; pass the arch label down to IdentitySection
  // so the base-model badge shows the variant-disambiguated name (e.g.
  // "FLUX 2 Klein 9B" instead of generic "FLUX 2" from ss_base_model_version).
  const structure = analyzeTensors(lora.tensors)
  const arch = detectArchitecture(structure)

  return (
    <div className="space-y-4 w-full max-w-5xl mx-auto">
      <IdentitySection lora={lora} archDisplayName={arch?.displayName} />
      <TensorAnalysis lora={lora} />
      {/* TagCloud renders nothing when ss_tag_frequency is absent — that's the
          common case for ai-toolkit. Appears for kohya-trained LoRAs. */}
      <TagCloud tagFrequency={lora.tagFrequency} />
      <RawMetadata
        decoded={lora.decodedMetadata}
        unknownKeys={lora.unknownKeys}
        tensors={lora.tensors}
      />
    </div>
  )
}

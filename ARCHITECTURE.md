# LoRA Inspector — Architecture Brief (V1)

## Product
A single-page web app where a user drags a `.safetensors` file onto the page and gets a beautiful breakdown of its metadata: rank, alpha, base model, training params, dataset stats, tag frequency cloud, raw JSON dump. Runs **entirely client-side** — files never leave the browser. Hosted on GitHub Pages.

The point of the project is to be a discovery funnel back to my GitHub profile (Broz, Lookout, MediaHive).

---

## V1 Scope (what we build now)

**In:**
- Drop one `.safetensors` file → parse header → show metadata cards
- Handle **ai-toolkit (ostris) metadata convention as the primary target** (FLUX trainers, our actual audience), with kohya-ss as a strong secondary
- Graceful fallback when metadata is missing/stripped/unknown
- Tag cloud visualization from `ss_tag_frequency`
- Raw JSON viewer (collapsible) for the metadata-curious
- Dark-first design
- Deploy to GitHub Pages

**Explicitly OUT (defer to V1.5+):**
- Comparing two LoRAs side-by-side
- Folder/batch upload
- Saving or sharing inspection results
- Desktop/Tauri version
- Library management features
- Anything requiring a backend

Resist scope creep. The funnel works because the page does one thing instantly.

---

## Tech Stack

- **Vite + React + TypeScript** — scaffolding
- **Tailwind CSS** — styling
- **shadcn/ui** — for primitives (Card, Button, Collapsible) — keep it light, don't pull in the whole catalog
- **No state library** — `useState` is enough for V1
- **No backend** — pure static
- **Deploy:** GitHub Actions → GitHub Pages

---

## Safetensors Parsing — The Critical Piece

Safetensors files have this structure:
```
[ 8 bytes: little-endian uint64 = header length N ]
[ N bytes: UTF-8 JSON header ]
[ tensor data — we IGNORE this entirely ]
```

The JSON header contains tensor names + a special `__metadata__` key. The `__metadata__` value is what we care about — it's a flat object of string→string with training info.

**Implementation approach:** Use the File API with `.slice()` to read only the first few MB. We never load the full file into memory. A 6GB LoRA is parsed in milliseconds.

```typescript
// src/lib/safetensors.ts — signature CC should target
export async function parseLoraMetadata(file: File): Promise<{
  metadata: Record<string, string>;        // raw __metadata__ object
  tensors: { name: string; dtype: string; shape: number[] }[];  // tensor index
  fileSize: number;
  fileName: string;
}>

// Implementation outline:
// 1. Read first 8 bytes via file.slice(0, 8).arrayBuffer()
// 2. Parse as BigInt64 little-endian → headerLength
// 3. Read next headerLength bytes via file.slice(8, 8 + headerLength).text()
// 4. JSON.parse the header
// 5. Extract __metadata__, separate tensor entries
// 6. Done — never touch the tensor data
```

Use `BigInt` for the header length (it's a uint64) but convert to `Number` after sanity-checking it's reasonable (< 100MB).

---

## Metadata Schema Knowledge

**Primary convention: ai-toolkit (ostris).** Our test corpus is FLUX trainers using ai-toolkit, so its key set drives the IdentitySection layout and the schema map's first-class display rules.

### ai-toolkit keys (primary)

| Key | Meaning | Display as |
|---|---|---|
| `name` | LoRA name | title, large |
| `version` | LoRA version | small badge next to name |
| `software` | JSON string: `{name, repo, version}` | parse → "ai-toolkit v0.9.13" badge, link `repo` |
| `ss_base_model_version` | Base model (shared with kohya) | badge: "FLUX 2", "FLUX.1-dev", "SDXL", etc. |
| `ss_output_name` | Output filename | display raw |
| `training_info` | JSON string: `{step, epoch}` | parse → "3,000 steps · 31 epochs" |
| `format` | Tensor format (e.g. `pt`) | small label |
| `sshs_model_hash` | Full model hash | mono, truncated with copy |
| `sshs_legacy_hash` | Short hash | mono |

Rank/alpha are not present in ai-toolkit metadata — **derive rank from tensor shapes** (inner dim of `*lora_A.weight` tensors). This is a separate utility in `src/lib/lora-stats.ts`.

### ai-toolkit — the buried gold: serialized YAML config

ai-toolkit's `get_meta_for_safetensors` flattens the entire training job config into the metadata as JSON-string values. The top-level key names depend on the trainer version (often `process_0_*`, `ss_*`, or a single config blob). **CC: dump all metadata keys from Ömer's actual files to discover the exact names, then parse the JSON values to access the nested fields below.**

Fields to surface from the parsed config (paths shown as nested):

| Config path | Why it matters | Display as |
|---|---|---|
| `process[0].trigger_word` | The token to invoke the LoRA | **Prominent badge: "Trigger: `sks`"** — maybe top-right of identity card |
| `process[0].sample.prompts[]` | Prompts the user set for periodic sampling — reveals intent | **THE SHOWPIECE — gallery of prompt cards** (replaces tag cloud) |
| `process[0].sample.seed` | Sample seed | sampling panel |
| `process[0].sample.guidance_scale` | Sample CFG | sampling panel |
| `process[0].datasets[].folder_path` | Dataset folder — last segment usually encodes concept | identity panel as "Dataset: `anotha_beril`" |
| `process[0].datasets[].resolution` | Training resolutions | training panel |
| `process[0].datasets[].caption_ext` | Caption extension | raw |
| `process[0].network.type` | Network type (lora, lokr, loha) | identity panel |
| `process[0].network.linear` | Rank (corroborates shape-derived) | training panel |
| `process[0].network.linear_alpha` | Alpha | training panel |
| `process[0].network.only_if_contains` | Layer targeting filter | training panel (only if set) |
| `process[0].train.lr` | Learning rate | training panel, scientific notation |
| `process[0].train.optimizer` | Optimizer | training panel |
| `process[0].train.noise_scheduler` | Scheduler | training panel |
| `process[0].train.batch_size` | Batch size | training panel |
| `process[0].train.train_unet` / `train_text_encoder` | What was trained | training panel — two pill badges |
| `process[0].train.gradient_checkpointing` | Memory opt flag | raw |
| `process[0].model.name_or_path` | Base model HF path | identity panel sub-line |
| `process[0].model.arch` | Architecture string | raw |
| `process[0].save.save_every` | Checkpoint frequency | raw |

### Sample Prompts Gallery — the new showpiece

This replaces the tag cloud for ai-toolkit LoRAs (which are most of Ömer's audience). Render `process[0].sample.prompts` as a grid of cards. Each card: the prompt text in mono, with the trigger word highlighted in yellow. Header: "Trained to produce" or similar. This is the visual anchor that makes the page interesting and shareable.

If both `sample.prompts` and `ss_tag_frequency` exist, prefer the prompts gallery — it's more informative. Tag cloud stays as the fallback for kohya LoRAs.

### Investigation findings (2026-05-24) — the buried gold isn't there

The two sections above are based on a faulty premise. After Ömer's two real ai-toolkit files (`anotha_beril_000003000.safetensors`, ai-toolkit v0.9.13 / FLUX 2 and `2ber_000002500.safetensors`, ai-toolkit v0.7.24 / Qwen Image) both came in with identical 9-key minimal metadata, CC traced the ai-toolkit source line-by-line. Conclusion: **ai-toolkit never embeds the training YAML config into safetensors metadata. There is no `process_0_*`, no `config` blob, no flag to enable it.**

Evidence:

- `toolkit/metadata.py` lines 11-27 — `get_meta_for_safetensors(meta, ...)` is a pure serializer over a pre-built `meta` dict. It never touches `self.config` or the YAML.
- `jobs/BaseJob.py __init__` — `self.meta = config['meta'] if 'meta' in config else OrderedDict()`. Only the YAML's top-level `meta:` block (which contains just `name` + `version` in every example file) gets pulled in.
- `jobs/process/BaseSDTrainProcess.py update_training_metadata()` adds exactly: `training_info` ({step, epoch}), `ss_base_model_version`, `ss_output_name`, and conditionally `ss_tag_frequency` (only when `self.trigger_word is not None`, encoded as kohya-compat `{"1_<trigger>": {"<trigger>": 1}}`).
- `add_model_hash_to_meta()` adds `sshs_model_hash` + `sshs_legacy_hash`.
- `toolkit/config_modules.py` `SaveConfig` has no embed/save-config flag. The full YAML is dumped to a **sibling `.yaml` file** on disk via `save_training_config()` — not into the safetensors.

So the complete set of keys ai-toolkit ever writes into the safetensors metadata is:

| Key | Source | Always present? |
|---|---|---|
| `name` | YAML `meta.name` | yes |
| `version` | YAML `meta.version` | yes (semantically: meta-block version, NOT LoRA version — ambiguous, don't display prominently) |
| `software` | `add_software_info=True` default | yes (`{name, repo, version}`) |
| `format` | hardcoded `"pt"` | yes |
| `training_info` | `{step, epoch}` from current state | yes |
| `ss_base_model_version` | `self.sd.get_base_model_version()` | yes |
| `ss_output_name` | `self.job.name` | yes |
| `sshs_model_hash` | content hash | yes |
| `sshs_legacy_hash` | content hash, short | yes |
| `ss_tag_frequency` | only if `trigger_word` set in config | NO — Ömer's two files don't have it |

**Implications for V1:**

- The "Sample Prompts Gallery as the showpiece" plan is dead for ai-toolkit. Sample prompts are consumed by `sample()` to write preview images to disk and never reach the safetensors at all.
- The trigger word IS recoverable — but only when the user set `trigger_word` during training. Extract from `ss_tag_frequency` keys (`"1_<word>"`) when present. Ömer's two files don't include one because his training didn't set it.
- The tag cloud reverts to being the showpiece for kohya files (where `ss_tag_frequency` is the dense map originally intended).
- The IdentitySection as currently implemented already surfaces 100% of ai-toolkit's safetensors metadata output. There is no more juice to squeeze from the metadata side.
- Sibling `.yaml` drop was considered and rejected by Ömer 2026-05-24 — "no use." Won't pursue.

**Where next:** anything richer than the current identity card has to come from **tensor analysis** (tensor names + shapes), since that data is in every safetensors regardless of trainer. The genuinely useful inference there is *what the LoRA targets* — full UNet vs attention-only vs text encoder vs specific block ranges — which classifies the LoRA's purpose (style / character / concept). Parameter counts and tensor counts on their own restate file size and aren't independently valuable. See below for the planned Tensor Analysis section if/when it gets built.

### kohya-ss keys (secondary)

Still common. The map keeps full coverage even though it's no longer the primary target:

| Key | Meaning | Display as |
|---|---|---|
| `ss_network_dim` | Rank | "Rank 32" |
| `ss_network_alpha` | Alpha | "Alpha 16" |
| `ss_sd_model_name` | Model file used | display raw |
| `ss_learning_rate` | LR | scientific notation |
| `ss_unet_lr` | UNet LR | scientific notation |
| `ss_text_encoder_lr` | TE LR | scientific notation |
| `ss_max_train_steps` | Total steps | with commas |
| `ss_num_epochs` | Epochs | integer |
| `ss_num_train_images` | Dataset size | integer |
| `ss_resolution` | Training res | "1024x1024" |
| `ss_optimizer` | Optimizer | display raw |
| `ss_lr_scheduler` | Scheduler | display raw |
| `ss_seed` | Seed | display raw |
| `ss_clip_skip` | CLIP skip | integer |
| `ss_mixed_precision` | Precision | display raw |
| `ss_training_comment` | Free-form notes (often trigger words) | display raw, allow line breaks |
| `ss_tag_frequency` | JSON string: `{folder: {tag: count}}` | parse → tag cloud |
| `ss_dataset_dirs` | JSON string of dirs | parse → list |

Also handle `modelspec.*` keys (newer convention) and OneTrainer's keys (different prefix). Keep all key→display-name mappings in `metadata-schemas.ts`.

**JSON-in-string pattern:** several values across both conventions are JSON-encoded strings (`software`, `training_info`, `ss_tag_frequency`, `ss_dataset_dirs`). The schema layer opportunistically `JSON.parse`s any string starting with `{` or `[`.

For unknown keys, dump them into the "Raw" section. Never hide data.

---

## Folder Structure

```
Inspector_Lora/
├── .github/workflows/deploy.yml       # GitHub Pages deploy
├── public/
│   └── favicon.svg
├── src/
│   ├── lib/
│   │   ├── safetensors.ts             # header parsing
│   │   ├── metadata-schemas.ts        # known key mappings, formatters
│   │   └── tag-frequency.ts           # parse + normalize ss_tag_frequency
│   ├── components/
│   │   ├── Dropzone.tsx               # drag-drop + click-to-select
│   │   ├── LoraCard.tsx               # main result container
│   │   ├── sections/
│   │   │   ├── IdentitySection.tsx    # name, base model, rank/alpha
│   │   │   ├── TrainingSection.tsx    # lr, steps, optimizer, etc.
│   │   │   ├── DatasetSection.tsx     # num images, resolution
│   │   │   ├── TagCloud.tsx           # the visual showpiece
│   │   │   └── RawMetadata.tsx        # collapsible JSON viewer
│   │   └── Footer.tsx                 # link to my other projects (THE FUNNEL)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                       # Tailwind import + global tokens
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts                      # base path for GH Pages
└── README.md
```

---

## Component Tree

```
<App>
  <Header />                            # title + tagline + GitHub link
  {!file ? (
    <Dropzone onFile={setFile} />
  ) : (
    <LoraCard data={parsedData} onReset={() => setFile(null)}>
      <IdentitySection />
      <TrainingSection />
      <DatasetSection />
      <TagCloud />
      <RawMetadata />
    </LoraCard>
  )}
  <Footer />                            # → omer's other projects
</App>
```

Parsing happens in `App` after a file is dropped, with a loading state for the (very brief) parse.

---

## Design Direction

- **Dark default**, light mode optional later. Our audience lives in dark.
- **Typography:** Inter for UI, JetBrains Mono for technical values (rank, LR, steps). Tabular numerics.
- **Color palette:** yellow-on-black, industrial / inspection-tape vibe.
  - Background: `#0a0a0a` (near-black)
  - Surfaces / cards: `#141414` with `#262626` borders
  - Primary text: `#e5e5e5`
  - Muted text: `#737373`
  - **Accent: `#FACC15` (Tailwind yellow-400)** — use sparingly
  - Yellow is reserved for: dropzone hover border, active/highlighted tag in cloud, key numeric values (rank, steps, LR), links, focus rings
  - Everything else stays grayscale. Yellow = "important data" signal, not decoration.
- **Dropzone:** big, obvious, animated border on drag-over. Empty state should fill the viewport. After a file is loaded, the dropzone collapses to a small "load another" button.
- **Cards:** rounded, soft borders, gentle shadow. Each section is its own card.
- **Tag cloud:** font size scaled by frequency. Top 50 tags max, with "show all" toggle. This is the showpiece.
- **Microcopy:** dry, technical, no exclamation marks. "Inspecting…" not "Inspecting your file! ✨"
- **Mobile:** make it work but don't optimize hard for it — this audience is on desktop.

Reference vibe: imagine Linear's design language applied to a single-purpose dev tool.

---

## The Funnel — Footer

The footer is the only part of the page with a non-utility purpose: it sells my other projects.

```
Made by Ömer Vaner
→ Broz — files across your devices over Tailscale
→ Lookout — a SQL IDE that doesn't suck
→ MediaHive — visual media browser
[GitHub icon link]
```

Style it simply, don't make it feel like an ad. The tools should be linked to their repos.

---

## Deploy

GitHub Actions on push to `main`:
- `npm ci`
- `npm run build`
- Push `dist/` to `gh-pages` branch
- Pages serves from `gh-pages`

`vite.config.ts` needs `base: '/lora-inspector/'` (whatever the repo name is).

---

## README

Short. Headline + animated GIF demo + "drop a file, see what's inside" + privacy note ("everything runs in your browser, no uploads") + tech stack + link to other projects.

---

## What CC Should Build First

1. `src/lib/safetensors.ts` with tests against a real LoRA file
2. `src/lib/metadata-schemas.ts` with the key→display-name map
3. `Dropzone` component, working drag-drop, calls into the parser
4. `LoraCard` with `IdentitySection` and `RawMetadata` first (gets us to "shows something" fastest)
5. Then `TrainingSection`, `DatasetSection`, `TagCloud` in that order
6. Deploy pipeline
7. Polish pass

Get to "drag file → see raw JSON" in the first session. Then layer pretty on top.


---

## Field findings (2026-05-24) — testing on Civitai LoRAs

Inspector was tested against four real ai-toolkit LoRAs spanning two architectures and three use cases (character, slider, style). Findings worth capturing for V1.x:

### 1. Block coverage is universally "all" for ai-toolkit

| File | Trainer | Coverage |
|---|---|---|
| `anotha_beril` (character) | ai-toolkit v0.9.13 / FLUX 2 | all blocks, all components |
| `2ber` (character) | ai-toolkit v0.7.24 / Qwen Image | all blocks, all components |
| `klein_slider_anatomy2` (slider) | ai-toolkit v0.7.20 / FLUX 2 Klein | all blocks, all components |
| `Psionix` (style) | ai-toolkit v0.7.24 / Qwen Image | all blocks, all components |

Cause: ai-toolkit's default training config trains every layer. Users almost never bother with `only_if_contains` or per-layer filters. So the coverage strip will report "all covered" on ~90% of real-world files.

Implication: the strip's value is **architecture fingerprinting**, not coverage signal. An 8+24 strip instantly = FLUX 2; a 60-strip instantly = Qwen Image. The "all covered" callout is mostly redundant. Consider de-emphasizing the redundant text, or treating partial coverage as the special-case alert state rather than the all-covered as the normal callout.

### 2. The actual classifier signal lives in rank + steps + epochs

Coverage doesn't differentiate use cases (all `all`), but the top stat row does, clearly:

| File | Rank | Steps | Epochs | Use case |
|---|---|---|---|---|
| `anotha_beril` | 32 | 3,000 | 19 | character / identity |
| `2ber` | 32 | 2,500 | 14 | character / identity |
| `klein_slider_anatomy2` | **4** | **50** | 6 | slider |
| `Psionix` | 16 | 5,000 | **712** | small-dataset style |

Signatures:
- **Slider:** very low rank (2–8), very few steps (≤100), few epochs. Tiny file.
- **Character / identity:** mid-to-high rank (16–32), moderate steps (1k–5k), moderate epochs.
- **Small-dataset style:** mid rank (8–16), high steps, **very high epochs** (100+ means a small dataset trained to death).
- **Concept / general:** mid rank, moderate steps, low-to-moderate epochs.

These are heuristics, not certainties — but they're reliable enough to surface as a one-line interpretation.

### 3. Proposed feature: "Quick read" line at top of analysis

A single sentence interpreting the rank+steps+epochs combo, displayed prominently above or inside the Tensor Analysis card. Examples:

```
Rank 4 · 50 steps · 6 epochs        → looks like a slider LoRA
Rank 16 · 5,000 steps · 712 epochs   → small-dataset style training
Rank 32 · 3,000 steps · 19 epochs    → character / identity training
```

Dry tone, no exclamation, "looks like" hedging language (not "is"). Yellow accent on the verdict word. This is the single most insight-dense addition the page can get without new data — it turns a data dump into an interpretation.

Decision rules (initial heuristic):

```
if rank <= 8 and steps <= 200:               "slider"
elif epochs >= 100 and rank <= 16:           "small-dataset style training"
elif rank >= 24 and 1000 <= steps <= 6000:   "character / identity training"
elif rank >= 16 and steps >= 3000:           "style / concept training"
else:                                        no quick-read, hide the line
```

The "hide the line" fallback is important — silence is better than a confidently wrong classification.

### 4. Title vs filename handling works correctly

`Psionix` LoRA has filename `Psionix (Comic Art) - Qwen 2512 - DirkDigitaller.safetensors` (spaces, parens, em-dashes). Inspector correctly uses the metadata `name` field for the title ("Psionix") and shows the full filename underneath. No truncation issues. Keep this pattern.

### 5. Unmapped components annotation works

Both Qwen Image files surface `unmapped components: img_mod.1, txt_mod.1`. This is correct and honest — those are the MMDiT modulation/AdaLN-Zero layers that don't fit the attention/MLP buckets. Don't hide them, don't force-categorize them. Pattern to keep across architectures.

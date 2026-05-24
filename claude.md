# LoRA Inspector — Claude Guidelines

## Project Purpose

LoRA Inspector is a single-page, client-side web app that parses `.safetensors` metadata in the browser. **The product goal is secondary to the funnel goal**: this exists to drive traffic to Ömer's other GitHub projects (Broz, Lookout, MediaHive). Every design decision passes through this lens — "does this make discovery + curiosity → click-through more likely?"

Implication: scope discipline matters more than usual. Features that add friction or complexity to the core "drop file → see metadata" interaction dilute the funnel. Defer everything that isn't core.

## Docs Map

- `ARCHITECTURE.md` — V1 scope, tech stack, safetensors parsing approach, component tree, design tokens. Read first.
- `claude.md` — this file. Workflow, standards, development approach.
- (Add `HANDOFF.md` only if the project grows large enough to need it. Don't add prematurely.)

## Workflow

- **Ömer** is the architect. He makes decisions, defines direction, reviews results.
- **Claude Desktop** is the design partner — architecture, planning, discussion.
- **Claude Code (CC)** handles implementation — writing code, running tests, debugging.
- Always have Ömer test the implementation before marking anything as complete.

## Scope is Ömer's

Ömer can change scope or add features at any time. Never push back on scope changes — just do them. The scope discipline above applies to *avoiding feature creep within the assistant's own suggestions*, not to Ömer's decisions.

## Code Standards

- Keep all files under 500 lines. If a file approaches this limit, split it.
- Single source of truth — don't duplicate logic, models, or constants. Metadata key→display-name mappings live in `src/lib/metadata-schemas.ts` only.
- Don't rewrite entire files for small changes — edit only what's needed.
- Read files fresh before editing — another agent (CC or Claude Desktop) may have modified them.
- No premature abstraction. Build the simple thing, refactor when a pattern emerges.
- **Client-side only.** No backend, no API calls to anything external (except CDN fonts if used). Files never leave the user's browser. This is a hard architectural constraint, not a preference.

## Doc Discipline

- **Doc updates must never exceed the token cost of the code change they document.** Code + commit messages are the durable record; docs are the sparse index on top of them.
- **One edit pass per file, not multiple.** Plan the diff before writing.
- Load-bearing constraints (e.g. "client-side only", "no upload") belong in `ARCHITECTURE.md` and stay there.
- Don't write a CHANGELOG.md for a project this small — `git log` is the changelog.

## Development Approach

- Build incrementally. Get something working end-to-end first, then polish.
- Each feature should be testable in isolation before integration.
- Get to "drag file → see raw JSON dumped on screen" before doing any visual design. Plumbing first, paint second.
- When in doubt, ask Ömer — don't assume.
- Never suggest giving up or questioning if something is worth the effort.
- If you fail a task more than once, stop and consult Ömer with the problem explained. Don't keep retrying blindly.

## Stack

- **Vite + React + TypeScript** — scaffolding.
- **Tailwind CSS** — styling. Use Tailwind tokens, avoid raw CSS files except `index.css` for globals.
- **shadcn/ui** — UI primitives. Pull in only what's needed (Card, Button, Collapsible, etc.), don't install the whole catalog.
- **No state library** — `useState` is enough for V1.
- **No router** — single page.
- **No backend, no external API calls.** Hard constraint.

## Deploy Target

- **GitHub Pages** via GitHub Actions on push to `main`.
- Repo name: `lora-inspector` → URL path `/lora-inspector/`.
- `vite.config.ts` must set `base: '/lora-inspector/'`.

## Funnel — Don't Forget

The footer is the most important commercial element on the page. It links to:
- Broz (https://github.com/[omer]/broz)
- Lookout (https://github.com/[omer]/lookout)
- MediaHive (https://github.com/[omer]/mediahive)

(CC: confirm exact repo URLs with Ömer before hardcoding.)

Don't make the footer feel like an ad. It should feel like a credits line on a thoughtful tool.

## Resolved Decisions

- [x] Stack: Vite + React + TS + Tailwind + shadcn/ui
- [x] Hosting: GitHub Pages
- [x] Repo name: `lora-inspector`
- [x] Product name on page: "LoRA Inspector"
- [x] Color palette: yellow-on-black (`#FACC15` accent on `#0a0a0a`), industrial / inspection-tape vibe
- [x] Parsing: client-side, read only first ~MB via File.slice(), never load tensor data
- [x] V1 scope: single-file inspection, ai-toolkit metadata convention (primary, kohya-ss secondary), tag cloud, raw JSON viewer
- [x] V1 explicitly excludes: compare mode, batch upload, sharing, desktop wrapper, library management

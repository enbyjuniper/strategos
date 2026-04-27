# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server with HMR
npm run build      # type-check then bundle (tsc -b && vite build)
npm run lint       # run ESLint
npm run preview    # serve the dist/ build locally
```

There are no tests in this project.

## Architecture

Strategos is a single-page Warhammer 40K army reference app built with React 19 + TypeScript + Vite. It has no backend — all state is stored in `localStorage`.

### Data flow

1. User imports a **New Recruit** roster export (JSON from newrecruit.eu).
2. `parseNR` (`src/utils/parseNR.ts`) transforms the raw NR schema into the internal `Army` / `Unit` types defined in `src/types.ts`.
3. `App.tsx` holds all runtime state — the parsed army, active phase, card order, unit-to-unit attachments, and per-unit images — and persists them to `localStorage` under `strategos_*` keys.

### Phase-driven rendering

`PhaseTabs` lets the user switch between five game phases (`move | shoot | melee | dur | abil`). The active `Phase` is passed down to every `UnitCard`, which conditionally renders a different subset of stats or content for each phase — movement stats, weapon tables, durability stats, or abilities.

### Attachment / clustering system

Units can be linked together into "clusters" (e.g. a Character attached to a squad). The `Attachments` type (`Record<string, string[]>`) maps a primary unit ID to an array of attached unit IDs. Attached units are hidden from the top-level grid and rendered nested inside the primary unit's `SortableSlot`. `UnitPicker` (a bottom-sheet modal) handles attaching, detaching, re-attaching, and dissolving clusters.

Drag-and-drop reordering (`@dnd-kit`) treats each cluster as a single draggable block — the `handleDragEnd` logic in `App.tsx` rebuilds a flat ID list by operating on blocks rather than individual unit IDs.

### Styling

All component styles use **CSS Modules** (`.module.scss` files colocated with each component). Shared SCSS mixins live in `src/styles/_mixins.scss`. CSS custom properties defined in `src/index.css` provide the phase color palette (`--move`, `--shoot`, `--melee`, `--dur`, `--abil`).

### Key utilities

- `parseNR` — converts the nested New Recruit XML-derived JSON into flat `Unit` objects; handles weapon deduplication, "choose one" weapon profile groups (`profiles[]`), enhancements, and detachment rules.
- `abilities.ts` — extracts invulnerable save (`getInv`) and Feel No Pain (`getFNP`) values from free-text ability names/descriptions via regex; `isKeyword` classifies abilities as keyword badges vs. full text entries.
- Image uploads are resized client-side to max 300 px width and stored as base64 JPEG data URLs in `localStorage`. `ImageTransform` (x/y pan + zoom) is stored separately and applied via CSS `transform`.

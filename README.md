# Strategos

A single-page Warhammer 40K army reference app. Import your roster from [New Recruit](https://newrecruit.eu), then browse your units by game phase — movement, shooting, melee, durability, and abilities — during a game.

No backend. All state persists in `localStorage`.

## Features

- Import New Recruit roster exports (JSON)
- Phase-driven unit cards (move / shoot / melee / dur / abil)
- Attach characters to squads — clusters drag as a single block
- Per-unit image uploads (resized client-side, stored as base64)
- Fight calculator
- PWA — installable on mobile

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), then import a New Recruit JSON export via the side menu.

## Commands

```bash
npm run dev        # dev server with HMR
npm run build      # type-check + bundle
npm run lint       # ESLint
npm run preview    # serve the dist/ build locally
```

## Stack

- React 19 + TypeScript + Vite
- CSS Modules (SCSS)
- [@dnd-kit](https://dndkit.com) for drag-and-drop reordering
- [@phosphor-icons/react](https://phosphoricons.com) for icons
- `vite-plugin-pwa` for PWA support

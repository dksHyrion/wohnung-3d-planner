# CLAUDE.md

This file provides project-specific commands and architecture guidelines for Claude Code.

---

## Commands

```bash
# Development
npm run dev                  # Start local Vite dev server (http://localhost:5173)

# Testing
npm test                     # Run all Vitest tests once (vitest run)
npx vitest                   # Run Vitest tests in watch mode
npx vitest run tests/<file>  # Run a specific test file

# Type-Checking & Build
npm run build                # Run tsc -b && vite build
```

---

## Architectural Guidelines

### Metric Units & Coordinate System
* **Invariant:** `1 Unit = 1 cm` across the entire codebase (`EPSILON_CM = 0.05`).
* `X` = Width, `Z` = Depth (ground plane), `Y` = Height (upward).
* Interior room area is strictly **Lichte Innenfläche** in m² calculated from wall inner boundaries.

### State & Store Slices
* State is managed with **Zustand** in `src/store/`:
  * `geometry.ts`: Walls, corners, openings, furniture placement, rugs, collision recalculation.
  * `view.ts`: Active tool (`select`, `draw-wall`, `measure`, `split-wall`), camera angles, lighting/sun presets.
  * `history.ts`: Undo/Redo (30 snapshots), autosave, JSON serialization.
* During drag operations, trigger `pushUndoSnapshot()` on drag start and pass `{ recordHistory: false }` during pointer move.

### 3D Rendering & Visuals
* Stack: `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `three` (r170).
* Visual resolution must follow `item.visual` (`resolveFurnitureVisual`), never item names.
* Raycasting uses dedicated 12-triangle interaction hitbox proxies (`FurnitureMesh3D.tsx`) to keep frame rates at 60 FPS.
* The renderer is 100% offline-capable (procedural IBL environment, no external CDN calls).

### Collision & Clearance Engines
* Collision: `THREE.OBB` + Separating Axis Theorem (SAT) for compound shapes (`src/core/furnitureShapes.ts`).
* Ergonomics: DIN 18040 clearance evaluation (`src/core/ergonomicsEngine.ts`) with green/amber/red passage thresholds.

### Privacy & Repository Cleanliness
* Do not commit personal user data or real purchase details.
* Local private plans belong in `privat/` (ignored by `.gitignore`).

### Operational Directness (Tunnel & Dev Server)
* When asked to start the dev server or open the tunnel ("mache den tunnel auf", "starte dev server"), run `npm run dev -- --host 0.0.0.0 --port 5173` directly in the background.
* Do not run the Vitest test suite or extensive file searches for simple operational commands. Report reachable URLs immediately.

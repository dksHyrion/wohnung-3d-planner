# AGENTS.md — Guidelines for AI Coding Agents

Welcome to **wohnung-3d-planner**. This document outlines core architectural invariants, conventions, and workflows for autonomous coding agents (Antigravity, Cursor, Windsurf, Copilot, etc.) working on this repository.

---

## 1. Project Purpose & Scope

A centimeter-accurate 2D/3D architectural floorplan and furniture placement simulator built with **React 18**, **Three.js (r170)**, **React Three Fiber**, **Zustand**, and **TypeScript 5**. It is designed for real-world space planning, clearance validation (DIN 18040 & Neufert), and scaled architectural plan exports (1:50 / 1:100 SVG).

---

## 2. Essential Commands

```bash
# Start development server (local)
npm run dev

# Run all automated tests (491 tests across 52 files)
npm test

# Run Vitest once without watch mode
npx vitest run

# Run specific test file
npx vitest run tests/<test-file>.test.ts

# Type-check and production build
npm run build
```

---

## 3. Core Architectural Invariants

### A. Coordinate System & Scale
* **Global Convention:** `1 Three.js Unit = 1.0 cm`.
* **Axes:** `X` = Horizontal, `Z` = Depth (floor plane), `Y` = Height (`+Y` points upwards towards ceiling).
* **Tolerance:** `EPSILON_CM = 0.05` (500 µm) for geometric and floating-point comparisons.
* **Lichte Innenfläche:** Area is always computed as interior net polygon area in m² (`computeFloorPolygons`), never gross or estimated WoFlV.

### B. Visual Decoupling (`visual` vs `name`)
* **Never sniff names:** The 3D model and collision geometry are determined **strictly** by `item.visual` (`FurnitureVisualType`), NEVER by substrings in `item.name`.
* If `item.visual` is absent or unknown, fall back to `'box'` (`GenericArchitecturalModel`).
* Resolvers live in `src/core/furnitureVisual.ts` and `src/core/furnitureVisualCatalog.ts`.

### C. Compound Collision & Multi-Part Furniture
* Compound pieces (dining table + chairs, L-sofas, beds + nightstands, unfolded sofa beds) must register their sub-polygons in `src/core/furnitureShapes.ts` (`layoutFurnitureParts`).
* Both 2D SVG canvas, 2D plan export, and 3D collision (`computeFurnitureOBB` / SAT) share `layoutFurnitureParts` to ensure zero discrepancies between rendered visuals and clearance checks.

### D. Store Architecture (`zustand`)
* Store resides in `src/store/useFloorplanStore.ts` and delegates to domain action slices:
  * `src/store/geometry.ts`: Walls, corners, openings, furniture, rugs, and collision evaluations.
  * `src/store/view.ts`: Tool selection, camera preset, lighting/time, grid, measure tool.
  * `src/store/history.ts`: 30-step undo/redo buffer, LocalStorage autosave, JSON import/export.
* **Drag Transactions:** When implementing drag interactions in 2D or 3D, always call `pushUndoSnapshot()` on pointer down, then use `{ recordHistory: false }` during pointer move to avoid flooding the undo history.

### E. 100% Offline-First
* Zero external CDN dependencies (no Google Fonts, UNPKG, or Poly Haven runtime fetches).
* Procedural IBL lighting via `@react-three/drei` `<Environment>` with parametric `<Lightformer>`s.
* High-resolution floorplan underlays are stored locally via IndexedDB (`overlayImageStore.ts`).

### F. Karpathy LLM-Wiki Structure
* `SCHEMA.md`: Governs wiki ingestion, querying, and linting.
* `raw/`: Immutable source research and specifications (never overwrite existing raw files).
* `wiki/`: Interlinked living concept documentation (`wiki/index.md` is the central index, `wiki/log.md` is the audit trail).

---

## 4. Coding & Testing Guidelines

* **TypeScript Strictness:** Strict types enabled. Avoid `any`. Prefer Discriminated Unions for visual types and tool modes.
* **Preserve Integrity:** Keep all 491 automated tests passing when refactoring or adding features.
* **Privacy by Design:** Never commit personal names, real addresses, private purchase receipts, or private floorplans to git. Keep private plans in `privat/` (ignored by `.gitignore`).
* **Verification Before Completion:** Always execute `npm test` and `npm run build` before claiming completion.

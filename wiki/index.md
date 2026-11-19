# Wiki-Index: 3D-Wohnungsvisualisierung & Raumplaner

Zentrales Inhaltsverzeichnis der vom Agenten gepflegten Wissensdatenbank nach dem [Karpathy LLM-Wiki-Schema](../SCHEMA.md).

## 1. Fachliche & Mathematische Konzepte (`wiki/concepts/`)

- [coordinate-system-cm.md](concepts/coordinate-system-cm.md) — Maßstabskonvention (`1 Three.js Unit = 1 cm`), Achsenbelegung (`X`, `Y`, `Z`), numerische Toleranz (`EPSILON_CM = 0.05`) sowie DIN-/Neufert-Standardmaße.
- [wall-graph-topology.md](concepts/wall-graph-topology.md) — Wandgraph, Mehrgeschossigkeit (`levels.ts`), Geschossdecken & Treppenausschnitte (`slabMath.ts`, `stairsMath.ts`), `splitCrossingWalls` & `splitWallAt`, Winkelhalbierenden-Gehrungen (`wallMiter.ts`), Raum-Löcher (`holes`), 5 Öffnungs-Bauarten, Türblatt (`DoorLeaf3D`), 3D-Fensterrahmen (`WindowFrame3D`), Kappenfunktionen, Cutaway bei 30 cm und Dachschrägen/WoFlV § 4 (`roofSlopeMath.ts`).
- [collision-detection.md](concepts/collision-detection.md) — Geschoss-isolierte zweistufige Kollisions-Engine (inkl. hohler Öffnungs-Subsegmente, Treppenausschnitte & `roof-slope-exceeded`), Kante-an-Kante-Snapping, Schwenkbogen-Befreiung, Compound-Layout (`furnitureShapes.ts`) und Cross-Floor-Ergonomie 2.0 (`ergonomicsScorecard.ts`).
- [furniture-inventory-and-design-specs.md](concepts/furniture-inventory-and-design-specs.md) — Echte Möbel und Platzhalter, eine Tabelle je `visual`, Objekt-Kopplung (`attachedToId`), Osaka-Posen (inkl. ausgeklappter 3D/2D-Liegefläche), Masterlift-Höhenbereich und Vitsœ 606.
- [cinematic-lighting-and-atmosphere.md](concepts/cinematic-lighting-and-atmosphere.md) — Cinematische Beleuchtungs-Engine (`moodPresets.ts`), stufenlose Tageszeitinterpolation (6–22 Uhr), autarkes Lightformer-IBL, PostFX-Pipeline (N8AO, Bloom, AgX), prozedurale Boden-Bump-Maps, gedämpfte Kamerafahrten und Performance/Schön-Modus.
- [precision-editor-and-scale-export.md](concepts/precision-editor-and-scale-export.md) — Maßband & Compound-Abstandsmessung, Fangraster, Smart Alignment Guides, Drag-Undo-Schutz, Bildspeicher, gehrungs-/öffnungsgeschnittener SVG-Export 1:50/1:100 (`wallExportPolygons.ts`, CAD-Symbole), AutoCAD R12 DXF-Export (`dxfExport.ts`) und CSV/Markdown-Stückliste (`bomExport.ts`).

## 2. Anwendungsarchitektur (`wiki/architecture/`)

- [app-state-and-views.md](architecture/app-state-and-views.md) — Domänenlogik (`src/core/`), Store (`useFloorplanStore`, Slices, `roofSlopes`, `ergonomicsScorecard`), zerlegte 2D-Layer (`editor2d/layers/`), 3D-Viewport (`RoofSlopeMesh3D`, `WallMesh3D`), Inspektoren inkl. `ErgonomicsScorecardSection` sowie Playwright-E2E (`e2e/app.spec.ts`).
- [i18n-subsystem.md](architecture/i18n-subsystem.md) — Zero-Dependency Internationalisierung (DE / EN) mit 100 % Key-Parität, robuster Offline-Synchronisation (Zustand & `useSyncExternalStore`), Sprachschalter in der TopBar und strikter Einhaltung von Invariante 3B.
- [github-reference-comparison.md](architecture/github-reference-comparison.md) — Architektur-Benchmark gegen vergleichbare Open-Source-Projekte auf GitHub (`openPlan3D`, `blueprint3d-modern`, `react-planner`, `threejs-sims-house-builder`, `SweetHome3D`), umgesetzte Pakete 3B/3C/3D + Sprints 1–6 und verbleibendes Backlog 3A/3E/3F.

## 3. Unveränderliche Rohquellen (`raw/`)

- [2026-10-20-threejs-research-report.md](../raw/2026-10-20-threejs-research-report.md) — Recherchebericht zu RoomSketcher/ArchDaily-Referenzen, Blueprint3D, React-Planner, 1D-Wandprojektion und `THREE.OBB`.
- [2026-10-30-github-floorplan-comparison.md](../raw/2026-10-30-github-floorplan-comparison.md) — GitHub-Vergleichsstudie zu Open-Source 2D/3D-Raumplanern (`openPlan3D`, `blueprint3d-modern`, `react-planner`, `threejs-sims-house-builder`, `SweetHome3D`) und Ableitung der Pakete 3A–3F.
- [din-and-neufert-standards.md](../raw/furniture-specs/din-and-neufert-standards.md) — Deutsche Standardmaße nach DIN 18101 und Neufert für Wände, Türen, Fenster, Durchgangsbreiten und Möbel in `cm`.
- [log.md](log.md) — Chronologisches Audit-Log aller Ingest-, Query- und Architektur-Operationen.

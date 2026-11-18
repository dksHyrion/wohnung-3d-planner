# Design Spec: Mehrgeschossigkeit, Geschossdecken & Parametrische Treppen (Sprints 12–14)

**Datum:** 2026-11-18  
**Status:** Freigegeben (Option A: `levelId`-basiertes Multi-Level-Modell)  
**Umfang:** Sprints 12, 13 und 14  

---

## 1. Ziele & Architektur-Invarianten

1. **100 % Abwärtskompatibilität:** Bestehende `FloorplanData`-JSONs, Presets, URL-Snapshots und alle 682 automatisierten Tests bleiben ohne Migration gültig. Elemente ohne explizites `levelId` gehören automatisch zum Basis-Geschoss (`DEFAULT_LEVEL_ID = 'level-0'`).
2. **Globale Skalierung bleibt `1 Unit = 1 cm`:** Jedes Geschoss liegt bei `Y = level.elevationCm` (z. B. `0 cm` für EG, `270 cm` für 1. OG bei `250 cm` Raumhöhe + `20 cm` Deckenstärke, `-270 cm` für UG).
3. **Gemeinsame Geometrie-Quelle:** Treppen-Grundrisse, Decken-Ausschnitte (`slabHoles`), 2D-CAD-Symbole, 3D-Meshes und Kollisions-/Kopffreiheitsprüfungen speisen sich aus derselben Pure-TS-Mathematik in `src/core/stairsMath.ts` und `src/core/levels.ts`.

---

## 2. Datenmodell & Store (Sprint 12)

### 2.1 Kern-Typen (`src/core/types.ts`)
* `BuildingLevel`:
  * `id: string`
  * `name: string` (z. B. `'Erdgeschoss'`, `'1. Obergeschoss'`, `'Untergeschoss'`)
  * `index: number` (ganzzahlige Sortier-Ordnung: `..., -1, 0, 1, 2, ...`)
  * `elevationCm: number` (Fußbodenoberkante FOK in cm relativ zu `0`)
  * `ceilingHeightCm: number` (lichte Raumhöhe, Standard `250 cm`)
  * `slabThicknessCm: number` (Geschossdecken-Stärke, Standard `20 cm`)
* `levelId?: string` als optionales Feld auf:
  * `Corner`, `Wall`, `WallOpening`, `FurnitureItem`, `AreaRug`, `RoomLabel`, `RoofSlope`, `WallFixture`.
* `FloorplanData` ergänzt um:
  * `levels?: BuildingLevel[]`
  * `stairs?: Staircase[]`
* `SelectableEntityType` ergänzt um `'stair'`.

### 2.2 Geschoss-Logik (`src/core/levels.ts`)
* `DEFAULT_LEVEL_ID = 'level-0'`
* `normalizeLevels(levels?: BuildingLevel[]): BuildingLevel[]`: garantiert mindestens ein Basis-Geschoss (`index: 0`), sortiert nach `index`, und berechnet bei Bedarf konsistente `elevationCm`-Stapel (`recomputeLevelElevations`).
* `getEntityLevelId(entity: { levelId?: string }): string`: gibt `entity.levelId ?? DEFAULT_LEVEL_ID` zurück.
* `scopeFloorplanToLevel(data: FloorplanData, levelId: string): FloorplanData`: filtert `corners`, `walls`, `openings`, `furniture`, `rugs`, `roomLabels`, `roofSlopes`, `fixtures` exakt auf `levelId` – damit laufen `computeFloorPolygons`, `evaluateFloorplanCollisions`, `ergonomicsEngine` und Exporte ohne Code-Duplikation pro Etage.

### 2.3 Store & Aktionen (`src/store/slices/levelSlice.ts`, `state.ts`, `view.ts`)
* `levels: BuildingLevel[]`
* `activeLevelId: string`
* `levelViewMode: 'active-only' | 'all-stacked' | 'ghost-below'`
* `showGhostBelow2D: boolean` (blendet im 2D-Grundriss das darunterliegende Geschoss als schwachen Durchpaus-Layer ein)
* Aktionen:
  * `addLevel({ name?, direction: 'above' | 'below', copyExteriorWalls?: boolean })`
  * `updateLevel(levelId, patch)` (passt `name`, `ceilingHeightCm`, `slabThicknessCm` an und aktualisiert Folge-`elevationCm`)
  * `removeLevel(levelId)` (verhindert Löschen des letzten verbleibenden Geschosses; räumt zugehörige Elemente & Treppen auf)
  * `setActiveLevel(levelId)` (wechselt aktives Geschoss, leert `selectedId`/`selectedIds`)
  * `setLevelViewMode(mode)` / `setShowGhostBelow2D(show)`
* Alle bestehenden Add-Aktionen (`addWallWithCorners`, `addFurniture`, `addRug`, `updateRoom`, …) versehen neue Elemente automatisch mit `levelId: state.activeLevelId`.
* Undo/Redo, `planImport.ts` und `exportJson` persistieren `levels[]` und `stairs[]`.

---

## 3. Parametrische Treppen & Geschossdecken (Sprint 13)

### 3.1 `Staircase`-Modell (`src/core/types.ts`, `src/core/stairsMath.ts`)
* `StaircaseType = 'straight' | 'l-shaped' | 'u-shaped'`
* `Staircase`:
  * `id: string`
  * `fromLevelId: string`
  * `toLevelId: string`
  * `type: StaircaseType`
  * `x: number`, `z: number`, `rotationYDeg: number`
  * `widthCm: number` (Standard `100 cm`)
  * `treadDepthCm: number` (Auftritt $a$, Standard `27 cm`)
  * `riserCount?: number` (optional; sonst automatisch nach DIN 18065 aus Geschoss-Höhendifferenz $\Delta H$: $n = \text{round}(\Delta H / 18)$)
  * `turnDirection?: 'left' | 'right'` (für L-/U-Treppen)
  * `landingLengthCm?: number` (Podestlänge, Standard `widthCm`)
  * `hasRailing?: boolean` (Standard `true`)
  * `color?: string`
* `computeStairGeometry(stair, fromLevel, toLevel)`:
  * Berechnet Stufenanzahl $n$, Steigung $s = \Delta H / n$, DIN-18065-Schrittmaß $2s + a$ (Sollbereich `59–65 cm`), Einzelstufen-Boxen `(x, y, z, width, height, depth)` in lokalen Koordinaten, Podest-Boxen, Geländerpfosten und **2D-Footprint-Polygone + Deckenloch-Polygon (`openingPolygonXZ`)**.
  * Unterstützt auch den Fall, dass ein einzelnes Geschoss existiert (z. B. freies Podest/Etagen-Treppe mit Zielhöhe `fromLevel.ceilingHeightCm + fromLevel.slabThicknessCm`).

### 3.2 Geschossdecken & Decken-Ausschnitte (`src/core/slabMath.ts`)
* Für jedes Geschoss `level` mit einem darunterliegenden Geschoss (`index > minLevelIndex`) werden aus den Bodenkonturen (`computeFloorPolygons`) + ggf. Stützflächen der unteren Etage die Deckenplatten-Polygone im Bereich $[Y_{\text{FOK}} - \text{slabThicknessCm},\; Y_{\text{FOK}}]$ erzeugt.
* Jede `Staircase`, die bei `level.id` ankommt (`toLevelId === level.id`), schneidet ihr `openingPolygonXZ` als Loch (`THREE.Shape.holes`) aus der Geschossdecke und der Fußbodenplatte des Zielgeschosses aus.

### 3.3 2D/3D-UI & Inspektor
* **2D (`StairsLayer` in `FurnitureAndOverlaysLayers.tsx` + `FloorplanCanvas2D.tsx`):** DIN-1356-Treppendarstellung mit Stufenstrichen, Lauflinie + Pfeilspitze (`↑`), Aussparungs-Schraffur/Umriss auf der Ziel-Etage sowie Dragging & Selektion.
* **3D (`StaircaseMesh3D.tsx` & `Scene3D.tsx`):** Geschoss-Gruppierung (`y = level.elevationCm`), gerenderte Geschossdecken inkl. Treppen-Ausschnitt, Stufen-/Podest-/Geländer-Meshes und Dragging auf aktiver Etage.
* **Inspektoren (`StairInspector.tsx`, `LevelManagerSection.tsx` in `InspectorSidebar.tsx`):**
  * Geschoss-Leiste / Manager (Etage hinzufügen oben/unten, Außenwände übernehmen, Decken-/Raumhöhe bearbeiten, Ansichtsmodus).
  * Treppen-Inspektor (Bauart Gerade/L/U, Breite, Auftritt, Stufenanzahl, Drehrichtung, DIN-18065-Schrittmaß-Check).

---

## 4. Geschoss-übergreifende Kollision, Ergonomie & Exporte (Sprint 14)

### 4.1 Kollision & DIN-18065-Prüfung (`collisionEngine.ts`)
* `evaluateFloorplanCollisions` gruppiert Elemente nach `levelId` und prüft Wände/Öffnungen/Möbel/Teppiche/Dachschrägen/MEP-Fixtures strikt innerhalb ihrer Etage.
* Treppen werden auf `fromLevelId` und `toLevelId` geprüft:
  * Kollision mit Wänden/Möbeln auf Start- und Ziel-Etage (`stair-blocked`).
  * Kopffreiheitsprüfung (`>= 200 cm` über der Lauffläche am Deckenloch).
  * DIN-18065-Schrittmaß-Warnung (`2s + a < 59` oder `> 65 cm`).

### 4.2 Ergonomie 2.0 (`ergonomicsEngine.ts`, `ergonomicsScorecard.ts`)
* Wertet jedes Geschoss über `scopeFloorplanToLevel` aus und berücksichtigt Treppen auf beiden Etagen als Durchgangs-/Erreichbarkeits-Seeds (`toLevelId` erhält Seed am Treppenantritt/-austritt, sobald die Start-Etage erreichbar ist).

### 4.3 Exporte (`planSvgExport.ts`, `dxfExport.ts`, `bomExport.ts`, `scene3dExport.ts`)
* **SVG- & DXF-Export:** Erhalten optional `levelId` (Standard: aktives Geschoss) und zeichnen Treppen mit DIN-Symbolik (Layer `STAIRS` im DXF, `.arch-stair` im SVG) sowie den Geschossnamen im Plankopf.
* **BOM-Stückliste (CSV/MD):** Weist Geschossname pro Raum/Möbel/Treppe aus und summiert Wohnflächen über alle Etagen.
* **3D/AR-Export (`.glb`/`.usdz`):** Da `Scene3D.tsx` die Geschoss-Gruppen innerhalb von `exportable-architecture-root` rendert (`y = level.elevationCm`), werden mehrgeschossige Gebäude inkl. Decken und Treppen direkt im korrekten Meter-Maßstab (`0.01`) exportiert.

---

## 5. Verifikation
* Pro Sprint dedizierte Vitest-Suite (`sprint12MultiFloorStore.test.ts`, `sprint13StairsAndSlabs.test.ts`, `sprint14MultiFloorExportErgonomics.test.ts`), i18n-Key-Parität (`de.ts` / `en.ts`), Wiki-Synchronisation sowie `npm run build` & `npm test` nach jedem Sprint.

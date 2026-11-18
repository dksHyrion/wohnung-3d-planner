# App-State, 2D-Grundriss-Editor & 3D-Viewport-Architektur

**Quellen:** [2026-10-20-threejs-research-report.md](../../raw/2026-10-20-threejs-research-report.md)  
**Verwandte Konzepte:** [coordinate-system-cm.md](../concepts/coordinate-system-cm.md), [wall-graph-topology.md](../concepts/wall-graph-topology.md), [collision-detection.md](../concepts/collision-detection.md)

---

## 1. Schichtenarchitektur (`src/`)

Die Anwendung trennt mathematische Geometrie-/Kollisionslogik strikt vom UI-State und den Render-Komponenten:

1. **`src/core/` (Pure Domain Logic):**
   * `types.ts`: Domänenmodelle (`Corner`, `Wall`, `WallOpening`, `OpeningType`, `FurnitureItem`, `AreaRug`, `RoofSlope`, `AlignmentGuide`, `FurnitureCollisionReport`, `BackgroundImageOverlay`, `PassageClearance`, `PassageClearanceReport`).
   * `geometry2d.ts`: Gemeinsame 2D-Schnittgeometrie (`segmentsIntersect2D`).
   * `wallMath.ts`, `wallMiter.ts`, `wallSubSegments.ts`: 1D-Wandprojektion (`checkWallFitCm`), Wandlängen-Änderung (`setWallLengthCm`), automatischer X-Schnitt (`splitCrossingWalls`), Winkelhalbierenden-Gehrungen (`computeWallMiterMap`), Öffnungs-Subsegmente (`computeWallSubSegments`), Mehrraum-/Loch-Extraktion (`computeFloorPolygons` mit `holes`/`netHoles`), Snapping (`findWallSnap`) und Cutaway (`shouldCutawayWall`).
   * `roofSlopeMath.ts`: Dachschrägen-Ebenen (`resolveRoofSlopePlanes`), Höhenabfrage (`getEffectiveCeilingHeightAt`), 2D-Höhenlinien (`1,00 m` / `2,00 m`), 3D-Flächenquads und WoFlV § 4 Berechnung (`computeRoomWoFlVBreakdown`).
   * `alignmentMath.ts`: Kante-an-Kante-Möbel-Snapping und Achsen-/Fluchtlinien-Berechnung (`getFurnitureWorldBoundsXZ`, `computeFurnitureAlignment`, `DEFAULT_FURNITURE_SNAP_THRESHOLD_CM = 8`).
   * `doorLeaf.ts`: Türblatt-Geometrie (`doorLeafPose`, `doorSwingFloorSegments`) sowie Öffnungstyp-Klassifikation (`OPENING_TYPE_LABELS`, `openingHasSwingArc`, `openingLetsLightThrough`, `openingIsWalkthrough`).
   * `collisionEngine.ts`: `THREE.OBB`-Erzeugung (inkl. hohler Wandöffnungen und `roof-slope-exceeded`-Höhenprüfung) und gesamter Kollisionsbericht (`evaluateFloorplanCollisions`). Die Möbelkästen kommen aus `furnitureShapes.ts`.
   * `ergonomicsEngine.ts` & `ergonomicsScorecard.ts`: Analytische DIN 18040 Engstellen-Analyse (`evaluatePassageClearances`) sowie Ergonomie 2.0 (`evaluateErgonomicsScorecard`: 2D-EDT-Erreichbarkeit, C-Space-Lieferweg, DIN 18040-2 150-cm-Wendekreis, Stuhl-Rückzugsraum, Klapp-Diff und Scorecard `A`–`D`).
   * `export/` (`planSvgExport.ts`, `wallExportPolygons.ts`, `dxfExport.ts`, `bomExport.ts`, `scene3dExport.ts`, `urlSnapshot.ts`): Gehrungs-/öffnungsgeschnittener SVG-Plan, AutoCAD R12 DXF-Export, CSV/Markdown-Stückliste & Flächen-/WoFlV-Bilanz, `cm->m`-skalierter GLB/USDZ-3D/AR-Export sowie komprimierter URL-Hash-Snapshot.
   * `groupTransformMath.ts`: Gruppen-Schwerpunkt, Pivot-Rotation und Compound-Marquee-Selektion.
   * `canvas2dMath.ts`: Pure 2D-SVG-Koordinatenprojektion, Zoom/Pan und Zoom-Grenzen (`clampViewBox`, `clientPointToSvgWorldCm`).
   * `furnitureShapes.ts`, `furnitureVisual.ts`, `furnitureVisualCatalog.ts`, `knownFurniture.ts`: Gemeinsames Compound-Layout, `visual`-Entkopplung, Katalog-Validierung und Osaka-/Masterlift-Spezifikationen.
   * `overlayImageStore.ts` & `tracingMath.ts`: IndexedDB-Bildspeicher und 2-Punkt-Referenzkalibrierung.
   * `customModelStore.ts` & `materials/wallFinishes.ts`: IndexedDB-Speicher für hochgeladene Custom-`.glb`-Möbel samt Auto-cm-Einpassung sowie seitengetrennte Wandbeläge (`posFinish` / `negFinish`).
   * `catalog.ts`, `presets.ts`, `floorplans/`: Katalog und Grundriss-Presets.
2. **`src/store/` (Single Source of Truth mit `Zustand`):**
   * `state.ts` hält `FloorplanState`, `CameraPreset` und `SelectableEntityType`. `geometry.ts`, `view.ts`, `history.ts` und `deps.ts` importieren den Typ von dort.
   * `useFloorplanStore.ts` baut den Store mit `createStore` und exportiert den Hook `useFloorplanStore`. Die Aktionsnamen bleiben. `getState`, `setState`, `subscribe` und `getInitialState` bleiben am Hook. Ergänzt sind `moveCorner(id, x, z, { recordHistory?: boolean })` und `moveFurniture(id, x, z, snapThresholdCm, { recordHistory?: boolean })` gegen Undo-Flutung beim Ziehen, `removeWall`, `removeCorner`, `selectRoom`, `updateRoom` sowie `propagateAttachedChildren` für gekoppelte Objekte (`attachedToId`).
   * `getInitialState` auf dem Store-Objekt gibt `getState()` zurück. `renderToStaticMarkup` liest diese Funktion. Eine spätere Zuweisung nur am Hook trifft sie nicht.
   * `geometry.ts`: Schlanker Orchestrator (< 50 Zeilen), der die Domain-Slices aus `src/store/slices/` aggregiert (`furnitureSlice.ts`, `wallSlice.ts`, `rugSlice.ts`, `presetSlice.ts`) und `propagateAttachedChildren` re-exportiert.
   * `src/store/slices/`:
     * `furnitureSlice.ts`: Möbel-CRUD, Katalog-Reset, Reale Möbel und Hierarchische Objektkopplung (`propagateAttachedChildren`).
   * `wallSlice.ts`: Wände (inkl. Wandstärken-Sync auf gesnappte Möbel & Kinder), Ecken, Öffnungen, `RoofSlope`-CRUD (`addRoofSlope`, `updateRoofSlope`, `removeRoofSlope`) und Raum-Labels.
   * `rugSlice.ts`: Teppich-Verwaltung (`AreaRug`).
   * `presetSlice.ts`: Preset-Laden, DIN 18040 Laufwege-Heatmap (`passageReport`) und Ergonomie-Scorecard (`ergonomicsScorecard`).
   * `view.ts`: Ansicht, Werkzeug, Kamera (`cameraEyeLevelCm`), `showDecor`, `alignSunWithWindows`, `roomLightsActive`, Licht, Maßband und Raster.
   * `history.ts` & `planImport.ts`: Undo/Redo, LocalStorage/Dev-Autosave (`planFile.ts`), JSON inkl. `roofSlopes`, `attachedToId` und `roomLabels[].flooringType`.
   * `setWithCollisions` aktualisiert Kollisionen (`collisionReports`) sowie bei aktivem `showPassageHeatmap` gleichzeitig `passageReport` und `ergonomicsScorecard`, gefolgt von `gcOverlays`.
3. **`src/components/` (Synchronisierte Views) & E2E (`e2e/`):**
   * `layout/TopBar.tsx`, `LightingControls.tsx`, `PlanExportDialog.tsx` (SVG, DXF, BOM CSV/Markdown), `JsonPlanDialog.tsx`, `KeyboardShortcutsDialog.tsx`, `MobileNoticeBanner.tsx`.
   * `editor2d/FloorplanCanvas2D.tsx`, `FloorplanSvg2D.tsx` und `editor2d/layers/` (`RoomsAndBackgroundLayers.tsx`, `WallsOpeningsRugsLayers.tsx`, `FurnitureAndOverlaysLayers.tsx` inkl. 150-cm-Wendekreis & 1m/2m-Dachschrägenlinien) plus `BackgroundOverlayControls.tsx`.
   * `viewer3d/Scene3D.tsx`, `WallMesh3D.tsx`, `RoofSlopeMesh3D.tsx`, `DoorLeaf3D.tsx`, `WindowFrame3D.tsx`, `FurnitureMesh3D.tsx`, `PassageClearance3D.tsx`, `PostFX3D.tsx`.
   * `sidebar/InspectorSidebar.tsx`, `WallInspector.tsx` (inkl. Dachschrägen-Editor), `OpeningInspector.tsx`, `FurnitureInspector.tsx`, `RoomInspector.tsx` (inkl. WoFlV-Bilanz), `RugInspector.tsx`, `ErgonomicsScorecardSection.tsx`.
   * `e2e/app.spec.ts` & `playwright.config.ts`: Automatisierte Headless-Chromium-Tests (WebGL-Smoke, 2D-Drag + `clientToWorldCm` + Undo/Redo, SVG-Export-Download, Dachschrägen-Erstellung).

---

## 2. Wichtige Implementierungsdetails (2D/3D & VPS-Betrieb)

* **Mehrraum-Rendering in 2D & 3D:** Sowohl `FloorplanCanvas2D.tsx` als auch `Scene3D.tsx` rufen `computeFloorPolygons(corners, walls)` auf. Im 2D-Grundriss erhält jeder Raum automatisch ein Flächen-Badge im Schwerpunkt mit der lichten Wohnfläche (z. B. `Raum 1: 24,3 m²`, `Raum 2: 22,0 m²`).
* **Grundriss-Tracing & Pointer-Events:** Das SVG-`<image>` des Unterlegers wird unterhalb der Wände und Möbel gerendert. Im gesperrten Zustand (`locked === true`) ist `pointer-events: none` aktiv, sodass Klicks zur Eck- und Wandplatzierung ungehindert durchgreifen. Im entsperrten Zustand kann das Bild frei verschoben werden.
* **3D-Ergonomie-Visualisierung & WCAG AA Kontrast:** Die lichten Durchgänge werden in `PassageClearance3D.tsx` als transparente Streifen bei $Y = 0.4\text{ cm}$ mit `depthWrite={false}` gerendert, um Z-Fighting mit Bodenbelägen und Teppichen auszuschließen. Zur Gewährleistung von WCAG AA Kontrastverhältnissen (> 4.5:1) steuert `getPassageBadgeTextColor` auf gelben/amberfarbenen Warn-Badges dunkle Textfarbe (`#0f172a`) anstelle von weißem Text an.
* **3D-HTML-Badges in `OrthographicCamera` vs. `PerspectiveCamera`:** In `FurnitureMesh3D.tsx` wird `<Html center>` aus `@react-three/drei` bewusst **ohne** `distanceFactor` genutzt. Grund: `@react-three/drei` multipliziert `distanceFactor` bei einer `OrthographicCamera` direkt mit `camera.zoom`, was bei großen Zentimeter-Werten (z. B. `800`) zu einer 600-fachen Vergrößerung führt. Ohne `distanceFactor` bleibt die Schriftgröße in Isometrie und Perspektive konstant 1:1 lesbar.
* **Start auf dem VPS & lokaler Zugriff (Windows PowerShell):**
  * Server auf dem VPS starten: `npm run dev -- --host 127.0.0.1 --port 5173`
  * SSH-Tunnel vom lokalen Windows-PC aufbauen: `ssh -L 5173:127.0.0.1:5173 <user>@<vps-host>`
  * Im lokalen Browser öffnen: `http://localhost:5173`

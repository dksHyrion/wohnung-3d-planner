# App-State, 2D-Grundriss-Editor & 3D-Viewport-Architektur

**Quellen:** [2026-10-20-threejs-research-report.md](../../raw/2026-10-20-threejs-research-report.md)  
**Verwandte Konzepte:** [coordinate-system-cm.md](../concepts/coordinate-system-cm.md), [wall-graph-topology.md](../concepts/wall-graph-topology.md), [collision-detection.md](../concepts/collision-detection.md)

---

## 1. Schichtenarchitektur (`src/`)

Die Anwendung trennt mathematische Geometrie-/Kollisionslogik strikt vom UI-State und den Render-Komponenten:

1. **`src/core/` (Pure Domain Logic):**
   * `types.ts`: Domänenmodelle (`Corner`, `Wall`, `WallOpening`, `OpeningType`, `FurnitureItem`, `AreaRug`, `AlignmentGuide`, `FurnitureCollisionReport`, `BackgroundImageOverlay`, `PassageClearance`, `PassageClearanceReport`).
   * `wallMath.ts`: 1D-Wandprojektion (`checkWallFitCm`), Wandlängen-Änderung (`setWallLengthCm`), Snapping (`findWallSnap`) und Cutaway-Berechnung (`shouldCutawayWall`).
   * `alignmentMath.ts`: Kante-an-Kante-Möbel-Snapping und Achsen-/Fluchtlinien-Berechnung (`getFurnitureWorldBoundsXZ`, `computeFurnitureAlignment`, `DEFAULT_FURNITURE_SNAP_THRESHOLD_CM = 8`).
   * `doorLeaf.ts`: Türblatt-Geometrie (`doorLeafPose`, `doorSwingFloorSegments`) sowie Öffnungstyp-Klassifikation (`OPENING_TYPE_LABELS`, `openingHasSwingArc`, `openingLetsLightThrough`, `openingIsWalkthrough`).
   * `collisionEngine.ts`: `THREE.OBB`-Erzeugung und gesamter Kollisionsbericht (`evaluateFloorplanCollisions`). Die Möbelkästen kommen aus `furnitureShapes.ts`.
   * `furnitureShapes.ts`: ein Layout für Bild und Kollision bei Esstisch, Ecksofa und Bett.
   * `furnitureVisual.ts`: gültiges `visual` oder `box`. Die erlaubten Werte kommen aus `furnitureVisualCatalog.ts`.
   * `furnitureVisualCatalog.ts`: für jedes `FurnitureVisualType` die deutsche Bezeichnung, `modelType` und `genericSubType`. `VALID_FURNITURE_VISUAL_TYPES` und `FURNITURE_VISUAL_OPTIONS` entstehen aus den Schlüsseln. Fehlt ein Schlüssel, bricht `tsc` ab.
   * `knownFurniture.ts`: Osaka-Posen und Masterlift-Höhenbereich.
   * `overlayImageStore.ts`: Pixel der Grundrissbilder, IndexedDB `wohnung-planer` / `overlay-images`.
   * `tracingMath.ts`: 2-Punkt-Referenzskalierung (`calculateScaleFromReference`) und Viewport-Einpassung (`fitOverlayToViewport`) für Grundriss-Unterleger.
   * `ergonomicsEngine.ts`: Analytische Engstellen- und Laufwege-Berechnung nach DIN 18040 und Neufert (`evaluatePassageClearances`) mit SAT-Minimaldistanz und Ampel-Klassifizierung.
   * `catalog.ts`: `FURNITURE_CATALOG`. `floorplans/`: je eine Datei für `standard-55`, `luxury-villa`, `studio-apartment`, `rectangular-room` und `empty-room`. `presets.ts` leitet nur weiter, damit alte Importe gelten.
2. **`src/store/` (Single Source of Truth mit `Zustand`):**
   * `state.ts` hält `FloorplanState`, `CameraPreset` und `SelectableEntityType`. `geometry.ts`, `view.ts`, `history.ts` und `deps.ts` importieren den Typ von dort.
   * `useFloorplanStore.ts` baut den Store mit `createStore` und exportiert den Hook `useFloorplanStore`. Die Aktionsnamen bleiben. `getState`, `setState`, `subscribe` und `getInitialState` bleiben am Hook. Ergänzt sind `moveCorner(id, x, z, { recordHistory?: boolean })` und `moveFurniture(id, x, z, snapThresholdCm, { recordHistory?: boolean })` gegen Undo-Flutung beim Ziehen, `removeWall`, `removeCorner`, `selectRoom`, `updateRoom` sowie `propagateAttachedChildren` für gekoppelte Objekte (`attachedToId`).
   * `getInitialState` auf dem Store-Objekt gibt `getState()` zurück. `renderToStaticMarkup` liest diese Funktion. Eine spätere Zuweisung nur am Hook trifft sie nicht.
   * `geometry.ts`: Schlanker Orchestrator (< 50 Zeilen), der die Domain-Slices aus `src/store/slices/` aggregiert (`furnitureSlice.ts`, `wallSlice.ts`, `rugSlice.ts`, `presetSlice.ts`) und `propagateAttachedChildren` re-exportiert.
   * `src/store/slices/`:
     * `furnitureSlice.ts`: Möbel-CRUD, Katalog-Reset, Reale Möbel und Hierarchische Objektkopplung (`propagateAttachedChildren`).
     * `wallSlice.ts`: Wände, Ecken, Öffnungen und Raum-Labels.
     * `rugSlice.ts`: Teppich-Verwaltung (`AreaRug`).
     * `presetSlice.ts`: Preset-Laden und DIN 18040 Laufwege-Heatmap.
   * `view.ts`: Ansicht, Werkzeug, Kamera, Licht, Maßband und Raster.
   * `history.ts`: Undo, Redo, LocalStorage und JSON, dazu Unterleger und Kalibrierung. `importJson` ruft `parsePlanJson` aus `planImport.ts` und schreibt das Ergebnis wie bisher, inklusive Unterleger, `attachedToId` und `roomLabels[].flooringType`.
   * `planImport.ts`: `parsePlanJson`. Ein `visual` bleibt nur, wenn es in `VALID_FURNITURE_VISUAL_TYPES` steht. Sonst bleibt das Feld leer. Ungültiges JSON oder fehlende Arrays ergeben `null`.
   * Der Store hält `corners`, `walls`, `openings`, `furniture`, `backgroundImage`, `overlayError`, `calibrationPoints`, `showPassageHeatmap`, `passageReport`, Auswahl, `viewMode` und `activeTool`.
   * `setWithCollisions` ist der eine Weg, der Kollision und Laufwege zusammen schreibt und danach `gcOverlays` ruft. Ist die Heatmap an, kommt `passageReport` aus `evaluatePassageClearances` ohne eigene Distanz. Es gilt `DEFAULT_MAX_PASSAGE_DISTANCE_CM` (120) aus `ergonomicsEngine.ts`. Die zweite Signatur der Funktion bleibt.
   * Undo und Redo schieben nur den Schnappschuss und rufen `setWithCollisions` mit `recordHistory = false`.
   * `setShowPassageHeatmap` ruft `set`, nicht `setWithCollisions`. Einschalten rechnet die Laufwege einmal und schreibt keinen Verlauf. Ausschalten setzt `passageReport` auf null.
   * Verlauf, Export und `wohnung_autosave` speichern die Unterleger-Lage und `imageId`, keine Pixel.
3. **`src/components/` (Synchronisierte Views):**
   * `layout/TopBar.tsx` bleibt die öffentliche Leiste: Ansicht, Werkzeug, Preset, Cutaway, Unterleger-Upload, Laufwege-Taste und die Dialoge. Die Laufwege-Zahl kommt aus `passageReport`. Ein Speicherfehler des Unterlegers steht als Satz neben der Taste. Exportiert bleiben `formatTimeOfDay`, `MOOD_PRESET_BUTTONS`, `capture3DCanvasSnapshot` und `handleOverlayImageFile`. `CameraPreset` wird von hier weitergegeben.
   * `layout/LightingControls.tsx`, `layout/PlanExportDialog.tsx`, `layout/JsonPlanDialog.tsx`: Licht, Planexport und JSON-Dialog. Der Zustand der Dialoge bleibt in der Leiste.
   * `editor2d/FloorplanCanvas2D.tsx` behält Zeiger, Zoom, Ziehen und den Kalibrierdialog. `editor2d/FloorplanSvg2D.tsx` zeichnet Raster, Unterleger, Wände, Türsymbol, Möbel und die Laufwege.
   * `editor2d/BackgroundOverlayControls.tsx`: Schwebende Werkzeugleiste im 2D-Canvas zur Steuerung des Unterlegers (Deckkraft-Schieberegler 10%–100%, Sperren/Entsperren, Sichtbarkeit, Kalibrier-Auslöser, Löschen).
   * `viewer3d/Scene3D.tsx`, `WallMesh3D.tsx`, `FurnitureMesh3D.tsx`: React-Three-Fiber-Szene mit umschaltbarer Orthographic-/Perspective-Kamera, prozeduralen Wand-Meshes inkl. Tür-/Fenster-Ausschnitten, 3D-Möbel-Dragging auf der XZ-Ebene und HTML-Maß-/Kollisions-Badges.
   * `viewer3d/DoorLeaf3D.tsx` zeichnet das Türblatt, `viewer3d/WindowFrame3D.tsx` den 3D-Fensterrahmen mit Mittelpfosten, Griff und Fensterbank. `WallMesh3D` bindet beide ein. Die Türrechnung bleibt in `src/core/doorLeaf.ts`. `WallMesh3D` gibt `DOOR_SWING_LINE_COLOR` (`#c9bfb2`) und `DOOR_SWING_LINE_WIDTH_CM` (`1.2`) weiter.
   * `computeWallCaps(Wandhöhe, Wandstärke, Wandstücke)` behält die Stücke, deren Oberkante auf der Wandhöhe liegt. `computeCutawayCaps` bekommt Wandlänge, Wandstärke und die Öffnungen. Eine Öffnung teilt die Schnittkappe nur bei einer Brüstung unter 5 cm. Farbe `#2e2a26`, Höhe `1.5` cm, die Kappe ist `0.4` cm dicker als die Wand. Die Schnittkante liegt auf `30` cm. Die Einzelheiten stehen in [wall-graph-topology.md](../concepts/wall-graph-topology.md).
   * `viewer3d/furniture/furnitureRegistry.tsx` hält `FURNITURE_MODELS`, eine Komponente je `FurnitureVisualType`. `ArchitecturalFurniture3D` zeichnet den Eintrag. Die Auflöser `resolveFurnitureModelType` und `resolveGenericFurnitureSubType` lesen den Katalog und liefern dieselben Schlüssel wie vorher (`sofa`, `generic`, `desk`, `musterring-sorrent` und die übrigen). Name, Marke und Maße wählen kein Modell.
   * `viewer3d/PassageClearance3D.tsx`: 3D-Ergonomie-Visualisierung auf dem Raumboden ($Y = 0.4\text{ cm}$, `depthWrite={false}`) mit mitdrehenden R3F Drei-`<Html>`-Badges. `Scene3D` importiert die Datei unter diesem Namen.
   * `sidebar/InspectorSidebar.tsx` bleibt die öffentliche Seitenleiste und exportiert `filterCatalogTemplates` und `CatalogFilterTab`. `WallInspector.tsx`, `OpeningInspector.tsx`, `FurnitureInspector.tsx`, `RoomInspector.tsx` und `RugInspector.tsx` zeichnen Wand, Öffnung (inkl. Bauart-Umschaltung `door` | `window` | `sliding-door` | `passage` | `balcony-door`), Möbel, Raum (inkl. Bodenbelags-Wahl `parquet` | `microcement` | `tile` und Objekt-Kopplung `attachedToId`) sowie Teppiche (`AreaRug` mit `addRug`, `updateRug`, `moveRug`, `removeRug` und `RUG_COLOR_PRESETS`). Osaka und Masterlift stehen im Möbel-Inspektor. Die Bildauswahl kommt aus `FURNITURE_VISUAL_OPTIONS`. Der leere Eintrag heißt „Auto (Katalog / Kategorie)“ und schreibt `visual: undefined`.

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

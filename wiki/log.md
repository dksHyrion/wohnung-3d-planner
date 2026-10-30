# Wiki Audit-Log (`wiki/log.md`)

Chronologisches Append-Only-Protokoll aller Änderungen an der Wissensbasis gemäß [SCHEMA.md](../SCHEMA.md).

---

## [2026-10-30] Pakete 3C & 3D: GitHub-Referenzanalyse, Smart Alignment Guides & Kante-an-Kante Möbel-Snapping, Erweiterte Wandöffnungen & Interaktiver Teppich-Editor (Tagesabschluss)

- **Action:** `INGEST`, `FEATURE`, `GEOMETRY`, `UI`, `LINT` & `TAGESABSCHLUSS`
- **GitHub-Recherche & Architektur-Benchmark (`raw/` & `wiki/architecture/`):**
  - Neue unveränderliche Rohquelle [`raw/2026-10-30-github-floorplan-comparison.md`](../raw/2026-10-30-github-floorplan-comparison.md) und kompilierte Architekturseite [`wiki/architecture/github-reference-comparison.md`](architecture/github-reference-comparison.md) angelegt und in [`wiki/index.md`](index.md) indexiert.
  - Systematischer Vergleich mit `laanlabs/openPlan3D`, `charmlinn/blueprint3d-modern` (`furnishup/blueprint3d`), `cvdlab/react-planner`, `threejs-sims-house-builder` und `SweetHome3D` sowie Dokumentation unserer Alleinstellungsmerkmale und des Backlogs (Pakete 3A, 3B, 3E, 3F).
- **Paket 3C (Smart Alignment Guides & Kante-an-Kante Möbel-Snapping):**
  - Neue reine Geometrie-Engine `src/core/alignmentMath.ts` (`getFurnitureWorldBoundsXZ`, `computeFurnitureAlignment`, `DEFAULT_FURNITURE_SNAP_THRESHOLD_CM = 8`).
  - Beim Verschieben eines Möbels (`moveFurniture` in `src/store/geometry.ts`) mit aktivem `snapToWallEnabled` rasten Möbel auf derselben Wand bündig Kante an Kante auf exakt $0\text{ cm}$ Spalt (`kind: 'flush'`) oder mittig (`kind: 'center'`) ein; frei im Raum stehende Möbel rasten auf Mittelachsen (`kind: 'center'`), Fluchtkanten (`kind: 'edge'`) und bündigen Kontakt (`kind: 'flush'`) ein.
  - Aktive Hilfslinien (`activeAlignmentGuides: AlignmentGuide[]`) werden in 2D (`FloorplanSvg2D.tsx`) und 3D (`Scene3D.tsx`) gezeichnet und beim Loslassen (`clearAlignmentGuides` in `FloorplanCanvas2D.tsx` und `Scene3D.tsx`) geleert.
- **Paket 3D-A (Erweiterte Wandöffnungen: `sliding-door`, `passage`, `balcony-door`):**
  - `OpeningType` in `src/core/types.ts` erweitert auf `'door' | 'window' | 'sliding-door' | 'passage' | 'balcony-door'`.
  - Klassifikations-Helfer in `src/core/doorLeaf.ts`: `OPENING_TYPE_LABELS`, `openingHasSwingArc` (`true` nur für `'door'` und `'balcony-door'`), `openingLetsLightThrough` (`true` für `'window'` und `'balcony-door'`), `openingIsWalkthrough` (`true` für alle außer `'window'`).
  - `src/core/collisionEngine.ts` erzeugt für `'sliding-door'` und `'passage'` keinen 90°-Türschwenksektor im Raum, während `checkWallFitCm` in `src/core/wallMath.ts` weiterhin die 1D-Wandöffnung gegen zugestellte Möbel schützt.
  - `StudioStage3D.tsx` (`computeDominantWindowDirection`) und `Scene3D.tsx` (`WindowLightPool3D`) berücksichtigen `'balcony-door'` als Tageslichtöffnung.
  - Vollständige Darstellung und Umschaltung aller 5 Bauarten in `OpeningInspector.tsx`, `WallInspector.tsx`, `FloorplanSvg2D.tsx`, `DoorLeaf3D.tsx`, `planSvgExport.ts` und `planImport.ts`.
- **Paket 3D-B (Interaktiver Teppich-Editor / `AreaRug`):**
  - `SelectableEntityType` um `'rug'` erweitert; Store-Aktionen `addRug`, `updateRug`, `moveRug(id, x, z, { recordHistory })` und `removeRug` in `src/store/geometry.ts` ergänzt.
  - Interaktive Auswahl, Drag-and-Drop (ohne Undo-Flutung) und `Delete`/`Backspace`-Löschung für Teppiche in 2D (`FloorplanSvg2D.tsx`, `FloorplanCanvas2D.tsx`) und 3D (`RugMesh3D.tsx`, `Scene3D.tsx`).
  - Neuer `src/components/sidebar/RugInspector.tsx` mit Maßen, Position, 90°-Drehung, 6 Architektur-Farbpresets (`RUG_COLOR_PRESETS`) und `+ Teppich`-Button in `InspectorSidebar.tsx`.
  - Maßstabsgetreuer Export aller Teppiche (`.arch-rug`) in `src/core/export/planSvgExport.ts`.
- **Nachgezogen:** `raw/2026-10-30-github-floorplan-comparison.md`, `wiki/architecture/github-reference-comparison.md`, `wiki/concepts/collision-detection.md`, `wiki/concepts/wall-graph-topology.md`, `wiki/concepts/precision-editor-and-scale-export.md`, `wiki/architecture/app-state-and-views.md`, `wiki/index.md`, `README.md`.
- **Prüfung am 30.10.2026:** `tsc -b` ohne Fehler, `vitest run` 448 Tests in 41 Dateien grün, `npm run build` durch.

## [2026-10-29] Pakete 1–3: 2D/3D-Präzision, Raum-Inspektor, Objekt-Kopplung (Surface Stacking), 3D-Fensterarchitektur, Boden-Bump-Maps & Kameradämpfung

- **Action:** `FEATURE`, `GEOMETRY`, `STACKING` & `ATMOSPHERE`
- **Paket 1 (Präzision, Editierbarkeit & 2D/3D-Einheit):**
  - **Undo-Historie ohne Drag-Flutung:** `moveCorner` und `moveFurniture` in `src/store/useFloorplanStore.ts` akzeptieren `options?: { recordHistory?: boolean }`. Im 2D-Editor (`FloorplanCanvas2D.tsx`) und 3D-Viewer (`FurnitureMesh3D.tsx`) wird zu Beginn einer Ziehbewegung einmalig `pushUndoSnapshot()` aufgerufen und während `PointerMove` mit `{ recordHistory: false }` verschoben, sodass der 30-Schritte-Undo-Ringpuffer exakt komplette Zieh-Transaktionen speichert.
  - **Ehrliche 2D-Architektursymbole & Compound-Geometrie:** `FloorplanCanvas2D.tsx` und `src/core/export/planSvgExport.ts` zeichnen Mehrteil-Möbel über `layoutFurnitureParts(item)` (Esstisch mit Stühlen, L-Ecksofa, Bett mit Kopfteil/Kissen/Nachttischen sowie ausgeklappte BoConcept Osaka Schlafcouch mit gestrichelter Matratzenfläche). In 3D (`BoConceptOsakaModel.tsx`) bleiben Sofa-Rücken und Armlehnen bei `pose === 'open'` auf 95 cm Tiefe stehen, während davor das ausgeklappte Bettgestell mit Matratze (`osaka-unfolded-bed`) auf 200 cm Gesamttiefe ausfährt. `computeFurnitureClearanceCm` und `computeFurnitureToWallDistanceCm` in `src/core/measureMath.ts` prüfen alle Teil-Polygone aus `layoutFurnitureParts`.
  - **Wand-/Ecken-Löschen & Raum-Inspektor:** Neue Store-Aktionen `removeWall`, `removeCorner`, `selectRoom` und `updateRoom`. Globale Tastatur-Shortcuts (`Delete`/`Backspace` zum Löschen ausgewählter Möbel, Öffnungen, Wände und Ecken; `Escape` zum Abbrechen/Abwählen) in `src/App.tsx`. Klickbare 2D-Raumstempel öffnen `src/components/sidebar/RoomInspector.tsx` zum Editieren von Raumname und Bodenbelag (`parquet` | `microcement` | `tile`, persistiert über `RoomLabel.flooringType` und `applyRoomLabels`).
- **Paket 2 (Physische Objekt-Kopplung / Surface Stacking):**
  - `FurnitureItem` um `attachedToId?: string | null` erweitert (in `standard-55` ist `f-std-monitor` ab Werk an `f-std-masterlift` gekoppelt).
  - `propagateAttachedChildren` in `src/store/useFloorplanStore.ts`: Verschieben eines Träger-Möbels (`moveFurniture`) nimmt gekoppelte Kind-Objekte mit; Drehen oder Höhenänderung (`updateFurniture` / Masterlift-Höhenschieber) rotiert Kind-Objekte um den Träger-Mittelpunkt und führt `elevationCm` automatisch auf der Trägeroberkante nach.
  - Inspector-UI in `src/components/sidebar/InspectorSidebar.tsx` („🔗 Objekt-Kopplung (Trägerfläche)“) zum Koppeln und Lösen von Objekten auf Tischen, Schreibtischen, Sideboards, Regalen und Küchen.
- **Paket 3 (3D-Architektur-Upgrade & Kamera-Gefühl):**
  - **Detaillierte 3D-Fenster (`src/components/viewer3d/WindowFrame3D.tsx`):** Eingebunden in `WallMesh3D.tsx` mit umlaufendem Fensterrahmen (`window-frame`), Mittelpfosten (`window-mullion` ab 90 cm Breite), Fenstergriff (`window-handle`) und innen-/außenseitiger Fensterbank (`window-sill`) bei unverändertem Single-Pass-Architekturglas (`window-glass`).
  - **Prozedurale Boden-Bump-Maps:** `getMicrocementBumpTexture`, `getParquetBumpTexture` und `getStoneTileBumpTexture` in `src/core/materials/proceduralTextures.ts`, eingebunden über `getFloorMaterialProps` in `src/components/viewer3d/Scene3D.tsx` für plastisches Sonnen-Streiflicht.
  - **Sanfte Kameradämpfung & Raum-Fokus:** Exponentiell gedämpfte Kamera-Interpolation in `CameraController` (`Scene3D.tsx`), die bei Benutzer-Interaktion an den `OrbitControls` sofort freigegeben wird, sowie `focusPoint`-Unterstützung in `computeFirstPersonViewpoint` zur direkten Ausrichtung der Augenhöhen-Ansicht auf den ausgewählten Raum oder das ausgewählte Möbelstück.
- **Nachgezogen:** `wiki/architecture/app-state-and-views.md`, `wiki/concepts/wall-graph-topology.md`, `wiki/concepts/furniture-inventory-and-design-specs.md`, `wiki/concepts/precision-editor-and-scale-export.md`, `wiki/concepts/cinematic-lighting-and-atmosphere.md`, `wiki/index.md`, `README.md`.
- **Prüfung am 29.10.2026:** `tsc -b --noEmit` ohne Fehler, `vitest run` 436 Tests in 40 Dateien grün, Production-Build durch.

## [2026-10-28] Store, Möbeltabelle, Türblatt, zerlegte Oberfläche

- **Action:** `STRUCTURE`
- Das Verhalten bleibt. Kollision und Laufwege laufen über `setWithCollisions`. Undo und Redo schieben nur den Schnappschuss und rufen denselben Weg ohne neuen Verlauf auf. Die Heatmap-Taste bleibt bei `set`.
- `FloorplanState` steht in `src/store/state.ts`. Der JSON-Import steht in `src/store/planImport.ts`. Ein unbekanntes `visual` bleibt leer.
- `getInitialState` auf dem Store-Objekt gibt den aktuellen Plan zurück. Der Server-Render liest diese Funktion. Eine Zuweisung nur am Hook trifft sie nicht.
- Bezeichnung und Modellschlüssel stehen in `src/core/furnitureVisualCatalog.ts`. Die React-Komponenten stehen in `src/components/viewer3d/furniture/furnitureRegistry.tsx`. Zwei Dateien, weil eine React-Tabelle in `src/core` den Store beim Start im Kreis lädt. Fehlt ein `FurnitureVisualType`, bricht `tsc` ab.
- Das Türblatt liegt in `src/components/viewer3d/DoorLeaf3D.tsx`. `WallMesh3D` zeichnet es weiter. `computeWallCaps` und `computeCutawayCaps` sind getrennt. Farbe, Höhe und der Überstand der Kappe bleiben.
- Inspektor, Grundriss und Leiste sind zerlegt. Die öffentlichen Dateien bleiben `InspectorSidebar.tsx`, `FloorplanCanvas2D.tsx` und `TopBar.tsx`. Osaka und Masterlift bleiben im Möbel-Inspektor.
- Nachgezogen: `wiki/architecture/app-state-and-views.md`, `wiki/concepts/furniture-inventory-and-design-specs.md`, `wiki/concepts/wall-graph-topology.md`, `wiki/concepts/precision-editor-and-scale-export.md`, `wiki/index.md`, `README.md`.
- Prüfung am 28.10.2026: `tsc -b` ohne Fehler, `npm test` 426 Tests in 40 Dateien grün, `npm run build` durch.

## [2026-10-28] Plan als Datei, Tür im Wandschnitt frei

- **Action:** `PERSISTENCE` & `MODEL`
- Dieselbe automatische Sicherung schreibt `.autosave/plan.json` neben dem Programm. Liegt im Browser nur die Beispielwohnung, wird diese Datei gelesen. `plaene/wohnung.json` bleibt unangetastet.
- Die angeschnittene Wand und ihre Kappe enden an der Tür. Die Öffnung geht bis zum Boden.

## [2026-10-28] Ruhigeres Bild an Scheibe, Tür und Sockel

- **Action:** `ATMOSPHERE`
- Die Fensterscheibe hat den Ton der Wand, matt, eine Lage. Das helle Blau ist aus dem Glas.
- Vor der Tür liegt eine schmale Linie in warmem Grau auf dem Boden. Die orange Fläche ist aus dem 3D-Bild.
- Die Sockelleiste ist `#e4ddd4`, einen Ton unter der Wand, und ebenso matt.

## [2026-10-28] Beispielwohnung schreibt den gespeicherten Plan nicht mehr über

- **Action:** `PERSISTENCE`
- Ein Nachladen des Programms hatte den offenen Plan auf die Beispielwohnung zurückgesetzt und konnte diese danach über `wohnung_autosave` schreiben.
- Der gespeicherte Plan wird beim neuen Speicher wieder gelesen. Das unveränderte Beispiel ersetzt einen anderen gespeicherten Plan nicht.
- Der Text wird beim Verschieben festgehalten. Auch ein Nachladen mitten in der kurzen Wartezeit schreibt diesen Stand.

## [2026-10-28] Ruhigeres Bild, ohne neue Knöpfe

- **Action:** `ATMOSPHERE`
- Das Bild öffnet im vorhandenen Morgenlicht, 08:00. Der neutrale Knopf bleibt.
- Unter den Möbeln liegt auch im schnellen Modus ein Kontakt-Schatten. Im Schön-Modus bleibt er kräftiger.
- Vor jedem Fenster liegt ein Lichtfleck auf dem Boden. Er hat die Farbe der Sonne, läuft weich in den Raum und ist weg, wenn die Sonne aus ist.

## [2026-10-28] Plan bleibt nach dem Verschieben, Türblatt, Wandbild

- **Action:** `PERSISTENCE` & `MODEL`
- Eine Änderung am Plan schreibt nach 400 ms in `wohnung_autosave`. Auswahl und Kamera schreiben nicht. Beim Öffnen wird der Schlüssel einmal gelesen. Ohne Eintrag bleibt `standard-55`. Der gelesene Stand löscht den Undo-Stapel.
- Im 3D-Bild hat jede Tür ein 4 cm dickes Blatt, 72° in der Aufschlagrichtung geöffnet, plus Zarge und Griff. Der 2D-Plan zeigt das Blatt als Fläche im 90°-Symbol.
- Katalog, Platzhalter: „Wandbild“ 90×70×4 cm, Unterkante 115 cm, und „Galerieschiene“ 200 cm, Unterkante 230 cm. Beides ist kein Bestand. Maße und Farbe im Inspektor. An die Wand schieben rastet ein.

## [2026-10-28] Eine Form, ehrliche Maße, Bildspeicher, Laufwege einmal

- **Action:** `GEOMETRY` & `PERSISTENCE`
- Kollision und 3D-Bild für Esstischstühle, Ecksofa und Bett-Nachtkästen kommen aus `src/core/furnitureShapes.ts`. Ein Sofa mit `visual: 'sofa'` bleibt ein Kasten. `generic-bed` hat keine Nachtkästen.
- Die Osaka im Beispiel bleibt zugeklappt 190×95×90. Ausgeklappt werden Breite 170, Tiefe 200 und die nicht gemessene Höhe 90 geschrieben. Der Inspektor sagt das. Der Masterlift-Schieber läuft von 62,5 bis 127,5 cm, Start bleibt 73. Ein importierter Wert außerhalb bleibt stehen und wird beschriftet.
- Vitsœ 606 hat `isRealFurniture: false` und steht nicht unter „Mein Inventar“. Fehlt `visual` oder ist es unbekannt, wird eine Kiste gezeichnet. Ein gesetztes `visual` gilt.
- Grundrissbilder liegen in IndexedDB `wohnung-planer` / `overlay-images`, ersatzweise im Sitzungsspeicher. Export, die 30 Undo-Schritte und `wohnung_autosave` behalten Lage und `imageId`, keine `data:`-URL. Eine alte Data-URL wird beim Import in den Bildspeicher gelegt. Schlägt das Sichern fehl, bleibt der Plan stehen und die Leiste zeigt den Fehlersatz.
- Laufwege rechnet der Store, solange die Heatmap an ist. 2D, 3D und die Leiste lesen nur dieses Ergebnis. Schwelle bleibt 120 cm.
- Katalog, die fünf Grundrisse und der Store sind auf `src/core/catalog.ts`, `src/core/floorplans/` und `src/store/{geometry,view,history}.ts` verteilt. `presets.ts` leitet weiter. `standard-55` bleibt das Beispiel. `plaene/wohnung.json` gibt es nicht.
- Nachgezogen am selben Tag: `wiki/concepts/collision-detection.md`, `wiki/concepts/furniture-inventory-and-design-specs.md`, `wiki/concepts/precision-editor-and-scale-export.md`, `wiki/architecture/app-state-and-views.md`, `wiki/index.md`, `README.md`. Der Log-Eintrag vom 27.10.2026 beschreibt den früheren Data-URL-Weg. Der Bildspeicher auf dieser Seite gilt.

## [2026-10-27] Grundriss-Unterleger (Tracing & 2-Punkt-Kalibrierung) & DIN 18040 Ergonomie-Heatmap

- **Action:** `FEATURE` & `ERGONOMICS`
- **Plan:** [`docs/superpowers/plans/2026-10-27-tracing-and-ergonomics-plan.md`](../docs/superpowers/plans/2026-10-27-tracing-and-ergonomics-plan.md)
- **Tracing & Grundriss-Unterleger (Option 1):**
  - Laden von Grundriss-Grafiken (PNG, JPG, WebP, SVG) direkt über die TopBar („Unterleger“) als Base64-DataURL zur verlustfreien Persistenz in LocalStorage und JSON-Export.
  - Mathematische 2-Punkt-Referenzskalierung (`src/core/tracingMath.ts`): Klick auf zwei bekannte Punkte (z. B. Außenwand oder Türbreite) und Eingabe des Realmaßes in cm berechnet den exakten Maßstab `cmPerPixel` und skaliert das Bild maßstabsgetreu ins Zentimeter-Koordinatensystem.
  - Schwebende Toolbar (`src/components/editor2d/BackgroundOverlayControls.tsx`) mit Deckkraftregler (10%–100%), Sperr-/Entsperrfunktion (verhindert versehentliches Verschieben beim Wände-Nachzeichnen), Sichtbarkeits-Toggle und Löschfunktion.
  - Freies Verschieben des Unterlegers im entsperrten Zustand mit Undo/Redo-Anbindung.
- **Ergonomie-, Laufwege- & Engstellen-Heatmap (Option 3 nach DIN 18040 / Neufert):**
  - Analytische Prüfung aller lichten Durchgänge (`src/core/ergonomicsEngine.ts`) zwischen Möbel $\leftrightarrow$ Möbel und Möbel $\leftrightarrow$ Wand auf Basis der Separating-Axis-Theorem (SAT) Abstandsberechnung.
  - Intelligente Filterung: Möbel mit bündigem Wandanschluss ($\le 5\text{ cm}$) sowie vertikal gestapelte Einheiten (Schreibtischaccessoires, Regale) werden von Fehlalarmen ausgenommen.
  - DIN 18040 Ampel-Klassifizierung:
    - `< 60 cm`: Kritische Engstelle (Rot `#ef4444`, `⚠️ X cm`)
    - `60–90 cm`: Warnung / Eingeschränkter Durchgang (Gelb/Amber `#f59e0b`, kontrastreiche Schrift für WCAG AA, `⚡ X cm`)
    - `90–120 cm`: Optimaler barrierefreier Hauptlaufweg (Grün `#10b981`, `✓ X cm`)
  - 2D-Visualisierung: Gestrichelte Linien mit Endpunkten und zentrierten Pill-Badges im SVG-Canvas (`pointer-events: none`).
  - 3D-Visualisierung (`src/components/viewer3d/PassageClearance3D.tsx`): Flache Bodenstreifen ($Y = 0.4\text{ cm}$, `depthWrite={false}`) und R3F Drei `<Html>` Badges mit Raumtiefenanpassung.
  - TopBar-Integration: Toggle-Button „Laufwege“ mit Live-Counter kritischer Engstellen (`Laufwege (X ⚠️)`).

---

## [2026-10-25] Beispielwohnung: Gesture, Monitor, LIUM, Neona Viva

- **Action:** `PRESET` & `VISUAL`
- In der Beispielwohnung stehen vier weitere echte Stücke. Der Grundriss bleibt ein Beispiel.
- Steelcase Gesture vor dem Masterlift, Blick nach Osten. Bodenkasten 66 cm ist der Fußkreuz-Durchmesser. Mit Kopfstütze 107 cm hoch, Korpus laut Steelcase 62,5 cm tief. Sitzhöhe im Modell 46 cm, im Bereich 41,5 bis 51,8 cm. Bezugsfarbe nicht erfasst.
- Ein Monitor auf der Platte, 27 Zoll als Standardmaß. Diagonale und Marke stehen im Inventar nicht. Die Unterkante liegt auf 73 cm.
- Regalraum LIUM L-1x4, Bestellmaß 57×36×140, links vom Nordfenster. Die Zusatzteile in 86 cm sind nicht angebaut.
- Neona Viva neben der Osaka. Shopmaß 26,5×14×140, drei Kugeln ø12. Farbe nicht erfasst, Modell schwarz.
- Die Monstera im Wohnen steht weiter westlich, damit der Stuhl frei ist.

## [2026-10-25] Katalog: Osaka-Zweisitzer gelöscht

- **Action:** `PRESET`
- Die kleinere Osaka mit zwei Sitzen gehört nicht zum Bestand. Katalogeintrag, Villa und L-Wohnung sind den Zweisitzer los. Die Schlafcouch, zugeklappt rund 190×95×90, bleibt.

## [2026-10-25] Beispielwohnung: Osaka statt Platzhaltersofa

- **Action:** `PRESET`
- Maße: Höhe 90 cm, Tiefe 95 cm. Die Breite bleibt die genannten rund 190 cm. Das graue Katalogsofa ist raus. An derselben Westwand steht die BoConcept Osaka Schlafcouch, schwarz, Alu-Beine.
- Die Liegefläche 170×200 ist der ausgeklappte Zustand und belegt im Alltag keinen extra Platz.
- Der Katalog-Zweisitzer 170×77×87,5 bleibt für Penthouse und Villa.

## [2026-10-25] Beispielwohnung: Masterlift statt Katalogschreibtisch

- **Action:** `PRESET` & `VISUAL`
- Der Katalogschreibtisch ist raus. An der Ostwand steht der Inwerk Masterlift 2, weiße Platte 160×80. Das Nordfenster liegt seitlich zum Platz. Die Höhe 73 cm ist eine Sitzstellung im Herstellerbereich 62,5 bis 127,5 cm, nicht die gespeicherte Höhe.
- Die Gestellfarbe steht im Inventar nicht. Das Modell zeigt ein schwarzes Gestell.
- Die Osaka bleibt draußen. Im Inventar fehlen Tiefe und Höhe im zugeklappten Zustand. Der Katalog-Zweisitzer 170×87,5×77 ist ein anderes Stück.

## [2026-10-25] Wohnküche: Tolomeo, Gardinen, WC, Teppich

- **Action:** `PRESET` & `VISUAL`
- Die Artemide Tolomeo hängt über dem Esstisch. Rosette auf 245 cm, die Beispieldecke ist 250 cm. Im Penthouse hängt dieselbe Leuchte höher, weil dort die Decke 280 cm hat.
- Die Wellengardinen sind dieselben wie im Penthouse und hängen an jedem Fenster. Der Deko-Schalter startet jetzt an. Vorher war er nach dem Neuladen aus, deshalb fehlten die Gardinen.
- Das Wand-WC ist eine hängende Schale mit Brille und Deckel. Der Wohnteppich bleibt flach. Die Kantenrundung hatte ihn zu einer Platte aufgebläht.

## [2026-10-25] Standardwohnung: Wohnküche, Bad und Katalogmöbel

- **Action:** `PRESET` & `VISUAL`
- Die Wand zwischen Wohnen und Küche ist weg, ebenso beide Küchentüren. Gemessen: Schlafen 15,7 m², Wohnküche 27,3 m², Diele 6,5 m², Bad 6,0 m². Summe 55,5 m². Die Diele bleibt ein eigener Raum, die Küche ist eine Nische der Wohnküche.
- Neu im Katalog, jeweils Standardmaß und kein Produkt: Duschkabine 90×90, Wand-WC, Waschmaschine 60×60×85, Waschtisch 70, Couchtisch, kleinere Zimmerpflanze.
- Die Beispielwohnung trägt diese Stücke plus Küchenzeile, Sofa, Esstisch, Schreibtisch, zwei Sideboards, fünf Pflanzen und zwei Teppiche. Der Sorrent bleibt im Schlafen. Die freistehende Wanne bleibt im Katalog und steht in diesem Bad nicht.
- Weiterhin ein Beispiel, nicht der eigene Grundriss.

## [2026-10-25] Standardwohnung: fünf benannte Räume, Bad 6 m²

- **Action:** `PRESET`
- Der vorige Schnitt hatte ein 4,4-m²-Restbad und ein 31-m²-Wohnzimmer. Neu aufgeteilt und beschriftet: Schlafen 15,7 m², Wohnen 19,4 m², Küche 7,5 m², Diele 6,5 m², Bad 6,0 m². Summe 55,1 m².
- Bad lichte Maße 240 × 250 cm. Küche hat ein eigenes Fenster und Türen zur Diele und zum Wohnen. Weiterhin ein Beispiel, nicht der eigene Grundriss.

## [2026-10-25] Standardwohnung neu: Diele mit Tür in jeden Raum

- **Action:** `PRESET`
- Der erste 55-m²-Schnitt hatte keine Tür zwischen Diele und Wohnen. Der große Raum war geschlossen.
- Neuer Schnitt nach üblichem 2-Zimmer-Grundriss: Eingang in die Diele, Türen zu Schlafen, Bad und Wohnen, Fenster auf der gegenüberliegenden Seite. Weiterhin ein Beispiel, nicht der eigene Grundriss.

## [2026-10-25] Standardwohnung 55 m², Sorrent im Penthouse, Sockel weg

- **Action:** `PRESET` & `VISUAL`
- Startvorlage ist `standard-55`, Nettogrundfläche 55,3 m². Beispiel, nicht der eigene Grundriss. Der Sorrent steht im Schlafzimmer.
- Im Penthouse ersetzt der Sorrent den PAX an derselben Wand.
- Sofa ohne dunkles Sockelpodest. Bett auf Beinen statt auf einem Klotz.

## [2026-10-25] Musterring Sorrent 200 als echtes Möbel

- **Action:** `REAL_FURNITURE`
- **Quelle:** Inventar-Spezifikation (25.10.2026). Nur der kleinere Sorrent kommt mit.
- **Maße:** 200 × 67 × 217 cm (Breite × Tiefe × Höhe). Zwei Schiebetüren, keine Auszugszone.
- **Modell:** `src/components/viewer3d/furniture/MusterringSorrentModel.tsx`, Katalogeintrag `visual: musterring-sorrent`.
- **Annahme:** Spiegel auf der rechten Tür. Oberfläche hell matt. Beides steht in der Quelle nicht.

---

## [2026-10-20] Initial Ingest & Architecture Bootstrap

- **Action:** `INGEST` & `INIT`
- **Quellen (`raw/`):**
  - [`raw/2026-10-20-threejs-research-report.md`](../raw/2026-10-20-threejs-research-report.md)
  - [`raw/furniture-specs/din-and-neufert-standards.md`](../raw/furniture-specs/din-and-neufert-standards.md)
  - [`docs/superpowers/specs/2026-10-20-3d-wohnungsvisualisierung-design.md`](../docs/superpowers/specs/2026-10-20-3d-wohnungsvisualisierung-design.md)
- **Erstellte Wiki-Seiten:**
  - [`concepts/coordinate-system-cm.md`](concepts/coordinate-system-cm.md)
  - [`concepts/wall-graph-topology.md`](concepts/wall-graph-topology.md)
  - [`concepts/collision-detection.md`](concepts/collision-detection.md)
  - [`architecture/app-state-and-views.md`](architecture/app-state-and-views.md)
- **Zusammenfassung:** Initialisierung des Karpathy LLM-Wiki-Verzeichnisses. Festlegung der globalen Zentimeter-Konvention (`1 Unit = 1 cm`, `EPSILON_CM = 0.05`), der 1D-Skalarprodukt-Wandlängenprüfung (`checkWallFitCm`) und der 3D-OBB-Kollisionserkennung (`THREE.OBB`).

---

## [2026-10-20] Complete 2D SVG Editor, 3D R3F Scene & Centimeter Inspector UI

- **Action:** `IMPLEMENT` & `VERIFY`
- **Referenzierte Wiki-Seiten:**
  - [`architecture/app-state-and-views.md`](architecture/app-state-and-views.md)
  - [`concepts/coordinate-system-cm.md`](concepts/coordinate-system-cm.md)
  - [`concepts/wall-graph-topology.md`](concepts/wall-graph-topology.md)
  - [`concepts/collision-detection.md`](concepts/collision-detection.md)
- **Implementierte Module (`src/`):**
  - `src/components/layout/TopBar.tsx`, `src/components/editor2d/FloorplanCanvas2D.tsx`, `src/components/viewer3d/Scene3D.tsx`, `src/components/viewer3d/WallMesh3D.tsx`, `src/components/viewer3d/FurnitureMesh3D.tsx`, `src/components/sidebar/InspectorSidebar.tsx`, `src/App.tsx`, `src/main.tsx`
- **Zusammenfassung:** Vollständige Synchronisation zwischen 2D-SVG-Grundriss-Editor (10-cm-/100-cm-Raster, Wandzeichnen, Türschwenkbögen), 3D-React-Three-Fiber-Szene (kamerabasierter Cutaway-Modus auf `30 cm`, Tür-/Fenster-Subsegmente, XZ-Boden-Dragging) und Zentimeter-Inspektor-Sidebar inklusive Live-Kollisionsdiagnose.

---

## [2026-10-20] Multi-Room Floor Polygons (22,0 m² Anbau), Isometric Label Fix & Projekt-Dokumentation

- **Action:** `EXTEND`, `FIX` & `DOCUMENT`
- **Aktualisierte Wiki- & Doku-Seiten:**
  - [`concepts/wall-graph-topology.md`](concepts/wall-graph-topology.md)
  - [`architecture/app-state-and-views.md`](architecture/app-state-and-views.md)
  - [`README.md`](../README.md)
- **Geänderte Code-Module:**
  - `src/core/wallMath.ts` (`computeFloorPolygons`, `getInteriorWallIds`)
  - `src/core/presets.ts` (`studio-apartment` erweitert um rechts anschließenden `550 × 400 cm = 22,0 m²` Raum, Verbindungstür `op-door-connect`, Fenster und Doppelbett)
  - `src/components/viewer3d/FurnitureMesh3D.tsx` (`distanceFactor` entfernt für konsistente 1:1-Darstellung in `OrthographicCamera`)
  - `src/components/editor2d/FloorplanCanvas2D.tsx` & `src/components/viewer3d/Scene3D.tsx` (Mehrraum-Bodenpolygone, `m²`-Flächenanzeige & Innenwand-Cutaway-Schutz)
- **Zusammenfassung:** Erweiterung des Standard-Grundrisses auf zwei verbundene Räume (`25,9 m²` + `22,0 m²`), automatische Halbkanten-Facettenextraktion für beliebig viele Räume, Behebung des `<Html>`-Skalierungsfehlers in der 3D-Isometrie sowie vollständige Dokumentation für die nächste Session (24/24 Vitest-Tests grün).

---

## [2026-10-21] Lichte Wohnflächen nach WoFlV (`netAreaSqM`), 22,0 m² Innenmaß-Korrektur & Sicherheits-Polish

- **Action:** `ENHANCE`, `SECURITY` & `TEST`
- **Aktualisierte Wiki- & Doku-Seiten:**
  - [`concepts/coordinate-system-cm.md`](concepts/coordinate-system-cm.md) (§5 Wandachsen vs. Lichte Raumfläche)
  - [`concepts/wall-graph-topology.md`](concepts/wall-graph-topology.md) (§5 Lichte Wohnflächenberechnung & T-Verbindungs-Klarstellung)
  - [`architecture/app-state-and-views.md`](architecture/app-state-and-views.md) (Lichte Wohnflächen in 2D & Dev-Server-Bindung 127.0.0.1)
  - [`README.md`](../README.md) (VPS-IP/Root-Redaktion, 127.0.0.1 Dev-Server, 29 Tests)
- **Geänderte Code-Module:**
  - `src/core/wallMath.ts` (`computeFloorPolygons` um wandindividuelles Inward-Offsetting `thicknessCm / 2` erweitert: liefert `netCorners` und `netAreaSqM`; `computeFitViewBox` hinzugefügt)
  - `src/core/presets.ts` (`c8` auf `(1185, 0)`, `c9` auf `(1185, 415)`, `c7` auf `(620, 415)` korrigiert für exakt `550 × 400 cm = 22,00 m²` lichte Innenmaße; `op-win-4` frische ID)
  - `src/components/editor2d/FloorplanCanvas2D.tsx` (Flächen-Badge nutzt `netAreaSqM` mit deutscher Lokalisierung `toLocaleString('de-DE')`; Reset-View passt ViewBox dynamisch an Grundrissgrenzen an)
  - `tests/wallMath.test.ts` (Präzise Assertions für `netAreaSqM`, Rechteck 400×300 mit 10 cm Wänden = 11,31 m², Mischwandstärken, Studio-Preset mit 22,00 m² und 24,29 m², `getInteriorWallIds`)
- **Zusammenfassung:** Umstellung aller angezeigten Raumflächen auf die lichte Wohnfläche nach DIN/WoFlV, saubere Trennung zwischen Wandachsen (`Achsmaß`) und lichten Innenmaßen, Behebung des ViewBox-Abschneidens beim Reset-Button, automatisches Aufspalten von Wänden an T-Knoten (`splitWallsAtCorner`) beim Hinzufügen neuer Wände sowie Sicherheitsbereinigung der Dokumentation (31/31 Vitest-Tests grün).

---

## [2026-10-21] Fotorealistischer 3D-Architektur-Visualizer (Referenz-Transformation)

- **Action:** `MAJOR_FEAT`, `RENDER_ENGINE` & `PBR_MATERIALS`
- **Aktualisierte Wiki- & Doku-Seiten:**
  - [`README.md`](../README.md)
  - [`docs/superpowers/plans/2026-10-21-architectural-3d-visualizer-plan.md`](../docs/superpowers/plans/2026-10-21-architectural-3d-visualizer-plan.md)
- **Geänderte & Neue Code-Module:**
  - `src/components/viewer3d/StudioStage3D.tsx` (Architektur-Studiobühne, weiche `ContactShadows`, warmes Sonnenlicht)
  - `src/core/materials/proceduralTextures.ts` (Asset-freie PBR-Texturen: Mikrozement, Eichenparkett, Fliesen, Wollbouclé-Teppiche, Akzent-Holzlamellen)
  - `src/components/viewer3d/RugMesh3D.tsx` (Zonen-Teppiche mit abgerundeten Kanten)
  - `src/components/viewer3d/furniture/*.tsx` (Detaillierte Möbel: Sofa, Bett, Esstisch, Kücheninsel, Pflanzen, Designer-Wanne)
  - `src/core/dimensionMath.ts` & `src/components/viewer3d/ArchitecturalDimensionLines3D.tsx` (DIN-Außenbemaßungsketten)
  - `src/components/layout/TopBar.tsx` (Kamera-Presets 65°/45°/Top-Down, 4K-PNG-Export, Theme-Toggle)
  - `src/core/presets.ts` (Neues Flagship-Preset `luxury-villa`)
- **Zusammenfassung:** Vollständige Transformation des 3D-Viewers zu einer hochwertigen Architektur-Schnittvisualisierung analog zur Referenz `RapidFloorPlanGeneration.jpg` mit Studiobeleuchtung, PBR-Materialien, detailreichen Möbeln, DIN-Bemaßung und PNG-Export (72/72 Vitest-Tests grün).

---

## [2026-10-21] Architektonische Beleuchtung (ACES Filmic), Wellengardinen, Möbel-Inventar & Designer-Möbel (BoConcept Osaka, Vitsœ 606)

- **Action:** `ATMOSPHERE`, `LIGHTING`, `INVENTORY` & `DESIGNER_FURNITURE`
- **Referenzierte Spezifikationen:**
  - `docs/superpowers/plans/2026-10-21-atmosphere-lighting-shelving-plan.md`
- **Geänderte & Neue Code-Module:**
  - `src/components/viewer3d/Scene3D.tsx` (ACESFilmicToneMapping, Exposure 1.15)
  - `src/components/viewer3d/StudioStage3D.tsx` (38° warmes Sonnen-Schräglicht, Hemisphere Fill `#e0f2fe`/`#f0e6d8`)
  - `src/components/viewer3d/WallMesh3D.tsx` (Architektonische Fußleisten mit Türaussparungen, 100% solide Cutaways)
  - `src/components/viewer3d/decor/ProceduralCurtain3D.tsx` (Bodenlange S-Fold Wellengardinen mit belgischer Slub-Yarn Leinentextur)
  - `src/core/types.ts`, `src/store/useFloorplanStore.ts`, `src/components/sidebar/InspectorSidebar.tsx` (Möbel-Inventar-System für reale Stücke vs. Platzhalter)
  - `src/components/viewer3d/furniture/BoConceptOsakaModel.tsx` (Originalgetreue Anders Nørgaard Osaka 2-Sitzer Couch 170×87.5×77 cm)
  - `src/components/viewer3d/furniture/Vitsoe606Model.tsx` (Dieter Rams 606 Universal Shelving System mit Wandschienen & Smart-Staging)
  - `tests/lightingAtmosphere.test.ts`, `tests/textilesDecor.test.ts`, `tests/furnitureInventory.test.ts`, `tests/designerFurniture.test.ts`
- **Zusammenfassung:** Behebung der flachen/stumpfen 3D-Darstellung auf internationales Architektur-Visualizer-Niveau (Lazishvili / iso3d), Einführung der Leinen-Wellenvorhänge, Etablierung des zweistufigen Möbel-Inventars und 3D-Nachbau der ersten beiden Designklassiker (118/118 Vitest-Tests grün).

---

## [2026-10-21] Minimalistische weiße Küche, Designer-Essbereich & Artemide Tolomeo Decentrata

- **Action:** `KITCHEN_UNIT`, `LIGHTING_FIXTURE`, `SCANDI_DINING` & `TAGESABSCHLUSS`
- **Geänderte & Neue Code-Module:**
  - `src/components/viewer3d/furniture/ArtemideTolomeoModel.tsx` (Michele De Lucchi & Giancarlo Fassina Klassiker: Deckenbaldachin, auskragender Aluminium-Gelenkarm, Seilzüge, Pergamentschirm & 2700K Stimmungs-Lichtkegel auf den Esstisch)
  - `src/components/viewer3d/furniture/KitchenUnitModel.tsx` (Mattweiße grifflose Küchenzeile mit 10 cm Toe-Kick Sockel, Unterbauspüle mit Schwanenhals-Armatur, Induktionskochfeld und Hängeschränken mit LED-Unterboden-Lichtleiste)
  - `src/components/viewer3d/furniture/DiningTableModel.tsx` (Mattweißer Esstisch mit Schweizer Kante, ergonomisch geformte Designer-Schalenstühle und Keramik-Vase)
  - `src/components/viewer3d/furniture/ArchitecturalFurniture3D.tsx` (Dispatcher für `kitchen-unit` und `artemide-tolomeo`)
  - `src/core/presets.ts` (`Artemide Tolomeo Decentrata`, `Küchenzeile Mattweiß` und `Esstisch Weiß` in Katalog und Standard-Presets integriert)
  - `tests/kitchenDiningTolomeo.test.ts` (9 dedizierte Unit- & Kollisionstests)
- **Zusammenfassung:** Vollständige Umsetzung des gewünschten weißen Küchendesigns und des skandinavischen Essbereichs. Integration der real besessenen Artemide Tolomeo Decentrata Leuchte als echtes Inventarmöbel mit Deckenabhängung und stimmungsvoller Tischbeleuchtung. 0 Kollisionen über alle Grundrisse, 127/127 Vitest-Tests bestanden, sauberer Production-Build.

---

## [2026-10-21] Cinematische Archviz-Beleuchtung, Mood-Engine & Post-Processing-Pipeline

- **Action:** `CINEMATIC_LIGHTING`, `POST_PROCESSING`, `TIME_INTERPOLATION` & `ATMOSPHERE`
- **Referenzierte Spezifikationen:**
  - `docs/superpowers/plans/2026-10-21-cinematic-lighting-and-atmosphere-plan.md`
- **Aktualisierte Wiki-Seiten:**
  - [`wiki/concepts/cinematic-lighting-and-atmosphere.md`](concepts/cinematic-lighting-and-atmosphere.md)
  - [`wiki/index.md`](index.md)
- **Geänderte & Neue Code-Module:**
  - `src/core/lighting/moodPresets.ts` (Deterministische mathematische Mood-Engine mit stufenloser linearer & trigonometrischer Zeitinterpolation 6:00–22:00 Uhr und 5 Presets: Morgen, Mittag, Golden Hour, Blaue Stunde, Nacht)
  - `src/store/useFloorplanStore.ts` (Integration von `timeOfDay`, `activeMoodKey`, `qualityMode` (`performance` | `beauty`), `glowingWallCaps` und passenden Actions mit NaN-Guards)
  - `src/components/viewer3d/PostFX3D.tsx` (`@react-three/postprocessing` Pipeline mit N8AO 40cm `#3a2f28`, selektivem Bloom mit Luminance-Threshold 1.0, AgX Tonemapping, Vignette und SMAA)
  - `src/components/viewer3d/StudioStage3D.tsx` (Autarkes IBL mit 3 parametrischen `<Lightformer>`s für 100% Offline-Betrieb, dynamischer Sonnenvektor aus Elevation/Azimut, PCSS-Soft-Shadows, 20 cm gefaste Architektur-Plinthe `computePlinthBounds` und Mood-Gradient-Bühne)
  - `src/components/viewer3d/Scene3D.tsx` (Einbindung von `PostFX3D`, Deaktivierung des nativen Tone-Mappings zu Gunsten von AgX)
  - `src/components/viewer3d/WallMesh3D.tsx` (Warmweißer Putz `#f1ece4`, Schnittkappen mit glühender Fuge `#ffe4b5`, physikalisches Fensterglas via `meshPhysicalMaterial` mit `transmission: 0.92`, `ior: 1.5`, `roughness: 0.05`)
  - `src/components/viewer3d/furniture/ArtemideTolomeoModel.tsx` & `KitchenUnitModel.tsx` (Dynamische Leuchtmittel-Emissionsstärke mit selektivem Bloom ab Dämmerung und fokussierten Lichtkegeln)
  - `src/components/layout/TopBar.tsx` (Atmosphäre-Werkzeugleiste in 3D: 5 Schnellwahltasten, stufenloser Zeitschieberegler `6:00–22:00 Uhr`, Qualitäts-Umschalter `⚡ Performance` vs `✨ Schön`)
  - `tests/moodPresets.test.ts`, `tests/storeLighting.test.ts`, `tests/postFX.test.ts`, `tests/topbarLighting.test.ts`
- **Zusammenfassung:** Quantensprung in der visuellen Qualität der 3D-Architekturvisualisierung auf internationales Archviz-Niveau. 100% autark ohne externe CDN-Ressourcen. 167/167 Vitest-Tests über 18 Testdateien grün, sauberer Production-Build, visuelle Vorher-/Nachher-Verifikation via Playwright erfolgreich.

---

## [2026-10-22] Eliminierung des Schattenflackerns, 3D-Performance-Offensive & Detaillierte Architektur-Möbel

- **Action:** `PERFORMANCE`, `SHADOW_STABILITY`, `ISOMETRIC_OPTICS` & `DETAILED_FURNITURE`
- **Referenzierte Spezifikationen:**
  - [`docs/superpowers/plans/2026-10-22-isometric-optics-and-performance-plan.md`](../docs/superpowers/plans/2026-10-22-isometric-optics-and-performance-plan.md)
- **Aktualisierte Wiki-Seiten:**
  - [`wiki/concepts/cinematic-lighting-and-atmosphere.md`](concepts/cinematic-lighting-and-atmosphere.md)
- **Geänderte & Neue Code-Module:**
  - `src/components/viewer3d/StudioStage3D.tsx` & `src/components/viewer3d/Scene3D.tsx` (`PLINTH_TOP_OFFSET_CM = -0.5` senkt Plinthe unter $Y = 0$ gegen Boden-Z-Fighting; Höhenstaffelung für `ContactShadows` $-20.6$, `<Grid>` $-20.8$ und Bodenebene $-21.0$; OrthographicCamera `near={10}, far={5000}`; Entfernung von `<SoftShadows>` zugunsten von `SUN_SHADOW_BIAS = -0.0004` und `SUN_SHADOW_NORMAL_BIAS_CM = 1.2`; `ContactShadows frames={1}`)
  - `src/components/viewer3d/WallMesh3D.tsx`, `src/components/viewer3d/furniture/ArtemideTolomeoModel.tsx`, `src/components/viewer3d/decor/ProceduralCurtain3D.tsx` (Entfernung von `transmission={0.92}` auf Fenstern zugunsten von Single-Pass-Architekturglas; Deaktivierung von `castShadow` am Tolomeo-PointLight; Kamera-Delta-Checks in `useFrame`)
  - `src/components/viewer3d/PostFX3D.tsx` (`return null` im `⚡ Performance`- und `blueprint`-Modus für 0 PostFX-Pässe und natives Hardware-MSAA + `THREE.AgXToneMapping`; im `✨ Schön`-Modus `N8AO quality="low" halfRes`)
  - `src/store/useFloorplanStore.ts` (Neue Start-Defaults: `noon` / `12.5` Uhr, `glowingWallCaps: false`)
  - `src/components/viewer3d/furniture/WardrobeModel.tsx`, `DeskModel.tsx`, `CoffeeTableModel.tsx` & `ArchitecturalFurniture3D.tsx` (Detaillierte 3D-Modelle für PAX-Kleiderschränke mit Türen/Schattenfugen/Stangengriffen, Home-Office-Schreibtische mit Kufengestell/Rollcontainer/Monitor/Bürostuhl sowie Marmor-Couchtische, Sideboards und Waschtische)
  - `src/core/presets.ts` (Ersatz greller Alt-CAD-Farben durch natürliche skandinavische Farbtöne)
- **Zusammenfassung:** Vollständige Behebung des Schattenflackerns (Z-Fighting & Shadow-Acne), drastische Reduktion der GPU-Last im Performance- und Schön-Modus sowie Ersatz sämtlicher verbleibender Klotz-Platzhalter durch detaillierte 3D-Architekturmöbel (169/169 Vitest-Tests grün).

---

## [2026-10-22] Beseitigung des Spülen-Flackerns (Z-Fighting) & GPU-Pipeline-Optimierung

- **Action:** `SINK_FLICKER_FIX`, `DRAW_CALL_PRUNING`, `RAYCAST_OPTIMIZATION` & `THREE_DEDUPE`
- **Aktualisierte Wiki-Seiten:**
  - [`wiki/concepts/cinematic-lighting-and-atmosphere.md`](concepts/cinematic-lighting-and-atmosphere.md)
- **Geänderte Code-Module:**
  - `src/components/viewer3d/furniture/KitchenIslandModel.tsx` & `KitchenUnitModel.tsx` (Ersatz koplanares Spülenboxen durch erhabenen Metallkragen `+0.25 cm` mit `polygonOffsetFactor: -2` und versenkte 14 cm Beckenkavität mit 4 Innenwänden und Ablaufring; Induktionsfeld mit gestaffelten Kochzonen)
  - `vite.config.ts` (`resolve: { dedupe: ['three'] }` eliminiert doppelte Three.js-Instanzen und doppelte Shader-Kompilierung)
  - `src/components/viewer3d/FurnitureMesh3D.tsx` (Entfernung von `onPointerDown` von der Hauptgruppe zugunsten einer unsichtbaren 12-Dreieck-Hitbox; beendet massives Raycasting über hunderte Kind-Meshes bei Mausbewegungen)
  - `src/components/viewer3d/StudioStage3D.tsx` (Bedingtes Mounten von `<ContactShadows>` nur im `isBeauty`-Modus)
  - `src/components/viewer3d/Scene3D.tsx` (`preserveDrawingBuffer: false` zur Behebung von GPU-Swapchain-/ReadPixels-Stalls im Browser)
  - `src/components/viewer3d/furniture/Vitsoe606Model.tsx`, `DiningTableModel.tsx`, `BedModel.tsx`, `PlantModel.tsx`, `DeskModel.tsx`, `SofaModel.tsx`, `BoConceptOsakaModel.tsx` (Entfernung von `castShadow` an Mikrodeko, Büchern, Zweigen und Stuhlbeinen; Reduzierung der `RoundedBox`-Smoothness von 4 auf 2)
  - `tests/kitchenDiningTolomeo.test.ts` & `tests/lightingAtmosphere.test.ts` (Tests für Anti-Flacker-Offsets und `preserveDrawingBuffer: false`)
- **Zusammenfassung:** 100% flackerfreie Spülen und Kochfelder in beiden Küchenmodellen. Beseitigung von GPU-Stalls und massive Reduzierung der Draw-Calls und Raycasting-Latenzen bei gleichzeitiger Wahrung der fotorealistischen Optik (170/170 Vitest-Tests grün).

---

## [2026-10-23] Externes Architektur-Review & Konzeption der 4 Sprints

- **Action:** `REVIEW`, `ASSESSMENT` & `PLANNING`
- **Quellen:**
  - [`docs/reviews/2026-10-23-externes-review.md`](../docs/reviews/2026-10-23-externes-review.md)
  - [`docs/reviews/2026-10-23-prompt-fuer-antigravity.md`](../docs/reviews/2026-10-23-prompt-fuer-antigravity.md)
- **Erstellte Pläne:**
  - `sprint-1-implementation-plan.md` bis `sprint-4-implementation-plan.md`
- **Zusammenfassung:** Umfassendes externes Architektur- und Usability-Review. Identifikation kritischer Mängel in Bounding-Box-Kollisionen (Fehlalarme bei Stühlen, Ecksofas und Türschwenken), Datenmodell-Kopplung an Namen (`item.name.includes`), optischer Überromantisierung, Weitwinkelverzerrungen sowie fehlender 2D-Editor-Präzision und maßstabsgetreuem Planexport. Strukturierung der Behebung in 4 fokussierte Sprints.

---

## [2026-10-23] Sprint 1: Wahre Maße & Kollisionsgeometrie

- **Action:** `GEOMETRY`, `COMPOUND_OBB`, `DOOR_SECTOR` & `WALL_SYNC`
- **Aktualisierte Wiki-Seiten:**
  - [`wiki/concepts/collision-detection.md`](concepts/collision-detection.md)
- **Geänderte Code-Module:**
  - `src/core/collisionEngine.ts` (Einführung von Compound-OBBs für Esstische mit Stuhlkästen `getDiningTableOBBs` und Ecksofas `getSofaOBBs`; exakte 90°-Kreissektorprüfung `isPointInDoorSwingArcCm` zur Vermeidung von Fehlalarmen außerhalb des Aufschlagradius)
  - `src/components/viewer3d/furniture/BedModel.tsx` (Bereinigung der Doppelbett-Matratzenmaße auf 196 cm bei 200 cm Rahmen)
  - `src/store/useFloorplanStore.ts` (Wandlängen-Änderung `setWallLengthCm` führt anliegende Wände, Öffnungen und gesnappte Möbel unter Beibehaltung der Ausrichtung `side` mit)
  - `tests/sprint1Geometry.test.ts` (25 neue Unit-Tests für Compound-OBB, Kreissektoren und Wandnachführung)
- **Zusammenfassung:** Mathematisch exakte Kollisionsgeometrie ohne Bounding-Box-Fehlalarme. 21/21 Testdateien (209 Tests) 100% grün.

---

## [2026-10-23] Sprint 2: Datenmodell, Typentkopplung & Auszugszonen

- **Action:** `DATA_MODEL`, `VISUAL_RESOLVER`, `CLEARANCE_ZONES` & `PROCEDURAL_FALLBACK`
- **Aktualisierte Wiki-Seiten:**
  - [`wiki/concepts/furniture-inventory-and-design-specs.md`](concepts/furniture-inventory-and-design-specs.md)
  - [`wiki/concepts/collision-detection.md`](concepts/collision-detection.md)
- **Geänderte Code-Module:**
  - `src/core/types.ts` (`FurnitureVisualType` Union mit 22 Typen, `catalogDims`, `clearanceZoneCm`, `hasNightstands`)
  - `src/core/furnitureVisual.ts` (`resolveFurnitureVisual` als Single Source of Truth; vollständige Beseitigung von Namens-Sniffing wie `item.name.includes`)
  - `src/components/viewer3d/furniture/GenericArchitecturalModel.tsx` (Generische architektonische Annäherung für Sitzmöbel, Tische, Schränke und Betten ohne Klotz-Platzhalter)
  - `src/components/sidebar/InspectorSidebar.tsx` (Warnhinweis `⚠️ Maße weichen vom Katalog ab` mit 1-Klick-Reset-Button)
  - `src/core/collisionEngine.ts` (50 cm Schrank- und Küchenauszugszonen `clearance-blocked`; modulare Bett-Nachttische)
  - `tests/sprint2DataModel.test.ts` (44 neue Unit-Tests)
- **Zusammenfassung:** Vollständige Entkopplung von Datenmodell und visueller Darstellung. 22/22 Testdateien (254 Tests) 100% grün.

---

## [2026-10-24] Sprint 3: Ehrliche visuelle Wirkung & Menschliche Perspektive

- **Action:** `HONEST_LIGHTING`, `FIRST_PERSON_CAMERA`, `SUN_ALIGNMENT` & `CLEAN_STAGING`
- **Aktualisierte Wiki-Seiten:**
  - [`wiki/concepts/cinematic-lighting-and-atmosphere.md`](concepts/cinematic-lighting-and-atmosphere.md)
- **Geänderte Code-Module:**
  - `src/core/lighting/moodPresets.ts` (`MOOD_PRESETS.neutral` mit reinweißem 6500K-Licht, 0 Bloom, 0 Vignette und neutraler Exposure als Standard)
  - `src/components/viewer3d/Scene3D.tsx` (Kamera-Preset `first-person` auf 170 cm Erwachsenen-Augenhöhe und 115 cm Kind-Schnellwahl; automatische Positionierung 80 cm hinter der Zimmertür mit Blick in den Raum; menschliches 55° FOV zur Vermeidung von Weitwinkelverzerrungen)
  - `src/components/viewer3d/StudioStage3D.tsx` (`computeDominantWindowDirection` richtet Sonnenlicht dynamisch an realen Fenstern aus `alignSunWithWindows`)
  - `src/components/viewer3d/decor/ProceduralCurtain3D.tsx`, `BedModel.tsx`, `DeskModel.tsx`, `DiningTableModel.tsx` (Deko-Toggle `showDecor: false` blendet Beiwerk für nüchterne Stellproben aus; separate Raumlicht-Schaltung)
  - `tests/sprint3HonestVisuals.test.ts` (35 neue Unit-Tests)
- **Zusammenfassung:** Verlässliche, unromantisierte Raumwahrnehmung auf menschlicher Augenhöhe. 23/23 Testdateien (289 Tests) 100% grün.

---

## [2026-10-24] Sprint 4: UI, UX, Präzision & Maßstabsgetreuer Plan-Export

- **Action:** `TAPE_MEASURE`, `ORTHO_SNAP`, `UNDO_REDO`, `AUTOSAVE` & `SCALE_SVG_EXPORT`
- **Aktualisierte Wiki-Seiten:**
  - [`wiki/concepts/precision-editor-and-scale-export.md`](concepts/precision-editor-and-scale-export.md)
  - [`wiki/concepts/collision-detection.md`](concepts/collision-detection.md)
  - [`wiki/index.md`](index.md)
- **Geänderte & Neue Code-Module:**
  - `src/core/measureMath.ts` (Interaktives Maßband mit Punkt-zu-Punkt-Messung und Separating-Axis-Theorem Kante-zu-Kante-Minimaldistanzen zwischen Möbeln und Wänden)
  - `src/core/wallMath.ts` (90°-Orthogonal-Winkelfang `snapAngleToOrthogonal` mit grüner Einrastanzeige `#10b981`; konfigurierbares Fangraster 1/5/10/25 cm `snapValueToGrid`)
  - `src/store/useFloorplanStore.ts` (30-Schritt Undo/Redo `undoStack`/`redoStack` mit Tastatur-Shortcuts `Ctrl+Z`, `Ctrl+Y`; LocalStorage-Autosave bei `beforeunload`/`visibilitychange`; Startzustand als sauberer leerer Raum `empty-room`)
  - `src/core/export/planSvgExport.ts` (Maßstabsgetreuer Vektor-SVG-Export im Maßstab 1:50 und 1:100 für DIN A4/A3 mit normiertem Plankopf, grafischer Maßstabsleiste, Netto-Raumstempeln und Bemaßungsketten)
  - `src/components/layout/TopBar.tsx` (Plan-Export-Modal, Undo/Redo-Buttons, Maßband-Werkzeug)
  - `tests/measureMath.test.ts`, `tests/editorPrecisionSnap.test.ts`, `tests/storeUndoAutosave.test.ts`, `tests/planSvgExport.test.ts` (31 neue Unit-Tests)
- **Zusammenfassung:** Vollständige Fertigstellung aller 4 Sprints. Höchste Zeichenpräzision, Session-Sicherheit und druckfertiger Vektorexport nach DIN 1356. 27/27 Testdateien (320 Tests) 100% grün, sauberer TypeScript- und Vite-Build, gemergt auf `master`.

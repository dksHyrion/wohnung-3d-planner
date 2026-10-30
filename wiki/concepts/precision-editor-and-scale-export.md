# 2D-Editor-Präzision, Maßband & Maßstabsgetreuer Plan-Export

**Quellen:** [docs/reviews/2026-10-23-externes-review.md](../../docs/reviews/2026-10-23-externes-review.md), [din-and-neufert-standards.md](../../raw/furniture-specs/din-and-neufert-standards.md)  
**Verwandte Konzepte:** [coordinate-system-cm.md](coordinate-system-cm.md), [wall-graph-topology.md](wall-graph-topology.md), [collision-detection.md](collision-detection.md), [app-state-and-views.md](../architecture/app-state-and-views.md)

---

## 1. Interaktives Maßband & Lichte Durchgangsmessung (`measureMath.ts`)

Für die verlässliche Stellprobe benötigt der Planer zwei Formen von Abstandsermittlung: freie Punkt-zu-Punkt-Messung und automatisierte Kante-zu-Kante-Durchgangsbreiten.

### A. Freies 2D-Maßband-Werkzeug (`EditorTool: 'measure'`)
Wird das Maßband in der TopBar aktiviert, erlaubt [`FloorplanCanvas2D.tsx`](../../src/components/editor2d/FloorplanCanvas2D.tsx) das Aufspannen einer dynamischen Messstrecke per Klick:
- **Euklidische Distanz & Deltas:**
  $$d = \sqrt{(x_2 - x_1)^2 + (z_2 - z_1)^2}, \quad \Delta x = |x_2 - x_1|, \quad \Delta z = |z_2 - z_1|$$
- **Visuelle Repräsentation:** Gestrichelte Bemaßungslinie (`#818cf8`), End-Ticks, Kreis-Ankerpunkte und ein zentriertes Bemaßungs-Badge mit Formatierung `formatMeasureDimension(d)` (z. B. `185,0 cm (1,85 m)`).

### B. Kante-zu-Kante-Minimaldistanz (Separating Axis Theorem)
Herzkern für realistische und professionelle Stellproben ist die Durchgangsprüfung zwischen zwei Möbelstücken (`computeFurnitureClearanceCm`) und zu Wänden (`computeFurnitureToWallDistanceCm`):
- Evaluiert alle Teil-Polygone aus `layoutFurnitureParts(item)` (Tischplatte + Stühle, Ecksofa-Chaiselongue, Bett + Nachttische) unter Berücksichtigung der individuellen Y-Drehung (`rotationYDeg`).
- Führt eine Überlappungsprüfung via **Separating Axis Theorem (SAT)** auf allen 4 Kanten-Normalen jedes Teil-Polygons durch.
- Bei Überlappung ist der Abstand $0.0\text{ cm}$.
- Bei Disjunktheit wird der exakte Minimalabstand aller 4 Eckpunkte von Poly A zu den 4 Liniensegmenten von Poly B (und umgekehrt) analytisch bestimmt:
  $$d_{\min}(P, AB) = \|P - \text{proj}_{AB}(P)\|$$
- Im Inspector (`InspectorSidebar.tsx`) werden unter **„📏 Lichte Durchgänge & Abstände“** automatisch die minimalen Durchgangsbreiten zu den nächsten 3 Möbeln sowie der Abstand zu den nächsten 2 Wänden in Zentimetern live ausgewiesen.

### C. Drag-Transaktionen im Verlaufsspeicher (`recordHistory: false`)
- Beim Ziehen von Ecken (`moveCorner`), Möbeln (`moveFurniture`) oder Teppichen (`moveRug`) in 2D (`FloorplanCanvas2D.tsx`) und 3D (`Scene3D.tsx`, `FurnitureMesh3D.tsx`, `RugMesh3D.tsx`) wird zu Beginn der Ziehgeste einmalig `pushUndoSnapshot()` aufgerufen und während `PointerMove` mit `{ recordHistory: false }` verschoben, sodass der 30-Schritte-Ringpuffer nicht durch Zwischenpositionen geflutet wird.

### D. Ehrliche 2D-Architektursymbole im Editor & SVG-Export
- Sowohl der 2D-Editor (`FloorplanCanvas2D.tsx`) als auch der maßstabsgetreue Planexport (`planSvgExport.ts`) zeichnen Mehrteil-Möbel über `layoutFurnitureParts(item)` statt als generische Klotz-Rechtecke (Esstisch mit Stuhlsymbolen, L-Ecksofa, Bett mit Kopfteil/Kissen/Nachttischen sowie ausgeklappte BoConcept Osaka Schlafcouch).

---

## 2. 2D-Editor-Präzision & Fangraster (`wallMath.ts`)

### A. 90°-Orthogonal-Winkelfang (`snapAngleToOrthogonal`)
Beim Zeichnen von Wänden rastet die Führungslinie automatisch auf die 4 orthogonalen Hauptachsen ($0^\circ, 90^\circ, 180^\circ, 270^\circ$) ein:
- Einrastkorridor: Schwellenwert $\Delta \alpha \le 5^\circ$ (also $85^\circ$–$95^\circ \to 90^\circ$, $175^\circ$–$185^\circ \to 180^\circ$, etc.).
- **Shift-Lock:** Halten der `Shift`-Taste erzwingt die Orthogonalität unabhängig vom Winkel.
- **Visuelles Feedback:** Eingerastete Wandlinien färben sich im 2D-Editor leuchtend grün (`#10b981`), um dem Planer die exakt rechtwinklige Geometrie unmittelbar zu signalisieren.

### B. Konfigurierbares Fangraster (`snapValueToGrid`)
- Unterstützt Rasterweiten von `1 cm`, `5 cm`, `10 cm` und `25 cm` (Standard: `5 cm`).
- Alle Wand- und Eckpunkt-Koordinaten werden auf ganzzahlige Vielfache der aktiven Rasterweite gerundet:
  $$\text{snapped} = \text{round}\left(\frac{v}{\text{gridSize}}\right) \times \text{gridSize}$$

### C. Smart Alignment Guides & Kante-an-Kante Möbel-Snapping (`alignmentMath.ts`)
- Beim Verschieben eines Möbels mit aktivem `snapToWallEnabled` rastet `computeFurnitureAlignment` innerhalb von `DEFAULT_FURNITURE_SNAP_THRESHOLD_CM = 8 cm` bündig Kante an Kante (`0 cm` Spalt auf derselben Wand, `kind: 'flush'`) sowie auf Mittelachsen (`kind: 'center'`) und Fluchtkanten (`kind: 'edge'`) im Raum ein.
- Aktive Hilfslinien (`activeAlignmentGuides`) werden im 2D-SVG-Editor und im 3D-Viewport gezeichnet und beim Loslassen der Maustaste via `clearAlignmentGuides()` geleert.

### D. Ehrliche Flächenterminologie
Gemäß Befund 6 des externen Architektur-Reviews wurde die unzutreffende Bezeichnung „Wohnfläche nach WoFlV“ (die Putzabzüge von 3 %, lichte Höhenabzüge unter Schrägen und Balkonanteile vorschreibt) konsequent bereinigt. Sämtliche 2D-Raumstempel, Tooltips und Dokumentationen weisen nun wahrheitsgemäß die **„Lichte Innenfläche“ / „Innenfläche (m²)“** aus.

---

## 3. Session-Sicherheit: Undo / Redo & LocalStorage-Autosave

### A. Zustand-Verlaufsspeicher (`src/store/history.ts`)
- **Ringpuffer-Stacks:** `undoStack` und `redoStack` speichern tiefe Kopien von Ecken, Wänden, Öffnungen, Möbeln, Teppichen, Raumstempeln und der Unterleger-Lage.
- **Kapazitätsdeckelung:** 30 Schritte (`MAX_HISTORY = 30`).
- **Tastatur:** `Ctrl+Z` macht rückgängig. `Ctrl+Shift+Z` oder `Ctrl+Y` wiederholt.
- Die Kopien enthalten `imageId`, Deckkraft, Sperre und Maße. Sie enthalten keine `data:`-URL und keine `blob:`-URL.
- Bilder, die weder der aktuelle Plan noch Undo oder Redo nennen, werden aus dem Bildspeicher gelöscht.

### B. LocalStorage-Autosave
- Der Plan liegt unter dem Schlüssel `wohnung_autosave`. Geschrieben wird dieselbe JSON-Form wie beim Export, also ohne Pixel.
- **Auslöser:** eine Änderung an Ecken, Wänden, Öffnungen, Möbeln, Teppichen, Raumstempeln oder am Unterleger. Der Text des Plans wird in dem Moment festgehalten. Das Schreiben wartet 400 ms, damit ein Verschieben nicht bei jeder Mausbewegung speichert. Zusätzlich schreiben `beforeunload` und das Verlassen des Tabs in `App.tsx`, auch wenn die Wartezeit noch läuft. Ein Nachladen des Programms schreibt diesen festgehaltenen Text, bevor es den gespeicherten Plan wieder liest.
- Eine reine Ansichtsänderung schreibt nicht. Dazu gehören Auswahl, Kamera, Tageszeit und die Laufwege-Anzeige.
- **Beim Öffnen** liest das Programm den Schlüssel. Liegt nichts darin, bleibt die Beispielwohnung `standard-55`. Wird der Programmspeicher neu erzeugt, liest es den Schlüssel erneut, damit das Beispiel den offenen Plan nicht ersetzt. Ein gespeicherter Plan wird nicht durch das unveränderte Beispiel überschrieben. Der gelesene Stand löscht den Undo-Stapel.
- Schlägt das Schreiben fehl, bleibt der bisherige Plan stehen. Die Leiste zeigt „Der Plan konnte nicht im Browser gesichert werden.“ Ein stilles `console.warn` gibt es an dieser Stelle nicht.
- **Startzustand ohne gespeicherten Plan:** die Beispielwohnung `standard-55`. `empty-room` bleibt eine eigene Vorlage. `plaene/wohnung.json` wird nicht angelegt. Ein abgepauster Grundriss kommt später als JSON ohne Pixel nach `plaene/` und wird über den JSON-Import geladen.
- Dieselbe JSON-Form schreibt das laufende Programm zusätzlich nach `.autosave/plan.json`. Die Datei ist die Sicherung, nicht der abgepauste Grundriss. Liegt im Browser nur die Beispielwohnung, liest das Programm diese Datei. Ein echter Plan im Browser bleibt stehen. Fehlt der Programmdienst, bleibt die Sicherung im Browser.

---

## 4. Maßstabsgetreuer 2D-Plan-Export (SVG 1:50 / 1:100) (`planSvgExport.ts`)

Für Bauherren, Vermieter und Handwerker generiert [`planSvgExport.ts`](../../src/core/export/planSvgExport.ts) druckfertige Architektur-Vektordokumente nach DIN 1356.

### A. Maßstabs- und Papiermathematik
Da SVG-Dokumente mit Millimeter-Einheiten (`width="297mm"`, `viewBox="0 0 297 210"`) arbeiten, entspricht 1 SVG-User-Unit genau 1 physikalischem Millimeter auf Papier:
- **Maßstab 1:50 (Detailmaßstab):**
  $$k = 0{,}2\text{ mm pro cm} \quad (50\text{ cm Natur} \to 10\text{ mm Papier} = 1\text{ cm Papier})$$
- **Maßstab 1:100 (Übersichtsmaßstab):**
  $$k = 0{,}1\text{ mm pro cm} \quad (100\text{ cm Natur} \to 10\text{ mm Papier} = 1\text{ cm Papier})$$
- Unterstützt DIN A4 (297 × 210 mm) und DIN A3 (420 × 297 mm) in Quer- oder Hochformat.

### B. Architektur-Elemente im Plan
1. **Wandkonturen mit Schnittfüllung:** Doppelwandige Innen- und Außenkanten mit architektonischem Solid-Dark-Stroke (`#0f172a`, Stärke 0.7 mm) und schraffierter/gedeckter Füllung.
2. **Öffnungen (5 Bauarten):**
   - Fenster (`arch-window`) als dreilinige Parallelen mit Rahmen und Glasebene.
   - Drehtüren (`arch-door`) und verglaste Balkontüren (`arch-balcony-door`) mit Türblatt und gestricheltem 90°-Aufschlagschwung-Kreisbogen. Im 3D-Bild steht dasselbe Blatt 72° offen in der gewählten Richtung, mit Zarge und Griff. Der 2D-Plan zeigt das Blatt 4 cm dick im 90°-Symbol. Der Schnitt der Wand blendet das Blatt nicht aus.
   - Schiebetüren (`arch-sliding-door`) mit Laufschiene und parallel zur Wand versetztem Schiebeflügel ohne 90°-Schwenkbogen.
   - Offene Wanddurchgänge (`arch-passage`) mit gestrichelten Laibungslinien ohne Türblatt und ohne Schwenkbogen.
3. **Teppiche (`arch-rug`) & Möbelkonturen (`arch-furniture`):** Exakt ausgerichtete 2D-Grundrisse aller Teppiche (`data-rug-name`) und Möbelstücke mit Beschriftung (`includeFurniture`).
4. **Außen-Bemaßungsketten:** DIN-gerechte Maßlinien mit 45°-Schrägstrichen (Ticks) und Maßzahlen in cm (`includeDimensions`).
5. **Raumstempel:** Raumbezeichnung und zentrierter Flächennachweis mit Netto-Innenfläche (`m²`).
6. **Normierter Plankopf (Title Block):** DIN-konformes Schriftfeld unten rechts mit Projektname, Maßstabsangabe (`M 1 : 50` / `M 1 : 100`), Erstelldatum, Autor und Gesamt-Nettofläche.
7. **Grafische Maßstabsleiste (Scale Bar):** Millimetergenau geteilter Kontrollbalken (0 m – 1 m – 2 m – 5 m) zur visuellen Maßstabskontrolle bei verkleinerten oder vergrößerten Ausdrucken.

---

## 5. Grundriss-Unterleger (Tracing) & DIN 18040 Ergonomie-Heatmap

### A. Bild-Import & 2-Punkt-Referenzskalierung (`tracingMath.ts`, `overlayImageStore.ts`)
Der Eintrag vom 27.10.2026 beschreibt den früheren Weg, das Bild als Data-URL in den Plan zu schreiben. Seit dem 28.10.2026 gilt der Bildspeicher.

- **Formate:** PNG, JPEG, WebP, SVG.
- **Pixel:** IndexedDB, Datenbank `wohnung-planer`, Store `overlay-images`. Fehlt IndexedDB, hält ein Speicher im Modul das Blob für diese Sitzung.
- **Verkleinerung:** die längere Kante wird auf 1920 px begrenzt (`fitSize`). Fotos werden JPEG mit Qualität 0,82. SVG unter 400 KB bleibt SVG. Größeres SVG wird gerastert. Ohne `document` bleibt die Originaldatei liegen.
- **Im Plan:** `BackgroundImageOverlay.url` ist zur Laufzeit eine kurze Blob-Adresse. `imageId` zeigt auf die Pixel. Export, Undo und `wohnung_autosave` speichern Lage, Maß, Deckkraft, Sperre und `imageId`.
- **Alter Import:** eine eingebettete Data-URL wird in den Bildspeicher gelegt und danach nur noch über `imageId` geführt. Beim Laden holt der Store das Blob und setzt die Blob-Adresse neu.
- **Fehler beim Dateiwählen:** der bisherige Plan bleibt. Die Leiste zeigt „Das Grundrissbild konnte nicht gespeichert werden.“
- **2-Punkt-Kalibrierung (`calculateScaleFromReference`):**
  Der Planer wählt zwei bekannte Referenzpunkte im Bild (z. B. eine 400 cm lange Außenwand oder ein 90 cm breites Türmaß) und gibt das reale Zentimeter-Maß ein:
  $$d_{\text{pixel}} = \sqrt{(x_2 - x_1)^2 + (z_2 - z_1)^2}, \quad s_{\text{cmPerPixel}} = \frac{d_{\text{realCm}}}{d_{\text{pixel}}}$$
  $$\text{widthCm} = \text{naturalWidthPx} \times s_{\text{cmPerPixel}}, \quad \text{heightCm} = \text{naturalHeightPx} \times s_{\text{cmPerPixel}}$$
- **Floating Toolbar (`BackgroundOverlayControls.tsx`):** Deckkraft (10%–100%), Sperren/Entsperren (`locked`), Sichtbarkeit (`visible`), 2-Punkt-Kalibrieren und Löschen.

### B. Ergonomie-, Laufwege- & Engstellen-Engine (`ergonomicsEngine.ts`)
Analysiert alle Engstellen und Durchgangsbreiten nach DIN 18040 / Neufert:
- Untersucht Möbel $\leftrightarrow$ Möbel und Möbel $\leftrightarrow$ Wand via Separating Axis Theorem (SAT).
- Filtert Wandanschläge ($\le 5\text{ cm}$) und vertikal gestapelte Möbel aus.
- **DIN 18040 Ampel-Klassifizierung:**
  - $< 60\text{ cm}$: Kritische Engstelle (Rot `#ef4444`, `⚠️ X cm`)
  - $60\dots90\text{ cm}$: Warnung / Eingeschränkter Durchgang (Amber `#f59e0b`, `⚡ X cm`)
  - $90\dots120\text{ cm}$: Optimaler barrierefreier Hauptweg (Grün `#10b981`, `✓ X cm`)
- **Visualisierung:**
  - **2D:** Gestrichelte Linien und kontraststarke Pill-Badges im SVG-Canvas (`pointer-events: none`).
  - **3D (`PassageClearance3D.tsx`):** Flache Bodenstreifen ($Y = 0.4\text{ cm}$, `depthWrite={false}`) und 3D `<Html>` Badges.
  - **Wann gerechnet wird:** `setWithCollisions` schreibt `collisionReports` und, solange die Heatmap an ist, `passageReport`. Der Aufruf übergibt keine eigene Distanz. Es gilt `DEFAULT_MAX_PASSAGE_DISTANCE_CM` (120) in `ergonomicsEngine.ts`. `setShowPassageHeatmap` geht über `set`: einmal rechnen beim Einschalten, `null` beim Ausschalten, kein Undo und keine neue Kollision. Undo und Redo schieben nur den Schnappschuss und rufen `setWithCollisions` mit `recordHistory = false`. Ist die Heatmap aus, bleibt `passageReport` null, damit das Ziehen der Möbel nicht jedes Mal die Abstände rechnet.
  - **Anzeige:** `FloorplanCanvas2D`, `PassageClearance3D` und die TopBar lesen nur dieses Ergebnis. Sie rufen `evaluatePassageClearances` nicht selbst auf.
  - **TopBar:** Die Taste heißt „Laufwege“. Die Zahl kritischer Engstellen steht daran, sobald die Heatmap an ist und der Bericht welche enthält.

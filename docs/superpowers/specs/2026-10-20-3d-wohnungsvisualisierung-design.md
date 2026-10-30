# Design-Spezifikation: 3D-Wohnungsvisualisierung & Raumplaner (Karpathy LLM-Wiki + Three.js/R3F)

**Datum:** 2026-10-20  
**Workspace:** `/home/agy/Wohnung`  
**Architektur-Ansatz:** Dual-Layer-Architektur (Karpathy LLM-Wiki Pattern + Vite / React / TypeScript / React Three Fiber Web-App)

---

## 1. Zielsetzung & Überblick

Dieses Projekt kombiniert zwei Ebenen in einem gemeinsamen Repository (`/home/agy/Wohnung`):
1. **Karpathy LLM-Wiki Layer (`SCHEMA.md`, `raw/`, `wiki/`):** Eine vom Agenten gepflegte, vernetzte Markdown-Wissensdatenbank nach Andrej Karpathys `llm-wiki.md`-Blueprint. Sie speichert unveränderliche Rohquellen in `raw/` (z. B. unseren Recherchebericht, Referenz-URLs und spätere reale Wohnungs-/Möbeldatenblätter) und pflegt in `wiki/` vernetzte Konzept-, Mathematik- und Architektur-Dokumente inklusive `wiki/index.md` und chronologischem `wiki/log.md`.
2. **Interaktive 2D/3D-Web-App (`src/`, `tests/`):** Eine zentimetergenaue (`1 Three.js Unit = 1 cm`) Web-Anwendung mit Vite, React, TypeScript, React Three Fiber (`@react-three/fiber`, `@react-three/drei`) und `Zustand`. Nutzer können ohne bestehenden Grundriss beliebige Räume/Wände in Zentimetern anlegen, Türen und Fenster positionieren, parametrische Möbelstücke (`Breite × Höhe × Tiefe` in cm) platzieren und erhalten in Echtzeit eine cm-genaue Kollisions- und Wandlängenprüfung.

---

## 2. Verzeichnisstruktur

```text
/home/agy/Wohnung/
├── SCHEMA.md                                    # LLM-Wiki Regeln, Workflows (Ingest, Query, Lint) & Projekt-Konventionen
├── raw/                                         # Unveränderliche Quellen (Immutable Sources)
│   ├── 2026-10-20-threejs-research-report.md    # Vollständiger Recherchebericht inkl. Referenz-URLs & Snippets
│   └── furniture-specs/                         # Ablageordner für spätere reale Möbel- und Grundriss-Notizen
├── wiki/                                        # Vom LLM-Agenten kompilierte & gepflegte Wissensbasis
│   ├── index.md                                 # Katalog aller Wiki-Dokumente mit Kurzbeschreibung
│   ├── log.md                                   # Chronologisches Audit-Log (Append-only)
│   ├── concepts/
│   │   ├── coordinate-system-cm.md              # Maßstab (1 Unit = 1 cm), Achsen & Toleranzen
│   │   ├── wall-graph-topology.md               # Corner/Wall-Graph, Tür-/Fenster-Öffnungen & Cutaway-Logik
│   │   └── collision-detection.md               # 1D-Skalarprodukt-Wandprüfung & 3D-OBB-Kollisionsmathematik
│   └── architecture/
│       └── app-state-and-views.md               # Kopplung zwischen Zustand-Store, 2D-SVG-Editor & 3D-R3F-Viewport
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-10-20-3d-wohnungsvisualisierung-design.md
│       └── plans/
├── src/
│   ├── core/                                    # Framework-unabhängiger Geometrie- & Kollisionskern
│   │   ├── types.ts                             # Strikte TypeScript-Interfaces (alle Längen in cm)
│   │   ├── wallMath.ts                          # Wandvektoren, Normalen, checkWallFitCm, Wand-Snapping, Cutaway
│   │   ├── collisionEngine.ts                   # THREE.OBB-Erzeugung, Möbel-/Wand-/Tür-Kollisionen, Raycast-Abstände
│   │   └── presets.ts                           # Beispiel-Grundrisse (z. B. 2-Zimmer-Wohnung, L-Raum) & Möbel-Katalog
│   ├── store/
│   │   └── useFloorplanStore.ts                 # Zustand-Store (CRUD für Ecken/Wände/Öffnungen/Möbel, JSON-Export/Import)
│   ├── components/
│   │   ├── layout/
│   │   │   └── TopBar.tsx                       # Ansichts-Umschalter (2D | Split | 3D-Isometrie | 3D-Perspektive), Presets, Export
│   │   ├── editor2d/
│   │   │   └── FloorplanCanvas2D.tsx            # Interaktiver SVG-Editor (cm-Grid, Wand-Zeichnen, Direkt-Maßeingabe, Türbögen)
│   │   ├── viewer3d/
│   │   │   ├── Scene3D.tsx                      # R3F Canvas, Kamera-Controller (Orthographic/Perspective), Beleuchtung
│   │   │   ├── WallMesh3D.tsx                   # 3D-Wandsegment mit Tür-/Fenster-Ausschnitten & automatischem Cutaway
│   │   │   └── FurnitureMesh3D.tsx              # 3D-Möbelstück mit Dragging, Wand-Snapping, Maß-Labels & Kollisionsfarbe
│   │   └── sidebar/
│   │       └── InspectorSidebar.tsx             # Eingabefelder für exakte Wandlänge (cm), Öffnungen, Möbel (B×H×T cm) & Kollisionsbericht
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── tests/
│   ├── wallMath.test.ts                         # Unit-Tests für 1D-Wandprojektion, Überstände, Snapping & Cutaway
│   ├── collisionEngine.test.ts                  # Unit-Tests für 3D-OBB-Schnitttests, Rotation & Tür-Schwenkbereiche
│   └── store.test.ts                            # Unit-Tests für Wandlängen-Resizing, Validierung & JSON-Import/Export
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 3. Koordinatensystem & Datenmodell (`src/core/types.ts`)

### 3.1 Maßstabs- und Achsenkonvention
* **Einheit:** `1 Three.js-Einheit = 1 cm` im gesamten Datenmodell, im 2D-SVG-Editor und im 3D-Szenegraphen.
* **Achsen:**
  * `X`: Horizontale Achse (links $\rightarrow$ rechts in cm)
  * `Z`: Tiefenachse auf der Bodenebene (oben $\rightarrow$ unten im 2D-Grundriss in cm)
  * `Y`: Höhe vom Fußboden nach oben ($Y = 0$ ist die Fußbodenoberkante)
* **Numerische Toleranz:** $\epsilon = 0.05\text{ cm}$ ($0.5\text{ mm}$), damit Möbel „Stoß an Stoß“ oder exakt passend in eine gleich breite Wandnische gestellt werden können, ohne durch Fließkomma-Ungenauigkeiten eine Kollision auszulösen.

### 3.2 Kern-Interfaces
```typescript
export interface Corner {
  id: string;
  x: number; // in cm
  z: number; // in cm
}

export interface Wall {
  id: string;
  startCornerId: string;
  endCornerId: string;
  thicknessCm: number; // Standard: 15 cm
  heightCm: number;    // Standard: 250 cm
}

export type OpeningType = 'door' | 'window';

export interface WallOpening {
  id: string;
  wallId: string;
  type: OpeningType;
  offsetFromStartCm: number; // Abstand vom startCorner entlang der Wand in cm
  widthCm: number;           // z. B. 86 cm (Tür) oder 120 cm (Fenster)
  heightCm: number;          // z. B. 200 cm (Tür) oder 130 cm (Fenster)
  sillHeightCm: number;      // Brüstungshöhe: 0 cm bei Türen, z. B. 90 cm bei Fenstern
  swingDirection?: 'in-left' | 'in-right' | 'out-left' | 'out-right';
}

export interface FurnitureItem {
  id: string;
  name: string;
  category: 'living' | 'bedroom' | 'kitchen' | 'office' | 'storage' | 'custom';
  widthCm: number;      // Ausdehnung entlang lokaler X-Achse in cm
  heightCm: number;     // Ausdehnung entlang lokaler Y-Achse in cm
  depthCm: number;      // Ausdehnung entlang lokaler Z-Achse in cm
  x: number;            // Mittelpunkt X in cm
  z: number;            // Mittelpunkt Z in cm
  elevationCm: number;  // Abstand Unterkante vom Boden (Standard: 0 cm)
  rotationYDeg: number; // Drehung um Y-Achse in Grad
  color: string;        // Hex-Farbcode
  snappedWallId?: string | null;
}

export interface CollisionIssue {
  type: 'wall-exceeded' | 'corner-overflow' | 'wall-intersection' | 'furniture-intersection' | 'opening-blocked';
  message: string;
  overflowCm?: number;
  targetId?: string;
}

export interface FurnitureCollisionReport {
  furnitureId: string;
  hasCollision: boolean;
  issues: CollisionIssue[];
   clearancesCm: {
    leftCm: number | null;
    rightCm: number | null;
  };
}
```

---

## 4. Mathematischer Kern & Kollisions-Engine (`src/core/`)

### 4.1 Wand-Vektormathematik (`src/core/wallMath.ts`)
1. **Wandlänge & Richtungsvektor:** Für eine Wand von `start` $A(x_A, z_A)$ nach `end` $B(x_B, z_B)$ gilt:
   $$\vec{V}_{\text{wall}} = B - A, \quad L_{\text{wall}} = \|\vec{V}_{\text{wall}}\|, \quad \hat{u}_{\text{wall}} = \frac{\vec{V}_{\text{wall}}}{L_{\text{wall}}}$$
   Die ins Rauminnere zeigende Einheitsnormale ist $\hat{n}_{\text{wall}} = (-\hat{u}_{\text{wall}, z}, \, 0, \, \hat{u}_{\text{wall}, x})$.
2. **Exakte Wandlängen-Änderung (`setWallLengthCm`):** Gibt der Nutzer für eine Wand eine neue Länge $L_{\text{neu}} \ge 10\text{ cm}$ ein, wird der Endpunkt $B$ auf $B_{\text{neu}} = A + L_{\text{neu}} \cdot \hat{u}_{\text{wall}}$ gesetzt.
3. **1D-Skalarprodukt-Prüfung (`checkWallFitCm`):**
   * Projiziert den Möbelmittelpunkt $P_{\text{furn}}$ mittels Skalarprodukt auf die Wandachse: $s = (P_{\text{furn}} - A) \cdot \hat{u}_{\text{wall}}$.
   * Belegtes Intervall des Möbelstücks auf der Wand: $[s_{\min}, s_{\max}] = [s - W/2, \, s + W/2]$.
   * Prüft:
     * `wall-exceeded`: $W > L_{\text{wall}} + \epsilon$ (Möbelstück ist insgesamt länger als die Wand; Differenz $W - L_{\text{wall}}$ in cm wird ausgegeben).
     * `corner-overflow`: $s_{\min} < -\epsilon$ (ragt über Start-Ecke $A$ hinaus) oder $s_{\max} > L_{\text{wall}} + \epsilon$ (ragt über End-Ecke $B$ hinaus).
     * `opening-blocked`: Schneidet $[s_{\min}, s_{\max}]$ eine Türöffnung oder ein Fenster, dessen Brüstungshöhe `sillHeightCm` kleiner als die Möbelhöhe (`elevationCm + heightCm`) ist?
   * Berechnet zudem den freien Restabstand nach links ($s_{\min}$) und rechts ($L_{\text{wall}} - s_{\max}$) in cm.
4. **Automatisches Wand-Snapping (`findWallSnap`):**
   * Liegt der senkrechte Abstand eines Möbelstücks zur Wandinnenfläche unterhalb eines Schwellwerts (`snapThresholdCm = 20 cm`), wird die Rotation des Möbelstücks parallel zur Wand ausgerichtet und der Mittelpunkt auf den exakten Wandabstand $\frac{\text{thicknessCm}}{2} + \frac{\text{depthCm}}{2}$ eingerastet.

### 4.2 3D-OBB-Kollisionsprüfung (`src/core/collisionEngine.ts`)
* Jedes Möbelstück, jedes reale Wandsegment und jede Tür-Schwenkzone (Quader über der Grundfläche des 90°-Türblatts) wird in eine [`THREE.OBB`](https://threejs.org/docs/#examples/en/math/OBB) umgewandelt.
* Die lokale Box des Möbelstücks wird vor der Transformation um $\epsilon = 0.05\text{ cm}$ verkleinert (`expandByScalar(-0.05)`), sodass bündiger Kontakt an der Wand oder zum Nachbarschrank erlaubt ist.
* Überschneidungen zwischen beliebig gedrehten Möbeln (`activeOBB.intersectsOBB(otherOBB)`), ungesnappten Wänden oder Tür-Schwenkbereichen erzeugen strukturierte `CollisionIssue`-Einträge.

---

## 5. Benutzeroberfläche & Interaktionsfluss

1. **TopBar (`TopBar.tsx`):**
   * Umschaltung des Ansichtsmodus: `2D Grundriss` | `Split (2D + 3D)` | `3D Isometrie (Orthographic)` | `3D Perspektive (Perspective)`.
   * Toggle für „Cutaway-Wände automatisch absenken“, Preset-Auswahl (Leerer Raum, Beispiel-Wohnung) sowie JSON-Export/Import.
2. **2D-Grundriss-Editor (`FloorplanCanvas2D.tsx`):**
   * SVG-Zeichenfläche mit Zoom/Pan, 10-cm-/100-cm-Raster und Bemaßungsbeschriftungen in `cm` an jeder Wand.
   * Modi: `Auswählen / Verschieben`, `Wand zeichnen` (mit Eck-Snapping), `Tür einfügen`, `Fenster einfügen`.
   * Möbel werden als maßstabsgetreue 2D-Rechtecke (inkl. Rotationswinkel, Name, Maßangabe `B×T cm` und roter Warnmarkierung bei Kollision) dargestellt und lassen sich direkt per Drag-and-Drop verschieben.
3. **3D-Viewport (`Scene3D.tsx`, `WallMesh3D.tsx`, `FurnitureMesh3D.tsx`):**
   * Prozedurale 3D-Wände mit echten Aussparungen für Türen (inkl. Türrahmen/Schwenkbogen-Markierung) und Fenster (inkl. transparenter Scheibe).
   * Kamerazugewandte Wände senken sich im Cutaway-Modus automatisch auf `30 cm` Sockelhöhe ab (wie im RoomSketcher-Referenzbild).
   * Möbel lassen sich in 3D anklicken, auf der XZ-Ebene ziehen (mit Live-Wand-Snapping) und zeigen ein schwebendes Maß-/Kollisions-Label. Bei Konflikten leuchtet das Möbelstück rot.
4. **Inspector- & Katalog-Sidebar (`InspectorSidebar.tsx`):**
   * **Ausgewählte Wand:** Exakte Eingabe der Wandlänge in `cm`, Wandstärke (`cm`), Wandhöhe (`cm`) sowie Liste der Türen/Fenster auf dieser Wand.
   * **Ausgewähltes Möbelstück:** Direkte Zahleneingabe für `Name`, `Breite (cm)`, `Höhe (cm)`, `Tiefe (cm)`, `Position X/Z (cm)`, `Rotation (°)` und `Farbe` sowie detaillierte Anzeige aller aktiven Kollisionsmeldungen und Wandabstände.
   * **Möbel-Katalog & Generator:** Schnelles Hinzufügen typischer Möbel (Sofa, Kleiderschrank, Bett, Esstisch, Schreibtisch) oder eines individuell bemaßten Wunschmöbels.

---

## 6. Fehlerbehandlung & Randfälle

* **Validierung von Benutzereingaben:** Wandlängen $< 10\text{ cm}$ oder Möbelmaße $< 1\text{ cm}$ werden auf gültige Minimalwerte begrenzt.
* **Entartete Wände:** Haben Start- und Endpunkt einer Wand denselben Ort ($L_{\text{wall}} < 1\text{ cm}$), wird die Wand im Renderer und in der Kollisionsberechnung sicher übersprungen.
* **Öffnungen größer als Wand:** Wird eine Wand verkürzt, sodass eine enthaltene Tür/ein Fenster übersteht, wird das `offsetFromStartCm` geklemmt bzw. eine Warnung ausgegeben.
* **Fehlertoleranter JSON-Import:** Ungültige JSON-Dateien werden abgefangen, ohne den aktuellen App-State zu überschreiben.

---

## 7. Testing & Verifikation

1. **Automatisierte Unit-Tests (Vitest):**
   * `tests/wallMath.test.ts`: Verifiziert `checkWallFitCm` (Möbel kürzer, exakt gleich lang mit $\epsilon$-Toleranz, länger als Wand; Überstand links/rechts; schräge Wände; Tür-/Fenster-Überdeckung; `setWallLengthCm`).
   * `tests/collisionEngine.test.ts`: Verifiziert `THREE.OBB`-Kollisionen (achsenparallele und um $45^\circ$ gedrehte Möbel, bündige Platzierung ohne Fehlalarm, Kollision mit Tür-Schwenkzone).
   * `tests/store.test.ts`: Verifiziert das Hinzufügen/Ändern von Wänden und Möbeln im Zustand-Store sowie JSON-Export/Import.
2. **Build- & Browser-Verifikation:**
   * Sauberer TypeScript-Build (`npm run build`) und Ausführung der Vitest-Suite (`npm test`).
   * Visuelle Prüfung der laufenden App im Browser (2D/3D-Split-View, isometrische Kamera, Maßeingabe in cm, rote Kollisionswarnung bei zu langem Möbelstück an einer Wand).

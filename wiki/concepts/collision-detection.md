# Zweistufige Kollisions- & Wandlängenprüfung (`1D` + `3D OBB`)

**Quellen:** [2026-10-20-threejs-research-report.md](../../raw/2026-10-20-threejs-research-report.md), [din-and-neufert-standards.md](../../raw/furniture-specs/din-and-neufert-standards.md)  
**Verwandte Konzepte:** [coordinate-system-cm.md](coordinate-system-cm.md), [wall-graph-topology.md](wall-graph-topology.md), [app-state-and-views.md](../architecture/app-state-and-views.md)

---

## 1. Stufe 1: 1D-Skalarprodukt-Prüfung an der Wand (`checkWallFitCm`)

Ist ein Möbelstück (`widthCm` $= W$, `heightCm` $= H$, `elevationCm` $= E$) an eine Wand $AB$ der Länge $L_{\text{wall}}$ gesnappt (`snappedWallId`), prüft `checkWallFitCm` in `src/core/wallMath.ts` per 1D-Projektion:

$$s = (P_{\text{furn}} - A) \cdot \hat{u}_{\text{wall}}, \quad [s_{\min}, s_{\max}] = \left[s - \frac{W}{2}, \, s + \frac{W}{2}\right]$$

Mit der Toleranz $\epsilon = \text{EPSILON\_CM} = 0.05\text{ cm}$ werden drei Fehlerklassen (`CollisionIssue`) ausgewertet:

1. **`wall-exceeded` (Möbel länger als Wand):**
   $$W > L_{\text{wall}} + \epsilon$$
   Das Möbelstück passt selbst bei optimaler Verschiebung nicht an diese Wand. Der Überstand `overflowCm` beträgt $W - L_{\text{wall}}$.
2. **`corner-overflow` (Überstand über Wand-Endpunkte):**
   $$s_{\min} < -\epsilon \quad \text{oder} \quad s_{\max} > L_{\text{wall}} + \epsilon$$
   Das Möbelstück ragt links über Ecke $A$ ($\Delta = -s_{\min}$) oder rechts über Ecke $B$ ($\Delta = s_{\max} - L_{\text{wall}}$) hinaus.
3. **`opening-blocked` (Tür oder niedriges Fenster überdeckt):**
   Für jede `WallOpening` auf der Wand mit Intervall $[o_{\text{start}}, o_{\text{end}}]$:
   $$\max(s_{\min}, o_{\text{start}}) < \min(s_{\max}, o_{\text{end}}) - \epsilon$$
   Wenn sich die horizontalen Intervalle schneiden **und** die Möbeloberkante $E + H > \text{sillHeightCm} + \epsilon$ (bzw. Möbelunterkante $E < \text{sillHeightCm} + \text{opening.heightCm} - \epsilon$) liegt, blockiert das Möbelstück das Fenster oder die Tür.

Zusätzlich liefert `checkWallFitCm` die freien Restabstände zu den Raumecken:
$$\text{leftCm} = s_{\min}, \quad \text{rightCm} = L_{\text{wall}} - s_{\max}$$

---

## 2. Automatisches Wand-Snapping (`findWallSnap`) & Kante-an-Kante Möbel-Snapping (`computeFurnitureAlignment`)

Wird ein Möbelstück in die Nähe einer Wand gezogen (senkrechter Abstand der Möbelrückseite zur Wandinnenfläche $\le \text{snapThresholdCm} = 20\text{ cm}$ und Projektion $s \in [0, L_{\text{wall}}]$):
* Der Abstand des Möbelmittelpunkts zur Wandmittellinie wird exakt auf
  $$d_{\text{snap}} = \frac{\text{thicknessCm}}{2} + \frac{\text{depthCm}}{2}$$
  gesetzt.
* Der Rotationswinkel `rotationYDeg` wird automatisch parallel zur Wandinnenseite ausgerichtet.
* **Smart Alignment & Kante-an-Kante-Snapping (`src/core/alignmentMath.ts`, Paket 3C):** Ist `snapToWallEnabled` aktiv, prüft `computeFurnitureAlignment` beim Verschieben (`moveFurniture`) mit einer Fangschwelle von `DEFAULT_FURNITURE_SNAP_THRESHOLD_CM = 8 cm`:
  * **Wand-Tangential-Snapping:** Steht ein weiteres Möbel auf derselben Wand (`snappedWallId`), rastet das bewegte Möbelstück bei Annäherung auf exakt $0\text{ cm}$ Spalt bündig Kante an Kante (`kind: 'flush'`, `label: 'Bündig (0 cm)'`) oder mittig (`kind: 'center'`) ein.
  * **Raum-Achsen- & Kanten-Snapping:** Für frei im Raum stehende Möbel (z. B. Couchtisch vor dem Sofa oder Teppich/Stuhl am Tisch) berechnet `getFurnitureWorldBoundsXZ` die gedrehte XZ-Ausdehnung (`effWidthCm`, `effDepthCm`) und rastet unabhängig auf X- und Z-Achse auf Mittelachsen (`kind: 'center'`), Fluchtkanten (`kind: 'edge'`) oder bündigen Kontakt (`kind: 'flush'`) ein.
  * Aktive Hilfslinien (`AlignmentGuide`) werden in `activeAlignmentGuides` gehalten, in 2D (`FloorplanSvg2D.tsx`) und 3D (`Scene3D.tsx`) als gestrichelte Fluchtlinien dargestellt und beim Loslassen (`clearAlignmentGuides`) geleert.

---

## 3. Stufe 2: 3D-Kollisionsprüfung mit `THREE.OBB` (`collisionEngine.ts`)

Für frei im Raum stehende oder gedrehte Möbel sowie für Kollisionen zwischen zwei Möbelstücken oder mit Tür-Schwenkbereichen verwendet `src/core/collisionEngine.ts` **Oriented Bounding Boxes (`OBB`)** aus `three/addons/math/OBB.js`:

* **Möbel-OBB (`computeFurnitureOBB`):**
  * Mittelpunkt: $(x, \, \text{elevationCm} + H/2, \, z)$
  * Halbachsen (`halfSize`): $\left(\max(0.5, \frac{W}{2} - \epsilon), \, \max(0.5, \frac{H}{2} - \epsilon), \, \max(0.5, \frac{D}{2} - \epsilon)\right)$
  * Rotation: 3×3-Rotationsmatrix aus `Euler(0, rotationYRad, 0)`
* **Möbel-Möbel-Schnitt (`furniture-intersection`):** `obbA.intersectsOBB(obbB)` erkennt Kollisionen auch bei $30^\circ$- oder $45^\circ$-Drehung exakt.
* **Wand-Schnitt (`wall-intersection`):** Prüft, ob ein Möbelstück in das Volumen einer (nicht gesnappten oder angrenzenden) Wand eindringt.
* **Tür-Schwenkbereich (`opening-blocked`):** Schwenkbare Türen (`door`, `balcony-door`, geprüft über `openingHasSwingArc(op.type)`) prüfen ihren Aufschlag über einen exakten **90°-Kreissektor** (`isPointInDoorSwingArcCm`), wodurch Fehlalarme in den Bounding-Box-Ecken außerhalb des Radius vollständig eliminiert werden. Schiebetüren (`sliding-door`) und offene Wanddurchgänge (`passage`) erzeugen keinen 90°-Schwenkbogen im Raum; ihre lichte Wandöffnung wird jedoch weiterhin in `checkWallFitCm` gegen zugestellte Möbel geschützt.

---

## 4. Compound-OBBs für komplexe Möbel-Geometrien

`computeFurnitureOBBs` liest die Kästen aus [`furnitureShapes.ts`](../../src/core/furnitureShapes.ts), Funktion `layoutFurnitureParts`. Dieselbe Funktion legt die 3D-Gruppen. Bild und Kollision haben damit dieselbe Mitte und dieselbe Größe. Die Halbachsen schrumpfen weiter um `EPSILON_CM` (0,05). Die Mitten schrumpfen nicht.

Welches Layout gilt, entscheidet nur `visual`:

1. **`dining-table`:** eine Tischplatte und die Stühle. Die Stuhlhöhe ist `min(Höhe, 75)` cm. Die Stuhltiefe ist `Sitzgröße × 0,95 + 4` cm. Der Stuhl steht bei `±(Tiefe/2 + 12)` cm. Der Zwischenraum unter der Platte bleibt frei.
2. **`sectional-sofa`:** zwei Kästen. Die Chaiselongue ist `clamp(Breite × 0,42, 80, 105)` cm breit. Der Hauptkörper ist `clamp(Tiefe × 0,6, 85, 100)` cm tief. Die offene Ecke bleibt frei. `visual: 'sofa'` bleibt ein Kasten.
3. **`bed`:** der Bettkörper und, wenn Nachtkästen an sind, zwei Kästen à `min(30, Breite × 0,15)` × 35 × 40 cm. Die Mitte in der Tiefe liegt bei `-Tiefe/2 + Kopfteil + 25` cm. Die Anhebung ist 15 cm. Nachtkästen gibt es nur bei `visual === 'bed'` und bei `hasNightstands === true` oder bei fehlendem Schalter und Breite ab 190 cm. `generic-bed` hat keine Nachtkästen.
4. **Alles andere:** ein Kasten um den Ursprung.

---

## 5. Schrank- und Küchenauszugszonen (`clearanceZoneCm`)

Für Schränke (`wardrobe`) und Küchenzeilen (`kitchen_unit`, `kitchen_island`) existiert eine funktionale **50-cm-Auszugszone** (`clearanceZoneCm: 50`):
- Definiert den Raum vor den Schubladen und Drehtüren, der nicht durch andere Möbel, Schwenktüren oder Wände zugestellt werden darf.
- Wird im 2D- und 3D-Editor als gestrichelter Funktionsbereich dargestellt.
- Führt bei Überlappung zum spezifischen Fehlercode `clearance-blocked` („Auszugszone blockiert“).

---

## 6. Lichte Kante-zu-Kante-Durchgangsanalyse & DIN 18040 Ergonomie-Engine (`ergonomicsEngine.ts`)

Zusätzlich zur binären Kollisionsprüfung (Ja/Nein) berechnet [`src/core/ergonomicsEngine.ts`](../../src/core/ergonomicsEngine.ts) über das **Separating Axis Theorem (SAT)** und analytische Punkt-zu-Strecke-Projektionen systematisch alle lichten Durchgangsweiten der Wohnung:

- **Untersuchte Relationen:**
  1. **Möbel $\leftrightarrow$ Möbel:** Kante-zu-Kante-Minimaldistanz rotierter Bounding-Boxes.
  2. **Möbel $\leftrightarrow$ Wand:** Bidirektionale Projektion (Möbelecken auf Wandmittellinie abzüglich halber Wandstärke sowie Wandendpunkte auf Möbelkanten).
- **Intelligente Rauschunterdrückung (False Positives Elimination):**
  - Möbel mit bündigem Wandanschluss ($\le 5\text{ cm}$ oder mit Snap-Zuordnung) werden ignoriert, damit Wandregale oder Schreibtische nicht als Durchgangs-Engstellen fehlinterpretiert werden.
  - Vertikal gestapelte Einheiten (Objekte auf Schreibtischen oder Regalen mit disjunkten Höhenintervallen $[E_1, E_1 + H_1]$ und $[E_2, E_2 + H_2]$) werden ausgeschlossen.
- **DIN 18040 Ampel-Klassifizierung:**
  - $< 60\text{ cm}$: **Kritisch** (Rot `#ef4444`, `⚠️ X cm`) — Mindestmaß für seitliches Durchzwängen unterschritten.
  - $60\dots90\text{ cm}$: **Warnung** (Amber `#f59e0b`, `⚡ X cm`) — Eingeschränkter Durchgang; für Nebenwege passierbar, für barrierefreie Hauptwege unzureichend.
  - $90\dots120\text{ cm}$: **Optimal** (Grün `#10b981`, `✓ X cm`) — Normgerechter barrierefreier Hauptdurchgang.
- **Querverweis:** Detaillierte mathematische Formeln und die 2D-/3D-Visualisierung sind in [precision-editor-and-scale-export.md](precision-editor-and-scale-export.md#5-grundriss-unterleger-tracing--din-18040-ergonomie-heatmap) dokumentiert.

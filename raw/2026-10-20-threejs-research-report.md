# Recherchebericht: 3D-Wohnungsvisualisierung, Raumplanung & Kollisionsprüfung mit Three.js

**Datum:** 2026-10-20  
**Status:** Immutable Raw Source (`raw/`)

---

## 1. Visuelle & Funktionale Referenzen

Für die Gestaltung einer übersichtlichen, maßstabsgetreuen 3D-Wohnungsvisualisierung (isometrischer Cutaway-Blick von schräg oben, klar erkennbare Wandstärken, Türöffnungen, Bodenbeläge und parametrische Möblierung) dienen folgende Referenzen als Leitbild:

1. **RoomSketcher 3D-Floorplan-Darstellung:**  
   `https://fpg.roomsketcher.com/image/level/698/3d/Stilvolles-Layout-f%C3%BCr-eine-3-Zimmer-Wohnung-mit-gro%C3%9Fem-Bad-3D.jpg`  
   *Merkmale:* Schräger Aufsichtwinkel, automatische Wandabsenkung (Cutaway) für freie Sicht ins Rauminnere, deutliche Konturen der Innen- und Außenwände, maßstabsgetreue Möbelblöcke.
2. **ArchDaily / Neufert Plan Visualizer:**  
   `https://neufert-cdn.archdaily.net/uploads/photo/image/420535/Architect-AI_Plan_Visualizer-02.jpg?v=1789133244`  
   *Merkmale:* Architektonische Klarheit, Kombination aus Grundriss-Bemaßung und plastischer 3D-Volumendarstellung nach Neufert-Entwurfsnormen.

---

## 2. Open-Source-Referenzarchitekturen (Three.js / WebGL)

### 2.1 Blueprint3D (`furnishup/blueprint3d`)
* **Datenmodell:** Trennt den Grundriss strikt in einen **Corner/Wall-Graph** (`Corner` mit 2D-Koordinaten `(x, z)` und `Wall` als Kante zwischen `startCorner` und `endCorner`).
* **Vorteil:** Verschiebt man eine Ecke oder ändert die Länge einer Wand, passen sich alle verbundenen Wände konsistent an. Räume entstehen als geschlossene Zyklen im Wandgraphen.
* **Cutaway-Technik:** Wände, deren Innennormale von der Kamera wegzeigt (d. h. die zwischen Kamera und Raummittelpunkt stehen), werden ausgeblendet oder auf Sockelhöhe (`30 cm`) abgesenkt.

### 2.2 React-Planner (`cvdlab/react-planner`)
* **Architektur:** Synchronisierter State zwischen einem 2D-SVG-Grundriss-Editor (Zeichnen von Wänden, Platzieren von Türen/Fenstern mit exakten Maßangaben) und einer 3D-Three.js-Szene.
* **Parametrischer Katalog:** Elemente besitzen explizite Parameter (`width`, `height`, `depth`, `altitude` / `elevation`) und werden prozedural als 3D-Meshes generiert.

---

## 3. Mathematische Grundlagen für Zentimetergenaue Prüfung (`1 Unit = 1 cm`)

Um zu prüfen, ob ein Möbelstück an eine bestimmte Wand passt, mit Nachbarmöbeln kollidiert oder eine Tür blockiert, kombinieren wir zwei Verfahren:

### 3.1 1D-Skalarprodukt-Projektion entlang der Wandachse (`checkWallFitCm`)

Gegeben sei eine Wand von Ecke $A(x_A, z_A)$ nach Ecke $B(x_B, z_B)$ mit:
$$\vec{V}_{\text{wall}} = B - A, \quad L_{\text{wall}} = \|\vec{V}_{\text{wall}}\|, \quad \hat{u}_{\text{wall}} = \frac{\vec{V}_{\text{wall}}}{L_{\text{wall}}}$$

Die ins Rauminnere zeigende Einheitsnormale lautet:
$$\hat{n}_{\text{wall}} = (-\hat{u}_{\text{wall}, z}, \, 0, \, \hat{u}_{\text{wall}, x})$$

Für ein an dieser Wand ausgerichtetes Möbelstück mit Mittelpunkt $P_{\text{furn}}(x, z)$ und Breite $W$ (`widthCm`) projizieren wir die Position mittels Skalarprodukt auf die Wandachse:
$$s = (P_{\text{furn}} - A) \cdot \hat{u}_{\text{wall}}$$

Das vom Möbelstück auf der Wand belegte 1D-Intervall ist:
$$[s_{\min}, s_{\max}] = \left[s - \frac{W}{2}, \, s + \frac{W}{2}\right]$$

Mit einer numerischen Toleranz $\epsilon = 0.05\text{ cm}$ (`EPSILON_CM`) prüfen wir:
1. **`wall-exceeded` (Möbel länger als Wand):** $W > L_{\text{wall}} + \epsilon \implies$ Überstand $\Delta = W - L_{\text{wall}}$.
2. **`corner-overflow` (Überstand über Eckpunkte):** $s_{\min} < -\epsilon$ (links über $A$) oder $s_{\max} > L_{\text{wall}} + \epsilon$ (rechts über $B$).
3. **`opening-blocked` (Tür/Fenster verdeckt):** Überlappt $[s_{\min}, s_{\max}]$ mit dem Öffnungsintervall $[o_{\text{start}}, o_{\text{end}}]$ und gilt für die Möbeloberkante $y_{\text{top}} = \text{elevationCm} + \text{heightCm} > \text{sillHeightCm} + \epsilon$, so blockiert das Möbelstück die Öffnung.

### 3.2 3D-Kollisionsprüfung mit Oriented Bounding Boxes (`THREE.OBB`)

Da `THREE.Box3` (AABB) bei gedrehten Möbeln (z. B. $45^\circ$ im Raum oder an einer schrägen Wand) zu ungenauen Hüllquadern führt, wird `OBB` aus `three/addons/math/OBB.js` (`THREE.OBB`) eingesetzt:
* Jedes Möbelstück, jedes Wandsegment und jede 90°-Tür-Schwenkzone wird als `OBB` mit Halbachsen $\left(\frac{W}{2} - \epsilon, \frac{H}{2} - \epsilon, \frac{D}{2} - \epsilon\right)$ und 3×3-Rotationsmatrix modelliert.
* Durch das Abziehen von $\epsilon = 0.05\text{ cm}$ (`0.5 mm`) können Schränke exakt „Stoß an Stoß“ (`0 cm` Abstand) oder bündig an einer Wand stehen, ohne einen Kollisions-Fehlalarm auszulösen.
* `obbA.intersectsOBB(obbB)` nutzt das Separating Axis Theorem (SAT) in 3D für exakte Schnitttests.

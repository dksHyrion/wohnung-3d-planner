# Koordinatensystem & Zentimeter-Maßstab (`1 Unit = 1 cm`)

**Quellen:** [2026-10-20-threejs-research-report.md](../../raw/2026-10-20-threejs-research-report.md), [din-and-neufert-standards.md](../../raw/furniture-specs/din-and-neufert-standards.md)  
**Verwandte Konzepte:** [wall-graph-topology.md](wall-graph-topology.md), [collision-detection.md](collision-detection.md), [app-state-and-views.md](../architecture/app-state-and-views.md)

---

## 1. Einheitlicher Maßstab: `1 Three.js Unit = 1 cm`

Im gesamten System — vom Datenmodell (`src/core/types.ts`) über den 2D-SVG-Grundriss-Editor bis zum 3D-Szenegraphen in React Three Fiber — gilt strikt:

$$\text{1 Welt-Einheit (Unit)} = 1\text{ cm}$$

Dadurch entfallen fehleranfällige Umrechnungsfaktoren zwischen Benutzereingaben (z. B. Wandlänge `340 cm` oder Schrankbreite `200 cm`) und der internen 3D-Geometrie.

---

## 2. Achsenkonvention (Rechtshändiges Y-Up-System)

| Achse | Bedeutung im Raum | 2D-Editor-Entsprechung | 3D-Viewport-Entsprechung |
| :---: | :--- | :--- | :--- |
| **`X`** | Horizontale Breite (links $\rightarrow$ rechts in `cm`) | SVG `x`-Koordinate | Welt-`X`-Achse |
| **`Z`** | Raumtiefe auf der Bodenebene (oben $\rightarrow$ unten in `cm`) | SVG `y`-Koordinate | Welt-`Z`-Achse |
| **`Y`** | Vertikale Raumhöhe ab Fußbodenoberkante (`Y = 0 cm`) | *(über Parameter `heightCm`, `elevationCm`, `sillHeightCm`)* | Welt-`Y`-Achse (Up) |

---

## 3. Numerische Toleranz (`EPSILON_CM = 0.05`)

Fließkomma-Operationen in JavaScript/TypeScript (`IEEE 754`) können bei trigonometrischen Berechnungen und Vektorprojektionen winzige Abweichungen im Bereich $10^{-12}\text{ cm}$ erzeugen. Zudem möchten Nutzer in der Praxis:
* einen `200 cm` breiten Kleiderschrank in eine exakt `200 cm` lange Wandnische stellen, oder
* zwei `100 cm` breite Schränke „Stoß an Stoß“ (`0 cm` Zwischenraum) nebeneinander platzieren.

Deshalb definiert `src/core/types.ts`:
```typescript
export const EPSILON_CM = 0.05; // 0.5 mm Toleranz
```

Alle 1D-Intervallprüfungen in [collision-detection.md](collision-detection.md) sowie die 3D-Bounding-Boxen (`THREE.OBB`) gewähren diese Toleranz von `0.05 cm` (`0.5 mm`), sodass bündiger Kontakt erlaubt ist, echte Überschneidungen ($\ge 0.1\text{ cm}$) jedoch zuverlässig erkannt werden.

---

## 4. Wichtige Richtmaße (DIN / Neufert)

Aus [din-and-neufert-standards.md](../../raw/furniture-specs/din-and-neufert-standards.md):
* **Minimale gültige Wandlänge:** `10 cm`
* **Minimales gültiges Möbelmaß:** `1 cm`
* **Standard-Wandhöhe:** `250 cm` (Cutaway-Sockelhöhe: `30 cm`)
* **Standard-Wandstärke:** `15 cm` (Innenwand) bzw. `24 cm` (Außen-/Tragwand)
* **Standard-Innentür:** `86 × 200 cm` (`sillHeightCm = 0 cm`)
* **Standard-Fenster:** `120 × 130 cm` bei `90 cm` Brüstungshöhe (`sillHeightCm = 90 cm`)

---

## 5. Wandachsen (Achsmaß) vs. Lichte Raumfläche (Wohnfläche)

Im CAD- und Architektur-Bereich wird zwischen zwei zentralen Flächenmaßen unterschieden:
1. **Achsmaß (`corners`, `areaSqM`):**
   * Alle Wandkoordinaten im Graph (`Corner.x`, `Corner.z`) repräsentieren die **Wandachsen (Mittellinien)**.
   * Das Brutto-Achsmaß-Polygon wird in `Scene3D.tsx` für den 3D-Bodenbelag genutzt, damit der Bodenbelag nahtlos bis unter die Wandachsen verläuft und keine sichtbaren Spalten entstehen.
2. **Lichte Wohnfläche (`netCorners`, `netAreaSqM`):**
   * Wandinnenkanten liegen um `thicknessCm / 2` nach innen versetzt.
   * `computeFloorPolygons` berechnet für jede Raumfacette automatisch das nach innen versetzte Netto-Polygon (`netCorners`), indem jede Kante um ihre jeweilige Wandstärke `thicknessCm / 2` entlang der Innennormalen verschoben und mit den Nachbarkanten geschnitten wird.
   * Die im 2D-Grundriss-Editor angezeigten Quadratmeter-Badges basieren auf der **lichten Wohnfläche (`netAreaSqM`)** gemäß deutscher Wohnflächenverordnung (WoFlV). So besitzt z. B. der Nebenraum bei `550 × 400 cm` lichten Innenmaßen exakt `22,00 m²` Wohnfläche.

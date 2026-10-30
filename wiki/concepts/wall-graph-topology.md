# Wand-Graph-Topologie, Öffnungen & Cutaway-Logik

**Quellen:** [2026-10-20-threejs-research-report.md](../../raw/2026-10-20-threejs-research-report.md), [din-and-neufert-standards.md](../../raw/furniture-specs/din-and-neufert-standards.md)  
**Verwandte Konzepte:** [coordinate-system-cm.md](coordinate-system-cm.md), [collision-detection.md](collision-detection.md), [app-state-and-views.md](../architecture/app-state-and-views.md)

---

## 1. Corner/Wall-Graph (Blueprint3D-Pattern)

Anstatt Wände als isolierte Rechtecke zu speichern, modelliert `src/core/types.ts` den Grundriss als ungerichteten/gerichteten Graphen:
* **Knoten (`Corner`):** Punkt auf der XZ-Bodenebene mit `(x, z)` in `cm`.
* **Kanten (`Wall`):** Verbindet `startCornerId` ($A$) mit `endCornerId` ($B$) und besitzt `thicknessCm` (Standard `15 cm`) sowie `heightCm` (Standard `250 cm`).

### Vektorgeometrie (`getWallGeometry`)
Für eine Wand von $A(x_A, z_A)$ nach $B(x_B, z_B)$ gilt:
$$\vec{V}_{\text{wall}} = \begin{pmatrix} x_B - x_A \\ z_B - z_A \end{pmatrix}, \quad L_{\text{wall}} = \sqrt{(x_B - x_A)^2 + (z_B - z_A)^2}$$

Der tangentiale Einheitsvektor $\hat{u}_{\text{wall}}$ und die um $+90^\circ$ gedrehte Innennormale $\hat{n}_{\text{wall}}$ lauten:
$$\hat{u}_{\text{wall}} = \frac{\vec{V}_{\text{wall}}}{L_{\text{wall}}}, \quad \hat{n}_{\text{wall}} = \begin{pmatrix} -\hat{u}_{\text{wall}, z} \\ \hat{u}_{\text{wall}, x} \end{pmatrix}$$

Bei einem im Uhrzeigersinn (auf der XZ-Ebene mit $+Z$ nach unten) definierten Raum zeigt $\hat{n}_{\text{wall}}$ exakt ins Rauminnere.

---

## 2. Exakte Wandlängen-Skalierung (`setWallLengthCm`)

Möchte der Nutzer im Inspector eine Wand auf ein exaktes Zentimetermaß $L_{\text{neu}} \ge 10\text{ cm}$ setzen, bleibt der Startpunkt $A$ fixiert und der Endpunkt $B$ wird entlang des Tangentenvektors verschoben:
$$B_{\text{neu}} = A + \max(10, L_{\text{neu}}) \cdot \hat{u}_{\text{wall}}$$

Da benachbarte Wände über dieselbe `Corner.id` mit $B$ verknüpft sind, aktualisiert sich die Raumgeometrie automatisch.

---

## 3. Wandöffnungen (`WallOpening`: 5 Bauarten)

Jede Öffnung referenziert ihre Wand über `wallId` und definiert ihre Lage als 1D-Offset `offsetFromStartCm` entlang der Wandachse ab `startCorner`:
* **5 unterstützte Öffnungstypen (`OpeningType`):**
  1. `'door'` — Klassische Drehtür mit 90°-Schwenkbogen (`openingHasSwingArc === true`).
  2. `'window'` — Fenster mit Brüstungshöhe (`sillHeightCm`), Tageslichteinfall (`openingLetsLightThrough === true`) und 3D-Fensterrahmen (`WindowFrame3D.tsx`).
  3. `'sliding-door'` — Schiebetür mit parallel zur Wand laufendem Türblatt und Laufschiene **ohne** 90°-Schwenkbogen (`openingHasSwingArc === false`).
  4. `'passage'` — Offener Wanddurchgang / Zargendurchbruch mit Laibungsrahmen ohne Türblatt und ohne Schwenkbogen (`openingHasSwingArc === false`).
  5. `'balcony-door'` — Verglaste Balkon-/Terrassentür (`sillHeightCm = 0`) mit 90°-Schwenkbogen (`openingHasSwingArc === true`) **und** Tageslichteinfall (`openingLetsLightThrough === true`, erzeugt Sonnen-Richtungsgewicht und `WindowLightPool3D`).
* **Belegtes Wandintervall:** $\left[\text{offsetFromStartCm}, \, \text{offsetFromStartCm} + \text{widthCm}\right]$
* **Vertikales Intervall:** $\left[\text{sillHeightCm}, \, \text{sillHeightCm} + \text{heightCm}\right]$
* **3D-Darstellung (`WallMesh3D.tsx`, `DoorLeaf3D.tsx`):** Eine Wand mit Öffnungen wird prozedural in linke/rechte Wandpfeiler, Sturz (oberhalb der Öffnung) und bei Fenstern eine Brüstung (unterhalb `sillHeightCm`) zerlegt. `DoorLeaf3D.tsx` rendert je nach `opening.type` entweder das 72° geöffnete Drehblatt mit Boden-Schwenklinie (`door`, `balcony-door` mit Glaseinsatz), das parallele Schiebetürblatt mit Laufschiene (`sliding-door`) oder nur die Zargenverkleidung (`passage`). Die Klassifikationsfunktionen (`openingHasSwingArc`, `openingLetsLightThrough`, `openingIsWalkthrough`, `OPENING_TYPE_LABELS`) liegen in [`doorLeaf.ts`](../../src/core/doorLeaf.ts).
* **3D-Fensterrahmen (`WindowFrame3D.tsx`):** Jede Fensteröffnung erhält einen umlaufenden Rahmen (`window-frame`), ab 90 cm Breite einen zweiflügeligen Mittelpfosten (`window-mullion`), einen Metallgriff (`window-handle`) sowie eine innen- und außenseitig überstehende Fensterbank (`window-sill`), während das Single-Pass-Fensterglas (`window-glass`) unverändert bleibt.
* **Wand- und Ecken-Löschung (`removeWall`, `removeCorner`):** Das Entfernen einer Wand löscht zugehörige `WallOpening`-Einträge, setzt `snappedWallId` betroffener Möbel auf `null` und bereinigt isolierte Ecken ohne verbleibende Wandkante.
* **Kappen:** `computeWallCaps(Wandhöhe, Wandstärke, Wandstücke)` behält die Stücke, deren Oberkante auf der Wandhöhe liegt. `computeCutawayCaps` bekommt Wandlänge, Wandstärke und die Öffnungen. Eine Öffnung teilt die Schnittkappe nur, wenn ihre Brüstung unter 5 cm liegt. Eine Tür mit Brüstung 0 bleibt bis zum Boden frei. Ein Fenster mit Brüstung, im Test 90 cm, bleibt ein Stück. Farbe `#2e2a26` (`WALL_CAP_COLOR`), Höhe `1.5` cm, die Kappe ist `0.4` cm dicker als die Wand. Die Schnittkante sitzt auf `CUTAWAY_HEIGHT_CM` (30) plus einer halben Kappenhöhe.

---

## 4. Automatische Cutaway-Wände (`shouldCutawayWall`)

Nach dem Vorbild der [RoomSketcher-3D-Referenz](../../raw/2026-10-20-threejs-research-report.md) sollen Außenwände, die zwischen der 3D-Kamera und dem Rauminneren stehen, den Blick nicht versperren:
1. Bestimme den Vektor vom Wandmittelpunkt $M_{\text{wall}}$ zum Raummittelpunkt $C_{\text{room}}$ und richte die Innennormale $\hat{n}_{\text{in}}$ so aus, dass $\hat{n}_{\text{in}} \cdot (C_{\text{room}} - M_{\text{wall}}) > 0$.
2. Berechne den Sichtvektor von der Wand zur Kamera: $\vec{v}_{\text{cam}} = P_{\text{cam}} - M_{\text{wall}}$.
3. Liegt die Kamera auf der Außenseite der Wand ($\hat{n}_{\text{in}} \cdot \vec{v}_{\text{cam}} < 0$), wird die Wand im Cutaway-Modus auf `30 cm` Sockelhöhe abgesenkt.

---

## 5. Mehrraum-Bodenpolygone (`computeFloorPolygons`) & Innenwände (`getInteriorWallIds`)

Sobald mehrere Räume aneinander anschließen (z. B. L-Schnitt-Hauptraum `24,3 m²` lichte Fläche / `25,9 m²` Achsmaß + rechts anschließender `22,0 m²` Nebenraum mit `550 × 400 cm` lichten Innenmaßen), entstehen im Wandgraphen T-Knoten mit Grad $\ge 3$ (z. B. `c7` bei `z = 415 cm`).

> [!NOTE] Topologische Voraussetzung für T-Verbindungen
> Die planare Facettenextraktion setzt voraus, dass an jedem Abzweigpunkt ein expliziter Eckknoten im Graphen existiert (z. B. geteilte Wand `w2` und `w2b` an Ecke `c7`). Das automatische Aufspalten bestehender Wände beim manuellen Hinzufügen einer T-Verbindung im UI-Zeichenmodus ist als künftige Store-Erweiterung (`splitWallAt`) vorgesehen.

1. **Planare Facetten-Extraktion (`computeFloorPolygons`):**
   * Bereinigt zunächst iterativ offene Stichwände (Knoten mit Grad $< 2$).
   * Zerlegt jede Wand in zwei gerichtete Halbkanten $(u \to v)$ und $(v \to u)$.
   * Wählt an jedem Knoten $v$ die ausgehende Kante $(v \to w)$ mit dem kleinsten positiven Rechts-Drehwinkel $\Delta \theta = (\theta_{\text{rev}} - \theta_{\text{out}}) \bmod 2\pi$.
   * Berechnet über die Shoelace-Formel den Flächeninhalt. Positive Zyklen ($A > 0$) sind geschlossene Innenräume (`areaSqM = A / 10000`), während die äußere Umrandung ($A < 0$) herausgefiltert wird.
   * **Lichte Wohnflächen-Berechnung (`netCorners`, `netAreaSqM`):** Versetzt jede Raumkante um ihre wandindividuelle Stärke `thicknessCm / 2` entlang der Innennormalen nach innen und berechnet die Schnittpunkte benachbarter Kanten. Kollineare Kanten an T-Knoten werden robust ohne Division durch Null behandelt.
2. **Innenwand-Erkennung (`getInteriorWallIds`):**
   * Gehören sowohl $(u \to v)$ als auch $(v \to u)$ einer Wand zu einem Innenraum-Zyklus, handelt es sich um eine **Innen-/Trennwand** zwischen zwei Räumen.
   * Innenwände (samt ihrer Verbindungstür) bleiben im 3D-Cutaway-Modus auf voller Raumhöhe stehen, während nur kamerazugewandte Außenwände auf `30 cm` abgesenkt werden.

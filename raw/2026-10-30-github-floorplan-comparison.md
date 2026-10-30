# Recherchebericht: Vergleichbare Open-Source 2D/3D-Raumplaner auf GitHub (Three.js / WebGL)

**Datum:** 2026-10-30  
**Status:** Immutable Raw Source (`raw/`)

---

## 1. Untersuchte Open-Source-Referenzprojekte auf GitHub

Im Rahmen der Weiterentwicklung unserer zentimetergenauen 3D-Wohnungsvisualisierung (`1 Three.js Unit = 1 cm`) wurden die führenden Open-Source-Projekte für 2D/3D-Grundrissplanung und Inneneinrichtung auf GitHub untersucht:

| GitHub-Repository | Tech-Stack | Zentrale Architektur- & Feature-Merkmale |
| :--- | :--- | :--- |
| **`laanlabs/openPlan3D`** | SvelteKit + Three.js + Apple RoomPlan (LiDAR) | • **Erweiterte Wandöffnungen:** Neben klassischen Drehtüren und Fenstern werden Schiebetüren (*sliding*), Taschentüren (*pocket*), Doppelflügeltüren (*double*), Falttüren (*bifold*) und offene Wanddurchbrüche (*passage*) unterstützt.<br>• **Gehrungsschnitte (Miter Joints):** Sauber verschnittene Wandecken ohne Überlappungs-Artefakte.<br>• **Multi-Format-Export:** PNG, SVG, DXF, DWG, PDF, JSON, USDZ sowie Import von iPhone/iPad Pro LiDAR-Raumscans (`RoomPlan`).<br>• **Local-First:** Vollständig clientseitige Speicherung ohne Cloud-Zwang. |
| **`charmlinn/blueprint3d-modern`** *(TypeScript-Rewrite von `furnishup/blueprint3d`)* | TypeScript + Three.js (r181+) + Next.js | • **Corner/Wall-HalfEdge-Topologie:** Jede Wand besitzt gerichtete Halbkanten (`HalfEdge`). An jedem Eckknoten (`Corner`) wird die Winkelhalbierende (*bisector*) berechnet, sodass Wandkörper und Fußleisten im 45°-Gehrungswinkel exakt abschließen.<br>• **Nachträgliches Wand-Splitting (`splitWallAt`):** Ein Klick auf eine bestehende Wand teilt diese durch Einfügen eines neuen `Corner`-Knotens in zwei kollineare Teilwände (ideal für T-Wände und Erker).<br>• **IndexedDB-Persistenz:** Lokale Speicherung großer Grundriss- und Texturdaten im Browser. |
| **`cvdlab/react-planner`** | React + Three.js + 2D-SVG | • **Haustechnik- & MEP-Layer:** Eigene Katalog-Elemente für Steckdosen, Lichtschalter, Heizkörper, Klima-/Lüftungsgeräte sowie Wasser-/Abwasseranschlüsse.<br>• **Smart Alignment Guides:** Magnetische Hilfslinien beim Verschieben von Elementen (Kante-an-Kante-Snapping und Mittelachsen-Fluchtlinien zwischen Möbeln).<br>• **Layer-System:** Getrennte Sichtbarkeitsschichten für Rohbau, Möblierung und Haustechnik. |
| **`threejs-sims-house-builder`** | React + Three.js (100% prozedural) | • **Halbkanten-Wandmaterialien:** Innen- und Außenseite einer Wand (bzw. jede Raumseite einer Innenwand) können unabhängig voneinander gestrichen oder mit Akzentpaneelen belegt werden.<br>• **Sicht- & Lichtkegel-Overlays:** Visuelle Kegel im Grundriss zur Beurteilung von Kamera- und Blickwinkeln. |
| **`SweetHome3D` (`emmanuelp/SweetHome3D`, JS/WebGL Viewer)** | Java / JS + WebGL | • **Interaktiver Teppich- & Zonen-Editor:** Teppiche (`AreaRug`) und Bodenebenen sind als eigenständige Objekte in 2D und 3D frei anlegbar, skalierbar, drehbar und einfärbbar.<br>• **Architektonische Sonderbauteile:** Wandnischen, Versorgungsschächte/Wandpfeiler (Kamin, Steigleitungen), Dachschrägen und abgehängte Decken.<br>• **Interaktive Begehung:** Freie First-Person-Navigation per Tastatur (WASD / Pfeiltasten) auf menschlicher Augenhöhe. |

---

## 2. Stärken unserer Architektur im Vergleich zu bestehenden GitHub-Projekten

Der direkte Code- und Funktionsvergleich zeigt fünf Bereiche, in denen unser Projekt (`Wohnung`) sämtlichen untersuchten Open-Source-Alternativen auf GitHub bereits deutlich voraus ist:

1. **Analytische SAT-Ergonomie & DIN 18040 Laufwege-Engine (`src/core/ergonomicsEngine.ts`):**
   * Kein anderes Open-Source-Projekt berechnet live die exakte lichte Kante-zu-Kante-Durchgangsbreite zwischen beliebig gedrehten Compound-Möbeln und Wänden mittels Separating Axis Theorem (SAT) inklusive DIN 18040 Ampel-Klassifizierung (`< 60 cm` kritisch, `60–90 cm` eingeschränkt, `90–120 cm` barrierefrei) sowie 2D/3D-Bodenstreifen (`PassageClearance3D.tsx`).
2. **Compound-OBB-Kollisionsgeometrie & exakter 90°-Türkreissektor (`src/core/collisionEngine.ts`, `src/core/furnitureShapes.ts`):**
   * Während `blueprint3d` und `react-planner` einfache AABB-Hüllquader nutzen (die bei L-Ecksofas, Esstischen mit untergeschobenen Stühlen oder im freien Eckbereich eines Türschwenks Fehlalarme auslösen), nutzt unser System mehrteilige `THREE.OBB`-Körper, 50-cm-Schrankauszugszonen (`clearanceZoneCm`) und exakte 90°-Kreissektor-Prüfungen (`isPointInDoorSwingArcCm`).
3. **Zweistufiges Möbel-Inventar (`isRealFurniture`), reale Funktionsposen & Physische Objekt-Kopplung (`attachedToId`):**
   * Strikte Trennung zwischen real besessenen Designklassikern/Bestandsmöbeln (*BoConcept Osaka Schlafcouch* mit zugeklappter 95-cm- und ausgeklappter 200-cm-Bettpose, *Inwerk Masterlift 2* mit stufenlosem Höhenbereich 62,5–127,5 cm, *Steelcase Gesture*, *Artemide Tolomeo Decentrata*, *Regalraum LIUM*, *Neona Viva*) und generischen Platzhaltern, ergänzt um mitfahrende/mitrotierende Kind-Objekte (`attachedToId`, z. B. Monitor auf dem Masterlift).
4. **Maßstabsgetreuer DIN 1356 Architektur-Vektorexport 1:50 & 1:100 (`src/core/export/planSvgExport.ts`):**
   * Druckfertige DIN A4/A3-Vektorpläne mit exakter Millimeter-Skalierung ($0{,}2\text{ mm/cm}$ bzw. $0{,}1\text{ mm/cm}$), Außenbemaßungsketten, Netto-Raumstempeln („Lichte Innenfläche“), normiertem Plankopf und grafischer Maßstabsleiste.
5. **Mathematische Mood-Engine & 0-Pass Performance-Architektur (`moodPresets.ts`, `PostFX3D.tsx`):**
   * 100% offline-fähiges Lightformer-IBL, stufenlose Tageszeitinterpolation (6:00–22:00 Uhr), reale Sonnenausrichtung an Fensterflächen (`computeDominantWindowDirection`) und vollständiges Unmounten des Post-Processing-Composers im `⚡ Performance`-Modus.

---

## 3. Abgeleitete Verbesserungs-Pakete (Learnings aus den GitHub-Projekten)

Aus der Analyse der GitHub-Referenzen wurden sechs konkrete Ausbaustufen (Pakete **3A bis 3F**) abgeleitet:

* **Paket 3A — Haustechnik, Anschlüsse & Heizkörper (inspiriert von `cvdlab/react-planner` & `SweetHome3D`):**
  * Wandgebundene Haustechnik-Elemente: Heizkörper (inkl. Nischen-/Wärmestau-Prüfung unter Fenstern), Steckdosen, Lichtschalter, LAN-/TV-Dosen, Wasser-/Abwasseranschlüsse sowie Raumecken-Versorgungsschächte (Kamin/Steigleitung) mit Kollisions- bzw. Verdeckungsprüfung („Wird der Lichtschalter vom PAX-Schrank verdeckt?“, „Abstand Masterlift zur Steckdose“).
* **Paket 3B — 3D-Wand-Gehrungen (Miter Joints) & Nachträgliches Wand-Splitting (inspiriert von `charmlinn/blueprint3d-modern` & `laanlabs/openPlan3D`):**
  * Berechnung der Winkelhalbierenden an Ecken für nahtlose 45°-Gehrungsschnitte an 3D-Wänden, Wandkappen und Fußleisten sowie `splitWallAt(wallId, point)` zum Einfügen neuer Eckknoten in bestehende Wände per Klick.
* **Paket 3C — Smart Alignment Guides & Kante-an-Kante Möbel-Snapping (inspiriert von `cvdlab/react-planner`):** *(Umgesetzt am 30.10.2026)*
  * Magnetisches Möbel-an-Möbel-Snapping (`DEFAULT_FURNITURE_SNAP_THRESHOLD_CM = 8 cm`) auf $0\text{ cm}$ Spalt entlang derselben Wand (`kind: 'flush'`) sowie Mittelachsen- und Fluchtkanten-Snapping frei im Raum (`kind: 'center'`, `'edge'`) mit Live-Hilfslinien in 2D und 3D (`src/core/alignmentMath.ts`).
* **Paket 3D — Erweiterte Wandöffnungen & Interaktiver Teppich-Editor (inspiriert von `laanlabs/openPlan3D` & `SweetHome3D`):** *(Umgesetzt am 30.10.2026)*
  * **3D-A:** Erweiterung von `OpeningType` auf 5 Bauarten (`door`, `window`, `sliding-door`, `passage`, `balcony-door`) inkl. Entfall des 90°-Schwenkbogens bei Schiebetüren/Durchgängen und Tageslicht-Kopplung bei Balkontüren (`src/core/doorLeaf.ts`).
  * **3D-B:** Vollwertiger 2D/3D-Editor und Inspector (`RugInspector.tsx`) für Teppiche (`AreaRug`).
* **Paket 3E — Interaktive WASD-Begehung & Sichtachsen-Prüfung (inspiriert von `openPlan3D` & `threejs-sims-house-builder`):**
  * Kontinuierliche Bewegung auf 170 cm / 115 cm Augenhöhe per Pfeiltasten/WASD durch offene Türen und Durchgänge sowie Prüfung von Blendung/Spiegelung (Fenster im Rücken des Monitors) und TV-/Blickwinkeln.
* **Paket 3F — Stellproben-Varianten (Layout-Snapshots A/B):**
  * Speichern und 1-Klick-Umschalten mehrerer Möblierungsvarianten innerhalb desselben Grundrisses inklusive Direktvergleich von freier Bodenfläche und Engstellen-Anzahl.

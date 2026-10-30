# Möbel-Inventar & Designer-Möbel-Spezifikationen (`concepts/furniture-inventory-and-design-specs.md`)

Dieses Dokument beschreibt das zweistufige Möbel-Inventar-System zur Unterscheidung von echten Möbeln gegenüber Planungsmöbeln (Platzhaltern) sowie die architektonischen Spezifikationen der integrierten Designer-Klassiker.

---

## 1. Zweistufiges Möbel-Inventar-System

In der Einrichtungs- und Umzugsplanung existiert eine fundamentale funktionale Diskrepanz zwischen zwei Arten von Einrichtungsgegenständen:
1. **Echte Möbel (`isRealFurniture: true`):**
   * Stücke, die der Nutzer **bereits besitzt** oder verbindlich kaufen möchte.
   * Besitzen feste, unveränderliche Realmaße (z. B. Herstellerangaben auf den Millimeter genau), spezifische Materialien und Modellnamen.
   * Dürfen in der Planung nicht willkürlich skaliert werden, da sie physisch existieren.
   * Werden in der Benutzeroberfläche mit einem grünen Status-Badge (`🟢 Echtes Möbel`) sowie Herstellerangabe (`brand`) und Modellbezeichnung (`modelName`) hervorgehoben.
2. **Platzhalter (`isRealFurniture: false` oder `undefined`):**
   * Abstrakte Volumen- und Zonenplaner (z. B. „Standard-Sofa“, „Generischer Kleiderschrank“).
   * Dienen der Zonenaufteilung und Abstandsermittlung, können frei in Breite, Tiefe und Höhe skaliert werden.
   * Werden mit einem dezenten Badge (`⚪ Platzhalter`) versehen.

### Datenmodell-Erweiterung (`FurnitureItem`)
```typescript
export interface FurnitureItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  widthCm: number;
  heightCm: number;
  depthCm: number;
  x: number;
  z: number;
  elevationCm: number;
  rotationYDeg: number;
  color: string;
  snappedWallId?: string | null;
  notes?: string;
  visual?: FurnitureVisualType;
  catalogWidthCm?: number;
  catalogHeightCm?: number;
  catalogDepthCm?: number;
  clearanceZoneCm?: number;
  hasNightstands?: boolean;
  /** Fehlt das Feld, gilt zugeklappt. */
  pose?: 'closed' | 'open';
  /** ID eines Träger-Möbels (Surface Stacking, z. B. Monitor auf Masterlift). */
  attachedToId?: string | null;
  isRealFurniture?: boolean;
  brand?: string;
  modelName?: string;
  articleNumber?: string;
}
```

Die drei Katalogmaße heißen `catalogWidthCm`, `catalogHeightCm` und `catalogDepthCm`. Ein Feld `catalogDims` gibt es nicht. Ist `attachedToId` auf ein Träger-Möbel gesetzt (z. B. `f-std-monitor` auf `f-std-masterlift`), wird das gekoppelte Objekt beim Verschieben, Drehen und Höhenverstellen des Trägers automatisch mitgeführt (`propagateAttachedChildren`).

### A. Typentkopplung & Visual-Resolver (`resolveFurnitureVisual`)
[`resolveFurnitureVisual`](../../src/core/furnitureVisual.ts) gibt ein gesetztes, gültiges `visual` zurück. Fehlt das Feld oder ist der Wert unbekannt, kommt `box`. Name, Marke und Maße wählen das Modell nicht. Ein gesetztes `visual: 'sofa'` bleibt ein Sofa. Die Presets setzen `visual` selbst, die Beispielwohnung sieht deshalb gleich aus.

„Mein Inventar“ im Inspektor zeigt nur Einträge mit `isRealFurniture === true`.

### B. Katalog-Maßabweichung & 1-Klick-Reset
Weicht ein Stück von seinen drei Katalogmaßen ab, zeigt der Inspektor den Hinweis und die Schaltfläche „Auf Katalogmaße zurücksetzen“. Die Osaka-Schlafcouch im Katalog ist zugeklappt 190 cm breit, 90 cm hoch und 95 cm tief. Der gelöschte Zweisitzer, 170 cm breit, 77 cm hoch und 87,5 cm tief, ist kein Katalogmaß.

### C. Modellwahl (`resolveFurnitureModelType`)
`resolveFurnitureModelType` und `resolveGenericFurnitureSubType` lesen [`furnitureVisualCatalog.ts`](../../src/core/furnitureVisualCatalog.ts). Ein gesetztes `wardrobe`, `desk`, `coffee-table`, `sideboard`, `vanity` oder `generic-*` nutzt das passende Architekturmodell. Fehlt `visual`, bleibt es die Kiste `box`. `generic-bed` ist ein Bett ohne Nachtkästen. `bed` ist das Bettmodell mit der Nachtkasten-Regel aus der Kollisionsseite.

Die React-Komponenten stehen getrennt in [`furnitureRegistry.tsx`](../../src/components/viewer3d/furniture/furnitureRegistry.tsx) als `FURNITURE_MODELS`. Beide Tabellen decken jedes `FurnitureVisualType` ab. Fehlt ein Schlüssel, bricht `tsc` ab. Eine gemeinsame React-Tabelle in `src/core` würde beim Start einen Kreis erzeugen: der Store rechnet Kollisionen, die Kollision ruft `resolveFurnitureVisual`, und die Modelle warten noch auf den Store.

Der JSON-Import in [`planImport.ts`](../../src/store/planImport.ts) behält `visual` nur, wenn `isFurnitureVisualType` gilt. Sonst bleibt das Feld leer. Die Auswahl „Auto (Katalog / Kategorie)“ im Möbel-Inspektor schreibt `visual: undefined`. Der angezeigte Wert ist `selectedFurniture.visual ?? ''`.

---

## 2. Integrierte Designer-Klassiker

### A. BoConcept Osaka Schlafcouch
* **Designer:** Anders Nørgaard für BoConcept (Dänemark).
* **Maße, zugeklappt:** 190 cm Breite × 95 cm Tiefe × 90 cm Höhe. Die Beispielwohnung `standard-55` startet so, an derselben Stelle.
* **Ausgeklappt:** Liegefläche 170 cm breit und 200 cm tief. Die Höhe ist nicht gemessen. Der Inspektor schreibt weiter 90 cm und zeigt den Satz: „Ausgeklappte Höhe ist nicht gemessen. Angezeigt bleibt die zugeklappte Höhe 90 cm.“ Die Konstanten stehen in [`knownFurniture.ts`](../../src/core/knownFurniture.ts) als `OSAKA_POSES`. Die Wahl schreibt Breite, Tiefe, Höhe und die drei Katalogmaße. Im 3D-Modell (`BoConceptOsakaModel.tsx`) bleiben Sofa-Korpus, Rückenkissen und Armlehnen bei `pose === 'open'` hinten bei 95 cm Tiefe stehen, während davor das ausgeklappte Metall-Bettgestell mit Matratze (`osaka-unfolded-bed`) und Stützbeinen auf 200 cm Gesamttiefe ausfährt. Im 2D-Grundriss und SVG-Export wird der ausgeklappte vordere Liegebereich als gestrichelte Matratzenfläche dargestellt.
* **Gelöscht:** der kleinere 2-Sitzer (170 × 87,5 × 77 cm) wurde zugunsten der Schlafcouch aus dem Katalog entfernt.
* **Ergonomie im Modell:** Sitzhöhe 45 cm, Beinhöhe 15 cm, Armlehnenhöhe 65 cm, Armlehnenstärke 12 cm.
* **Architektonische Details:**
  * 4 schlanke Metall-/Scandi-Beine mit 5°-Ausstellung (`splayRad = 0.087`).
  * 15 cm schlanker Chassis-Rahmen (Y = 15 bis 30 cm).
  * 2 Sitzkissen. Die Breite folgt der Couch. 2 um 8° nach hinten geneigte Rückenkissen.
  * 2 schlanke Osaka-Armlehnen mit Kedernähten.
  * 2 Zierkissen an den Innenseiten.
  * Textil: Skandinavischer Strukturstoff (`roughness: 0.92`, `metalness: 0.05`).

### A2. Inwerk Masterlift 2
* Die Platte ist 160 × 80 cm. Die gezeigte Sitzhöhe startet bei 73 cm.
* Der Herstellerbereich ist 62,5 bis 127,5 cm. Der Schieber im Inspektor erscheint nur bei `visual === 'inwerk-masterlift'` und schreibt nur Werte in diesem Bereich.
* Ein importierter Wert außerhalb bleibt stehen. Der Inspektor beschriftet ihn mit „Die Höhe liegt außerhalb des Herstellerbereichs.“ Erst das Bewegen des Schiebers klemmt den Wert.

### B. Vitsœ 606 Universal Shelving System (5 Tablare)
* **Designer:** Dieter Rams (1960) für Vitsœ.
* **Katalog & Vorlagen:** Katalog, Luxusvilla und Studio führen es als Markenmodell (`isRealFurniture: true`).
* **Maße:** 91,2 cm Breite × 22 cm Tiefe × 170 cm Höhe (Wandmontage bei 35 cm Bodenfreiheit).
* **Architektonische Details:**
  * 2 vertikale Wandschienen (E-Tracks) aus stranggepresstem, eloxiertem Aluminium (`trackW = 3.5 cm`, `trackD = 1.8 cm`) mit Stanzschlitzen.
  * 5 pulverbeschichtete Metall-Tablare mit abgekanteten Buchstützen-Seitenflanschen (`shelfFlangeH = 11.5 cm`) im 32-cm-Raster.
* **Smart-Staging (Kuration):**
  * *Tablar 1 (oben):* Minimalistische Donut-Vase + Kiesel-Schale + Freiraum.
  * *Tablar 2:* 8 Architektur-Monografien + 1 schräg angelehntes Buch.
  * *Tablar 3:* 2 liegende Bildbände + Steinguttopf mit rankendem Efeu.
  * *Tablar 4:* Monografien-Reihe mit minimalistischem Buchteiler.
  * *Tablar 5 (unten):* Dokumenten-/Archivbox mit Griffmulde.

### C. Artemide Tolomeo Sospensione Decentrata
* **Designer:** Michele De Lucchi & Giancarlo Fassina (1987) für Artemide (Italien).
* **Kategorie:** Deckenleuchte mit Ausleger (`decor`, Beleuchtung).
* **Maße:** Diffusor Ø 36 cm, Höhe 21 cm, Ausladung ~150 cm, Gesamthöhe ~90 cm (Montage bei Y = 155 bis 245 cm).
* **Architektonische Details:**
  * Deckenbaldachin aus gebürstetem Aluminium mit Pendelstange.
  * Polierter Aluminium-Doppelgelenkarm mit Seilzügen und Federspannern.
  * Conical Pergamentschirm (Diffusor) im warmen Naturton (`#fdfbf7`) mit Justiergriff.
  * Gerichtetes warmes 2700K Point-Light (`intensity: 1.4`, `distance: 320 cm`), das die Tischfläche beleuchtet.

### D. Minimalistische weiße Küchenzeile (`KitchenUnitModel`)
* **Standardmaße:** 240 cm Breite × 215 cm Gesamthöhe × 60 cm Tiefe.
* **Architektonische Details:**
  * 10 cm hoher, 5 cm zurückspringender Sockel (Toe-Kick) in Anthrazit.
  * Grifflose Fronten mit 3.5 cm Schattenfuge (Griffrille).
  * 3.8 cm nahtlose Quarzkomposit-Arbeitsplatte in Reinweiß.
  * Flächenbündiges Unterbauspülbecken mit hohem Schwanenhals-Wasserhahn in Mattschwarz.
  * 4-Zonen Induktionskochfeld mit Glaskeramik-Oberfläche und Touch-Leiste.
  * Oberschränke (ab 140 cm Raumhöhe) mit durchgehender Nischenrückwand und integrierter LED-Unterboden-Lichtleiste.

---

## 3. Kollisions-Verhalten bei Rauminstallation

1. **3D-Kollisionstest für Deckenleuchten:**
   * Die Tolomeo-Leuchte besitzt eine Elevation von 155 cm und eine Höhe von 90 cm (Spannweite Y = 155 bis 245 cm).
   * Der darunterstehende Esstisch hat eine Höhe von 75 cm (Y = 0 bis 75 cm).
   * Da auf der Y-Achse ein Freiraum von 80 cm besteht, schlägt die OBB-Kollisionsprüfung nicht an (Kollisionsfreiheit trotz gleicher XZ-Projektion).
2. **Wandmontage:**
   * Wandschränke und Regale (Vitsœ 606) werden über `snappedWallId` an der jeweiligen Wand verankert und richten ihre Ausrichtung automatisch an der Wandnormalen aus.

# Beitragen zu wohnung-3d-planner (Contributing Guide)

Vielen Dank für dein Interesse, zu **wohnung-3d-planner** beizutragen! Dieses Projekt ist ein zentimetergenauer 2D/3D-Architektur- und Raumplaner, der für den realen Einsatz gebaut ist.

Um die geometrische Konsistenz, Performance und Stabilität des Projekts zu sichern, gelten die folgenden architektonischen Invarianten und Entwicklungsrichtlinien.

---

## 1. Architektonische Invarianten

Jeder Beitrag (Pull Request) muss diese unverletzlichen Grundregeln einhalten:

### A. Koordinatensystem & Maßstab
* **1 Three.js Unit = 1.0 cm** im gesamten Codebase.
* **Achsen:** `X` = Breite (horizontal), `Z` = Tiefe (Bodenebene), `Y` = Höhe (`+Y` zeigt nach oben zur Decke).
* **Toleranz:** `EPSILON_CM = 0.05` (500 µm) für geometrische Vergleiche und Schnittpunkttests.
* **Lichte Innenfläche:** Flächen werden als reine Netto-Innenpolygone in m² berechnet (`computeFloorPolygons`), niemals als geschätzte WoFlV.

### B. Visuelle Entkopplung (`visual` vs `name`)
* **Kein Name-Sniffing:** Die 3D-Geometrie und Kollisionskörper werden ausschließlich über `item.visual` (`FurnitureVisualType`) bestimmt – niemals über Substrings im Namen `item.name`.
* Fehlt `item.visual` oder ist unbekannt, greift der Fallback `'box'`.

### C. Geteilte Compound-Geometrie
* Mehrteilige Möbel (z. B. Esstisch mit Stühlen, L-Sofas, Schlafsofas) definieren ihre Teilpolygone zentral in `src/core/furnitureShapes.ts` via `layoutFurnitureParts`.
* 2D-Canvas, SVG-Plan-Export und 3D-Kollision (`computeFurnitureOBB` / SAT) greifen auf dieselben Teilpolygone zu, um Diskrepanzen zwischen Visualisierung und Prüfung zu verhindern.

### D. Store-Architektur & Drag-Transaktionen
* Bei Drag-Interaktionen in 2D oder 3D:
  * Beim ersten Pointer-Move: `pushUndoSnapshot()` aufrufen.
  * Während aller weiteren Drag-Moves: `{ recordHistory: false }` übergeben, um die Undo-Historie nicht zu überfluten.

### E. 100% Offline-First
* Keine externen CDN-Aufrufe (keine Google Fonts, CDNs oder Telemetrie-Tracker).
* Vollständig offline im Browser lauffähig.

---

## 2. Lokale Entwicklung & Befehle

```bash
# Abhängigkeiten installieren
npm install

# Lokalen Vite-Dev-Server starten
npm run dev

# Alle automatisierten Tests ausführen
npm test

# Einzelne Testdatei ausführen
npx vitest run tests/<datei>.test.ts

# Type-Check (Strict TypeScript, keine Warnings)
npx tsc --noEmit

# Produktions-Bundle bauen
npm run build
```

---

## 3. Pull-Request-Checkliste

Bevor du einen Pull Request einreichst, stelle bitte sicher:
1. `npm test` läuft zu 100% grün durch.
2. `npx tsc --noEmit` meldet 0 Fehler.
3. `npm run build` erzeugt erfolgreich das Produktions-Bundle.
4. Neue Features oder Fehlerbehebungen bringen passende Tests in `tests/` mit (TDD-Prinzip).
5. Keine persönlichen Daten, echten Adressen oder privaten Grundrisse einchecken (Datenschutz / Privacy-by-Design).

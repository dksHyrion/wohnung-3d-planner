# 3D-Wohnungsvisualisierung & Raumplaner (cm-genau)

[![CI](https://github.com/dksHyrion/wohnung-3d-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/dksHyrion/wohnung-3d-planner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Zentimetergenaue (`1 Three.js Unit = 1 cm`) 2D-/3D-Wohnungsvisualisierung mit **Three.js**, **React Three Fiber**, **TypeScript**, **Zustand** und einer integrierten **Karpathy LLM-Wiki-Wissensdatenbank**.

---

## 1. Schnellstart

### A. Lokaler Start (macOS / Linux / Windows)
```bash
# Repository klonen
git clone https://github.com/dksHyrion/wohnung-3d-planner.git
cd wohnung-3d-planner

# Abhängigkeiten installieren und Dev-Server starten
npm install
npm run dev
```
Im Browser öffnen: 👉 **`http://localhost:5173`**

### B. Remote-Start auf einem VPS (mit SSH-Portweiterleitung)

1. **Auf dem Server starten:**
   ```bash
   npm run dev -- --host 127.0.0.1 --port 5173
   ```

2. **Verbindung herstellen:**
   * **macOS & Linux (Terminal):**
     ```bash
     ssh -L 5173:127.0.0.1:5173 <user>@<vps-host>
     ```
   * **Windows (PowerShell):**
     ```powershell
     ssh -L 5173:127.0.0.1:5173 <user>@<vps-host>
     ```

3. Im lokalen Browser öffnen: 👉 **`http://localhost:5173`**

### C. Tests & Production-Build
```bash
npm test         # 448 Vitest-Tests in 41 Dateien
npm run build    # Production-Build in dist/ (TypeScript + Vite)
```

---

## 2. Kern-Features & Highlights

* **📐 Präziser 2D-Grundriss-Editor:**
  * cm-genaues Arbeiten mit Fangrastern (1, 5, 10, 25 cm) und 90°-Orthogonal-Winkelfang.
  * Dynamische Wand- und Eckpunkt-Topologie, Wandstärken und automatische Netto-Raumstempel (**Lichte Innenfläche** in m²).
  * 5 architektonische Wandöffnungen: Türen (mit 90°-Schwenkbogen), Fenster, Schiebetüren, Durchgänge und Balkontüren.
  * Interaktiver Teppich-Editor (`AreaRug`) mit 2D/3D-Dragging, Farb-Presets und 90°-Rotation.

* **🛋️ Möbel- & Inventar-System:**
  * Über 30 detailgetreue parametrische 3D-Architekturmodelle (Schränke, Tische, Sofas, Küchenzeilen, Designer-Möbel).
  * Strikte Trennung von Optik (`visual`) und Benennung – kein Name-Sniffing.
  * Surface Stacking / Physische Kopplung (`attachedToId`): Zubehör wie Monitore bewegt sich synchron mit Trägermöbeln.
  * Flexible Unterscheidung zwischen realem Inventar und generischen Raum-Platzhaltern.

* **⚡ Kollisions- & Ergonomie-Engine (DIN 18040):**
  * Mitrotierende 3D-Kollisionsboxen (`THREE.OBB`) und Separating Axis Theorem (SAT).
  * Realistische Compound-Kollision für Tische mit Stuhllücken, L-Ecksofas und Betten.
  * Analytische Durchgangs- und Engstellenprüfung nach DIN 18040 mit Ampel-Klassifizierung (< 60 cm rot, 60–90 cm amber, 90–120 cm grün) und Live-Engstellen-Counter.
  * Magnetisches Kante-an-Kante-Snapping und Smart Alignment Guides beim Verschieben von Möbeln.

* **🎨 Cinematische Archviz-Beleuchtung (100 % Offline):**
  * Stufenlose Tageszeit-Engine (6:00 bis 22:00 Uhr) mit dynamischem Sonnenstand, Dämmerungslicht und Leuchtmittel-Emissionsregelung.
  * Autarkes prozedurales IBL via `<Environment>` und parametrischen `<Lightformer>`s (keine externen CDN-Downloads).
  * High-End Post-Processing Pipeline: N8AO Ambient Occlusion (36 cm Radius), selektiver Bloom, AgX-Tonemapping und Antialiasing.
  * 0-Pass `⚡ Performance`-Modus für flüssige 60 FPS auf leistungsschwächerer Hardware.
  * Menschliche Ego-Perspektive auf 170 cm oder 115 cm Augenhöhe mit verzerrungsfreiem 55°-FOV.

* **📏 Maßband, Tracing & 1:50-Plan-Export:**
  * Freies interaktives 2D-Maßband mit minimaler Kante-zu-Kante-Distanz (SAT) zu Möbeln und Wänden.
  * Grundriss-Unterleger (PNG, JPG, WebP, SVG) mit 2-Punkt-Referenzkalibrierung und lokaler IndexedDB-Speicherung.
  * Druckfertiger, maßstabsgetreuer 2D-Architektur-Vektorexport (SVG 1:50 / 1:100) mit DIN-Plankopf, Maßstabsbalken und Bemaßungsketten.

* **🛡️ Session-Sicherheit & Privatsphäre:**
  * 30-Schritt-Verlaufsspeicher (Undo/Redo via `Ctrl+Z` / `Ctrl+Y`) mit transaktionssicherem Drag-Handling.
  * Lokale Sicherung im Browser (LocalStorage) und portabler JSON-Import/-Export.
  * 100 % lokal und privat: Keine Serverübertragung, lokale Pläne im git-ignorierten Ordner `privat/`.

---

## 3. Tech-Stack

| Bereich | Eingesetzte Frameworks & Tools |
| :--- | :--- |
| **3D & Rendering** | **Three.js (r170)**, **React Three Fiber (`@react-three/fiber`)**, **`@react-three/drei`** |
| **Post-Processing** | **`@react-three/postprocessing`** (N8AO, Selective Bloom, AgX Tonemapping, SMAA) |
| **Geometrie & Mathe** | **`THREE.OBB`** + Separating Axis Theorem (SAT) + 1D-Skalarprodukt-Wandprojektion |
| **Frontend & UI** | **React 18**, **TypeScript 5**, **Zustand** (Store-Slices), **Lucide React** |
| **2D-Engine** | Natives React + SVG (`viewBox` in cm, Pan/Zoom, 90°-Türschwenkbögen) |
| **Build & Testing** | **Vite 5** (HMR & Tree-Shaking), **Vitest 2** (448 Unit- & Integrationstests) |
| **Wissensbasis** | **Karpathy LLM-Wiki Pattern** (`SCHEMA.md`, `raw/`, `wiki/index.md`, `wiki/log.md`) |

---

## 4. Projektübersicht

```text
wohnung-3d-planner/
├── src/
│   ├── core/         # Geometrie, Wand-Graph, SAT-Kollision, Ergonomie, Katalog & Presets
│   ├── store/        # Zustand-Store (Slices: geometry, view, history)
│   └── components/   # 2D-SVG-Canvas, 3D-R3F-Szene, Beleuchtung & Inspektoren
├── tests/            # 41 Vitest-Testdateien (Wandgeometrie, Kollision, Ergonomie, SVG-Export)
├── wiki/             # Vernetzte LLM-Wissensbasis (Konzepte, Architektur, Audit-Log)
├── raw/              # Referenz-Quellen und GitHub-Benchmark-Dokumentation
├── privat/           # Lokale private Pläne & Notizen (in .gitignore)
├── AGENTS.md         # Richtlinien & Architektur-Invarianten für KI-Coding-Agenten
└── CLAUDE.md         # Projekt-Kommandos & Architektur-Leitfaden
```

---

## 5. Lizenz

Veröffentlicht unter der [MIT License](LICENSE).

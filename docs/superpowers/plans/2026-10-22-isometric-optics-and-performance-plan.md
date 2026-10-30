# Implementierungsplan: Isometrische Optik, Schatten-Stabilität, 60-FPS-Performance & Detaillierte Architektur-Möbel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Schatten-Flackern in der 3D-Isometrie vollständig beseitigen, die Render-Performance (insbesondere im `⚡ Performance`-Modus, aber auch im `✨ Schön`-Modus) durch Eliminierung versteckter Multi-Pass-Flaschenhälse drastisch beschleunigen, die Standard-Lichtstimmung auf klares Tageslicht (`Mittag`) mit ruhigen anthrazitfarbenen Wand-Schnittkanten umstellen und alle bisher als einfache Blöcke dargestellten Möbel (`Kleiderschrank PAX`, `Schreibtisch`, `Marmor Couchtisch`, `Sideboard`) als fein detaillierte 3D-Architekturmodelle ausführen.

**Architecture:**
1. **Z-Fighting & Orthographic-Depth-Fix (`StudioStage3D.tsx`, `Scene3D.tsx`):** Der Architektursockel (`Plinth`) wird um `0.5 cm` abgesenkt (`centerYCm = -10.5`, Oberkante bei `Y = -0.5`), sodass er nicht mehr mit den Raumböden (`Y = 0.0`) koplanar ist. Die `<OrthographicCamera>` erhält einen positiven Near-Clip (`near={10}`, `far={5000}` statt `-5000..12000`), was die Tiefenpuffer-Präzision verzehnfacht und `N8AO`-Artefakte in der Isometrie behebt.
2. **Schatten-Stabilisierung (`StudioStage3D.tsx`):** Entfernung des verrauschten 10-Sample-`<SoftShadows>`-Shaders zugunsten von Hardware-`PCFSoftShadowMap` mit `shadow-normalBias={1.2}` und `shadow-bias={-0.0004}`, engerem Shadow-Frustum und statisch gebackenen `<ContactShadows frames={1} />`.
3. **Eliminierung versteckter Multi-Pass-Flaschenhälse (`WallMesh3D.tsx`, `ArtemideTolomeoModel.tsx`, `PostFX3D.tsx`):**
   - Fensterglas ohne `transmission={0.92}` spart **1 kompletten Full-Scene-Renderpass + Mipmap-Generierung pro Frame** (auch im Performance-Modus).
   - Entfernung von `castShadow` am `pointLight` der Tolomeo-Leuchte spart **6 Cubemap-Shadow-Pässe pro Frame**.
   - Vollständiges Unmounten von `<EffectComposer>` im `⚡ Performance`-Modus (`PostFX3D` gibt `null` zurück) aktiviert direktes WebGL-Hardware-MSAA + natives Renderer-Tonemapping (`0 PostFX-Pässe`).
4. **Optik & Detaillierte 3D-Möbel (`WardrobeModel.tsx`, `DeskModel.tsx`, `CoffeeTableModel.tsx`, `presets.ts`):**
   - Start-Preset auf `noon` (`12.5` Uhr, helle 58°-Sonne), ruhige Wandkappen (`glowingWallCaps: false` als Standard) und nahtloser Canvas-Hintergrund (`mood.stageGradientBottom`).
   - Neue detaillierte 3D-Komponenten für Kleiderschränke (PAX mit Sockel, 4-türiger Korpus-Teilung, Schattenfugen & Stangengriffen), Schreibtische (Eichenplatte, Stahlgestell, Rollcontainer, Widescreen-Monitor, Tastatur & Bürostuhl), Couchtische (Stahlrahmen, gefaste Marmorplatte, Ablage & Kunstbildband) und Sideboards, inklusive harmonischer Natur-Farbpalette in `presets.ts` statt greller CAD-Farben.

---

## Tasks

- **Task 1:** Y-Layer-Entkopplung gegen Z-Fighting & Orthographic-Tiefenpräzision (`StudioStage3D.tsx`, `Scene3D.tsx`)
- **Task 2:** Beseitigung des Schatten-Flackerns (`SoftShadows`-Entfernung, `normalBias` & Statische `ContactShadows` in `StudioStage3D.tsx`)
- **Task 3:** Eliminierung der versteckten Multi-Pass-Flaschenhälse (`WallMesh3D.tsx`, `ArtemideTolomeoModel.tsx`, `ProceduralCurtain3D.tsx`)
- **Task 4:** Echter Zero-Overhead Performance-Modus (`PostFX3D.tsx` & `Scene3D.tsx`)
- **Task 5:** Freundliche Tageslicht-Standardstimmung (`Mittag`), Ruhige Wand-Schnittkanten & Nahtloser Bühnen-Horizont (`useFloorplanStore.ts`, `Scene3D.tsx`, `moodPresets.ts`)
- **Task 6:** Detaillierte 3D-Architektur-Möbelmodelle (`WardrobeModel.tsx`, `DeskModel.tsx`, `CoffeeTableModel.tsx`, `ArchitecturalFurniture3D.tsx`, `presets.ts`)

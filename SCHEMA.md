# LLM-Wiki Schema: 3D-Wohnungsvisualisierung (`Wohnung`)

Dieses Repository folgt Andrej Karpathys **LLM-Wiki-Pattern** ([Gist 442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)) kombiniert mit einer ausführbaren Three.js/React-Three-Fiber-Anwendung (`src/`).

## 1. Architektur der Wissensbasis

- **`raw/` (Immutable Source Layer):** Unveränderliche Rohdokumente, Rechercheberichte, Messprotokolle der Wohnung und Möbel-Datenblätter. Der Agent liest aus `raw/`, verändert bestehende Dateien dort aber niemals.
- **`wiki/` (Compiled Knowledge Layer):** Vom Agenten verwaltete, untereinander verlinkte Markdown-Seiten.
  - **`wiki/index.md`:** Zentrales Inhaltsverzeichnis aller Wiki-Seiten mit je einer Kurzbeschreibung pro Eintrag.
  - **`wiki/log.md`:** Chronologisches Append-Only-Protokoll aller Ingest-, Query-, Lint- und Architektur-Updates.
  - **`wiki/concepts/`:** Fachliche und mathematische Konzepte (`1 Unit = 1 cm`, Wand-Graph, 1D-Skalarprodukt-Prüfung, 3D-OBB-Kollisionen).
  - **`wiki/architecture/`:** Technische Dokumentation der Web-App (`src/core`, `src/store`, `src/components`).

## 2. Agent-Workflows

1. **Ingest:** Wenn eine neue Datei in `raw/` abgelegt wird (z. B. echte Raummaße oder ein Möbelkatalog), liest der Agent die Quelle, aktualisiert oder erstellt die passenden Konzeptseiten in `wiki/`, ergänzt `wiki/index.md` und schreibt einen datierten Eintrag an das Ende von `wiki/log.md`.
2. **Query:** Bei Fragen zum Projekt liest der Agent zuerst `wiki/index.md`, navigiert gezielt zu den verlinkten Wiki-Seiten und antwortet mit Quellenverweisen auf `wiki/` und `src/`.
3. **Lint:** Prüft regelmäßig, ob alle Links in `wiki/index.md` auf existierende Dateien zeigen, ob Formeln in `wiki/concepts/` mit dem Code in `src/core/` übereinstimmen und ob verwaiste Seiten existieren.

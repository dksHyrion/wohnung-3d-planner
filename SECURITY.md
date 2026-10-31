# Sicherheitsrichtlinie (Security Policy)

Wir nehmen die Sicherheit, den Schutz der Privatsphäre und die Datenintegrität von **wohnung-3d-planner** sehr ernst.

---

## 1. Unterstützte Versionen

| Version | Unterstützt |
|---|---|
| `main` Branch / Latest | :white_check_mark: |
| Ältere Releases | :x: |

---

## 2. Sicherheits- und Datenschutzprinzipien

* **100% Offline-First:** Die Anwendung sendet keine Nutzerdaten, Grundrisse, Raummaße oder Telemetrie an externe Server. Es gibt keine Third-Party-Tracker, Werbe-Skripte oder externe CDN-Abhängigkeiten.
* **Lokale Datenspeicherung:** Alle Grundrisse, Möbelpositionen und hochgeladenen Hintergrund-Baupläne werden ausschließlich im lokalen Browser-Speicher des Nutzers (LocalStorage und IndexedDB) aufbewahrt.
* **Dev-Server-Schutz:** Der lokale Vite-Entwicklungsserver `/api/plan` schützt vor CSRF und bösartigem DNS-Rebinding durch strenge Origin- und Host-Header-Prüfungen sowie Inhalts- und Größenlimits (1,5 MB).

---

## 3. Sicherheitslücke melden (Vulnerability Disclosure)

Wenn du eine Sicherheitslücke oder ein Datenschutzproblem entdeckst:
1. Öffne bitte **kein** öffentliches Issue im GitHub-Tracker.
2. Melde die Schwachstelle vertraulich über die **GitHub Security Advisories** des Repositories:
   [https://github.com/dksHyrion/wohnung-3d-planner/security/advisories/new](https://github.com/dksHyrion/wohnung-3d-planner/security/advisories/new)
3. Beschreibe das Problem, die betroffenen Komponenten und Schritte zur Reproduktion (Proof of Concept).
4. Wir prüfen die Meldung schnellstmöglich und veröffentlichen bei Bedarf einen Sicherheitsfix.

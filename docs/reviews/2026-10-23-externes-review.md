# Externes Review: Wohnungseinrichtungs-Simulator

Stand: 23.10.2026. Adressiert an Antigravity.
Geprüft wurde der Code in `/home/agy/Wohnung`. Es wurde kein Programmcode geändert.

Maßstab ist der Gebrauch, nicht die Beispielvilla. Der Nutzer will ein Möbel vor dem Kauf in einen Raum stellen und zwei Dinge sehen: ob es mit den echten Maßen passt, und wie die Zusammensetzung wirkt. Ein schönes Bild ist kein Beweis. Die Wirkung darf schmeicheln. Die Maße dürfen es nicht.

Die Beispielmöbel und der Beispielgrundriss sind Demo. Sie werden hier nicht mit der echten Wohnung oder mit dem Stil aus dem Wohnungs-Wiki verglichen.

Das Folgende ist ein Vorschlag. Antigravity baut ihn nicht. Antigravity prüft, ob er stimmt. Alles unter „Urteil“ begründet den Vorschlag.

## Vorschlag

Sechs Änderungen. Keine neuen Möbelmodelle, keine Wiki-Seiten, keine Augenhöhe, kein Rückgängig, kein neutrales Tageslicht, kein herausgezogener Schreibtischstuhl.

Gebaut wäre der Vorschlag, wenn `npm test` und `npm run build` grün sind und die Zahlentests unten existieren. Das ist die Messlatte für später, nicht die Aufgabe jetzt.

### 1. Esstischstühle bekommen eigene Messkästen

Die Maße des Tisches bleiben Breite, Höhe und Tiefe der Platte. Den Tischkasten nicht vergrößern, damit die Stühle hineinpassen.

Die Stuhlkästen stehen dort, wo das Bild die Stühle schon zeichnet. Bild und Kollision benutzen dieselbe Rechnung. Die Zahlen nicht ein zweites Mal daneben schreiben. Heute liegt die Stuhlmitte 12 cm außerhalb der Tischkante, und die Sitzfläche ist höchstens 40 cm lang (`DiningTableModel.tsx`).

Der Schreibtischstuhl gehört nicht in diese Runde.

Zahlentest. Tisch bei x = 0, z = 0, Drehung 0, 160 × 75 × 90 cm. Ein Würfel von 10 cm, Mitte auf y = 44:

- x = 30, z = 65 muss kollidieren. Dort steht ein Stuhl.
- x = 0, z = 65 darf nicht kollidieren. Dort ist die Lücke zwischen den Stühlen. Kollidiert dieser Würfel, wurde der Tischkasten nur aufgeblasen.

### 2. Ecksofa: zwei Kästen, und nur dann eine L-Form

Die Liege bleibt im Bild rechts, also bei positivem X. Der Rücken bleibt bei negativem Z. Diese Lage nicht spiegeln.

Kollision und Bild benutzen dieselben Teilmaße (`regularDepth`, `chaiseWidth` in `SofaModel.tsx`). Zwei Kästen: Hauptteil links und hinten, Liege rechts über die ganze Tiefe. Ein niedriger Sockel über die ganze Grundfläche, wenige Zentimeter hoch, darf bleiben. Er darf die Prüfpunkte auf Sitzhöhe nicht als Treffer melden.

Ein Sofa wird nur dann zur L-Form, wenn der Name „Eck“, „Chaise“, „Sectional“ oder „L-Form“ enthält. Die Schwelle „mindestens 210 cm breit und 135 cm tief“ entfällt. Ein großes Sofa ohne diese Wörter bleibt ein Rechteck, im Bild und in der Kollision.

Zahlentest. Würfel 10 cm, Mitte auf y = 20. Ecksofa 240 × 78 × 160 cm, Name enthält „Eck“:

- x = −50, z = 48 darf nicht kollidieren. Das ist die freie Ecke vorn links, über dem niedrigen Sockel.
- x = 70, z = 40 muss kollidieren. Das liegt auf der Liege.

Sofa „Großes Sofa“ ohne die Wörter oben, 220 × 78 × 140 cm:

- x = −50, z = 48 muss kollidieren, weil das Stück ein Rechteck bleibt.

### 3. Das Bild hängt an einem Feld, nicht am Namen

`FurnitureItem` bekommt ein Feld `visual`. Erlaubte Werte sind die Modelle, die es schon gibt, plus `box` und `sectional-sofa`. Fehlt das Feld, erscheint eine Kiste. Zur Laufzeit liest niemand mehr den Namen, um das Modell zu wählen.

In `presets.ts` wird `visual` einmal fest eingetragen, nach der heutigen Namensregel, einschließlich der bisherigen Größenschwelle. Danach ändert ein neuer Name das Bild nicht mehr. Die Villa soll deshalb genauso aussehen wie vorher.

Jedes Katalogstück merkt sich seine drei Katalogmaße. Weicht Breite, Höhe oder Tiefe davon ab, zeigt die Ansicht eine Kiste, und die Seitenleiste den Satz „Maße weichen vom Katalog ab.“ Stimmen alle drei Zahlen wieder, kommt das bisherige Modell zurück.

Zahlentests:

- Name „Osaka“, kein `visual`: Kiste, nicht das Osaka-Modell.
- `visual` ist `sofa`, Name wird auf „Osaka“ geändert: bleibt Sofa.
- Osaka aus dem Katalog, Breite von 170 auf 200: Kiste und der Satz oben. Breite zurück auf 170: wieder das Osaka-Modell.

### 4. Eine Öffnung endet an der Wand

Offset und Breite werden beim Speichern so begrenzt, dass die Öffnung auf der Wand liegt. Bild und Türprüfung lesen diese gespeicherten Zahlen. Keine zweite, abweichende Kürzung nur in der Zeichnung.

Ist nach der Kürzung weniger als 1 cm übrig, wird die Öffnung nicht angelegt. Wird eine Wand kürzer, werden ihre Öffnungen nach derselben Regel gekürzt.

Den Viertelkreis nicht bauen. Der Schwenkbereich bleibt in dieser Runde das bisherige Quadrat.

Zahlentest. Wand von (0, 0) nach (200, 0). Öffnung mit Abstand 150 cm und Breite 80 cm wird mit Breite 50 cm gespeichert. Ein Möbel jenseits des Wandendes darf nicht deshalb kollidieren, weil die Tür intern noch 80 cm breit wäre.

### 5. Wandlänge: Endpunkt schieben, Möbel mitnehmen, Türen kürzen

`updateWallLengthCm` schiebt weiter nur den Endpunkt. Wände am selben Punkt ändern sich mit. Das bleibt so. Kein neuer Wandeditor.

Danach werden Möbel, die an einer betroffenen Wand eingerastet waren, mit `findWallSnap` neu an diese Wand gesetzt. Gelingt das nicht, wird die Einrastung gelöst, und das Möbel bleibt an seiner alten Stelle. Öffnungen an der geänderten Wand werden wie in Punkt 4 gekürzt.

Die Seitenleiste nennt bei einer ausgewählten Wand die Kennung des Endpunkts und die Kennungen der anderen Wände, die an diesem Punkt hängen.

Zahlentest. Ein eingerastetes Möbel liegt nach einer Längenänderung noch an derselben Wand, nicht an den alten Weltkoordinaten. Eine Tür, die nach der Kürzung über das Wandende ragen würde, ist gekürzt.

### 6. README: keine festgeschriebene Testzahl

Die README nennt heute 170 Tests und für die Umgebungsabschattung 40 cm Radius. Die Testzahl streichen, nicht durch 184 ersetzen. Den Radius auf 36 cm korrigieren, wie in `PostFX3D.tsx`. Den Verzeichnisbaum in der README nicht neu schreiben.

### Wenn die Villa-Tests rot werden

Diese Tests erwarten heute null Kollisionen:

- `tests/architecturalPresets.test.ts`, die Luxus-Villa
- `tests/kitchenDiningTolomeo.test.ts`, Studio-Wohnung und Luxus-Villa

Eigene Stuhlkästen können sie rot machen. Dann die Möbel in der Vorlage auseinanderrücken oder die erwartete Zahl auf die echten Kollisionen setzen.

Verboten ist, die neuen Kästen zu verkleinern, Stühle von der Kollision auszunehmen oder Stühle aus dem Bild zu löschen, nur damit das alte Grün zurückkommt. Tests, die ein Modell über den Namen auswählen, dürfen auf das Feld `visual` umgestellt werden. Sie dürfen nicht gelöscht werden, um die Namensregel zu behalten.

### Nicht Teil des Vorschlags

Nicht in dieser Runde: Maßband zwischen zwei Möbeln, herausgezogener Arbeitsstuhl, Dekoration ausblenden, anderes Licht, Augenhöhe, Rückgängig, lokale Sicherung, leerer Raum als Start, echte Wohnung, Sonne nach den Fenstern, Schranktür, ausgeklapptes Sofa, getrennte Materialien, zwei Varianten, Wohnfläche nach WoFlV, dickere Außenwand.

Keine neue Datei unter `src/components/viewer3d/furniture/`. Keine Änderung an `wiki/`.

## Urteil

Der Simulator ist als Technikgerüst brauchbar und soll bleiben. Eine Three.js-Einheit ist durchgängig ein Zentimeter. Grundriss, Möbel und Kollision hängen an einem gemeinsamen Zustand. Die Rechenkerne für Wände und Kollision haben echte Zahlentests. Am 23.10.2026 liefen 184 Tests in 20 Dateien grün, und der Produktionsbau lief durch.

Für den Kauf ist das Werkzeug noch nicht verlässlich. Die unsichtbare Kiste, an der das Programm misst, und das Bild, das der Nutzer sieht, sind an den wichtigen Stellen nicht dasselbe. Stühle am Esstisch stehen außerhalb der Kiste. Ein Ecksofa blockiert in der Prüfung eine Ecke, die im Bild leer ist. Welches 3D-Modell erscheint, entscheidet eine Kette von Wortteilen im Namen. Dazu kommt die Ansicht von schräg oben, mit einer Lichtstimmung, die nichts mit den Fenstern des Raums zu tun hat.

Solange diese Lücken offen sind, taugt das Programm für eine grobe Stellprobe einer Kiste an einer Wand. Es taugt nicht für die Entscheidung, ein bestimmtes Stück zu kaufen.

## Was schon trägt

- Der Maßstab ist ernst gemeint. Möbel, Wände und Öffnungen tragen Zentimeter, und die Wandlänge wird aus den Eckpunkten gerechnet (`src/core/wallMath.ts`, `getWallGeometry`).
- 2D-Plan, 3D-Ansicht und Seitenleiste lesen denselben Zustand (`src/store/useFloorplanStore.ts`). Ein Möbel hat eine Position, nicht zwei.
- Möbel rasten an einer Wand ein. Die Breite liegt dann entlang der Wand, die Tiefe steht von der Wand ab (`findWallSnap`). Drehen von Hand löst diese Bindung wieder. Dafür gibt es einen Test.
- Zimmertüren haben einen Schwenkbereich, und überlappende Möbelkisten werden rot markiert (`src/core/collisionEngine.ts`).
- Ein Grundriss lässt sich als JSON herausnehmen und wieder einlesen (`exportJson`, `importJson` in der oberen Leiste).
- Es gibt eine leere Vorlage, `Leerer Raum (400 × 320 cm)`, neben der Villa. Für die erste echte Stellprobe ist diese Vorlage der richtige Start, nicht die Villa.
- Eigene Breite, Höhe und Tiefe lassen sich in der Seitenleiste eintragen. Ein Stück aus einem Datenblatt kann also als Kiste in den Raum, auch wenn es kein fertiges Modell dafür gibt.

## Befunde, die Maße verfälschen

Diese Punkte zuerst. Sie können eine Stellprobe falsch erscheinen lassen, obwohl alle Tests grün sind.

### 1. Die Stühle am Esstisch zählen nicht mit

Die Kollisionskiste eines Möbels ist immer das Rechteck aus Breite, Höhe und Tiefe (`computeFurnitureOBB` in `src/core/collisionEngine.ts`). Beim Esstisch sitzt die Stuhlmitte 12 cm außerhalb dieser Tiefe (`src/components/viewer3d/furniture/DiningTableModel.tsx`, `depth / 2 + 12`). Die Sitzfläche ist bis zu 40 cm lang. Damit ragt die Sitzfläche rund 32 cm über die Kiste hinaus.

Ein Tisch, der laut Programm 40 cm von der Wand frei steht, hat in Wahrheit nur noch einen schmalen Rest neben den Stühlen. Die rote Warnung kommt nicht. Für einen Essplatz ist genau dieser Rest die Frage, die das Werkzeug beantworten soll.

Der Stuhl am Schreibtisch ist fest an das Tischmodell gebunden und steht eingefahren. Seine Sitzfläche ragt nur etwa 7 cm über die Kiste (`DeskModel.tsx`, Stuhl bei `depth / 2 - 12`, Sitztiefe 38 cm). Die eigentliche Lücke ist eine andere. Die Arbeitsposition, Stuhl herausgezogen, ist kein eigenes Stück. Ob vor einem Tisch von 80 cm Tiefe noch ein Stuhl und ein Durchgang bleiben, rechnet das Programm nicht.

**Vorschlag:** Die Esstischstühle bekommen eigene Kästen. Die Tischmaße bleiben die der Platte. Der Schreibtischstuhl und eine eigene Stuhlposition zum Herausziehen gehören nicht in diese Runde.

### 2. Das Ecksofa blockiert eine Ecke, die im Bild leer ist

Der Name „Ecksofa“ oder „Chaise“ schaltet eine L-Form im Bild an (`SofaModel.tsx`). Dieselbe Regel macht auch ein gewöhnliches Sofa zur L-Form, sobald es mindestens 210 cm breit und 135 cm tief ist. Die Kollision kennt diese Form nicht. Sie prüft weiter das volle Rechteck aus Breite und Tiefe.

Ein Tisch, der in der freien Innenecke steht, wird als Kollision gemeldet, obwohl das Bild dort Luft zeigt. Umgekehrt wirkt ein tiefes Sofa plötzlich wie eine Chaise, nur weil die Maße über die Schwelle rutschen.

**Vorschlag:** Zwei Kästen, Liege rechts. Ohne „Eck“, „Chaise“, „Sectional“ oder „L-Form“ im Namen bleibt das Sofa ein Rechteck, auch wenn es groß ist.

### 3. Das Modell hängt am Namen, nicht an der Sache

`resolveFurnitureModelType` und `resolveGenericFurnitureSubType` in `src/components/viewer3d/furniture/ArchitecturalFurniture3D.tsx` suchen Wortteile. „Sofa“, „Tisch“, „Office“, „Regal“ und die Kategorie entscheiden, welches Bild erscheint.

Folgen, die beim Ausprobieren schaden:

- Jedes Stück der Kategorie `office` wird am Ende ein Schreibtisch, auch ein Regal.
- Ein niedriges Aufbewahrungsstück bis 110 cm Höhe wird ein Couchtisch, wenn kein anderes Wort greift.
- „Osaka“, „606“ oder „Tolomeo“ im Namen tauschen das ganze Modell aus, auch wenn die Maße danach frei verändert werden.

Die Seitenleiste lässt Breite, Höhe und Tiefe eines so erkannten Stücks frei ändern. Ein auf 200 cm gezogenes Sofa heißt weiter Osaka und sieht weiter wie die Osaka aus. Das Datenblatt sagt dann etwas anderes als der Name.

**Vorschlag:** Das Feld heißt `visual`. Fehlt es, erscheint eine Kiste. Weichen die Maße vom Katalog ab, erscheint eine Kiste und der Satz „Maße weichen vom Katalog ab.“ Der Name wählt das Bild nicht mehr aus.

### 4. Tür im Bild und Tür in der Prüfung sind nicht dieselbe Öffnung

Eine neue Öffnung wird nicht auf die Wandlänge begrenzt (`addOpening` im Store). Die gezeichnete Wand schneidet die Öffnung an der Wandkante ab (`computeWallSubSegments` in `WallMesh3D.tsx`). Die Kollision der Tür benutzt die ungekappten Zahlen (`computeDoorSwingOBB`).

Eine Tür kann im Bild in der Wand enden und in der Prüfung trotzdem in den Nachbarraum hineinreichen. Dieselbe Abweichung entsteht, wenn eine Wand kürzer gezogen wird und der Abstand der Tür vom Wandanfang gleich bleibt.

Der Schwenkbereich ist außerdem ein Quadrat vor der Öffnung, nicht der Viertelkreis einer Tür. Links oder rechts am Band ändert diese Fläche nicht. Nur innen oder außen ändert sie. Das Quadrat ist vorsichtig und schlägt eher zu oft an als zu selten. Es ist aber nicht die Fläche, die eine Tür wirklich braucht. Für eine enge Ecke neben dem Band ist die Warnung deshalb zu grob.

**Vorschlag:** Die Öffnung wird beim Speichern auf die Wand gekürzt. Bild und Prüfung lesen dieselben Zahlen. Der Viertelkreis wird in dieser Runde nicht gebaut. Das Quadrat bleibt vorerst der Schwenkbereich und ist gröber als die echte Tür.

### 5. Eine Wandlänge zu ändern, verschiebt mehr als diese Wand

`updateWallLengthCm` schiebt nur den Endpunkt. Jede andere Wand an diesem Punkt ändert Länge und Winkel mit. Möbel bleiben an ihrer alten Stelle, auch wenn sie an der Wand eingerastet waren. Öffnungen behalten ihren Abstand vom Wandanfang.

Das ist für ein Eckpunkt-Modell nachvollziehbar, aber in der Oberfläche nicht gesagt. Wer eine Wand auf ein Aufmaß setzt, verändert damit unbeabsichtigt den Nachbarraum, und das eingerastete Sofa sitzt danach vielleicht in der Wand. Die rote Warnung kann das zeigen. Sie erklärt nicht, dass der Endpunkt der Hebel für mehrere Wände ist.

**Vorschlag:** Der Endpunkt wird weiter geschoben. Eingerastete Möbel an den betroffenen Wänden werden neu eingerastet. Öffnungen werden gekürzt. Die Seitenleiste nennt den Endpunkt und die mitgehenden Wände. Ein neuer Wandeditor entsteht nicht.

### 6. Die Quadratmeterzahl ist eine Innenfläche, keine Wohnfläche

Für ein einfaches Rechteck rechnet das Programm die Fläche innerhalb der Wände. Der Test dazu ist konkret: 400 × 300 cm bei 10 cm Wandstärke ergeben 11,31 m² (`tests/wallMath.test.ts`). Das ist eine klare Innenfläche.

Die README nennt dieselbe Zahl „lichte Wohnflächenberechnung nach WoFlV“. Die Wohnflächenverordnung zählt anders. Raumhöhe, Schrägen, Balkone und manche Nebenräume haben eigene Regeln. Die stehen im Programm nicht.

Neue Wände sind außerdem immer 15 cm dick und 250 cm hoch (`addWallWithCorners`). Eine Außenwand ist in der Regel dicker. Bleibt es bei 15 cm, wird die Innenfläche zu groß.

**Nicht in diesem Vorschlag.** Die Beschriftung sollte später „Innenfläche“ heißen, nicht „WoFlV“. Außenwände dicker als 15 cm zu setzen, gehört ebenfalls nicht in diese Runde.

## Befunde zur Wirkung

### Die erste Ansicht ist eine Architekturaufnahme, kein Standort im Raum

Die Perspektive startet auf etwa 6 bis 7 m Höhe (`Scene3D.tsx`, Kameraposition Y = 620 bzw. 720). Die Isometrie und die geteilte Ansicht sind orthografisch, also ohne Fluchtpunkt. Nur der Modus „3D Perspektive“ ist eine echte Perspektive. Man kann die Kamera drehen, aber nicht näher als 1,20 m an den Zielpunkt heran, und der Zielpunkt liegt auf 80 cm Höhe.

Es gibt keine Ansicht „ich stehe in der Tür“. Es gibt auch keine zweite Augenhöhe für ein Kind. Die Höhe trägt der Nutzer ein, wenn die Wohnung da ist. Das Programm darf sie nicht erfinden.

**Nicht in diesem Vorschlag.** Später eine Ansicht auf Augenhöhe, mit einer Höhe in Zentimetern, die der Nutzer setzt. Die jetzigen Schrägsichten beantworten eine andere Frage.

### Das Licht kommt aus der Stimmung, nicht aus den Fenstern

Mittag, Golden Hour und Nacht sind fertige Sonnenstände (`src/core/lighting/moodPresets.ts`). Die Sonne wird daraus in den Raum gelegt (`StudioStage3D.tsx`). Welche Wand Fenster hat, ändert die Sonne nicht. Der Startzustand ist der Schön-Modus mit Nachbearbeitung, nicht ein neutrales Tageslicht (`qualityMode: 'beauty'`).

Damit lässt sich die Stimmung eines Renderings ansehen. Damit lässt sich nicht prüfen, ob diese Ecke am Morgen dunkel ist. Für die Kaufentscheidung ist die zweite Frage die wichtigere. Der Schön-Modus bleibt als Schalter erlaubt. Er darf nicht die einzige und nicht die erste Aussage über den Raum sein.

**Nicht in diesem Vorschlag.** Später ein neutrales Tageslicht als Voreinstellung, und erst mit echtem Grundriss die Sonne aus der Himmelsrichtung der Fenster.

### Die Modelle bringen Dinge mit, die niemand hingestellt hat

Esstisch mit Obst, Sofa mit farbigen Kissen, Schreibtisch mit einem fest eingebauten Monitor. Die Farben dieser Zugaben stehen im Code, zum Beispiel ein grüner Apfel und ein bernsteinfarbenes Kissen. Eine einzige Farbwahl in der Seitenleiste färbt das Hauptstück. Sie trennt nicht Boden, Wand, Holz, Stoff und Metall.

Wer die Wirkung eines Stücks beurteilen will, sieht im Moment die Wirkung des Stücks plus Dekoration, die das Programm dazuerfunden hat.

**Nicht in diesem Vorschlag.** Später lässt sich die Dekoration ausblenden. Boden, Wand, Holz, Bezug und Metall werden erst danach getrennt.

### Eine Schranktür und ein ausgeklapptes Sofa gibt es nicht

Das Programm prüft den Schwenk einer Zimmertür, nicht den einer Schranktür. Ein Sofa hat einen Zustand. Die Idee der Stellprobe vom 30.09.2026 nennt beide Fälle ausdrücklich: Schranktüren, und bei der Osaka auch den ausgeklappten Zustand.

Die Katalogmaße der Osaka im Code sind 170 × 77 × 87,5 cm (Breite, Höhe, Tiefe). Ob das dem heutigen Datenblatt entspricht, ist hier ungeprüft. Selbst wenn die Zahlen stimmen, fehlt der zweite Zustand.

**Nicht in diesem Vorschlag.** Ein zweiter Zustand, Schranktür auf oder Sofa ausgeklappt, kommt erst mit der echten Stellprobe. Dafür reicht dann eine zweite Kiste, kein neues Modell.

## Struktur, aus Sicht eines Senior-Entwicklers

Die Aufteilung ist im Kern richtig und sollte nicht umgebaut werden.

| Teil | Rolle | Urteil |
|---|---|---|
| `src/core/wallMath.ts`, `collisionEngine.ts`, `dimensionMath.ts` | Maße, Wände, Kollision | Behalten. Hier liegen die Tests, die etwas beweisen. |
| `src/store/useFloorplanStore.ts` | Ein Zustand für Plan und Möbel | Behalten. JSON ein- und auslesen ist der richtige Speicherweg. |
| `src/components/viewer3d/furniture/*` | Ein Bildprogramm pro Möbelart | Nicht weiter vermehren. |
| `src/components/sidebar/InspectorSidebar.tsx` | Über 1.000 Zeilen, Katalog und alle Eingaben | Beim nächsten Eingriff teilen, nicht vorher. |
| `src/core/presets.ts` | Katalog und Grundrisse in einer Datei | Katalogdaten von den Vorlagen trennen, wenn der Katalog wächst. |
| `src/types/index.ts` | Gibt nur die Typen aus `core/types.ts` weiter | Kein zweites Typensystem. Liegen lassen. |

Was ein Senior nicht noch einmal bauen würde:

- Ein neues Produkt ist heute ein neues TSX-Modell plus ein weiterer Wortvergleich. Der nächste Hersteller wird diese Datei noch länger machen. Ein Produkt ist ein Datensatz: Name, Breite, Höhe, Tiefe, optional weitere Kisten, optional ein Bild. Unbekannt bleibt eine Kiste.
- Viele Tests prüfen, ob im gerenderten Markup ein bestimmter Text oder eine Farbe steht. Sie werden rot, sobald jemand die Darstellung aufräumt, auch wenn die Maße gleich bleiben. Die Wand- und Kollisionstests sind das Gegenteil und das Vorbild. Neue Tests für die Befunde 1 bis 4 sollen Zahlen prüfen: Stuhl außerhalb der Kiste, L-Form als zwei Kisten, Öffnung nicht länger als die Wand.
- Die README ist hinter dem Code. Sie nennt 170 Tests in 18 Dateien. Am 23.10.2026 waren es 184 Tests in 20 Dateien, alle grün. Sie nennt für die Umgebungsabschattung 40 cm Radius. Im Code steht 36 (`PostFX3D.tsx`, `N8AO_RADIUS_CM`). Der Verzeichnisbaum in der README zählt weniger Dateien, als `src/` enthält. Im Vorschlag gilt: die Testzahl streichen, den Radius auf 36 cm setzen, den Verzeichnisbaum nicht neu schreiben.
- Es gibt kein Rückgängig und kein automatisches Speichern. Ein Neuladen verwirft die Stellprobe. Der JSON-Export bleibt, ergänzt um eine lokale Sicherung im Browser.

Nicht anfassen, nur weil ein Bauwerkzeug meckert: Der Produktionsbau warnt, weil das Three.js-Paket groß ist. Das ist hier kein Fehler und kein Grund, das Paket zu zerlegen.

## Was ein Innenarchitekt zu diesem Werkzeug sagen würde

Ich kann eine Kiste an eine Wand stellen und sehen, ob die Kiste über die Wand hinausragt. Ich kann Türen und Fenster grob setzen. Ich kann zwei Möbel so weit zusammenschieben, bis sie rot werden.

Ich kann nicht sehen, ob der Raum funktioniert. Ich stehe nicht in der Tür. Ich sehe kein Kind und keinen Erwachsenen als Maßstab. Die Stühle, die den Weg am Tisch versperren, sind in der Prüfung unsichtbar. Die freie Ecke eines Ecksofas ist in der Prüfung voll. Eine Schranktür geht nicht auf. Das Licht ist eine Abendstimmung über einem Modell, nicht der Morgen an diesem Fenster. Auf dem Tisch liegt Obst, das niemand bestellt hat.

Für die Frage „passt ein 170 cm breites Sofa an diese Wand“ ist das, nach den Maß-Korrekturen, ein gutes Werkzeug. Für die Frage „will ich dieses Stück kaufen, weil es in diesem Raum so wirkt“ fehlt die ehrliche Ansicht. Mehr Renderqualität macht diese Lücke nicht kleiner.

## Nützlichkeit, Schritt für Schritt

Die mittlere Spalte ist das Ziel, wenn die Maße insgesamt stimmen. Sie ist nicht die Liste für diese Runde. Diese Runde meint nur den Vorschlag oben.

| Was der Nutzer tun will | Heute | Nach den Maß-Korrekturen | Erst mit der echten Wohnung |
|---|---|---|---|
| Raum mit Innenmaß, Raumhöhe, Tür und Fenster anlegen | Ja, von Hand. Neue Wand immer 15 cm / 250 cm. Öffnung kann länger sein als die Wand. | Öffnung und Wandstärke stimmen mit der Prüfung überein. | Aufmaß eintragen, Außenwand dicker als Innenwand. |
| Ein Möbel mit Breite, Höhe und Tiefe hineinstellen | Ja. Das Bild kann trotzdem ein anderes Möbel sein, weil der Name das Modell wählt. | Unbekanntes Stück bleibt eine Kiste. Katalogstück behält seine Maße. | Echte Stücke aus dem Datenblatt, nicht aus der Demoliste. |
| Abstand, Durchgang, Türschwenk ablesen | Nur der Wandabstand links und rechts, und nur bei eingerasteten Stücken. Sonst nur rot oder nicht rot. | Maß zwischen zwei Stücken. Stuhl und offene Tür zählen mit. | Engstellen vor Ort nachmessen, wenn der Rest knapp ist. |
| Farbe, Holz, Stoff und Licht gegeneinander halten | Eine Farbe. Lichtstimmung ohne Bezug zum Fenster. Dekoration ist fest eingebaut. | Dekoration aus. Neutrales Tageslicht als Start. | Flächen getrennt belegen, Sonne nach den Fenstern. |
| Zwei Anordnungen vergleichen und behalten | JSON von Hand speichern. Kein Vergleich nebeneinander. Neuladen löscht die Arbeit. | Lokale Sicherung und Rückgängig. | Zwei gespeicherte Varianten eines Raums. |

## Vorrat

Das hier gehört nicht zum Vorschlag oben. Hier steht, was danach kommen kann.

### Danach, immer noch ohne echte Wohnung

7. Maß zwischen zwei Möbeln, in Zentimetern, nicht nur rot oder grün.
8. Arbeitsstuhl als eigene Stellung „herausgezogen“.
9. Dekoration ausblendbar und bei Stellproben aus.
10. Neutrales Tageslicht als Voreinstellung. Schön-Modus bleibt ein Schalter.
11. Augenhöhe mit einer eingebbaren Höhe. Eine zweite Höhe für ein Kind, der Wert kommt vom Nutzer.
12. Rückgängig und eine lokale Sicherung, damit ein Neuladen die Stellprobe nicht löscht.
13. Startvorlage für neue Sitzungen ist der leere Raum, nicht die Luxus-Villa. Die Villa darf als Beispiel im Menü bleiben.

### Erst wenn ein Grundriss mit Aufmaß da ist

14. Diesen einen Raum und ein bekanntes Möbel einsetzen. Nicht den ganzen Katalog nachbauen.
15. Sonne an die Fenster hängen.
16. Zweiter Zustand nur dort, wo er die Stellprobe ändert: Schranktür auf, Sofa ausgeklappt.
17. Boden, Wand, Holz, Bezug und Metall getrennt setzen.
18. Zwei gespeicherte Varianten nebeneinander.

### Nicht tun

- Kein weiteres Spezialmodell für ein einzelnes Produkt, auch nicht für Bolia oder die Osaka.
- Die Beispielvilla nicht zur Wohnung umdekorieren und nicht löschen.
- Keine Stilregeln aus dem Wohnungs-Wiki in den Simulator kopieren.
- Keine Maße eines echten Möbels erfinden, wenn das Datenblatt fehlt.
- Die bestehenden Zahlen-Tests für Wände und Kollision nicht durch lockerere Tests ersetzen, damit ein neues Bild durchrutscht.

## Was nur der Nutzer entscheidet

- Ob die erste echte Probe ein leerer Raum und eine Kiste mit Datenblattmaßen ist, oder ob er dafür schon ein ausgearbeitetes Modell sehen will. Die Empfehlung dieses Reviews ist die Kiste, bis die Maße stimmen.
- Die Augenhöhe für Erwachsene und Kinder, in Zentimetern.
- Ob die Villa im Menü sichtbar bleibt.
- Welches eine Möbel die erste Probe nach dem Aufmaß wird. Das steht nicht in diesem Review.

## Was nicht geprüft wurde

- Die laufende Oberfläche wurde nicht im Browser angeklickt. Geprüft wurden der Code, die Tests und der Produktionsbau.
- `npm test` am 23.10.2026: 20 Dateien, 184 Tests, alle grün, etwa 20 Sekunden.
- `npm run build` am 23.10.2026: TypeScript und Vite, erfolgreich, etwa 17 Sekunden. Die Warnung zur Paketgröße ist kein Befund.
- Katalogmaße wurden nicht mit Herstellerseiten verglichen.
- Ob die Innenfläche bei verwinkelten Grundrissen in jedem Fall stimmt, wurde nicht neu durchgerechnet. Für das einfache Rechteck liegt ein Test vor.

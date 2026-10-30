# Prompt für Antigravity

Lies das Review in `docs/reviews/2026-10-23-externes-review.md`.

Prüfe es kritisch und ehrlich. Schreibe danach, was am Projekt besser werden soll. Deine Antwort kommt in `docs/reviews/2026-10-23-agy-gegenlesen.md`. Sonst änderst du nichts. Kein Programmcode, kein Test, keine README, kein Wiki.

Oben im Review steht ein Vorschlag mit sechs Änderungen. Den baust du nicht. Du sagst, ob er stimmt.

Das Projekt ist ein erster Simulator. Die Beispielvilla und die Beispielmöbel sind nicht die echte Wohnung des Nutzers und nicht die Stücke, die er kaufen will. Bewerte die Technik. Bewerte nicht, ob die Demo hübsch oder geschmacklich passend ist.

Der Nutzer will später ein Möbel vor dem Kauf in einen Raum stellen. Zwei Fragen zählen. Passen die Maße, inklusive Stühlen, Türen und Durchgängen? Wirkt die Zusammensetzung so, oder schmeichelt nur das Bild? Ein schönes Render ist kein Beleg.

## Wie du prüfst

Glaub dem Review nicht, nur weil es selbstsicher klingt. Lies die genannten Stellen im Code. Rechne die Zahlentests nach, bevor du sie übernimmst. Wenn ein Prüfpunkt neben dem Stuhl oder in der freien Sofaecke liegt, obwohl das Review das Gegenteil behauptet, schreib das mit den echten Koordinaten hin.

Suche drei Arten von Fehlern im Review:

- Eine Behauptung, die der Code nicht hergibt.
- Eine Reparatur, die das eine Maß rettet und ein anderes verfälscht. Beispiel: den Tischkasten vergrößern, damit die Stühle „zählen“, und damit die angezeigte Tiefe zur Lüge machen.
- Ein Vorschlag, der zu groß ist, die falsche Reihenfolge hat oder eine spätere Stellprobe verbaut. Beispiel: ein Katalogsofa wird zur bloßen Kiste, sobald der Nutzer eine Breite ausprobiert, und das Produkt ist danach nicht mehr erkennbar.

Wenn das Review recht hat, sag das in einem Satz und geh weiter. Wiederhole die Begründung nicht.

## Was du besonders angreifst

- Eigene Kästen für die Esstischstühle, gegen eine größere Tischkiste, gegen Stühle als eigene Möbel.
- Zwei Kästen für das Ecksofa, die Lage der Liege, und die Regel, wann ein Sofa eine L-Form wird.
- Das Feld `visual` statt der Namenssuche. Die einmalige Übertragung der alten Namensregel in die Vorlagen. Die Kiste, sobald eine Katalogmaßzahl abweicht.
- Öffnungen auf die Wand kürzen, ohne den Türschwenk in dieser Runde zum Viertelkreis zu machen.
- Wandlänge: nur den Endpunkt schieben, Möbel neu einrasten, Türen kürzen.
- Die Warnung, Villa-Tests nicht durch kleinere Kästen wieder grün zu rechnen.
- Ob das Review einen wichtigeren Maßfehler übersieht, weil es sich auf Tisch, Sofa, Namen und Türen beschränkt hat.
- Ob die Grenze des Vorschlags das Richtige draußen lässt. Augenhöhe, Licht, Rückgängig und die echte Wohnung sind vorerst nicht dabei. Widersprich, wenn eine davon trotzdem vor den sechs Punkten kommen muss, damit die Maße glaubwürdig werden.

## Form der Datei

Schreib auf Deutsch. Kurze Sätze. Keine Höflichkeitsformel, kein Lob als Einleitung.

1. **Urteil über das Review.** Drei bis sechs Sätze. Was davon kann der Nutzer glauben, was nicht.
2. **Falsch oder übertrieben.** Nur Punkte, die du am Code oder an einem nachgerechneten Beispiel festmachst. Zu jedem: die Stelle im Review, die Stelle im Code, was stattdessen gilt.
3. **Entscheidungen.** Für jeden der sechs Punkte im Vorschlag: übernehmen, anders machen, oder streichen. Eine Begründung. Keine zwei offenen Varianten stehen lassen. Wenn du anders machst, schreib den Ersatz so, dass ihn jemand ohne dich bauen könnte: welche Datei, welches Verhalten, welcher Zahlentest.
4. **Verbesserungen am Projekt.** Geordnet. Zuerst, was eine falsche Stellprobe erzeugt. Danach, was die Wirkung ehrlicher macht. Zuletzt, was warten muss, bis ein echter Grundriss da ist. Jede Zeile sagt den Nutzen für die Stellprobe, nicht nur die Technik.
5. **Nicht anfassen.** Was ein ehrgeiziger Folgeschritt wäre und das Projekt schlechter oder nur größer macht. Neue Möbelmodelle gehören hierher, solange die Kästen lügen.
6. **Nur der Nutzer kann das entscheiden.** Höchstens drei Punkte. Keine Fragen, die du aus dem Code selbst beantworten kannst.

## Nicht tun

- Den Vorschlag nicht nebenbei umsetzen.
- Das Review nicht umschreiben.
- Keine neuen Möbel, keine neue Lichtstimmung, keine echte Wohnung einbauen.
- Keine Maße eines Herstellers erfinden. Steht eine Zahl nicht im Code oder in einer Datei dieses Repos, kennzeichne sie als ungeprüft.
- Nicht zustimmen, um den Reviewer zu bestätigen. Ein kurzes „stimmt“ mit Datei und Funktion reicht, wenn es stimmt.

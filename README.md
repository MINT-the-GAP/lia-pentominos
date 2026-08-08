<!--
author: MINT-the-GAP, Martin Lommatzsch
version: 1.0.0
language: de
narrator: Deutsch Female
edit: true
comment: Interaktives Hunderterfeld mit ziehbaren, drehbaren und fixierbaren Polyominos aus zwei bis fünf Zellen, responsivem Inventar und Abdeckungsquiz auf Basis von lia-coordinate.
tags: Mathematik, Polyomino, Pentomino, Geometrie, Quiz

import: https://cdn.jsdelivr.net/gh/LiaTemplates/JSXGraph@main/README.md
import: https://cdn.jsdelivr.net/gh/MINT-the-GAP/lia-coordinate@main/README.md

script: ./dist/index.js

@PentominoBoard_: @Koordinatensystem(`xmin=-0.15;xmax=10.15;ymin=-0.15;ymax=10.15;width=520;id=@0;achsen=0;grid=0;border=0`)

@PentominoChart_
<span id="pentomino-hundred-chart-@0" class="lia-pentomino-hundred-chart" data-board-id="@1" data-chart-kind="@2" hidden aria-hidden="true"></span>
@end

@Pentomino: @Pentomino_(@uid,`@0`)
@Pentominos: @Pentomino_(@uid,```@0```)

@Pentomino_
@PentominoBoard_(pentomino-board-@0)

@PentominoChart_(@0,`pentomino-board-@0`,`standard`)

<pre id="pentomino-config-@0" class="lia-pentomino-config" data-board-id="pentomino-board-@0" hidden aria-hidden="true">@1</pre>
@end

@PentominoDock: @PentominoDock_(@uid,`all`)
@PentominoDockAuswahl: @PentominoDock_(@uid,`@0`)

@PentominoDock_
<section class="lia-pentomino-workspace">

<div class="lia-pentomino-workspace-board">

@PentominoBoard_(pentomino-dock-board-@0)

@PentominoChart_(@0,`pentomino-dock-board-@0`,`standard`)

</div>

<div class="lia-pentomino-workspace-sidebar">

@PentominoDockMarker_(@0,`pentomino-dock-board-@0`,`@1`)

</div>

</section>
@end

@PentominoDockMarker_
<lia-keep class="lia-pentomino-dock-keep">
<aside id="pentomino-dock-@0" class="lia-pentomino-dock" data-board-id="@1" data-types="@2">
</aside>
</lia-keep>
@end

@PentominoConfig_
<pre id="pentomino-config-@0" class="lia-pentomino-config" data-board-id="@1" hidden aria-hidden="true">@2</pre>
@end

@PentominoDockQuiz: @PentominoDockQuiz_(@uid,@0,`all`,`@1`,`standard`)
@PentominoDockQuizN: @PentominoDockQuiz_(@uid,@0,`all`,`@1`,`negative`)
@PentominoDockQuizAuswahl: @PentominoDockQuiz_(@uid,@0,`@1`,`@2`,`standard`)
@PentominoDockQuizAuswahlN: @PentominoDockQuiz_(@uid,@0,`@1`,`@2`,`negative`)

@PentominoDockQuiz_
<section class="lia-pentomino-workspace">

<div class="lia-pentomino-workspace-board">

@PentominoBoard_(pentomino-dock-quiz-board-@0)

@PentominoChart_(@0,`pentomino-dock-quiz-board-@0`,`@4`)

</div>

<div class="lia-pentomino-workspace-sidebar">

@PentominoDockMarker_(@0,`pentomino-dock-quiz-board-@0`,`@2`)

</div>

</section>

@PentominoDockQuizCheck_(@0,`pentomino-dock-quiz-board-@0`,@1,`pentomino-dock-@0`,`@3`)
@end

@PentominoDockQuizCheck_
<div class="lia-pentomino-quiz-task lia-pentomino-dock-quiz-task">
<span id="pentomino-dock-quiz-@0" class="lia-pentomino-dock-quiz" data-board-id="@1" data-target-sum="@2" data-dock-marker-id="@3" hidden aria-hidden="true"></span>

**Decke** mit einem beliebigen Stein aus dem Inventar Zahlen ab, deren Summe **@2** beträgt. Geprüft wird jeder Stein einzeln.

</div>

@4
[[!]]
<script modify="false">window.LiaPentomino?.checkQuiz?.('pentomino-dock-quiz-@0') === true</script>
@end

@PentominoQuiz: @PentominoQuiz_(@uid,@0,`@1`,`@2`,`standard`)
@PentominoQuizN: @PentominoQuiz_(@uid,@0,`@1`,`@2`,`negative`)

@PentominoQuiz_
@PentominoBoard_(pentomino-quiz-board-@0)

@PentominoChart_(@0,`pentomino-quiz-board-@0`,`@4`)

@PentominoQuizTask_(@0,`pentomino-quiz-board-@0`,@1,`@2`,`@3`)
@end

@PentominoQuizTask_
@PentominoConfig_(@0,`@1`,`@3`)

<div class="lia-pentomino-quiz-task">
<span id="pentomino-quiz-@0" class="lia-pentomino-quiz" data-board-id="@1" data-target-sum="@2" data-piece-marker-id="pentomino-config-@0" hidden aria-hidden="true"></span>
</div>

@4
[[!]]
<script modify="false">window.LiaPentomino?.checkQuiz?.('pentomino-quiz-@0') === true</script>
@end
-->

# Pentomino-Template

          --{{0}}--

Dieses LiaScript-Template verbindet ein statisches Hunderterfeld mit
interaktiven Polyominos und nativen LiaScript-Abdeckungsquizzen. Das Inventar
enthält alle 20 freien Formen aus zwei bis fünf Einheitsquadraten: ein Domino,
zwei Triominos, fünf Tetrominos und zwölf Pentominos. Jeder Stein ist
standardmäßig als Ganzes ziehbar, rastet beim Loslassen auf dem Zahlenraster
ein und lässt sich über einen kleinen runden `↻`-Button seitlich am Stein in
90°-Schritten drehen. Am rechten Rand wechselt der Button automatisch auf die
linke Seite.

Die Zahlen bleiben durch die leicht transparenten Füllungen sichtbar. Jeder
Formtyp besitzt eine eigene Standardfarbe und jede konkrete Instanz intern
einen eindeutigen Namen. Dieser Name wird auf dem Feld nicht angezeigt.

Die aktuelle Fassung ist ein Proposal mit der Version `1.0.0`.

## Abhängigkeiten

          --{{0}}--

Der Dokumentkopf lädt den jeweils aktuellen Stand des Zweigs `main` von
`lia-coordinate`:

``` markdown
import: https://cdn.jsdelivr.net/gh/LiaTemplates/JSXGraph@main/README.md
import: https://cdn.jsdelivr.net/gh/MINT-the-GAP/lia-coordinate@main/README.md
```

Um den Stand von `lia-coordinate` festzuhalten, kann der bisher geprüfte
Stand stattdessen auf Commit
`1e1f7be4ea807c8360d10bf6b251a1272974212e` fixiert werden:

``` markdown
import: https://cdn.jsdelivr.net/gh/LiaTemplates/JSXGraph@main/README.md
import: https://cdn.jsdelivr.net/gh/MINT-the-GAP/lia-coordinate@1e1f7be4ea807c8360d10bf6b251a1272974212e/README.md
```

JSXGraph verweist in beiden Varianten weiterhin auf den beweglichen Zweig
`@main`. Für einen vollständig reproduzierbaren Kurs muss auch diese
Abhängigkeit auf einen kompatiblen Commit festgelegt werden.

LiaScript löst verschachtelte Template-Importe nicht in jeder Situation
zuverlässig auf. Ein konsumierender Kurs sollte deshalb JSXGraph,
`lia-coordinate` und dieses Pentomino-Template jeweils direkt in seinem
eigenen Dokumentkopf importieren:

``` markdown
import: https://cdn.jsdelivr.net/gh/LiaTemplates/JSXGraph@main/README.md
import: https://cdn.jsdelivr.net/gh/MINT-the-GAP/lia-coordinate@main/README.md
import: https://cdn.jsdelivr.net/gh/MINT-the-GAP/lia-pentominos@main/README.md
```

Der dritte Import lädt dieses Template aus dem Repository
`MINT-the-GAP/lia-pentominos` vom Zweig `main`. `README.md` und
`dist/index.js` bleiben dabei gemeinsam erreichbar.

## `@Pentomino(spec)`

          --{{0}}--

`@Pentomino` erzeugt ein vollständiges Zahlenfeld und setzt genau einen
konfigurierten Polyomino-Stein darauf. Ein separates Koordinatenboard und eine
Board-ID sind nicht erforderlich:

``` markdown
@Pentomino(`name=T5-01;type=T5;numbers=[6,7,8,17,27]`)
```

Das folgende `T5-01` startet genau über den Zahlen `6, 7, 8, 17` und `27`.
Die Reihenfolge der fünf Einträge in `numbers` ist beliebig. Der Stein rastet
beim Loslassen auf ganzen Rasterkoordinaten ein und lässt sich über den kleinen
runden `↻`-Button in 90°-Schritten drehen.

---

@Pentomino(`name=T5-01;type=T5;numbers=[6,7,8,17,27]`)

## `@Pentominos`

          --{{0}}--

`@Pentominos` liest mehrere Konfigurationszeilen aus einem Codeblock und
erzeugt dafür ein gemeinsames Zahlenfeld. Jede nicht leere Zeile beschreibt
eine Instanz; Namen müssen innerhalb dieses Feldes eindeutig sein.

```` markdown
``` text @Pentominos
name=L5-01;type=L5;numbers=[11,21,31,41,42]
name=U5-01;type=U5;numbers=[15,17,25,26,27]
name=X5-01;type=X5;numbers=[59,68,69,70,79]
```
````

---

``` text @Pentominos
name=L5-01;type=L5;numbers=[11,21,31,41,42]
name=U5-01;type=U5;numbers=[15,17,25,26,27]
name=X5-01;type=X5;numbers=[59,68,69,70,79]
```

## `@PentominoDock`

          --{{0}}--

`@PentominoDock` erzeugt ein vollständiges Hunderterfeld mit einem kompakten
Inventar rechts daneben. Das Feld ist
$520\,\text{px}\times520\,\text{px}$ groß. Wird der
verfügbare Inhaltsbereich schmal, rutscht
das Inventar automatisch unter das Feld. Der vertikale Reiter ist genauso hoch
wie das Hunderterfeld; sein um 180° gedrehter Schriftzug **Pentominos** läuft
von unten nach oben. Die Palette klappt nach rechts auf und ordnet alle 20
Formen von `I2` bis `Z5` als größere farbige Vorschauen in einem 4×5-Raster an.
Inventar und Reiter bleiben exakt feldhoch; erst zusätzliche Einträge unterhalb
der Palette lassen das Panel scrollen. Ziehe eine Form in das Feld; auf Geräten
ohne bequeme Zeigerbedienung kann sie auch angetippt beziehungsweise angeklickt
werden.

``` markdown
@PentominoDock
```

---

@PentominoDock

Jede Vorschau bleibt im Inventar verfügbar und kann mehrfach verwendet werden.
Jeder herausgezogene Stein ist anschließend ein normaler Polyomino-Stein: Er
rastet auf dem Raster ein, bleibt als Ganzes ziehbar und lässt sich in
90°-Schritten drehen. Die Runtime vergibt konfliktfreie Namen wie `T5-Dock-01` und
`T5-Dock-02`; diese Namen erscheinen weder auf dem Feld noch im Dock.

Sobald ein Stein erzeugt wurde, erscheint er im Abschnitt **Pentominos im Feld**
nur noch als kleine Formvorschau; Fixier- und Löschknöpfe gibt es dort nicht
mehr. Zum Löschen ziehst du den beweglichen Stein zurück auf den sichtbaren
Reiter oder in das geöffnete Inventar. Alternativ wählst du ihn im Feld oder in
der Vorschau aus und drückst **Entf** beziehungsweise **Delete**. Die internen
Instanznamen bleiben dabei im Feld und im Dock unsichtbar. Die Makrooption
`fixed=true` bleibt für fest vorgegebene Aufgabensteine verfügbar; diese Steine
sind nicht Teil der beiden Dock-Löschgesten. Die Inventarvorlage bleibt für
weitere Steine verfügbar.

## `@PentominoDockAuswahl(types)`

          --{{0}}--

Mit `@PentominoDockAuswahl` lässt sich das Inventar auf bestimmte benannte
Formen begrenzen. Die kommaseparierte Liste wird als ein Makroparameter in
Backticks geschrieben:

``` markdown
@PentominoDockAuswahl(`I2,L3,O4,T5`)
```

---

@PentominoDockAuswahl(`I2,L3,O4,T5`)

Die Reihenfolge der Namen bestimmt die Reihenfolge im Dock. Erlaubt sind
ausschließlich die 20 Typnamen aus der Formtabelle; unbekannte Namen und eine
explizit leere Auswahl wie `[]` werden als Konfigurationsfehler gemeldet. Der
interne Wert `all` wählt den vollständigen Katalog und wird von
`@PentominoDock` bereits als Vorgabe gesetzt.

## `@PentominoDockQuiz(targetSum, quizOptions)`

          --{{0}}--

`@PentominoDockQuiz` verbindet das Hunderterfeld mit dem vollständigen
Inventar und einem nativen LiaScript-Quiz. Ziehe einen beliebigen Stein auf das
Feld und ordne ihn so an, dass seine bedeckten Zahlen zusammen `targetSum`
ergeben. Anschließend wählst du **Prüfen**.

``` markdown
@PentominoDockQuiz(65,`<!-- data-solution-button="off" -->`)
```

Beispielsweise kann ein `I2` die Zahlen $32+33=65$ oder ein `T5` die Zahlen
$6+7+8+17+27=65$ bedecken. Andere Typen und Lagen sind genauso gültig, sobald
mindestens ein einzelner, vollständig auf dem Hunderterfeld liegender
Inventarstein die Zielsumme erreicht.

---

@PentominoDockQuiz(65,`<!-- data-solution-button="off" -->`)

Mehrere Steine dürfen gleichzeitig auf dem Feld liegen. Sie werden einzeln
geprüft; ihre Summen werden nicht miteinander addiert. Fest konfigurierte
Steine aus anderen Standalone-Instanzen zählen nicht. Über den
Parameter `quizOptions` lassen sich native LiaScript-Quizoptionen
weiterreichen. Für diese räumlich offene Aufgabe empfiehlt sich wie im Beispiel
`<!-- data-solution-button="off" -->`, weil es keine einzelne darstellbare
Musterlage gibt.

Mit einem angehängten `N` erzeugen die eigenständigen Dock-Quizmakros
stattdessen das negative Hunderterfeld von $50$ bis $-49$. Geprüft wird dann
die Summe der sichtbaren Feldwerte:

``` markdown
@PentominoDockQuizN(-35,`<!-- data-solution-button="off" -->`)
@PentominoDockQuizAuswahlN(-35,`I2,L3,O4,T5`,`<!-- data-solution-button="off" -->`)
```

---

@PentominoDockQuizN(-35,`<!-- data-solution-button="off" -->`)

Mit `@PentominoDockQuizAuswahl` wird das Inventar eingeschränkt:

``` markdown
@PentominoDockQuizAuswahl(65,`I2,L3,O4,T5`,`<!-- data-solution-button="off" -->`)
```

## `@PentominoQuiz(targetSum, spec, quizOptions)`

          --{{0}}--

`@PentominoQuiz` erzeugt ein vollständiges Hunderterfeld, setzt genau das in
`spec` konfigurierte Polyomino darauf und ergänzt ein natives
LiaScript-Quiz. **Verschiebe** und drehe den Stein so, dass die bedeckten
Zahlen zusammen `targetSum` ergeben, und wähle anschließend **Prüfen**.

Der dritte Parameter reicht LiaScript-Quizoptionen unverändert an
das native Quiz weiter. Für Abdeckungsaufgaben empfiehlt sich
`<!-- data-solution-button="off" -->`, weil es keine einzige automatisch
darstellbare Zielposition gibt.

Eine handgeschriebene Musterlösung kann direkt auf den Makroaufruf folgen.
Der Sternblock wird dann dem intern erzeugten Quiz zugeordnet:

``` markdown
@PentominoQuiz(45,`name=Lia503-I2;type=I2;numbers=[1,2]`,`<!-- data-solution-button="off" -->`)
***********
Der `I2` kann die Zahlen 22 und 23 bedecken: $22+23=45$.
***********
```

Mit `data-solution-button="off"` bleibt die Musterlösung bis zu einer
erfolgreichen Prüfung verborgen. Soll sie über **Auflösen** erreichbar sein,
muss der dritte Parameter auf `<!-- data-solution-button="on" -->` gesetzt
werden.

``` markdown
@PentominoQuiz(115,`name=T5-Quiz-01;type=T5;numbers=[6,7,8,17,27]`,`<!-- data-solution-button="off" -->`)
```

Das Beispiel startet mit $6+7+8+17+27=65$. Eine mögliche Lösung bedeckt
$16,17,18,27,37$ und hat damit die Summe $115$. Andere Positionen werden
ebenfalls akzeptiert, wenn ihre fünf Zahlen dieselbe Zielsumme ergeben.

---

@PentominoQuiz(115,`name=T5-Quiz-01;type=T5;numbers=[6,7,8,17,27]`,`<!-- data-solution-button="off" -->`)

Mit `@PentominoQuizN` genügt ebenfalls das angehängte `N`, um das negative
Hunderterfeld zu erzeugen. Die Zielsumme bezieht sich auf seine sichtbaren
Werte; ein `I2` auf den Positionen 68 und 69 bedeckt dort $-17$ und $-18$ und
erfüllt somit die Zielsumme $-35$:

``` markdown
@PentominoQuizN(-35,`name=FoBi-I2;type=I2;numbers=[2,3]`,`<!-- data-solution-button="off" -->`)
```

Die Einträge in `numbers` bleiben dabei die eindeutigen Feldpositionen von
`1` bis `100`. Im Beispiel startet der Stein deshalb auf der zweiten und
dritten Position; dort stehen im negativen Feld zunächst die Werte 49 und 48.

---

@PentominoQuizN(-35,`name=FoBi-I2;type=I2;numbers=[2,3]`,`<!-- data-solution-button="off" -->`)

Die Prüfung ist nur dann erfolgreich, wenn der Stein vollständig eingerastet
ist und genau so viele eindeutige Zahlen des Hunderterfeldes bedeckt, wie sein
Typ Zellen besitzt. Eine Teilabdeckung außerhalb des Feldes kann deshalb nicht
versehentlich als richtige Teilsumme gelten. In den Beispielen ist der
LiaScript-Lösungsbutton über `quizOptions` deaktiviert, weil die Aufgabe
mehrere räumliche Lösungen besitzen kann.

## Die 20 Formen

          --{{0}}--

Die Typnamen verbinden den üblichen Formbuchstaben mit ihrer Zellenzahl. Der
Katalog umfasst das Domino `I2`, die Triominos `I3` und `L3`, die Tetrominos
`I4`, `O4`, `T4`, `L4` und `S4` sowie die zwölf Pentominos. Eine optionale
Instanznummer folgt nach einem Bindestrich, zum Beispiel `I2-01`, `L3-02`,
`O4-01`, `T5-02` oder `X5-01`.

| Typ | Grundbox | Standardfarbe |
| --- | ---: | --- |
| `I2` | 2 × 1 | `#006d77` – Petrol |
| `I3` | 3 × 1 | `#8338ec` – Violett |
| `L3` | 2 × 2 | `#ff6b6b` – Koralle |
| `I4` | 4 × 1 | `#118ab2` – Blau |
| `O4` | 2 × 2 | `#f4a261` – Apricot |
| `T4` | 3 × 2 | `#6a994e` – Grün |
| `L4` | 2 × 3 | `#e76f51` – Terrakotta |
| `S4` | 3 × 2 | `#9b5de5` – Lila |
| `F5` | 3 × 3 | `#3569b7` – Kobaltblau |
| `I5` | 5 × 1 | `#e88918` – Orange |
| `L5` | 2 × 4 | `#d43d51` – Karmin |
| `P5` | 2 × 3 | `#2a9d8f` – Türkis |
| `N5` | 4 × 2 | `#4f8f3a` – Grün |
| `T5` | 3 × 3 | `#d6a800` – Gold |
| `U5` | 3 × 2 | `#7a4fb3` – Violett |
| `V5` | 3 × 3 | `#d95f9d` – Pink |
| `W5` | 3 × 3 | `#8c5a3c` – Braun |
| `X5` | 3 × 3 | `#56616b` – Anthrazit |
| `Y5` | 2 × 4 | `#169cc4` – Cyan |
| `Z5` | 3 × 3 | `#83951c` – Oliv |

Die Ausdehnung ist kein Bestandteil des Instanznamens: Sie ändert sich beim
Drehen. Statt einer mehrdeutigen Kurzform wie `T23` bleibt der Stein
beispielsweise immer `T5-01`. Seine Startlage und Orientierung werden direkt
aus den zur Zellenzahl passenden Einträgen in `numbers` ermittelt; Autorinnen
und Autoren müssen dafür weder Rasterkoordinaten noch einen Drehwinkel
berechnen.

Spiegeln gehört noch nicht zur Interaktion dieser Proposal-Version.

Bei `O4` und `X5` ist jede Vierteldrehung geometrisch identisch; mehrere
weitere Formen wiederholen sich nach `180°`. Intern hält der Laufzeitzustand
dennoch jeden Drehschritt in Vierteldrehungen fest. Für die fachliche
Auswertung sind deshalb `cells` beziehungsweise `coveredNumbers` maßgeblich.

## Konfigurationsoptionen

          --{{0}}--

| Option | Bedeutung | Vorgabe |
| --- | --- | --- |
| `name` | Eindeutiger Instanzname auf dem Board | erforderlich |
| `type` | Einer der 20 Typnamen aus der Formtabelle | erforderlich |
| `numbers` | Pro Zelle ein abgedecktes Feld; bestimmt Startlage und Orientierung | erforderlich |
| `fixed` | Stein gegen Verschieben und Drehen sperren | `true` oder `false`, Standard `false` |
| `color` | Optionale eigene Farbe | sechsstelliger Hexwert |
| `opacity` | Optionale Transparenz | `0.2` bis `0.85`, Standard `0.58` |

Groß- und Kleinschreibung werden bei `type` gleich behandelt. Für die zwölf
Fünferformen bleiben außerdem einzelne Formbuchstaben als rückwärtskompatible
Kurzformen erlaubt, beispielsweise `type=t` für `T5`. Bei den kleineren
Formen ist die Zellenzahl zwingend, weil etwa `I2`, `I3` und `I4` sonst nicht
eindeutig wären. Zeilen, die mit `#` beginnen, werden in einer
Mehrfachkonfiguration als Kommentare übersprungen.

`numbers` enthält genau so viele verschiedene Felder von `1` bis `100`, wie
die Endziffer des Typs angibt: zwei bei `I2`, drei bei `I3` und `L3`, vier bei
den Tetrominos und fünf bei den Pentominos. Die Reihenfolge ist bedeutungslos.
Die Felder müssen in einer der vier Vierteldrehungen genau die unter `type`
angegebene Form bilden. Beispielsweise beschreiben
`numbers=[6,7,8,17,27]` und jede Permutation dieser Liste dasselbe `T5`; für
`I2` genügt etwa `numbers=[6,7]`. Die Zellkanten haben immer die Länge `1` und
stimmen dadurch exakt mit dem Hunderterfeld überein.

Ein Feld kann in derselben Liste maskiert werden: Sowohl `6=x` als auch `x=6`
legen den Stein auf das Feld `6`, zeigen dort aber $x$ statt der Zahl an. Ein
nacktes `x` ist ebenfalls möglich, etwa `numbers=[x,7,8,17,27]`, sofern sich
das fehlende Feld aus den übrigen Zahlen und `type` eindeutig ermitteln lässt.
Für `L3` reichen entsprechend zwei Zahlen und ein `x`. Gibt es keine oder
mehrere Ergänzungen, ist die Konfiguration ungültig. Die
Maskierung gehört zum absoluten Feld des Hunderterfeldes: Intern bleibt es das
entsprechende Zahlenfeld, wird bei Summen und in `coveredNumbers` numerisch
ausgewertet und bleibt auch dann an dieser Stelle, wenn der Stein verschoben
oder gedreht wird.

Mit `fixed=true` bleibt ein Stein an seiner Startlage fixiert; er lässt
sich weder verschieben noch drehen und benötigt deshalb keinen Drehknopf.

## Maskiertes und fixiertes Pentomino

          --{{0}}--

Dieses vollständige Beispiel setzt ein fixiertes `T5` auf die Felder
`6, 7, 8, 17, 27`. Das Feld `27` zeigt dabei $x$ statt der Zahl. Für einen
weiterhin beweglichen Stein wird `fixed=true` einfach weggelassen.

``` markdown
@Pentomino(`name=T5-X-01;type=T5;numbers=[6,7,8,17,27=x];fixed=true`)
```

---

@Pentomino(`name=T5-X-01;type=T5;numbers=[6,7,8,17,27=x];fixed=true`)

## Acht Pentomino-Abdeckaufgaben

          --{{0}}--

In jeder Aufgabe muss ein Fünfer-Pentomino so gezogen, gedreht und abgelegt
werden, dass die Summe seiner fünf bedeckten Zahlen den Zielwert erreicht.
**Prüfen** wertet ausschließlich eine vollständige Abdeckung aus. Im
Präsentations- und Folienmodus erscheinen die Aufgaben nacheinander; im
Textbook-Modus stehen sie untereinander.

             {{0-1}}
********************************************************************************

**Aufgabe 1 – I5: einfacher Einstieg**

Hier genügt es, den waagerechten `I5` zu verschieben.

@PentominoQuiz(65,`name=I5-Abdecken-01;type=I5;numbers=[1,2,3,4,5]`,`<!-- data-solution-button="off" -->`)

********************************************************************************

             {{1-2}}
********************************************************************************

**Aufgabe 2 – T5: drehen und verschieben**

Für diese eindeutige Abdeckung muss der `T5` seine Orientierung ändern.

@PentominoQuiz(143,`name=T5-Abdecken-02;type=T5;numbers=[6,7,8,17,27]`,`<!-- data-solution-button="off" -->`)

********************************************************************************

             {{2-3}}
********************************************************************************

**Aufgabe 3 – L5: neue Orientierung finden**

Drehe und verschiebe den `L5`; auch diese Zielsumme besitzt genau eine Lage.

@PentominoQuiz(164,`name=L5-Abdecken-03;type=L5;numbers=[11,21,31,41,42]`,`<!-- data-solution-button="off" -->`)

********************************************************************************

             {{3-4}}
********************************************************************************

**Aufgabe 4 – X5: die richtige Mitte treffen**

Beim drehsymmetrischen `X5` entscheidet allein die richtige Position.

@PentominoQuiz(225,`name=X5-Abdecken-04;type=X5;numbers=[3,12,13,14,23]`,`<!-- data-solution-button="off" -->`)

********************************************************************************

             {{4-5}}
********************************************************************************

**Aufgabe 5 – P5 oder Y5: zwei Lösungswege**

Wähle einen der beiden Steine aus dem Inventar. Beide Formen können die
Zielsumme erreichen.

@PentominoDockQuizAuswahl(164,`P5,Y5`,`<!-- data-solution-button="off" -->`)

********************************************************************************

             {{5-6}}
********************************************************************************

**Aufgabe 6 – F5, N5 oder W5: passende Form finden**

Nur eine der drei angebotenen Formen besitzt eine passende Abdeckung.

@PentominoDockQuizAuswahl(115,`F5,N5,W5`,`<!-- data-solution-button="off" -->`)

********************************************************************************

             {{6-7}}
********************************************************************************

**Aufgabe 7 – U5, V5 oder Z5: mehrere Wege**

Hier führen verschiedene Formen und Lagen zur gesuchten Summe.

@PentominoDockQuizAuswahl(245,`U5,V5,Z5`,`<!-- data-solution-button="off" -->`)

********************************************************************************

             {{7}}
********************************************************************************

**Aufgabe 8 – Alle zwölf: die Höchstsumme abdecken**

Nutze das vollständige Fünfer-Pentomino-Inventar und erreiche die größte
überhaupt mögliche Abdeckungssumme.

@PentominoDockQuizAuswahl(490,`F5,I5,L5,P5,N5,T5,U5,V5,W5,X5,Y5,Z5`,`<!-- data-solution-button="off" -->`)

********************************************************************************


## Implementation

          --{{0}}--

Der folgende Implementationsauszug zeigt die öffentlichen Shortcuts und
zentralen Marker. Die Makros injizieren eine eindeutige DOM-ID über `@uid`.
Der fachliche Instanzname steht unabhängig davon in der Konfiguration:

```` markdown
script: ./dist/index.js

@Pentomino: @Pentomino_(@uid,`@0`)
@Pentominos: @Pentomino_(@uid,```@0```)
@PentominoDock: @PentominoDock_(@uid,`all`)
@PentominoDockAuswahl: @PentominoDock_(@uid,`@0`)
@PentominoDockQuiz: @PentominoDockQuiz_(@uid,@0,`all`,`@1`,`standard`)
@PentominoDockQuizN: @PentominoDockQuiz_(@uid,@0,`all`,`@1`,`negative`)
@PentominoDockQuizAuswahl: @PentominoDockQuiz_(@uid,@0,`@1`,`@2`,`standard`)
@PentominoDockQuizAuswahlN: @PentominoDockQuiz_(@uid,@0,`@1`,`@2`,`negative`)
@PentominoQuiz: @PentominoQuiz_(@uid,@0,`@1`,`@2`,`standard`)
@PentominoQuizN: @PentominoQuiz_(@uid,@0,`@1`,`@2`,`negative`)

@Pentomino_
@PentominoBoard_(pentomino-board-@0)
@PentominoChart_(@0,`pentomino-board-@0`,`standard`)
<pre id="pentomino-config-@0" class="lia-pentomino-config" data-board-id="pentomino-board-@0" hidden aria-hidden="true">@1</pre>
@end

@PentominoDockMarker_
<lia-keep class="lia-pentomino-dock-keep">
<aside id="pentomino-dock-@0" class="lia-pentomino-dock" data-board-id="@1" data-types="@2"></aside>
</lia-keep>
@end

@PentominoConfig_
<pre id="pentomino-config-@0" class="lia-pentomino-config" data-board-id="@1" hidden aria-hidden="true">@2</pre>
@end
````

Die privaten Quizmakros erzeugen weiterhin das von LiaScript zu parsende
`[[!]]`, delegieren die Prüfung im Header aber nur noch einzeilig an
`window.LiaPentomino.checkQuiz(markerId)`. Strikte Zielwertprüfung,
Zuordnung zum Einzelstein beziehungsweise Dock und Abdeckungslogik liegen im
TypeScript-Bundle. Auch Schalter, Panel, Listen und ARIA-Attribute des Docks
erzeugt das Bundle aus dem schlanken `aside`-Marker.

Für eigene Integrationen stehen außerdem
`window.LiaPentomino.getDockPieces(boardId, dockMarkerId)` und
`window.LiaPentomino.dockCoversSum(boardId, dockMarkerId, targetSum)` bereit.
Die zweite Methode liefert `true`, sobald ein einzelner vollständig auf dem
Feld liegender Stein des angegebenen Docks die Zielsumme bildet; mehrere
Steine werden dabei nicht addiert.

Das Bundle wartet auf das von `lia-coordinate` registrierte Board, baut
Hunderterfeld und Steine idempotent auf und ersetzt sie bei einem
LiaScript-Seitenwechsel auf dem jeweils aktuellen Board. Ein Runtime-Token
verhindert dabei alte Drag-Handler nach einem erneuten Laden des Bundles.

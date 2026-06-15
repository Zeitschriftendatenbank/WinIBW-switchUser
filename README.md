# SwitchUser
## Kurzbeschreibung
- Sammlung von Hilfsskripten zur Verwaltung von Benutzerwechseln und zugehörigen Aufgaben innerhalb der WinIBW4-Umgebung.

Inhalt des Ordners
- `Scripts/` — Hauptskripte, z. B. `switchUser.js` (Hauptlogik) und Hilfsdateien.
- `winibw_users copy.tsv` — Beispiel-Benutzerliste.
- `ScriptFileList.txt` — Liste der verfügbaren Skripte (falls vorhanden).

Schnellstart
- Öffnen Sie den Ordner `Scripts` und laden Sie `switchUser.js` in den internen Skripteditor von WinIBW4.
- Führen Sie das Skript innerhalb der WinIBW4-Anwendung aus; die Skripte sind für die Ausführung in dieser Umgebung geschrieben.

Konfiguration
- Passen Sie die TSV- oder Konfigurationsdateien im Ordner an Ihre lokale Umgebung an. Stellen Sie sicher, dass die Kodierung auf UTF-8 gesetzt ist.

Beispiele
- Allgemeine Anpassungen und Beispiele finden sich neben den Skripten im Ordner `Scripts`.

Beitrag leisten
- Änderungen lokal testen und eine kurze Beschreibung der Änderung samt Testschritten beilegen.

Kontakt
- Bei Fragen oder Problemen wenden Sie sich an die Projektverantwortlichen.

## Funktion initSwitchUser

Zweck
- Initialisiert das globale `Users`-Objekt aus der TSV-Datei `winibw_users.tsv` und lädt optional ein Master-Passwort.

Verhalten
- Legt `Users` mit den Teilobjekten `eln`, `iln` und `user` an.
- Liest die Datei `winibw_users.tsv` (im Profil-Unterordner `user`) mittels der `CSV`-Hilfsklasse. Erwartete Spalten: `USER_WIN`, `USER_WEB`, `eln`, `iln`, `USER_NAME`.
- Baut Zuordnungen: ELN → Benutzerliste, ILN → ELN-Liste, BenutzerID → Anzeigename. Entfernt Duplikate.
- Zeigt nach dem Einlesen eine Zusammenfassung (Anzahl ELN/ILN/User) an.
- Versucht, das Master-Passwort über `__switchUserGetMaster()` zu lesen und speichert es in `Users.master`.

Aufruf
- Direkt: `initSwitchUser()`
- Wird automatisch von `switchUser()` aufgerufen, falls `Users` nicht initialisiert ist.

Voraussetzungen
- Die Datei `%APPDATA%\\OCLC\\WinIBW4\\user\\winibw_users.tsv` muss vorhanden sein (Tab-separiert, Header in Zeile 1).
- Optional: `%APPDATA%\\OCLC\\WinIBW4\\user\\getpw.ps1` zum Abruf des Master-Passworts.
- Die WinIBW4-Umgebung mit `CSV`-Klasse und `activeWindow` API muss verfügbar sein.

Nebenwirkungen
- Schreibt Profil-Einstellungen (`csv.filepath = 'user'`) und zeigt Info-/Alert-Dialoge.
- Initialisiert die globale Variable `Users`.


## Funktion `Users.switchTo`

Zweck
- Programmgesteuertes Umschalten auf einen bestimmten Benutzer, falls dieser in der eingelesenen Benutzerliste vorhanden ist.

Signatur
- `Users.switchTo(user)`

Parameter
- `user` (string): Benutzerkennung (z. B. `USER_WIN` oder `USER_WEB`).

Verhalten
- Führt bei Bedarf die Lazy-Initialisierung aus (TSV-Einlesen, Master-Passwort-Abruf) bevor die Operation ausgeführt wird.
- Prüft, ob der Benutzer in `Users.user` vorhanden ist; falls nicht, gibt die Funktion `false` zurück.
- Beschafft das Passwort wie in `switchUser()` beschrieben: gespeichertes Passwort, Master-Passwort oder interaktive Abfrage mit Option zum Speichern.
- Führt das Login in einem neuen Fenster aus (intern wird `Users.logOn(..., newWindow=true)` verwendet) und gibt die Fenster-ID zurück.

Rückgabewert
- Zahl (Fenster-ID) bei Erfolg.
- `false` bei Abbruch (z. B. User nicht gefunden oder Nutzer bricht Passwortabfrage ab).

Nebenwirkungen
- Kann bei Bedarf das Master-Passwort oder individuelle Passwörter im Profil speichern, wenn vom Nutzer bestätigt.


## Funktion `Users.logOn`

Zweck
- Sendet die eigentlichen Login-Befehle an WinIBW4; kann wahlweise in einem neuen Fenster ausgeführt werden.

Signatur
- `Users.logOn(user, pwd, newWindow)`

Parameter
- `user` (string): Benutzerkennung.
- `pwd` (string): Passwort (im Klartext).
- `newWindow` (boolean): Wenn `true`, wird das Login in einem neuen Fenster versucht; `false` führt das Login im aktuellen Fenster aus.

Verhalten
- Führt den Befehl `log <user> <pwd>` über `activeWindow.command(...)` aus. Bei `newWindow === true` wird die `inNewWindow`-Flag gesetzt.
- Versucht (heuristisch) innerhalb kurzer Zeit festzustellen, ob ein neues Fenster erzeugt wurde und gibt dessen Fenster-ID zurück. Falls keine neue ID festgestellt wird, liefert die Funktion die aktuelle Fenster-ID oder `false`.

Rückgabewert
- Zahl (Fenster-ID) bei Erfolg (eventuell die aktuelle Fenster-ID wenn kein neues Fenster angelegt wurde).
- `false` bei Fehler.

Hinweis zur Nutzung
- Beide Funktionen sind als Wrapper so implementiert, dass sie vor der aufwändigen Initialisierung der `Users`-Datenstruktur aufgerufen werden können; die tatsächliche Initialisierung erfolgt beim ersten Bedarf (lazy init).

## Funktion switchUser

Zweck
- Führt den tatsächlichen Benutzerwechsel durch: Auswahl eines Benutzers, Passwortbeschaffung und Login-Befehle an die WinIBW4-Oberfläche senden.

Verhalten
- Prüft, ob `Users` initialisiert ist; falls nicht, ruft `initSwitchUser()` auf.
- Baut eine Liste möglicher Benutzer auf:
	- Für normale Fenster: sammelt alle Benutzer über `Users.eln` und sortiert sie.
	- Für `Tw`-Datensätze: ermittelt die `ILN` aus dem aktiven Datensatz (`__getIlnFromTw()`), ermittelt zugehörige `ELN` und daraus die Benutzer.
- Zeigt eine Auswahlbox (`__promptUsers`) zur Benutzerwahl an.
- Beschafft das Passwort:
	- Verwendet `Users.master`, falls gesetzt.
	- Sonst versucht es, ein gespeichertes Passwort aus dem Profil (`switchUser` namespace) zu lesen.
	- Falls keines vorhanden ist, fragt es interaktiv nach einem Passwort und bietet an, dieses zu speichern.
- Nach erfolgreicher Auswahl und Passwortbeschaffung sendet es die Login-Befehle an die Anwendung:
	- `log <user> <pwd>`
	- setzt System/Bestandsparameter mit `\sys` und `\bes` aus den Profilwerten `cbs.sys` und `cbs.bes`.
	- Falls eine IDN (`P3GPP`) vorhanden ist, führt es eine Suche `f \PPN <idn>` aus.

Aufruf
- Direkt: `switchUser()`

Voraussetzungen
- `initSwitchUser()` oder eine zuvor initialisierte globale Variable `Users`.
- Funktionierende APIs der Umgebung: `activeWindow`, `utility.newPrompter()`, `getProfileString()`.

Nebenwirkungen
- Öffnet Dialoge/Prompts und kann Passwörter ins Profil schreiben (wenn der Nutzer es bestätigt).

## Master-Passwort festlegen

Kurzanleitung (PowerShell + DPAPI)
- Einfaches, einmaliges Vorgehen, um ein Master-Passwort verschlüsselt abzulegen:

Führen Sie einmalig in einer PowerShell aus:

```powershell
$pw = Read-Host "Passwort" -AsSecureString

$encrypted = ConvertFrom-SecureString $pw

$encrypted | Set-Content C:\secure\pw.txt
```

Als Ergebnis erhalten Sie eine Zeichenkette wie z. B.:

```
01000000d08c9ddf0115d1118c7a00c04fc297eb...
```

Hinweis
- Die verschlüsselte Zeichenkette wurde mit DPAPI an Ihren Windows-Benutzer gebunden. Das bedeutet:
	- Sie kann nur unter demselben Windows-Benutzer und auf demselben Rechner entschlüsselt werden.
	- Die Datei ist somit nicht einfach auf anderen Rechnern oder unter anderen Benutzern nutzbar.

Optionale Integration
- Das vorhandene Skript `__switchUserGetMaster()` ruft standardmäßig `%APPDATA%\\OCLC\\WinIBW4\\user\\getpw.ps1` auf; passen Sie den Speicherort entsprechend an oder erstellen Sie ein PowerShell-Skript, das die Datei `C:\secure\pw.txt` liest und das Passwort unverschlüsselt ausgibt (achten Sie auf Berechtigungen!).

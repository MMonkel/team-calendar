# Team S — functionele spelregels

## Team

**Admins:** Alexandra, Marc
**Leden:** Nicole, Celestine, Mariska, Robin, Marielle, Jim

## Basisrooster

Geldt het hele jaar, tenzij een aanvraag het overschrijft:

| Dag | Ochtend | Middag |
|---|---|---|
| Maandag | Celestine | Robin |
| Dinsdag | Mariska | Nicole |
| Woensdag | Celestine | Alexandra + Marc |
| Donderdag | Robin | Mariska |
| Vrijdag | Nicole | Marielle |
| Zaterdag | Alexandra + Marc (hele dag) | |
| Zondag | Alexandra + Marc (hele dag) | |

## Feestdagen

Goede Vrijdag, 2e Paasdag, Hemelvaart, 2e Pinksterdag, Koningsdag, en 4 en 5 mei
zijn gewone werkdagen: het basisrooster hierboven geldt gewoon, de kalender
toont alleen een label. Alleen **1e en 2e Kerstdag** wijken af: die dagen
draaien altijd Alexandra en Marc, ook als het basisrooster van die weekdag iets
anders zou zeggen.

Feestdagen worden berekend (Pasen als anker), niet los per jaar bijgehouden.
Zie `shared/src/holidays.ts`.

## Aanvragen: drie soorten, één tabel

* **Vrije dag / vakantie** (`absence`) — één of meer dagen vrij, met per
  dagdeel een eigen vervanger.
* **Verplaatsing** (`move`) — schuift een bestaande aanvraag (concept of al
  definitief) naar andere datums. Wijst naar de oorspronkelijke aanvraag via
  `targetId`.
* **Terugzetten** (`revert`) — maakt een bestaande aanvraag weer een gewone
  werkdag. Wijst ook naar de oorspronkelijke aanvraag.

Alles begint als **concept** (`draft`). Alleen Alexandra of Marc kan een
concept goedkeuren (`approved`) of afkeuren (`rejected`, met verplichte reden).
Een verplaatsing of terugzetting is zelf ook weer een concept tot een admin hem
goedkeurt — pas dan schuift de oorspronkelijke aanvraag mee, of vervalt hij.

Deze kaskade-logica (wat er met de oorspronkelijke aanvraag gebeurt bij
goedkeuring van een move/revert) staat op één plek:
`api/src/domain/requestRules.ts` → `cascadeForApproval`.

## Vervangers per dagdeel

Een aanvraag voor meerdere dagen kan per dagdeel een andere vervanger hebben —
niet één vervanger voor de hele periode. De sleutel is `"YYYY-MM-DD|dagdeel"`
(bijvoorbeeld `2026-01-05|am`), met als waarde de naam van de vervanger.

De server accepteert alleen vervangers voor dagdelen die daadwerkelijk van de
aanvrager zelf zijn (`sanitizeReplacements` in `requestRules.ts`) — een
gemanipuleerd verzoek kan geen dagdelen van iemand anders overnemen.

## 3-maandenwaarschuwing

Ligt de eerste dag van een aanvraag binnen 3 maanden vanaf vandaag, dan:
* ziet de aanvrager een waarschuwing in het formulier voordat hij indient;
* krijgt de aanvraag een `shortNotice`-vlag die Alexandra en Marc in hun
  beoordeellijst zien.

Dit blokkeert niets — het is puur een signaal. Zie `noticeWarning` in
`shared/src/roster.ts`.

## Activiteiten

Een admin kan in de dagweergave van de kalender een **activiteit** plannen
op een hele dag (bijvoorbeeld een teamuitje of training): een naam plus een
optionele toelichting. Iedereen ziet die in de dag-, week- en maandweergave,
zodat het team er rekening mee kan houden. Een activiteit is puur
informatief: het rooster en de aanvragen veranderen er niet door. Alleen
admins kunnen activiteiten aanmaken en verwijderen (`api/src/routes/activities.ts`).

## Wie ziet wat

* **Kalender** (dag/week/maand): open voor iedereen, onbeperkt bladeren heen
  en terug. Toont voor elk dagdeel wie er staat, en bij een openstaande of
  goedgekeurde aanvraag ook wie de oorspronkelijke persoon was.
* **Mijn overzicht**: eigen aanvragen (met intrekken/verplaatsen/terugzetten),
  plus twee jaaroverzichten — vrij genomen dagdelen, en dagdelen die je als
  vervanger draait die niet je eigen rooster waren.
* **Te beoordelen** (alleen admins): alle openstaande concepten, één voor één,
  met een waarschuwing als er dagdelen zonder vervanger zijn.
* **Alle aanvragen** (alleen admins): volledige lijst met statusfilter.

## Wat nog niet af is

* **Login is een placeholder** — zie de "Login"-sectie in de hoofd-README.
  Zonder Entra ID kan iedereen zich voordoen als een admin.
* **Geen notificaties** — een admin moet zelf op "Te beoordelen" kijken; een
  aanvrager moet zelf terugkomen om een beslissing te zien.
* **Geen bezettingsoverzicht los van het rooster** — of een dag "genoeg mensen"
  heeft, zie je alleen door te kijken of alle dagdelen een naam hebben.

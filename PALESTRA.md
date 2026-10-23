# Palestra

Tab di RunPlan per la forza, pensato per chi prepara gare di corsa. Gira in un iframe (`palestra/index.html?embed=runplan`) con lo stesso foglio di stile di RunPlan (`css/app.css` + `palestra/palestra.css`).

## Il programma

**Lo decidi tu: cosa e quanto.** In *Schede → Decidi movimenti e serie* scegli:

- **sedute a settimana**: 1, 2 o 3 (Total Body A, B, C, a rotazione);
- **i movimenti di ogni seduta**: squat, una gamba, femorali, stacco e glutei, polpacci, soleo, salti (a due piedi o alternati), spinta orizzontale e verticale, trazione verticale e orizzontale, bicipiti, tricipiti, core anti-estensione e anti-rotazione; aggiungi, togli, riordina;
- **quante serie** per ogni movimento (1–8);
- per i salti, se farli sempre o solo nel blocco Potenza (predefinito).

Si può partire da un modello (*Equilibrato*, *Più gambe*, *Breve*) e modificarlo. Sotto le schede c'è il conteggio delle **serie a settimana per area** (gambe, polpacci, spinta, trazione, braccia, core, salti) con un riferimento indicativo per chi corre.

**L'app sceglie gli esercizi.** Per ogni movimento e ogni blocco propone l'esercizio, le ripetizioni e il recupero (`PATTERNS` in `palestra/data.js`); in *Schede* puoi sostituirlo con un'alternativa, per blocco. Il programma è diviso in blocchi da 4 settimane: 3 di carico crescente (RPE 7 → 7–8 → 8) e la 4ª di scarico (una serie in meno, −10% del carico):

| Blocco | Ripetizioni | Scopo |
|---|---|---|
| Base | 10–12 (polpacci 12–15) | tendini, tecnica, base per i blocchi pesanti |
| Forza | 4–6 / 6–8 | carichi alti e recuperi lunghi: economia di corsa |
| Potenza | salti + 4–6 veloci | reattività di tendini e piedi |

Dopo Potenza si riparte da Base con i carichi raggiunti. In *Oggi → Cambia settimana* si sposta la posizione nel programma.

## Progressione

Per ogni esercizio la seduta parte già compilata (`palestra/engine.js`, funzione `prescribe`):

- **stesso carico, +1 ripetizione** per serie finché tutte le serie arrivano al tetto del range;
- poi **più carico** e si riparte dal fondo del range: +2 kg per i manubri (peso del singolo manubrio), +2,5 kg per bilanciere, macchine e cavi; per le trazioni assistite −5 kg di assistenza;
- con RPE 9–10 nella seduta precedente il carico non sale;
- al cambio di blocco il carico è stimato dal massimale implicito dell'ultima esecuzione (Epley, con 2 ripetizioni in riserva);
- a corpo libero si progredisce con le ripetizioni; al tetto si rende l'esercizio più difficile;
- le sedute di scarico non contano come riferimento.

## Collegamento con la corsa

`gym-bridge.js` legge la settimana del piano di RunPlan (`RunPlanGym.runWeek`):

- **taper e settimana gara**: la palestra va in scarico; in settimana gara una sola seduta, senza salti;
- **giorni consigliati** (tanti quante le sedute): forza nei giorni duri dopo la corsa o nei giorni di riposo; mai il giorno prima di qualità, lungo o gara, né il giorno del lungo; possibilmente un giorno pieno fra una seduta e l'altra.

Le sedute finite entrano in RunPlan come "altri sport" (calendario, carico TRIMP in Forma e fatica) tramite `runPlanGymActivities()`, in sola lettura.

## Dati

Tutto in `localStorage['passo-v1']` (versione 3) su questo dispositivo: programma, scelte degli esercizi, storico, seduta in corso. Non va nel cloud: **Impostazioni e backup** esporta e importa un JSON. I dati delle versioni precedenti vengono migrati da soli: dalla v1 si tengono le sedute di palestra (le corse registrate lì vengono scartate: stanno in RunPlan); dalla v2 si passa al programma personalizzabile partendo dal modello Equilibrato, con le scelte di esercizio già fatte.

## Test

`node tests/palestra.cjs`.

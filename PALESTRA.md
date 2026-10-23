# Palestra

Tab di RunPlan per la forza, pensato per chi prepara gare di corsa. Gira in un iframe (`palestra/index.html?embed=runplan`) con lo stesso foglio di stile di RunPlan (`css/app.css` + `palestra/palestra.css`).

## Il programma

Due sedute Total Body a settimana, A e B, alternate. Il programma è diviso in blocchi da 4 settimane: 3 di carico crescente (RPE 7 → 7–8 → 8) e la 4ª di scarico (una serie in meno, −10% del carico). Ogni blocco cambia esercizi e ripetizioni:

| Blocco | Ripetizioni | Scopo |
|---|---|---|
| Base | 10–12 (polpacci 12–15) | tendini, tecnica, base per i blocchi pesanti |
| Forza | 4–6 / 6–8 | carichi alti e recuperi lunghi: economia di corsa |
| Potenza | salti + 4–6 veloci | reattività di tendini e piedi |

Dopo Potenza si riparte da Base con i carichi raggiunti. In **Schede** si può scegliere, per ogni blocco, un'alternativa a ciascun esercizio; in **Oggi → Cambia settimana** si sposta la posizione nel programma.

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
- **giorni consigliati**: forza nei giorni duri dopo la corsa o nei giorni di riposo; mai il giorno prima di qualità, lungo o gara, né il giorno del lungo; almeno un giorno pieno tra le due sedute.

Le sedute finite entrano in RunPlan come "altri sport" (calendario, carico TRIMP in Forma e fatica) tramite `runPlanGymActivities()`, in sola lettura.

## Dati

Tutto in `localStorage['passo-v1']` (versione 2) su questo dispositivo: programma, scelte degli esercizi, storico, seduta in corso. Non va nel cloud: **Impostazioni e backup** esporta e importa un JSON. I dati del vecchio modulo (v1) vengono migrati da soli: si tengono le sedute di palestra, le corse registrate lì vengono scartate (le corse stanno in RunPlan).

## Test

`node tests/palestra.cjs`.

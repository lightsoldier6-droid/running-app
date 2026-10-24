# Palestra

Tab di RunPlan per la forza, pensato per chi prepara gare di corsa. Funziona come un diario d'allenamento alla Hevy: le schede le componi tu, l'app tiene i numeri e propone carichi e progressione. Gira in un iframe (`palestra/index.html?embed=runplan`) con lo stesso foglio di stile di RunPlan (`css/app.css` + `palestra/palestra.css`).

Quattro sezioni: **Oggi**, **Schede**, **Esercizi**, **Progressi**.

## Schede

Una scheda è un elenco di esercizi scelti da te dal catalogo. Per ogni esercizio imposti:

- **serie** (1–20);
- **range di ripetizioni** (es. 8–12), o di secondi per gli esercizi a tempo;
- **recupero**;
- una nota facoltativa.

Gli esercizi si aggiungono dal catalogo, con ricerca e filtri per muscolo e attrezzo; si possono riordinare, sostituire e togliere. Alla prima apertura ci sono due schede di esempio (Total Body A e B) da modificare o eliminare; *Aggiungi le schede di esempio* le rimette.

**Allenamento libero**: parte vuoto, aggiungi esercizi mentre ti alleni. A fine allenamento puoi salvarlo come nuova scheda.

## Esercizi

Catalogo di circa 125 esercizi (`EXERCISES` in `palestra/data.js`): bilanciere, manubri, kettlebell, macchine, cavi, corpo libero, elastici. Ogni esercizio ha:

- un muscolo principale e i muscoli che lavorano in aiuto;
- un tipo di carico: peso, corpo libero, assistenza (trazioni e dip assistiti) o tempo.

Puoi creare **esercizi personalizzati**. Il dettaglio di un esercizio mostra:

- sedute fatte, carico massimo e massimale stimato;
- il grafico del massimale nel tempo e lo storico delle serie.

## Allenamento

Ogni esercizio parte già compilato con carico e ripetizioni suggeriti. Accanto a ogni serie c'è la colonna **Prima**, con l'esecuzione precedente.

Durante l'allenamento:

- spunti le serie e parte il timer di recupero;
- puoi aggiungere serie, anche **serie di riscaldamento** (tocca il numero della serie, oppure *Aggiungi serie di riscaldamento* al 50% del carico);
- puoi aggiungere o sostituire esercizi.

Le serie di riscaldamento non contano per progressione, statistiche e record.

Quando termini:

- inserisci nome, RPE complessivo e note;
- se hai cambiato esercizi o serie, scegli se aggiornare la scheda o salvarne una nuova;
- il riepilogo mostra durata, serie, kg sollevati e i **record personali** battuti: carico più alto, massimale stimato, più ripetizioni, tempo più lungo.

## Progressione

Calcolata da `prescribe` in `palestra/engine.js`, sulla base dell'ultima volta che hai fatto quell'esercizio. Il range lo decidi tu, il resto lo propone l'app:

- **stesso carico, +1 ripetizione** per serie, finché tutte le serie arrivano al tetto del range;
- poi **più carico**, ripartendo dal fondo del range. Gli incrementi sono:
  - +2 kg per i manubri (peso del singolo manubrio);
  - +2,5 kg per bilanciere, macchine e cavi;
  - +4 kg per i kettlebell;
  - −5 kg di assistenza per trazioni e dip assistiti;
  - +5 secondi negli esercizi a tempo.
- con RPE 9–10 nella seduta precedente il carico non sale;
- se cambi range di ripetizioni, il carico è stimato dal massimale implicito (Epley, con 2 ripetizioni in riserva);
- a corpo libero si progredisce con le ripetizioni.

**Ciclo di 4 settimane**: 3 settimane di carico (RPE 7 → 7–8 → 8) e la 4ª di scarico, con una serie in meno e il 90% del carico. Le sedute di scarico non contano come riferimento. Lo scarico automatico si può disattivare in *Impostazioni*, dove si sposta anche la settimana del ciclo.

## Progressi

- totali del periodo (7 giorni, 30 giorni, 3 mesi): allenamenti, tempo, tonnellate, serie;
- **andamento settimanale** (durata, volume o serie) sulle ultime 12 settimane;
- **serie per muscolo**: 1 serie al muscolo principale, ½ a quelli che aiutano;
- **mappa dei muscoli** (davanti e dietro), colorata in base alle serie;
- **calendario** mensile con gli allenamenti e le settimane di fila con almeno una seduta;
- **storico**: tocca un allenamento per i dettagli, per ripeterlo, salvarlo come scheda o eliminarlo.

## Collegamento con la corsa

`gym-bridge.js` legge la settimana del piano di RunPlan (`RunPlanGym.runWeek`):

- **taper e settimana gara**: la palestra va in scarico;
- **giorni consigliati**, quanti l'obiettivo settimanale di sedute. I criteri:
  - forza nei giorni duri dopo la corsa o nei giorni di riposo;
  - mai il giorno prima di qualità, lungo o gara, né il giorno del lungo;
  - possibilmente un giorno pieno fra una seduta e l'altra.

Gli allenamenti finiti entrano in RunPlan come "altri sport", con il nome della scheda, tramite `runPlanGymActivities()`, in sola lettura. Contano nel calendario e nel carico TRIMP di Forma e fatica.

## Dati

Tutto è in `localStorage['passo-v1']` (versione 4) su questo dispositivo: schede, esercizi personalizzati, storico, allenamento in corso. Non va nel cloud: **Impostazioni e backup** esporta e importa un JSON.

I dati delle versioni precedenti vengono migrati da soli:

- dalla v1 si tengono le sedute di palestra; le corse registrate lì vengono scartate, perché stanno in RunPlan;
- dalla v3 i Total Body con movimenti scelti diventano schede "Total Body A/B/C", con gli esercizi che l'app aveva assegnato. Lo storico resta.

## Test

`node tests/palestra.cjs`.

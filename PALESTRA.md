# Palestra

Tab di RunPlan per la forza, pensato per chi prepara gare di corsa. Funziona come un diario d'allenamento alla Hevy: le schede le componi tu, l'app ti suggerisce cosa inserire, tiene i numeri e propone carichi e progressione. Gira in un iframe (`palestra/index.html?embed=runplan`) con lo stesso foglio di stile di RunPlan (`css/app.css` + `palestra/palestra.css`).

Quattro sezioni: **Oggi**, **Schede**, **Esercizi**, **Progressi**.

## Schede

Una scheda è un elenco di esercizi scelti da te dal catalogo. Per ogni esercizio imposti:

- **serie** (1–20);
- **range di ripetizioni** (es. 8–12), o di secondi per gli esercizi a tempo;
- **recupero**;
- una nota facoltativa.

Gli esercizi si aggiungono dal catalogo, con ricerca e filtri per muscolo e attrezzo; si possono riordinare, sostituire e togliere. Non ci sono schede preconfezionate: alla prima apertura l'elenco è vuoto.

**Allenamento libero**: parte vuoto, aggiungi esercizi mentre ti alleni. A fine allenamento puoi salvarlo come nuova scheda.

## Cosa inserire dopo

Mentre componi una scheda, e nell'allenamento libero, il riquadro **Da dove partire** (lista vuota) o **Cosa aggiungere** propone 3 esercizi. Non aggiunge niente da solo:

- tocca un suggerimento per aggiungerlo, con serie, ripetizioni e recupero di partenza (modificabili dopo);
- ⇄ propone un altro esercizio dello stesso tipo;
- in cima al catalogo, senza filtri, ci sono gli stessi suggerimenti.

Come sceglie (`suggestNext` in `palestra/engine.js`, spazi in `SLOTS` di `palestra/data.js`):

- ogni esercizio appartiene a uno **spazio** della seduta di un runner. Prima i fondamentali: squat o pressa, catena posteriore, polpacci, tirata, spinta, una gamba, core. Poi i complementi: femorali isolati, anche (abduttori e adduttori), salti, braccia;
- propone gli spazi ancora scoperti nella lista, nell'ordine di importanza;
- dentro uno spazio sceglie l'esercizio che hai già fatto più spesso, poi quello con lo stesso attrezzo degli altri in lista, poi l'ordine di preferenza;
- **allenamento libero**: conta anche le serie degli ultimi 7 giorni, quindi viene prima quello che in settimana hai allenato meno. Se domani nel piano di corsa c'è qualità, lungo o gara, niente salti e meno gambe;
- da 8 esercizi, o circa 75 minuti, la scheda è segnalata come già piena.

Serie, ripetizioni e recupero di partenza sono quelli che usi già per lo stesso esercizio in un'altra scheda; altrimenti quelli dello spazio (es. polpacci 3 × 12–15, 60"; core 2 × 8–12, 45").

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

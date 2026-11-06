# RunPlan — Guida completa

App personale di allenamento per la corsa. Costruita sui tuoi dati (148 corse da aprile 2025), gira interamente in locale: nessun account, nessun server, i dati restano sul tuo dispositivo.

---

## 1. Avvio

**Dal Mac**: doppio click su `index.html`. Tutto qui.

**Dall'iPhone** (consigliato):
1. Vai su https://app.netlify.com/drop e trascina la cartella `running-app`
2. Apri l'URL generato con Safari
3. Condividi → **Aggiungi a Home**: icona e schermo intero, come un'app vera

Quando aggiorni i dati sul Mac (vedi §6), ritrascina la cartella su Netlify Drop per aggiornare anche l'iPhone.

---

## 1b. Navigazione (dalla versione v112)

La barra in basso ha 6 voci; quelle con due viste hanno un selettore in alto:

| Voce | Contenuto |
|---|---|
| **Oggi** | Card della seduta del giorno (passo, fascia FC, schema della seduta, settimana a pallini), **Carico e rischio infortuni** (con gli altri sport), **Come stai**, **Da tenere d'occhio**, **Cosa ho notato** (note automatiche sulle ultime 5 corse). |
| **Piano** | **Settimane** (piano con "sei qui", schema di ogni seduta, menù ⋯ per cambiarla, quando e come ricalibrare, guida alle sedute, generazione del piano) · **Aderenza** (l'ex Monitor: solo statistiche su come stai seguendo il piano). |
| **Gara** | Previsione gara dalla soglia recente, obiettivo: cosa serve (sedute prova, errori da evitare), tempi previsti, passi di allenamento, ora/previsto/migliore/obiettivo, capacità e lacune, VDOT nel tempo (tutto lo storico), record personali, gare riconosciute. |
| **Forma** | **Fitness** (fitness da FC, indice aerobico, efficienza a FC di riferimento, passo a ogni FC, passo accumulato, migliori tratti) · **Zone** (zone attuali, minuti per zona e di soglia, dove passi il tempo, costo del passo, piramide, qualità del segnale FC). |
| **Progressi** | Analisi del blocco, periodo e bilancio, miglioramento dei passi, ultima corsa vs precedente, volume, passo e efficienza delle corse facili, dinamiche di corsa. |
| **Corse** | Calendario, ultime corse, **Analisi della corsa** (meteo, piano e dati esclusi), altri sport, archivio, importazione (.zip Garmin, .fit, CSV). |
| **⚙ in alto** | Impostazioni: FC max/riposo, zone FC (modifica/conferma), test, ripristino dati. |

### Novità v105 (fase specifica della maratona come RunZones)

- **Martedì a ritmo maratona**: nella fase specifica, 2 settimane di carico su 3 il martedì è una seduta a sé a ritmo M, in km e in progressione: 3×3 km → 2×5 km → 4×3 km → 3×4 km → 10 km continui → 2×6 km. La terza settimana resta a soglia (cruise o criss-cross); anche la settimana del big workout.
- **Giovedì**: se il martedì è a ritmo M e il lungo è facile, il giovedì diventa **Soglia** (6×1000 m a T); se il lungo ha ritmo gara resta Base (mai più di due sedute dure).
- **Lunghi con più ritmo gara**: la parte a ritmo M nei lunghi qualificati cresce di 6' a settimana fino a 70' (circa 16 km), contro i 50' di prima.
- Per applicarlo al piano in corso: Piano › Settimane › **↻ Ricalibra i passi delle sedute** (dalla v130 cambia solo i passi, tarati su tre VDOT: gare, soglia con la FC, facile con la FC).
- Correzione: in v104 il selettore «Guida a passo / a FC» aveva lo stesso identificativo del menu Modalità del generatore, che così non veniva letto. Risolto.

### Novità v104 (le funzioni di RunZones che mancavano)

- **Forma › Fitness › Ora, previsto, migliore, obiettivo**: per Steady, LT1, LT2 e potenza aerobica il passo che tieni ora con la FC in zona (40 giorni), quello che il VDOT da gara fa attendere, la migliore finestra degli ultimi 2 anni e il passo che serve per l'obiettivo. Se un riferimento manca, suggerisce il test per misurarlo.
- **Forma › Fitness › Efficienza a FC di riferimento**: passo settimanale con la FC in Steady, LT1 o LT2 (a scelta), con tendenza (s/km a settimana) e affidabilità.
- **Indice aerobico**: finestre 3 mesi / 6 mesi / 12 mesi / 2 anni.
- **Forma › Progressi › Analisi del blocco** (8/12/16/20 settimane): forma (CTL), fatica (ATL) e freschezza (TSB) dal TRIMP di ogni corsa; questo blocco contro il precedente; ultime 4 settimane contro le prime 4; composizione per zona; settimana tipo; storico 2 anni (miglior periodo, forma massima, gare, interruzioni).
- **Corse › Calendario** (4/8/12 settimane): un cerchio per corsa, grandezza = durata, colore = zona più alta toccata in modo significativo, arco = quota di tempo in quella zona; a destra km, corse, ore e indice aerobico della settimana. Tocca un cerchio per l'analisi.
- **Corse › Analisi**: tempo in zona sia per FC sia per passo (passi dal VDOT).
- **Corse › Archivio**: filtri per tipo (Easy, Lunghi, Qualità, Interval, Gare), corse con FC 1s, tapis roulant.
- **Piano › Guida a passo / Guida a FC**: con «Guida a FC» le sedute mostrano la fascia di FC al posto del passo (il passo resta tra parentesi); le ripetute brevi restano a passo perché la FC arriva in ritardo.
- **Oggi**: proiezione dei km a fine settimana (se fai le sedute rimaste e al ritmo dei giorni passati).

Colori fissi delle zone in tutta l'app: Z1 grigio-azzurro, Z2 blu, Z3/LT1 verde, Z4/LT2 arancio, Z5 rosso. Le sezioni sotto (§2–§5) descrivono i contenuti con i vecchi nomi dei tab.

---

## 2. Tab "Oggi" — cosa fare oggi e lo stato di forma

- **Seduta del giorno**: la seduta di oggi presa dal piano, coi ritmi già pronti e — per le sedute di qualità — riscaldamento e defaticamento. Se oggi è riposo mostra la **prossima** seduta ("Domani"/"Tra X giorni") e sotto il riepilogo della settimana con ✓ su quelle già fatte. Se non hai un piano attivo, la card lo spiega.
- **Carico e rischio infortuni**: il rapporto tra i km degli ultimi 7 giorni e la tua media settimanale delle ultime 4 (*acute:chronic workload ratio*). Fascia consigliata **0.8–1.3** (verde); sopra 1.3 arancio, sopra 1.5 rosso = picco di carico e massimo rischio; sotto 0.8 = carico in calo. Mostra anche l'incremento % rispetto alla settimana scorsa (limite prudente +10%). Serve a non salire troppo in fretta.
- **VDOT stimato**: il tuo livello secondo le tabelle di Jack Daniels, calcolato dal miglior sforzo degli ultimi 90 giorni. La freccia confronta col trimestre precedente. È il numero che guida tutti i ritmi dell'app.
- **km ultimi 7/28 giorni** con confronto sul periodo precedente.
- **Tempi previsti in gara** (5k → maratona) al VDOT attuale.
- **Passi d'allenamento**: le 5 zone con i tuoi ritmi al km:

| Zona | Uso |
|---|---|
| E (Easy) | recupero, lunghi, volume |
| M (Maratona) | ritmo gara 42k, finali dei lunghi |
| T (Soglia) | medio-soglia, cruise interval |
| I (Interval) | ripetute 2-5 minuti |
| R (Reps) | ripetute brevi 200-400m |

- **Ultime corse** con classificazione automatica.

## 3. Tab "Progressi" — i miglioramenti

- **Periodo**: pills 3/6/12 mesi o date libere. Tutto il tab si ricalcola sul periodo scelto.
- **Bilancio del periodo**: confronta le prime ~4 settimane con le ultime ~4 su sei metriche (VDOT, passo easy, efficienza, volume, cadenza, contatto suolo) e dà un giudizio complessivo, dal "netto miglioramento" al "periodo interlocutorio".
- **Ultima corsa vs precedente simile**: confronto con delta su 8 metriche. Cerca prima la stessa seduta specifica (una 8x200 con l'ultima 8x200), poi stessa tipologia e distanza simile, poi stessa tipologia. Il criterio usato è dichiarato.
- **Analisi sedute (lap)**: per le corse importate da .fit — passo e FC di ogni ripetuta, costanza (scarto in secondi tra la più veloce e la più lenta), split di gara, VDOT gara.
- **Grafici**: VDOT nel tempo, volume settimanale, passo delle corse facili, efficienza aerobica (metri per battito: più alto = stessa velocità con meno sforzo), dinamiche di corsa a scelta (cadenza, lunghezza passo, rapporto verticale, oscillazione, contatto suolo).
- **Record personali** su 5k, 10k e mezza.

## 3b. Tab "Analisi" — la lente su una singola corsa

Scegli qualsiasi corsa dall'archivio (menu in alto) e ottieni:

- **Dati principali**: km, tempo, passo, FC media con zona, FC max, dislivello.
- **Confronto con tutte le tue corse dello stesso tipo**: passo, FC, efficienza, cadenza, lunghezza passo, contatto suolo, oscillazione — con delta colorati rispetto alla tua media.
- **Lap completi** (se la corsa viene da un .fit): tabella con passo e FC di ogni frazione.
- **Giudizio testuale**: posizionamento storico ("più veloce di X delle tue Y simili"), intensità corretta o no per la tipologia (per le sedute veloci guarda i picchi FC, non la media), efficienza vs il tuo standard, costanza delle frazioni, deriva cardiaca, e per le gare il VDOT con le proiezioni.

## 3c. Tab "Fitness" — la forma letta dalla frequenza cardiaca

Funziona sulle corse importate da **.fit** o da **archivio .zip** (vedi §5): da ognuna l'app conserva la FC secondo per secondo, ripulita da picchi e dall'aggancio alla cadenza nei recuperi. Le corse arrivate dal CSV hanno solo le medie e qui non contano.

- **Zone attuali**: 5 fasce di FC — Recupero (Z1), Steady (Z2), LT1 (Z3), LT2 (Z4), Alta intensità (Z5). Sono **stimate** dalla tua gara più recente con FC (la FC media di uno sforzo di 35–75' sta appena sopra il tetto di LT2; un 5k 4-5 bpm più su, una mezza 3 bpm più giù), oppure **confermate** se le inserisci nel tab Dati. Accanto: il passo che tieni davvero in ogni fascia e il passo Daniels equivalente. Le stesse zone valgono in tutta l'app (analisi seduta, piano).
- **Minuti a settimana per zona** (1/4/8 settimane) e **minuti di soglia** LT1/LT2 settimana per settimana.
- **Indice aerobico**: stima del VDOT dalla velocità tenuta a parità di FC in 4 fasce di 8 bpm sotto il tetto di LT2 (finestra 28 giorni). Si confronta col VDOT da gara: se coincidono la forma è coerente; la tabella dice quale fascia ha mosso l'indice nell'ultima settimana.
- **Passo a ogni FC**: curva passo-FC per bande di 5 bpm (solo dove almeno 3 corse la sostengono), ultimi 40 giorni contro la miglior finestra degli ultimi 18 mesi.
- **Dove passi il tempo**: tratti continui ≥5/10/15' nella stessa banda di 5 bpm.
- **Quanto costa ogni passo**: per fascia di 20", minuti a settimana e FC media.
- **Passo accumulato**: i minuti più veloci della settimana sommati fra tutte le corse, su 3/5/10 km.
- **Migliori tratti** dentro le corse (1 km → mezza), ultime 4 settimane e storico.
- **Piramide** degli ultimi 56 giorni (un mattone = 60' Recupero, 45' Steady, 30' LT1, 25' LT2, 15' Alta).
- **Capacità e lacune**: settimana più alta, miglior blocco di 8 settimane, livello ripetibile, ripartenza sicura e tetto di crescita; da quanti giorni non fai un lungo, un lavoro a LT2, un'alta intensità, una gara 5–10 km; **divario di resistenza** (VDOT gara breve contro gara lunga); deriva cardiaca nei lunghi facili.
- **Gare riconosciute**: le corse che sembrano gare (titolo, distanza standard, sforzo vicino al tuo massimo). ✓ conferma, ✕ scarta: le scartate non contano più per il VDOT, le confermate ancorano le zone.
- **Qualità del segnale**: corse con FC poco affidabile, escluse dalle analisi FC (puoi riammetterle).

## 4. Tab "Piano" — generare e seguire il piano

**Generare**: scegli gara, data, corse/settimana. VDOT e volume di partenza si compilano da soli dai tuoi dati (modificabili). Da 6 a 52 settimane.

**Il piano non compare all'apertura**: all'avvio il tab resta pulito. Se hai già un piano salvato vedi una riga con obiettivo/data/VDOT e il pulsante **Mostra ultimo piano**; il piano si mostra solo quando lo apri o quando premi Genera. Resta comunque in memoria (serve alla progressione e alla ricalibrazione).

**Date sulle sedute**: ogni seduta mostra il giorno della settimana e la data reale (giorno + mese), calcolata ancorando l'ultima settimana alla domenica di gara — le stesse date che finiscono nel .ics e nel calendario.

**Come è costruito il piano**:
- *Periodizzazione*: base (endurance) → velocità (VO2max, lo stile del tuo "blocco qualità") → specifico (ritmo gara) → taper. Le durate si adattano alle settimane disponibili.
- *Obiettivo in range*, mai un numero secco: es. 3:22–3:27. Dove cadi dentro dipende da meteo, percorso e giornata.
- *Ritmi espliciti con tolleranza ±3s* già inclusa nei range, e km stimati per seduta.
- *Alternanza*: la qualità del giovedì si alterna con corsa base; nelle settimane col lungo qualificato il giovedì è sempre base. Mai più di 2 sedute impegnative a settimana.
- *Lungo qualificato* (fase specifica): una parte del lungo si corre a ritmo gara — ritmo maratona per la maratona, **ritmo mezza** per la mezza. Non tutti i lunghi sono qualificati: **maratona**, il primo della fase è facile e poi ne rientra uno facile ogni tre; **mezza**, a lunghi alterni. Il lungo facile non è un riempitivo — è il mattone aerobico (volume, tolleranza meccanica, capacità di reggere il ritmo sotto fatica) e serve anche a permettersi il costo di quelli specifici. Il picco è sempre qualificato.
- *Strutture del lungo*, in progressione lungo il blocco specifico. La quota di lavoro a ritmo gara è la stessa: cambia come è distribuita, con richiesta via via maggiore.
  - **Lungo progressivo** — easy → steady → ritmo gara, senza pause. Impara ad alzare l'intensità sulla fatica.
  - **Lungo a blocchi RM** — 2-3 blocchi a ritmo gara intervallati da 8-10' easy. Stessi km specifici ma più sostenibili, e ogni ripartenza dopo l'easy è lo stimolo.
  - **Lungo fast finish** — blocco unico in coda: correre a ritmo gara con la fatica già accumulata.
  - **Lungo a ritmo gara continuo** — blocco unico centrale, chiusura easy. Specificità e stabilità del ritmo.
  - **Lungo sopra/sotto RM** — alternanze poco sopra e poco sotto il ritmo gara, senza recupero vero: controllo metabolico e recupero in corsa.
  - **Big workout** (picco, ultimo lungo prima del taper) — la prova generale: massima quota specifica in blocco unico, e l'occasione per testare gel, liquidi, scarpe e pacing. Sulla mezza si chiama *Simulazione gara*.
- *Carico dichiarato*: ogni seduta porta un'etichetta — base, intermedio, alto, molto alto — accanto ai km. Serve a leggere quanto costa una settimana, non solo quanto è lunga: due settimane da 70 km possono pesare in modo molto diverso.
- *Scarico* ogni 4ª settimana (mai l'ultima prima del taper).
- *Estate (giu-ago)* ☀️: volume -15%, sedute base max 90', la fase base diventa lavori di velocità (200/300/400 @ R). Lunghi presto al mattino.
- *Colori per fase*: verde = base, rosso = velocità, blu = specifico, arancio = taper, grigio = scarico.

**FC accanto ai passi**: ogni seduta mostra anche la fascia di FC della zona (T → LT2, M → LT1, I → Alta intensità, Z2 → Steady).

**Dose di intensità per settimana**: minuti di lavoro LT1/LT2/alta intensità previsti dalle sedute, e per le settimane passate i minuti registrati con la FC in LT1+LT2.

**Obiettivo: cosa serve**: VDOT e passi che il tempo obiettivo richiede contro quelli attuali (puoi scrivere un tempo diverso da quello del piano), cosa chiede quella gara (quota di lavoro per tipo), le sedute prova con la finestra di settimane in cui farle e gli errori da evitare.

**Quando ricalibrare il piano** (sotto il piano): un box dà un verdetto — 🟢 prosegui / 🟠 valuta / 🔴 ricalibra ora — in base a segnali concreti: aderenza km recente sotto 85%/75%, VDOT salito ≥1.5 punti (ritmi ormai troppo morbidi) o sceso ≥1.5 (troppo duri), sedute di qualità saltate, passaggio a una nuova fase, o troppe settimane senza ritocchi. Il VDOT di riferimento è quello dell'ultima ricalibrazione. Sotto, i due bottoni per agire:

**Rigenera il piano dal reale (.fit)**: aggiorna il piano *dov'è*. Tiene gara, data, distanza e giorni/settimana; il calendario non si muove — stesse settimane, stesse fasi, stessi scarichi, stesse gare intermedie — e vengono riscritti solo i contenuti: passi ricalcolati sul VDOT attuale, tipologie di seduta scelte di nuovo dal generatore, lunghi della fase specifica con le strutture aggiornate. Le settimane già concluse restano intatte e viene scaricato il **nuovo `.ics`**. Se alla gara mancano meno di 6 settimane si blocca.

**Ricalibra i passi delle sedute** (dalla v130): cambia **solo i passi** scritti nelle sedute non ancora svolte. Fasi, settimane, tipologie, durate, km e gare restano identici. La forma si misura con **tre numeri**, non con il solo VDOT da gara:
- **velocità** (passi I e R) → il miglior VDOT da gara degli ultimi 90 giorni;
- **soglia e ritmo maratona** (passi T e M) → il passo tenuto con la FC in LT2 nelle ultime 3 settimane (≥20' in ≥2 corse; altrimenti dalla curva passo-FC);
- **facile** (passi E, recuperi, lunghi) → il passo tenuto nei 5 bpm più alti della Z2: diventa il limite veloce del range E.

Ogni passo del testo viene riconosciuto come facile, soglia/maratona o velocità (un range "a–b" sempre tutto intero) e riportato alla stessa intensità col VDOT nuovo della sua classe. La progressione verso il target riparte dai valori misurati nella settimana in corso e sale dello stesso guadagno che il piano prevedeva ancora da qui. Seguono la ricalibrazione anche le sedute cambiate a mano (Flex) delle settimane non finite. I tre valori compaiono nel titolo del piano ("VDOT 47.1 → 51.9 · soglia 46.3 · facile 44.3") e il box "Quando ricalibrare" avvisa se soglia o facile misurati con la FC si spostano di ≥1 punto. *Perché:* con la velocità avanti e la parte aerobica indietro, un solo VDOT da gara prescriveva facili e ritmo maratona troppo veloci (il 06/11/2026 il ritmo M a 4:31–4:37 corrispondeva alla FC di LT2).

*Correzione collegata (v130):* Flex, "gara al volo" e strategia di gara calcolavano il VDOT della settimana contando anche le settimane storiche: con 16 settimane passate davano passi di circa 3 VDOT troppo veloci (T 4:11–4:17 invece di 4:28). Ora usano la stessa rampa del piano.

**Esportare**:
- *Copia piano (markdown)*: per incollarlo dove vuoi.
- *Esporta per Google Calendar (.ics)*: un evento per seduta col giorno giusto (gara inclusa, anche se di sabato). Nella descrizione: fase, riscaldamento e defaticamento per le sedute di qualità, lavoro coi ritmi, km totali. Su Google Calendar: Impostazioni → Importa. Consiglio: crea prima un calendario dedicato "Corsa", così quando ricalibri cancelli quello e reimporti pulito. Dopo una ricalibrazione il .ics contiene solo le settimane future.

## 4b. Pannello "Aderenza" — come stai seguendo il piano

Solo statistiche: confronta il piano con le tue corse. Le decisioni (ricalibrare, rigenerare) stanno nel pannello **Settimane**, sotto il piano. Il calendario su cui si misura ha **una sola fonte per ogni periodo**:
- **dalla settimana in corso in avanti** è il piano, sempre aggiornato (scarichi, gare al volo, sedute spostate o tolte, ricalibrazioni);
- **le settimane concluse** sono lo **storico**: quello che era previsto davvero in quella settimana (gare al volo, settimane riscritte sulle corse svolte), congelato quando la settimana finisce. Il piano da solo non basta, perché alle settimane già passate non riapplica le modifiche fatte a mano. Lo storico viaggia nel cloud con il resto (`rp_monitor`).

Le corse sono agganciate **in automatico**: tutte quelle dell'archivio che cadono nelle settimane del piano. L'abbinamento è **settimanale**: ogni seduta pianificata viene agganciata alla corsa migliore di quella settimana (preferendo tipo e giorno giusti), così se sposti un allenamento di un giorno non risulta saltato.

**Aderenza al piano** (anelli): % di km pianificati fatti, settimane a target, sedute svolte, sulle settimane **concluse**; la settimana in corso ha una riga a parte.

**Andamento**: grafico a barre dell'aderenza % delle settimane concluse e grafico dello scostamento km cumulato dal piano (sopra zero = più km del previsto, sotto = meno).

**Settimana per settimana**: km fatti/pianificati, corse completate, qualità e lungo spuntati. Verdetti: ✅ a target (≥85% km + qualità + lungo), 🟡 parziale, 🔴 saltata, ⏳ in corso.

**Passi: target vs reale** e **Distribuzione dell'intensità**: quanto i passi corsi stanno nei range del piano e come si distribuisce il tempo fra le intensità.

**Seduta per seduta**: per ogni allenamento — ✅ svolto / 🔁 tipo diverso / 🔴 saltata / ⏳ in programma, km reali vs previsti e, per easy/lungo, passo reale vs range target ("in target / più veloce / più lento"). Per le ripetute il passo medio è indicativo (rimanda ai lap in Analisi). Segnala anche le corse extra fuori piano.

## 5. Tab "Dati" — importare le corse

- **Import .FIT** (consigliato): aggiunge corsa, dinamiche di corsa e lap. Più file insieme.
- **Import archivio .zip** (consigliato per lo storico): l'export completo di Garmin («Esporta i tuoi dati» dalla gestione account) o l'archivio di Strava, caricato così com'è senza estrarlo. Le corse già presenti vengono completate con FC secondo per secondo, lap e traccia; quelle mancanti aggiunte. Meglio dal computer.
- **Import CSV** (export "Attività" di Garmin Connect): per caricare tanti riepiloghi in blocco, senza lap.
- I duplicati vengono sempre scartati: reimportare non fa danni.
- **Parametri**: FC max e riposo. Sotto, le **zone FC** in uso: stimate dall'app o, se le inserisci e salvi, **confermate** (per esempio quelle di un coach o di un test).

**Come nominare i .fit** (il nome file diventa il titolo, e il titolo decide la classificazione):

| Nel nome | Classificata come | Esempio |
|---|---|---|
| `gara` | Gara | `Gara Otranto 10k.fit` |
| `soglia` `medio` `progressivo` `fartlek` `cruise` | Qualità | `medio-soglia 25.fit` |
| pattern `NxM` o `ripetute` | Interval | `8x200.fit` |
| `lungo` | Lungo | `lungo 100.fit` |
| niente | Easy | `giro mattina.fit` |

La parola chiave vince sul pattern (`fartlek 8x1.fit` → Qualità). Il pattern `NxM` definisce anche il sottotipo: una `8x200` verrà confrontata con l'ultima 8x200, non con una 10x400.

## 6. Flusso settimanale (semi-automatico, ~2 minuti)

1. Su connect.garmin.com: attività della settimana → ⚙ → **Esporta file originale** (zip → estrai il .fit)
2. Rinomina i file col tipo di seduta (tabella sopra)
3. Mettili nella cartella `fit/`
4. Terminale: `cd ~/Documents/allenamenti/running-app && python3 sync_garmin.py --rebuild`
5. L'app sul Mac è aggiornata. Per l'iPhone: ritrascina la cartella su Netlify Drop

In alternativa, senza Mac: trascina i .fit nel tab Dati direttamente dall'iPhone (stesso risultato; il rebuild serve solo a "cuocere" i dati dentro data.js, utile per averli anche dopo un cambio di telefono o browser).

Dipendenza una tantum: `pip3 install fitdecode`.

> Il download automatico da Garmin (login da script) è bloccato da Garmin stessa da marzo 2026 per tutto l'ecosistema. Se la situazione cambia, `sync_garmin.py` è già pronto a riattivarlo.

## 7. Aggiornamenti tramite Claude (sessione Cowork)

Collegando la cartella `allenamenti` in una sessione Cowork puoi chiedere di:
- **Sincronizzare il piano su Google Calendar**: trascina il .ics in chat → gli eventi vengono creati col tag `[RunPlan]`; agli aggiornamenti i futuri vengono sostituiti, il resto del calendario non si tocca (istruzioni operative nel README).
- **Scaricare le corse via browser** (serve l'estensione Claude in Chrome): Claude naviga connect.garmin.com nella tua sessione già loggata, scarica i .fit e fa il rebuild.
- Modificare l'app, aggiungere metriche, cambiare la logica del piano.

## 8. Risoluzione problemi

- **L'app non mostra le corse nuove**: se importate col rebuild sul Mac, ricarica la pagina (su iPhone: riapri l'app; se non basta, il service worker si aggiorna entro qualche secondo). Su Netlify serve il redeploy.
- **Una corsa è classificata male**: il titolo non contiene la parola chiave giusta. Rinomina il .fit e reimportalo (il duplicato con titolo vecchio resta: usa "Ripristina dati iniziali" + rebuild per pulizia totale).
- **"Ripristina dati iniziali"** (tab Dati): torna al contenuto di data.js, scartando gli import manuali fatti nel browser.
- **VDOT sembra basso**: la stima usa il miglior sforzo recente. Se da 90 giorni non fai gare o sedute tirate, si abbassa. Una gara lo ritara subito.
- **Il piano chiede almeno 6 settimane**: è voluto — sotto le 6 settimane non c'è tempo per un blocco sensato.

## 9. I file della cartella

| File | Cosa è |
|---|---|
| `index.html` | l'app (tutto incluso) |
| `data.js` | il database: corse + lap |
| `sync_garmin.py` | rigenera data.js dai .fit in `fit/` |
| `fit/` | i tuoi file .fit |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | PWA: installazione e offline |
| `README.md` | note tecniche e istruzioni per Claude |
| `GUIDA.md` | questa guida |

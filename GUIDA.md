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

## 2. Tab "Oggi" — cosa fare oggi e lo stato di forma

- **Seduta del giorno**: la seduta di oggi presa dal piano che segui (prima il Monitor/.ics, poi il piano generato), coi ritmi già pronti e — per le sedute di qualità — riscaldamento e defaticamento. Se oggi è riposo mostra la **prossima** seduta ("Domani"/"Tra X giorni") e sotto il riepilogo della settimana con ✓ su quelle già fatte. Se non hai un piano attivo, la card lo spiega.
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

## 4. Tab "Piano" — generare e seguire il piano

**Generare**: scegli gara, data, corse/settimana. VDOT e volume di partenza si compilano da soli dai tuoi dati (modificabili). Da 6 a 52 settimane.

**Il piano non compare all'apertura**: all'avvio il tab resta pulito. Se hai già un piano salvato vedi una riga con obiettivo/data/VDOT e il pulsante **Mostra ultimo piano**; il piano si mostra solo quando lo apri o quando premi Genera. Resta comunque in memoria (serve alla progressione e alla ricalibrazione).

**Date sulle sedute**: ogni seduta mostra il giorno della settimana e la data reale (giorno + mese), calcolata ancorando l'ultima settimana alla domenica di gara — le stesse date che finiscono nel .ics e nel calendario.

**Come è costruito il piano**:
- *Periodizzazione*: base (endurance) → velocità (VO2max, lo stile del tuo "blocco qualità") → specifico (ritmo gara) → taper. Le durate si adattano alle settimane disponibili.
- *Obiettivo in range*, mai un numero secco: es. 3:22–3:27. Dove cadi dentro dipende da meteo, percorso e giornata.
- *Ritmi espliciti con tolleranza ±3s* già inclusa nei range, e km stimati per seduta.
- *Alternanza*: la qualità del giovedì si alterna con corsa base; nelle settimane col finale @ M nel lungo, il giovedì è sempre base. Mai più di 2 sedute impegnative a settimana.
- *Scarico* ogni 4ª settimana (mai l'ultima prima del taper).
- *Estate (giu-ago)* ☀️: volume -15%, sedute base max 90', la fase base diventa lavori di velocità (200/300/400 @ R). Lunghi presto al mattino.
- *Colori per fase*: verde = base, rosso = velocità, blu = specifico, arancio = taper, grigio = scarico.

**Progressione vs piano**: settimana per settimana, km fatti/pianificati, corse completate, qualità e lungo spuntati. Verdetti: ✅ a target (≥85% km + qualità + lungo), 🟡 parziale, 🔴 saltata, ⏳ in corso. In testa: aderenza complessiva.

**Ricalibra il piano dai dati reali**: rigenera le settimane future col VDOT attuale e il volume che stai davvero reggendo. Le settimane passate restano in archivio (attenuate, "passata") per il confronto. Da usare a ogni cambio di fase o quando l'aderenza cala.

**Esportare**:
- *Copia piano (markdown)*: per incollarlo dove vuoi.
- *Esporta per Google Calendar (.ics)*: un evento per seduta col giorno giusto (gara inclusa, anche se di sabato). Nella descrizione: fase, riscaldamento e defaticamento per le sedute di qualità, lavoro coi ritmi, km totali. Su Google Calendar: Impostazioni → Importa. Consiglio: crea prima un calendario dedicato "Corsa", così quando ricalibri cancelli quello e reimporti pulito. Dopo una ricalibrazione il .ics contiene solo le settimane future.

## 4b. Tab "Monitor" — seguire un piano dal calendario

Serve a monitorare il piano che stai **davvero seguendo**, caricando l'`.ics` esportato dal tab Piano e confrontandolo con le tue corse, seduta per seduta. È indipendente dal piano generato al volo: carichi l'`.ics` una volta e resta lì finché non lo cambi.

**Caricare il piano**: trascina/scegli l'`.ics` (bottone "Esporta .ics" del tab Piano). L'app legge ogni seduta: data, tipo, km previsti, ritmi target e fase.

**Quali corse considera**:
- di default aggancia **in automatico** tutte le corse dell'archivio che cadono nelle settimane del piano;
- oppure scegli manualmente dal menù a tendina le corse **già importate** (nessun nuovo caricamento): in quel caso il Monitor considera **solo quelle**. Le corse scelte compaiono come chip, con la ✕ per toglierle.

L'abbinamento è **settimanale**: ogni seduta pianificata viene agganciata alla corsa migliore di quella settimana (preferendo tipo e giorno giusti), così se sposti un allenamento di un giorno non risulta saltato.

**Aderenza al piano** (con barre di stato): % di km pianificati fatti, settimane a target, sedute svolte. Considera anche la **settimana in corso** (parziale), segnalandolo. Le barre diventano verde/arancio/rosso sopra 85% / 60% / sotto.

**Andamento**: grafico a barre dell'aderenza % delle settimane concluse e grafico dello scostamento km cumulato dal piano (sopra zero = più km del previsto, sotto = meno).

**Settimana per settimana** e **Seduta per seduta**: per ogni allenamento — ✅ svolto / 🔁 tipo diverso / 🔴 saltata / ⏳ in programma, km reali vs previsti e, per easy/lungo, passo reale vs range target ("in target / più veloce / più lento"). Per le ripetute il passo medio è indicativo (rimanda ai lap in Analisi). Segnala anche le corse extra fuori piano. Ogni settimana ha la data (giorno + mese) e una barra di volume.

**Quando ricalibrare**: un box dà un verdetto — 🟢 prosegui / 🟠 valuta / 🔴 ricalibra ora — in base a segnali concreti: aderenza km recente sotto 85%/75%, VDOT salito ≥1.5 punti (ritmi ormai troppo morbidi) o sceso ≥1.5 (troppo duri), sedute di qualità saltate, passaggio a una nuova fase, o troppe settimane senza ritocchi. Il VDOT di riferimento è quello del momento in cui hai caricato l'`.ics`.

**Rigenera il piano dal reale (.ics + .fit)**: un pulsante che ricalibra usando l'`.ics` che segui + le tue corse .fit. Prende gara, data e distanza dall'`.ics`, stima i giorni/settimana dalla struttura, e usa VDOT e volume **reali** dai tuoi dati per rigenerare le settimane **da oggi alla gara**. Le settimane passate restano (rinumerate in modo pulito), il Monitor si aggiorna subito e viene scaricato il **nuovo `.ics`** da importare nel calendario. Se alla gara mancano meno di 6 settimane si blocca (troppo poche per un blocco sensato).

## 5. Tab "Dati" — importare le corse

- **Import .FIT** (consigliato): aggiunge corsa, dinamiche di corsa e lap. Più file insieme.
- **Import CSV** (export "Attività" di Garmin Connect): per caricare tanti riepiloghi in blocco, senza lap.
- I duplicati vengono sempre scartati: reimportare non fa danni.
- **Parametri**: FC max e riposo per le zone Karvonen.

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

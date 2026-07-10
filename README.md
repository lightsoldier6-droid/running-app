# RunPlan — la tua app di allenamento

App web (PWA) tarata sui tuoi dati: 148 corse precaricate (apr 2025 → lug 2026) e i tuoi ritmi.

## Cosa fa

- **Oggi**: la **seduta del giorno** presa dal piano che segui (coi ritmi pronti) e il resto della settimana; il **carico e rischio infortuni** (rapporto acuto/cronico dei km); VDOT stimato, km settimanali/mensili con trend, tempi previsti in gara, passi d'allenamento (E/M/T/I/R)
- **Progressi**: analisi sedute dai .FIT (passo/FC di ogni ripetuta, costanza, split di gara), VDOT nel tempo, volume settimanale, passo delle corse facili, efficienza aerobica (m/battito), record personali
- **Piano**: scegli gara, data e corse/settimana → genera un piano completo con ritmi personalizzati, scarico e taper. I **ritmi delle sedute progrediscono** lungo il blocco: partono dal VDOT attuale e salgono linearmente fino al VDOT previsto in gara, così le settimane finali mostrano il passo-obiettivo (tutti i ritmi, non solo la qualità). "Rigenera dal reale" ricalibra la rampa su/giù dai tuoi .fit. La fase velocità (VO2max) usa un **blocco a diamante** (stile piano_10_settimane): gli interval del martedì scendono in durata fino al picco (20×1') con passi via via più veloci, poi — quando le settimane bastano — c'è uno scarico agganciato al picco e una risalita speculare con passi più spinti (2-3" più veloci a parità di durata). Se la fase è corta, il diamante si adatta facendo solo la discesa fino al picco. Fuori dalla fase velocità lo scarico resta ogni 4 settimane. Tra due sedute dure c'è sempre una corsa lenta (Z2/base) per non stressare le gambe; d'estate due sedute veloci corte e intense separate da Z2 (es. martedì interval, giovedì Z2, weekend qualità), niente lungo lento. Ogni seduta ha la data (giorno + mese). Il piano non compare all'apertura: si mostra con "Mostra ultimo piano" o rigenerando
- **Monitor**: carichi l'`.ics` del piano che segui e lo confronti con le tue corse, seduta per seduta — svolto/saltato, km e passo vs previsti, aderenza settimanale con barre di stato, andamento nel tempo. Scegli le corse dal menù (fra quelle già importate) o lascia l'aggancio automatico. Un box consiglia **quando ricalibrare**; il pulsante "Rigenera dal reale" ricalibra usando gara/data dall'`.ics` e VDOT/volume reali dai .fit, conserva le settimane passate e scarica il nuovo `.ics`
- **Dati**: importa i nuovi export Garmin (CSV Attività) o i .FIT — i duplicati vengono scartati. Tutto resta sul tuo telefono (localStorage).

## Come metterla sull'iPhone

Serve un URL https (requisito iOS per le PWA). Due opzioni gratuite:

**Netlify Drop (più veloce, 2 minuti)**
1. Vai su https://app.netlify.com/drop
2. Trascina la cartella `running-app`
3. Apri l'URL generato da Safari sull'iPhone
4. Condividi → **Aggiungi a Home** → icona e schermo intero come un'app

**GitHub Pages**
1. Crea un repo, carica i file di `running-app`
2. Settings → Pages → deploy dal branch main
3. Stesso passaggio "Aggiungi a Home" da Safari

Per provarla subito sul Mac: doppio click su `index.html`.

## Sincronizzazione Google Calendar (automatica)

Il piano si sincronizza da solo sul Google Calendar principale, ogni lunedì mattina.

1. Nel tab **Piano** esporta l'`.ics` ("Esporta .ics") e salvalo nella cartella `allenamenti` come `piano-allenamento.ics` (imposta il percorso di download la prima volta, poi si sovrascrive).
2. Un'attività pianificata legge quel file e allinea il calendario tramite `calendar-sync.mjs`: crea le sedute nuove, aggiorna quelle cambiate, rimuove quelle non più previste. Lo storico passato non viene toccato.
3. È idempotente (mappa UID→eventId in `.calendar-sync.json`): rilanciarla senza modifiche non fa nulla e non crea doppioni.

Gli eventi sono su tutto il giorno, con promemoria il giorno prima. L'export dell'app produce già un `.ics` incrementale (UID ancorato alla data, eventi di cancellazione, `SEQUENCE`), quindi è importabile in modo pulito anche a mano in Google Calendar.

## Aggiornare i dati

Due modi, dal tab **Dati**:

- **CSV**: Garmin Connect → Attività → Esporta CSV → Importa (solo riepiloghi)
- **.FIT** (consigliato per qualità e gare): Garmin Connect → attività → ⚙ → Esporta file originale → Importa. Aggiunge la corsa *e* i lap: l'analisi per ripetuta compare in Progressi.

### Come nominare i file .FIT (il nome file diventa il titolo)

L'app classifica dalla parola chiave nel nome, in quest'ordine di priorità:

| Nel nome | Classificata come | Esempi |
|---|---|---|
| `gara` | Gara | `Gara Otranto 10k.fit` |
| `soglia`, `medio`, `progressivo`, `fartlek`, `cruise` | Qualità | `medio-soglia 25.fit`, `fartlek 8x1.fit` |
| `NxM` (es. 8x200), `ripetute` | Interval | `8x200.fit`, `10x400.fit` |
| `lungo` | Lungo | `lungo 100.fit` (auto anche se ≥15 km o ≥75') |
| nessuna parola chiave | Easy | `giro mattina.fit` |

Il pattern `NxM` definisce anche il sottotipo per il confronto "ultima vs simile": una `8x200` viene confrontata con l'ultima seduta di 200, non con una 10x400. La parola chiave vince sul pattern: `fartlek 8x1.fit` è Qualità, non Interval.

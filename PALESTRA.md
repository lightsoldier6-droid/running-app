# RunPlan + Palestra (Passo)

Un’unica PWA con sezioni separate per corsa e palestra. Il ramo aggiunge il registro palestra alla navigazione esistente e mantiene il modulo indipendente in `palestra/`.

## Cosa è condiviso

- Il monitor palestra legge le corse già presenti in RunPlan, senza copiarle nel proprio archivio. Il pulsante Registra corsa apre il diario originale.
- Le sedute di forza completate entrano nei riepiloghi, calendario e calcoli del carico esistenti mediante `allXts()`. Hanno identità stabili: aprire o aggiornare la pagina non crea copie.
- Il tema chiaro/scuro segue RunPlan. La PWA e il service worker restano quelli principali; nessun secondo account o seconda installazione.
- Le corse senza RPE vengono contate nei chilometri ma escluse dal carico minuti × RPE. Non viene inventato uno sforzo percepito. La scala UA della palestra e la scala TRIMP di RunPlan restano esplicitamente distinte.

## Cosa resta locale

Schede, serie, pesi, alternative, cronologia e seduta in corso restano in `passo-v1` sul dispositivo. Non sono inseriti nel documento Firebase, né copiati in `rp_xt`. I riepiloghi sono derivati in lettura dalla cronologia palestra, così non rimangono attività orfane dopo un’eliminazione o un’importazione del backup. I precedenti dati corsa e il loro collegamento Firebase non vengono migrati o modificati.

Un eventuale .FIT palestra già importato è una voce separata: non si deducono automaticamente collegamenti sulla sola somiglianza di data e durata. Se rappresenta la stessa seduta registrata in Passo, rimuovere la voce duplicata importata dal diario Altri sport. L’integrazione non confronta biometrici per riconciliare sessioni.

Supabase non è configurato in questo ramo: è una possibile successiva migrazione con accesso utente, tabelle e regole per utente, da concordare prima di spostare i dati.

## Allenamento

Due schede A/B, ciascuna con 8 esercizi e 3 esercizi gambe. Serie, ripetizioni, recuperi e almeno due alternative iniziali per esercizio. Le schede sono ricostruite dagli esercizi delle immagini della chat: le risposte originali erano riferimenti senza testo accessibile. L’app dichiara questa limitazione.

Il registro permette di spuntare serie, confrontare il precedente per variante, aggiungere/rimuovere/riordinare esercizi e serie, cambiare recupero, sostituire con alternative o esercizi personalizzati. Se sostituisci dopo aver già completato serie, queste restano sull’esercizio originale e quelle ancora da fare passano alla variante con pesi separati.

Il cronometro seduta e i recuperi usano orari assoluti, salvati con la bozza. Alla conclusione si registrano solo le serie spuntate, con RPE e note. Il monitor mostra tempo dall’ultima seduta, carico settimanale e storico carichi per variante.

## Backup e iPhone

Le impostazioni palestra consentono di esportare/importare un backup JSON validato. Il backup riguarda il modulo palestra, non i dati corsa. Cancellare i dati del sito cancella il registro locale. Safari e la PWA possono usare archivi distinti: installare e poi usare sempre lo stesso contesto, trasferendo il backup quando necessario.

Aprire RunPlan in Safari → Condividi → Aggiungi alla schermata Home. Il service worker principale include anche gli asset palestra. È necessario un primo caricamento online completo. Le librerie Firebase sono aggiunte alla cache se il relativo CDN è disponibile; login e sincronizzazione richiedono comunque rete. Il suono del timer a schermo bloccato non è garantito da iOS. Non è un monitor GPS, battito o Apple Watch.

## Verifiche

Da questa cartella: `node tests/palestra.cjs`. Include flusso serie, timer, sostituzioni con serie conservate, persistenza, cronologia, alternative, backup e collegamento locale con RunPlan. Controllo sintassi degli script originali modificati e dei nuovi script. Prove browser su registrazione, cambio esercizio, ricaricamento, salvataggio, monitor e apertura offline del modulo. La prova di integrazione usa dati sintetici, senza effettuare l’accesso all’account Firebase dell’utente. Installazione su iPhone fisico non verificata.

La versione live attuale non viene modificata da questo ramo. Per aggiornare la PWA servono revisione e merge della pull request, seguiti dalla distribuzione GitHub Pages configurata nel repository.

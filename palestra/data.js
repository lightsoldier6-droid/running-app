'use strict';
/* Programma di forza per un runner: due sedute Total Body (A e B) a settimana, in blocchi di 4 settimane
   (3 di carico progressivo + 1 di scarico). Ogni blocco cambia esercizi e schema di ripetizioni; dopo il
   terzo si ricomincia dal primo con i carichi raggiunti. Gli id delle varianti sono stabili: lo storico
   di un esercizio resta suo anche quando torna in un blocco successivo. */

// Libreria esercizi. loadType: weight = kg | body = corpo libero (si progredisce con le ripetizioni)
// | assistance = kg di assistenza (si progredisce togliendo assistenza). side: ripetizioni per lato.
const X = (id, name, gear, loadType = 'weight', side = false) => ({ id, name, gear, loadType, side });
const EXERCISES = Object.fromEntries(
  [
    // squat e varianti
    X('goblet', 'Goblet squat', 'Manubrio'),
    X('legpress', 'Leg press', 'Macchina'),
    X('smith-squat', 'Squat al multipower', 'Macchina'),
    X('squat-bb', 'Back squat', 'Bilanciere'),
    // una gamba
    X('split', 'Split squat', 'Manubri', 'weight', true),
    X('bulgarian', 'Squat bulgaro', 'Manubri', 'weight', true),
    X('step-up', 'Step-up', 'Manubri', 'weight', true),
    X('reverse-lunge', 'Affondi indietro', 'Manubri', 'weight', true),
    // stacchi e femorali
    X('rdl-db', 'Stacco rumeno con manubri', 'Manubri'),
    X('rdl-bb', 'Stacco rumeno con bilanciere', 'Bilanciere'),
    X('trapbar', 'Stacco con trap bar', 'Bilanciere'),
    X('sl-rdl', 'Stacco rumeno a una gamba', 'Manubrio', 'weight', true),
    X('legcurl', 'Leg curl', 'Macchina'),
    X('nordic', 'Nordic curl assistito', 'Appoggio sicuro', 'body'),
    // anca
    X('hip-machine', 'Hip thrust alla macchina', 'Macchina'),
    X('hip-bb', 'Hip thrust con bilanciere', 'Bilanciere'),
    X('bridge-db', 'Glute bridge con manubrio', 'Manubrio'),
    // polpacci
    X('calf-stand', 'Calf raise in piedi', 'Macchina'),
    X('calf-single', 'Calf raise a una gamba', 'Manubrio', 'weight', true),
    X('calf-press', 'Calf raise alla pressa', 'Macchina'),
    X('calf-seated', 'Calf raise da seduto', 'Macchina'),
    // spinta
    X('incline-db', 'Panca inclinata con manubri', 'Manubri'),
    X('bench-db', 'Panca piana con manubri', 'Manubri'),
    X('chest-machine', 'Chest press', 'Macchina'),
    X('pushup', 'Piegamenti sulle braccia', 'Tappetino', 'body'),
    X('shoulder-db', 'Shoulder press con manubri', 'Manubri'),
    X('shoulder-machine', 'Lento avanti alla macchina', 'Macchina'),
    X('pushpress-db', 'Push press con manubri', 'Manubri'),
    X('landmine', 'Landmine press a un braccio', 'Bilanciere', 'weight', true),
    // trazione
    X('lat-wide', 'Lat machine presa larga', 'Cavo'),
    X('lat-neutral', 'Lat machine presa neutra', 'Cavo'),
    X('pullup-assisted', 'Trazioni assistite', 'Macchina', 'assistance'),
    X('row-cable', 'Rematore al cavo da seduto', 'Cavo'),
    X('row-db', 'Rematore con manubrio', 'Manubrio', 'weight', true),
    X('chest-row', 'Rematore con appoggio al petto', 'Manubri'),
    X('row-machine', 'Rematore alla macchina', 'Macchina'),
    // core
    X('deadbug', 'Dead bug', 'Tappetino', 'body', true),
    X('birddog', 'Bird dog', 'Tappetino', 'body', true),
    X('heel-tap', 'Heel tap supino', 'Tappetino', 'body', true),
    X('pallof', 'Pallof press', 'Cavo', 'weight', true),
    X('cable-chop', 'Woodchop al cavo', 'Cavo', 'weight', true),
    X('abwheel', 'Rollout con ruota', 'Ruota', 'body'),
    // salti (pliometria): qualità prima della quantità
    X('box-jump', 'Box jump', 'Box', 'body'),
    X('broad-jump', 'Salto in lungo da fermo', 'Corpo libero', 'body'),
    X('pogo', 'Pogo jumps', 'Corpo libero', 'body'),
    X('split-jump', 'Salti in affondo alternati', 'Corpo libero', 'body', true),
    X('skater', 'Salti laterali (skater)', 'Corpo libero', 'body', true),
  ].map(x => [x.id, x]),
);

// Slot di una seduta: s(id, gruppo, ruolo, esercizio, [alternative], serie, [rip. min, max], recupero, nota)
// ruolo: plyo (salti, a inizio seduta) | main (fondamentale) | acc (complementare) | calf | core
const s = (id, group, role, ex, alt, sets, reps, rest, note = '') => ({ id, group, role, ex, alt, sets, reps, rest, note });

const BLOCKS = [
  {
    id: 'base',
    name: 'Base',
    title: 'Base · adattamento',
    why: 'Ripetizioni medie e carichi moderati: prepara tendini e tecnica e costruisce la base per i blocchi pesanti.',
    rpe: ['7', '7–8', '8'],
    routines: {
      A: [
        s('a-squat', 'Gambe', 'main', 'goblet', ['legpress', 'split'], 3, [10, 12], 90),
        s('a-hinge', 'Gambe', 'main', 'rdl-db', ['legcurl', 'sl-rdl'], 3, [10, 12], 90, 'Schiena neutra, scendi finché senti tirare i femorali.'),
        s('a-calf', 'Polpacci', 'calf', 'calf-stand', ['calf-single', 'calf-press'], 3, [12, 15], 60, 'Due secondi in discesa, pausa in basso.'),
        s('a-push', 'Petto', 'acc', 'incline-db', ['chest-machine', 'pushup'], 3, [10, 12], 75),
        s('a-pull', 'Dorso', 'acc', 'lat-wide', ['lat-neutral', 'pullup-assisted'], 3, [10, 12], 75),
        s('a-core', 'Core', 'core', 'deadbug', ['birddog', 'heel-tap'], 2, [8, 10], 45, 'Bacino fermo: se la schiena si stacca dal tappetino, accorcia il movimento.'),
      ],
      B: [
        s('b-single', 'Gambe', 'main', 'step-up', ['reverse-lunge', 'split'], 3, [10, 12], 90, 'Gradino all’altezza del ginocchio; spingi col piede sopra.'),
        s('b-hip', 'Gambe', 'main', 'hip-machine', ['hip-bb', 'bridge-db'], 3, [10, 12], 90),
        s('b-calf', 'Polpacci', 'calf', 'calf-seated', ['calf-press', 'calf-single'], 3, [12, 15], 60, 'Ginocchio piegato: lavora il soleo, il polpaccio che regge di più in corsa.'),
        s('b-pull', 'Dorso', 'acc', 'row-cable', ['row-db', 'row-machine'], 3, [10, 12], 75),
        s('b-push', 'Spalle', 'acc', 'shoulder-db', ['shoulder-machine', 'landmine'], 2, [10, 12], 75),
        s('b-core', 'Core', 'core', 'pallof', ['birddog', 'deadbug'], 2, [10, 12], 45, 'Resisti alla rotazione: il busto non deve girare.'),
      ],
    },
  },
  {
    id: 'forza',
    name: 'Forza',
    title: 'Forza · carichi alti',
    why: 'Poche ripetizioni, carichi alti e recuperi lunghi: è il blocco che migliora di più l’economia di corsa.',
    rpe: ['7', '7–8', '8'],
    routines: {
      A: [
        s('a-squat', 'Gambe', 'main', 'smith-squat', ['legpress', 'squat-bb'], 4, [5, 6], 150, 'Scendi controllato, sali deciso.'),
        s('a-hinge', 'Gambe', 'main', 'nordic', ['legcurl', 'sl-rdl'], 3, [4, 6], 120, 'Scendi più lento che puoi; usa le mani per risalire.'),
        s('a-calf', 'Polpacci', 'calf', 'calf-single', ['calf-stand', 'calf-press'], 4, [8, 10], 75, 'Manubrio nella mano dello stesso lato; tieniti con l’altra.'),
        s('a-push', 'Petto', 'acc', 'bench-db', ['chest-machine', 'incline-db'], 3, [6, 8], 120),
        s('a-pull', 'Dorso', 'acc', 'pullup-assisted', ['lat-neutral', 'lat-wide'], 3, [6, 8], 120),
        s('a-core', 'Core', 'core', 'abwheel', ['deadbug', 'pallof'], 3, [6, 10], 60, 'Fermati prima che la schiena si inarchi.'),
      ],
      B: [
        s('b-single', 'Gambe', 'main', 'bulgarian', ['split', 'step-up'], 3, [6, 8], 120),
        s('b-hip', 'Gambe', 'main', 'rdl-bb', ['trapbar', 'rdl-db'], 4, [5, 6], 150),
        s('b-calf', 'Polpacci', 'calf', 'calf-seated', ['calf-press', 'calf-single'], 4, [8, 10], 75),
        s('b-pull', 'Dorso', 'acc', 'row-db', ['chest-row', 'row-cable'], 3, [6, 8], 90),
        s('b-push', 'Spalle', 'acc', 'shoulder-db', ['landmine', 'shoulder-machine'], 3, [6, 8], 90),
        s('b-core', 'Core', 'core', 'cable-chop', ['pallof', 'birddog'], 3, [8, 10], 60),
      ],
    },
  },
  {
    id: 'potenza',
    name: 'Potenza',
    title: 'Potenza · forza esplosiva',
    why: 'Salti a inizio seduta e salita veloce nei fondamentali: allena la reattività di tendini e piedi.',
    rpe: ['7', '7–8', '8'],
    routines: {
      A: [
        s('a-plyo', 'Salti', 'plyo', 'box-jump', ['broad-jump', 'pogo'], 3, [5, 6], 90, 'Atterra morbido e scendi dal box camminando. Qualità, non fatica.'),
        s('a-squat', 'Gambe', 'main', 'smith-squat', ['legpress', 'goblet'], 3, [4, 6], 150, 'Salita il più veloce possibile, discesa controllata.'),
        s('a-hinge', 'Gambe', 'main', 'sl-rdl', ['rdl-db', 'legcurl'], 3, [6, 8], 90),
        s('a-calf', 'Polpacci', 'calf', 'calf-single', ['calf-stand', 'calf-press'], 3, [8, 10], 75),
        s('a-push', 'Spalle', 'acc', 'pushpress-db', ['shoulder-db', 'landmine'], 3, [5, 6], 90, 'Piccola piegata delle gambe e spinta esplosiva.'),
        s('a-pull', 'Dorso', 'acc', 'pullup-assisted', ['lat-neutral', 'lat-wide'], 3, [5, 6], 120),
        s('a-core', 'Core', 'core', 'pallof', ['deadbug', 'birddog'], 2, [10, 12], 45),
      ],
      B: [
        s('b-plyo', 'Salti', 'plyo', 'split-jump', ['skater', 'broad-jump'], 3, [5, 6], 90, 'Cambio gamba in volo, atterraggio stabile.'),
        s('b-single', 'Gambe', 'main', 'step-up', ['bulgarian', 'reverse-lunge'], 3, [5, 6], 120, 'Salita esplosiva sul gradino.'),
        s('b-hip', 'Gambe', 'main', 'hip-bb', ['hip-machine', 'trapbar'], 3, [5, 6], 120),
        s('b-calf', 'Polpacci', 'calf', 'pogo', ['calf-seated', 'calf-stand'], 3, [15, 20], 75, 'Saltelli rapidi sugli avampiedi, ginocchia quasi tese, contatti brevi.'),
        s('b-pull', 'Dorso', 'acc', 'row-db', ['chest-row', 'row-cable'], 3, [6, 8], 90),
        s('b-push', 'Petto', 'acc', 'bench-db', ['pushup', 'chest-machine'], 3, [6, 8], 90),
        s('b-core', 'Core', 'core', 'abwheel', ['deadbug', 'pallof'], 2, [8, 10], 60),
      ],
    },
  },
];

const BLOCK_WEEKS = 4; // 3 di carico + 1 di scarico
const ROUTINE_NAMES = { A: 'Total Body A', B: 'Total Body B' };

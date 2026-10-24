'use strict';
/* Palestra di RunPlan: catalogo esercizi, muscoli, schede di esempio.
   Le schede le compone l'utente scegliendo dal catalogo; l'app suggerisce carichi, ripetizioni,
   progressione e settimane di scarico. Gli id degli esercizi sono stabili: lo storico di un esercizio
   resta suo in qualunque scheda venga usato. */

// Muscoli (primari e secondari): id → nome
const MUSCLES = {
  petto: 'Petto', dorso: 'Dorsali', trapezi: 'Trapezi', spalle: 'Spalle', bicipiti: 'Bicipiti', tricipiti: 'Tricipiti',
  avambracci: 'Avambracci', addome: 'Addome', lombari: 'Lombari', glutei: 'Glutei', quadricipiti: 'Quadricipiti',
  femorali: 'Femorali', adduttori: 'Adduttori', abduttori: 'Abduttori', polpacci: 'Polpacci',
};
const EQUIPMENT = ['Bilanciere', 'Manubri', 'Kettlebell', 'Macchina', 'Cavo', 'Corpo libero', 'Elastico', 'Altro'];

/* Esercizio: X(id, nome, muscolo primario, attrezzo, tipo di carico, per lato, [muscoli secondari])
   tipo di carico: weight = kg | body = corpo libero (ripetizioni) | assistance = kg di assistenza |
   time = secondi (plank e simili). per lato: ripetizioni contate per lato. */
const X = (id, name, muscle, gear, loadType = 'weight', side = false, sec = []) => ({ id, name, muscle, gear, loadType, side, sec });
const W = 'weight', BD = 'body', AS = 'assistance', TM = 'time';
const EXERCISES = Object.fromEntries(
  [
    // petto
    X('bench-bb', 'Panca piana con bilanciere', 'petto', 'Bilanciere', W, false, ['tricipiti', 'spalle']),
    X('bench-db', 'Panca piana con manubri', 'petto', 'Manubri', W, false, ['tricipiti', 'spalle']),
    X('incline-bb', 'Panca inclinata con bilanciere', 'petto', 'Bilanciere', W, false, ['spalle', 'tricipiti']),
    X('incline-db', 'Panca inclinata con manubri', 'petto', 'Manubri', W, false, ['spalle', 'tricipiti']),
    X('decline-bb', 'Panca declinata con bilanciere', 'petto', 'Bilanciere', W, false, ['tricipiti']),
    X('chest-machine', 'Chest press', 'petto', 'Macchina', W, false, ['tricipiti', 'spalle']),
    X('incline-machine', 'Chest press inclinata', 'petto', 'Macchina', W, false, ['spalle', 'tricipiti']),
    X('pec-deck', 'Pectoral machine', 'petto', 'Macchina'),
    X('fly-db', 'Croci con manubri', 'petto', 'Manubri'),
    X('cable-fly', 'Croci ai cavi', 'petto', 'Cavo'),
    X('pushup', 'Piegamenti sulle braccia', 'petto', 'Corpo libero', BD, false, ['tricipiti', 'spalle', 'addome']),
    X('dips', 'Dip alle parallele', 'petto', 'Corpo libero', BD, false, ['tricipiti', 'spalle']),
    X('dips-assisted', 'Dip assistite', 'petto', 'Macchina', AS, false, ['tricipiti', 'spalle']),
    // dorso
    X('pullup', 'Trazioni alla sbarra', 'dorso', 'Corpo libero', BD, false, ['bicipiti']),
    X('pullup-assisted', 'Trazioni assistite', 'dorso', 'Macchina', AS, false, ['bicipiti']),
    X('chinup', 'Trazioni presa inversa', 'dorso', 'Corpo libero', BD, false, ['bicipiti']),
    X('lat-wide', 'Lat machine presa larga', 'dorso', 'Cavo', W, false, ['bicipiti']),
    X('lat-neutral', 'Lat machine presa neutra', 'dorso', 'Cavo', W, false, ['bicipiti']),
    X('lat-single', 'Lat machine a un braccio', 'dorso', 'Cavo', W, true, ['bicipiti']),
    X('row-bb', 'Rematore con bilanciere', 'dorso', 'Bilanciere', W, false, ['trapezi', 'bicipiti', 'lombari']),
    X('row-db', 'Rematore con manubrio', 'dorso', 'Manubri', W, true, ['trapezi', 'bicipiti']),
    X('chest-row', 'Rematore con appoggio al petto', 'dorso', 'Manubri', W, false, ['trapezi', 'bicipiti']),
    X('row-cable', 'Rematore al cavo da seduto', 'dorso', 'Cavo', W, false, ['trapezi', 'bicipiti']),
    X('row-machine', 'Rematore alla macchina', 'dorso', 'Macchina', W, false, ['trapezi', 'bicipiti']),
    X('tbar-row', 'Rematore T-bar', 'dorso', 'Bilanciere', W, false, ['trapezi', 'bicipiti']),
    X('inverted-row', 'Rematore inverso', 'dorso', 'Corpo libero', BD, false, ['trapezi', 'bicipiti']),
    X('pullover-cable', 'Pullover al cavo', 'dorso', 'Cavo'),
    // trapezi
    X('shrug-db', 'Scrollate con manubri', 'trapezi', 'Manubri'),
    X('shrug-bb', 'Scrollate con bilanciere', 'trapezi', 'Bilanciere'),
    // spalle
    X('shoulder-db', 'Shoulder press con manubri', 'spalle', 'Manubri', W, false, ['tricipiti']),
    X('shoulder-machine', 'Lento avanti alla macchina', 'spalle', 'Macchina', W, false, ['tricipiti']),
    X('ohp-bb', 'Lento avanti con bilanciere', 'spalle', 'Bilanciere', W, false, ['tricipiti']),
    X('arnold', 'Arnold press', 'spalle', 'Manubri', W, false, ['tricipiti']),
    X('pushpress-db', 'Push press con manubri', 'spalle', 'Manubri', W, false, ['tricipiti', 'quadricipiti']),
    X('landmine', 'Landmine press a un braccio', 'spalle', 'Bilanciere', W, true, ['petto', 'tricipiti']),
    X('lateral-db', 'Alzate laterali con manubri', 'spalle', 'Manubri'),
    X('lateral-cable', 'Alzate laterali al cavo', 'spalle', 'Cavo', W, true),
    X('lateral-machine', 'Alzate laterali alla macchina', 'spalle', 'Macchina'),
    X('front-raise', 'Alzate frontali', 'spalle', 'Manubri'),
    X('rear-delt-db', 'Alzate posteriori con manubri', 'spalle', 'Manubri', W, false, ['trapezi']),
    X('reverse-fly-machine', 'Reverse fly alla macchina', 'spalle', 'Macchina', W, false, ['trapezi']),
    X('face-pull', 'Face pull', 'spalle', 'Cavo', W, false, ['trapezi']),
    // bicipiti
    X('curl-db', 'Curl con manubri', 'bicipiti', 'Manubri'),
    X('curl-bb', 'Curl con bilanciere', 'bicipiti', 'Bilanciere'),
    X('curl-ez', 'Curl con bilanciere EZ', 'bicipiti', 'Bilanciere'),
    X('curl-hammer', 'Curl a martello', 'bicipiti', 'Manubri', W, false, ['avambracci']),
    X('curl-cable', 'Curl al cavo', 'bicipiti', 'Cavo'),
    X('curl-preacher', 'Curl alla panca Scott', 'bicipiti', 'Macchina'),
    X('curl-incline', 'Curl su panca inclinata', 'bicipiti', 'Manubri'),
    X('curl-conc', 'Curl di concentrazione', 'bicipiti', 'Manubri', W, true),
    // tricipiti
    X('pushdown-rope', 'Pushdown con corda', 'tricipiti', 'Cavo'),
    X('pushdown-bar', 'Pushdown con barra', 'tricipiti', 'Cavo'),
    X('skullcrusher', 'Skullcrusher con manubri', 'tricipiti', 'Manubri'),
    X('skull-ez', 'French press con bilanciere EZ', 'tricipiti', 'Bilanciere'),
    X('overhead-cable', 'Estensioni sopra la testa al cavo', 'tricipiti', 'Cavo'),
    X('overhead-db', 'Estensioni sopra la testa con manubrio', 'tricipiti', 'Manubri'),
    X('close-bench', 'Panca presa stretta', 'tricipiti', 'Bilanciere', W, false, ['petto']),
    X('kickback', 'Kickback con manubrio', 'tricipiti', 'Manubri', W, true),
    X('dips-bench', 'Dip alla panca', 'tricipiti', 'Corpo libero', BD),
    // avambracci
    X('wrist-curl', 'Curl dei polsi', 'avambracci', 'Manubri'),
    X('reverse-curl', 'Curl presa inversa', 'avambracci', 'Bilanciere', W, false, ['bicipiti']),
    // addome e core
    X('plank', 'Plank', 'addome', 'Corpo libero', TM),
    X('side-plank', 'Plank laterale', 'addome', 'Corpo libero', TM, true),
    X('hollow', 'Hollow hold', 'addome', 'Corpo libero', TM),
    X('deadbug', 'Dead bug', 'addome', 'Corpo libero', BD, true),
    X('heel-tap', 'Heel tap supino', 'addome', 'Corpo libero', BD, true),
    X('crunch', 'Crunch', 'addome', 'Corpo libero', BD),
    X('crunch-cable', 'Crunch al cavo', 'addome', 'Cavo'),
    X('leg-raise', 'Sollevamento gambe alla sbarra', 'addome', 'Corpo libero', BD),
    X('knee-raise', 'Knee raise alle parallele', 'addome', 'Corpo libero', BD),
    X('russian-twist', 'Russian twist', 'addome', 'Corpo libero', BD),
    X('abwheel', 'Rollout con ruota', 'addome', 'Altro', BD),
    X('pallof', 'Pallof press', 'addome', 'Cavo', W, true),
    X('cable-chop', 'Woodchop al cavo', 'addome', 'Cavo', W, true),
    // lombari
    X('birddog', 'Bird dog', 'lombari', 'Corpo libero', BD, true, ['addome', 'glutei']),
    X('back-ext', 'Iperestensioni', 'lombari', 'Corpo libero', BD, false, ['glutei', 'femorali']),
    X('superman', 'Superman', 'lombari', 'Corpo libero', BD),
    // glutei
    X('hip-bb', 'Hip thrust con bilanciere', 'glutei', 'Bilanciere', W, false, ['femorali']),
    X('hip-machine', 'Hip thrust alla macchina', 'glutei', 'Macchina', W, false, ['femorali']),
    X('bridge-db', 'Glute bridge con manubrio', 'glutei', 'Manubri', W, false, ['femorali']),
    X('glute-bridge', 'Ponte glutei', 'glutei', 'Corpo libero', BD, false, ['femorali']),
    X('sl-bridge', 'Ponte glutei a una gamba', 'glutei', 'Corpo libero', BD, true, ['femorali']),
    X('kickback-cable', 'Slanci all’indietro al cavo', 'glutei', 'Cavo', W, true),
    X('kb-swing', 'Kettlebell swing', 'glutei', 'Kettlebell', W, false, ['femorali', 'lombari']),
    // abduttori e adduttori
    X('abductor-machine', 'Abductor machine', 'abduttori', 'Macchina'),
    X('abduction-cable', 'Abduzione al cavo', 'abduttori', 'Cavo', W, true),
    X('band-walk', 'Passi laterali con elastico', 'abduttori', 'Elastico', BD, true, ['glutei']),
    X('clamshell', 'Clamshell con elastico', 'abduttori', 'Elastico', BD, true, ['glutei']),
    X('adductor-machine', 'Adductor machine', 'adduttori', 'Macchina'),
    X('copenhagen', 'Copenhagen plank', 'adduttori', 'Corpo libero', TM, true, ['addome']),
    // quadricipiti
    X('squat-bb', 'Back squat', 'quadricipiti', 'Bilanciere', W, false, ['glutei', 'lombari']),
    X('front-squat', 'Front squat', 'quadricipiti', 'Bilanciere', W, false, ['glutei', 'addome']),
    X('goblet', 'Goblet squat', 'quadricipiti', 'Manubri', W, false, ['glutei']),
    X('smith-squat', 'Squat al multipower', 'quadricipiti', 'Macchina', W, false, ['glutei']),
    X('hack-squat', 'Hack squat', 'quadricipiti', 'Macchina', W, false, ['glutei']),
    X('legpress', 'Leg press', 'quadricipiti', 'Macchina', W, false, ['glutei']),
    X('leg-ext', 'Leg extension', 'quadricipiti', 'Macchina'),
    X('split', 'Split squat', 'quadricipiti', 'Manubri', W, true, ['glutei']),
    X('bulgarian', 'Squat bulgaro', 'quadricipiti', 'Manubri', W, true, ['glutei']),
    X('step-up', 'Step-up', 'quadricipiti', 'Manubri', W, true, ['glutei']),
    X('reverse-lunge', 'Affondi indietro', 'quadricipiti', 'Manubri', W, true, ['glutei']),
    X('walking-lunge', 'Affondi in camminata', 'quadricipiti', 'Manubri', W, true, ['glutei']),
    X('pistol', 'Pistol squat assistito', 'quadricipiti', 'Corpo libero', BD, true, ['glutei']),
    X('wall-sit', 'Wall sit', 'quadricipiti', 'Corpo libero', TM),
    // femorali e catena posteriore
    X('deadlift', 'Stacco da terra', 'femorali', 'Bilanciere', W, false, ['glutei', 'lombari', 'trapezi']),
    X('trapbar', 'Stacco con trap bar', 'femorali', 'Bilanciere', W, false, ['glutei', 'quadricipiti', 'lombari']),
    X('rdl-bb', 'Stacco rumeno con bilanciere', 'femorali', 'Bilanciere', W, false, ['glutei', 'lombari']),
    X('rdl-db', 'Stacco rumeno con manubri', 'femorali', 'Manubri', W, false, ['glutei', 'lombari']),
    X('sl-rdl', 'Stacco rumeno a una gamba', 'femorali', 'Manubri', W, true, ['glutei']),
    X('good-morning', 'Good morning', 'femorali', 'Bilanciere', W, false, ['lombari', 'glutei']),
    X('legcurl', 'Leg curl sdraiato', 'femorali', 'Macchina'),
    X('legcurl-seated', 'Leg curl da seduto', 'femorali', 'Macchina'),
    X('nordic', 'Nordic curl assistito', 'femorali', 'Corpo libero', BD),
    X('slider-curl', 'Leg curl con slider', 'femorali', 'Corpo libero', BD, false, ['glutei']),
    // polpacci
    X('calf-stand', 'Calf raise in piedi', 'polpacci', 'Macchina'),
    X('calf-single', 'Calf raise a una gamba', 'polpacci', 'Manubri', W, true),
    X('calf-press', 'Calf raise alla pressa', 'polpacci', 'Macchina'),
    X('calf-seated', 'Calf raise da seduto', 'polpacci', 'Macchina'),
    X('calf-smith', 'Calf raise al multipower', 'polpacci', 'Macchina'),
    X('tib-raise', 'Tibialis raise', 'polpacci', 'Corpo libero', BD),
    // pliometria
    X('box-jump', 'Box jump', 'quadricipiti', 'Altro', BD, false, ['glutei', 'polpacci']),
    X('jump-squat', 'Squat jump', 'quadricipiti', 'Corpo libero', BD, false, ['glutei', 'polpacci']),
    X('broad-jump', 'Salto in lungo da fermo', 'glutei', 'Corpo libero', BD, false, ['quadricipiti', 'polpacci']),
    X('split-jump', 'Salti in affondo alternati', 'quadricipiti', 'Corpo libero', BD, true, ['glutei', 'polpacci']),
    X('skater', 'Salti laterali (skater)', 'glutei', 'Corpo libero', BD, true, ['quadricipiti', 'polpacci']),
    X('pogo', 'Pogo jumps', 'polpacci', 'Corpo libero', BD),
    X('sl-hop', 'Balzi su una gamba', 'polpacci', 'Corpo libero', BD, true, ['quadricipiti']),
    X('depth-jump', 'Drop jump', 'quadricipiti', 'Altro', BD, false, ['polpacci', 'glutei']),
  ].map(x => [x.id, x]),
);

/* Schede di esempio per chi parte da zero: due Total Body per un runner.
   R(nome, nota, [[esercizio, serie, rip. min, rip. max, recupero s]]) */
const R = (name, note, list) => ({ name, note, exercises: list.map(([ex, sets, lo, hi, rest]) => ({ ex, sets, lo, hi, rest })) });
const STARTER_ROUTINES = [
  R('Total Body A', 'Spinta, trazione, gambe e polpacci.', [
    ['goblet', 3, 10, 12, 90], ['rdl-db', 3, 10, 12, 90], ['calf-stand', 3, 12, 15, 60],
    ['incline-db', 3, 10, 12, 75], ['lat-wide', 3, 10, 12, 75], ['deadbug', 2, 8, 10, 45],
  ]),
  R('Total Body B', 'Una gamba, catena posteriore e soleo.', [
    ['step-up', 3, 10, 12, 90], ['hip-machine', 3, 10, 12, 90], ['calf-seated', 3, 12, 15, 60],
    ['row-cable', 3, 10, 12, 75], ['shoulder-db', 3, 10, 12, 75], ['pallof', 2, 10, 12, 45],
  ]),
];

/* Solo per la migrazione dai dati v3 (programma per movimenti): esercizio e schema del blocco Base
   di ciascun movimento. */
const LEGACY_PATTERNS = {
  squat: ['goblet', 10, 12, 90], singola: ['step-up', 10, 12, 90], femorali: ['rdl-db', 10, 12, 90],
  stacco: ['hip-machine', 10, 12, 90], polpacci: ['calf-stand', 12, 15, 60], soleo: ['calf-seated', 12, 15, 60],
  salti: ['pogo', 10, 15, 75], salti1: ['skater', 5, 6, 75], spintaO: ['incline-db', 10, 12, 75],
  spintaV: ['shoulder-db', 10, 12, 75], trazioneV: ['lat-wide', 10, 12, 75], trazioneO: ['row-cable', 10, 12, 75],
  bicipiti: ['curl-db', 10, 12, 60], tricipiti: ['pushdown-rope', 10, 12, 60], coreE: ['deadbug', 8, 10, 45],
  coreR: ['pallof', 10, 12, 45],
};

const CYCLE_WEEKS = 4; // con lo scarico attivo: 3 settimane di carico + 1 di scarico

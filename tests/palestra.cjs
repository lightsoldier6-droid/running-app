// Test della Palestra:  node tests/palestra.cjs
// Motore di programma e progressione, flusso di una seduta (con un DOM finto), migrazione dei dati
// del vecchio modulo, collegamento con RunPlan. Non serve un browser.
process.env.TZ = 'Europe/Rome';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function engine() {
  const c = { console, Date, Math, JSON, Intl };
  vm.createContext(c);
  vm.runInContext(read('palestra/data.js') + read('palestra/engine.js') + ';this.E=GymEngine;this.B=BLOCKS;this.X=EXERCISES;this.W=BLOCK_WEEKS', c);
  return c;
}
const session = (variant, kg, reps, date, { rpe = 7, lo, hi, deload = false } = {}) => ({
  type: 'gym', id: 'h' + date, date, endedAt: Date.parse(date + 'T19:00:00'), rpe, deload, routine: 'A',
  exercises: [{ variant, presc: { lo, hi, sets: reps.length }, target: `${lo}–${hi}`, sets: reps.map(r => ({ kg, reps: r, done: true })) }],
});

test('programma: tre blocchi da 4 settimane, scarico nella quarta, poi si ricomincia', () => {
  const { E, B, W } = engine();
  assert.equal(B.length, 3);
  assert.equal(W, 4);
  const at = d => { const p = E.position(B, '2026-10-26', d, null); return [p.block.id, p.week, p.deload, p.cycle]; };
  assert.deepEqual(at('2026-10-26'), ['base', 1, false, 1]);
  assert.deepEqual(at('2026-11-15'), ['base', 3, false, 1]); // domenica della 3ª settimana
  assert.deepEqual(at('2026-11-16'), ['base', 4, true, 1]);
  assert.deepEqual(at('2026-11-23'), ['forza', 1, false, 1]);
  assert.deepEqual(at('2026-12-21'), ['potenza', 1, false, 1]);
  assert.deepEqual(at('2027-01-18'), ['base', 1, false, 2]);
  // ogni blocco cambia davvero esercizi o ripetizioni rispetto al precedente
  for (let i = 0; i < 3; i++) {
    const a = B[i].routines.A.map(s => s.ex + s.reps), b = B[(i + 1) % 3].routines.A.map(s => s.ex + s.reps);
    assert.ok(a.filter(x => b.includes(x)).length <= 1, `${B[i].id} → ${B[(i + 1) % 3].id} troppo simili`);
  }
  // tutti gli esercizi citati esistono e hanno almeno due alternative
  for (const b of B) for (const r of ['A', 'B']) for (const s of b.routines[r]) {
    for (const id of [s.ex, ...s.alt]) assert.ok(E && engine().X[id], `${id} non esiste`);
    assert.ok(s.alt.length >= 2);
  }
});

test('taper e settimana gara della corsa mettono la palestra in scarico', () => {
  const { E, B } = engine();
  const p = E.position(B, '2026-10-26', '2026-10-28', { isTaper: true, race: false });
  assert.equal(p.deload, true);
  const r = E.position(B, '2026-10-26', '2026-10-28', { isTaper: true, race: true });
  assert.equal(r.race, true);
  assert.match(r.why, /gara/);
});

test('progressione doppia: ripetizioni, poi carico', () => {
  const { E, B, X } = engine();
  const slot = B[0].routines.A[0], v = X[slot.ex], p = E.position(B, '2026-10-26', '2026-11-04', null);
  const first = E.prescribe(slot, v, p, []);
  assert.equal(first.kg, null);
  assert.deepEqual([...first.reps], [12, 12, 12]);
  const reps = E.prescribe(slot, v, p, [session(v, 20, [11, 10, 10], '2026-10-28', { lo: 10, hi: 12 })]);
  assert.equal(reps.kg, 20);
  assert.deepEqual([...reps.reps], [12, 11, 11]);
  assert.equal(reps.trend, 'reps');
  const up = E.prescribe(slot, v, p, [session(v, 20, [12, 12, 12], '2026-10-28', { lo: 10, hi: 12 })]);
  assert.equal(up.kg, 22); // manubrio: +2 kg
  assert.deepEqual([...up.reps], [10, 10, 10]);
  assert.equal(up.trend, 'up');
  // RPE 9-10: niente aumento
  assert.equal(E.prescribe(slot, v, p, [session(v, 20, [12, 12, 12], '2026-10-28', { lo: 10, hi: 12, rpe: 9 })]).kg, 20);
  // bilanciere e macchine salgono di 2,5 kg
  const lat = X['lat-wide'];
  assert.equal(E.prescribe(B[0].routines.A[4], lat, p, [session(lat, 40, [12, 12, 12], '2026-10-28', { lo: 10, hi: 12 })]).kg, 42.5);
});

test('scarico, cambio di blocco, corpo libero e assistenza', () => {
  const { E, B, X } = engine();
  const slot = B[0].routines.A[0], v = X[slot.ex];
  const hist = [session(v, 24, [12, 11, 11], '2026-11-12', { lo: 10, hi: 12 })];
  const dl = E.prescribe(slot, v, E.position(B, '2026-10-26', '2026-11-18', null), hist);
  assert.equal(dl.sets, 2);
  assert.equal(dl.kg, 21); // −10% arrotondato per difetto al kg
  assert.equal(dl.trend, 'deload');
  // nel blocco Forza (5-6 rip.) il carico parte dalla stima del massimale; la seduta di scarico non conta
  const hist2 = [...hist, session(v, 21, [10, 10], '2026-11-18', { lo: 10, hi: 12, deload: true })];
  const nb = E.prescribe({ ...B[1].routines.A[0], ex: 'goblet' }, v, E.position(B, '2026-10-26', '2026-11-25', null), hist2);
  assert.equal(nb.trend, 'new');
  assert.ok(nb.kg > 24 && nb.kg < 32, `stima ${nb.kg}`);
  // corpo libero: solo ripetizioni
  const db = X.deadbug, p = E.position(B, '2026-10-26', '2026-11-04', null);
  const b = E.prescribe(B[0].routines.A[5], db, p, [session(db, 0, [9, 8], '2026-10-28', { lo: 8, hi: 10 })]);
  assert.equal(b.kg, null);
  assert.deepEqual([...b.reps], [9, 9]);
  // assistenza: al tetto si toglie assistenza
  const pa = X['pullup-assisted'];
  const a = E.prescribe(B[1].routines.A[4], pa, E.position(B, '2026-10-26', '2026-12-02', null), [session(pa, 30, [8, 8, 8], '2026-11-25', { lo: 6, hi: 8 })]);
  assert.equal(a.kg, 25);
});

test('giorni consigliati rispetto al piano di corsa', () => {
  const { E } = engine();
  const wk = { sess: [{ day: 1, name: 'Easy + allunghi', hard: false }, { day: 2, name: 'Easy', hard: false }, { day: 3, name: 'Fartlek', hard: true }, { day: 6, name: 'Lungo', hard: true, long: true }] };
  const d = E.suggestDays(wk).map(x => x.day);
  assert.equal(d.length, 2);
  assert.ok(!d.includes(2), 'mai il giorno prima della qualità');
  assert.ok(!d.includes(5), 'mai il giorno prima del lungo');
  assert.ok(!d.includes(6), 'non il giorno del lungo');
  assert.ok(d.includes(3), 'sì dopo la qualità');
  assert.ok(Math.abs(d[0] - d[1]) >= 2);
  const race = { sess: [{ day: 1, name: 'Richiami', hard: true }, { day: 3, name: 'Ritmo gara', hard: true }, { day: 6, name: 'GARA', hard: true, race: true }] };
  assert.deepEqual([...E.suggestDays(race, 1).map(x => x.day)], [1]);
  assert.equal(E.suggestDays(null), null);
});

// ---- interfaccia, con un DOM finto ----
function app(storage = {}) {
  const els = {}, listeners = {};
  const el = () => ({ innerHTML: '', textContent: '', open: false, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; }, getBoundingClientRect: () => ({ left: 0, right: 500, top: 0, bottom: 500 }) });
  const store = { ...storage };
  const c = {
    console, Date, Math, JSON, Intl, URL, Blob, Number, String, Array, Object, Map, Set, Promise, Error,
    crypto: require('node:crypto').webcrypto,
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    location: { hash: '', search: '' }, history: { replaceState() {} }, navigator: {},
    setInterval() {}, setTimeout() {}, clearTimeout() {},
    document: { querySelector: s => (els[s] ??= el()), addEventListener: (n, f) => (listeners[n] ??= []).push(f), visibilityState: 'visible', body: el() },
    addEventListener() {}, scrollTo() {},
  };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(read('palestra/data.js') + read('palestra/engine.js') + read('palestra/app.js'), c);
  const run = s => vm.runInContext(s, c);
  const click = (action, data = {}) => listeners.click[0]({ target: { closest: q => (q === '[data-action]' ? { dataset: { action, ...data } } : null) } });
  return { run, click, store, els };
}

test('seduta: si parte dal programma, si spuntano le serie, si salva con blocco e settimana', () => {
  const { run, click, store, els } = app();
  assert.match(els['#main'].innerHTML, /Total Body A/);
  assert.doesNotMatch(els['#main'].innerHTML, /[Cc]ors[ae] registrat|Registra corsa/);
  run('start("A")');
  assert.equal(run('state.active.exercises.length'), 6);
  assert.equal(run('state.active.block'), 'base');
  assert.equal(run('state.active.exercises[0].presc.sets'), 3);
  // senza carico non si spunta
  click('check', { index: '0', set: '0' });
  assert.equal(run('state.active.exercises[0].sets[0].done'), false);
  run('state.active.exercises[0].sets[0].kg=20');
  click('check', { index: '0', set: '0' });
  assert.equal(run('state.active.exercises[0].sets[0].done'), true);
  assert.equal(run('state.timer.total'), 90);
  assert.equal(run('state.active.exercises[0].sets[1].kg'), 20); // la serie dopo eredita il carico
  // sostituzione a metà esercizio: le serie fatte restano, le altre passano alla variante
  run('chooseVariant(0, state.active.exercises[0].variants[1])');
  assert.equal(run('state.active.exercises.length'), 7);
  assert.equal(run('state.active.exercises[1].variant.id'), 'legpress');
  assert.equal(run('state.active.exercises[1].sets.length'), 2);
  run('finish(7, "ok")');
  const saved = JSON.parse(store['passo-v1']);
  assert.equal(saved.version, 2);
  assert.equal(saved.history.length, 1);
  assert.equal(saved.history[0].blockName, 'Base');
  assert.equal(saved.history[0].week, 1);
  assert.equal(saved.history[0].exercises.length, 1); // solo esercizi con serie fatte
  assert.equal(run('GymEngine.nextRoutine(state.history, pos())'), 'B');
  // il backup esportato si reimporta
  run('validateBackup(JSON.parse(JSON.stringify(state)))');
});

test('i dati del vecchio modulo (v1) vengono migrati: si tengono solo le sedute di palestra', () => {
  const v1 = {
    version: 1, routines: {}, plan: [], settings: { sound: false }, active: null, timer: null,
    history: [
      { id: 'g1', type: 'gym', routine: 'A', date: '2026-10-20', endedAt: Date.parse('2026-10-20T19:00:00'), minutes: 50, rpe: 7, note: '',
        exercises: [{ variant: { id: 'goblet', name: 'Goblet squat', gear: 'Manubrio', loadType: 'weight' }, target: '8–10', sets: [{ kg: 18, reps: 10, done: true }] }] },
      { id: 'r1', type: 'run', date: '2026-10-21', kind: 'easy', km: 8, minutes: 45, rpe: 4, note: '', endedAt: 1 },
    ],
  };
  const { run } = app({ 'passo-v1': JSON.stringify(v1) });
  assert.equal(run('state.version'), 2);
  assert.equal(run('state.history.length'), 1);
  assert.equal(run('state.settings.sound'), false);
  assert.equal(run('state.program.start'), '2026-10-19');
  // la vecchia seduta alimenta la progressione dello stesso esercizio
  assert.equal(run('GymEngine.lastPerformance("goblet", state.history).sets[0].kg'), 18);
});

test('RunPlan: le sedute entrano come "altri sport" e la settimana del piano è leggibile', () => {
  const store = { 'passo-v1': JSON.stringify({ version: 2, history: [{ id: 'g1', type: 'gym', routine: 'B', blockName: 'Forza', date: '2026-10-28', startedAt: Date.parse('2026-10-28T18:30:00'), minutes: 47.6, rpe: 7, exercises: [] }] }) };
  const plan = { dateStr: '2027-03-21', weeks: Array.from({ length: 22 }, (_, i) => ({ w: i + 1, phase: i > 19 ? 'taper' : 'base', isTaper: i > 19, sess: [{ t: 'Giovedì', n: 'Fartlek', km: 8 }, { t: 'Domenica', n: i === 21 ? 'GARA 🏁' : 'Lungo', km: 20 }] })) };
  const c = {
    console, Date, Math, JSON, document: { body: { classList: { contains: () => false } } }, addEventListener() {},
    localStorage: { getItem: k => store[k] ?? null, setItem() {} },
    LS: k => (k === 'rp_plan' ? plan : null),
    wkSunISO: (pl, wk) => { const r = new Date(pl.dateStr + 'T12:00:00'); r.setDate(r.getDate() - (pl.weeks.length - wk.w) * 7); return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`; },
  };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(read('gym-bridge.js'), c);
  const acts = vm.runInContext('runPlanGymActivities()', c);
  assert.equal(acts.length, 1);
  assert.equal(acts[0].min, 48);
  assert.equal(acts[0].note, 'Total Body B · Forza');
  assert.equal(acts[0].src, 'passo');
  const last = vm.runInContext('RunPlanGym.runWeek("2027-03-18")', c);
  assert.equal(last.race, true);
  assert.equal(last.isTaper, true);
  assert.deepEqual(last.sess.map(x => x.day), [3, 6]);
  assert.equal(vm.runInContext('RunPlanGym.runWeek("2020-01-01")', c), null);
  assert.equal(vm.runInContext('typeof RunPlanGym.getRuns', c), 'undefined'); // niente più corse nella palestra
  // il codice di RunPlan usa allXts() per calendario e carico, e non manda la palestra al cloud
  const root = [read('index.html'), ...fs.readdirSync(path.join(ROOT, 'js')).map(f => read('js/' + f))].join('\n');
  assert.ok(root.includes('allXts().forEach'));
  assert.ok(!/payload:JSON\.stringify\(\{[^}]*passo/.test(root));
  const sw = read('sw.js');
  for (const f of ['palestra/index.html', 'palestra/app.js', 'palestra/engine.js', 'palestra/data.js', 'palestra/palestra.css', 'gym-bridge.js']) assert.ok(sw.includes(`'${f}'`), f);
  for (const f of sw.match(/'[^':]+\.(?:js|css|html|png|webmanifest)'/g)) assert.ok(fs.existsSync(path.join(ROOT, f.slice(1, -1))), `manca ${f}`);
});

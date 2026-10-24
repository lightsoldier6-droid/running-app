// Test della Palestra:  node tests/palestra.cjs
// Catalogo, ciclo di scarico, progressione, record e statistiche, schede e allenamenti (con un DOM
// finto), migrazione dei dati delle versioni precedenti, collegamento con RunPlan. Senza browser.
process.env.TZ = 'Europe/Rome';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const arr = a => [...a]; // array creati in un altro contesto vm

function engine() {
  const c = { console, Date, Math, JSON, Intl };
  vm.createContext(c);
  vm.runInContext(read('palestra/data.js') + read('palestra/engine.js') + ';this.E=GymEngine;this.X=EXERCISES;this.M=MUSCLES;this.G=EQUIPMENT;this.S=STARTER_ROUTINES;this.L=LEGACY_PATTERNS', c);
  return c;
}
const slot = (sets, lo, hi, rest = 90) => ({ sets, reps: [lo, hi], rest });
const session = (variant, kg, reps, date, { rpe = 7, lo, hi, deload = false, warm = [] } = {}) => ({
  type: 'gym', id: 'h' + date + variant.id, date, endedAt: Date.parse(date + 'T19:00:00'), rpe, deload, name: 'Test',
  exercises: [{ variant, presc: { lo, hi, sets: reps.length }, target: `${lo}–${hi}`, sets: [...warm.map(r => ({ kg: kg / 2, reps: r, done: true, kind: 'warmup' })), ...reps.map(r => ({ kg, reps: r, done: true, kind: 'normal' }))] }],
});

test('catalogo: esercizi completi e coerenti', () => {
  const { X, M, G, S, L } = engine();
  const list = Object.values(X);
  assert.ok(list.length >= 100, `solo ${list.length} esercizi`);
  for (const v of list) {
    assert.ok(M[v.muscle], `${v.id}: muscolo ${v.muscle}`);
    for (const m of v.sec) assert.ok(M[m], `${v.id}: secondario ${m}`);
    assert.ok(G.includes(v.gear), `${v.id}: attrezzo ${v.gear}`);
    assert.ok(['weight', 'body', 'assistance', 'time'].includes(v.loadType), v.id);
  }
  // ogni muscolo ha almeno due esercizi; ogni attrezzo almeno uno
  for (const m of Object.keys(M)) assert.ok(list.filter(v => v.muscle === m).length >= 2, m);
  for (const g of G) assert.ok(list.some(v => v.gear === g), g);
  // schede di esempio e conversione dai dati vecchi usano esercizi che esistono
  for (const r of S) for (const x of r.exercises) assert.ok(X[x.ex] && x.lo <= x.hi, x.ex);
  for (const [ex] of Object.values(L)) assert.ok(X[ex], ex);
});

test('ciclo: 3 settimane di carico + 1 di scarico; taper e gara scaricano sempre', () => {
  const { E } = engine();
  const at = (d, on = true, rw = null) => { const p = E.cycle('2026-10-26', d, rw, on); return [p.week, p.deload]; };
  assert.deepEqual(at('2026-10-26'), [1, false]);
  assert.deepEqual(at('2026-11-15'), [3, false]);
  assert.deepEqual(at('2026-11-16'), [4, true]);
  assert.deepEqual(at('2026-11-23'), [1, false]);
  assert.deepEqual(at('2026-11-16', false), [4, false]); // scarico disattivato
  assert.equal(E.cycle('2026-10-26', '2026-10-28', { isTaper: true }, false).deload, true);
  const race = E.cycle('2026-10-26', '2026-10-28', { isTaper: true, race: true }, true);
  assert.equal(race.race, true);
  assert.match(race.why, /gara/);
});

test('progressione doppia sul range della scheda', () => {
  const { E, X } = engine();
  const p = E.cycle('2026-10-26', '2026-11-04', null, true), g = X.goblet;
  const first = E.prescribe(slot(3, 10, 12), g, p, []);
  assert.equal(first.kg, null);
  assert.deepEqual(arr(first.reps), [12, 12, 12]);
  const reps = E.prescribe(slot(3, 10, 12), g, p, [session(g, 20, [11, 10, 10], '2026-10-28', { lo: 10, hi: 12, warm: [10] })]);
  assert.equal(reps.kg, 20); // il riscaldamento non conta
  assert.deepEqual(arr(reps.reps), [12, 11, 11]);
  const up = E.prescribe(slot(3, 10, 12), g, p, [session(g, 20, [12, 12, 12], '2026-10-28', { lo: 10, hi: 12 })]);
  assert.deepEqual([up.kg, ...up.reps, up.trend], [22, 10, 10, 10, 'up']); // manubri: +2 kg
  assert.equal(E.prescribe(slot(3, 10, 12), g, p, [session(g, 20, [12, 12, 12], '2026-10-28', { lo: 10, hi: 12, rpe: 9 })]).kg, 20);
  const lat = X['lat-wide'];
  assert.equal(E.prescribe(slot(3, 10, 12), lat, p, [session(lat, 40, [12, 12, 12], '2026-10-28', { lo: 10, hi: 12 })]).kg, 42.5);
  const kb = X['kb-swing'];
  assert.equal(E.prescribe(slot(3, 10, 12), kb, p, [session(kb, 16, [12, 12, 12], '2026-10-28', { lo: 10, hi: 12 })]).kg, 20); // kettlebell: +4
  // range cambiato nella scheda: carico stimato dal massimale implicito
  const nr = E.prescribe(slot(4, 5, 6), g, p, [session(g, 24, [12, 12, 11], '2026-10-28', { lo: 10, hi: 12 })]);
  assert.equal(nr.trend, 'new');
  assert.ok(nr.kg > 24 && nr.kg < 32, `stima ${nr.kg}`);
});

test('scarico, corpo libero, tempo e assistenza', () => {
  const { E, X } = engine();
  const g = X.goblet, hist = [session(g, 24, [12, 11, 11], '2026-11-12', { lo: 10, hi: 12 })];
  const dl = E.prescribe(slot(3, 10, 12), g, E.cycle('2026-10-26', '2026-11-18', null, true), hist);
  assert.deepEqual([dl.sets, dl.kg, dl.trend], [2, 21, 'deload']);
  // la seduta di scarico non diventa il riferimento per la settimana dopo
  const after = E.prescribe(slot(3, 10, 12), g, E.cycle('2026-10-26', '2026-11-25', null, true), [...hist, session(g, 21, [10, 10], '2026-11-18', { lo: 10, hi: 12, deload: true })]);
  assert.equal(after.kg, 24);
  const p = E.cycle('2026-10-26', '2026-11-04', null, true);
  const db = X.deadbug;
  assert.deepEqual(arr(E.prescribe(slot(2, 8, 10), db, p, [session(db, 0, [9, 8], '2026-10-28', { lo: 8, hi: 10 })]).reps), [9, 9]);
  const pl = X.plank;
  const t = E.prescribe(slot(3, 30, 60), pl, p, [session(pl, 0, [40, 35, 35], '2026-10-28', { lo: 30, hi: 60 })]);
  assert.deepEqual(arr(t.reps), [40, 40, 40]); // +5 secondi
  assert.match(t.why, /secondi/);
  const pa = X['pullup-assisted'];
  assert.equal(E.prescribe(slot(3, 6, 8), pa, p, [session(pa, 30, [8, 8, 8], '2026-10-28', { lo: 6, hi: 8 })]).kg, 25);
});

test('record personali, statistiche per muscolo, rotazione delle schede', () => {
  const { E, X } = engine();
  const b = X['bench-db'];
  const h1 = session(b, 20, [10, 10, 10], '2026-10-20', { lo: 8, hi: 12 });
  const h2 = session(b, 22, [8, 8, 8], '2026-10-27', { lo: 8, hi: 12 });
  assert.deepEqual(arr(E.records(h1, [])), []); // prima volta: niente da battere
  const r2 = E.records(h2, [h1]);
  assert.equal(r2.length, 1);
  assert.equal(r2[0].kind, 'Carico più alto');
  const h3 = session(b, 22, [12, 11, 10], '2026-11-03', { lo: 8, hi: 12 });
  assert.equal(E.records(h3, [h1, h2])[0].kind, 'Massimale stimato');
  // serie per muscolo: 1 al principale, ½ ai secondari; riscaldamento escluso
  const ms = E.setsByMuscle([session(b, 20, [10, 10], '2026-10-20', { lo: 8, hi: 12, warm: [10] })], '2026-10-01', '2026-10-31', id => X[id]);
  assert.deepEqual([ms.petto, ms.tricipiti, ms.spalle], [2, 1, 1]);
  assert.equal(E.volume(h1), 600);
  // rotazione: la scheda dopo l'ultima fatta
  const rs = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }];
  const done = (id, d) => ({ type: 'gym', routineId: id, date: d, endedAt: Date.parse(d) });
  assert.equal(E.nextRoutine([], rs).id, 'r1');
  assert.equal(E.nextRoutine([done('r1', '2026-10-20'), done('r2', '2026-10-22')], rs).id, 'r3');
  assert.equal(E.nextRoutine([done('r3', '2026-10-22')], rs).id, 'r1');
  assert.equal(E.nextRoutine([], []), null);
});

test('giorni consigliati rispetto al piano di corsa', () => {
  const { E } = engine();
  const wk = { sess: [{ day: 1, name: 'Easy + allunghi', hard: false }, { day: 2, name: 'Easy', hard: false }, { day: 3, name: 'Fartlek', hard: true }, { day: 6, name: 'Lungo', hard: true, long: true }] };
  const d = arr(E.suggestDays(wk).map(x => x.day));
  assert.equal(d.length, 2);
  assert.ok(!d.includes(2) && !d.includes(5) && !d.includes(6), `giorni ${d}`);
  assert.ok(d.includes(3));
  const d3 = arr(E.suggestDays(wk, 3).map(x => x.day));
  assert.equal(d3.length, 3);
  assert.ok(!d3.includes(6) && !d3.includes(5) && !d3.includes(2), `giorni ${d3}`);
  const race = { sess: [{ day: 1, name: 'Richiami', hard: true }, { day: 3, name: 'Ritmo gara', hard: true }, { day: 6, name: 'GARA', hard: true, race: true }] };
  assert.deepEqual(arr(E.suggestDays(race, 1).map(x => x.day)), [1]);
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

test('primo avvio: due schede di esempio, nessuna traccia di corsa', () => {
  const { run, els } = app();
  assert.equal(run('state.version'), 4);
  assert.deepEqual(arr(run('state.routines.map(r => r.name)')), ['Total Body A', 'Total Body B']);
  assert.match(els['#main'].innerHTML, /Total Body A/);
  assert.doesNotMatch(els['#main'].innerHTML, /Registra corsa|corse registrate/);
  for (const r of ['schede', 'esercizi', 'progressi']) { run(`navigate("${r}")`); assert.ok(els['#main'].innerHTML.length > 200, r); }
});

test('scheda creata a mano, allenamento, record e rotazione', () => {
  const { run, click, store } = app();
  click('new-routine');
  const id = run('editId');
  assert.equal(run('route'), 'scheda');
  run('picker = { mode: "routine", index: null, sel: [] }; pickApply(["bench-db", "lat-wide", "plank"])');
  assert.equal(run('routineById(editId).exercises.length'), 3);
  assert.equal(run('routineById(editId).exercises[2].lo'), 30); // esercizio a tempo: secondi
  click('rx-sets', { index: '0', d: '1' });
  assert.equal(run('routineById(editId).exercises[0].sets'), 4);
  run('routineById(editId).name = "Spinta e tirata"');
  click('start', { id });
  assert.equal(run('state.active.name'), 'Spinta e tirata');
  assert.equal(run('state.active.exercises[0].sets.length'), 4);
  run('state.active.exercises[0].sets.forEach(x => { x.kg = 20; x.reps = 10; })');
  for (const j of [0, 1, 2, 3]) click('check', { index: '0', set: String(j) });
  assert.equal(run('state.timer.total'), 90);
  run('state.active.exercises[2].sets[0].reps = 40');
  click('check', { index: '2', set: '0' });
  click('set-kind', { index: '0', set: '0' }); // la prima serie diventa riscaldamento
  run('finish({ rpe: 7, note: "", name: "", update: false, saveNew: false })');
  const saved = JSON.parse(store['passo-v1']);
  const h = saved.history[0];
  assert.equal(h.name, 'Spinta e tirata');
  assert.equal(h.routineId, id);
  assert.equal(h.exercises.length, 2);
  assert.equal(run('E.setsCount(state.history[0])'), 4); // 3 di lavoro + 1 plank
  assert.equal(run('E.nextRoutine(state.history, state.routines).name'), 'Total Body A'); // dopo l'ultima si torna alla prima
  // seconda volta più pesante: record e scheda aggiornata con l'allenamento di oggi
  run('startWorkout({ routine: routineById(editId) })');
  assert.equal(run('state.active.exercises[0].presc.kg'), 20);
  run('state.active.exercises[0].sets.forEach(x => { x.kg = 24; x.reps = 10; x.done = true; })');
  run('state.active.exercises = state.active.exercises.slice(0, 1)');
  run('finish({ rpe: 7, note: "", name: "", update: true, saveNew: false })');
  assert.equal(run('state.history[1].records[0].kind'), 'Carico più alto');
  assert.equal(run('routineById(editId).exercises.length'), 1);
});

test('allenamento libero salvato come scheda, ripetizione dallo storico', () => {
  const { run, click } = app();
  click('start-empty');
  assert.equal(run('state.active.name'), 'Allenamento libero');
  run('picker = { mode: "session", index: null, sel: [] }; pickApply(["squat-bb", "calf-single"])');
  assert.equal(run('state.active.exercises.length'), 2);
  run('state.active.exercises[0].sets[0].kg = 60; state.active.exercises[0].sets[0].reps = 8; state.active.exercises[0].sets[0].done = true');
  // sostituzione a metà esercizio: la serie fatta resta, le altre passano al nuovo esercizio
  run('picker = { mode: "replace-session", index: 0, sel: [] }; pickApply(["front-squat"])');
  assert.deepEqual(arr(run('state.active.exercises.map(e => e.variant.id + ":" + e.sets.length)')), ['squat-bb:1', 'front-squat:2', 'calf-single:3']);
  run('finish({ rpe: 8, note: "", name: "Gambe", update: false, saveNew: true })');
  assert.equal(run('state.routines.at(-1).name'), 'Gambe');
  assert.equal(run('state.routines.at(-1).exercises.length'), 1);
  assert.equal(run('state.history[0].routineId'), run('state.routines.at(-1).id'));
  click('repeat', { id: run('state.history[0].id') });
  assert.equal(run('state.active.name'), 'Gambe');
  assert.equal(run('state.active.exercises[0].presc.kg'), 60);
  run('validateBackup(JSON.parse(JSON.stringify(state)))');
});

test('migrazione dalla v3 (programma per movimenti): schede vere, scelte e storico conservati', () => {
  const v3 = {
    version: 3, custom: {}, active: null, timer: null, settings: { sound: false },
    program: { start: '2026-10-26', perWeek: 3, picks: { base: { 'a-squat': 'legpress' } }, template: {
      A: [{ id: 'a-plyo', p: 'salti', sets: 3, when: 'potenza' }, { id: 'a-squat', p: 'squat', sets: 4, when: 'always' }, { id: 'a-core', p: 'coreE', sets: 2, when: 'always' }],
      B: [{ id: 'b-hip', p: 'stacco', sets: 3, when: 'always' }],
      C: [{ id: 'c-x', p: 'bicipiti', sets: 2, when: 'always' }] } },
    history: [{ id: 'g1', type: 'gym', routine: 'A', blockName: 'Base', week: 1, date: '2026-10-27', endedAt: Date.parse('2026-10-27T19:00:00'), minutes: 50, rpe: 7, note: '',
      exercises: [{ variant: { id: 'legpress', name: 'Leg press', gear: 'Macchina', loadType: 'weight' }, presc: { lo: 10, hi: 12, sets: 4 }, sets: [{ kg: 100, reps: 12, done: true }] }] }],
  };
  const { run } = app({ 'passo-v1': JSON.stringify(v3) });
  assert.equal(run('state.version'), 4);
  assert.deepEqual(arr(run('state.routines.map(r => r.name + ":" + r.exercises.map(x => x.ex + "x" + x.sets).join(","))')), ['Total Body A:legpressx4,deadbugx2', 'Total Body B:hip-machinex3', 'Total Body C:curl-dbx2']);
  assert.equal(run('state.settings.goal'), 3);
  assert.equal(run('state.settings.sound'), false);
  assert.equal(run('state.history[0].routineId'), run('state.routines[0].id'));
  assert.equal(run('state.history[0].name'), 'Total Body A');
  assert.equal(run('E.nextRoutine(state.history, state.routines).name'), 'Total Body B');
  assert.equal(run('plannedRoutine(state.routines[0], pos())[0].presc.kg'), 100); // la progressione continua
});

test('migrazione dalla v1 e dalla v2', () => {
  const v1 = { version: 1, routines: {}, plan: [], settings: { sound: true }, active: null, timer: null, history: [
    { id: 'g1', type: 'gym', routine: 'B', date: '2026-10-20', endedAt: Date.parse('2026-10-20T19:00:00'), minutes: 50, rpe: 7, note: '', exercises: [] },
    { id: 'r1', type: 'run', date: '2026-10-21', kind: 'easy', km: 8, minutes: 45, rpe: 4, note: '', endedAt: 1 }] };
  const a = app({ 'passo-v1': JSON.stringify(v1) });
  assert.equal(a.run('state.version'), 4);
  assert.equal(a.run('state.history.length'), 1);
  assert.equal(a.run('state.history[0].name'), 'Total Body B');
  assert.equal(a.run('state.routines.length'), 2);
  const v2 = { version: 2, program: { start: '2026-10-26', picks: { base: { 'b-hip': 'hip-bb' } } }, custom: {}, history: [], active: null, timer: null, settings: { sound: true } };
  const b = app({ 'passo-v1': JSON.stringify(v2) });
  assert.equal(b.run('state.routines[1].exercises[1].ex'), 'hip-bb');
});

test('RunPlan: gli allenamenti entrano come "altri sport" e la settimana del piano è leggibile', () => {
  const store = { 'passo-v1': JSON.stringify({ version: 4, history: [
    { id: 'g1', type: 'gym', routine: 'B', blockName: 'Forza', date: '2026-10-28', startedAt: Date.parse('2026-10-28T18:30:00'), minutes: 47.6, rpe: 7, exercises: [] },
    { id: 'g2', type: 'gym', name: 'Gambe <b>', date: '2026-10-30', startedAt: Date.parse('2026-10-30T18:30:00'), minutes: 40, rpe: 8, exercises: [] }] }) };
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
  assert.deepEqual(acts.map(a => [a.min, a.note, a.src]), [[48, 'Total Body B · Forza', 'passo'], [40, 'Gambe <b>', 'passo']]);
  const last = vm.runInContext('RunPlanGym.runWeek("2027-03-18")', c);
  assert.equal(last.race, true);
  assert.equal(last.isTaper, true);
  assert.deepEqual(arr(last.sess.map(x => x.day)), [3, 6]);
  assert.equal(vm.runInContext('RunPlanGym.runWeek("2020-01-01")', c), null);
  assert.equal(vm.runInContext('typeof RunPlanGym.getRuns', c), 'undefined'); // niente corse nella palestra
  // RunPlan usa allXts() per calendario e carico, mostra la nota con escape, e non manda la palestra al cloud
  const root = [read('index.html'), ...fs.readdirSync(path.join(ROOT, 'js')).map(f => read('js/' + f))].join('\n');
  assert.ok(root.includes('allXts().forEach'));
  assert.ok(root.includes("x.note?' · '+fxEsc(x.note)"));
  assert.ok(!/payload:JSON\.stringify\(\{[^}]*passo/.test(root));
  const sw = read('sw.js');
  for (const f of ['palestra/index.html', 'palestra/app.js', 'palestra/engine.js', 'palestra/data.js', 'palestra/palestra.css', 'gym-bridge.js']) assert.ok(sw.includes(`'${f}'`), f);
  for (const f of sw.match(/'[^':]+\.(?:js|css|html|png|webmanifest)'/g)) assert.ok(fs.existsSync(path.join(ROOT, f.slice(1, -1))), `manca ${f}`);
});

'use strict';
/* Palestra di RunPlan. Schede composte dall'utente scegliendo dal catalogo, allenamenti registrati e
   salvabili, libreria esercizi, statistiche e calendario. L'app suggerisce carichi, ripetizioni,
   progressione e scarico (engine.js). Gira dentro RunPlan in un iframe (?embed=runplan) e dialoga col
   genitore solo tramite RunPlanGym (gym-bridge.js). Dati in localStorage['passo-v1'] sul dispositivo. */
const $ = s => document.querySelector(s);
const clone = x => JSON.parse(JSON.stringify(x));
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const E = GymEngine;
const KEY = 'passo-v1';
const DAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const bridge = (() => {
  try {
    return window.parent !== window && new URLSearchParams(location.search).get('embed') === 'runplan' ? window.parent.RunPlanGym : null;
  } catch {
    return null;
  }
})();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const rid = p => p + uid().replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
const today = () => E.iso(new Date());
const num = n => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(n);
const dateLabel = d => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const dayLabel = d => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const duration = s => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
};
const hoursMin = min => (min >= 60 ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}` : `${Math.round(min)} min`);
const rangeText = (lo, hi) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

/* ---------- stato e migrazione ---------- */
const routineFrom = (name, note, list) => ({
  id: rid('r'), name, note: note || '', updatedAt: Date.now(),
  exercises: list.map(x => ({ id: rid('e'), ex: x.ex, sets: x.sets, lo: x.lo, hi: x.hi, rest: x.rest, note: x.note || '' })),
});
const starterRoutines = () => STARTER_ROUTINES.map(r => routineFrom(r.name, r.note, r.exercises));
const fresh = () => ({ version: 4, routines: starterRoutines(), program: { start: E.monday(today()) }, custom: {}, history: [], active: null, timer: null, settings: { sound: true, goal: 2, deload: true } });
// programma predefinito delle versioni 2-3 (movimenti per seduta), per convertire i dati vecchi
const LEGACY_DEFAULT = {
  A: [['a-squat', 'squat'], ['a-hinge', 'femorali'], ['a-calf', 'polpacci'], ['a-push', 'spintaO'], ['a-pull', 'trazioneV'], ['a-core', 'coreE', 2]],
  B: [['b-single', 'singola'], ['b-hip', 'stacco'], ['b-calf', 'soleo'], ['b-pull', 'trazioneO'], ['b-push', 'spintaV'], ['b-core', 'coreR', 2]],
};
function migrate(s) {
  if (!s || typeof s !== 'object') return fresh();
  if (s.version === 1) {
    // v1 (modulo "Passo"): si tengono solo le sedute di palestra
    const gym = (s.history || []).filter(h => h.type === 'gym');
    const first = gym.map(h => h.date).sort()[0];
    s = { version: 2, program: { start: E.monday(first || today()), picks: {} }, custom: {}, history: gym,
      active: s.active && s.active.type === 'gym' ? s.active : null, timer: s.timer || null, settings: { sound: s.settings?.sound !== false } };
  }
  if (s.version === 2) {
    const tpl = {};
    for (const k of ['A', 'B']) tpl[k] = LEGACY_DEFAULT[k].map(([id, p, sets]) => ({ id, p, sets: sets || 3, when: 'always' }));
    s = { ...s, version: 3, program: { ...s.program, perWeek: 2, template: tpl } };
  }
  if (s.version === 3) {
    // v3 (programma per movimenti, esercizi scelti dall'app) → schede vere, con gli esercizi del blocco
    // Base e le scelte già fatte; lo storico viene agganciato alle nuove schede
    const keys = ['A', 'B', 'C'].slice(0, s.program.perWeek || 2);
    const picks = s.program.picks?.base || {};
    const routines = keys.map(k => routineFrom('Total Body ' + k, '', (s.program.template?.[k] || [])
      .filter(e => e.when !== 'potenza' && LEGACY_PATTERNS[e.p])
      .map(e => { const [ex, lo, hi, rest] = LEGACY_PATTERNS[e.p]; return { ex: picks[e.id] || ex, sets: e.sets, lo, hi, rest }; })));
    const byKey = Object.fromEntries(keys.map((k, i) => [k, routines[i]]));
    const history = (s.history || []).map(h => (h.routineId ? h : { ...h, routineId: byKey[h.routine]?.id || null, name: h.name || 'Total Body ' + (h.routine || 'A') }));
    const active = s.active ? { ...s.active, routineId: byKey[s.active.routine]?.id || null, name: s.active.name || 'Total Body ' + s.active.routine } : null;
    s = { version: 4, routines, program: { start: s.program.start }, custom: s.custom || {}, history, active, timer: s.timer || null,
      settings: { sound: s.settings?.sound !== false, goal: s.program.perWeek || 2, deload: true } };
  }
  if (s.version === 4) return s;
  throw Error('Formato dati non riconosciuto');
}
let state, storageOK = true;
try {
  state = migrate(JSON.parse(localStorage.getItem(KEY)));
} catch {
  state = fresh();
  storageOK = false;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOK = true;
  } catch {
    storageOK = false;
    toast('Salvataggio non riuscito: esporta un backup prima di chiudere.');
  }
  try { bridge?.changed(); } catch {}
}
function toast(s) {
  const t = $('#toast');
  t.textContent = s;
  t.classList.add('show');
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove('show'), 3500);
}

/* ---------- dati derivati ---------- */
const runWeek = d => { try { return bridge?.runWeek?.(d) || null; } catch { return null; } };
const pos = () => E.cycle(state.program.start, today(), runWeek(today()), state.settings.deload !== false);
const exercise = id => EXERCISES[id] || state.custom[id] || null;
const exOrGone = id => exercise(id) || { id, name: 'Esercizio non più in elenco', muscle: '', gear: 'Altro', loadType: 'weight', sec: [] };
const gymHistory = () => state.history.filter(h => h.type === 'gym');
const byEnd = (a, b) => (b.endedAt || 0) - (a.endedAt || 0);
const lastGym = () => gymHistory().sort(byEnd)[0];
const workDone = s => s.exercises.flatMap(e => e.sets).filter(x => x.done && x.kind !== 'warmup');
const routineById = id => state.routines.find(r => r.id === id);
const nameOf = h => h.name || 'Total Body ' + (h.routine || 'A');
const allExercises = () => [...Object.values(EXERCISES), ...Object.values(state.custom)];
const kgOn = v => v.loadType === 'weight' || v.loadType === 'assistance';
const loadLabel = v => ({ weight: 'Kg', assistance: 'Assist.', body: '—', time: '—' })[v.loadType];
const repsLabel = v => (v.loadType === 'time' ? 'Sec' : 'Rip.');
const muscleName = m => MUSCLES[m] || '';
const setText = (v, x) => (kgOn(v) ? `${num(x.kg)}×${x.reps}` : `${x.reps}${v.loadType === 'time' ? ' s' : ''}`);

function prescriptionText(presc, v) {
  if (!presc) return '';
  let t = `${presc.sets} × ${rangeText(presc.lo, presc.hi)}${v.loadType === 'time' ? ' s' : ''}${v.side ? ' per lato' : ''}`;
  if (v.loadType === 'weight' && presc.kg != null) t += ` · ${num(presc.kg)} kg`;
  if (v.loadType === 'assistance' && presc.kg != null) t += ` · ${num(presc.kg)} kg assist.`;
  return t;
}
const TREND = { up: ['↑', 'Progresso'], reps: ['+1', 'Una ripetizione in più'], new: ['nuovo', 'Nuovo range'], deload: ['↓', 'Scarico'], hold: ['=', 'Stesso lavoro'] };
const trendBadge = t => (TREND[t] ? `<span class="trend t-${t}" title="${TREND[t][1]}">${TREND[t][0]}</span>` : '');

// esercizio pronto per l'allenamento, con la prescrizione calcolata dallo storico
function plannedExercise(item, p) {
  const v = exOrGone(item.ex);
  const presc = E.prescribe({ sets: item.sets, reps: [item.lo, item.hi], rest: item.rest }, v, p, state.history);
  return {
    id: uid(), slot: item.id || null, variant: clone(v), target: rangeText(presc.lo, presc.hi), rest: presc.rest, note: item.note || '', presc,
    sets: presc.reps.map(r => ({ kg: kgOn(v) ? presc.kg ?? '' : 0, reps: r, done: false, kind: 'normal' })),
  };
}
const plannedRoutine = (r, p) => r.exercises.map(x => plannedExercise(x, p));
const routineMinutes = r => E.minutes(r.exercises);
const exCounts = () => {
  const c = {};
  for (const h of gymHistory()) for (const e of h.exercises) if (e.sets.some(x => x.done)) c[e.variant.id] = (c[e.variant.id] || 0) + 1;
  return c;
};

/* ---------- navigazione ---------- */
const ROUTES = [['home', 'Oggi'], ['schede', 'Schede'], ['esercizi', 'Esercizi'], ['progressi', 'Progressi']];
let route = location.hash.slice(1) || 'home', editId = null, filt = { q: '', m: '', g: '' }, range = 30, metric = 'durata', calMonth = null, showAll = false;
function navigate(r) {
  route = r;
  if (location.hash.slice(1) !== r) history.replaceState(null, '', '#' + r);
  render();
  window.scrollTo(0, 0);
}
function render() {
  if (route === 'session' && !state.active) route = 'home';
  if (route === 'scheda' && !routineById(editId)) route = 'schede';
  if (![...ROUTES.map(r => r[0]), 'session', 'scheda'].includes(route)) route = 'home';
  const cur = route === 'session' ? 'home' : route === 'scheda' ? 'schede' : route;
  $('#subnav').innerHTML = ROUTES.map(([r, n]) => `<span data-route="${r}" class="${cur === r ? 'on' : ''}">${n}</span>`).join('');
  $('#main').innerHTML = { home, schede, scheda, esercizi, progressi, session }[route]();
  tick();
}

/* ---------- Oggi ---------- */
function home() {
  const p = pos(), a = state.active;
  if (a) {
    const done = workDone(a).length, total = a.exercises.reduce((s, e) => s + e.sets.filter(x => x.kind !== 'warmup').length, 0);
    return `<section class="card hero"><div class="hl">Allenamento in corso</div><div class="hn">${esc(a.name)}</div>
      <div class="hw">${done} di ${total} serie fatte · <span id="elapsed">${duration((Date.now() - a.startedAt) / 1000)}</span></div>
      <button class="btn hbtn" data-action="resume">Riprendi</button></section>${weekCard(p)}${cycleCard(p)}`;
  }
  const r = E.nextRoutine(state.history, state.routines);
  let hero;
  if (r) {
    const list = plannedRoutine(r, p), ups = list.filter(e => e.presc.trend === 'up').length;
    hero = `<section class="card hero">
      <div class="hl">${p.deload ? 'Scarico' : p.deloadOn ? `Settimana ${p.week} di ${CYCLE_WEEKS}` : 'Prossima scheda'}</div>
      <div class="hn">${esc(r.name)}</div>
      <div class="hchips"><span class="hchip">${list.length} esercizi</span><span class="hchip">~${routineMinutes(r)} min</span><span class="hchip">RPE ${esc(p.rpe)}</span>${ups ? `<span class="hchip">${ups} in progressione ↑</span>` : ''}</div>
      ${p.why ? `<div class="hw">${esc(p.why)}</div>` : ''}
      <div class="hlist">${list.map(e => `<div><span class="hn2">${esc(e.variant.name)}</span><b>${esc(prescriptionText(e.presc, e.variant))}</b>${trendBadge(e.presc.trend)}</div>`).join('') || '<div><span class="hn2">La scheda è vuota: aggiungi gli esercizi in Schede.</span></div>'}</div>
      <button class="btn hbtn" data-action="start" data-id="${r.id}">Inizia</button>
      ${state.routines.length > 1 ? `<div class="hother">Oppure ${state.routines.filter(x => x.id !== r.id).map(x => `<button data-action="start" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>` : ''}
    </section>`;
  } else {
    hero = `<section class="card hero"><div class="hl">Palestra</div><div class="hn">Nessuna scheda</div>
      <div class="hw">Crea una scheda scegliendo gli esercizi dal catalogo, oppure allenati libero e salvalo alla fine.</div>
      <button class="btn hbtn" data-action="new-routine">Crea una scheda</button></section>`;
  }
  return `${hero}<div class="grow"><button class="btn btn2" data-action="start-empty">Allenamento libero</button></div>${weekCard(p)}${cycleCard(p)}`;
}
function weekCard(p) {
  const we = E.addDays(p.weekStart, 6);
  const week = gymHistory().filter(h => h.date >= p.weekStart && h.date <= we).sort((a, b) => a.date.localeCompare(b.date));
  const goal = p.race ? 1 : state.settings.goal || 2;
  const sug = E.suggestDays(runWeek(today()), goal);
  const days = sug && sug.length
    ? `<p class="gline"><b>Giorni consigliati</b> ${sug.map(d => `${DAYS[d.day]} <span class="muted">(${d.rest ? 'riposo' : 'dopo ' + esc(d.with.join(', '))})</span>`).join(' · ')}</p>
       <p class="muted">Dal tuo piano di corsa: forza nei giorni duri dopo la corsa o nei giorni di riposo, mai il giorno prima di qualità, lungo o gara.</p>`
    : `<p class="muted">Giorni non consecutivi, mai il giorno prima di una seduta di qualità o del lungo. Il giorno di una seduta dura, la forza va dopo la corsa.</p>`;
  const last = lastGym();
  const since = last ? Math.floor((Date.now() - (last.endedAt || Date.parse(last.date))) / 36e5) : null;
  return `<section class="card"><h2>Questa settimana</h2>
    <div class="gdots">${Array.from({ length: Math.max(goal, week.length) }, (_, i) => `<i class="${i < week.length ? 'done' : ''}">${week[i] ? DAYS[(new Date(week[i].date + 'T12:00:00').getDay() + 6) % 7] : ''}</i>`).join('')}<span><b>${week.length} di ${goal}</b> sedute${since != null ? ` · ultima ${since >= 48 ? Math.floor(since / 24) + ' giorni fa' : since >= 24 ? 'ieri' : since + ' ore fa'}` : ''}</span></div>
    ${days}</section>`;
}
function cycleCard(p) {
  if (!p.deloadOn) return `<section class="card"><h2>Scarico</h2><p class="muted">Settimana di scarico automatica disattivata: si scarica solo in taper e in settimana gara.</p><div class="grow"><button class="btn btn2 mini" data-action="settings">Impostazioni e backup</button></div></section>`;
  return `<section class="card"><h2>Ciclo di 4 settimane</h2>
    <div class="gpips big">${Array.from({ length: CYCLE_WEEKS }, (_, w) => `<i class="${w + 1 < p.week ? 'past' : w + 1 === p.week ? 'now' : ''}${w + 1 === CYCLE_WEEKS ? ' dl' : ''}"><span>${w + 1 === CYCLE_WEEKS ? 'scarico' : 'sett. ' + (w + 1)}</span></i>`).join('')}</div>
    <p class="muted">Tre settimane di carico crescente (RPE 7 → 8) e una di scarico, con una serie in meno e carichi al 90%: serve a recuperare e a ripartire più forte.${p.week < CYCLE_WEEKS ? ` Prossimo scarico dal ${dateLabel(p.nextDeload)}.` : ''}</p>
    <div class="grow"><button class="btn btn2 mini" data-action="settings">Impostazioni e backup</button></div></section>`;
}

/* ---------- Schede ---------- */
function schede() {
  const card = (r, i) => `<section class="card groutine"><div class="ghead"><div><div class="gtitle2">${esc(r.name)}</div>
      <div class="muted">${r.exercises.length} esercizi · ${r.exercises.reduce((n, x) => n + x.sets, 0)} serie · ~${routineMinutes(r)} min</div></div>
      <button class="gicon" data-action="routine-menu" data-id="${r.id}" data-index="${i}" aria-label="Opzioni">•••</button></div>
    ${r.note ? `<p class="muted">${esc(r.note)}</p>` : ''}
    <p class="gexlist">${r.exercises.map(x => esc(exOrGone(x.ex).name)).join(' · ') || '<span class="muted">Ancora nessun esercizio.</span>'}</p>
    <div class="grow"><button class="btn" data-action="start" data-id="${r.id}">Inizia</button><button class="btn btn2" data-action="edit-routine" data-id="${r.id}">Modifica</button></div></section>`;
  return `<div class="grow gtop"><button class="btn" data-action="new-routine">+ Nuova scheda</button><button class="btn btn2" data-action="start-empty">Allenamento libero</button></div>
    ${state.routines.map(card).join('') || '<section class="card"><p class="muted">Nessuna scheda. Creane una o aggiungi quelle di esempio.</p></section>'}
    <div class="grow"><button class="btn btn2 mini" data-action="add-starters">Aggiungi le schede di esempio</button><button class="btn btn2 mini" data-action="settings">Impostazioni e backup</button></div>`;
}
const RESTS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240];
const restLabel = s => (!s ? 'nessuno' : s >= 60 ? `${Math.floor(s / 60)}'${s % 60 ? String(s % 60).padStart(2, '0') + '"' : ''}` : s + '"');
function scheda() {
  const r = routineById(editId);
  const rows = r.exercises.map((x, i) => {
    const v = exOrGone(x.ex);
    const last = E.lastPerformance(v.id, state.history);
    const rests = RESTS.includes(x.rest) ? RESTS : [...RESTS, x.rest].sort((a, b) => a - b);
    return `<section class="card gedit"><div class="ghead"><div><button class="gtitle2 glink" data-action="ex-detail" data-v="${esc(v.id)}">${esc(v.name)}</button>
        <div class="muted">${esc(muscleName(v.muscle))} · ${esc(v.gear)}${last ? ` · ultima volta ${last.sets.map(s => setText(v, s)).join(' ')}` : ''}</div></div>
        <button class="gicon" data-action="rx-menu" data-index="${i}" aria-label="Opzioni">•••</button></div>
      <div class="gform">
        <div><label>Serie</label><div class="gstep"><button data-action="rx-sets" data-index="${i}" data-d="-1" aria-label="Una serie in meno">−</button><b>${x.sets}</b><button data-action="rx-sets" data-index="${i}" data-d="1" aria-label="Una serie in più">+</button></div></div>
        <div><label>${v.loadType === 'time' ? 'Secondi' : 'Ripetizioni'}</label><span class="grng"><input type="number" inputmode="numeric" min="1" max="600" value="${x.lo}" data-rx="lo" data-index="${i}" aria-label="Minimo">–<input type="number" inputmode="numeric" min="1" max="600" value="${x.hi}" data-rx="hi" data-index="${i}" aria-label="Massimo"></span></div>
        <div><label>Recupero</label><select data-rx="rest" data-index="${i}">${rests.map(s => `<option value="${s}" ${s === x.rest ? 'selected' : ''}>${restLabel(s)}</option>`).join('')}</select></div>
      </div>
      <input class="gnote" placeholder="Nota (facoltativa)" maxlength="200" value="${esc(x.note)}" data-rx="note" data-index="${i}"></section>`;
  }).join('');
  return `<section class="card"><label>Nome della scheda</label><input data-rf="name" maxlength="60" value="${esc(r.name)}">
      <label>Nota</label><input data-rf="note" maxlength="200" value="${esc(r.note)}" placeholder="Es. dopo la corsa di qualità">
      <p class="muted gmt">${r.exercises.length} esercizi · ${r.exercises.reduce((n, x) => n + x.sets, 0)} serie · ~${routineMinutes(r)} min. Il range di ripetizioni guida la progressione: quando lo chiudi in tutte le serie, l’app aumenta il carico.</p></section>
    ${rows}
    <button class="btn" data-action="pick-open" data-mode="routine">+ Aggiungi esercizi</button>
    <div class="grow"><button class="btn btn2" data-action="go" data-id="schede">Fatto</button>${state.active ? '' : `<button class="btn btn2" data-action="start" data-id="${r.id}">Inizia ora</button>`}</div>`;
}

/* ---------- catalogo e scelta degli esercizi ---------- */
function filtered() {
  const q = filt.q.trim().toLowerCase();
  return allExercises()
    .filter(v => (!filt.m || v.muscle === filt.m) && (!filt.g || v.gear === filt.g) && (!q || v.name.toLowerCase().includes(q) || muscleName(v.muscle).toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}
const filterBar = () => `<div class="gfilter"><input type="search" id="f-q" placeholder="Cerca esercizio o muscolo" value="${esc(filt.q)}" autocomplete="off">
  <div class="grow2"><select id="f-m" aria-label="Muscolo"><option value="">Tutti i muscoli</option>${Object.entries(MUSCLES).map(([id, n]) => `<option value="${id}" ${filt.m === id ? 'selected' : ''}>${n}</option>`).join('')}</select>
  <select id="f-g" aria-label="Attrezzo"><option value="">Ogni attrezzo</option>${EQUIPMENT.map(g => `<option ${filt.g === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div></div>`;
let picker = null, pickSaved = null; // il catalogo nel popup ha filtri suoi, poi tornano quelli della pagina Esercizi
// picker: { mode: 'routine' | 'session' | 'replace-routine' | 'replace-session', index, sel: [] }
function pickerList() {
  const sel = new Set(picker.sel), multi = !picker.mode.startsWith('replace');
  return filtered().map(v => `<button class="${sel.has(v.id) ? 'on' : ''}" data-action="pick-toggle" data-v="${esc(v.id)}"><span><b>${esc(v.name)}</b><small>${esc(muscleName(v.muscle))} · ${esc(v.gear)}${v.custom ? ' · tuo' : ''}</small></span><i>${multi ? (sel.has(v.id) ? '✓' : '+') : '›'}</i></button>`).join('') || '<p class="muted">Nessun esercizio con questi filtri.</p>';
}
function openPicker(mode, index = null) {
  picker = { mode, index, sel: [] };
  if (!pickSaved) pickSaved = filt;
  filt = { q: '', m: '', g: '' };
  const multi = !mode.startsWith('replace');
  openModal(multi ? 'Aggiungi esercizi' : 'Sostituisci con…', `${filterBar()}<div class="glist gpick" id="pick-list">${pickerList()}</div>
    <div class="gpickbar">${multi ? `<button class="btn" data-action="pick-done" id="pick-done">Aggiungi</button>` : ''}<button class="btn btn2" data-action="custom-new">Nuovo esercizio</button></div>`);
  updatePickDone();
}
function updatePickDone() {
  const b = $('#pick-done');
  if (b) { b.textContent = picker.sel.length ? `Aggiungi (${picker.sel.length})` : 'Aggiungi'; b.disabled = !picker.sel.length; }
}
const defaultItem = id => {
  const v = exOrGone(id), t = v.loadType === 'time';
  return { id: rid('e'), ex: id, sets: 3, lo: t ? 30 : 8, hi: t ? 45 : 12, rest: v.muscle === 'addome' ? 45 : v.muscle === 'polpacci' ? 60 : 90, note: '' };
};
function pickApply(ids) {
  const { mode, index } = picker;
  if (mode === 'routine' || mode === 'replace-routine') {
    const r = routineById(editId);
    if (mode === 'routine') r.exercises.push(...ids.map(defaultItem));
    else r.exercises[index] = { ...r.exercises[index], ex: ids[0] };
    r.updatedAt = Date.now();
  } else if (mode === 'session') {
    const p = { deload: !!state.active.deload };
    for (const id of ids) state.active.exercises.push(plannedExercise(defaultItem(id), p));
  } else if (mode === 'replace-session') replaceInSession(index, exOrGone(ids[0]));
  picker = null;
  save();
  close();
  render();
}
function exerciseDetail(id) {
  const v = exOrGone(id);
  const runs = gymHistory().sort((a, b) => (a.endedAt || 0) - (b.endedAt || 0)).flatMap(h => {
    const sets = h.exercises.filter(e => e.variant.id === id).flatMap(e => e.sets.filter(x => x.done && x.kind !== 'warmup'));
    return sets.length ? [{ h, sets }] : [];
  });
  const w = v.loadType === 'weight', b = E.bests(id, state.history);
  const value = r => (w ? Math.max(...r.sets.map(x => E.e1rm(Number(x.kg) || 0, x.reps))) : Math.max(...r.sets.map(x => x.reps)));
  let chart = '';
  if (runs.length >= 2) {
    const pts = runs.slice(-20), vals = pts.map(value), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const xy = vals.map((y, i) => [40 + (i * 270) / (pts.length - 1), 86 - ((y - lo) / span) * 70]);
    chart = `<svg viewBox="0 0 320 100" class="gchart"><polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--z3)" stroke-width="2.5" stroke-linejoin="round"/>${xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="var(--z3)"/>`).join('')}<text x="2" y="20">${num(Math.round(hi))}</text><text x="2" y="90">${num(Math.round(lo))}</text></svg>
      <p class="muted">${w ? 'Massimale stimato per seduta, in kg (carico e ripetizioni, con 2 in riserva).' : v.loadType === 'time' ? 'Secondi migliori per seduta.' : 'Ripetizioni migliori per seduta.'}</p>`;
  }
  const custom = !!state.custom[id];
  openModal(esc(v.name), `<p class="muted">${esc(muscleName(v.muscle))}${v.sec?.length ? ` · anche ${v.sec.map(muscleName).join(', ').toLowerCase()}` : ''} · ${esc(v.gear)}${v.side ? ' · per lato' : ''}</p>
    ${runs.length ? `<div class="grid3 gstats"><div class="stat"><b>${runs.length}</b><span>sedute</span></div>
      ${w ? `<div class="stat"><b>${num(b.kg)}</b><span>kg max</span></div><div class="stat"><b>${num(Math.round(b.e1rm))}</b><span>massimale stim.</span></div>` : `<div class="stat"><b>${b.reps}</b><span>${v.loadType === 'time' ? 'secondi max' : 'rip. max'}</span></div>`}</div>
      ${chart}<table><tr><th>Data</th><th>Serie</th></tr>${runs.slice(-6).reverse().map(r => `<tr><td>${dateLabel(r.h.date)}</td><td>${r.sets.map(x => setText(v, x)).join(' · ')}</td></tr>`).join('')}</table>`
      : '<p class="muted">Non l’hai ancora fatto: dopo la prima volta qui vedi carichi, record e andamento.</p>'}
    ${custom ? `<div class="grow"><button class="btn btn2" data-action="custom-edit" data-v="${esc(id)}">Modifica</button>${runs.length ? '' : `<button class="btn btn2" data-action="custom-del" data-v="${esc(id)}">Elimina</button>`}</div>` : ''}`);
}
function customForm(v = null) {
  openModal(v ? 'Modifica esercizio' : 'Nuovo esercizio', `<form id="custom-form" data-v="${v ? esc(v.id) : ''}">
    <label>Nome</label><input name="name" required maxlength="80" value="${v ? esc(v.name) : ''}">
    <label>Muscolo principale</label><select name="muscle">${Object.entries(MUSCLES).map(([id, n]) => `<option value="${id}" ${v?.muscle === id ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label>Attrezzo</label><select name="gear">${EQUIPMENT.map(g => `<option ${v?.gear === g ? 'selected' : ''}>${g}</option>`).join('')}</select>
    <label>Si misura in</label><select name="load">${[['weight', 'Kg e ripetizioni'], ['body', 'Ripetizioni (corpo libero)'], ['assistance', 'Kg di assistenza e ripetizioni'], ['time', 'Secondi']].map(([k, n]) => `<option value="${k}" ${v?.loadType === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label class="gtoggle"><input type="checkbox" name="side" ${v?.side ? 'checked' : ''}> Ripetizioni per lato</label>
    <button class="btn">${v ? 'Salva' : 'Crea'}</button></form>`);
}

/* ---------- Esercizi ---------- */
const exList = (list, counts) => list.map(v => `<button data-action="ex-detail" data-v="${esc(v.id)}"><span><b>${esc(v.name)}</b><small>${esc(muscleName(v.muscle))} · ${esc(v.gear)}${state.custom[v.id] ? ' · tuo' : ''}${counts[v.id] ? ` · fatto ${counts[v.id]} ${counts[v.id] === 1 ? 'volta' : 'volte'}` : ''}</small></span><i>›</i></button>`).join('') || '<p class="muted">Nessun esercizio con questi filtri.</p>';
function esercizi() {
  const list = filtered();
  return `<section class="card">${filterBar()}<p class="muted gmt" id="ex-count">${list.length} esercizi${filt.m || filt.g || filt.q ? ' con questi filtri' : ''}.</p></section>
    <div class="grow gtop"><button class="btn btn2" data-action="custom-new">+ Esercizio personalizzato</button></div>
    <section class="card"><div class="glist" id="ex-list">${exList(list, exCounts())}</div></section>`;
}

/* ---------- Progressi: statistiche, muscoli, calendario, storico ---------- */
function progressi() {
  const to = today(), from = E.addDays(to, -(range - 1));
  const hs = gymHistory().filter(h => h.date >= from && h.date <= to);
  const tot = { n: hs.length, min: hs.reduce((s, h) => s + (h.minutes || 0), 0), vol: hs.reduce((s, h) => s + E.volume(h), 0), sets: hs.reduce((s, h) => s + E.setsCount(h), 0) };
  const muscles = E.setsByMuscle(gymHistory(), from, to, exercise);
  const ranked = Object.entries(muscles).sort((a, b) => b[1] - a[1]);
  const maxM = Math.max(1, ...ranked.map(x => x[1]));
  return `<div class="gpills">${[[7, '7 giorni'], [30, '30 giorni'], [90, '3 mesi']].map(([d, n]) => `<span class="pill ${range === d ? 'on' : ''}" data-action="range" data-index="${d}">${n}</span>`).join('')}</div>
    <section class="card"><div class="tiles4"><div class="stat"><b>${tot.n}</b><span>allenamenti</span></div><div class="stat"><b>${hoursMin(tot.min)}</b><span>in palestra</span></div>
      <div class="stat"><b>${num(Math.round(tot.vol / 100) / 10)}</b><span>tonnellate</span></div><div class="stat"><b>${tot.sets}</b><span>serie</span></div></div></section>
    <section class="card"><h2>Andamento settimanale</h2>${weeklyChart()}</section>
    <section class="card"><h2>Serie per muscolo</h2>${ranked.length ? `<div class="gbars">${ranked.map(([m, n]) => `<div><span>${esc(muscleName(m))}</span><i><b style="width:${(n / maxM) * 100}%"></b></i><em>${num(n)}</em></div>`).join('')}</div>
      <p class="muted">1 serie al muscolo principale dell’esercizio, ½ a quelli che lavorano in aiuto. Serie di riscaldamento escluse.</p>` : '<p class="muted">Nessun allenamento in questo periodo.</p>'}</section>
    <section class="card"><h2>Muscoli allenati</h2>${bodyMap(muscles)}</section>
    <section class="card"><h2>Calendario</h2>${calendar()}</section>
    <section class="card"><h2>Storico</h2>${historyList()}</section>`;
}
function weeklyChart() {
  const g = gymHistory();
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const ws = E.addDays(E.monday(today()), -(11 - i) * 7), we = E.addDays(ws, 6);
    const hs = g.filter(h => h.date >= ws && h.date <= we);
    return { ws, n: hs.length, durata: hs.reduce((s, h) => s + (h.minutes || 0), 0), volume: hs.reduce((s, h) => s + E.volume(h), 0) / 1000, serie: hs.reduce((s, h) => s + E.setsCount(h), 0) };
  });
  const max = Math.max(1e-9, ...weeks.map(w => w[metric]));
  const unit = { durata: 'min', volume: 't', serie: 'serie' }[metric];
  const bars = weeks.map((w, i) => {
    const h = (w[metric] / max) * 80, x = 6 + i * 26;
    return `<rect x="${x}" y="${92 - h}" width="18" height="${Math.max(h, w.n ? 2 : 0)}" rx="3" fill="${i === 11 ? 'var(--txt)' : 'var(--z3)'}"/>${i % 2 === 1 ? `<text x="${x + 9}" y="108" text-anchor="middle">${w.ws.slice(8, 10)}/${w.ws.slice(5, 7)}</text>` : ''}`;
  }).join('');
  const cur = weeks[11][metric];
  return `<div class="gpills">${[['durata', 'Durata'], ['volume', 'Volume'], ['serie', 'Serie']].map(([k, n]) => `<span class="pill ${metric === k ? 'on' : ''}" data-action="metric" data-id="${k}">${n}</span>`).join('')}</div>
    <svg viewBox="0 0 320 112" class="gchart" role="img" aria-label="Andamento settimanale">${bars}</svg>
    <p class="muted">Questa settimana: ${metric === 'volume' ? num(Math.round(cur * 10) / 10) : Math.round(cur)} ${unit}. Ultime 12 settimane.</p>`;
}
/* sagoma stilizzata fronte/retro: ogni zona si colora con le serie del periodo */
function bodyMap(ms) {
  const max = Math.max(1, ...Object.values(ms));
  const fill = m => { const v = ms[m] || 0; return v ? `color-mix(in srgb, var(--z3) ${Math.round(25 + (v / max) * 75)}%, var(--soft))` : 'var(--soft)'; };
  const tag = (m, open, close) => `${open} fill="${fill(m)}" data-m="${m}"><title>${muscleName(m)}: ${num(ms[m] || 0)} serie</title>${close}`;
  const ell = (m, [cx, cy, rx, ry]) => tag(m, `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"`, '</ellipse>');
  const rect = (m, [x, y, w, h, r]) => tag(m, `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"`, '</rect>');
  const poly = (m, pts) => tag(m, `<polygon points="${pts}"`, '</polygon>');
  const pair = (m, e) => ell(m, e) + ell(m, [100 - e[0], e[1], e[2], e[3]]);
  const base = `<circle cx="50" cy="13" r="9" fill="var(--line)"/><rect x="45" y="21" width="10" height="6" rx="2" fill="var(--line)"/>
    <ellipse cx="20" cy="93" rx="3.5" ry="5" fill="var(--line)"/><ellipse cx="80" cy="93" rx="3.5" ry="5" fill="var(--line)"/>
    <ellipse cx="41" cy="184" rx="6" ry="4" fill="var(--line)"/><ellipse cx="59" cy="184" rx="6" ry="4" fill="var(--line)"/>`;
  const front = base + poly('trapezi', '39,27 61,27 66,33 34,33') + pair('spalle', [30, 37, 8, 7]) +
    rect('petto', [36.5, 32, 13, 15, 5]) + rect('petto', [50.5, 32, 13, 15, 5]) + pair('bicipiti', [25.5, 54, 5, 11]) +
    pair('avambracci', [22, 76, 4.5, 11]) + rect('addome', [40, 49, 20, 31, 6]) + pair('abduttori', [35, 89, 4, 7]) +
    pair('quadricipiti', [42, 113, 8.5, 23]) + pair('adduttori', [47, 104, 2.6, 11]) + pair('polpacci', [41.5, 155, 5, 18]);
  const back = base + poly('trapezi', '38,27 62,27 67,34 50,50 33,34') + pair('spalle', [30, 37, 8, 7]) +
    poly('dorso', '36,38 48,51 48,70 39,66 34,50') + poly('dorso', '64,38 52,51 52,70 61,66 66,50') + pair('tricipiti', [25.5, 54, 5, 11]) +
    pair('avambracci', [22, 76, 4.5, 11]) + rect('lombari', [42, 68, 16, 13, 4]) + pair('abduttori', [34, 88, 4, 7]) +
    pair('glutei', [43, 92, 8, 8.5]) + pair('femorali', [42, 120, 8, 18]) + pair('polpacci', [41.5, 155, 6, 17]);
  return `<div class="gbody"><figure><svg viewBox="0 0 100 192" role="img" aria-label="Muscoli, davanti">${front}</svg><figcaption>Davanti</figcaption></figure>
    <figure><svg viewBox="0 0 100 192" role="img" aria-label="Muscoli, dietro">${back}</svg><figcaption>Dietro</figcaption></figure></div>
    <p class="muted" id="body-tip">Più è scuro, più serie nel periodo. Tocca una zona per il numero.</p>`;
}
function calendar() {
  const now = new Date();
  const [y, m] = calMonth || [now.getFullYear(), now.getMonth()];
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const by = {};
  for (const h of gymHistory()) (by[h.date] ||= []).push(h);
  const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
  const cells = Array.from({ length: lead }, () => '<span></span>');
  for (let d = 1; d <= days; d++) {
    const iso = `${ym}-${String(d).padStart(2, '0')}`, n = by[iso]?.length || 0;
    cells.push(`<span class="${n ? 'on' : ''} ${iso === today() ? 'today' : ''}" ${n ? `data-action="cal-day" data-id="${iso}"` : ''}>${d}</span>`);
  }
  const monthCount = Object.keys(by).filter(k => k.startsWith(ym)).reduce((s, k) => s + by[k].length, 0);
  // settimane consecutive con almeno un allenamento, fino a questa (o alla scorsa, se questa è ancora vuota)
  let streak = 0, ws = E.monday(today());
  const has = w => gymHistory().some(h => h.date >= w && h.date <= E.addDays(w, 6));
  if (!has(ws)) ws = E.addDays(ws, -7);
  while (has(ws)) { streak++; ws = E.addDays(ws, -7); }
  return `<div class="gcalh"><button class="gicon" data-action="cal-prev" aria-label="Mese precedente">‹</button><b>${MONTHS[m]} ${y}</b><button class="gicon" data-action="cal-next" aria-label="Mese successivo">›</button></div>
    <div class="gcal">${DAYS.map(d => `<em>${d[0].toUpperCase()}</em>`).join('')}${cells.join('')}</div>
    <p class="muted">${monthCount} ${monthCount === 1 ? 'allenamento' : 'allenamenti'} nel mese${streak ? ` · ${streak} ${streak === 1 ? 'settimana' : 'settimane'} di fila con almeno un allenamento` : ''}.</p>`;
}
function historyList() {
  const g = gymHistory().sort((a, b) => b.date.localeCompare(a.date) || byEnd(a, b));
  if (!g.length) return '<p class="muted">Ancora nessun allenamento. Il primo lo trovi in Oggi.</p>';
  const list = showAll ? g : g.slice(0, 8);
  return `<div class="glist">${list.map(h => `<button data-action="detail" data-id="${esc(h.id)}"><span><b>${esc(nameOf(h))}${h.deload ? ' <span class="badge">scarico</span>' : ''}${h.records?.length ? ` <span class="badge pr">${h.records.length} record</span>` : ''}</b><small>${dateLabel(h.date)} · ${Math.round(h.minutes)} min · ${E.setsCount(h)} serie · ${num(Math.round(E.volume(h)))} kg</small></span><i>›</i></button>`).join('')}</div>
    ${g.length > 8 ? `<button class="hlink2" data-action="show-all">${showAll ? 'Mostra meno' : `Mostra tutti (${g.length})`}</button>` : ''}`;
}
function detailModal(id) {
  const h = state.history.find(x => x.id === id);
  if (!h) return;
  openModal(esc(nameOf(h)), `<p class="muted">${dayLabel(h.date)} · ${Math.round(h.minutes)} min · RPE ${h.rpe} · ${num(Math.round(E.volume(h)))} kg sollevati${h.deload ? ' · scarico' : ''}</p>
    ${h.records?.length ? `<div class="grecs">${h.records.map(r => `<div><b>${esc(r.name)}</b><span>${esc(r.kind)}: ${esc(r.value)}</span></div>`).join('')}</div>` : ''}
    ${h.exercises.filter(e => e.sets.some(x => x.done)).map(e => `<div class="gdet"><b>${esc(e.variant.name)}</b><span>${e.sets.filter(x => x.done).map(x => (x.kind === 'warmup' ? 'R ' : '') + setText(e.variant, x)).join(' · ')}</span></div>`).join('')}
    ${h.note ? `<p>${esc(h.note)}</p>` : ''}
    <div class="grow"><button class="btn" data-action="repeat" data-id="${esc(h.id)}">Ripeti</button><button class="btn btn2" data-action="save-as-routine" data-id="${esc(h.id)}">Salva come scheda</button></div>
    <button class="hlink2" data-action="delete" data-id="${esc(h.id)}">Elimina allenamento</button>`);
}

/* ---------- allenamento in corso ---------- */
function session() {
  const a = state.active;
  const total = a.exercises.reduce((s, e) => s + e.sets.filter(x => x.kind !== 'warmup').length, 0), done = workDone(a).length;
  return `<section class="card gsess"><div class="ghead"><div><div class="hl2">${a.deload ? 'Scarico' : a.week ? `Settimana ${a.week} di ${CYCLE_WEEKS}` : 'Allenamento'}</div><div class="gtitle">${esc(a.name)}</div>
      <div class="muted"><span id="elapsed">${duration((Date.now() - a.startedAt) / 1000)}</span> · ${done}/${total} serie · ${num(Math.round(E.volume(a)))} kg</div></div>
      <button class="btn mini" data-action="finish">Termina</button></div>
      <div class="gbar"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
      <div class="grow"><button class="btn btn2 mini" data-action="manual-timer">Timer</button><button class="btn btn2 mini" data-action="pick-open" data-mode="session">+ Esercizi</button><button class="btn btn2 mini" data-action="discard">Annulla</button></div></section>
    ${a.exercises.map((e, i) => exerciseCard(e, i)).join('') || '<section class="card"><p class="muted">Aggiungi il primo esercizio dal catalogo.</p></section>'}
    <button class="btn" data-action="pick-open" data-mode="session">+ Aggiungi esercizi</button>`;
}
function exerciseCard(e, i) {
  const v = e.variant, on = kgOn(v);
  const prev = E.lastPerformance(v.id, state.history);
  let w = 0;
  return `<section class="card gex"><div class="ghead"><div><button class="gtitle2 glink" data-action="ex-detail" data-v="${esc(v.id)}">${esc(v.name)}</button><div class="muted">${e.presc ? esc(prescriptionText(e.presc, v)) : `${esc(e.target)} rip.`} · recupero ${e.rest}"</div></div>
      <button class="gicon" data-action="active-menu" data-index="${i}" aria-label="Opzioni">•••</button></div>
    ${e.presc?.why ? `<p class="gwhy">${trendBadge(e.presc.trend)} ${esc(e.presc.why)}</p>` : ''}${e.note ? `<p class="muted">${esc(e.note)}</p>` : ''}
    <div class="gset gsh"><span>#</span><span>Prima</span><span>${loadLabel(v)}</span><span>${repsLabel(v)}</span><span></span></div>
    ${e.sets.map((x, j) => {
      const warm = x.kind === 'warmup', label = warm ? 'R' : ++w, p = prev && !warm ? prev.sets[w - 1] : null;
      return `<div class="gset ${x.done ? 'done' : ''} ${warm ? 'warm' : ''}"><button class="gnum" data-action="set-kind" data-index="${i}" data-set="${j}" aria-label="Serie ${label}: tocca per segnarla di riscaldamento">${label}</button>
        <span class="muted">${p ? setText(v, p) : '—'}</span>
        <input type="number" inputmode="decimal" min="0" max="2000" step="0.5" ${on ? `value="${x.kg ?? ''}"` : 'disabled value=""'} placeholder="—" data-ex="${i}" data-set="${j}" data-field="kg" aria-label="Carico serie ${label}">
        <input type="number" inputmode="numeric" min="1" max="999" step="1" value="${x.reps ?? ''}" placeholder="${esc(e.target)}" data-ex="${i}" data-set="${j}" data-field="reps" aria-label="${repsLabel(v)} serie ${label}">
        <button class="gcheck ${x.done ? 'on' : ''}" data-action="check" data-index="${i}" data-set="${j}" aria-pressed="${x.done}" aria-label="Serie ${label} fatta">✓</button></div>`;
    }).join('')}
    <div class="grow"><button class="hlink2" data-action="add-set" data-index="${i}">+ Serie</button><button class="hlink2" data-action="swap" data-index="${i}">⇄ Sostituisci</button><button class="hlink2" data-action="rest-edit" data-index="${i}">Recupero ${e.rest}"</button></div></section>`;
}
function startWorkout({ routine = null, exercises = null, name = null }) {
  if (state.active) return navigate('session');
  unlockAudio();
  const p = pos();
  state.active = {
    id: uid(), type: 'gym', routineId: routine?.id || null, name: name || routine?.name || 'Allenamento libero', startedAt: Date.now(), date: today(),
    week: p.deloadOn ? p.week : null, deload: p.deload,
    exercises: exercises || (routine ? plannedRoutine(routine, p) : []),
  };
  save();
  wake();
  navigate('session');
}
// l'allenamento è diverso dalla scheda? (esercizi, ordine o numero di serie fatte)
function differsFromRoutine(a, r) {
  const ex = a.exercises.filter(e => e.sets.some(x => x.done && x.kind !== 'warmup'));
  if (ex.length !== r.exercises.length) return true;
  return ex.some((e, i) => e.variant.id !== r.exercises[i].ex || e.sets.filter(x => x.done && x.kind !== 'warmup').length !== r.exercises[i].sets);
}
const itemsFrom = exs => exs.filter(e => e.sets.some(x => x.done && x.kind !== 'warmup')).map(e => {
  const [lo, hi] = e.presc ? [e.presc.lo, e.presc.hi] : E.parseRange(e.target);
  return { ex: e.variant.id, sets: e.sets.filter(x => x.done && x.kind !== 'warmup').length, lo, hi, rest: e.rest, note: e.note || '' };
});
function finish({ rpe, note, name, update, saveNew }) {
  const a = clone(state.active);
  a.exercises = a.exercises.map(e => ({ ...e, sets: e.sets.filter(x => x.done) })).filter(e => e.sets.length);
  a.endedAt = Date.now();
  a.minutes = Math.max(1, Math.round((a.endedAt - a.startedAt) / 60000));
  a.rpe = rpe;
  a.note = note;
  if (name) a.name = name;
  a.records = E.records(a, state.history);
  const r = routineById(a.routineId);
  if (update && r) { r.exercises = itemsFrom(a.exercises).map(x => ({ id: rid('e'), ...x })); r.updatedAt = Date.now(); }
  if (saveNew) { const nr = routineFrom(a.name, '', itemsFrom(a.exercises)); state.routines.push(nr); a.routineId = nr.id; }
  state.history.push(a);
  state.active = null;
  state.timer = null;
  save();
  navigate('home');
  summaryModal(a);
}
function summaryModal(h) {
  openModal('Allenamento salvato', `<div class="grid3 gstats"><div class="stat"><b>${hoursMin(h.minutes)}</b><span>durata</span></div><div class="stat"><b>${E.setsCount(h)}</b><span>serie</span></div><div class="stat"><b>${num(Math.round(E.volume(h)))}</b><span>kg sollevati</span></div></div>
    ${h.records.length ? `<h2 class="mh2">Record personali</h2><div class="grecs">${h.records.map(r => `<div><b>${esc(r.name)}</b><span>${esc(r.kind)}: ${esc(r.value)}</span></div>`).join('')}</div>` : '<p class="muted">Nessun record questa volta. Il prossimo allenamento è già pronto in Oggi.</p>'}
    <button class="btn" data-action="close">Fatto</button>`);
}
function replaceInSession(i, v) {
  const e = state.active.exercises[i];
  const remaining = e.sets.filter(x => !x.done && x.kind !== 'warmup').length, completed = e.sets.filter(x => x.done);
  if (v.id === e.variant.id) return;
  if (!remaining && completed.length) return toast('Tutte le serie sono fatte: aggiungi una serie prima di sostituire.');
  const [lo, hi] = e.presc ? [e.presc.lo, e.presc.hi] : E.parseRange(e.target);
  const repl = plannedExercise({ ex: v.id, sets: Math.max(1, remaining), lo, hi, rest: e.rest, note: e.note }, { deload: !!state.active.deload });
  if (completed.length) { e.sets = completed; state.active.exercises.splice(i + 1, 0, repl); }
  else state.active.exercises[i] = repl;
}

/* ---------- finestre, impostazioni, backup ---------- */
function openModal(title, body) {
  $('#modal').innerHTML = `<div class="mhead"><h2>${title}</h2><button class="gicon" data-action="close" aria-label="Chiudi">×</button></div>${body}`;
  if (!$('#modal').open) $('#modal').showModal();
}
const close = () => { if ($('#modal').open) $('#modal').close(); };
$('#modal').addEventListener('close', () => { if (pickSaved) { filt = pickSaved; pickSaved = null; } });
let confirmation = null;
function confirmAction(title, text, fn) {
  confirmation = fn;
  openModal(title, `<p class="muted">${text}</p><div class="grow"><button class="btn btn2" data-action="close">Indietro</button><button class="btn" data-action="confirm">Conferma</button></div>`);
}
function settingsModal() {
  const p = pos();
  openModal('Impostazioni', `<label>Obiettivo: allenamenti a settimana</label><select id="goal-setting">${[1, 2, 3, 4, 5].map(n => `<option ${n === (state.settings.goal || 2) ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label class="gtoggle"><input type="checkbox" id="deload-setting" ${state.settings.deload !== false ? 'checked' : ''}> Settimana di scarico ogni 4</label>
    ${state.settings.deload !== false ? `<label>Questa settimana è la</label><select id="cycle-week">${[1, 2, 3, 4].map(w => `<option value="${w}" ${w === p.week ? 'selected' : ''}>${w}ª${w === 4 ? ' (scarico)' : ''}</option>`).join('')}</select>` : ''}
    <p class="muted">In taper e in settimana gara della corsa lo scarico scatta comunque.</p>
    <label class="gtoggle"><input type="checkbox" id="sound-setting" ${state.settings.sound ? 'checked' : ''}> Suono a fine recupero</label>
    <h2 class="mh2">Backup</h2><p class="muted">Gli allenamenti stanno su questo dispositivo (Safari e app nella Home hanno archivi separati). In RunPlan entrano nel calendario e nel carico, ma non vanno nel cloud: esporta un backup ogni tanto.</p>
    <div class="grow"><button class="btn btn2" data-action="export">Esporta backup</button><label class="btn btn2 gfile">Importa backup<input id="import-file" type="file" accept="application/json,.json" hidden></label></div>
    <p class="muted">${gymHistory().length} allenamenti · ${state.routines.length} schede${storageOK ? '' : ' · archivio locale non disponibile: esporta subito'}.</p>`);
}
function validateBackup(raw) {
  const s = migrate(raw);
  const ok = x => { if (!x) throw Error('Backup non valido'); };
  const n = (x, a, b) => typeof x === 'number' && Number.isFinite(x) && x >= a && x <= b;
  const id = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
  ok(s.version === 4 && s.program && /^\d{4}-\d{2}-\d{2}$/.test(s.program.start) && s.settings && Array.isArray(s.routines) && s.routines.length <= 100 && Array.isArray(s.history) && s.history.length <= 10000);
  for (const r of s.routines) {
    ok(id(r.id) && typeof r.name === 'string' && r.name.length <= 80 && Array.isArray(r.exercises) && r.exercises.length <= 60);
    r.exercises.forEach(x => ok(x && typeof x.ex === 'string' && Number.isInteger(x.sets) && n(x.sets, 1, 20) && n(x.lo, 1, 600) && n(x.hi, x.lo, 600) && n(x.rest, 0, 900)));
  }
  const variant = v => ok(v && typeof v.id === 'string' && v.id.length <= 100 && typeof v.name === 'string' && v.name.length <= 90 && ['weight', 'body', 'assistance', 'time'].includes(v.loadType));
  const sets = l => { ok(Array.isArray(l) && l.length <= 50); l.forEach(x => ok(x && typeof x.done === 'boolean' && (!x.done || (n(x.reps, 1, 999) && n(Number(x.kg) || 0, 0, 2000))))); };
  for (const h of s.history) {
    ok(id(h.id) && h.type === 'gym' && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && n(h.minutes, 0.1, 1e6) && n(h.rpe, 1, 10) && Array.isArray(h.exercises));
    h.exercises.forEach(e => { variant(e.variant); sets(e.sets); });
  }
  for (const v of Object.values(s.custom || {})) variant(v);
  if (s.active) { ok(Array.isArray(s.active.exercises)); s.active.exercises.forEach(e => { variant(e.variant); sets(e.sets); }); }
  return s;
}

/* ---------- timer di recupero ---------- */
let audioCtx;
function unlockAudio() { try { audioCtx ??= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch {} }
async function wake() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible' && state.active) await navigator.wakeLock.request('screen'); } catch {} }
function startTimer(sec) { state.timer = { end: Date.now() + sec * 1000, total: sec }; save(); tick(); }
function tick() {
  if ($('#elapsed') && state.active) $('#elapsed').textContent = duration((Date.now() - state.active.startedAt) / 1000);
  const t = state.timer;
  if (!t) { $('#timer').innerHTML = ''; return; }
  const left = Math.ceil((t.end - Date.now()) / 1000);
  if (left <= 0) {
    state.timer = null;
    save();
    $('#timer').innerHTML = '';
    toast('Recupero finito: prossima serie.');
    if (state.settings.sound && audioCtx) {
      try { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); g.gain.value = 0.12; o.frequency.value = 660; o.start(); o.stop(audioCtx.currentTime + 0.35); } catch {}
    }
    navigator.vibrate?.([150, 100, 150]);
    return;
  }
  $('#timer').innerHTML = `<div class="gtimer"><div><small>Recupero</small><b role="timer">${duration(left)}</b></div><button data-action="timer-minus">−15</button><button data-action="timer-plus">+15</button><button data-action="timer-skip">Salta</button></div>`;
}
setInterval(tick, 1000);
document.addEventListener('visibilitychange', () => { tick(); wake(); });

/* ---------- eventi ---------- */
document.addEventListener('click', ev => {
  const nav = ev.target.closest('[data-route]');
  if (nav) return navigate(nav.dataset.route);
  const b = ev.target.closest('[data-action]');
  if (!b) {
    const m = ev.target.closest('[data-m]');
    if (m && $('#body-tip')) $('#body-tip').textContent = m.querySelector('title')?.textContent || '';
    return;
  }
  const act = b.dataset.action, k = b.dataset.id, i = Number(b.dataset.index), j = Number(b.dataset.set);
  if (act === 'close') { picker = null; return close(); }
  if (act === 'confirm') { const fn = confirmation; confirmation = null; close(); return fn?.(); }
  if (act === 'go') return navigate(k);
  if (act === 'start') { close(); return startWorkout({ routine: routineById(k) }); }
  if (act === 'start-empty') return startWorkout({});
  if (act === 'resume') return navigate('session');
  if (act === 'settings') return settingsModal();
  // schede
  if (act === 'new-routine') { const r = routineFrom('Nuova scheda', '', []); state.routines.push(r); save(); editId = r.id; return navigate('scheda'); }
  if (act === 'edit-routine') { editId = k; return navigate('scheda'); }
  if (act === 'add-starters') { state.routines.push(...starterRoutines()); save(); render(); return toast('Aggiunte le schede di esempio: modificale come vuoi.'); }
  if (act === 'routine-menu')
    return openModal(esc(routineById(k).name), `<div class="glist"><button data-action="routine-dup" data-id="${k}"><span><b>Duplica</b></span><i>⧉</i></button>
      <button data-action="routine-move" data-id="${k}" data-index="${i}" data-d="-1"><span><b>Sposta su</b></span><i>↑</i></button><button data-action="routine-move" data-id="${k}" data-index="${i}" data-d="1"><span><b>Sposta giù</b></span><i>↓</i></button>
      <button data-action="routine-del" data-id="${k}"><span><b>Elimina</b><small>Gli allenamenti già fatti restano nello storico.</small></span><i>×</i></button></div>`);
  if (act === 'routine-dup') { const r = clone(routineById(k)); r.id = rid('r'); r.name += ' (copia)'; r.exercises.forEach(x => (x.id = rid('e'))); state.routines.push(r); save(); close(); return render(); }
  if (act === 'routine-move') { const l = state.routines, t = i + Number(b.dataset.d); if (t >= 0 && t < l.length) [l[i], l[t]] = [l[t], l[i]]; save(); close(); return render(); }
  if (act === 'routine-del') return confirmAction('Eliminare la scheda?', 'Gli allenamenti già fatti restano nello storico.', () => { state.routines = state.routines.filter(r => r.id !== k); save(); render(); });
  if (act === 'rx-sets') { const r = routineById(editId), x = r.exercises[i]; x.sets = Math.min(20, Math.max(1, x.sets + Number(b.dataset.d))); r.updatedAt = Date.now(); save(); return render(); }
  if (act === 'rx-menu')
    return openModal(esc(exOrGone(routineById(editId).exercises[i].ex).name), `<div class="glist"><button data-action="rx-move" data-index="${i}" data-d="-1"><span><b>Sposta su</b></span><i>↑</i></button><button data-action="rx-move" data-index="${i}" data-d="1"><span><b>Sposta giù</b></span><i>↓</i></button>
      <button data-action="pick-open" data-mode="replace-routine" data-index="${i}"><span><b>Sostituisci</b><small>Serie, ripetizioni e recupero restano.</small></span><i>⇄</i></button>
      <button data-action="rx-del" data-index="${i}"><span><b>Togli dalla scheda</b></span><i>×</i></button></div>`);
  if (act === 'rx-move') { const l = routineById(editId).exercises, t = i + Number(b.dataset.d); if (t >= 0 && t < l.length) [l[i], l[t]] = [l[t], l[i]]; save(); close(); return render(); }
  if (act === 'rx-del') { routineById(editId).exercises.splice(i, 1); save(); close(); return render(); }
  // catalogo
  if (act === 'pick-open') return openPicker(b.dataset.mode, Number.isFinite(i) ? i : null);
  if (act === 'pick-toggle') {
    const v = b.dataset.v;
    if (picker.mode.startsWith('replace')) return pickApply([v]);
    picker.sel = picker.sel.includes(v) ? picker.sel.filter(x => x !== v) : [...picker.sel, v];
    b.classList.toggle('on', picker.sel.includes(v));
    b.querySelector('i').textContent = picker.sel.includes(v) ? '✓' : '+';
    return updatePickDone();
  }
  if (act === 'pick-done') return picker.sel.length && pickApply(picker.sel);
  if (act === 'custom-new') return customForm();
  if (act === 'ex-detail') return exerciseDetail(b.dataset.v);
  if (act === 'custom-edit') return customForm(state.custom[b.dataset.v]);
  if (act === 'custom-del') return confirmAction('Eliminare l’esercizio?', 'Sparisce dal catalogo e dalle schede che lo contengono.', () => {
    delete state.custom[b.dataset.v];
    state.routines.forEach(r => (r.exercises = r.exercises.filter(x => x.ex !== b.dataset.v)));
    save(); render();
  });
  // progressi
  if (act === 'range') { range = i; return render(); }
  if (act === 'metric') { metric = k; return render(); }
  if (act === 'cal-prev' || act === 'cal-next') {
    const now = new Date(), [y, m] = calMonth || [now.getFullYear(), now.getMonth()], d = new Date(y, m + (act === 'cal-next' ? 1 : -1), 1);
    calMonth = [d.getFullYear(), d.getMonth()];
    return render();
  }
  if (act === 'cal-day') {
    const hs = gymHistory().filter(h => h.date === k);
    return hs.length === 1 ? detailModal(hs[0].id) : openModal(dayLabel(k), `<div class="glist">${hs.map(h => `<button data-action="detail" data-id="${esc(h.id)}"><span><b>${esc(nameOf(h))}</b><small>${Math.round(h.minutes)} min</small></span><i>›</i></button>`).join('')}</div>`);
  }
  if (act === 'show-all') { showAll = !showAll; return render(); }
  if (act === 'detail') return detailModal(k);
  if (act === 'repeat') {
    const h = state.history.find(x => x.id === k), r = routineById(h.routineId), p = pos();
    close();
    // se la scheda d'origine c'è ancora ed è uguale, si riparte da lei (stessa rotazione); altrimenti si copia l'allenamento
    return r && !differsFromRoutine(h, r) ? startWorkout({ routine: r }) : startWorkout({ name: nameOf(h), exercises: itemsFrom(h.exercises).map(x => plannedExercise(x, p)) });
  }
  if (act === 'save-as-routine') { const h = state.history.find(x => x.id === k); state.routines.push(routineFrom(nameOf(h), '', itemsFrom(h.exercises))); save(); close(); render(); return toast('Salvato fra le schede.'); }
  if (act === 'delete') return confirmAction('Eliminare l’allenamento?', 'Sparisce dallo storico, dalle statistiche e dal carico di RunPlan.', () => { state.history = state.history.filter(h => h.id !== k); save(); render(); });
  if (act === 'export') {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `palestra-backup-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return;
  }
  if (act === 'timer-plus' || act === 'timer-minus') { if (state.timer) { state.timer.end += act === 'timer-plus' ? 15000 : -15000; save(); tick(); } return; }
  if (act === 'timer-skip') { state.timer = null; save(); return tick(); }
  // allenamento in corso
  if (!state.active) return;
  if (act === 'finish') {
    const n = workDone(state.active).length;
    if (!n) return toast('Spunta almeno una serie prima di salvare.');
    const r = routineById(state.active.routineId), changed = r && differsFromRoutine(state.active, r);
    return openModal('Fine allenamento', `<p class="muted">${n} serie in ${duration((Date.now() - state.active.startedAt) / 1000)}. Le serie non spuntate non vengono salvate.</p>
      <form id="finish-form"><label>Nome</label><input name="name" maxlength="60" value="${esc(state.active.name)}">
      <label>Fatica complessiva · RPE da 1 a 10</label><input name="rpe" type="number" min="1" max="10" value="7" required>
      <label>Note</label><input name="note" maxlength="500" placeholder="Gambe, energia, prossima corsa…">
      ${changed ? `<label class="gtoggle"><input type="checkbox" name="update"> Aggiorna la scheda «${esc(r.name)}» con esercizi e serie di oggi</label>` : ''}
      ${!r ? `<label class="gtoggle"><input type="checkbox" name="saveNew"> Salvalo anche come nuova scheda</label>` : ''}
      <button class="btn">Salva allenamento</button></form><p class="muted">Con RPE 9–10 la prossima volta non aumento i carichi.</p>`);
  }
  if (act === 'discard') return confirmAction('Annullare l’allenamento?', 'Le serie di oggi non verranno salvate.', () => { state.active = null; state.timer = null; save(); navigate('home'); });
  if (act === 'manual-timer') return openModal('Timer', `<form id="timer-form"><label>Secondi</label><input name="seconds" type="number" min="5" max="3600" value="90" required><button class="btn">Avvia</button></form>`);
  if (act === 'swap') return openPicker('replace-session', i);
  const e = state.active.exercises[i];
  if (!e) return;
  if (act === 'check') {
    const x = e.sets[j];
    if (!x.done) {
      unlockAudio();
      if (!Number.isInteger(Number(x.reps)) || Number(x.reps) < 1) return toast(`Scrivi ${e.variant.loadType === 'time' ? 'i secondi' : 'le ripetizioni'} prima di spuntare.`);
      const on = kgOn(e.variant);
      if (on && (x.kg === '' || !Number.isFinite(Number(x.kg)) || Number(x.kg) < 0)) return toast('Scrivi il carico (0 se senza peso).');
      x.reps = Number(x.reps);
      x.kg = on ? Number(x.kg) || 0 : 0;
      x.done = true;
      // la serie dopo parte da quanto hai appena fatto, se non l'hai già modificata
      const nx = e.sets[j + 1];
      if (nx && !nx.done && on && x.kind !== 'warmup' && (nx.kg === '' || nx.kg === e.presc?.kg)) nx.kg = x.kg;
      if (e.rest > 0 && x.kind !== 'warmup') startTimer(e.rest);
    } else x.done = false;
    save();
    return render();
  }
  if (act === 'set-kind') { const x = e.sets[j]; x.kind = x.kind === 'warmup' ? 'normal' : 'warmup'; save(); return render(); }
  if (act === 'add-set') {
    const last = e.sets[e.sets.length - 1];
    e.sets.push({ kg: last?.kg ?? '', reps: last?.reps ?? '', done: false, kind: 'normal' });
    save();
    return render();
  }
  if (act === 'add-warmup') {
    const first = e.sets.find(x => x.kind !== 'warmup');
    const kg = kgOn(e.variant) && Number(first?.kg) ? E.round(Number(first.kg) * 0.5, e.variant, -1) : kgOn(e.variant) ? '' : 0;
    e.sets.unshift({ kg, reps: 10, done: false, kind: 'warmup' });
    save(); close(); return render();
  }
  if (act === 'rest-edit') return openModal('Recupero', `<form id="rest-form" data-index="${i}"><label>Secondi</label><input name="seconds" type="number" min="0" max="900" value="${e.rest}" required><button class="btn">Salva</button></form>`);
  if (act === 'active-menu')
    return openModal(esc(e.variant.name), `<div class="glist"><button data-action="add-warmup" data-index="${i}"><span><b>Aggiungi serie di riscaldamento</b><small>Al 50% del carico; non conta nelle statistiche.</small></span><i>R</i></button>
      <button data-action="active-move" data-index="${i}" data-dir="-1"><span><b>Sposta su</b></span><i>↑</i></button><button data-action="active-move" data-index="${i}" data-dir="1"><span><b>Sposta giù</b></span><i>↓</i></button>
      <button data-action="remove-last-set" data-index="${i}"><span><b>Togli l’ultima serie non fatta</b></span><i>−</i></button><button data-action="remove-active" data-index="${i}"><span><b>Togli l’esercizio</b></span><i>×</i></button></div>`);
  if (act === 'active-move') { const l = state.active.exercises, t = i + Number(b.dataset.dir); if (t >= 0 && t < l.length) [l[i], l[t]] = [l[t], l[i]]; save(); close(); return render(); }
  if (act === 'remove-last-set') {
    const n = e.sets.findLastIndex(x => !x.done);
    if (n < 0 || e.sets.length <= 1) return toast('Nessuna serie da togliere.');
    e.sets.splice(n, 1);
    save(); close(); return render();
  }
  if (act === 'remove-active') return confirmAction('Togliere l’esercizio?', e.sets.some(x => x.done) ? 'Anche le serie già fatte di questo esercizio verranno tolte.' : 'Solo dall’allenamento di oggi.', () => { state.active.exercises.splice(i, 1); save(); render(); });
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.id === 'f-q') {
    filt.q = t.value;
    if (picker && $('#pick-list')) $('#pick-list').innerHTML = pickerList();
    else if ($('#ex-list')) { const l = filtered(); $('#ex-list').innerHTML = exList(l, exCounts()); $('#ex-count').textContent = `${l.length} esercizi${filt.m || filt.g || filt.q ? ' con questi filtri' : ''}.`; }
    return;
  }
  if (t.dataset.rf && route === 'scheda') { const r = routineById(editId); r[t.dataset.rf] = t.value; r.updatedAt = Date.now(); return save(); }
  if (t.dataset.rx && route === 'scheda' && t.dataset.rx !== 'rest') {
    const x = routineById(editId).exercises[+t.dataset.index], f = t.dataset.rx;
    if (f === 'note') x.note = t.value;
    else if (t.value !== '' && Number(t.value) >= 1) x[f] = Math.round(Number(t.value));
    routineById(editId).updatedAt = Date.now();
    return save();
  }
  if (!t.matches('[data-field]') || !state.active) return;
  const x = state.active.exercises[+t.dataset.ex].sets[+t.dataset.set];
  x[t.dataset.field] = t.value === '' ? '' : Number(t.value);
  if (x.done) {
    x.done = false;
    const row = t.closest('.gset');
    row.classList.remove('done');
    row.querySelector('.gcheck').classList.remove('on');
  }
  save();
});
document.addEventListener('change', async ev => {
  const t = ev.target;
  if (t.id === 'f-m' || t.id === 'f-g') {
    filt[t.id === 'f-m' ? 'm' : 'g'] = t.value;
    if (picker && $('#pick-list')) { $('#pick-list').innerHTML = pickerList(); return; }
    return render();
  }
  if (t.dataset.rx && route === 'scheda') {
    const x = routineById(editId).exercises[+t.dataset.index];
    if (t.dataset.rx === 'rest') x.rest = +t.value;
    if (x.hi < x.lo) [x.lo, x.hi] = [x.hi, x.lo]; // il massimo non può stare sotto il minimo
    save();
    return render();
  }
  if (t.id === 'goal-setting') { state.settings.goal = +t.value; save(); return render(); }
  if (t.id === 'deload-setting') { state.settings.deload = t.checked; save(); render(); return settingsModal(); }
  if (t.id === 'cycle-week') { state.program.start = E.addDays(E.monday(today()), -(+t.value - 1) * 7); save(); render(); return toast(`Ciclo aggiornato: settimana ${t.value}.`); }
  if (t.id === 'sound-setting') { state.settings.sound = t.checked; if (t.checked) unlockAudio(); return save(); }
  if (t.id === 'import-file' && t.files[0]) {
    try {
      if (t.files[0].size > 10e6) throw Error();
      const data = validateBackup(JSON.parse(await t.files[0].text()));
      confirmAction('Importare il backup?', `${data.history.length} allenamenti e ${data.routines.length} schede. Sostituisce tutto quello che c’è su questo dispositivo.`, () => { state = data; save(); render(); toast('Backup importato.'); });
    } catch {
      toast('Backup non valido: i dati attuali sono intatti.');
    }
  }
});
document.addEventListener('submit', ev => {
  const f = ev.target;
  if (!f.closest('#modal')) return;
  ev.preventDefault();
  if (!f.reportValidity()) return;
  const d = Object.fromEntries(new FormData(f));
  if (f.id === 'finish-form') return finish({ rpe: Math.round(+d.rpe), note: d.note || '', name: (d.name || '').trim(), update: !!d.update, saveNew: !!d.saveNew });
  if (f.id === 'timer-form') { unlockAudio(); startTimer(+d.seconds); return close(); }
  if (f.id === 'rest-form') { state.active.exercises[+f.dataset.index].rest = +d.seconds; save(); close(); return render(); }
  if (f.id === 'custom-form') {
    const old = f.dataset.v;
    const v = { id: old || rid('c-'), name: d.name.trim(), muscle: d.muscle, gear: d.gear, loadType: d.load, side: !!d.side, sec: [], custom: true };
    state.custom[v.id] = v;
    save();
    if (old) { close(); render(); return toast('Esercizio aggiornato.'); }
    if (picker) {
      // creato dal selettore: si torna al selettore con l'esercizio già scelto
      const { mode, index } = picker;
      if (mode.startsWith('replace')) { picker = { mode, index, sel: [] }; return pickApply([v.id]); }
      openPicker(mode, index);
      picker.sel = [v.id];
      $('#pick-list').innerHTML = pickerList();
      return updatePickDone();
    }
    close();
    render();
    return toast('Esercizio creato.');
  }
});
$('#modal').addEventListener('click', e => {
  if (e.target !== $('#modal')) return;
  const r = $('#modal').getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { picker = null; close(); }
});
window.addEventListener('hashchange', () => { route = location.hash.slice(1) || 'home'; render(); });

/* ---------- tema: segue RunPlan ---------- */
function syncTheme() {
  let dark = false;
  try { dark = bridge ? bridge.isDark() : localStorage.getItem('rp_theme') === 'dark'; } catch {}
  document.body.classList.toggle('dark', dark);
}
syncTheme();
if (bridge) {
  document.body.classList.add('embedded');
  try { new MutationObserver(syncTheme).observe(window.parent.document.body, { attributes: true, attributeFilter: ['class'] }); } catch {}
}
render();
wake();

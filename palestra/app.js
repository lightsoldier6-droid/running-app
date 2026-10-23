'use strict';
/* Palestra di RunPlan: programma Total Body A/B a blocchi di 4 settimane, registro delle serie, timer.
   Gira dentro RunPlan in un iframe (?embed=runplan) e dialoga col genitore solo tramite RunPlanGym
   (gym-bridge.js). I dati stanno in localStorage['passo-v1'] su questo dispositivo. */
const $ = s => document.querySelector(s);
const clone = x => JSON.parse(JSON.stringify(x));
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const E = GymEngine;
const KEY = 'passo-v1';
const DAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const GROUPS = ['Gambe', 'Polpacci', 'Salti', 'Petto', 'Dorso', 'Spalle', 'Braccia', 'Core'];

const bridge = (() => {
  try {
    return window.parent !== window && new URLSearchParams(location.search).get('embed') === 'runplan' ? window.parent.RunPlanGym : null;
  } catch {
    return null;
  }
})();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const today = () => E.iso(new Date());
const num = n => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(n);
const dateLabel = d => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const duration = s => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
};

/* ---------- stato e migrazione ---------- */
const templateOf = name => clone({ A: TEMPLATES[name].A, B: TEMPLATES[name].B, C: TEMPLATES[name].C });
const fresh = () => ({ version: 3, program: { start: E.monday(today()), picks: {}, perWeek: 2, template: templateOf('equilibrato') }, custom: {}, history: [], active: null, timer: null, settings: { sound: true } });
function migrate(s) {
  if (!s || typeof s !== 'object') return fresh();
  if (s.version === 1) {
    // v1 (modulo "Passo"): si tengono solo le sedute di palestra; il programma riparte dal blocco 1
    const gym = (s.history || []).filter(h => h.type === 'gym');
    const first = gym.map(h => h.date).sort()[0];
    s = { version: 2, program: { start: E.monday(first || today()), picks: {} }, custom: {}, history: gym,
      active: s.active && s.active.type === 'gym' ? s.active : null, timer: s.timer || null, settings: { sound: s.settings?.sound !== false } };
  }
  if (s.version === 2) {
    // v2: schede fisse A/B. Da v3 il programma (movimenti e serie) lo decide l'utente; si parte da
    // quello che c'era, con gli stessi id delle voci così le scelte di esercizio restano valide
    s = { ...s, version: 3, program: { ...s.program, perWeek: 2, template: templateOf('equilibrato') } };
  }
  if (s.version === 3) return s;
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

/* ---------- programma ---------- */
const runWeek = d => { try { return bridge?.runWeek?.(d) || null; } catch { return null; } };
const pos = () => E.position(BLOCKS, state.program.start, today(), runWeek(today()));
const routineKeys = () => ROUTINE_KEYS.slice(0, state.program.perWeek || 2);
const exercise = id => EXERCISES[id] || state.custom[id];
const pickOf = (block, slot) => state.program.picks?.[block.id]?.[slot.id] || slot.ex;
const variantsOf = slot => [slot.ex, ...slot.alt].map(exercise).filter(Boolean);
const gymHistory = () => state.history.filter(h => h.type === 'gym');
const lastGym = () => gymHistory().sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0))[0];
const doneSets = s => s.exercises.flatMap(e => e.sets).filter(x => x.done);
const rangeText = (lo, hi) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

const slotsFor = (p, routine) => E.buildSlots(state.program.template[routine], p.block.id, { race: p.race });
function prescriptionText(presc, v) {
  if (!presc) return '';
  let t = `${presc.sets} × ${rangeText(presc.lo, presc.hi)}${v.side ? ' per lato' : ''}`;
  if (v.loadType === 'weight') t += presc.kg != null ? ` · ${num(presc.kg)} kg` : ' · carico da trovare';
  if (v.loadType === 'assistance') t += presc.kg != null ? ` · ${num(presc.kg)} kg di assistenza` : ' · assistenza da trovare';
  return t;
}
const TREND = { up: ['↑', 'Progresso'], reps: ['+1', 'Una ripetizione in più'], new: ['nuovo', 'Nuovo schema'], deload: ['↓', 'Scarico'], hold: ['=', 'Stesso lavoro'] };
const trendBadge = t => (TREND[t] ? `<span class="trend t-${t}" title="${TREND[t][1]}">${TREND[t][0]}</span>` : '');

function plannedExercise(slot, variant, p) {
  const presc = E.prescribe(slot, variant, p, state.history);
  return {
    id: uid(),
    slot: slot.id,
    role: slot.role,
    variant: clone(variant),
    variants: variantsOf(slot).map(clone),
    group: slot.group,
    target: rangeText(presc.lo, presc.hi),
    rest: presc.rest,
    note: slot.note || '',
    presc,
    sets: presc.reps.map(r => ({ kg: variant.loadType === 'body' ? 0 : presc.kg ?? '', reps: r, done: false })),
  };
}
const plannedSession = (routine, p) => slotsFor(p, routine).map(slot => plannedExercise(slot, exercise(pickOf(p.block, slot)), p));
const estMinutes = list => E.minutes(list.map(e => ({ sets: e.presc.sets, rest: e.rest })));

/* ---------- navigazione ---------- */
const ROUTES = [['home', 'Oggi'], ['schede', 'Schede'], ['progressi', 'Progressi'], ['storico', 'Storico']];
let route = location.hash.slice(1) || 'home', schedeBlock = null, progressVariant = '';
function navigate(r) {
  route = r;
  if (location.hash.slice(1) !== r) history.replaceState(null, '', '#' + r);
  render();
  window.scrollTo(0, 0);
}
function render() {
  if (route === 'session' && !state.active) route = 'home';
  if (![...ROUTES.map(r => r[0]), 'session', 'programma'].includes(route)) route = 'home';
  const cur = route === 'session' ? 'home' : route === 'programma' ? 'schede' : route;
  $('#subnav').innerHTML = ROUTES.map(([r, n]) => `<span data-route="${r}" class="${cur === r ? 'on' : ''}">${n}</span>`).join('');
  $('#main').innerHTML = { home, schede, progressi, storico, session, programma }[route]();
  tick();
}

/* ---------- Oggi ---------- */
function home() {
  const p = pos(), a = state.active;
  if (a) {
    const done = doneSets(a).length, total = a.exercises.reduce((s, e) => s + e.sets.length, 0);
    return `<section class="card hero"><div class="hl">Seduta in corso</div><div class="hn">${esc(routineName(a.routine))}</div>
      <div class="hw">${done} di ${total} serie fatte · <span id="elapsed">${duration((Date.now() - a.startedAt) / 1000)}</span></div>
      <button class="btn hbtn" data-action="resume">Riprendi</button></section>${weekCard(p)}${programCard(p)}`;
  }
  const keys = routineKeys(), r = E.nextRoutine(state.history, p, keys), list = plannedSession(r, p);
  const ups = list.filter(e => e.presc.trend === 'up').length;
  return `<section class="card hero">
      <div class="hl">${esc(p.block.name)} · settimana ${p.week} di ${BLOCK_WEEKS}${p.deload ? ' · scarico' : ''}</div>
      <div class="hn">${esc(routineName(r))}</div>
      <div class="hchips"><span class="hchip">${list.length} esercizi</span><span class="hchip">~${estMinutes(list)} min</span><span class="hchip">RPE ${esc(p.rpe)}</span>${ups ? `<span class="hchip">${ups} in progressione ↑</span>` : ''}</div>
      ${p.why ? `<div class="hw">${esc(p.why)}</div>` : ''}
      <div class="hlist">${list.map(e => `<div><span class="hn2">${esc(e.variant.name)}</span><b>${esc(prescriptionText(e.presc, e.variant))}</b>${trendBadge(e.presc.trend)}</div>`).join('')}</div>
      <button class="btn hbtn" data-action="start" data-id="${r}">Inizia ${esc(routineName(r))}</button>
      ${keys.filter(k => k !== r).map(k => `<button class="hlink" data-action="start-other" data-id="${k}">Oggi preferisci la ${k}?</button>`).join('')}
    </section>${weekCard(p)}${programCard(p)}`;
}
function weekCard(p) {
  const week = gymHistory().filter(h => h.date >= p.weekStart && h.date <= E.addDays(p.weekStart, 6));
  const target = p.race ? 1 : routineKeys().length;
  const rw = runWeek(today());
  const sug = E.suggestDays(rw, target);
  let days = '';
  if (sug && sug.length)
    days = `<p class="gline"><b>Giorni consigliati</b> ${sug.map(d => `${DAYS[d.day]} <span class="muted">(${d.rest ? 'riposo' : 'dopo ' + esc(d.with.join(', '))})</span>`).join(' · ')}</p>
      <p class="muted">Dal tuo piano di corsa: forza nei giorni duri dopo la corsa o nei giorni di riposo, mai il giorno prima di qualità, lungo o gara.</p>`;
  else days = `<p class="muted">Giorni non consecutivi, mai il giorno prima di una seduta di qualità o del lungo. Il giorno di una seduta dura, la forza va dopo la corsa.</p>`;
  const last = lastGym();
  const since = last ? Math.floor((Date.now() - (last.endedAt || Date.parse(last.date))) / 36e5) : null;
  return `<section class="card"><h2>Questa settimana</h2>
    <div class="gdots">${Array.from({ length: target }, (_, i) => `<i class="${i < week.length ? 'done' : ''}">${week[i] ? esc(week[i].routine) : ''}</i>`).join('')}<span><b>${week.length} di ${target}</b> sedute${since != null ? ` · ultima ${since >= 48 ? Math.floor(since / 24) + ' giorni fa' : since >= 24 ? 'ieri' : since + ' ore fa'}` : ''}</span></div>
    ${days}</section>`;
}
function programCard(p) {
  return `<section class="card"><h2>Il programma</h2>
    <div class="gblocks">${BLOCKS.map((b, i) => `<div class="${i === p.blockIndex ? 'on' : ''}"><b>${esc(b.name)}</b><span>${i === p.blockIndex ? `sett. ${p.week}/${BLOCK_WEEKS}` : i === (p.blockIndex + 1) % BLOCKS.length ? 'dal ' + dateLabel(p.nextBlockStart) : '4 sett.'}</span>${i === p.blockIndex ? `<div class="gpips">${Array.from({ length: BLOCK_WEEKS }, (_, w) => `<i class="${w + 1 < p.week ? 'past' : w + 1 === p.week ? 'now' : ''}${w + 1 === BLOCK_WEEKS ? ' dl' : ''}"></i>`).join('')}</div>` : ''}</div>`).join('')}</div>
    <p class="muted">${esc(p.block.why)} Ogni blocco dura 4 settimane: 3 di carico crescente e 1 di scarico. Poi cambiano esercizi e ripetizioni; dopo il terzo si riparte dal primo con i carichi raggiunti${p.cycle > 1 ? ` (ciclo ${p.cycle})` : ''}.</p>
    <div class="grow"><button class="btn btn2 mini" data-action="editor">Movimenti e serie</button><button class="btn btn2 mini" data-action="program">Cambia settimana</button><button class="btn btn2 mini" data-action="settings">Impostazioni e backup</button></div></section>`;
}

/* ---------- Schede ---------- */
function schede() {
  const p = pos(), bi = schedeBlock ?? p.blockIndex, b = BLOCKS[bi];
  const view = { ...p, blockIndex: bi, block: b, deload: false, race: false, week: 1 };
  return `<div class="gpills">${BLOCKS.map((x, i) => `<span class="pill ${i === bi ? 'on' : ''}" data-action="schede-block" data-index="${i}">${esc(x.name)}${i === p.blockIndex ? ' · ora' : ''}</span>`).join('')}</div>
    <section class="card"><h2>${esc(b.title)}</h2><p class="muted">${esc(b.why)} RPE di riferimento: ${b.rpe.join(' → ')}, scarico nella 4ª settimana.</p>
      <button class="btn" data-action="editor">Decidi movimenti e serie</button></section>
    ${routineKeys().map(r => `<section class="card"><h2>${routineName(r)} · ~${E.minutes(slotsFor(view, r))} min</h2>${slotsFor(view, r).map(slot => {
      const v = exercise(pickOf(b, slot));
      return `<button class="gslot" data-action="pick" data-id="${slot.id}" data-index="${bi}" data-routine="${r}"><span><b>${esc(v.name)}</b><small>${esc(slot.name)} · ${slot.sets} × ${rangeText(...slot.reps)}${v.side ? ' per lato' : ''} · recupero ${slot.rest}"</small></span><i>⇄</i></button>`;
    }).join('')}${bi === p.blockIndex && !state.active ? `<button class="btn btn2" data-action="start" data-id="${r}">Inizia ${r}</button>` : ''}</section>`).join('')}
    <p class="muted gfoot">Qui decide l’app quale esercizio fare per ogni movimento; tocca un esercizio per sceglierne un altro per questo blocco. Manubri: peso del singolo manubrio. Ripetizioni per lato negli esercizi a una gamba o un braccio.</p>`;
}
function pickModal(bi, routine, slotId) {
  const b = BLOCKS[bi], slot = E.buildSlots(state.program.template[routine], b.id).find(x => x.id === slotId), cur = pickOf(b, slot);
  openModal(`${esc(slot.name)} · ${b.name}`, `<p class="muted">Vale per tutte le sedute del blocco ${esc(b.name)}. Ogni esercizio ha il suo storico dei carichi.</p>
    <div class="glist">${variantsOf(slot).map(v => `<button data-action="pick-set" data-id="${slot.id}" data-index="${bi}" data-v="${v.id}" class="${v.id === cur ? 'on' : ''}"><span><b>${esc(v.name)}</b><small>${esc(v.gear)}${v.loadType === 'body' ? ' · corpo libero' : v.loadType === 'assistance' ? ' · kg di assistenza' : ''}</small></span><i>${v.id === cur ? '✓' : ''}</i></button>`).join('')}</div>
    ${slot.note ? `<p class="muted">${esc(slot.note)}</p>` : ''}`);
}

/* ---------- Programma: movimenti e serie decisi dall'utente ---------- */
function programma() {
  const p = pos(), keys = routineKeys(), tpl = state.program.template;
  const vol = E.weeklyVolume(tpl, keys, p.block.id);
  const card = k => {
    const entries = tpl[k], slots = E.buildSlots(entries, p.block.id);
    const sets = slots.reduce((n, x) => n + x.sets, 0);
    return `<section class="card"><h2>${routineName(k)} · ${sets} serie · ~${E.minutes(slots)} min</h2>
      ${entries.map((e, i) => {
        const P = PATTERNS[e.p], d = P[p.block.id], v = exercise(state.program.picks?.[p.block.id]?.[e.id] || d.ex);
        const off = e.when === 'potenza' && p.block.id !== 'potenza';
        return `<div class="grow-row ${off ? 'off' : ''}"><span><b>${esc(P.name)}</b><small>${off ? 'solo nel blocco Potenza' : `${esc(v.name)} · ${rangeText(...d.reps)} rip.`}</small></span>
          <div class="gstep"><button data-action="tpl-sets" data-routine="${k}" data-index="${i}" data-d="-1" aria-label="Una serie in meno">−</button><b>${e.sets}</b><button data-action="tpl-sets" data-routine="${k}" data-index="${i}" data-d="1" aria-label="Una serie in più">+</button></div>
          <button class="gicon" data-action="tpl-menu" data-routine="${k}" data-index="${i}" aria-label="Opzioni">•••</button></div>`;
      }).join('')}
      <button class="btn btn2" data-action="tpl-add" data-routine="${k}">+ Aggiungi movimento</button></section>`;
  };
  const rows = AREAS.map(a => {
    const n = vol[a.id] || 0, cls = n < a.lo ? 'lo' : n > a.hi ? 'hi' : 'ok';
    if (!n && !a.lo) return '';
    return `<tr><td>${a.id}</td><td class="r"><b class="v-${cls}">${n}</b></td><td class="r muted">${a.lo}–${a.hi}</td></tr>`;
  }).join('');
  return `<section class="card"><h2>Il tuo programma</h2>
      <p class="muted">Decidi tu <b>cosa</b> allenare (i movimenti) e <b>quanto</b> (le serie). Gli esercizi li sceglie l’app per ogni blocco, insieme a ripetizioni, carichi e recuperi; in Schede puoi comunque cambiarli.</p>
      <label>Sedute a settimana</label><div class="seg gseg">${[1, 2, 3].map(n => `<span data-action="per-week" data-index="${n}" class="${n === keys.length ? 'on' : ''}">${n}</span>`).join('')}</div>
      <label>Parti da un modello</label><div class="gpills">${Object.entries(TEMPLATES).map(([id, x]) => `<span class="pill" data-action="preset" data-id="${id}">${esc(x.name)}</span>`).join('')}</div></section>
    ${keys.map(card).join('')}
    <section class="card"><h2>Serie a settimana · blocco ${esc(p.block.name)}</h2>
      <table><tr><th>Area</th><th class="r">Tue</th><th class="r">Riferimento</th></tr>${rows}</table>
      <p class="muted">Riferimento indicativo per chi corre e fa forza in parallelo: sotto il minimo lo stimolo è scarso, sopra il massimo la palestra inizia a togliere freschezza alla corsa. Nella settimana di scarico le serie calano da sole.</p></section>
    <div class="grow"><button class="btn btn2 mini" data-action="go-schede">‹ Schede</button></div>`;
}
function tplMenu(k, i) {
  const e = state.program.template[k][i], P = PATTERNS[e.p];
  openModal(esc(P.name), `<p class="muted">${esc(P.hint)}</p>
    <div class="glist">
      <button data-action="tpl-move" data-routine="${k}" data-index="${i}" data-d="-1"><span><b>Sposta su</b></span><i>↑</i></button>
      <button data-action="tpl-move" data-routine="${k}" data-index="${i}" data-d="1"><span><b>Sposta giù</b></span><i>↓</i></button>
      <button data-action="tpl-when" data-routine="${k}" data-index="${i}"><span><b>${e.when === 'potenza' ? 'Fallo in tutti i blocchi' : 'Solo nel blocco Potenza'}</b><small>${e.when === 'potenza' ? 'Ora compare solo nelle 4 settimane di Potenza.' : 'Ora compare in tutti i blocchi.'}</small></span><i>⇄</i></button>
      <button data-action="tpl-remove" data-routine="${k}" data-index="${i}"><span><b>Togli dalla seduta</b></span><i>×</i></button>
    </div>`);
}
function tplAdd(k) {
  const have = new Set(state.program.template[k].map(e => e.p));
  openModal(`Aggiungi a ${routineName(k)}`, `<div class="glist">${PATTERN_ORDER.map(id => {
    const P = PATTERNS[id];
    return `<button data-action="tpl-add-p" data-routine="${k}" data-id="${id}" ${have.has(id) ? 'disabled' : ''}><span><b>${esc(P.name)}</b><small>${esc(P.area)} · ${esc(P.hint)}</small></span><i>${have.has(id) ? '✓' : '+'}</i></button>`;
  }).join('')}</div>`);
}
function tplChanged(msg) {
  save();
  render();
  if (msg) toast(msg);
}

/* ---------- Progressi ---------- */
function weekVolume(h) {
  return h.exercises.filter(e => e.variant.loadType === 'weight').flatMap(e => e.sets.filter(x => x.done)).reduce((s, x) => s + (Number(x.kg) || 0) * x.reps, 0);
}
function progressi() {
  const g = gymHistory();
  const p = pos();
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const ws = E.addDays(E.monday(today()), -(7 - i) * 7), we = E.addDays(ws, 6);
    const hs = g.filter(h => h.date >= ws && h.date <= we);
    return { ws, n: hs.length, sets: hs.reduce((s, h) => s + doneSets(h).length, 0), vol: hs.reduce((s, h) => s + weekVolume(h), 0) };
  });
  const cur = weeks[7], max = Math.max(1, ...weeks.map(w => w.vol));
  const chart = `<svg viewBox="0 0 320 120" class="gchart" role="img" aria-label="Volume settimanale">${weeks.map((w, i) => {
    const h = (w.vol / max) * 84, x = 8 + i * 39;
    return `<rect x="${x}" y="${96 - h}" width="26" height="${Math.max(h, w.n ? 2 : 0)}" rx="4" fill="${i === 7 ? 'var(--txt)' : 'var(--z3)'}"/><text x="${x + 13}" y="112" text-anchor="middle">${w.ws.slice(8, 10)}/${w.ws.slice(5, 7)}</text>${w.n ? `<text x="${x + 13}" y="${92 - h}" text-anchor="middle">${w.n}</text>` : ''}`;
  }).join('')}</svg>`;
  const variants = [...new Map(g.flatMap(h => h.exercises.filter(e => e.sets.some(x => x.done)).map(e => [e.variant.id, e.variant]))).values()];
  const v = variants.find(x => x.id === progressVariant) || variants[0];
  let ex = '<p class="muted">Dopo la prima seduta vedi qui carichi e ripetizioni di ogni esercizio.</p>';
  if (v) {
    const rows = g.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0)).flatMap(h => {
      const sets = h.exercises.filter(e => e.variant.id === v.id).flatMap(e => e.sets.filter(x => x.done));
      return sets.length ? [{ h, sets }] : [];
    }).slice(0, 10);
    const best = r => Math.max(...r.sets.map(x => E.e1rm(Number(x.kg) || 0, x.reps)));
    ex = `<select id="progress-variant" class="gsel">${variants.map(x => `<option value="${esc(x.id)}" ${x.id === v.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <table><tr><th>Data</th><th>Serie</th>${v.loadType === 'weight' ? '<th class="r">Stima max</th>' : ''}</tr>${rows.map(r => `<tr><td>${dateLabel(r.h.date)}${r.h.deload ? ' <span class="badge">scarico</span>' : ''}</td><td>${r.sets.map(x => (v.loadType === 'body' ? x.reps : `${num(x.kg)}×${x.reps}`)).join(' · ')}</td>${v.loadType === 'weight' ? `<td class="r">${num(Math.round(best(r)))} kg</td>` : ''}</tr>`).join('')}</table>
      <p class="muted">${v.loadType === 'assistance' ? 'Kg di assistenza: meno è meglio.' : v.loadType === 'body' ? 'Corpo libero: conta le ripetizioni.' : 'Stima del massimale da carico e ripetizioni (con 2 in riserva): serve a confrontare sedute con schemi diversi.'}</p>`;
  }
  return `<section class="card"><h2>Questa settimana</h2><div class="grid3">
      <div class="stat"><b>${cur.n}</b><span>sedute</span></div><div class="stat"><b>${cur.sets}</b><span>serie</span></div><div class="stat"><b>${num(Math.round(cur.vol / 10) / 100)}</b><span>tonnellate</span></div></div></section>
    <section class="card"><h2>Volume, ultime 8 settimane</h2>${chart}<p class="muted">Chili sollevati (carico × ripetizioni) per settimana; il numero è quante sedute. Il carico sulla salute delle gambe lo vedi in RunPlan, in Progressi → Forma e fatica.</p></section>
    <section class="card"><h2>Esercizio per esercizio</h2>${ex}</section>
    <p class="muted gfoot">${esc(p.block.name)}, settimana ${p.week} di ${BLOCK_WEEKS}.</p>`;
}

/* ---------- Storico ---------- */
function storico() {
  const g = gymHistory().sort((a, b) => b.date.localeCompare(a.date) || (b.endedAt || 0) - (a.endedAt || 0));
  if (!g.length) return `<section class="card"><h2>Storico</h2><p class="muted">Ancora nessuna seduta. La prima la trovi in Oggi.</p></section>`;
  return `<section class="card"><h2>Sedute</h2>${g.map(h => `<button class="gslot" data-action="detail" data-id="${esc(h.id)}"><span><b>${esc(routineName(h.routine) || 'Seduta')}${h.blockName ? ` · ${esc(h.blockName)} sett. ${h.week}` : ''}${h.deload ? ' <span class="badge">scarico</span>' : ''}</b><small>${dateLabel(h.date)} · ${Math.round(h.minutes)} min · RPE ${h.rpe} · ${doneSets(h).length} serie</small></span><i>›</i></button>`).join('')}</section>
    <div class="grow"><button class="btn btn2 mini" data-action="settings">Impostazioni e backup</button></div>`;
}
function detailModal(id) {
  const h = state.history.find(x => x.id === id);
  if (!h) return;
  openModal(`${esc(routineName(h.routine) || 'Seduta')} · ${dateLabel(h.date)}`, `<p class="muted">${Math.round(h.minutes)} min · RPE ${h.rpe}${h.blockName ? ` · ${esc(h.blockName)}, settimana ${h.week}` : ''}</p>
    ${h.exercises.filter(e => e.sets.some(x => x.done)).map(e => `<div class="gdet"><b>${esc(e.variant.name)}</b><span>${e.sets.filter(x => x.done).map(x => (e.variant.loadType === 'body' ? `${x.reps}` : `${num(x.kg)}×${x.reps}`)).join(' · ')}${e.variant.loadType === 'assistance' ? ' (assist.)' : ''}</span></div>`).join('')}
    ${h.note ? `<p>${esc(h.note)}</p>` : ''}<button class="btn btn2" data-action="delete" data-id="${esc(h.id)}">Elimina seduta</button>`);
}

/* ---------- seduta in corso ---------- */
function session() {
  const a = state.active;
  const total = a.exercises.reduce((s, e) => s + e.sets.length, 0), done = doneSets(a).length;
  return `<section class="card gsess"><div class="ghead"><div><div class="hl2">${a.blockName ? `${esc(a.blockName)} · sett. ${a.week}${a.deload ? ' · scarico' : ''}` : 'Seduta'}</div><div class="gtitle">${esc(routineName(a.routine))}</div>
      <div class="muted"><span id="elapsed">${duration((Date.now() - a.startedAt) / 1000)}</span> · ${done}/${total} serie</div></div>
      <button class="btn mini" data-action="finish">Termina</button></div>
      <div class="gbar"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
      <div class="grow"><button class="btn btn2 mini" data-action="manual-timer">Timer</button><button class="btn btn2 mini" data-action="add-active">+ Esercizio</button><button class="btn btn2 mini" data-action="discard">Annulla seduta</button></div></section>
    ${a.exercises.map((e, i) => exerciseCard(e, i)).join('')}`;
}
function exerciseCard(e, i) {
  const v = e.variant, body = v.loadType === 'body';
  const prev = E.lastPerformance(v.id, state.history);
  return `<section class="card gex"><div class="ghead"><div><div class="gtitle2">${esc(v.name)}</div><div class="muted">${esc(e.group)}${e.presc ? ` · ${esc(prescriptionText(e.presc, v))}` : ` · ${esc(e.target)} rip.`} · recupero ${e.rest}"</div></div>
      <button class="gicon" data-action="active-menu" data-index="${i}" aria-label="Opzioni">•••</button></div>
    ${e.presc?.why ? `<p class="gwhy">${trendBadge(e.presc.trend)} ${esc(e.presc.why)}</p>` : ''}${e.note ? `<p class="muted">${esc(e.note)}</p>` : ''}
    <div class="gset gsh"><span>#</span><span>Prima</span><span>${v.loadType === 'assistance' ? 'Assist.' : 'Kg'}</span><span>Rip.</span><span></span></div>
    ${e.sets.map((x, j) => `<div class="gset ${x.done ? 'done' : ''}"><b>${j + 1}</b><span class="muted">${prev && prev.sets[j] ? (body ? prev.sets[j].reps : `${num(prev.sets[j].kg)}×${prev.sets[j].reps}`) : '—'}</span>
      <input type="number" inputmode="decimal" min="0" max="2000" step="0.5" ${body ? 'disabled value="0"' : `value="${x.kg ?? ''}"`} placeholder="—" data-ex="${i}" data-set="${j}" data-field="kg" aria-label="Peso serie ${j + 1}">
      <input type="number" inputmode="numeric" min="1" max="999" step="1" value="${x.reps ?? ''}" placeholder="${esc(e.target)}" data-ex="${i}" data-set="${j}" data-field="reps" aria-label="Ripetizioni serie ${j + 1}">
      <button class="gcheck ${x.done ? 'on' : ''}" data-action="check" data-index="${i}" data-set="${j}" aria-pressed="${x.done}" aria-label="Serie ${j + 1} fatta">✓</button></div>`).join('')}
    <div class="grow"><button class="hlink2" data-action="add-set" data-index="${i}">+ Serie</button><button class="hlink2" data-action="swap" data-index="${i}">⇄ Sostituisci</button><button class="hlink2" data-action="rest-edit" data-index="${i}">Recupero ${e.rest}"</button></div></section>`;
}

function start(routine) {
  if (state.active) return navigate('session');
  unlockAudio();
  const p = pos();
  state.active = {
    id: uid(), type: 'gym', routine, startedAt: Date.now(), date: today(),
    block: p.block.id, blockName: p.block.name, week: p.week, deload: p.deload,
    exercises: plannedSession(routine, p),
  };
  save();
  wake();
  navigate('session');
}
function finish(rpe, note) {
  const a = clone(state.active);
  a.exercises = a.exercises.map(e => ({ ...e, sets: e.sets.filter(x => x.done) })).filter(e => e.sets.length);
  a.endedAt = Date.now();
  a.minutes = Math.max(1, Math.round((a.endedAt - a.startedAt) / 60000));
  a.rpe = rpe;
  a.note = note;
  state.history.push(a);
  state.active = null;
  state.timer = null;
  save();
  close();
  navigate('home');
  toast('Seduta salvata. La prossima è già pronta in Oggi.');
}

/* ---------- sostituzioni ---------- */
function swapModal(i) {
  const e = state.active.exercises[i];
  openModal('Sostituisci esercizio', `<p class="muted">Le serie già fatte restano sull’esercizio di prima; quelle da fare passano al nuovo, con carichi suoi.</p>
    <div class="glist">${e.variants.map(v => `<button data-action="choose-variant" data-index="${i}" data-v="${esc(v.id)}" ${v.id === e.variant.id ? 'disabled' : ''}><span><b>${esc(v.name)}</b><small>${esc(v.gear)}</small></span><i>${v.id === e.variant.id ? '✓' : '›'}</i></button>`).join('')}</div>
    <button class="btn btn2" data-action="custom-swap" data-index="${i}">Un altro esercizio…</button>`);
}
function chooseVariant(i, variant) {
  const e = state.active.exercises[i];
  const remaining = e.sets.filter(x => !x.done).length, completed = e.sets.filter(x => x.done);
  if (variant.id === e.variant.id) return close();
  if (!remaining) return toast('Tutte le serie sono fatte: aggiungi una serie prima di sostituire.');
  const slot = { sets: remaining, reps: e.presc ? [e.presc.lo, e.presc.hi] : E.parseRange(e.target), rest: e.rest, role: e.role || 'acc' };
  const p = { deload: !!state.active.deload };
  const presc = E.prescribe(slot, variant, p, state.history);
  presc.sets = remaining;
  const repl = { ...clone(e), id: uid(), variant: clone(variant), presc, sets: Array.from({ length: remaining }, (_, j) => ({ kg: variant.loadType === 'body' ? 0 : presc.kg ?? '', reps: presc.reps[j] ?? presc.lo, done: false })) };
  if (!repl.variants.some(v => v.id === variant.id)) repl.variants.push(clone(variant));
  if (completed.length) {
    e.sets = completed;
    state.active.exercises.splice(i + 1, 0, repl);
  } else state.active.exercises[i] = repl;
  save();
  close();
  render();
}
function addModal() {
  const list = Object.values(EXERCISES).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  openModal('Aggiungi esercizio', `<div class="glist">${list.map(v => `<button data-action="add-library" data-v="${v.id}"><span><b>${esc(v.name)}</b><small>${esc(v.gear)}</small></span><i>+</i></button>`).join('')}</div>
    <button class="btn btn2" data-action="custom-active">Un esercizio che non c’è…</button>`);
}
function addToSession(variant) {
  const slot = { id: 'extra', group: guessGroup(variant), role: 'acc', sets: 3, reps: variant.loadType === 'body' ? [8, 12] : [8, 12], rest: 90, note: '' };
  const e = plannedExercise(slot, variant, { deload: !!state.active.deload });
  e.variants = [clone(variant)];
  state.active.exercises.push(e);
  save();
  close();
  render();
}
function guessGroup(v) {
  for (const P of Object.values(PATTERNS)) for (const bl of BLOCKS) if ([P[bl.id].ex, ...P[bl.id].alt].includes(v.id)) return P.group;
  return 'Core';
}
function customModal(mode, i = '') {
  openModal(mode === 'swap' ? 'Esercizio sostitutivo' : 'Nuovo esercizio', `<form id="custom-form" data-mode="${mode}" data-index="${i}">
    <label>Nome<input name="name" required maxlength="90"></label><label>Attrezzo<input name="gear" required maxlength="50" placeholder="Es. manubri, macchina"></label>
    <label>Carico<select name="load"><option value="weight">Peso in kg</option><option value="body">Corpo libero</option><option value="assistance">Assistenza in kg</option></select></label>
    <button class="btn">${mode === 'swap' ? 'Sostituisci' : 'Aggiungi'}</button></form>`);
}

/* ---------- modali, impostazioni, backup ---------- */
function openModal(title, body) {
  $('#modal').innerHTML = `<div class="mhead"><h2>${title}</h2><button class="gicon" data-action="close" aria-label="Chiudi">×</button></div>${body}`;
  if (!$('#modal').open) $('#modal').showModal();
}
const close = () => $('#modal').open && $('#modal').close();
let confirmation = null;
function confirmAction(title, text, fn) {
  confirmation = fn;
  openModal(title, `<p class="muted">${text}</p><div class="grow"><button class="btn btn2" data-action="close">Indietro</button><button class="btn" data-action="confirm">Conferma</button></div>`);
}
function programModal() {
  const p = pos();
  openModal('Dove sei nel programma', `<p class="muted">Se hai iniziato prima o vuoi ripartire, indica blocco e settimana di <b>questa</b> settimana. Lo storico non cambia.</p>
    <form id="program-form"><label>Blocco<select name="block">${BLOCKS.map((b, i) => `<option value="${i}" ${i === p.blockIndex ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select></label>
    <label>Settimana<select name="week">${[1, 2, 3, 4].map(w => `<option value="${w}" ${w === p.week ? 'selected' : ''}>${w}${w === 4 ? ' (scarico)' : ''}</option>`).join('')}</select></label>
    <button class="btn">Salva</button></form>`);
}
function settingsModal() {
  openModal('Impostazioni', `<label class="gtoggle"><input type="checkbox" id="sound-setting" ${state.settings.sound ? 'checked' : ''}> Suono a fine recupero</label>
    <p class="muted">Il timer usa l’orario reale e si rimette in pari quando riapri l’app; su iPhone il suono a schermo bloccato non è garantito.</p>
    <h2 class="mh2">Backup</h2><p class="muted">Le sedute di palestra stanno su questo dispositivo (Safari e app nella Home hanno archivi separati). In RunPlan entrano nel calendario e nel carico, ma non vanno nel cloud: esporta un backup ogni tanto.</p>
    <div class="grow"><button class="btn btn2" data-action="export">Esporta backup</button><label class="btn btn2 gfile">Importa backup<input id="import-file" type="file" accept="application/json,.json" hidden></label></div>
    <p class="muted">${gymHistory().length} sedute salvate${storageOK ? '' : ' · archivio locale non disponibile: esporta subito'}.</p>`);
}
function validateBackup(raw) {
  const s = migrate(raw);
  const ok = x => { if (!x) throw Error('Backup non valido'); };
  const n = (x, a, b) => typeof x === 'number' && Number.isFinite(x) && x >= a && x <= b;
  const id = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
  ok(s.version === 3 && s.program && /^\d{4}-\d{2}-\d{2}$/.test(s.program.start) && [1, 2, 3].includes(s.program.perWeek) && s.settings && Array.isArray(s.history) && s.history.length <= 10000);
  for (const k of ROUTINE_KEYS) {
    const l = s.program.template?.[k];
    ok(Array.isArray(l) && l.length >= 1 && l.length <= 30);
    l.forEach(e => ok(e && id(e.id) && PATTERNS[e.p] && Number.isInteger(e.sets) && n(e.sets, 1, 8) && ['always', 'potenza'].includes(e.when)));
  }
  const variant = v => ok(v && typeof v.id === 'string' && v.id.length <= 100 && typeof v.name === 'string' && v.name.length <= 90 && ['weight', 'body', 'assistance'].includes(v.loadType));
  const sets = l => { ok(Array.isArray(l) && l.length <= 50); l.forEach(x => ok(x && typeof x.done === 'boolean' && (!x.done || (n(x.reps, 1, 999) && n(Number(x.kg) || 0, 0, 2000))))); };
  for (const h of s.history) {
    ok(id(h.id) && h.type === 'gym' && ROUTINE_KEYS.includes(h.routine) && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && n(h.minutes, 0.1, 1e6) && n(h.rpe, 1, 10) && Array.isArray(h.exercises));
    h.exercises.forEach(e => { variant(e.variant); sets(e.sets); });
  }
  if (s.active) { ok(ROUTINE_KEYS.includes(s.active.routine) && Array.isArray(s.active.exercises)); s.active.exercises.forEach(e => { variant(e.variant); sets(e.sets); }); }
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
  if (!b) return;
  const act = b.dataset.action, k = b.dataset.id, i = Number(b.dataset.index), j = Number(b.dataset.set);
  if (act === 'close') return close();
  if (act === 'confirm') { const fn = confirmation; confirmation = null; close(); return fn?.(); }
  if (act === 'start') return start(k);
  if (act === 'start-other') return confirmAction(`Oggi la ${k}?`, `La prossima volta ti proporrò l’altra scheda.`, () => start(k));
  if (act === 'resume') return navigate('session');
  if (act === 'program') return programModal();
  if (act === 'settings') return settingsModal();
  if (act === 'schede-block') { schedeBlock = i; return render(); }
  if (act === 'pick') return pickModal(i, b.dataset.routine, k);
  if (act === 'pick-set') {
    const bid = BLOCKS[i].id;
    state.program.picks[bid] = { ...(state.program.picks[bid] || {}), [k]: b.dataset.v };
    save(); close(); render(); return toast('Esercizio cambiato per questo blocco.');
  }
  if (act === 'editor') return navigate('programma');
  if (act === 'go-schede') return navigate('schede');
  if (act === 'per-week') {
    state.program.perWeek = i;
    return tplChanged(i === 1 ? 'Una seduta a settimana: sempre la A.' : `${i} sedute a settimana: ${ROUTINE_KEYS.slice(0, i).join(', ')}.`);
  }
  if (act === 'preset') {
    const x = TEMPLATES[k];
    return confirmAction(`Modello «${x.name}»`, `${esc(x.note)} Sostituisce movimenti e serie delle schede; storico e scelte degli esercizi restano.`, () => {
      state.program.template = templateOf(k);
      tplChanged(`Modello «${x.name}» applicato.`);
    });
  }
  if (act.startsWith('tpl-')) {
    const r = b.dataset.routine, list = state.program.template[r];
    if (act === 'tpl-sets') {
      const e = list[i];
      e.sets = Math.min(8, Math.max(1, e.sets + Number(b.dataset.d)));
      return tplChanged();
    }
    if (act === 'tpl-menu') return tplMenu(r, i);
    if (act === 'tpl-add') return tplAdd(r);
    if (act === 'tpl-add-p') {
      const P = PATTERNS[k];
      list.push({ id: 'u' + uid().replace(/[^a-zA-Z0-9]/g, '').slice(0, 10), p: k, sets: P.sets, when: P.when || 'always' });
      close();
      return tplChanged(`${P.name} aggiunto a ${routineName(r)}.`);
    }
    if (act === 'tpl-move') {
      const t = i + Number(b.dataset.d);
      if (t < 0 || t >= list.length) return close();
      [list[i], list[t]] = [list[t], list[i]];
      close();
      return tplChanged();
    }
    if (act === 'tpl-when') {
      list[i].when = list[i].when === 'potenza' ? 'always' : 'potenza';
      close();
      return tplChanged();
    }
    if (act === 'tpl-remove') {
      if (list.length <= 1) return toast('Lascia almeno un movimento nella seduta.');
      list.splice(i, 1);
      close();
      return tplChanged();
    }
  }
  if (act === 'detail') return detailModal(k);
  if (act === 'delete') return confirmAction('Eliminare la seduta?', 'Sparisce dallo storico e dal carico di RunPlan.', () => { state.history = state.history.filter(h => h.id !== k); save(); render(); });
  if (act === 'export') {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `palestra-backup-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return;
  }
  if (act === 'timer-plus' || act === 'timer-minus') { if (state.timer) { state.timer.end += act === 'timer-plus' ? 15000 : -15000; save(); tick(); } return; }
  if (act === 'timer-skip') { state.timer = null; save(); return tick(); }
  if (!state.active) return;
  if (act === 'finish') {
    const n = doneSets(state.active).length;
    if (!n) return toast('Spunta almeno una serie prima di salvare.');
    return openModal('Fine seduta', `<p class="muted">${n} serie fatte in ${duration((Date.now() - state.active.startedAt) / 1000)}. Le serie non spuntate non vengono salvate.</p>
      <form id="finish-form"><label>Fatica della seduta · RPE da 1 a 10<input name="rpe" type="number" min="1" max="10" value="7" required></label>
      <label>Note<input name="note" maxlength="500" placeholder="Gambe, energia, prossima corsa…"></label><button class="btn">Salva seduta</button></form>
      <p class="muted">Con RPE 9–10 la prossima volta non aumento i carichi.</p>`);
  }
  if (act === 'discard') return confirmAction('Annullare la seduta?', 'Le serie di oggi non verranno salvate.', () => { state.active = null; state.timer = null; save(); navigate('home'); });
  if (act === 'manual-timer') return openModal('Timer', `<form id="timer-form"><label>Secondi<input name="seconds" type="number" min="5" max="3600" value="90" required></label><button class="btn">Avvia</button></form>`);
  if (act === 'add-active') return addModal();
  if (act === 'add-library') return addToSession(EXERCISES[b.dataset.v]);
  if (act === 'custom-active') return customModal('active');
  if (act === 'swap') return swapModal(i);
  if (act === 'custom-swap') return customModal('swap', i);
  if (act === 'choose-variant') return chooseVariant(i, state.active.exercises[i].variants.find(v => v.id === b.dataset.v));
  const e = state.active.exercises[i];
  if (!e) return;
  if (act === 'check') {
    const x = e.sets[j];
    if (!x.done) {
      unlockAudio();
      if (!Number.isInteger(Number(x.reps)) || Number(x.reps) < 1) return toast('Scrivi le ripetizioni prima di spuntare.');
      if (e.variant.loadType !== 'body' && (x.kg === '' || !Number.isFinite(Number(x.kg)) || Number(x.kg) < 0)) return toast('Scrivi il carico (0 se senza peso).');
      x.reps = Number(x.reps);
      x.kg = Number(x.kg) || 0;
      x.done = true;
      // la serie successiva parte da quanto hai appena fatto, se non l'hai già modificata
      const nx = e.sets[j + 1];
      if (nx && !nx.done && e.variant.loadType !== 'body' && (nx.kg === '' || nx.kg === e.presc?.kg)) nx.kg = x.kg;
      if (e.rest > 0) startTimer(e.rest);
    } else x.done = false;
    save();
    return render();
  }
  if (act === 'add-set') {
    const last = e.sets[e.sets.length - 1];
    e.sets.push({ kg: e.variant.loadType === 'body' ? 0 : last?.kg ?? '', reps: last?.reps ?? '', done: false });
    save();
    return render();
  }
  if (act === 'rest-edit') return openModal('Recupero', `<form id="rest-form" data-index="${i}"><label>Secondi<input name="seconds" type="number" min="0" max="600" value="${e.rest}" required></label><button class="btn">Salva</button></form>`);
  if (act === 'active-menu')
    return openModal(esc(e.variant.name), `<div class="glist"><button data-action="active-move" data-index="${i}" data-dir="-1"><span><b>Sposta su</b></span><i>↑</i></button><button data-action="active-move" data-index="${i}" data-dir="1"><span><b>Sposta giù</b></span><i>↓</i></button><button data-action="remove-last-set" data-index="${i}"><span><b>Togli l’ultima serie non fatta</b></span><i>−</i></button><button data-action="remove-active" data-index="${i}"><span><b>Togli l’esercizio dalla seduta</b></span><i>×</i></button></div>`);
  if (act === 'active-move') {
    const l = state.active.exercises, t = i + Number(b.dataset.dir);
    if (t < 0 || t >= l.length) return;
    [l[i], l[t]] = [l[t], l[i]];
    save(); close(); return render();
  }
  if (act === 'remove-last-set') {
    const n = e.sets.findLastIndex(x => !x.done);
    if (n < 0 || e.sets.length <= 1) return toast('Nessuna serie da togliere.');
    e.sets.splice(n, 1);
    save(); close(); return render();
  }
  if (act === 'remove-active') return confirmAction('Togliere l’esercizio?', e.sets.some(x => x.done) ? 'Anche le serie già fatte di questo esercizio verranno tolte.' : 'Solo dalla seduta di oggi.', () => { state.active.exercises.splice(i, 1); save(); render(); });
});
document.addEventListener('input', ev => {
  const t = ev.target;
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
  if (t.id === 'progress-variant') { progressVariant = t.value; return render(); }
  if (t.id === 'sound-setting') { state.settings.sound = t.checked; if (t.checked) unlockAudio(); return save(); }
  if (t.id === 'import-file' && t.files[0]) {
    try {
      if (t.files[0].size > 10e6) throw Error();
      const data = validateBackup(JSON.parse(await t.files[0].text()));
      confirmAction('Importare il backup?', `${data.history.length} sedute. Sostituisce programma, storico ed eventuale seduta in corso su questo dispositivo.`, () => { state = data; save(); render(); toast('Backup importato.'); });
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
  if (f.id === 'finish-form') return finish(Math.round(+d.rpe), d.note || '');
  if (f.id === 'timer-form') { unlockAudio(); startTimer(+d.seconds); return close(); }
  if (f.id === 'rest-form') { state.active.exercises[+f.dataset.index].rest = +d.seconds; save(); close(); return render(); }
  if (f.id === 'program-form') {
    const bi = +d.block, w = +d.week;
    state.program.start = E.addDays(E.monday(today()), -(bi * BLOCK_WEEKS + w - 1) * 7);
    save(); close(); render();
    return toast(`Ora sei in ${BLOCKS[bi].name}, settimana ${w}.`);
  }
  if (f.id === 'custom-form') {
    const v = { id: 'c-' + uid().replace(/[^a-zA-Z0-9]/g, '').slice(0, 16), name: d.name.trim(), gear: d.gear.trim(), loadType: d.load, side: false };
    state.custom[v.id] = v;
    if (f.dataset.mode === 'swap') return chooseVariant(+f.dataset.index, v);
    return addToSession(v);
  }
});
$('#modal').addEventListener('click', e => {
  if (e.target !== $('#modal')) return;
  const r = $('#modal').getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
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

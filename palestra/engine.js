'use strict';
/* Motore della Palestra: settimana di carico o di scarico, carichi e ripetizioni suggeriti, record,
   statistiche. Funzioni pure (niente DOM, niente localStorage): si testano con Node (tests/palestra.cjs).

   Progressione "doppia" sul range di ripetizioni che hai scelto nella scheda: a parità di carico una
   ripetizione in più per serie fino al massimo del range; quando tutte le serie arrivano al massimo,
   la volta dopo più carico e si riparte dal minimo. A corpo libero si progredisce con le ripetizioni,
   negli esercizi a tempo con i secondi (+5), in quelli assistiti togliendo assistenza.
   Con lo scarico attivo, ogni 4ª settimana è di scarico (−10%, una serie in meno); in taper e in
   settimana gara della corsa lo scarico scatta comunque. */
const GymEngine = (() => {
  const DAY = 864e5;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => new Date(s.slice(0, 10) + 'T12:00:00');
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const monday = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
  const weeksBetween = (a, b) => Math.floor(Math.round((parse(b) - parse(a)) / DAY) / 7);

  // incremento di carico per attrezzo (kg); per i manubri è il peso di un manubrio
  const STEP = { Manubri: 2, Manubrio: 2, Kettlebell: 4, Bilanciere: 2.5, Macchina: 2.5, Cavo: 2.5 };
  const step = v => (v.loadType === 'assistance' ? 5 : STEP[v.gear] || 2.5);
  // arrotondamento al peso disponibile: manubri al kg, kettlebell a 2 kg, il resto a 1,25 kg
  const round = (kg, v, dir = 0) => {
    const q = /Manubri/.test(v.gear) ? 1 : v.gear === 'Kettlebell' ? 2 : 1.25;
    const f = dir < 0 ? Math.floor : dir > 0 ? Math.ceil : Math.round;
    return Math.max(0, f(kg / q) * q);
  };
  // massimale stimato (Epley) da una serie con ~2 ripetizioni in riserva
  const e1rm = (kg, reps) => kg * (1 + (reps + 2) / 30);
  const kgFor = (orm, reps) => orm / (1 + (reps + 2) / 30);

  /* Settimana del ciclo di 4 (3 di carico + 1 di scarico) a partire dal lunedì di start. runWeek
     (facoltativo) è la settimana del piano di corsa di RunPlan: in taper e in settimana gara si scarica. */
  function cycle(start, today, runWeek, deloadOn = true) {
    const w = Math.max(0, weeksBetween(monday(start), monday(today)));
    const week = (w % CYCLE_WEEKS) + 1;
    const weekStart = addDays(monday(start), w * 7);
    let deload = deloadOn && week === CYCLE_WEEKS, why = deload ? 'Settimana di scarico: una serie in meno e carichi al 90%.' : '';
    const race = !!(runWeek && runWeek.race);
    if (runWeek && (runWeek.isTaper || race)) {
      deload = true;
      why = race ? 'Settimana di gara: una sola seduta leggera, niente salti, almeno 3 giorni prima della gara.' : 'Taper della corsa: in palestra si scarica anche qui.';
    }
    const nextDeload = deloadOn ? addDays(weekStart, (CYCLE_WEEKS - week) * 7) : null;
    return { week, deloadOn, deload, why, race, weekStart, nextDeload, rpe: deload ? '6' : deloadOn ? ['7', '7–8', '8', '6'][week - 1] : '7–8' };
  }

  // ultima esecuzione "valida" di un esercizio: si saltano le sedute di scarico (carichi non rappresentativi)
  function lastPerformance(variantId, history) {
    const list = history.filter(h => h.type === 'gym').sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    for (const h of list) {
      if (h.deload) continue;
      const exs = h.exercises.filter(e => e.variant.id === variantId);
      const sets = exs.flatMap(e => e.sets.filter(x => x.done && x.kind !== 'warmup'));
      if (!sets.length) continue;
      const p = exs.find(e => e.presc)?.presc;
      const range = p ? [p.lo, p.hi] : parseRange(exs[0].target);
      return { sets, date: h.date, rpe: h.rpe, lo: range[0], hi: range[1], plannedSets: p ? p.sets : sets.length };
    }
    return null;
  }
  function parseRange(t) {
    const m = String(t || '').match(/(\d+)\s*[–-]\s*(\d+)/);
    if (m) return [+m[1], +m[2]];
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? [n, n] : [8, 12];
  }

  const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');
  const repsList = sets => sets.map(x => x.reps).join('/');

  /* Prescrizione di un esercizio di una scheda per la seduta di oggi.
     slot = { sets, reps: [min, max], rest }. Restituisce serie, range, carico e ripetizioni (o secondi)
     suggeriti per ogni serie, e una frase che spiega il perché. */
  function prescribe(slot, variant, pos, history) {
    const [lo, hi] = slot.reps;
    const sets = pos.deload ? Math.max(1, slot.sets - 1) : slot.sets;
    const out = { sets, lo, hi, rest: slot.rest, kg: null, reps: Array(sets).fill(lo), why: '', trend: '' };
    const last = lastPerformance(variant.id, history);
    const isTime = variant.loadType === 'time', isBody = variant.loadType === 'body' || isTime, isAssist = variant.loadType === 'assistance';
    const unit = isTime ? 'secondi' : 'ripetizioni', inc = isTime ? 5 : 1;

    if (!last) {
      out.reps = Array(sets).fill(hi);
      out.why = isBody ? `Prima volta: punta a ${lo}–${hi} ${unit}.` : `Prima volta: scegli un carico che ti lasci 2–3 ripetizioni in riserva a ${hi}.`;
      return out;
    }
    const lastKg = Math.max(...last.sets.map(x => Number(x.kg) || 0));
    const sameRange = last.lo === lo && last.hi === hi;
    const atTop = last.sets.length >= last.plannedSets && last.sets.every(x => x.reps >= last.hi);
    const tooHard = last.rpe >= 9;

    if (pos.deload) {
      out.kg = isBody ? null : isAssist ? round(lastKg * 1.1, variant, 1) : round(lastKg * 0.9, variant, -1);
      out.reps = Array(sets).fill(lo);
      out.why = `Scarico: ${isBody ? `${unit} al minimo` : isAssist ? 'un po’ più di assistenza' : '−10% del carico'} e una serie in meno.`;
      out.trend = 'deload';
      return out;
    }
    if (isBody) {
      const base = Math.min(...last.sets.map(x => x.reps));
      if (sameRange && atTop) {
        out.reps = Array(sets).fill(hi);
        out.why = `Hai chiuso ${repsList(last.sets)}: sei al massimo del range. Rendilo più difficile (più lento, una variante più dura) o alza il range nella scheda.`;
        out.trend = 'up';
      } else {
        const t = Math.min(hi, Math.max(lo, sameRange ? base + (tooHard ? 0 : inc) : lo));
        out.reps = Array(sets).fill(t);
        out.why = sameRange ? `La volta scorsa ${repsList(last.sets)}: punta a ${t} ${isTime ? 'secondi' : ''} per serie.`.replace('  ', ' ') : `Nuovo range: ${lo}–${hi} ${unit}.`;
        out.trend = sameRange ? (tooHard ? 'hold' : 'reps') : 'new';
      }
      return out;
    }
    if (!sameRange) {
      // range cambiato nella scheda: stima il carico dal massimale implicito dell'ultima volta
      if (isAssist) {
        out.kg = lastKg;
        out.why = `Nuovo range ${lo}–${hi}: riparti da ${fmt(lastKg)} kg di assistenza.`;
      } else {
        const orm = Math.max(...last.sets.map(x => e1rm(Number(x.kg) || 0, x.reps)));
        out.kg = round(kgFor(orm, lo) * 0.97, variant, -1);
        out.why = `Nuovo range ${lo}–${hi}: da ${fmt(lastKg)} kg × ${last.sets[0].reps} stimo ${fmt(out.kg)} kg.`;
      }
      out.trend = 'new';
      return out;
    }
    if (atTop && !tooHard) {
      const s = step(variant);
      out.kg = isAssist ? Math.max(0, lastKg - s) : round(lastKg + s, variant);
      out.why = isAssist
        ? `Hai chiuso ${repsList(last.sets)}: togli ${fmt(s)} kg di assistenza.`
        : `Hai chiuso ${repsList(last.sets)} al massimo del range: +${fmt(out.kg - lastKg)} kg e riparti da ${lo}.`;
      out.trend = 'up';
      return out;
    }
    out.kg = lastKg;
    const r = last.sets.map(x => x.reps);
    out.reps = Array.from({ length: sets }, (_, i) => Math.min(hi, Math.max(lo, (r[i] ?? r[r.length - 1]) + (tooHard ? 0 : 1))));
    out.why = tooHard
      ? `Seduta precedente molto dura (RPE ${last.rpe}): stesso carico e stesse ripetizioni.`
      : `Stesso carico, una ripetizione in più per serie (la volta scorsa ${repsList(last.sets)}).`;
    out.trend = tooHard ? 'hold' : 'reps';
    return out;
  }

  // la prossima scheda segue l'ordine dell'elenco, partendo da quella dopo l'ultima fatta
  function nextRoutine(history, routines) {
    if (!routines.length) return null;
    const ids = routines.map(r => r.id);
    const last = history.filter(h => h.type === 'gym' && ids.includes(h.routineId)).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0))[0];
    return last ? routines[(ids.indexOf(last.routineId) + 1) % routines.length] : routines[0];
  }
  const minutes = list => Math.round(list.reduce((m, s) => m + s.sets * ((s.rest || 60) + 40), 0) / 60 / 5) * 5 + 10;

  /* Giorni consigliati per la palestra nella settimana di corsa: forza nello stesso giorno delle sedute
     dure (dopo la corsa) o nei giorni di riposo, mai il giorno prima di una seduta dura, del lungo o
     della gara, né il giorno del lungo; possibilmente un giorno pieno fra una seduta e l'altra.
     runWeek.sess = [{day:0..6, name, hard, long, race}] */
  function suggestDays(runWeek, n = 2) {
    if (!runWeek || !runWeek.sess) return null;
    const by = Array.from({ length: 7 }, (_, d) => runWeek.sess.filter(x => x.day === d));
    const hard = d => by[d] && by[d].some(x => x.hard), race = d => by[d] && by[d].some(x => x.race);
    const score = d => {
      if (race(d) || race(d + 1) || race(d + 2)) return -99;
      let v = 0;
      if (by[d].some(x => x.long)) v += 0; // dopo il lungo le gambe vanno lasciate recuperare
      else if (hard(d)) v += 3; else if (!by[d].length) v += 2; else v += 1;
      if (d < 6 && hard(d + 1)) v -= 4;
      if (d < 6 && by[d + 1] && by[d + 1].some(x => x.long)) v -= 4;
      return v;
    };
    // solo giorni con punteggio positivo: dopo il lungo, prima di qualità/lungo/gara non si propone mai
    const ranked = [0, 1, 2, 3, 4, 5, 6].map(d => ({ d, v: score(d) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v || a.d - b.d);
    const pick = [];
    for (const c of ranked) if (pick.length < n && pick.every(p => Math.abs(p.d - c.d) >= 2)) pick.push(c);
    // con 3 sedute a volte non c'è un giorno pieno di stacco fra tutte: si accettano anche giorni consecutivi
    for (const c of ranked) if (pick.length < n && !pick.includes(c)) pick.push(c);
    return pick.sort((a, b) => a.d - b.d).map(p => ({ day: p.d, with: by[p.d].map(x => x.name), rest: !by[p.d].length }));
  }

  /* ---------- statistiche ---------- */
  const workSets = h => h.exercises.flatMap(e => e.sets.filter(x => x.done && x.kind !== 'warmup').map(x => ({ e, x })));
  // serie per muscolo: 1 al muscolo principale, ½ a ciascun secondario (lookup: id → esercizio)
  function setsByMuscle(history, from, to, lookup) {
    const out = {};
    for (const h of history) {
      if (h.type !== 'gym' || h.date < from || h.date > to) continue;
      for (const { e } of workSets(h)) {
        const ex = lookup(e.variant.id) || e.variant;
        if (!ex.muscle) continue;
        out[ex.muscle] = (out[ex.muscle] || 0) + 1;
        for (const m of ex.sec || []) out[m] = (out[m] || 0) + 0.5;
      }
    }
    return out;
  }
  const volume = h => workSets(h).filter(({ e }) => e.variant.loadType === 'weight').reduce((s, { x }) => s + (Number(x.kg) || 0) * x.reps, 0);
  const setsCount = h => workSets(h).length;
  const repsCount = h => workSets(h).filter(({ e }) => e.variant.loadType !== 'time').reduce((s, { x }) => s + x.reps, 0);

  // migliori prestazioni di un esercizio prima di una certa seduta (esclusa)
  function bests(variantId, history, beforeEnded = Infinity) {
    const b = { kg: 0, e1rm: 0, setVol: 0, reps: 0 };
    for (const h of history) {
      if (h.type !== 'gym' || (h.endedAt || 0) >= beforeEnded) continue;
      for (const { e, x } of workSets(h)) {
        if (e.variant.id !== variantId) continue;
        const kg = Number(x.kg) || 0;
        b.kg = Math.max(b.kg, kg);
        b.e1rm = Math.max(b.e1rm, e1rm(kg, x.reps));
        b.setVol = Math.max(b.setVol, kg * x.reps);
        b.reps = Math.max(b.reps, x.reps);
      }
    }
    return b;
  }
  /* record personali battuti in una seduta rispetto allo storico precedente. Alla prima volta di un
     esercizio non si segnala nulla (non c'è niente da battere). */
  function records(entry, history) {
    const out = [];
    const seen = new Set();
    for (const e of entry.exercises) {
      const v = e.variant;
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      const prev = bests(v.id, history, entry.endedAt || Infinity);
      const sets = entry.exercises.filter(y => y.variant.id === v.id).flatMap(y => y.sets.filter(x => x.done && x.kind !== 'warmup'));
      if (!sets.length || !(prev.kg || prev.reps)) continue;
      if (v.loadType === 'weight') {
        const kg = Math.max(...sets.map(x => Number(x.kg) || 0));
        const orm = Math.max(...sets.map(x => e1rm(Number(x.kg) || 0, x.reps)));
        if (kg > prev.kg) out.push({ id: v.id, name: v.name, kind: 'Carico più alto', value: `${fmt(kg)} kg` });
        else if (orm > prev.e1rm + 0.01) out.push({ id: v.id, name: v.name, kind: 'Massimale stimato', value: `${fmt(Math.round(orm * 10) / 10)} kg` });
      } else if (v.loadType !== 'assistance') {
        const r = Math.max(...sets.map(x => x.reps));
        if (r > prev.reps) out.push({ id: v.id, name: v.name, kind: v.loadType === 'time' ? 'Tempo più lungo' : 'Più ripetizioni', value: v.loadType === 'time' ? `${r} s` : `${r}` });
      }
    }
    return out;
  }

  return { iso, addDays, monday, weeksBetween, cycle, prescribe, lastPerformance, nextRoutine, minutes, suggestDays, e1rm, step, round, parseRange, setsByMuscle, volume, setsCount, repsCount, bests, records };
})();
if (typeof module !== 'undefined') module.exports = GymEngine;

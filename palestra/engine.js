'use strict';
/* Motore del programma di forza: dove sei nel ciclo, cosa fare oggi e con che carico.
   Funzioni pure (nessun DOM, nessun localStorage): si testano con Node in tests/palestra.cjs.

   Progressione "doppia": a parità di carico si aggiunge una ripetizione per serie fino al tetto del
   range; quando tutte le serie arrivano al tetto, la volta dopo si aumenta il carico e si riparte dal
   fondo del range. Gli esercizi a corpo libero progrediscono solo con le ripetizioni, quelli assistiti
   togliendo assistenza. La 4ª settimana di ogni blocco è di scarico (−10%, una serie in meno). */
const GymEngine = (() => {
  const DAY = 864e5;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => new Date(s.slice(0, 10) + 'T12:00:00');
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const monday = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
  const weeksBetween = (a, b) => Math.floor(Math.round((parse(b) - parse(a)) / DAY) / 7);

  // incremento di carico per attrezzo (kg); per i manubri è il peso di un manubrio
  const STEP = { Manubri: 2, Manubrio: 2, Bilanciere: 2.5, Macchina: 2.5, Cavo: 2.5 };
  const step = v => (v.loadType === 'assistance' ? 5 : STEP[v.gear] || 2.5);
  // arrotondamento al peso disponibile: manubri al kg, il resto a 1,25 kg
  const round = (kg, v, dir = 0) => {
    const q = /Manubri/.test(v.gear) ? 1 : 1.25;
    const f = dir < 0 ? Math.floor : dir > 0 ? Math.ceil : Math.round;
    return Math.max(0, f(kg / q) * q);
  };
  // massimale stimato (Epley) da una serie con ~2 ripetizioni in riserva
  const e1rm = (kg, reps) => kg * (1 + (reps + 2) / 30);
  const kgFor = (orm, reps) => orm / (1 + (reps + 2) / 30);

  /* Posizione nel ciclo. start = lunedì della settimana 1 del blocco 1. runWeek (facoltativo) è la
     settimana del piano di corsa di RunPlan: in taper o in settimana gara la palestra va in scarico. */
  function position(blocks, start, today, runWeek) {
    const w = Math.max(0, weeksBetween(monday(start), monday(today)));
    const cycleLen = blocks.length * BLOCK_WEEKS;
    const inCycle = w % cycleLen;
    const bi = Math.floor(inCycle / BLOCK_WEEKS);
    const week = (inCycle % BLOCK_WEEKS) + 1;
    const weekStart = addDays(monday(start), w * 7);
    const blockStart = addDays(weekStart, -(week - 1) * 7);
    const nextBi = (bi + 1) % blocks.length;
    let deload = week === BLOCK_WEEKS, why = deload ? 'Settimana di scarico del blocco.' : '';
    const race = runWeek && runWeek.race;
    if (runWeek && (runWeek.isTaper || race)) {
      deload = true;
      why = race ? 'Settimana di gara: una sola seduta leggera, senza salti, almeno 3 giorni prima della gara.' : 'Taper della corsa: in palestra si scarica anche qui.';
    }
    return {
      cycle: Math.floor(w / cycleLen) + 1, blockIndex: bi, block: blocks[bi], week, deload, why, race: !!race,
      weekStart, blockStart, nextBlock: blocks[nextBi], nextBlockStart: addDays(blockStart, BLOCK_WEEKS * 7),
      rpe: deload ? '6' : blocks[bi].rpe[week - 1] || '8',
    };
  }

  // ultima esecuzione "valida" di una variante: si saltano le sedute di scarico (carichi non rappresentativi)
  function lastPerformance(variantId, history) {
    const list = history.filter(h => h.type === 'gym').sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    for (const h of list) {
      if (h.deload) continue;
      const exs = h.exercises.filter(e => e.variant.id === variantId);
      const sets = exs.flatMap(e => e.sets.filter(x => x.done));
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

  /* Prescrizione di uno slot per la seduta di oggi. Restituisce serie, range, carico e ripetizioni
     suggerite per ogni serie, e una frase che spiega il perché. */
  function prescribe(slot, variant, pos, history) {
    const [lo, hi] = slot.reps;
    let sets = slot.sets;
    if (pos.deload) sets = Math.max(slot.role === 'core' ? 1 : 2, sets - 1);
    const out = { sets, lo, hi, rest: slot.rest, kg: null, reps: Array(sets).fill(lo), why: '', trend: '' };
    const last = lastPerformance(variant.id, history);
    const isBody = variant.loadType === 'body', isAssist = variant.loadType === 'assistance';

    if (!last) {
      out.reps = Array(sets).fill(hi);
      out.why = isBody
        ? `Prima volta: punta a ${lo}–${hi} ripetizioni pulite.`
        : `Prima volta: scegli un carico che ti lasci 2–3 ripetizioni in riserva a ${hi}.`;
      return out;
    }
    const lastKg = Math.max(...last.sets.map(x => Number(x.kg) || 0));
    const sameRange = last.lo === lo && last.hi === hi;
    const atTop = last.sets.length >= last.plannedSets && last.sets.every(x => x.reps >= last.hi);
    const tooHard = last.rpe >= 9;

    if (pos.deload) {
      out.kg = isBody ? null : isAssist ? round(lastKg * 1.1, variant, 1) : round(lastKg * 0.9, variant, -1);
      out.reps = Array(sets).fill(lo);
      out.why = `Scarico: ${isBody ? 'ripetizioni al minimo del range' : isAssist ? 'un po’ più di assistenza' : '−10% del carico'} e una serie in meno.`;
      out.trend = 'deload';
      return out;
    }
    if (isBody) {
      const base = Math.min(...last.sets.map(x => x.reps));
      if (sameRange && atTop) {
        out.reps = Array(sets).fill(hi);
        out.why = `Hai chiuso ${repsList(last.sets)} al tetto del range: tieni ${hi} e rendi l’esercizio più difficile (più lento, più ampio o una variante più dura).`;
        out.trend = 'up';
      } else {
        const t = Math.min(hi, Math.max(lo, (sameRange ? base : lo) + (sameRange ? 1 : 0)));
        out.reps = Array(sets).fill(t);
        out.why = sameRange ? `La volta scorsa ${repsList(last.sets)}: punta a ${t} per serie.` : `Nuovo schema: ${lo}–${hi} ripetizioni.`;
        out.trend = sameRange ? 'reps' : 'new';
      }
      return out;
    }
    if (!sameRange) {
      // nuovo blocco: stima il carico per il nuovo range dal massimale implicito dell'ultima volta
      if (isAssist) {
        out.kg = lastKg;
        out.reps = Array(sets).fill(lo);
        out.why = `Nuovo schema ${lo}–${hi}: riparti da ${fmt(lastKg)} kg di assistenza.`;
      } else {
        const orm = Math.max(...last.sets.map(x => e1rm(Number(x.kg) || 0, x.reps)));
        out.kg = round(kgFor(orm, lo) * 0.97, variant, -1);
        out.reps = Array(sets).fill(lo);
        out.why = `Nuovo schema ${lo}–${hi}: da ${fmt(lastKg)} kg × ${last.sets[0].reps} stimo ${fmt(out.kg)} kg.`;
      }
      out.trend = 'new';
      return out;
    }
    if (atTop && !tooHard) {
      const inc = step(variant);
      out.kg = isAssist ? Math.max(0, lastKg - inc) : round(lastKg + inc, variant);
      out.reps = Array(sets).fill(lo);
      out.why = isAssist
        ? `Hai chiuso ${repsList(last.sets)}: togli ${fmt(inc)} kg di assistenza.`
        : `Hai chiuso ${repsList(last.sets)} al tetto del range: +${fmt(out.kg - lastKg)} kg e riparti da ${lo}.`;
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

  // la prossima scheda segue l'ordine A → B → C (quelle attive); nel blocco nuovo si riparte dalla prima
  function nextRoutine(history, pos, keys = ['A', 'B']) {
    const last = history.filter(h => h.type === 'gym' && h.date >= pos.blockStart && keys.includes(h.routine)).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0))[0];
    return last ? keys[(keys.indexOf(last.routine) + 1) % keys.length] : keys[0];
  }

  /* Dal programma dell'utente (movimenti e serie) alle sedute del blocco: per ogni voce l'esercizio
     del blocco, ripetizioni e recupero. when: 'always' | 'potenza' (solo nel blocco Potenza).
     In settimana gara niente salti. */
  function buildSlots(entries, blockId, opts = {}) {
    return (entries || []).filter(e => PATTERNS[e.p] && (e.when !== 'potenza' || blockId === 'potenza') && !(opts.race && PATTERNS[e.p].role === 'plyo')).map(e => {
      const P = PATTERNS[e.p], d = P[blockId];
      return { id: e.id, p: e.p, name: P.name, group: P.group, area: P.area, role: P.role, ex: d.ex, alt: d.alt, sets: e.sets, reps: d.reps, rest: d.rest, note: d.note || '' };
    });
  }
  // serie a settimana per area, nel blocco indicato, con le sedute attive
  function weeklyVolume(template, keys, blockId) {
    const out = {};
    for (const k of keys) for (const s of buildSlots(template[k], blockId)) out[s.area] = (out[s.area] || 0) + s.sets;
    return out;
  }
  const minutes = slots => Math.round(slots.reduce((m, s) => m + s.sets * (s.rest + 40), 0) / 60 / 5) * 5 + 10;

  /* Giorni consigliati per la palestra nella settimana di corsa: forza nello stesso giorno delle sedute
     dure (dopo la corsa) o nei giorni di riposo, mai il giorno prima di una seduta dura, del lungo o
     della gara, né il giorno del lungo; almeno un giorno pieno tra le due sedute.
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

  return { iso, addDays, monday, weeksBetween, position, prescribe, lastPerformance, nextRoutine, buildSlots, weeklyVolume, minutes, suggestDays, e1rm, step, round, parseRange };
})();
if (typeof module !== 'undefined') module.exports = GymEngine;

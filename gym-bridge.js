/* Ponte fra RunPlan e la Palestra (palestra/, caricata in un iframe).
   - Le sedute di forza finite entrano in lettura nel calendario e nel carico di RunPlan tramite
     runPlanGymActivities(): non vengono copiate in rp_xt né mandate al cloud.
   - La Palestra legge dal piano di corsa la settimana corrente (fase, taper, gara, sedute) per
     mettere lo scarico nelle settimane giuste e consigliare i giorni. */
(function () {
  const KEY = 'passo-v1';
  function gymState() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      return s && (s.version === 1 || s.version === 2) && Array.isArray(s.history) ? s : null;
    } catch {
      return null;
    }
  }
  const pad = n => String(n).padStart(2, '0');
  window.runPlanGymActivities = function () {
    const s = gymState();
    return (s?.history || [])
      .filter(h => h.type === 'gym' && Number.isFinite(h.minutes) && h.minutes > 0 && Number.isFinite(h.rpe) && h.rpe >= 1 && h.rpe <= 10
        && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && typeof h.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(h.id))
      .map(h => {
        const d = new Date(h.startedAt || h.endedAt);
        const time = Number.isFinite(d.getTime()) ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '12:00';
        const note = 'Total Body ' + (h.routine === 'B' ? 'B' : 'A') + (h.blockName ? ' · ' + h.blockName : '');
        return { id: 'passo-' + h.id, date: h.date + ' ' + time, sport: 'gym', min: Math.max(1, Math.round(h.minutes)), rpe: h.rpe, hr: null, note, src: 'passo' };
      });
  };

  // settimana del piano di corsa che contiene la data (lunedì-domenica), con le sedute e il giorno
  const DAY3 = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  function runWeek(dateISO) {
    if (typeof LS !== 'function' || typeof wkSunISO !== 'function') return null;
    let pl = LS('rp_plan');
    if (!pl || !Array.isArray(pl.weeks) || !pl.dateStr) return null;
    if (typeof applyWkEdits === 'function') pl = applyWkEdits(pl) || pl;
    for (const wk of pl.weeks) {
      const sun = wkSunISO(pl, wk), mon = new Date(sun + 'T12:00:00');
      mon.setDate(mon.getDate() - 6);
      const monISO = `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
      if (dateISO < monISO || dateISO > sun) continue;
      const sess = (wk.sess || []).map(x => {
        const name = String(x.n || ''), day = DAY3.indexOf(String(x.t || '').toLowerCase().slice(0, 3));
        const race = /^GARA\b/.test(name) || !!x.race;
        return { day, name, race, long: /lungo/i.test(name), hard: race || !/easy|recupero|riposo|lento|z2|scarico/i.test(name) };
      }).filter(x => x.day >= 0);
      return { w: wk.w, phase: wk.phase, isTaper: !!wk.isTaper, isDeload: !!wk.isDeload, race: sess.some(x => x.race), sess };
    }
    return null;
  }

  let lastSignature = JSON.stringify(window.runPlanGymActivities());
  window.RunPlanGym = {
    runWeek(dateISO) {
      try { return runWeek(dateISO); } catch (e) { console.warn('Palestra: piano di corsa non leggibile', e); return null; }
    },
    changed() {
      const sig = JSON.stringify(window.runPlanGymActivities());
      if (sig === lastSignature) return;
      lastSignature = sig;
      try { if (typeof refresh === 'function') refresh(); } catch (e) { console.warn('Riepilogo palestra', e); }
    },
    isDark() { return document.body.classList.contains('dark'); },
  };
  window.addEventListener('storage', e => { if (e.key === KEY) window.RunPlanGym.changed(); });
})();

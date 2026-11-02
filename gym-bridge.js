/* Ponte fra RunPlan e la Palestra (palestra/, caricata in un iframe).
   - Le sedute di forza finite entrano in lettura nel calendario e nel carico di RunPlan tramite
     runPlanGymActivities(): non vengono copiate in rp_xt. Tutto lo stato della Palestra (passo-v1) va nel
     cloud con pushGymCloud() di js/cloud.js, a ogni salvataggio.
   - La Palestra legge dal piano di corsa la settimana corrente (fase, taper, gara, sedute) per
     mettere lo scarico nelle settimane giuste e consigliare i giorni. */
(function () {
  const KEY = 'passo-v1';
  function gymState() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      return s && [1, 2, 3, 4].includes(s.version) && Array.isArray(s.history) ? s : null;
    } catch {
      return null;
    }
  }
  window.runPlanGymActivities = function () {
    const s = gymState();
    return (s?.history || [])
      .filter(h => h.type === 'gym' && Number.isFinite(h.minutes) && h.minutes > 0 && Number.isFinite(h.rpe) && h.rpe >= 1 && h.rpe <= 10
        && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && typeof h.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(h.id))
      .map(h => {
        const d = new Date(h.startedAt || h.endedAt);
        const time = Number.isFinite(d.getTime()) ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '12:00';
        const note = typeof h.name === 'string' && h.name ? h.name.slice(0, 60) : 'Total Body ' + (['A', 'B', 'C'].includes(h.routine) ? h.routine : 'A') + (h.blockName ? ' · ' + h.blockName : '');
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
      const sun = wkSunISO(pl, wk), monISO = addDaysISO(sun, -6);
      if (dateISO < monISO || dateISO > sun) continue;
      const sess = (wk.sess || []).map(x => {
        const name = String(x.n || ''), day = DAY3.indexOf(String(x.t || '').toLowerCase().slice(0, 3));
        const race = isRaceSess(x); // js/monitor.js: anche le gare intermedie del piano (🏁 senza segno race)
        const c = sessCls(x); // stessa classificazione del piano (monitor.js); se già corsa, la corsa vera
        return { day, name, race, long: c === 'long', hard: race || c !== 'easy' };
      }).filter(x => x.day >= 0);
      return { w: wk.w, phase: wk.phase, isTaper: !!wk.isTaper, isDeload: !!wk.isDeload, race: sess.some(x => x.race), sess };
    }
    return null;
  }

  /* Notifica push di fine recupero (functions/index.js): a telefono bloccato la pagina è sospesa e il timer
     non suona, quindi a ogni recupero si chiede al server una notifica all'ora di fine.
     Attivazione per dispositivo (rp_restpush in localStorage, non sincronizzato): l'iscrizione push è del
     dispositivo. Su iPhone funziona solo dall'app aggiunta alla schermata Home (iOS 16.4+). */
  function restPush() {
    const FN = 'https://europe-west1-runplan-359bd.cloudfunctions.net/';
    const VAPID = 'BGMhX5AwX2IVsEY8WEpmeYGG4v7XkNeelUIqkKatVEBri8g-H861HmHfMVM-88hGfWN8zrFuRUlqMOZh-hdla3I';
    const ON = 'rp_restpush', TASK = 'rp_resttask';
    const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
    const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
    const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const ios = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const installed = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    const key = () => { const s = atob(VAPID.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
    async function subscription(create) {
      const reg = await navigator.serviceWorker.ready;
      let s = await reg.pushManager.getSubscription();
      if (!s && create) s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() });
      return s;
    }
    async function call(name, data) {
      const u = typeof fbAuth !== 'undefined' && fbAuth.currentUser;
      if (!u) throw Error('accesso a RunPlan assente');
      const r = await fetch(FN + name, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await u.getIdToken()) }, body: JSON.stringify({ data }) });
      if (!r.ok) throw Error(name + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return (await r.json()).result;
    }
    // le chiamate vanno in fila: un annullamento non deve superare la programmazione che lo precede
    let chain = Promise.resolve();
    const queue = fn => (chain = chain.then(fn).catch(e => console.warn('Notifica recupero', e)));
    const api = {
      // 'on' | 'off' | 'denied' | 'install' (iPhone fuori dall'app Home) | 'unsupported'
      status() {
        if (!supported()) return ios() && !installed() ? 'install' : 'unsupported';
        if (Notification.permission === 'denied') return 'denied';
        return get(ON) === '1' && Notification.permission === 'granted' ? 'on' : 'off';
      },
      // va chiamata dentro il tocco dell'utente: il permesso si chiede subito, prima di ogni await
      enable() {
        if (!supported()) return Promise.resolve(api.status());
        const perm = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
        return perm.then(async p => {
          if (p !== 'granted') return api.status();
          await subscription(true);
          set(ON, '1');
          return 'on';
        }).catch(e => { console.warn('Notifica recupero', e); set(ON, null); return 'error'; });
      },
      disable() { api.cancel(); set(ON, null); },
      // ora di fine recupero (ms); sostituisce il recupero già programmato
      schedule(at, body) {
        if (api.status() !== 'on') return;
        const id = newId(), prev = get(TASK);
        set(TASK, id);
        queue(async () => {
          const sub = await subscription(false);
          if (!sub) { set(ON, null); return; } // iscrizione tolta dal sistema: va riattivata
          await call('restSchedule', { id, prev, at: Math.round(at), sub: sub.toJSON(), title: 'Recupero finito', body: body || 'Prossima serie.' });
        });
      },
      cancel() {
        const id = get(TASK);
        if (!id) return;
        set(TASK, null);
        queue(() => call('restCancel', { id }));
      },
      // recupero arrivato alla fine: il task è già partito, niente da annullare
      done() { set(TASK, null); },
    };
    return api;
  }

  let lastSignature = JSON.stringify(window.runPlanGymActivities());
  window.RunPlanGym = {
    runWeek(dateISO) {
      try { return runWeek(dateISO); } catch (e) { console.warn('Palestra: piano di corsa non leggibile', e); return null; }
    },
    changed() {
      try { if (typeof pushGymCloud === 'function') pushGymCloud(); } catch (e) { console.warn('Palestra: cloud', e); }
      const sig = JSON.stringify(window.runPlanGymActivities());
      if (sig === lastSignature) return;
      lastSignature = sig;
      try { if (typeof refresh === 'function') refresh(); } catch (e) { console.warn('Riepilogo palestra', e); }
    },
    isDark() { return document.body.classList.contains('dark'); },
    restPush: restPush(),
  };
  window.addEventListener('storage', e => { if (e.key === KEY) window.RunPlanGym.changed(); });
})();

/* ---------- date: funzioni condivise ----------
   Caricato per primo (subito dopo data.js), così è disponibile a tutti gli script, gym-bridge.js compreso.
   Le date "di calendario" (AAAA-MM-GG) si leggono a mezzogiorno locale: l'ora legale non sposta mai il giorno.
   La Palestra (palestra/, in un iframe) ha le sue in palestra/engine.js, che è un modulo a sé testato con Node.

   Le funzioni sono ASSEGNATE all'oggetto globale, non dichiarate con const/function: durante un aggiornamento
   il service worker vecchio serve index.html dalla rete ma gli altri script dalla sua cache, e i vecchi
   util.js / fc.js dichiarano ancora isoLoc, dOnly, addDaysISO… Con una dichiarazione qui il browser
   scarterebbe quei file ("already declared") e l'app resterebbe a metà fino alla chiusura completa;
   un'assegnazione invece convive con le vecchie dichiarazioni. */
(function (g) {
  const pad2 = n => String(n).padStart(2, '0');
  const isoLoc = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; // Date → 'AAAA-MM-GG' in ora locale (no shift UTC)
  const todayISO = () => isoLoc(new Date());
  const dOnly = s => new Date(String(s).slice(0, 10) + 'T12:00:00'); // 'AAAA-MM-GG[ hh:mm]' → Date a mezzogiorno di quel giorno
  const addD = (dt, k) => { const x = new Date(dt); x.setDate(x.getDate() + k); return x; }; // nuovo Date spostato di k giorni (sicuro con ora legale)
  const addDaysISO = (iso, k) => isoLoc(addD(dOnly(iso), k));
  const daysBetween = (a, b) => Math.round((dOnly(b) - dOnly(a)) / 864e5); // b - a, in giorni di calendario
  const mondayOf = iso => { const d = dOnly(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoLoc(d); };
  const weeksBack = n => { const out = []; const m = dOnly(mondayOf(todayISO())); for (let i = 0; i < n; i++) { out.unshift(isoLoc(m)); m.setDate(m.getDate() - 7); } return out; };
  Object.assign(g, { pad2, isoLoc, todayISO, dOnly, addD, addDaysISO, daysBetween, mondayOf, weeksBack });
})(globalThis);

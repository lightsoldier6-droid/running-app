// Fotografia di RunPlan: carica l'app con dati e data fissi, importa i .fit di prova,
// genera un piano, visita tutti i tab e salva HTML + stato. Serve a dimostrare che un
// refactor non cambia nulla di ciò che l'app mostra o salva.
//
// Uso:  node tests/snapshot.cjs <url-app/> <out.json>
//       node tests/snapshot.cjs --compare a.json b.json
// Richiede playwright (npm i playwright) e i .fit in tests/fixtures/.
const fs = require('fs');
const path = require('path');

if (process.argv[2] === '--compare') {
  const A = JSON.parse(fs.readFileSync(process.argv[3])), B = JSON.parse(fs.readFileSync(process.argv[4]));
  const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
  const diff = keys.filter(k => A[k] !== B[k]);
  for (const k of diff) {
    const a = String(A[k] ?? ''), b = String(B[k] ?? ''); let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.log(`DIFF ${k} @${i}\n  A: ${a.slice(Math.max(0, i - 80), i + 120)}\n  B: ${b.slice(Math.max(0, i - 80), i + 120)}`);
  }
  console.log(diff.length ? `${diff.length} differenze su ${keys.length} voci` : `IDENTICHE (${keys.length} voci)`);
  process.exit(diff.length ? 1 : 0);
}

const { chromium } = require('playwright');
const [url, out] = process.argv.slice(2);
const NOW = new Date('2026-10-23T15:00:00+02:00');
const FIX = path.join(__dirname, 'fixtures');
const FB_STUB = `window.__pushed=[];window.firebase={initializeApp(){},auth(){return{currentUser:{uid:'u1'},onAuthStateChanged(cb){setTimeout(()=>cb({uid:'u1'}),0)},signOut(){},signInWithEmailAndPassword(){return Promise.resolve()},createUserWithEmailAndPassword(){return Promise.resolve()}}},firestore:Object.assign(()=>({collection:()=>({doc:()=>({onSnapshot(cb){setTimeout(()=>cb({metadata:{hasPendingWrites:false},data:()=>null}),0);return()=>{}},set(o){window.__pushed.push(o);return Promise.resolve()},get(){return Promise.resolve({exists:false,data:()=>null})}})})}),{FieldValue:{serverTimestamp:()=>0}})};`;
const SEED = {
  rp_xt: [
    { id: 'f2026-10-14 18:00', date: '2026-10-14 18:00', sport: 'gym', min: 50, hr: 118, src: 'fit' },
    { id: 'm1', date: '2026-10-18 10:00', sport: 'bike', min: 90, rpe: 4, hr: null, note: 'giro', src: 'man' },
  ],
  'passo-v1': { version: 1, routines: {}, plan: {}, active: null, timer: null, settings: {}, history: [
    { id: 'g1', type: 'gym', date: '2026-10-20', startedAt: '2026-10-20T18:00:00+02:00', endedAt: Date.parse('2026-10-20T19:00:00+02:00'), minutes: 55, rpe: 7, routine: 'A', exercises: [] },
  ] },
};

(async () => {
  const exe = fs.existsSync('/opt/pw-browsers/chromium-1243/chrome-linux64/chrome') ? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' : undefined;
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Rome', locale: 'it-IT' });
  await ctx.route(/gstatic\.com/, r => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('app-compat') ? FB_STUB : '' }));
  await ctx.route(u => !/^http:\/\/(localhost|127\.0\.0\.1)/.test(u.href) && !/gstatic/.test(u.href), r => r.abort());
  const page = await ctx.newPage();
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(NOW);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', d => d.accept());
  await page.addInitScript(seed => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
    Math.random = (() => { let s = 42; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  }, SEED);
  const tick = async ms => { await page.clock.runFor(ms); await page.waitForTimeout(50); };
  await page.goto(url + 'index.html', { waitUntil: 'load' });
  await tick(2000);

  const snap = {};
  const tabs = async tag => {
    const panes = await page.evaluate(() => [...document.querySelectorAll('.tab')].map(t => t.id.replace('tab-', '')).filter(p => p !== 'gym'));
    for (const p of panes) {
      await page.evaluate(p => showPane(p), p); await tick(300);
      snap[`${tag}/${p}`] = await page.evaluate(p => document.getElementById('tab-' + p).innerHTML, p);
    }
  };
  const state = async tag => {
    snap[`${tag}/localStorage`] = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    snap[`${tag}/numbers`] = await page.evaluate(() => { const L = loadSeries(), l = L[L.length - 1];
      return JSON.stringify({ runs: runs.length, xts: xts.length, ctl: l && l.ctl, atl: l && l.atl }); });
  };

  await tabs('1-avvio'); await state('1-avvio');

  // import .fit
  const fits = (fs.existsSync(FIX) ? fs.readdirSync(FIX) : []).filter(f => f.endsWith('.fit')).sort().map(f => path.join(FIX, f));
  if (fits.length) { await page.setInputFiles('#dt-fit', fits); await tick(5000); }
  await tabs('2-fit'); await state('2-fit');

  // genera un piano maratona con gara intermedia
  await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change')); };
    set('p-goal', '42.195'); set('p-date', '2027-03-21'); set('p-days', '4');
    set('p-r1-dist', '21.0975'); set('p-r1-date', '2027-02-14'); set('p-mode', 'mod');
    genPlan();
  });
  await tick(3000);
  await tabs('3-piano'); await state('3-piano');

  // analisi di ogni corsa con .fit
  const fitRuns = await page.evaluate(() => runs.filter(r => typeof X !== 'undefined' && X[r.date]).map(r => r.date));
  for (const d of fitRuns) {
    await page.evaluate(d => anaOpen(d), d); await tick(800);
    snap[`4-corsa/${d}`] = await page.evaluate(() => [...document.querySelectorAll('.tab.on')].map(t => t.id + ':' + t.innerHTML).join('\n'));
  }

  await page.waitForTimeout(1000); await tick(4000);
  // ultimo invio al cloud (gli invii intermedi dipendono dai tempi delle richieste meteo)
  await page.evaluate(() => typeof pushCloud === 'function' && pushCloud()); await tick(4000);
  snap['cloud/payload'] = await page.evaluate(() => { const p = window.__pushed; return p.length ? p[p.length - 1].payload : ''; });
  snap['errors'] = JSON.stringify(errors);
  fs.writeFileSync(out, JSON.stringify(snap, null, 1));
  console.log(`${Object.keys(snap).length} voci, ${errors.length} errori${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
})();

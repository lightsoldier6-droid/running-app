// Test dei calcoli di RunPlan (senza browser):  node tests/core.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./load-app.cjs');

const near = (v, want, tol, msg) => assert.ok(Math.abs(v - want) <= tol, `${msg}: ${v} (atteso ${want} ± ${tol})`);
const HAS_FIT = fs.existsSync(path.join(__dirname, 'fixtures', 'Lecce - 8x200 2026-06-30.fit')) && fs.existsSync(path.join(__dirname, 'fixtures', 'Gara Surbo 7km 2026-06-18.fit'));
const fitOpt = { skip: HAS_FIT ? false : 'mancano i .fit in tests/fixtures (restano solo in locale)' };
const fitBuf = f => { const b = fs.readFileSync(path.join(__dirname, 'fixtures', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };

test('Daniels: VDOT, previsioni e passi', () => {
  const { run } = loadApp();
  const vd = run('vdotOf(5,1200)');
  near(vd, 49.8, 0.2, 'VDOT di un 5k in 20:00');
  assert.equal(run('fmtD(predict(10,vdotOf(5,1200)))'), '41:28');
  assert.equal(run('fmtD(predict(42.195,vdotOf(5,1200)))'), '3:11:17');
  const p = JSON.parse(run('JSON.stringify(Object.fromEntries(Object.entries(paces(50)).map(([k,v])=>[k,Array.isArray(v)?v.map(fmtP):fmtP(v)])))'));
  assert.deepEqual(p, { E: ['5:38', '5:07'], M: '4:30', T: '4:15', I: '3:55', R: '3:38' });
  // più veloce = VDOT più alto
  assert.ok(run('vdotOf(10,2400)') > run('vdotOf(10,2500)'));
});

test('formati e parsing dei tempi', () => {
  const { run } = loadApp();
  assert.equal(run('fmtP(300)'), '5:00');
  assert.equal(run('fmtP(0)'), '–');
  assert.equal(run('fmtD(3725)'), '1:02:05');
  assert.equal(run('parseHMS("3:45:00")'), 13500);
  assert.equal(run('parseHMS("45:30")'), 2730);
  assert.equal(run('parseHMS("abc")'), null);
});

test('classificazione dal titolo (tabella del README)', () => {
  const { run } = loadApp();
  const c = (title, km = 8, sec = 2400) => run(`cls(${JSON.stringify({ title, km, sec })})`);
  assert.equal(c('Gara Otranto 10k'), 'race');
  assert.equal(c('medio-soglia 25'), 'qual');
  assert.equal(c('fartlek 8x1'), 'qual'); // la parola chiave vince sul pattern NxM
  assert.equal(c('8x200'), 'int');
  assert.equal(c('lungo 100'), 'long');
  assert.equal(c('giro mattina', 16), 'long'); // lungo automatico da 15 km
  assert.equal(c('giro mattina', 10, 80 * 60), 'long'); // o da 75'
  assert.equal(c('giro mattina'), 'easy');
  assert.equal(run(`subType({title:'8x200',km:6})`), 'ripetute 200m');
  assert.equal(run(`subType({title:'10x1',km:8})`), "ripetute 1'");
});

test('carico: TRIMP corsa, altri sport e palestra dal registro', () => {
  const gym = { version: 1, history: [{ id: 'g1', type: 'gym', date: '2026-10-20', startedAt: '2026-10-20T18:00:00+02:00', minutes: 47.5, rpe: 7, routine: 'B' },
    { id: 'bad', type: 'gym', date: '2026-10-21', minutes: 40, rpe: 0 }] }; // RPE non valido: escluso
  const { run } = loadApp({ storage: { 'passo-v1': gym, rp_xt: [{ id: 'm1', date: '2026-10-18 10:00', sport: 'bike', min: 90, rpe: 4, hr: null, src: 'man' }] } });
  near(run('runLoad({sec:3600,km:12,hr:140,date:"2026-10-01 08:00"})'), 85.29, 0.01, 'TRIMP 60\' a FC 140');
  assert.ok(run('runLoad({sec:3600,km:12,hr:160,date:"2026-10-01 08:00"})') > run('runLoad({sec:3600,km:12,hr:140,date:"2026-10-01 08:00"})'));
  near(run('xtLoad({sport:"gym",min:55,rpe:7,hr:null})'), 100.98, 0.01, 'palestra 55\' RPE 7');
  near(run('xtLoad({sport:"bike",min:90,rpe:4,hr:null})'), 87.72, 0.01, 'bici 90\' RPE 4');
  const all = JSON.parse(run('JSON.stringify(allXts())'));
  assert.deepEqual(all.map(x => [x.id, x.min, x.src]), [['m1', 90, 'man'], ['passo-g1', 48, 'passo']]); // minuti interi
  const L = run('loadSeries()'); const last = L[L.length - 1];
  assert.equal(last.d, '2026-10-23');
  for (const k of ['ctl', 'atl', 'tsb']) assert.ok(Number.isFinite(last[k]), k);
});

test('import .fit: ripetute con titolo automatico e lap', fitOpt, async () => {
  const app = loadApp(); app.ctx.__buf = fitBuf('Lecce - 8x200 2026-06-30.fit');
  const r = JSON.parse(await app.run(`(async()=>{runs=runs.filter(r=>!r.date.startsWith('2026-06-30'));const c={nr:0,nu:0,nx:0,skip:0,xt:0};
    await ingestFitBuf(__buf,'Activity_123.fit',c);const r=runs.find(r=>r.date.startsWith('2026-06-30'));
    return JSON.stringify({c,date:r.date,title:r.title,km:r.km,sec:r.sec,hr:r.hr,cls:cls(r),laps:lapsDB[r.date].laps.length,x:!!X[r.date]})})()`));
  assert.deepEqual(r, { c: { nr: 1, nu: 0, nx: 1, skip: 0, xt: 0 }, date: '2026-06-30 07:13', title: 'Ripetute - 8x200m', km: 6.75, sec: 2168, hr: 151, cls: 'int', laps: 25, x: true });
});

test('import .fit: una corsa già presente viene completata, non duplicata', fitOpt, async () => {
  const app = loadApp(); app.ctx.__buf = fitBuf('Gara Surbo 7km 2026-06-18.fit');
  const r = JSON.parse(await app.run(`(async()=>{const n0=runs.length;const c={nr:0,nu:0,nx:0,skip:0,xt:0};
    await ingestFitBuf(__buf,'Gara Surbo 7km.fit',c);await ingestFitBuf(__buf,'Gara Surbo 7km.fit',c);
    return JSON.stringify({c,added:runs.length-n0,cls:cls(runs.find(r=>r.date.startsWith('2026-06-18')))})})()`));
  assert.equal(r.added, 0);
  assert.equal(r.c.nr, 0);
  assert.equal(r.c.nu, 2);
  assert.equal(r.cls, 'race');
});

test('la palestra non finisce nei dati inviati al cloud', () => {
  const { run, store } = loadApp({ storage: { 'passo-v1': { version: 1, history: [{ id: 'g1', type: 'gym', date: '2026-10-20', minutes: 50, rpe: 6 }] } } });
  run(`LS('rp_xt',xts)`);
  assert.equal(store.get('rp_xt'), '[]');
  assert.ok(!/passo/.test(run(`JSON.stringify({runs,xt:LS('rp_xt')})`)));
});

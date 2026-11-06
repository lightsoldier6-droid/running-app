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

test('strategia di gara: GPX a giri, passi che tornano al tempo obiettivo', () => {
  const { run } = loadApp();
  // anello quadrato di 2,5 km percorso 4 volte = 10 km, con una salitella di 5 m sul primo lato
  const run2 = run(`(()=>{
    const pts=[],lat0=40.25,lon0=18.28,dLat=625/110540,dLon=625/(111320*Math.cos(lat0*Math.PI/180));
    for(let g=0;g<4;g++)for(let i=0;i<100;i++){const s=Math.floor(i/25),f=(i%25)/25;
      const [la,lo]=s===0?[lat0+f*dLat,lon0]:s===1?[lat0+dLat,lon0+f*dLon]:s===2?[lat0+dLat-f*dLat,lon0+dLon]:[lat0,lon0+dLon-f*dLon];
      pts.push('<trkpt lat="'+la+'" lon="'+lo+'"><ele>'+(50+(s===0?5*f:s===1?5:s===2?5*(1-f):0))+'</ele></trkpt>')}
    pts.push('<trkpt lat="'+lat0+'" lon="'+lon0+'"><ele>50</ele></trkpt>');
    const gpx='<gpx><trk><name>Anello &amp; test</name><trkseg>'+pts.join('')+'</trkseg></trk><wpt lat="'+(lat0+dLat)+'" lon="'+lon0+'"><name>Ristoro</name></wpt></gpx>';
    const c=courseBuild(gpxParse(gpx));
    racesDB={'u:t':{name:'T',km:10,date:'2026-11-15',target:2700,course:c}};
    const r=raceList()[0],S=stratCompute(r);
    return JSON.stringify({name:c.name,len:c.len,laps:c.laps.length,turns:c.turns.length,wp:c.wp.length,up:c.up,km:snapKm(c.len),
      tot:S.K[S.K.length-1].cum,n:S.K.length,tgt:raceTarget().sec,src:raceTarget().src});
  })()`);
  const o = JSON.parse(run2);
  assert.equal(o.name, 'Anello & test');
  near(o.len, 10000, 60, 'lunghezza misurata');
  assert.equal(o.km, 10);
  assert.equal(o.laps, 3); // 3 ripassaggi dal via = 4 giri
  assert.ok(o.turns >= 12 && o.turns <= 16, 'curve a 90°: ' + o.turns);
  assert.equal(o.wp, 1); // un punto notevole, agganciato al punto di traccia più vicino
  near(o.up, 20, 4, 'dislivello positivo (4 × 5 m)');
  near(o.tot, 2700, 0.5, 'la somma dei km torna al tempo obiettivo');
  assert.equal(o.n, 10);
  assert.equal(o.tgt, 2700);
  assert.equal(o.src, 'scelto da te');
});

test('ricalibra i passi: tre VDOT (gare, soglia FC, facile FC) e rampa dalla prima settimana futura', () => {
  const { run } = loadApp({ now: '2026-11-04T10:00:00+01:00' });
  const S = (t, n, d) => ({ t, n, d, km: 10 });
  const plan = { goal: 42.195, dateStr: '2026-12-13', vd: 47, vdTarget: 52, ph: { baseW: 3, speedW: 3, ispecW: 0, specW: 0, taper: 2 },
    weeks: [
      { w: 1, hist: 1, phase: 'base', sess: [S('Domenica', 'Lungo', "60' @ 5:30–6:00")] },
      { w: 2, hist: 1, phase: 'base', sess: [S('Domenica', 'Lungo', "60' @ 5:30–6:00")] },
      { w: 3, phase: 'base', sess: [S('Martedì', 'Easy', "40' @ 5:20–5:52"), S('Domenica', 'Lungo con finale', "60' @ 5:20–5:52 + 20' @ 4:35–4:41 (M)")] },
      { w: 4, phase: 'speed', sess: [S('Martedì', 'Interval', "8×5' @ 4:06–4:12 (I), rec 3' @ 5:15–5:47")] },
      { w: 5, phase: 'speed', sess: [] }, { w: 6, phase: 'speed', sess: [] }, { w: 7, phase: 'taper', sess: [] },
      { w: 8, phase: 'taper', sess: [{ t: 'Domenica', n: 'GARA 🏁', d: '42.2 km @ 4:20/km — obiettivo 3:03:00', km: 42.2 }] }] };
  const J = c => JSON.parse(run(`JSON.stringify(${c})`));
  run(`var P=${JSON.stringify(plan)}`);
  // la rampa conta dalla prima settimana non storica: w3 è la 1ª di 6 → 47 + 5/6
  near(J('planWeekVd(P,P.weeks[2])').R, 47 + 5 / 6, 1e-9, 'VDOT della settimana in corso');
  const r = J(`(()=>{const r=repacePlan(P,{R:47,T:46,E:44},'2026-11-04');return{p:r.plan,n:r.nSess}})()`);
  const w3 = r.p.weeks[2], w4 = r.p.weeks[3];
  assert.deepEqual(w3.vdk, { E: 44, T: 46, R: 47 }, 'la settimana in corso parte dai valori misurati');
  assert.equal(w3.sess[0].d, "40' @ 5:20–5:52", 'martedì è già passato: non si tocca');
  const m = w3.sess[1].d.match(/(\d:\d\d)–(\d:\d\d) \+ 20' @ (\d:\d\d)–(\d:\d\d)/);
  assert.ok(m, w3.sess[1].d);
  // stessa intensità del testo di partenza (5:20 a VDOT 47.83), riportata al VDOT facile 44
  assert.equal(m[1], run(`fmtP(vAt(vo2(60000/320)/(47+5/6),44))`), 'facile: limite veloce dal VDOT facile');
  near(run(`parseHMS('${m[1]}')`), run('paces(44).E[1]'), 3, 'facile ≈ limite veloce del range E a VDOT 44');
  assert.ok(run(`parseHMS('${m[3]}')`) > run(`parseHMS('4:35')`), 'ritmo maratona più lento con la soglia più bassa');
  // un range si converte tutto con la stessa classe: le ripetute I restano I (passi dalle gare)
  const iv = w4.sess[0].d.match(/@ (\d:\d\d)–(\d:\d\d) \(I\)/);
  const gap = run(`parseHMS('${iv[2]}')-parseHMS('${iv[1]}')`);
  assert.ok(gap >= 5 && gap <= 7, `ampiezza del range I conservata: ${iv[1]}–${iv[2]}`);
  assert.ok(w4.vdk.E > 44 && w4.vdk.T > 46 && w4.vdk.R > 47, 'la progressione verso il target riparte dai valori misurati');
  near(r.p.vdkT.R - 47, 52 - (47 + 5 / 6), 0.02, 'resta il guadagno che il piano prevedeva ancora');
  run(`var P2=${JSON.stringify(r.p)}`);
  assert.deepEqual(J('planWeekVd(P2,P2.weeks[3])'), w4.vdk, 'le settimane ricalibrate portano i loro VDOT');
  assert.equal(run(`repacePlan(P2,{R:47,T:46,E:44},'2026-11-04').nSess`), 0, 'stessa forma: niente da riscrivere');
  // Flex: una foto fatta prima della v130 si legge dal range facile scritto nella seduta
  near(J(`legacyFlexVd("35' @ 5:12–5:43 + 4 allunghi")`).E, run(`vdotFromE(312)`), 1e-9, 'VDOT dalla seduta');
});

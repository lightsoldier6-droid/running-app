/* ---------- fitness da FC (engine + interfaccia) ---------- */
/* =====================================================================================
   FITNESS DA FREQUENZA CARDIACA (zone da evidenza, minuti per zona, indice aerobico)
   Ogni corsa importata da .fit/.zip porta con sé X[chiave] = metriche secondo per secondo
   (istogramma FC, tenute, migliori tratti, minuti veloci, deriva, traccia). Da lì:
   zone da evidenza, minuti per zona, indice aerobico, curva passo-FC, capacità e lacune.
   ===================================================================================== */
let X=(()=>{try{return JSON.parse(localStorage.getItem('rp_hrx')||'{}')||{}}catch(e){return{}}})();
let xCloudTimer=null;
function saveX(){
  try{localStorage.setItem('rp_hrx',JSON.stringify(X))}catch(e){ // spazio pieno: via le tracce più vecchie
    const ks=Object.keys(X).sort();for(const k of ks.slice(0,Math.ceil(ks.length/2)))if(X[k])delete X[k].tr;
    try{localStorage.setItem('rp_hrx',JSON.stringify(X))}catch(e2){console.warn('rp_hrx',e2)}}
  pushCloudX();
}
// Le metriche FC viaggiano nello stesso documento cloud delle corse, in un campo a parte (hrx) scritto
// con merge: non tocca updatedAt, quindi non fa ricaricare gli altri dispositivi. Le tracce restano locali
// (pesano e il documento ha un limite di 1 MB).
function pushCloudX(){
  if(typeof cloudReady==='undefined'||!cloudReady||!fbAuth.currentUser)return;
  clearTimeout(xCloudTimer);
  xCloudTimer=setTimeout(()=>{
    const c={};for(const k in X){const{tr,...rest}=X[k];c[k]=rest}
    fbDb.collection('users').doc(fbAuth.currentUser.uid).set({
      hrx:JSON.stringify(c),hrxWriter:cloudSessionId,hrxAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true}).catch(e=>console.warn('cloud hrx',e));
  },2000);
}
function cloudXIn(d){
  if(!d)return;
  if(!d.hrx){if(Object.keys(X).length)pushCloudX();return}
  const rv=d.hrxAt&&d.hrxAt.toMillis?d.hrxAt.toMillis():0,lv=+(localStorage.getItem('rp_hrx_v')||0);
  if(rv&&rv<=lv)return;localStorage.setItem('rp_hrx_v',rv);
  if(d.hrxWriter===cloudSessionId)return;
  let inc={};try{inc=JSON.parse(d.hrx||'{}')}catch(e){return}
  for(const k in inc){const loc=X[k];X[k]=inc[k];if(loc&&loc.tr&&!inc[k].tr)X[k].tr=loc.tr}
  try{localStorage.setItem('rp_hrx',JSON.stringify(X))}catch(e){}
  zCache=null;try{rFit();rAna()}catch(e){}
}

/* ---------- utilità ---------- */
const dOnly=s=>new Date(s.slice(0,10)+'T12:00:00');
const daysBetween=(a,b)=>Math.round((dOnly(b)-dOnly(a))/864e5); // b - a
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const median=a=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1]};
function xFlag(r,x){
  if(!x||!x.hist)return 'nessun dato FC secondo per secondo';
  if(x.cov<.7)return 'FC presente solo nel '+Math.round(x.cov*100)+'% della corsa';
  if(x.art>.12*x.mov)return Math.round(x.art/60)+' min di FC scartati (picchi o aggancio alla cadenza)';
  return null}
function xOf(r){const x=X[r.date];if(!x||!x.hist||r.tm||r.nh)return null;
  if(xFlag(r,x)&&!(st.hrok&&st.hrok[r.date]))return null;return x}
// corse con dati FC in una finestra di giorni che termina in 'end' (ISO, default oggi)
function xRuns(days,end){end=end||todayISO();
  return runs.filter(r=>{const g=daysBetween(r.date,end);return g>=0&&g<days&&xOf(r)})}
function histSum(x,a,b){ // secondi e metri con FC in [a,b)
  const h=x.hist;let s=0,m=0;if(!h)return[0,0];
  for(let i=Math.max(0,a-h.h0);i<h.s.length&&h.h0+i<b;i++){s+=h.s[i];m+=h.m[i]}return[s,m]}
function histAvg(x){const h=x.hist;let s=0,w=0;h.s.forEach((v,i)=>{s+=(h.h0+i)*v;w+=v});return w?s/w:null}
const fmtMin=s=>Math.round(s/60)+"'";

/* ---------- gare: riconosciute e confermate ---------- */
const RACE_D=[5,10,15,21.0975,42.195];
function raceState(r){return st.races&&st.races[r.date]}
function raceCands(){
  const yr=runs.filter(r=>daysAgo(r)<540&&!r.np&&r.km>=3);
  const out=[];
  yr.forEach(r=>{
    const s=raceState(r);
    const vd=vdotOf(r.km,r.sec);
    const ref=bestVdot(runs.filter(q=>Math.abs(daysBetween(q.date,r.date))<120&&raceState(q)!=='n'))||vd;
    const near=RACE_D.some(d=>Math.abs(r.km-d)/d<.035);
    const byTitle=cls(r)==='race';
    const x=X[r.date];
    const hr=x&&x.hist?histAvg(x):r.hr;
    const hard=vd>=ref*.93&&(!hr||hr>=(st.hrrest+.8*(st.hrmax-st.hrrest)));
    if(s==='y'||byTitle||(near&&hard)||(hard&&vd>=ref*.97&&r.km>=5))out.push({r,vd,hr,state:s||(byTitle?'t':'?'),near});
  });
  return out.sort((a,b)=>a.r.date<b.r.date?1:-1);
}
function setRace(key,v){st.races=st.races||{};if(v)st.races[key]=v;else delete st.races[key];LS('rp_st',st);zCache=null;refresh()}

/* ---------- zone: stima da evidenza o confermate ---------- */
const ZN=['Recupero','Steady','LT1','LT2','Alta intensità'];
const ZTAG=['Z1','Z2','Z3','Z4','Z5'];
let zCache=null;
function zoneAnchor(){
  // sforzi da gara (titolo "gara" o confermati) degli ultimi 180 giorni con FC affidabile:
  // la FC media di uno sforzo di 35-75' sta appena sopra il tetto di LT2; di 18-35' (5k) ~4-5 bpm sopra;
  // di 75-130' (mezza) ~3 bpm sotto. Si prende la stima più alta degli ultimi 120 giorni (forma attuale).
  const out=[];
  runs.forEach(r=>{
    if(r.tm||r.nh||daysAgo(r)>180)return;
    const s=raceState(r);if(s==='n')return;
    if(!(s==='y'||cls(r)==='race'))return;
    const x=X[r.date];let hr=null,min=r.sec/60;
    if(x&&x.hist&&x.cov>=.85){hr=histAvg(x);min=x.mov/60}else if(r.hr)hr=r.hr;
    if(!hr||min<18||min>135)return;
    const top=min<35?hr-5:min<75?hr-1:hr+3;
    out.push({r,hr:Math.round(hr),min:Math.round(min),top:Math.round(top),age:daysAgo(r)});
  });
  const rec=out.filter(o=>o.age<=120);const pool=rec.length?rec:out;
  if(!pool.length)return null;
  return pool.reduce((a,b)=>b.top>a.top?b:a);
}
function zonesFromTop(top,src,anchor){
  const floor=Math.round(st.hrrest+.42*(st.hrmax-st.hrrest));
  const c2=top-18,c=[c2-25,c2,top-7,top+1];
  return{c,floor,top,src,anchor};
}
function Zcur(){
  if(zCache)return zCache;
  const a=zoneAnchor();
  const prop=a?zonesFromTop(a.top,'stima',a):zonesFromTop(Math.round(st.hrrest+.85*(st.hrmax-st.hrrest)),'formula',null);
  zCache=st.zones&&st.zones.c?{c:st.zones.c.slice(),floor:st.zones.floor||prop.floor,top:st.zones.c[3]-1,src:'confermate',date:st.zones.date,prop}:{...prop,prop};
  return zCache;
}
function zIdx(h,Z){Z=Z||Zcur();const c=Z.c;return h<c[0]?0:h<c[1]?1:h<c[2]?2:h<c[3]?3:4}
function zRange(i,Z){Z=Z||Zcur();const c=Z.c;return i===0?[Z.floor,c[0]-1]:i===4?[c[3],null]:[c[i-1],c[i]-1]}
const zLab=(i,Z)=>{const r=zRange(i,Z);return r[1]==null?r[0]+'+':r[0]+'–'+r[1]};
function zSecs(x,Z){Z=Z||Zcur();const s=[0,0,0,0,0],m=[0,0,0,0,0];const h=x.hist;if(!h)return{s,m};
  h.s.forEach((v,i)=>{const k=zIdx(h.h0+i,Z);s[k]+=v;m[k]+=h.m[i]});return{s,m}}

/* ---------- settimane ---------- */
function mondayOf(iso){const d=dOnly(iso);d.setDate(d.getDate()-((d.getDay()+6)%7));return isoLoc(d)}
function weeksBack(n){const out=[];let m=dOnly(mondayOf(todayISO()));for(let i=0;i<n;i++){out.unshift(isoLoc(m));m.setDate(m.getDate()-7)}return out}
const addDaysISO=(iso,k)=>{const d=dOnly(iso);d.setDate(d.getDate()+k);return isoLoc(d)};

/* ---------- 1. ricetta: minuti a settimana per zona ---------- */
function recipe(days,end){
  const rs=xRuns(days,end),Z=Zcur(),s=[0,0,0,0,0],m=[0,0,0,0,0];
  rs.forEach(r=>{const z=zSecs(X[r.date],Z);z.s.forEach((v,i)=>{s[i]+=v;m[i]+=z.m[i]})});
  const all=runs.filter(r=>{const g=daysBetween(r.date,end||todayISO());return g>=0&&g<days&&!r.tm}).length;
  return{perWk:s.map(v=>v/60/(days/7)),pace:s.map((v,i)=>m[i]>200?v/(m[i]/1000):null),n:rs.length,all};
}
/* ---------- 2. minuti di soglia per settimana ---------- */
function weekZones(n){
  const ws=weeksBack(n),Z=Zcur();
  return ws.map(w=>{const s=[0,0,0,0,0];let nx=0,nr=0;
    runs.forEach(r=>{if(mondayOf(r.date)!==w||r.tm)return;nr++;const x=xOf(r);if(!x)return;nx++;zSecs(x,Z).s.forEach((v,i)=>s[i]+=v)});
    return{w,min:s.map(v=>v/60),nx,nr}});
}
/* ---------- 3. indice aerobico (VDOT stimato dalla FC) ----------
   Per 4 bande di 8 bpm sotto il tetto di LT2: velocità tenuta → costo in O2 (formula di Daniels),
   frazione di riserva cardiaca → VO2max equivalente. Media delle bande valide (≥10' e ≥2 corse). */
function aeroBands(Z){Z=Z||Zcur();const t=Z.c[3];return[[t-32,t-24],[t-24,t-16],[t-16,t-8],[t-8,t]]}
function bandEst(sec,m,hm){const v=m/(sec/60),f=(hm-st.hrrest)/(st.hrmax-st.hrrest);if(f<=.3)return null;return(vo2(v)-3.5)/f+3.5}
function aeroWin(end,days){
  days=days||28;const rs=xRuns(days,end).filter(r=>!r.np),B=aeroBands();
  return B.map(([a,b])=>{let s=0,m=0,nr=0;rs.forEach(r=>{const[ss,mm]=histSum(X[r.date],a,b);if(ss>=60)nr++;s+=ss;m+=mm});
    const ok=s>=600&&nr>=2;return{a,b,s,m,nr,ok,pace:m>0?s/(m/1000):null,est:ok?bandEst(s,m,(a+b)/2):null}});
}
const aeroIdx=bs=>{const v=bs.filter(b=>b.ok);return v.length>=3?mean(v.map(b=>b.est)):null};
function aeroSeries(n){
  const out=[];const ws=weeksBack(n);
  ws.forEach((w,i)=>{const end=i===ws.length-1?todayISO():addDaysISO(w,6);const v=aeroIdx(aeroWin(end));out.push({w,end,v})});
  return out;
}
function aeroMoved(){
  const now=aeroWin(todayISO()),prev=aeroWin(addDaysISO(todayISO(),-7));
  const rows=now.map((b,i)=>({...b,prev:prev[i]}));const common=rows.filter(r=>r.ok&&r.prev.ok);
  rows.forEach(r=>{r.contrib=r.ok&&r.prev.ok?(r.est-r.prev.est)/Math.max(3,common.length):null});
  return{rows,ok:common.length>=3,total:common.length>=3?common.reduce((s,r)=>s+r.contrib,0):null};
}
/* ---------- 4. curva passo-FC (bande di 5 bpm, ≥3 corse) ---------- */
function curveWin(end){
  end=end||todayISO();let days=40,rs=xRuns(days,end).filter(r=>!r.np);
  const tot=()=>rs.reduce((s,r)=>s+X[r.date].hist.s.reduce((a,b)=>a+b,0),0);
  while(tot()<60000&&days<120){days+=7;rs=xRuns(days,end).filter(r=>!r.np)}
  const pts=[];
  for(let a=100;a<200;a+=5){let s=0,m=0,nr=0;rs.forEach(r=>{const[ss,mm]=histSum(X[r.date],a,a+5);if(ss>=90)nr++;s+=ss;m+=mm});
    if(nr>=3&&s>=300&&m>0)pts.push({a,pace:s/(m/1000),s,nr})}
  return{days,pts,min:Math.round(tot()/60)};
}
function curveBest(){ // finestre di 40 giorni negli ultimi 18 mesi, a passi di 2 settimane
  const best={};for(let k=0;k<39;k++){const end=addDaysISO(todayISO(),-14*k);const c=curveWin(end);
    c.pts.forEach(p=>{if(!best[p.a]||p.pace<best[p.a].pace)best[p.a]={pace:p.pace,end}})}
  return best;
}
function zonePaceWin(i,end){const Z=Zcur(),[a,b]=zRange(i,Z);const c=curveWin(end);let s=0,m=0;
  xRuns(c.days,end).forEach(r=>{if(r.np)return;const[ss,mm]=histSum(X[r.date],a,b==null?250:b+1);s+=ss;m+=mm});
  return s>=600&&m>0?s/(m/1000):null}
/* ---------- 5. tenute: tratti continui nella stessa banda di 5 bpm ---------- */
function holdsWin(days,minSec){
  const rs=xRuns(days).filter(r=>!r.np),byB={};
  rs.forEach(r=>(X[r.date].holds||[]).forEach(([b,s,m])=>{if(s<minSec)return;const o=byB[b]=byB[b]||{n:0,s:0,m:0};o.n++;o.s+=s;o.m+=m}));
  return Object.entries(byB).map(([b,o])=>({b:+b,...o,pace:o.m?o.s/(o.m/1000):null})).sort((a,b)=>a.b-b.b);
}
/* ---------- 6. quanto costa ogni passo (bande di 20s, dalla traccia ogni 30s) ---------- */
function paceCost(days){
  const rs=xRuns(days).filter(r=>!r.np),bk={};
  rs.forEach(r=>{const t=X[r.date].tr;if(!t)return;t.p.forEach((p,i)=>{if(!p||p<180||p>480)return;const b=Math.floor(p/20)*20;
    const o=bk[b]=bk[b]||{n:0,h:0,hn:0};o.n++;if(t.h[i]){o.h+=t.h[i];o.hn++}})});
  return Object.entries(bk).map(([b,o])=>({b:+b,min:o.n*.5/(days/7),hr:o.hn?o.h/o.hn:null})).filter(o=>o.min>=1).sort((a,b)=>a.b-b.b);
}
/* ---------- 7. passo accumulato: i minuti più veloci della settimana, sommati ---------- */
function accWeek(w){
  const ms=[];runs.forEach(r=>{if(mondayOf(r.date)!==w||r.np)return;const x=X[r.date];if(x&&x.fast)ms.push(...x.fast)});
  ms.sort((a,b)=>b-a);const out={};
  for(const L of[3000,5000,10000]){let d=0,t=0;for(const v of ms){if(d+v>=L){t+=(L-d)/v;d=L;break}d+=v;t++}
    out[L]=d>=L?t*60/(L/1000):null}
  return out;
}
/* ---------- 8. migliori tratti ---------- */
function bestIn(days){const o={};runs.forEach(r=>{if(days&&daysAgo(r)>=days)return;const x=X[r.date];if(!x||!x.best||r.np)return;
  for(const k in x.best)if(!o[k]||x.best[k]<o[k].s)o[k]={s:x.best[k],r}});return o}
/* ---------- 9. capacità ripetibile, guardrail, esposizione, divario di resistenza ---------- */
function weeklySeries(){
  if(!runs.length)return[];const m={};runs.forEach(r=>{const k=mondayOf(r.date);m[k]=(m[k]||0)+vk(r)});
  const out=[];let w=mondayOf(runs[0].date);const cur=mondayOf(todayISO());
  while(w<=cur){out.push({w,km:m[w]||0});w=addDaysISO(w,7)}return out;
}
function capacity(){
  const ws=weeklySeries();const done=ws.slice(0,-1);if(done.length<8)return null;
  const big=done.reduce((a,b)=>b.km>a.km?b:a);
  const means=[];for(let i=8;i<=done.length;i++){const sl=done.slice(i-8,i);const act=sl.filter(x=>x.km>0).length;
    if(act>=6)means.push({end:sl[7].w,v:mean(sl.map(x=>x.km))})}
  const last12=means.filter(o=>daysBetween(o.end,todayISO())<=365);
  const best8=means.length?means.reduce((a,b)=>b.v>a.v?b:a):null;
  const lv=last12.map(o=>o.v).sort((a,b)=>a-b);const rep=lv.length?lv[Math.floor(lv.length*.75)]:mean(done.slice(-8).map(x=>x.km)); // superato in 1 blocco su 4 dell'ultimo anno
  const curB=mean(done.slice(-4).map(x=>x.km));
  return{big,best8,rep,cur:curB,safe:[rep*.73,rep*.9],ceil:[rep*1.26,rep*1.4]};
}
function exposure(){
  const Z=Zcur();const last=f=>{for(let i=runs.length-1;i>=0;i--){if(f(runs[i]))return runs[i]}return null};
  const zmin=(r,k)=>{const x=xOf(r);return x?zSecs(x,Z).s[k]/60:0};
  return[
    ['Lungo (≥90\' o ≥18 km)',last(r=>!r.tm&&(r.sec>=5400||r.km>=18))],
    ['Lavoro a LT2 (≥10\' in zona)',last(r=>zmin(r,3)>=10)],
    ['Alta intensità (≥6\' in zona)',last(r=>zmin(r,4)>=6)],
    ['Gara o test 5–10 km',last(r=>r.km>=4.5&&r.km<=10.6&&(raceState(r)==='y'||(cls(r)==='race'&&raceState(r)!=='n')))],
  ].map(([n,r])=>({n,r,days:r?daysAgo(r):null}));
}
function enduranceGap(){
  const isRace=r=>raceState(r)==='y'||(cls(r)==='race'&&raceState(r)!=='n')||(r.km>=40&&raceState(r)!=='n');
  const short=runs.filter(r=>isRace(r)&&r.km>=4.5&&r.km<=10.6&&daysAgo(r)<365).map(r=>({r,v:vdotOf(r.km,r.sec)}));
  const long=runs.filter(r=>isRace(r)&&r.km>=20&&daysAgo(r)<540).map(r=>({r,v:vdotOf(r.km,r.sec)}));
  const bs=short.length?short.reduce((a,b)=>b.v>a.v?b:a):null,bl=long.length?long.reduce((a,b)=>b.v>a.v?b:a):null;
  return{bs,bl,gap:bs&&bl?bs.v-bl.v:null};
}
function durability(){
  const Z=Zcur();return xRuns(84).map(r=>({r,d:X[r.date].dec})).filter(o=>o.d&&o.d.cv<.08&&o.d.min>=45&&zIdx(o.d.hr,Z)<=2);
}
/* ---------- 10. obiettivo: cosa chiede la gara e quanto manca ---------- */
function demand(goalKm,tSec){
  const min=tSec/60;
  if(goalKm>=42){
    const band=min<=180?'≤3:00':min<=210?'3:00–3:30':min<=255?'3:30–4:15':'oltre 4:15';
    const fast=min<=210;
    return{band,dur:`${Math.round(min)} minuti di gara`,
      text:fast?'A questo livello la gara si corre per lo più tra LT1 alto e LT2 basso: decide la capacità di tenere quel ritmo quando la fatica si accumula dopo il 25-30° km, più che la velocità pura.':'A questo livello la gara si corre intorno o sotto LT1: decidono volume aerobico, durata dei lunghi e gestione di carboidrati e passo.',
      emph:fast?[['Specifico ritmo maratona',25],['Tenuta (soglia bassa lunga)',23],['LT2 / soglia',16],['LT1 di raccordo',15],['Economia (allunghi, salite brevi)',11],['Potenza aerobica',6],['VO2max',4]]:
                [['Volume aerobico e lunghi',32],['Specifico ritmo maratona',22],['LT1 di raccordo',18],['LT2 / soglia',12],['Economia',10],['Potenza aerobica',6]],
      proofs:[['LT1 di raccordo',"60–75' continui a LT1, oppure lungo con 2×25–30' a LT1",14,10],
              ['Tenuta',"2×25' o 3×15' a LT2 basso dentro un medio-lungo",12,8],
              ['Specifico',"3×5 km a ritmo maratona con breve recupero corsa",10,7],
              ['Specifico',"lungo con gli ultimi 8–14 km (35–60') a ritmo maratona",8,5],
              ['Specifico',"2×8–10 km a ritmo maratona",7,4],
              ['Economia',"6 allunghi in piano dopo un medio-lungo, tutto l'anno; meno negli ultimi 10 giorni",52,1]],
      errors:['Allenarsi coi carichi di un atleta molto più veloce senza averne il recupero','Trasformare ogni medio-lungo in una corsa "steady" dura','Ripetere troppo spesso lavori da 20 km e più a ritmo gara','Sopravvalutare le sedute VO2 perché 5k e 10k migliorano in fretta','Trascurare il lavoro a LT1']};
  }
  if(goalKm>=21)return{band:min<=90?'≤1:30':min<=110?'1:30–1:50':'oltre 1:50',dur:`${Math.round(min)} minuti di gara`,
    text:'La mezza si corre intorno a LT2 (più vicino al tetto se dura meno di 80\'): servono soglia lunga e tenuta.',
    emph:[['LT2 / soglia',30],['Specifico ritmo mezza',22],['Volume e lunghi',20],['Potenza aerobica',12],['LT1',10],['Economia',6]],
    proofs:[['Soglia',"3×10–12' a LT2",10,6],['Specifico',"3×4 km a ritmo mezza",6,3],['Tenuta',"lungo con finale di 20–30' a ritmo mezza",7,3]],
    errors:['Fare tutto il lavoro di qualità sopra soglia','Nessun lungo oltre i 18 km']};
  return{band:goalKm>=10?'10 km':'5 km',dur:`${Math.round(min)} minuti di gara`,
    text:'Sulle distanze brevi la gara si corre sopra LT2: contano potenza aerobica e VO2, sostenuti da un buon volume facile.',
    emph:[['Potenza aerobica / VO2',30],['LT2 / soglia',25],['Volume facile',25],['Economia e velocità',20]],
    proofs:[['VO2',"5×1000 m al ritmo gara o poco più veloce",6,2],['Soglia',"20–25' a LT2",8,3]],errors:['Correre gli easy troppo forte']};
}
function goalTarget(){
  const pl=LS('rp_plan');if(!pl)return null;
  let t=st.goalT||null;
  if(!t&&pl.target)t=parseHMS(pl.target);
  if(!t&&pl.GT){const m=String(pl.GT).split('–').map(parseHMS).filter(Boolean);if(m.length)t=mean(m)}
  return t?{km:+pl.goal,sec:t,date:pl.dateStr,pl}:null;
}
/* ---------- 11. dose di intensità prevista nelle sedute del piano ---------- */
function planDose(txt,goalKm){
  const o=[0,0,0];if(!txt)return o; // [LT1, LT2, alta]
  const Z={M:0,gara:goalKm>=42?0:1,'ritmo mezza':1,T:1,I:2,R:2};
  let t=String(txt);
  t=t.replace(/([\d.]+) km continui @ (\d:\d\d)(?:–(\d:\d\d))? \((M|gara|T)\)/g,(_,k,a,b,z)=>{const p=(toSec(a)+toSec(b||a))/2;o[Z[z]]+=k*p/60;return''});
  t=t.replace(/(\d+)×(\d+)' alternando (\d+)' @ [^()]*\((M|gara)\) \/ (\d+)' @ [^()]*\(T\)/g,(_,n,_m,a,z,b)=>{o[Z[z]]+=n*a;o[1]+=n*b;return''});
  t=t.replace(/(\d+)×(\d+)' alternando (\d+)' @ [\d:]+ \(poco sopra M\)/g,(_,n,mm)=>{o[0]+=n*mm;return''});
  t=t.replace(/([\d.]+) km @ (\d:\d\d)(?:–(\d:\d\d))?\/km/g,(_,k,a,b)=>{const p=(toSec(a)+toSec(b||a))/2,mm=k*p/60;o[k<12?2:k<30?1:0]+=mm;return''});
  t=t.replace(/(\d+)×\((\d+)'(?:\d+")? @ [^()]*\((I|R)\)/g,(_,n,mm)=>{o[2]+=n*mm;return''});
  t=t.replace(/(\d+)×(\d+)(?:"|'(?:(\d+)")?) @ [^()+]*\((I|R|T|M|gara)\)/g,(s,n,mm,ss,z)=>{
    const isSec=/^\d+×\d+"/.test(s);const per=isSec?mm/60:(+mm+(ss?ss/60:0));o[Z[z]]+=n*per;return''});
  t=t.replace(/(\d+)×(\d+)m @ (\d:\d\d)(?:–(\d:\d\d))? \((I|R|T|M|gara)\)/g,(_,n,d,a,b,z)=>{const p=(toSec(a)+toSec(b||a))/2;o[Z[z]]+=n*d/1000*p/60;return''});
  t.replace(/(\d+)' @ [^()+']*\((T|M|I|R|gara|ritmo mezza)\)/g,(_,mm,z)=>{o[Z[z]]+=+mm;return''});
  t.replace(/(\d+)' continui da [\d:]+ a [\d:]+ \(E→(T|M)\)/g,(_,mm,z)=>{o[z==='T'?1:0]+=mm/3;return''});
  return o.map(v=>Math.round(v));
}
/* ---------- 12. FC suggerita accanto ai passi del piano ---------- */
function hrTag(txt){
  if(!txt)return txt;try{const Z=Zcur();const lab=i=>{const r=zRange(i,Z);return r[1]==null?'FC '+r[0]+'+':'FC '+r[0]+'–'+r[1]};
  if(st.guide==='hr'&&typeof hrMode==='function')return hrMode(String(txt),Z,lab);
  return String(txt).replace(/\((I|R|T|M|Z2|gara)\)/g,(s,z)=>{const i={Z2:1,M:2,gara:2,T:3,I:4,R:4}[z];
    return z==='R'?s:`${s}<span class="hrt">${lab(i)}</span>`});
  }catch(e){console.warn('hrTag',e);return txt}
}


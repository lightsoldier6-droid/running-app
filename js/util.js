/* ---------- utils ---------- */
const fmtP=s=>{if(!s||!isFinite(s))return'–';const t=Math.round(s);return`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`};
const fmtD=s=>{s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${m}:${String(x).padStart(2,'0')}`};
const day=d=>new Date(d.replace(' ','T'));
// GIORNI INTERI, non ore. Prima era (adesso − ora della corsa)/24h: le finestre "ultimi 7 giorni" e
// "7 giorni precedenti" scorrevano con l'ora in cui aprivi l'app e con l'ora di partenza della corsa,
// così un lungo poteva cadere FUORI da entrambe per pochi minuti — un caso reale ha prodotto
// "+142% (16→39)" con due sole corse nella finestra precedente. Ancorando tutto alla mezzanotte le
// finestre sono giorni pieni e i numeri non cambiano a seconda dell'ora. 0 = oggi.
const daysAgo=r=>Math.round((new Date().setHours(0,0,0,0)-day(r.date).setHours(0,0,0,0))/864e5);
const pace=r=>r.sec/r.km;

/* ---------- classificazione ---------- */
function cls(r){
  const t=(r.title||'').toLowerCase();
  if(/gara|race|competizione/.test(t))return 'race';
  if(/soglia|medio|progressiv|tempo run|fartlek|cruise/.test(t))return 'qual';
  if(/\d+\s*[x×]\s*\d+/.test(t)||/interval|ripetut/.test(t))return 'int';
  if(/lungo|long/.test(t)||r.km>=15||r.sec>=75*60)return 'long';
  return 'easy';
}
const CLSN={int:'Interval',qual:'Qualità',long:'Lungo',easy:'Easy',race:'Gara'};
function subType(r){ // sottotipo per il confronto (es. ripetute 200m vs soglia)
  const t=(r.title||'').toLowerCase();
  if(cls(r)==='int'){const m=t.match(/\d+\s*[x×]\s*(\d+)/);if(m)return 'ripetute '+m[1]+(+m[1]<50?"'":'m');return 'ripetute'}
  if(/soglia|tempo run|cruise/.test(t))return 'soglia';
  if(/medio/.test(t))return 'medio';
  if(/progressiv/.test(t))return 'progressivo';
  if(/fartlek/.test(t))return 'fartlek';
  return null;
}

/* ---------- Daniels VDOT ---------- */
const pct=t=>0.8+0.1894393*Math.exp(-0.012778*t)+0.2989558*Math.exp(-0.1932605*t);
const vo2=v=>-4.6+0.182258*v+0.000104*v*v;
const vdotOf=(km,sec)=>{const t=sec/60,v=km*1000/t;return vo2(v)/pct(t)};
const vAt=(f,vd)=>{const c=4.6+f*vd,v=(-0.182258+Math.sqrt(0.182258**2+4*0.000104*c))/(2*0.000104);return 60000/v};
function predict(km,vd){let lo=km*2.2,hi=km*12;for(let i=0;i<60;i++){const m=(lo+hi)/2;vdotOf(km,m*60)>vd?lo=m:hi=m}return lo*60}
function parseHMS(s){const a=String(s).trim().split(':');if(!a.length||a.some(x=>x===''||isNaN(+x)))return null;const n=a.map(Number);let sec;if(n.length===3)sec=n[0]*3600+n[1]*60+n[2];else if(n.length===2)sec=n[0]*60+n[1];else if(n.length===1)sec=n[0];else return null;return sec>0?sec:null}
function bestVdot(list){let b=null;for(const r of list){if(r.km<3||r.np)continue;if(typeof st!=='undefined'&&st&&st.races&&st.races[r.date]==='n')continue;const v=vdotOf(r.km,r.sec);if(!b||v>b)b=v}return b}
const curVdot=()=>bestVdot(runs.filter(r=>daysAgo(r)<90))||bestVdot(runs);
function paces(vd){return{E:[vAt(.62,vd),vAt(.70,vd)],M:vAt(.82,vd),T:vAt(.88,vd),I:vAt(.975,vd),R:vAt(1.07,vd)}}
// target di una seduta a ripetute preso dalla seduta PIANIFICATA (tag I/R/T/M e range di passo),
// non indovinato dalla distanza della ripetuta (un 6×2' Interval fa frazioni ~490m ma non è ripetute R).
function plannedFor(dateISO){
  // aggancio manuale (st.links, chiave = data completa della corsa): vince sull'abbinamento per data
  const lk=(typeof st!=='undefined'&&st&&st.links&&st.links[dateISO])||null;
  if(lk==='none')return null;
  const ds=lk||(dateISO||'').slice(0,10);
  const src=(typeof monitor!=='undefined'&&monitor&&monitor.sessions)||[];
  return src.find(s=>(s.date||'').slice(0,10)===ds)||null;
}
function workTarget(sess){
  if(!sess||!sess.work)return null;
  const w=sess.work;
  // preferisci il range col tag di zona (è il lavoro, non il riscaldamento/recupero)
  let m=w.match(/(\d:\d\d)\s*[–-]\s*(\d:\d\d)\s*\((I|R|T|M)\)/);
  let zone=m?m[3]:((w.match(/\((I|R|T|M)\)/)||[])[1]||null);
  if(!m)m=w.match(/(\d:\d\d)\s*[–-]\s*(\d:\d\d)/)||w.match(/@\s*(\d:\d\d)/);
  if(!m)return null;
  const a=toSec(m[1]),b=m[2]?toSec(m[2]):a;
  return {lo:Math.min(a,b),hi:Math.max(a,b),mid:(a+b)/2,zone};
}

/* ---------- tabs ---------- */
const GROUPS={oggi:['dash'],piano:['plan','mon'],gara:['gara'],forma:['fit','zon'],prog:['prog'],corse:['runs'],imp:['data'],gym:['gym']};
const PTITLE={dash:'Oggi',fit:'Forma',zon:'Forma',prog:'Progressi',gara:'Gara',plan:'Piano',mon:'Piano',runs:'Corse',data:'Impostazioni',gym:'Palestra'};
let curPane='dash';
function showPane(p){
  curPane=p;
  if(p==='gym'){const f=document.getElementById('gym-frame');if(!f.getAttribute('src'))f.src=f.dataset.src;}
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.id==='tab-'+p));
  const g=Object.keys(GROUPS).find(k=>GROUPS[k].includes(p));
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x.dataset.g===g));
  document.querySelectorAll('.seg span[data-p]').forEach(x=>x.classList.toggle('on',x.dataset.p===p));
  document.getElementById('hdr-t').textContent=PTITLE[p]||'';
  if(p==='plan'&&!document.getElementById('p-out').querySelector('.wk')){const pl=LS('rp_plan');if(pl)try{rPlan(pl)}catch(e){console.warn(e)}}
  window.scrollTo(0,0);
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showPane(GROUPS[b.dataset.g][0]));
document.querySelectorAll('.seg span[data-p]').forEach(sp=>sp.onclick=()=>showPane(sp.dataset.p));
document.getElementById('gear').onclick=()=>showPane('data');

/* ---------- SVG charts ---------- */
// Ogni grafico dice da solo come si legge: unità sull'asse, verso "meglio", tacche tonde,
// linee di riferimento (piano, zero, obiettivo, media), valore dell'ultimo punto scritto e
// una riga di lettura sotto (cosa è un punto, da → a, migliore). Prima c'erano solo linea e numeri.
function niceStep(span,n,pace){
  const raw=(span||1)/Math.max(1,n);
  if(pace){for(const s of[5,10,15,20,30,60,120,300])if(s>=raw)return s;return 600}
  const p=Math.pow(10,Math.floor(Math.log10(raw)));
  for(const m of[1,2,2.5,5,10])if(m*p>=raw-1e-12)return m*p;return 10*p;
}
function stepDec(st){let d=0;while(d<3&&Math.abs(Math.round(st*10**d)-st*10**d)>1e-9)d++;return d}
const chEsc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function chart(el,pts,o={}){
  const{ylab=v=>v.toFixed(0),color='var(--acc)',bar=false,invertY=false,unit='',each='',ref=[],avg=false,pace=false,better=null,suf='',extra='',read=true}=o;
  const W=420,H=206,P={l:44,r:12,t:26,b:24};
  const host=document.getElementById(el);if(!host)return;
  if(pts.length<2){host.innerHTML='<p class="muted">Dati insufficienti</p>';return}
  const n=pts.length,ys=pts.map(p=>p.y),mu=ys.reduce((a,b)=>a+b,0)/n;
  const refs=ref.filter(r=>r&&r.y!=null&&isFinite(r.y)).slice();
  if(avg)refs.push({y:mu,lab:'media '+ylab(mu),c:'var(--dim)',avg:1});
  const allY=ys.concat(refs.map(r=>r.y));
  let y0=Math.min(...allY),y1=Math.max(...allY);if(bar)y0=Math.min(0,y0);
  // mai tacche più fitte della precisione con cui scrivo i valori (niente 257.6 ms se il valore è 258)
  const yDec=pace?0:((String(ylab(ys[0])).match(/\.(\d+)/)||[,''])[1]).length;
  const step=Math.max(niceStep(y1-y0,4,pace),pace?1:10**-yDec);
  y0=Math.floor(y0/step+1e-9)*step;y1=Math.ceil(y1/step-1e-9)*step;if(y1<=y0)y1=y0+step;
  // spazio per l'etichetta dell'ultimo valore: se il punto tocca il bordo, una tacca in più
  const lastY=ys[n-1],edge=invertY?lastY-y0:y1-lastY;if(!bar&&edge<step*.25){if(invertY)y0-=step;else y1+=step}
  const tick=o.tlab||(pace?fmtP:(v=>v.toFixed(stepDec(step))+suf));
  const slot=(W-P.l-P.r)/n;
  const X=i=>bar?P.l+slot*(i+.5):P.l+i*(W-P.l-P.r)/(n-1);
  const Y=v=>{let f=(v-y0)/(y1-y0);if(invertY)f=1-f;return H-P.b-f*(H-P.t-P.b)};
  let s='';
  // riga di testa: unità a sinistra, verso del "meglio" a destra
  const topBetter=better?((better==='up')!==!!invertY):null;
  const upTxt=o.up||(better?(topBetter?'↑ meglio':'↓ meglio'):'');
  if(unit)s+=`<text x="2" y="12" class="cu">${chEsc(unit)}</text>`;
  if(upTxt)s+=`<text x="${W-2}" y="12" text-anchor="end" class="cd">${chEsc(upTxt)}</text>`;
  for(let v=y0;v<=y1+step*1e-6;v+=step){const y=Y(v);
    s+=`<line x1="${P.l}" y1="${y.toFixed(1)}" x2="${W-P.r}" y2="${y.toFixed(1)}" stroke="var(--line)"/><text x="${P.l-6}" y="${(y+4).toFixed(1)}" text-anchor="end">${tick(v)}</text>`}
  if(bar){const bw=Math.max(2,Math.min(26,slot*.72));
    pts.forEach((p,i)=>{const yv=Y(p.y),yb=Y(Math.max(y0,0));s+=`<rect x="${(X(i)-bw/2).toFixed(1)}" y="${Math.min(yv,yb).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(yb-yv).toFixed(1)}" fill="${p.c||color}" fill-opacity="${p.o||1}" rx="1.5"/>`})}
  else{const line=pts.map((p,i)=>`${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join('L');
    s+=`<path d="M${X(0).toFixed(1)},${H-P.b}L${line}L${X(n-1).toFixed(1)},${H-P.b}Z" fill="${color}" fill-opacity="0.08"/>`;
    s+=`<path d="M${line}" fill="none" stroke="${color}" stroke-width="2"/>`;
    pts.forEach((p,i)=>{if(i<n-1)s+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.6" fill="${p.c||color}"/>`})}
  // linee di riferimento, con il nome scritto sopra a destra
  refs.forEach(r=>{const y=Y(r.y);const c=r.c||'var(--txt)';
    s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${c}" stroke-width="1.3" stroke-dasharray="5 4" opacity=".85"/>`;
    s+=`<text x="${P.l+4}" y="${(y-4).toFixed(1)}" class="cr" style="fill:${c}">${chEsc(r.lab||'')}</text>`});
  // ultimo punto evidenziato con il suo valore
  {const i=n-1,x=X(i),y=Y(pts[i].y);
    if(!bar)s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" fill="${pts[i].c||color}" stroke="var(--card)" stroke-width="2"/>`;
    const below=y-P.t<16;s+=`<text x="${(x+(bar?0:-2)).toFixed(1)}" y="${(below?y+18:y-8).toFixed(1)}" text-anchor="${bar?'middle':'end'}" class="cv">${chEsc(pts[i].vl||ylab(pts[i].y))}</text>`}
  // etichette asse x: ~5, mai tagliate ai bordi
  const xs=Math.max(1,Math.ceil(n/5));
  pts.forEach((p,i)=>{const last=i===n-1;if(!(i%xs===0&&(last||n-1-i>=xs*.6))&&!last)return;
    const tw=String(p.x).length*6.4,cx=Math.max(tw/2+1,Math.min(W-tw/2-1,X(i)));
    s+=`<text x="${cx.toFixed(1)}" y="${H-6}" text-anchor="middle">${chEsc(p.x)}</text>`});
  // tooltip: tocco/hover → valore del punto più vicino
  s+=`<g class="ctt" style="display:none;pointer-events:none"><line y1="${P.t}" y2="${H-P.b}" stroke="var(--dim)" stroke-dasharray="3 3"/><circle r="4" fill="${color}" stroke="var(--card)" stroke-width="2"/><rect rx="5" height="20" fill="var(--txt)" fill-opacity=".9"/><text text-anchor="middle" style="fill:var(--card);font-size:11.5px;font-weight:600"></text></g>`;
  // riga di lettura
  let rd='';
  if(read){const f=pts[0],l=pts[n-1],parts=[];
    if(each)parts.push(each);
    if(better&&n>=2){
      // la differenza si calcola sui valori come sono scritti, così 1.20 → 1.19 fa −0.01 e non −0.00
      let d,dec=0;
      if(pace)d=Math.round(l.y)-Math.round(f.y);
      else{const sa=String(ylab(f.y)),sb=String(ylab(l.y)),a=parseFloat(sa),b=parseFloat(sb);dec=((sb.match(/\.(\d+)/)||[,''])[1]).length;
        d=isFinite(a)&&isFinite(b)?+(b-a).toFixed(dec):+(l.y-f.y).toFixed(stepDec(step)+1);if(!(isFinite(a)&&isFinite(b)))dec=stepDec(step)+1}
      const good=d===0?null:(better==='up')===(d>0);
      const dtx=pace?`${Math.abs(d)}" /km ${d<0?'più veloce':'più lento'}`:`${d>0?'+':'−'}${Math.abs(d).toFixed(dec)}`;
      parts.push(`da ${chEsc(f.x)} a ${chEsc(l.x)}: ${ylab(f.y)} → <b>${ylab(l.y)}</b>${good==null?' (invariato)':` <span class="${good?'up':'down'}">(${dtx}${pace?'':good?', meglio':', peggio'})</span>`}`);
      const bi=ys.reduce((b,v,i)=>((better==='up')?v>ys[b]:v<ys[b])?i:b,0);
      if(bi!==n-1&&ylab(ys[bi])!==ylab(l.y))parts.push(`migliore ${ylab(ys[bi])} (${chEsc(pts[bi].x)})`)}
    if(extra)parts.push(extra);
    if(parts.length){let t=parts.join(' · ');t=t.replace(/^[a-zà-ù]/,c=>c.toUpperCase());rd=`<p class="chr">${t}.</p>`}}
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="chv" style="touch-action:pan-y">${s}</svg>${rd}`;
  const svg=host.querySelector('svg'),tt=svg.querySelector('.ctt');
  const tl=tt.querySelector('line'),tc=tt.querySelector('circle'),tr=tt.querySelector('rect'),tx=tt.querySelector('text');
  const show=cx=>{
    const rct=svg.getBoundingClientRect(),vx=(cx-rct.left)*W/rct.width;
    let i=bar?Math.floor((vx-P.l)/slot):Math.round((vx-P.l)/((W-P.l-P.r)/(n-1)));
    i=Math.max(0,Math.min(n-1,i));
    const x=X(i),lab=`${pts[i].x} · ${pts[i].t||ylab(pts[i].y)}`;
    tl.setAttribute('x1',x);tl.setAttribute('x2',x);
    tc.setAttribute('cx',x);tc.setAttribute('cy',Y(pts[i].y));tc.style.display=bar?'none':'';
    const tw=lab.length*6.6+16,txp=Math.max(tw/2+1,Math.min(W-tw/2-1,x));
    tr.setAttribute('x',txp-tw/2);tr.setAttribute('y',P.t-22);tr.setAttribute('width',tw);
    tx.setAttribute('x',txp);tx.setAttribute('y',P.t-8);tx.textContent=lab;
    tt.style.display='';
  };
  svg.addEventListener('pointermove',e=>show(e.clientX));
  svg.addEventListener('pointerdown',e=>show(e.clientX));
  svg.addEventListener('pointerleave',()=>tt.style.display='none');
}

/* ---------- aggregazioni ---------- */
let prRange={from:null,to:null};
const inRange=r=>{const d=r.date.slice(0,10);return(!prRange.from||d>=prRange.from)&&(!prRange.to||d<=prRange.to)};
const fRuns=()=>runs.filter(inRange);
function rangeSpan(list){if(!list.length)return 0;return(day(list[list.length-1].date)-day(list[0].date))/864e5}
function weekKey(d){const dt=day(d);const mon=new Date(dt);mon.setDate(dt.getDate()-((dt.getDay()+6)%7));return isoLoc(mon)}
const MESI=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const labDay=k=>{const p=k.split('-');return +p[2]+' '+MESI[+p[1]-1]}; // '2026-07-06' -> '6 lug'
const labMonth=k=>{const p=k.split('-');return MESI[+p[1]-1]+' '+p[0].slice(2)}; // '2026-07' -> 'lug 26'
function weeklyKm(list){list=list||runs;const m={};list.forEach(r=>{const k=weekKey(r.date);m[k]=(m[k]||0)+vk(r)});return Object.entries(m).sort()}
function groupAvg(list,val,wt){ // media per settimana o mese; wt opzionale = peso (media ponderata, es. km)
  const wk=rangeSpan(list)<=150;
  const m={};
  list.forEach(r=>{const v=val(r);if(v==null||!isFinite(v))return;const w=wt?wt(r):1;if(!(w>0))return;const k=wk?weekKey(r.date):r.date.slice(0,7);(m[k]=m[k]||[]).push([v,w])});
  const out=Object.entries(m).sort().map(([k,v])=>({x:wk?labDay(k):labMonth(k),y:v.reduce((a,p)=>a+p[0]*p[1],0)/v.reduce((a,p)=>a+p[1],0),n:v.length}));
  out.per=wk?'settimana':'mese';return out;
}
function monthlyVdot(list){
  list=list||runs;if(!list.length)return[];
  const out=[];const first=day(list[0].date),last=day(list[list.length-1].date);
  const n=Math.min(24,Math.max(2,Math.round((last-first)/(30*864e5))+1));
  for(let i=n-1;i>=0;i--){const to=new Date(last);to.setDate(to.getDate()-i*Math.max(14,Math.round((last-first)/864e5/n)));
    const from=new Date(to);from.setDate(from.getDate()-60);
    const v=bestVdot(list.filter(r=>{const d=day(r.date);return d>=from&&d<=to}));
    if(v)out.push({x:MESI[to.getMonth()]+' '+String(to.getFullYear()).slice(2),y:+v.toFixed(1)})}
  return out}
function pbs(){
  const t={'5 km':5,'10 km':10,'Mezza':21.0975};const rows=[];
  for(const[n,d]of Object.entries(t)){
    let best=null;runs.forEach(r=>{if(r.km>=d*0.98&&!r.np){const est=r.sec*(d/r.km);if(!best||est<best.sec)best={sec:est,r}}});
    if(best)rows.push(`<tr><td>${n}</td><td class="r">${fmtD(best.sec)}</td><td class="r pace">${fmtP(best.sec/d)}/km</td><td class="r muted">${best.r.date.slice(0,10)}</td></tr>`)}
  return rows.join('')}


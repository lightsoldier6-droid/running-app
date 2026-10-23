/* ---------- grafici piccoli ---------- */
const zcol=i=>`var(--z${i+1})`;
function hbars(rows,unit){
  const mx=Math.max(1e-9,...rows.map(r=>r.v||0));
  return `<div class="hb">${rows.map(r=>`<div class="hbr"><div class="hbl">${r.l}${r.sub?`<small>${r.sub}</small>`:''}</div><div class="hbt"><i style="width:${Math.max(r.v?2:0,100*(r.v||0)/mx).toFixed(1)}%;background:${r.c||'var(--acc)'}"></i></div><div class="hbv">${r.txt!=null?r.txt:Math.round(r.v||0)+(unit||'')}</div></div>`).join('')}</div>`;
}
function gbars(el,labels,series,fmt,o={}){ // barre affiancate per settimana
  const host=document.getElementById(el);if(!host)return;
  const W=420,H=196,P={l:36,r:8,t:24,b:24};
  const mx=Math.max(1,...series.flatMap(s=>s.v.map(v=>v||0)));
  const step=Math.max(5,Math.ceil(mx/4/5)*5),top=step*Math.ceil(mx/step);
  const n=labels.length,gw=(W-P.l-P.r)/n,bw=Math.max(2,(gw-4)/series.length-1);
  const Y=v=>H-P.b-(v/top)*(H-P.t-P.b);
  let s=`<text x="2" y="12" class="cu">${o.unit||''}</text>`;
  for(let g=0;g<=top;g+=step)s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(g)}" y2="${Y(g)}" stroke="var(--line)"/><text x="${P.l-5}" y="${Y(g)+4}" text-anchor="end">${g}</text>`;
  const xs=Math.max(1,Math.ceil(n/5));
  labels.forEach((lb,i)=>{series.forEach((se,j)=>{const v=se.v[i];if(v==null)return;const x=P.l+i*gw+2+j*(bw+1),y=Y(v);
      s+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0,H-P.b-y).toFixed(1)}" rx="1.5" fill="${se.c}" fill-opacity="${se.o||1}"><title>${lb} · ${se.n}: ${fmt?fmt(v):Math.round(v)}</title></rect>`});
    if((i%xs===0&&n-1-i>=xs*.6)||i===n-1){const tw=String(lb).length*6.4,cx=Math.max(tw/2+1,Math.min(W-tw/2-1,P.l+i*gw+gw/2));s+=`<text x="${cx.toFixed(1)}" y="${H-6}" text-anchor="middle">${lb}</text>`}});
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="chv">${s}</svg><div class="lgd">${series.map(se=>`<span><i style="background:${se.c};opacity:${se.o||1}"></i>${se.n}</span>`).join('')}</div>${o.leg?`<p class="chr">${o.leg}</p>`:''}`;
}
function pillset(id,opts,cur,cb){const el=document.getElementById(id);if(!el)return;
  el.innerHTML=opts.map(([v,l])=>`<span class="pill${v===cur?' on':''}" data-v="${v}">${l}</span>`).join('');
  el.querySelectorAll('.pill').forEach(p=>p.onclick=()=>cb(+p.dataset.v));}

/* ---------- tab Fitness ---------- */
let fitWin=4,fitHold=10,aeroN=26;
function rFit(){
  const host=document.getElementById('tab-fit');if(!host)return;
  const nX=runs.filter(r=>X[r.date]&&X[r.date].hist).length;
  const rec12=runs.filter(r=>daysAgo(r)<84&&!r.tm),rec12x=rec12.filter(r=>xOf(r)).length;
  const Z=Zcur();
  const set=(id,h)=>{const e=document.getElementById(id);if(e)e.innerHTML=h};
  // copertura dati
  set('f-cov',nX?`<p class="muted">FC secondo per secondo su <b>${nX}</b> corse (${rec12x}/${rec12.length} delle ultime 12 settimane).${rec12x<rec12.length?` Per completare lo storico importa l'archivio Garmin o Strava (.zip) nel tab <b>Dati</b>.`:''}</p>`
    :`<div class="stwarn">Qui servono le corse con la FC secondo per secondo: importa l'<b>archivio .zip</b> di Garmin o Strava (o i singoli .fit) dal tab <b>Dati</b>. Le corse arrivate dal CSV hanno solo le medie.</div>`);
  // 1. zone attuali
  const zp=[0,1,2,3,4].map(i=>zonePaceWin(i));const vd=curVdot(),pc=vd?paces(vd):null;
  const dan=pc?[`>${fmtP(pc.E[0])}`,`${fmtP(pc.E[1])}–${fmtP(pc.E[0])}`,`M ${fmtP(pc.M)}`,`T ${fmtP(pc.T)}`,`I ${fmtP(pc.I)}`]:['','','','',''];
  const src=Z.src==='confermate'?`<span class="phb race">confermate${Z.date?' il '+Z.date:''}</span>`:Z.src==='stima'?`<span class="phb ispec">stimate</span> <span class="muted">dalla ${Z.anchor.r.title} del ${Z.anchor.r.date.slice(0,10)} (${Z.anchor.min}', FC media ${Z.anchor.hr})</span>`:`<span class="phb deload">da formula</span> <span class="muted">nessuna gara con FC: uso la riserva cardiaca</span>`;
  set('f-zones',`<p style="margin-bottom:8px">${src}</p><table><tr><th>Zona</th><th class="r">FC</th><th class="r">Passo osservato</th><th class="r">Passo Daniels</th></tr>${[0,1,2,3,4].map(i=>`<tr><td><span class="zdot" style="background:${zcol(i)}"></span>${ZN[i]} <span class="muted">${ZTAG[i]}</span></td><td class="r">${zLab(i,Z)}</td><td class="r">${zp[i]?fmtP(zp[i])+'/km':'<span class="muted">–</span>'}</td><td class="r muted">${dan[i]}</td></tr>`).join('')}</table><p class="muted" style="margin-top:6px">Passo osservato = quello che hai davvero tenuto in quella fascia di FC negli ultimi 40 giorni (almeno 10'). Le zone si correggono in Impostazioni (⚙).</p>`);
  // 2. ricetta
  pillset('f-win',[[1,'1 sett'],[4,'4 sett'],[8,'8 sett']],fitWin,v=>{fitWin=v;rFit()});
  const rc=recipe(fitWin*7);const tot=rc.perWk.reduce((a,b)=>a+b,0);
  const hard=rc.perWk[2]+rc.perWk[3]+rc.perWk[4];
  set('f-recipe',rc.n?hbars(rc.perWk.map((v,i)=>({l:ZN[i],sub:zLab(i,Z)+' bpm'+(rc.pace[i]?' · '+fmtP(rc.pace[i])+'/km':''),v,c:zcol(i),txt:Math.round(v)+"'/sett"})))+
    `<p class="muted" style="margin-top:8px">${Math.round(tot)}' a settimana con FC registrata (${rc.n} di ${rc.all} corse). Sopra LT1: <b>${Math.round(hard)}'</b> (${tot?Math.round(hard/tot*100):0}%). È la composizione di quello che hai fatto, non un programma da copiare.</p>`:'<p class="muted">Nessuna corsa con FC nella finestra.</p>');
  // 3. minuti di soglia
  const wz=weekZones(12);const lab=wz.map(o=>labDay(o.w));
  gbars('f-thr',lab,[{n:'LT1',c:zcol(2),v:wz.map(o=>o.nx?o.min[2]:null)},{n:'LT2',c:zcol(3),v:wz.map(o=>o.nx?o.min[3]:null)},{n:'Alta int.',c:zcol(4),v:wz.map(o=>o.nx?o.min[4]:null)}],v=>Math.round(v)+"'",{unit:'minuti nella zona, per settimana',leg:'Ogni gruppo di barre = una settimana (lun–dom), con la data del lunedì; l’ultima è quella in corso.'});
  const done=wz.slice(0,-1).filter(o=>o.nx);
  set('f-thr-n',done.length?`Media settimane concluse: LT1 <b>${Math.round(mean(done.map(o=>o.min[2])))}'</b> · LT2 <b>${Math.round(mean(done.map(o=>o.min[3])))}'</b> · alta intensità <b>${Math.round(mean(done.map(o=>o.min[4])))}'</b>. Sono minuti con la FC dentro la fascia, riscaldamento e recuperi compresi se la FC c'era.`:'');
  // 4. indice aerobico
  pillset('f-aerow',[[13,'3 mesi'],[26,'6 mesi'],[52,'12 mesi'],[104,'2 anni']],aeroN,v=>{aeroN=v;rFit()});
  const ser=aeroSeries(aeroN).filter(o=>o.v!=null);const mv=aeroMoved();const cur=ser.length?ser[ser.length-1]:null;
  if(ser.length>=2)chart('f-aero-c',ser.map(o=>({x:labDay(o.w),y:+o.v.toFixed(1)})),{ylab:v=>v.toFixed(1),color:'var(--acc2)',unit:'indice aerobico (punti VDOT)',better:'up',
    ref:vd?[{y:vd,lab:'VDOT da gara '+vd.toFixed(1),c:'var(--dim)'}]:[],
    each:'Ogni punto = una settimana, calcolato sui 28 giorni precedenti'});else set('f-aero-c','');
  const bestA=ser.length?ser.reduce((a,b)=>b.v>a.v?b:a):null;
  set('f-aero',cur?`<div class="grid3"><div class="stat"><b>${cur.v.toFixed(1)}</b><span>indice aerobico</span>${mv.total!=null?`<i style="display:block" class="${mv.total>=0?'up':'down'}">${mv.total>=0?'▲':'▼'} ${Math.abs(mv.total).toFixed(1)} vs 7 giorni fa</i>`:''}</div>
      <div class="stat"><b>${vd?vd.toFixed(1):'–'}</b><span>VDOT da gara</span><i style="display:block" class="muted">${vd&&cur?(vd-cur.v>=0?'+':'')+(vd-cur.v).toFixed(1)+' sull\'indice':''}</i></div>
      <div class="stat"><b>${bestA.v.toFixed(1)}</b><span>migliore ${({13:'3 mesi',26:'6 mesi',52:'12 mesi',104:'2 anni'})[aeroN]}</span><i style="display:block" class="muted">${labDay(bestA.w)}</i></div></div>
      <table style="margin-top:10px"><tr><th>Fascia FC</th><th class="r">Passo ora</th><th class="r">7 gg fa</th><th class="r">Min</th><th class="r">Effetto</th></tr>
      ${mv.rows.map(b=>`<tr><td>${b.a}–${b.b-1}</td><td class="r">${b.pace&&b.ok?fmtP(b.pace):'–'}</td><td class="r muted">${b.prev.pace&&b.prev.ok?fmtP(b.prev.pace):'–'}</td><td class="r muted">${Math.round(b.s/60)}</td><td class="r ${b.contrib==null?'':b.contrib>=0?'up':'down'}">${b.contrib==null?'–':(b.contrib>=0?'+':'')+b.contrib.toFixed(2)}</td></tr>`).join('')}</table>
      <p class="muted" style="margin-top:6px">Stima del VDOT dalla velocità che tieni a parità di FC, finestra di 28 giorni, almeno 3 fasce su 4 con ≥10'. ${vd&&cur&&vd-cur.v>2?'Il VDOT da gara è più alto: in gara rendi più di quanto dica la FC in allenamento (buona capacità di soffrire, o FC alta per caldo e fatica).':vd&&cur&&cur.v-vd>2?'L\'indice supera il VDOT da gara: la forma aerobica è avanti rispetto all\'ultima gara, un test la confermerebbe.':'I due metodi concordano.'}</p>`
    :'<p class="muted">Servono almeno 3 fasce di FC con 10\' ciascuna nelle ultime 4 settimane.</p>');
  // 5. curva passo-FC
  const cw=curveWin(),cb=curveBest();rCurve('f-curve',cw,cb,Z);
  const lt2=zonePaceWin(3),bestLt2=(()=>{let b=null;for(let k=0;k<39;k++){const e=addDaysISO(todayISO(),-14*k);const p=zonePaceWin(3,e);if(p&&(!b||p<b.p))b={p,e}}return b})();
  set('f-curve-n',`Ultimi ${cw.days} giorni · ${cw.min}' di FC · punti solo dove almeno 3 corse sostengono la fascia. Passo a LT2 ora <b>${lt2?fmtP(lt2):'–'}/km</b>${bestLt2?`, migliore 18 mesi <b>${fmtP(bestLt2.p)}</b> (finestra al ${labDay(bestLt2.e)})`:''}.`);
  // 6. tenute
  pillset('f-holdp',[[5,"5'"],[10,"10'"],[15,"15'"]],fitHold,v=>{fitHold=v;rFit()});
  const hd=holdsWin(28,fitHold*60);
  set('f-holds',hd.length?hbars(hd.map(o=>({l:`${o.b}–${o.b+5}`,sub:`${fmtP(o.pace)}/km · ${ZN[zIdx(o.b+2,Z)]}`,v:o.n,c:zcol(zIdx(o.b+2,Z)),txt:`${o.n} · ${fmtMin(o.s)}`})))+'<p class="muted" style="margin-top:6px">Tratti continui con la FC (media 60") nella stessa fascia di 5 bpm, ultime 4 settimane.</p>':`<p class="muted">Nessun tratto continuo di almeno ${fitHold}' nelle ultime 4 settimane.</p>`);
  // 7. costo del passo
  const pcst=paceCost(28);
  set('f-cost',pcst.length?hbars(pcst.map(o=>({l:`${fmtP(o.b)}–${fmtP(o.b+20)}`,sub:o.hr?`FC media ${Math.round(o.hr)}`:'',v:o.min,c:o.hr?zcol(zIdx(o.hr,Z)):'var(--dim)',txt:Math.round(o.min)+"'/sett"}))):'<p class="muted">Servono le tracce delle corse.</p>');
  // 8. passo accumulato
  const ws=weeksBack(10),acc=ws.map(w=>({w,a:accWeek(w)})),av=acc.filter(o=>o.a[5000]);
  if(av.length>=2)chart('f-acc-c',av.map(o=>({x:labDay(o.w),y:o.a[5000]})),{ylab:v=>fmtP(v),pace:true,invertY:true,better:'down',up:'↑ più veloce',unit:'passo dei 5 km accumulati, min/km',color:'var(--warn)',
    each:'Ogni punto = una settimana'});else set('f-acc-c','');
  const la=acc[acc.length-1].a[5000]?acc[acc.length-1]:acc[acc.length-2];
  const bestAcc=av.length?av.reduce((a,b)=>b.a[5000]<a.a[5000]?b:a):null;
  set('f-acc',la?`<div class="grid3">${[3000,5000,10000].map(L=>`<div class="stat"><b>${la.a[L]?fmtP(la.a[L]):'–'}</b><span>${L/1000} km accumulati</span></div>`).join('')}</div><p class="muted" style="margin-top:6px">Settimana del ${labDay(la.w)}. I minuti più veloci della settimana sommati fra tutte le corse (media mobile di 2'), tapis roulant esclusi. Misura di allenamento, non previsione di gara.${bestAcc?` Migliore 10 settimane: ${fmtP(bestAcc.a[5000])}/km (${labDay(bestAcc.w)}).`:''}</p>`:'<p class="muted">Servono le corse importate da .fit.</p>');
  // 9. migliori tratti
  const b4=bestIn(28),ball=bestIn(0),DL={1000:'1 km',3000:'3 km',5000:'5 km',10000:'10 km',15000:'15 km',21097:'Mezza'};
  set('f-best',`<table><tr><th></th><th class="r">Ultime 4 sett</th><th class="r">Passo</th><th class="r">Migliore storico</th></tr>${Object.entries(DL).map(([k,l])=>`<tr><td>${l}</td><td class="r">${b4[k]?fmtD(b4[k].s):'–'}</td><td class="r pace">${b4[k]?fmtP(b4[k].s/(k/1000)):''}</td><td class="r muted">${ball[k]?fmtD(ball[k].s)+' · '+ball[k].r.date.slice(0,10):'–'}</td></tr>`).join('')}</table><p class="muted" style="margin-top:6px">Tratti migliori dentro qualsiasi corsa (tempo in movimento), separati dai risultati di gara.</p>`);
  // 10. piramide
  const pr=recipe(56),BR=[60,45,30,25,15];
  set('f-pyr',`<div class="pyr">${[4,3,2,1,0].map(i=>{const mins=pr.perWk[i]*8,n=Math.floor(mins/BR[i]);return`<div class="pyrr"><span class="pyl">${ZN[i]}<small style="display:block;color:var(--dim);font-size:10.5px">1 mattone = ${BR[i]}'</small></span><span class="pyb">${Array.from({length:Math.min(n,24)},()=>`<i style="background:${zcol(i)}"></i>`).join('')}${n>24?`<em>+${n-24}</em>`:''}${!n?'<em>–</em>':''}</span><span class="pyv">${Math.round(mins)}'</span></div>`}).join('')}</div><p class="muted" style="margin-top:6px">Minuti con la FC in ogni zona negli ultimi 56 giorni (numero a destra). Ogni mattone vale minuti diversi a seconda della zona (scritto sotto il nome): così le zone dure, dove bastano pochi minuti, restano visibili accanto a quelle facili. Una base larga e una punta stretta = distribuzione tipica da fondo.</p>`);
  // 11. capacità e lacune
  const cp=capacity(),ex=exposure(),eg=enduranceGap(),du=durability();
  set('f-cap',(cp?`<table><tr><td>Settimana più alta</td><td class="r"><b>${Math.round(cp.big.km)} km</b> <span class="muted">${labDay(cp.big.w)}</span></td></tr>
    <tr><td>Miglior blocco di 8 settimane</td><td class="r"><b>${cp.best8?Math.round(cp.best8.v):'–'} km/sett</b> <span class="muted">${cp.best8?'fino al '+labDay(cp.best8.end):''}</span></td></tr>
    <tr><td>Livello ripetibile (12 mesi)<br><span class="muted">tenuto in 1 blocco di 8 sett. su 4</span></td><td class="r"><b>${Math.round(cp.rep)} km/sett</b></td></tr>
    <tr><td>Ultime 4 settimane</td><td class="r"><b>${Math.round(cp.cur)} km/sett</b> <span class="muted">${Math.round(cp.cur/cp.rep*100)}% del ripetibile</span></td></tr></table>
    <p style="margin-top:8px;font-size:13px">Ripartenza sicura <b>${Math.round(cp.safe[0])}–${Math.round(cp.safe[1])} km</b>, tetto di crescita del blocco <b>${Math.round(cp.ceil[0])}–${Math.round(cp.ceil[1])} km</b>.</p>`:'')+
    `<h3 class="fh">Da quanto non fai…</h3><table>${ex.map(e=>`<tr><td>${e.n}</td><td class="r ${e.days==null||e.days>28?'down':e.days>14?'':'up'}">${e.days==null?'mai (con FC)':e.days===0?'oggi':e.days+' giorni'}</td><td class="r muted">${e.r?e.r.date.slice(0,10):''}</td></tr>`).join('')}</table>`+
    (eg.bs?`<h3 class="fh">Divario di resistenza</h3><p style="font-size:13px">Gara breve migliore: <b>VDOT ${eg.bs.v.toFixed(1)}</b> (${eg.bs.r.title}, ${eg.bs.r.date.slice(0,10)}).${eg.bl?` Gara lunga migliore: <b>VDOT ${eg.bl.v.toFixed(1)}</b> (${eg.bl.r.title}). Differenza <b>${eg.gap.toFixed(1)}</b> punti: ${eg.gap>3?'la resistenza è il limite, servono volume e lunghi più che velocità.':eg.gap>1.5?'margine di resistenza da costruire.':'resistenza in linea con la velocità.'}`:' Nessuna gara lunga negli ultimi 18 mesi.'}</p>`:'')+
    (du.length?`<h3 class="fh">Deriva cardiaca nelle corse lunghe facili</h3><p style="font-size:13px">Mediana <b>${median(du.map(o=>o.d.v)).toFixed(1)}%</b> su ${du.length} corse (12 settimane): ${median(du.map(o=>o.d.v))<5?'tieni bene il passo quando la fatica sale.':'la FC sale molto nella seconda metà: più lunghi facili costanti.'}</p>`:''));
  // 12. gare
  const rcd=raceCands().slice(0,14);
  set('f-races',rcd.length?`<table>${rcd.map(o=>`<tr><td><b>${o.r.km.toFixed(1)} km</b> ${fmtD(o.r.sec)} <span class="muted">· ${o.r.date.slice(0,10)} · ${o.r.title}</span><br><span class="muted">VDOT ${o.vd.toFixed(1)}${o.hr?' · FC '+Math.round(o.hr):''}</span></td><td class="r" style="white-space:nowrap">${o.state==='y'?'<span class="phb race">confermata</span>':o.state==='t'?'<span class="phb deload">dal titolo</span>':''}
      <button class="btn btn2 mini" onclick="setRace('${o.r.date}','y')" title="È una gara vera">✓</button><button class="btn btn2 mini" onclick="setRace('${o.r.date}','n')" title="Non era una gara">✕</button>${o.state==='y'?`<button class="btn btn2 mini" onclick="setRace('${o.r.date}',null)" title="Annulla">↺</button>`:''}</td></tr>`).join('')}</table><p class="muted" style="margin-top:6px">Le gare confermate ancorano le zone e il VDOT; quelle scartate (✕) non contano più per il VDOT.</p>`:'<p class="muted">Nessuna gara riconosciuta.</p>');
  const rej=runs.filter(r=>raceState(r)==='n');
  if(rej.length)document.getElementById('f-races').innerHTML+=`<p class="muted" style="margin-top:6px">Scartate: ${rej.map(r=>`${r.date.slice(0,10)} <a href="#" onclick="setRace('${r.date}',null);return false">ripristina</a>`).join(' · ')}</p>`;
  // 13. qualità del segnale
  const flg=runs.filter(r=>X[r.date]&&X[r.date].hist&&xFlag(r,X[r.date])&&daysAgo(r)<180);
  set('f-qual',flg.length?`<p class="muted" style="margin-bottom:6px">Corse con FC poco affidabile, escluse dalle analisi FC (distanza e passo restano):</p><table>${flg.map(r=>`<tr><td>${r.date.slice(0,10)} · ${r.title}<br><span class="muted">${xFlag(r,X[r.date])}</span></td><td class="r"><label style="margin:0;display:flex;gap:6px;align-items:center;justify-content:flex-end"><input type="checkbox" style="width:auto" ${st.hrok&&st.hrok[r.date]?'checked':''} onchange="st.hrok=st.hrok||{};if(this.checked)st.hrok['${r.date}']=1;else delete st.hrok['${r.date}'];LS('rp_st',st);zCache=null;rFit()">usa</label></td></tr>`).join('')}</table>`:'<p class="muted">Nessuna corsa scartata negli ultimi 6 mesi.</p>');
}
function rCurve(el,cw,best,Z){
  const host=document.getElementById(el);if(!host)return;
  const pts=cw.pts;const bp=Object.entries(best).map(([a,o])=>({a:+a,pace:o.pace}));
  if(pts.length<2&&bp.length<2){host.innerHTML='<p class="muted">Dati insufficienti.</p>';return}
  const all=[...pts,...bp];const W=420,H=244,P={l:44,r:10,t:40,b:36};
  const x0=Math.min(...all.map(p=>p.a))-3,x1=Math.max(...all.map(p=>p.a))+8;
  let y0=Math.min(...all.map(p=>p.pace)),y1=Math.max(...all.map(p=>p.pace));
  const st_=niceStep(y1-y0,4,true);y0=Math.floor(y0/st_)*st_;y1=Math.ceil(y1/st_)*st_;if(y1<=y0)y1=y0+st_;
  const X_=a=>P.l+(a-x0)/(x1-x0)*(W-P.l-P.r),Y=v=>P.t+(v-y0)/(y1-y0)*(H-P.t-P.b);
  let s=`<text x="2" y="12" class="cu">passo, min/km</text><text x="${W-2}" y="12" text-anchor="end" class="cd">↑ più veloce</text>`;
  const ZS=['Rec.','Steady','LT1','LT2','Alta'];
  for(let i=0;i<5;i++){const [a,b]=zRange(i,Z);const xa=Math.max(P.l,X_(Math.max(a,x0))),xb=Math.min(W-P.r,X_(b==null?x1:Math.min(b+1,x1)));
    if(xb>xa){s+=`<rect x="${xa}" y="${P.t-16}" width="${xb-xa}" height="${H-P.t-P.b+16}" fill="${zcol(i)}" fill-opacity=".10"/>`;
      if(xb-xa>=ZS[i].length*6.2+4)s+=`<text x="${((xa+xb)/2).toFixed(1)}" y="${P.t-5}" text-anchor="middle" class="cz" style="fill:${zcol(i)}">${ZS[i]}</text>`}}
  for(let v=y0;v<=y1+1e-9;v+=st_)s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${P.l-6}" y="${Y(v)+4}" text-anchor="end">${fmtP(v)}</text>`;
  for(let a=Math.ceil(x0/10)*10;a<=x1;a+=10)s+=`<text x="${X_(a)}" y="${H-P.b+16}" text-anchor="middle">${a}</text>`;
  s+=`<text x="${(P.l+W-P.r)/2}" y="${H-3}" text-anchor="middle" class="cd">frequenza cardiaca, bpm →</text>`;
  const line=(arr,c,dash)=>{arr=arr.slice().sort((p,q)=>p.a-q.a);if(arr.length<1)return'';const d=arr.map((p,i)=>`${i?'L':'M'}${X_(p.a+2.5).toFixed(1)},${Y(p.pace).toFixed(1)}`).join('');
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2" ${dash?'stroke-dasharray="5 4"':''}/>`+arr.map(p=>`<circle cx="${X_(p.a+2.5).toFixed(1)}" cy="${Y(p.pace).toFixed(1)}" r="${dash?2.5:3.5}" fill="${c}"><title>${p.a}–${p.a+4} bpm · ${fmtP(p.pace)}/km</title></circle>`).join('')};
  s+=line(bp,'var(--dim)',true)+line(pts,'var(--acc2)',false);
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="chv">${s}</svg><div class="lgd"><span><i style="background:var(--acc2)"></i>Ora</span><span><i style="background:var(--dim)"></i>Migliore 18 mesi (tratteggio)</span></div>
    <p class="chr">Ogni punto = il passo medio che tieni quando la FC sta in quella fascia di 5 bpm. Linea blu più in alto del tratteggio = a parità di battiti oggi corri più veloce del tuo meglio; più in basso = più lento. Le fasce colorate sono le tue zone.</p>`;
}

/* ---------- Dati: zone confermate e import archivio ---------- */
function rZoneEd(){
  const el=document.getElementById('st-zones');if(!el)return;
  const Z=Zcur(),p=Z.prop;
  const v=[Z.floor,...Z.c];
  el.innerHTML=`<div class="znote">Zone FC ${Z.src==='confermate'?'<b>confermate</b>'+(Z.date?' il '+Z.date:''):Z.src==='stima'?'<b>stimate</b> dalla '+Z.anchor.r.title+' ('+Z.anchor.r.date.slice(0,10)+')':'<b>da formula</b> (manca una gara con FC)'}</div>
   ${[0,1,2,3,4].map(i=>`<div class="zchip" style="border-top:3px solid ${zcol(i)}"><b>${ZTAG[i]} · ${ZN[i]}</b><span>${zLab(i,Z)}</span></div>`).join('')}
   <details class="pinfo" style="flex:1 0 100%"><summary>Modifica o conferma le zone</summary><div class="pinfo-body">
     <p>Inserisci da quale FC parte ogni zona. Quando arrivano zone confermate da un coach o da un test, mettile qui: tutta l'app (analisi, piano, Fitness) userà queste.</p>
     <div class="zedit">${['Recupero da','Steady da','LT1 da','LT2 da','Alta int. da'].map((l,i)=>`<div><label>${l}</label><input type="number" id="ze-${i}" value="${v[i]}"></div>`).join('')}</div>
     <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" style="width:auto;margin:0;padding:9px 16px" onclick="saveZones()">Salva come confermate</button>
     ${Z.src==='confermate'?`<button class="btn btn2" style="width:auto;margin:0;padding:9px 16px" onclick="clearZones()">Torna alla stima (${p.floor}/${p.c.join('/')})</button>`:''}</div>
     <p style="margin-top:8px">La stima: tetto di LT2 dalla FC media di una gara di 35–75' (−1 bpm; 5k −5; mezza +3), LT2 largo 8 bpm, LT1 11 bpm sotto, Steady fino a 25 bpm sotto LT1, Recupero dal 42% della riserva cardiaca.</p>
   </div></details>`;
}
function saveZones(){const v=[0,1,2,3,4].map(i=>+document.getElementById('ze-'+i).value);
  if(v.some(x=>!x)||v.some((x,i)=>i&&x<=v[i-1])){alert('Le soglie devono essere crescenti.');return}
  st.zones={floor:v[0],c:v.slice(1),date:todayISO()};LS('rp_st',st);zCache=null;refresh();alert('Zone salvate come confermate')}
function clearZones(){delete st.zones;LS('rp_st',st);zCache=null;refresh()}

/* ---------- Analisi seduta: traccia, zone, tratti ---------- */
function anaXCard(r){
  const x=X[r.date];if(!x||!x.hist)return'';
  const Z=Zcur(),zs=zSecs(x,Z),tot=zs.s.reduce((a,b)=>a+b,0)||1;
  const flag=xFlag(r,x);
  let tr='';
  if(x.tr&&x.tr.p.length>4){
    // due pannelli con lo stesso asse dei km: sopra il passo (veloce in alto), sotto la FC con le zone
    const t=x.tr,n=t.p.length,W=420,P={l:42,r:10},T1=28,H1=112,T2=T1+H1+36,H2=104,H=T2+H2+22;
    const km=t.d.map(v=>v/100),kmax=km[n-1]||1,X_=k=>P.l+k/kmax*(W-P.l-P.r);
    const ps=t.p.filter(v=>v>0);let pl=Math.min(...ps),ph=Math.min(Math.max(...ps),pl+180);
    const sp=niceStep(ph-pl,3,true);pl=Math.floor(pl/sp)*sp;ph=Math.ceil(ph/sp)*sp;if(ph<=pl)ph=pl+sp;
    const Yp=v=>T1+(Math.min(v,ph)-pl)/(ph-pl)*H1;
    const hs=t.h.filter(v=>v>0);let hl=Math.min(...hs),hh=Math.max(...hs);
    const sh=niceStep(hh-hl,3);hl=Math.floor(hl/sh)*sh;hh=Math.ceil(hh/sh)*sh;if(hh<=hl)hh=hl+sh;
    const Yh=v=>T2+(1-(v-hl)/(hh-hl))*H2;
    let s=`<text x="2" y="12" class="cu">passo, min/km</text><text x="${W-2}" y="12" text-anchor="end" class="cd">↑ più veloce</text>`;
    s+=`<text x="2" y="${T2-10}" class="cu">frequenza cardiaca, bpm</text><text x="${W-2}" y="${T2-10}" text-anchor="end" class="cd">fasce = le tue zone</text>`;
    const ZS=['Recupero','Steady','LT1','LT2','Alta int.'];
    for(let i=0;i<5;i++){const[a,b]=zRange(i,Z);const lo=Math.max(a,hl),hi=Math.min(b==null?hh:b+1,hh);if(hi>lo){const ya=Yh(hi),yb=Yh(lo);
      s+=`<rect x="${P.l}" y="${ya.toFixed(1)}" width="${W-P.l-P.r}" height="${(yb-ya).toFixed(1)}" fill="${zcol(i)}" fill-opacity=".13"/>`;
      if(yb-ya>=10)s+=`<text x="${W-P.r-3}" y="${(ya+(yb-ya)/2+4).toFixed(1)}" text-anchor="end" class="cz" style="fill:${zcol(i)}">${ZS[i]}</text>`}}
    const path=(arr,Y)=>arr.map((v,i)=>v>0?`${i&&arr[i-1]>0?'L':'M'}${X_(km[i]).toFixed(1)},${Y(v).toFixed(1)}`:'').join('');
    for(let v=pl;v<=ph+1e-9;v+=sp)s+=`<text x="${P.l-6}" y="${Yp(v)+4}" text-anchor="end">${fmtP(v)}</text><line x1="${P.l}" x2="${W-P.r}" y1="${Yp(v)}" y2="${Yp(v)}" stroke="var(--line)"/>`;
    for(let v=hl;v<=hh+1e-9;v+=sh)s+=`<text x="${P.l-6}" y="${Yh(v)+4}" text-anchor="end">${v}</text>`;
    s+=`<path d="${path(t.p,Yp)}" fill="none" stroke="var(--acc)" stroke-width="1.7"/><path d="${path(t.h,Yh)}" fill="none" stroke="var(--red)" stroke-width="1.7"/>`;
    const ks=Math.max(1,Math.ceil(kmax/7));
    for(let k=0;k<=kmax;k+=ks){const lst=k+ks>kmax;s+=`<line x1="${X_(k)}" x2="${X_(k)}" y1="${T1}" y2="${T2+H2}" stroke="var(--line)" stroke-dasharray="2 3"/><text x="${Math.min(X_(k),W-P.r-14)}" y="${H-6}" text-anchor="middle">${k}${lst?' km':''}</text>`}
    tr=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="chv" style="max-width:none">${s}</svg>`;
  }
  const bars=`<div class="zrow"><span>Per FC</span><div class="zstack">${zs.s.map((v,i)=>v>0?`<i style="width:${(v/tot*100).toFixed(1)}%;background:${zcol(i)}" title="${ZN[i]} ${fmtMin(v)}"></i>`:'').join('')}</div></div>
    <div class="lgd">${zs.s.map((v,i)=>v>=30?`<span><i style="background:${zcol(i)}"></i>${ZN[i]} ${fmtMin(v)}${zs.m[i]>200?' · '+fmtP(v/(zs.m[i]/1000)):''}</span>`:'').join('')}</div>`;
  let pz='';const vdz=curVdot();
  if(x.tr&&x.tr.p.length>4&&vdz){const B=paceBounds(vdz),ps=[0,0,0,0,0];x.tr.p.forEach(p=>{if(p>0&&p<900)ps[paceZone(p,B)]+=30});const pt=ps.reduce((a,b)=>a+b,0)||1;
    pz=`<div class="zrow"><span>Per passo</span><div class="zstack">${ps.map((v,i)=>v>0?`<i style="width:${(v/pt*100).toFixed(1)}%;background:${zcol(i)}" title="${ZN[i]} ${fmtMin(v)}"></i>`:'').join('')}</div></div>
    <div class="lgd">${ps.map((v,i)=>v>=60?`<span><i style="background:${zcol(i)}"></i>${ZN[i]} ${fmtMin(v)}</span>`:'').join('')}</div><p class="chr" style="margin-top:2px">Fasce di passo dal VDOT ${vdz.toFixed(1)}: Recupero più lento di ${fmtP(B[0])} · Steady da ${fmtP(B[0])} · LT1 da ${fmtP(B[1])} · LT2 da ${fmtP(B[2])} · Alta da ${fmtP(B[3])}/km. Se le due barre si somigliano, FC e passo raccontano la stessa seduta; se “per FC” è più rossa, hai faticato più di quanto dica il passo (caldo, salita, stanchezza).</p>`}
  const bests=Object.entries(x.best||{}).filter(([k])=>+k>=1000).map(([k,s])=>`${+k>=21000?'mezza':+k/1000+' km'} <b>${fmtD(s)}</b>`).join(' · ');
  const hl=(x.holds||[]).map(([b,s,m])=>`${b}–${b+5} bpm per ${fmtMin(s)} a ${fmtP(s/(m/1000))}`).join(' · ');
  return `<div class="card lapcard"><h2>Passo, FC e zone</h2>${flag?`<div class="nolap">${flag}: questa corsa non entra nelle analisi FC.</div>`:''}${tr}${bars}${pz}
    <p class="muted" style="margin-top:8px">Tempo in movimento ${fmtD(x.mov)} · FC registrata ${Math.round(x.cov*100)}%${x.art>=30?` · ${fmtMin(x.art)} di FC messi da parte (picchi o aggancio alla cadenza)`:''}${x.dec&&x.dec.cv<.08?` · deriva cardiaca ${x.dec.v}% (seconda metà vs prima)`:''}.</p>
    ${bests?`<p class="muted">Migliori tratti: ${bests}.</p>`:''}${hl?`<p class="muted">Tenute ≥5': ${hl}.</p>`:''}</div>`;
}


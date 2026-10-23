/* ---------- 1. riferimenti: ora / previsto / migliore 2 anni / obiettivo ---------- */
const REFBEST={};
function zoneBest(i){ // migliore passo in zona: finestre di 40 gg ogni 14 gg negli ultimi 2 anni
  const k=i+'|'+todayISO()+'|'+Object.keys(X).length+'|'+JSON.stringify(Zcur().c);if(REFBEST[k]!==undefined)return REFBEST[k];
  let b=null;for(let n=0;n<53;n++){const e=addDaysISO(todayISO(),-14*n);const p=zonePaceWin(i,e);if(p&&(!b||p<b.p))b={p,e}}
  return REFBEST[k]=b}
function rRefs(){
  const el=document.getElementById('f-refs');if(!el)return;
  const vd=curVdot(),pc=vd?paces(vd):null,g=goalTarget(),gp=g?paces(vdotOf(g.km,g.sec)):null;
  const R=[[1,'Steady',p=>(p.E[0]+p.E[1])/2,"60' facili con la FC sempre in Steady"],
           [2,'LT1',p=>p.M,"40–60' continui con la FC in LT1"],
           [3,'LT2',p=>p.T,"2×15' (rec 3') con la FC limitata alla fascia LT2"],
           [4,'Potenza aerobica',p=>p.I,"5×3' (rec 2') fino a portare la FC in alta intensità"]];
  const rows=R.map(([i,n,f,test])=>{const now=zonePaceWin(i),best=zoneBest(i);return{i,n,now,prev:pc?f(pc):null,best,goal:gp?f(gp):null,test}});
  const d=(a,b)=>a&&b?`<small class="${a-b<=0?'up':'down'}">${a-b>0?'+':''}${Math.round(a-b)}s</small>`:'';
  el.innerHTML=`<table class="reft"><tr><th>Riferimento</th><th class="r">Ora</th><th class="r">Previsto</th><th class="r">Migliore 2 anni</th><th class="r">Obiettivo</th></tr>
    ${rows.map(o=>`<tr><td><span class="zdot" style="background:${zcol(o.i)}"></span>${o.n}<br><span class="muted" style="font-size:11px">FC ${zLab(o.i)}</span></td>
      <td class="r"><b>${o.now?fmtP(o.now):'–'}</b></td>
      <td class="r">${o.prev?fmtP(o.prev):'–'}<br>${d(o.now,o.prev)}</td>
      <td class="r">${o.best?fmtP(o.best.p):'–'}<br>${o.best?`<small class="muted">${labDay(addDaysISO(o.best.e,-39))}–${labDay(o.best.e)}</small>`:''}</td>
      <td class="r">${o.goal?fmtP(o.goal):'–'}<br>${d(o.now,o.goal)}</td></tr>`).join('')}</table>
    ${rows.filter(o=>!o.now).length?`<h3 class="fh">Per misurare quelli che mancano</h3><ul class="muted" style="padding-left:18px;font-size:12.5px;line-height:1.5">${rows.filter(o=>!o.now).map(o=>`<li><b>${o.n}</b>: ${o.test}.</li>`).join('')}</ul>`:''}
    <p class="muted" style="margin-top:6px"><b>Ora</b> = passo tenuto con la FC dentro la zona negli ultimi 40 giorni (almeno 10'). <b>Previsto</b> = quello che il VDOT da gara (${vd?vd.toFixed(1):'–'}) fa attendere. <b>Migliore 2 anni</b> = la finestra di 40 giorni più veloce. <b>Obiettivo</b> = il passo che serve per ${g?fmtD(g.sec)+' in '+(g.km>=42?'maratona':g.km>=21?'mezza':g.km+' km'):'l\'obiettivo del piano'}. Δ: verde se sei già lì.</p>`;
}

/* ---------- 2. efficienza aerobica a una FC di riferimento ---------- */
let effZ=1;
function zoneWeekPace(i,n){
  const[a,b]=zRange(i);return weeksBack(n).map((w,k,arr)=>{const end=k===arr.length-1?todayISO():addDaysISO(w,6);
    let s=0,m=0,nr=0;xRuns(14,end).forEach(r=>{if(r.np)return;const[ss,mm]=histSum(X[r.date],a,b==null?250:b+1);if(ss>=120)nr++;s+=ss;m+=mm});
    return{w,s,nr,pace:s>=600&&m>0?s/(m/1000):null}})}
function rEff(){
  const el=document.getElementById('f-eff');if(!el)return;
  pillsTxt('f-effz',[[1,'Steady'],[2,'LT1'],[3,'LT2']],String(effZ),v=>{effZ=+v;rEff()});
  const ser=zoneWeekPace(effZ,16),pts=ser.filter(o=>o.pace);
  if(pts.length<2){el.innerHTML=`<p class="muted">Servono almeno due settimane con 10' in ${ZN[effZ]} (finestra di 14 giorni).</p>`;document.getElementById('f-eff-c').innerHTML='';return}
  chart('f-eff-c',pts.map(o=>({x:labDay(o.w),y:Math.round(o.pace)})),{ylab:v=>fmtP(v),pace:true,invertY:true,better:'down',up:'↑ più veloce',unit:`passo con FC in ${ZN[effZ]}, min/km`,color:zcol(effZ),
    each:'Ogni punto = una settimana (finestra dei 14 giorni precedenti)'});
  const L=pts.slice(-8),xs=L.map((o,k)=>k),ys=L.map(o=>o.pace),mx=mean(xs),my=mean(ys);
  const sl=xs.reduce((s,x,k)=>s+(x-mx)*(ys[k]-my),0)/Math.max(1e-9,xs.reduce((s,x)=>s+(x-mx)**2,0)); // s/km a settimana
  const tr=L.length<3?'troppo pochi dati':sl<-1?'in miglioramento':sl>1?'in calo':'stabile';
  const avgMin=mean(L.map(o=>o.s/60)),rel=L.length>=6&&avgMin>=40?'alta':L.length>=3&&avgMin>=20?'media':'bassa';
  const cur=pts[pts.length-1],first=pts[0];
  el.innerHTML=`<div class="grid3"><div class="stat"><b>${fmtP(cur.pace)}</b><span>passo in ${ZN[effZ]} ora</span></div>
    <div class="stat"><b class="${sl<-1?'up':sl>1?'down':''}">${tr}</b><span>${L.length>=3?(sl<=0?'':'+')+sl.toFixed(1)+' s/km a settimana':'tendenza'}</span></div>
    <div class="stat"><b>${rel}</b><span>affidabilità · ${Math.round(avgMin)}'/finestra</span></div></div>
    <p class="muted" style="margin-top:6px">Passo medio tenuto con la FC in ${ZN[effZ]} (${zLab(effZ)} bpm), finestra mobile di 14 giorni. Da ${labDay(first.w)}: ${fmtP(first.pace)} → ${fmtP(cur.pace)}. Più veloce alla stessa FC = motore aerobico che cresce. Affidabilità: quante settimane e quanti minuti sostengono la stima.</p>`;
}

/* ---------- 3. calendario a cerchi ---------- */
let calWk=8;
function runKey(r){ // zona "chiave" della corsa e quota di tempo in quella zona
  const x=xOf(r);
  if(x){const z=zSecs(x).s,t=z.reduce((a,b)=>a+b,0)||1;
    for(const i of[4,3,2])if(z[i]>=(i===4?180:420)||z[i]/t>=.1)return{z:i,f:z[i]/t,x:1};
    const i=z[0]>z[1]?0:1;return{z:i,f:z[i]/t,x:1}}
  const c=cls(r);return{z:{int:4,qual:3,race:3,long:1,easy:1}[c],f:null,x:0}}
function rCal(){
  const el=document.getElementById('c-cal');if(!el)return;
  pillsTxt('c-calw',[[4,'4 sett'],[8,'8 sett'],[12,'12 sett']],String(calWk),v=>{calWk=+v;rCal()});
  const ws=weeksBack(calWk),today=todayISO();
  const head=`<div class="calr calh">${['L','M','M','G','V','S','D'].map(d=>`<span>${d}</span>`).join('')}<span>Sett.</span></div>`;
  const rows=ws.map(w=>{let km=0,n=0,min=0;
    let xmin=0;
    const cells=[0,1,2,3,4,5,6].map(k=>{const iso=addDaysISO(w,k);const rr=runs.filter(r=>r.date.slice(0,10)===iso);
      const xx=allXts().filter(x=>x.date.slice(0,10)===iso);xmin+=xx.reduce((a,x)=>a+x.min,0);
      const xh=xx.map(x=>`<span class="calx" title="${XT_SP[x.sport][0]} · ${x.min}'">${XT_SP[x.sport][1]}</span>`).join('');
      km+=rr.reduce((a,r)=>a+vk(r),0);n+=rr.length;min+=rr.reduce((a,r)=>a+r.sec/60,0);
      if(iso>today)return'<span class="calc fut"></span>';
      if(!rr.length)return xh?`<span class="calc">${xh}</span>`:'<span class="calc"><i class="cal0"></i></span>';
      return`<span class="calc">${rr.map(r=>{const kz=runKey(r),m=r.sec/60,rad=Math.max(4,Math.min(14,4+10*Math.sqrt(m/120)));
        const C=2*Math.PI*(rad+2.6),arc=kz.f!=null?Math.max(.04,kz.f)*C:0;
        return`<svg viewBox="0 0 36 36" class="calv" onclick="anaOpen('${r.date}')"><title>${r.date.slice(0,10)} · ${r.title} · ${r.km.toFixed(1)} km · ${fmtD(r.sec)}${kz.f!=null?` · ${Math.round(kz.f*100)}% in ${ZN[kz.z]}`:' · senza FC 1s'}</title>
          <circle cx="18" cy="18" r="${rad.toFixed(1)}" fill="${zcol(kz.z)}" fill-opacity="${kz.x?.85:.45}"/>
          ${arc?`<circle cx="18" cy="18" r="${(rad+2.6).toFixed(1)}" fill="none" stroke="${zcol(kz.z)}" stroke-width="2" stroke-dasharray="${arc.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 18 18)"/>`:''}</svg>`}).join('')}${xh}</span>`}).join('');
    const ai=aeroIdx(aeroWin(addDaysISO(w,6)>today?today:addDaysISO(w,6)));
    return`<div class="calr"><div class="calwl">${labDay(w)}</div>${cells}<span class="cals"><b>${Math.round(km)} km</b><small>${n} corse · ${Math.floor(min/60)}h${String(Math.round(min%60)).padStart(2,'0')}</small>${ai?`<small>indice ${ai.toFixed(1)}</small>`:''}${xmin?`<small>+ ${Math.floor(xmin/60)}h${String(xmin%60).padStart(2,'0')} altri sport</small>`:''}</span></div>`}).join('');
  el.innerHTML=`<div class="cal">${head}${rows}</div>
    <div class="lgd">${[1,2,3,4].map(i=>`<span><i style="background:${zcol(i)};border-radius:50%"></i>${ZN[i]}</span>`).join('')}</div>
    <p class="muted" style="margin-top:6px">Grandezza = durata. Colore = zona più alta toccata in modo significativo (Alta ≥3', LT2/LT1 ≥7' o ≥10% del tempo). Arco = quota del tempo passata in quella zona. Cerchio pallido = corsa senza FC secondo per secondo (colore dal tipo). Tocca un cerchio per l'analisi.</p>`;
}

/* ---------- 4. analisi del blocco ---------- */
let blkWk=12;
function runLoad(r){ // TRIMP di Banister (minuti × riserva cardiaca pesata)
  const f=h=>{const q=Math.max(0,Math.min(1,(h-st.hrrest)/(st.hrmax-st.hrrest)));return q*.64*Math.exp(1.92*q)};
  const x=xOf(r);
  if(x){let s=0;x.hist.s.forEach((v,i)=>s+=v/60*f(x.hist.h0+i));const cov=Math.max(.5,x.cov||1);return s/cov}
  const min=r.sec/60;return min*f(r.hr||st.hrrest+.65*(st.hrmax-st.hrrest));
}
function loadSeries(){
  if(!runs.length)return[];const byD={};runs.forEach(r=>{const k=r.date.slice(0,10);byD[k]=(byD[k]||0)+runLoad(r)});
  allXts().forEach(x=>{const k=x.date.slice(0,10);byD[k]=(byD[k]||0)+xtLoad(x)}); // altri sport: stesso TRIMP
  const out=[];let d=runs[0].date.slice(0,10),ctl=0,atl=0;const end=todayISO();
  while(d<=end){const l=byD[d]||0;ctl+=(l-ctl)/42;atl+=(l-atl)/7;out.push({d,l,ctl,atl,tsb:ctl-atl});d=addDaysISO(d,1)}
  return out;
}
function blockStats(start,end,LS_){ // [start,end) ISO
  const rs=runs.filter(r=>{const d=r.date.slice(0,10);return d>=start&&d<end});
  const wks=Math.max(1,daysBetween(start,end)/7);
  const Z=Zcur(),zs=[0,0,0,0,0];let nx=0;rs.forEach(r=>{const x=xOf(r);if(!x)return;nx++;zSecs(x,Z).s.forEach((v,i)=>zs[i]+=v)});
  const zt=zs.reduce((a,b)=>a+b,0);
  const easy=rs.filter(r=>cls(r)==='easy'&&!r.np&&r.km>=4);
  const eff=easy.filter(r=>r.hr).map(r=>(1000/pace(r))*60/r.hr); // metri per battito
  const du=rs.map(r=>{const x=xOf(r);return x&&x.dec&&x.dec.cv<.08&&x.dec.min>=45&&zIdx(x.dec.hr,Z)<=2?x.dec.v:null}).filter(v=>v!=null);
  let b5=null;rs.forEach(r=>{const x=X[r.date];if(x&&x.best&&x.best[5000]&&(!b5||x.best[5000]<b5.s))b5={s:x.best[5000],r}});
  const ld=LS_.filter(o=>o.d<end);const last=ld[ld.length-1]||{ctl:0,atl:0,tsb:0};
  const ae=aeroIdx(aeroWin(addDaysISO(end,-1)));
  const cc={};rs.forEach(r=>{const c=cls(r);cc[c]=(cc[c]||0)+1});
  return{n:rs.length,km:rs.reduce((a,r)=>a+vk(r),0),kmW:rs.reduce((a,r)=>a+vk(r),0)/wks,nW:rs.length/wks,hW:rs.reduce((a,r)=>a+r.sec,0)/3600/wks,
    long:rs.reduce((a,r)=>Math.max(a,r.km),0),zp:zt?zs.map(v=>v/zt):null,above:zt?(zs[2]+zs[3]+zs[4])/zt:null,cov:rs.length?nx/rs.length:0,
    ep:easy.length?mean(easy.map(pace)):null,eh:easy.filter(r=>r.hr).length?mean(easy.filter(r=>r.hr).map(r=>r.hr)):null,eff:eff.length?mean(eff):null,
    du:du.length?median(du):null,b5,ctl:last.ctl,atl:last.atl,tsb:last.tsb,ae,cc,rs};
}
function rBlock(){
  const el=document.getElementById('b-out');if(!el)return;
  pillsTxt('b-wk',[[8,'8 sett'],[12,'12 sett'],[16,'16 sett'],[20,'20 sett']],String(blkWk),v=>{blkWk=+v;rBlock()});
  const L=loadSeries();if(!L.length){el.innerHTML='<p class="muted">Nessuna corsa.</p>';return}
  const end=addDaysISO(todayISO(),1),start=addDaysISO(end,-7*blkWk),pstart=addDaysISO(start,-7*blkWk);
  const B=blockStats(start,end,L),P=blockStats(pstart,start,L);
  const F=blockStats(start,addDaysISO(start,28),L),T=blockStats(addDaysISO(end,-28),end,L);
  const now=L[L.length-1];
  const tsbLab=now.tsb>5?'fresco':now.tsb>-10?'in equilibrio':now.tsb>-25?'affaticato (carico produttivo)':'molto affaticato';
  // grafico CTL/ATL/TSB, in due pannelli: sopra forma e fatica (stessa scala), sotto la freschezza
  // con le fasce che dicono cosa significa il numero. Prima stavano tutte e tre sullo stesso asse.
  const seg=L.filter(o=>o.d>=start);const W=420,Pd={l:36,r:8};
  const T1=30,H1=116,T2=T1+H1+36,H2=96,H=T2+H2+22;
  const ymx=Math.max(10,...seg.map(o=>Math.max(o.ctl,o.atl)));const st1=niceStep(ymx,3),top1=Math.ceil(ymx/st1)*st1;
  const tmn=Math.min(...seg.map(o=>o.tsb)),tmx=Math.max(...seg.map(o=>o.tsb));
  const lo=Math.min(-30,Math.floor(tmn/10)*10),hi=Math.max(20,Math.ceil(tmx/10)*10);
  const Xc=i=>Pd.l+i/(Math.max(1,seg.length-1))*(W-Pd.l-Pd.r);
  const Y1=v=>T1+(top1-v)/top1*H1,Y2=v=>T2+(hi-v)/(hi-lo)*H2;
  const pl=(k,c,w,Yf,da)=>`<path d="${seg.map((o,i)=>`${i?'L':'M'}${Xc(i).toFixed(1)},${Yf(o[k]).toFixed(1)}`).join('')}" fill="none" stroke="${c}" stroke-width="${w}" ${da?'stroke-dasharray="4 3"':''}/>`;
  let sv=`<text x="2" y="12" class="cu">Forma e fatica (carico TRIMP medio al giorno)</text>`;
  for(let v=0;v<=top1+1e-9;v+=st1)sv+=`<line x1="${Pd.l}" x2="${W-Pd.r}" y1="${Y1(v)}" y2="${Y1(v)}" stroke="var(--line)"/><text x="${Pd.l-5}" y="${Y1(v)+4}" text-anchor="end">${Math.round(v)}</text>`;
  sv+=pl('ctl','var(--z2)',2.4,Y1)+pl('atl','var(--z5)',1.4,Y1);
  // valori finali scritti accanto alle linee (separati se troppo vicini)
  {const xe=Xc(seg.length-1),yc=Y1(now.ctl),ya=Y1(now.atl);let a=yc,b=ya;if(Math.abs(a-b)<14){const m=(a+b)/2;a=m+(yc>=ya?7:-7);b=m+(yc>=ya?-7:7)}
    sv+=`<text x="${xe-2}" y="${(a+(a>=b?14:-5)).toFixed(1)}" text-anchor="end" class="cv" style="fill:var(--z2)">forma ${Math.round(now.ctl)}</text><text x="${xe-2}" y="${(b+(b>a?14:-5)).toFixed(1)}" text-anchor="end" class="cv" style="fill:var(--z5)">fatica ${Math.round(now.atl)}</text>`}
  sv+=`<text x="2" y="${T2-10}" class="cu">Freschezza = forma − fatica</text>`;
  const bands=[[hi,5,'var(--ok)','fresco, pronto per gara (sopra +5)'],[5,-10,'var(--dim)','in equilibrio (−10…+5)'],[-10,-25,'var(--z2)','carico produttivo (−25…−10)'],[-25,lo,'var(--red)','troppa fatica (sotto −25)']];
  bands.forEach(([a,b,c])=>{if(a<=b)return;const ya=Y2(a),yb=Y2(b);sv+=`<rect x="${Pd.l}" y="${ya.toFixed(1)}" width="${W-Pd.l-Pd.r}" height="${(yb-ya).toFixed(1)}" fill="${c}" fill-opacity=".12"/>`});
  for(let v=Math.ceil(lo/20)*20;v<=hi;v+=20)sv+=`<text x="${Pd.l-5}" y="${Y2(v)+4}" text-anchor="end">${v>0?'+':''}${v}</text>`;
  sv+=`<line x1="${Pd.l}" x2="${W-Pd.r}" y1="${Y2(0)}" y2="${Y2(0)}" stroke="var(--dim)" stroke-width="1"/>`;
  sv+=pl('tsb','var(--z3)',1.8,Y2);
  {const xe=Xc(seg.length-1),y=Y2(now.tsb);sv+=`<circle cx="${xe}" cy="${y}" r="4" fill="var(--z3)" stroke="var(--card)" stroke-width="2"/><text x="${xe-6}" y="${(y<T2+14?y+16:y-7).toFixed(1)}" text-anchor="end" class="cv">${now.tsb>0?'+':''}${Math.round(now.tsb)}</text>`}
  // mesi sull'asse, e l'ultimo giorno = oggi
  seg.forEach((o,i)=>{if(o.d.endsWith('-01')&&i<seg.length-8)sv+=`<line x1="${Xc(i)}" x2="${Xc(i)}" y1="${T1}" y2="${T2+H2}" stroke="var(--line)" stroke-dasharray="2 3"/><text x="${Xc(i)}" y="${H-6}" text-anchor="middle">${MESI[+o.d.slice(5,7)-1]}</text>`});
  sv+=`<text x="${W-Pd.r}" y="${H-6}" text-anchor="end" class="cd">oggi</text>`;
  // settimana tipo
  const DN=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const tw=DN.map((n,k)=>{const rs=B.rs.filter(r=>(dOnly(r.date).getDay()+6)%7===k);const f=rs.length/blkWk;
    const cc={};rs.forEach(r=>{const c=cls(r);cc[c]=(cc[c]||0)+1});const top=Object.entries(cc).sort((a,b)=>b[1]-a[1])[0];
    return{n,f,km:rs.length?mean(rs.map(r=>r.km)):0,c:top?top[0]:null}});
  const row=(lab,a,b,fmt,better)=>{const dv=a!=null&&b!=null?a-b:null;const good=dv==null?'':better==='low'?(dv<0?'up':dv>0?'down':''):(dv>0?'up':dv<0?'down':'');
    return`<tr><td>${lab}</td><td class="r"><b>${a!=null?fmt(a):'–'}</b></td><td class="r muted">${b!=null?fmt(b):'–'}</td><td class="r ${good}">${dv!=null&&Math.abs(dv)>1e-9?(dv>0?'+':'')+fmt(dv,1):''}</td></tr>`};
  const n1=(v,d)=>d?v.toFixed(1):v.toFixed(1),n0=v=>Math.round(v)+'',pc=v=>Math.round(v*100)+'%',ps=(v,d)=>d?(v>0?'':'−')+Math.abs(Math.round(v))+'s':fmtP(v);
  const cmp=(X1,X2,h1,h2)=>{if(!X2.n)X2={};if(!X1.n)X1={};return cmpT(X1,X2,h1,h2)};
  const cmpT=(X1,X2,h1,h2)=>`<table><tr><th></th><th class="r">${h1}</th><th class="r">${h2}</th><th class="r">Δ</th></tr>
    ${row('km a settimana',X1.kmW,X2.kmW,n1)}${row('corse a settimana',X1.nW,X2.nW,n1)}${row('ore a settimana',X1.hW,X2.hW,n1)}
    ${row('corsa più lunga (km)',X1.long,X2.long,n1)}${row('tempo sopra LT1',X1.above,X2.above,(v,d)=>d?(v>0?'+':'')+Math.round(v*100)+' pt':pc(v))}
    ${row('passo corse facili',X1.ep,X2.ep,ps,'low')}${row('FC corse facili',X1.eh,X2.eh,n0,'low')}${row('metri per battito (facili)',X1.eff,X2.eff,(v)=>v.toFixed(2))}
    ${row('indice aerobico a fine periodo',X1.ae,X2.ae,n1)}${row('forma (CTL) a fine periodo',X1.ctl,X2.ctl,n0)}
    ${row('deriva cardiaca nei lunghi',X1.du,X2.du,(v)=>v.toFixed(1)+'%','low')}</table>`;
  // storico 2 anni
  const two=addDaysISO(todayISO(),-730);
  const races=runs.filter(r=>r.date.slice(0,10)>=two&&(raceState(r)==='y'||(cls(r)==='race'&&raceState(r)!=='n'))).reverse();
  const gaps=[];for(let i=1;i<runs.length;i++){const a=runs[i-1].date.slice(0,10),b=runs[i].date.slice(0,10);if(b<two)continue;const g=daysBetween(a,b);if(g>=9)gaps.push({a,b,g})}
  const lastR=runs[runs.length-1];const gNow=daysAgo(lastR);if(gNow>=9)gaps.push({a:lastR.date.slice(0,10),b:null,g:gNow});
  const cp=capacity();
  const ctlBest=L.filter(o=>o.d>=two).reduce((a,b)=>b.ctl>a.ctl?b:a,{ctl:0});
  el.innerHTML=`<div class="grid3"><div class="stat"><b>${Math.round(now.ctl)}</b><span>forma (CTL, 42 gg)</span><i style="display:block" class="muted">migliore 2 anni ${Math.round(ctlBest.ctl)} · ${ctlBest.d?labDay(ctlBest.d):''}</i></div>
      <div class="stat"><b>${Math.round(now.atl)}</b><span>fatica (ATL, 7 gg)</span></div>
      <div class="stat"><b class="${now.tsb>-10?'up':now.tsb<-25?'down':''}">${now.tsb>0?'+':''}${Math.round(now.tsb)}</b><span>freschezza (TSB) · ${tsbLab}</span></div></div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" class="chv" style="margin-top:10px">${sv}</svg>
    <div class="lgd"><span><i style="background:var(--z2)"></i>Forma (CTL): carico medio delle ultime 6 settimane</span><span><i style="background:var(--z5)"></i>Fatica (ATL): carico medio degli ultimi 7 giorni</span></div>
    <div class="lgd"><span style="color:var(--txt)">Fasce della freschezza:</span>${bands.map(([,,c,t])=>`<span><i style="background:${c};opacity:.45"></i>${t}</span>`).join('')}</div>
    <p class="chr">Come si legge: la <b>forma</b> sale piano se ti alleni con costanza; la <b>fatica</b> sale e scende in fretta con le singole settimane. Quando la fatica sta sopra la forma la freschezza è negativa: normale durante il carico. Prima di una gara si scarica finché la freschezza arriva a +5…+15.</p>
    <p class="muted" style="margin-top:4px">Carico di ogni corsa = TRIMP: minuti pesati per la FC (secondo per secondo se c'è il .fit, altrimenti la media; senza FC si assume un'uscita facile). Ultime ${blkWk} settimane.</p>
    <h3 class="fh">Questo blocco contro il precedente (${blkWk} settimane)</h3>${cmp(B,P,'Ora','Prima')}
    <h3 class="fh">Andamento dentro il blocco: ultime 4 settimane contro le prime 4</h3>${cmp(T,F,'Ultime 4','Prime 4')}
    <h3 class="fh">Composizione</h3>
    ${B.zp?`<div class="zstack">${B.zp.map((v,i)=>v>0?`<i style="width:${(v*100).toFixed(1)}%;background:${zcol(i)}" title="${ZN[i]} ${Math.round(v*100)}%"></i>`:'').join('')}</div>
      <div class="lgd">${B.zp.map((v,i)=>v>=.01?`<span><i style="background:${zcol(i)}"></i>${ZN[i]} ${Math.round(v*100)}%</span>`:'').join('')}</div>`:''}
    <p class="muted" style="margin-top:4px">${Object.entries(B.cc).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`${CLSN[c]} ${n}`).join(' · ')} · FC secondo per secondo su ${Math.round(B.cov*100)}% delle corse${B.cov<.6?' (zone indicative)':''}.${B.b5?` Miglior 5 km dentro una corsa: <b>${fmtD(B.b5.s)}</b> (${B.b5.r.date.slice(0,10)}).`:''}</p>
    <h3 class="fh">Settimana tipo</h3>
    <div class="twk">${tw.map(o=>`<div class="${o.f<.25?'off':''}"><b>${o.n}</b><span>${o.f>=.25&&o.c?CLSN[o.c]:'riposo'}</span><small>${o.f>=.25?Math.round(o.km)+' km · '+Math.round(o.f*100)+'%':''}</small></div>`).join('')}</div>
    <p class="muted" style="margin-top:4px">Per ogni giorno: tipo di corsa più frequente, km medi e quota di settimane in cui hai corso.</p>
    <h3 class="fh">Storico 2 anni</h3>
    <table>${cp&&cp.best8?`<tr><td>Miglior periodo (8 settimane)</td><td class="r"><b>${Math.round(cp.best8.v)} km/sett</b> <span class="muted">fino al ${labDay(cp.best8.end)}</span></td></tr>`:''}
      <tr><td>Forma massima (CTL)</td><td class="r"><b>${Math.round(ctlBest.ctl)}</b> <span class="muted">${ctlBest.d?ctlBest.d.split('-').reverse().join('/'):''}</span></td></tr>
      <tr><td>Gare</td><td class="r">${races.length?races.slice(0,8).map(r=>`${r.date.slice(0,10).split('-').reverse().join('/')} · ${r.km.toFixed(1)} km in <b>${fmtD(r.sec)}</b> <span class="muted">VDOT ${vdotOf(r.km,r.sec).toFixed(1)}</span>`).join('<br>'):'<span class="muted">nessuna</span>'}</td></tr>
      <tr><td>Interruzioni (≥9 giorni senza correre)</td><td class="r">${gaps.length?gaps.slice(-6).reverse().map(o=>`${o.a.split('-').reverse().join('/')} · <b>${o.g} giorni</b>${o.b?'':' (in corso)'}`).join('<br>'):'<span class="muted">nessuna</span>'}</td></tr></table>`;
}

/* ---------- 5. guida a FC nel piano ---------- */
function hrMode(t,Z,lab){
  const vd=curVdot(),B=vd?paceBounds(vd):null;
  const TZ={Z2:1,M:2,gara:2,'ritmo mezza':3,T:3,I:4,R:4};
  return t.replace(/(?<![\d:])(\d:\d\d)(?:\s*[–-]\s*(\d:\d\d))?(\/km)?(?![\d:])(\s*\((I|R|T|M|Z2|gara|ritmo mezza)\))?/g,(s,a,b,u,tg,z)=>{
    let i=z&&z!=='gara'&&z!=='ritmo mezza'?TZ[z]:null;
    if(i==null){if(!B)return z?s:s;i=paceZone((toSec(a)+toSec(b||a))/2,B)}
    if(i>=4)return s; // ripetute brevi: la FC arriva in ritardo, si corrono a passo
    return`<b class="hrm">${lab(i)}</b> <span class="hrp">(${a}${b?'–'+b:''}${tg?' '+tg.trim():''})</span>`;
  });
}
function rGuideMode(){
  pillsTxt('p-gmode',[['pace','Guida a passo'],['hr','Guida a FC']],st.guide==='hr'?'hr':'pace',v=>{st.guide=v;LS('rp_st',st);rGuideMode();const pl=LS('rp_plan');if(pl)try{rPlan(pl)}catch(e){console.warn(e)}});
}

/* ---------- 6. filtri dell'archivio ---------- */
let manF='all';
function manOk(r){if(manF==='all')return true;if(manF==='fc')return!!(X[r.date]&&X[r.date].hist);if(manF==='tm')return!!r.tm;return cls(r)===manF}
function rManFilt(){
  pillsTxt('dt-filt',[['all','Tutte'],['easy','Easy'],['long','Lunghi'],['qual','Qualità'],['int','Interval'],['race','Gare'],['fc','Con FC 1s'],['tm','Tapis roulant']],manF,v=>{manF=v;rManFilt();rManage()});
  const n=runs.filter(manOk).length;const el=document.getElementById('dt-filtn');if(el)el.textContent=`${n} corse${n>40?' · mostro le ultime 40':''}`;
}

function rMore(){
  [rRefs,rEff,rCal,rBlock,rGuideMode,rManFilt].forEach(f=>{try{f()}catch(e){console.warn(f.name,e)}});
}


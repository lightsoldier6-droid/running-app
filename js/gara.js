/* ---------- Piano: obiettivo, richiesta della gara, dose di intensità ---------- */
/* ---------- previsione gara dalla soglia recente (ripresa dal "Race outlook" di RunZones) ----------
   Il VDOT da gara invecchia: d'inverno, senza gare, resta fermo. Qui la stima viene dal lavoro a LT2
   delle ULTIME 3 SETTIMANE: passo tenuto con la FC dentro la fascia LT2 (dalla traccia secondo per
   secondo, solo corse con FC e passo affidabili). Il passo di soglia si converte in VDOT (quello per cui
   il passo T di Daniels coincide) e da lì nel tempo di gara. Prova sufficiente = almeno 20' in fascia,
   in almeno 2 corse con 5' ciascuna. Se manca, lo si dice invece di dare un numero. */
function lt2Evidence(end,days){
  end=end||todayISO();days=days||21;
  const[a,b]=zRange(3);let s=0,m=0,n=0;
  xRuns(days,end).forEach(r=>{if(r.np)return;const[ss,mm]=histSum(X[r.date],a,b==null?250:b+1);if(ss>=300){n++;s+=ss;m+=mm}});
  return{s,m,n,ok:s>=1200&&n>=2&&m>0,pace:m>0?s/(m/1000):null};
}
function vdotFromT(tSec){let lo=20,hi=90;for(let i=0;i<50;i++){const v=(lo+hi)/2;paces(v).T>tSec?lo=v:hi=v}return(lo+hi)/2}
function rOutlook(){
  const el=document.getElementById('p-outlook');if(!el)return;
  const g=goalTarget();
  if(!g){el.innerHTML='<p class="muted">Genera o apri un piano per avere la previsione sulla gara obiettivo.</p>';return}
  const gName=g.km>=42?'maratona':g.km>=21?'mezza':g.km+' km',todayS=todayISO(),raceDone=g.date<todayS;
  const asOf=raceDone?addDaysISO(g.date,-1):todayS;
  const ev=lt2Evidence(asOf),cv=curVdot();
  const proj=ev.ok?(()=>{const v=vdotFromT(ev.pace);return{v,t:predict(g.km,v),lo:predict(g.km,vdotFromT(ev.pace-3)),hi:predict(g.km,vdotFromT(ev.pace+3))}})():null;
  const fromRace=cv?predict(g.km,cv):null;
  // storico: la stessa stima a 3, 6 e 9 settimane fa
  const hist=[21,42,63].map(k=>{const e=lt2Evidence(addDaysISO(asOf,-k));return{k,t:e.ok?predict(g.km,vdotFromT(e.pace)):null}});
  const dl=t=>{const d=t-g.sec,a=Math.abs(d);return `<span class="${d<=0?'up':'down'}">${d<=0?'−':'+'}${fmtD(a)}</span>`};
  // durata: per la maratona la soglia non basta, serve il lungo
  const longR=runs.filter(r=>daysBetween(r.date.slice(0,10),asOf)>=0&&daysBetween(r.date.slice(0,10),asOf)<42&&!r.nv).reduce((a,r)=>Math.max(a,r.km),0);
  const durNote=g.km>=42&&(proj||fromRace)&&longR>0&&longR<28?`<p class="fx-warn">⚠️ Il lungo più lungo delle ultime 6 settimane è di ${longR.toFixed(0)} km: per la maratona la stima vale solo se la resistenza arriva (lunghi da 28–32 km). Senza, aspettati qualche minuto in più.</p>`:'';
  // esito, a gara corsa
  const res=raceDone?runs.filter(r=>r.date.slice(0,10)===g.date&&r.km>=g.km*.95).sort((a,b)=>b.km-a.km)[0]:null;
  let html='';
  if(res){const t=res.sec*(g.km/res.km);
    html+=`<div class="grid3"><div class="stat"><b>${fmtD(t)}</b><span>Risultato del ${g.date}</span></div><div class="stat"><b>${fmtD(g.sec)}</b><span>Obiettivo · ${dl(t)}</span></div><div class="stat"><b>${proj?fmtD(proj.t):'–'}</b><span>Previsione alla vigilia</span></div></div>`;
  }
  html+=`<div class="grid3">
    <div class="stat"><b>${proj?fmtD(proj.t):'–'}</b><span>${proj?`Dalla soglia recente · ${fmtD(proj.lo)}–${fmtD(proj.hi)}`:'Dalla soglia recente'}</span></div>
    <div class="stat"><b>${fmtD(g.sec)}</b><span>Obiettivo ${gName}${proj?' · '+dl(proj.t):''}</span></div>
    <div class="stat"><b>${fromRace?fmtD(fromRace):'–'}</b><span>Dalle gare (VDOT ${cv?cv.toFixed(1):'–'})${fromRace?' · '+dl(fromRace):''}</span></div></div>`;
  if(proj)html+=`<p class="muted" style="margin-top:8px">Ultime 3 settimane: <b>${Math.round(ev.s/60)}'</b> con la FC in LT2 (${zLab(3)}) in <b>${ev.n}</b> corse, a <b>${fmtP(ev.pace)}/km</b> → VDOT di soglia <b>${proj.v.toFixed(1)}</b>. ${Math.abs(proj.t-g.sec)<=g.sec*.01?'Sei in linea con l’obiettivo.':proj.t<g.sec?'La soglia attuale vale già più dell’obiettivo.':'Alla soglia attuale manca '+fmtD(proj.t-g.sec)+' per l’obiettivo: è normale lontano dalla gara, conta la tendenza.'}</p>`;
  else html+=`<p class="fx-warn">Servono prove di soglia recenti. Nelle ultime 3 settimane ci sono <b>${Math.round(ev.s/60)}'</b> con la FC in LT2 (${zLab(3)}) in ${ev.n} corse con almeno 5' in fascia: ne servono almeno 20' in 2 corse. Un 2×15' (rec 3') con la FC tenuta in fascia basta. Non vuol dire che l’allenamento non funzioni: manca solo la misura.</p>`;
  if(hist.some(h=>h.t))html+=`<p class="muted" style="margin-top:6px">Tendenza della stima dalla soglia: ${hist.slice().reverse().map(h=>`${h.k/7} sett. fa <b>${h.t?fmtD(h.t):'–'}</b>`).join(' · ')} · ora <b>${proj?fmtD(proj.t):'–'}</b></p>`;
  html+=durNote+`<p class="muted" style="margin-top:6px;font-size:11.5px">Due stime: dalla soglia (le sedute misurate) e dalle gare (ultimo VDOT confermato). Quando sono vicine la previsione è solida; se divergono, la soglia è più aggiornata, le gare più sicure.</p>`;
  el.innerHTML=html;
}
function rGoal(){
  const el=document.getElementById('p-goalgap');if(!el)return;
  const g=goalTarget();
  if(!g){el.innerHTML='<p class="muted">Genera o apri un piano per vedere cosa chiede la gara.</p>';return}
  const gv=vdotOf(g.km,g.sec),cv=curVdot()||0,gp=paces(gv),cp=paces(cv||gv);
  const dm=demand(g.km,g.sec);
  const race=dOnly(g.date);const wkOut=k=>{const d=new Date(race);d.setDate(d.getDate()-7*k);return d};
  const fmtDay=d=>d.getDate()+' '+MESI[d.getMonth()];
  const today=new Date();
  const eq=[[5,'5 km'],[10,'10 km'],[21.0975,'Mezza'],[42.195,'Maratona']];
  el.innerHTML=`<div class="ggrid"><div>
    <p style="margin-bottom:6px">Obiettivo <b class="pace">${fmtD(g.sec)}</b> · ${g.km>=42?'maratona':g.km>=21?'mezza':g.km+' km'} del ${g.date} <span class="muted">(${st.goalT?'scelto da te':'dal piano'})</span></p>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><input type="text" id="g-t" placeholder="es. 2:59:59" value="${st.goalT?fmtD(st.goalT):''}" style="flex:1"><button class="btn btn2" style="width:auto;margin:0;padding:9px 12px" onclick="const v=parseHMS(document.getElementById('g-t').value);if(v)st.goalT=v;else delete st.goalT;LS('rp_st',st);rGoal()">Confronta</button></div>
    <table><tr><th></th><th class="r">Oggi</th><th class="r">Serve</th><th class="r">Δ</th></tr>
      <tr><td>VDOT</td><td class="r">${cv.toFixed(1)}</td><td class="r">${gv.toFixed(1)}</td><td class="r ${gv-cv>0?'down':'up'}">${(gv-cv>=0?'+':'')+(gv-cv).toFixed(1)}</td></tr>
      ${[['Soglia T','T'],['Maratona M','M'],['Interval I','I']].map(([n,k])=>`<tr><td>${n}</td><td class="r">${fmtP(cp[k])}</td><td class="r">${fmtP(gp[k])}</td><td class="r">${Math.round(gp[k]-cp[k])}s</td></tr>`).join('')}
      ${eq.filter(([d])=>d!==g.km).map(([d,n])=>`<tr><td>${n} equivalente</td><td class="r">${cv?fmtD(predict(d,cv)):'–'}</td><td class="r">${fmtD(predict(d,gv))}</td><td></td></tr>`).join('')}
    </table>
    <p class="muted" style="margin-top:6px">${gv-cv>5?'Il salto richiesto è grande: oltre 1 punto VDOT al mese è raro senza aumentare molto il volume.':gv-cv>2?'Salto ambizioso ma possibile con un blocco completo e regolare.':'Obiettivo in linea con la forma attuale.'}</p>
  </div><div>
    <p style="margin-bottom:6px"><b>Cosa chiede la gara</b> <span class="muted">· fascia ${dm.band} · ${dm.dur}</span></p>
    <p class="muted" style="margin-bottom:8px">${dm.text}</p>
    ${hbars(dm.emph.map(([n,v])=>({l:n,v,c:'var(--acc2)',txt:v+'%'})))}
  </div></div>
  <h3 class="fh">Sedute prova da fare prima della gara</h3>
  <table>${dm.proofs.map(([n,d,a,b])=>{const from=wkOut(a),to=wkOut(b);const stt=today>to?'<span class="phb deload">passata</span>':today>=from?'<span class="phb race">adesso</span>':`<span class="muted">dal ${fmtDay(from)}</span>`;
    return`<tr><td><b>${n}</b> · ${d}</td><td class="r" style="white-space:nowrap">${a===52?'tutto l\'anno':`${a}–${b} sett. prima`}<br>${a===52?'':stt}</td></tr>`}).join('')}</table>
  <h3 class="fh">Errori da evitare</h3><ul class="muted" style="padding-left:18px;font-size:12.5px;line-height:1.5">${dm.errors.map(e=>`<li>${e}</li>`).join('')}</ul>`;
}
function doseCard(plan){
  const wz={};weekZones(60).forEach(o=>{if(o.nx)wz[o.w]=o.min});
  const rows=plan.weeks.map(w=>{const mon=wkMonISO(plan,w);
    const d=[0,0,0];w.sess.forEach(s=>{if(s.done||isRaceSess(s))return;planDose(s.d,+plan.goal).forEach((v,i)=>d[i]+=v)});
    const rec=wz[mon];return{w:w.w,mon,d,rec:rec?rec[2]+rec[3]:null,race:w.sess.some(isRaceSess)}});
  setTimeout(()=>{
    const host=document.getElementById('p-dose');if(!host)return;
    const W=420,H=214,P={l:34,r:8,t:30,b:24},n=rows.length,gw=(W-P.l-P.r)/n,bw=Math.max(3,gw*.72);
    const mx=Math.max(30,...rows.map(r=>r.d[0]+r.d[1]+r.d[2]),...rows.map(r=>r.rec||0));
    const step=Math.ceil(mx/4/10)*10,top=step*Math.ceil(mx/step),Y=v=>H-P.b-(v/top)*(H-P.t-P.b);
    let s=`<text x="2" y="12" class="cu">minuti di lavoro di qualità, per settimana</text>`;
    for(let g=0;g<=top;g+=step)s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(g)}" y2="${Y(g)}" stroke="var(--line)"/><text x="${P.l-5}" y="${Y(g)+4}" text-anchor="end">${g}</text>`;
    // dove siamo: linea "oggi" fra settimane passate e future
    const tdy=todayISO(),ci=rows.findIndex(r=>r.mon<=tdy&&tdy<isoLoc(addD(dOnly(r.mon),7)));
    if(ci>=0){const xo=P.l+ci*gw;s+=`<line x1="${xo.toFixed(1)}" x2="${xo.toFixed(1)}" y1="${P.t-8}" y2="${H-P.b}" stroke="var(--txt)" stroke-width="1.2" stroke-dasharray="4 3"/><text x="${(xo+3).toFixed(1)}" y="${P.t-1}" class="cr" style="fill:var(--txt)">oggi →</text>`;
      if(ci>0)s+=`<text x="${(xo-3).toFixed(1)}" y="${P.t-1}" text-anchor="end" class="cr" style="fill:var(--dim)">← fatte</text>`}
    rows.forEach((r,i)=>{const x=P.l+i*gw+(gw-bw)/2;let base=0;
      [0,1,2].forEach(k=>{const v=r.d[k];if(!v)return;s+=`<rect x="${x.toFixed(1)}" y="${Y(base+v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y(base)-Y(base+v)).toFixed(1)}" fill="${zcol(k+2)}" fill-opacity=".55"><title>S${r.w} · ${['LT1','LT2','alta'][k]} prevista ${Math.round(v)}'</title></rect>`;base+=v});
      if(r.rec!=null)s+=`<line x1="${(x-1).toFixed(1)}" x2="${(x+bw+1).toFixed(1)}" y1="${Y(r.rec).toFixed(1)}" y2="${Y(r.rec).toFixed(1)}" stroke="var(--acc)" stroke-width="3" stroke-linecap="round"><title>S${r.w} · LT1+LT2 registrata ${Math.round(r.rec)}'</title></line>`;
      if(r.race)s+=`<text x="${(x+bw/2).toFixed(1)}" y="${(Y(base)-3).toFixed(1)}" text-anchor="middle" style="font-size:11px">🏁</text>`;
      const xs=Math.max(1,Math.ceil(n/6));if((i%xs===0&&n-1-i>=xs*.6)||i===n-1)s+=`<text x="${(P.l+i*gw+gw/2).toFixed(1)}" y="${H-6}" text-anchor="middle">S${r.w}</text>`});
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="chv">${s}</svg><div class="lgd"><span><i style="background:${zcol(2)};opacity:.55"></i>LT1 prevista</span><span><i style="background:${zcol(3)};opacity:.55"></i>LT2 prevista</span><span><i style="background:${zcol(4)};opacity:.55"></i>Alta intensità prevista</span><span><i style="background:var(--acc)"></i>trattino = LT1+LT2 registrata (FC)</span><span>🏁 gara</span></div>`;
  },0);
  const tot=rows.reduce((a,r)=>[a[0]+r.d[0],a[1]+r.d[1],a[2]+r.d[2]],[0,0,0]);
  return `<div class="card"><h2>Dose di intensità per settimana</h2><div id="p-dose"></div>
    <p class="muted" style="margin-top:6px">Minuti di lavoro previsti dalle sedute (solo la parte di qualità, senza riscaldamento né gare) e, per le settimane passate, minuti registrati con la FC in LT1+LT2. Totale previsto: LT1 ${Math.round(tot[0])}' · LT2 ${Math.round(tot[1])}' · alta intensità ${Math.round(tot[2])}'. Se una settimana salta, non recuperare il lavoro mancato nei giorni dopo.</p></div>`;
}

document.getElementById('dt-zip').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const stEl=document.getElementById('dt-zipst');
  try{
    const res=await importZip(f,(i,n,msg)=>{stEl.textContent=msg||`Elaboro ${i} di ${n} file .fit…`});
    stEl.innerHTML=`<b>Fatto.</b> ${res.total} file .fit nell'archivio · ${res.nf} letti · ${res.nr} corse nuove · ${res.nu} completate · FC secondo per secondo su ${res.nx}${res.skip?` · ${res.skip} non di corsa ignorati`:''}${res.err?` · ${res.err} illeggibili`:''}.`;
  }catch(err){stEl.textContent='Errore: '+err.message}
});

/* ---------- Piano: settimane richiudibili e "sei qui" ---------- */
function wkWrap(w,isCur,sunW,curWeek,html){
  const open=isCur||(curWeek&&w.w===curWeek+1);
  const mon=new Date(sunW);mon.setDate(mon.getDate()-6);
  const dl=d=>d.getDate()+' '+MESI[d.getMonth()];
  const PHN={base:'Base',speed:'Velocità',ispec:'Specifico mezza',spec:'Specifico',taper:'Taper'};
  const key=(w.sess||[]).filter(s=>isRaceSess(s)||(typeof sLoad==='function'&&sLoad(s)>=3)).map(s=>s.n.replace(/^🏁\s*/,'🏁 ')).slice(0,2).join(' · ')
    ||(w.sess||[]).map(s=>s.n).slice(0,2).join(' · ');
  const past=w.hist||(curWeek&&w.w<curWeek);
  return `<details class="wkd${past?' past':''}"${open?' open':''}><summary><span class="wks-n">S${w.w}</span><span class="wks-t">${key}<small>${dl(mon)}–${dl(sunW)} · ${PHN[w.phase]||''}${w.isDeload?' · scarico':''}${past?' · passata':''}</small></span><span class="wks-k">${w.vol} km</span></summary>${html}</details>`;
}
function hereMarker(plan,curWeek,nAll,race){
  const days=Math.round((dOnly(plan.dateStr)-dOnly(todayISO()))/864e5);
  const pos=curWeek?((curWeek-.5)/nAll*100):null;
  return `${pos!=null?`<div class="here"><span style="left:${Math.min(92,Math.max(8,pos)).toFixed(1)}%">▲ S${curWeek} · sei qui</span></div>`:''}
    <div class="cdown"><div><b>${days>=0?days:'–'}</b><span>giorni alla gara</span></div><div><b>${curWeek||'–'}/${nAll}</b><span>settimana</span></div></div>`;
}
/* ---------- Corse: apri l'analisi di una corsa ---------- */
function anaOpen(date){
  showPane('runs');const sel=document.getElementById('a-sel');sel.value=date;rAna();
  const c=sel.closest('.card');if(c)setTimeout(()=>c.scrollIntoView({behavior:'smooth',block:'start'}),50);
}
function groupPast(){
  const past=[...document.querySelectorAll('#p-out details.wkd.past')];if(past.length<2)return;
  const d=document.createElement('details');d.className='wkd-past';
  d.innerHTML=`<summary><span>Settimane passate</span><b>${past.length}</b></summary>`;
  past[0].before(d);past.forEach(p=>d.appendChild(p));
}

/* =====================================================================================
   v104 — le funzioni di RunZones che mancavano:
   riferimenti ora/previsto/migliore/obiettivo, efficienza a FC di riferimento, calendario a cerchi,
   analisi del blocco con freschezza/fatica e storico 2 anni, guida a FC nel piano, filtri archivio,
   tempo in zona per passo.
   ===================================================================================== */
// confini di passo (s/km) fra le 5 zone, dal VDOT: più lento di B[0] = Recupero, … più veloce di B[3] = Alta intensità
function paceBounds(vd){const p=paces(vd),mid=(a,b)=>(a+b)/2;return[p.E[0],mid(p.E[1],p.M),mid(p.M,p.T),mid(p.T,p.I)]}
function paceZone(sec,B){return sec>B[0]?0:sec>B[1]?1:sec>B[2]?2:sec>B[3]?3:4}
function pillsTxt(id,opts,cur,cb){const el=document.getElementById(id);if(!el)return;
  el.innerHTML=opts.map(([v,l])=>`<span class="pill${v===cur?' on':''}" data-v="${v}">${l}</span>`).join('');
  el.querySelectorAll('.pill').forEach(p=>p.onclick=()=>cb(p.dataset.v))}


/* ---------- render dashboard ---------- */
function rDash(){
  const vd=curVdot();
  const vPrev=bestVdot(runs.filter(r=>daysAgo(r)>=90&&daysAgo(r)<180));
  // finestre di giorni pieni: 0..6 = ultimi 7 giorni (oggi compreso), 7..13 = i 7 precedenti
  const w7=runs.filter(r=>daysAgo(r)<7).reduce((s,r)=>s+vk(r),0);
  const w7p=runs.filter(r=>daysAgo(r)>=7&&daysAgo(r)<14).reduce((s,r)=>s+vk(r),0);
  const m28=runs.filter(r=>daysAgo(r)<28).reduce((s,r)=>s+vk(r),0);
  const m28p=runs.filter(r=>daysAgo(r)>=28&&daysAgo(r)<56).reduce((s,r)=>s+vk(r),0);
  const delta=(a,b,u='')=>b?`<span class="${a>=b?'up':'down'}">${a>=b?'▲':'▼'} ${Math.abs(a-b).toFixed(1)}${u}</span>`:'';
  document.getElementById('d-vdot').textContent=vd?vd.toFixed(1):'–';
  document.getElementById('d-vdot-d').innerHTML=delta(vd||0,vPrev,'');
  document.getElementById('d-wkm').textContent=w7.toFixed(0);
  document.getElementById('d-wkm-d').innerHTML=delta(w7,w7p,' km');
  document.getElementById('d-mkm').textContent=m28.toFixed(0);
  document.getElementById('d-mkm-d').innerHTML=delta(m28,m28p,' km');
  document.getElementById('hdr').textContent=`${runs.length} corse · ${runs.reduce((s,r)=>s+r.km,0).toFixed(0)} km`;
  try{rOggiExtra()}catch(e){console.warn('rOggiExtra',e)}
  if(vd){
    document.getElementById('d-pred').innerHTML=[[5,'5 km'],[10,'10 km'],[21.0975,'Mezza'],[42.195,'Maratona']]
      .map(([d,n])=>`<div class="stat"><b style="font-size:17px">${fmtD(predict(d,vd))}</b><span>${n} · ${fmtP(predict(d,vd)/d)}/km</span></div>`).join('');
    const p=paces(vd);
    document.getElementById('d-paces').innerHTML=`<tr><th>Zona</th><th class="r">Passo /km</th><th class="r">Uso</th></tr>
      <tr><td>Easy (E)</td><td class="r pace">${fmtP(p.E[1])}–${fmtP(p.E[0])}</td><td class="r muted">recupero, lunghi</td></tr>
      <tr><td>Maratona (M)</td><td class="r pace">${fmtP(p.M)}</td><td class="r muted">ritmo gara 42k</td></tr>
      <tr><td>Soglia (T)</td><td class="r pace">${fmtP(p.T)}</td><td class="r muted">medio-soglia</td></tr>
      <tr><td>Interval (I)</td><td class="r pace">${fmtP(p.I)}</td><td class="r muted">ripetute 2-5'</td></tr>
      <tr><td>Reps (R)</td><td class="r pace">${fmtP(p.R)}</td><td class="r muted">200-400m</td></tr>`;
  }
  document.getElementById('d-recent').innerHTML='<tr><th>Data</th><th>Corsa</th><th class="r">km</th><th class="r">Passo</th></tr>'+
    runs.slice(-8).reverse().map(r=>`<tr><td class="muted">${r.date.slice(5,10)}</td><td>${r.title}<br><span class="badge ${cls(r)}">${CLSN[cls(r)]}</span></td><td class="r">${r.km.toFixed(1)}</td><td class="r pace">${fmtP(pace(r))}</td></tr>`).join('');
}

/* ---------- seduta del giorno (dal piano che segui) ---------- */
/* ---------- seduta del giorno (dal piano che segui): card scura + settimana a pallini ---------- */
function todaySessions(){
  if(monitor&&monitor.sessions&&monitor.sessions.length)return monitor.sessions;
  const pl=LS('rp_plan');return pl?planToSessions(pl):null;
}
function sessZone(work,c){
  const m=String(work||'').match(/\((I|R|T|M|Z2|gara)\)/);
  if(m)return{Z2:1,M:2,gara:2,T:3,I:4,R:4}[m[1]];
  return ['easy','long'].includes(c)?1:null;
}
function rToday(){
  const el=document.getElementById('d-today');if(!el)return;
  const DN=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  const now=new Date();
  const sub=document.getElementById('hdr-sub');if(sub)sub.textContent=`${DN[now.getDay()]} ${now.getDate()} ${['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'][now.getMonth()]}`;
  const sessions=todaySessions();
  if(!sessions||!sessions.length){el.innerHTML='<div class="hl">Oggi</div><div class="hn">Nessun piano attivo</div><p class="hw">Genera un piano nel tab Piano: qui vedrai la seduta del giorno con passo e FC.</p>';return}
  const todayS=todayISO();
  const todayList=sessions.filter(s=>s.date===todayS);
  let target=todayList[0],label='Oggi';
  if(!target){
    const up=sessions.filter(s=>s.date>todayS).sort((a,b)=>a.date<b.date?-1:1)[0];
    if(!up){el.innerHTML='<div class="hl">Oggi</div><div class="hn">Piano concluso</div><p class="hw">Nessuna seduta in programma: genera o carica un nuovo piano.</p>';return}
    target=up;const gg=Math.round((day(up.date)-day(todayS))/864e5);
    label=gg<=1?'Domani':`Tra ${gg} giorni`;
  }
  const doneToday=todayList.length&&runs.some(r=>runDay(r)===todayS&&runLink(r)!=='none');
  const dt=day(target.date),isQ=['int','qual','race'].includes(target.cls);
  const zi=sessZone(target.work,target.cls),Z=Zcur();
  const pr=String(target.work||'').match(/(\d:\d\d)\s*[–-]\s*(\d:\d\d)/);
  const zr=zi!=null?zRange(zi,Z):null;
  let html=`<div class="hl">${!todayList.length?'Oggi riposo · ':''}${label} · ${DN[dt.getDay()]} ${dt.getDate()} ${MESI[dt.getMonth()]}</div>
    <div class="hn">${target.name}</div>
    <div class="hchips">${pr?`<span class="hchip">${pr[1]}–${pr[2]} /km</span>`:''}${zr?`<span class="hchip"><i style="background:var(--z${zi+1})"></i>FC ${zr[1]==null?zr[0]+'+':zr[0]+'–'+zr[1]} · ${ZTAG[zi]}</span>`:''}${target.km?`<span class="hchip">≈ ${target.km} km</span>`:''}${doneToday?'<span class="hchip">✓ svolta</span>':''}</div>
    ${target.work?`<p class="hw">${target.work}</p>${sessBar(target.work,16)}`:''}
    ${isQ?`<p class="hw" style="margin-top:4px;opacity:.7">Riscaldamento 15-20' easy + 4-5 allunghi · defaticamento 10' easy.</p>`:''}`;
  // settimana lun-dom a pallini
  const mon=dOnly(mondayOf(todayS));const cells=[];
  for(let k=0;k<7;k++){const d=new Date(mon);d.setDate(mon.getDate()+k);const iso=isoLoc(d);
    const ss=sessions.filter(s=>s.date===iso),rr=runs.filter(r=>runDay(r)===iso);
    const rkm=rr.reduce((a,r)=>a+vk(r),0),pkm=ss.reduce((a,s)=>a+(+s.km||0),0);
    let c='',t='';
    if(rr.length){c=ss.length&&rr.some(r=>runLink(r)!=='none')?'done':'extra';t=Math.round(rkm)}
    else if(ss.length&&iso<todayS){c='miss';t=Math.round(pkm)||'·'}
    else if(iso===todayS&&ss.length){c='now';t=Math.round(pkm)||'·'}
    else if(ss.length){c='pl';t=Math.round(pkm)||'·'}
    const nm=ss.length?ss[0].name.split(/[ -]/)[0].toLowerCase():'';
    cells.push(`<div class="wd">${['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][k]}<div class="wdot ${c}" title="${ss.map(s=>s.name).join(', ')}">${t}</div><b>${iso===todayS?'oggi':nm.slice(0,7)}</b></div>`)}
  const wPl=sessions.filter(s=>mondayOf(s.date)===mondayOf(todayS)).reduce((a,s)=>a+(+s.km||0),0);
  const wDo=runs.filter(r=>mondayOf(r.date)===mondayOf(todayS)).reduce((a,r)=>a+vk(r),0);
  // proiezione a fine settimana: sedute rimaste del piano, e al ritmo dei giorni passati
  const ranToday=runs.some(r=>r.date.slice(0,10)===todayS);
  const left=sessions.filter(s=>mondayOf(s.date)===mondayOf(todayS)&&(s.date>todayS||(s.date===todayS&&!ranToday))).reduce((a,s)=>a+(+s.km||0),0);
  const el_=(now.getDay()+6)%7+(ranToday?1:0);
  const proj=[];if(wPl>0)proj.push(`<b>${Math.round(wDo+left)} km</b> se fai le sedute rimaste (${Math.round((wDo+left)/wPl*100)}%)`);
  if(el_>=2&&wDo>0)proj.push(`${Math.round(wDo/el_*7)} km al ritmo di questi giorni`);
  html+=`<div class="wstrip">${cells.join('')}</div><p class="hw" style="margin-top:8px;opacity:.7">${wDo.toFixed(0)} di ${wPl.toFixed(0)} km previsti questa settimana${proj.length?'<br>Proiezione: '+proj.join(' · '):''}</p>`;
  el.innerHTML=html;
}
function rOggiExtra(){
  const acute=runs.filter(r=>daysAgo(r)<7).reduce((s,r)=>s+vk(r),0),chr=runs.filter(r=>daysAgo(r)<28).reduce((s,r)=>s+vk(r),0)/4;
  const a=document.getElementById('d-acwr');
  if(a){if(chr>=1){const q=acute/chr;a.textContent=q.toFixed(2);a.style.color=q>1.5?'var(--z5)':q>1.3||q<.8?'var(--warn)':'';
      document.getElementById('d-acwr-d').innerHTML=`<span class="muted">${q>1.5?'picco':q>1.3?'alto':q>=.8?'ottimale':q>=.5?'in calo':'molto basso'}</span>`}else a.textContent='–'}
  const e=document.getElementById('d-aero');
  if(e){const ser=aeroSeries(2).filter(o=>o.v!=null),mv=aeroMoved();
    if(ser.length){e.textContent=ser[ser.length-1].v.toFixed(1);e.style.color='var(--z2)';
      document.getElementById('d-aero-d').innerHTML=mv.total!=null?`<span class="${mv.total>=0?'up':'down'}">${mv.total>=0?'▲':'▼'} ${Math.abs(mv.total).toFixed(1)} in 7 gg</span>`:''}
    else{e.textContent='–';document.getElementById('d-aero-d').innerHTML='<span class="muted">serve la FC dei .fit</span>'}}
}
/* ---------- avvisi: lacune, aderenza, carico, dati ---------- */
function rAlerts(){
  const el=document.getElementById('d-alerts');if(!el)return;
  const out=[];const add=(lvl,h)=>out.push({lvl,h});
  const todayS=todayISO();
  try{
    const ex=exposure();
    const lg=ex[0];if(lg.days==null)add('bad','<b>Nessun lungo registrato.</b> Per la maratona è il mattone principale.');else if(lg.days>28)add(lg.days>60?'bad':'warn',`<b>Lungo: ${lg.days} giorni fa.</b> L'ultimo oltre i 90' o i 18 km è del ${lg.r.date.slice(8,10)}/${lg.r.date.slice(5,7)}.`);
    const t2=ex[1];if(t2.days!=null&&t2.days>21)add('warn',`<b>Nessun lavoro a LT2 da ${t2.days} giorni</b> (almeno 10' con la FC in zona).`);
  }catch(e){}
  const ss=todaySessions()||[];
  const lastMon=addDaysISO(mondayOf(todayS),-7);
  const pl=ss.filter(s=>mondayOf(s.date)===lastMon).reduce((a,s)=>a+(+s.km||0),0);
  const dn=runs.filter(r=>mondayOf(r.date)===lastMon).reduce((a,r)=>a+vk(r),0);
  if(pl>0&&dn/pl<.8)add('warn',`<b>Settimana scorsa al ${Math.round(dn/pl*100)}%</b> dei km previsti (${dn.toFixed(0)} di ${pl.toFixed(0)}).`);
  const miss=ss.filter(s=>mondayOf(s.date)===mondayOf(todayS)&&s.date<todayS&&!runs.some(r=>runDay(r)===s.date&&runLink(r)!=='none'));
  miss.forEach(s=>{const d=day(s.date);add('warn',`<b>${s.name} di ${['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'][d.getDay()]} non registrata.</b> Se l'hai fatta, importa il .fit in Corse.`)});
  const acute=runs.filter(r=>daysAgo(r)<7).reduce((s,r)=>s+vk(r),0),chr=runs.filter(r=>daysAgo(r)<28).reduce((s,r)=>s+vk(r),0)/4;
  if(chr>=1&&acute/chr>1.3)add(acute/chr>1.5?'bad':'warn',`<b>Carico alto:</b> ${acute.toFixed(0)} km negli ultimi 7 giorni contro una media di ${chr.toFixed(0)}.`);
  const r12=runs.filter(r=>daysAgo(r)<84&&!r.tm),x12=r12.filter(r=>X[r.date]&&X[r.date].hist).length;
  if(r12.length&&x12/r12.length<.6)add('info',`<b>FC secondo per secondo su ${x12} delle ${r12.length} corse recenti.</b> Importa l'archivio .zip in Corse per completare le analisi.`);
  try{const unc=raceCands().filter(o=>o.state==='?'&&daysAgo(o.r)<60);if(unc.length)add('info',`<b>${unc.length} ${unc.length===1?'corsa sembra':'corse sembrano'} una gara</b> (${unc.map(o=>o.r.date.slice(8,10)+'/'+o.r.date.slice(5,7)).join(', ')}): confermale in Forma › Gare riconosciute.`)}catch(e){}
  const C={bad:'var(--z5)',warn:'var(--z4)',info:'var(--z2)'};
  el.innerHTML=out.length?out.map(o=>`<div class="alrt"><span class="m" style="background:${C[o.lvl]}"></span><span>${o.h}</span></div>`).join(''):'<p class="muted">Tutto in ordine: nessuna lacuna o anomalia.</p>';
}

/* ---------- carico e rischio infortuni (acute:chronic) ---------- */
function rLoad(){
  const el=document.getElementById('d-load');if(!el)return;
  const acute=runs.filter(r=>daysAgo(r)<7).reduce((s,r)=>s+vk(r),0);
  const chronic28=runs.filter(r=>daysAgo(r)<28).reduce((s,r)=>s+vk(r),0);
  const chronic=chronic28/4;
  if(chronic<1){el.innerHTML='<p class="muted">Servono corse nelle ultime 4 settimane per stimare il carico.</p>';return}
  const ratio=acute/chronic;
  const lastWk=runs.filter(r=>daysAgo(r)>=7&&daysAgo(r)<14).reduce((s,r)=>s+vk(r),0);
  // le date delle due finestre, scritte in chiaro: sono 7 giorni MOBILI, non la settimana lun-dom,
  // e senza dirlo il confronto sembra sbagliato a chi ragiona per settimane di calendario
  const dLbl=k=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-k);return `${d.getDate()}/${d.getMonth()+1}`};
  const winA=`${dLbl(6)}→${dLbl(0)}`,winP=`${dLbl(13)}→${dLbl(7)}`;
  const ramp=lastWk?((acute-lastWk)/lastWk*100):null;
  let col,verdict;
  if(ratio>1.5){col='red';verdict='<b>Picco di carico.</b> Stai correndo molto più della tua media recente: è la zona di massimo rischio infortunio. Meglio alleggerire nei prossimi giorni.'}
  else if(ratio>1.3){col='warn';verdict='<b>Carico alto.</b> Sopra la fascia ottimale: ok per una settimana di spinta, ma non protrarla — cura sonno e recupero.'}
  else if(ratio>=0.8){col='';verdict='<b>Carico ottimale.</b> Sei nella fascia (0.8–1.3) dove si costruisce forma con basso rischio.'}
  else if(ratio>=0.5){col='warn';verdict='<b>Carico in calo.</b> Meno della tua media: normale in scarico/taper o dopo una pausa, ma se prolungato perdi condizione.'}
  else{col='warn';verdict='<b>Carico molto basso.</b> Settimana quasi ferma: bene se voluta (riposo/rientro), altrimenti stai perdendo terreno.'}
  // scala con le fasce scritte: dove cadi rispetto a basso / ottimale / alto / picco
  const gauge=(()=>{const W=420,L=8,R=8,MX=1.8,Xg=v=>L+Math.min(v,MX)/MX*(W-L-R);
    const seg=[[0,.8,'var(--z1)','basso'],[.8,1.3,'var(--ok)','ottimale'],[1.3,1.5,'var(--warn)','alto'],[1.5,MX,'var(--red)','picco']];
    let g=seg.map(([a,b,c,t])=>`<rect x="${Xg(a).toFixed(1)}" y="20" width="${(Xg(b)-Xg(a)).toFixed(1)}" height="10" fill="${c}" fill-opacity=".35"/><text x="${((Xg(a)+Xg(b))/2).toFixed(1)}" y="60" text-anchor="middle" class="cz" style="fill:${c}">${t}</text>`).join('');
    g+=[.8,1.3,1.5].map(v=>`<line x1="${Xg(v)}" x2="${Xg(v)}" y1="18" y2="34" stroke="var(--card)" stroke-width="1.5"/><text x="${Xg(v)}" y="46" text-anchor="middle">${v.toFixed(1)}</text>`).join('');
    const xm=Xg(ratio);g+=`<path d="M${(xm-6).toFixed(1)},14 L${(xm+6).toFixed(1)},14 L${xm.toFixed(1)},22 Z" fill="var(--txt)"/><line x1="${xm.toFixed(1)}" x2="${xm.toFixed(1)}" y1="18" y2="32" stroke="var(--txt)" stroke-width="2.5"/>`;
    const tw=60,tx=Math.max(tw/2,Math.min(W-tw/2,xm));g+=`<text x="${tx.toFixed(1)}" y="10" text-anchor="middle" class="cv">tu: ${ratio.toFixed(2)}</text>`;
    return`<svg viewBox="0 0 ${W} 64" width="100%" class="chv gauge">${g}</svg>`})();
  el.innerHTML=`<div class="grid3">
      <div class="stat"><b>${ratio.toFixed(2)}</b><span>carico ac./cron.</span></div>
      <div class="stat"><b>${acute.toFixed(0)}</b><span>km ultimi 7g</span></div>
      <div class="stat"><b>${chronic.toFixed(0)}</b><span>media sett. (28g)</span></div>
    </div>
    ${gauge}
    <p style="margin-top:10px">${verdict}</p>
    ${(()=>{const x7=allXts().filter(x=>daysAgo(x)<7);if(!x7.length)return'';const mn=x7.reduce((a,x)=>a+x.min,0),lx=x7.reduce((a,x)=>a+xtLoad(x),0),lr=runs.filter(r=>daysAgo(r)<7).reduce((a,r)=>a+runLoad(r),0);
      return `<p class="muted" style="margin-top:6px">Altri sport negli ultimi 7 giorni: ${x7.length} sedute · ${Math.floor(mn/60)}h${String(mn%60).padStart(2,'0')} (${[...new Set(x7.map(x=>XT_SP[x.sport][0].toLowerCase()))].join(', ')}) — carico ≈ ${Math.round(lx)} TRIMP, ${lr?Math.round(lx/lr*100)+'% di quello della corsa':'senza corse nello stesso periodo'}. Conta in forma e fatica, non nei km qui sopra.</p>`})()}
    ${ramp!=null?`<p class="muted" style="margin-top:4px">Vs i 7 giorni precedenti: ${ramp>=0?'+':''}${ramp.toFixed(0)}% km (${winP} ${lastWk.toFixed(0)} km → ${winA} ${acute.toFixed(0)} km). Sopra +10% è il limite prudente.</p>`:''}
    <details class="pinfo"><summary>Come si calcola</summary><p class="muted" style="margin-top:4px">Sono 7 giorni mobili (${winA}), non la settimana lunedì-domenica: con la settimana ancora a metà il confronto per settimane di calendario direbbe sempre "in calo". Il rapporto è fra i km di questi 7 giorni e la media settimanale delle ultime 4 (acute:chronic workload ratio). Fascia consigliata 0.8–1.3.</p></details>`;
}


/* ---------- allineamento Piano ↔ Monitor ----------
   Il Monitor tiene il calendario VERO: ogni seduta ha la sua data reale. Il tab Piano invece ricalcola
   le settimane a ritroso dalla domenica di gara sul totale `weeks.length`, quindi basta una settimana
   di differenza nel conteggio perché tutta la griglia scivoli e i due tab mostrino la stessa settimana
   con numeri e contenuti diversi. Quando succede, il Monitor è la fonte attendibile: questa funzione
   ricostruisce le settimane del piano dalle sedute del Monitor, così le due viste tornano identiche. */
/* ---------- registro delle ricalibrazioni ----------
   Serve al box "Quando ricalibrare il piano": senza, il consiglio misura tutto dall'inizio del piano,
   quindi "sono trascorse N settimane" e "il VDOT è cambiato di X" restano veri per sempre e il box
   ripete lo stesso messaggio anche il giorno dopo che hai premuto il bottone. Registrando data e VDOT
   di ogni ritocco, il conteggio riparte da lì. Vive dentro `monitor` perché è già sincronizzato. */
function logRecal(kind){
  if(typeof monitor==='undefined'||!monitor)return;
  const h=((monitor.recal||[]).filter(r=>r&&r.at));
  h.push({at:todayISO(),kind,vdot:curVdot()||null});
  monitor.recal=h.slice(-10);
  LS('rp_monitor',monitor);
}
function lastRecal(){
  const h=(typeof monitor!=='undefined'&&monitor&&monitor.recal)||[];
  return h.length?h[h.length-1]:null;
}
// domenica della n-esima settimana piena dopo una data (per dire quando tornerò a valutare)
function nthSundayAfter(iso,n){
  const d=day(iso);
  d.setDate(d.getDate()+((7-d.getDay())%7||7)+7*(Math.max(1,n)-1));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function monFirstMonday(){
  if(typeof monitor==='undefined'||!monitor||!monitor.sessions||!monitor.sessions.length)return '';
  return monitor.sessions.map(s=>weekKey(s.date)).sort()[0];
}
function alignPlanToMonitor(){
  if(typeof monitor==='undefined'||!monitor||!monitor.sessions||!monitor.sessions.length)
    return alert('Il Monitor non ha nessun piano caricato: non c’è niente da recuperare.');
  const old=LS('rp_plan');
  if(!old)return alert('Genera prima un piano nel tab Piano.');
  const nEd=Object.keys(LS('rp_wkedit')||{}).length+Object.keys(LS('rp_wkskip')||{}).length+Object.keys(LS('rp_flex')||{}).length;
  const dL=x=>new Date(x).toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  // Direzione: qui si copia Monitor → Piano. Se il piano è stato toccato DOPO l'ultimo allineamento del
  // Monitor (tipico di "Ricalibra i passi", che aggiorna il piano ma non il Monitor), recuperare da qui
  // butterebbe via la ricalibrazione: la direzione giusta sarebbe l'opposta.
  const stale=old.savedAt&&monitor.syncedAt&&old.savedAt>monitor.syncedAt;
  const warn=stale?`\n\n⚠️ Il piano qui è più recente del Monitor (piano ${dL(old.savedAt)}, Monitor ${dL(monitor.syncedAt)}). Se hai appena premuto “Ricalibra i passi” e vuoi portare quei passi nel Monitor, annulla e usa invece “↺ Aggiorna dal piano corrente” in Piano › Aderenza.`:'';
  const edTxt=nEd?`\nLe ${nEd} modifiche manuali alle settimane (scarico / riscrivi sul reale) vengono azzerate: sono già dentro le sedute del Monitor, e riapplicarle sopra le duplicherebbe.`:'';
  if(!confirm(`Riscrivo le settimane del tab Piano usando il calendario e le sedute del Monitor: le due viste torneranno identiche.${edTxt}${warn}\n\nProcedo?`))return;
  const DN=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  const addD=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayS=todayISO();
  const g={};
  monitor.sessions.forEach(s=>{const k=weekKey(s.date);(g[k]=g[k]||[]).push(s)});
  const keys=Object.keys(g).sort();
  const weeks=keys.map((k,i)=>{
    const ss=g[k].slice().sort((a,b)=>a.date<b.date?-1:1);
    const sunISO=iso(addD(day(k),6));
    const cnt={};ss.forEach(s=>{const p=s.phase||'base';cnt[p]=(cnt[p]||0)+1});
    const phase=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0]||'base';
    const wk={w:i+1,phase,summer:ss.some(s=>s.summer),isDeload:ss.some(s=>s.deload),
      isTaper:phase==='taper',vol:Math.round(ss.reduce((a,s)=>a+(s.km||0),0)),
      sess:ss.map(s=>{const o={t:DN[day(s.date).getDay()],n:s.name,d:s.work||'',km:s.km||0};
        if(s.done){o.done=1;o.realDate=s.date;o.rcls=s.cls}
        return o;})};
    if(sunISO<todayS)wk.hist=1;
    return wk;
  });
  const PHK={base:'baseW',speed:'speedW',ispec:'ispecW',spec:'specW',taper:'taper'};
  const ph={baseW:0,speedW:0,ispecW:0,specW:0,taper:0};
  weeks.forEach(w=>{const kk=PHK[w.phase];if(kk)ph[kk]++});
  const np={...old,weeks,ph};
  // Tutte le modifiche a mano sono ormai incorporate nelle settimane ricostruite (il Monitor le ha già
  // dentro): se restassero verrebbero riapplicate sopra a sé stesse — gare duplicate, settimane
  // riscritte due volte — e le due viste mostrerebbero titoli diversi a griglia allineata.
  if(nEd){LS('rp_wkedit',{});LS('rp_wkskip',{});LS('rp_flex',{})}
  LS('rp_plan',np);
  monitor.syncedAt=np.savedAt||new Date().toISOString(); // da adesso sono la stessa cosa
  LS('rp_monitor',monitor);
  rPlan(np);rTrack();if(typeof rToday==='function')rToday();
  alert(`Piano recuperato dal Monitor: ${weeks.length} settimane, da lunedì ${keys[0]} alla gara del ${np.dateStr}.${nEd?` Azzerate ${nEd} modifiche manuali alle settimane.`:''}`);
}
function rPlan(plan){
  if(!plan)return;
  plan=applyWkEdits(plan);
  const gn={5:'5 km',10:'10 km','21.0975':'Mezza maratona','42.195':'Maratona'}[plan.goal]||plan.goal+' km';
  const iS=plan.iSpec;
  const iNm=iS?(iS.dist>=42?'maratona':iS.dist>=21?'mezza':iS.dist+'k'):'gara';
  const PH={base:'Base',speed:'Velocità',ispec:`Specifico ${iNm}`,spec:'Specifico',taper:'Taper'};
  const DCL={int:'ripetute',qual:'qualità',long:'lungo',easy:'facile',race:'gara'}; // etichetta delle sedute svolte
  const PHC={base:'var(--z2)',speed:'var(--z5)',ispec:'var(--z4)',spec:'var(--z3)',taper:'var(--z1)'};
  // barra della periodizzazione, proporzionale alle settimane di ogni fase
  const ph=plan.ph||{};
  const segs=[['Base',ph.baseW,'var(--z2)'],[`Specifico ${iNm}`,ph.ispecW,'var(--z4)'],['Velocità',ph.speedW,'var(--z5)'],['Specifico',ph.specW,'var(--z3)'],['Taper',ph.taper,'var(--z1)']].filter(s=>s[1]>0);
  const totW=segs.reduce((a,s)=>a+s[1],0)||1;
  const phaseBar=segs.length?`<div style="display:flex;height:9px;border-radius:5px;overflow:hidden;margin:10px 0 8px">${segs.map(s=>`<div style="width:${(s[1]/totW*100).toFixed(1)}%;background:${s[2]}"></div>`).join('')}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11px;color:var(--dim);margin-bottom:2px">${segs.map(s=>`<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${s[2]};vertical-align:middle;margin-right:5px"></span>${s[0]} · ${s[1]} sett.</span>`).join('')}</div>`:'';
  // settimana in corso (ancorata alla domenica della gara, come il tracker)
  const addD=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const race=new Date(plan.dateStr+'T12:00:00');
  const refSun=addD(race,(7-race.getDay())%7);
  const nAll=plan.weeks.length,todayS=iso(new Date());
  const OFF={'Lunedì':-6,'Martedì':-5,'Mercoledì':-4,'Giovedì':-3,'Venerdì':-2,'Sabato':-1,'Domenica':0};
  let curWeek=0;
  plan.weeks.forEach(w=>{if(w.hist)return;const sun=addD(refSun,-(nAll-w.w)*7),mon=addD(sun,-6);if(todayS>=iso(mon)&&todayS<=iso(sun))curWeek=w.w});
  const peakVol=Math.max(1,...plan.weeks.map(w=>w.vol||0));
  // il Monitor ha le date vere: se il primo lunedì non coincide, la griglia qui è scivolata (vedi alignPlanToMonitor)
  const monMon=monFirstMonday(),planMon=iso(addD(refSun,-(nAll-1)*7-6));
  const misAlign=monMon&&monMon!==planMon
    ? `<p class="muted" style="margin:6px 0;padding:8px 10px;border-left:3px solid var(--red,#d33);background:rgba(211,51,51,.08);border-radius:6px">⚠️ <b>Calendario sfasato rispetto al Monitor</b> — qui il piano parte da lunedì ${planMon}, nel Monitor da lunedì ${monMon}: le stesse date finiscono su settimane diverse. Il calendario giusto è quello del Monitor (ha le date reali delle sedute).
       <button class="btn btn2" style="margin:8px 0 0" onclick="alignPlanToMonitor()">↺ Recupera dal Monitor</button></p>`
    : '';
  document.getElementById('p-out').innerHTML=`<div class="card">
    <h2>${gn} · ${plan.dateStr} · VDOT ${plan.vd}${plan.vdTarget&&plan.vdTarget!==plan.vd?` → ${plan.vdTarget}`:''}</h2>
    <div style="margin-bottom:2px">Obiettivo: <b class="pace">${plan.GT}</b> (${plan.GP}/km).${plan.mode?` <span class="muted">· Modalità: <b>${plan.mode}</b>${plan.targetSet?' (tempo scelto da te)':''}</span>`:''}<br>
    <details class="pinfo"><summary>Come leggere obiettivo e ritmi</summary><span class="muted">È un range, non un numero: dove cadi dentro dipende da meteo, percorso e giornata. Entrambi gli estremi sono un buon risultato.${plan.vdTarget&&plan.vdTarget>plan.vd?` I ritmi delle sedute progrediscono nel blocco: partono dal VDOT ${plan.vd} attuale e salgono fino al VDOT ${plan.vdTarget} previsto in gara, così le settimane finali mostrano il passo che punti a raggiungere. Rigenera dal reale per ricalibrarli su/giù coi tuoi dati.`:''}</span></details></div>
    ${phaseBar}
    ${hereMarker(plan,curWeek,nAll,race)}
    ${misAlign}
    ${plan.readiness?`<p class="muted" style="margin:6px 0;padding:8px 10px;border-left:3px solid var(--warn,#e0a800);background:rgba(224,168,0,.08);border-radius:6px">⚠️ <b>Base leggera</b> — ${plan.readiness.text} ${plan.readiness.advice} Il piano parte comunque nei limiti di sicurezza, ma le prime settimane saranno più impegnative.</p>`:''}
    ${plan.interRaces&&plan.interRaces.length?`<p class="muted" style="margin:6px 0">🏁 Gare intermedie (tune-up): ${plan.interRaces.map(r=>`${r.dist>=42?'Maratona':r.dist>=21?'Mezza':r.dist+'k'} il ${new Date(r.date).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}`).join(' · ')}. Mini-scarico prima, la gara sostituisce la qualità, poi recupero. Il blocco a diamante è collocato fuori dagli scarichi gara.${plan.iSpec?` <b>La prima</b> ha davanti ${plan.iSpec.len} settimane di <b>fase specifica ${iNm}</b> (viola): soglia al martedì e lungo con finale a ritmo gara, perché a quella distanza vale la pena arrivarci preparati — e la soglia guadagnata resta per la gara obiettivo. Le successive restano tune-up.`:''}</p>`:''}
    ${plan.weeks.some(w=>w.summer)?'<p class="muted" style="margin:6px 0">☀️ Estate (giu-ago): intenso ma breve — martedì interval, giovedì Z2, weekend qualità. Due sedute veloci corte separate da corse lente, niente lungo lento. Corri presto al mattino.</p>':''}
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <button class="btn btn2" style="margin:0;flex:1 1 44%" onclick="copyPlan()">Copia (markdown)</button>
      <button class="btn btn2" style="margin:0;flex:1 1 44%" onclick="exportICS()">Esporta .ics</button>
      ${monMon?`<button class="btn btn2" style="margin:0;flex:1 1 100%" onclick="alignPlanToMonitor()">↺ Recupera dal Monitor</button>`:''}</div>
    ${monMon?`<p class="muted" style="margin:6px 0 0"><b>↺ Recupera dal Monitor</b> riscrive le settimane qui sotto con le date e le sedute che vedi nel Monitor: premilo dopo aver ricalibrato o rigenerato il piano da lì, così le due viste coincidono. La direzione opposta è <b>↺ Aggiorna dal piano corrente</b>, in Piano › Aderenza.</p>`:''}
    <details class="pinfo"><summary>Note operative</summary><p class="muted" style="margin:6px 0 2px"><b>Note operative</b> — Riscaldamento interval/cruise: 15-20' easy progressivo + 4-5 allunghi 80m (inclusi nei km). Defaticamento: 10' easy. Tolleranza sui passi: ±3s (già nei range). I km indicati sono ≈ totali di seduta. Tra due sedute dure c'è sempre una corsa lenta (Z2/base) per non sovraccaricare le gambe. D'estate: due sedute veloci corte e intense separate da Z2 (es. martedì interval, giovedì Z2, weekend qualità), niente lungo lento.</p></details></div>`+(()=>{try{return doseCard(plan,refSun,nAll)}catch(e){console.warn('doseCard',e);return''}})()+
    `<div class="card">`+
    plan.weeks.map(w=>{
      const isCur=!w.hist&&curWeek===w.w;
      const phCol=w.isDeload?'var(--dim)':(PHC[w.phase]||'var(--acc)');
      const vpct=Math.min(100,Math.round((w.vol||0)/peakVol*100));
      const sunW=addD(refSun,-(nAll-w.w)*7);
      const wkKey=iso(sunW);
      const sO=(v,l)=>`<option value="${v}"${w.manual===v||(!w.manual&&v==='')?' selected':''}>${l}</option>`;
      const editSel=(!w.hist&&w.w!==nAll)?`<select class="wksel" onchange="setWkBase('${wkKey}',this.value)">
          ${sO('','Auto')}
          ${sO('deload','Rendi scarico')}
          <optgroup label="Gara la domenica (settimana riadattata)">${sO('a5','+ Gara 5k')}${sO('a10','+ Gara 10k')}${sO('a21','+ Gara mezza')}</optgroup>
          <optgroup label="Settimana dedicata (scarico + gara)">${sO('r5','Gara 5k')}${sO('r10','Gara 10k')}${sO('r21','Gara mezza')}</optgroup>
          <optgroup label="Gara infrasettimanale (giovedì)">${sO('w5','Gara 5k giovedì')}${sO('w10','Gara 10k giovedì')}${sO('w21','Gara mezza giovedì')}</optgroup>
        </select>
        <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--dim);margin:7px 0 0;cursor:pointer"><input type="checkbox" ${w.fromReal?'checked':''} onchange="setWkReal('${wkKey}',this.checked)" style="width:15px;height:15px;accent-color:var(--acc2,#2563eb)">✔ Riscrivi sulle corse svolte</label>`:'';
      return wkWrap(w,isCur,sunW,curWeek,`<div class="wk ph-${w.phase||'base'}${w.isDeload?' deload':''}${isCur?' cur':''}${w.manual?' manual':''}"${w.hist?' style="opacity:.55"':''}>
        <div class="wkhead"><div class="wktitle">Settimana ${w.w}${isCur?' <span class="nowb">in corso</span>':''}</div><div class="wkvol">~${w.vol} km</div></div>
        <div class="wkpills"><span class="phb ${w.phase}">${PH[w.phase]||''}</span>${w.isDeload?'<span class="phb deload">scarico</span>':''}${w.manual&&w.manual!=='deload'&&w.manual!=='real'?`<span class="phb race">🏁 gara${w.addRace?' (dom)':w.midRace?' (gio)':''}</span>`:''}${w.fromReal?'<span class="phb manual">✔ dal reale</span>':''}${w.flex?'<span class="phb manual">✎ sedute cambiate</span>':''}${w.manual&&!w.fromReal?'<span class="phb manual">✎ a mano</span>':''}${w.summer?'<span class="phb summer">☀️ estate</span>':''}${w.hist?'<span class="phb deload">passata</span>':''}</div>
        ${editSel}
        ${w.raceNote?`<p style="font-size:11px;color:var(--dim);margin:6px 0 0;padding:6px 8px;border-left:3px solid var(--acc2,#2563eb);background:rgba(37,99,235,.07);border-radius:6px;line-height:1.4">🧠 ${w.raceNote}</p>`:''}
        <div class="vbar"><i style="width:${vpct}%;background:${phCol}"></i></div>
        ${(()=>{
          // Corse dell'archivio agganciate alle sedute della settimana, con le stesse regole del Monitor:
          // prima lo stesso giorno, poi il giorno più vicino e lo stesso tipo; una seduta futura si
          // aggancia solo a una corsa dello stesso giorno. Prima il Piano segnava "✔ svolta" solo nelle
          // settimane con "Riscrivi sulle corse svolte": con una gara al volo (o senza nulla) la corsa
          // fatta martedì non compariva mai. Qui si SEGNA soltanto, la settimana non viene riscritta.
          w._hit={};
          const monS=iso(addD(sunW,-6)),sunS=iso(sunW);
          const doneKeys=new Set(w.sess.filter(s=>s.done).map(s=>s.realDate));
          const wr=runs.filter(r=>{const d=runDay(r);return d>=monS&&d<=sunS&&r.date.slice(0,10)<=todayS&&!doneKeys.has(r.date.slice(0,10))&&runLink(r)!=='none'});
          const pairs=[];
          w.sess.forEach((s,si)=>{if(s.done||s.n.startsWith('GARA'))return;
            const sdI=iso(addD(sunW,OFF[s.t]??0)),sc=planCls(s.n);
            wr.forEach(r=>{const rd=r.date.slice(0,10),lk=runLink(r);if(lk){if(lk===sdI)pairs.push({si,r,score:1000});return}if(sdI>todayS&&rd!==sdI)return;
              const rc=cls(r),same=rc===sc||(sc==='easy'&&rc==='long')||(sc==='long'&&rc==='easy');
              const dd=Math.min(6,Math.abs(Math.round((day(rd)-day(sdI))/864e5)));
              pairs.push({si,r,score:(6-dd)*10+(same?4:0)+1})})});
          pairs.sort((a,b)=>b.score-a.score);const used=new Set();
          pairs.forEach(p=>{if(w._hit[p.si]||used.has(p.r.date))return;w._hit[p.si]=p.r;used.add(p.r.date)});
          return '';})()}
        ${w.sess.map((s,si)=>{const isRaceFinal=s.n.startsWith('GARA'),isr=isRaceFinal||s.race;
          const sd=isRaceFinal?race:addD(sunW,OFF[s.t]??0);
          const L=sLoad(s);
          const hit=w._hit&&w._hit[si];
          if(hit){const rd=day(hit.date.slice(0,10));
            return `<div class="sess${isr?' race':''} done"><span class="daychip">${s.t.slice(0,3)}<br><span style="font-weight:400;font-size:9px">${sd.getDate()} ${MESI[sd.getMonth()]}</span></span><div class="sbody"><span class="sn">✔ ${s.n}</span> <span class="sd">${hrTag(s.d)}</span><div class="smeta">svolta${iso(rd)!==iso(sd)?` ${['dom','lun','mar','mer','gio','ven','sab'][rd.getDay()]} ${rd.getDate()}`:''}: «${hit.title}» ${hit.km.toFixed(1)} km @ ${fmtP(pace(hit))}/km${hit.hr?` · FC ${hit.hr}`:''} · <span class="ldb l${L}">${DCL[cls(hit)]||'svolta'}</span></div></div></div>`}
          // Sulle sedute SVOLTE il "carico" era dedotto dal nome che hai dato tu alla corsa: si mostra
          // invece cosa è stata davvero (la classificazione che l'app calcola dai dati della corsa).
          const badge=s.done&&s.rcls?(DCL[s.rcls]||'svolta'):`carico ${LOADL[L]}`;
          const canSkip=!w.hist&&w.w!==nAll&&!s.done&&!isRaceFinal;
          return `<div class="sess${isr?' race':''}${s.done?' done':''}"><span class="daychip">${s.t.slice(0,3)}<br><span style="font-weight:400;font-size:9px">${sd.getDate()} ${MESI[sd.getMonth()]}</span></span><div class="sbody"><span class="sn">${isRaceFinal?'🏁 ':''}${s.done?'✔ ':''}${s.n}</span> <span class="sd">${s.done?s.d:hrTag(s.d)}</span>${s.done?'':sessBar(s.d)}<div class="smeta">${s.done?'':'≈'}${s.km} km · <span class="ldb l${L}">${badge}</span></div></div>${canSkip?`<span class="sbtns"><button class="fxbtn" title="Cambia seduta: modifica, sposta, alleggerisci, sostituisci" onclick="fxOpen('${wkKey}',${si})">⋯</button><button class="skipx" title="Togli questa seduta dalla settimana" onclick="wkSkipAdd('${wkKey}',${si})">✕</button></span>`:''}</div>`;
        }).join('')}
        ${(!w.hist&&w.w!==nAll&&iso(sunW)>=todayS)?`<p class="fxrow"><button onclick="fxAdd('${wkKey}')">＋ Aggiungi seduta</button>${w.flex?`<button onclick="fxReset('${wkKey}')">↺ Ripristina la settimana del piano</button>`:''}</p>`:''}
        ${(!w.hist&&w.w!==nAll&&(wkSkips()[wkKey]||[]).length)?`<p class="skiprow"><span>Tolte a mano:</span>${(wkSkips()[wkKey]||[]).map((k,ki)=>`<button onclick="wkSkipDel('${wkKey}',${ki})" title="Rimetti questa seduta">↺ ${k.split('|')[1]} (${k.split('|')[0].slice(0,3).toLowerCase()})</button>`).join('')}</p>`:''}
      </div>`);
    }).join('')+`</div>`;
  try{groupPast()}catch(e){console.warn(e)}
}
/* ---------- progressione vs piano ---------- */
function rTrack(){
  const el=document.getElementById('p-track');
  const pl=applyWkEdits(LS('rp_plan'));
  if(!pl){el.innerHTML='<p class="muted">Genera un piano: da qui traccio settimana per settimana come lo stai seguendo.</p>';return}
  const addD=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const race=new Date(pl.dateStr+'T12:00:00');
  const refSun=addD(race,(7-race.getDay())%7);
  const n=pl.weeks.length;
  const todayS=iso(new Date());
  const QUAL=['Interval','Ripetute','Cruise','Criss','Richiami','Fartlek','Medio','Progressivo','Ritmo'];
  const rows=[];let sumP=0,sumA=0,okW=0,tot=0;
  pl.weeks.forEach(w=>{
    const sun=addD(refSun,-(n-w.w)*7),mon=addD(sun,-6);
    const sMon=iso(mon),sSun=iso(sun);
    if(sMon>todayS)return;
    const cur=sSun>=todayS;
    const rr=runs.filter(r=>{const d=r.date.slice(0,10);return d>=sMon&&d<=sSun});
    const aKm=rr.reduce((a,r)=>a+vk(r),0),pKm=w.vol;
    const qPlan=w.sess.filter(s=>QUAL.some(q=>s.n.startsWith(q))).length;
    const qDone=rr.filter(r=>['int','qual','race'].includes(cls(r))).length;
    const lPlan=w.sess.some(s=>s.n.startsWith('Lungo')||s.n.startsWith('Simulazione')||s.n.startsWith('Big workout')||s.n.startsWith('GARA'));
    const lDone=rr.some(r=>['long','race'].includes(cls(r))||r.km>=Math.max(12,pKm*0.3));
    const pct=pKm?Math.round(aKm/pKm*100):0;
    if(!cur){sumP+=pKm;sumA+=aKm;tot++;if(pct>=85&&qDone>=qPlan&&(!lPlan||lDone))okW++}
    const icon=cur?'⏳':pct>=85&&qDone>=qPlan&&(!lPlan||lDone)?'✅':pct>=60?'🟡':'🔴';
    rows.push(`<tr><td>${icon} S${w.w}${w.summer?'☀️':''}<br><span class="muted">${sMon.slice(5)}→${sSun.slice(5)}</span></td>
      <td class="r">${aKm.toFixed(0)}/${pKm} km<br><span class="muted">${pct}%</span></td>
      <td class="r">${rr.length}/${w.sess.length}</td>
      <td class="r">${qDone}/${qPlan}${lPlan?`<br><span class="muted">lungo ${lDone?'✓':'—'}</span>`:''}</td></tr>`);
  });
  const rbtn=`<p class="muted" style="margin-top:8px">Per ricalibrare il piano sui dati reali (VDOT e volume attuali) vai al <b>Monitor</b> → <b>Rigenera il piano dal reale (.ics + .fit)</b>: aggiorna le settimane future e riesporta il calendario in un colpo solo.</p>`;
  if(!rows.length){el.innerHTML=`<p class="muted">Il piano parte lunedì ${iso(addD(refSun,-(n-1)*7-6)).slice(5)}: qui vedrai km fatti vs pianificati, sedute di qualità e lunghi completati, settimana per settimana.</p>`+rbtn;return}
  const head=tot?`<p style="margin-bottom:8px">Aderenza: <b class="pace">${Math.round(sumA/Math.max(1,sumP)*100)}%</b> dei km pianificati · <b>${okW}/${tot}</b> settimane complete a target</p>`:'';
  el.innerHTML=head+`<table><tr><th>Sett.</th><th class="r">Volume</th><th class="r">Corse</th><th class="r">Qualità</th></tr>${rows.slice(-10).join('')}</table>`
    +(rows.length>10?`<p class="muted" style="margin-top:6px">Mostrate le ultime 10 di ${rows.length} settimane trascorse.</p>`:'')
    +rbtn;
}
// Ripopola dal piano salvato i campi che una rigenerazione perderebbe: gare intermedie e opzioni.
// I campi del form sono vuoti dopo un ricaricamento della pagina, e il generatore legge da lì: senza
// questo passaggio le tune-up sparirebbero dal piano rigenerato (niente mini-scarico, gara, recupero).
function restorePlanOptions(pl){
  const fut=((pl&&pl.interRaces)||[])
    .filter(r=>r&&r.dist>0&&r.date&&new Date(r.date+'T12:00:00')>Date.now())   // le tune-up già corse non servono più
    .sort((a,b)=>a.date<b.date?-1:1).slice(0,2);
  [['p-r1-dist','p-r1-date'],['p-r2-dist','p-r2-date']].forEach(([d,t],i)=>{
    const ed=document.getElementById(d),et=document.getElementById(t);
    if(!ed||!et)return;
    ed.value=fut[i]?String(fut[i].dist):'';
    et.value=fut[i]?fut[i].date:'';
  });
  const cb=document.getElementById('p-mara-extra');if(cb)cb.checked=!!(pl&&pl.maraExtraEasy);
  return fut;
}
// settimane già concluse di un piano (ancorate alla domenica della settimana di gara)
function pastWeeks(pl){
  if(!pl||!pl.weeks)return [];
  const addD=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const race=new Date(pl.dateStr+'T12:00:00'),refSun=addD(race,(7-race.getDay())%7);
  const N=pl.weeks.length,todayS=iso(new Date());
  return pl.weeks.filter(w=>iso(addD(refSun,-(N-w.w)*7))<todayS);
}
// A che punto della fase specifica eravamo. Senza questo una rigenerazione farebbe ripartire i lunghi da
// zero (primo lungo facile, pochi minuti a ritmo gara, rampa km da 22) anche a poche settimane dalla gara.
function progressCarry(weeks){
  const QS=/^(Lungo progressivo|Lungo a blocchi RM|Lungo fast finish|Lungo a ritmo gara continuo|Lungo sopra\/sotto RM|Lungo alternato|Lungo con finale|Big workout|Simulazione gara)/;
  const spec=(weeks||[]).filter(w=>w.phase==='spec');
  const longs=spec.map(w=>(w.sess||[]).find(s=>s.t==='Domenica'&&/^(Lungo|Big workout|Simulazione)/.test(s.n||''))).filter(Boolean);
  const real=longs.filter(s=>!/ridotto|corto/.test(s.n));   // esclude i lunghi delle settimane di scarico
  return {wOff:spec.length,lDone:real.length,qDone:real.filter(s=>QS.test(s.n)).length,
          startTot:real.length?Math.max(...real.map(s=>+s.km||0)):0};
}
function updatePlan(){
  const old=LS('rp_plan');if(!old)return alert('Genera prima un piano');
  const vd=curVdot();
  document.getElementById('p-goal').value=old.goal;
  document.getElementById('p-date').value=old.dateStr;
  document.getElementById('p-days').value=old.days;
  restorePlanOptions(old);   // gare intermedie + "+1 easy": senza questo la rigenerazione le perde
  document.getElementById('p-mode').value=old.modeVal||({Conservativo:'cons',Moderato:'mod',Ambizioso:'amb','Molto ambizioso':'amb'})[old.mode]||'mod';
  document.getElementById('p-target').value=old.target||'';
  document.getElementById('p-vdot').value=vd?vd.toFixed(1):old.vd;
  const wk=weeklyKm().slice(-4).map(([,v])=>v);
  document.getElementById('p-base').value=Math.max(15,Math.round(wk.reduce((a,b)=>a+b,0)/Math.max(1,wk.length)));
  // conserva le settimane già concluse del vecchio piano
  const addD=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const race=new Date(old.dateStr+'T12:00:00');
  const refSun=addD(race,(7-race.getDay())%7);
  const N=old.weeks.length,todayS=iso(new Date());
  const hist=old.weeks.filter(w=>iso(addD(refSun,-(N-w.w)*7))<todayS).map(h=>({...h,hist:1}));
  const np=genPlan(true,progressCarry(hist));if(!np)return;
  np.weeks=[...hist,...np.weeks];
  np.weeks.forEach((w,i)=>w.w=i+1);
  LS('rp_plan',np);monSyncFuture();rPlan(np);rTrack();rToday();
  logRecal('repace');rMonitor();   // il box "Quando ricalibrare" riparte a contare da oggi
  alert(`Piano ricalibrato: VDOT ${np.vd}, volume di partenza ${document.getElementById('p-base').value} km (dai tuoi dati reali).${old.target?` Obiettivo mantenuto: ${old.target} (${np.mode}).`:` Modalità: ${np.mode}.`} ${np.weeks.length-hist.length} settimane rimanenti aggiornate, ${hist.length} passate conservate. Riesporta il .ics: contiene solo le settimane future.`);
}
function exportICS(silent){
  // Il piano va letto CON gli override manuali applicati: leggendo `rp_plan` grezzo il calendario
  // ignorava scarichi, gare al volo e settimane riscritte sul reale — l'app mostrava «Gara 10k» la
  // domenica e l'.ics esportava il «Lungo» del piano originale. Vale anche per l'.ics che scarica
  // "Rigenera il piano dal reale": è la stessa funzione.
  const pl=applyWkEdits(LS('rp_plan'));if(!pl)return alert('Genera prima un piano');
  const race=new Date(pl.dateStr+'T00:00:00');
  const OFF={'Lunedì':-6,'Martedì':-5,'Mercoledì':-4,'Giovedì':-3,'Venerdì':-2,'Sabato':-1,'Domenica':0};
  const pad=x=>String(x).padStart(2,'0');
  const ymd=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  const parseY=y=>new Date(+y.slice(0,4),+y.slice(4,6)-1,+y.slice(6,8));
  const esc=s=>s.replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const n=pl.weeks.length;
  const addD=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x}; // sicuro con ora legale
  // ancora alla vera domenica della settimana di gara (la gara può essere di sabato)
  const refSun=addD(race,(7-race.getDay())%7);
  const stamp=ymd(new Date())+'T000000Z',todayY=ymd(new Date());
  // stato di sync incrementale per questa gara: UID per data + SEQUENCE + cancellazioni
  let sync=LS('rp_ics');if(!sync||sync.key!==pl.dateStr)sync={key:pl.dateStr,seq:0,events:[]};
  const seq=(sync.seq||0)+1;
  const PHN={base:'Base',speed:'Velocità',ispec:'Intermedio',spec:'Specifico',taper:'Taper'};
  const QUALN=['Interval','Ripetute','Cruise','Criss','Richiami'];
  let ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RunPlan//IT\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Allenamenti corsa\r\n';
  const curr=[],slotUsed={};
  pl.weeks.forEach(w=>{
    if(w.hist)return; // niente eventi per le settimane già passate
    const sun=addD(refSun,-(n-w.w)*7);
    w.sess.forEach(s=>{
      const d=s.n.startsWith('GARA')?race:addD(sun,OFF[s.t]??0);
      const dy=ymd(d),d1=ymd(addD(d,1));
      if(dy<todayY)return; // giorni già trascorsi: l'evento in calendario resta com'era (storico, non si riscrive)
      const slot=slotUsed[dy]||0;slotUsed[dy]=slot+1;          // UID stabile ancorato alla DATA (aggiorna sul posto, niente doppioni)
      const uid=`runplan-${dy}${slot?'-'+slot:''}@runplan`;
      curr.push({uid,ymd:dy});
      let desc=`Fase: ${PHN[w.phase]||''}${w.summer?' ☀️ estate':''} — settimana ${w.w}${w.isDeload?' (scarico)':''}`;
      if(QUALN.some(q=>s.n.startsWith(q)))
        desc+=`\nRiscaldamento: 15-20' easy progressivo @ ${pl.E||''} + 4-5 allunghi 80m`
             +`\nLavoro: ${s.d}`
             +`\nDefaticamento: 10' easy @ ${pl.E||''}`;
      else desc+=`\nSeduta: ${s.d}`;
      desc+=`\nTotale ≈${s.km} km · tolleranza passi ±3s`;
      ics+='BEGIN:VEVENT\r\nUID:'+uid+'\r\nSEQUENCE:'+seq+'\r\nDTSTAMP:'+stamp+'\r\n'
        +'DTSTART;VALUE=DATE:'+dy+'\r\nDTEND;VALUE=DATE:'+d1+'\r\n'
        +'SUMMARY:'+esc(`🏃 ${s.n}${s.n.startsWith('GARA')?'':` ≈${s.km}km`} (sett. ${w.w}${w.summer?' ☀️':''})`)+'\r\n'
        +'DESCRIPTION:'+esc(desc).replace(/\n/g,'\\n')+'\r\n'
        +'BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Allenamento\r\nTRIGGER:-PT12H\r\nEND:VALARM\r\n'
        +'END:VEVENT\r\n';
    });
  });
  // cancella dal calendario le sedute FUTURE già esportate e ora non più previste (il passato resta come storico)
  const currSet=new Set(curr.map(e=>e.uid));let cancelled=0;
  (sync.events||[]).forEach(e=>{
    if(currSet.has(e.uid)||e.ymd<todayY)return;
    cancelled++;
    ics+='BEGIN:VEVENT\r\nUID:'+e.uid+'\r\nSEQUENCE:'+seq+'\r\nDTSTAMP:'+stamp+'\r\n'
      +'DTSTART;VALUE=DATE:'+e.ymd+'\r\nDTEND;VALUE=DATE:'+ymd(addD(parseY(e.ymd),1))+'\r\n'
      +'STATUS:CANCELLED\r\nSUMMARY:Allenamento annullato\r\nEND:VEVENT\r\n';
  });
  ics+='END:VCALENDAR\r\n';
  LS('rp_ics',{key:pl.dateStr,seq,events:curr});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));
  a.download='piano-allenamento.ics';a.click();
  if(!silent)alert(`.ics pronto: ${curr.length} sedute${cancelled?` · ${cancelled} rimosse`:''}. Importalo nel calendario dedicato "Allenamenti corsa": gli eventi con la stessa data si aggiornano sul posto (niente doppioni) e le sedute non più previste vengono tolte in automatico.`);
  return ics;
}
function copyPlan(){
  const pl=applyWkEdits(LS('rp_plan'));if(!pl)return;   // come l'.ics: senza override si copia il piano pre-modifiche
  const PH={base:'base',speed:'velocità',ispec:'specifico gara intermedia',spec:'specifico',taper:'taper'};
  let md=`# Piano ${pl.dateStr} — VDOT ${pl.vd}\nObiettivo: ${pl.GT} (${pl.GP}/km)\n\n`;
  pl.weeks.forEach(w=>{md+=`## Settimana ${w.w} — ${PH[w.phase]||''} (~${w.vol} km)${w.isDeload?' — scarico':''}\n`;
    w.sess.forEach(s=>md+=`- **${s.t}** ${s.n}: ${s.d} (≈${s.km} km)\n`);md+='\n'});
  navigator.clipboard.writeText(md).then(()=>alert('Piano copiato'));
}

/* ---------- monitoraggio piano (da .ics) ---------- */
const toSec=p=>{const m=(''+p).split(':');return +m[0]*60+ +m[1]};
const PHKEY={base:'base',velocità:'speed',velocita:'speed',intermedio:'ispec',specifico:'spec',taper:'taper'};
const PHN={base:'Base',speed:'Velocità',ispec:'Intermedio',spec:'Specifico',taper:'Taper'};
/* CARICO della seduta — 1 base · 2 intermedio · 3 alto · 4 molto alto.
   Le sedute che lo dichiarano (i lunghi della fase specifica, che conoscono la propria struttura)
   vincono; per tutte le altre si deduce dal nome. Serve a leggere a colpo d'occhio quanto costa
   una settimana, non solo quanti km vale. */
const LOADL=['','base','intermedio','alto','molto alto'];
function sLoad(s){
  if(s&&s.load)return s.load;
  const nm=(s&&s.n)||'',n=nm.toLowerCase();
  if((s&&s.race)||nm.includes('🏁'))return 4;
  if(/simulazione|big workout|sopra\/sotto/.test(n))return 4;
  if(/interval|ripetute|cruise|criss|richiami|blocchi rm|gara continuo|alternato/.test(n))return 3;
  if(/fast finish|con finale|medio|progressiv|fartlek|ritmo m|ritmo gara/.test(n))return 2;
  if(/^lungo/.test(n))return 1;   // il lungo facile è carico base: costruisce, non svuota
  return 1;
}
// una seduta è una GARA solo se il nome porta la bandierina (o inizia per "gara", per gli .ics vecchi):
// "Pre-gara", "Simulazione gara" e "Ritmo gara" sono allenamenti, non gare, e vanno classificati come tali.
function isRaceName(name){const s=(name||'').trim();return s.includes('🏁')||/^gara\b/i.test(s)}
// SISTEMA allenato da una seduta PRESCRITTA. Definizione unica: ce n'erano tre copie dentro
// applyWkEdits e una aveva già preso una strada sua.
// Gli ALLUNGHI non sono ripetute: «9×20"» e «~100m» nella descrizione di «Easy + allunghi» facevano
// scattare l'euristica numerica delle ripetute, quindi un easy veniva classificato vo2 — finiva fra le
// qualità della settimana, veniva "tolto per non affollare" e alla settimana riscritta sul reale non
// restava nessuna seduta facile da spostare, così ne inventava una generica.
function sysOfSess(s){
  const t=(((s&&s.n)||'')+' '+((s&&s.d)||'')).toLowerCase();
  if(/lungo|long|simulazione|big workout/.test(t))return 'endurance';
  if(/cruise|soglia|medio|progress|criss|ritmo|tempo run|fartlek/.test(t))return 'threshold';
  if(/interval|ripetut|richiami/.test(t))return 'vo2';        // ripetute dichiarate nel nome
  if(/allungh|strides/.test(t))return 'easy';                 // easy + allunghi resta easy
  if(/[0-9]+\s*[×x]\s*[0-9]|[0-9]{3}\s*m/.test(t))return 'vo2'; // ripetute riconosciute dalla struttura
  return 'easy';
}
function planCls(name){ // classifica la seduta pianificata dal suo nome
  const n=(name||'').toLowerCase();
  if(isRaceName(name))return 'race';
  if(/^progressivo/.test(n))return 'qual';   // "Progressivo lungo" è la qualità del giovedì, non un lungo
  if(/lungo|simulazione|big workout/.test(n))return 'long';
  if(/interval|ripetut|richiami/.test(n))return 'int';
  if(/cruise|criss|fartlek|medio|progressiv|ritmo|soglia|tempo/.test(n))return 'qual';
  return 'easy'; // base, easy, z2, scarico, allunghi
}
function parseICS(text){
  text=text.replace(/\r\n/g,'\n').replace(/\n[ \t]/g,''); // unfold righe piegate
  const un=s=>s.replace(/\\n/g,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\');
  const blocks=text.split('BEGIN:VEVENT').slice(1);
  const sessions=[];
  blocks.forEach(b=>{
    const g=re=>{const m=b.match(re);return m?un(m[1]).trim():''};
    const ds=(b.match(/DTSTART[^:\n]*:(\d{8})/)||[])[1];
    if(!ds)return;
    const date=`${ds.slice(0,4)}-${ds.slice(4,6)}-${ds.slice(6,8)}`;
    const summary=g(/SUMMARY:(.*)/);
    const desc=g(/DESCRIPTION:(.*)/);
    const week=+(summary.match(/sett\.\s*(\d+)/)||[])[1]||+(desc.match(/settimana\s*(\d+)/)||[])[1]||null;
    let name=summary.replace(/^[^A-Za-zÀ-ÿ]*/,'').replace(/\s*≈[\d.]+\s*km/i,'').replace(/\s*\(sett\.[^)]*\)/i,'').trim();
    if(!name)return;
    let km=(desc.match(/Totale\s*≈?\s*([\d.]+)\s*km/i)||[])[1];
    if(!km)km=(summary.match(/≈([\d.]+)\s*km/i)||[])[1];
    km=km?+km:null;
    const phRaw=(desc.match(/Fase:\s*([A-Za-zÀ-ÿ]+)/i)||[])[1]||'';
    const phase=PHKEY[phRaw.toLowerCase()]||'base';
    const work=(desc.match(/(?:Lavoro|Seduta):\s*([^\n]*)/i)||[])[1]||'';
    const paces=(work.match(/\d:\d\d/g)||[]);
    const summer=/estate|☀/.test(summary+desc);
    const deload=/scarico/i.test(desc)||/scarico/i.test(name);
    sessions.push({date,week,name,cls:planCls(name),km,phase,work,paces,summer,deload});
  });
  sessions.sort((a,b)=>a.date<b.date?-1:1);
  return sessions;
}
document.getElementById('mon-ics').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const sessions=parseICS(rd.result);
      if(!sessions.length)throw new Error('nessuna seduta riconosciuta (serve l’.ics esportato dal tab Piano)');
      monitor={name:f.name,importedAt:new Date().toISOString(),syncedAt:new Date().toISOString(),sessions,vdot0:curVdot()||null};
      LS('rp_monitor',monitor);rMonitor();
      const races=sessions.filter(s=>s.cls==='race');
      alert(`Piano caricato: ${sessions.length} sedute in ${new Set(sessions.map(s=>s.week)).size} settimane${races.length?` · gara ${races[0].date}`:''}.`);
    }catch(err){alert('Errore .ics: '+err.message)}
  };rd.readAsText(f);
  e.target.value='';
});
document.getElementById('mon-fromplan').addEventListener('click',()=>{
  const pl=LS('rp_plan');
  if(!pl)return alert('Genera prima un piano nel tab Piano.');
  const fut=planToSessions(pl); // applica già scarichi/gare messi a mano
  if(!fut.length)return alert('Il piano non contiene sedute future da monitorare.');
  // IL PASSATO NON SI BUTTA. `planToSessions` salta le settimane già concluse (`hist`), quindi
  // prendendo solo il suo output il Monitor perdeva tutto lo storico: bastava aggiungere una gara al
  // volo per veder sparire i mesi già corsi. Il passato si ricompone da due fonti, in quest'ordine:
  //  1. le sedute che il Monitor ha già (registro vero, arrivato dall'.ics o da rigenerazioni);
  //  2. le settimane `hist` del piano, per i giorni che al Monitor mancano.
  const todayS=todayISO();
  const seen=new Set(fut.map(s=>s.date)); // una sola seduta per data, come nella rigenerazione
  const past=[];
  const take=s=>{if(s.date<todayS&&!seen.has(s.date)){seen.add(s.date);past.push(s)}};
  ((monitor&&monitor.sessions)||[]).forEach(take);
  planToSessions(pl,true).forEach(take);
  const merged=[...past,...fut].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  // numerazione per settimana di calendario: il passato recuperato entra davanti e le settimane
  // future scalano di conseguenza, senza buchi né doppioni di numero
  const wkKeys=[...new Set(merged.map(s=>weekKey(s.date)))].sort();
  const wkNum={};wkKeys.forEach((k,i)=>wkNum[k]=i+1);
  merged.forEach(s=>s.week=wkNum[weekKey(s.date)]);
  const prevRuns=(monitor&&monitor.runs)||[]; // conserva le corse selezionate manualmente
  const prevRecal=(monitor&&monitor.recal)||[]; // e il registro delle ricalibrazioni: è lo stesso piano
  const prevVd0=(monitor&&monitor.vdot0)||curVdot()||null;
  monitor={name:'Piano corrente',importedAt:new Date().toISOString(),syncedAt:new Date().toISOString(),sessions:merged,vdot0:prevVd0,runs:prevRuns,recal:prevRecal};
  LS('rp_monitor',monitor);rMonitor();
  const races=merged.filter(s=>s.cls==='race');
  alert(`Monitor aggiornato dal piano: ${merged.length} sedute in ${wkKeys.length} settimane${past.length?`, di cui ${past.length} già svolte conservate`:''}${races.length?` · ${races.length} gara/e`:''}.`);
});
document.getElementById('mon-clear').addEventListener('click',()=>{
  if(!monitor)return;
  if(!confirm('Rimuovere il piano monitorato? Le corse restano in archivio.'))return;
  monitor=null;localStorage.removeItem('rp_monitor');pushCloud();rMonitor();
});
document.getElementById('mon-addrun').addEventListener('click',()=>{
  if(!monitor)return alert('Carica prima un piano .ics');
  const v=document.getElementById('mon-runsel').value;if(!v)return;
  monitor.runs=monitor.runs||[];
  if(!monitor.runs.includes(v))monitor.runs.push(v);
  LS('rp_monitor',monitor);rMonitor();
});
function monRemoveRun(k){
  if(!monitor)return;
  monitor.runs=(monitor.runs||[]).filter(x=>x!==k);
  LS('rp_monitor',monitor);rMonitor();
}
/* ---------- Piano → Monitor automatico (da OGGI in avanti) ----------
   "Oggi", la striscia a pallini, gli avvisi e il Monitor leggono il calendario da monitor.sessions
   (todaySessions). Prima una gara al volo, uno scarico, una seduta tolta o un piano rigenerato con una
   gara intermedia cambiavano solo il tab Piano: il resto dell'app restava sul vecchio calendario finché
   non premevi "↺ Aggiorna dal piano corrente". Ora ogni modifica fatta nel Piano si propaga da sola.
   Regole (le stesse di monRecalibrate): il PASSATO del Monitor è il registro e non si tocca; da oggi in
   avanti comanda il piano; le sedute "svolte" delle settimane riscritte sul reale entrano con la loro
   data vera, e in quelle settimane le prescrizioni non corse decadono.
   Il confine è il LUNEDÌ della settimana in corso, non oggi: se a metà settimana ci metti una gara,
   cambia tutta la settimana (anche il martedì già passato), come fa "↺ Aggiorna dal piano corrente".
   Altrimenti il martedì resterebbe la vecchia seduta e la corsa fatta risulterebbe di tipo diverso. */
function monSyncFuture(){
  if(!monitor||!monitor.sessions||!monitor.sessions.length)return false;
  const pl=LS('rp_plan');if(!pl||!pl.weeks)return false;
  const curMon=weekKey(todayISO());
  const gen=planToSessions(pl,true);
  const doneDates=new Set(gen.filter(s=>s.done).map(s=>s.date));
  const realWeeks=new Set(Object.entries(wkEdits()).filter(([,v])=>String(v).split('+').includes('real')).map(([sun])=>weekKey(sun)));
  const runDates=new Set(runs.map(r=>r.date.slice(0,10)));
  const seen=new Set();
  const past=monitor.sessions.filter(s=>{
    if(s.date>=curMon||doneDates.has(s.date)||seen.has(s.date))return false;
    if(realWeeks.has(weekKey(s.date))&&!runDates.has(s.date))return false;
    seen.add(s.date);return true;
  });
  const fut=gen.filter(s=>s.date>=curMon||s.done);
  const merged=[...past,...fut].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  const wkKeys=[...new Set(merged.map(s=>weekKey(s.date)))].sort();
  const wkNum={};wkKeys.forEach((k,i)=>wkNum[k]=i+1);
  merged.forEach(s=>s.week=wkNum[weekKey(s.date)]);
  monitor.sessions=merged;
  monitor.syncedAt=new Date().toISOString();
  LS('rp_monitor',monitor);
  if(typeof rMonitor==='function')rMonitor();
  return true;
}
// converte un piano rp_plan in sedute stile .ics. Di norma solo le settimane future: con withHist=true
// restituisce anche quelle già concluse (`hist`), che servono a ricostruire lo storico del Monitor.
function planToSessions(pl,withHist){
  pl=applyWkEdits(pl);
  const addD=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x};
  const isoL=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const OFF={'Lunedì':-6,'Martedì':-5,'Mercoledì':-4,'Giovedì':-3,'Venerdì':-2,'Sabato':-1,'Domenica':0};
  const race=new Date(pl.dateStr+'T12:00:00');
  const refSun=addD(race,(7-race.getDay())%7);
  const n=pl.weeks.length;const out=[];
  pl.weeks.forEach(w=>{if(w.hist&&!withHist)return;
    const sun=addD(refSun,-(n-w.w)*7);
    w.sess.forEach(s=>{
      const isr=s.n.startsWith('GARA'); // solo la gara finale usa la data gara; le gare al volo restano nel loro giorno
      const d=isr?race:addD(sun,OFF[s.t]??0);
      // le sedute già svolte (settimana riscritta sul reale) portano la loro data e classificazione vera
      out.push({date:s.done&&s.realDate?s.realDate:isoL(d),week:w.w,name:s.n,cls:s.done&&s.rcls?s.rcls:planCls(s.n),km:s.km,phase:w.phase,work:s.d,paces:(s.d.match(/\d:\d\d/g)||[]),summer:!!w.summer,deload:!!w.isDeload,done:!!s.done});
    });
  });
  return out;
}
// ricalibrazione leggera: stessa gara e stesso calendario, cambiano solo i contenuti delle sedute
document.getElementById('mon-repace').addEventListener('click',updatePlan);
document.getElementById('mon-recal').addEventListener('click',monRecalibrate);
function monRecalibrate(){
  if(!monitor||!monitor.sessions.length)return alert('Carica prima un piano .ics nel Monitor.');
  // gara e distanza dall'.ics: conta la gara OBIETTIVO, cioè l'ultima in ordine di data — non la prima,
  // che può essere una tune-up già corsa. Il filtro è sul nome perché gli .ics già caricati possono
  // portarsi dietro la vecchia classificazione (che marcava come gara anche "Pre-gara"/"Simulazione gara").
  const racesIcs=monitor.sessions.filter(s=>isRaceName(s.name)).sort((a,b)=>a.date<b.date?-1:1);
  const raceS=racesIcs.length?racesIcs[racesIcs.length-1]:null;
  let dateStr,goalKm;
  if(raceS){dateStr=raceS.date;goalKm=raceS.km||42.195}
  else{
    const last=monitor.sessions[monitor.sessions.length-1];
    const mon=day(weekKey(last.date));const sun=new Date(mon);sun.setDate(mon.getDate()+6);
    dateStr=`${sun.getFullYear()}-${String(sun.getMonth()+1).padStart(2,'0')}-${String(sun.getDate()).padStart(2,'0')}`;
    goalKm=Math.max(...monitor.sessions.map(s=>s.km||0));
  }
  const goals=[5,10,21.0975,42.195];
  const goal=goals.reduce((a,b)=>Math.abs(b-goalKm)<Math.abs(a-goalKm)?b:a);
  const wtorace=Math.round((new Date(dateStr+'T12:00:00')-Date.now())/(7*864e5));
  if(wtorace<6){
    const dLoc=new Date(dateStr+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'});
    const pl=LS('rp_plan');
    const hint=(pl&&pl.dateStr&&pl.dateStr!==dateStr)
      ? `\n\nIl piano che hai in memoria punta invece al ${new Date(pl.dateStr+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}: se è quella la gara giusta, aggiorna il Monitor con "Aggiorna dal piano" (o ricarica l'.ics aggiornato) e riprova.`
      : '';
    return alert(wtorace<0
      ? `La gara letta dal piano monitorato (${dLoc}) è già passata: il Monitor sta seguendo un piano vecchio.${hint}`
      : `Alla gara del ${dLoc} mancano ~${wtorace} settimane: troppo poche per rigenerare un blocco sensato (minimo 6). La ricalibrazione va fatta prima, non a ridosso della gara.${hint}`);
  }
  // giorni/settimana: mediana delle sedute per settimana nell'.ics
  const perWk={};monitor.sessions.forEach(s=>{const k=s.week!=null?'w'+s.week:weekKey(s.date);perWk[k]=(perWk[k]||0)+1});
  const counts=Object.values(perWk).sort((a,b)=>a-b);
  let days=counts.length?counts[Math.floor(counts.length/2)]:4;
  days=Math.max(3,Math.min(5,days));
  // imposta il generatore con gara dall'.ics + forma reale dai .fit
  document.getElementById('p-goal').value=goal;
  document.getElementById('p-date').value=dateStr;
  document.getElementById('p-days').value=days;
  const prev=LS('rp_plan');
  const vd=curVdot();
  // se i dati recenti non bastano a stimare il VDOT, si riparte da quello del piano in corso
  document.getElementById('p-vdot').value=vd?vd.toFixed(1):(prev&&prev.vd?String(prev.vd):'');
  const wkv=weeklyKm().slice(-4).map(([,v])=>v);
  const baseVol=Math.max(15,Math.round(wkv.reduce((a,b)=>a+b,0)/Math.max(1,wkv.length)));
  document.getElementById('p-base').value=baseVol;
  document.getElementById('p-mode').value=prev?(prev.modeVal||({Conservativo:'cons',Moderato:'mod',Ambizioso:'amb','Molto ambizioso':'amb'})[prev.mode]||'mod'):'mod';
  document.getElementById('p-target').value=(prev&&+prev.goal===goal&&prev.target)?prev.target:'';
  // stessa gara del piano in memoria → conserva gare intermedie, opzioni e la griglia del piano
  const same=!!(prev&&prev.dateStr===dateStr&&prev.weeks&&prev.weeks.length>=6);
  const keptRaces=same?restorePlanOptions(prev):restorePlanOptions(null);
  // IN PLACE: stesso numero di settimane del piano in corso → fasi, scarichi e diamante restano dove
  // sono e si aggiornano solo i contenuti (passi, tipologie, strutture dei lunghi). Se invece il piano
  // in memoria è di un'altra gara si riparte da capo, riprendendo almeno il punto della progressione.
  const np=genPlan(true,same?{nWeeks:prev.weeks.length}:progressCarry(pastWeeks(prev)));
  if(!np)return;
  if(same){ // le settimane già concluse restano quelle vere: la numerazione coincide, si sostituiscono in blocco
    const past=pastWeeks(prev).map(h=>({...h,hist:1}));
    np.weeks=[...past,...np.weeks.slice(past.length)];
    np.weeks.forEach((w,i)=>w.w=i+1);
    LS('rp_plan',np);rPlan(np);rTrack();
  }
  // monitor: passato conservato dall'.ics + futuro rigenerato
  const todayS=todayISO();
  // il passato è quello vero: una sola seduta per data (una rigenerazione precedente può averne lasciate
  // due sullo stesso giorno — si tiene la prima, cioè quella dell'.ics originale già svolta)
  const seenPast=new Set();
  const gen=planToSessions(np);
  // eccezione: le sedute «svolte» delle settimane riscritte sul reale sono nel passato ma vanno tenute,
  // altrimenti la corsa che hai davvero fatto sparisce dal monitor e risulta "extra non a piano"
  const doneDates=new Set(gen.filter(s=>s.done).map(s=>s.date));
  // settimana IN CORSO: i giorni già passati appartengono al piano che stiamo sostituendo. Le sedute
  // che quel piano prevedeva e che non hai corso non sono «saltate», sono prescrizioni decadute:
  // tenerle ti fa misurare contro un piano che non esiste più (es. 5 sedute/sett. quando il nuovo ne
  // prevede 3). Si tolgono solo qui: nelle settimane già chiuse le mancate restano, sono storia vera.
  const curWk=weekKey(todayS);
  const runDates=new Set(((typeof runs!=='undefined'&&runs)||[]).map(r=>r.date.slice(0,10)));
  // ...e lo stesso vale per le settimane che hai esplicitamente riscritto sulle corse svolte
  // («Riscrivi sulle corse svolte» nel Piano): lì la verità l'hai dichiarata tu, quindi le prescrizioni
  // rimaste dal piano precedente sono decadute anche a settimana ormai chiusa. La chiave di wkEdits è
  // la DOMENICA della settimana, weekKey() la riporta al lunedì; il valore può essere combinato (a10+real).
  const realWeeks=new Set(Object.entries(wkEdits()).filter(([,v])=>String(v).includes('real')).map(([sun])=>weekKey(sun)));
  let curDropped=0;
  const past=monitor.sessions.filter(s=>{
    if(s.date>=todayS||seenPast.has(s.date)||doneDates.has(s.date))return false;
    const wk=weekKey(s.date);
    if((wk===curWk||realWeeks.has(wk))&&!runDates.has(s.date)){curDropped++;return false}
    seenPast.add(s.date);return true;
  });
  // la rigenerazione riparte da OGGI: i giorni già trascorsi della settimana in corso NON vengono
  // riscritti, altrimenti la seduta nuova si aggiunge a quella già svolta (doppione sullo stesso giorno)
  const fut=gen.filter(s=>s.date>=todayS||s.done);
  // comparatore stabile: a parità di data l'ordine di inserimento (passato prima) va conservato
  const merged=[...past,...fut].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  const wkKeys=[...new Set(merged.map(s=>weekKey(s.date)))].sort();
  const wkNum={};wkKeys.forEach((k,i)=>wkNum[k]=i+1);
  merged.forEach(s=>s.week=wkNum[weekKey(s.date)]);
  monitor.sessions=merged;
  monitor.syncedAt=new Date().toISOString(); // Monitor e piano escono da qui allineati
  if(!/ricalibrato/.test(monitor.name||''))monitor.name=(monitor.name||'piano')+' (ricalibrato)';
  monitor.vdot0=monitor.vdot0||vd||null;
  LS('rp_monitor',monitor);
  logRecal('recal');rMonitor();   // il box "Quando ricalibrare" riparte a contare da oggi
  exportICS(true); // scarica il nuovo .ics (settimane future)
  const gname=goal>=42?'maratona':goal>=21?'mezza':goal+' km';
  const rTxt=keptRaces.length?`\nGare intermedie conservate: ${keptRaces.map(r=>`${r.dist>=42?'maratona':r.dist>=21?'mezza':r.dist+'k'} il ${r.date}`).join(' · ')}.`:'';
  const gTxt=same?`\nCalendario invariato: stesse settimane, stesse fasi, stessi scarichi — ho aggiornato passi, tipi di seduta e strutture dei lunghi.`
    :`\nPiano ricostruito da capo (il piano in memoria non è di questa gara): le settimane si rinumerano da adesso.`;
  const dTxt=curDropped?`\nDal passato ho tolto ${curDropped} seduta/e che il piano precedente prevedeva e non hai svolto: erano prescrizioni decadute (settimana in corso, o settimana che hai riscritto sulle corse svolte), non contano come saltate. Nelle altre settimane chiuse le mancate restano.`:'';
  alert(`Piano rigenerato dal reale.\nGara: ${gname} il ${dateStr} · VDOT ${np.vd} · volume ${baseVol} km/sett · ${days} corse/sett.${gTxt}${rTxt}${dTxt}\n\nIl Monitor è aggiornato (passato conservato, futuro rigenerato) e ho scaricato il nuovo .ics. Importalo nel calendario dedicato "Allenamenti corsa" (Google Calendar → Impostazioni → Importa): gli eventi con la stessa data si aggiornano sul posto e le sedute non più previste vengono rimosse, senza doppioni.`);
}
/* ---------- Monitor: passi target vs reale ----------
   Il passo MEDIO di una seduta dura non dice niente: dentro ci sono riscaldamento, recuperi e
   defaticamento, che lo rallentano di 40-60"/km. Per qualità e interval si usano quindi i lap di
   lavoro del .fit (tipo 'act'), che sono il ritmo vero delle frazioni; per easy e lunghi, dove la
   corsa è continua, il passo medio della corsa è già il dato giusto. */
function workLapPace(run){
  const lp=lapsDB[run.date];
  if(!lp||!lp.laps)return null;
  const acts=lp.laps.filter(l=>l[4]==='act'&&l[0]>=200);
  if(!acts.length)return null;
  const m=acts.reduce((a,l)=>a+l[0],0),s=acts.reduce((a,l)=>a+l[1],0);
  return m>=800&&s>0?s/(m/1000):null;   // sotto gli 800 m di lavoro il dato è troppo rumoroso
}
function rMonPaces(weeks,todayS){
  const el=document.getElementById('mon-paces');if(!el)return;
  const ORD=['easy','long','qual','int'];
  const LAB={easy:'Easy / Z2',long:'Lungo',qual:'Qualità (T/M)',int:'Interval / ripetute'};
  const G={};ORD.forEach(k=>G[k]={n:0,lo:0,hi:0,real:0,ok:0,dsum:0});
  let noLap=0,noTgt=0;
  weeks.filter(w=>w.started).forEach(w=>{
    w.sess.forEach((s,si)=>{
      const run=w.matches[si];
      if(!run||s.date>todayS||!G[s.cls])return;          // gare escluse: lì il target è il tempo, non il passo
      const t=workTarget(s);
      if(!t){noTgt++;return}
      const cont=s.cls==='easy'||s.cls==='long';
      const real=cont?pace(run):workLapPace(run);
      if(real==null){noLap++;return}
      const g=G[s.cls];
      g.n++;g.lo+=t.lo;g.hi+=t.hi;g.real+=real;
      g.dsum+=real<t.lo?real-t.lo:real>t.hi?real-t.hi:0;   // scarto dal bordo più vicino della fascia
      if(real>=t.lo-3&&real<=t.hi+3)g.ok++;
    });
  });
  const rows=ORD.filter(k=>G[k].n).map(k=>{
    const g=G[k],d=g.dsum/g.n;
    const dTxt=Math.abs(d)<1.5?'<span class="up">in fascia</span>'
      :`<span class="${Math.abs(d)<=5?'':'down'}">${d>0?'+':'−'}${Math.abs(d).toFixed(0)}"</span>`;
    return `<tr><td>${LAB[k]}</td>
      <td class="r pace">${fmtP(g.lo/g.n)}–${fmtP(g.hi/g.n)}</td>
      <td class="r">${fmtP(g.real/g.n)}</td>
      <td class="r">${dTxt}</td>
      <td class="r">${g.ok}/${g.n}</td></tr>`;
  }).join('');
  if(!rows){el.innerHTML='<p class="muted">Ancora nessuna seduta svolta con un passo target confrontabile. Serve almeno una corsa agganciata a una seduta del piano che indichi i ritmi.</p>';return}
  // lettura: gli errori tipici sono easy troppo forti e qualità troppo morbide
  const notes=[];
  const dE=(G.easy.n+G.long.n)?((G.easy.dsum+G.long.dsum)/(G.easy.n+G.long.n)):null;
  const dQ=(G.qual.n+G.int.n)?((G.qual.dsum+G.int.dsum)/(G.qual.n+G.int.n)):null;
  if(dE!=null&&dE<=-5)notes.push(`Le corse facili le stai correndo <b>${Math.abs(dE).toFixed(0)}"/km più forte</b> della fascia easy: è il modo classico per arrivare stanco alle sedute che contano. Rallenta.`);
  else if(dE!=null&&dE>=8)notes.push(`Le corse facili sono <b>${dE.toFixed(0)}"/km più lente</b> della fascia: va bene se sono recuperi veri, ma se capita sempre il volume ti sta costando più del previsto.`);
  if(dQ!=null&&dQ>=5)notes.push(`Le sedute dure girano <b>${dQ.toFixed(0)}"/km sopra il target</b>: o i passi del piano sono ottimistici, o le stai affrontando con troppa fatica addosso. Se si ripete, ricalibra i passi.`);
  else if(dQ!=null&&dQ<=-5)notes.push(`Le sedute dure le chiudi <b>${Math.abs(dQ).toFixed(0)}"/km sotto il target</b>: sei avanti rispetto al VDOT del piano — una ricalibrazione ti darebbe ritmi più aderenti.`);
  if(!notes.length&&(dE!=null||dQ!=null))notes.push('Passi in linea col piano, sia in facile che nelle sedute dure: l’esecuzione sta seguendo l’intenzione.');
  const skip=[];
  if(noLap)skip.push(`${noLap} seduta/e dura/e senza lap nel .fit (non posso isolare il ritmo delle frazioni)`);
  if(noTgt)skip.push(`${noTgt} senza un passo target scritto nella scheda`);
  el.innerHTML=`<table><tr><th>Tipo</th><th class="r">Target</th><th class="r">Reale</th><th class="r">Δ</th><th class="r">In fascia</th></tr>${rows}</table>
    ${notes.map(n=>`<p style="margin:8px 0 0;font-size:12.5px;line-height:1.45">${n}</p>`).join('')}
    <p class="muted" style="margin-top:8px">Easy e lunghi: passo medio della corsa. Qualità e interval: solo i <b>lap di lavoro</b> del .fit, senza riscaldamento e recuperi. Δ = scarto medio dal bordo più vicino della fascia (± 3" di tolleranza).${skip.length?` Escluse: ${skip.join('; ')}.`:''}</p>`;
}
/* ---------- Monitor: distribuzione dell'intensità ----------
   Due letture diverse e vale la pena tenerle separate: i km per TIPO DI SEDUTA (quanto pesa il lavoro
   duro nel piano) e i km davvero corsi A RITMO, ricavati dai lap: dentro una seduta di ripetute la
   maggior parte dei km è riscaldamento e recupero, cioè corsa facile. */
function rMonDist(weeks,todayS){
  const el=document.getElementById('mon-dist');if(!el)return;
  const BK={easy:'fac',long:'fac',qual:'qua',int:'itv',race:'itv'};
  const ORD=['fac','qua','itv'];
  const LAB={fac:'Facile / lungo',qua:'Qualità (T/M)',itv:'Interval, ripetute, gare'};
  const COL={fac:'var(--acc)',qua:'var(--warn,#e0a800)',itv:'var(--red,#d33)'};
  const P={fac:0,qua:0,itv:0},A={fac:0,qua:0,itv:0};
  let hardKm=0,hardWork=0,lapKm=0,lapN=0;
  weeks.filter(w=>w.started).forEach(w=>{
    w.sess.forEach(s=>{if(s.date<=todayS)P[BK[s.cls]||'fac']+=s.km||0});
    w.weekRuns.forEach(r=>{
      const c=cls(r);A[BK[c]||'fac']+=r.km;
      if(c==='int'||c==='qual'||c==='race'){
        hardKm+=r.km;
        const wp=workLapPace(r);
        const lp=lapsDB[r.date],acts=lp&&lp.laps?lp.laps.filter(l=>l[4]==='act'&&l[0]>=200):[];
        if(wp!=null&&acts.length){lapKm+=r.km;lapN++;hardWork+=acts.reduce((a,l)=>a+l[0],0)/1000}
      }
    });
  });
  const tP=ORD.reduce((a,k)=>a+P[k],0),tA=ORD.reduce((a,k)=>a+A[k],0);
  if(!tA)  {el.innerHTML='<p class="muted">Nessuna corsa ancora nelle settimane del piano.</p>';return}
  const pc=(v,t)=>t?Math.round(v/t*100):0;
  const km=v=>v.toFixed(0)+' km';
  const dot=c=>`<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${c};margin-right:6px"></span>`;
  const bar=(segs)=>{const t=segs.reduce((a,s)=>a+s[0],0)||1;
    return `<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin:6px 0 10px">${segs.map(s=>`<div style="width:${s[0]/t*100}%;background:${s[1]}"></div>`).join('')}</div>`};
  // BLOCCO 1 — come sono divisi i km per tipo di seduta. Le percentuali sono su totali diversi
  // (pianificato vs svolto), perciò la riga del totale è necessaria: senza, due colonne con gli stessi
  // km ma percentuali diverse sembrano un errore di calcolo.
  const rows=ORD.map(k=>`<tr><td>${dot(COL[k])}${LAB[k]}</td>
      <td class="r">${pc(P[k],tP)}%<br><span class="muted">${km(P[k])}</span></td>
      <td class="r">${pc(A[k],tA)}%<br><span class="muted">${km(A[k])}</span></td></tr>`).join('')
    +`<tr><td class="muted">Totale</td><td class="r muted">${km(tP)}</td><td class="r muted">${km(tA)}</td></tr>`;
  const blk1=`<p class="muted" style="margin:0 0 2px">Come sono divisi i km <b>per tipo di seduta</b>.</p>
    ${bar(ORD.map(k=>[A[k],COL[k]]))}
    <table><tr><th>Tipo di seduta</th><th class="r">Pianificato</th><th class="r">Svolto</th></tr>${rows}</table>`;
  // BLOCCO 2 — quanti di quei km sono corsi davvero forte. È una domanda diversa dalla prima: dentro
  // una seduta dura riscaldamento, recuperi e defaticamento sono corsa facile a tutti gli effetti.
  let blk2;
  if(lapKm>0){
    const frac=hardWork/lapKm;                       // quota di km a ritmo dentro una seduta dura
    const workTot=hardWork+(hardKm-lapKm)*frac;      // stima sulle sedute dure senza lap
    const insideEasy=hardKm-workTot;                 // km facili nascosti dentro le sedute dure
    const easyTot=tA-workTot;
    const rat=Math.round(easyTot/tA*100);
    const verd=rat>=75?'In linea con l’ordine di grandezza del riferimento.'
      :rat>=62?'Sei sopra il riferimento sul lato duro: coerente con un blocco di sedute corte e intense, la quota facile risale quando rientrano i lunghi.'
      :'Molto più duro del riferimento: gran parte dei km è a ritmo. Regge per blocchi brevi, meno se va avanti per settimane.';
    blk2=`<p class="muted" style="margin:14px 0 2px;padding-top:12px;border-top:1px solid var(--line)">Quanti di quei km sono corsi <b>davvero a ritmo</b>, letti dai lap.</p>
      ${bar([[easyTot,'var(--acc)'],[workTot,'var(--red,#d33)']])}
      <table><tr><th>Intensità reale</th><th class="r">km</th><th class="r">quota</th></tr>
        <tr><td>${dot('var(--acc)')}Corsa facile</td><td class="r">${km(easyTot)}</td><td class="r"><b>${rat}%</b></td></tr>
        <tr><td>${dot('var(--red,#d33)')}A ritmo</td><td class="r">${km(workTot)}</td><td class="r"><b>${100-rat}%</b></td></tr></table>
      <p style="margin:10px 0 0;font-size:12.5px;line-height:1.45">Le sedute dure svolte pesano <b>${km(hardKm)}</b> (qualità + interval qui sopra), ma solo <b>${km(workTot)}</b> sono corsi a ritmo: gli altri <b>${km(insideEasy)}</b> — riscaldamento, recuperi, defaticamento — sono corsa facile e vanno sommati ai ${km(A.fac)} delle sedute facili. Ecco perché si passa da <b>${100-pc(A.fac,tA)}%</b> di sedute dure a <b>${100-rat}%</b> di km duri.</p>
      <p class="muted" style="margin-top:6px">${verd} Il riferimento ~80/20 nasce sul <b>tempo</b> in zona, non sui km: prendilo come ordine di grandezza. Dai lap di ${lapN} sedute${hardKm-lapKm>0.5?`, con i ${km(hardKm-lapKm)} di sedute dure senza lap stimati alla stessa proporzione`:''}.</p>`;
  }else{
    blk2='<p class="muted" style="margin:14px 0 0;padding-top:12px;border-top:1px solid var(--line)">Importa i .fit con i lap per sapere quanti di questi km sono davvero corsi a ritmo: dentro una seduta dura la maggior parte è riscaldamento e recupero.</p>';
  }
  el.innerHTML=blk1+blk2;
}
function rMonitor(){
  const info=document.getElementById('mon-info');
  const ids=['mon-head','mon-weeks','mon-sess','mon-paces','mon-dist'];
  if(!monitor||!monitor.sessions||!monitor.sessions.length){
    info.textContent="Carica l’.ics esportato dal tab Piano (bottone “Esporta .ics”): lo confronto con le tue corse, seduta per seduta.";
    ids.forEach(id=>document.getElementById(id).innerHTML='<p class="muted">Nessun piano caricato.</p>');
    document.getElementById('mon-trend').innerHTML='<p class="muted">—</p>';
    document.getElementById('mon-cum').innerHTML='<p class="muted">—</p>';
    document.getElementById('mon-trend-note').textContent='';
    document.getElementById('mon-runsel').innerHTML='<option value="">— carica prima un piano —</option>';
    document.getElementById('mon-runs').innerHTML='';
    rToday();
    return;
  }
  const S=monitor.sessions;
  info.textContent=`${monitor.name} · ${S.length} sedute · caricato il ${monitor.importedAt.slice(0,10)}. Le corse arrivano dall’archivio (import .FIT/CSV).`;
  const todayS=todayISO();
  const addD=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x};
  const isoOf=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  // corse selezionate manualmente: se presenti, monitoro solo quelle; altrimenti aggancio tutto l'archivio
  monitor.runs=monitor.runs||[];
  const manual=monitor.runs.length>0;
  const pool=manual?runs.filter(r=>monitor.runs.includes(r.date)):runs;
  // menù a tendina: corse già in archivio non ancora selezionate
  const sel=document.getElementById('mon-runsel');
  const addable=runs.filter(r=>!monitor.runs.includes(r.date)).slice().reverse();
  sel.innerHTML='<option value="">— scegli una corsa —</option>'+
    addable.map(r=>`<option value="${r.date}">${r.date.slice(0,10)} · ${r.title} (${r.km.toFixed(1)} km · ${CLSN[cls(r)]})</option>`).join('');
  const runsEl=document.getElementById('mon-runs');
  if(manual){
    runsEl.innerHTML=`<p class="muted" style="margin-bottom:6px">Monitoro solo queste ${monitor.runs.length} corse selezionate:</p>`+
      monitor.runs.map(k=>{const r=runs.find(x=>x.date===k);return `<span class="pill on" style="cursor:default">${r?`${r.date.slice(5,10)} ${r.title}`:k} <b style="cursor:pointer;color:var(--red)" onclick="monRemoveRun('${k}')">✕</b></span>`}).join('');
  }else{
    runsEl.innerHTML='<p class="muted">Nessuna corsa selezionata: aggancio in automatico tutte le corse dell’archivio che cadono nelle settimane del piano. Aggiungine dal menù per monitorare solo quelle scelte.</p>';
  }
  // raggruppa per settimana del piano
  const wmap={};
  S.forEach(s=>{const k=s.week!=null?'w'+s.week:'k'+weekKey(s.date);(wmap[k]=wmap[k]||[]).push(s)});
  const wkeys=Object.keys(wmap).sort((a,b)=>day(wmap[a][0].date)-day(wmap[b][0].date));
  const usedRuns=new Set();
  const weeks=[];
  wkeys.forEach(k=>{
    const sess=wmap[k].slice().sort((a,b)=>day(a.date)-day(b.date));
    const monISO=weekKey(sess[0].date),sunISO=isoOf(addD(day(monISO),6));
    const weekRuns=pool.filter(r=>{const d=runDay(r);return d>=monISO&&d<=sunISO}); // una corsa agganciata a mano vale nella settimana della sua seduta
    // abbinamento globale: valuto TUTTE le coppie (seduta, corsa) della settimana e assegno
    // in ordine di punteggio decrescente. La vicinanza di data pesa più del tipo di seduta,
    // così una corsa fatta di domenica non finisce nello slot del giovedì solo perché
    // il giovedì viene prima nell'ordine di scansione.
    const matches={};
    const pairs=[];
    sess.forEach((s,si)=>{
      const sFut=s.date>todayS;
      weekRuns.forEach(r=>{
        if(usedRuns.has(r.date))return;
        const rd=r.date.slice(0,10),lk=runLink(r);
        if(lk==='none')return;                                                   // dichiarata extra
        if(lk){if(lk===s.date)pairs.push({si,r,score:1000});return}              // agganciata a mano: solo alla sua seduta
        if(sFut&&rd!==s.date)return; // una seduta futura non può essere "svolta" da una corsa passata
        const rc=cls(r);
        const sameCls=rc===s.cls||(s.cls==='easy'&&rc==='long')||(s.cls==='long'&&rc==='easy');
        const dd=Math.min(6,Math.abs(Math.round((day(rd)-day(s.date))/864e5)));
        pairs.push({si,r,score:(6-dd)*10+(sameCls?4:0)+1}); // >=1 sempre: entro la settimana vale come svolta
      });
    });
    pairs.sort((a,b)=>b.score-a.score);
    pairs.forEach(p=>{
      if(matches[p.si]||usedRuns.has(p.r.date))return;
      matches[p.si]=p.r;usedRuns.add(p.r.date);
    });
    const matchedDates=new Set(Object.values(matches).map(r=>r.date));
    const extra=weekRuns.filter(r=>!matchedDates.has(r.date));
    const plannedKm=sess.reduce((a,s)=>a+(s.km||0),0);
    const actualKm=weekRuns.reduce((a,r)=>a+vk(r),0);
    const qPlan=sess.filter(s=>['int','qual','race'].includes(s.cls)).length;
    const qDone=weekRuns.filter(r=>['int','qual','race'].includes(cls(r))).length;
    const lPlan=sess.some(s=>['long','race'].includes(s.cls));
    const lDone=weekRuns.some(r=>['long','race'].includes(cls(r))||r.km>=Math.max(12,plannedKm*0.3));
    const started=monISO<=todayS,inProg=started&&sunISO>=todayS;
    const pct=plannedKm?Math.round(actualKm/plannedKm*100):0;
    const okTarget=pct>=85&&qDone>=qPlan&&(!lPlan||lDone);
    weeks.push({num:sess[0].week,monISO,sunISO,sess,matches,extra,weekRuns,plannedKm,actualKm,qPlan,qDone,lPlan,lDone,started,inProg,pct,okTarget,summer:sess.some(s=>s.summer)});
  });
  const startedW=weeks.filter(w=>w.started);
  const completed=weeks.filter(w=>w.started&&!w.inProg);
  const curW=weeks.find(w=>w.inProg);
  // I tre anelli misurano lo STESSO periodo: le settimane concluse. Contare anche quella in corso
  // falsava l'aderenza km — il lunedì mattina i km previsti della settimana nuova sono già tutti nel
  // denominatore ma nessuno è ancora stato corso, quindi la percentuale crollava per finta e risaliva
  // da sola nei giorni successivi. La settimana in corso ha una riga sua, sotto gli anelli.
  const sumP=completed.reduce((a,w)=>a+w.plannedKm,0),sumA=completed.reduce((a,w)=>a+w.actualKm,0);
  const okW=completed.filter(w=>w.okTarget).length;
  const sessPast=completed.flatMap(w=>w.sess.map((s,si)=>({s,run:w.matches[si],future:s.date>todayS})));
  const doneCount=sessPast.filter(x=>x.run&&!x.future).length;
  const dueCount=sessPast.filter(x=>!x.future).length;
  // Settimana in corso: contata a parte. "In ritardo" solo le sedute con data GIÀ passata — quella di
  // oggi non è saltata, hai ancora la giornata per farla.
  const curPast=curW?curW.sess.filter(s=>s.date<todayS).length:0;
  const curPastDone=curW?curW.sess.filter((s,si)=>s.date<todayS&&curW.matches[si]).length:0;
  const curToday=curW?curW.sess.find(s=>s.date===todayS):null;
  const curNext=curW?curW.sess.find(s=>s.date>todayS):null;
  // header aderenza
  const kmPct=Math.round(sumA/Math.max(1,sumP)*100);
  const wkPct=completed.length?Math.round(okW/completed.length*100):0;
  const sePct=Math.round(doneCount/Math.max(1,dueCount)*100);
  // anelli di progresso (stile activity ring)
  const rcol=p=>p>=85?'var(--acc)':p>=60?'var(--warn)':'var(--red)';
  const ring=(pct,val,lab,sub)=>{const r=26,c=2*Math.PI*r,p=Math.min(100,Math.max(0,pct));
    return `<div style="text-align:center;flex:1;min-width:100px"><svg viewBox="0 0 64 64" width="106" height="106" style="max-width:100%"><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="${rcol(pct)}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c*p/100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="36" text-anchor="middle" style="fill:var(--txt);font-size:12px;font-weight:700">${val}</text></svg><div style="font-size:12px;color:var(--dim);margin-top:2px">${lab}</div><div style="font-size:11px;color:var(--dim)">${sub}</div></div>`};
  const dm=s=>`${+s.slice(8,10)}/${+s.slice(5,7)}`;
  const DNS=['dom','lun','mar','mer','gio','ven','sab'];
  const dlab=s=>`${DNS[day(s).getDay()]} ${dm(s)}`;
  let curTxt='';
  if(curW){
    const late=curPast-curPastDone;
    curTxt=`${curW.actualKm.toFixed(0)}/${curW.plannedKm.toFixed(0)} km`;
    curTxt+=curPast?` · ${curPastDone}/${curPast} sedute svolte dei giorni già passati`:'';
    curTxt+=late>0?` · <span class="down">${late} salta${late===1?'ta':'te'}</span>`:'';
    curTxt+=curToday?` · <b>oggi: ${curToday.name}</b>`:'';
    if(!curPast&&!curToday&&curNext)curTxt+=` · la settimana è appena iniziata, si parte ${dlab(curNext.date)} con ${curNext.name}`;
    else if(curNext)curTxt+=` · prossima ${dlab(curNext.date)}`;
    curTxt+=` · ${curW.sess.length} sedute in tutto`;
  }
  const curLine=curW?`<p style="margin:10px 0 0;padding:8px 10px;border-left:3px solid var(--acc2,#2563eb);background:rgba(37,99,235,.07);border-radius:6px;font-size:12.5px;line-height:1.45">
      <b>Settimana ${curW.num||''} in corso</b> (${dm(curW.monISO)}→${dm(curW.sunISO)}): ${curTxt}.
      <span class="muted">Non entra negli anelli qui sopra finché non è finita.</span></p>`:'';
  document.getElementById('mon-head').innerHTML=completed.length
    ?`<div style="display:flex;gap:6px;justify-content:space-between;flex-wrap:wrap">
        ${ring(kmPct,kmPct+'%','aderenza km',`${sumA.toFixed(0)}/${sumP.toFixed(0)} km`)}
        ${ring(wkPct,okW+'/'+completed.length,'sett. a target',wkPct+'%')}
        ${ring(sePct,doneCount+'/'+dueCount,'sedute svolte',sePct+'%')}
      </div>
      <p class="muted" style="margin-top:8px">Sulle <b>${completed.length}</b> settimane concluse del piano (fino a domenica ${dm(completed[completed.length-1].sunISO)}).</p>
      ${curLine}`
    :startedW.length
    ?`<p class="muted">Prima settimana del piano ancora in corso: gli anelli compaiono quando si chiude.</p>${curLine}`
    :`<p class="muted">Il piano parte lunedì ${weeks[0].monISO.slice(5)}: qui comparirà l’aderenza appena inizia.</p>`;
  // grafici trend + scostamento cumulato (solo settimane concluse: la corrente è parziale)
  const wcol=w=>w.okTarget?'var(--acc)':w.pct>=60?'var(--warn)':'var(--red)';
  const MONLEG='<span class="clg"><i style="background:var(--acc)"></i>a target<i style="background:var(--warn)"></i>\u226560%<i style="background:var(--red)"></i>sotto</span>';
  // il valore vero va nel tooltip anche quando la barra è tagliata a 150%
  const trend=completed.map(w=>({x:'S'+(w.num||''),y:Math.min(150,w.pct),c:wcol(w),vl:`${Math.round(w.pct)}%`,t:`${Math.round(w.pct)}% · ${w.actualKm.toFixed(0)}/${w.plannedKm.toFixed(0)} km`}));
  const nOk=completed.filter(w=>w.okTarget).length;
  chart('mon-trend',trend,{bar:true,ylab:v=>v.toFixed(0)+'%',suf:'%',color:'var(--acc2)',unit:'% dei km pianificati',
    ref:[{y:100,lab:'100% = come da piano',c:'var(--txt)'}],
    extra:trend.length?`<b>${nOk} su ${completed.length}</b> settimane a target`:''});
  document.getElementById('mon-trend-note').innerHTML=trend.length?'Ogni barra = km svolti diviso km pianificati, per settimana conclusa (la barra si ferma a 150%; tocca per il valore vero). '+MONLEG:'';
  let cum=0;const cumPts=completed.map(w=>{cum+=w.actualKm-w.plannedKm;return{x:'S'+(w.num||''),y:+cum.toFixed(0),c:wcol(w),t:`${cum>=0?'+':''}${cum.toFixed(0)} km`}});
  chart('mon-cum',cumPts,{ylab:v=>(v>0?'+':'')+v.toFixed(0)+' km',tlab:v=>(v>0?'+':'')+v.toFixed(0),color:'var(--dim)',unit:'km in più (+) o in meno (−) del piano',
    ref:[{y:0,lab:'0 = in linea col piano',c:'var(--txt)'}],
    extra:cumPts.length?`a fine S${completed[completed.length-1].num||''} sei a <b>${cum>=0?'+':''}${cum.toFixed(0)} km</b> ${cum>=0?'sopra':'sotto'} il piano, sommando tutte le settimane`:''});
  {const n=document.getElementById('mon-cum-note');if(n)n.innerHTML=cumPts.length?'Somma, settimana dopo settimana, della differenza fra km svolti e pianificati. Linea che sale = stai facendo più del piano; che scende = meno. I punti hanno il colore della settimana: '+MONLEG:'Sopra lo zero = km in più rispetto al pianificato; sotto = km in meno.';}
  // tabella settimana per settimana
  const wrows=weeks.filter(w=>w.started).map(w=>{
    const icon=w.inProg?'⏳':w.okTarget?'✅':w.pct>=60?'🟡':'🔴';
    // dire QUALE dei tre criteri è mancato: senza, una settimana all'83% con qualità e lungo a posto
    // sembra bocciata senza motivo
    const miss=[];
    if(!w.inProg&&!w.okTarget){
      if(w.pct<85)miss.push(`km ${w.pct}% (min 85%)`);
      if(w.qDone<w.qPlan){const n=w.qPlan-w.qDone;miss.push(`${n} qualità saltat${n===1?'a':'e'}`)}
      if(w.lPlan&&!w.lDone)miss.push('lungo saltato');
    }
    return `<tr><td>${icon} S${w.num||''}${w.summer?'☀️':''}<br><span class="muted">${w.monISO.slice(5)}→${w.sunISO.slice(5)}</span>${miss.length?`<br><span class="muted" style="font-size:10px">${miss.join(' · ')}</span>`:''}</td>
      <td class="r">${w.actualKm.toFixed(0)}/${w.plannedKm.toFixed(0)} km<br><span class="muted">${w.pct}%</span></td>
      <td class="r">${Object.keys(w.matches).length}/${w.sess.length}</td>
      <td class="r">${w.qDone}/${w.qPlan}${w.lPlan?`<br><span class="muted">lungo ${w.lDone?'✓':'—'}</span>`:''}</td></tr>`;
  });
  document.getElementById('mon-weeks').innerHTML=wrows.length
    ?`<table><tr><th>Sett.</th><th class="r">Volume</th><th class="r">Corse</th><th class="r">Qualità</th></tr>${wrows.slice(-12).join('')}</table>${wrows.length>12?`<p class="muted" style="margin-top:6px">Ultime 12 di ${wrows.length} settimane iniziate.</p>`:''}
      <p class="muted" style="margin-top:8px">✅ <b>a target</b> = almeno l’<b>85%</b> dei km previsti <i>e</i> tutte le sedute di qualità svolte <i>e</i> il lungo fatto. Servono <b>tutte e tre</b>: una settimana all’83% dei km resta 🟡 anche con qualità e lungo a posto. Sotto ogni settimana non a target c’è scritto quale criterio è mancato. 🟡 = dal 60% in su, 🔴 = sotto il 60%.</p>`
    :'<p class="muted">Nessuna settimana ancora iniziata.</p>';
  // seduta per seduta (dettaglio, per settimana)
  const DN=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  const sblocks=weeks.map(w=>{
    const rows=w.sess.map((s,si)=>{
      const run=w.matches[si],fut=s.date>todayS;
      const dd=day(s.date),chip=DN[dd.getDay()];
      let icon,detail;
      if(run){
        const okType=cls(run)===s.cls||(s.cls==='easy'&&cls(run)==='long')||(s.cls==='long'&&cls(run)==='easy');
        icon=okType?'✅':'🔁';
        const kmOk=s.km?Math.abs(run.km-s.km)<=Math.max(1.5,s.km*0.2):true;
        const kmTxt=s.km?`${run.km.toFixed(1)}/${s.km} km <span class="${kmOk?'':'down'}">${kmOk?'':run.km>s.km?'▲':'▼'}</span>`:`${run.km.toFixed(1)} km`;
        let paceTxt='';
        if((s.cls==='easy'||s.cls==='long')&&s.paces.length){
          const t=s.paces.map(toSec),lo=Math.min(...t),hi=Math.max(...t),ap=pace(run);
          const flag=ap<lo-3?'<span class="down">più veloce del target</span>':ap>hi+3?'<span class="down">più lento del target</span>':'<span class="up">in target</span>';
          paceTxt=`<br><span class="muted">passo ${fmtP(ap)} vs ${fmtP(lo)}–${fmtP(hi)} · ${flag}</span>`;
        }else{
          paceTxt=`<br><span class="muted">passo medio ${fmtP(pace(run))}/km${['int','qual','race'].includes(s.cls)?' (include recuperi — vedi lap in Analisi)':''}</span>`;
        }
        detail=`${okType?'':'tipo diverso: hai corso una '+CLSN[cls(run)].toLowerCase()+' · '}${kmTxt}${paceTxt}`;
      }else if(fut){icon='⏳';detail=`<span class="muted">in programma${s.km?` · ≈${s.km} km`:''}</span>`}
      else{icon='🔴';detail='<span class="down">saltata</span>'+(s.km?` <span class="muted">(≈${s.km} km previsti)</span>`:'')}
      // la descrizione della seduta (ripetute, recuperi, passi target) come nel tab Piano: qui serve
      // per sapere cosa andava fatto senza dover saltare avanti e indietro fra i due tab
      const work=s.work?`<div class="swork">${s.work}</div>`:'';
      return `<div class="sess"><span class="daychip">${chip}<br><span style="font-weight:400;font-size:9px">${dd.getDate()} ${MESI[dd.getMonth()]}</span></span>
        <div class="sbody"><span class="sn">${icon} ${s.name}</span> <span class="badge ${s.cls}">${CLSN[s.cls]}</span>
        ${work}<div class="smeta">${detail}</div></div></div>`;
    }).join('');
    const extraTxt=w.extra.length?`<p class="muted" style="margin:6px 0 0">+${w.extra.length} corsa/e extra non a piano: ${w.extra.map(r=>`${r.title} (${r.km.toFixed(1)} km)`).join(', ')}</p>`:'';
    const cls2=w.inProg?' cur':'';
    const barCol=w.pct>=85?'var(--acc)':w.pct>=60?'var(--warn)':'var(--red)';
    return `<div class="wk ph-${w.sess[0].phase||'base'}${cls2}"${!w.started?' style="opacity:.55"':''}>
      <div class="wkhead"><div class="wktitle">Settimana ${w.num||''}${w.inProg?' <span class="nowb">in corso</span>':''}</div>
      <div class="wkvol">${w.actualKm.toFixed(0)}/${w.plannedKm.toFixed(0)} km · ${w.pct}%</div></div>
      ${w.started?`<div class="vbar"><i style="width:${Math.min(100,w.pct)}%;background:${barCol}"></i></div>`:''}
      ${rows}${extraTxt}</div>`;
  }).join('');
  document.getElementById('mon-sess').innerHTML=sblocks;
  // box accessori: se un .fit ha lap malformati non devono portarsi dietro il resto del Monitor
  try{rMonPaces(weeks,todayS)}catch(e){document.getElementById('mon-paces').innerHTML='<p class="muted">Non riesco a calcolare i passi: '+e.message+'</p>'}
  try{rMonDist(weeks,todayS)}catch(e){document.getElementById('mon-dist').innerHTML='<p class="muted">Non riesco a calcolare la distribuzione: '+e.message+'</p>'}
  // ---- consiglio: quando ricalibrare ----
  // Il consiglio si misura DALL'ULTIMA RICALIBRAZIONE, non dall'inizio del piano: altrimenti "sono
  // trascorse N settimane" e "il VDOT è cambiato di X" restano veri per sempre e il box ripete lo
  // stesso messaggio anche subito dopo che hai ricalibrato. Vedi logRecal().
  const adv=document.getElementById('mon-advice');
  const lr=lastRecal();
  const sinceRecal=lr?completed.filter(w=>w.sunISO>lr.at):completed;
  const KIND={repace:'ricalibrati i passi delle sedute',recal:'piano rigenerato dal reale',align:'piano allineato al Monitor'};
  const lrLine=lr?`<p class="muted" style="margin:0 0 8px;padding-bottom:8px;border-bottom:1px solid var(--line)">Ultima ricalibrazione: <b>${dm(lr.at)}</b> — ${KIND[lr.kind]||lr.kind}${lr.vdot?` · VDOT di allora ${(+lr.vdot).toFixed(1)}`:''}. Da lì ${sinceRecal.length===0?'non si è ancora chiusa nessuna settimana':sinceRecal.length===1?'si è chiusa <b>1</b> settimana':`si sono chiuse <b>${sinceRecal.length}</b> settimane`}.</p>`:'';
  if(!completed.length){
    adv.innerHTML=lrLine+'<p class="muted">Ancora presto: serve almeno una settimana conclusa per un consiglio sulla ricalibrazione.</p>';
  }else if(lr&&sinceRecal.length<2){
    // periodo di grazia: i dati che avevano motivato il ritocco sono ancora quelli, giudicarli di
    // nuovo farebbe ricomparire lo stesso consiglio il giorno dopo aver ricalibrato
    adv.innerHTML=lrLine+`<p><span class="up"><b>Hai appena ricalibrato: lascia lavorare il piano.</b></span></p>
      <p class="muted" style="margin-top:6px">Servono <b>2 settimane concluse</b> dopo un ritocco per capire se ne serve un altro: prima di allora i segnali sarebbero ancora quelli vecchi. Torno a valutare da domenica ${dm(nthSundayAfter(lr.at,2-sinceRecal.length))}.</p>`;
  }else{
    const cur=curVdot();
    const from=lr?'dall’ultima ricalibrazione':'da inizio piano';
    const base=(lr&&lr.vdot)||monitor.vdot0||bestVdot(runs.filter(r=>r.date.slice(0,10)<S[0].date))||cur;
    const dv=(cur&&base)?cur-base:0;
    const recent=sinceRecal.slice(-3);
    const recentPct=Math.round(recent.reduce((a,w)=>a+w.pct,0)/recent.length);
    const missedQ=recent.reduce((a,w)=>a+Math.max(0,w.qPlan-w.qDone),0);
    // il cambio di fase non vale se hai già ricalibrato dentro la settimana in corso
    const phaseChange=curW&&completed.length&&completed[completed.length-1].sess[0].phase!==curW.sess[0].phase
      &&!(lr&&lr.at>=curW.monISO);
    let level=0;const reasons=[];
    if(recentPct<75){level=2;reasons.push(`nelle ultime ${recent.length} settimane hai coperto in media il <b>${recentPct}%</b> dei km previsti: il volume del piano è oltre quello che stai reggendo — ricalibra verso il basso`)}
    else if(recentPct<85){level=Math.max(level,1);reasons.push(`aderenza km recente al <b>${recentPct}%</b>, un po' sotto il piano`)}
    if(cur&&base&&dv>=1.5){level=2;reasons.push(`il tuo VDOT è salito di <b>${dv.toFixed(1)}</b> punti ${from} (${base.toFixed(1)}→${cur.toFixed(1)}): i ritmi target sono ormai troppo morbidi, ricalibrando corri ai valori giusti`)}
    else if(cur&&base&&dv<=-1.5){level=2;reasons.push(`il tuo VDOT è sceso di <b>${Math.abs(dv).toFixed(1)}</b> punti ${from} (${base.toFixed(1)}→${cur.toFixed(1)}): i ritmi attuali rischiano di essere troppo duri — meglio ritararli`)}
    else if(cur&&base&&Math.abs(dv)>=0.7){level=Math.max(level,1);reasons.push(`VDOT variato di <b>${dv>0?'+':''}${dv.toFixed(1)}</b> ${from}`)}
    if(missedQ>=3){level=2;reasons.push(`<b>${missedQ}</b> sedute di qualità saltate di recente: sono quelle che spostano davvero la forma`)}
    else if(missedQ>=1){level=Math.max(level,1);reasons.push(`${missedQ} seduta/e di qualità saltata/e nelle ultime settimane`)}
    if(phaseChange){level=Math.max(level,1);reasons.push('stai entrando in una nuova fase del piano: è il momento naturale per ritarare volume e ritmi sui dati reali')}
    if(sinceRecal.length>=5&&level===0){level=1;reasons.push(`sono trascorse <b>${sinceRecal.length}</b> settimane ${lr?'dall’ultimo ritocco':'dall’inizio del piano'}: una ricalibrazione periodica tiene i ritmi allineati alla forma`)}
    const head=level===2?'<span class="down"><b>Conviene ricalibrare ora.</b></span>'
      :level===1?'<span style="color:var(--warn)"><b>Puoi valutare una ricalibrazione.</b></span>'
      :'<span class="up"><b>Prosegui così: il piano è ancora ben calibrato.</b></span>';
    const body=reasons.length?`<ul style="margin:8px 0 0 18px;padding:0">${reasons.map(r=>`<li style="margin-bottom:5px">${r}</li>`).join('')}</ul>`
      :'<p class="muted" style="margin-top:6px">Aderenza in linea e forma stabile: nessun segnale che imponga un ritocco.</p>';
    const how=level>0?`<p class="muted" style="margin-top:10px">Come fare: usa il pulsante <b>Rigenera il piano dal reale (.ics + .fit)</b> qui sotto — rigenera con VDOT e volume attuali, aggiorna il Monitor e riscarica il .ics per il calendario.</p>`:'';
    adv.innerHTML=lrLine+`<p>${head}</p>${body}${how}`;
  }
  rToday();
}


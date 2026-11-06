/* ---------- Gara in esame e strategia dal percorso (.gpx) ----------
   Il tab Gara lavora sulla gara che scegli, non solo sull'obiettivo del piano:
   - l'elenco unisce la gara obiettivo e le intermedie del piano con le gare aggiunte da te;
   - il piano resta il riferimento: settimana e fase in cui cade la gara, VDOT previsto in quella settimana;
   - a ogni gara si può agganciare il percorso (.gpx): profilo, giri, curve, ristori, vento → passi per km
     a sforzo costante, fasi di gara, rifornimento.
   rp_races (sincronizzato): id → {name,km,date,start,target,mode,adapt,course,wx}.
   id 'goal' = obiettivo del piano, 'i:<data>' = intermedia del piano (lì il piano decide distanza e data,
   qui si salvano nome, ora, obiettivo e percorso), 'u:<…>' = gare tue. Se il piano cambia e una gara
   collegata sparisce, resta come gara tua con i dati salvati. La gara scelta sta in st.raceSel. */
let racesDB=LS('rp_races')||{};
const saveRaces=()=>LS('rp_races',racesDB);
const escH=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const GSET=[[5,'5 km'],[10,'10 km'],[21.0975,'Mezza'],[42.195,'Maratona']];
function kmName(km){km=+km;if(Math.abs(km-42.195)<.3)return'Maratona';if(Math.abs(km-21.0975)<.2)return'Mezza';return String(Math.round(km*10)/10).replace('.',',')+' km'}
const GIORNI=['dom','lun','mar','mer','gio','ven','sab'];
const dayLab=iso=>iso?`${GIORNI[dOnly(iso).getDay()]} ${labDay(iso)}`:'data da fissare';

/* ---- il piano come riferimento ---- */
function planWeekAt(pl,date){return pl&&pl.weeks&&date?pl.weeks.find(w=>wkMonISO(pl,w)<=date&&date<=wkSunISO(pl,w))||null:null}
function planVdAt(pl,date){ // VDOT che il piano prevede nella settimana di `date` (stessa rampa di applyWkOv)
  const w=planWeekAt(pl,date);if(!w||!pl.vd)return null;
  return planWeekVd(pl,w).R;
}

/* ---- elenco gare ---- */
function raceList(){
  const pl=LS('rp_plan'),out=[],seen=new Set();
  // obiettivo cambiato nel piano: quello vecchio (se aveva dati) diventa una gara tua
  if(racesDB.goal&&pl&&racesDB.goal.date&&racesDB.goal.date!==pl.dateStr){const id='u:'+racesDB.goal.date;if(!racesDB[id])racesDB[id]=racesDB.goal;delete racesDB.goal;saveRaces()}
  const mk=(id,km,date,def,kind)=>{const o=racesDB[id]||{};seen.add(id);return{...o,id,kind,km,date,name:o.name||def,start:o.start||'09:00'}};
  if(pl&&pl.dateStr&&pl.goal)out.push(mk('goal',+pl.goal,pl.dateStr,kmName(pl.goal)+' obiettivo','goal'));
  ((pl&&pl.interRaces)||[]).forEach(r=>{if(r&&r.date&&r.dist)out.push(mk('i:'+r.date,+r.dist,r.date,kmName(r.dist)+' intermedia','inter'))});
  Object.entries(racesDB).forEach(([id,o])=>{if(seen.has(id)||!o||!o.km)return;out.push({...o,id,kind:'mine',start:o.start||'09:00',name:o.name||kmName(o.km)})});
  return out.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
}
function selectedRace(){
  const L=raceList();if(!L.length)return null;
  const t=todayISO();
  return L.find(r=>r.id===st.raceSel)||L.find(r=>r.date&&r.date>=t)||L[L.length-1];
}
function racePatch(id,patch){
  const r=raceList().find(x=>x.id===id)||{};
  racesDB[id]={...(racesDB[id]||{}),km:r.km,date:r.date,...patch};
  Object.keys(racesDB[id]).forEach(k=>racesDB[id][k]==null&&delete racesDB[id][k]);
  saveRaces();
}
// tempo obiettivo della gara: scelto da te → dal piano (obiettivo, o VDOT previsto in quella settimana) → dalla forma
function raceGoalSec(r){
  if(!r)return null;
  if(r.id==='goal'){const g=goalTarget();if(g)return{sec:g.sec,src:st.goalT?'scelto da te':'dal piano'}}
  if(r.target)return{sec:r.target,src:'scelto da te'};
  const pl=LS('rp_plan'),pv=planVdAt(pl,r.date);
  if(pv)return{sec:predict(r.km,pv),src:`dal piano (VDOT ${pv.toFixed(1)} in quella settimana)`};
  const cv=curVdot();if(cv)return{sec:predict(r.km,cv),src:`dalla forma attuale (VDOT ${cv.toFixed(1)})`};
  return null;
}
// come goalTarget(), ma sulla gara scelta nel tab Gara: lo usano previsione, "cosa serve" e riferimenti
function raceTarget(){
  const r=selectedRace();if(!r)return goalTarget();
  const t=raceGoalSec(r);if(!t)return null;
  return{km:+r.km,sec:t.sec,date:r.date,pl:LS('rp_plan'),race:r,src:t.src,name:r.name};
}
function setRaceTarget(txt){
  const r=selectedRace();if(!r)return;const v=parseHMS(txt);
  if(r.id==='goal'){if(v)st.goalT=v;else delete st.goalT;LS('rp_st',st)}
  else racePatch(r.id,{target:v||null});
  rRaceAll();
}
function rRaceAll(){
  [rRace,rOutlook,rStrat,rGoal,rRefs].forEach(f=>{try{f()}catch(e){console.warn(f.name,e)}});
}
function raceSelect(id){st.raceSel=id;LS('rp_st',st);rRaceAll()}

/* ---- card "Gara in esame" ---- */
function rRace(){
  const el=document.getElementById('r-sel');if(!el)return;
  const L=raceList(),r=selectedRace(),t=todayISO();
  const tools=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn btn2" style="width:auto;margin:0;padding:9px 12px" onclick="raceNew()">+ Nuova gara</button>
      <label class="btn btn2" style="width:auto;margin:0;padding:9px 12px;cursor:pointer;display:inline-block">📍 Carica percorso .gpx<input type="file" accept=".gpx,application/gpx+xml" style="display:none" onchange="gpxPick(this)"></label>
    </div><p class="muted" id="r-msg" style="margin-top:6px"></p>`;
  if(!r){el.innerHTML=`<p class="muted">Nessuna gara: genera un piano, aggiungi una gara o carica il percorso di una gara (.gpx da Garmin Connect, Strava o dal sito della gara).</p>${tools}`;return}
  const KIND={goal:'obiettivo del piano',inter:'intermedia del piano',mine:'aggiunta da te'};
  const opts=L.filter(x=>x.id===r.id||!x.date||x.date>=addDaysISO(t,-60)).map(x=>`<option value="${escH(x.id)}"${x.id===r.id?' selected':''}>${x.date?labDay(x.date)+' · ':''}${escH(x.name)} · ${kmName(x.km)}${x.course?' 📍':''}${x.date&&x.date<t?' (corsa)':''}</option>`).join('');
  const pl=LS('rp_plan'),w=planWeekAt(pl,r.date),g=raceGoalSec(r);
  const PHN={base:'Base',speed:'Velocità',ispec:'Specifico intermedio',spec:'Specifico',taper:'Taper'};
  const days=r.date?daysBetween(t,r.date):null;
  let ref='';
  if(!pl)ref='Nessun piano salvato: la gara vive da sola, con l’obiettivo che scegli.';
  else if(r.id==='goal')ref=`È la gara obiettivo del piano (${pl.weeks.length} settimane, VDOT ${pl.vd}${pl.vdTarget&&pl.vdTarget!==pl.vd?' → '+pl.vdTarget:''}).`;
  else if(w){const pv=planVdAt(pl,r.date),toGoal=daysBetween(r.date,pl.dateStr);
    ref=`Nel piano cade in <b>S${w.w}</b> di ${pl.weeks.length} · fase <b>${PHN[w.phase]||w.phase||'–'}</b>${w.isDeload?' · scarico':''}${(w.sess||[]).some(isRaceSess)?' · settimana di gara':' · <span class="down">il piano non la prevede: aggiungila come gara intermedia o con "gara al volo" nella settimana</span>'}. VDOT previsto quella settimana <b>${pv?pv.toFixed(1):'–'}</b>. Obiettivo finale: ${kmName(pl.goal)} del ${labDay(pl.dateStr)}${toGoal>0?` (${Math.round(toGoal/7)} settimane dopo)`:''}.`}
  else ref=r.date?'Fuori dalle settimane del piano attuale.':'Fissa la data per collocarla nel piano.';
  const ro=r.kind!=='mine',kmSel=GSET.some(([k])=>Math.abs(k-r.km)<.05);
  el.innerHTML=`<select id="r-pick" onchange="raceSelect(this.value)" style="width:100%">${opts}</select>
    <div class="grid3" style="margin-top:10px">
      <div class="stat"><b>${days==null?'–':days>=0?days:'✓'}</b><span>${days==null?'data da fissare':days>=0?'giorni · '+dayLab(r.date):'corsa il '+labDay(r.date)}</span></div>
      <div class="stat"><b>${kmName(r.km)}</b><span>${KIND[r.kind]} · via ${escH(r.start)}</span></div>
      <div class="stat"><b>${g?fmtD(g.sec):'–'}</b><span>obiettivo · ${g?escH(g.src):'da scegliere'}</span></div></div>
    <p class="muted" style="margin-top:8px;font-size:12.5px">${ref}</p>
    <details class="pinfo" style="margin-top:6px"><summary>Modifica la gara</summary>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <label style="grid-column:1/3;margin:0">Nome<input type="text" id="r-name" value="${escH(r.name)}"></label>
        <label style="margin:0">Distanza<select id="r-km" ${ro?'disabled':''} onchange="document.getElementById('r-kmx').style.display=this.value==='x'?'':'none'">${GSET.map(([k,n])=>`<option value="${k}"${Math.abs(k-r.km)<.05?' selected':''}>${n}</option>`).join('')}<option value="x"${kmSel?'':' selected'}>altra…</option></select>
          <input type="text" id="r-kmx" placeholder="km, es. 15" value="${kmSel?'':r.km}" style="margin-top:4px;${kmSel?'display:none':''}" ${ro?'disabled':''}></label>
        <label style="margin:0">Data<input type="date" id="r-date" value="${r.date||''}" ${ro?'disabled':''}></label>
        <label style="margin:0">Ora del via<input type="time" id="r-start" value="${escH(r.start)}"></label>
        <label style="margin:0">Obiettivo<input type="text" id="r-tgt" placeholder="vuoto = ${g?fmtD(g.sec):'dal piano'}" value="${r.id==='goal'?(st.goalT?fmtD(st.goalT):''):(r.target?fmtD(r.target):'')}"></label>
      </div>
      ${ro?'<p class="muted" style="font-size:11.5px;margin-top:4px">Distanza e data vengono dal piano: si cambiano rigenerandolo.</p>':''}
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn" style="width:auto;margin:0;padding:9px 14px" onclick="raceSave()">Salva</button>
        ${r.course?`<button class="btn btn2" style="width:auto;margin:0;padding:9px 12px" onclick="if(confirm('Togliere il percorso da questa gara?')){racePatch('${escH(r.id)}',{course:null});rRaceAll()}">Togli percorso</button>`:''}
        ${r.kind==='mine'?`<button class="btn btn2" style="width:auto;margin:0;padding:9px 12px;color:var(--red)" onclick="if(confirm('Eliminare questa gara?')){delete racesDB['${escH(r.id)}'];saveRaces();delete st.raceSel;LS('rp_st',st);rRaceAll()}">Elimina</button>`:''}</div>
    </details>${tools}`;
}
function raceSave(){
  const r=selectedRace();if(!r)return;const v=id=>(document.getElementById(id)||{}).value;
  const patch={name:(v('r-name')||'').trim()||null,start:v('r-start')||'09:00'};
  if(r.kind==='mine'){const k=v('r-km')==='x'?parseFloat(String(v('r-kmx')).replace(',','.')):+v('r-km');if(k>0)patch.km=k;patch.date=v('r-date')||null}
  const tg=parseHMS(v('r-tgt')||'');
  if(r.id==='goal'){if(tg)st.goalT=tg;else delete st.goalT;LS('rp_st',st)}else patch.target=tg||null;
  racePatch(r.id,patch);
  rRaceAll();
}
function raceNew(){
  const id='u:'+Date.now().toString(36);
  racesDB[id]={name:'Nuova gara',km:10,date:addDaysISO(todayISO(),28),start:'09:00'};saveRaces();
  st.raceSel=id;LS('rp_st',st);rRaceAll();
  const d=document.querySelector('#r-sel details');if(d)d.open=true;
}

/* ---- lettura del .gpx ---- */
function hav(a1,o1,a2,o2){const R=6371000,r=Math.PI/180,dp=(a2-a1)*r,dl=(o2-o1)*r,x=Math.sin(dp/2)**2+Math.cos(a1*r)*Math.cos(a2*r)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function bearing(a1,o1,a2,o2){const r=Math.PI/180,y=Math.sin((o2-o1)*r)*Math.cos(a2*r),x=Math.cos(a1*r)*Math.sin(a2*r)-Math.sin(a1*r)*Math.cos(a2*r)*Math.cos((o2-o1)*r);return(Math.atan2(y,x)/r+360)%360}
const xmlUn=s=>String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").trim();
function gpxParse(txt){
  const P=[],W=[];let m;
  const re=/<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  const at=(a,k)=>{const x=new RegExp('\\b'+k+'\\s*=\\s*["\']([^"\']+)').exec(a);return x?+x[1]:NaN};
  while((m=re.exec(txt))){const la=at(m[2],'lat'),lo=at(m[2],'lon');if(!isFinite(la)||!isFinite(lo))continue;
    const e=m[3]&&/<ele>\s*([-\d.]+)\s*<\/ele>/.exec(m[3]);P.push([la,lo,e?+e[1]:null])}
  const rw=/<wpt\b([^>]*?)>([\s\S]*?)<\/wpt>/g;
  while((m=rw.exec(txt))){const la=at(m[1],'lat'),lo=at(m[1],'lon'),n=/<name>([\s\S]*?)<\/name>/.exec(m[2]),ty=/<type>([\s\S]*?)<\/type>/.exec(m[2]);
    if(isFinite(la)&&isFinite(lo))W.push([la,lo,xmlUn(n?n[1]:ty?ty[1]:'Punto')])}
  const nm=/<name>([\s\S]*?)<\/name>/.exec(txt);
  return{pts:P,wpts:W,name:nm?xmlUn(nm[1]):''};
}
// percorso compatto da salvare: punti ogni 50 m [d, quota lisciata, lat, lon] + curve, giri, punti notevoli
function courseBuild(g){
  const P=g.pts.filter((p,i,a)=>!i||hav(a[i-1][0],a[i-1][1],p[0],p[1])>.5);
  if(P.length<20)throw new Error('il file non contiene una traccia');
  const d=[0];for(let i=1;i<P.length;i++)d.push(d[i-1]+hav(P[i-1][0],P[i-1][1],P[i][0],P[i][1]));
  const L=d[d.length-1];if(L<800)throw new Error('traccia troppo corta');
  const hasE=P.filter(p=>p[2]!=null).length>P.length*.8;
  // ricampionamento a 10 m
  const S=[];let j=1;
  for(let x=0;x<=L;x+=10){while(j<d.length-1&&d[j]<x)j++;const t=(x-d[j-1])/Math.max(1e-9,d[j]-d[j-1]),a=P[j-1],b=P[j];
    S.push([x,a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),hasE&&a[2]!=null&&b[2]!=null?a[2]+t*(b[2]-a[2]):0])}
  // quota lisciata su ±100 m: le tracce da mappa hanno un rumore di 1-2 m ogni 30 m che gonfia il dislivello
  const E=S.map((p,i)=>{let s=0,n=0;for(let k=Math.max(0,i-10);k<=Math.min(S.length-1,i+10);k++){s+=S[k][3];n++}return s/n});
  // curve: cambio di direzione ≥60° su ±30 m, raggruppate entro 60 m
  const turns=[];
  for(let i=3;i<S.length-3;i++){const b1=bearing(S[i-3][1],S[i-3][2],S[i][1],S[i][2]),b2=bearing(S[i][1],S[i][2],S[i+3][1],S[i+3][2]);
    let a=Math.abs(b2-b1);if(a>180)a=360-a;
    if(a>=60){const last=turns[turns.length-1];if(last&&S[i][0]-last[0]<60){if(a>last[1]){last[0]=S[i][0];last[1]=Math.round(a)}}else turns.push([S[i][0],Math.round(a)])}}
  // giri: ripassaggi entro 40 m dal via, dopo essersene allontanati
  const laps=[];let away=false;
  for(const p of S){const dd=hav(S[0][1],S[0][2],p[1],p[2]);if(dd>300)away=true;
    if(away&&dd<40&&p[0]>1000&&L-p[0]>500&&(!laps.length||p[0]-laps[laps.length-1]>1000)){laps.push(p[0]);away=false}}
  // punti notevoli (ristori, spugnaggi…): sul punto di traccia più vicino
  const wp=g.wpts.map(([la,lo,n])=>{let b=null;for(const p of S){const dd=hav(la,lo,p[1],p[2]);if(!b||dd<b[1])b=[p[0],dd]}return b&&b[1]<150?[b[0],n]:null}).filter(Boolean).sort((a,b)=>a[0]-b[0]);
  const pts=[];for(let i=0;i<S.length;i+=5)pts.push([S[i][0],+E[i].toFixed(1),+S[i][1].toFixed(5),+S[i][2].toFixed(5)]);
  const lastI=S.length-1;if(pts[pts.length-1][0]!==S[lastI][0])pts.push([S[lastI][0],+E[lastI].toFixed(1),+S[lastI][1].toFixed(5),+S[lastI][2].toFixed(5)]);
  // dislivello con isteresi di 2 m: conta solo le variazioni vere
  let up=0,dn=0,ref=pts[0][1];for(const p of pts){const de=p[1]-ref;if(de>=2){up+=de;ref=p[1]}else if(de<=-2){dn-=de;ref=p[1]}}
  const loop=hav(S[0][1],S[0][2],S[lastI][1],S[lastI][2])<150;
  return{name:g.name,len:Math.round(L),hasE,up:Math.round(up),dn:Math.round(dn),loop,pts,turns,laps,wp,at:todayISO()};
}
function snapKm(L){const k=L/1000,s=[5,10,15,21.0975,30,42.195].find(x=>Math.abs(k-x)/x<.04);return s||Math.round(k*10)/10}
async function gpxPick(inp){
  const f=inp.files&&inp.files[0];inp.value='';if(!f)return;
  const msg=t=>{const e=document.getElementById('r-msg');if(e)e.innerHTML=t};
  try{
    const c=courseBuild(gpxParse(await f.text())),km=snapKm(c.len),near=x=>Math.abs(x.km-km)/km<.12;
    const L=raceList(),sel=selectedRace(),t=todayISO();
    let r=sel&&near(sel)?sel:L.find(x=>near(x)&&(!x.date||x.date>=t));
    let created=false;
    if(!r){const id='u:'+Date.now().toString(36);racesDB[id]={name:c.name||kmName(km),km,date:null,start:'09:00'};saveRaces();r={id,kind:'mine',km};created=true}
    const generic=!racesDB[r.id]||!racesDB[r.id].name;
    racePatch(r.id,{course:c,...(generic&&c.name?{name:c.name}:{}),wx:null});
    st.raceSel=r.id;LS('rp_st',st);rRaceAll();
    msg(`<b>Percorso caricato</b>: ${escH(c.name||f.name)} · ${(c.len/1000).toFixed(2)} km misurati${created?' · nuova gara: fissa la data in "Modifica la gara"':' · agganciato a '+escH(selectedRace().name)}.`);
    if(created){const d=document.querySelector('#r-sel details');if(d)d.open=true}
  }catch(e){msg('Non riesco a leggere il .gpx: '+escH(e.message))}
}

/* ---- meteo del giorno di gara (Open-Meteo, previsione fino a 16 giorni) ---- */
let raceWxBusy=false;const raceWxFail={};
async function raceWx(r,force){
  if(raceWxBusy||!r||!r.date)return;
  if(!force&&raceWxFail[r.id]&&Date.now()-raceWxFail[r.id]<15*60e3)return; // offline: non ritentare a ogni disegno
  const days=daysBetween(todayISO(),r.date);if(days<0||days>15)return;
  if(!force&&r.wx&&Date.now()-r.wx.at<3*3600e3)return;
  const pos=r.course&&r.course.pts.length?{lat:r.course.pts[0][2],lon:r.course.pts[0][3]}:wxHome();
  raceWxBusy=true;
  try{
    const j=await wxGet(`https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&hourly=temperature_2m,dew_point_2m,wind_speed_10m,wind_direction_10m,precipitation_probability&start_date=${r.date}&end_date=${r.date}&timezone=Europe%2FRome`);
    const H=j.hourly;if(!H||!H.time)throw new Error('vuoto');
    const g=raceGoalSec(r),h0=+(r.start||'09:00').slice(0,2),h1=h0+Math.max(1,Math.ceil((g?g.sec:3600)/3600));
    const idx=H.time.map((s,i)=>[+s.slice(11,13),i]).filter(([h])=>h>=h0&&h<=h1).map(([,i])=>i);
    const av=k=>mean(idx.map(i=>H[k][i]).filter(v=>v!=null));
    // direzione media del vento come media vettoriale
    const vx=mean(idx.map(i=>Math.sin(H.wind_direction_10m[i]*Math.PI/180))),vy=mean(idx.map(i=>Math.cos(H.wind_direction_10m[i]*Math.PI/180)));
    racePatch(r.id,{wx:{at:Date.now(),t:av('temperature_2m'),dp:av('dew_point_2m'),ws:av('wind_speed_10m'),wd:(Math.atan2(vx,vy)*180/Math.PI+360)%360,pp:Math.max(...idx.map(i=>H.precipitation_probability[i]||0)),days}});
  }catch(e){console.warn('meteo gara',e);raceWxFail[r.id]=Date.now();raceWxBusy=false;return}
  raceWxBusy=false;
  rStrat();
}

/* ---- strategia: passi per km a sforzo costante ---- */
// costo della pendenza (g frazione): +3,3% di passo per 1% di salita, −1,8% per 1% di discesa (si recupera meno)
const gradeF=g=>{g=Math.max(-.15,Math.min(.15,g));return g>0?1+3.3*g:Math.max(.92,1+1.8*g)};
const STRAT={even:'Passo pari',neg:'Split negativo',cons:'Partenza prudente'};
function stratCompute(r){
  const g=raceGoalSec(r);if(!g)return null;
  const off=r.km*1000,c=r.course,wx=r.wx,eff=wx?wxEffect(wx):null;
  const mode=r.mode||(r.km>=21?'neg':'even'),adapt=r.adapt!==false;
  const heat=eff?eff.heat+eff.cold:0,T=g.sec*(adapt&&heat>=1?1+heat/100:1);
  // segmenti di 50 m sulla distanza ufficiale (la traccia viene riscalata: i km del tabellone, non del GPS)
  let seg=[];
  if(c&&c.pts.length>2){const k=off/c.len;
    for(let i=1;i<c.pts.length;i++){const a=c.pts[i-1],b=c.pts[i],len=(b[0]-a[0])*k;if(len<=0)continue;
      seg.push({d0:a[0]*k,len,gr:c.hasE?(b[1]-a[1])/(b[0]-a[0]):0,dz:c.hasE?b[1]-a[1]:0,br:bearing(a[2],a[3],b[2],b[3])})}}
  else for(let x=0;x<off;x+=50)seg.push({d0:x,len:Math.min(50,off-x),gr:0,dz:0,br:null});
  const v=off/T,ws=wx&&wx.ws!=null?wx.ws/3.6*.7:0; // vento all'altezza del corridore ≈ 70% di quello a 10 m
  seg.forEach(s=>{
    s.fg=gradeF(s.gr);
    s.head=ws&&s.br!=null?ws*Math.cos((wx.wd-s.br)*Math.PI/180):0;
    // resistenza dell'aria ≈ 1% del costo a vento nullo, cresce col quadrato della velocità relativa;
    // tarata su ~3-4% di passo con 20 km/h contro (misurati a 10 m). Il vento a favore restituisce meno.
    let air=ws?.01*((v+s.head)*Math.abs(v+s.head)-v*v)/(v*v):0;if(air<0)air*=.6;
    if(ws&&s.br==null)air=eff?eff.wind/100:0;
    s.fw=1+air;
    const x=(s.d0+s.len/2)/off;
    s.fp=mode==='neg'?1+(r.km>=42?.01:.012)*(1-2*x):mode==='cons'?(x<.15?1.025:1):1;
    s.F=s.fg*s.fw*s.fp});
  const base=T/seg.reduce((a,s)=>a+s.len*s.F,0);
  seg.forEach(s=>s.t=s.len*base*s.F);
  // per km
  const nk=Math.ceil(off/1000-1e-6),K=[];
  for(let i=0;i<nk;i++)K.push({k:i+1,len:Math.min(1000,off-i*1000),t:0,up:0,dn:0,head:0,hl:0,turns:0,wp:[],lap:null});
  seg.forEach(s=>{let x=s.d0,rem=s.len;while(rem>1e-6){const i=Math.min(nk-1,Math.floor(x/1000+1e-9)),end=Math.min((i+1)*1000,off),part=Math.min(rem,end-x)||rem,f=part/s.len,o=K[i];
    o.t+=s.t*f;if(s.dz>0)o.up+=s.dz*f;else o.dn-=s.dz*f;o.head+=s.head*part;o.hl+=part;x+=part;rem-=part}});
  if(c){const k=off/c.len,at=d=>K[Math.min(nk-1,Math.floor(d*k/1000))];
    c.turns.forEach(([d])=>at(d).turns++);c.wp.forEach(([d,n])=>at(d).wp.push(n));c.laps.forEach((d,i)=>{at(d).lap=i+2})}
  // ultimo spezzone corto (es. i 97 m della mezza): unito al km prima, un passo su 100 m non dice niente
  if(K.length>1&&K[K.length-1].len<300){const z=K.pop(),o=K[K.length-1];['len','t','up','dn','head','hl','turns'].forEach(k=>o[k]+=z[k]);o.wp.push(...z.wp);o.lap=o.lap||z.lap;o.tail=true}
  let cum=0;K.forEach(o=>{cum+=o.t;o.cum=cum;o.pace=o.t/(o.len/1000);o.head=o.hl?o.head/o.hl*3.6/.7:0});
  return{g,T,heat,eff,mode,adapt,seg,K,base,off};
}
function kmNote(o,c){
  const n=[],net=o.up-o.dn; // dislivello netto del km (la quota lisciata ha ancora 1-2 m di rumore)
  if(o.lap)n.push(`<b>giro ${o.lap}</b>`);
  if(net>=5)n.push(`sale di ${Math.round(net)} m: tieni lo sforzo, lascia andare il passo`);
  else if(net<=-5)n.push(`scende di ${Math.round(-net)} m: sciolto, non spingere`);
  if(o.turns>=3)n.push(`${o.turns} curve strette: corda e niente scatti in uscita`);
  if(o.head>=8)n.push(`vento contro ~${Math.round(o.head)} km/h: cerca una scia`);
  else if(o.head<=-8)n.push(`vento a favore: lascia correre`);
  o.wp.forEach(w=>n.push('📍 '+escH(w)));
  return n.join(' · ');
}
function stratPhases(S,r){
  const km=r.km,f=km>=40?[[0,5,'Avvio','Il passo deve sembrare facile: chi parte forte paga dopo il 30°. FC in LT1 ('+zLab(2)+').'],[5,30,'Crociera','Passo da tabella, FC stabile in LT1. Bevi a ogni ristoro anche senza sete.'],[30,37,'Tenuta','Qui comincia la gara: concentrati su cadenza e postura, non sul cronometro del singolo km.'],[37,km,'Finale','Se hai margine, alza un po’ il ritmo un km alla volta.']]
    :km>=20?[[0,3,'Avvio','Lascia sfogare il gruppo: 3–5" più lento della media non costano niente. FC sotto '+zRange(3)[0]+' fino al 3°.'],[3,15,'Ritmo','Passo da tabella, FC in LT2 ('+zLab(3)+'), respiro controllato.'],[15,18,'Tenuta','La fatica sale ma il passo no: pensa al km che stai correndo.'],[18,km,'Finale','Da qui si spende tutto quello che resta, prima a sensazione poi a tutta negli ultimi 1000 m.']]
    :km>=9?[[0,2,'Avvio','Non farti trascinare: il primo km è quello che si paga di più.'],[2,7,'Ritmo','Passo da tabella, FC che sale piano verso l’alta intensità.'],[7,km,'Finale','Ogni km un po’ più forte, ultimo a tutta.']]
    :[[0,1,'Avvio','Controllato per i primi 600–800 m.'],[1,km-1,'Ritmo','Passo da tabella: è dura dall’inizio, è normale.'],[km-1,km,'Finale','Tutto quello che resta.']];
  return f.map(([a,b,n,txt])=>{const ks=S.K.filter(o=>o.k>a&&o.k<=Math.ceil(b-1e-6));const t=ks.reduce((s,o)=>s+o.t,0),l=ks.reduce((s,o)=>s+o.len,0);
    return{n,a,b,txt,pace:l?t/(l/1000):null,cum:ks.length?ks[ks.length-1].cum:null}});
}
function fuelPlan(S,r){
  const T=S.T,km=r.km,v=S.off/T,at=min=>Math.round(min*60*v/1000);
  if(T<70*60)return km>=9?'Gara breve: niente gel in corsa. Colazione 2–3 ore prima, acqua ai ristori se fa caldo.':'Gara breve: nessun rifornimento in corsa.';
  const g=[];if(km>=40){for(let m=35;m<T/60-15;m+=30)g.push(m)}else{g.push(Math.min(45,T/60*.45));if(T>95*60)g.push(T/60*.75)}
  return `Gel 10–15' prima del via, poi ${g.map(m=>`al <b>${Math.round(m)}'</b> (≈ km ${at(m)})`).join(', ')}, sempre con acqua a un ristoro.${km>=40?' Nei 2 giorni prima carico di carboidrati (8–10 g/kg al giorno).':''}`;
}
function rStrat(){
  const el=document.getElementById('r-strat');if(!el)return;
  const r=selectedRace();
  if(!r){el.innerHTML='<p class="muted">Scegli o aggiungi una gara in cima.</p>';return}
  const S=stratCompute(r);
  if(!S){el.innerHTML='<p class="muted">Serve un tempo obiettivo: impostalo in "Modifica la gara".</p>';return}
  const c=r.course,t=todayISO(),days=r.date?daysBetween(t,r.date):null;
  if(days!=null&&days>=0&&days<=15&&(!r.wx||Date.now()-r.wx.at>3*3600e3))setTimeout(()=>raceWx(r),0);
  const avg=S.T/(S.off/1000),wx=r.wx,eff=S.eff;
  let h='';
  // percorso
  if(c){h+=`<div class="grid3"><div class="stat"><b>${(c.len/1000).toFixed(2)}</b><span>km misurati sulla traccia</span></div>
      <div class="stat"><b>${c.hasE?'+'+c.up+' / −'+c.dn:'–'}</b><span>dislivello m${c.hasE?'':' (il .gpx non ha quote)'}</span></div>
      <div class="stat"><b>${c.laps.length?c.laps.length+1+' giri':c.loop?'anello':'linea'}</b><span>${c.turns.length} curve strette${c.wp.length?' · '+c.wp.length+' punti':''}</span></div></div>
    <div id="r-prof" style="margin-top:10px">${stratProfile(S,r)}</div><div id="r-map" style="margin-top:6px">${stratMap(S,r)}</div>`}
  else h+=`<p class="muted">Senza percorso la strategia considera un tracciato piatto. Carica il .gpx (da Garmin Connect: percorso → ⋯ → Esporta GPX) per profilo, giri, curve e vento.</p>`;
  // meteo
  h+=`<h3 class="fh">Meteo al via</h3>`;
  if(wx&&days!=null&&days>=0)h+=`<p style="font-size:13px">${Math.round(wx.t)}°C · rugiada ${Math.round(wx.dp)}°C · vento ${Math.round(wx.ws)} km/h da ${WX_DIR[Math.round(wx.wd/45)%8]}${wx.pp>=30?` · pioggia ${wx.pp}%`:''} <span class="muted">(previsione ${wx.days===0?'di oggi':'a '+wx.days+' giorni'}, ore ${escH(r.start)})</span> <button class="fxbtn" onclick="raceWx(selectedRace(),true)">aggiorna</button></p>
      ${eff?`<p style="margin-top:4px"><span class="phb" style="background:${wxLvlCol(eff.lvl)};color:#fff">Caldo/freddo ${(S.heat).toFixed(1)}%</span> <span class="muted">${S.heat>=1?(S.adapt?`obiettivo adattato: <b>${fmtD(S.T)}</b> invece di ${fmtD(S.g.sec)}`:`con questo meteo è realistico ${fmtD(S.g.sec*(1+S.heat/100))}`):'nessun effetto apprezzabile sul passo'}</span></p>`:''}`;
  else h+=`<p class="muted">${days==null?'Fissa la data per avere il meteo.':days<0?'Gara già corsa.':'La previsione arriva a 16 giorni dalla gara: ricompare da sola.'}</p>`;
  // scelte
  h+=`<div style="margin-top:10px"><div id="r-mode"></div><div id="r-adapt" style="margin-top:4px"></div></div>`;
  // fasi
  const ph=stratPhases(S,r);
  h+=`<h3 class="fh">Come correrla · obiettivo ${fmtD(S.T)} (media ${fmtP(avg)}/km)</h3><table>${ph.map(p=>`<tr><td><b>${p.n}</b> <span class="muted">km ${p.a}–${String(Math.round(p.b*10)/10).replace('.',',')}</span><br><span class="muted" style="font-size:12px">${p.txt}</span></td><td class="r" style="white-space:nowrap"><b class="pace">${fmtP(p.pace)}</b>/km<br><span class="muted">al km ${String(Math.round(p.b*10)/10).replace('.',',')}: ${p.cum?fmtD(p.cum):'–'}</span></td></tr>`).join('')}</table>`;
  // tabella km
  h+=`<h3 class="fh">Passi km per km</h3><table class="r-km"><tr><th>km</th><th class="r">passo</th><th class="r">tempo</th><th>note</th></tr>${S.K.map(o=>{const dv=o.pace-avg;return`<tr><td>${o.len<999||o.tail?String(Math.round((o.k-1+o.len/1000)*100)/100).replace('.',','):o.k}</td><td class="r"><b>${fmtP(o.pace)}</b>${Math.abs(dv)>=1.5?`<br><small class="${dv>0?'down':'up'}">${dv>0?'+':'−'}${Math.round(Math.abs(dv))}"</small>`:''}</td><td class="r">${fmtD(o.cum)}</td><td class="muted" style="font-size:12px">${kmNote(o,c)}</td></tr>`}).join('')}</table>
    <button class="btn btn2" style="width:auto;margin:8px 0 0;padding:8px 12px" onclick="stratCopy()">Copia la tabella passi</button>`;
  // giri
  if(c&&c.laps.length){const b=[0,...c.laps.map(d=>d*S.off/c.len),S.off];
    h+=`<h3 class="fh">Giri</h3><table><tr><th>Giro</th><th class="r">km</th><th class="r">tempo</th><th class="r">passo</th><th class="r">passaggio</th></tr>${b.slice(1).map((e,i)=>{const t=S.seg.filter(s=>s.d0>=b[i]-1e-6&&s.d0<e-1e-6).reduce((a,s)=>a+s.t,0),tc=S.seg.filter(s=>s.d0<e-1e-6).reduce((a,s)=>a+s.t,0);
      return`<tr><td>${i+1}</td><td class="r">${((e-b[i])/1000).toFixed(2)}</td><td class="r">${fmtD(t)}</td><td class="r">${fmtP(t/((e-b[i])/1000))}</td><td class="r">${fmtD(tc)}</td></tr>`}).join('')}</table>
      <p class="muted" style="margin-top:4px;font-size:12px">Sui percorsi a giri usa i passaggi dal via come controllo: più affidabili del GPS, che in paese fra le case sbaglia.</p>`}
  // rifornimento, riscaldamento, orologio
  const wu=r.km>=40?"5–10' di corsetta molto leggera, niente allunghi":r.km>=20?"10' facili + 2–3 allunghi, finito 10' prima del via":"15' facili + 4 allunghi, finito 10' prima del via";
  h+=`<h3 class="fh">Prima e durante</h3><ul class="muted" style="padding-left:18px;font-size:12.5px;line-height:1.55">
    <li><b>Riscaldamento</b>: ${wu}.</li>
    <li><b>Rifornimento</b>: ${fuelPlan(S,r)}</li>
    <li><b>Orologio</b>: il GPS misura di solito lo 0,5–1% in più (curve, tangenti${c&&c.turns.length>20?', e qui le curve sono '+c.turns.length:''}): per stare nel tempo il passo sul display va tenuto ≈ <b>${fmtP(avg*.993)}</b> invece di ${fmtP(avg)}. Meglio ancora: lap manuale ai cartelli dei km.</li>
    <li><b>Garmin PacePro</b>: carica lo stesso percorso in Garmin Connect, crea una strategia PacePro con obiettivo ${fmtD(S.T)}, ${S.mode==='neg'?'split negativo 2%':S.mode==='cons'?'split pari e primo km più lento':'split pari'} e sforzo in salita "basso"${c&&c.hasE&&c.up<40?' (qui conta poco: il percorso è piatto)':''}.</li></ul>`;
  el.innerHTML=h;
  pillsTxt('r-mode',Object.entries(STRAT),S.mode,v=>{racePatch(r.id,{mode:v});rStrat()});
  if(eff&&S.heat>=1)pillsTxt('r-adapt',[['1','Adatta l’obiettivo al meteo'],['0','Tieni l’obiettivo']],S.adapt?'1':'0',v=>{racePatch(r.id,{adapt:v==='1'});rStrat()});
}
function stratCopy(){
  const r=selectedRace(),S=r&&stratCompute(r);if(!S)return;
  const txt=`${r.name} · ${kmName(r.km)} · obiettivo ${fmtD(S.T)}\n`+S.K.map(o=>`km ${o.k}  ${fmtP(o.pace)}  ${fmtD(o.cum)}`).join('\n');
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{const m=document.getElementById('r-msg');if(m)m.textContent='Tabella passi copiata.'}).catch(()=>prompt('Copia la tabella:',txt));
}
// profilo altimetrico + passo per km
function stratProfile(S,r){
  const c=r.course,W=560,H=230,P={l:34,r:8,t:14,b:18},H1=120,k=S.off/c.len;
  const X=d=>P.l+d/S.off*(W-P.l-P.r);
  const es=c.pts.map(p=>p[1]),lo=Math.min(...es),hi=Math.max(...es),mid=(lo+hi)/2,span=Math.max(20,hi-lo)*1.15;
  const Y=e=>P.t+(1-(e-(mid-span/2))/span)*(H1-P.t);
  let s='';
  const st=niceStep(span,3);for(let g=Math.ceil((mid-span/2)/st)*st;g<=mid+span/2;g+=st)s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(g).toFixed(1)}" y2="${Y(g).toFixed(1)}" stroke="var(--line)"/><text x="${P.l-4}" y="${(Y(g)+4).toFixed(1)}" text-anchor="end">${Math.round(g)}</text>`;
  const line=c.pts.map((p,i)=>`${i?'L':'M'}${X(p[0]*k).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  s+=`<path d="${line}L${X(S.off).toFixed(1)},${H1}L${P.l},${H1}Z" fill="var(--acc2)" fill-opacity=".12"/><path d="${line}" fill="none" stroke="var(--acc2)" stroke-width="1.8"/>`;
  c.laps.forEach((d,i)=>{const x=X(d*k).toFixed(1);s+=`<line x1="${x}" x2="${x}" y1="${P.t}" y2="${H-P.b}" stroke="var(--dim)" stroke-dasharray="3 3"/><text x="${(+x+3)}" y="${P.t+8}" style="fill:var(--dim)">giro ${i+2}</text>`});
  c.wp.forEach(([d,n])=>{s+=`<text x="${X(d*k).toFixed(1)}" y="${H1-3}" text-anchor="middle" style="font-size:11px"><title>${escH(n)}</title>📍</text>`});
  s+=`<text x="2" y="10" class="cu">quota (m)</text>`;
  // passo per km: barre attorno alla media
  const avg=S.T/(S.off/1000),y0=H1+20,y1=H-P.b,ym=(y0+y1)/2,dv=Math.max(4,...S.K.map(o=>Math.abs(o.pace-avg)));
  s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${ym}" y2="${ym}" stroke="var(--dim)" stroke-dasharray="2 3"/><text x="${P.l-4}" y="${ym+4}" text-anchor="end">${fmtP(avg)}</text><text x="2" y="${y0-4}" class="cu">passo per km (sopra = più lento)</text>`;
  const every=S.K.length>25?5:S.K.length>12?2:1;
  S.K.forEach(o=>{const xa=X((o.k-1)*1000)+1,xb=X((o.k-1)*1000+o.len)-1,h=(o.pace-avg)/dv*(y1-y0)/2;
    s+=`<rect x="${xa.toFixed(1)}" y="${(h>0?ym-h:ym).toFixed(1)}" width="${Math.max(1,xb-xa).toFixed(1)}" height="${Math.max(1,Math.abs(h)).toFixed(1)}" fill="${h>0?'var(--warn)':'var(--acc)'}" fill-opacity=".7"><title>km ${o.k}: ${fmtP(o.pace)}/km</title></rect>`;
    if(o.k%every===0&&!(o.k===S.K.length&&o.len<500&&!o.tail))s+=`<text x="${((xa+xb)/2).toFixed(1)}" y="${H-4}" text-anchor="middle">${o.k}</text>`});
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" class="chv">${s}</svg>`;
}
// mappa del percorso, colorata dal costo del tratto (salita + vento): dove servirà più sforzo per lo stesso passo
function stratMap(S,r){
  const c=r.course,la0=c.pts[0][2],cs=Math.cos(la0*Math.PI/180);
  const xs=c.pts.map(p=>p[3]*cs*111320),ys=c.pts.map(p=>-p[2]*110540);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const W=360,sc=Math.min((W-30)/Math.max(1,x1-x0),300/Math.max(1,y1-y0)),H=Math.round((y1-y0)*sc+30);
  const X=i=>15+(xs[i]-x0)*sc,Y=i=>15+(ys[i]-y0)*sc;
  let s='';
  S.seg.forEach((g,i)=>{if(i+1>=c.pts.length)return;const f=g.fg*g.fw,col=f>1.012?'var(--red)':f>1.004?'var(--warn)':f<.99?'var(--acc)':'var(--dim)';
    s+=`<line x1="${X(i).toFixed(1)}" y1="${Y(i).toFixed(1)}" x2="${X(i+1).toFixed(1)}" y2="${Y(i+1).toFixed(1)}" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`});
  // km: etichette che non si sovrappongono (sui giri ripassano negli stessi punti)
  const placed=[],k=S.off/c.len,step=r.km>25?5:1;
  for(let km=step;km<r.km;km+=step){const d=km*1000/k,i=c.pts.findIndex(p=>p[0]>=d);if(i<0)continue;const x=X(i),y=Y(i);
    if(placed.some(([a,b])=>Math.hypot(a-x,b-y)<16))continue;placed.push([x,y]);
    s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="var(--card)" stroke="var(--dim)"/><text x="${x.toFixed(1)}" y="${(y+3.5).toFixed(1)}" text-anchor="middle" style="font-size:9px;fill:var(--txt)">${km}</text>`}
  const n=c.pts.length-1;
  s+=`<circle cx="${X(0).toFixed(1)}" cy="${Y(0).toFixed(1)}" r="5.5" fill="var(--txt)" stroke="var(--card)" stroke-width="2"/>`+(Math.hypot(X(n)-X(0),Y(n)-Y(0))>8?`<rect x="${(X(n)-5).toFixed(1)}" y="${(Y(n)-5).toFixed(1)}" width="10" height="10" fill="var(--txt)"/>`:'');
  const wx=r.wx;if(wx&&wx.ws>=3){const a=(wx.wd+180)%360; // freccia: verso dove soffia
    s+=`<g transform="translate(${W-24},22) rotate(${a.toFixed(0)})"><line x1="0" y1="10" x2="0" y2="-10" stroke="var(--txt)" stroke-width="2"/><path d="M-5,-4 L0,-11 L5,-4" fill="none" stroke="var(--txt)" stroke-width="2"/></g><text x="${W-24}" y="46" text-anchor="middle" style="font-size:10px">${Math.round(wx.ws)} km/h</text>`}
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" class="chv" style="max-width:420px">${s}</svg><div class="lgd"><span>● partenza${Math.hypot(X(n)-X(0),Y(n)-Y(0))>8?' · ■ arrivo':' e arrivo'}</span><span><i style="background:var(--dim)"></i>neutro</span><span><i style="background:var(--warn)"></i>costa un po’</span><span><i style="background:var(--red)"></i>costa di più</span><span><i style="background:var(--acc)"></i>aiuta</span>${wx&&wx.ws>=3?'<span>freccia = verso dove soffia il vento</span>':''}</div>`;
}

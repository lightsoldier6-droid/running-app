/* ---------- dati / settings ---------- */
function rData(){
  document.getElementById('dt-info').textContent=`${runs.length} corse in archivio (${runs[0].date.slice(0,10)} → ${runs[runs.length-1].date.slice(0,10)}). I dati restano sul tuo telefono.`;
  document.getElementById('st-hrmax').value=st.hrmax;document.getElementById('st-hrrest').value=st.hrrest;
  rZoneEd();
  renderStAlert();
  renderFcTest();
}
function applyHrmax(v){document.getElementById('st-hrmax').value=v;saveSettings();}
function renderFcTest(){
  const el=document.getElementById('st-fctest');if(!el)return;
  const hardRe=/gara|ripetut|fartlek|progress|soglia|sprint|salit|collin|[0-9]\s*[x×]\s*[0-9]/i;
  const cand=runs.filter(r=>r.hrmax&&r.hrmax<=210&&r.hrmax>=150)
    .sort((a,b)=>(b.hrmax-a.hrmax)||(new Date(b.date)-new Date(a.date))).slice(0,3);
  let pick;
  if(cand.length){
    const rows=cand.map(r=>{const isHard=hardRe.test(r.title||'');
      return `<div class="fccand"><div><b>${r.hrmax} bpm</b> <span class="muted">· ${r.date.slice(0,10)} · ${r.title}${isHard?' · sforzo intenso':''}</span></div><button class="btn btn2" style="width:auto;margin:0;padding:5px 10px;font-size:12px" onclick="applyHrmax(${r.hrmax})">Usa</button></div>`;
    }).join('');
    pick=`<p style="margin:6px 0 2px;font-size:12.5px"><b>Dai tuoi dati</b> — gli sforzi con la FC più alta registrata. Usa il valore solo se è reale e non un picco anomalo del sensore:</p>${rows}`;
  }else{
    pick=`<p class="muted" style="margin:6px 0">Nessuno sforzo con FC abbastanza alta nell'archivio: conviene fare il test qui sotto.</p>`;
  }
  el.innerHTML=`<details class="pinfo"><summary>Rifai il test della FC max</summary><div class="pinfo-body">
    ${pick}
    <p style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px"><b>Oppure fai un test apposta, in piano (niente salite).</b> Dopo 15' di riscaldamento progressivo: <b>3 blocchi da 3'</b> a intensità crescente — il 1° controllato, il 2° forte, il 3° quasi a fondo — con 2-3' di corsa lenta tra uno e l'altro; poi chiudi con <b>400-600 m tutto fuori</b>, accelerando fino allo sprint finale. La FC più alta dell'ultimo minuto è la tua FC max: torna qui e impostala. Una pista o un tratto piatto e libero sono l'ideale.</p>
    <p class="muted" style="margin-top:6px">In pratica anche una gara o una seduta di ripetute dure ti portano a ridosso della FC max: spesso basta il valore più alto già registrato qui sopra, senza test dedicato. Meglio con la fascia cardio: i sensori da polso sottostimano i picchi. Non farlo se sei affaticato, malato o non scaldato bene.</p>
  </div></details>`;
}
function renderStAlert(){
  const el=document.getElementById('st-alert');if(!el)return;
  const msgs=[];
  const newest=runs.length?new Date(runs[runs.length-1].date):null;
  if(newest){
    const cutoff=new Date(newest);cutoff.setDate(cutoff.getDate()-120);
    let peak=0,peakDate=null;
    runs.forEach(r=>{const d=new Date(r.date);if(d>=cutoff&&r.hrmax&&r.hrmax<=220&&r.hrmax>peak){peak=r.hrmax;peakDate=r.date.slice(0,10);}});
    if(peak>st.hrmax)msgs.push(`<div class="stwarn"><b>FC max da aggiornare.</b> Il ${peakDate} una corsa ha toccato <b>${peak} bpm</b>, sopra la FC max salvata (${st.hrmax}): le zone sono probabilmente troppo basse. Se è un valore reale (non un errore del sensore), aggiornala.<br><button class="btn btn2" style="width:auto;margin:8px 0 0;padding:6px 10px;font-size:12px" onclick="applyHrmax(${peak})">Imposta FC max a ${peak}</button></div>`);
  }
  const today=new Date();
  if(st.updated){
    const days=Math.round((today-new Date(st.updated))/864e5);
    if(days>=183)msgs.push(`<div class="stwarn soft">Sono passati ~${Math.round(days/30)} mesi dall'ultimo aggiornamento dei parametri (${st.updated}). Vale la pena rimisurare la FC riposo e valutare un nuovo test di FC max.</div>`);
  }else{
    msgs.push(`<div class="stwarn soft">Non hai mai aggiornato i parametri a mano: i valori sono quelli iniziali. Controllali coi tuoi dati e salva.</div>`);
  }
  el.innerHTML=msgs.join('');
  const lu=document.getElementById('st-lastupd');
  if(lu)lu.textContent=st.updated?`Ultimo aggiornamento parametri: ${st.updated}.`:'Parametri mai aggiornati manualmente.';
}
function saveSettings(){st={...st,hrmax:+document.getElementById('st-hrmax').value||188,hrrest:+document.getElementById('st-hrrest').value||53,updated:new Date().toISOString().slice(0,10)};LS('rp_st',st);zCache=null;refresh();alert('Salvato')}
function resetData(){if(confirm('Tornare ai dati iniziali? Import manuali, rinomine ed eliminazioni verranno persi.')){edits={};LS('rp_edits',edits);runs=SEED_RUNS.slice().sort((a,b)=>a.date<b.date?-1:1);LS('rp_runs',[]);refresh()}}
function rManage(){
  document.getElementById('dt-manage').innerHTML=runs.filter(manOk).slice(-40).reverse().map(r=>{const k=r.date+'|'+r.km;
    return `<div class="shoecard"><div style="flex:1"><b>${r.title}</b> <span class="badge ${cls(r)}">${CLSN[cls(r)]}</span><br>
      <span class="muted">${r.date.slice(0,10)} · ${r.km.toFixed(1)} km · ${fmtP(pace(r))}/km${r.hr?' · FC '+r.hr:''}${X[r.date]&&X[r.date].hist?' · <b class="xok">FC 1s</b>':''}${r.nh?' · <b class="down">FC esclusa</b>':''}${r.np&&!r.tm?' · <b class="down">passo escluso</b>':''}${r.nv?' · <b class="down">km esclusi</b>':''}${runLink(r)?' · 🔗 '+(runLink(r)==='none'?'extra':'agganciata'):''}${(()=>{const w=wxDB[r.date],e=wxEffect(w);return e?` · ${Math.round(w.t)}°C${e.pct>=2.5?` <b style="color:${wxLvlCol(e.lvl)}">meteo ${e.lvl}</b>`:''}`:''})()}</span></div>
      <button class="btn btn2" style="width:auto;margin:0 0 0 8px;padding:8px 10px;font-size:12px" onclick="anaOpen('${r.date}')">Analizza</button>
      <button class="btn btn2" style="width:auto;margin:0 0 0 8px;padding:8px 10px;font-size:12px" onclick="renameRun('${k}')">✎</button>
      <button class="btn btn2" style="width:auto;margin:0 0 0 6px;padding:8px 10px;font-size:12px" onclick="delRun('${k}')">✕</button></div>`}).join('');
}
function renameRun(key){
  const i=runs.findIndex(r=>r.date+'|'+r.km===key);if(i<0)return;
  const t=prompt('Nuovo titolo — la categoria segue le parole chiave (gara, soglia, medio, progressivo, fartlek, 8x200, lungo):',runs[i].title);
  if(!t||!t.trim())return;
  edits[key]={title:t.trim()};LS('rp_edits',edits);
  runs[i]={...runs[i],title:t.trim()};refresh();
}
function delRun(key){
  const i=runs.findIndex(r=>r.date+'|'+r.km===key);if(i<0)return;
  if(!confirm(`Eliminare "${runs[i].title}" del ${runs[i].date.slice(0,10)}?`))return;
  edits[key]=null;LS('rp_edits',edits);runs.splice(i,1);refresh();
}

document.getElementById('dt-file').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const added=parseGarmin(rd.result);
      LS('rp_runs',runs);refresh();
      alert(added+' nuove corse importate');
    }catch(err){alert('Errore: '+err.message)}
  };rd.readAsText(f);
});
function csvRows(text){ // parser CSV con virgolette
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true;
    else if(c===','){row.push(cur);cur=''}
    else if(c==='\n'||c==='\r'){if(cur||row.length){row.push(cur);rows.push(row);row=[];cur=''}if(c==='\r'&&text[i+1]==='\n')i++}
    else cur+=c}
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows}
function parseGarmin(text){
  const rows=csvRows(text);const h=rows[0];
  const ix=n=>h.findIndex(x=>x.trim().toLowerCase()===n);
  const iT=ix('tipo di attività'),iD=ix('data'),iTi=ix('titolo'),iDi=ix('distanza'),
        iTe=ix('tempo'),iTM=ix('tempo in movimento'),iH=ix('fc media'),iHM=ix('fc max'),
        iC=ix('cadenza di corsa media'),iA=ix('ascesa totale'),
        iSL=ix('lunghezza media passo'),iVR=ix('rapporto verticale medio'),
        iVO=ix('oscillazione verticale media'),iG=ix('tempo medio di contatto con il suolo');
  if(iD<0||iDi<0)throw new Error('Formato CSV non riconosciuto (serve l’export Attività di Garmin Connect)');
  const dur=t=>{const p=(t||'').split(':');if(p.length===3)return +p[0]*3600+ +p[1]*60+parseFloat(p[2]);if(p.length===2)return +p[0]*60+parseFloat(p[1]);return null};
  const num=s=>{const v=parseFloat((s||'').replace(/,/g,''));return isFinite(v)?v:null};
  const seen=new Set(runs.map(r=>r.date+'|'+r.km));let added=0;
  for(let i=1;i<rows.length;i++){const r=rows[i];if(r.length<5)continue;
    const km=num(r[iDi]),sec=Math.round(dur(r[iTM>=0?iTM:iTe])||dur(r[iTe])||0);
    if(!km||!sec)continue;
    const dyn=i=>{if(i<0)return null;const v=num(r[i]);return v&&v>0?v:null};
    const rec={date:r[iD].slice(0,16),title:r[iTi],km:+km.toFixed(2),sec,
      hr:parseInt(r[iH])||null,hrmax:parseInt(r[iHM])||null,cad:parseInt(r[iC])||null,
      stl:dyn(iSL),vr:dyn(iVR),vo:dyn(iVO),gct:dyn(iG),
      asc:Math.round(num(r[iA])||0),tm:/tapis/i.test(r[iT]||'')?1:0};
    const key=rec.date+'|'+rec.km;
    if(!seen.has(key)){seen.add(key);runs.push(rec);added++}}
  runs.sort((a,b)=>a.date<b.date?-1:1);
  return added}


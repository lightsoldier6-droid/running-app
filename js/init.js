/* ---------- init ---------- */
/* ---------- guida alle sedute (dizionario, ai ritmi attuali) ---------- */
function rGuide(){
  const el=document.getElementById('p-guide');if(!el)return;
  const vd=curVdot();
  if(!vd){el.innerHTML='<p class="muted">Importa qualche corsa per vedere i ritmi delle sedute.</p>';return}
  const p=paces(vd);
  const row=(n,pc,scopo,es)=>`<tr><td><b>${n}</b><br><span class="muted">${scopo}</span></td><td class="r pace" style="white-space:nowrap">${pc}</td><td class="muted">${es}</td></tr>`;
  el.innerHTML=`<table>
   <tr><th>Seduta</th><th class="r">Passo /km</th><th>Esempio</th></tr>
   ${row('Recupero (Z1)','&gt;'+fmtP(p.E[0]),'scioglie le gambe, non aggiunge fatica',"30–50' molto lento")}
   ${row('Fondo / Lungo (Z2)',fmtP(p.E[1])+'–'+fmtP(p.E[0]),'base aerobica, usa i grassi come carburante',"60–120' facili")}
   ${row('Ritmo maratona (M)',fmtP(p.M),'economia di corsa al ritmo dei 42k; nella fase specifica è la seduta del martedì (2 settimane su 3)',"3×3 km → 2×5 → 4×3 → 3×4 → 10 km continui → 2×6 km @ M")}
   ${row('Soglia (T)',fmtP(p.T),'alza la soglia del lattato, ritardi la fatica',"4×8' @ T, rec 2'")}
   ${row('VO2max (I)',fmtP(p.I),'massima potenza aerobica',"6×3' @ I, rec 3'")}
   ${row('Ripetute brevi (R)',fmtP(p.R),'velocità, reattività ed economia','10×200–400m @ R')}
   ${row('Criss-cross',fmtP(p.M)+'↔'+fmtP(p.T),'gestione del lattato e cambi di ritmo gara',"6×6': 3' @ M / 3' @ T")}
   ${row('Simulazione gara',fmtP(p.E[1])+' + '+fmtP(p.M),'prova ritmo, alimentazione e testa',"90–120': Z2 + blocco finale @ M")}
  </table>
  <p class="muted" style="margin-top:10px"><b>Strutture del lungo</b> (fase specifica, in ordine di carico crescente): <b>facile</b> — costruisce base aerobica e tolleranza; <b>progressivo</b> — easy → steady → ritmo gara senza pause; <b>a blocchi RM</b> — 2-3 blocchi a ritmo gara intervallati da easy; <b>fast finish</b> — blocco unico in coda, sulle gambe già stanche; <b>a ritmo gara continuo</b> — blocco unico centrale, chiusura easy; <b>sopra/sotto RM</b> — alternanze appena sopra e appena sotto il ritmo gara, senza recupero vero; <b>big workout</b> — il picco, prova generale di ritmo, fueling e scarpe. Non tutti i lunghi sono qualificati: i lunghi facili intercalati servono a reggere il costo degli altri.</p>
  <p class="muted" style="margin-top:8px">Sedute dure: riscaldamento 10–15' in Z1 + allunghi, defaticamento 10' Z1. Intensità crescente: Z1 recupero &lt; Z2 fondo &lt; M &lt; T &lt; I/R. I passi seguono il tuo VDOT attuale (${vd.toFixed(1)}).</p>`;
}
function refresh(){zCache=null;calCache=null;applyRunFlags();
  try{monFreeze(false)}catch(e){console.warn('monFreeze',e)} // congela nello storico le settimane appena concluse
  rDash();rLoad();rProg();rData();rManage();rAnaSel();rAna();rGuide();rToday();
  const vd=curVdot();if(vd)document.getElementById('p-vdot').value=vd.toFixed(1);
  const wk=weeklyKm().slice(-4).map(([,v])=>v);
  document.getElementById('p-base').value=Math.round(wk.reduce((a,b)=>a+b,0)/Math.max(1,wk.length));
  const savedPlan=LS('rp_plan');
  const pout=document.getElementById('p-out');
  if(savedPlan){
    const gn={5:'5 km',10:'10 km','21.0975':'Mezza',42.195:'Maratona'}[savedPlan.goal]||savedPlan.goal+' km';
    pout.innerHTML=`<div class="card"><p class="muted" style="margin-bottom:8px">Hai un piano salvato: <b>${gn}</b> · ${savedPlan.dateStr} · VDOT ${savedPlan.vd}. Non lo mostro finché non lo apri o rigeneri.</p>
      <button class="btn btn2" style="margin:0" onclick="showPlan()">Mostra ultimo piano</button></div>`;
  }else pout.innerHTML='';
  rTrack();rMonitor();
  try{rGoal()}catch(e){console.warn('rGoal',e)}
  try{rOutlook()}catch(e){console.warn('rOutlook',e)}
  setTimeout(()=>{wxSync().catch(e=>console.warn('wxSync',e))},1500);
  try{rFit()}catch(e){console.warn('rFit',e)}
  try{rAlerts()}catch(e){console.warn('rAlerts',e)}
  try{rNotes()}catch(e){console.warn('rNotes',e)}
  try{rXt()}catch(e){console.warn('rXt',e)}
  try{rMore()}catch(e){console.warn('rMore',e)}
  const gc=document.getElementById('gen-card');if(gc)gc.open=!LS('rp_plan');
  if(curPane==='plan'&&savedPlan)try{rPlan(savedPlan)}catch(e){console.warn(e)}
  lastRenderDay=todayISO();
}
/* Tutto ciò che è "oggi" viene calcolato durante il rendering, e il rendering avviene una volta sola
   al caricamento. Su un'app installata sul telefono la pagina resta aperta per giorni: senza questo
   controllo, a mezzanotte la seduta del giorno, la settimana in corso e l'aderenza resterebbero
   ferme al giorno in cui l'hai aperta. Al cambio di data si ridisegna tutto. */
let lastRenderDay=null;
function checkDayRollover(){
  if(lastRenderDay&&todayISO()!==lastRenderDay)refresh();
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDayRollover()});
window.addEventListener('focus',checkDayRollover);
window.addEventListener('pageshow',checkDayRollover);
setInterval(checkDayRollover,60000);
function showPlan(){const p=LS('rp_plan');if(p)rPlan(p)}
document.querySelectorAll('#pr-pills .pill').forEach(pl=>pl.onclick=()=>{
  document.querySelectorAll('#pr-pills .pill').forEach(x=>x.classList.remove('on'));pl.classList.add('on');
  const m=+pl.dataset.m;
  if(!m){prRange={from:null,to:null};document.getElementById('pr-from').value='';document.getElementById('pr-to').value=''}
  else{const to=new Date(),from=new Date();from.setMonth(from.getMonth()-m);
    prRange={from:isoLoc(from),to:isoLoc(to)};
    document.getElementById('pr-from').value=prRange.from;document.getElementById('pr-to').value=prRange.to}
  rProg();
});
['pr-from','pr-to'].forEach(id=>document.getElementById(id).onchange=()=>{
  prRange={from:document.getElementById('pr-from').value||null,to:document.getElementById('pr-to').value||null};
  document.querySelectorAll('#pr-pills .pill').forEach(x=>x.classList.remove('on'));
  rProg();
});
document.getElementById('pr-metric').onchange=()=>rProg();
document.getElementById('a-sel').onchange=()=>rAna();
refresh();
// update(): controlla subito se c'è una versione nuova del service worker (register da solo non lo fa)
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').then(r=>r.update()).catch(()=>{});

/* ---------- tema chiaro/scuro ---------- */
function applyTheme(t){
  document.body.classList.toggle('dark',t==='dark');
  document.querySelector('meta[name="theme-color"]').setAttribute('content',t==='dark'?'#101114':'#f2f3f5');
  document.getElementById('thm').textContent=t==='dark'?'☀️':'🌙';
}
document.getElementById('thm').onclick=()=>{
  const t=document.body.classList.contains('dark')?'light':'dark';
  localStorage.setItem('rp_theme',t);applyTheme(t);
};
document.getElementById('acct').onclick=e=>{e.stopPropagation();const p=document.getElementById('acct-pop');p.hidden=!p.hidden;};
document.addEventListener('click',e=>{const p=document.getElementById('acct-pop');if(p&&!p.hidden&&!p.contains(e.target)&&!e.target.closest('#acct'))p.hidden=true;});
applyTheme(localStorage.getItem('rp_theme')||'light');

/* ---------- storage ---------- */
let calCache=null; // calendario composto del Monitor (calSessions in monitor.js): si butta quando cambia una sua fonte
const LS=(k,v)=>{
  if(v===undefined) return JSON.parse(localStorage.getItem(k)||'null');
  // ogni scrittura del piano porta l'ora (informativa: dice quando il piano è stato toccato l'ultima volta)
  if(k==='rp_plan'&&v&&typeof v==='object')v.savedAt=new Date().toISOString();
  localStorage.setItem(k,JSON.stringify(v));
  if(k==='rp_plan'||k==='rp_wkedit'||k==='rp_wkskip'||k==='rp_flex'||k==='rp_monitor')calCache=null;
  if(k==='rp_runs'||k==='rp_lapsdb'||k==='rp_edits'||k==='rp_st'||k==='rp_monitor'||k==='rp_plan'||k==='rp_ics'||k==='rp_wkedit'||k==='rp_wkskip'||k==='rp_flex'||k==='rp_wx'||k==='rp_xt') pushCloud();
  return v;
};
let edits=LS('rp_edits')||{}; // rinomine ed eliminazioni manuali, sopravvivono ai rebuild
let runs=(()=>{ // unione seed (aggiornato dallo script di sync) + import manuali, senza duplicati
  const seen=new Set(),out=[];
  [...SEED_RUNS,...(LS('rp_runs')||[])].forEach(r=>{const k=r.date+'|'+r.km;if(!seen.has(k)){seen.add(k);out.push(r)}});
  const fin=[];
  out.forEach(r=>{const e=edits[r.date+'|'+r.km];if(e===null)return;fin.push(e&&e.title?{...r,title:e.title}:r)});
  fin.sort((a,b)=>a.date<b.date?-1:1);return fin})();
let lapsDB=Object.assign({},typeof SEED_LAPS!=='undefined'?SEED_LAPS:{},LS('rp_lapsdb')||{});
let st=LS('rp_st')||{hrmax:188,hrrest:53};
/* ---------- dati esclusi a mano e aggancio manuale al piano (ripresi da RunZones) ----------
   st.ign[run.date] = {hr,pace,vol}: la corsa resta, ma il dato sbagliato smette di alimentare le analisi.
     · FC esclusa  → niente zone, minuti di soglia, forma da FC, previsioni da FC (km e passo restano)
     · passo escluso → fuori da VDOT, migliori tratti, passo per zona, efficienza (FC e km restano)
     · km esclusi  → fuori dal volume settimanale e dal carico (FC e passo restano)
   Si applica come flag sull'oggetto corsa (nh / np / nv), così le funzioni esistenti filtrano con un test.
   st.links[run.date] = 'AAAA-MM-GG' (seduta del piano a cui la corsa va agganciata) | 'none' (corsa extra). */
function applyRunFlags(){
  const IG=st.ign||{};
  (typeof runs!=='undefined'?runs:[]).forEach(r=>{
    const g=IG[r.date]||{};
    if(g.hr){if(!('_hr' in r)){r._hr=r.hr??null;r._hrmax=r.hrmax??null}r.hr=null;r.hrmax=null;r.nh=true}
    else{if('_hr' in r){r.hr=r._hr;r.hrmax=r._hrmax;delete r._hr;delete r._hrmax}delete r.nh}
    r.np=!!(r.tm||g.pace);r.nv=!!g.vol;
  });
}
const vk=r=>r.nv?0:r.km; // km che contano per volume e carico
const runLink=r=>((st&&st.links)||{})[r.date]||null;
const runDay=r=>{const l=runLink(r);return l&&l!=='none'?l:r.date.slice(0,10)}; // giorno di piano a cui la corsa vale
function setRunIgn(date,k,on){st.ign=st.ign||{};const g=st.ign[date]=st.ign[date]||{};if(on)g[k]=1;else delete g[k];
  if(!Object.keys(g).length)delete st.ign[date];LS('rp_st',st);zCache=null;refresh()}
function setRunLink(date,v){st.links=st.links||{};if(v)st.links[date]=v;else delete st.links[date];LS('rp_st',st);refresh()}
applyRunFlags();
let monitor=LS('rp_monitor')||null; // STORICO del calendario (settimane concluse) + metadati: vedi calSessions in monitor.js


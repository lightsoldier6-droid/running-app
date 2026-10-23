/* Local integration: completed strength sessions are projected into RunPlan's
   existing calendar/load readers. They are never copied into rp_xt or uploaded. */
(function(){
  const KEY='passo-v1';
  function gymState(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');return s?.version===1&&Array.isArray(s.history)?s:null;}catch{return null;}}
  window.runPlanGymActivities=function(){const s=gymState();return (s?.history||[]).filter(h=>h.type==='gym'&&Number.isFinite(h.minutes)&&h.minutes>0&&Number.isFinite(h.rpe)&&h.rpe>=1&&h.rpe<=10&&/^\d{4}-\d{2}-\d{2}$/.test(h.date)&&typeof h.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(h.id)).map(h=>{const d=new Date(h.startedAt||h.endedAt),time=Number.isFinite(d.getTime())?`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:'12:00';return {id:'passo-'+h.id,date:h.date+' '+time,sport:'gym',min:h.minutes,rpe:h.rpe,hr:null,note:'Total Body '+(h.routine==='B'?'B':'A'),src:'passo'};});};
  const safeHash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);};
  let lastGymSignature=JSON.stringify(window.runPlanGymActivities());
  window.RunPlanGym={
    getRuns(){return (typeof runs!=='undefined'?runs:[]).filter(r=>Number.isFinite(r.km)&&r.km>0&&Number.isFinite(r.sec)&&r.sec>0).map(r=>({id:'runplan-'+safeHash(r.date+'|'+r.km),type:'run',source:'runplan',date:r.date.slice(0,10),kind:typeof cls==='function'&&cls(r)==='long'?'long':typeof cls==='function'&&['qual','int','race'].includes(cls(r))?'quality':'easy',km:r.km,minutes:r.sec/60,rpe:Number.isInteger(r.rpe)&&r.rpe>=1&&r.rpe<=10?r.rpe:null,note:r.title||'Corsa RunPlan',endedAt:Date.parse(r.date.replace(' ','T'))||0}));},
    openRuns(){showPane('runs');},
    changed(){const sig=JSON.stringify(window.runPlanGymActivities());if(sig===lastGymSignature)return;lastGymSignature=sig;try{if(typeof refresh==='function')refresh();}catch(e){console.warn('Riepilogo palestra',e);}},
    isDark(){return document.body.classList.contains('dark');}
  };
  window.addEventListener('storage',event=>{if(event.key===KEY)window.RunPlanGym.changed();});
})();

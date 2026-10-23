/* ---------- render progressi ---------- */
const DYN={cad:{n:'Cadenza',u:'passi/min',dir:1,f:v=>v.toFixed(0)},stl:{n:'Lunghezza passo',u:'m',dir:1,f:v=>v.toFixed(2)},
  vr:{n:'Rapporto verticale',u:'%',dir:-1,f:v=>v.toFixed(1)},vo:{n:'Oscillazione verticale',u:'cm',dir:-1,f:v=>v.toFixed(1)},
  gct:{n:'Contatto col suolo',u:'ms',dir:-1,f:v=>v.toFixed(0)}};
function rProg(){
  const list=fRuns();
  // VDOT: con la linea dell'obiettivo del piano, se c'è
  let gV=null;try{const g=goalTarget();if(g)gV=vdotOf(g.km,g.sec)}catch(e){}
  chart('c-vdot',monthlyVdot(runs),{ // in Gara: tutto lo storico, non il periodo di Progressi
   ylab:v=>v.toFixed(1),unit:'VDOT',better:'up',
    ref:gV?[{y:gV,lab:'obiettivo '+gV.toFixed(1),c:'var(--ok)'}]:[],
    each:'Ogni punto = la prestazione più forte (gara o sforzo massimo) dei 60 giorni prima di quella data, convertita in VDOT'});
  // volume: la settimana in corso è parziale, la segno più chiara
  const curWk=weekKey(todayISO()+' 12:00');
  const wkRaw=weeklyKm(list).slice(-40);
  const wk=wkRaw.map(([k,v])=>({x:labDay(k),y:+v.toFixed(1),o:k===curWk?.4:1,vl:`${v.toFixed(0)} km`,t:k===curWk?`${v.toFixed(0)} km (in corso)`:`${v.toFixed(0)} km`}));
  const wDone=wkRaw.filter(([k])=>k!==curWk).map(([,v])=>v),l4=wDone.slice(-4);
  const wMax=wkRaw.reduce((a,b)=>b[1]>a[1]?b:a,wkRaw[0]||['',0]);
  chart('c-vol',wk,{bar:true,color:'var(--acc2)',unit:'km a settimana',ylab:v=>v.toFixed(0),avg:true,
    each:'Ogni barra = km di una settimana (lun–dom)'+(wkRaw.length&&wkRaw[wkRaw.length-1][0]===curWk?'; l’ultima, più chiara, è quella in corso':''),
    extra:(l4.length?`media ultime 4 concluse <b>${Math.round(mean(l4))} km</b>`:'')+(wMax[0]?` · più alta ${Math.round(wMax[1])} km (${labDay(wMax[0])})`:'')});
  const ge=groupAvg(list.filter(r=>cls(r)==='easy'&&!r.np),r=>pace(r),r=>r.km); // ponderata sui km = sec totali/km totali
  chart('c-easy',ge,{ylab:fmtP,pace:true,invertY:true,better:'down',up:'↑ più veloce',unit:'min/km',color:'var(--warn)',
    each:`Ogni punto = passo medio delle corse facili ${ge.per==='mese'?'del mese':'della settimana'} (pesato sui km)`});
  const gf=groupAvg(list.filter(r=>cls(r)==='easy'&&r.hr&&!r.np),r=>r.km*1000/(r.hr*r.sec/60),r=>r.hr*r.sec/60); // ponderata sui battiti = metri totali/battiti totali
  chart('c-eff',gf,{ylab:v=>v.toFixed(2),unit:'metri per battito',better:'up',dfmt:v=>v.toFixed(2),
    each:`Ogni punto = corse facili ${gf.per==='mese'?'del mese':'della settimana'}`});
  const mk=document.getElementById('pr-metric').value||'cad';const M=DYN[mk];
  const gd=groupAvg(list.filter(r=>r[mk]!=null&&!r.tm),r=>r[mk]);
  chart('c-dyn',gd,{ylab:M.f,invertY:M.dir<0,better:M.dir>0?'up':'down',unit:M.u,color:'var(--acc2)',
    each:`Ogni punto = media ${gd.per==='mese'?'del mese':'della settimana'}`});
  document.getElementById('dyn-note').textContent=`${M.n} (${M.u}): ${M.dir>0?'più alto':'più basso'} = meglio, a parità di ritmo.${M.dir<0?' Il grafico è capovolto: in alto c’è il valore migliore.':''}`;
  document.getElementById('c-pb').innerHTML='<tr><th>Distanza</th><th class="r">Tempo</th><th class="r">Passo</th><th class="r">Quando</th></tr>'+pbs();
  rRecap();rPaces();rCmp();rAnaSel();rAna();
}

/* ---------- miglioramento passi di allenamento (E/M/T/I/R) nel periodo ---------- */
function rPaces(){
  const el=document.getElementById('c-paces');
  const list=fRuns().filter(r=>!r.tm);
  if(list.length<6){el.innerHTML='<p class="muted">Servono più corse nel periodo selezionato per un confronto.</p>';return}
  const t0=day(list[0].date).getTime(),t1=day(list[list.length-1].date).getTime();
  const span=(t1-t0)/864e5;
  if(span<21){el.innerHTML='<p class="muted">Periodo troppo breve per un confronto (minimo ~3 settimane).</p>';return}
  const win=Math.min(28,span/2)*864e5;
  const A=list.filter(r=>day(r.date).getTime()<=t0+win);
  const B=list.filter(r=>day(r.date).getTime()>=t1-win);
  const vA=bestVdot(A),vB=bestVdot(B);
  if(!vA||!vB){el.innerHTML='<p class="muted">Dati insufficienti per stimare il VDOT a inizio e fine periodo.</p>';return}
  const pA=paces(vA),pB=paces(vB);
  const mid=e=>(e[0]+e[1])/2;
  const rows=[
    ['Easy (E)',mid(pA.E),mid(pB.E)],
    ['Maratona (M)',pA.M,pB.M],
    ['Soglia (T)',pA.T,pB.T],
    ['Interval (I)',pA.I,pB.I],
    ['Reps (R)',pA.R,pB.R]
  ];
  const rowsHtml=rows.map(([n,a,b])=>{
    const d=a-b,sig=Math.abs(d)>=1; // d>0: passo fine periodo più veloce (meno sec/km)
    return `<tr><td>${n}</td><td class="r muted">${fmtP(a)}</td><td class="r">${fmtP(b)}</td>
      <td class="r ${!sig?'':d>0?'up':'down'}">${!sig?'≈':(d>0?'▲ -':'▼ +')+Math.abs(d).toFixed(0)+'s'}</td></tr>`;
  }).join('');
  const tot=rows.reduce((s,[,a,b])=>s+(a-b),0);
  let verdict;
  if(tot>=8)verdict='<b>Passi in netto miglioramento.</b> A parità di zona alleni ritmi sensibilmente più veloci rispetto a inizio periodo.';
  else if(tot>=2)verdict='<b>Passi in leggero miglioramento.</b> Il progresso c\'è, anche se contenuto.';
  else if(tot>-2)verdict='<b>Passi stabili.</b> Nessuna variazione significativa nel periodo.';
  else verdict='<b>Passi in rallentamento.</b> I ritmi di riferimento sono più lenti che a inizio periodo: normale dopo un carico alto, un infortunio o in piena estate.';
  el.innerHTML=`<p class="muted" style="margin-bottom:6px">Passi stimati da VDOT (metodo Daniels) — inizio vs fine periodo (${list[0].date.slice(0,10)} → ${list[list.length-1].date.slice(0,10)})</p>
    <table><tr><th>Zona</th><th class="r">Inizio</th><th class="r">Fine</th><th class="r">Δ</th></tr>${rowsHtml}</table>
    <p style="margin-top:10px">${verdict}</p>
    <p class="muted" style="margin-top:4px">VDOT: ${vA.toFixed(1)} → ${vB.toFixed(1)}. Variazioni sotto 1s/km = stabili (≈).</p>`;
}

/* ---------- bilancio del periodo ---------- */
function rRecap(){
  const el=document.getElementById('c-recap');
  const list=fRuns().filter(r=>!r.tm);
  if(list.length<6){el.innerHTML='<p class="muted">Servono più corse nel periodo selezionato per un bilancio.</p>';return}
  const t0=day(list[0].date).getTime(),t1=day(list[list.length-1].date).getTime();
  const span=(t1-t0)/864e5;
  if(span<21){el.innerHTML='<p class="muted">Periodo troppo breve per un bilancio (minimo ~3 settimane).</p>';return}
  const win=Math.min(28,span/2)*864e5;
  const A=list.filter(r=>day(r.date).getTime()<=t0+win);
  const B=list.filter(r=>day(r.date).getTime()>=t1-win);
  const avg=(a,f)=>{const v=a.map(f).filter(x=>x!=null&&isFinite(x));return v.length?v.reduce((x,y)=>x+y)/v.length:null};
  const wavg=(a,num,den)=>{let n=0,d=0;a.forEach(r=>{const x=num(r),y=den(r);if(x!=null&&y!=null&&isFinite(x)&&y>0){n+=x;d+=y}});return d?n/d:null}; // media ponderata
  const easyA=A.filter(r=>cls(r)==='easy'),easyB=B.filter(r=>cls(r)==='easy');
  const wpace=a=>wavg(a,r=>r.sec,r=>r.km); // sec totali / km totali
  const eff=a=>wavg(a.filter(r=>r.hr),r=>r.km*1000,r=>r.hr*r.sec/60); // metri totali / battiti totali
  const wkKm=a=>{if(a.length<2)return null;const d=(day(a[a.length-1].date)-day(a[0].date))/864e5+1;return a.reduce((s,r)=>s+vk(r),0)/Math.max(1,d/7)};
  const vA=wkKm(A);
  // il passo easy non si giudica "più veloce = meglio": conta quanto sta dentro la fascia E prescritta dal VDOT del momento
  const eRange=vd=>vd?paces(vd).E:null; // [lento, veloce]
  const eDev=(v,E)=>(v==null||!E)?null:(v>E[0]?v-E[0]:(v<E[1]?v-E[1]:0)); // >0 troppo lento, <0 troppo veloce, 0 in fascia
  const eNote=d=>d==null?'':d===0?' <span class="up" style="font-size:11px">in fascia</span>':` <span class="muted" style="font-size:11px">${Math.abs(d).toFixed(0)}s ${d<0?'troppo veloce':'troppo lento'}</span>`;
  const M=[ // [nome, A, B, formato, direzione buona, soglia significatività, fasce E per il passo easy]
    ['VDOT',bestVdot(A),bestVdot(B),v=>v.toFixed(1),1,0.3],
    ['Passo easy',wpace(easyA),wpace(easyB),v=>fmtP(v)+'/km',-1,3,{a:eRange(bestVdot(A)),b:eRange(bestVdot(B))}],
    ['Efficienza (m/battito)',eff(easyA),eff(easyB),v=>v.toFixed(2),1,0.03],
    ['Volume settimanale',vA,wkKm(B),v=>v.toFixed(0)+' km',1,vA?Math.max(2,vA*0.05):2],
    ['Cadenza',avg(A,r=>r.cad),avg(B,r=>r.cad),v=>v.toFixed(0)+' spm',1,1],
    ['Contatto suolo',avg(A,r=>r.gct),avg(B,r=>r.gct),v=>v.toFixed(0)+' ms',-1,3]
  ];
  let up=0,down=0,rows='';
  M.forEach(([n,a,b,f,dir,thr,rng])=>{
    if(a==null||b==null)return;
    const d=b-a;let sig=Math.abs(d)>=thr,good=d*dir>0,nA='',nB='';
    if(rng&&rng.a&&rng.b){
      const da=eDev(a,rng.a),db=eDev(b,rng.b);
      if(da!=null&&db!=null){
        good=Math.abs(db)<Math.abs(da);           // avvicinarsi alla fascia è il miglioramento
        sig=Math.abs(Math.abs(db)-Math.abs(da))>=thr;
        nA=eNote(da);nB=eNote(db);
      }
    }
    if(sig)good?up++:down++;
    rows+=`<tr><td>${n}</td><td class="r muted">${f(a)}${nA}</td><td class="r">${f(b)}${nB}</td>
      <td class="r ${!sig?'':good?'up':'down'}">${!sig?'≈':(good?'▲':'▼')}</td></tr>`;
  });
  const net=up-down;let verdict;
  if(net>=3)verdict='<b>Netto miglioramento.</b> La condizione è cresciuta su quasi tutti i fronti: il lavoro sta pagando.';
  else if(net>=1)verdict='<b>In progresso.</b> I segnali positivi prevalgono: consolida con costanza, senza forzare la rampa.';
  else if(net===0)verdict='<b>Stabile.</b> Nessuna variazione rilevante: normale in mantenimento, dopo uno scarico o in piena estate.';
  else verdict='<b>Periodo interlocutorio.</b> Alcune metriche sono arretrate: caldo, stanchezza o poco volume. Può valere la pena ricalibrare il piano dai dati reali.';
  el.innerHTML=`<p class="muted" style="margin-bottom:6px">Prime ~4 settimane vs ultime ~4 del periodo (${list[0].date.slice(0,10)} → ${list[list.length-1].date.slice(0,10)})</p>
    <table><tr><th>Metrica</th><th class="r">Inizio</th><th class="r">Fine</th><th class="r"></th></tr>${rows}</table>
    <p style="margin-top:10px">${verdict}</p>
    <p class="muted" style="margin-top:4px">${up} metriche migliorate · ${down} peggiorate · variazioni sotto soglia = stabili (≈). Il passo easy è valutato sulla fascia E prescritta dal VDOT del periodo, non in assoluto.</p>`;
}

/* ---------- confronto ultima vs simile ---------- */
function rCmp(){
  const el=document.getElementById('c-cmp');
  if(!runs.length){el.innerHTML='';return}
  const last=runs[runs.length-1],c=cls(last),st=subType(last);
  let prev=null,crit='';
  // 1) stesso sottotipo di allenamento (es. ripetute 200m, soglia, progressivo)
  if(st)for(let i=runs.length-2;i>=0;i--){const r=runs[i];
    if(cls(r)===c&&subType(r)===st&&!r.tm===!last.tm){prev=r;crit='stesso tipo di seduta: '+st;break}}
  // 2) stessa tipologia + distanza simile
  if(!prev)for(let i=runs.length-2;i>=0;i--){const r=runs[i];
    if(cls(r)===c&&Math.abs(r.km-last.km)/last.km<=0.25&&!r.tm===!last.tm){prev=r;crit='stessa tipologia ('+CLSN[c]+'), distanza simile';break}}
  // 3) stessa tipologia
  if(!prev)for(let i=runs.length-2;i>=0;i--){const r=runs[i];
    if(cls(r)===c&&!r.tm===!last.tm){prev=r;crit='stessa tipologia ('+CLSN[c]+')';break}}
  if(!prev){el.innerHTML='<p class="muted">Nessuna corsa simile precedente trovata.</p>';return}
  const mb=r=>r.hr?r.km*1000/(r.hr*r.sec/60):null;
  const rows=[
    ['Passo',r=>pace(r),v=>fmtP(v)+'/km',-1,v=>Math.abs(v).toFixed(0)+'s/km'],
    ['FC media',r=>r.hr,v=>v+' bpm',-1,v=>Math.abs(v).toFixed(0)+' bpm'],
    ['m/battito',mb,v=>v.toFixed(2),1,v=>Math.abs(v).toFixed(2)],
    ['Cadenza',r=>r.cad,v=>v+' spm',1,v=>Math.abs(v).toFixed(0)],
    ['Lung. passo',r=>r.stl,v=>v.toFixed(2)+' m',1,v=>Math.abs(v).toFixed(2)],
    ['Rapp. verticale',r=>r.vr,v=>v.toFixed(1)+'%',-1,v=>Math.abs(v).toFixed(1)],
    ['Oscillazione',r=>r.vo,v=>v.toFixed(1)+' cm',-1,v=>Math.abs(v).toFixed(1)],
    ['Contatto suolo',r=>r.gct,v=>v.toFixed(0)+' ms',-1,v=>Math.abs(v).toFixed(0)]
  ].map(([n,get,fmt,dir,dfmt])=>{
    const a=get(prev),b=get(last);
    if(a==null||b==null)return'';
    const d=b-a,good=d*dir>0,zero=Math.abs(d)<1e-9;
    return `<tr><td>${n}</td><td class="r muted">${fmt(a)}</td><td class="r">${fmt(b)}</td>
      <td class="r ${zero?'':good?'up':'down'}">${zero?'=':(d>0?'+':'−')+dfmt(d)}</td></tr>`}).join('');
  el.innerHTML=`<p class="muted" style="margin-bottom:4px"><b>${last.title}</b> (${last.date.slice(0,10)}, ${last.km.toFixed(1)} km, ${CLSN[c]})
    vs <b>${prev.title}</b> (${prev.date.slice(0,10)}, ${prev.km.toFixed(1)} km)</p>
    <p class="muted" style="margin-bottom:8px">Criterio: ${crit}</p>
    <table><tr><th></th><th class="r">Prima</th><th class="r">Ultima</th><th class="r">Δ</th></tr>${rows}</table>`;
}


/* ---------- piano ---------- */
const rngP=(s,t=3)=>`${fmtP(s-t)}–${fmtP(s+t)}`; // tolleranza ±3s come nel piano 10 settimane
const recF=r=>r%1?`${Math.floor(r)}'30"`:`${r}'`;
// carry (opzionale): come agganciarsi a un piano già in corso.
// · nWeeks — genera sulla STESSA griglia di un piano esistente invece di ricalcolare le settimane da oggi.
//   Con lo stesso totale di settimane (e le stesse gare intermedie) fasi, scarichi e diamante ricadono
//   dove erano: il calendario non si muove, cambiano solo i contenuti delle sedute. È la "rigenerazione
//   in place" del Monitor, che aggiorna passi, tipologie e strutture dei lunghi senza spostare il piano.
// · wOff/lDone/qDone/startTot — a che punto della fase specifica eravamo, per non far ripartire la
//   progressione dei lunghi da zero quando invece il blocco viene ricostruito accorciato.
function genPlan(silent,carry){
  const nFix=(carry&&carry.nWeeks)||0;
  const wOff=(carry&&carry.wOff)||0,lDone=(carry&&carry.lDone)||0,qDone=(carry&&carry.qDone)||0;
  const carryTot=(carry&&carry.startTot)||0;
  const goal=+document.getElementById('p-goal').value;
  const dateStr=document.getElementById('p-date').value;
  const days=+document.getElementById('p-days').value;
  const maraExtraEasy=!!(document.getElementById('p-mara-extra')||{}).checked; // maratona: +1 easy nella fase specifica
  const vd=+document.getElementById('p-vdot').value||curVdot();
  const base=+document.getElementById('p-base').value||30;
  if(!dateStr)return alert('Inserisci la data della gara');
  if(!vd)return alert('Non riesco a stimare il VDOT dalle tue corse: importane qualcuna dal tab Corse, oppure scrivi il VDOT a mano nel campo del tab Piano.');
  // Numero di settimane: si contano le settimane di CALENDARIO (lun-dom) dalla settimana in corso a
  // quella della gara, inclusa. Con il vecchio conteggio (giorni-alla-gara/7 arrotondato) rigenerare a
  // metà settimana poteva produrre una settimana in meno: siccome il tab Piano ricalcola le date a
  // ritroso dalla domenica di gara, l'intera griglia scivolava di 7 giorni e si sfalsava dal Monitor.
  let n=nFix;
  if(!n){
    const _add=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x};
    const _race=dOnly(dateStr);
    const _raceSun=_add(_race,(7-_race.getDay())%7);          // domenica della settimana di gara
    const _today=new Date();_today.setHours(12,0,0,0);
    const _curSun=_add(_today,(7-_today.getDay())%7);         // domenica della settimana in corso
    n=Math.round((_raceSun-_curSun)/(7*864e5))+1;             // +1: la settimana in corso conta
  }
  if(n<6)return alert('Servono almeno 6 settimane alla gara');
  n=Math.min(n,52);
  const p=paces(vd);
  const Ea=(p.E[0]+p.E[1])/2;
  const E=`${fmtP(p.E[1])}–${fmtP(p.E[0])}`,T=rngP(p.T),I=rngP(p.I),R=rngP(p.R),M=rngP(p.M);
  const kmAt=(min,sp)=>min*60/sp;
  const isM=goal>=42,isHM=goal>=21&&!isM;
  const taper=isM&&n>=16?3:n>=12?2:1;
  // periodizzazione: base (endurance) → velocità (VO2max) → specifico (ritmo gara) → taper
  const core=n-taper;
  // fase specifica: fino a 14 sett. quando c'è spazio (≥12 di qualità + ~2 scarichi interni);
  // scende in proporzione sui piani corti, lasciando comunque ≥4 sett. a base+velocità.
  const specW=Math.max(3,Math.min(14,Math.ceil(core*0.4),core-4));
  // gare intermedie (tune-up): distanza + data, comprese tra oggi e la gara finale, ordinate per data
  const interRaces=[['p-r1-dist','p-r1-date'],['p-r2-dist','p-r2-date']]
    .map(([d,t])=>({dist:+((document.getElementById(d)||{}).value)||0,date:((document.getElementById(t)||{}).value)||''}))
    .filter(r=>r.dist>0&&r.date&&new Date(r.date)>Date.now()&&new Date(r.date)<new Date(dateStr))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  const isSummerW=w=>{const wd=dOnly(dateStr);wd.setDate(wd.getDate()-(n-w)*7);return [6,7,8].includes(wd.getMonth()+1);};
  const raceAt={};interRaces.forEach(r=>{const w=n-Math.round((new Date(dateStr)-new Date(r.date))/(7*864e5));if(w>=2&&w<=core-1)raceAt[w]=r;});
  // gara intermedia in arrivo entro `within` settimane (per avvicinare il lungo alla distanza gara)
  const nextRaceWithin=(w,within)=>{for(let k=1;k<=within;k++)if(raceAt[w+k])return raceAt[w+k];return null;};
  // finestra velocità (diamante) su settimane "pulite": non estive, non gara, non recupero post-gara.
  // Cresce all'indietro dall'ultima settimana pre-specifico fino a 10 settimane idonee (blocco pulito da 10),
  // lasciando almeno 2 settimane di base. build (base+speed) = core-specW resta invariato.
  const endSpeed=core-specW;
  // BLOCCO SPECIFICO PER LA PRIMA GARA INTERMEDIA.
  // La prima gara intermedia vera (≥10 km: tipicamente la mezza d'autunno dentro un blocco maratona
  // lungo) non è solo un tune-up. Dieci settimane di base indifferenziata la sprecano: 3-5 settimane di
  // lavoro specifico prima — volume a soglia + ritmo gara nel lungo — alzano la soglia, e quel guadagno
  // resta dentro il blocco maratona che segue. Le gare intermedie SUCCESSIVE restano tune-up puri
  // (mini-scarico, gara, recupero): a quel punto il piano ha già la sua fase specifica da difendere.
  // Il blocco si chiude 2 settimane prima della gara: l'ultima è il mini-scarico pre-gara.
  let iSpec=null;
  {
    // SOLO la prima gara intermedia in ordine di data: le successive sono verifiche dentro un piano
    // che ha già una sua fase specifica, e mettere un secondo blocco le toglierebbe settimane.
    const wR=Object.keys(raceAt).map(Number).sort((a,b)=>a-b)[0];
    const r0=wR&&raceAt[wR].dist>=10?raceAt[wR]:null; // sotto i 10 km non vale un blocco dedicato
    // deve stare dentro il build (non invade la fase specifica della gara obiettivo) e lasciare
    // almeno 2 settimane di base davanti, per non partire con la qualità dal primo giorno
    if(r0&&wR<=endSpeed){
      const len=Math.min(4,wR-4);
      if(len>=3)iSpec={dist:r0.dist,date:r0.date,w0:wR,len,start:wR-1-len,end:wR-2};
    }
  }
  // la fase copre anche il mini-scarico pre-gara e la settimana di gara: sono il finale del blocco,
  // non un ritorno alla base (il contenuto di quelle settimane resta però quello dei tune-up)
  const inIspec=w=>!!iSpec&&w>=iSpec.start&&w<=iSpec.w0;
  const eligibleW=w=>!isSummerW(w)&&!raceAt[w]&&!raceAt[w-1]&&!inIspec(w);
  let start=endSpeed+1,elig=0;
  while(start-1>=3&&elig<10){start--;if(eligibleW(start))elig++;}
  let baseW=Math.max(1,start-1),speedW=endSpeed-baseW;
  const build=baseW+speedW;
  // modalità obiettivo: quanti punti VDOT punto a guadagnare nel blocco
  const mode=document.getElementById('p-mode').value||'mod';
  const GAIN={cons:0,mod:Math.min(0.12*n,3),amb:Math.min(0.21*n,5)};
  const CEIL=Math.min(0.30*n,7);       // oltre = irrealistico
  const permo=n/4.345;                  // mesi disponibili
  const volK={cons:1,mod:1.05,amb:1.12}[mode]||1;
  const peak=Math.min(base*(baseW>4?1.55:1.4)*volK,(goal>=42?90:goal>=21?75:60)*volK);
  // VDOT target = forma attuale + guadagno atteso; il tempo obiettivo esplicito lo sovrascrive
  const gNm=goal>=42?'maratona':goal>=21?'mezza':goal+' km';
  let vdTarget=vd+(GAIN[mode]||0);
  let modeLabel={cons:'Conservativo',mod:'Moderato',amb:'Ambizioso'}[mode]||'Moderato';
  let targetSet=false;
  const tgtStr=(document.getElementById('p-target').value||'').trim();
  if(tgtStr){
    const ts=parseHMS(tgtStr);
    if(ts==null){if(!silent)return alert('Tempo obiettivo non valido. Usa hh:mm:ss oppure mm:ss (es. 3:45:00 o 42:30).');}
    else{
    const vdReq=vdotOf(goal,ts),dv=vdReq-vd,rate=dv/permo;
    vdTarget=vdReq;targetSet=true;
    const mCav=goal>=42?'\n\nNota maratona: il VDOT estrapolato è meno affidabile su 42 km — contano endurance, volume del lungo e alimentazione.':'';
    if(dv>CEIL){
      modeLabel='Irrealistico';
      if(!silent&&!confirm(`⚠️ Obiettivo poco realistico\n\n${fmtD(ts)} sulla ${gNm} richiede VDOT ${vdReq.toFixed(1)} (ora ${vd.toFixed(1)}): +${dv.toFixed(1)} punti in ${n} settimane, cioè ~${rate.toFixed(1)} punti/mese. Anche chi risponde bene raramente supera ~1 punto/mese.${mCav}\n\nProcedo comunque a costruire il piano su questo tempo?`))return;
    }else if(dv>GAIN.amb*1.1){
      modeLabel='Molto ambizioso';
      if(!silent)alert(`Obiettivo molto ambizioso\n\n${fmtD(ts)} richiede +${dv.toFixed(1)} punti VDOT (~${rate.toFixed(1)}/mese). Possibile ma raro: tienilo come stretch e valuta ${fmtD(predict(goal,vd+GAIN.amb))} come obiettivo primario.${mCav}`);
    }else if(dv>GAIN.mod*1.1)modeLabel='Ambizioso';
    else if(dv>0.1)modeLabel='Moderato';
    else modeLabel='Conservativo';
    }
  }
  // obiettivo come RANGE attorno al VDOT target (ottimista) fino a un margine prudente
  const tFast=predict(goal,vdTarget),tSlow=predict(goal,Math.max(vdTarget-0.8,vd-1.2));
  const GP=`${fmtP(tFast/goal)}–${fmtP(tSlow/goal)}`;
  const GT=`${fmtD(tFast)}–${fmtD(tSlow)}`;
  // ── Base-readiness: il volume attuale regge la gara/data scelte? ──────────────
  // Base minima consigliata per distanza + rampa implicita fino al picco (≤10%/sett prudente).
  let readiness=null;
  {
    const floorByGoal=goal>=42?25:goal>=21?18:goal>=10?12:8;   // km/sett di partenza minimi
    const g=(build>0&&base>0)?Math.pow(peak/base,1/build)-1:0;  // crescita settimanale implicita
    const lowBase=base<floorByGoal, steep=g>0.10;
    if(lowBase||steep){
      const safeBase=Math.round(peak/Math.pow(1.08,build));                          // base che terrebbe ≤8%/sett
      const wkNeed=base>0?Math.ceil(Math.log(peak/base)/Math.log(1.08)):build;
      const extraW=Math.max(0,wkNeed-build);
      const parts=[];
      if(lowBase)parts.push(`Il tuo volume attuale (~${base} km/sett) è sotto la base consigliata per la ${gNm} (~${floorByGoal} km/sett).`);
      if(steep)parts.push(`Per arrivare a ~${Math.round(peak)} km/sett di picco in ${build} settimane la salita sarebbe ~${Math.round(g*100)}%/sett (prudente: ≤10%).`);
      const advice=extraW>0
        ? `Meglio costruire prima la base: ~${extraW} settimana/e in più di corsa facile verso ~${safeBase} km/sett, oppure sposta la gara più in là.`
        : `Parti da ~${safeBase} km/sett e sali gradualmente.`;
      readiness={low:lowBase,steep,floor:floorByGoal,base,peak:Math.round(peak),grow:Math.round(g*100),safeBase,extraW,advice,text:parts.join(' ')};
      if(!silent&&!confirm(`⚠️ Base un po' leggera per questo obiettivo\n\n${parts.join('\n\n')}\n\n${advice}\n\nGenero comunque il piano? Salirà nei limiti di sicurezza, ma le prime settimane saranno più impegnative.`))return;
    }
  }
  // progressione interval a "diamante" (stile piano_10_settimane): discesa fino al picco (20×1'),
  // poi scarico agganciato al picco e risalita speculare con passi più spinti.
  // off = scarto in secondi sul passo I (VDOT): rep lunghe più lente, corte più veloci; risalita 2-3" più veloce.
  const DESC=[{mi:5,nr:8,rec:3,off:8},{mi:4,nr:10,rec:3,off:4},{mi:3,nr:10,rec:2.5,off:0},{mi:2,nr:15,rec:2,off:-5},{mi:1,nr:20,rec:1,off:-10}];
  const ASC=[{mi:2,nr:15,rec:2,off:-8},{mi:3,nr:10,rec:2.5,off:-2},{mi:4,nr:10,rec:3,off:2},{mi:5,nr:8,rec:3,off:6}];
  const buildDiamond=sw=>sw<=0?[]:sw<=5?DESC.slice(5-sw):[...DESC,{deload:true},...ASC.slice(0,Math.min(4,sw-6))];
  // assegna il diamante SOLO alle settimane idonee della finestra velocità (in ordine cronologico)
  const diaByWeek={};
  {const el=[];for(let w=baseW+1;w<=endSpeed;w++)if(eligibleW(w))el.push(w);
   const dia=buildDiamond(Math.min(10,el.length));
   el.slice(0,dia.length).forEach((w,i)=>diaByWeek[w]=dia[i]);}
  // ---- ANCORAGGIO DEL LUNGO AL REALE ----
  // In fase base la rampa era `70 + w*4`, legata all'INDICE della settimana nel piano: rigenerando a
  // metà blocco prescriveva 100' a chi nelle ultime sei settimane non era mai uscito oltre i 66'.
  // (Le altre fasi non hanno il problema: `speed` riparte dall'inizio del proprio blocco, `ispec` è
  // vincolata al volume della settimana, la `spec` maratona usa già il carry del reale.)
  // Ora si parte dal lungo più lungo DAVVERO corso di recente e si cresce ~12% per settimana carica.
  // Le gare sono escluse dal seme: una mezza corsa a settembre non è una seduta ripetibile la domenica dopo.
  const longSeed=(()=>{
    const rs=(typeof runs!=='undefined'&&runs)||[];
    const rec=rs.filter(r=>!r.tm&&daysAgo(r)<42&&cls(r)!=='race');
    return rec.length?Math.max(...rec.map(r=>r.sec/60)):null;
  })();
  const wNow=(()=>{
    const _a=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x};
    const _r=dOnly(dateStr),_rs=_a(_r,(7-_r.getDay())%7);
    const _t=new Date();_t.setHours(12,0,0,0);const _cs=_a(_t,(7-_t.getDay())%7);
    return n-Math.round((_rs-_cs)/(7*864e5));
  })();
  // quante settimane CARICHE ci sono fra oggi e la settimana w: scarichi, settimane gara e recuperi
  // non fanno progredire il lungo, quindi non devono consumare uno scalino della rampa
  const buildIdx=ww=>{let i=0;for(let k=Math.max(1,wNow);k<ww;k++){
    if(k%4===0&&k!==core)continue;if(raceAt[k]||raceAt[k-1])continue;i++}return i};
  const CR=[[4,8,2],[3,12,3],[5,10,2],[2,20,4]]; // cruise interval @ T: [rip, min, rec]
  const weeks=[];let crx=0,mpx=0,spx=0;
  for(let w=1;w<=n;w++){
    const isTaper=w>core;
    // gare intermedie: settimana gara (tune-up), settimana prima (mini-scarico), settimana dopo (recupero)
    const raceWeek=!isTaper&&raceAt[w]?raceAt[w]:null;
    const recovery=!isTaper&&!raceWeek&&!!raceAt[w-1];
    const preRace=!isTaper&&!raceWeek&&!!raceAt[w+1];
    const diaEntry=(!isTaper&&!raceWeek&&!recovery)?(diaByWeek[w]||null):null; // entry del diamante o {deload}
    const inSpeedRange=!isTaper&&w>baseW&&w<=endSpeed;
    // deload: nella fase velocità è agganciato al picco (dal diamante); nella base/specifico cadenza ogni 4 sett.
    // Dentro il blocco intermedio niente scarico automatico: sono 3-4 settimane e lo scarico è già la
    // settimana pre-gara. Senza questo la cadenza w%4 poteva cadere sulla PRIMA settimana del blocco
    // (visto sul piano reale: 5-11 ott) e mangiarsene una su quattro.
    const noDl=inIspec(w);
    const isDeload=!isTaper&&!raceWeek&&!recovery&&!preRace&&!noDl&&(diaEntry?!!diaEntry.deload:(!inSpeedRange&&w%4===0&&w!==core));
    const phase=isTaper?'taper':inIspec(w)?'ispec':diaEntry?'speed':(inSpeedRange?'base':(w<=baseW?'base':'spec'));
    // ritmi progressivi: il VDOT sale linearmente da attuale (sett.1) a target (fine blocco), poi tenuto nel taper.
    // Questi shadowano p/E/T/I/R/M/Ea del blocco per questa iterazione, così TUTTE le sedute usano i passi della settimana.
    const vdW=vd+(vdTarget-vd)*Math.min(1,w/Math.max(1,core));
    const p=paces(vdW);
    const Ea=(p.E[0]+p.E[1])/2;
    const E=`${fmtP(p.E[1])}–${fmtP(p.E[0])}`,T=rngP(p.T),I=rngP(p.I),R=rngP(p.R),M=rngP(p.M);
    // Mona Fartlek: 20' esatti a piramide discendente (2×90" / 4×60" / 4×30" / 4×15") con recupero
    // attivo di pari durata. 10' di lavoro forte + 10' di float: allena il cambio di ritmo, non la sola velocità.
    const MONA=(wu=15)=>({n:'Fartlek Mona',d:`${wu}' @ ${E} + Mona 20': 2×90" / 4×60" / 4×30" / 4×15" forte @ ${R} (R), recupero di pari durata in corsa scorrevole @ ${E} + ${wu}' @ ${E}`,km:kmAt(wu*2,Ea)+kmAt(20,(p.R+Ea)/2)});
    // stagione: la settimana w termina la domenica raceDate-(n-w)*7gg (calcolo su giorni, non ms: ora legale)
    const wd=dOnly(dateStr);wd.setDate(wd.getDate()-(n-w)*7);
    const mth=wd.getMonth()+1;
    const summer=mth>=6&&mth<=8;
    let vol=base+(peak-base)*Math.min(1,(w-1)/Math.max(1,build-2));
    if(summer&&!isTaper)vol*=0.85; // estate: meno volume
    if(isDeload)vol*=0.65;if(isTaper)vol*=(w===n?0.45:w===n-1?0.6:0.75);
    if(raceWeek)vol*=0.55;else if(recovery)vol*=0.7;else if(preRace)vol*=0.85; // tune-up gare intermedie
    const sp=Math.max(1,w-baseW); // settimana dentro il blocco velocità
    const tmin=18+Math.min(12,sp*2);
    const sess=[];
    if(raceWeek){ // settimana gara intermedia: scarico corto + gara come seduta chiave
      const rd=raceWeek.dist,rp=predict(rd,vdW)/rd,rn=rd>=42?'Maratona':rd>=21?'Mezza':rd+'k';
      sess.push({t:'Martedì',n:'Easy',d:`35' @ ${E}`,km:kmAt(35,Ea)});
      sess.push({t:'Giovedì',n:'Pre-gara',d:`20' @ ${E} + 4×100m allunghi`,km:kmAt(20,Ea)+0.4});
      sess.push({t:'GARA',n:`🏁 ${rn}`,d:`${rd>=21?rd.toFixed(1):rd} km @ ${fmtP(rp)}/km (test)`,km:rd});
    }else if(recovery){ // settimana dopo la gara: recupero
      sess.push({t:'Martedì',n:'Easy',d:`35' @ ${E}`,km:kmAt(35,Ea)});
      sess.push({t:'Giovedì',n:'Easy',d:`40' @ ${E} (Z2)`,km:kmAt(40,Ea)});
      sess.push({t:'Domenica',n:'Lungo ridotto',d:`60' @ ${E}`,km:kmAt(60,Ea)});
    }else if(preRace){ // settimana prima della gara: mini-scarico, gambe fresche
      sess.push({t:'Martedì',n:'Richiami',d:`5×2' @ ${I} (I), rec 2' @ ${E}`,km:3.2+kmAt(10,p.I)+kmAt(8,Ea)+1.7});
      sess.push({t:'Giovedì',n:'Easy',d:`35' @ ${E} + 4 allunghi 80m`,km:kmAt(35,Ea)+0.4});
      sess.push({t:'Domenica',n:'Lungo corto',d:`70' @ ${E}`,km:kmAt(70,Ea)});
    }else if(isDeload){
      sess.push({t:'Martedì',n:'Scarico',d:`40' @ ${E} + 6 allunghi 80m`,km:kmAt(40,Ea)+0.5});
      sess.push({t:'Giovedì',n:'Easy',d:`35' @ ${E}`,km:kmAt(35,Ea)});
      sess.push({t:'Domenica',n:'Lungo ridotto',d:`60' @ ${E}`,km:kmAt(60,Ea)});
    }else if(isTaper){
      const[nr,mi,rec]=w===n?[5,2,2]:[6,3,2.5];
      sess.push({t:'Martedì',n:'Richiami',d:`${nr}×${mi}' @ ${I} (I), rec ${recF(rec)} @ ${E}`,km:3.2+kmAt(nr*mi,p.I)+kmAt((nr-1)*rec,Ea)+1.7});
      sess.push({t:'Giovedì',n:'Ritmo gara',d:w===n?`20' @ ${E} + 10' @ ${GP} (gara)`:`15' @ ${E} + 2×10' @ ${GP} (gara), rec 3' @ ${E}`,km:w===n?kmAt(20,Ea)+kmAt(10,tFast/goal):kmAt(18,Ea)+kmAt(20,tFast/goal)});
      sess.push(w===n?{t:'Domenica',n:'GARA 🏁',d:`${goal>=21?goal.toFixed(1):goal} km @ ${GP}/km — obiettivo ${GT}`,km:goal}
        :{t:'Domenica',n:'Lungo corto',d:`70' @ ${E}`,km:kmAt(70,Ea)});
    }else if(phase==='ispec'){ // specifico gara intermedia: soglia + ritmo gara sulla distanza
      const rd=iSpec.dist,rp=predict(rd,vdW)/rd,RP=rngP(rp);
      const rn=rd>=42?'maratona':rd>=21?'mezza':rd+'k';
      const k=w-iSpec.start+1,L=iSpec.len,prog=L>1?(k-1)/(L-1):1; // posizione nel blocco → 0..1
      // lungo qualificato a settimane alterne, l'ultima sempre: è la seduta più specifica del blocco
      const hasQ=k===L||k%2===0;
      // MARTEDÌ: volume a soglia, il motore della mezza (non le ripetute corte). Progressione dedicata
      // e più contenuta di quella della fase specifica maratona: lì il blocco arriva su un volume molto
      // più alto, qui si innesta su settimane di base e 40' a soglia sono già il tetto.
      const ICR=[[3,8,2],[4,8,2],[3,12,3],[4,10,2.5],[5,8,2]];
      const[cn,cm,crec]=ICR[Math.min(k,ICR.length)-1];
      if(k%2===0)
        sess.push({t:'Martedì',n:'Criss-cross',d:`${cn}×${cm}' alternando ${Math.round(cm/2)}' @ ${RP} (gara) / ${Math.round(cm/2)}' @ ${T} (T), rec ${recF(crec)} @ ${E}`,km:3.2+kmAt(cn*cm,(rp+p.T)/2)+kmAt((cn-1)*crec,Ea)+1.7});
      else
        sess.push({t:'Martedì',n:'Cruise @ soglia',d:`${cn}×${cm}' @ ${T} (T), rec ${recF(crec)} @ ${E}`,km:3.2+kmAt(cn*cm,p.T)+kmAt((cn-1)*crec,Ea)+1.7});
      // GIOVEDÌ: base quando la domenica è qualificata (mai 3 sedute dure), altrimenti ritmo gara
      const nrep=3+Math.round(prog); // 3 → 4 × 2000m
      sess.push(hasQ?{t:'Giovedì',n:'Base',d:`50' @ ${E} (Z2)`,km:kmAt(50,Ea)}
        :{t:'Giovedì',n:`Ritmo ${rn}`,d:`15' @ ${E} + ${nrep}×2000m @ ${RP} (gara), rec 2' @ ${E} + 10' @ ${E}`,km:kmAt(25,Ea)+nrep*2+kmAt((nrep-1)*2,Ea)});
      // DOMENICA: il lungo è la variabile di aggiustamento. Punta verso ~85% della distanza di gara ma
      // non oltre quello che resta del volume della settimana: senza questo vincolo il blocco produceva
      // settimane da 46 km innestate su una base da 30, cioè il modo più rapido per farsi male.
      const oth=sess.reduce((a,x)=>a+x.km,0);
      let lngKm=Math.min(rd*(0.62+0.23*prog),Math.max(kmAt(65,Ea),vol-oth));
      let lng=Math.round(lngKm*Ea/60/5)*5;lngKm=kmAt(lng,Ea);
      if(hasQ){
        // minuti a ritmo gara nel finale: 35' su una mezza sono una seduta chiave, su una 10k sarebbero
        // di fatto la gara — sotto i 21 km il tetto scende a 20'
        const fin=Math.max(15,Math.min(rd>=21?35:20,Math.round((15+prog*20)/5)*5));
        lngKm=lngKm+kmAt(fin,rp)-kmAt(fin,Ea);
        sess.push({t:'Domenica',n:'Lungo specifico',d:`${lng-fin}' @ ${E} + ${fin}' @ ${RP} (ritmo ${rn})`,km:lngKm});
      }else{
        sess.push({t:'Domenica',n:'Lungo',d:`${lng}' @ ${E}`,km:lngKm});
      }
    }else if(phase==='base'){ // endurance: volume, salite, ritmo aerobico (estate: velocità)
      if(summer){
        const SR=[[10,200],[12,200],[8,300],[6,400]];const[rn,rm]=SR[(w-1)%SR.length];
        sess.push({t:'Martedì',n:'Ripetute brevi',d:`${rn}×${rm}m @ ${R} (R), rec ${rm}m corsa lenta`,km:3.2+rn*rm*2/1000+1.7});
        // qualità solo a settimane alterne: nelle altre, base
        const q=w%2===0?{n:'Base',d:`40' @ ${E} (Z2)`,km:kmAt(40,Ea)}
          :w%4===1?{n:'Fartlek leggero',d:`15' @ ${E} + 6×(1' @ ${R} (R) / 1' @ ${E}) + 15' @ ${E}`,km:kmAt(30,Ea)+kmAt(12,(p.R+Ea)/2)}
          :{n:'Medio breve',d:`10' @ ${E} + 15' @ ${T} (T) + 10' @ ${E}`,km:kmAt(20,Ea)+kmAt(15,p.T)};
        sess.push({t:'Giovedì',...q});
      }else{
        const ns=6+Math.min(4,Math.floor(w/3));
        sess.push({t:'Martedì',n:'Easy + allunghi',d:`45' @ ${E} + ${ns}×20" forte in piano (o su rampa breve ~100m se disponibile), rec 1' camminando`,km:kmAt(45,Ea)+0.8});
        const q=w%2===0?{n:'Base',d:`50' @ ${E} (Z2)`,km:kmAt(50,Ea)}
          :w%3===0?{n:'Progressivo',d:`40' continui da ${fmtP(p.E[0])} a ${fmtP(p.T)} (E→T)`,km:kmAt(40,(Ea+p.T)/2)}
          :(w>=5&&w%4===1)?MONA(15) // base avanzata: il fartlek strutturato al posto di quello leggero
          :{n:'Fartlek leggero',d:`15' @ ${E} + 6×(1' @ ${R} (R) / 1' @ ${E}) + 15' @ ${E}`,km:kmAt(30,Ea)+kmAt(12,(p.R+Ea)/2)};
        sess.push({t:'Giovedì',...q});
      }
      // LUNGO base = seduta chiave dell'endurance: cresce col blocco e vale una quota importante del volume.
      const capL=isM?150:isHM?115:95;
      const seedL=longSeed?Math.max(45,longSeed):70; // nessuna corsa recente: si riparte da 70'
      let lng=Math.round(Math.min(seedL*Math.pow(1.12,buildIdx(w)+1),capL)/5)*5;
      if(summer)lng=Math.min(lng,90);
      let lngKm=kmAt(lng,Ea);
      if(lngKm>vol*0.52){lngKm=vol*0.52;lng=Math.round(lngKm*Ea/60/5)*5}
      // avvicinamento gara intermedia (~2 sett. prima): lungo verso ~90% della distanza gara
      {const upR=nextRaceWithin(w,2);if(upR&&!summer){const aKm=Math.min(upR.dist*0.9,vol*0.55);if(aKm>lngKm){lngKm=aKm;lng=Math.round(lngKm*Ea/60/5)*5;}}}
      // ogni ~3ª settimana (non estate, lungo ≥70') il lungo NON è piatto: finale a ritmo gara/soglia
      // per abituarsi a girare veloci sulle gambe stanche, senza toccare il resto del blocco base.
      // Durata nuova e ritmo gara nella stessa seduta, subito dopo uno scarico, è il modo classico
      // per farsi male: il primo lungo qualificato arriva dopo almeno 2 settimane cariche.
      const bStruct=!summer&&lng>=70&&buildIdx(w)>=2&&w>=6&&w%3===0;
      if(bStruct){
        const fp=(isM||isHM)?M:T,fl=(isM||isHM)?'M':'T',fsp=(isM||isHM)?p.M:p.T;
        const fin=Math.max(15,Math.min(30,Math.round(lng*0.3/5)*5)); // ultima parte a ritmo gara
        lngKm=lngKm+kmAt(fin,fsp)-kmAt(fin,Ea);
        sess.push({t:'Domenica',n:'Lungo con finale',d:`${lng-fin}' @ ${E} + ${fin}' @ ${fp} (${fl})`,km:lngKm});
      }else{
        sess.push({t:'Domenica',n:'Lungo',d:`${lng}' @ ${E}${summer?' — presto al mattino, idratazione':''}`,km:lngKm});
      }
    }else if(phase==='speed'){ // VO2max: blocco a diamante (stile piano_10_settimane)
      const{nr,mi,rec,off}=diaEntry;
      const ip=p.I+off,ipStr=rngP(ip); // passo I aggiustato per la settimana (±3s tolleranza)
      sess.push({t:'Martedì',n:'Interval',d:`${nr}×${mi}' @ ${ipStr} (I), rec ${recF(rec)} @ ${E}`,km:3.2+kmAt(nr*mi,ip)+kmAt((nr-1)*rec,Ea)+1.7});
      // interval al martedì = seduta dura: il giovedì alterna qualità e base
      const nf=6+Math.min(4,Math.floor(sp/2)),pm=40+Math.min(15,sp*2),qv=Math.floor(sp/2);
      const qual=sp%2===0?{n:'Base',d:`50' @ ${E} (Z2)`,km:kmAt(50,Ea)}
        :qv%4===3?MONA(15)
        :qv%4===2?{n:'Fartlek',d:`15' @ ${E} + ${nf}×(1' @ ${R} (R) / 1' @ ${E}) + 15' @ ${E}`,km:kmAt(30,Ea)+kmAt(nf*2,(p.R+Ea)/2)}
        :qv%4===1?{n:'Progressivo',d:`${pm}' continui da ${fmtP(p.E[0])} a ${fmtP(p.T)} (E→T)`,km:kmAt(pm,(Ea+p.T)/2)}
        :{n:'Medio-soglia',d:`15' @ ${E} + ${tmin}' @ ${T} (T) + 10' @ ${E}`,km:kmAt(25,Ea)+kmAt(tmin,p.T)};
      sess.push({t:'Giovedì',...qual});
      let lng=Math.round(Math.min(85+sp*3,isM?145:isHM?105:85)/5)*5;
      if(summer)lng=Math.min(lng,90);
      let lngKm=kmAt(lng,Ea);
      if(lngKm>vol*0.45){lngKm=vol*0.45;lng=Math.round(lngKm*Ea/60/5)*5}
      // avvicinamento gara intermedia (~2 sett. prima): lungo verso ~90% della distanza gara
      {const upR=nextRaceWithin(w,2);if(upR&&!summer){const aKm=Math.min(upR.dist*0.9,vol*0.5);if(aKm>lngKm){lngKm=aKm;lng=Math.round(lngKm*Ea/60/5)*5;}}}
      sess.push({t:'Domenica',n:'Lungo',d:`${lng}' @ ${E}`,km:lngKm});
    }else{ // specifico: ritmo gara + endurance specifica
      const wq=w-baseW-speedW;
      // --- quali settimane hanno il LUNGO QUALIFICATO (con lavoro a ritmo gara) ---
      // Serve prima del giovedì: in quelle settimane la seduta di metà settimana scende a base.
      const isPeak=wq===specW; // ultimo lungo prima del taper
      // progressione sui SOLI lunghi veri della fase specifica (esclude scarico/gara/pre-gara/recupero),
      // così la rampa è regolare anche se le settimane speciali interrompono la sequenza.
      const specLongWks=[];for(let k=1;k<=specW;k++){const ww=baseW+speedW+k;if(!raceAt[ww]&&!raceAt[ww-1]&&!raceAt[ww+1]&&!(ww%4===0&&ww!==core))specLongWks.push(k);}
      const li=specLongWks.indexOf(wq),nLong=specLongWks.length;
      const prog=nLong>1&&li>=0?li/(nLong-1):(isPeak?1:0); // 0 (1° lungo specifico) → 1 (picco)
      // ALTERNANZA lunghi facili / lunghi specifici. Non tutti i lunghi vanno trasformati in seduta di
      // qualità: il lungo facile resta il mattone aerobico (volume, tolleranza meccanica, durability) e
      // serve anche a reggere il costo dei lunghi specifici. Maratona: il 1° lungo della fase è facile e
      // poi ne rientra uno facile ogni tre. Mezza: a lunghi alterni (fra quelli VERI, non per parità di
      // settimana, che salta gli scarichi). In entrambi i casi il picco è sempre qualificato, così
      // l'ultima seduta dura del blocco è la più specifica.
      // gi = posizione del lungo nella sequenza COMPLESSIVA (include quelli già svolti prima di un ricalibro)
      const isQ=k=>{const i=specLongWks.indexOf(k);if(i<0)return false;const gi=i+lDone;
        return isM?(k===specW||(gi>0&&gi%3!==0)):isHM&&(k===specW||(gi>=1&&gi%2===1))};
      const hasM=isQ(wq);
      const qOrd=qDone+specLongWks.filter(k=>k<wq&&isQ(k)).length; // quanti lunghi qualificati già fatti
      // MARATONA: il ritmo gara diventa una seduta a sé il martedì (2 settimane su 3), in km e con
      // progressione 9 → 10 → 12 km; la terza settimana resta soglia (cruise / criss-cross) per non
      // perdere lo stimolo LT2. Il picco (big workout la domenica) ha il martedì a soglia.
      const sIdx=spx++; // contatore delle sole settimane specifiche di carico (salta scarichi e gare)
      const tueMP=isM&&!isPeak&&sIdx%3!==2;
      if(tueMP){
        const MPS=[[3,3,2],[2,5,3],[4,3,2],[3,4,2],[1,10,0],[2,6,3]]; // [ripetute, km, rec min]
        const[mn,mk,mr]=MPS[mpx<MPS.length?mpx:4+(mpx-MPS.length)%2];mpx++;
        sess.push({t:'Martedì',n:'Ritmo maratona',load:3,d:mn===1?`${mk} km continui @ ${M} (M)`:`${mn}×${mk*1000}m @ ${M} (M), rec ${mr}' @ ${E}`,km:3.2+mn*mk+kmAt((mn-1)*mr,Ea)+1.7});
      }else{
      const[cn,cm,crec]=CR[crx++%CR.length];
      // alterna cruise a soglia e criss-cross (Z3/Z4): entrambi lavorano la soglia, il criss-cross aggiunge cambi di ritmo gara
      if(crx%2===0)
        sess.push({t:'Martedì',n:'Criss-cross',d:`${cn}×${cm}' alternando ${Math.round(cm/2)}' @ ${M} (M) / ${Math.round(cm/2)}' @ ${T} (T), rec ${recF(crec)} @ ${E}`,km:3.2+kmAt(cn*cm,(p.M+p.T)/2)+kmAt((cn-1)*crec,Ea)+1.7});
      else
        sess.push({t:'Martedì',n:'Cruise @ soglia',d:`${cn}×${cm}' @ ${T} (T), rec ${recF(crec)} @ ${E}`,km:3.2+kmAt(cn*cm,p.T)+kmAt((cn-1)*crec,Ea)+1.7});
      }
      // nelle settimane col lungo qualificato il giovedì è base (max 2 sedute dure/settimana)
      const mfinWeek=hasM;
      const qual=mfinWeek?{n:'Base',d:`50' @ ${E} (Z2)`,km:kmAt(50,Ea)}
        :isM?(tueMP?{n:'Soglia',d:`15' @ ${E} + 6×1000m @ ${T} (T), rec 2' @ ${E} + 10' @ ${E}`,km:kmAt(25,Ea)+6+kmAt(10,Ea)}
          :{n:'Progressivo lungo',d:`60' continui da ${fmtP(p.E[0])} a ${fmtP(p.M)} (E→M)`,km:kmAt(60,(Ea+p.M)/2)})
        :isHM?(Math.floor(wq/2)%2?{n:'Ritmo M',d:`15' @ ${E} + 2×15' @ ${M} (M), rec 5' @ ${E} + 10' @ ${E}`,km:kmAt(30,Ea)+kmAt(30,p.M)}
          :{n:'Progressivo lungo',d:`60' continui da ${fmtP(p.E[0])} a ${fmtP(p.M)} (E→M)`,km:kmAt(60,(Ea+p.M)/2)})
        :wq%2===0?{n:'Base',d:`50' @ ${E} (Z2)`,km:kmAt(50,Ea)}
        :{n:'Ritmo gara',d:`15' @ ${E} + ${goal<=5?'6×1000m':'5×2000m'} @ ${GP} (gara), rec 2' @ ${E} + 10' @ ${E}`,km:kmAt(25,Ea)+(goal<=5?6:10)+kmAt((goal<=5?5:4)*2,Ea)};
      sess.push({t:'Giovedì',...qual});
      // LUNGO SPECIFICO — progressione graduale in DISTANZA verso il picco.
      // parte a ritmo gara nel lungo (cresce col blocco): calcolata prima per dedurre la quota Z2.
      // Il ritmo di riferimento è quello DELLA GARA OBIETTIVO: M per la maratona, ritmo mezza per la mezza
      // (per un mezzista il ritmo maratona è ~10-15 s/km troppo lento per essere specifico).
      const qNum=isM?p.M:tFast/goal,qStr=isM?M:GP,qLab=isM?'M':'gara';
      const mmin=Math.min(isM?70:40,(isM?15:15)+(wq+wOff)*(isM?6:4)); // maratona: fino a ~16 km a ritmo gara nel lungo
      // FORMA del lungo qualificato — progressione applicativa: progressivo → blocchi a ritmo gara →
      // fast finish → sopra/sotto ritmo gara → ritmo gara continuo → big workout (picco). La quota di
      // lavoro specifico è la stessa (mmin): cambia COME è distribuita, con richiesta via via maggiore.
      // Prima si impara a reggere la durata, poi si alza la densità interna senza allungare la seduta.
      // l'ordine è anche di carico crescente; esauriti gli stadi si alternano le due forme più specifiche.
      const SEQ=['prog','blocchi','fastfinish','continuo','sottosopra'];
      const struct=!hasM?'easy':isPeak?'big'
        :(mmin<20?'prog':SEQ[qOrd<SEQ.length?qOrd:SEQ.length-2+(qOrd-SEQ.length)%2]);
      const StN=(p.E[0]+qNum)/2,St=rngP(StN);  // "steady": fra fondo facile e ritmo gara
      const upN=qNum-7,dnN=qNum+9;             // poco sopra / poco sotto il ritmo gara
      let nb=1,bm=mmin,fl=10;
      if(struct==='blocchi'){nb=mmin>=36?3:2;bm=Math.round(mmin/nb);fl=nb===3?8:10}
      else if(struct==='sottosopra'){nb=Math.max(3,Math.min(6,Math.round(mmin/9)));bm=2*Math.round(mmin/nb/2)}
      const qmin=nb*bm;                        // minuti effettivi di lavoro specifico (arrotondati sui blocchi)
      const smin=struct==='prog'?Math.round(qmin/2/5)*5:0; // progressivo: metà dei minuti specifici a steady
      const rmin=qmin-smin;                    // minuti veri a ritmo gara
      // km guadagnati rispetto alla stessa durata in easy: le parti veloci coprono più strada
      const qExtra=!hasM?0:kmAt(rmin,qNum)+kmAt(smin,StN)-kmAt(qmin,Ea);
      let lng,lngKm;
      if(isM){
        // km TOTALI del lungo: rampa lineare da ~22 (prima sett. specifica) a 34 (picco), ultimo garantito al picco.
        // Dopo un ricalibro la rampa riparte dal punto già raggiunto, non da 22.
        const peakTot=34,startTot=Math.min(peakTot-1,Math.max(22,carryTot));
        let total=isPeak?peakTot:startTot+(peakTot-startTot)*prog;
        const mExtra=qExtra;                               // km "gratis" della parte specifica (più veloce dell'easy)
        lngKm=Math.max(kmAt(50,Ea),total-mExtra);          // quota easy/Z2 (min 50')
        lng=Math.round(lngKm*Ea/60/5)*5;
        lngKm=kmAt(lng,Ea);                                 // riallinea ai minuti arrotondati
      }else{
        lng=Math.round(Math.min(100+wq*7,isHM?125:85)/5)*5; // mezza: verso ~20-21 km
        lngKm=kmAt(lng,Ea);
        if(lngKm>vol*0.5){lngKm=vol*0.5;lng=Math.round(lngKm*Ea/60/5)*5}
      }
      if(summer){lng=Math.min(lng,90);lngKm=Math.min(lngKm,kmAt(90,Ea));}
      // durata totale invariata: i minuti di lavoro specifico sono ricavati dentro i `lng` minuti del lungo
      const SNAME={easy:'Lungo facile',prog:'Lungo progressivo',blocchi:'Lungo a blocchi RM',
        fastfinish:'Lungo fast finish',sottosopra:'Lungo sopra/sotto RM',continuo:'Lungo a ritmo gara continuo',
        big:isM?'Big workout (picco)':'Simulazione gara (picco)'};
      const SDESC={
        easy:`${lng}' @ ${E}${summer?' — presto al mattino, idratazione':''}`,
        prog:`${lng}' @ ${E} + ${smin}' @ ${St} (steady) + ${rmin}' @ ${qStr} (${qLab}) — progressione continua, senza pause`,
        blocchi:`${lng}' @ ${E} — nella seconda metà ${nb}×${bm}' @ ${qStr} (${qLab}) alternati a ${fl}' @ ${E}, poi chiudi @ ${E}`,
        fastfinish:`${lng}' @ ${E} — ultimi ${qmin}' @ ${qStr} (${qLab}) senza rallentare`,
        sottosopra:`${lng}' @ ${E} — poi ${nb}×${bm}' alternando ${bm/2}' @ ${fmtP(upN)} (poco sopra ${qLab}) e ${bm/2}' @ ${fmtP(dnN)} (poco sotto), senza recupero`,
        continuo:`${Math.max(20,lng-10)}' @ ${E} + ${qmin}' @ ${qStr} (${qLab}) in blocco unico + ${Math.min(10,lng-20)}' @ ${E}`,
        big:`${lng}' @ ${E} — nella seconda metà ${qmin}' @ ${qStr} (${qLab}) in blocco unico: è la prova generale, testa gel, liquidi, scarpe e pacing`};
      // carico dichiarato (scala del documento): 1 base · 2 intermedio · 3 alto · 4 molto alto
      const SLOAD={easy:1,prog:2,fastfinish:2,blocchi:3,continuo:3,sottosopra:4,big:4};
      sess.push({t:'Domenica',n:SNAME[struct],d:SDESC[struct],load:SLOAD[struct],km:lngKm+qExtra});
    }
    // ESTATE (giu-ago): intenso ma breve. Microciclo tipo Mar interval → Gio Z2 → weekend qualità:
    // due sedute veloci corte, separate da corse lente; niente lungo lento (poco tempo in piedi col caldo).
    if(summer&&!isDeload&&!isTaper&&!raceWeek&&!recovery&&!preRace){
      const TUE=[
        {n:'Interval',d:`6×2' @ ${I} (I), rec 2' @ ${E}`,km:3.2+kmAt(12,p.I)+kmAt(10,Ea)+1.7},
        {n:'Ripetute brevi',d:`10×200m @ ${R} (R), rec 200m lenta`,km:3.2+10*0.2*2+1.7},
        {n:'Interval corti',d:`8×400m @ ${I} (I), rec 90" @ ${E}`,km:3.2+8*0.4+kmAt(10.5,Ea)+1.7},
        // classico da 5k: la media dei 1000 è un indicatore diretto del tempo sui 5 km
        {n:'Interval lunghi',d:`6×1000m @ ${I} (I), rec 2'30" @ ${E}`,km:3.2+6+kmAt(12.5,Ea)+1.7},
        {n:'Ripetute brevi',d:`12×200m @ ${R} (R), rec 200m lenta`,km:3.2+12*0.2*2+1.7},
        {n:'Interval corti',d:`12×400m @ ${I} (I), rec 90" @ ${E}`,km:3.2+12*0.4+kmAt(16.5,Ea)+1.7}];
      const WKND=[
        {n:'Fartlek',d:`10' @ ${E} + 8×(1' @ ${R} (R) / 1' @ ${E}) + 10' @ ${E}`,km:kmAt(20,Ea)+kmAt(16,(p.R+Ea)/2)},
        {n:'Medio breve',d:`10' @ ${E} + 20' @ ${T} (T) + 10' @ ${E}`,km:kmAt(20,Ea)+kmAt(20,p.T)},
        {n:'Cruise',d:`10' @ ${E} + 4×4' @ ${T} (T), rec 90" @ ${E} + 10' @ ${E}`,km:kmAt(20,Ea)+kmAt(16,p.T)+kmAt(4.5,Ea)},
        MONA(10),
        {n:'Progressivo',d:`30' continui da ${fmtP(p.E[0])} a ${fmtP(p.T)} (E→T)`,km:kmAt(30,(Ea+p.T)/2)}];
      const z2=(t,min)=>({t,n:'Z2',d:`${min}' @ ${E} (Z2) — presto al mattino`,km:kmAt(min,Ea)});
      sess.length=0;
      sess.push({t:'Martedì',...TUE[(w-1)%TUE.length]});
      if(days>=5)sess.push(z2('Mercoledì',40));
      sess.push(z2('Giovedì',45));
      if(days>=4)sess.push(z2('Sabato',35));
      sess.push({t:'Domenica',...WKND[(w-1)%WKND.length]});
    }else if(!raceWeek&&!recovery&&!preRace){
      // maratona: opzione "+1 easy nella fase specifica" → un giorno di corsa in più (sempre easy) per alzare il volume
      const effDays=(isM&&maraExtraEasy&&phase==='spec'&&!isDeload&&!isTaper)?days+1:days;
      if(effDays>=4&&!isDeload)sess.splice(1,0,{t:'Mercoledì',n:'Easy',d:`45' @ ${E} (Z2)`,km:kmAt(45,Ea)});
      if(effDays>=5&&!isDeload&&!isTaper)sess.push({t:'Sabato',n:'Easy',d:`38' @ ${E} (Z2) + 4 allunghi 80m`,km:kmAt(38,Ea)+0.4});
      if(effDays>=6&&!isDeload&&!isTaper)sess.push({t:'Venerdì',n:'Easy',d:`40' @ ${E} (Z2)`,km:kmAt(40,Ea)});
    }else if((recovery||preRace)&&isM&&maraExtraEasy&&phase==='spec'){
      // "+1 easy" attivo: mantieni 4 corse anche nelle settimane pre-gara/recupero della fase specifica
      // (la settimana della gara e gli scarichi restano a 3)
      sess.splice(1,0,{t:'Mercoledì',n:'Easy',d:`40' @ ${E} (Z2)`,km:kmAt(40,Ea)});
    }
    sess.forEach(s=>s.km=Math.round(s.km*2)/2);
    weeks.push({w,vol:Math.round(sess.reduce((a,s)=>a+(w===n&&isGoalRace(s)?0:s.km),0)),phase,summer,isDeload,isTaper,sess});
  }
  // conteggio fasi dalle settimane effettivamente costruite: il nominale non conosce il blocco intermedio
  const phC={base:0,speed:0,ispec:0,spec:0,taper:0};
  weeks.forEach(w=>{if(phC[w.phase]!=null)phC[w.phase]++});
  const plan={goal,dateStr,vd:+vd.toFixed(1),vdTarget:+vdTarget.toFixed(1),mode:modeLabel,modeVal:mode,target:tgtStr,targetSet,days,maraExtraEasy,weeks,GP,GT,E,I,T,interRaces,iSpec,readiness,ph:{baseW:phC.base,speedW:phC.speed,ispecW:phC.ispec,specW:phC.spec,taper:phC.taper}};
  LS('rp_plan',plan);
  if(!silent)monFreeze(); // piano generato a mano: lo storico del Monitor resta, il futuro è il piano nuovo
  rPlan(plan);rTrack();rToday();
  return plan;
}
/* ---------- modifiche manuali alle settimane (scarico / gara al volo) ---------- */
// Sopravvivono ai rebuild: chiave = domenica ISO della settimana (stabile finché la data gara non cambia).
function wkEdits(){return LS('rp_wkedit')||{}}
/* Date delle settimane del piano: si conta a ritroso dalla domenica della settimana di gara (la gara può
   essere di sabato), con l'ultima settimana del piano = settimana di gara. È l'UNICO punto che fa questo
   conto: Piano, Monitor, Gara, analisi della corsa e Palestra passano tutti da qui. wk = settimana o suo numero. */
function wkSunDate(pl,wk){
  const race=dOnly(pl.dateStr),refSun=addD(race,(7-race.getDay())%7);
  return addD(refSun,-(pl.weeks.length-(typeof wk==='object'?wk.w:wk))*7);
}
function wkSunISO(pl,wk){return isoLoc(wkSunDate(pl,wk))}
function wkMonISO(pl,wk){return isoLoc(addD(wkSunDate(pl,wk),-6))}
// Tipo di settimana e "riscrivi sulle corse svolte" sono due scelte indipendenti che convivono nella
// stessa chiave ("a10+real"): prima erano un valore solo, quindi spuntare la riscrittura cancellava la
// gara appena impostata (e viceversa).
function wkParts(key){const v=String(wkEdits()[key]||''),p=v.split('+');
  return {base:p.filter(x=>x&&x!=='real')[0]||'',real:p.includes('real')}}
function setWkBase(key,val){const o=wkParts(key);o.base=val;setWkEdit(key,[o.base,o.real?'real':''].filter(Boolean).join('+'))}
function setWkReal(key,on){const o=wkParts(key);o.real=!!on;setWkEdit(key,[o.base,o.real?'real':''].filter(Boolean).join('+'))}
function setWkEdit(key,val){
  const ed=wkEdits();
  if(!val)delete ed[key];else ed[key]=val;
  {const fx=flexAll();if(fx[key]){delete fx[key];LS('rp_flex',fx)}} // la settimana si ricostruisce: la foto delle modifiche seduta per seduta non vale più
  LS('rp_wkedit',ed);
  monFreeze(); // se la modifica tocca una settimana appena conclusa, lo storico del Monitor la recepisce
  const pl=LS('rp_plan');if(pl){rPlan(pl);rTrack();rToday()}
}
// applica gli override a una copia del piano puro: usata da rPlan, rTrack, rToday, planToSessions
function applyWkOv(pl){
  if(!pl||!pl.weeks)return pl;
  const ed=wkEdits();if(!Object.keys(ed).length)return pl;
  const ph=pl.ph||{},core=Math.max(1,(ph.baseW||0)+(ph.speedW||0)+(ph.ispecW||0)+(ph.specW||0));
  const kmAt=(min,sp)=>min*60/sp,r2=k=>Math.round(k*2)/2;
  const clone=JSON.parse(JSON.stringify(pl)),nAll=clone.weeks.length;
  clone.weeks=clone.weeks.map(w=>{
    if(w.hist||w.w===nAll)return w; // niente override su settimane passate o sulla gara finale
    // Nella chiave stanno DUE cose indipendenti, separate da '+': il tipo di settimana
    // (scarico / gara al volo) e la riscrittura sulle corse svolte — es. "a10+real". I valori
    // vecchi ('real', 'a10', 'deload') restano leggibili.
    const ovRaw=ed[wkSunISO(clone,w)];
    if(!ovRaw)return w;
    const _p=String(ovRaw).split('+');
    const real=_p.includes('real');
    const ov=_p.filter(x=>x&&x!=='real')[0]||'';
    const vdW=pl.vd+((pl.vdTarget||pl.vd)-pl.vd)*Math.min(1,w.w/core);
    const p=paces(vdW),Ea=(p.E[0]+p.E[1])/2;
    const E=`${fmtP(p.E[1])}–${fmtP(p.E[0])}`;
    // RISCRITTURA SULLE CORSE SVOLTE. È un modificatore, non un tipo di settimana: si applica SOPRA
    // la settimana così com'è (normale, scarico o con la gara al volo), che resta quella che è.
    // Prima era un valore alternativo nella stessa chiave, quindi spuntarla cancellava la gara.
    const rewriteReal=(w0)=>{
      let sess;
      const sunISOw=wkSunISO(clone,w0);
      const addDw=(dt,k)=>{const x=new Date(dt);x.setDate(x.getDate()+k);return x};
      const isoW=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const monISOw=isoW(addDw(dOnly(sunISOw),-6));
      const wkRuns=((typeof runs!=='undefined'&&runs)||[]).filter(r=>{const d=r.date.slice(0,10);return d>=monISOw&&d<=sunISOw})
        .slice().sort((a,b)=>a.date<b.date?-1:1);
      if(!wkRuns.length)return w0; // niente da adattare: la settimana resta quella del piano
      const DN=['','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
      const DI={'Lunedì':1,'Martedì':2,'Mercoledì':3,'Giovedì':4,'Venerdì':5,'Sabato':6,'Domenica':7};
      const idxOf=ds=>{const g=dOnly(ds).getDay();return g===0?7:g};
      const SYSN={vo2:'VO2max/velocità',threshold:'soglia',endurance:'resistenza',easy:'facile'};
      const sysOf=sysOfSess;
      const sysReal=r=>{const c=cls(r);
        return c==='int'?'vo2':c==='race'?(r.km<=10?'vo2':'threshold'):c==='qual'?'threshold':c==='long'?'endurance':'easy'};
      // 1) le corse svolte diventano sedute fissate al loro giorno reale
      const done=wkRuns.map(r=>{const sp=r.sec/r.km,m=Math.floor(sp/60),s2=Math.round(sp%60);
        return {t:DN[idxOf(r.date.slice(0,10))],n:r.title||'Corsa',done:true,realDate:r.date.slice(0,10),rcls:cls(r),
          d:`svolta · ${r.km.toFixed(1)} km @ ${m}:${String(s2).padStart(2,'0')}/km${r.hr?` · FC media ${r.hr}`:''}`,
          // il carico veniva dedotto dal TITOLO della corsa: «Z2 - 14k» non somiglia a nessuna seduta
          // del piano e finiva a carico base anche per un lungo di 14 km. Si prende dalla classe vera.
          km:r.km,load:({race:4,int:3,qual:2,long:2,easy:1})[cls(r)]||1}});
      const doneQ=wkRuns.filter(r=>['int','qual','race','long'].includes(cls(r)));
      const doneSys=new Set(doneQ.map(sysReal));
      const lastQ=doneQ.length?Math.max(...doneQ.map(r=>idxOf(r.date.slice(0,10)))):0;
      const lastAny=Math.max(...wkRuns.map(r=>idxOf(r.date.slice(0,10))));
      // 2) del pianificato tengo UNA sola qualità: il carico più alto che non ripete un sistema già allenato
      // Una gara messa a mano non si tocca: resta al suo giorno ed è LEI la qualità della settimana
      // (se quel giorno hai già corso, la corsa vera prende il suo posto).
      const raceS=w0.sess.filter(s=>isRaceSess(s)&&!done.some(d=>d.t===s.t));
      const raceRun=w0.sess.filter(s=>isRaceSess(s)&&done.some(d=>d.t===s.t)); // gara nel passato: vale la corsa vera
      const hard=w0.sess.filter(s=>!raceS.includes(s)&&sysOf(s)!=='easy');
      const scoreOf=s=>sLoad(s)-(doneSys.has(sysOf(s))?5:0);
      const ranked=hard.slice().sort((a,b)=>scoreOf(b)-scoreOf(a));
      let kept=(!raceS.length&&doneQ.length<2&&ranked.length&&scoreOf(ranked[0])>=1)?ranked[0]:null,keptI=null;
      if(kept){ // carico alto ⇒ sabato (lascia 2 giorni prima del martedì dopo), altrimenti domenica
        keptI=sLoad(kept)>=3?6:7;
        if(keptI<lastQ+2)keptI=lastQ+2;          // almeno 2 giorni pieni dall'ultima qualità svolta
        if(keptI>7){kept=null;keptI=null}        // non c'è più spazio: la settimana finisce qui
      }
      const dropped=hard.filter(s=>s!==kept);
      sess=done.slice();
      raceS.forEach(rs=>sess.push({...rs}));
      const days=+pl.days||3;
      let room=days-(done.length+raceS.length+(kept?1:0)),addedMid=null;
      if(kept){
        // RACCORDO: solo se avanza spazio nelle corse/settimana che fai davvero E se il buco è vero
        // (≥3 giorni di stacco). Prima veniva aggiunto sempre: con 3 corse a settimana, due già svolte
        // e la qualità tenuta, la settimana ne mostrava quattro — la quarta inventata dall'app.
        const midI=Math.floor((Math.max(lastAny,1)+keptI)/2);
        if(room>0&&keptI-lastAny>=4&&midI>lastAny&&midI<keptI){
          const z2=w0.sess.find(s=>sysOf(s)==='easy');
          sess.push(z2?{...z2,t:DN[midI],d:z2.d.replace(/\s*—.*$/,'')+' — raccordo'}
                      :{t:DN[midI],n:'Z2',d:`45' @ ${E} (Z2) — raccordo`,km:kmAt(45,Ea)});
          addedMid=DN[midI];room--;
        }
        sess.push({...kept,t:DN[keptI]});
      }
      sess.sort((a,b)=>DI[a.t]-DI[b.t]);
      sess.forEach(s=>s.km=r2(s.km));
      let note=`Settimana riscritta sulle corse svolte. `;
      note+=doneQ.length
        ? `Hai già fatto ${doneQ.map(r=>`«${r.title}» ${DN[idxOf(r.date.slice(0,10))].toLowerCase()} (${SYSN[sysReal(r)]})`).join(' e ')}. `
        : `Finora solo corse facili. `;
      if(kept)note+=`Tengo «${kept.n}» spostata a ${DN[keptI].toLowerCase()}: è il carico più alto rimasto (${LOADL[sLoad(kept)]}) e allena un sistema diverso (${SYSN[sysOf(kept)]}), con ${keptI-lastQ} giorni di stacco da quello che hai già fatto${keptI===6?' e 2 giorni pieni prima del martedì della settimana dopo, che resta intatta':''}. `;
      if(raceS.length)note+=`La gara di ${raceS[0].t.toLowerCase()} resta dov'è: è lei la qualità della settimana. `;
      if(raceRun.length)note+=`${raceRun[0].t} tengo la corsa che hai fatto davvero al posto della gara prevista. `;
      if(dropped.length)note+='Tolgo '+dropped.map(s=>`«${s.n}» (${raceS.length?'la gara copre già la qualità':doneSys.has(sysOf(s))?'stesso sistema di quello che hai già allenato':'per non affollare la settimana'})`).join(' e ')+'. ';
      if(addedMid)note+=`Aggiungo una corsa lenta di raccordo ${addedMid.toLowerCase()}: fra l'ultima corsa e ${DN[keptI].toLowerCase()} restavano ${keptI-lastAny-1} giorni vuoti e hai ancora spazio nelle tue ${days} corse a settimana. `;
      else if(kept&&room<=0)note+=`Non aggiungo altro: con ${days} corse a settimana, le ${done.length} già svolte più «${kept.n}» riempiono la settimana. `;
      note+='Gli altri giorni sono riposo.';
      // Della nota della settimana base resta solo la PREMESSA (prima frase): il resto descriveva una
      // disposizione delle sedute che la riscrittura ha appena cambiato, e le due si contraddicevano
      // ("Tengo «Lungo» giovedì" seguito da "Tolgo «Lungo»").
      const head=(w0.raceNote||'').split('. ')[0];
      // manual resta quello della settimana (gara/scarico): la spunta "dal reale" è un'altra cosa
      return {...w0,fromReal:true,raceNote:(head?head+'. ':'')+note,sess,vol:Math.round(sess.reduce((a,s)=>a+s.km,0))};
    };
    let sess;
    if(ov==='deload'){
      sess=[
        {t:'Martedì',n:'Scarico',d:`40' @ ${E} + 6 allunghi 80m`,km:kmAt(40,Ea)+0.5},
        {t:'Giovedì',n:'Easy',d:`35' @ ${E}`,km:kmAt(35,Ea)},
        {t:'Domenica',n:'Lungo ridotto',d:`60' @ ${E}`,km:kmAt(60,Ea)}];
      sess.forEach(s=>s.km=r2(s.km));
      const Wd={...w,isDeload:true,manual:'deload',sess,vol:Math.round(sess.reduce((a,s)=>a+s.km,0))};
      return real?rewriteReal(Wd):Wd;
    }
    if(!ov)return real?rewriteReal(w):w;   // solo riscrittura sul reale
    // gara al volo: 'r*' = settimana dedicata (mini-scarico + gara); 'a*' = gara la domenica, resto invariato
    const add=ov[0]==='a',num=ov.slice(1);
    const dist=num==='5'?5:num==='10'?10:21.0975;
    const rn=dist>=21?'Mezza':dist+'k',rp=predict(dist,vdW)/dist;
    const raceSess={t:'Domenica',n:`🏁 Gara ${rn}`,race:true,d:`${dist>=21?dist.toFixed(1):dist} km @ ${fmtP(rp)}/km`,km:dist};
    if(ov[0]==='w'){ // gara infrasettimanale (giovedì): sostituisce la qualità, sceglie cosa tenere
      const raceSysW=dist<=5?'vo2':dist<=10?'threshold':'endurance';
      const SYSN={vo2:'VO2max/velocità',threshold:'soglia',endurance:'resistenza',easy:'facile'};
      const sysOf=sysOfSess;
      const OFFw={'Lunedì':-6,'Martedì':-5,'Mercoledì':-4,'Giovedì':-3,'Venerdì':-2,'Sabato':-1,'Domenica':0};
      const rank={threshold:3,endurance:2,vo2:1};
      const hard=w.sess.filter(s=>sysOf(s)!=='easy');
      const scoreOf=s=>rank[sysOf(s)]-(sysOf(s)===raceSysW?5:0)-(OFFw[s.t]<-3?0.6:0);
      const ranked=hard.slice().sort((a,b)=>scoreOf(b)-scoreOf(a));
      const kept=(ranked.length&&scoreOf(ranked[0])>=1)?ranked[0]:null;
      const raceSessW={t:'Giovedì',n:`🏁 Gara ${rn}`,race:true,d:`${dist>=21?dist.toFixed(1):dist} km @ ${fmtP(rp)}/km — infrasettimanale`,km:dist};
      sess=[{t:'Martedì',n:'Z2',d:`45' @ ${E} (Z2) — corsa lenta di raccordo`,km:kmAt(45,Ea)},raceSessW];
      if(kept)sess.push({...kept,t:'Domenica'});
      const dropped=hard.filter(s=>s!==kept);
      let note=`Gara al giovedì (${SYSN[raceSysW]}). `;
      if(kept)note+=`Tengo «${kept.n}» spostata a domenica: stimolo di ${SYSN[sysOf(kept)]}, complementare alla gara e con recupero dopo. `;
      if(dropped.length)note+='Tolgo '+dropped.map(s=>`«${s.n}» (${sysOf(s)===raceSysW?'stesso sistema della gara':'per non affollare la settimana'}${OFFw[s.t]<-3?', e a ridosso pre-gara':''})`).join(' e ')+'. ';
      note+='Martedì corsa lenta Z2 di raccordo tra i due impegni.';
      sess.forEach(s=>s.km=r2(s.km));
      const Ww={...w,isDeload:false,manual:ov,midRace:true,raceNote:note,sess,vol:Math.round(sess.reduce((a,s)=>a+s.km,0))};
      return real?rewriteReal(Ww):Ww;
    }
    if(add){
      // GARA LA DOMENICA — la settimana si riadatta invece di limitarsi a perdere la domenica.
      // Prima la gara sostituiva il lungo e basta: il lungo spariva senza dirlo e martedì/giovedì
      // restavano com'erano, così in fase specifica venivano fuori tre giorni duri (Cruise, Ritmo
      // gara e gara). Ora vale la stessa logica della gara infrasettimanale: si salva UNA seduta,
      // la più utile, e la si sposta nello slot della più sacrificabile fra martedì e giovedì.
      const raceSysA=dist<=5?'vo2':dist<=10?'threshold':'endurance';
      const SYSNA={vo2:'VO2max/velocità',threshold:'soglia',endurance:'resistenza',easy:'facile'};
      const sysA=sysOfSess;
      // Con la gara di domenica lo stimolo che resta scoperto NON è la qualità ma la resistenza:
      // il lungo pesa più della soglia. La penalità sul sistema della gara fa il resto — con una
      // mezza è la gara stessa a fare da lungo, e allora vince la qualità.
      const rankA={endurance:3,threshold:2,vo2:1,easy:0};
      const scoreA=x=>rankA[sysA(x)]-(sysA(x)===raceSysA?5:0)+sLoad(x)*0.1; // a parità di sistema vince il carico più alto
      const DIA={'Lunedì':1,'Martedì':2,'Mercoledì':3,'Giovedì':4,'Venerdì':5,'Sabato':6,'Domenica':7};
      const hardA=w.sess.filter(x=>sysA(x)!=='easy');
      const rankedA=hardA.slice().sort((a,b)=>scoreA(b)-scoreA(a));
      const keptA=(rankedA.length&&scoreA(rankedA[0])>=1)?rankedA[0]:null;
      const occupA=['Martedì','Giovedì'].map(t=>w.sess.find(x=>x.t===t)).filter(Boolean);
      const victA=occupA.length?occupA.slice().sort((a,b)=>scoreA(a)-scoreA(b))[0]:null;
      let slotA=victA?victA.t:'Martedì',arretrata=false;
      // Il giovedì dista 3 giorni dalla gara: lì ci può stare solo volume aerobico puro. Un «Lungo con
      // finale» ha 30' a ritmo maratona dentro e pesa come una qualità pur avendo sLoad 2, quindi il
      // criterio non è il carico ma la presenza di lavoro a ritmo (tag di zona o freccia del progressivo).
      const puroAer=keptA&&sysA(keptA)==='endurance'&&!/\((?:M|T|I|R)\)|\(ritmo|→/.test(keptA.d||'');
      if(keptA&&slotA==='Giovedì'&&!puroAer){slotA='Martedì';arretrata=true}
      const otherA=slotA==='Martedì'?'Giovedì':'Martedì';
      sess=[];
      if(keptA)sess.push({...keptA,t:slotA});
      // Il giovedì non va sprecato in un taper: davanti a una 5k/10k bastano gambe fresche, non
      // riposo, quindi resta una corsa vera con allunghi. Solo la mezza merita il pre-gara corto.
      const preLong=dist>=21;
      sess.push(otherA==='Giovedì'
        ?(preLong?{t:'Giovedì',n:'Pre-gara',d:`25' @ ${E} + 4×100m allunghi`,km:kmAt(25,Ea)+0.4}
                 :{t:'Giovedì',n:'Easy + allunghi',d:`45' @ ${E} + 4×100m allunghi`,km:kmAt(45,Ea)+0.4})
        :{t:'Martedì',n:'Z2',d:`45' @ ${E} (Z2) — corsa lenta di raccordo`,km:kmAt(45,Ea)});
      sess.push(raceSess);
      sess.sort((a,b)=>DIA[a.t]-DIA[b.t]);
      const dropA=hardA.filter(x=>x!==keptA&&x!==victA); // victA è già nominata come slot ceduto
      let noteA=`Gara la domenica (${rn}: stimolo di ${SYSNA[raceSysA]}). `;
      if(keptA){
        const fem=/^lungo/i.test(keptA.n)?'o':'a';
        noteA+=`Tengo «${keptA.n}» spostat${fem} a ${slotA.toLowerCase()}: la gara copre già ${SYSNA[raceSysA]}, quindi la seduta più utile che resta è quella di ${SYSNA[sysA(keptA)]}`;
        noteA+=victA&&victA!==keptA?`, e prende il posto di «${victA.n}», la più sacrificabile fra martedì e giovedì. `:'. ';
        if(arretrata)noteA+=`L'ho messa al martedì e non al giovedì: ha del lavoro a ritmo dentro (carico ${LOADL[sLoad(keptA)]}) e il giovedì disterebbe solo 3 giorni dalla gara. `;
      }else noteA+=`Nessuna seduta da salvare: quelle previste allenano lo stesso sistema della gara. `;
      if(dropA.length)noteA+='Tolgo '+dropA.map(x=>`«${x.n}» (${sysA(x)===raceSysA?'stesso sistema della gara':'per non affollare la settimana'})`).join(' e ')+'. ';
      noteA+=otherA==='Giovedì'
        ?(preLong?'Giovedì solo pre-gara leggero: alla mezza ci si arriva scarichi.':'Giovedì corsa easy con allunghi: davanti a una gara corta servono gambe fresche, non riposo.')
        :'Martedì corsa lenta di raccordo.';
      sess.forEach(x=>x.km=r2(x.km));
      const Wa={...w,isDeload:false,manual:ov,addRace:true,raceNote:noteA,sess,vol:Math.round(sess.reduce((a,x)=>a+x.km,0))};
      return real?rewriteReal(Wa):Wa;
    }else{ // settimana dedicata alla gara: mini-scarico + gara
      sess=[
        {t:'Martedì',n:'Easy',d:`35' @ ${E}`,km:kmAt(35,Ea)},
        {t:'Giovedì',n:'Pre-gara',d:`20' @ ${E} + 4×100m allunghi`,km:kmAt(20,Ea)+0.4},
        raceSess];
    }
    sess.forEach(s=>s.km=r2(s.km));
    const Wr={...w,isDeload:add?w.isDeload:false,manual:ov,addRace:add,sess,vol:Math.round(sess.reduce((a,s)=>a+s.km,0))};
    return real?rewriteReal(Wr):Wr;
  });
  return clone;
}
/* ---------- sedute tolte a mano da una settimana ----------
   Per il caso «questa settimana il lungo non lo faccio»: prima l'unico modo era rigenerare il piano
   o rendere scarica tutta la settimana. Vive accanto a rp_wkedit ed è chiavato sulla domenica ISO,
   quindi sopravvive ai rebuild e ai riscritti dal reale. Chiave della seduta: `giorno|nome`. */
function wkSkips(){return LS('rp_wkskip')||{}}
function wkSkipKey(s){return `${s.t}|${s.n}`}
function wkSkipSave(sp){LS('rp_wkskip',sp);monFreeze();const pl=LS('rp_plan');if(pl){rPlan(pl);rTrack();if(typeof rToday==='function')rToday()}}
function wkSkipAdd(key,i){ // i = indice della seduta nella settimana COSÌ COM'È RESA ORA
  const pl=applyWkEdits(LS('rp_plan'));if(!pl)return;
  const w=pl.weeks.find(x=>wkSunISO(pl,x)===key);if(!w||!w.sess[i])return;
  const sk=wkSkipKey(w.sess[i]),sp=wkSkips(),a=sp[key]||[];
  if(!a.includes(sk))a.push(sk);
  sp[key]=a;wkSkipSave(sp);
}
function wkSkipDel(key,i){
  const sp=wkSkips(),a=sp[key]||[];
  a.splice(i,1);
  if(a.length)sp[key]=a;else delete sp[key];
  wkSkipSave(sp);
}
function applyWkSkips(pl){
  if(!pl||!pl.weeks)return pl;
  const sp=wkSkips();if(!Object.keys(sp).length)return pl;
  const clone=JSON.parse(JSON.stringify(pl)),nAll=clone.weeks.length;
  clone.weeks=clone.weeks.map(w=>{
    if(w.hist||w.w===nAll)return w;               // mai sulle passate né sulla settimana di gara
    const a=sp[wkSunISO(clone,w)];if(!a||!a.length)return w;
    const sess=w.sess.filter(s=>s.done||!a.includes(wkSkipKey(s))); // le corse svolte non si tolgono
    if(sess.length===w.sess.length)return w;
    return {...w,sess,vol:Math.round(sess.reduce((x,s)=>x+s.km,0))};
  });
  return clone;
}
function applyWkEdits(pl){return applyWkSkips(applyFlex(applyWkOv(pl)))}
/* ---------- FLEX: cambio della singola seduta (ripreso dal "Flex session" di RunZones) ----------
   Sei azioni su ogni seduta del Piano non ancora svolta:
   ✎ Modifica (ripetute, durata, zona, recupero, testo) · ↔ Sposta (stesso allenamento, altro giorno) ·
   ⬇ Alleggerisci (rendila facile / sposta il lavoro duro / scambia con un giorno facile) ·
   ⇄ Cambia (scegli lo stimolo, poi una seduta dalla banca, coi passi DELLA SETTIMANA) ·
   🏁 Gara o test al posto della seduta · ＋ Aggiungi una seduta in un giorno libero.
   Ogni azione passa da un'anteprima con gli avvisi (due giorni duri di fila) e si applica solo con
   "Conferma". Il risultato si salva come FOTO della settimana in `rp_flex[domenicaISO]`: sopravvive ai
   rebuild del piano come gli altri override, e "↺ Ripristina la settimana" la toglie. Cambiare il tipo
   di settimana (scarico / gara al volo / riscrivi sul reale) la azzera, perché la settimana si ricostruisce. */
const FX_DAYS=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
let FX=null; // stato del pannello aperto
function flexAll(){return LS('rp_flex')||{}}
function applyFlex(pl){
  if(!pl||!pl.weeks)return pl;
  const fx=flexAll();if(!Object.keys(fx).length)return pl;
  const clone=JSON.parse(JSON.stringify(pl)),nAll=clone.weeks.length;
  clone.weeks=clone.weeks.map(w=>{
    if(w.hist||w.w===nAll)return w;
    const s=fx[wkSunISO(clone,w)];if(!s)return w;
    return {...w,sess:JSON.parse(JSON.stringify(s)),flex:true,vol:Math.round(s.reduce((a,x)=>a+(+x.km||0),0))};
  });
  return clone;
}
// settimana così come la vedi ora (tutti gli override applicati) + i passi di quella settimana
function fxCtx(key){
  const raw=LS('rp_plan');if(!raw||!raw.weeks)return null;
  const pl=applyWkEdits(raw);
  const w=pl.weeks.find(x=>wkSunISO(pl,x)===key);if(!w)return null;
  const ph=raw.ph||{},core=Math.max(1,(ph.baseW||0)+(ph.speedW||0)+(ph.ispecW||0)+(ph.specW||0));
  const vd=raw.vd+((raw.vdTarget||raw.vd)-raw.vd)*Math.min(1,w.w/core);
  const p=paces(vd),Ea=(p.E[0]+p.E[1])/2;
  const Z={p,vd,Ea,E:`${fmtP(p.E[1])}–${fmtP(p.E[0])}`,M:rngP(p.M),T:rngP(p.T),I:rngP(p.I),R:rngP(p.R)};
  return {pl,w,Z,nAll:pl.weeks.length,editable:!w.hist&&w.w!==pl.weeks.length};
}
const fxIso=(key,t)=>addDaysISO(key,FX_DAYS.indexOf(t)-6);
const fxDL=iso=>{const d=dOnly(iso);return `${['dom','lun','mar','mer','gio','ven','sab'][d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`};
const fxHard=s=>!!s&&(sLoad(s)>=2||isRaceSess(s));
const fxSort=ss=>ss.slice().sort((a,b)=>FX_DAYS.indexOf(a.t)-FX_DAYS.indexOf(b.t));
const fxEsc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fxCost=s=>{const L=sLoad(s);return L>=3?'alto':L===2?'medio':'basso'};
const fxR=k=>Math.round(k*2)/2;
function fxLists(keys){const o={};[...new Set(keys)].forEach(k=>{const c=fxCtx(k);o[k]=c?JSON.parse(JSON.stringify(c.w.sess)):[]});return o}
function fxCur(){const c=FX&&fxCtx(FX.key);return c&&FX.si!=null?c.w.sess[FX.si]:null}
// giorni proponibili: da oggi fino alla fine della settimana dopo, solo dentro settimane modificabili
function fxDays(key){
  const out=[],todayS=todayISO();
  [0,7].forEach(off=>{const k=addDaysISO(key,off),c=fxCtx(k);if(!c||!c.editable)return;
    FX_DAYS.forEach(t=>{const iso=fxIso(k,t);if(iso<todayS)return;out.push({iso,key:k,t,sess:c.w.sess.filter(s=>s.t===t)})})});
  return out;
}
// due giorni duri di fila: si segnalano solo quelli che la modifica CREA
function fxDayMap(keys,over){const m={};keys.forEach(k=>{const c=fxCtx(k);if(!c)return;
  ((over&&over[k])||c.w.sess).forEach(s=>{const iso=fxIso(k,s.t);(m[iso]=m[iso]||[]).push(s)})});return m}
function fxHardPairs(m){return Object.keys(m).sort().filter(d=>{const n=addDaysISO(d,1);return m[n]&&m[d].some(fxHard)&&m[n].some(fxHard)}).map(d=>d+'|'+addDaysISO(d,1))}
function fxWarnings(changes){
  const ks=[...new Set(Object.keys(changes).flatMap(k=>[addDaysISO(k,-7),k,addDaysISO(k,7)]))];
  const before=new Set(fxHardPairs(fxDayMap(ks))),after=fxHardPairs(fxDayMap(ks,changes));
  return after.filter(x=>!before.has(x)).map(x=>{const [a,b]=x.split('|');return `Così ci sono due giorni duri di fila: ${fxDL(a)} e ${fxDL(b)}. Meglio una corsa facile in mezzo.`});
}
/* ---------- banca sedute, coi passi della settimana ---------- */
const FX_STIM=[
  ['rec','Recupero','Corsa molto lenta, solo per muovere le gambe'],
  ['z2','Facile Z2','Base aerobica, la maggior parte dei km'],
  ['eco','Economia','Allunghi e salite brevi: tecnica e reattività senza fatica'],
  ['lt1','Medio (LT1)','Ritmo maratona o poco più lento, continuo'],
  ['mp','Ritmo maratona','Blocchi al passo gara'],
  ['lt2','Soglia (LT2)','Cruise interval e soglia continua'],
  ['cap','Tenuta','Blocchi lunghi a ritmo mezza: reggere il passo nel tempo'],
  ['ap','Potenza aerobica','Ritmo 10k (CV), ripetute da 1-2 km'],
  ['vo2','VO2max','Ripetute da 3-5 minuti al passo I'],
  ['spd','Velocità','Ripetute brevi al passo R'],
  ['long','Lungo','Il lungo facile o con un finale più veloce']
];
function fxBank(stim,Z){
  const {p,Ea,E,M,T,I,R,vd}=Z,WC=4.9,km=(min,sec)=>min*60/sec;
  const cvS=predict(10,vd)/10,hmS=predict(21.0975,vd)/21.0975,CV=rngP(cvS),HM=rngP(hmS);
  const recE=`${fmtP(p.E[0])}–${fmtP(p.E[0]+20)}`;
  const reps=(n,min,pace,sec,tag,rec,nm,load)=>({n:nm,load,d:`${n}×${min}' @ ${pace} (${tag}), rec ${recF(rec)} @ ${E}`,km:fxR(WC+km(n*min,sec)+km((n-1)*rec,Ea))});
  const kmReps=(n,dist,pace,sec,tag,rec,nm,load)=>({n:nm,load,d:`${n}×${dist>=1000?dist/1000+' km':dist+'m'} @ ${pace} (${tag}), rec ${recF(rec)} @ ${E}`,km:fxR(WC+n*dist/1000+km((n-1)*rec,Ea))});
  const B={
    rec:[30,40,50].map(m=>({n:'Recupero',load:1,d:`${m}' @ ${recE} (Z2) — molto facile, FC bassa`,km:fxR(km(m,p.E[0]+10))})),
    z2:[...[40,50,60].map(m=>({n:'Easy',load:1,d:`${m}' @ ${E} (Z2)`,km:fxR(km(m,Ea))})),
        {n:'Easy + allunghi',load:1,d:`45' @ ${E} (Z2) + 6×20" in progressione, rec 1' camminando`,km:fxR(km(45,Ea)+0.8)}],
    eco:[{n:'Easy + allunghi',load:1,d:`40' @ ${E} (Z2) + 8×100m allunghi, rec 100m camminando`,km:fxR(km(40,Ea)+1.6)},
         {n:'Easy + salite brevi',load:1,d:`35' @ ${E} (Z2) + 6×8" sprint in salita, rec 2' camminando`,km:fxR(km(35,Ea)+0.5)},
         {n:'Easy + allunghi lunghi',load:1,d:`35' @ ${E} (Z2) + 10×200m sciolti @ ${R} (R), rec 200m camminando`,km:fxR(km(35,Ea)+4)},
         {n:'Easy + allunghi lanciati',load:1,d:`40' @ ${E} (Z2) + 6×60m lanciati, rec completo`,km:fxR(km(40,Ea)+1)}],
    lt1:[...[30,45,60].map(m=>({n:'Medio',load:2,d:`${m}' @ ${M} (M) continui`,km:fxR(WC+km(m,p.M))})),
         {n:'Medio a blocchi',load:2,d:`3×15' @ ${M} (M), rec 3' @ ${E}`,km:fxR(WC+km(45,p.M)+km(6,Ea))}],
    mp:[kmReps(3,3000,M,p.M,'M',3,'Ritmo maratona',3),kmReps(2,5000,M,p.M,'M',4,'Ritmo maratona',3),
        kmReps(4,3000,M,p.M,'M',2,'Ritmo maratona',3),
        {n:'Ritmo maratona',load:3,d:`10 km continui @ ${M} (M)`,km:fxR(WC+10)}],
    lt2:[reps(5,6,T,p.T,'T',1,'Cruise @ soglia',3),reps(4,8,T,p.T,'T',2,'Cruise @ soglia',3),reps(3,10,T,p.T,'T',2,'Cruise @ soglia',3),
         reps(2,15,T,p.T,'T',3,'Cruise @ soglia',3),kmReps(6,1000,T,p.T,'T',1,'Cruise @ soglia',3),
         {n:'Soglia continua',load:3,d:`20' @ ${T} (T) continui`,km:fxR(WC+km(20,p.T))}],
    cap:[kmReps(2,5000,HM,hmS,'T',3,'Ritmo mezza',3),kmReps(3,3000,HM,hmS,'T',2,'Ritmo mezza',3),kmReps(4,2000,HM,hmS,'T',2,'Ritmo mezza',3)],
    ap:[kmReps(5,1000,CV,cvS,'I',2,'Interval CV',3),kmReps(6,1000,CV,cvS,'I',1.5,'Interval CV',3),
        kmReps(3,2000,CV,cvS,'I',3,'Interval CV',3),kmReps(5,1200,CV,cvS,'I',2,'Interval CV',3)],
    vo2:[reps(6,3,I,p.I,'I',2.5,'Interval',3),reps(5,4,I,p.I,'I',3,'Interval',3),reps(4,5,I,p.I,'I',3,'Interval',3),
         kmReps(5,1000,I,p.I,'I',2.5,'Interval',3),
         {n:'Ripetute',load:3,d:`12×400m @ ${I} (I), rec 200m corsa lenta`,km:fxR(WC+4.8+2.2)}],
    spd:[[10,200],[12,200],[8,300],[6,400]].map(([n,m])=>({n:'Ripetute brevi',load:3,d:`${n}×${m}m @ ${R} (R), rec ${m}m corsa lenta`,km:fxR(WC+n*m*2/1000)})),
    long:[...[90,105,120].map(m=>({n:'Lungo',load:1,d:`${m}' @ ${E} (Z2)`,km:fxR(km(m,Ea))})),
          {n:'Lungo con finale',load:2,d:`80' @ ${E} (Z2) + 20' @ ${M} (M)`,km:fxR(km(80,Ea)+km(20,p.M))},
          {n:'Lungo con finale',load:2,d:`90' @ ${E} (Z2) + 30' @ ${M} (M)`,km:fxR(km(90,Ea)+km(30,p.M))}]
  };
  return B[stim]||[];
}
/* ---------- pannello ---------- */
function fxShell(kicker,title,body,foot){
  let el=document.getElementById('fx-modal');
  if(!el){el=document.createElement('div');el.id='fx-modal';el.className='fx-ov';el.onclick=e=>{if(e.target===el)fxClose()};document.body.appendChild(el)}
  el.innerHTML=`<div class="fx-box" role="dialog" aria-modal="true"><div class="fx-hd"><div><div class="fx-k">${kicker}</div><div class="fx-t">${title}</div></div><button class="fx-x" onclick="fxClose()" aria-label="Chiudi">✕</button></div><div class="fx-bd">${body}</div>${foot?`<div class="fx-ft">${foot}</div>`:''}</div>`;
}
function fxClose(){FX=null;const el=document.getElementById('fx-modal');if(el)el.remove()}
function fxSessLine(s,iso){return `<div class="fx-cur"><b>${fxEsc(s.n)}</b> · ${fxDL(iso)}<div class="fx-d">${fxEsc(s.d)}</div><div class="fx-m">≈${s.km} km · costo di recupero ${fxCost(s)}</div></div>`}
function fxOpen(key,si){FX={key,si};fxMenu()}
function fxMenu(){
  const s=fxCur();if(!s)return fxClose();
  const iso=fxIso(FX.key,s.t),hard=fxHard(s);
  const opt=(fn,t,d)=>`<button class="fx-opt" onclick="${fn}"><b>${t}</b><span>${d}</span></button>`;
  fxShell('Cambia seduta',fxEsc(s.n),fxSessLine(s,iso)+
    opt('fxModify()','✎ Modifica la seduta','Ripetute, durata, zona, recupero e testo: tieni la struttura e la ritocchi.')+
    opt('fxMove()','↔ Spostala','Stesso allenamento in un altro giorno, anche della settimana dopo.')+
    (hard?opt('fxEasier()','⬇ Alleggerisci oggi','Rendila facile, sposta il lavoro duro più avanti o scambiala con un giorno facile.'):'')+
    opt('fxStim()','⇄ Cambia seduta','Scegli lo stimolo, poi una seduta dalla banca, già coi tuoi passi.')+
    opt('fxRace()','🏁 Gara o test al suo posto','Una gara o una prova cronometrata al posto della seduta.'));
}
// ---- anteprima + conferma, comune a tutte le azioni
function fxPreview(changes,lines,back){
  FX.pending=changes;FX.back=back;
  const warn=fxWarnings(changes);
  fxShell('Anteprima','Controlla prima di confermare',
    `<ul class="fx-sum">${lines.map(l=>`<li>${l}</li>`).join('')}</ul>`+
    (warn.length?warn.map(w=>`<p class="fx-warn">⚠️ ${w}</p>`).join(''):'<p class="fx-ok">Nessun conflitto con le sedute dure vicine.</p>')+
    `<p class="fx-note">La settimana resta modificata a mano finché non premi «↺ Ripristina la settimana» nel Piano.</p>`,
    `<button class="btn btn2" onclick="${back}">Indietro</button><button class="btn" onclick="fxCommit()">Conferma</button>`);
}
function fxCommit(){
  if(!FX||!FX.pending)return;
  const fx=flexAll(),sp=wkSkips();
  Object.entries(FX.pending).forEach(([k,ss])=>{fx[k]=fxSort(ss);delete sp[k]}); // le sedute tolte sono già fuori dalla foto
  LS('rp_flex',fx);LS('rp_wkskip',sp);
  fxClose();monFreeze();
  const pl=LS('rp_plan');if(pl){rPlan(pl);rTrack();rToday()}
}
function fxReset(key){
  if(!confirm('Rimettere questa settimana com’era nel piano? Le modifiche fatte seduta per seduta si perdono.'))return;
  const fx=flexAll();delete fx[key];LS('rp_flex',fx);monFreeze();
  const pl=LS('rp_plan');if(pl){rPlan(pl);rTrack();rToday()}
}
const fxSL=s=>s?`<b>${fxEsc(s.n)}</b>`:'riposo';
// ---- ↔ Sposta
function fxMove(){
  const s=fxCur(),from=fxIso(FX.key,s.t);
  const days=fxDays(FX.key).filter(d=>d.iso!==from);
  fxShell('Sposta la seduta',fxEsc(s.n),`<p class="fx-note">Scegli il giorno. Se è già occupato, le due sedute si scambiano.</p>`+
    days.map((d,i)=>`<button class="fx-day" onclick="fxMoveTo(${i},'fxMove()')"><b>${fxDL(d.iso)}</b><span>${d.sess.length?d.sess.map(x=>fxEsc(x.n)+(fxHard(x)?' · dura':'')).join(', '):'libero'}</span></button>`).join(''),
    `<button class="btn btn2" onclick="fxMenu()">Indietro</button>`);
  FX.days=days;
}
function fxMoveTo(i,back){
  const d=FX.days[i],o=fxLists([FX.key,d.key]),src=o[FX.key],s=src[FX.si],fromT=s.t,from=fxIso(FX.key,fromT);
  src.splice(FX.si,1);
  const there=o[d.key].filter(x=>x.t===d.t&&!x.done&&!isGoalRace(x));
  o[d.key]=o[d.key].filter(x=>!there.includes(x));
  there.forEach(x=>{x.t=fromT;src.push(x)});
  o[d.key].push({...s,t:d.t});
  const lines=[`${fxSL(s)}: ${fxDL(from)} → ${fxDL(d.iso)}`].concat(there.map(x=>`${fxSL(x)}: ${fxDL(d.iso)} → ${fxDL(from)} (scambio)`));
  fxPreview(o,lines,back||'fxMove()');
}
// ---- ⬇ Alleggerisci
function fxEasier(){
  const s=fxCur(),iso=fxIso(FX.key,s.t),Z=fxCtx(FX.key).Z;
  const days=fxDays(FX.key).filter(d=>d.iso>iso);
  FX.days=days;
  const fxEasyS=x=>!x.done&&!fxHard(x)&&planCls(x.n)==='easy'; // il lungo non è un giorno «facile» da sacrificare
  const easyDays=days.map((d,i)=>({d,i})).filter(({d})=>d.sess.length&&d.sess.every(fxEasyS));
  fxShell('Alleggerisci oggi',fxEsc(s.n)+' · '+fxDL(iso),
    `<div class="fx-sec">Rendila facile</div><div class="fx-chips">
      <button onclick="fxEasy(0)">Riposo</button><button onclick="fxEasy(5)">5 km facili</button><button onclick="fxEasy(8)">8 km facili</button></div>
     <div class="fx-sec">Sposta il lavoro duro più avanti</div><p class="fx-note">Oggi diventa riposo; la seduta va in un giorno libero o al posto di una corsa facile.</p>
     ${days.filter(d=>d.sess.every(fxEasyS)).map(d=>`<button class="fx-day" onclick="fxMoveHard(${days.indexOf(d)})"><b>${fxDL(d.iso)}</b><span>${d.sess.length?d.sess.map(x=>fxEsc(x.n)).join(', '):'libero'}</span></button>`).join('')||'<p class="fx-note">Nessun giorno libero o con corsa facile nei prossimi giorni.</p>'}
     <div class="fx-sec">Scambiala con un giorno facile</div>
     ${easyDays.map(({d,i})=>`<button class="fx-day" onclick="fxSwapEasy(${i})"><b>${fxDL(d.iso)}</b><span>${d.sess.map(x=>fxEsc(x.n)).join(', ')}</span></button>`).join('')||'<p class="fx-note">Nessuna corsa facile da scambiare nei prossimi giorni.</p>'}`,
    `<button class="btn btn2" onclick="fxMenu()">Indietro</button>`);
}
function fxEasy(kmE){
  const o=fxLists([FX.key]),L=o[FX.key],s=L[FX.si],iso=fxIso(FX.key,s.t),Z=fxCtx(FX.key).Z;
  if(!kmE)L.splice(FX.si,1);
  else L[FX.si]={t:s.t,n:'Easy',load:1,d:`${Math.round(kmE*Z.Ea/60)}' @ ${Z.E} (Z2) — alleggerita`,km:kmE};
  fxPreview(o,[`${fxDL(iso)}: ${fxSL(s)} → ${kmE?`<b>Easy ${kmE} km</b>`:'riposo'}`],'fxEasier()');
}
function fxMoveHard(i){
  const d=FX.days[i],o=fxLists([FX.key,d.key]),src=o[FX.key],s=src[FX.si],iso=fxIso(FX.key,s.t);
  src.splice(FX.si,1);
  const gone=o[d.key].filter(x=>x.t===d.t);
  o[d.key]=o[d.key].filter(x=>x.t!==d.t);o[d.key].push({...s,t:d.t});
  fxPreview(o,[`${fxSL(s)}: ${fxDL(iso)} → ${fxDL(d.iso)}`,`${fxDL(iso)}: riposo`].concat(gone.map(x=>`${fxDL(d.iso)}: ${fxSL(x)} tolta`)),'fxEasier()');
}
function fxSwapEasy(i){fxMoveTo(i,'fxEasier()')}
// ---- ⇄ Cambia: stimolo → seduta
function fxStim(){
  const s=FX.si!=null?fxCur():null;
  fxShell(FX.si!=null?'Cambia seduta · 1 di 2':'Aggiungi seduta · 2 di 3','Scegli lo stimolo',
    FX_STIM.map(([id,t,d])=>`<button class="fx-opt" onclick="fxPick('${id}')"><b>${t}</b><span>${d}</span></button>`).join(''),
    `<button class="btn btn2" onclick="${FX.si!=null?'fxMenu()':'fxAddDays()'}">Indietro</button>`);
}
function fxPick(stim){
  const c=fxCtx(FX.key);FX.stim=stim;FX.bank=fxBank(stim,c.Z);
  const t=(FX_STIM.find(x=>x[0]===stim)||[])[1];
  fxShell(FX.si!=null?'Cambia seduta · 2 di 2':'Aggiungi seduta · 3 di 3',t,
    `<p class="fx-note">Passi calcolati sul VDOT di questa settimana (${c.Z.vd.toFixed(1)}).</p>`+
    FX.bank.map((b,i)=>`<button class="fx-opt" onclick="fxUse(${i})"><b>${fxEsc(b.n)} · ≈${b.km} km</b><span>${hrTag(fxEsc(b.d))}</span>${sessBar(b.d,14)}<em>costo di recupero ${fxCost(b)}</em></button>`).join(''),
    `<button class="btn btn2" onclick="fxStim()">Indietro</button>`);
}
function fxUse(i){
  const b=FX.bank[i];
  if(FX.si==null){ // aggiunta
    const o=fxLists([FX.key]);o[FX.key].push({t:FX.addT,...b});
    return fxPreview(o,[`${fxDL(fxIso(FX.key,FX.addT))}: aggiunta ${fxSL(b)} (≈${b.km} km)`],`fxPick('${FX.stim}')`);
  }
  const o=fxLists([FX.key]),L=o[FX.key],s=L[FX.si];
  L[FX.si]={t:s.t,...b};
  fxPreview(o,[`${fxDL(fxIso(FX.key,s.t))}: ${fxSL(s)} → ${fxSL(b)} (≈${s.km} → ${b.km} km)`],`fxPick('${FX.stim}')`);
}
// ---- ＋ Aggiungi
function fxAdd(key){FX={key,si:null};fxAddDays()}
function fxAddDays(){
  const days=fxDays(FX.key).filter(d=>d.key===FX.key);FX.days=days;
  fxShell('Aggiungi seduta · 1 di 3','Scegli il giorno',
    days.map((d,i)=>`<button class="fx-day" onclick="FX.addT=FX.days[${i}].t;fxStim()"><b>${fxDL(d.iso)}</b><span>${d.sess.length?d.sess.map(x=>fxEsc(x.n)).join(', ')+' (si aggiunge)':'libero'}</span></button>`).join('')||'<p class="fx-note">Nessun giorno ancora disponibile in questa settimana.</p>',
    `<button class="btn btn2" onclick="fxClose()">Annulla</button>`);
}
// ---- 🏁 Gara o test
function fxRace(){
  const s=fxCur();
  fxShell('Gara o test',fxEsc(s.n)+' · '+fxDL(fxIso(FX.key,s.t)),
    `<label>Tipo</label><div class="fx-chips" id="fx-rk"><button class="on" data-v="gara" onclick="fxTog(this)">Gara</button><button data-v="test" onclick="fxTog(this)">Prova cronometrata</button></div>
     <label>Distanza</label><select id="fx-rd" onchange="document.getElementById('fx-rdo').style.display=this.value==='x'?'':'none'">
       <option value="3">3 km</option><option value="5" selected>5 km</option><option value="10">10 km</option><option value="15">15 km</option><option value="16.09">10 miglia</option><option value="21.0975">Mezza maratona</option><option value="x">Altra distanza…</option></select>
     <input id="fx-rdo" type="number" step="0.1" min="1" placeholder="km" style="display:none;margin-top:6px">
     <label>Impegno</label><div class="fx-chips" id="fx-re"><button class="on" data-v="tutta" onclick="fxTog(this)">A tutta</button><button data-v="ctrl" onclick="fxTog(this)">Controllata</button></div>
     <label>Superficie</label><select id="fx-rs"><option>strada</option><option>pista</option><option>trail</option><option>collinare</option></select>
     <label>Obiettivo (facoltativo)</label><input id="fx-rg" type="text" placeholder="es. sotto 21:00, o «sensazioni»">`,
    `<button class="btn btn2" onclick="fxMenu()">Indietro</button><button class="btn" onclick="fxRaceGo()">Anteprima</button>`);
}
function fxTog(b){[...b.parentElement.children].forEach(x=>x.classList.toggle('on',x===b))}
function fxRaceGo(){
  const v=id=>document.getElementById(id).value,on=id=>document.querySelector(`#${id} .on`).dataset.v;
  let dist=v('fx-rd')==='x'?+v('fx-rdo'):+v('fx-rd');
  if(!dist||dist<1)return alert('Indica la distanza in km.');
  const c=fxCtx(FX.key),kind=on('fx-rk'),eff=on('fx-re'),surf=v('fx-rs'),goal=v('fx-rg').trim();
  const rp=predict(dist,c.Z.vd)/dist*(eff==='ctrl'?1.03:1);
  const lab=Math.abs(dist-21.0975)<.01?'Mezza':Math.abs(dist-16.09)<.01?'10 miglia':(+dist.toFixed(1))+'k';
  const o=fxLists([FX.key]),L=o[FX.key],s=L[FX.si];
  const ns={t:s.t,n:`🏁 ${kind==='test'?'Test':'Gara'} ${lab}`,race:true,load:eff==='ctrl'?3:4,
    d:`${dist>=21?dist.toFixed(1):+dist.toFixed(2)} km @ ${fmtP(rp)}/km — ${eff==='ctrl'?'controllata':'a tutta'} · ${surf}${goal?' · obiettivo: '+goal.replace(/[<>]/g,''):''}`,km:+dist.toFixed(1)};
  L[FX.si]=ns;
  fxPreview(o,[`${fxDL(fxIso(FX.key,s.t))}: ${fxSL(s)} → ${fxSL(ns)} (${ns.d.replace(/[<>]/g,'')})`],'fxRace()');
}
// ---- ✎ Modifica
function fxParse(d){
  let m=String(d).match(/^(\d+)×(\d+(?:[.,]\d+)?)\s*(m|'|km)\s*@\s*([0-9:–\-]+)\s*\((I|R|T|M|Z2)\)(.*)$/s);
  if(m)return{kind:'reps',n:+m[1],amt:+m[2].replace(',','.'),unit:m[3],zone:m[5],tail:m[6]};
  m=String(d).match(/^(\d+(?:[.,]\d+)?)\s*(km|')(\s*continui)?\s*@\s*([0-9:–\-]+)\s*\((I|R|T|M|Z2)\)(.*)$/s);
  if(m)return{kind:'cont',amt:+m[1].replace(',','.'),unit:m[2],zone:m[5],tail:m[6],cont:!!m[3]};
  return{kind:'free'};
}
function fxModify(){
  const s=fxCur(),P=fxParse(s.d),rm=P.tail&&P.tail.match(/rec (\d+)'(30")?/);
  FX.mod={P,s,rec:rm?+rm[1]+(rm[2]?.5:0):null};
  const zsel=z=>`<select id="fx-mz" onchange="fxModUpd()">${[['Z2','Facile (Z2)'],['M','Maratona (M)'],['T','Soglia (T)'],['I','Interval (I)'],['R','Ripetute (R)']].map(([v,l])=>`<option value="${v}"${v===z?' selected':''}>${l}</option>`).join('')}</select>`;
  const unitL={m:'metri','\'':'minuti',km:'km'};
  let struct='';
  if(P.kind==='reps')struct=`<div class="fx-grid"><div><label>Ripetute</label><div class="fx-step"><button onclick="fxStep(-1)">−</button><input id="fx-mn" type="number" min="1" value="${P.n}" oninput="fxModUpd()"><button onclick="fxStep(1)">+</button></div></div>
      <div><label>Ogni ripetuta (${unitL[P.unit]})</label><input id="fx-ma" type="number" step="${P.unit==='km'?0.5:P.unit==='m'?50:0.5}" value="${P.amt}" oninput="fxModUpd()"></div>
      <div><label>Zona</label>${zsel(P.zone)}</div>
      ${FX.mod.rec!=null?`<div><label>Recupero (minuti)</label><input id="fx-mr" type="number" step="0.5" min="0.5" value="${FX.mod.rec}" oninput="fxModUpd()"></div>`:''}</div>`;
  else if(P.kind==='cont')struct=`<div class="fx-grid"><div><label>${P.unit==='km'?'Distanza (km)':'Durata (minuti)'}</label><input id="fx-ma" type="number" step="${P.unit==='km'?0.5:5}" value="${P.amt}" oninput="fxModUpd()"></div><div><label>Zona</label>${zsel(P.zone)}</div></div>`;
  else struct=`<p class="fx-note">Questa seduta non ha una struttura riconoscibile (ripetute o tratto continuo): modifica direttamente il testo e i km.</p>`;
  fxShell('Modifica la seduta',fxEsc(s.n)+' · '+fxDL(fxIso(FX.key,s.t)),
    `<label>Nome</label><input id="fx-mt" type="text" value="${fxEsc(s.n)}">${struct}
     <label>Descrizione</label><textarea id="fx-md" rows="3">${fxEsc(s.d)}</textarea>
     <label>Km totali (con riscaldamento e defaticamento)</label><input id="fx-mk" type="number" step="0.5" value="${s.km}" oninput="FX.mod.kmTouched=true;fxModFoot()">`,
    `<span class="fx-delta" id="fx-mf"></span><button class="btn btn2" onclick="fxMenu()">Indietro</button><button class="btn" onclick="fxModGo()">Anteprima</button>`);
  fxModFoot();
}
function fxStep(k){const i=document.getElementById('fx-mn');i.value=Math.max(1,(+i.value||1)+k);fxModUpd()}
function fxModUpd(){
  const {P}=FX.mod,Z=fxCtx(FX.key).Z,g=id=>{const e=document.getElementById(id);return e?+e.value:null};
  const zone=document.getElementById('fx-mz').value,pace={Z2:Z.E,M:Z.M,T:Z.T,I:Z.I,R:Z.R}[zone],sec={Z2:Z.Ea,M:Z.p.M,T:Z.p.T,I:Z.p.I,R:Z.p.R}[zone];
  let d,km;
  if(P.kind==='reps'){
    const n=Math.max(1,g('fx-mn')||1),a=g('fx-ma')||P.amt,rec=FX.mod.rec!=null?(g('fx-mr')||FX.mod.rec):null;
    let tail=P.tail;if(rec!=null)tail=tail.replace(/rec \d+'(30")?/,'rec '+recF(rec));
    d=`${n}×${+a}${P.unit==='km'?' km':P.unit} @ ${pace} (${zone})${tail}`;
    const work=P.unit==='m'?n*a/1000:P.unit==='km'?n*a:n*a*60/sec;
    const recKm=rec!=null?(n-1)*rec*60/Z.Ea:P.unit==='m'&&/rec \d+m/.test(tail)?n*a/1000:0;
    km=fxR(4.9+work+recKm);
  }else{
    const a=g('fx-ma')||P.amt;
    d=`${+a}${P.unit==='km'?' km':"'"}${P.cont?' continui':''} @ ${pace} (${zone})${P.tail}`;
    km=fxR((P.unit==='km'?a:a*60/sec)+(zone==='Z2'?0:4.9));
  }
  document.getElementById('fx-md').value=d;
  if(!FX.mod.kmTouched)document.getElementById('fx-mk').value=km;
  fxModFoot();
}
function fxModFoot(){const e=document.getElementById('fx-mf');if(e)e.textContent=`${FX.mod.s.km} km → ${document.getElementById('fx-mk').value||'?'} km`}
function fxModGo(){
  const o=fxLists([FX.key]),L=o[FX.key],s=L[FX.si];
  const n=document.getElementById('fx-mt').value.trim()||s.n,d=document.getElementById('fx-md').value.trim()||s.d,km=+document.getElementById('fx-mk').value||s.km;
  const ns={...s,n,d,km};
  if(ns.n!==s.n)delete ns.load; // con un nome nuovo il carico si ricava dal nome, come per le sedute del piano
  L[FX.si]=ns;
  fxPreview(o,[`${fxDL(fxIso(FX.key,s.t))}: ${fxSL(s)} → ${fxSL(ns)}`,`<span class="fx-d">${fxEsc(d)}</span>`,`≈${s.km} → ${km} km`],'fxModify()');
}


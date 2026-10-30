/* ---------- analisi approfondita di una corsa ---------- */
function hrZone(h){if(!h)return null;try{return ZTAG[zIdx(h)]}catch(e){const f=(h-st.hrrest)/(st.hrmax-st.hrrest);return f<0.6?'Z1':f<0.7?'Z2':f<0.8?'Z3':f<0.9?'Z4':'Z5'}} // zone da evidenza (o confermate): vedi Zcur()
let anaActs=null; // lap della corsa analizzata (per il dettaglio cliccabile)
function lapSel(i){
  if(!anaActs)return;
  const d=document.getElementById('lap-detail');
  const chips=document.querySelectorAll('.lapcard .laprow .lapc');
  if(anaActs.sel===i){anaActs.sel=null;chips.forEach(el=>el.classList.remove('sel'));if(d)d.innerHTML='';return}
  anaActs.sel=i;chips.forEach((el,j)=>el.classList.toggle('sel',j===i));
  if(!d)return;
  const {acts,pcs,best,avgW,vI}=anaActs,l=acts[i],pc=pcs[i];
  const isShort=l[0]<200;
  const dAvg=pc-avgW,dBest=pc-best;
  const zone=hrZone(l[2]),pctMax=l[3]&&st.hrmax?Math.round(l[3]/st.hrmax*100):null;
  const stl=l[5]?(1000/pc)/(l[5]/60):null;
  const distL=l[0]>=950?(l[0]/1000).toFixed(l[0]%1000?2:0)+' km':l[0]+' m';
  // 1) passo vs media lavoro
  const tiles=[`<div class="stat"><b>${fmtP(pc)}<small style="font-size:12px;color:var(--dim)">/km</small></b><span>${distL} in ${fmtD(l[1])}</span><i class="${dAvg<=0.5?'up':'down'}">${Math.abs(dAvg)<0.5?'in linea con la media lavoro':(dAvg<0?'−':'+')+Math.abs(dAvg).toFixed(0)+'s/km vs media lavoro ('+fmtP(avgW)+')'}</i></div>`];
  // 2) a cosa corrisponde questo passo nelle TUE zone (Daniels)
  const cvdL=curVdot();
  if(cvdL){const p=paces(cvdL);
    const Z=[['R','ritmo ripetute brevi',p.R],['I','ritmo VO2max',p.I],['T','ritmo soglia',p.T],['M','ritmo maratona',p.M],['E','ritmo fondo facile',(p.E[0]+p.E[1])/2]];
    let bz=Z[0],bd=1e9;Z.forEach(z=>{const dd=Math.abs(pc-z[2]);if(dd<bd){bd=dd;bz=z}});
    tiles.push(`<div class="stat"><b>${bz[0]}</b><span>zona di passo</span><i>≈ il tuo ${bz[1]} (${fmtP(bz[2])}/km)</i></div>`);}
  // 3) posizione tra i lap interi
  if(!isShort&&vI.length>=2){const vp=vI.map(x=>pcs[x]),rank=vp.slice().sort((a,b)=>a-b).indexOf(pc)+1;
    tiles.push(`<div class="stat"><b>${rank}°<small style="font-size:12px;color:var(--dim)">/${vI.length}</small></b><span>tra i lap interi</span><i>${dBest<0.5?'il più veloce della seduta':'+'+dBest.toFixed(0)+'s/km dal più veloce ('+fmtP(best)+')'}</i></div>`);}
  // 4) cuore
  if(l[2])tiles.push(`<div class="stat"><b>${l[2]}${l[3]?'→'+l[3]:''}</b><span>FC media→max${zone?' · '+zone:''}</span><i>${pctMax?'picco al '+pctMax+'% della tua FC max':''}</i></div>`);
  // 5) costo cardiaco del lap (efficienza)
  if(l[2]){const mbLap=l[0]/(l[2]*l[1]/60);
    const withHr=acts.filter(x=>x[2]&&x[0]>=200);
    const mbAvg=withHr.length?withHr.reduce((s,x)=>s+x[0],0)/withHr.reduce((s,x)=>s+x[2]*x[1]/60,0):null;
    const dMb=mbAvg?mbLap-mbAvg:null;
    tiles.push(`<div class="stat"><b>${mbLap.toFixed(2)}</b><span>metri per battito</span><i class="${dMb==null?'':dMb>=0?'up':'down'}">${dMb==null?'più alto = meno sforzo':(dMb>=0?'+':'')+dMb.toFixed(2)+' vs media seduta: '+(dMb>=0.02?'più efficiente':dMb<=-0.02?'costato di più (deriva o ritmo)':'in linea')}</i></div>`);}
  // 6) cadenza
  if(l[5])tiles.push(`<div class="stat"><b>${l[5]}</b><span>passi al minuto</span><i>${stl?'falcata media '+stl.toFixed(2)+' m':''}</i></div>`);
  d.innerHTML=`<div class="lapdet">${isShort?'<p class="muted" style="margin-bottom:8px">Lap breve (sprint/scarto finale): i confronti con gli altri lap sono poco significativi.</p>':''}<div class="grid3">${tiles.join('')}</div></div>`;
}
function rAnaSel(){
  const sel=document.getElementById('a-sel');
  const cur=sel.value;
  sel.innerHTML=runs.slice().reverse().map(r=>`<option value="${r.date}">${r.date.slice(0,10)} · ${r.title} (${r.km.toFixed(1)} km)</option>`).join('');
  sel.value=cur&&runs.some(r=>r.date===cur)?cur:(runs.length?runs[runs.length-1].date:'');
}
/* ---------- ESECUZIONE vs PRESCRIZIONE ----------
   Prima l'analisi indovinava la struttura dai lap: un 6×2' diventava "6×487m" (i metri sono un
   sottoprodotto del cronometro, cambiano ogni volta), le soglie dello scarto erano in secondi assoluti
   e ogni paragrafo dava il suo verdetto — così la stessa seduta risultava insieme "troppa varianza" e
   "eseguita come da programma". Adesso si parte dal testo della seduta a piano, che è scritto da
   genPlan e quindi ha un formato noto, e si confronta ripetuta per ripetuta. */
function parseWork(txt){
  if(!txt)return null;
  const t=String(txt);
  const bandOf=x=>{const m=x.match(/(\d:\d\d)\s*[–—-]\s*(\d:\d\d)/);
    if(m){const a=toSec(m[1]),b=toSec(m[2]);return{lo:Math.min(a,b),hi:Math.max(a,b)}}
    const o=x.match(/@\s*(\d:\d\d)/);if(o){const a=toSec(o[1]);return{lo:a-3,hi:a+3}}return null};
  const zoneOf=x=>(x.match(/\((I|R|T|M|gara|E|Z2)\)/)||[])[1]||null;
  // ripetute: n × valore, in minuti (') o in metri (m)
  const m=t.match(/(\d+)\s*[x×]\s*(\d+)\s*(m|')/);
  if(m){
    const n=+m[1],v=+m[2],isD=m[3]==='m';
    const seg=t.slice(m.index+m[0].length).split(/,\s*rec/)[0];
    let b=bandOf(seg);
    if(/alternando/.test(seg)){ // criss-cross: due fasce, il target è la loro unione
      const all=[...seg.matchAll(/(\d:\d\d)\s*[–—-]\s*(\d:\d\d)/g)].flatMap(x=>[toSec(x[1]),toSec(x[2])]);
      if(all.length)b={lo:Math.min(...all),hi:Math.max(...all)};
    }
    if(!b)return null;
    return{kind:'reps',n,dist:isD?v:null,dur:isD?null:v*60,lo:b.lo,hi:b.hi,zone:zoneOf(seg),
      label:n+'×'+(isD?v+'m':v+"'"),alt:/alternando/.test(seg)};
  }
  const pr=t.match(/(\d+)'\s*continui\s*da\s*(\d:\d\d)\s*a\s*(\d:\d\d)/);
  if(pr)return{kind:'prog',dur:+pr[1]*60,lo:Math.min(toSec(pr[2]),toSec(pr[3])),hi:Math.max(toSec(pr[2]),toSec(pr[3])),
    zone:zoneOf(t),label:pr[1]+"' progressivi"};
  // blocchi continui a ritmo (medio, ritmo gara, finale del lungo): quelli col tag di zona
  const bl=[...t.matchAll(/(\d+)'\s*@\s*(\d:\d\d)\s*[–—-]\s*(\d:\d\d)\s*\((I|R|T|M|gara)\)/g)];
  if(bl.length){const b=bl[0],tot=bl.reduce((x,y)=>x+ +y[1],0);
    return{kind:'blocchi',n:bl.length,dur:tot*60,lo:Math.min(toSec(b[2]),toSec(b[3])),hi:Math.max(toSec(b[2]),toSec(b[3])),
      zone:b[4],label:bl.length>1?bl.length+' blocchi ('+tot+"' a ritmo)":b[1]+"' a ritmo"};
  }
  // corsa continua facile: nessuna prescrizione da confrontare frazione per frazione
  const ez=t.match(/(\d+)'\s*@\s*(\d:\d\d)\s*[–—-]\s*(\d:\d\d)/);
  if(ez)return{kind:'facile',dur:+ez[1]*60,lo:Math.min(toSec(ez[2]),toSec(ez[3])),hi:Math.max(toSec(ez[2]),toSec(ez[3])),zone:'E',label:ez[1]+"' facili"};
  return null;
}
/* Abbina i lap del .fit alle frazioni prescritte. Se Garmin ha registrato la struttura (allenamento
   programmato) bastano i lap 'act'; se il file ha tutti i lap 'act' — giro manuale o auto-lap — si
   cercano quelli che somigliano alla frazione prescritta. Se non tornano, lo si dichiara. */
function matchReps(pres,laps){
  if(!pres||!laps||!laps.length||pres.kind!=='reps')return null;
  const strutt=laps.some(l=>l[4]!=='act');
  const n=pres.n;
  let cand=laps.filter(l=>l[4]==='act'&&l[0]>=150);
  let dedotto=false;
  const okLap=l=>pres.dist?Math.abs(l[0]-pres.dist)<=pres.dist*0.15
    :pres.dur?Math.abs(l[1]-pres.dur)<=Math.max(10,pres.dur*0.2):false;
  if(!strutt||cand.length>n+1){
    const f=cand.filter(okLap);
    if(f.length>=Math.max(2,n-1)&&f.length<=n+1){cand=f;dedotto=!strutt}
  }
  if(cand.length<2)return null;
  const reps=cand.slice(0,n).map((l,i)=>({i:i+1,m:l[0],s:l[1],pace:l[1]/(l[0]/1000),hr:l[2]}));
  return{reps,trovate:cand.length,attese:n,strutt,dedotto};
}
/* Blocco continuo (medio, ritmo gara, finale del lungo): non sono frazioni da incolonnare — il dato
   giusto è il passo dell'INTERO blocco. Serve che il .fit marchi riscaldamento e defaticamento,
   altrimenti non c'è modo di sapere dove comincia il lavoro e si dichiara che non si sa. */
function matchBlock(pres,laps){
  if(!pres||pres.kind!=='blocchi'||!laps||!laps.length)return null;
  if(!laps.some(l=>l[4]!=='act'))return null;
  const a=laps.filter(l=>l[4]==='act'&&l[0]>=200);
  if(!a.length)return null;
  const m=a.reduce((x,l)=>x+l[0],0),sec=a.reduce((x,l)=>x+l[1],0);
  if(m<800)return null;
  return{m,s:sec,pace:sec/(m/1000),n:a.length};
}
/* Verdetto UNICO sull'esecuzione: quante frazioni, quante in fascia, scarto medio, regolarità.
   La regolarità si misura in % sul passo (6s/km su ripetute a 4:00 sono l'2,5%, su un easy a 5:40
   sono un'altra cosa) e non contraddice mai il verdetto sulla fascia. */
function repVerdict(pres,mr){
  const R=mr.reps,tol=3;
  const pcs=R.map(x=>x.pace),avg=pcs.reduce((a,b)=>a+b,0)/pcs.length;
  const inB=R.filter(x=>x.pace>=pres.lo-tol&&x.pace<=pres.hi+tol).length;
  const spread=Math.max(...pcs)-Math.min(...pcs),spreadPct=spread/avg*100;
  const d=avg<pres.lo?avg-pres.lo:avg>pres.hi?avg-pres.hi:0;
  const band=fmtP(pres.lo)+'–'+fmtP(pres.hi)+'/km'+(pres.zone?' ('+pres.zone+')':'');
  let v='';
  if(mr.trovate<mr.attese)v+=`Hai chiuso ${mr.trovate} frazioni delle ${mr.attese} previste. `;
  else if(mr.trovate>mr.attese)v+=`Ne hai fatte ${mr.trovate} invece delle ${mr.attese} previste (qui sotto le prime ${mr.attese}). `;
  if(inB===R.length)v+=`Tutte a target (${band}): seduta eseguita come prescritta.`;
  else if(inB>=R.length-1)v+=`${inB} frazioni su ${R.length} dentro il target (${band})`+
    (d===0?`, media in fascia.`:`, media ${Math.abs(d).toFixed(0)}s/km ${d<0?'più veloce':'più lenta'}.`);
  else if(d<0)v+=`Media ${Math.abs(d).toFixed(0)}s/km più veloce del target (${band}): ${Math.abs(d)<=5?'gamba brillante':'oltre la prescrizione — il rischio è arrivare cotto alle sedute dopo'}.`;
  else if(d>0)v+=`Media ${d.toFixed(0)}s/km sopra il target (${band}): ${d<=5?'poco sotto ritmo, niente di grave':'la seduta non ha centrato lo stimolo previsto — o era una giornata storta, o il target è troppo ambizioso'}.`;
  else v+=`Media in fascia (${band}), ma ${R.length-inB} frazioni fuori: esecuzione ballerina.`;
  // la regolarità si aggiunge solo quando dice qualcosa che il verdetto sopra non dice già
  if(inB<R.length||spreadPct>3.5)
    v+=` Scarto tra la più veloce e la più lenta: ${spread.toFixed(0)}s/km (${spreadPct.toFixed(1)}%) — `+
      (spreadPct<=1.5?'esecuzione da metronomo.':spreadPct<=3?'buona regolarità.':'partenza troppo generosa: meglio conservativo e chiudere in progressione.');
  return{txt:v,avg,inB,spread,spreadPct,band};
}
/* ---------- schema grafico della seduta (ripreso da RunZones) ----------
   Dal testo della seduta (il formato scritto da genPlan e dalla banca Flex) ricava i blocchi:
   riscaldamento, ripetute, recuperi, tratti continui, defaticamento. Larghezza = minuti, altezza e
   colore = zona. Le distanze diventano minuti col passo scritto nella seduta (o col VDOT attuale).
   Riscaldamento 15' e defaticamento 10' si aggiungono alle sedute di qualità, come dicono le note operative. */
const SB_LV={wu:1,cd:1,rec:0,Z2:1,E:1,M:2,gara:3,T:3,I:4,R:4};
function sbPace(seg,z){const m=String(seg).match(/(\d:\d\d)\s*[–—-]\s*(\d:\d\d)/);if(m)return(toSec(m[1])+toSec(m[2]))/2;
  const o=String(seg).match(/@\s*(\d:\d\d)/);if(o)return toSec(o[1]);
  const p=paces(curVdot()||45),E=(p.E[0]+p.E[1])/2;return{Z2:E,E,M:p.M,T:p.T,I:p.I,R:p.R,gara:p.T,rec:p.E[0]}[z]||E}
function sessBlocks(d){
  const t=String(d||'').replace(/\s+/g,' ').trim();if(!t)return[];
  const ZA={'ritmo mezza':'T',steady:'M',test:'gara','E→T':'T','E→M':'M'};
  const zOf=x=>{const m=String(x).match(/\((I|R|T|M|Z2|E|gara|ritmo mezza|steady|test|E→T|E→M)\)/);return m?ZA[m[1]]||m[1]:null};
  const B=[],add=(z,min)=>{if(min>0)B.push({z,min})};
  const toMin=(v,u,pace)=>u==="'"?v:u==='"'?v/60:u==='km'?v*pace/60:u==='m'?v/1000*pace/60:v;
  const rc=t.match(/^(\d+(?:[.,]\d+)?)\s*km\s*@\s*(\d:\d\d)\/km/);
  if(rc){add('gara',+rc[1].replace(',','.')*toSec(rc[2])/60);return B}
  let quality=false;
  t.split(/\s\+\s/).forEach(seg=>{
    // lungo con il lavoro dentro: "125' @ E — nella seconda metà 2×16' @ M alternati a 10' @ E…", "135' @ E — ultimi 50' @ M"
    const em=seg.match(/^(\d+)'\s*@\s*[^—]*?—\s*(.+)$/);
    if(em&&/\((M|T|I|R)\)/.test(em[2])){
      const T=+em[1],tail=em[2],W=[];
      let q=tail.match(/(\d+)\s*[x×]\s*(\d+)'\s*@[^,]*?\((M|T|I|R)\)\s*alternati a\s*(\d+)'/);
      if(q){for(let i=0;i<+q[1];i++){W.push({z:q[3],min:+q[2]});if(i<+q[1]-1)W.push({z:'Z2',min:+q[4]})}}
      else{q=tail.match(/(\d+)'\s*@[^(]*\((M|T|I|R)\)/);if(q)W.push({z:q[2],min:+q[1]})}
      const S=W.reduce((a,b)=>a+b.min,0);
      if(W.length&&S<T){const pre=/ultimi/.test(tail)?T-S:/seconda metà/.test(tail)?T/2:(T-S)/2;add('Z2',pre);W.forEach(b=>add(b.z,b.min));add('Z2',T-pre-S);return}
    }
    if(/\bMona\b/i.test(seg)){[90,90,60,60,60,60,30,30,30,30,15,15,15,15].forEach(v=>{add('R',v/60);add('rec',v/60)});quality=true;return}
    let m=seg.match(/(\d+)\s*[x×]\s*\(\s*(\d+(?:[.,]\d+)?)'\s*@\s*([^/]*)\/\s*(\d+(?:[.,]\d+)?)'\s*@\s*([^)]*)\)/);
    if(m){const z1=zOf(m[3])||'I',z2=zOf(m[5]);for(let i=0;i<+m[1];i++){add(z1,+m[2].replace(',','.'));add(z2&&z2!=='Z2'&&z2!=='E'?z2:'rec',+m[4].replace(',','.'))}quality=true;return}
    m=seg.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(m|'|km|")/);
    if(m){
      const n=+m[1],v=+m[2].replace(',','.'),u=m[3],body=seg.slice(m.index+m[0].length),work=body.split(/,\s*rec/)[0];
      const light=/allungh|forte|sprint|lanciat|sciolt/i.test(seg),alt=/alternando/.test(work);
      const z=zOf(work)||(light?'R':'I'),rep=toMin(v,u,sbPace(work,z));
      const rm=body.match(/rec\s*(\d+)'(30")?/),rmM=body.match(/rec\s*(\d+)\s*m/),rmS=body.match(/rec\s*(\d+)"/);
      const rec=rm?+rm[1]+(rm[2]?.5:0):rmS?+rmS[1]/60:rmM?+rmM[1]/1000*sbPace('','rec')/60:0;
      for(let i=0;i<n;i++){if(alt){add('M',rep/2);add('T',rep/2)}else add(z,rep);if(i<n-1&&rec)add('rec',rec)}
      if(!light)quality=true;return;
    }
    m=seg.match(/(\d+)'\s*continui\s*da/);if(m){const zt=zOf(seg)||'M',q=+m[1]/4;add('Z2',q);add('Z2',q);add('M',q);add(zt,q);return} // progressivo: sale a gradini
    m=seg.match(/(\d+(?:[.,]\d+)?)\s*(km|')(?:\s*continui)?\s*@/);
    if(m){const z=zOf(seg)||'Z2';add(z,toMin(+m[1].replace(',','.'),m[2],sbPace(seg,z)));if(z!=='Z2'&&z!=='E')quality=true;return}
    m=seg.match(/(\d+)'/);if(m)add(zOf(seg)||'Z2',+m[1]);
  });
  if(quality&&!(B[0]&&(B[0].z==='Z2'||B[0].z==='E'))){B.unshift({z:'wu',min:15});B.push({z:'cd',min:10})}
  return B;
}
function sessBar(d,H){
  const B=sessBlocks(d);if(B.length<2)return'';const tot=B.reduce((a,b)=>a+b.min,0);if(!tot)return'';
  H=H||20;const W=300,hz=[.24,.42,.6,.8,1];let x=0;
  const NM={wu:'riscaldamento',cd:'defaticamento',rec:'recupero'};
  const rects=B.map(b=>{const w=b.min/tot*W,L=SB_LV[b.z]??1,hh=hz[L]*H;
    const r=`<rect x="${x.toFixed(1)}" y="${(H-hh).toFixed(1)}" width="${Math.max(.6,w-.7).toFixed(1)}" height="${hh.toFixed(1)}" rx="1" fill="${zcol(L)}"${NM[b.z]&&b.z!=='rec'?' fill-opacity=".5"':''}><title>${NM[b.z]||ZN[L]} · ${Math.round(b.min*10)/10}'</title></rect>`;x+=w;return r}).join('');
  return `<svg class="sbar" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Struttura: ${Math.round(tot)} minuti">${rects}</svg>`;
}
/* pianificato vs svolto, ripetuta per ripetuta: fascia prescritta in grigio, una barra per ripetuta */
function repChart(pres,R){
  if(!R||R.length<2)return'';
  const W=320,H=130,Pl=34,Pb=18,Pt=8,ps=R.map(x=>x.pace);
  const lo=Math.min(pres.lo,...ps)-6,hi=Math.max(pres.hi,...ps)+6;
  const Y=v=>Pt+(v-lo)/(hi-lo)*(H-Pt-Pb),bw=(W-Pl-6)/R.length;
  let g=`<rect x="${Pl}" y="${Y(pres.lo).toFixed(1)}" width="${W-Pl-4}" height="${Math.max(2,Y(pres.hi)-Y(pres.lo)).toFixed(1)}" fill="var(--line)" opacity=".8"/>`;
  g+=`<text x="${Pl-4}" y="${(Y(pres.lo)+4).toFixed(1)}" text-anchor="end" class="cu">${fmtP(pres.lo)}</text><text x="${Pl-4}" y="${(Y(pres.hi)+4).toFixed(1)}" text-anchor="end" class="cu">${fmtP(pres.hi)}</text>`;
  R.forEach((x,i)=>{const d=x.pace<pres.lo?x.pace-pres.lo:x.pace>pres.hi?x.pace-pres.hi:0;
    const col=Math.abs(d)<3?'#1f9d43':d<0?'#0a84ff':'var(--warn)',cx=Pl+i*bw+bw/2,y=Y(x.pace);
    g+=`<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${(H-Pb).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="${Math.max(3,Math.min(14,bw*.55)).toFixed(1)}" stroke-linecap="round"><title>${i+1}ª · ${fmtP(x.pace)}/km</title></line>`;
    if(R.length<=16)g+=`<text x="${cx.toFixed(1)}" y="${H-4}" text-anchor="middle" class="cu">${i+1}</text>`});
  return `<div class="repc"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Passo di ogni ripetuta rispetto alla fascia prescritta">${g}</svg>
    <p class="muted" style="font-size:11.5px;margin:2px 0 8px">Barra = passo della ripetuta (più alta = più veloce). Fascia grigia = passo prescritto. <span style="color:#1f9d43">■</span> in fascia · <span style="color:#0a84ff">■</span> più veloce · <span style="color:var(--warn)">■</span> più lenta.</p></div>`;
}
/* ---------- note automatiche dopo ogni corsa ("What we noticed" di RunZones) ----------
   Per ogni fascia di FC con almeno 3' di corsa: minuti, passo tenuto con la FC in fascia, FC media in
   fascia, e il confronto col tuo passo abituale nella stessa fascia nei 40 giorni prima della corsa. */
const NOTE_CACHE={};
function runNotes(r){
  const k=r.date+'|'+Object.keys(X).length+'|'+JSON.stringify(Zcur().c)+'|'+(r.np?1:0)+(r.nh?1:0);if(NOTE_CACHE[k])return NOTE_CACHE[k];
  const out=[],x=xOf(r),Z=Zcur();
  if(x){
    for(const i of[1,2,3,4]){const[a,b]=zRange(i,Z);const[ss,mm]=histSum(x,a,b==null?250:b+1);if(ss<180)continue;
      const h=x.hist;let hs=0,hw=0;for(let j=0;j<h.s.length;j++){const hr=h.h0+j;if(hr>=a&&(b==null||hr<=b)){hs+=hr*h.s[j];hw+=h.s[j]}}
      const pc=!r.np&&mm>0?ss/(mm/1000):null,ref=pc?zonePaceWin(i,addDaysISO(r.date.slice(0,10),-1)):null,dd=pc&&ref?Math.round(pc-ref):null;
      out.push(`<b>${ZN[i]}</b> (${zLab(i,Z)}): ${fmtMin(ss)}${pc?` a ${fmtP(pc)}/km`:''} con FC media ${Math.round(hs/hw)}${dd==null?'':Math.abs(dd)>=3?` — <span class="${dd<0?'up':'down'}">${Math.abs(dd)}s/km ${dd<0?'più veloce':'più lento'}</span> del tuo solito in questa fascia`:' — in linea col tuo solito'}.`);
    }
    if(!out.length)out.push('Nessuna fascia con almeno 3 minuti di dati FC affidabili.');
  }else out.push(r.nh?'FC esclusa a mano: nessuna lettura per fascia.':'Corsa senza FC secondo per secondo: nessuna lettura per fascia (importa il .fit).');
  const w=(typeof wxDB!=='undefined')?wxDB[r.date]:null,e=wxEffect(w);if(e&&e.pct>=2.5)out.push(`<b>Meteo</b>: ${Math.round(w.t)} °C, rugiada ${Math.round(w.dp)}° — effetto ${e.lvl} (+${e.pct.toFixed(1)}% sul passo).`);
  const pl=plannedFor(r.date);if(pl)out.push(`<b>Piano</b>: vale come «${fxEsc(pl.name)}» del ${pl.date.slice(8,10)}/${pl.date.slice(5,7)}.`);
  return NOTE_CACHE[k]=out;
}
function rNotes(){
  const el=document.getElementById('d-notes');if(!el)return;
  const last=runs.slice(-5).reverse();
  if(!last.length){el.innerHTML='<p class="muted">Nessuna corsa ancora.</p>';return}
  el.innerHTML=last.map(r=>{const d=dOnly(r.date);
    return `<div class="note"><a href="#" onclick="anaOpen('${r.date}');return false"><b>${['dom','lun','mar','mer','gio','ven','sab'][d.getDay()]} ${d.getDate()}/${d.getMonth()+1}</b> · ${fxEsc(r.title)} · ${r.km.toFixed(1)} km</a>
      <ul>${runNotes(r).map(t=>`<li>${t}</li>`).join('')}</ul></div>`}).join('')+
    `<p class="muted" style="font-size:11.5px">Per ogni fascia di FC con almeno 3': minuti, passo e FC media in fascia, confrontati col tuo passo nella stessa fascia nei 40 giorni prima della corsa.</p>`;
}
/* ---------- altri sport: palestra, bici, camminata… nel calendario e nel carico ----------
   Arrivano dai .fit non di corsa (prima venivano scartati) o si inseriscono a mano. Carico in TRIMP come
   la corsa: dalla FC media se c'è, altrimenti dalla fatica percepita (RPE 1–10 → frazione di riserva
   cardiaca 0,36–0,90). Per la palestra si prende il maggiore dei due: la FC sottostima il carico della forza.
   Entrano in forma/fatica/freschezza (CTL/ATL/TSB) e nel calendario; il carico acuto/cronico in km resta della corsa. */
const XT_SP={gym:['Palestra','🏋️',6],bike:['Bici','🚴',4],walk:['Camminata','🚶',2],hike:['Escursione','🥾',4],swim:['Nuoto','🏊',5],other:['Altro','➕',4]};
let xts=LS('rp_xt')||[];
function allXts(){return [...xts,...(window.runPlanGymActivities?window.runPlanGymActivities():[])].sort((a,b)=>a.date.localeCompare(b.date));}
function xtLoad(x){
  const f=q=>q*.64*Math.exp(1.92*q);
  const qh=x.hr?Math.max(0,Math.min(1,(x.hr-st.hrrest)/(st.hrmax-st.hrrest))):null;
  const rpe=x.rpe||(XT_SP[x.sport]||XT_SP.other)[2],qr=Math.min(.95,.3+.06*rpe);
  const a=qh!=null?x.min*f(qh):0,b=x.min*f(qr);return x.sport==='gym'?Math.max(a,b):(qh!=null?a:b);
}
function xtAdd(){
  const v=id=>document.getElementById(id).value;
  const d=v('xt-d'),t=v('xt-t')||'18:00',m=+v('xt-m');if(!d||!(m>0))return alert('Indica data e durata.');
  const x={id:'m'+Date.now(),date:`${d} ${t}`,sport:v('xt-s'),min:Math.round(m),rpe:+v('xt-r')||null,hr:+v('xt-h')||null,note:v('xt-n').trim()||null,src:'man'};
  xts.push(x);xts.sort((a,b)=>a.date<b.date?-1:1);LS('rp_xt',xts);refresh();
}
function xtDel(id){if(!confirm('Togliere questa attività?'))return;xts=xts.filter(x=>x.id!==id);LS('rp_xt',xts);refresh()}
function rXt(){
  const el=document.getElementById('xt-out');if(!el)return;
  const today=todayISO(),w4=allXts().filter(x=>daysAgo(x)<28);
  const bySp={};w4.forEach(x=>{bySp[x.sport]=(bySp[x.sport]||0)+x.min});
  el.innerHTML=`<div class="xtf">
      <input type="date" id="xt-d" value="${today}"><input type="time" id="xt-t" value="18:00">
      <select id="xt-s">${Object.entries(XT_SP).map(([k,[n,i]])=>`<option value="${k}">${i} ${n}</option>`).join('')}</select>
      <input type="number" id="xt-m" min="5" step="5" placeholder="minuti">
      <select id="xt-r"><option value="">fatica (RPE)</option>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}">${n} · ${n<=2?'molto facile':n<=4?'facile':n<=6?'moderata':n<=8?'dura':'massimale'}</option>`).join('')}</select>
      <input type="number" id="xt-h" min="60" max="220" placeholder="FC media (facolt.)">
      <input type="text" id="xt-n" placeholder="nota (facolt.)">
      <button class="btn" style="margin:0" onclick="xtAdd()">Aggiungi</button></div>
    ${w4.length?`<p class="muted" style="margin:8px 0 4px">Ultime 4 settimane: ${Object.entries(bySp).map(([k,m])=>`${XT_SP[k][1]} ${XT_SP[k][0].toLowerCase()} ${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`).join(' · ')}</p>`:''}
    ${allXts().slice(-15).reverse().map(x=>`<div class="shoecard"><div style="flex:1"><b>${XT_SP[x.sport][1]} ${XT_SP[x.sport][0]}</b> <span class="muted">${x.date.slice(0,10)} · ${x.min}'${x.hr?' · FC '+x.hr:''}${x.rpe?' · RPE '+x.rpe:''}${x.km?' · '+x.km+' km':''} · carico ${Math.round(xtLoad(x))}${x.note?' · '+fxEsc(x.note):''}${x.src==='fit'?' · da .fit':x.src==='passo'?' · dal registro palestra (locale)':''}</span></div>
      <button class="btn btn2" style="width:auto;margin:0 0 0 8px;padding:8px 10px;font-size:12px" onclick="${x.src==='passo'?"showPane('gym')":"xtDel('"+x.id+"')"}">${x.src==='passo'?'Apri':'✕'}</button></div>`).join('')||'<p class="muted" style="margin-top:8px">Nessuna attività. Le sedute di palestra, bici o camminata importate da .fit compaiono qui da sole.</p>'}
    <p class="muted" style="font-size:11.5px;margin-top:6px">Carico in TRIMP, come per la corsa: dalla FC media se c'è, altrimenti dalla fatica percepita (per la palestra conta la maggiore delle due). Entra in forma, fatica e freschezza e nel calendario; il carico acuto/cronico in km resta solo della corsa.</p>`;
}
/* ---------- meteo della corsa ed "effetto meteo" (ripreso da RunZones) ----------
   Meteo orario da Open-Meteo (gratuito, senza chiave, chiamabile dal browser): archivio ERA5 per il
   passato, previsione con date passate per gli ultimi giorni (l'archivio arriva con ~5 giorni di
   ritardo). Posizione: il punto di partenza salvato dal .fit; le corse importate senza GPS (CSV, archivio
   vecchio) usano la località predefinita, Lecce, modificabile. I valori sono mediati sulla durata della
   corsa (5 campioni interpolati fra le ore). Cache in rp_wx, sincronizzata nel cloud.
   Effetto sul passo: regola temperatura + punto di rugiada in °F (Hadley), più un piccolo costo per il
   freddo sotto i 5 °C e per il vento sopra i 12 km/h (percorso misto: il vento contro non si recupera
   tutto a favore). È una stima: serve a leggere le corse estive, non a correggere i dati. */
const WX_H='temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,wind_speed_10m,wind_direction_10m,precipitation';
const WX_HOME={lat:40.35,lon:18.17,name:'Lecce'};
let wxDB=LS('rp_wx')||{};
let wxBusy=false;
const wxHome=()=>(st&&st.wxHome)||WX_HOME;
const wxPos=r=>r.lat!=null&&r.lon!=null?{lat:r.lat,lon:r.lon,src:'gps'}:{lat:wxHome().lat,lon:wxHome().lon,src:'home'};
const wxT=sx=>{const m=String(sx).match(/(\d+)-(\d+)-(\d+)[T ](\d+):(\d+)/);return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]):NaN}; // ora locale "ingenua"
const WX_DIR=['N','NE','E','SE','S','SO','O','NO'];
async function wxGet(url){const r=await fetch(url);if(!r.ok)throw new Error('meteo '+r.status);return r.json()}
function wxAt(H,t){ // valori interpolati all'istante t (ms)
  const h0=Math.floor(t/3600000),f=t/3600000-h0,a=H[h0],b=H[h0+1]||a;if(!a)return null;
  const o={};WX_H.split(',').forEach(k=>{const x=a[k],y=b?b[k]:null;o[k]=x==null?null:y==null?x:(k==='wind_direction_10m'?x:x+(y-x)*f)});return o}
function wxOfRun(H,r){
  const t0=wxT(r.date),dur=(r.sec||0)*1000;if(isNaN(t0))return null;
  const S=[0,1,2,3,4].map(k=>wxAt(H,t0+dur*k/4)).filter(Boolean);if(!S.length||S[0].temperature_2m==null)return null;
  const av=k=>{const v=S.map(x=>x[k]).filter(v=>v!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  const r1=v=>v==null?null:Math.round(v*10)/10;
  return{t:r1(av('temperature_2m')),at:r1(av('apparent_temperature')),rh:Math.round(av('relative_humidity_2m')),dp:r1(av('dew_point_2m')),
    ws:r1(av('wind_speed_10m')),wd:S[2]?S[2].wind_direction_10m:S[0].wind_direction_10m,pr:r1(S.reduce((a,x)=>a+(x.precipitation||0),0)/S.length*Math.max(1,dur/3600000)),
    tmax:r1(Math.max(...S.map(x=>x.temperature_2m).filter(v=>v!=null)))};
}
async function wxSync(force){
  if(wxBusy||!navigator.onLine)return;
  const now=Date.now(),todayS=todayISO();
  const need=runs.filter(r=>daysAgo(r)<730&&r.date.slice(0,10)<=todayS&&(force||!wxDB[r.date]||(wxDB[r.date].fail&&now-wxDB[r.date].fail>864e5)));
  if(!need.length)return;
  wxBusy=true;let changed=0;
  try{
    const groups={};need.forEach(r=>{const p=wxPos(r),k=p.lat.toFixed(2)+','+p.lon.toFixed(2);(groups[k]=groups[k]||{p,rs:[]}).rs.push(r)});
    for(const {p,rs} of Object.values(groups)){
      const ds=rs.map(r=>r.date.slice(0,10)).sort(),from=ds[0],to=ds[ds.length-1];
      const cut=addDaysISO(todayS,-6),H={};
      const put=j=>{if(!j||!j.hourly)return;const T=j.hourly.time;T.forEach((t,i)=>{const h=Math.floor(wxT(t)/3600000);
        const o={};let ok=false;WX_H.split(',').forEach(k=>{o[k]=j.hourly[k][i];if(o[k]!=null)ok=true});if(ok&&(!H[h]||H[h].temperature_2m==null))H[h]=o})};
      const q=`latitude=${p.lat}&longitude=${p.lon}&hourly=${WX_H}&timezone=Europe%2FRome`;
      if(from<=cut)put(await wxGet(`https://archive-api.open-meteo.com/v1/archive?${q}&start_date=${from}&end_date=${to<cut?to:cut}`).catch(e=>{console.warn(e);return null}));
      const fFrom=from>addDaysISO(todayS,-60)?from:addDaysISO(todayS,-60);
      if(to>addDaysISO(todayS,-12))put(await wxGet(`https://api.open-meteo.com/v1/forecast?${q}&start_date=${fFrom}&end_date=${todayS}`).catch(e=>{console.warn(e);return null}));
      rs.forEach(r=>{const w=wxOfRun(H,r);wxDB[r.date]=w?{...w,src:p.src,lat:p.lat,lon:p.lon}:{fail:now};changed++});
    }
  }finally{wxBusy=false}
  if(changed){LS('rp_wx',wxDB);try{rManage();rNotes();if(curPane==='runs')rAna()}catch(e){console.warn(e)}}
}
function wxEffect(w){
  if(!w||w.t==null)return null;
  const F=c=>c*9/5+32,sum=F(w.t)+F(w.dp??w.t);
  const B=[[100,0],[110,.5],[120,1],[130,2],[140,3],[150,4.5],[160,6],[170,8],[180,10]];
  let heat=0;if(sum>=180)heat=10+(sum-180)*.2;else for(let i=1;i<B.length;i++)if(sum<B[i][0]){heat=sum<=B[0][0]?0:B[i-1][1]+(B[i][1]-B[i-1][1])*(sum-B[i-1][0])/(B[i][0]-B[i-1][0]);break}
  const cold=w.t<5?(5-w.t)*.15:0,wind=w.ws>12?Math.pow(w.ws-12,2)*.0025:0,pct=heat+cold+wind;
  return{pct,heat,cold,wind,sum,lvl:pct<1?'minimo':pct<2.5?'lieve':pct<5?'moderato':'forte'};
}
const wxLvlCol=l=>({minimo:'var(--acc)',lieve:'var(--z3)',moderato:'var(--warn)',forte:'var(--red)'})[l];
async function wxSetHome(){
  const q=prompt('Località da usare per le corse senza GPS (es. Lecce, Roma, Milano):',wxHome().name||'');if(!q||!q.trim())return;
  try{const j=await wxGet('https://geocoding-api.open-meteo.com/v1/search?count=1&language=it&name='+encodeURIComponent(q.trim()));
    const g=j.results&&j.results[0];if(!g)return alert('Località non trovata.');
    st.wxHome={lat:+g.latitude.toFixed(2),lon:+g.longitude.toFixed(2),name:g.name+(g.admin1?' ('+g.admin1+')':'')};LS('rp_st',st);
    Object.keys(wxDB).forEach(k=>{if(wxDB[k].src==='home'||wxDB[k].fail)delete wxDB[k]});LS('rp_wx',wxDB);
    rAna();await wxSync();
  }catch(e){alert('Meteo non raggiungibile: '+e.message)}
}
function runWxCard(r){
  const w=wxDB[r.date];
  if(daysAgo(r)>=730)return '';
  if(!w||w.fail){return `<div class="card"><h2>Meteo</h2><p class="muted">${w&&w.fail?'Meteo non disponibile per questa corsa (riprovo domani).':'Scarico il meteo di questa corsa…'}</p></div>`}
  const e=wxEffect(w),p=pace(r),adj=e&&!r.np?p/(1+e.pct/100):null;
  const st2=(v,l)=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  const why=[e.heat>=.3?`caldo umido (temperatura + punto di rugiada = ${Math.round(e.sum)} °F): +${e.heat.toFixed(1)}%`:'',e.cold>=.3?`freddo: +${e.cold.toFixed(1)}%`:'',e.wind>=.3?`vento ${Math.round(w.ws)} km/h: +${e.wind.toFixed(1)}%`:''].filter(Boolean).join(' · ');
  return `<div class="card"><h2>Meteo</h2>
    <div class="grid3">${st2(Math.round(w.t)+'°C',`percepiti ${Math.round(w.at)}°${w.tmax!=null&&w.tmax-w.t>=1?` · max ${Math.round(w.tmax)}°`:''}`)}${st2(w.rh+'%',`umidità · rugiada ${Math.round(w.dp)}°`)}${st2(Math.round(w.ws)+' km/h',`vento da ${WX_DIR[Math.round((w.wd||0)/45)%8]}${w.pr>=.1?` · pioggia ${w.pr} mm`:''}`)}</div>
    <p style="margin:10px 0 4px"><span class="phb" style="background:${wxLvlCol(e.lvl)};color:#fff">Effetto meteo ${e.lvl}</span> <b>≈ +${e.pct.toFixed(1)}%</b> sul passo${why?` <span class="muted">— ${why}</span>`:''}</p>
    ${adj&&e.pct>=1?`<p class="muted">A parità di sforzo, i tuoi <b>${fmtP(p)}/km</b> valgono circa <b>${fmtP(adj)}/km</b> in condizioni ideali (10–12 °C, aria secca, poco vento).</p>`:''}
    <p class="muted" style="font-size:11.5px;margin-top:6px">Meteo orario Open-Meteo mediato sulla durata della corsa · posizione: ${w.src==='gps'?'partenza registrata nel file':`${fxEsc(wxHome().name||'predefinita')} (predefinita: la corsa non ha GPS salvato)`} · <a href="#" onclick="wxSetHome();return false">cambia località predefinita</a></p></div>`;
}
/* ---------- dettaglio corsa: seduta del piano + dati esclusi ---------- */
function runCtlCard(r){
  const d0=r.date.slice(0,10),lk=runLink(r),g=(st.ign||{})[r.date]||{};
  const ss=(todaySessions()||[]).filter(s=>Math.abs(daysBetween(d0,s.date))<=4).sort((a,b)=>a.date<b.date?-1:1);
  const auto=(()=>{const L=st.links;if(!L||!L[r.date])return plannedFor(r.date);const v=L[r.date];delete L[r.date];const p=plannedFor(r.date);L[r.date]=v;return p})();
  const DL=iso=>{const d=dOnly(iso);return `${['dom','lun','mar','mer','gio','ven','sab'][d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`};
  const opt=(v,t)=>`<option value="${v}"${(lk||'')===v?' selected':''}>${t}</option>`;
  const sw=(k,t,d)=>`<label class="ign"><input type="checkbox" ${g[k]?'checked':''} onchange="setRunIgn('${r.date}','${k}',this.checked)"><span><b>${t}</b><br>${d}</span></label>`;
  return `<div class="card"><h2>Piano e dati della corsa</h2>
    <label class="muted" style="display:block;font-size:12px;margin-bottom:4px">Seduta del piano a cui vale questa corsa</label>
    <select onchange="setRunLink('${r.date}',this.value)">
      ${opt('',`Automatico${auto?` — ${DL(auto.date)} · ${auto.name}`:' — nessuna seduta lo stesso giorno'}`)}
      ${ss.map(s=>opt(s.date,`${DL(s.date)} · ${s.name}${s.km?` (≈${s.km} km)`:''}`)).join('')}
      ${opt('none','Nessuna: corsa extra, non a piano')}
    </select>
    <p class="muted" style="margin:6px 0 12px;font-size:12px">Serve quando l’abbinamento automatico sbaglia (es. la seduta del martedì corsa il mercoledì). Monitor, Piano, Oggi e l’analisi della seduta seguono la tua scelta.</p>
    <div class="muted" style="font-size:12px;margin-bottom:4px">Escludi un dato registrato male — la corsa resta in archivio, il dato smette solo di alimentare le analisi</div>
    ${sw('hr','FC esclusa','Niente zone, minuti di soglia, forma e previsioni da FC. Km e passo restano.')}
    ${sw('pace','Passo escluso','Fuori da VDOT, migliori tratti, passo per zona ed efficienza (es. GPS sballato in pista o tra i palazzi). FC e km restano.')}
    ${sw('vol','Km esclusi','Non contano nel volume settimanale e nel carico (es. distanza doppia o sbagliata). FC e passo restano.')}
  </div>`;
}
function rAna(){
  const el=document.getElementById('a-out');
  const key=document.getElementById('a-sel').value;
  const r=runs.find(x=>x.date===key);
  if(!r){el.innerHTML='';return}
  const c=cls(r),stp=subType(r);
  const sim=runs.filter(x=>x.date!==r.date&&cls(x)===c&&!x.tm===!r.tm);
  const avgS=f=>{const v=sim.map(f).filter(x=>x!=null&&isFinite(x));return v.length?v.reduce((a,b)=>a+b)/v.length:null};
  const mb=x=>x.hr?x.km*1000/(x.hr*x.sec/60):null;
  // medie ponderate di categoria: passo = sec totali/km totali, m/battito = metri totali/battiti totali
  const wPaceSim=(()=>{let s=0,k=0;sim.forEach(x=>{s+=x.sec;k+=x.km});return k?s/k:null})();
  const wMbSim=(()=>{let m=0,b=0;sim.forEach(x=>{if(x.hr){m+=x.km*1000;b+=x.hr*x.sec/60}});return b?m/b:null})();
  const zone=hrZone(r.hr),zmax=hrZone(r.hrmax);
  const vd=vdotOf(r.km,r.sec),cvd=curVdot();
  const lp0=lapsDB[key];const allLaps=lp0&&lp0.laps?lp0.laps:[];
  // sotto i 200 m sono allunghi o resti dell'auto-lap: entravano nell'analisi e diventavano
  // "la frazione più veloce (4:30/km)" dentro una corsa facile.
  const acts=allLaps.filter(l=>l[4]==='act'&&l[0]>=200);
  // cluster delle frazioni uguali: se il .fit non marca riscaldamento e defaticamento questi restano
  // in mezzo agli 'act' e fanno sembrare i lap non uniformi — si prova a togliere gli estremi.
  const repCore=(()=>{const uni=a=>a.length>=3&&a.every(l=>Math.abs(l[0]-a[0][0])<100);
    for(const cnd of [acts,acts.slice(1),acts.slice(0,-1),acts.slice(1,-1)])if(uni(cnd))return cnd;
    return[];})();
  const planSess=plannedFor(key),pres=parseWork(planSess&&planSess.work);
  const mrep=matchReps(pres,allLaps),mblk=matchBlock(pres,allLaps);
  // split prima/seconda parte per DISTANZA (non per numero di lap): con lap eterogenei
  // (es. 10×1km + allunghi da 100m) dividere a metà per conteggio falsa i passi.
  const halfIdx=a=>{const tot=a.reduce((s,l)=>s+l[0],0),mid=tot/2;let cum=0,i=0;
    for(;i<a.length-1;i++){if(cum+a[i][0]>=mid)break;cum+=a[i][0];}
    const before=mid-cum,after=a[i][0]-before;const s=before>=after?i+1:i;
    return Math.min(Math.max(s,1),a.length-1);};
  const PARA=[];
  // 1. contesto
  const DN=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  const dt=day(r.date);
  const wkTot=runs.filter(x=>weekKey(x.date)===weekKey(r.date)).reduce((s,x)=>s+vk(x),0);
  const idx=runs.findIndex(x=>x.date===r.date);
  const prev=idx>0?runs[idx-1]:null;
  let ctx=`${CLSN[c]}${stp?' ('+stp+')':''} di ${r.km.toFixed(1)} km, ${DN[dt.getDay()]} ${dt.getHours()<12?'mattina':dt.getHours()<18?'pomeriggio':'sera'}, passo medio ${fmtP(pace(r))}/km, in una settimana da ${wkTot.toFixed(0)} km totali.`;
  // sui GIORNI di calendario: col confronto fra orari una serale seguita da una mattutina due giorni
  // dopo risultava "il giorno prima" (18 casi in archivio)
  if(prev){
    const gap=Math.round((dOnly(r.date)-dOnly(prev.date))/864e5);
    ctx+=gap<=1?` Arrivavi dalla ${CLSN[cls(prev)].toLowerCase()} del giorno prima (${prev.km.toFixed(1)} km).`
      :` Arrivavi da ${gap-1} giorn${gap-1===1?'o':'i'} di riposo.`}
  PARA.push(ctx);
  // 2. esecuzione — se c'è una prescrizione da confrontare, quella comanda
  let ex='',repHtml='';
  if(pres&&mrep&&c!=='race'){
    const vd2=repVerdict(pres,mrep);
    const R=mrep.reps,unitD=!!pres.dist;
    ex=`Previsto: <b>${pres.label} @ ${vd2.band}</b>. ${vd2.txt}`;
    if(mrep.dedotto)ex+=` <span class="muted">(il .fit non marca riscaldamento e recuperi: ho riconosciuto le frazioni per somiglianza con quelle prescritte)</span>`;
    const best=Math.min(...R.map(x=>x.pace));
    repHtml=repChart(pres,R)+`<table class="reptab"><thead><tr><th>Frazione</th><th>${unitD?'Tempo':'Distanza'}</th><th>Passo</th><th>Δ target</th>${R.some(x=>x.hr)?'<th>FC</th>':''}</tr></thead><tbody>`+
      R.map(x=>{const d=x.pace<pres.lo?x.pace-pres.lo:x.pace>pres.hi?x.pace-pres.hi:0;
        const klass=Math.abs(d)<3?'ok':d<0?'fast':'slow';
        return `<tr><td>${x.i}ª${x.pace===best?' ★':''}</td><td>${unitD?fmtD(Math.round(x.s)):Math.round(x.m)+' m'}</td><td>${fmtP(x.pace)}</td><td class="${klass}">${Math.abs(d)<3?'in fascia':(d>0?'+':'−')+Math.abs(d).toFixed(0)+'s'}</td>${R.some(y=>y.hr)?`<td>${x.hr||'–'}</td>`:''}</tr>`}).join('')+
      `</tbody></table>`;
  }else if(pres&&mblk&&c!=='race'){ // blocco continuo: conta il passo dell'INTERO blocco, non la prima frazione
    const dr=mblk.pace<pres.lo?mblk.pace-pres.lo:mblk.pace>pres.hi?mblk.pace-pres.hi:0;
    const d=Math.abs(dr)<3?0:Math.round(dr); // ±3s è la tolleranza dichiarata nelle note del piano
    const band=fmtP(pres.lo)+'–'+fmtP(pres.hi)+'/km'+(pres.zone?' ('+pres.zone+')':'');
    ex=`Previsto: <b>${pres.label} @ ${band}</b>. Hai corso ${(mblk.m/1000).toFixed(2)} km di lavoro in ${fmtD(Math.round(mblk.s))} a <b>${fmtP(mblk.pace)}/km</b> — `+
      (d===0?'dentro la fascia prescritta: blocco centrato.'
      :d<0?`${Math.abs(d).toFixed(0)}s/km più veloce del target${Math.abs(d)<=5?': gamba brillante.':': sopra la prescrizione — il medio corso a soglia costa più di quanto rende.'}`
      :`${d.toFixed(0)}s/km più lento del target${d<=5?': in pratica in linea.':': lo stimolo previsto non è stato raggiunto.'}`);
  }else if(pres&&(pres.kind==='facile'||pres.kind==='prog')&&!mrep){
    const pc=pace(r),d=pc<pres.lo?pc-pres.lo:pc>pres.hi?pc-pres.hi:0;
    ex=`Previsto: <b>${pres.label} @ ${fmtP(pres.lo)}–${fmtP(pres.hi)}/km</b>. Passo medio ${fmtP(pc)}/km — `+
      (d===0?'dentro la fascia prescritta.'
      :d<0?`${Math.abs(d).toFixed(0)}s/km più veloce del previsto${c==='easy'||c==='long'?': il facile corso forte è il modo più comune di arrivare stanchi alle sedute che contano.':'.'}`
      :`${d.toFixed(0)}s/km più lento del previsto: giornata pesante, caldo o percorso.`);
  }else if(c!=='race'&&repCore.length>=3){ // nessuna prescrizione: struttura dedotta dai lap
    const secs=repCore.map(l=>l[1]),dd=repCore.map(l=>l[0]);
    const aTempo=(Math.max(...secs)-Math.min(...secs))<=4&&(Math.max(...dd)-Math.min(...dd))/(dd.reduce((a,b)=>a+b,0)/dd.length)>0.012;
    const et=aTempo?(Math.round(secs[0])>=60&&Math.round(secs[0])%60===0?Math.round(secs[0]/60)+"'":Math.round(secs[0])+'"'):Math.round(repCore[0][0])+'m';
    const pcs=repCore.map(l=>l[1]/(l[0]/1000));
    const avg=pcs.reduce((a,b)=>a+b,0)/pcs.length,best=Math.min(...pcs),bi=pcs.indexOf(best)+1;
    const spread=Math.max(...pcs)-Math.min(...pcs),spPct=spread/avg*100;
    ex=`Nessuna seduta a piano per questa data, la struttura la deduco dai lap: <b>${repCore.length}×${et}</b> a ${fmtP(avg)}/km di media, migliore la ${bi}ª (${fmtP(best)}). Scarto ${spread.toFixed(0)}s/km (${spPct.toFixed(1)}%): ${spPct<=1.5?'esecuzione da metronomo':spPct<=3?'buona regolarità':'partenza troppo generosa, meglio conservativo e chiudere in progressione'}.`;
    if(cvd){const pz=paces(cvd);
      const zz=[['R',pz.R],['I',pz.I],['T',pz.T],['M',pz.M]].reduce((b,z)=>Math.abs(avg-z[1])<Math.abs(avg-b[1])?z:b);
      ex+=` Il passo tenuto cade nella tua zona <b>${zz[0]}</b> attuale (${fmtP(zz[1])}/km).`}
  }else if(acts.length>=2){
    const si=halfIdx(acts);
    const pAvg=a=>a.reduce((x,l)=>x+l[1],0)/a.reduce((x,l)=>x+l[0]/1000,0);
    const t1=pAvg(acts.slice(0,si)),t2=pAvg(acts.slice(si)),d=t2-t1;
    const pcs=acts.map(l=>l[1]/(l[0]/1000)),fi=pcs.indexOf(Math.min(...pcs))+1;
    ex=`Prima parte a ${fmtP(t1)}/km, seconda a ${fmtP(t2)}/km: ${d<=-2?'negative split netto — gestione da manuale, partito con margine e chiuso in crescendo':d<=1?'ritmo uniforme, buona gestione dello sforzo':d<=6?'leggero positive split, partenza un filo generosa ma tenuta accettabile':'positive split marcato: partito troppo forte, e la seconda metà lo ha pagato'}. La frazione più veloce è stata la ${fi}ª (${fmtP(Math.min(...pcs))}/km).`;
  }else if(cvd){
    const p=paces(cvd),pc=pace(r);
    if(c==='easy'||c==='long')
      ex=pc<p.E[1]-3?`Il passo è più veloce della tua fascia easy attuale (${fmtP(p.E[1])}–${fmtP(p.E[0])}): l'hai corsa come un medio, e il recupero ne risente.`
        :pc<=p.E[0]+10?`Il passo è dentro la tua fascia easy attuale (${fmtP(p.E[1])}–${fmtP(p.E[0])}): esattamente dove deve stare una corsa di costruzione.`
        :`Passo tranquillo, sotto la fascia easy: perfetto se era un'uscita rigenerante.`;
    else ex=`Passo medio ${fmtP(pc)}/km sull'intera seduta.`;
  }
  if(ex)PARA.push(ex);
  if(repHtml)PARA.push({raw:repHtml});
  // 3. risposta cardiaca
  let hrp='';
  if(r.hr){
    hrp=`FC media ${r.hr} bpm (${zone})${r.hrmax?`, massima ${r.hrmax} — il ${Math.round(r.hrmax/st.hrmax*100)}% della tua FC max`:''}.`;
    const EXP={easy:['Z1','Z2'],long:['Z1','Z2'],qual:['Z3','Z4'],int:['Z4','Z5'],race:['Z4','Z5']};
    if(EXP[c].includes(zone))hrp+=' Intensità corretta per la tipologia.';
    else if(c==='easy'||c==='long')hrp+=` Per una ${CLSN[c].toLowerCase()} è troppo: il facile deve restare in Z1-Z2, altrimenti rubi energie alle sedute che contano.`;
    else hrp+=(zmax==='Z4'||zmax==='Z5')?' La media è abbassata dai recuperi, ma i picchi nelle frazioni veloci sono nella zona giusta.':' FC mai davvero alta: o la seduta era corsa sotto ritmo, o i recuperi erano troppo generosi.';
    if(acts.length>=4){
      const si=halfIdx(acts);
      const hA=acts.slice(0,si).map(l=>l[2]).filter(Boolean),hB=acts.slice(si).map(l=>l[2]).filter(Boolean);
      if(hA.length&&hB.length){const m=a=>a.reduce((x,y)=>x+y)/a.length;const dr=(m(hB)-m(hA))/m(hA)*100;
        hrp+=` La deriva cardiaca tra prima e seconda parte è ${dr>=0?'+':''}${dr.toFixed(1)}%: ${dr<3?'tenuta aerobica ottima':dr<6?'nella norma per questo tipo di sforzo':'alta — caldo, disidratazione o sforzo oltre la condizione attuale'}.`}
    }
    const myMb=mb(r),refMb=(()=>{let m=0,b=0;runs.filter(x=>cls(x)==='easy'&&x.hr&&!x.np).forEach(x=>{m+=x.km*1000;b+=x.hr*x.sec/60});return b?m/b:null})();
    if(myMb&&refMb&&(c==='easy'||c==='long'))
      hrp+=myMb>refMb*1.03?` Efficienza ${myMb.toFixed(2)} m/battito contro una tua media di ${refMb.toFixed(2)}: il motore sta crescendo.`
        :myMb<refMb*0.97?` Efficienza ${myMb.toFixed(2)} m/battito, sotto la tua media (${refMb.toFixed(2)}): giornata pesante, caldo o percorso ostico.`
        :` Efficienza in linea col tuo standard (${myMb.toFixed(2)} m/battito).`;
  }
  if(hrp)PARA.push(hrp);
  {const w=wxDB[r.date],e=wxEffect(w);if(e&&e.pct>=2.5&&!r.np)PARA.push(`<b>Meteo:</b> ${Math.round(w.t)} °C con rugiada a ${Math.round(w.dp)} °C${w.ws>20?` e vento a ${Math.round(w.ws)} km/h`:''} — effetto ${e.lvl}, circa +${e.pct.toFixed(1)}% sul passo. In condizioni ideali lo stesso sforzo valeva ~${fmtP(pace(r)/(1+e.pct/100))}/km: tienine conto prima di giudicare passo e FC di questa corsa.`)}
  // 3b. beneficio fisiologico prevalente: zona più vicina al passo del LAVORO (lap attivi, recuperi esclusi)
  // → mostrato come callout in evidenza in cima alla lettura, anche per le gare
  let benefit=null;
  if(cvd){
    const pz=paces(cvd);
    const wp=acts.length>=2?acts.reduce((s,l)=>s+l[1],0)/acts.reduce((s,l)=>s+l[0]/1000,0):pace(r);
    const ZB=[
      ['R',pz.R,'velocità ed economia di corsa','reattività neuromuscolare e tecnica: rende più economico ogni altro ritmo'],
      ['I',pz.I,'VO2max','la massima potenza aerobica: alza il tetto del motore'],
      ['T',pz.T,'soglia anaerobica','sposta in su il ritmo che riesci a reggere a lungo — la leva più efficiente dai 10k in su'],
      ['M',pz.M,'endurance specifica','economia di corsa e gestione dei carboidrati al ritmo gara'],
      ['E',(pz.E[0]+pz.E[1])/2,'base aerobica','capillari, mitocondri e metabolismo dei grassi: il fondamento che regge tutto il resto']];
    let bz=ZB[0],bd=1e9;ZB.forEach(z=>{const d=Math.abs(wp-z[1]);if(d<bd){bd=d;bz=z}});
    let desc=c==='race'
      ?`Una gara stimola tutto l'insieme, ma a questo ritmo il carico principale è qui: ${bz[3]}.`
      :`${bz[3].charAt(0).toUpperCase()+bz[3].slice(1)}.`;
    if(c==='race'&&cvd)desc+=` In più, la gara è il test più affidabile della forma: aggiorna la stima del VDOT.`;
    if(c==='long'&&r.sec>=90*60)desc+=` Oltre i 90' si aggiunge il beneficio chiave del lungo: resistenza strutturale e capacità di usare i grassi.`;
    if(c==='int'&&acts.length>=2&&acts[0][0]<600&&bz[0]!=='R')desc+=' Le frazioni brevi aggiungono anche un lavoro di velocità e tecnica.';
    benefit={zone:bz[0],name:bz[2],desc,wp};
  }
  // 4. contesto storico
  let hist='';
  if(sim.length>=3){
    const faster=sim.filter(x=>pace(x)<pace(r)).length;
    const dAvg=pace(r)-wPaceSim;
    hist=faster===0?`È la più veloce delle tue ${sim.length+1} corse ${CLSN[c].toLowerCase()} in archivio.`:`Su ${sim.length} corse simili in archivio, ${faster} sono state più veloci.`;
    hist+=` Rispetto alla tua media di categoria sei ${Math.abs(dAvg)<1?'esattamente in linea':`${Math.abs(dAvg).toFixed(0)}s/km più ${dAvg<0?'veloce':'lento'}`}.`;
    const prevSim=[...sim].reverse().find(x=>x.date<r.date);
    if(prevSim){const d=pace(r)-pace(prevSim);
      hist+=` La precedente dello stesso tipo (${prevSim.date.slice(0,10)}) era andata ${Math.abs(d)<1?'allo stesso ritmo':`${Math.abs(d).toFixed(0)}s/km più ${d>0?'veloce':'lenta — la direzione è quella giusta'}`}.`}
    const ca=avgS(x=>x.cad);
    if(r.cad&&ca&&Math.abs(r.cad-ca)>=2)hist+=` Cadenza ${r.cad} spm (${r.cad-ca>0?'+':'−'}${Math.abs(r.cad-ca).toFixed(0)} sulla tua media di categoria).`;
  }
  if(hist)PARA.push(hist);
  // 5. indicazione pratica
  let take='';
  if(c==='race'){take=`Come sforzo massimale vale VDOT ${vd.toFixed(1)}${cvd?` (il tuo attuale è ${cvd.toFixed(1)})`:''}: proietta ${fmtD(predict(10,vd))} sui 10k e ${fmtD(predict(21.0975,vd))} in mezza.`;
    if(cvd&&vd>=cvd-0.1)take+=' Vale la pena ricalibrare il piano su questo valore.';}
  else if(c==='int'||c==='qual')take='Seduta che va a libretto: segna il ritmo tenuto e confrontalo con la prossima uguale — è il termometro più affidabile della forma, molto più del passo delle corse facili.';
  else if(c==='long')take=r.sec>=90*60?'Lungo vero: è il mattone aerobico che costruisce la maratona. Oltre i 90 minuti curare idratazione e carboidrati fa metà della seduta.':'Lungo corto: utile come ponte, ma la crescita verso la maratona passa dai lunghi oltre i 90 minuti (fuori estate).';
  else take='Le corse facili fatte davvero facili sono ciò che ti permette di spingere forte nelle sedute che contano: il volume si costruisce qui, senza pagare interessi.';
  // 6. rispetto a oggi
  let now='';
  const ago=daysAgo(r);   // daysAgo è già in giorni interi
  if(cvd){
    if(ago<=14)now=`È una corsa recente (${ago<=1?'ultimi giorni':ago+' giorni fa'}): pesa direttamente sulla stima attuale della tua forma (VDOT ${cvd.toFixed(1)}).`;
    else{
      const around=bestVdot(runs.filter(x=>Math.abs(day(x.date)-dt)<=30*864e5&&!x.np));
      if(around){const d=cvd-around;
        now=`Questa corsa ha ${ago} giorni: all'epoca il tuo VDOT era ~${around.toFixed(1)}, oggi è ${cvd.toFixed(1)}${Math.abs(d)<0.3?' — condizione stabile da allora':d>0?` — da allora sei cresciuto di ${d.toFixed(1)} punti`:` — allora eri più in forma di ${Math.abs(d).toFixed(1)} punti: c'è margine da recuperare`}.`}
    }
  }
  if(now)PARA.push(now);
  // 7. rispetto al piano
  // L'analisi parte dalla PRESCRIZIONE: se la settimana è stata modificata a mano, la prescrizione
  // vera è quella con l'override, non quella del piano grezzo (una gara messa al volo veniva
  // confrontata col lungo che il piano prevedeva prima).
  const plA=applyWkEdits(LS('rp_plan'));
  let plano='';
  if(plA){
    const rd=r.date.slice(0,10);
    const wk=plA.weeks.find(w=>rd>=wkMonISO(plA,w)&&rd<=wkSunISO(plA,w));
    if(wk){
      const PHn={base:'base',speed:'velocità',spec:'specifico',taper:'taper'};
      const dayName=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][dt.getDay()];
      const sess=wk.sess.find(s=>s.t===dayName);
      plano=`Rispetto al piano: cade nella settimana ${wk.w} (fase ${PHn[wk.phase]||'?'}${wk.isDeload?', scarico':''}${wk.summer?', estiva':''}).`;
      if(sess){
        const expC=isRaceSess(sess)?'race':sessCls(sess); // stessa classificazione del piano (monitor.js)
        if(expC===c){
          const kmOk=Math.abs(r.km-sess.km)<=Math.max(2,sess.km*0.2);
          plano+=` Per ${dayName.toLowerCase()} era previsto ${sess.n} (≈${sess.km} km): tipologia rispettata${kmOk?' e chilometraggio in linea — programma seguito.':`, ma sui km sei ${r.km>sess.km?'sopra':'sotto'} (${r.km.toFixed(1)} contro ≈${sess.km}).`}`;
        }else plano+=` Per ${dayName.toLowerCase()} era previsto ${sess.n}, hai corso una ${CLSN[c].toLowerCase()}: uno scambio ogni tanto ci sta, l'importante è non perdere le sedute chiave della settimana.`;
      }else plano+=` Il piano non prevedeva corsa in questo giorno: seduta extra${c==='easy'?' — se resta easy leggera, nessun problema.':' — occhio a non aggiungere qualità fuori programma.'}`;
    }else plano='Rispetto al piano: la corsa è fuori dal periodo coperto dal piano attuale.';
  }
  if(plano)PARA.push(plano);
  if(take)PARA.push(take);
  // ---- assemblaggio: beneficio principale in evidenza, poi lettura, poi i dati
  // 83% dell'archivio viene dal CSV Garmin e non ha i lap: dirlo, invece di far sembrare l'analisi
  // dello stesso spessore di quella di una seduta importata da .fit
  const noLapHtml=allLaps.length?'':`<div class="nolap">Questa corsa non ha i lap: è arrivata dall'export CSV, non da un .fit. Posso leggere solo i totali — niente frazioni, niente confronto con il target delle ripetute, niente deriva cardiaca. Importa il .fit dal tab Corse per l'analisi completa.</div>`;
  const benHtml=benefit?`<div class="benefit"><span class="bl">Beneficio principale</span><b>${benefit.name}</b> <small>· zona ${benefit.zone} · lavoro @ ${fmtP(benefit.wp)}/km</small><p>${benefit.desc}</p></div>`:'';
  let html=`<div class="card"><h2>Lettura della corsa</h2>${noLapHtml}${benHtml}${PARA.map(x=>typeof x==='string'?`<p style="margin-bottom:10px">${x}</p>`:x.raw).join('')}</div>`;
  html+=`<div class="card"><h2>${r.title} · ${r.date.slice(0,10)}</h2>
    <p style="margin-bottom:10px"><span class="badge ${c}">${CLSN[c]}</span>${stp?` <span class="badge">${stp}</span>`:''}${r.tm?' <span class="badge">tapis</span>':''}</p>
    <div class="grid3">
      <div class="stat"><b>${r.km.toFixed(2)}</b><span>km</span></div>
      <div class="stat"><b>${fmtD(r.sec)}</b><span>tempo</span></div>
      <div class="stat"><b>${fmtP(pace(r))}</b><span>min/km</span></div>
      <div class="stat"><b>${r.hr??'–'}</b><span>FC media ${zone?'('+zone+')':''}</span></div>
      <div class="stat"><b>${r.hrmax??'–'}</b><span>FC max</span></div>
      <div class="stat"><b>${r.asc||0}</b><span>m D+</span></div>
    </div></div>`;
  // ---- confronto con le simili
  const drow=(n,val,ref,fmt,dir,u)=>{
    if(val==null)return'';
    if(ref==null)return`<tr><td>${n}</td><td class="r">${fmt(val)}</td><td class="r muted">–</td><td class="r"></td></tr>`;
    const d=val-ref,good=d*dir>0,zero=Math.abs(d)<1e-9;
    return`<tr><td>${n}</td><td class="r">${fmt(val)}</td><td class="r muted">${fmt(ref)}</td>
      <td class="r ${zero?'':good?'up':'down'}">${zero?'=':(d>0?'+':'−')+u(Math.abs(d))}</td></tr>`};
  if(sim.length){
    html+=`<div class="card"><h2>Vs le tue ${sim.length} corse ${CLSN[c].toLowerCase()}</h2>
      <table><tr><th></th><th class="r">Questa</th><th class="r">Media</th><th class="r">Δ</th></tr>
      ${drow('Passo',pace(r),wPaceSim,v=>fmtP(v)+'/km',-1,v=>v.toFixed(0)+'s')}
      ${drow('FC media',r.hr,avgS(x=>x.hr),v=>Math.round(v)+' bpm',-1,v=>v.toFixed(0))}
      ${drow('m/battito',mb(r),wMbSim,v=>v.toFixed(2),1,v=>v.toFixed(2))}
      ${drow('Cadenza',r.cad,avgS(x=>x.cad),v=>Math.round(v)+' spm',1,v=>v.toFixed(0))}
      ${drow('Lung. passo',r.stl,avgS(x=>x.stl),v=>v.toFixed(2)+' m',1,v=>v.toFixed(2))}
      ${drow('Contatto suolo',r.gct,avgS(x=>x.gct),v=>Math.round(v)+' ms',-1,v=>v.toFixed(0))}
      ${drow('Oscillazione',r.vo,avgS(x=>x.vo),v=>v.toFixed(1)+' cm',-1,v=>v.toFixed(1))}
      </table></div>`;
  }
  // ---- lap: striscia orizzontale di chip cliccabili, con barra velocità e dettaglio sotto
  anaActs=null;
  if(acts.length>=2){
    const pcs=acts.map(l=>l[1]/(l[0]/1000));
    // classifica e "migliore" solo sui lap interi (≥200m): il micro-lap finale da sprint falsa i confronti
    const vI=acts.map((l,i)=>l[0]>=200?i:-1).filter(i=>i>=0);
    const vP=vI.length?vI.map(i=>pcs[i]):pcs;
    const best=Math.min(...vP),worst=Math.max(...vP),bi=pcs.indexOf(best)+1;
    const avgW=acts.reduce((s,l)=>s+l[1],0)/acts.reduce((s,l)=>s+l[0]/1000,0);
    anaActs={acts,pcs,best,worst,avgW,vI,sel:null};
    const distL=l=>l[0]>=950?(l[0]/1000).toFixed(l[0]%1000?2:0)+' km':l[0]+' m';
    const chips=acts.map((l,i)=>{const pc=pcs[i];
      const w=worst>best?Math.min(100,Math.max(10,Math.round(15+85*(worst-pc)/(worst-best)))):100;
      return`<div class="lapc${pc===best&&l[0]>=200?' best':''}" onclick="lapSel(${i})"><span class="ln">Lap ${i+1}</span><b>${fmtP(pc)}</b><span class="lu">/km</span><div class="lbar"><i style="width:${w}%"></i></div><span class="lm">${distL(l)} · ${fmtD(l[1])}</span>${l[2]?`<span class="lm">FC ${l[2]}→${l[3]??'–'} · ${hrZone(l[2])}</span>`:''}${l[5]?`<span class="lm">${l[5]} spm</span>`:''}</div>`}).join('');
    const hrsL=acts.map(l=>l[2]).filter(Boolean),spms=acts.map(l=>l[5]).filter(Boolean);
    const sum=[`media lavoro <b class="pace">${fmtP(avgW)}/km</b>`,`migliore ${fmtP(best)} (lap ${bi})`,`scarto ${(worst-best).toFixed(0)}s/km`];
    if(hrsL.length)sum.push(`FC media lap ${Math.round(hrsL.reduce((a,b)=>a+b)/hrsL.length)} bpm`);
    if(spms.length)sum.push(`cadenza media ${Math.round(spms.reduce((a,b)=>a+b)/spms.length)} spm`);
    html+=`<div class="card lapcard"><h2>Lap <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">· tocca un lap per i dettagli</span></h2><div class="laprow">${chips}</div><div id="lap-detail"></div><p class="muted" style="margin-top:8px">${sum.join(' · ')}</p></div>`;
  }
  try{html+=anaXCard(r)}catch(e){console.warn('anaXCard',e)}
  try{html+=runWxCard(r)}catch(e){console.warn('runWxCard',e)}
  try{html+=runCtlCard(r)}catch(e){console.warn('runCtlCard',e)}
  if(!wxDB[r.date]&&daysAgo(r)<730)setTimeout(()=>wxSync(),0);
  el.innerHTML=html;
}
/* ===== FIT: lettura completa (sessione, lap, record secondo per secondo) ===== */
function parseFit(buf){
  const dv=new DataView(buf);
  const hdr=dv.getUint8(0);
  const dataSize=dv.getUint32(4,true);
  const end=Math.min(hdr+dataSize,buf.byteLength);
  const defs={};let sess=null,sport=null;const laps=[],recs=[];
  const INVALID={1:0xFF,2:0xFFFF,4:0xFFFFFFFF};
  let lastTs=null;
  function readData(d,p,cts){
    const vals={};
    for(const f of d.fields){
      let v=null;
      if(f.s===1)v=dv.getUint8(p);
      else if(f.s===2)v=dv.getUint16(p,d.le);
      else if(f.s===4)v=dv.getUint32(p,d.le);
      if(v!==null&&INVALID[f.s]===v)v=null;
      vals[f.n]=v;p+=f.s;
    }
    p+=d.dev;
    if(vals[253]!=null)lastTs=vals[253];
    else if(cts!=null&&d.gn===20)vals[253]=cts;
    if(d.gn===20)recs.push(vals);
    else if(d.gn===19)laps.push(vals);
    else if(d.gn===18&&!sess)sess=vals;
    else if(d.gn===12&&!sport)sport=vals;
    return p;
  }
  let p=hdr;
  while(p<end){
    const h=dv.getUint8(p++);
    if(h&0x80){ // intestazione a timestamp compresso
      const d=defs[(h>>5)&3];if(!d)throw new Error('FIT non supportato');
      let cts=null;
      if(lastTs!=null){const off=h&0x1F;cts=(lastTs&~0x1F)+off;if(off<(lastTs&0x1F))cts+=0x20;lastTs=cts}
      p=readData(d,p,cts);continue}
    const lt=h&0xF;
    if(h&0x40){
      p++;const arch=dv.getUint8(p++),le=arch===0;
      const gn=dv.getUint16(p,le);p+=2;
      const nf=dv.getUint8(p++);const fields=[];
      for(let i=0;i<nf;i++){fields.push({n:dv.getUint8(p),s:dv.getUint8(p+1)});p+=3}
      let dev=0;
      if(h&0x20){const nd=dv.getUint8(p++);for(let i=0;i<nd;i++){dev+=dv.getUint8(p+1);p+=3}}
      defs[lt]={gn,fields,le,dev};
    }else{
      const d=defs[lt];if(!d)throw new Error('FIT malformato');
      p=readData(d,p,null);
    }
  }
  return{sess,laps,recs,sport};
}

/* ===== metriche per corsa dai record (calcolate una volta all'import) =====
   x = {v, mov, dist, cov, art, hmax, hist:{h0,s,m}, holds:[[banda,sec,m]], best:{m:sec},
        fast:[m/min…], dec:{v,cv,hr,min}, tr:{p,h,a,d}}                                      */
const X_VER=1;
const X_BEST=[400,1000,3000,5000,10000,15000,21097,42195];
function fitX(recs,o){
  o=o||{};const hrmax=o.hrmax||200;
  // 1) serie pulita: solo record con tempo e distanza
  const S=[];
  for(const r of recs){
    const ts=r[253],d=r[5];if(ts==null||d==null)continue;
    const spd=r[73]!=null?r[73]/1000:(r[6]!=null?r[6]/1000:null);
    const alt=r[78]!=null?r[78]/5-500:(r[2]!=null?r[2]/5-500:null);
    let cad=r[4];if(cad!=null&&r[53]!=null)cad+=r[53]/128;
    S.push({ts,d:d/100,hr:r[3]??null,spd,alt,cad:cad!=null?cad*2:null});
  }
  if(S.length<30)return null;
  S.sort((a,b)=>a.ts-b.ts);
  // 2) segmenti in movimento: dt<=30s e velocità >= 1.2 m/s (sotto = fermo o camminata lenta)
  const n=S.length,mv=new Array(n).fill(0),dt=new Array(n).fill(0),dd=new Array(n).fill(0);
  for(let i=1;i<n;i++){
    const t=S[i].ts-S[i-1].ts,x=S[i].d-S[i-1].d;
    if(t>0&&t<=30&&x>=0){const v=x/t;if(v>=1.2&&v<8){mv[i]=1;dt[i]=t;dd[i]=x}}
  }
  // 3) FC: valori fuori scala, picchi isolati e aggancio alla cadenza nei recuperi
  const runV=[];for(let i=1;i<n;i++)if(mv[i])runV.push(dd[i]/dt[i]);
  runV.sort((a,b)=>a-b);const vMed=runV.length?runV[runV.length>>1]:0;
  const hrOk=new Array(n).fill(false);
  for(let i=0;i<n;i++){const h=S[i].hr;hrOk[i]=h!=null&&h>=50&&h<=hrmax+5}
  const W=15;let art=0;
  for(let i=0;i<n;i++){
    if(!hrOk[i])continue;
    const win=[];for(let j=Math.max(0,i-W);j<=Math.min(n-1,i+W);j++)if(hrOk[j])win.push(S[j].hr);
    win.sort((a,b)=>a-b);const med=win[win.length>>1];
    const v=mv[i]?dd[i]/dt[i]:0,c=S[i].cad;
    const spike=Math.abs(S[i].hr-med)>18;
    const cadLock=c!=null&&Math.abs(S[i].hr-c)<=3&&S[i].hr>=.85*hrmax&&v>0&&v<.8*vMed;
    if(spike||cadLock){hrOk[i]=false;if(mv[i])art+=dt[i]}
  }
  // 4) totali, istogramma FC (secondi e metri per battito)
  let mov=0,dist=0,hrSec=0,hmax=0;const hs={},hm={};
  for(let i=1;i<n;i++){if(!mv[i])continue;mov+=dt[i];dist+=dd[i];
    if(hrOk[i]){const h=S[i].hr;hrSec+=dt[i];hs[h]=(hs[h]||0)+dt[i];hm[h]=(hm[h]||0)+dd[i];if(h>hmax)hmax=h}}
  if(mov<300)return null;
  const hk=Object.keys(hs).map(Number).sort((a,b)=>a-b);
  const hist=hk.length?{h0:hk[0],s:[],m:[]}:null;
  if(hist)for(let h=hk[0];h<=hk[hk.length-1];h++){hist.s.push(Math.round(hs[h]||0));hist.m.push(Math.round(hm[h]||0))}
  // 5) linea del tempo in movimento (secondi cumulati) per finestre e tratti
  const T=new Array(n).fill(0),D=new Array(n).fill(0);
  for(let i=1;i<n;i++){T[i]=T[i-1]+(mv[i]?dt[i]:0);D[i]=D[i-1]+(mv[i]?dd[i]:0)}
  // FC lisciata (media 30s sulle sole FC valide) per le tenute
  const sm=new Array(n).fill(null);{let a=0,q=[],sum=0;
    for(let i=0;i<n;i++){if(hrOk[i]&&mv[i]){q.push(i);sum+=S[i].hr}
      while(q.length&&T[i]-T[q[0]]>60){sum-=S[q[0]].hr;q.shift()}
      sm[i]=q.length>=10?sum/q.length:null}}
  // 6) tenute: tratti continui >=5' con FC lisciata (60s) nella stessa banda di 5 bpm (uscite <=45s tollerate)
  const holds=[];{let band=null,st=null,lastIn=null;
    const close=i=>{if(band!=null&&st!=null&&lastIn!=null){const sec=T[lastIn]-T[st];if(sec>=300)holds.push([band,Math.round(sec),Math.round(D[lastIn]-D[st])])}};
    for(let i=0;i<n;i++){if(!mv[i]||sm[i]==null)continue;const b=Math.floor(sm[i]/5)*5;
      if(b===band){lastIn=i;continue}
      if(band!=null&&lastIn!=null&&T[i]-T[lastIn]<=45)continue;
      close(i);band=b;st=i;lastIn=i}
    close(n-1)}
  // 7) migliori tratti su distanza (tempo in movimento)
  const best={};
  for(const L of X_BEST){if(D[n-1]<L)break;let j=0,b=Infinity;
    for(let i=0;i<n;i++){while(j<n&&D[j]-D[i]<L)j++;if(j>=n)break;
      const over=D[j]-D[i],tj=T[j]-(over-L)/Math.max(.1,(D[j]-D[j-1])/Math.max(1,T[j]-T[j-1]));
      const t=tj-T[i];if(t>0&&t<b)b=t}
    if(isFinite(b))best[L]=Math.round(b)}
  // 8) minuti veloci: metri per minuto (media mobile 2') dei minuti in movimento, i 60 migliori
  const mins=[];{let k=1;for(let i=0;i<n;i++){if(T[i]>=k*60){mins.push(D[i]);k++}}}
  const per=[];for(let k=0;k<mins.length;k++)per.push(mins[k]-(k?mins[k-1]:0));
  const two=per.map((v,k)=>k+1<per.length?(v+per[k+1])/2:(k?(v+per[k-1])/2:v));
  const fast=two.slice().sort((a,b)=>b-a).slice(0,60).map(Math.round);
  // 9) deriva cardiaca (Pa:HR) dopo i primi 10', metà contro metà
  let dec=null;
  if(mov>=45*60&&hrSec>=.8*mov){
    const t0=600,tm=(mov+t0)/2;let a=[0,0,0],b=[0,0,0];const sp=[];
    for(let i=1;i<n;i++){if(!mv[i]||!hrOk[i]||T[i]<t0)continue;const g=T[i]<tm?a:b;g[0]+=dd[i];g[1]+=dt[i];g[2]+=S[i].hr*dt[i]}
    if(a[1]>300&&b[1]>300){const e1=(a[0]/a[1])/(a[2]/a[1]),e2=(b[0]/b[1])/(b[2]/b[1]);
      const pm=per.slice(10);const mu=pm.reduce((x,y)=>x+y,0)/Math.max(1,pm.length);
      const cv=pm.length>3?Math.sqrt(pm.reduce((x,y)=>x+(y-mu)**2,0)/pm.length)/mu:1;
      dec={v:+((e1-e2)/e1*100).toFixed(1),cv:+cv.toFixed(3),hr:Math.round((a[2]+b[2])/(a[1]+b[1])),min:Math.round(mov/60)}}
  }
  // 10) traccia ogni 30s: passo s/km, FC, quota, km
  const tr={p:[],h:[],a:[],d:[]};{let k=1,i0=0;
    for(let i=0;i<n;i++){if(T[i]>=k*30||i===n-1){
      const ddx=D[i]-D[i0],tt=T[i]-T[i0];let hsum=0,hw=0,as=0,aw=0;
      for(let j=i0+1;j<=i;j++){if(mv[j]&&hrOk[j]){hsum+=S[j].hr*dt[j];hw+=dt[j]}if(S[j].alt!=null){as+=S[j].alt;aw++}}
      if(tt>0){tr.p.push(ddx>5?Math.round(tt/(ddx/1000)):0);tr.h.push(hw?Math.round(hsum/hw):0);tr.a.push(aw?Math.round(as/aw):0);tr.d.push(Math.round(D[i]/10))}
      i0=i;k++}}}
  return{v:X_VER,mov:Math.round(mov),dist:Math.round(dist),cov:+(hrSec/mov).toFixed(2),art:Math.round(art),hmax,hist,holds,best,fast,dec,tr};
}
/* nome file generico (es. 23989492515_ACTIVITY): meglio dedurre il titolo dai lap */
function genericFitName(n){
  if(/\d{6,}|@/.test(String(n)))return true;
  const w=String(n).toLowerCase().replace(/[\d_\-.]+/g,' ').match(/[a-zà-ù]{3,}/g)||[];
  return w.every(x=>['activity','activities','record','workout','running','run','corsa','garmin','untitled'].includes(x));
}
function fitStruct(rows){ // struttura riconosciuta dai lap: ripetute, interval o progressivo
  const core=rows.filter(r=>r[0]>=200);
  const work=core.filter(r=>r[4]==='act'),rec=core.filter(r=>r[4]==='rest'||r[4]==='rec');
  const kmT=n=>String(Math.round(n*10)/10).replace(/\.0$/,'')+'k';
  if(work.length>=3&&rec.length>=work.length-2){
    const d=work.map(r=>r[0]),avg=d.reduce((x,y)=>x+y,0)/d.length;
    const t=work.map(r=>r[1]),tavg=t.reduce((x,y)=>x+y,0)/t.length;
    const reg=Math.max(...d)-Math.min(...d)<=.15*avg;
    const lbl=reg?(avg>=1000?kmT(avg/1000):Math.round(avg/50)*50+'m'):Math.round(tavg/60)+"'";
    return{kind:avg<=600?'Ripetute':'Interval',label:work.length+'x'+lbl};
  }
  if(work.length>=3){
    const p=work.map(r=>r[1]/(r[0]/1000));let dn=0;
    for(let i=1;i<p.length;i++)if(p[i]<p[i-1]-2)dn++;
    if(dn>=p.length-2&&p[0]-p[p.length-1]>=30)
      return{kind:'Progressivo',label:kmT(work.reduce((x,r)=>x+r[0],0)/1000)};
  }
  return null;
}
function fitTitle(rows,km,key){
  const kmT=n=>String(Math.round(n*10)/10).replace(/\.0$/,'')+'k';
  const st=fitStruct(rows),pl=plannedFor(key),n=pl&&pl.name; // il nome della seduta a piano batte l'indovinello
  if(st)return (n||st.kind)+' - '+st.label;
  if(n)return n+' - '+kmT(km);
  return (km>=15?'Lungo - ':'Easy - ')+kmT(km);
}
document.getElementById('dt-fit').addEventListener('change',async e=>{
  const files=[...e.target.files];
  e.target.value=''; // senza reset, riselezionare lo stesso file non emette 'change' e non succede nulla
  if(!files.length)return;
  try{
    const{nf,nr,nu,nx}=await importFit(files);
    alert(nf?`${nf} file .FIT elaborati · ${nr} nuove corse${nu?` · ${nu} già presenti (aggiornate)`:''} · FC secondo per secondo su ${nx}`:'Nessun file .FIT elaborato');
  }catch(err){alert('Errore import .FIT: '+err.message)}
});


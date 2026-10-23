/* ---------- import: un .fit (da file singolo o da archivio) ---------- */
async function ingestFitBuf(buf,name,ctx){
  const INT={0:'act',1:'rest',2:'wu',3:'cd',4:'rec'};
  const{sess,laps,recs}=parseFit(buf);
  if(!sess)throw new Error('nessuna sessione nel file');
  if(sess[5]!==1&&sess[5]!=null){ // non è una corsa: va negli altri sport (prima veniva scartata)
    const SP={2:'bike',11:'walk',17:'hike',5:'swim',10:'gym',4:'gym'};
    const d0=new Date((sess[2]+631065600)*1000),pd=n=>String(n).padStart(2,'0');
    const k0=`${d0.getFullYear()}-${pd(d0.getMonth()+1)}-${pd(d0.getDate())} ${pd(d0.getHours())}:${pd(d0.getMinutes())}`;
    const mn=Math.round((sess[8]||sess[7]||0)/60000);
    if(mn>=5&&!xts.some(x=>x.date===k0)){xts.push({id:'f'+k0,date:k0,sport:SP[sess[5]]||'other',min:mn,hr:sess[16]??null,km:sess[9]?+(sess[9]/100000).toFixed(1):null,src:'fit'});
      xts.sort((a,b)=>a.date<b.date?-1:1);LS('rp_xt',xts);ctx.xt=(ctx.xt||0)+1}
    ctx.skip++;return}
  const dt=new Date((sess[2]+631065600)*1000);
  const pad=n=>String(n).padStart(2,'0');
  const key=`${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  const km=+((sess[9]||0)/100000).toFixed(2);
  const rows=laps.filter(l=>(l[9]||0)>0).map(l=>[Math.round(l[9]/100),+(l[8]/1000).toFixed(1),l[15]??null,l[16]??null,INT[l[23]]||'act',l[17]!=null?Math.round(l[17]*2):null]);
  // stessa corsa già in archivio (es. dal CSV): stesso giorno, partenza entro 5', km simili
  let old=runs.find(r=>r.date===key);
  if(!old){const t=dt.getTime();old=runs.find(r=>r.date.slice(0,10)===key.slice(0,10)&&Math.abs(day(r.date).getTime()-t)<=5*60000&&Math.abs(r.km-km)<=Math.max(.3,km*.03))}
  const k=old?old.date:key;
  if(rows.length)lapsDB[k]={laps:rows};
  // punto di partenza (semicircoli → gradi), solo per il meteo: arrotondato al centesimo (~1 km)
  const semi=v=>v==null?null:(v>0x7FFFFFFF?v-0x100000000:v)*180/2147483648;
  let la=semi(sess[3]),lo=semi(sess[4]);
  if(la==null||lo==null){const r0=recs.find(x=>x[0]!=null&&x[1]!=null);if(r0){la=semi(r0[0]);lo=semi(r0[1])}}
  const pos=la!=null&&lo!=null&&Math.abs(la)<=90&&Math.abs(lo)<=180?{lat:+la.toFixed(2),lon:+lo.toFixed(2)}:null;
  if(old&&pos&&old.lat==null){old.lat=pos.lat;old.lon=pos.lon;if(wxDB[k]&&wxDB[k].src==='home')delete wxDB[k]}
  const x=fitX(recs,{hrmax:st.hrmax});if(x){X[k]=x;ctx.nx++}
  const base=String(name||'').replace(/\.fit$/i,'');
  const title=genericFitName(base)?fitTitle(rows,km,k):base;
  if(!old){
    if(!sess[9]||!sess[8])return;
    runs.push({date:key,title,km,sec:Math.round(sess[8]/1000),hr:sess[16]??null,hrmax:sess[17]??null,
      cad:sess[18]!=null?Math.round((sess[18]+(sess[92]??0)/128)*2):null,
      stl:sess[134]!=null?+(sess[134]/10000).toFixed(2):null,vr:sess[132]!=null?+(sess[132]/100).toFixed(2):null,
      vo:sess[89]!=null?+(sess[89]/100).toFixed(2):null,gct:sess[91]!=null?Math.round(sess[91]/10):null,
      asc:sess[22]??0,tm:sess[6]===1?1:0,...(pos&&sess[6]!==1?pos:{})});
    ctx.nr++;
  }else{if(genericFitName(old.title))old.title=title;ctx.nu++}
}
async function importFit(files){
  const ctx={nr:0,nu:0,nx:0,skip:0,nf:0};
  for(const f of files){try{await ingestFitBuf(await f.arrayBuffer(),f.name,ctx);ctx.nf++}catch(err){alert(f.name+': '+err.message)}}
  runs.sort((a,b)=>a.date<b.date?-1:1);
  try{LS('rp_lapsdb',lapsDB);LS('rp_runs',runs);saveX();zCache=null;refresh()}
  catch(err){alert('Dati importati, ma errore nell\'aggiornamento schermata: '+err.message)}
  return ctx;
}
function loadJSZip(){
  if(window.JSZip)return Promise.resolve(window.JSZip);
  return new Promise((res,rej)=>{const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload=()=>res(window.JSZip);s.onerror=()=>rej(new Error('non riesco a caricare il lettore ZIP: serve la connessione'));document.head.appendChild(s)});
}
async function gunzipBuf(buf){
  if(typeof DecompressionStream==='undefined')throw new Error('browser senza supporto gzip');
  return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
async function importZip(file,onProg){
  const JSZip=await loadJSZip();
  const ctx={nr:0,nu:0,nx:0,skip:0,nf:0,err:0};const queue=[];
  async function walk(zip,depth){
    for(const e of Object.values(zip.files)){if(e.dir)continue;const n=e.name.toLowerCase();
      if(n.endsWith('.zip')&&depth<3){try{await walk(await JSZip.loadAsync(await e.async('arraybuffer')),depth+1)}catch(err){ctx.err++}}
      else if(n.endsWith('.fit')||n.endsWith('.fit.gz'))queue.push(e)}
  }
  onProg&&onProg(0,0,'Apro l\'archivio…');
  await walk(await JSZip.loadAsync(file),0);
  for(let i=0;i<queue.length;i++){const e=queue[i];
    try{let b=await e.async('arraybuffer');if(e.name.toLowerCase().endsWith('.gz'))b=await gunzipBuf(b);
      await ingestFitBuf(b,e.name.split('/').pop().replace(/\.gz$/i,''),ctx);ctx.nf++}catch(err){ctx.err++}
    if(i%8===0){onProg&&onProg(i+1,queue.length);await new Promise(r=>setTimeout(r,0))}}
  runs.sort((a,b)=>a.date<b.date?-1:1);
  LS('rp_lapsdb',lapsDB);LS('rp_runs',runs);saveX();zCache=null;refresh();
  return{...ctx,total:queue.length};
}


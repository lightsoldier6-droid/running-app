/* ---------- cloud sync (Firebase) ---------- */
const firebaseConfig={apiKey:"AIzaSyBzU-XqbcaYnYIRhLTHzAWhSnHihLir-to",authDomain:"runplan-359bd.firebaseapp.com",projectId:"runplan-359bd",storageBucket:"runplan-359bd.firebasestorage.app",messagingSenderId:"551652841397",appId:"1:551652841397:web:441b785ee34d7000d5abfc"};
firebase.initializeApp(firebaseConfig);
const fbAuth=firebase.auth();
const fbDb=firebase.firestore();
let cloudReady=false,cloudUnsub=null;
/* Dati della corsa sincronizzati: [campo del payload, chiave localStorage, lettura in invio, obbligatorio].
   Senza lettura si invia LS(chiave). Obbligatorio = in ricezione si applica solo se presente e non vuoto
   (corse, lap e impostazioni non vanno mai sovrascritti con null); gli altri si applicano anche se null.
   Per sincronizzare un dato nuovo basta aggiungerlo qui. La Palestra viaggia a parte (gym*, in fondo). */
const CLOUD_KEYS=[
  ['runs','rp_runs',()=>runs,true],
  ['lapsdb','rp_lapsdb',()=>lapsDB,true],
  ['edits','rp_edits',()=>edits],
  ['st','rp_st',()=>st,true],
  ['monitor','rp_monitor',()=>monitor],
  ['plan','rp_plan'],['ics','rp_ics'],['wkedit','rp_wkedit'],['wkskip','rp_wkskip'],
  ['flex','rp_flex'],['wx','rp_wx'],['xt','rp_xt'],
];
const cloudSessionId=Math.random().toString(36).slice(2);

function authSubmit(mode){
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-pass').value;
  const errEl=document.getElementById('auth-err');
  errEl.textContent='';
  const p=mode==='signup'?fbAuth.createUserWithEmailAndPassword(email,pass):fbAuth.signInWithEmailAndPassword(email,pass);
  p.catch(e=>{errEl.textContent=e.message});
}

function renderCloudStatus(){
  const el=document.getElementById('cloud-status'),bt=document.getElementById('cloud-logout');
  if(!el)return;
  const u=fbAuth.currentUser;
  if(u){el.textContent='Connesso come '+u.email+'. Corse e palestra si sincronizzano automaticamente su tutti i dispositivi.';bt.style.display='block'}
  else{el.textContent='Non connesso.';bt.style.display='none'}
}

fbAuth.onAuthStateChanged(user=>{
  const gate=document.getElementById('auth-gate');
  if(user){
    gate.style.display='none';
    startCloudSync(user.uid);
  }else{
    gate.style.display='flex';
    cloudReady=false;
    if(cloudUnsub){cloudUnsub();cloudUnsub=null}
  }
  renderCloudStatus();
});

function startCloudSync(uid){
  if(cloudUnsub)return;
  const ref=fbDb.collection('users').doc(uid);
  cloudUnsub=ref.onSnapshot(doc=>{
    if(doc.metadata.hasPendingWrites)return;
    const d=doc.data();
    cloudReady=true;
    try{cloudXIn(d)}catch(e){console.warn('cloud hrx',e)}
    if(!d){pushCloud();pushGymCloud();return} // primo accesso in assoluto: nessun dato cloud, pubblico quello che ho in locale
    let gymNew=false;try{gymNew=gymIn(d)}catch(e){console.warn('cloud palestra',e)}
    const remoteV=d.updatedAt&&d.updatedAt.toMillis?d.updatedAt.toMillis():0;
    const localV=+(localStorage.getItem('rp_cloud_v')||0);
    if(remoteV&&remoteV<=localV){if(gymNew)location.reload();return} // già applicato
    localStorage.setItem('rp_cloud_v',remoteV);
    if(d.writer===cloudSessionId){if(gymNew)location.reload();return} // conferma di una mia scrittura, già aggiornato in locale
    let payload={};try{payload=JSON.parse(d.payload||'{}')}catch(e){}
    for(const [f,k,,req] of CLOUD_KEYS){const v=payload[f];if(req?v:v!==undefined)localStorage.setItem(k,JSON.stringify(v))}
    location.reload();
  },err=>console.warn('cloud sync',err));
}

let cloudSyncTimer=null;
function pushCloud(){
  if(!cloudReady||!fbAuth.currentUser)return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer=setTimeout(()=>{
    fbDb.collection('users').doc(fbAuth.currentUser.uid).set({
      payload:JSON.stringify(Object.fromEntries(CLOUD_KEYS.map(([f,k,get])=>[f,get?get():LS(k)]))),
      writer:cloudSessionId,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true}).catch(e=>console.warn('cloud push',e));
  },1200);
}

/* Palestra: localStorage['passo-v1'] viaggia negli stessi dati utente ma in campi propri (gym, gymAt, gymWriter),
   con una versione sua: le scritture della corsa e quelle della palestra non si sovrascrivono a vicenda.
   rp_gym_dirty = modifiche locali non ancora confermate dal cloud (offline, ricarica prima dell'invio):
   finché c'è, un aggiornamento remoto viene unito invece che sostituito, e al primo snapshot si ripubblica. */
const GYM_KEY='passo-v1';
function gymParse(raw){
  try{const s=typeof raw==='string'?JSON.parse(raw):raw;return s&&typeof s==='object'&&[1,2,3,4].includes(s.version)&&Array.isArray(s.history)?s:null}
  catch(e){return null}
}
// unione per id: allenamenti e schede presenti da una sola parte si tengono; a parità di scheda vince la più recente
function gymMerge(remote,local){
  if(!local||local.version!==remote.version)return remote;
  const out={...remote};
  const hid=new Set(remote.history.map(h=>h&&h.id));
  out.history=remote.history.concat(local.history.filter(h=>h&&!hid.has(h.id))).sort((a,b)=>(a.endedAt||0)-(b.endedAt||0));
  if(Array.isArray(remote.routines)&&Array.isArray(local.routines)){
    const byId=new Map(remote.routines.map(r=>[r.id,r]));
    for(const r of local.routines){if(!r)continue;const o=byId.get(r.id);if(!o||(r.updatedAt||0)>(o.updatedAt||0))byId.set(r.id,r)}
    out.routines=[...byId.values()];
  }
  out.custom={...(local.custom||{}),...(remote.custom||{})};
  if(!out.active&&local.active)out.active=local.active;
  return out;
}
// applica la palestra arrivata dal cloud; true se il locale è cambiato (serve ricaricare)
function gymIn(d){
  const v=d.gymAt&&d.gymAt.toMillis?d.gymAt.toMillis():0;
  const localV=+(localStorage.getItem('rp_gym_v')||0);
  const raw=localStorage.getItem(GYM_KEY),local=gymParse(raw);
  const dirty=localStorage.getItem('rp_gym_dirty')==='1';
  if(!v){if(local)pushGymCloud();return false} // nel cloud ancora niente: pubblico la palestra di questo dispositivo
  if(v<=localV){if(dirty&&local)pushGymCloud();return false}
  localStorage.setItem('rp_gym_v',v);
  if(d.gymWriter===cloudSessionId)return false; // conferma di una mia scrittura
  const remote=gymParse(d.gym);
  if(!remote)return false;
  if(local&&(dirty||!localV)){ // primo allineamento di questo dispositivo, o modifiche locali non ancora inviate
    const merged=JSON.stringify(gymMerge(remote,local));
    if(merged===raw)return false;
    localStorage.setItem(GYM_KEY,merged);
    if(merged!==JSON.stringify(remote))localStorage.setItem('rp_gym_dirty','1'); // ripubblico l'unione dopo la ricarica
    else localStorage.removeItem('rp_gym_dirty');
    return true;
  }
  if(d.gym===raw)return false;
  localStorage.setItem(GYM_KEY,d.gym);
  return true;
}
let gymSyncTimer=null;
function pushGymCloud(){
  if(!gymParse(localStorage.getItem(GYM_KEY)))return;
  localStorage.setItem('rp_gym_dirty','1');
  if(!cloudReady||!fbAuth.currentUser)return; // la invio al primo snapshot
  clearTimeout(gymSyncTimer);
  gymSyncTimer=setTimeout(()=>{
    const sent=localStorage.getItem(GYM_KEY);
    if(!gymParse(sent))return;
    fbDb.collection('users').doc(fbAuth.currentUser.uid).set({
      gym:sent,
      gymWriter:cloudSessionId,
      gymAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true}).then(()=>{if(localStorage.getItem(GYM_KEY)===sent)localStorage.removeItem('rp_gym_dirty')})
      .catch(e=>console.warn('cloud push palestra',e));
  },1200);
}

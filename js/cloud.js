/* ---------- cloud sync (Firebase) ---------- */
const firebaseConfig={apiKey:"AIzaSyBzU-XqbcaYnYIRhLTHzAWhSnHihLir-to",authDomain:"runplan-359bd.firebaseapp.com",projectId:"runplan-359bd",storageBucket:"runplan-359bd.firebasestorage.app",messagingSenderId:"551652841397",appId:"1:551652841397:web:441b785ee34d7000d5abfc"};
firebase.initializeApp(firebaseConfig);
const fbAuth=firebase.auth();
const fbDb=firebase.firestore();
let cloudReady=false,cloudUnsub=null;
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
  if(u){el.textContent='Connesso come '+u.email+'. Le corse si sincronizzano automaticamente su tutti i dispositivi.';bt.style.display='block'}
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
    if(!d){pushCloud();return} // primo accesso in assoluto: nessun dato cloud, pubblico quello che ho in locale
    const remoteV=d.updatedAt&&d.updatedAt.toMillis?d.updatedAt.toMillis():0;
    const localV=+(localStorage.getItem('rp_cloud_v')||0);
    if(remoteV&&remoteV<=localV)return; // già applicato
    localStorage.setItem('rp_cloud_v',remoteV);
    if(d.writer===cloudSessionId)return; // conferma di una mia scrittura, già aggiornato in locale
    let payload={};try{payload=JSON.parse(d.payload||'{}')}catch(e){}
    if(payload.runs)localStorage.setItem('rp_runs',JSON.stringify(payload.runs));
    if(payload.lapsdb)localStorage.setItem('rp_lapsdb',JSON.stringify(payload.lapsdb));
    if(payload.edits!==undefined)localStorage.setItem('rp_edits',JSON.stringify(payload.edits));
    if(payload.st)localStorage.setItem('rp_st',JSON.stringify(payload.st));
    if(payload.monitor!==undefined)localStorage.setItem('rp_monitor',JSON.stringify(payload.monitor));
    if(payload.plan!==undefined)localStorage.setItem('rp_plan',JSON.stringify(payload.plan));
    if(payload.ics!==undefined)localStorage.setItem('rp_ics',JSON.stringify(payload.ics));
    if(payload.wkedit!==undefined)localStorage.setItem('rp_wkedit',JSON.stringify(payload.wkedit));
    if(payload.wkskip!==undefined)localStorage.setItem('rp_wkskip',JSON.stringify(payload.wkskip));
    if(payload.flex!==undefined)localStorage.setItem('rp_flex',JSON.stringify(payload.flex));
    if(payload.wx!==undefined)localStorage.setItem('rp_wx',JSON.stringify(payload.wx));
    if(payload.xt!==undefined)localStorage.setItem('rp_xt',JSON.stringify(payload.xt));
    location.reload();
  },err=>console.warn('cloud sync',err));
}

let cloudSyncTimer=null;
function pushCloud(){
  if(!cloudReady||!fbAuth.currentUser)return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer=setTimeout(()=>{
    fbDb.collection('users').doc(fbAuth.currentUser.uid).set({
      payload:JSON.stringify({runs,lapsdb:lapsDB,edits,st,monitor,plan:LS('rp_plan'),ics:LS('rp_ics'),wkedit:LS('rp_wkedit'),wkskip:LS('rp_wkskip'),flex:LS('rp_flex'),wx:LS('rp_wx'),xt:LS('rp_xt')}),
      writer:cloudSessionId,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true}).catch(e=>console.warn('cloud push',e));
  },1200);
}


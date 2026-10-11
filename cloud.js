'use strict';
/* Browser-only cloud backup. PUBLIC_KEY is publishable; never use a secret/service key. */
(function(){
const URL='https://zxmuvdjsxhhvzzovdbpa.supabase.co';
const PUBLIC_KEY='sb_publishable_0NmWj9i_F_ypqf2n7heSEw_-zoNZlva';
const REDIRECT='https://moohabusiness-rgb.github.io/gym-log/';
const SESSION='moGymLog.cloudSession.v1',PAIR='moGymLog.cloudPair.v1',BEFORE='moGymLog.beforeCloudRestore.v1';
const el=id=>document.getElementById(id);
let session=null,pair=null,remote=undefined,busy=false,paused=false,syncing=false,issue='',queue=null;
const saved=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const store=(k,x)=>{try{localStorage.setItem(k,JSON.stringify(x));return true}catch(e){console.warn(e);return false}};
const drop=k=>{try{localStorage.removeItem(k)}catch(e){}};
function stats(d){
 const t=d?.tracker||{},ss=Array.isArray(d?.sessions)?d.sessions.length:0;
 const ww=Array.isArray(t.weeks)?t.weeks.filter(w=>w&&(w.weight||w.waist||w.ending||w.steps||w.cardio)).length:0;
 const baseline=Boolean(t.startWeight||t.startWaist);return{sessions:ss,weeks:ww,baseline,hasAny:ss>0||ww>0||baseline};
}
function pretty(t){if(!t)return'Never';const d=new Date(t);return isNaN(d)?'Unknown':d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function ready(){return Boolean(session?.access_token&&session?.user?.id)}
function linked(){return ready()&&pair?.userId===session.user.id}
function dirty(){return linked()&&data.updatedAt!==pair.lastSyncedUpdatedAt}
function online(){return navigator.onLine!==false}
function screen(msg){
 const connected=ready(),badge=el('cloudBadge'),status=el('cloudStatus');
 el('cloudAuthForm').classList.toggle('hidden',connected);
 el('cloudConnected').classList.toggle('hidden',!connected);
 badge.classList.remove('ready','pending','error');
 if(!connected){
    badge.textContent='Not connected';
    status.className='storage-status';
    status.textContent=msg||'Cloud backup is off. Your data is still saved on this device.';
    return;
 }
 el('cloudAccountEmail').textContent=session.user.email||'Signed-in user';
 el('cloudLastSynced').textContent=linked()?'Last synced: '+pretty(pair.lastSyncedAt):'This device is not paired yet';
 const isConflict=linked()&&remote&&remote.revision!==pair.revision;
 const pending=dirty()||!online();
 badge.textContent=issue||isConflict?'Needs attention':syncing?'Syncing':!online()?'Offline':linked()?dirty()?'Pending sync':'Synced':'Not paired';
 if(issue||isConflict)badge.classList.add('error');
 else if(pending)badge.classList.add('pending');
 else if(linked())badge.classList.add('ready');
 status.className='storage-status '+(issue||isConflict?'warning':linked()?'good':'');
 status.textContent=msg||issue||(isConflict?'Cloud changed on another device. Do not overwrite it. Export your current JSON backup.':
  syncing?'Uploading your latest records…':
  !online()?'Offline. Local changes are saved and will sync when possible.':
  linked()?dirty()?'New records saved locally; waiting to sync.':'Cloud backup is current as of '+pretty(pair.lastSyncedAt):
  remote?'Existing backup found. Restore it if you need these records.':
  remote===null?'No cloud backup yet. Choose Back up this device to start.':'Signed in. Choose Check cloud backup.');
 const local=stats(data),cloud=remote?stats(remote.data):null;
 el('cloudComparison').textContent=
   'This device: '+local.sessions+' workouts, '+local.weeks+' weekly records'+(local.baseline?', baseline saved':'')+
   ' | Cloud: '+(remote===undefined?'not checked':remote===null?'empty':cloud.sessions+' workouts, '+cloud.weeks+' weekly records')+
   (isConflict?' | CONFLICT: automatic upload blocked':'');
 el('cloudUpload').textContent=linked()?'Sync local changes now':'Back up this device';
 el('cloudUpload').disabled=busy||syncing||Boolean(remote&&!linked())||isConflict;
 el('cloudRestore').disabled=busy||syncing||!remote;
 el('cloudCheck').disabled=busy||syncing;
}
async function call(path,method,body,authorization=true,extra={},retry=true){
 if(!online())throw Error('Offline. Changes remain saved on this device.');
 if(authorization)await freshSession();
 const headers={apikey:PUBLIC_KEY,Accept:'application/json',...extra};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(authorization&&ready())headers.Authorization='Bearer '+session.access_token;
 let response=await fetch(URL+path,{method:method||'GET',headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 if(response.status===401&&authorization&&retry&&session?.refresh_token){await refreshSession();return call(path,method,body,authorization,extra,false)}
 const raw=await response.text();let result;
 try{result=raw?JSON.parse(raw):null}catch(e){result=null}
 if(!response.ok)throw Error(result?.msg||result?.error_description||result?.message||result?.error||'Cloud request failed: '+response.status);
 return result;
}
function setSession(obj){
 if(!obj?.user?.id||!obj?.access_token||!obj?.refresh_token)throw Error('No session returned. Confirm email first and sign in.');
 session={access_token:obj.access_token,refresh_token:obj.refresh_token,
 expiresAt:Date.now()+1000*(Number(obj.expires_in)||3600),
 user:{id:obj.user.id,email:obj.user.email}};
 if(!store(SESSION,session))throw Error('Browser could not save your login session');
}
async function refreshSession(){
 if(!session?.refresh_token)throw Error('Please sign in again');
 const x=await call('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token},false);
 setSession(x);
}
async function freshSession(){if(!ready())throw Error('Please sign in');if(Date.now()>=session.expiresAt-60000)await refreshSession()}
async function cloudRead(){
 const list=await call('/rest/v1/gym_log_snapshots?select=user_id,data,revision,updated_at&user_id=eq.'+encodeURIComponent(session.user.id)+'&limit=1');
 if(!Array.isArray(list))throw Error('Unexpected cloud response');
 const x=list[0]||null;
 if(x&&(!x.data||!Array.isArray(x.data.sessions)||!x.data.tracker))throw Error('Unknown cloud data format');
 remote=x;return x;
}
function savePair(x,version){
 pair={userId:session.user.id,revision:Number(x.revision),lastSyncedUpdatedAt:version===undefined?data.updatedAt:version,lastSyncedAt:x.updated_at||new Date().toISOString()};
 if(!store(PAIR,pair))issue='Cloud saved, but device could not remember its revision. Export a JSON backup.';
}
async function connect(create){
 if(busy)return;
 const email=el('cloudEmail').value.trim().toLowerCase(),password=el('cloudPassword').value;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return notify('Enter a valid email');
 if(password.length<8)return notify('Use a password of at least 8 characters');
 busy=true;issue='';screen('Connecting securely…');
 try{
   if(create){
     const r=await call('/auth/v1/signup','POST',{email,password,options:{email_redirect_to:REDIRECT}},false);
     if(r?.access_token){setSession(r);await cloudRead()}
     else {el('cloudPassword').value='';issue='Account created. Check email to confirm your address, then sign in from this app.'}
   }else{const r=await call('/auth/v1/token?grant_type=password','POST',{email,password},false);setSession(r);await cloudRead()}
   el('cloudPassword').value='';
 }catch(e){issue='Sign-in error: '+e.message}
 finally{busy=false;screen()}
}
async function check(){
 if(!ready()||busy||syncing)return;
 busy=true;issue='';screen('Checking cloud backup…');
 try{await cloudRead();if(linked()&&remote&&remote.revision!==pair.revision)issue='Cloud revision changed. Local upload stopped to protect both copies.'}
 catch(e){issue='Cloud check failed: '+e.message}
 finally{busy=false;screen()}
}
async function firstBackup(){
 if(!ready())return notify('Sign in first');
 if(!stats(data).hasAny)return notify('There is no workout data to upload yet');
 if(!confirm('Upload your currently saved workouts and measurements to your private Supabase account? This is your first cloud backup for this device.'))return;
 syncing=true;issue='';screen('Checking cloud for existing records…');
 try{
   if(await cloudRead()){issue='A cloud copy already exists. Export this device to JSON, then choose Restore cloud if appropriate. Initial overwrite is blocked.';return}
   const row=await call('/rest/v1/gym_log_snapshots','POST',{user_id:session.user.id,data:JSON.parse(JSON.stringify(data))},true,{Prefer:'return=representation'});
   if(!Array.isArray(row)||!row[0])throw Error('No confirmation of saved cloud record');
   remote=row[0];savePair(row[0]);notify('Private cloud backup created');
 }catch(e){issue='Backup failed: '+e.message}
 finally{syncing=false;screen()}
}
async function restore(){
 if(!ready()||syncing)return;
 syncing=true;issue='';screen('Checking private cloud backup…');
 try{
   const row=await cloudRead();if(!row){notify('No cloud record available');return}
   const old=stats(data),cloud=stats(row.data);
   const msg='Restore '+cloud.sessions+' cloud workouts and '+cloud.weeks+' weekly records to THIS device?'+
       (old.hasAny?' This replaces the current '+old.sessions+' workouts and '+old.weeks+' weekly records. Export a JSON backup first.':'')+
       ' A pre-restore recovery copy will also be kept locally.';
   if(!confirm(msg))return;
   if(old.hasAny&&!store(BEFORE,data))throw Error('Cannot preserve local records. Export a JSON backup first.');
   const previous=data,previousPair=pair;
   paused=true;
   try{
     data=JSON.parse(JSON.stringify(row.data));
     if(!persist())throw Error('Device storage could not save the restored data');
     savePair(row,data.updatedAt);
     renderHome();renderHistory();renderProgress();notify('Cloud backup restored');
   }catch(e){data=previous;pair=previousPair;throw e}
   finally{paused=false}
 }catch(e){issue='Restore failed: '+e.message}
 finally{syncing=false;screen()}
}
async function push(){
 if(!linked()||busy||syncing||paused)return;
 if(!dirty()){screen('All local changes already backed up.');return}
 if(!online()){screen('Offline: changes are saved locally and queued for backup.');return}
 syncing=true;issue='';screen('Checking for another device update…');
 try{
   const existing=await cloudRead();
   if(!existing||existing.revision!==pair.revision){issue='Cloud changed since your last sync. Automatic upload stopped. Export local JSON backup before choosing a recovery action.';return}
   const snapshot=JSON.parse(JSON.stringify(data));
   const path='/rest/v1/gym_log_snapshots?user_id=eq.'+encodeURIComponent(session.user.id)+'&revision=eq.'+String(pair.revision);
   const rows=await call(path,'PATCH',{data:snapshot},true,{Prefer:'return=representation'});
   if(!Array.isArray(rows)||!rows[0]){issue='Another device changed cloud data during sync. No overwrite performed.';await cloudRead();return}
   remote=rows[0];savePair(remote,snapshot.updatedAt);
   if(dirty())queueSync();
   notify('Cloud backup updated');
 }catch(e){issue='Sync pending: '+e.message}
 finally{syncing=false;screen()}
}
function queueSync(){
 if(paused||!linked())return;
 clearTimeout(queue);queue=setTimeout(()=>{queue=null;push()},1500);screen();
}
async function upload(){
 if(linked()){
   if(remote&&remote.revision!==pair.revision){issue='Cloud has changed; upload blocked. Check cloud first.';screen();return}
   await push();
 }else await firstBackup();
}
function signOut(){
 if(!confirm('Sign out from cloud backup? Workouts remain stored on this device.'))return;
 const token=session?.access_token;session=null;remote=undefined;issue='';drop(SESSION);screen('Signed out. Local data is unchanged.');
 if(token)fetch(URL+'/auth/v1/logout',{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+token}}).catch(()=>{});
}
async function init(){
 pair=saved(PAIR);session=saved(SESSION);screen();
 if(ready()){
   try{await freshSession();await cloudRead();
       if(linked()&&remote&&remote.revision!==pair.revision)issue='Cloud was changed on another device; automatic upload paused.';
       else if(linked()&&dirty())queueSync();
   }catch(e){issue='Cloud unavailable: '+e.message}
 }
 screen();
}
el('cloudSignIn').addEventListener('click',()=>connect(false));
el('cloudCreate').addEventListener('click',()=>connect(true));
el('cloudCheck').addEventListener('click',check);
el('cloudUpload').addEventListener('click',upload);
el('cloudRestore').addEventListener('click',restore);
el('cloudSignOut').addEventListener('click',signOut);
window.addEventListener('online',()=>{if(dirty())queueSync();else if(ready())check()});
window.addEventListener('pageshow',()=>{if(dirty())queueSync()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&dirty())queueSync()});
function unlink(){clearTimeout(queue);queue=null;pair=null;drop(PAIR);issue='This device is no longer paired. Existing cloud backup was not deleted.';screen()}
window.GymCloud={queueSync,refresh:check,unlink,getStatus:()=>({connected:ready(),paired:linked(),needsSync:dirty(),issue})};
init();
})();
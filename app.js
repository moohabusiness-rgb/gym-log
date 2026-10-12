'use strict';
const PLAN={
upperA:{name:'Upper A',day:'Day 1',ex:[['Bench Press',3,10,120,'Chest'],['V-Bar Lat Pulldown',3,10,120,'Back'],['Incline Chest Press',3,10,120,'Upper chest'],['Seated Cable Row',3,10,120,'Back'],['Shoulder Press Machine',3,10,90,'Shoulders'],['Triceps Pushdown',3,12,75,'Triceps'],['Biceps Curl',3,12,75,'Biceps']]},
lowerA:{name:'Lower A',day:'Day 2',ex:[['Leg Press',4,10,120,'Quads + glutes'],['Seated Leg Curl',4,12,90,'Hamstrings'],['Leg Extension',3,12,75,'Quads'],['Seated Calf Raise',3,15,60,'Calves']]},
upperB:{name:'Upper B',day:'Day 4',ex:[['Incline Chest Press',3,10,120,'Upper chest'],['Seated Cable Row',3,10,120,'Back'],['Bench Press',3,10,120,'Chest'],['V-Bar Lat Pulldown',3,10,120,'Back'],['Shoulder Press Machine',3,10,90,'Shoulders'],['Biceps Curl',3,12,75,'Biceps'],['Triceps Pushdown',3,12,75,'Triceps']]},
lowerB:{name:'Lower B',day:'Day 5',ex:[['Leg Press',4,10,120,'Quads + glutes'],['Seated Leg Curl',4,12,90,'Hamstrings'],['Leg Extension',3,12,75,'Quads'],['Seated Calf Raise',3,15,60,'Calves']]}
};
const STRENGTH=['Bench Press','V-Bar Lat Pulldown','Leg Press','Shoulder Press Machine'];
const KEY='moGymLog.v1';
const RECOVERY_KEY=KEY+'.recovery';
let storageWrites=0;
let recoverySnapshot=null;
let recoveryDBPromise=null;
let recoveryWriteQueue=Promise.resolve();
const $=id=>document.getElementById(id);
const defaults=()=>({version:1,sessions:[],tracker:{startDate:'',startWeight:'',startWaist:'',weeks:Array.from({length:12},()=>({ending:'',weight:'',waist:'',steps:'',workouts:'',cardio:'',notes:''})),strength:{}}});
function load(){const d=defaults();try{const raw=localStorage.getItem(KEY)||localStorage.getItem(RECOVERY_KEY)||'{}';const saved=JSON.parse(raw);if(saved&&typeof saved==='object'){d.sessions=Array.isArray(saved.sessions)?saved.sessions:[];const t=saved.tracker||{};d.tracker={...d.tracker,...t};d.tracker.weeks=Array.from({length:12},(_,i)=>({...defaults().tracker.weeks[i],...(t.weeks||[])[i]}));d.tracker.strength=t.strength&&typeof t.strength==='object'?t.strength:{};d.updatedAt=saved.updatedAt||null}}catch(e){console.warn('Saved data could not be read',e)}return d}
let data=load(),activeWorkout=null,clock=null,clockEnd=0,toastTimer=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function fmt(v){if(!v)return '';const d=new Date(v+'T12:00:00');return Number.isFinite(+d)?d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):v}
function notify(message){const n=$('toast');n.textContent=message;n.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.add('hidden'),2300)}
function persist(){
 const previousTimestamp=data.updatedAt;
 data.updatedAt=new Date().toISOString();
 const json=JSON.stringify(data);
 try{
   localStorage.setItem(KEY,json);
   if(localStorage.getItem(KEY)!==json)throw new Error('Saved data readback failed');
   storageWrites++;
   try{localStorage.setItem(RECOVERY_KEY,json)}catch(e){console.warn('Extra local copy not saved',e)}
   scheduleDeviceRecovery(json);
   refreshStorageStatus();
   if(window.GymCloud?.queueSync)window.GymCloud.queueSync();
   return true;
 }catch(e){
   data.updatedAt=previousTimestamp;
   console.error('Gym Log save failed',e);
   notify('Save failed — export a backup!');
   refreshStorageStatus();
   return false;
 }
}

function safeCurrentRecord(){
 try{
   const raw=localStorage.getItem(KEY);
   if(!raw)return null;
   const record=JSON.parse(raw);
   if(!record||typeof record!=='object'||!Array.isArray(record.sessions)||!record.tracker)return null;
   return record;
 }catch(e){console.warn('Unable to read current saved record',e);return null}
}
function counts(record){
 const t=record?.tracker||{};
 const weeks=Array.isArray(t.weeks)?t.weeks:[];
 const baseline=Number(t.startWeight)>0||Number(t.startWaist)>0;
 const weeksSaved=weeks.filter(w=>Number(w?.weight)>0||Number(w?.waist)>0||w?.ending||w?.steps||w?.cardio).length;
 const sessions=Array.isArray(record?.sessions)?record.sessions.length:0;
 const strength=Object.values(t.strength||{}).reduce((sum,v)=>sum+Object.values(v||{}).filter(x=>x!==null&&x!==undefined&&x!=='').length,0);
 return {sessions,weeks:weeksSaved,baseline,strength,score:sessions*10+weeksSaved*4+(baseline?3:0)+strength};
}
function formatSavedTimestamp(raw){
 if(!raw)return 'Unknown';
 const d=new Date(raw);
 return isNaN(d.getTime())?'Unknown':d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}
function refreshStorageStatus(){
 const box=$('storageStatus'),recover=$('recoverBackup');
 if(!box||!recover)return;
 const current=safeCurrentRecord(),n=counts(current);
 box.classList.remove('good','warning');
 if(current && n.score>0){
   box.classList.add('good');
   box.innerHTML='<strong>✓ Local saved data found</strong>'+
    n.sessions+' workouts · '+n.weeks+' weekly check-ins · '+(n.baseline?'baseline saved':'no baseline')+
    '<small>Last saved: '+esc(formatSavedTimestamp(current.updatedAt))+'</small>';
 }else{
   box.classList.add('warning');
   box.innerHTML='<strong>No measurements or workouts found here</strong>'+
    '<small>This Safari storage area is empty. If you used a Home Screen app or another browser, check that location before entering anything again.</small>';
 }
 let backup=null;
 try{backup=recoverySnapshot?JSON.parse(recoverySnapshot):null}catch(e){backup=null}
 recover.classList.toggle('hidden',!(backup&&counts(backup).score>n.score));
}
function openDeviceRecovery(){
 return new Promise(resolve=>{
   if(!('indexedDB' in window))return resolve(null);
   let request;
   try{request=indexedDB.open('GymLogDeviceRecovery',1)}
   catch(e){console.warn('IndexedDB unavailable',e);return resolve(null)}
   request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots')};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>resolve(null);
   request.onblocked=()=>resolve(null);
 });
}
function recoveryDB(){return recoveryDBPromise||(recoveryDBPromise=openDeviceRecovery())}
async function readDeviceRecovery(){
 const db=await recoveryDB();
 if(!db)return null;
 return new Promise(resolve=>{
   try{
     const transaction=db.transaction('snapshots','readonly');
     const request=transaction.objectStore('snapshots').get('latest');
     request.onsuccess=()=>resolve(typeof request.result==='string'?request.result:null);
     request.onerror=()=>resolve(null);
   }catch(e){resolve(null)}
 });
}
async function writeDeviceRecovery(json){
 const db=await recoveryDB();
 if(!db)return false;
 return new Promise(resolve=>{
   try{
     const tx=db.transaction('snapshots','readwrite');
     tx.objectStore('snapshots').put(json,'latest');
     tx.oncomplete=()=>resolve(true);
     tx.onerror=()=>resolve(false);
     tx.onabort=()=>resolve(false);
   }catch(e){resolve(false)}
 });
}
function scheduleDeviceRecovery(json){
 recoveryWriteQueue=recoveryWriteQueue.then(()=>writeDeviceRecovery(json)).then(ok=>{
   if(ok){recoverySnapshot=json;refreshStorageStatus()}
   else console.warn('Secondary device recovery copy was not available');
 },err=>console.warn('Secondary backup failed',err));
}
async function initializeDeviceRecovery(){
 const startWrites=storageWrites;
 // Heal a missing primary record from the immediate local recovery mirror first.
 if(!safeCurrentRecord()){
   try{
     const mirrored=localStorage.getItem(RECOVERY_KEY);
     const old=mirrored&&JSON.parse(mirrored);
     if(old&&Array.isArray(old.sessions)&&old.tracker&&counts(old).score>0&&storageWrites===startWrites){
       data=old;
       if(persist()){
         renderHome();
         if(document.getElementById('progress').classList.contains('active'))renderProgress();
         notify('Recovered previous locally saved records');
       }
     }
   }catch(e){console.warn('Local recovery mirror unreadable',e)}
 }
 const saved=await readDeviceRecovery();
 if(saved){
   recoverySnapshot=saved;
   try{
     const backup=JSON.parse(saved),primary=safeCurrentRecord();
     if(!primary&&storageWrites===startWrites&&counts(backup).score>0){
       data=backup;
       if(persist()){
         renderHome();
         if(document.getElementById('progress').classList.contains('active'))renderProgress();
         notify('Recovered saved data on this device');
       }
     }
   }catch(e){console.warn('Recovery copy unreadable',e)}
 }
 refreshStorageStatus();
}
$('verifyStorage').addEventListener('click',async()=>{
 await initializeDeviceRecovery();
 const saved=safeCurrentRecord();
 notify(saved&&counts(saved).score?'Saved data verified':'No saved records found');
});
$('recoverBackup').addEventListener('click',()=>{
 if(!recoverySnapshot)return notify('No recovery copy found');
 let candidate;
 try{candidate=JSON.parse(recoverySnapshot);if(!Array.isArray(candidate.sessions)||!candidate.tracker)throw new Error('Invalid recovery data')}
 catch(e){notify('Recovery copy is not readable');return}
 if(!confirm('Restore the previous saved local copy? This replaces your current on-device records. Export a JSON backup first if you want to preserve them.'))return;
 const old=data;data=candidate;
 if(!persist()){data=old;return}
 renderHome();renderHistory();renderProgress();notify('Device recovery copy restored');
});

function validTab(t){return ['home','workout','history','progress','settings'].includes(t)?t:'home'}
function navigate(tab){const t=validTab(tab);document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===t));document.querySelectorAll('.tabs [data-tab]').forEach(x=>{const is=x.dataset.tab===t;x.classList.toggle('selected',is);if(is)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});if(t==='history')renderHistory();if(t==='progress')renderProgress();if(t==='home')renderHome();if(t==='settings')refreshStorageStatus();window.scrollTo(0,0)}
function fromHash(){navigate(validTab((location.hash||'#home').slice(1)))}
window.addEventListener('hashchange',fromHash);
document.querySelectorAll('.tabs [data-tab]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const t=a.dataset.tab;if(location.hash==='#'+t)navigate(t);else location.hash=t}));
function go(tab){if(location.hash==='#'+tab)navigate(tab);else location.hash=tab}
function sessionsThisWeek(){const d=new Date(),start=new Date(d.getFullYear(),d.getMonth(),d.getDate());start.setDate(start.getDate()-((start.getDay()+6)%7));const startDay=[start.getFullYear(),String(start.getMonth()+1).padStart(2,'0'),String(start.getDate()).padStart(2,'0')].join('-');return data.sessions.filter(s=>s.date>=startDay).length}
function trackerWeek(){if(!data.tracker.startDate)return 1;const start=new Date(data.tracker.startDate+'T12:00:00').getTime();if(!Number.isFinite(start))return 1;return Math.min(12,Math.max(1,Math.floor((Date.now()-start)/604800000)))}
function renderHome(){
 $('workouts').innerHTML=Object.entries(PLAN).map(([key,p])=>'<button class="workout-choice" data-workout="'+key+'"><b>'+p.name+'</b><small>'+p.day+' · '+p.ex.length+' exercises</small><span>Start workout →</span></button>').join('');
 document.querySelectorAll('[data-workout]').forEach(el=>el.addEventListener('click',()=>startWorkout(el.dataset.workout)));
 $('sessionsCount').textContent=data.sessions.length;$('thisWeek').textContent=sessionsThisWeek()+' / 4 workouts this week';$('trackerWeek').textContent=trackerWeek();
 const vals=data.tracker.weeks.map(w=>Number(w.weight)).filter(x=>Number.isFinite(x)&&x>0);const baseline=Number(data.tracker.startWeight);$('latestWeight').textContent=vals.length?vals[vals.length-1].toFixed(1)+' kg':(Number.isFinite(baseline)&&baseline>0?baseline.toFixed(1)+' kg':'—');
}
function lastSession(key){return data.sessions.filter(s=>s.workoutKey===key).sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0))[0]}
function startWorkout(key){
 const p=PLAN[key];if(!p)return;activeWorkout=key;$('workoutHeading').textContent=p.day+' · '+p.name;$('sessionDate').value=today();$('sessionNotes').value='';const last=lastSession(key);
 $('exerciseItems').innerHTML=p.ex.map((e,i)=>{
 const [name,sets,reps,rest,muscle]=e;const prev=last&&last.exercises&&last.exercises[i]?last.exercises[i].sets.map(x=>x.weight||'—').join(' / ')+' kg':'Not recorded yet';
 const inputs=Array.from({length:sets},(_,j)=>'<label>Set '+(j+1)+'<input type="number" min="0" step="0.5" inputmode="decimal" data-ex="'+i+'" data-set="'+j+'" placeholder="kg" aria-label="'+esc(name)+' set '+(j+1)+' weight in kilograms"></label>').join('');
 return '<article class="exercise"><div class="exercise-head"><h3>'+esc(name)+'</h3><span>'+sets+' × '+reps+'</span></div><p>'+esc(muscle)+' · Rest '+rest+' sec</p><div class="previous">Previous: '+esc(prev)+'</div><div class="set-grid">'+inputs+'</div><button class="rest" data-rest="'+rest+'">Start '+rest+'s rest timer</button></article>'
 }).join('');
 document.querySelectorAll('[data-rest]').forEach(b=>b.addEventListener('click',()=>startRest(Number(b.dataset.rest))));go('workout');
}
$('cancel').addEventListener('click',()=>go('home'));
$('saveSession').addEventListener('click',()=>{
 if(!activeWorkout)return;const p=PLAN[activeWorkout], date=$('sessionDate').value||today();
 const exercises=p.ex.map((e,i)=>({name:e[0],target:e[1]+' x '+e[2],sets:Array.from({length:e[1]},(_,j)=>({weight:document.querySelector('[data-ex="'+i+'"][data-set="'+j+'"]')?.value||'',reps:e[2]}))}));
 if(!exercises.some(e=>e.sets.some(s=>s.weight!==''))){notify('Enter at least one set weight');return}
 const obj={id:Date.now(),workoutKey:activeWorkout,workoutName:p.name,date,notes:$('sessionNotes').value,exercises};
 data.sessions.push(obj);if(!persist()){data.sessions.pop();return}activeWorkout=null;notify('Workout saved');go('home');
});
function renderHistory(){
 const list=$('historyItems');
 const sorted=[...data.sessions].sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0));
 if(!sorted.length){list.innerHTML='<div class="empty">No workouts yet. Your first session will appear here.</div>';return}
 list.innerHTML=sorted.map(s=>{
  const exercises=(s.exercises||[]).map(e=>'<div class="history-ex"><b>'+esc(e.name)+'</b>: '+(e.sets||[]).map(x=>esc(x.weight!==''&&x.weight!=null?x.weight+' kg':'—')).join(' / ')+'</div>').join('');
  return '<article class="record"><div class="record-header"><h3>'+esc(s.workoutName)+'</h3><small>'+esc(fmt(s.date))+'</small></div>'+
   (s.notes?'<p class="hint">'+esc(s.notes)+'</p>':'')+
   '<details><summary>View logged sets</summary>'+exercises+'</details>'+
   '<div class="history-actions"><button class="secondary" data-edit="'+esc(s.id)+'">Edit workout</button><button class="danger" data-delete="'+esc(s.id)+'">Delete workout</button></div>'+
   '<div class="history-editor hidden" id="edit-'+esc(s.id)+'"></div></article>';
 }).join('');
 document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openWorkoutEditor(b.dataset.edit)));
 document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{
  if(!confirm('Permanently delete this workout?'))return;
  const old=data.sessions;
  data.sessions=old.filter(s=>String(s.id)!==b.dataset.delete);
  if(!persist()){data.sessions=old;return}
  renderHistory();renderHome();
 }));
}
function openWorkoutEditor(id){
 const session=data.sessions.find(s=>String(s.id)===String(id));
 const box=$('edit-'+id);
 if(!session||!box)return;
 if(!box.classList.contains('hidden')){box.classList.add('hidden');box.innerHTML='';return}
 document.querySelectorAll('.history-editor').forEach(x=>{x.classList.add('hidden');x.innerHTML=''});
 box.classList.remove('hidden');
 box.innerHTML='<h3>Edit '+esc(session.workoutName)+'</h3>'+
  '<p class="hint">For barbells, enter the total weight (including the bar). Dumbbells: weight of one dumbbell. Changes keep the original session.</p>'+
  '<label>Workout date<input type="date" data-edit-date value="'+esc(session.date||'')+'"></label>'+
  (session.exercises||[]).map((e,i)=>'<div class="edit-exercise"><strong>'+esc(e.name)+'</strong><div class="edit-sets">'+
   (e.sets||[]).map((set,j)=>'<label>Set '+(j+1)+' (kg)<input type="number" min="0" step="0.5" inputmode="decimal" data-edit-ex="'+i+'" data-edit-set="'+j+'" value="'+esc(set.weight??'')+'"></label>').join('')+
   '</div></div>').join('')+
  '<label>Workout notes<textarea rows="2" data-edit-notes>'+esc(session.notes||'')+'</textarea></label>'+
  '<div class="history-actions"><button class="primary" data-edit-save>Save corrections</button><button class="mutedbtn" data-edit-cancel>Cancel</button></div>';
 box.querySelector('[data-edit-cancel]').addEventListener('click',()=>{box.classList.add('hidden');box.innerHTML=''});
 box.querySelector('[data-edit-save]').addEventListener('click',()=>{
  const date=box.querySelector('[data-edit-date]').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){notify('Enter a valid workout date');return}
  const edits=[...box.querySelectorAll('[data-edit-ex]')];
  if(edits.some(input=>input.value!==''&&(!Number.isFinite(Number(input.value))||Number(input.value)<0))){notify('Enter valid nonnegative weights');return}
  const previous=JSON.parse(JSON.stringify(session));
  session.date=date;
  session.notes=box.querySelector('[data-edit-notes]').value;
  for(const input of edits){
    const i=Number(input.dataset.editEx),j=Number(input.dataset.editSet);
    session.exercises[i].sets[j].weight=input.value;
  }
  if(!persist()){Object.assign(session,previous);return}
  renderHistory();renderHome();notify('Workout corrections saved');
 });
}

function validMeasure(raw){if(raw===undefined||raw===null||raw==='')return null;const n=Number(raw);return Number.isFinite(n)&&n>0?n:null}
function signedDelta(current,base,unit){if(current===null||base===null)return '—';const diff=current-base;return (diff>0?'+':'')+diff.toFixed(1)+' '+unit}
function showBaseline(){
 const t=data.tracker,weight=validMeasure(t.startWeight),waist=validMeasure(t.startWaist);
 if(weight===null&&waist===null&&!t.startDate){$('baselineSummary').innerHTML='';return}
 $('baselineSummary').innerHTML='<strong>✓ Starting point saved on this device</strong>'+
 '<div class="saved-values"><span>Date: '+esc(t.startDate?fmt(t.startDate):'Not set')+'</span>'+
 '<span>Weight: '+(weight!==null?weight.toFixed(1)+' kg':'Not set')+'</span>'+
 '<span>Waist: '+(waist!==null?waist.toFixed(1)+' cm':'Not set')+'</span></div>'+
 '<small>Baseline / Week 0. You can edit these fields and save again if needed.</small>';
}
function latestCheckin(){
 const rows=data.tracker.weeks.map((w,i)=>({week:i+1,row:w,weight:validMeasure(w.weight),waist:validMeasure(w.waist)}));
 return rows.filter(w=>w.weight!==null||w.waist!==null).at(-1)||null;
}
function showProgressSummary(){
 const t=data.tracker,latest=latestCheckin(),el=$('progressSummary');
 if(!latest){const baseOK=validMeasure(t.startWeight)!==null||validMeasure(t.startWaist)!==null;el.innerHTML='<p class="summary-note">'+(baseOK?'Your baseline is saved. Enter a weekly check-in above to compare measurements and see the charts.':'No starting measurements are saved in this browser storage area. Check Settings → Saved data & recovery before entering them again.')+'</p>';return}
 const bw=validMeasure(t.startWeight),bc=validMeasure(t.startWaist);
 const measures=[
   ['Weight',latest.weight,bw,'kg'],
   ['Waist',latest.waist,bc,'cm']
 ];
 const stats=measures.map(([label,value,base,unit])=>{
   const diff=(value!==null&&base!==null)?value-base:null;
   const cls=diff===null?'':diff<0?'negative':diff>0?'positive':'';
   return '<div class="summary-stat"><small>'+label+'</small>'+
     '<b class="'+cls+'">'+(value!==null?value.toFixed(1)+' '+unit:'—')+'</b>'+
     '<span>'+(diff!==null?esc(signedDelta(value,base,unit))+' vs. start':'No baseline comparison')+'</span></div>';
 }).join('');
 el.innerHTML='<div class="summary-heading">✓ Latest saved check-in · Week '+latest.week+(latest.row.ending?' · '+esc(fmt(latest.row.ending)):'')+'</div>'+
 '<div class="summary-stats">'+stats+'</div>'+
 '<div class="summary-note">Saved locally. Your baseline and weekly entries remain here when you reopen this app on the same device.</div>';
}
function fillQuickCheckin(){
 const i=Math.max(0,Math.min(11,Number($('checkinWeek').value)-1));
 const w=data.tracker.weeks[i]||{};
 $('checkinDate').value=w.ending||today();
 $('checkinWeight').value=w.weight||'';
 $('checkinWaist').value=w.waist||'';
}
$('checkinWeek').addEventListener('change',fillQuickCheckin);
$('saveCheckin').addEventListener('click',()=>{
 const i=Number($('checkinWeek').value)-1;
 if(!Number.isInteger(i)||i<0||i>=12)return notify('Select a valid week');
 const weight=validMeasure($('checkinWeight').value),waist=validMeasure($('checkinWaist').value);
 if(weight===null&&waist===null)return notify('Enter your weight or waist measurement');
 const date=$('checkinDate').value||today();
 const previous={...data.tracker.weeks[i]};
 data.tracker.weeks[i]={...previous,ending:date,weight:weight!==null?String(weight):previous.weight,waist:waist!==null?String(waist):previous.waist};
 if(!persist()){data.tracker.weeks[i]=previous;return}
 renderProgress();renderHome();notify('Week '+(i+1)+' check-in saved');
});

function renderProgress(){
 const t=data.tracker;$('startDate').value=t.startDate||'';$('startWeight').value=t.startWeight||'';$('startWaist').value=t.startWaist||'';
 $('checkinWeek').innerHTML=Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'">Week '+(i+1)+'</option>').join('');
 $('checkinWeek').value=String(trackerWeek());
 fillQuickCheckin();showBaseline();showProgressSummary();
 $('weeklyItems').innerHTML=t.weeks.map((w,i)=>'<article class="week-card"><h3>Week '+(i+1)+'</h3><div class="week-grid">'+
 ['ending','weight','waist','steps','workouts','cardio','notes'].map(k=>{const labels={ending:'Week ending',weight:'Weight kg',waist:'Waist cm',steps:'Average daily steps',workouts:'Workouts completed /4',cardio:'Cardio minutes',notes:'Notes'};const type=k==='ending'?'date':k==='notes'?'text':'number';const step=k==='weight'||k==='waist'?'step="0.1"':'step="1"';return '<label class="'+(k==='notes'?'span2':'')+'">'+labels[k]+'<input data-week="'+i+'" data-field="'+k+'" type="'+type+'" '+step+' value="'+esc(w[k]||'')+'"></label>'}).join('')+
 '</div><button class="secondary wide" data-save-week="'+i+'">Save week '+(i+1)+'</button></article>').join('');
 document.querySelectorAll('[data-save-week]').forEach(b=>b.addEventListener('click',()=>{
 const i=Number(b.dataset.saveWeek),previous={...t.weeks[i]};
 document.querySelectorAll('[data-week="'+i+'"]').forEach(el=>t.weeks[i][el.dataset.field]=el.value);
 if(!persist()){t.weeks[i]=previous;return}
 showProgressSummary();drawCharts();renderHome();notify('Week '+(i+1)+' saved');
}));
 $('strengthItems').innerHTML=STRENGTH.map(name=>{const vals=t.strength[name]||{};return '<div class="strength-row"><strong>'+name+'</strong><div class="strength-grid">'+['start','w4','w8','w12'].map((k,j)=>'<label>'+['Start','Week 4','Week 8','Week 12'][j]+'<input type="number" min="0" step="0.5" inputmode="decimal" data-strength="'+esc(name)+'" data-col="'+k+'" value="'+esc(vals[k]||'')+'"></label>').join('')+'</div></div>'}).join('');
 drawCharts();
}
$('saveStart').addEventListener('click',()=>{
 const t=data.tracker,old={startDate:t.startDate,startWeight:t.startWeight,startWaist:t.startWaist};
 const weight=validMeasure($('startWeight').value),waist=validMeasure($('startWaist').value);
 if(weight===null&&waist===null){notify('Enter a starting weight or waist');return}
 t.startDate=$('startDate').value;t.startWeight=weight!==null?String(weight):'';t.startWaist=waist!==null?String(waist):'';
 if(!persist()){Object.assign(t,old);return}
 showBaseline();showProgressSummary();drawCharts();renderHome();notify('Starting point saved');
});
$('saveStrength').addEventListener('click',()=>{document.querySelectorAll('[data-strength]').forEach(inp=>{const name=inp.dataset.strength;data.tracker.strength[name]??={};data.tracker.strength[name][inp.dataset.col]=inp.value});if(persist())notify('Strength snapshot saved')});
function drawCharts(){
 chart('weightChart',[data.tracker.startWeight,...data.tracker.weeks.map(w=>w.weight)],'kg');
 chart('waistChart',[data.tracker.startWaist,...data.tracker.weeks.map(w=>w.waist)],'cm');
}
function chart(id,raw,unit){
 const canvas=$(id),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#f5f8fa';ctx.fillRect(0,0,w,h);
 const pts=raw.map((v,i)=>({i,value:validMeasure(v)})).filter(p=>p.value!==null);
 ctx.strokeStyle='#dce7ee';ctx.lineWidth=1;
 for(let i=0;i<4;i++){const y=30+i*51;ctx.beginPath();ctx.moveTo(42,y);ctx.lineTo(w-20,y);ctx.stroke()}
 if(!pts.length){ctx.fillStyle='#73899b';ctx.font='18px Arial';ctx.fillText('Save your starting values to begin',42,h/2);return}
 const vals=pts.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),pad=Math.max((max-min)*.2,unit==='kg'?1:0.5);
 const X=i=>42+i*(w-65)/12,Y=v=>h-38-(v-(min-pad))/(max-min+2*pad)*(h-72);
 ctx.strokeStyle='#20857f';ctx.lineWidth=4;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(X(p.i),Y(p.value)):ctx.moveTo(X(p.i),Y(p.value)));if(pts.length>1)ctx.stroke();
 pts.forEach(p=>{ctx.beginPath();ctx.fillStyle=p.i===0?'#12314d':'#20857f';ctx.arc(X(p.i),Y(p.value),6,0,Math.PI*2);ctx.fill()});
 ctx.fillStyle='#60788b';ctx.font='13px Arial';ctx.fillText('Start',42,h-10);ctx.fillText('W6',X(6)-10,h-10);ctx.fillText('W12',w-52,h-10);
 ctx.fillStyle='#133451';ctx.font='bold 18px Arial';ctx.fillText(vals.at(-1).toFixed(1)+' '+unit,w-128,22);
 if(pts.length===1){ctx.fillStyle='#73899b';ctx.font='14px Arial';ctx.fillText('Baseline recorded — add a weekly check-in',50,60);}
}
function startRest(seconds){clearInterval(clock);clockEnd=Date.now()+1000*seconds;$('timerBox').classList.remove('hidden');showTimer();clock=setInterval(showTimer,250)}
function showTimer(){const left=Math.max(0,Math.ceil((clockEnd-Date.now())/1000));$('timerLabel').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');if(left===0){clearInterval(clock);if(navigator.vibrate)navigator.vibrate(200);notify('Rest complete');$('timerBox').classList.add('hidden')}}
$('stopTimer').addEventListener('click',()=>{clearInterval(clock);$('timerBox').classList.add('hidden')});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gym-log-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);notify('Backup file created')});
$('import').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const incoming=JSON.parse(r.result);if(!Array.isArray(incoming.sessions)||!incoming.tracker||!Array.isArray(incoming.tracker.weeks))throw Error('Bad format');if(!confirm('Replace your current workout history with this backup? Export your current data first if needed.'))return;const old=data;window.GymCloud?.unlink?.();data=incoming;if(!persist()){data=old;return}data=load();renderHome();renderProgress();renderHistory();notify('Backup restored')}catch(err){alert('Not a valid Gym Log backup.')}};r.readAsText(f);e.target.value=''});
$('reset').addEventListener('click',()=>{if(!confirm('Delete ALL saved workouts and tracker data on this device? Your private cloud backup, if present, will be kept. This cannot be undone locally.'))return;window.GymCloud?.unlink?.();data=defaults();if(persist()){renderHome();renderProgress();renderHistory();go('home');notify('Local data deleted; cloud unchanged')}});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(err=>console.warn('Offline cache unavailable',err)));
renderHome();fromHash();initializeDeviceRecovery();
'use strict';
const PLAN={
upperA:{name:'Upper A',day:'Day 1',ex:[['Bench Press',3,10,120,'Chest'],['V-Bar Lat Pulldown',3,10,120,'Back'],['Incline Chest Press',3,10,120,'Upper chest'],['Seated Cable Row',3,10,120,'Back'],['Shoulder Press Machine',3,10,90,'Shoulders'],['Triceps Pushdown',3,12,75,'Triceps'],['Biceps Curl',3,12,75,'Biceps']]},
lowerA:{name:'Lower A',day:'Day 2',ex:[['Leg Press',4,10,120,'Quads + glutes'],['Seated Leg Curl',4,12,90,'Hamstrings'],['Leg Extension',3,12,75,'Quads'],['Seated Calf Raise',3,15,60,'Calves']]},
upperB:{name:'Upper B',day:'Day 4',ex:[['Incline Chest Press',3,10,120,'Upper chest'],['Seated Cable Row',3,10,120,'Back'],['Bench Press',3,10,120,'Chest'],['V-Bar Lat Pulldown',3,10,120,'Back'],['Shoulder Press Machine',3,10,90,'Shoulders'],['Biceps Curl',3,12,75,'Biceps'],['Triceps Pushdown',3,12,75,'Triceps']]},
lowerB:{name:'Lower B',day:'Day 5',ex:[['Leg Press',4,10,120,'Quads + glutes'],['Seated Leg Curl',4,12,90,'Hamstrings'],['Leg Extension',3,12,75,'Quads'],['Seated Calf Raise',3,15,60,'Calves']]}
};
const STRENGTH=['Bench Press','V-Bar Lat Pulldown','Leg Press','Shoulder Press Machine'];
const KEY='moGymLog.v1';
const $=id=>document.getElementById(id);
const defaults=()=>({version:1,sessions:[],tracker:{startDate:'',startWeight:'',startWaist:'',weeks:Array.from({length:12},()=>({ending:'',weight:'',waist:'',steps:'',workouts:'',cardio:'',notes:''})),strength:{}}});
function load(){const d=defaults();try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object'){d.sessions=Array.isArray(saved.sessions)?saved.sessions:[];const t=saved.tracker||{};d.tracker={...d.tracker,...t};d.tracker.weeks=Array.from({length:12},(_,i)=>({...defaults().tracker.weeks[i],...(t.weeks||[])[i]}));d.tracker.strength=t.strength&&typeof t.strength==='object'?t.strength:{}}}catch(e){console.warn('Saved data could not be read',e)}return d}
let data=load(),activeWorkout=null,clock=null,clockEnd=0,toastTimer=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function fmt(v){if(!v)return '';const d=new Date(v+'T12:00:00');return Number.isFinite(+d)?d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):v}
function notify(message){const n=$('toast');n.textContent=message;n.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.add('hidden'),2300)}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch(e){console.error(e);notify('Unable to save. Check Safari storage.');return false}}
function validTab(t){return ['home','workout','history','progress','settings'].includes(t)?t:'home'}
function navigate(tab){const t=validTab(tab);document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===t));document.querySelectorAll('.tabs [data-tab]').forEach(x=>{const is=x.dataset.tab===t;x.classList.toggle('selected',is);if(is)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});if(t==='history')renderHistory();if(t==='progress')renderProgress();if(t==='home')renderHome();window.scrollTo(0,0)}
function fromHash(){navigate(validTab((location.hash||'#home').slice(1)))}
window.addEventListener('hashchange',fromHash);
document.querySelectorAll('.tabs [data-tab]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const t=a.dataset.tab;if(location.hash==='#'+t)navigate(t);else location.hash=t}));
function go(tab){if(location.hash==='#'+tab)navigate(tab);else location.hash=tab}
function sessionsThisWeek(){const d=new Date(),start=new Date(d.getFullYear(),d.getMonth(),d.getDate());start.setDate(start.getDate()-((start.getDay()+6)%7));const startDay=[start.getFullYear(),String(start.getMonth()+1).padStart(2,'0'),String(start.getDate()).padStart(2,'0')].join('-');return data.sessions.filter(s=>s.date>=startDay).length}
function trackerWeek(){if(!data.tracker.startDate)return 1;const start=new Date(data.tracker.startDate+'T12:00:00').getTime();if(!Number.isFinite(start))return 1;return Math.min(12,Math.max(1,Math.floor((Date.now()-start)/604800000)+1))}
function renderHome(){
 $('workouts').innerHTML=Object.entries(PLAN).map(([key,p])=>'<button class="workout-choice" data-workout="'+key+'"><b>'+p.name+'</b><small>'+p.day+' · '+p.ex.length+' exercises</small><span>Start workout →</span></button>').join('');
 document.querySelectorAll('[data-workout]').forEach(el=>el.addEventListener('click',()=>startWorkout(el.dataset.workout)));
 $('sessionsCount').textContent=data.sessions.length;$('thisWeek').textContent=sessionsThisWeek()+' / 4 workouts this week';$('trackerWeek').textContent=trackerWeek();
 const vals=data.tracker.weeks.map(w=>Number(w.weight)).filter(x=>Number.isFinite(x)&&x>0);$('latestWeight').textContent=vals.length?vals[vals.length-1].toFixed(1)+' kg':'—';
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
 const list=$('historyItems');const sorted=[...data.sessions].sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0));
 if(!sorted.length){list.innerHTML='<div class="empty">No workouts yet. Your first session will appear here.</div>';return}
 list.innerHTML=sorted.map(s=>{
 const exercises=(s.exercises||[]).map(e=>'<div class="history-ex"><b>'+esc(e.name)+'</b>: '+(e.sets||[]).map(x=>esc(x.weight?x.weight+' kg':'—')).join(' / ')+'</div>').join('');
 return '<article class="record"><div class="record-header"><h3>'+esc(s.workoutName)+'</h3><small>'+esc(fmt(s.date))+'</small></div>'+(s.notes?'<p class="hint">'+esc(s.notes)+'</p>':'')+'<details><summary>View logged sets</summary>'+exercises+'</details><button class="danger" data-delete="'+s.id+'">Delete workout</button></article>'
 }).join('');
 document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{if(confirm('Permanently delete this workout?')){data.sessions=data.sessions.filter(s=>String(s.id)!==b.dataset.delete);persist();renderHistory();renderHome()}}));
}
function renderProgress(){
 const t=data.tracker;$('startDate').value=t.startDate||'';$('startWeight').value=t.startWeight||'';$('startWaist').value=t.startWaist||'';
 $('weeklyItems').innerHTML=t.weeks.map((w,i)=>'<article class="week-card"><h3>Week '+(i+1)+'</h3><div class="week-grid">'+
 ['ending','weight','waist','steps','workouts','cardio','notes'].map(k=>{const labels={ending:'Week ending',weight:'Weight kg',waist:'Waist cm',steps:'Average daily steps',workouts:'Workouts completed /4',cardio:'Cardio minutes',notes:'Notes'};const type=k==='ending'?'date':k==='notes'?'text':'number';const step=k==='weight'||k==='waist'?'step="0.1"':'step="1"';return '<label class="'+(k==='notes'?'span2':'')+'">'+labels[k]+'<input data-week="'+i+'" data-field="'+k+'" type="'+type+'" '+step+' value="'+esc(w[k]||'')+'"></label>'}).join('')+
 '</div><button class="secondary wide" data-save-week="'+i+'">Save week '+(i+1)+'</button></article>').join('');
 document.querySelectorAll('[data-save-week]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.saveWeek);document.querySelectorAll('[data-week="'+i+'"]').forEach(el=>t.weeks[i][el.dataset.field]=el.value);persist();drawCharts();notify('Week '+(i+1)+' saved');renderHome()}));
 $('strengthItems').innerHTML=STRENGTH.map(name=>{const vals=t.strength[name]||{};return '<div class="strength-row"><strong>'+name+'</strong><div class="strength-grid">'+['start','w4','w8','w12'].map((k,j)=>'<label>'+['Start','Week 4','Week 8','Week 12'][j]+'<input type="number" min="0" step="0.5" inputmode="decimal" data-strength="'+esc(name)+'" data-col="'+k+'" value="'+esc(vals[k]||'')+'"></label>').join('')+'</div></div>'}).join('');
 drawCharts();
}
$('saveStart').addEventListener('click',()=>{data.tracker.startDate=$('startDate').value;data.tracker.startWeight=$('startWeight').value;data.tracker.startWaist=$('startWaist').value;if(persist()){notify('Starting values saved');renderHome()}});
$('saveStrength').addEventListener('click',()=>{document.querySelectorAll('[data-strength]').forEach(inp=>{const name=inp.dataset.strength;data.tracker.strength[name]??={};data.tracker.strength[name][inp.dataset.col]=inp.value});if(persist())notify('Strength snapshot saved')});
function drawCharts(){chart('weightChart',data.tracker.weeks.map(w=>w.weight),'kg');chart('waistChart',data.tracker.weeks.map(w=>w.waist),'cm')}
function chart(id,raw,unit){
 const canvas=$(id),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#f5f8fa';ctx.fillRect(0,0,w,h);
 const pts=raw.map((v,i)=>({i,value:v===''||v==null?NaN:Number(v)})).filter(p=>Number.isFinite(p.value)&&p.value>0);
 ctx.strokeStyle='#dce7ee';ctx.lineWidth=1;for(let i=0;i<4;i++){const y=28+i*58;ctx.beginPath();ctx.moveTo(38,y);ctx.lineTo(w-20,y);ctx.stroke()}
 if(!pts.length){ctx.fillStyle='#73899b';ctx.font='19px Arial';ctx.fillText('Add weekly measurements to see your trend',45,h/2);return}
 const min=Math.min(...pts.map(p=>p.value)),max=Math.max(...pts.map(p=>p.value)),pad=Math.max((max-min)*.2,unit==='kg'?1:.5);
 const X=i=>38+i*(w-65)/11,Y=v=>h-29-(v-(min-pad))/(max-min+2*pad)*(h-58);
 ctx.strokeStyle='#20857f';ctx.lineWidth=4;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(X(p.i),Y(p.value)):ctx.moveTo(X(p.i),Y(p.value)));ctx.stroke();
 pts.forEach(p=>{ctx.beginPath();ctx.fillStyle='#12314d';ctx.arc(X(p.i),Y(p.value),5,0,Math.PI*2);ctx.fill()});
 ctx.fillStyle='#133451';ctx.font='bold 17px Arial';ctx.fillText(pts.at(-1).value.toFixed(1)+' '+unit,w-115,21);
}
function startRest(seconds){clearInterval(clock);clockEnd=Date.now()+1000*seconds;$('timerBox').classList.remove('hidden');showTimer();clock=setInterval(showTimer,250)}
function showTimer(){const left=Math.max(0,Math.ceil((clockEnd-Date.now())/1000));$('timerLabel').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');if(left===0){clearInterval(clock);if(navigator.vibrate)navigator.vibrate(200);notify('Rest complete');$('timerBox').classList.add('hidden')}}
$('stopTimer').addEventListener('click',()=>{clearInterval(clock);$('timerBox').classList.add('hidden')});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gym-log-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);notify('Backup file created')});
$('import').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const incoming=JSON.parse(r.result);if(!Array.isArray(incoming.sessions)||!incoming.tracker||!Array.isArray(incoming.tracker.weeks))throw Error('Bad format');if(!confirm('Replace your current workout history with this backup? Export your current data first if needed.'))return;const old=data;data=incoming;if(!persist()){data=old;return}data=load();renderHome();renderProgress();renderHistory();notify('Backup restored')}catch(err){alert('Not a valid Gym Log backup.')}};r.readAsText(f);e.target.value=''});
$('reset').addEventListener('click',()=>{if(!confirm('Delete ALL saved workouts and tracker data on this device? This cannot be undone.'))return;data=defaults();if(persist()){renderHome();renderProgress();renderHistory();go('home');notify('Local data deleted')}});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(err=>console.warn('Offline cache unavailable',err)));
renderHome();fromHash();
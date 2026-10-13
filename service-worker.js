/* Gym Log offline-first app shell. Workout data stays in localStorage. */
const CACHE='gym-log-offline-v10';
const APP_SHELL=['./','./index.html','./styles.css','./app.js','./cloud.js','./manifest.webmanifest','./icon.svg','./icon-192.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('gym-log-offline-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
function networkFirst(request,fallback){
 return fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(fallback||request,copy)).catch(()=>{});}
   return response;
 }).catch(()=>caches.match(fallback||request).then(cached=>cached||Response.error()));
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
   event.respondWith(networkFirst(request,'./index.html'));
   return;
 }
 if(/\/(app\.js|cloud\.js|styles\.css)$/.test(url.pathname)){
   event.respondWith(networkFirst(request));
   return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||networkFirst(request)));
});

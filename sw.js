const A='quiz-app-v1',D='quiz-data-v1';
const APP=['./','index.html','app.js','manifest.webmanifest'],DATA=['data.js','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(Promise.all([caches.open(A).then(c=>c.addAll(APP)),caches.open(D).then(c=>c.addAll(DATA))]));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==A&&x!==D).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||e.request.cache==='no-store'||e.request.url.indexOf('version.json')>-1)return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});

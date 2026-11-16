const PREFIX='sdd-shell:'+self.registration.scope+':',CACHE=PREFIX+'v2.0.2';
const FILES=['./','index.html','main.mjs','finance.mjs','forms.mjs','views.mjs','storage.mjs','calculations.mjs','calculator-ui.mjs','payslip.mjs','legacy.mjs','app-v2.css','style.css','style-0.css','style-1.css','style-2.css','style-3.css','style-4.css','app-config.json','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
const CORE=new Set(FILES.map(f=>new URL(f,self.registration.scope).pathname));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new URL(f,self.registration.scope).href)))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).then(response=>{if(response.ok)caches.open(CACHE).then(c=>c.put(new URL('index.html',self.registration.scope).href,response.clone()));return response}).catch(()=>caches.match(new URL('index.html',self.registration.scope).href)));return;}
 if(!CORE.has(url.pathname))return;event.respondWith(fetch(req).then(response=>{if(response.ok)caches.open(CACHE).then(c=>c.put(req,response.clone()));return response}).catch(()=>caches.match(req)));
});

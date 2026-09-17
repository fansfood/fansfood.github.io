const CACHE_PREFIX='classflow-shell-';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
// Recovery service worker: intentionally no fetch handler.
// Network requests go straight to the network so an old cached shell cannot trap ClassFlow.

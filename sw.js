// My Money Book: keeps the app itself on this phone, so it opens at once, even without internet.
// Your money data is not kept here (the app keeps its own copy in the phone's storage), and reading or saving
// always goes straight to Google through your private link.
const VERSION = 'mmb-12';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'mmb-fonts').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;   // reads and saves (POST to Google) are never touched
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // the app: from the phone at once; a newer copy is fetched in the background and used the next time you open it
    e.respondWith(caches.open(VERSION).then(async c => {
      const key = req.mode === 'navigate' ? 'index.html' : req;
      const hit = await c.match(key, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r && r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || new Response('Offline and not saved on this phone yet.', { status: 503 });
    }));
    return;
  }
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    // the app's two fonts, kept after the first time
    e.respondWith(caches.open('mmb-fonts').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }
      catch (x) { return new Response('', { status: 503 }); }
    }));
  }
});

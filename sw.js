const CACHE = 'studio-v1';
const BASE = ['./', 'index.html', 'core/theme.css', 'core/shell.css', 'core/shell.js', 'core/app.js', 'core/sync.js', 'apps.json', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

function keyFor(u) { const k = new URL(u, self.registration.scope); return k.origin + k.pathname; }

// Downloads every file Studio needs and stores it, so the whole studio (every app) works offline.
async function precache() {
  const c = await caches.open(CACHE);
  const list = BASE.slice();
  try {
    const j = await (await fetch('apps.json', { cache: 'reload' })).json();
    (j.apps || []).forEach(function (a) { list.push(a.entry); (a.files || []).forEach(function (f) { list.push(f); }); });
  } catch (_) {}
  await Promise.all(list.map(async function (u) {
    try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(keyFor(u), r); } catch (_) {}
  }));
}

self.addEventListener('install', function (e) { e.waitUntil(precache().then(function () { return self.skipWaiting(); })); });

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

// Saved copy first, so Studio opens instantly even with no or a weak connection;
// the newest files are fetched in the background and used the next time you open it.
async function savedFirst(req) {
  const u = new URL(req.url);
  const key = u.origin + u.pathname;
  const c = await caches.open(CACHE);
  const hit = await c.match(key);
  const net = fetch(req).then(function (res) { if (res.ok) c.put(key, res.clone()); return res; });
  net.catch(function () {});
  if (hit) return hit;
  try { return await net; } catch (e) { return (await c.match('index.html')) || Response.error(); }
}

self.addEventListener('fetch', function (e) {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // the update check asks the network directly
  if (e.request.cache === 'no-store' || u.searchParams.has('t')) return;
  e.respondWith(savedFirst(e.request));
});

// The "Update ready" button asks for a full refresh of the saved files.
self.addEventListener('message', function (e) {
  if (e.data === 'refresh') e.waitUntil(precache().then(function () { if (e.source) e.source.postMessage('refreshed'); }));
});

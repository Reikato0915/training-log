// アプリ本体をキャッシュし、圏外でも起動できるようにする。
// 更新時は CACHE の版を上げる。GitHub API はキャッシュしない。
const CACHE = 'ironlog-v11';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './src/app.js', './src/catalog.js', './src/aggregate.js', './src/store.js', './src/sync.js', './src/bodyweight.js', './src/token-expiry.js', './src/timeslot.js', './src/progress.js',
  './src/ui/dom.js', './src/ui/log.js', './src/ui/week.js', './src/ui/settings.js', './src/ui/weight.js', './src/ui/calendar.js', './src/ui/day-extras.js', './src/ui/card.js', './src/ui/progress-panel.js',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// キャッシュ優先で即表示し、裏で最新を取得して次回に反映（stale-while-revalidate）
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached ?? network;
  }));
});

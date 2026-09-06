/* SPEAK LAB 서비스 워커 — 앱 껍데기를 캐시해 오프라인에서도 열리게 한다.
   얼굴·자세 모델은 다른 출처(CDN)라 여기서 캐시하지 않고 브라우저 HTTP 캐시에 맡긴다. */
const CACHE = 'speaklab-v1';
const SHELL = ['./', './index.html', './style.css', './app.js', './manifest.json',
               './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;          // CDN·모델은 건드리지 않는다

  // HTML은 네트워크 우선 — 배포한 수정이 바로 반영되게
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // 나머지는 캐시 우선, 없으면 받아서 채운다
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});

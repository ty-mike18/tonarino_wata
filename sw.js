const CACHE_NAME = 'tonari-v20260703-final-v3-25-flat';
const ASSETS = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', './sakana.png', './abura.png', './niku.png', './gyunyu.png', './yasai.png', './kaiso.png', './imo.png', './tamago.png', './daizu.png', './kudamono.png', './confection.png', './sweet_drink.png', './weight_scale.png', './bedtime.png', './wake_time.png', './weight_paw.png', './wata-body.png', './wata-tail.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('notificationclick', event => {
  // リマインダー通知をタップしたらアプリを前面に(なければ開く)
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  if (req.mode === 'navigate') {
    // ページ本体はネットワーク優先: index.htmlの更新がキャッシュ名の上げ忘れで
    // 利用者に届かなくなる事故を防ぐ。オフライン時はキャッシュで動く。
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() =>
        caches.match(req).then(cached => cached || caches.match('index.html'))
      )
    );
    return;
  }
  // 画像などの静的アセットはキャッシュ優先。どちらも失敗したら504を返す。
  event.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).catch(() => new Response('', { status: 504, statusText: 'offline' }))
    )
  );
});

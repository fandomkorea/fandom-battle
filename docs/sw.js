// ── 팬픽 Service Worker v1 ──
// 전략: JS/CSS(버전태그) → 캐시 우선 | HTML/rankings.json → 네트워크 우선 + 캐시 폴백
const CACHE_NAME = 'fandom-battle-sw-v1';

// ── 설치: 즉시 활성화 ──
self.addEventListener('install', () => self.skipWaiting());

// ── 활성화: 이전 캐시 정리 ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── 요청 가로채기 ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 1. 크로스 오리진 (Firebase, Google, Cloudinary, AdSense 등) → SW 개입 없이 통과
  if (url.origin !== self.location.origin) return;

  // 2. POST 등 비-GET 요청 → 통과
  if (e.request.method !== 'GET') return;

  const path = url.pathname;

  // 3. rankings.json → 네트워크 우선, 캐시 폴백 (항상 최신 데이터)
  if (path.endsWith('rankings.json')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 4. ?v= 버전태그 있는 JS/CSS → 캐시 우선 (버전이 바뀌면 새 URL → 자동 갱신)
  if (url.search.includes('v=') && (path.endsWith('.js') || path.endsWith('.css'))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // 5. HTML 문서 → 네트워크 우선, 캐시 폴백 (오프라인 시 마지막 버전 표시)
  if (
    e.request.destination === 'document' ||
    path === '/' || path.endsWith('/') || path.endsWith('.html')
  ) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(cached =>
            cached || new Response(
              '<meta charset="utf-8"><title>팬픽</title><p style="font-family:sans-serif;text-align:center;margin-top:40px">📡 오프라인 상태입니다. 잠시 후 다시 시도해주세요.</p>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          )
        )
    );
    return;
  }

  // 6. 그 외 정적 리소스 (폰트 캐시 등) → 캐시 우선, 없으면 네트워크
  if (['image', 'font', 'style', 'script'].includes(e.request.destination)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
  }
});

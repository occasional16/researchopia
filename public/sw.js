const CACHE_NAME = 'researchopia-v1';
const urlsToCache = [
  '/',
  '/api/site/statistics',
  '/api/papers/recent-comments',
  '/_next/static/css/',
  '/_next/static/chunks/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // 只缓存API请求和静态资源
  if (event.request.url.includes('/api/') || event.request.url.includes('/_next/')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // 如果缓存中有，先返回缓存，同时后台更新
          if (response) {
            // 后台更新缓存
            fetch(event.request).then((fetchResponse) => {
              if (fetchResponse && fetchResponse.status === 200) {
                const responseClone = fetchResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseClone);
                  });
              }
            });
            return response;
          }
          
          // 如果缓存中没有，从网络获取
          return fetch(event.request).then((fetchResponse) => {
            if (!fetchResponse || fetchResponse.status !== 200) {
              return fetchResponse;
            }

            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseClone);
              });

            return fetchResponse;
          });
        })
    );
  }
});
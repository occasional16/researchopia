const CACHE_NAME = 'researchopia-v1';
const urlsToCache = [
  '/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // 逐个添加URL，避免某个URL失败导致整个缓存失败
        return Promise.allSettled(
          urlsToCache.map(url =>
            cache.add(url).catch(err => {
              console.warn('Failed to cache:', url, err);
              return null;
            })
          )
        );
      })
      .catch(err => {
        console.warn('Service Worker install failed:', err);
      })
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
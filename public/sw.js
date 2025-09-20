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
  // 只缓存GET请求的静态资源，避免缓存API请求
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return; // 不处理非GET请求和API请求
  }

  // 只缓存静态资源
  if (event.request.url.includes('/_next/') || event.request.url.includes('/static/')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // 如果缓存中有，直接返回
          if (response) {
            return response;
          }

          // 如果缓存中没有，从网络获取并缓存
          return fetch(event.request).then((fetchResponse) => {
            if (!fetchResponse || fetchResponse.status !== 200) {
              return fetchResponse;
            }

            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseClone);
              })
              .catch(err => {
                console.warn('Failed to cache resource:', err);
              });

            return fetchResponse;
          });
        })
        .catch(() => {
          // 如果缓存失败，直接从网络获取
          return fetch(event.request);
        })
    );
  }
});
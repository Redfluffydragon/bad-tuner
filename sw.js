const APP_PREFIX = 'tuner_';

const VERSION = '0.0.0.1';

const CACHE_NAME = APP_PREFIX + VERSION;

const URLS = [
  '/tuner/',
  '/tuner/index.html',
  '/tuner/min.js',
  '/tuner/index.css',
];

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(function (request) {
      return request || fetch(e.request);
    })
  )
}, false);

self.addEventListener('install', e => {
  e.waitUntil (
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(URLS);
    })
  )
}, false);

self.addEventListener('activate', e => {
  e.waitUntil (
    caches.keys().then(keyList => {
      let cacheWhitelist = keyList.filter(key => {
        return key.indexOf(APP_PREFIX);
      });
      cacheWhitelist.push(CACHE_NAME);

      return Promise.all(keyList.map((key, i) => {
        if (cacheWhitelist.indexOf(key) === -1) {
          return caches.delete(keyList[parseInt(i)]);
        }
      }));

    })
  );
}, false);
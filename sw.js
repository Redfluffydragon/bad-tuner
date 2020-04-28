let APP_PREFIX = 'tuner_';

let VERSION = '0.0.0.1';

let CACHE_NAME = APP_PREFIX + VERSION;

let URLS = [
  '/tuner/',
  '/tuner/index.html',
  '/tuner/index.js',
  '/tuner/index.css',
  '/tuner/img/apple-touch-icon.png',
  '/tuner/img/icon.png'
];


self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(function (request) {
      return request || fetch(e.request)
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
      let cacheWhitelist = keyList.filter(key =>{
        return key.indexOf(APP_PREFIX);
      })
      cacheWhitelist.push(CACHE_NAME);

      return Promise.all(keyList.map((key, i) => {
        if (cacheWhitelist.indexOf(key) === -1) {
          return caches.delete(keyList[i]);
        }
      }))

    })
  )
}, false);
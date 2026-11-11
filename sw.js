// =============================================================================
//  THE SERVICE WORKER: lets the game install as an app and play offline
// =============================================================================
//
//  WHAT IS A SERVICE WORKER?
//  A small script the browser keeps running in the background, separate from
//  the page. Once installed, it sits BETWEEN the page and the internet: every
//  file the page asks for (index.html, style.css, ...) passes through its
//  'fetch' event, and it decides where the answer comes from.
//
//  OUR STRATEGY: "NETWORK FIRST"
//    1. Try the internet, so you always get the newest version of the game.
//    2. Save every answer in a cache (a storage box the browser keeps for us).
//    3. No internet? Answer from the cache, so the game still works offline.
//
//  JAVASCRIPT NOTE: PROMISES
//  Network and cache operations take time, so they return a PROMISE: a value
//  that arrives later. promise.then(f) means "when it arrives, call f with it".
//  promise.catch(f) means "if it fails, call f instead".
//
//  WHY THE FILE NAME AND PLACE MATTER
//  A service worker only controls pages in its own folder and below. sw.js
//  sits next to index.html, so it controls the whole game.
//
//  Service workers only run on https:// sites (like GitHub Pages) or on
//  localhost.
// =============================================================================

// The cache's name. Change the number to throw away all saved files at once.
const CACHE = 'tetris-v1';

// The files the game needs. They are saved when the worker is installed, so
// the game works offline even before you have played once.
// './' is the folder itself: the address you open (it serves index.html).
const FILES = [
  './',
  './index.html',
  './style.css',
  './browser.js',
  './tetris-core.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// INSTALL: happens once, the first time the browser sees this worker (or a
// changed version of it). We fill the cache with all the files.
// event.waitUntil(promise) tells the browser: "not finished until this is".
// self is the worker itself (in a page you would say window).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()), // start right away, don't wait
  );
});

// ACTIVATE: the new worker takes over. Delete caches with other names (left
// over from older versions), then take control of open pages immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE).map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

// FETCH: runs for every file the page asks for.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only handle simple downloads (GET) of our own files; let anything else
  // go to the internet untouched.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // event.respondWith(promise): "the answer for this request is this".
  event.respondWith(
    // cache: 'no-cache' asks the server "has this changed?" every time instead
    // of using the browser's normal short-term copy, so updates show at once.
    fetch(request.url, { cache: 'no-cache' })
      .then((response) => {
        // Got it from the internet. Save a copy (response.clone(), because a
        // response can only be read once) and hand the original to the page.
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request.url, copy));
        }
        return response;
      })
      // No internet: answer from the cache. For the page itself (a
      // "navigation"), fall back to the saved start page.
      .catch(() => caches.match(request.url)
        .then((saved) => saved || (request.mode === 'navigate' ? caches.match('./') : undefined))),
  );
});

// Service worker: guarda los archivos de la app para que abra sin internet.
// IMPORTANTE: cambia CACHE cada vez que publiques cambios, o los teléfonos seguirán viendo la versión anterior.
const CACHE = 'turnos-v10';
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/dist/umd/supabase.js';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './store.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS).then(() => c.add(SUPABASE_JS).catch(() => {})))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Archivos propios: primero la red (para recibir actualizaciones), si no hay conexión, la copia guardada.
// Fuentes de Google y la librería de Supabase (URL con versión fija): primero la copia guardada.
// Las llamadas a la API de Supabase no pasan por aquí: siempre van a la red.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
  } else if (url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com') || req.url === SUPABASE_JS) {
    e.respondWith(
      caches.match(req).then((r) => r || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }))
    );
  }
});

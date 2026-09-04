// ============================================================
// sw.js — Service Worker для Kvazavaza PWA
//
// Стратегия: Cache First (игра работает оффлайн после первого запуска)
// Обновление кэша: при каждом новом деплое меняй CACHE_VERSION
// ============================================================

const CACHE_VERSION = 'kvazavaza-v1'

// Файлы для кэширования при первой установке
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ────────────────────────────────────────────────────────────
// INSTALL: кэшируем ключевые файлы
// ────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Установка:', CACHE_VERSION)

  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    })
  )

  // Активируемся немедленно, не ждём закрытия вкладок
  self.skipWaiting()
})

// ────────────────────────────────────────────────────────────
// ACTIVATE: удаляем старые кэши
// ────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Активация:', CACHE_VERSION)

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => {
            console.log('[SW] Удаляем старый кэш:', name)
            return caches.delete(name)
          })
      )
    })
  )

  // Контролируем все вкладки немедленно
  self.clients.claim()
})

// ────────────────────────────────────────────────────────────
// FETCH: Cache First → Network Fallback
// ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Не кэшируем POST-запросы (Supabase)
  if (event.request.method !== 'GET') return

  // Не кэшируем запросы к Supabase (всегда нужны свежие данные)
  if (event.request.url.includes('supabase.co')) return

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Если есть в кэше — отдаём кэш
      if (cachedResponse) return cachedResponse

      // Иначе — идём в сеть
      return fetch(event.request).then((networkResponse) => {
        // Кэшируем успешный ответ (только GET, только 200)
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseClone = networkResponse.clone()
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return networkResponse
      }).catch(() => {
        // Оффлайн и нет в кэше — возвращаем главную страницу
        return caches.match('/')
      })
    })
  )
})

// Present so browsers treat the planner as an installable app. It never caches or rewrites a request.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

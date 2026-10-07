// TwoChat Service Worker — PWA Caching & Web Push Notifications

const CACHE_NAME = "twochat-v1";
const STATIC_ASSETS = ["/", "/chat", "/connect", "/login", "/register", "/icon-192.png", "/badge-72.png"];

// Install Event — Cache static shell assets safely (never cache private /api routes)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Cache addAll warning:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event — Clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event — Static assets network-first with cache fallback; NEVER cache /api requests
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Exclude API, WebSocket, and dynamic auth routes from service worker caching
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/ws")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful GET responses for static shell
        if (event.request.method === "GET" && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push Event — Receive Web Push Notification
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "TwoChat";
    const options = {
      body: payload.body || "New message received",
      icon: payload.icon || "/icon-192.png",
      badge: payload.badge || "/badge-72.png",
      data: payload.data || { url: "/chat" },
      tag: payload.data?.messageId || "twochat-msg",
      renotify: true,
      vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("[SW] Error parsing push payload:", err);
  }
});

// Notification Click Event — Open or focus TwoChat window safely
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/chat";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          // If window is already open at TwoChat origin, focus it
          if (clientUrl.origin === self.location.origin) {
            if ("focus" in client) {
              client.focus();
            }
            if ("navigate" in client && clientUrl.pathname !== targetUrl) {
              client.navigate(targetUrl);
            }
            return;
          }
        }
        // If no open window found, open new window to target route
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Notification Close Event
self.addEventListener("notificationclose", (_event) => {
  // Silent analytics or cleanup if needed
});

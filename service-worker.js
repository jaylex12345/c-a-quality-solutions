const CACHE_NAME = "c-a-driver-pwa-v37";
const APP_SHELL = [
  "./",
  "/driver-login.html",
  "/driver/login.html",
  "/driver/dashboard.html",
  "/driver/install.html",
  "/driver/profile.html",
  "/driver/history.html",
  "/driver/reset-password.html",
  "/driver/setup-password.html",
  "/manifest.json",
  "/assets/images/logo.jpeg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  const path = requestUrl.pathname;
  const bypassAuthCache =
    path === "/login.html" ||
    path === "/admin.html" ||
    path.startsWith("/admin/") ||
    path === "/assets/js/admin-auth.js";

  if (bypassAuthCache) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(event.request)) ||
            (await caches.match("/driver/login.html")) ||
            (await caches.match("/driver/dashboard.html"))
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return response;
      });
    })
  );
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : "New driver update" };
  }

  const title = data.title || "C&A Driver Update";
  const body = data.body || "You have a new delivery update.";
  const url = data.url || "/driver/dashboard.html";
  const tag = data.tag || "driver-update";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/assets/images/logo.jpeg",
      badge: "/assets/images/logo.jpeg",
      data: { url },
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/driver/dashboard.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes("/driver/") && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});
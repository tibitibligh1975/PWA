const CACHE_NAME = "pwa-test-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/app.js",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Instalando");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Cache aberto");
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener("push", (event) => {
  console.log("[ServiceWorker] Push recebido");
  console.log("[ServiceWorker] Dados Push:", event.data?.text());

  try {
    const payload = event.data.json();
    console.log("[ServiceWorker] Dados da notificação:", payload);

    if (payload.silent) {
      console.log(
        "[ServiceWorker] Notificação silenciosa recebida - não será exibida"
      );
      return;
    }

    // Garantir que todos os campos necessários estejam presentes
    const notificationData = {
      ...payload,
      icon: payload.icon || "/icons/icon-192x192.png",
      badge: payload.badge || "/icons/icon-192x192.png",
      vibrate: payload.vibrate || [100, 50, 100],
      requireInteraction: true,
      tag: "checkoutinho-notification",
      actions: [
        {
          action: "open",
          title: "Abrir",
        },
        {
          action: "close",
          title: "Fechar",
        },
      ],
    };

    event.waitUntil(
      (async () => {
        try {
          // Tocar o som se estiver presente no payload
          if (payload.sound) {
            try {
              const audio = new Audio(payload.sound);
              await audio.play();
              console.log("[ServiceWorker] Som reproduzido com sucesso");
            } catch (audioError) {
              console.error("[ServiceWorker] Erro ao tocar som:", audioError);
              // Continua mesmo se o som falhar
            }
          }

          // Mostrar a notificação
          await self.registration.showNotification(
            notificationData.title,
            notificationData
          );
          console.log("[ServiceWorker] Notificação mostrada com sucesso");
        } catch (error) {
          console.error(
            "[ServiceWorker] Erro ao processar notificação:",
            error
          );
        }
      })()
    );
  } catch (e) {
    console.error("[ServiceWorker] Erro ao processar payload:", e);
    // Se não conseguir processar o JSON, mostra uma notificação simples
    event.waitUntil(
      self.registration.showNotification("Nova Notificação", {
        body: event.data.text(),
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  console.log("[ServiceWorker] Notificação clicada");
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow("/");
        }
      })
  );
});

self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Ativado");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[ServiceWorker] Removendo cache antigo:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

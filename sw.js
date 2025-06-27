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

  let notificationData = {
    title: "Nova Notificação",
    body: "Sem conteúdo",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    vibrate: [100, 50, 100],
    sound: "/sound/CashRegister.mp3",
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
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

  try {
    const payload = event.data.json();
    notificationData = {
      ...notificationData,
      ...payload,
    };
    console.log("[ServiceWorker] Dados da notificação:", notificationData);

    if (payload.silent) {
      console.log(
        "[ServiceWorker] Notificação silenciosa recebida - não será exibida"
      );
      return;
    }
  } catch (e) {
    console.error("[ServiceWorker] Erro ao processar payload:", e);
    notificationData.body = event.data.text();
  }

  event.waitUntil(
    (async () => {
      try {
        // Tocar o som antes de mostrar a notificação
        const audio = new Audio("/sound/CashRegister.mp3");
        await audio.play();

        // Mostrar a notificação
        await self.registration.showNotification(
          notificationData.title,
          notificationData
        );
        console.log("[ServiceWorker] Notificação mostrada com sucesso");
      } catch (error) {
        console.error("[ServiceWorker] Erro ao processar notificação:", error);
      }
    })()
  );
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

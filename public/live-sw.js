self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Nouveau live";
  const body = payload.body || "Un créateur que vous suivez est en ligne.";
  const icon = payload.icon || "/famous-ai-logo.svg";
  const image = payload.image || icon;
  const url = payload.url || "/watch";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      image,
      badge: icon,
      tag: payload.tag || `live-${Date.now()}`,
      renotify: true,
      data: { url },
      actions: [{ action: "view-live", title: payload.actionTitle || "Voir le live" }],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/watch";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    })
  );
});
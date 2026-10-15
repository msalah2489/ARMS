/* ARMS Web Push service worker — works with Next static export + basePath /ARMS */
/* global self, clients */

function appBasePathFromScope() {
  try {
    const path = new URL(self.registration.scope).pathname.replace(/\/$/, "");
    return path || "";
  } catch {
    return "";
  }
}

function appHomeUrl() {
  const base = appBasePathFromScope();
  return `${self.location.origin}${base}/`;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "ARMS", body: "", url: "" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = {
        title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : "ARMS",
        body: typeof parsed.body === "string" ? parsed.body : "",
        url: typeof parsed.url === "string" ? parsed.url : "",
      };
    }
  } catch {
    try {
      const text = event.data ? event.data.text() : "";
      if (text) data.body = text;
    } catch {
      /* ignore */
    }
  }

  const base = appBasePathFromScope();
  const targetUrl = data.url
    ? data.url.startsWith("http")
      ? data.url
      : `${self.location.origin}${base}${data.url.startsWith("/") ? data.url : `/${data.url}`}`
    : appHomeUrl();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      dir: "rtl",
      lang: "ar",
      data: { url: targetUrl },
      tag: data.title.slice(0, 64) || "arms-push",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || appHomeUrl();

  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && typeof client.navigate === "function") {
            try {
              await client.navigate(target);
            } catch {
              /* ignore navigate failures */
            }
          }
          return;
        }
      }
      if (clients.openWindow) {
        await clients.openWindow(target);
      }
    })(),
  );
});

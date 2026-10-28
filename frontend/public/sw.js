/* Hisaby shell SW v4 — network only for pages. Never substitute another page. */
const CACHE = "hisaby-shell-v4";
const PRECACHE = ["/manifest.webmanifest", "/brand/hisaby-mark.png"];

function shouldBypass(url) {
  try {
    const u = new URL(url);
    const path = u.pathname || "";
    // Always hit network for app data and build artifacts
    if (path.startsWith("/backend-api")) return true;
    if (path.startsWith("/api")) return true;
    if (path.startsWith("/_next")) return true;
    if (path.includes(".")) {
      // JS/CSS/maps from previous deploys must not stick around as offline shells
      if (/\.(js|css|map|json|woff2?|ttf|eot)$/i.test(path) && !path.startsWith("/brand/")) {
        return true;
      }
    }
    // Cross-origin always network
    if (u.origin !== self.location.origin) return true;
  } catch {
    return true;
  }
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("hisaby-shell-") && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (shouldBypass(req.url)) {
    // Network only — never serve HTML for API failures
    event.respondWith(fetch(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(
            "<!doctype html><meta charset=\"utf-8\"><title>حسابي</title><body style=\"font-family:sans-serif;background:#f8fafc;color:#0f172a;padding:2rem\"><p>تعذر تحميل الصفحة. تحقق من الاتصال ثم أعد المحاولة.</p></body>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          ),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(req).catch(async () => (await caches.match(req)) || new Response("", { status: 504 })),
  );
});

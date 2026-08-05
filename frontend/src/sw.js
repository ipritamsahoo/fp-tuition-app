/* eslint-disable no-undef */

// ═══════════════════════════════════════════
// FIREBASE CLOUD MESSAGING (FCM) — must load FIRST
// importScripts must be at the top, before any ES imports
// ═══════════════════════════════════════════
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

import { get, set } from "idb-keyval";

const messaging = firebase.messaging();

// Handle background push notifications (data-only messages)
messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const title = data.title || "FP Finance";
    const isNotice = data.type === "notice";

    const options = {
        body: data.body || "You have a new notification",
        icon: "/pwa-192x192.png", // Must be PNG for Android
        badge: "/badge-icon-192x192.png",
        tag: `fpfinance-${Date.now()}`,
        renotify: true,
        data: data,
    };

    // Add "Mark as Read" action button only for notice-type notifications
    if (isNotice && data.notice_id) {
        options.actions = [
            { action: "mark_read", title: "✓ Mark as Read" },
            { action: "open_notices", title: "Open" },
        ];
    }

    // Save notification to IndexedDB so frontend can read it
    const notif = {
        id: `local_bg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        title: title !== "FP Finance" ? title : (data.title || ""),
        message: options.body,
        type: data.type || "general",
        notice_id: data.notice_id || null,
        target_uid: data.target_uid || null, // Ensure strict user isolation
        is_read: false,
        created_at: new Date().toISOString(),
    };

    get("fpfinance_notifications").then((raw) => {
        let notifs = Array.isArray(raw) ? raw : [];
        notifs = [notif, ...notifs].slice(0, 50); // Keep max 50
        return set("fpfinance_notifications", notifs);
    }).then(() => {
        // Notify all open client windows to refresh the bell immediately
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                client.postMessage({ type: "NEW_NOTIFICATION", notification: notif });
            }
        });
    }).catch(console.error);

    // Increment and apply PWA app icon badge
    _incrementBadge();

    self.registration.showNotification(title, options);
});

// ─────────────────────────────────────────────────
// PWA App Icon Badge Helpers
// ─────────────────────────────────────────────────
const BADGE_KEY = "fp_badge_count";

async function _getBadgeCount() {
    try {
        const count = await get(BADGE_KEY);
        return typeof count === "number" ? count : 0;
    } catch {
        return 0;
    }
}

async function _setBadgeCount(count) {
    const safeCount = Math.max(0, count);
    try {
        await set(BADGE_KEY, safeCount);
    } catch { /* silent */ }
    try {
        if (safeCount > 0) {
            await self.navigator.setAppBadge(safeCount);
        } else {
            await self.navigator.clearAppBadge();
        }
    } catch { /* Badge API not supported on this platform */ }
}

async function _incrementBadge() {
    const current = await _getBadgeCount();
    await _setBadgeCount(current + 1);
}

async function _decrementBadge() {
    const current = await _getBadgeCount();
    await _setBadgeCount(current - 1);
}


// ─────────────────────────────────────────────────
// "Mark as Read" background API call helper
// ─────────────────────────────────────────────────
async function _markNoticeRead(noticeId) {
    if (!noticeId) return;
    try {
        // Read the auth token that api.js mirrors into IndexedDB on every request
        const token = await get("fp_auth_token");
        if (!token) return; // No token — skip silently (app will handle it on next open)

        const apiBase = self.__API_BASE__ || "";
        await fetch(`${apiBase}/api/notices/${noticeId}/read`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });
    } catch {
        // Network failure — the app will auto-mark on next Notices page load
    }
}

async function _markLocalNotifRead(noticeId) {
    if (!noticeId) return;
    try {
        const raw = await get("fpfinance_notifications");
        if (!Array.isArray(raw)) return;
        const updated = raw.map((n) =>
            n.notice_id === noticeId ? { ...n, is_read: true } : n
        );
        await set("fpfinance_notifications", updated);
    } catch { /* silent */ }
}


// Handle notification click — Mark as Read action, open app, or focus existing window
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    const noticeId = data.notice_id || null;
    const action = event.action;

    if (action === "mark_read" && noticeId) {
        // Background: call the API + mark local notification as read + update badge
        event.waitUntil(
            Promise.all([
                _markNoticeRead(noticeId),
                _markLocalNotifRead(noticeId),
                _decrementBadge(),
            ]).then(() => {
                // Inform any open windows to refresh their notification bell
                return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
                    for (const client of clientList) {
                        client.postMessage({ type: "NOTICE_MARKED_READ", noticeId });
                    }
                });
            })
        );
        return; // Don't open the app
    }

    // "open_notices" action or default tap on notification body → open/focus the app on notices page
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    // Navigate existing window to notices page
                    client.navigate("/student/notices");
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow("/student/notices");
            }
        })
    );
});

// ═══════════════════════════════════════════
// WORKBOX: Precaching & Runtime Caching
// ═══════════════════════════════════════════
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { enable as enableNavigationPreload } from "workbox-navigation-preload";

// Enable navigation preload — allows the browser to start loading
// the page in parallel with service worker boot, eliminating the
// gap where the URL bar flashes on PWA launch.
enableNavigationPreload();

// Handle all navigation requests (HTML page loads) with NetworkFirst.
// Falls back to cached index.html if offline.
const navigationHandler = new NetworkFirst({
    cacheName: "navigations",
    plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
});
registerRoute(new NavigationRoute(navigationHandler));

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Google Fonts
registerRoute(
    /^https:\/\/fonts\.googleapis\.com\/.*/i,
    new CacheFirst({
        cacheName: "google-fonts-cache",
        plugins: [
            new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
            new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
    })
);

registerRoute(
    /^https:\/\/fonts\.gstatic\.com\/.*/i,
    new CacheFirst({
        cacheName: "gstatic-fonts-cache",
        plugins: [
            new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
            new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
    })
);

// Cloudinary images
registerRoute(
    /^https:\/\/res\.cloudinary\.com\/.*/i,
    new CacheFirst({
        cacheName: "cloudinary-images",
        plugins: [
            new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }),
            new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
    })
);

self.addEventListener("activate", (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.delete("navigations")
        ])
    );
});

// Allow the PWA plugin to force skipWaiting when auto-updating
// Also handles badge control messages from the running app
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
    if (event.data && event.data.type === "GET_VERSION") {
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
                version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "Unknown"
            });
        }
    }
    // App sends SET_BADGE when unread notice count is known (e.g. on login or page focus)
    if (event.data && event.data.type === "SET_BADGE") {
        const count = typeof event.data.count === "number" ? event.data.count : 0;
        _setBadgeCount(count);
    }
    // App sends CLEAR_BADGE when user reads all notices (e.g. visiting Notices page)
    if (event.data && event.data.type === "CLEAR_BADGE") {
        _setBadgeCount(0);
    }
});

// Handle PWA Web Share Target POST requests
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (event.request.method === "POST" && url.pathname === "/share-receiver") {
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    const imageFile = formData.get("screenshot");
                    if (imageFile) {
                        await set("shared_payment_screenshot", imageFile);
                    }
                    return Response.redirect("/student?shared=true", 303);
                } catch (err) {
                    console.error("Web Share Target error:", err);
                    return Response.redirect("/student?shared_error=true", 303);
                }
            })()
        );
    }
});

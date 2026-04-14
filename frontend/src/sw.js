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
    const options = {
        body: data.body || "You have a new notification",
        icon: "/pwa-192x192.png", // Must be PNG for Android
        badge: "/fp-badge-icon.png",
        tag: `fpfinance-${Date.now()}`,
        renotify: true,
        data: data,
    };

    // Save notification to IndexedDB so frontend can read it
    const notif = {
        id: `local_bg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        message: options.body,
        type: data.type || "general",
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

    self.registration.showNotification(title, options);
});

// Handle notification click — focus or open the app
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
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

// Serve the app shell (index.html) with NetworkFirst for navigations.
// This uses the preloaded response when available, making launch instant.
registerRoute(
    new NavigationRoute(
        new NetworkFirst({
            cacheName: "navigations",
            plugins: [
                new CacheableResponsePlugin({ statuses: [0, 200] }),
            ],
        })
    )
);

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

// Allow the PWA plugin to force skipWaiting when auto-updating
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

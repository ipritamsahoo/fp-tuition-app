import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

/**
 * Request notification permission and get FCM token.
 * Uses the PWA's main service worker (which includes FCM handling).
 * Returns the token string or null if permission denied/error.
 */
async function requestNotificationPermission() {
    try {
        if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
            return null;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.log("Notification permission denied");
            return null;
        }

        const { getMessaging, getToken } = await import("firebase/messaging");
        const messaging = getMessaging(app);

        // Wait for the PWA's main service worker to be ready
        // (it already includes FCM handling via importScripts)
        const swRegistration = await navigator.serviceWorker.ready;

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration,
        });

        console.log("FCM token obtained:", token ? "✓" : "✗");
        return token || null;
    } catch (error) {
        console.error("FCM token error:", error);
        return null;
    }
}

/**
 * Set up the foreground message handler.
 * Returns an unsubscribe function, or null if FCM is unavailable.
 */
async function setupForegroundListener(callback) {
    try {
        if (typeof window === "undefined" || !("Notification" in window)) return null;

        const { getMessaging, onMessage } = await import("firebase/messaging");
        const messaging = getMessaging(app);
        return onMessage(messaging, callback);
    } catch (e) {
        console.warn("FCM foreground listener unavailable:", e.message);
        return null;
    }
}

export { app, auth, db, requestNotificationPermission, setupForegroundListener };

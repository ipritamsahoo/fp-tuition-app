import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { requestNotificationPermission, setupForegroundListener } from "@/lib/firebase";
import { api } from "@/lib/api";

import { get, set, clear } from "idb-keyval";

const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

// ── IndexedDB helpers ──
const STORAGE_KEY = "fpfinance_notifications";
const MAX_NOTIFICATIONS = 50;
const EXPIRE_DAYS = 7;

async function loadNotifs(uid) {
    try {
        const raw = await get(STORAGE_KEY);
        if (!raw || !Array.isArray(raw)) return [];
        // Auto-expire old notifications and strictly filter by target_uid
        const cutoff = Date.now() - EXPIRE_DAYS * 24 * 60 * 60 * 1000;
        return raw.filter((n) =>
            (!n.target_uid || n.target_uid === uid) &&
            new Date(n.created_at).getTime() > cutoff
        );
    } catch {
        return [];
    }
}

async function saveNotifs(notifs) {
    try {
        // Keep only the latest MAX_NOTIFICATIONS
        const trimmed = notifs.slice(0, MAX_NOTIFICATIONS);
        await set(STORAGE_KEY, trimmed);
    } catch {
        // Silently fail if IDB is full
    }
}

export function NotificationProvider({ children }) {
    const { user, loading } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const userRef = useRef(null);

    // ── Helper: add a notification to state + IndexedDB ──
    const addNotification = useCallback((notif) => {
        setNotifications((prev) => {
            const updated = [notif, ...prev].slice(0, MAX_NOTIFICATIONS);
            saveNotifs(updated);
            setUnreadCount(updated.filter((n) => !n.is_read).length);
            return updated;
        });
    }, []);

    // Load notifications from IndexedDB when user changes
    useEffect(() => {
        if (loading) return; // Wait for Firebase Auth to initialize

        if (!user?.uid) {
            setNotifications([]);
            setUnreadCount(0);
            userRef.current = null;
            // Wipe IndexedDB on logout to ensure no cross-account leakage
            clear().catch(console.error);
            return;
        }

        userRef.current = user.uid;

        const reload = async () => {
            if (!userRef.current) return;
            const stored = await loadNotifs(userRef.current);
            setNotifications(stored);
            setUnreadCount(stored.filter((n) => !n.is_read).length);
        };

        // Initial load
        reload();

        // Reload on focus to catch any background notifications added by sw.js
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") reload();
        };

        window.addEventListener("focus", reload);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Listen for messages from service worker (background notification sync)
        const handleSWMessage = (event) => {
            if (event.data?.type === "NEW_NOTIFICATION" && event.data.notification) {
                const notif = event.data.notification;
                // Only add if it belongs to this user
                if (!notif.target_uid || notif.target_uid === userRef.current) {
                    addNotification(notif);
                }
            }
        };
        navigator.serviceWorker?.addEventListener("message", handleSWMessage);

        return () => {
            window.removeEventListener("focus", reload);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
        };
    }, [user?.uid, addNotification]);

    // ── FCM setup: request permission + register token ──
    useEffect(() => {
        if (!user?.uid) return;

        const setupFCM = async () => {
            try {
                const token = await requestNotificationPermission();
                if (token) {
                    await api.post("/api/auth/fcm-token", { token });
                    localStorage.setItem("fcm_token", token);
                }
            } catch (err) {
                console.warn("FCM setup failed:", err);
            }
        };

        setupFCM();
    }, [user?.uid]);

    // ── Foreground FCM message handler → save to localStorage ──
    useEffect(() => {
        let cleanup = null;

        setupForegroundListener((payload) => {
            const data = payload.data || {};
            const notif = {
                id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                message: data.body || payload.notification?.body || "New notification",
                type: data.type || "general",
                is_read: false,
                created_at: new Date().toISOString(),
            };
            addNotification(notif);

            // Force native push notification even when app is open
            if ("serviceWorker" in navigator && "Notification" in window && Notification.permission === "granted") {
                navigator.serviceWorker.ready.then((registration) => {
                    registration.showNotification(data.title || "FP Finance", {
                        body: notif.message,
                        icon: "/pwa-192x192.png", // Must be PNG
                        badge: "/pwa-192x192.png", // Must be PNG
                        tag: `fpfinance-fg-${Date.now()}`,
                        data: data,
                    });
                });
            }
        }).then((unsub) => {
            cleanup = unsub;
        }).catch(() => { });

        return () => { if (cleanup) cleanup(); };
    }, [addNotification]);

    // ── Actions (all operate on localStorage, no API calls) ──
    const markRead = useCallback((notifId) => {
        setNotifications((prev) => {
            const updated = prev.map((n) =>
                n.id === notifId ? { ...n, is_read: true } : n
            );
            saveNotifs(updated);
            setUnreadCount(updated.filter((n) => !n.is_read).length);
            return updated;
        });
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications((prev) => {
            const updated = prev.map((n) => ({ ...n, is_read: true }));
            saveNotifs(updated);
            setUnreadCount(0);
            return updated;
        });
    }, []);

    const dismiss = useCallback((notifId) => {
        setNotifications((prev) => {
            const updated = prev.filter((n) => n.id !== notifId);
            saveNotifs(updated);
            setUnreadCount(updated.filter((n) => !n.is_read).length);
            return updated;
        });
    }, []);

    const clearAll = useCallback(() => {
        setNotifications((prev) => {
            const updated = prev.filter((n) => !n.is_read);
            saveNotifs(updated);
            setUnreadCount(updated.filter((n) => !n.is_read).length);
            return updated;
        });
    }, []);

    return (
        <NotificationContext.Provider
            value={{ notifications, unreadCount, markRead, markAllRead, dismiss, clearAll }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

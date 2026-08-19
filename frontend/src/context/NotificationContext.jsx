import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
    const [pushEnabled, setPushEnabled] = useState(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "denied") return false;
            return localStorage.getItem("push_enabled") !== "false";
        }
        return false;
    });
    const lastPermissionRef = useRef(
        typeof window !== "undefined" && "Notification" in window
            ? Notification.permission
            : "default"
    );
    const userRef = useRef(null);

    // Dynamic states for blocked notification modal and theme syncing
    const [blockedModalOpen, setBlockedModalOpen] = useState(false);
    const [appTheme, setAppTheme] = useState("dark");

    // Lock background scrolling when blocked notification modal is open
    useEffect(() => {
        if (blockedModalOpen) {
            document.documentElement.classList.add("scroll-lock");
            document.body.style.overflow = "hidden";
        } else {
            document.documentElement.classList.remove("scroll-lock");
            document.body.style.overflow = "unset";
        }
        return () => {
            document.documentElement.classList.remove("scroll-lock");
            document.body.style.overflow = "unset";
        };
    }, [blockedModalOpen]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const isAdmin = user?.role === "admin";
        const isTeacher = user?.role === "teacher";
        const themeKey = isAdmin
            ? "fp_admin_theme_v2"
            : isTeacher
            ? "fp_teacher_theme_v2"
            : "fp_student_theme_v2";
        setAppTheme(localStorage.getItem(themeKey) || "dark");
    }, [user]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleStudentThemeChange = (e) => {
            if (user?.role !== "teacher" && user?.role !== "admin") {
                setAppTheme(e.detail);
            }
        };
        const handleTeacherThemeChange = (e) => {
            if (user?.role === "teacher") {
                setAppTheme(e.detail);
            }
        };
        const handleAdminThemeChange = (e) => {
            if (user?.role === "admin") {
                setAppTheme(e.detail);
            }
        };
        window.addEventListener("fp-student-theme-change", handleStudentThemeChange);
        window.addEventListener("fp-teacher-theme-change", handleTeacherThemeChange);
        window.addEventListener("fp-admin-theme-change", handleAdminThemeChange);
        return () => {
            window.removeEventListener("fp-student-theme-change", handleStudentThemeChange);
            window.removeEventListener("fp-teacher-theme-change", handleTeacherThemeChange);
            window.removeEventListener("fp-admin-theme-change", handleAdminThemeChange);
        };
    }, [user]);

    // Disable background scrolling when modal is open
    useEffect(() => {
        if (typeof document === "undefined") return;
        if (blockedModalOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [blockedModalOpen]);

    // ── Helper: add a notification to state + IndexedDB ──
    const addNotification = useCallback((notif) => {
        setNotifications((prev) => {
            const updated = [notif, ...prev].slice(0, MAX_NOTIFICATIONS);
            saveNotifs(updated);
            setUnreadCount(updated.filter((n) => !n.is_read).length);
            return updated;
        });
    }, []);
 
    // ── Helper: sync notification permission and local state ──
    const syncPermissionState = useCallback(async () => {
        if (typeof window === "undefined" || !("Notification" in window)) return;
 
        const currentPermission = Notification.permission;
        const lastPermission = lastPermissionRef.current;
 
        if (currentPermission !== lastPermission) {
            lastPermissionRef.current = currentPermission;
 
            if (currentPermission === "granted") {
                // User enabled notifications in browser settings -> turn ON toggle
                setPushEnabled(true);
                localStorage.setItem("push_enabled", "true");
 
                if (user?.uid) {
                    try {
                        const token = await requestNotificationPermission();
                        if (token) {
                            await api.post("/api/auth/fcm-token", { token });
                            localStorage.setItem("fcm_token", token);
                        }
                    } catch (err) {
                        console.warn("FCM setup failed on permission query change to granted:", err);
                    }
                }
            } else {
                // User revoked permission (blocked) in browser settings -> turn OFF toggle
                setPushEnabled(false);
                localStorage.setItem("push_enabled", "false");
 
                try {
                    const token = localStorage.getItem("fcm_token");
                    if (token) {
                        await api.delete("/api/auth/fcm-token", { token });
                        localStorage.removeItem("fcm_token");
                    }
                } catch (err) {
                    console.warn("FCM token cleanup failed on permission revoke:", err);
                }
            }
        } else {
            // Permission did not change, but if it is blocked, make sure the toggle is OFF
            if (currentPermission === "denied" && pushEnabled) {
                setPushEnabled(false);
                localStorage.setItem("push_enabled", "false");
            }
        }
    }, [user?.uid, pushEnabled]);

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

        // Reload notifications and sync permission state on focus/visibility change
        const handleFocusOrVisibility = () => {
            if (document.visibilityState === "visible") {
                reload();
                syncPermissionState();
            }
        };
 
        window.addEventListener("focus", handleFocusOrVisibility);
        document.addEventListener("visibilitychange", handleFocusOrVisibility);
 
        // Listen for messages from service worker (background notification sync)
        const handleSWMessage = (event) => {
            if (event.data?.type === "NEW_NOTIFICATION" && event.data.notification) {
                const raw = event.data.notification;
                const notif = {
                    ...raw,
                    title: raw.title || raw.data?.title || "",
                };
                // Only add if it belongs to this user
                if (!notif.target_uid || notif.target_uid === userRef.current) {
                    addNotification(notif);
                }
            }
        };
        navigator.serviceWorker?.addEventListener("message", handleSWMessage);
 
        return () => {
            window.removeEventListener("focus", handleFocusOrVisibility);
            document.removeEventListener("visibilitychange", handleFocusOrVisibility);
            navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
        };
    }, [user?.uid, addNotification, syncPermissionState]);

    // ── FCM setup: request permission + register token ──
    useEffect(() => {
        if (!user?.uid) return;

        const setupFCM = async () => {
            if (localStorage.getItem("push_enabled") === "false") {
                return; // User disabled push notifications in-app
            }
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

        // Listen for browser notification permission change
        let permissionStatus = null;
        const handlePermissionChange = () => {
            syncPermissionState();
        };

        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions
                .query({ name: "notifications" })
                .then((status) => {
                    permissionStatus = status;
                    status.addEventListener("change", handlePermissionChange);
                })
                .catch((err) => {
                    console.warn("Notification permissions query not supported:", err);
                });
        }

        return () => {
            if (permissionStatus) {
                permissionStatus.removeEventListener("change", handlePermissionChange);
            }
        };
    }, [user?.uid, syncPermissionState]);
 
    // ── Action to toggle push notification preferences in-app ──
    const togglePushNotifications = useCallback(async () => {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied") {
            setBlockedModalOpen(true);
            return false;
        }
 
        const originalState = pushEnabled;
        const nextState = !originalState;
        
        // Optimistically update state
        setPushEnabled(nextState);
        localStorage.setItem("push_enabled", String(nextState));
 
        if (nextState) {
            try {
                const token = await requestNotificationPermission();
                if (token) {
                    await api.post("/api/auth/fcm-token", { token });
                    localStorage.setItem("fcm_token", token);
                    return true;
                } else {
                    // Rollback if permission denied
                    setPushEnabled(originalState);
                    localStorage.setItem("push_enabled", String(originalState));
                    return false;
                }
            } catch (err) {
                console.warn("Failed to enable push notifications:", err);
                // Rollback if call failed
                setPushEnabled(originalState);
                localStorage.setItem("push_enabled", String(originalState));
                return false;
            }
        } else {
            try {
                const token = localStorage.getItem("fcm_token");
                if (token) {
                    await api.delete("/api/auth/fcm-token", { token });
                    localStorage.removeItem("fcm_token");
                }
                
                // Unsubscribe from service worker's PushManager
                if ("serviceWorker" in navigator) {
                    const registration = await navigator.serviceWorker.ready;
                    const subscription = await registration.pushManager.getSubscription();
                    if (subscription) {
                        await subscription.unsubscribe();
                    }
                }
                return true;
            } catch (err) {
                console.warn("Failed to disable push notifications:", err);
                // Rollback if call failed
                setPushEnabled(originalState);
                localStorage.setItem("push_enabled", String(originalState));
                return false;
            }
        }
    }, [pushEnabled, setBlockedModalOpen]);

    // ── Foreground FCM message handler → save to localStorage ──
    useEffect(() => {
        let cleanup = null;

        setupForegroundListener((payload) => {
            const data = payload.data || {};
            const notif = {
                id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                title: data.title || payload.notification?.title || "",
                message: data.body || payload.notification?.body || "New notification",
                type: data.type || "general",
                is_read: false,
                created_at: new Date().toISOString(),
            };
            addNotification(notif);

            // If it is a new notice notification, trigger count refresh
            if (data.type === "notice") {
                window.dispatchEvent(new CustomEvent("notices-updated"));
                window.dispatchEvent(new CustomEvent("notices-read"));
            }

            // Force native push notification even when app is open
            if ("serviceWorker" in navigator && "Notification" in window && Notification.permission === "granted") {
                navigator.serviceWorker.ready.then((registration) => {
                    registration.showNotification(data.title || "FP Finance", {
                        body: notif.message,
                        icon: "/pwa-192x192.png", // Must be PNG
                        badge: "/badge-icon-192x192.png", // Must be PNG (monochromatic)
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
            value={{
                notifications,
                unreadCount,
                pushEnabled,
                togglePushNotifications,
                markRead,
                markAllRead,
                dismiss,
                clearAll,
            }}
        >
            {children}

            {/* Custom Modal for Blocked Notifications */}
            {blockedModalOpen && createPortal(
                <div 
                    data-theme={appTheme}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    onClick={() => setBlockedModalOpen(false)}
                    style={{
                        backgroundColor: (appTheme === "light") ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.5)',
                        backdropFilter: 'blur(16px) saturate(1.5)',
                        WebkitBackdropFilter: 'blur(16px) saturate(1.5)'
                    }}
                >
                    <div 
                        className="w-full max-w-sm rounded-[32px] p-8 animate-modal-in shadow-2xl flex flex-col items-center text-center"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: (appTheme === "light") ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.01)',
                            border: `1px solid ${(appTheme === "light") ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)'}`,
                            backdropFilter: 'blur(80px) saturate(2.5)',
                            WebkitBackdropFilter: 'blur(80px) saturate(2.5)',
                            boxShadow: (appTheme === "light")
                                ? '0 32px 64px rgba(0,0,0,0.05), inset 0 0 32px rgba(255,255,255,0.6)'
                                : '0 32px 64px rgba(0,0,0,0.6), inset 0 0 32px rgba(255,255,255,0.05)',
                            transform: "translateZ(0)",
                            isolation: "isolate"
                        }}
                    >
                        {/* Icon */}
                        <div 
                            className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-md"
                            style={{
                                backgroundColor: (appTheme === "light") ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 110, 132, 0.1)',
                                border: `1px solid ${(appTheme === "light") ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 110, 132, 0.2)'}`,
                                color: (appTheme === "light") ? '#ef4444' : '#ff9dac'
                            }}
                        >
                            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                notifications_off
                            </span>
                        </div>

                        {/* Title */}
                        <h3 
                            className="font-extrabold text-2xl mb-3 tracking-tight text-center" 
                            style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}
                        >
                            Notification Blocked
                        </h3>

                        {/* Description */}
                        <p 
                            className="text-xs sm:text-sm leading-relaxed mb-6 font-medium"
                            style={{ color: 'var(--st-text-secondary)' }}
                        >
                            Notification permission is blocked in your browser or device settings. Please allow notifications in settings first.
                        </p>

                        {/* Action Button */}
                        <div className="w-full">
                            <button
                                onClick={() => setBlockedModalOpen(false)}
                                className={`w-full px-4 py-4 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95 border shadow-lg ${
                                    appTheme === "light"
                                        ? 'bg-[#0d9488]/10 border-[#0d9488]/30 text-[#0d9488] hover:bg-[#0d9488]/20'
                                        : 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/20'
                                }`}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </NotificationContext.Provider>
    );
}

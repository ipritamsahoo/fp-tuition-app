import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
    getCachedProfilePic,
    setCachedProfilePic,
    shouldRefreshProfilePic,
    clearCachedProfilePic,
} from "@/lib/profilePicCache";
import { apiFetch } from "@/lib/api";

const AuthContext = createContext(null);

function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    if (/Windows/i.test(ua)) os = "Windows";
    else if (/Mac/i.test(ua)) os = "MacOS";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPad/i.test(ua)) os = "iOS";
    else if (/Linux/i.test(ua)) os = "Linux";

    if (/Edg/i.test(ua)) browser = "Edge";
    else if (/Chrome/i.test(ua)) browser = "Chrome";
    else if (/Safari/i.test(ua)) browser = "Safari";
    else if (/Firefox/i.test(ua)) browser = "Firefox";

    return { os, browser };
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    /** Build the user state object from a Firestore profile, handling pic cache. */
    const buildUserState = useCallback(async (uid, email, profile, idToken) => {
        const picUrl = profile.profile_pic_url || null;
        const picVersion = profile.pic_version || null;

        // Smart cache: check if we need to re-fetch the profile pic
        let cachedPicDataUrl = null;
        if (picUrl) {
            const cached = getCachedProfilePic(uid);
            if (cached && !shouldRefreshProfilePic(uid, picVersion)) {
                cachedPicDataUrl = cached.dataUrl;
            } else {
                // Cache in the background (don't block login)
                setCachedProfilePic(uid, picUrl, picVersion).then(() => {
                    const freshCache = getCachedProfilePic(uid);
                    if (freshCache) {
                        setUser((prev) => prev ? { ...prev, profilePicDataUrl: freshCache.dataUrl } : null);
                    }
                });
            }
        } else {
            clearCachedProfilePic(uid);
        }

        return {
            uid,
            email,
            name: profile.name || "",
            role: profile.role || "student",
            batchId: profile.batch_id || null,
            currentBadge: profile.current_badge || null,
            badgeAnimationPending: profile.badge_animation_pending || false,
            profilePicUrl: picUrl,
            picVersion: picVersion,
            profilePicDataUrl: cachedPicDataUrl,
            idToken,
            activeSessions: profile.active_sessions || [],
        };
    }, []);

    useEffect(() => {
        // Track the Firestore doc listener so we can clean it up
        let unsubDoc = null;
        // Timestamp when auth was initialized — used to give a grace period for session validation
        let authInitTime = 0;
        const SESSION_GRACE_MS = 8000; // 8 seconds grace after auth init before validating sessions

        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log("FP_FINANCE_AUTH_V3 Session Persistence Fix Active!");

            // Always clean up previous doc listener before setting up a new one
            if (unsubDoc) {
                unsubDoc();
                unsubDoc = null;
            }

            if (firebaseUser) {
                // ── STEP 1: Immediately restore from cache so user is never null ──
                // This prevents the flash of "logged out" while Firestore loads
                const cachedProfileRaw = localStorage.getItem(`fpfinance_profile_${firebaseUser.uid}`);
                if (cachedProfileRaw) {
                    try {
                        const profile = JSON.parse(cachedProfileRaw);
                        const cachedToken = localStorage.getItem("idToken") || "";
                        const cachedUserState = await buildUserState(firebaseUser.uid, firebaseUser.email, profile, cachedToken);
                        setUser(cachedUserState);
                        setLoading(false); // User is hydrated from cache — stop loading immediately
                    } catch (parseErr) {
                        console.error("Cache parse error during restore:", parseErr);
                        // Don't set loading false yet — let the snapshot handle it
                    }
                }

                try {
                    const idToken = await firebaseUser.getIdToken();
                    localStorage.setItem("idToken", idToken);

                    // Mark the time of auth initialization for session grace period
                    authInitTime = Date.now();

                    // ── STEP 2: Set up real-time listener for fresh data ──
                    let isFirstSnapshot = true;

                    unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), async (userDoc) => {
                        if (userDoc.exists()) {
                            const profile = userDoc.data();

                            // Session validation: if we have a local session ID but it was removed from DB,
                            // it means Admin kicked us out or session expired.
                            // IMPORTANT GUARDS:
                            // 1. Skip cached snapshots (stale data)
                            // 2. Skip the very first snapshot after auth init (Firestore may not have synced yet)
                            // 3. Skip if within the grace period after auth initialization
                            const activeSessions = profile.active_sessions || [];
                            const currentSessionId = localStorage.getItem("current_device_session_id");
                            const isSynced = localStorage.getItem("session_synced") === "true";
                            const withinGracePeriod = (Date.now() - authInitTime) < SESSION_GRACE_MS;

                            if (
                                isSynced &&
                                !userDoc.metadata.fromCache &&
                                !isFirstSnapshot &&
                                !withinGracePeriod &&
                                currentSessionId &&
                                !activeSessions.some(s => s.session_id === currentSessionId)
                            ) {
                                console.warn("Session missing from DB. Waiting 3s to confirm it's not a sync delay...");

                                // Double-check with a fresh server read before logging out
                                setTimeout(async () => {
                                    try {
                                        const freshDoc = await getDoc(doc(db, "users", firebaseUser.uid));
                                        if (freshDoc.exists()) {
                                            const latestProfile = freshDoc.data();
                                            const latestSessions = latestProfile.active_sessions || [];
                                            if (!latestSessions.some(s => s.session_id === currentSessionId)) {
                                                console.error("Session permanently revoked. Logging out.");
                                                localStorage.removeItem(`fpfinance_profile_${firebaseUser.uid}`);
                                                localStorage.removeItem("idToken");
                                                localStorage.removeItem("current_device_session_id");
                                                localStorage.removeItem("session_synced");
                                                await signOut(auth);
                                                setUser(null);
                                                setLoading(false);
                                                window.location.reload();
                                            } else {
                                                console.log("Delayed sync caught the session. Keeping user logged in.");
                                            }
                                        }
                                    } catch (e) {
                                        console.error("Error doing final session check:", e);
                                    }
                                }, 3000);

                                // Even during session check, keep existing user state (don't blank it out)
                                // Just mark first snapshot done and return
                                isFirstSnapshot = false;
                                return;
                            }

                            isFirstSnapshot = false;

                            // Cache profile for future offline use / instant restore
                            localStorage.setItem(`fpfinance_profile_${firebaseUser.uid}`, JSON.stringify(profile));

                            // Update user state with fresh data + fresh token
                            const freshToken = await firebaseUser.getIdToken();
                            localStorage.setItem("idToken", freshToken);
                            const userState = await buildUserState(firebaseUser.uid, firebaseUser.email, profile, freshToken);
                            setUser(userState);
                            setLoading(false); // Guaranteed: user is set BEFORE loading becomes false
                        } else {
                            // User doc doesn't exist in Firestore — this is a deleted account
                            setUser(null);
                            setLoading(false);
                        }
                    }, (err) => {
                        console.error("Firestore listener error (likely offline):", err);

                        // If we already hydrated from cache, user is fine — nothing to do.
                        // If not, try the cache fallback so user isn't stuck on loading.
                        if (!cachedProfileRaw) {
                            setUser(null);
                            setLoading(false);
                        }
                    });

                } catch (err) {
                    console.error("Error setting up auth listener:", err);

                    // Offline fallback: Use cached profile if available
                    if (cachedProfileRaw) {
                        try {
                            const profile = JSON.parse(cachedProfileRaw);
                            const idToken = localStorage.getItem("idToken") || "";
                            const userState = await buildUserState(firebaseUser.uid, firebaseUser.email, profile, idToken);
                            setUser(userState);
                        } catch (parseErr) {
                            setUser(null);
                        }
                    } else {
                        setUser(null);
                    }
                    setLoading(false);
                }
            } else {
                // No firebase user — genuinely logged out
                localStorage.removeItem("idToken");
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsub();
            if (unsubDoc) {
                unsubDoc();
            }
        };
    }, [buildUserState]);

    const login = async (username, password) => {
        const email = `${username.trim().toLowerCase()}@fp.com`;
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await cred.user.getIdToken();
        localStorage.setItem("idToken", idToken);

        const userDoc = await getDoc(doc(db, "users", cred.user.uid));
        if (userDoc.exists()) {
            const profile = userDoc.data();
            localStorage.setItem(`fpfinance_profile_${cred.user.uid}`, JSON.stringify(profile));
            const userState = await buildUserState(cred.user.uid, cred.user.email, profile, idToken);
            setUser(userState);

            // Register device session
            try {
                const sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem("current_device_session_id", sessionId);

                const { os, browser } = getBrowserInfo();
                await apiFetch("/api/auth/session", {
                    method: "POST",
                    body: JSON.stringify({
                        session_id: sessionId,
                        device_name: os,
                        platform: browser,
                    }),
                });
                localStorage.setItem("session_synced", "true");
            } catch (err) {
                console.error("Failed to register session:", err);
            }
        }

        return cred;
    };

    const logout = async () => {
        if (user?.uid) {
            clearCachedProfilePic(user.uid);
            localStorage.removeItem(`fpfinance_profile_${user.uid}`);

            // Clean up our session from the database
            const currentSessionId = localStorage.getItem("current_device_session_id");
            if (currentSessionId) {
                try {
                    await apiFetch(`/api/auth/session/${currentSessionId}`, { method: "DELETE" });
                } catch (e) {
                    console.error("Session cleanup failed:", e);
                }
            }

            // Clean up FCM token from the database
            const fcmToken = localStorage.getItem("fcm_token");
            if (fcmToken) {
                try {
                    await apiFetch("/api/auth/fcm-token", {
                        method: "DELETE",
                        body: JSON.stringify({ token: fcmToken }),
                    });
                } catch (e) {
                    console.error("FCM token cleanup failed:", e);
                }
                localStorage.removeItem("fcm_token");
            }
        }
        await signOut(auth);
        localStorage.removeItem("idToken");
        localStorage.removeItem("current_device_session_id");
        localStorage.removeItem("session_synced");
        setUser(null);
    };

    /** Update profile pic in context + cache after a new upload. */
    const updateProfilePic = useCallback(async (picUrl, picVersion) => {
        if (!user) return;
        if (picUrl) {
            await setCachedProfilePic(user.uid, picUrl, picVersion);
            const cached = getCachedProfilePic(user.uid);
            setUser((prev) => prev ? {
                ...prev,
                profilePicUrl: picUrl,
                picVersion: picVersion,
                profilePicDataUrl: cached?.dataUrl || null,
            } : null);
        } else {
            clearCachedProfilePic(user.uid);
            setUser((prev) => prev ? {
                ...prev,
                profilePicUrl: null,
                picVersion: null,
                profilePicDataUrl: null,
            } : null);
        }
    }, [user]);

    /** Force re-read the user profile from Firestore and update React state. */
    const refreshUser = useCallback(async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        try {
            // Force reload to get updated email/password claims
            await currentUser.reload();
            const idToken = await currentUser.getIdToken(true);
            localStorage.setItem("idToken", idToken);
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
                const profile = userDoc.data();
                localStorage.setItem(`fpfinance_profile_${currentUser.uid}`, JSON.stringify(profile));
                const userState = await buildUserState(currentUser.uid, currentUser.email, profile, idToken);
                setUser(userState);
            }
        } catch (err) {
            console.error("refreshUser error:", err);
            // On network failure during refresh, fall back to what we have or cached
            const cachedProfileRaw = localStorage.getItem(`fpfinance_profile_${currentUser.uid}`);
            if (cachedProfileRaw) {
                try {
                    const profile = JSON.parse(cachedProfileRaw);
                    const idToken = localStorage.getItem("idToken") || "";
                    const userState = await buildUserState(currentUser.uid, currentUser.email, profile, idToken);
                    setUser(userState);
                } catch (parseErr) {
                    // don't destory existing state if parse fails
                }
            }
        }
    }, [buildUserState]);

    // Proactively refresh token + update session heartbeat when app comes back to the foreground
    useEffect(() => {
        let lastHeartbeat = 0;
        const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // Throttle: at most once per 2 minutes

        const handleVisibilityChange = async () => {
            if (document.visibilityState === "visible" && auth.currentUser) {
                try {
                    // Force refresh if it's close to expiring, otherwise get cached valid token
                    const newToken = await auth.currentUser.getIdToken();
                    if (localStorage.getItem("idToken") !== newToken) {
                        localStorage.setItem("idToken", newToken);
                        setUser((prev) => (prev ? { ...prev, idToken: newToken } : null));
                    }

                    // Send heartbeat to update last_active for this device session
                    const currentSessionId = localStorage.getItem("current_device_session_id");
                    const now = Date.now();
                    if (currentSessionId && (now - lastHeartbeat) > HEARTBEAT_INTERVAL_MS) {
                        lastHeartbeat = now;
                        apiFetch(`/api/auth/session/${currentSessionId}/heartbeat`, { method: "PATCH" })
                            .catch((err) => console.warn("Session heartbeat failed:", err.message));
                    }
                } catch (err) {
                    console.error("Foreground token refresh error:", err);
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleVisibilityChange);
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, updateProfilePic, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be inside AuthProvider");
    return ctx;
}


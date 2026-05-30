import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
    isBiometricAvailable,
    getAppLockSettings,
    saveAppLockSettings,
    hasRegisteredCredential,
    registerBiometric,
    authenticateBiometric,
    removeBiometricCredential,
} from "@/lib/biometricService";

const BiometricContext = createContext(null);

export function BiometricProvider({ children, userId }) {
    // Whether biometric hw is available on this device
    const [isSupported, setIsSupported] = useState(false);
    // Current settings: { enabled, timeout }
    const [settings, setSettings] = useState(() => getAppLockSettings());
    // Is the app currently locked?
    const [isLocked, setIsLocked] = useState(() => {
        const initSettings = getAppLockSettings();
        return initSettings.enabled && !!userId;
    });
    // State for setup/auth flow
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authError, setAuthError] = useState("");

    // Timer ref for delayed lock
    const lockTimerRef = useRef(null);
    // Timestamp when app went to background
    const hiddenAtRef = useRef(null);

    // ── Init ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        isBiometricAvailable().then(setIsSupported);
    }, []);

    // ── Visibility-based lock trigger ─────────────────────────────────────────
    useEffect(() => {
        if (!settings.enabled) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                // App going to background — record time
                hiddenAtRef.current = Date.now();

                if (settings.timeout === 0) {
                    // Immediate lock
                    setIsLocked(true);
                } else {
                    // Schedule lock after timeout ms
                    lockTimerRef.current = setTimeout(() => {
                        setIsLocked(true);
                    }, settings.timeout);
                }
            } else if (document.visibilityState === "visible") {
                // App came back to foreground
                if (settings.timeout > 0 && hiddenAtRef.current) {
                    const elapsed = Date.now() - hiddenAtRef.current;
                    if (elapsed < settings.timeout) {
                        // Not enough time passed → cancel the timer, don't lock
                        clearTimeout(lockTimerRef.current);
                    } else {
                        // Time elapsed but background JS was suspended → lock now
                        setIsLocked(true);
                    }
                }
                hiddenAtRef.current = null;
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            clearTimeout(lockTimerRef.current);
        };
    }, [settings]);

    // ── Public API ────────────────────────────────────────────────────────────

    /** Enable app lock — registers biometric credential */
    const enableAppLock = useCallback(async (timeout = 0) => {
        if (!isSupported) throw new Error("Biometric not supported on this device.");
        await registerBiometric(userId);
        const newSettings = { enabled: true, timeout };
        saveAppLockSettings(newSettings);
        setSettings(newSettings);
    }, [isSupported, userId]);

    /** Change the lock timeout (0 = immediate, 60000 = 1min, 300000 = 5min) */
    const updateTimeout = useCallback((timeout) => {
        const newSettings = { ...settings, timeout };
        saveAppLockSettings(newSettings);
        setSettings(newSettings);
    }, [settings]);

    /** Disable app lock — removes credential */
    const disableAppLock = useCallback(() => {
        clearTimeout(lockTimerRef.current);
        removeBiometricCredential();
        setSettings({ enabled: false, timeout: 0 });
        setIsLocked(false);
    }, []);

    /** Trigger biometric authentication to unlock the app */
    const unlock = useCallback(async (options = {}) => {
        const { silentOnCancel = false } = options;
        setIsAuthenticating(true);
        setAuthError("");
        try {
            await authenticateBiometric();
            setIsLocked(false);
        } catch (err) {
            console.warn("[Biometric] Unlock failed:", err);
            if (err.name === "NotAllowedError") {
                // Do not show any error message if the user cancels or denies
            } else if (err.name === "InvalidStateError") {
                setAuthError("No biometric registered. Please re-enable Biometric Lock.");
            } else {
                setAuthError(err.message || "Authentication failed.");
            }
        } finally {
            setIsAuthenticating(false);
        }
    }, []);

    /** Check if credential is already registered */
    const isRegistered = hasRegisteredCredential();

    return (
        <BiometricContext.Provider
            value={{
                isSupported,
                settings,
                isLocked,
                isAuthenticating,
                authError,
                isRegistered,
                enableAppLock,
                updateTimeout,
                disableAppLock,
                unlock,
                setAuthError,
            }}
        >
            {children}
        </BiometricContext.Provider>
    );
}

export function useBiometric() {
    const ctx = useContext(BiometricContext);
    if (!ctx) throw new Error("useBiometric must be inside BiometricProvider");
    return ctx;
}

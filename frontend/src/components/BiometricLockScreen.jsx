import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useBiometric } from "@/context/BiometricContext";
import { useAuth } from "@/context/AuthContext";

export default function BiometricLockScreen() {
    const { isLocked, isAuthenticating, authError, unlock, setAuthError, settings } = useBiometric();
    const { user } = useAuth();

    const [visible, setVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);
    const [isAppBackgrounded, setIsAppBackgrounded] = useState(() => document.visibilityState === "hidden");
    // Track if this is the first lock trigger (auto-prompt once)
    const autoTriggered = useRef(false);

    // Track app background state (minimizing/multitasking history switcher)
    useEffect(() => {
        if (!settings?.enabled) {
            setIsAppBackgrounded(false);
            return;
        }

        const handleBlur = () => {
            setIsAppBackgrounded(true);
        };

        const handleFocus = () => {
            setIsAppBackgrounded(false);
        };

        const handleVisibility = () => {
            if (document.visibilityState === "hidden") {
                setIsAppBackgrounded(true);
            } else if (document.visibilityState === "visible") {
                setIsAppBackgrounded(false);
            }
        };

        window.addEventListener("blur", handleBlur);
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            window.removeEventListener("blur", handleBlur);
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [settings?.enabled]);

    // Disable body scroll when app is locked
    useEffect(() => {
        if (isLocked) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isLocked]);

    // ── Show / hide lifecycle ─────────────────────────────────────────────────
    useEffect(() => {
        if (isLocked) {
            setVisible(true);
            requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));

            // Auto-trigger biometric once on first lock, respecting window focus
            if (!autoTriggered.current) {
                autoTriggered.current = true;

                const triggerUnlock = () => {
                    unlock({ silentOnCancel: true });
                };

                const handleWindowFocus = () => {
                    window.removeEventListener("focus", handleWindowFocus);
                    setTimeout(triggerUnlock, 300);
                };

                if (document.hasFocus()) {
                    const t = setTimeout(triggerUnlock, 550);
                    return () => clearTimeout(t);
                } else {
                    window.addEventListener("focus", handleWindowFocus);
                    return () => {
                        window.removeEventListener("focus", handleWindowFocus);
                    };
                }
            }
        } else {
            setAnimateIn(false);
            autoTriggered.current = false;
            const t = setTimeout(() => setVisible(false), 380);
            return () => clearTimeout(t);
        }
    }, [isLocked, unlock]);

    // Reset auto-trigger flag when error occurs so next manual tap works cleanly
    useEffect(() => {
        if (authError) {
            autoTriggered.current = true; // prevent re-auto-trigger
        }
    }, [authError]);

    const handleUnlock = () => {
        setAuthError("");
        unlock();
    };

    const showPrivacyOverlay = !isLocked && settings?.enabled && isAppBackgrounded;

    if (!visible && !showPrivacyOverlay) return null;

    const isLight = user ? (user.role === "student" && localStorage.getItem("fp_student_theme_v2") === "light") : (localStorage.getItem("fp_student_theme_v2") === "light");

    // Dynamic styles based on theme
    const themeBg = isLight
        ? "linear-gradient(135deg, #eef2ff 0%, #dbeafe 25%, #ede9fe 50%, #fce7f3 75%, #eef2ff 100%)"
        : "linear-gradient(145deg, #0a0a14 0%, #0d0d1f 50%, #080812 100%)";

    const iconColor = authError
        ? "#f87171"
        : isLight
        ? "#0d9488"
        : "rgba(255, 255, 255, 0.6)";

    const titleColor = isLight ? "#1a1a2e" : "#f0f0fd";

    const subtitleColor = authError ? "#f87171" : isLight ? "rgba(26, 26, 46, 0.55)" : "rgba(255, 255, 255, 0.38)";

    const btnBg = isLight ? "rgba(13, 148, 136, 0.12)" : "rgba(59, 130, 246, 0.15)";
    const btnBorder = isLight ? "rgba(13, 148, 136, 0.25)" : "rgba(59, 130, 246, 0.35)";
    const btnColor = isLight ? "#0d9488" : "#3b82f6";
    const btnShadow = isLight ? "0 4px 20px rgba(13, 148, 136, 0.1)" : "0 4px 24px rgba(59, 130, 246, 0.18)";

    const btnHoverBg = isLight ? "rgba(13, 148, 136, 0.18)" : "rgba(59, 130, 246, 0.22)";
    const btnHoverShadow = isLight ? "0 6px 24px rgba(13, 148, 136, 0.15)" : "0 6px 28px rgba(59, 130, 246, 0.25)";

    return createPortal(
        <>
            {showPrivacyOverlay && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 999999,
                        background: themeBg,
                        pointerEvents: "all",
                    }}
                />
            )}
            {visible && (
                <div
                    data-theme={isLight ? "light" : "dark"}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 99999,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: themeBg,
                        opacity: animateIn ? 1 : 0,
                        transition: "opacity 0.38s cubic-bezier(0.4, 0, 0.2, 1)",
                        userSelect: "none",
                        WebkitTapHighlightColor: "transparent",
                    }}
                >

            {/* ── Main content ─────────────────────────────────────────────── */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transform: animateIn ? "translateY(0) scale(1)" : "translateY(28px) scale(0.96)",
                    transition: "transform 0.42s cubic-bezier(0.34, 1.4, 0.64, 1)",
                    padding: "24px 32px",
                    width: "100%",
                    maxWidth: 360,
                    height: "65vh",
                    maxHeight: 520,
                    boxSizing: "border-box",
                }}
            >
                {/* Top group: Lock icon + Title + Subtitle */}
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }}>
                    {/* Lock icon */}
                    <span
                        className="material-symbols-outlined"
                        style={{
                            fontSize: 64,
                            fontVariationSettings: "'FILL' 1",
                            color: iconColor,
                            transition: "color 0.3s ease",
                            marginBottom: 28,
                            display: "inline-block",
                            ...(authError && {
                                animation: "shake 0.4s ease",
                            }),
                        }}
                    >
                        lock
                    </span>

                    {/* Title */}
                    <h1 style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: titleColor,
                        fontFamily: "'Manrope', sans-serif",
                        letterSpacing: "-0.5px",
                        margin: 0,
                        marginBottom: 8,
                        textAlign: "center",
                    }}>
                        FP Finance Locked
                    </h1>

                    {/* Subtitle / error */}
                    <p style={{
                        fontSize: 14,
                        color: subtitleColor,
                        fontFamily: "'Manrope', sans-serif",
                        textAlign: "center",
                        lineHeight: 1.5,
                        margin: 0,
                        minHeight: 22,
                        transition: "color 0.2s",
                        animation: authError ? "shake 0.4s ease" : "none",
                    }}>
                        {authError || ""}
                    </p>
                </div>

                {/* ── Unlock button ── */}
                <button
                    id="biometric-unlock-btn"
                    onClick={handleUnlock}
                    disabled={isAuthenticating}
                    style={{
                        width: "100%",
                        padding: "17px 24px",
                        borderRadius: 18,
                        border: `1px solid ${btnBorder}`,
                        background: btnBg,
                        color: btnColor,
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: "'Manrope', sans-serif",
                        cursor: isAuthenticating ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        transition: "all 0.2s ease",
                        boxShadow: btnShadow,
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        WebkitTapHighlightColor: "transparent",
                        outline: "none",
                        letterSpacing: "0.01em",
                    }}
                    onMouseEnter={(e) => {
                        if (!isAuthenticating) {
                            e.currentTarget.style.background = btnHoverBg;
                            e.currentTarget.style.boxShadow = btnHoverShadow;
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = btnBg;
                        e.currentTarget.style.boxShadow = btnShadow;
                    }}
                    onTouchStart={(e) => {
                        if (!isAuthenticating) e.currentTarget.style.transform = "scale(0.97)";
                    }}
                    onTouchEnd={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                    }}
                >
                    Unlock
                </button>
            </div>

            <style>{`
                @keyframes pulse-icon {
                    0%, 100% { opacity: 0.7; transform: scale(1); }
                    50%       { opacity: 1;   transform: scale(1.06); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20%      { transform: translateX(-7px); }
                    40%      { transform: translateX(7px); }
                    60%      { transform: translateX(-4px); }
                    80%      { transform: translateX(4px); }
                }
            `}</style>
                </div>
            )}
        </>,
        document.body
    );
}

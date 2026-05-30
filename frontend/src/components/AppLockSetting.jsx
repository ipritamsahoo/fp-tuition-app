/**
 * AppLockSetting.jsx
 * A plug-and-play settings card for enabling/configuring biometric app lock.
 * Works for both StudentSettings and TeacherSettings.
 *
 * Props:
 *  - accentColor: string (e.g. '#3b82f6')
 *  - isLight: boolean
 *  - userId: string
 */
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useBiometric } from "@/context/BiometricContext";

const TIMEOUT_OPTIONS = [
    { label: "Immediately", value: 0 },
    { label: "After 1 minute", value: 60_000 },
    { label: "After 5 minutes", value: 300_000 },
];

export default function AppLockSetting({ accentColor = "#3b82f6", isLight = false, variant = "card", onSelect }) {
    const {
        isSupported,
        settings,
        isRegistered,
        enableAppLock,
        updateTimeout,
        disableAppLock,
    } = useBiometric();

    const [modalOpen, setModalOpen] = useState(false);
    const [setupStep, setSetupStep] = useState("options"); // "options" | "registering" | "success" | "error"
    const [selectedTimeout, setSelectedTimeout] = useState(settings.timeout ?? 0);
    const [errorMsg, setErrorMsg] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Sync selectedTimeout when settings change externally
    useEffect(() => {
        setSelectedTimeout(settings.timeout ?? 0);
    }, [settings.timeout]);

    // Disable body scroll when modal is open
    useEffect(() => {
        if (modalOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [modalOpen]);

    const isEnabled = settings.enabled && isRegistered;

    const currentTimeoutLabel =
        TIMEOUT_OPTIONS.find((o) => o.value === settings.timeout)?.label ?? "Immediately";

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleOpenModal = () => {
        setSetupStep("options");
        setErrorMsg("");
        setSelectedTimeout(settings.timeout ?? 0);
        setModalOpen(true);
        if (onSelect) onSelect();
    };

    const handleEnable = async () => {
        setIsLoading(true);
        setSetupStep("registering");
        setErrorMsg("");
        try {
            await enableAppLock(selectedTimeout);
            setSetupStep("success");
        } catch (err) {
            if (err.name === "NotAllowedError") {
                setErrorMsg("Biometric setup was cancelled. Please try again.");
            } else if (err.name === "InvalidStateError") {
                setErrorMsg("Credential already exists. Try disabling and re-enabling.");
            } else {
                setErrorMsg(err.message || "Setup failed. Device may not support biometrics.");
            }
            setSetupStep("error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateTimeout = (val) => {
        setSelectedTimeout(val);
        if (isEnabled) {
            updateTimeout(val);
        }
    };

    const handleDisable = () => {
        disableAppLock();
        setModalOpen(false);
    };

    // ── Styles ────────────────────────────────────────────────────────────────
    const cardBg = isLight ? "rgba(13,148,136,0.06)" : "rgba(255,255,255,0.04)";
    const cardBorder = isLight ? "rgba(13,148,136,0.15)" : "rgba(255,255,255,0.08)";
    const iconBg = isLight ? "rgba(13,148,136,0.1)" : "rgba(59,130,246,0.1)";
    const textPrimary = isLight ? "#0f172a" : "#f0f0fd";
    const textSecondary = isLight ? "#64748b" : "#aaaab7";
    const modalBg = isLight ? "rgba(255,255,255,0.15)" : "rgba(16,16,28,0.92)";
    const modalBorder = isLight ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.1)";

    if (!isSupported) {
        if (variant === "dropdown") return null;
        // Always show the row, but in a non-clickable disabled state
        return (
            <div
                className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl opacity-50"
                style={{ cursor: "not-allowed" }}
            >
                <div className="flex items-center gap-4">
                    <div
                        className="w-10 h-10 flex items-center justify-center rounded-xl"
                        style={{ backgroundColor: iconBg }}
                    >
                        <span
                            className="material-symbols-outlined"
                            style={{ color: textSecondary, fontVariationSettings: "'FILL' 1" }}
                        >
                            fingerprint
                        </span>
                    </div>
                    <div className="text-left">
                        <span className="font-medium block" style={{ color: textPrimary }}>
                            Biometric Lock
                        </span>
                        <span className="text-xs" style={{ color: textSecondary }}>
                            Not supported on this device
                        </span>
                    </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                    style={{
                        backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
                        color: textSecondary,
                    }}
                >
                    N/A
                </span>
            </div>
        );
    }

    return (
        <>
            {variant === "dropdown" ? (
                <button
                    id="app-lock-setting-btn"
                    onClick={handleOpenModal}
                    className="w-full flex items-center justify-between p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group cursor-pointer border border-transparent hover:border-[#3b82f6]/30"
                >
                    <div className="flex items-center gap-3 text-left">
                        <div
                            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors bg-black/20 group-hover:bg-[#3b82f6]/20"
                        >
                            <span
                                className="material-symbols-outlined text-[18px]"
                                style={{
                                    color: isEnabled ? accentColor : textSecondary,
                                    fontVariationSettings: "'FILL' 1",
                                }}
                            >
                                fingerprint
                            </span>
                        </div>
                        <span className="text-sm font-medium text-[#f0f0fd]">Biometric Lock</span>
                    </div>

                    {/* Status badge + chevron */}
                    <div className="flex items-center gap-2">
                        <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{
                                backgroundColor: isEnabled
                                    ? `${accentColor}20`
                                    : isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
                                color: isEnabled ? accentColor : textSecondary,
                                border: `1px solid ${isEnabled ? `${accentColor}30` : "transparent"}`,
                            }}
                        >
                            {isEnabled ? "Enabled" : "Disabled"}
                        </span>
                        <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">
                            chevron_right
                        </span>
                    </div>
                </button>
            ) : (
                /* ── Settings Row ── */
                <button
                    id="app-lock-setting-btn"
                    onClick={handleOpenModal}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div
                            className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
                            style={{ backgroundColor: iconBg }}
                        >
                            <span
                                className="material-symbols-outlined"
                                style={{
                                    color: isEnabled ? accentColor : textSecondary,
                                    fontVariationSettings: "'FILL' 1",
                                }}
                            >
                                fingerprint
                            </span>
                        </div>
                        <div className="text-left">
                            <span className="font-medium block" style={{ color: textPrimary }}>
                                Biometric Lock
                            </span>
                        </div>
                    </div>

                    {/* Status badge + chevron */}
                    <div className="flex items-center gap-2">
                        <span
                            className="text-xs px-2.5 py-1 rounded-full font-bold"
                            style={{
                                backgroundColor: isEnabled
                                    ? `${accentColor}20`
                                    : isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
                                color: isEnabled ? accentColor : textSecondary,
                                border: `1px solid ${isEnabled ? `${accentColor}40` : "transparent"}`,
                            }}
                        >
                            {isEnabled ? "Enabled" : "Disabled"}
                        </span>
                        <span className="material-symbols-outlined" style={{ color: textSecondary }}>
                            chevron_right
                        </span>
                    </div>
                </button>
            )}

            {/* ── Modal ── */}
            {modalOpen &&
                createPortal(
                    <div
                        data-theme={isLight ? "light" : "dark"}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                        onClick={() => setModalOpen(false)}
                        style={{
                            backgroundColor: isLight ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.6)",
                            backdropFilter: "blur(16px) saturate(1.5)",
                            WebkitBackdropFilter: "blur(16px) saturate(1.5)",
                        }}
                    >
                        <div
                            className="w-full max-w-sm rounded-[32px] animate-modal-in shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: modalBg,
                                border: `1px solid ${modalBorder}`,
                                backdropFilter: "blur(80px) saturate(2.5)",
                                WebkitBackdropFilter: "blur(80px) saturate(2.5)",
                                boxShadow: isLight
                                    ? "0 32px 64px rgba(0,0,0,0.08), inset 0 0 32px rgba(255,255,255,0.5)"
                                    : "0 32px 64px rgba(0,0,0,0.6), inset 0 0 32px rgba(255,255,255,0.03)",
                            }}
                        >
                            {/* ── STEP: Options (main screen) ── */}
                            {(setupStep === "options" || setupStep === "error") && (
                                <div className="p-8 space-y-6">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}30` }}
                                            >
                                                <span
                                                    className="material-symbols-outlined"
                                                    style={{ color: accentColor, fontVariationSettings: "'FILL' 1" }}
                                                >
                                                    fingerprint
                                                </span>
                                            </div>
                                            <div>
                                                <h3
                                                    className="font-extrabold text-lg tracking-tight"
                                                    style={{ fontFamily: "'Manrope', sans-serif", color: textPrimary }}
                                                >
                                                    Biometric Lock
                                                </h3>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setModalOpen(false)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer"
                                            style={{
                                                background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
                                                border: `1px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"}`,
                                                color: textSecondary,
                                            }}
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>

                                    {/* Error banner */}
                                    {setupStep === "error" && errorMsg && (
                                        <div
                                            className="p-3 rounded-2xl text-sm"
                                            style={{
                                                background: "rgba(239,68,68,0.1)",
                                                border: "1px solid rgba(239,68,68,0.25)",
                                                color: "#ff9dac",
                                            }}
                                        >
                                            {errorMsg}
                                        </div>
                                    )}

                                    {/* Lock timing options */}
                                    <div className="space-y-2">
                                        <p
                                            className="text-xs font-bold uppercase tracking-widest mb-3"
                                            style={{ color: textSecondary }}
                                        >
                                            Lock After
                                        </p>
                                        {TIMEOUT_OPTIONS.map((opt) => {
                                            const isSelected = selectedTimeout === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    id={`lock-timeout-${opt.value}`}
                                                    onClick={() => handleUpdateTimeout(opt.value)}
                                                    className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all cursor-pointer"
                                                    style={{
                                                        background: isSelected
                                                            ? `${accentColor}18`
                                                            : isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
                                                        border: `1.5px solid ${isSelected ? `${accentColor}50` : "transparent"}`,
                                                    }}
                                                >
                                                    <div
                                                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                                        style={{
                                                            border: `2px solid ${isSelected ? accentColor : textSecondary}`,
                                                            background: isSelected ? accentColor : "transparent",
                                                        }}
                                                    >
                                                        {isSelected && (
                                                            <div
                                                                style={{
                                                                    width: 8, height: 8,
                                                                    borderRadius: "50%",
                                                                    background: "#fff",
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                    <span
                                                        className="font-medium text-sm"
                                                        style={{ color: isSelected ? textPrimary : textSecondary }}
                                                    >
                                                        {opt.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="space-y-3 pt-1">
                                        {!isEnabled ? (
                                            <button
                                                id="enable-app-lock-btn"
                                                onClick={handleEnable}
                                                disabled={isLoading}
                                                className="w-full py-4 rounded-2xl font-bold text-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                                style={{
                                                    background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}18)`,
                                                    border: `1px solid ${accentColor}50`,
                                                    color: accentColor,
                                                    boxShadow: `0 4px 20px ${accentColor}20`,
                                                    fontFamily: "'Manrope', sans-serif",
                                                }}
                                            >
                                                Enable Biometric Lock
                                            </button>
                                        ) : (
                                                <button
                                                    id="disable-app-lock-btn"
                                                    onClick={handleDisable}
                                                    className="w-full py-3 rounded-2xl font-bold text-sm transition-all cursor-pointer active:scale-95"
                                                    style={{
                                                        background: "rgba(239,68,68,0.08)",
                                                        border: "1px solid rgba(239,68,68,0.2)",
                                                        color: "#ef4444",
                                                        fontFamily: "'Manrope', sans-serif",
                                                    }}
                                                >
                                                    Disable Biometric Lock
                                                </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── STEP: Registering ── */}
                            {setupStep === "registering" && (
                                <div className="p-8 flex flex-col items-center gap-5 text-center">
                                    <div
                                        style={{
                                            width: 72, height: 72, borderRadius: "50%",
                                            background: `${accentColor}20`,
                                            border: `1.5px solid ${accentColor}40`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            animation: "pulse-ring 1.4s ease-in-out infinite",
                                            boxShadow: `0 0 32px ${accentColor}30`,
                                        }}
                                    >
                                        <span
                                            className="material-symbols-outlined"
                                            style={{
                                                fontSize: 36, color: accentColor,
                                                fontVariationSettings: "'FILL' 1",
                                            }}
                                        >
                                            fingerprint
                                        </span>
                                    </div>
                                    <h3
                                        className="font-extrabold text-xl"
                                        style={{ color: textPrimary, fontFamily: "'Manrope', sans-serif" }}
                                    >
                                        Setting Up...
                                    </h3>
                                    <p style={{ color: textSecondary, fontSize: 14, lineHeight: 1.5 }}>
                                        Register your biometric
                                    </p>
                                </div>
                            )}

                            {/* ── STEP: Success ── */}
                            {setupStep === "success" && (
                                <div className="p-8 flex flex-col items-center gap-5 text-center">
                                    <div
                                        style={{
                                            width: 72, height: 72, borderRadius: "50%",
                                            background: "rgba(34,197,94,0.15)",
                                            border: "1.5px solid rgba(34,197,94,0.4)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            boxShadow: "0 0 32px rgba(34,197,94,0.2)",
                                        }}
                                    >
                                        <span
                                            className="material-symbols-outlined"
                                            style={{
                                                fontSize: 40, color: "#22c55e",
                                                fontVariationSettings: "'FILL' 1",
                                            }}
                                        >
                                            check_circle
                                        </span>
                                    </div>
                                    <h3
                                        className="font-extrabold text-xl"
                                        style={{ color: textPrimary, fontFamily: "'Manrope', sans-serif" }}
                                    >
                                        Biometric Lock Enabled!
                                    </h3>
                                    <p style={{ color: textSecondary, fontSize: 14, lineHeight: 1.5 }}>
                                        Your app will lock{" "}
                                        <strong style={{ color: textPrimary }}>
                                            {TIMEOUT_OPTIONS.find((o) => o.value === selectedTimeout)?.label?.toLowerCase()}
                                        </strong>{" "}
                                        when you leave.
                                    </p>
                                    <button
                                        onClick={() => setModalOpen(false)}
                                        className="w-full py-4 rounded-2xl font-bold text-sm cursor-pointer active:scale-95"
                                        style={{
                                            background: "rgba(34,197,94,0.12)",
                                            border: "1px solid rgba(34,197,94,0.3)",
                                            color: "#22c55e",
                                            fontFamily: "'Manrope', sans-serif",
                                        }}
                                    >
                                        Done
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
                )}

            <style>{`
                @keyframes pulse-ring {
                    0%, 100% { box-shadow: 0 0 32px ${accentColor}30; }
                    50% { box-shadow: 0 0 48px ${accentColor}50; }
                }
            `}</style>
        </>
    );
}

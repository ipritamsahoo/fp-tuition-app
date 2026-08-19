import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function PwaUpdateBanner({ show, mode = "update", currentVersion, newVersion, onUpdate, onClose }) {
    const [isUpdating, setIsUpdating] = useState(false);

    const [currentTheme, setCurrentTheme] = useState(() => {
        try {
            return document.documentElement.getAttribute("data-theme") ||
                (document.documentElement.classList.contains("dark") ? "dark" : "light") ||
                "light";
        } catch {
            return "light";
        }
    });

    useEffect(() => {
        const updateTheme = () => {
            const t = document.documentElement.getAttribute("data-theme") ||
                (document.documentElement.classList.contains("dark") ? "dark" : "light") ||
                "light";
            setCurrentTheme(t);
        };
        updateTheme();
        window.addEventListener("fp-student-theme-change", updateTheme);
        window.addEventListener("fp-teacher-theme-change", updateTheme);
        window.addEventListener("fp-admin-theme-change", updateTheme);
        return () => {
            window.removeEventListener("fp-student-theme-change", updateTheme);
            window.removeEventListener("fp-teacher-theme-change", updateTheme);
            window.removeEventListener("fp-admin-theme-change", updateTheme);
        };
    }, [show]);

    // Lock body scrolling when update modal is open
    useEffect(() => {
        if (show) {
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
    }, [show]);

    if (!show) return null;

    const handleUpdate = () => {
        setIsUpdating(true);
        if (onUpdate) {
            onUpdate();
        }
    };

    const isUpdateMode = mode === "update";
    const isLight = currentTheme === "light";

    return createPortal(
        <div
            data-theme={currentTheme}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn"
            onClick={onClose}
                    style={{
                        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.55)',
                        backdropFilter: 'blur(16px) saturate(1.5)',
                        WebkitBackdropFilter: 'blur(16px) saturate(1.5)'
                    }}
                >
                    <div 
                        className="w-full max-w-[360px] sm:max-w-[400px] rounded-[32px] p-6 sm:p-7 relative overflow-hidden shadow-2xl border transition-all animate-modal-in flex flex-col items-center text-center"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: isLight
                                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(245, 248, 255, 0.82) 100%)'
                                : 'linear-gradient(135deg, rgba(30, 35, 48, 0.82) 0%, rgba(15, 20, 32, 0.72) 100%)',
                            borderColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.14)',
                            boxShadow: isLight
                                ? '0 24px 48px -12px rgba(0, 0, 0, 0.08), inset 0 0 32px rgba(255, 255, 255, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.9)'
                                : '0 32px 64px rgba(0, 0, 0, 0.6), inset 0 0 32px rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(60px) saturate(2.2)',
                            WebkitBackdropFilter: 'blur(60px) saturate(2.2)',
                            color: isLight ? '#1f2937' : '#f3f4f6',
                            transform: "translateZ(0)",
                            isolation: "isolate"
                        }}
                    >
                {/* Decorative Ambient Glass Glow Spheres */}
                <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />



                {/* Icon Visual */}
                <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-3.5 shadow-md relative z-10"
                    style={{
                        backgroundColor: isLight ? 'rgba(13, 148, 136, 0.12)' : 'rgba(59, 130, 246, 0.15)',
                        border: `1px solid ${isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(59, 130, 246, 0.3)'}`,
                        color: isLight ? '#0d9488' : '#3b82f6'
                    }}
                >
                    <span 
                        className="material-symbols-outlined text-3xl"
                        style={{ fontVariationSettings: "'wght' 700" }}
                    >
                        {isUpdateMode ? 'system_update' : 'check'}
                    </span>
                </div>

                {/* Title */}
                <h3 
                    className="text-xl sm:text-2xl font-black tracking-tight mb-2 relative z-10" 
                    style={{ fontFamily: "'Manrope', sans-serif", color: isLight ? '#1f2937' : '#ffffff' }}
                >
                    {isUpdateMode ? "New Version Available" : "You're Up to Date"}
                </h3>

                {/* Version Indicators */}
                {isUpdateMode ? (
                    currentVersion && (
                        <div 
                            className="flex items-center gap-1.5 sm:gap-2 justify-center text-xs font-bold px-3 py-1 rounded-full mb-3 tracking-wide relative z-10"
                            style={{
                                backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(59, 130, 246, 0.1)',
                                border: `1px solid ${isLight ? 'rgba(13, 148, 136, 0.2)' : 'rgba(59, 130, 246, 0.25)'}`,
                                color: isLight ? '#475569' : '#cbd5e1'
                            }}
                        >
                            <span>v{currentVersion}</span>
                            <span className="material-symbols-outlined text-xs" style={{ color: isLight ? '#0d9488' : '#60a5fa' }}>arrow_right_alt</span>
                            <span className="font-black" style={{ color: isLight ? '#0d9488' : '#3b82f6' }}>v{newVersion || "New"}</span>
                        </div>
                    )
                ) : (
                    currentVersion && (
                        <p 
                            className="text-xs font-bold mb-3 tracking-wide relative z-10"
                            style={{ color: isLight ? '#0d9488' : '#3b82f6' }}
                        >
                            Version {currentVersion}
                        </p>
                    )
                )}

                {/* Description */}
                <p 
                    className="text-xs sm:text-sm leading-relaxed mb-6 font-medium relative z-10"
                    style={{ color: isLight ? '#4b5563' : '#9ca3af' }}
                >
                    {isUpdateMode
                        ? "Update now to experience the latest features, enhancements, and bug fixes."
                        : "You are already using the latest and newest version of FP Finance."}
                </p>

                {/* Action Buttons */}
                <div className="w-full relative z-10">
                    {isUpdateMode ? (
                        <button
                            onClick={handleUpdate}
                            disabled={isUpdating}
                            className={`w-full py-3.5 px-6 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95 border shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
                                isLight
                                    ? 'bg-[#0d9488]/10 border-[#0d9488]/30 text-[#0d9488] hover:bg-[#0d9488]/20'
                                    : 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/20'
                            }`}
                        >
                            {isUpdating ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                    <span>Updating...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-base">autorenew</span>
                                    <span>Update Now</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={onClose}
                            className={`w-full py-3.5 px-6 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95 border shadow-lg ${
                                isLight
                                    ? 'bg-[#0d9488]/10 border-[#0d9488]/30 text-[#0d9488] hover:bg-[#0d9488]/20'
                                    : 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/20'
                            }`}
                        >
                            Awesome
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

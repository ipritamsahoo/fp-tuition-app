import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function PwaUpdateBanner({ show, mode = "update", currentVersion, newVersion, onUpdate, onClose }) {
    const [isUpdating, setIsUpdating] = useState(false);
    const location = useLocation();
    const { user } = useAuth();

    const [studentTheme, setStudentTheme] = useState(() => {
        try {
            return localStorage.getItem("fp_student_theme_v2") || "light";
        } catch {
            return "light";
        }
    });

    useEffect(() => {
        const handleThemeChange = (e) => {
            setStudentTheme(e.detail);
        };
        window.addEventListener("fp-student-theme-change", handleThemeChange);
        return () => window.removeEventListener("fp-student-theme-change", handleThemeChange);
    }, []);

    if (!show) return null;

    const handleUpdate = () => {
        setIsUpdating(true);
        if (onUpdate) {
            onUpdate();
        }
    };

    const isUpdateMode = mode === "update";

    // Determine if we are inside the student section or a student-specific page
    const isStudentSection = location.pathname.startsWith("/student") ||
        (user?.role === "student" && ["/notifications", "/about", "/feedback"].includes(location.pathname));

    const resolvedTheme = isStudentSection ? studentTheme : "dark";

    return (
        <div data-theme={resolvedTheme} className="fixed inset-0 z-[10000] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in pwa-overlay">
            <div className="pwa-modal-card w-full max-w-xs sm:max-w-sm glass-card-student rounded-3xl sm:rounded-[32px] p-6 sm:p-8 flex flex-col items-center text-center animate-fade-in-scale shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 relative overflow-hidden">
                {/* Decorative glow elements inside popup */}
                <div className="absolute -top-20 -right-20 w-44 h-44 bg-[#3b82f6]/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-[#8b5cf6]/5 rounded-full blur-3xl pointer-events-none" />

                {/* Close/Cross Button */}
                <button
                    onClick={onClose}
                    disabled={isUpdating}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-400 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed close-btn"
                    aria-label="Close modal"
                >
                    <span className="material-symbols-outlined text-sm sm:text-base">close</span>
                </button>

                {/* Content */}
                <h3 className="text-[#f0f0fd] text-xl sm:text-2xl font-extrabold mb-2 sm:mb-3 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {isUpdateMode ? "New Version Available" : "You're Up to Date"}
                </h3>

                {/* Version Indicators */}
                {isUpdateMode ? (
                    currentVersion && (
                        <div className="version-tag flex items-center gap-1.5 sm:gap-2 justify-center text-[10px] sm:text-xs font-bold bg-white/5 border border-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl mb-3 sm:mb-4 tracking-wide text-[#aaaab7]">
                            <span>v{currentVersion}</span>
                            <span className="material-symbols-outlined text-[12px] sm:text-[14px]">arrow_right_alt</span>
                            <span className="text-[#3b82f6] new-version-text">v{newVersion || "New"}</span>
                        </div>
                    )
                ) : (
                    currentVersion && (
                        <div className="version-tag version-tag-success flex items-center gap-1 sm:gap-1.5 justify-center text-[10px] sm:text-xs font-bold bg-white/5 border border-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl mb-3 sm:mb-4 tracking-wide text-[#3b82f6]">
                            <span className="material-symbols-outlined text-[12px] sm:text-[14px]">verified</span>
                            <span>Version {currentVersion}</span>
                        </div>
                    )
                )}

                <p className="text-[#aaaab7] text-xs sm:text-sm leading-relaxed mb-5 sm:mb-6">
                    {isUpdateMode
                        ? "Update now to experience the latest features and fixes."
                        : "You are already using the latest version."}
                </p>

                {/* Action Button */}
                {isUpdateMode ? (
                    <button
                        onClick={handleUpdate}
                        disabled={isUpdating}
                        className="w-full py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-xl sm:rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] font-bold active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer text-sm sm:text-base update-btn"
                    >
                        {isUpdating ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Updating...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[18px]">autorenew</span>
                                Update Now
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-xl sm:rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] font-bold active:scale-[0.98] cursor-pointer text-sm sm:text-base awesome-btn"
                    >
                        Awesome
                    </button>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .pwa-overlay {
                    background-color: rgba(9, 15, 30, 0.7) !important;
                }
                [data-theme="light"].pwa-overlay {
                    background-color: rgba(226, 232, 240, 0.6) !important;
                }
                .pwa-modal-card {
                    background-color: rgba(15, 23, 42, 0.92) !important;
                }
                .pwa-modal-card:hover {
                    background: rgba(15, 23, 42, 0.92) !important;
                    border-color: rgba(255, 255, 255, 0.1) !important;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6) !important;
                    transform: none !important;
                    transition: none !important;
                }
                [data-theme="light"] .pwa-modal-card {
                    background-color: rgba(255, 255, 255, 0.98) !important;
                    border-color: rgba(0, 0, 0, 0.08) !important;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15) !important;
                }
                [data-theme="light"] .pwa-modal-card:hover {
                    background: rgba(255, 255, 255, 0.98) !important;
                    border-color: rgba(0, 0, 0, 0.08) !important;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15) !important;
                    transform: none !important;
                    transition: none !important;
                }
                [data-theme="light"] .pwa-modal-card h3 {
                    color: #0f172a !important;
                }
                [data-theme="light"] .pwa-modal-card p {
                    color: #475569 !important;
                }
                [data-theme="light"] .pwa-modal-card .version-tag {
                    background-color: rgba(0, 0, 0, 0.04) !important;
                    border-color: rgba(0, 0, 0, 0.06) !important;
                    color: #475569 !important;
                }
                [data-theme="light"] .pwa-modal-card .version-tag-success {
                    background-color: rgba(13, 148, 136, 0.06) !important;
                    border-color: rgba(13, 148, 136, 0.1) !important;
                    color: #0d9488 !important;
                }
                [data-theme="light"] .pwa-modal-card .close-btn {
                    background-color: rgba(0, 0, 0, 0.04) !important;
                    border-color: rgba(0, 0, 0, 0.06) !important;
                    color: #64748b !important;
                }

                [data-theme="light"] .pwa-modal-card .success-icon-container {
                    background: linear-gradient(to top right, rgba(13, 148, 136, 0.15), rgba(59, 130, 246, 0.05)) !important;
                    ring-color: rgba(13, 148, 136, 0.1) !important;
                    box-shadow: 0 0 30px rgba(13, 148, 136, 0.1) !important;
                }
                [data-theme="light"] .pwa-modal-card .success-icon-text {
                    color: #0d9488 !important;
                }
                [data-theme="light"] .pwa-modal-card .update-icon-container {
                    background: linear-gradient(to top right, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.05)) !important;
                    ring-color: rgba(59, 130, 246, 0.1) !important;
                    box-shadow: 0 0 30px rgba(59, 130, 246, 0.1) !important;
                }
                [data-theme="light"] .pwa-modal-card .update-icon-text {
                    color: #2563eb !important;
                }
                [data-theme="light"] .pwa-modal-card .awesome-btn {
                    background-color: rgba(13, 148, 136, 0.08) !important;
                    border-color: rgba(13, 148, 136, 0.2) !important;
                    color: #0d9488 !important;
                }

                [data-theme="light"] .pwa-modal-card .new-version-text {
                    color: #0d9488 !important;
                }
                [data-theme="light"] .pwa-modal-card .update-btn {
                    background-color: rgba(13, 148, 136, 0.08) !important;
                    border-color: rgba(13, 148, 136, 0.2) !important;
                    color: #0d9488 !important;
                }

            ` }} />
        </div>
    );
}

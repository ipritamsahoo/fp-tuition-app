import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AboutContent from "@/components/AboutContent";
import StudentFeedbackModal from "@/components/StudentFeedbackModal";

export default function AboutPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem("fp_student_theme_v2") || "dark";
        } catch {
            return "dark";
        }
    });
    const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

    useEffect(() => {
        if (user) {
            if (user.role === "student") {
                try {
                    const saved = localStorage.getItem("fp_student_theme_v2") || "dark";
                    setTheme(saved);
                } catch {
                    setTheme("dark");
                }
            } else {
                setTheme("dark");
            }
        }
    }, [user]);

    const isLight = theme === "light";
    const accentColor = isLight ? "#0d9488" : "#3b82f6";

    return (
        <div
            data-theme={theme}
            className="min-h-[100dvh] flex flex-col md:items-center md:justify-center"
            style={{ backgroundColor: "var(--st-surface)" }}
        >
            {/* ── Ambient background blobs ── */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute -top-[10%] -left-[10%] w-[65%] h-[65%] blur-[100px]"
                    style={{
                        background: isLight
                            ? "radial-gradient(circle, rgba(99,165,255,0.55) 0%, rgba(147,197,253,0.20) 50%, transparent 70%)"
                            : "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
                    }}
                />
                <div
                    className="absolute -bottom-[10%] -right-[10%] w-[70%] h-[70%] blur-[100px]"
                    style={{
                        background: isLight
                            ? "radial-gradient(circle, rgba(167,139,250,0.45) 0%, rgba(196,181,253,0.15) 50%, transparent 70%)"
                            : "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",
                    }}
                />
                {isLight && (
                    <>
                        <div
                            className="absolute top-[25%] right-[5%] w-[55%] h-[55%] blur-[120px]"
                            style={{ background: "radial-gradient(circle, rgba(251,146,173,0.30) 0%, rgba(253,164,186,0.10) 50%, transparent 70%)" }}
                        />
                        <div
                            className="absolute top-[50%] -left-[5%] w-[45%] h-[45%] blur-[110px]"
                            style={{ background: "radial-gradient(circle, rgba(103,232,249,0.25) 0%, transparent 70%)" }}
                        />
                    </>
                )}
            </div>

            {/* ══ MOBILE layout (full page with sticky header) ══ */}
            <div className="md:hidden relative z-10 flex flex-col flex-1 w-full">
                {/* Header */}
                <header
                    className="sticky top-0 z-40 border-b"
                    style={{
                        backgroundColor: isLight ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 17, 23, 0.25)",
                        borderColor: isLight ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.08)",
                        backdropFilter: "blur(48px) saturate(2.0)",
                        WebkitBackdropFilter: "blur(48px) saturate(2.0)",
                        transform: "translateZ(0)",
                        isolation: "isolate",
                    }}
                >
                    <div className="flex items-center px-4 h-16 gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 flex items-center justify-center rounded-2xl transition-all active:scale-90 cursor-pointer"
                            style={{ 
                                backgroundColor: isLight ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.05)",
                                border: `1px solid ${isLight ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.1)"}`,
                                color: "var(--st-text-primary)" 
                            }}
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h1
                            className="font-extrabold text-xl tracking-tight"
                            style={{ fontFamily: "'Manrope', sans-serif", color: "var(--st-text-primary)" }}
                        >
                            About
                        </h1>
                    </div>
                </header>
                {/* Content */}
                <div className="flex-1 w-full max-w-lg mx-auto px-6 py-10">
                    <AboutContent 
                        isLight={isLight} 
                        accentColor={accentColor} 
                        onFeedbackClick={() => {
                            if (window.innerWidth < 768) {
                                navigate("/feedback");
                            } else {
                                setFeedbackModalOpen(true);
                            }
                        }} 
                    />
                </div>
            </div>

            {/* ══ DESKTOP layout (centered card, same as modal) ══ */}
            <div
                className="hidden md:flex flex-col relative z-10 w-full max-w-sm rounded-[32px] p-8 shadow-2xl gap-5 animate-modal-in"
                style={{
                    backgroundColor: isLight ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${isLight ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.05)"}`,
                    backdropFilter: "blur(64px) saturate(2.2)",
                    WebkitBackdropFilter: "blur(64px) saturate(2.2)",
                    transform: "translateZ(0)",
                    isolation: "isolate",
                }}
            >
                {/* Header row */}
                <div className="flex justify-between items-center">
                    <h1
                        className="font-extrabold text-xl tracking-tight"
                        style={{ fontFamily: "'Manrope', sans-serif", color: "var(--st-text-primary)" }}
                    >
                        About
                    </h1>
                    <button
                        onClick={() => navigate(-1)}
                        className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
                        style={{ backgroundColor: "var(--st-icon-bg)", color: "var(--st-text-muted)" }}
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
                <AboutContent 
                    isLight={isLight} 
                    accentColor={accentColor} 
                    onFeedbackClick={() => {
                        if (window.innerWidth < 768) {
                            navigate("/feedback");
                        } else {
                            setFeedbackModalOpen(true);
                        }
                    }} 
                />
            </div>

            {/* ── Feedback Modal ── */}
            <StudentFeedbackModal
                isOpen={feedbackModalOpen}
                onClose={() => setFeedbackModalOpen(false)}
                isLight={isLight}
                accentColor={accentColor}
                theme={theme}
            />
        </div>
    );
}

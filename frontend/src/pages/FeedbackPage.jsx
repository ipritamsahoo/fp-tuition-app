import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function FeedbackPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem("fp_student_theme_v2") || "dark";
        } catch {
            return "dark";
        }
    });

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

    // ── Feedback form state ──
    const [fbRating, setFbRating]                 = useState(0);
    const [fbHovered, setFbHovered]               = useState(0);
    const [fbFeatures, setFbFeatures]             = useState([]);
    const [fbImprovements, setFbImprovements]     = useState("");
    const [fbHasIssues, setFbHasIssues]           = useState("");
    const [fbIssueDetails, setFbIssueDetails]     = useState("");
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
    const [feedbackSubmitted, setFeedbackSubmitted]   = useState(false);

    const FEATURE_OPTIONS = [
        "Fee Tracking",
        "Notifications",
        "UI Design",
        "Badge Earning",
        "Leaderboard",
    ];

    const toggleFeature = (f) =>
        setFbFeatures((prev) =>
            prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
        );

    const handleFeedbackSubmit = async (e) => {
        e.preventDefault();
        if (fbRating === 0 || !fbHasIssues || fbFeatures.length === 0) return;
        setFeedbackSubmitting(true);
        try {
            await api.post("/api/student/feedback", {
                rating:        fbRating,
                features:      fbFeatures,
                improvements:  fbImprovements,
                has_issues:    fbHasIssues,
                issue_details: fbIssueDetails,
            });
            setFeedbackSubmitted(true);
        } catch (err) {
            console.error("Feedback submission error:", err);
        } finally {
            setFeedbackSubmitting(false);
        }
    };

    const formContent = feedbackSubmitted ? (
        <div className="flex flex-col items-center gap-4 py-12 px-6 text-center w-full animate-fade-in">
            <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--st-accent-bg)', border: `1px solid ${isLight ? 'rgba(13,148,136,0.2)' : 'rgba(74,248,227,0.2)'}` }}
            >
                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--st-accent)', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <div>
                <p className="font-extrabold text-2xl" style={{ color: 'var(--st-text-primary)', fontFamily: "'Manrope', sans-serif" }}>Thank you! 🎉</p>
                <p className="text-sm mt-2" style={{ color: 'var(--st-text-secondary)' }}>Your feedback has been received.</p>
            </div>
            <button
                onClick={() => navigate(-1)}
                className="mt-2 px-8 py-3 rounded-full text-sm font-bold cursor-pointer active:scale-95 transition-all"
                style={{ backgroundColor: 'var(--st-accent-bg)', color: 'var(--st-accent)', border: `1px solid ${isLight ? 'rgba(13,148,136,0.2)' : 'rgba(74,248,227,0.2)'}` }}
            >
                Back to About
            </button>
        </div>
    ) : (
        <form onSubmit={handleFeedbackSubmit} className="flex-1 w-full flex flex-col pt-4">
            <div className="flex flex-col gap-6 px-6 pb-6">
                <div>
                    <h3 className="font-extrabold text-xl tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                        Give Feedback
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--st-text-muted)' }}>Your response goes directly to our team</p>
                </div>

                {/* ── Q1: Rating ── */}
                <div>
                    <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--st-text-primary)' }}>
                        How would you rate our app? <span style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>*</span>
                    </label>
                    <div className="flex gap-2 justify-between">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setFbRating(n)}
                                onMouseEnter={() => setFbHovered(n)}
                                onMouseLeave={() => setFbHovered(0)}
                                className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer active:scale-95"
                                style={{
                                    backgroundColor: n <= (fbHovered || fbRating)
                                        ? (isLight ? 'rgba(13,148,136,0.12)' : 'rgba(59,130,246,0.15)')
                                        : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'),
                                    border: `1.5px solid ${n <= (fbHovered || fbRating)
                                        ? (isLight ? 'rgba(13,148,136,0.35)' : 'rgba(59,130,246,0.4)')
                                        : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)')
                                    }`,
                                }}
                            >
                                <span className="text-sm font-bold" style={{ color: n <= (fbHovered || fbRating) ? accentColor : 'var(--st-text-muted)' }}>{n}</span>
                            </button>
                        ))}
                    </div>
                    {fbRating > 0 && (
                        <p className="text-xs mt-1.5 text-center" style={{ color: accentColor }}>
                            {["😞 Poor", "😐 Fair", "🙂 Good", "😊 Great", "🤩 Excellent!"][fbRating - 1]}
                        </p>
                    )}
                </div>

                {/* ── Q2: Features ── */}
                <div>
                    <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--st-text-primary)' }}>
                        Which feature do you like the most? <span style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>*</span>
                    </label>
                    <div className="flex flex-col gap-2">
                        {FEATURE_OPTIONS.map((feature) => {
                            const checked = fbFeatures.includes(feature);
                            return (
                                <button
                                    key={feature}
                                    type="button"
                                    onClick={() => toggleFeature(feature)}
                                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer active:scale-[0.98] text-left"
                                    style={{
                                        backgroundColor: checked
                                            ? (isLight ? 'rgba(13,148,136,0.08)' : 'rgba(59,130,246,0.12)')
                                            : (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'),
                                        border: `1.5px solid ${checked
                                            ? (isLight ? 'rgba(13,148,136,0.4)' : 'rgba(59,130,246,0.4)')
                                            : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)')
                                        }`,
                                    }}
                                >
                                    <div
                                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all"
                                        style={{
                                            backgroundColor: checked ? accentColor : 'transparent',
                                            border: `2px solid ${checked ? accentColor : (isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)')}`,
                                        }}
                                    >
                                        {checked && <span className="material-symbols-outlined text-white text-[13px]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>}
                                    </div>
                                    <span style={{ color: checked ? 'var(--st-text-primary)' : 'var(--st-text-secondary)', fontWeight: checked ? 600 : 400 }}>{feature}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Q3: Improvements ── */}
                <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--st-text-primary)' }}>
                        What improvements/feature would you like to see in the app? <span style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>*</span>
                    </label>
                    <input
                        type="text"
                        value={fbImprovements}
                        onChange={(e) => setFbImprovements(e.target.value)}
                        placeholder="Your answer"
                        className="w-full px-4 py-3 rounded-2xl text-sm focus:outline-none transition-all placeholder:text-gray-400"
                        style={{
                            backgroundColor: 'var(--st-icon-bg)',
                            border: `1px solid var(--st-input-border)`,
                            color: 'var(--st-text-primary)',
                        }}
                    />
                </div>

                {/* ── Q4: Did you face issues? ── */}
                <div>
                    <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--st-text-primary)' }}>
                        Did you face any issues while using the app? <span style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>*</span>
                    </label>
                    <div className="flex gap-3">
                        {["yes", "no"].map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => { setFbHasIssues(opt); if (opt === "no") setFbIssueDetails(""); }}
                                className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer active:scale-95"
                                style={{
                                    backgroundColor: fbHasIssues === opt
                                        ? (opt === "yes"
                                            ? (isLight ? 'rgba(239,68,68,0.08)' : 'rgba(255,110,132,0.12)')
                                            : (isLight ? 'rgba(13,148,136,0.08)' : 'rgba(59,130,246,0.12)'))
                                        : (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'),
                                    border: `1.5px solid ${fbHasIssues === opt
                                        ? (opt === "yes"
                                            ? (isLight ? 'rgba(239,68,68,0.35)' : 'rgba(255,110,132,0.35)')
                                            : (isLight ? 'rgba(13,148,136,0.35)' : 'rgba(59,130,246,0.35)'))
                                        : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)')
                                    }`,
                                }}
                            >
                                <div
                                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                                    style={{
                                        border: `2px solid ${fbHasIssues === opt
                                            ? (opt === "yes" ? (isLight ? '#ef4444' : '#ff6e84') : accentColor)
                                            : (isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)')}`,
                                    }}
                                >
                                    {fbHasIssues === opt && (
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opt === "yes" ? (isLight ? '#ef4444' : '#ff6e84') : accentColor }} />
                                    )}
                                </div>
                                <span style={{ color: 'var(--st-text-primary)', fontWeight: fbHasIssues === opt ? 600 : 400 }}>{opt === "yes" ? "Yes" : "No"}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Q5: Issue Details ── */}
                {fbHasIssues === "yes" && (
                    <div
                        className="rounded-2xl p-4 flex flex-col gap-3"
                        style={{
                            backgroundColor: isLight ? 'rgba(239,68,68,0.04)' : 'rgba(255,110,132,0.06)',
                            border: `1px solid ${isLight ? 'rgba(239,68,68,0.15)' : 'rgba(255,110,132,0.15)'}`,
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm" style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>report_problem</span>
                            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>Issue Details</span>
                        </div>
                        <label className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>
                            Please describe the issue <span style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>*</span>
                        </label>
                        <textarea
                            value={fbIssueDetails}
                            onChange={(e) => setFbIssueDetails(e.target.value)}
                            placeholder="Your answer"
                            rows={3}
                            required={fbHasIssues === "yes"}
                            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all placeholder:text-gray-400 resize-none"
                            style={{
                                backgroundColor: 'var(--st-icon-bg)',
                                border: `1px solid var(--st-input-border)`,
                                color: 'var(--st-text-primary)',
                            }}
                        />
                    </div>
                )}
                {/* ── Submit Button ── */}
                <div className="w-full pt-2 pb-4">
                    <button
                        type="submit"
                        disabled={feedbackSubmitting || fbRating === 0 || !fbHasIssues || fbFeatures.length === 0 || !fbImprovements.trim() || (fbHasIssues === "yes" && !fbIssueDetails.trim())}
                        className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 cursor-pointer active:scale-95 border shadow-lg ${
                            isLight
                                ? 'bg-[#0d9488]/10 border-[#0d9488]/30 text-[#0d9488] hover:bg-[#0d9488]/20'
                                : 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/20'
                        }`}
                    >
                        {feedbackSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                Sending...
                            </span>
                        ) : "Submit Feedback"}
                    </button>
                </div>
            </div>
        </form>
    );

    return (
        <div data-theme={theme} className="min-h-[100dvh] flex flex-col md:items-center md:justify-center" style={{ backgroundColor: "var(--st-surface)" }}>
            {/* Ambient Background blobs */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute -top-[10%] -left-[10%] w-[65%] h-[65%] blur-[100px]"
                    style={{ background: isLight ? "radial-gradient(circle, rgba(99,165,255,0.55) 0%, rgba(147,197,253,0.20) 50%, transparent 70%)" : "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)" }}
                />
                <div
                    className="absolute -bottom-[10%] -right-[10%] w-[70%] h-[70%] blur-[100px]"
                    style={{ background: isLight ? "radial-gradient(circle, rgba(167,139,250,0.45) 0%, rgba(196,181,253,0.15) 50%, transparent 70%)" : "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)" }}
                />
            </div>

            {/* Mobile layout */}
            <div className="md:hidden relative z-10 flex flex-col flex-1 w-full">
                <header
                    className="sticky top-0 z-40 border-b flex items-center px-4 h-16 gap-4 w-full"
                    style={{
                        backgroundColor: isLight ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 17, 23, 0.25)",
                        borderColor: isLight ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.08)",
                        backdropFilter: "blur(48px) saturate(2.0)",
                        WebkitBackdropFilter: "blur(48px) saturate(2.0)",
                        transform: "translateZ(0)",
                        isolation: "isolate",
                    }}
                >
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
                        Feedback
                    </h1>
                </header>
                <div className="flex-1 w-full max-w-lg mx-auto flex flex-col items-center">
                    {formContent}
                </div>
            </div>

            {/* Desktop layout */}
            <div
                className="hidden md:flex flex-col relative z-10 w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-modal-in"
                style={{
                    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.08)'}`,
                    backdropFilter: "blur(64px) saturate(2.2)",
                    WebkitBackdropFilter: "blur(64px) saturate(2.2)",
                    boxShadow: isLight
                        ? '0 24px 48px rgba(0,0,0,0.1), inset 0 0 20px rgba(255,255,255,0.5)'
                        : '0 24px 48px rgba(0,0,0,0.5), inset 0 0 20px rgba(255,255,255,0.03)',
                }}
            >
                <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--st-divider)' }}>
                    <h1 className="font-extrabold text-xl tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: "var(--st-text-primary)" }}>
                        Feedback
                    </h1>
                    <button
                        onClick={() => navigate(-1)}
                        className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
                        style={{ backgroundColor: "var(--st-icon-bg)", color: "var(--st-text-muted)" }}
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
                <div className="max-h-[600px] overflow-y-auto w-full flex flex-col items-center">
                    {formContent}
                </div>
            </div>
        </div>
    );
}

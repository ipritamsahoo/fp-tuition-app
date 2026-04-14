import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function StudentFeedbackModal({ isOpen, onClose, isLight, accentColor, theme }) {
    const { user } = useAuth();

    // ── Feedback form state ──
    const [fbRating, setFbRating]                 = useState(0);
    const [fbHovered, setFbHovered]               = useState(0);
    const [fbFeatures, setFbFeatures]             = useState([]);   // multi-select checkboxes
    const [fbImprovements, setFbImprovements]     = useState("");
    const [fbHasIssues, setFbHasIssues]           = useState("");   // "yes" | "no" | ""
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

    const handleClose = () => {
        onClose();
        setTimeout(() => {
            setFbRating(0); setFbHovered(0);
            setFbFeatures([]); setFbImprovements("");
            setFbHasIssues(""); setFbIssueDetails("");
            setFeedbackSubmitted(false); setFeedbackSubmitting(false);
        }, 300);
    };

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

    if (!isOpen) return null;

    return createPortal(
        <div
            data-theme={theme}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
            onClick={handleClose}
            style={{
                backgroundColor: isLight ? 'rgba(238,242,255,0.5)' : 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
            }}
        >
            <div
                className="w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] animate-modal-in shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxHeight: '92dvh',
                    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.08)'}`,
                    backdropFilter: 'blur(64px) saturate(2.2)',
                    WebkitBackdropFilter: 'blur(64px) saturate(2.2)',
                    boxShadow: isLight
                        ? '0 24px 48px rgba(0,0,0,0.1), inset 0 0 20px rgba(255,255,255,0.5)'
                        : '0 24px 48px rgba(0,0,0,0.5), inset 0 0 20px rgba(255,255,255,0.03)',
                    transform: "translateZ(0)", isolation: "isolate",
                }}
            >
                {/* ── Sticky Header ── */}
                <div
                    className="flex justify-between items-center px-6 pt-6 pb-4 shrink-0"
                    style={{ borderBottom: `1px solid var(--st-divider)` }}
                >
                    <div>
                        <h3 className="font-extrabold text-xl tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                            Give Feedback
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--st-text-muted)' }}>Your response goes directly to our team</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer shrink-0"
                        style={{
                            backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}`,
                            color: 'var(--st-text-muted)'
                        }}
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>

                {feedbackSubmitted ? (
                    /* ── Success State ── */
                    <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
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
                            onClick={handleClose}
                            className="mt-2 px-8 py-3 rounded-full text-sm font-bold cursor-pointer active:scale-95 transition-all"
                            style={{ backgroundColor: 'var(--st-accent-bg)', color: 'var(--st-accent)', border: `1px solid ${isLight ? 'rgba(13,148,136,0.2)' : 'rgba(74,248,227,0.2)'}` }}
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    /* ── Scrollable Form Body ── */
                    <form onSubmit={handleFeedbackSubmit} className="flex-1 overflow-y-auto overscroll-contain">
                        <div className="flex flex-col gap-6 p-6">

                            {/* ── Q1: Rating (1–5 linear scale) ── */}
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

                            {/* ── Q2: Feature liked most (Checkboxes) ── */}
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

                            {/* ── Q3: Improvements (Short text) ── */}
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

                            {/* ── Q4: Did you face issues? (Yes/No) ── */}
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

                            {/* ── Q5: Issue Details (conditional) ── */}
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
                            <div className="w-full pt-2 pb-2">
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
                )}
            </div>
        </div>,
        document.body
    );
}

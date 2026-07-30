import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import StudentLayout from "@/components/StudentLayout";
import AnimatedGreeting from "@/components/AnimatedGreeting";
import BadgeCelebrationOverlay from "@/components/BadgeCelebrationOverlay";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { setCache } from "@/lib/memoryCache";
import { StudentDashboardSkeleton } from "@/components/Skeletons";

function StudentDashboardContent() {
    const { user, refreshUser } = useAuth();
    const { theme } = useStudentTheme();
    const navigate = useNavigate();
    const isLight = theme === "light";

    const [notices, setNotices] = useState([]);
    const [showBadgeCelebration, setShowBadgeCelebration] = useState(() =>
        !!(user?.badgeAnimationPending && user?.currentBadge)
    );

    // Background fetch notices without blocking dashboard UI render
    const loadDashboardData = useCallback(async () => {
        try {
            const batchId = user?.batchId || user?.batch_id;
            if (batchId) {
                const noticeData = await api.get(`/api/notices/batch/${batchId}?limit=2`);
                setNotices(noticeData?.notices || noticeData || []);
            }
        } catch (err) {
            console.error("Dashboard notice load error:", err);
        }
    }, [user?.batchId, user?.batch_id]);

    useEffect(() => {
        if (user?.uid) {
            loadDashboardData();
        }
    }, [user?.uid, loadDashboardData]);

    useEffect(() => {
        if (user?.badgeAnimationPending && user?.currentBadge) {
            setShowBadgeCelebration(true);
        }
    }, [user?.badgeAnimationPending, user?.currentBadge]);

    return (
        <div className="space-y-6 pb-6">
            {/* Badge Celebration Overlay */}
            {showBadgeCelebration && user?.currentBadge && (
                <BadgeCelebrationOverlay
                    badgeTier={user.currentBadge}
                    user={user}
                    onComplete={() => {
                        setShowBadgeCelebration(false);
                        refreshUser();
                    }}
                />
            )}

            {/* ── Top Header Bar (Greetings & Subtitle) ── */}
            <section className="flex items-center justify-between gap-4 pt-2">
                <div>
                    <h1
                        className="text-2xl md:text-3xl font-extrabold tracking-tight"
                        style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}
                    >
                        <AnimatedGreeting name={user?.name || "Student"} />
                    </h1>
                    <p className="text-sm md:text-base font-semibold mt-1.5" style={{ color: isLight ? '#64748b' : 'var(--st-text-secondary)' }}>
                        Level up your skills with <span className="font-bold text-[#6366f1]">Future Point</span>
                    </p>
                </div>
            </section>

            {/* ── Hero Banner Card ("Learn Smarter") ── */}
            <section
                className="relative rounded-[32px] p-6 sm:p-8 overflow-hidden transition-all duration-300 shadow-[0_12px_32px_-8px_rgba(99,102,241,0.12)] border"
                style={{
                    background: isLight
                        ? 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 50%, #ede9fe 100%)'
                        : 'linear-gradient(135deg, rgba(30,27,75,0.8) 0%, rgba(49,46,129,0.5) 50%, rgba(12,14,23,0.9) 100%)',
                    borderColor: isLight ? 'rgba(199,210,254,0.6)' : 'rgba(99,102,241,0.2)',
                }}
            >
                {/* 3D Sphere / Glass Ring Art Accent */}
                <div className="absolute top-1/2 -right-10 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 pointer-events-none opacity-80 sm:opacity-100">
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#818cf8]/30 to-[#c084fc]/30 blur-2xl animate-pulse" />
                    <div className="absolute inset-4 rounded-full border-[8px] border-white/20 backdrop-blur-md transform rotate-45" />
                </div>

                <div className="relative z-10 max-w-sm space-y-4">
                    <div className="space-y-1">
                        <h2 className="text-xl sm:text-2xl font-extrabold leading-tight tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: isLight ? '#1e1b4b' : '#ffffff' }}>
                            Learn Smarter with Expert Guidance
                        </h2>
                        <p className="text-xs sm:text-sm font-medium opacity-80" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>
                            Access study notes, notices and track your fees payments.
                        </p>
                    </div>

                    <button
                        onClick={() => navigate("/student/notices")}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-xs sm:text-sm text-white shadow-lg active:scale-95 transition-all cursor-pointer"
                        style={{
                            backgroundColor: '#181829',
                            boxShadow: '0 8px 20px rgba(24,24,41,0.25)',
                        }}
                    >
                        <span>View Latest Notice</span>
                        <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">➔</span>
                    </button>
                </div>
            </section>

            {/* ── 2 Mini Metric Cards (Side-by-Side Borderless Soft Glass Themes) ── */}
            <section className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Card 1: Study Notes (Borderless Soft Rose Tint) */}
                <div
                    onClick={() => navigate("/student/notes")}
                    className="group rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 flex flex-col justify-between h-32 sm:h-36 relative overflow-hidden cursor-pointer backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
                    style={{
                        background: isLight
                            ? 'linear-gradient(135deg, rgba(255, 241, 242, 0.65) 0%, rgba(255, 228, 230, 0.35) 100%)'
                            : 'linear-gradient(135deg, rgba(136, 19, 55, 0.22) 0%, rgba(76, 5, 25, 0.12) 100%)',
                        border: 'none',
                        boxShadow: 'none'
                    }}
                >
                    {/* Decorative Ambient Background Glow */}
                    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-rose-400/10 blur-xl pointer-events-none" />

                    <div className="flex items-center justify-between">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center bg-rose-500/15 text-[#f43f5e] shadow-xs">
                            <span className="material-symbols-outlined text-xl sm:text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                menu_book
                            </span>
                        </div>
                    </div>

                    <div className="flex items-end justify-between gap-1.5 mt-1">
                        <div>
                            <span className="block text-xs sm:text-sm font-extrabold leading-tight" style={{ color: 'var(--st-text-primary)' }}>Study Notes</span>
                            <span className="block text-[10px] sm:text-xs font-semibold leading-tight" style={{ color: 'var(--st-text-muted)' }}>Class Materials</span>
                        </div>
                        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#f43f5e] text-white flex items-center justify-center group-hover:scale-110 transition-all shadow-md shrink-0">
                            <span className="material-symbols-outlined text-xs sm:text-sm font-bold">north_east</span>
                        </span>
                    </div>
                </div>

                {/* Card 2: Leaderboard (Borderless Soft Amber Tint) */}
                <div
                    onClick={() => navigate("/student/leaderboard")}
                    className="group rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 flex flex-col justify-between h-32 sm:h-36 relative overflow-hidden cursor-pointer backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
                    style={{
                        background: isLight
                            ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.55) 0%, rgba(253, 230, 138, 0.25) 100%)'
                            : 'linear-gradient(135deg, rgba(120, 53, 15, 0.22) 0%, rgba(69, 26, 3, 0.12) 100%)',
                        border: 'none',
                        boxShadow: 'none'
                    }}
                >
                    {/* Decorative Ambient Background Glow */}
                    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-amber-400/10 blur-xl pointer-events-none" />

                    <div className="flex items-center justify-between">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center bg-amber-500/15 text-[#d97706] dark:text-[#f59e0b] shadow-xs">
                            <span className="material-symbols-outlined text-xl sm:text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                emoji_events
                            </span>
                        </div>
                    </div>

                    <div className="flex items-end justify-between gap-1.5 mt-1">
                        <div>
                            <span className="block text-xs sm:text-sm font-extrabold leading-tight" style={{ color: 'var(--st-text-primary)' }}>Leaderboard</span>
                            <span className="block text-[10px] sm:text-xs font-semibold leading-tight" style={{ color: 'var(--st-text-muted)' }}>Top Students</span>
                        </div>
                        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#f59e0b] text-white flex items-center justify-center group-hover:scale-110 transition-all shadow-md shrink-0">
                            <span className="material-symbols-outlined text-xs sm:text-sm font-bold">north_east</span>
                        </span>
                    </div>
                </div>
            </section>

            {/* ── CIBIL Speedometer Half-Circle Gauge Card (FP Score) ── */}
            <FPScoreGaugeCard />
        </div>
    );
}

// ── CIBIL-style Speedometer Gauge Meter Component for FP Score ──
function FPScoreGaugeCard() {
    const { user, refreshUser } = useAuth();
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    const [calculating, setCalculating] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);

    // Check if score has been calculated/saved previously in Firestore
    const hasInitialScore = Boolean(user?.fp_score_updated_at);

    const [scoreData, setScoreData] = useState({
        score: user?.fp_score ?? null,
        tier: user?.fp_score_tier ?? null,
        updatedAt: user?.fp_score_updated_at ?? null,
        hasChecked: hasInitialScore
    });

    const handleCalculateScore = useCallback(async () => {
        setCalculating(true);
        try {
            const data = await api.post("/api/student/calculate-fp-score");
            setScoreData({
                score: data.fp_score,
                tier: data.fp_score_tier,
                updatedAt: data.updated_at,
                hasChecked: true
            });
            if (refreshUser) refreshUser();
        } catch (err) {
            console.error("Error calculating FP Score:", err);
        } finally {
            setCalculating(false);
        }
    }, [refreshUser]);

    useEffect(() => {
        const s = user?.fp_score;
        const t = user?.fp_score_tier;
        const d = user?.fp_score_updated_at;

        if (s !== undefined && s !== null && d) {
            setScoreData({
                score: s,
                tier: t || "PERFECT",
                updatedAt: d,
                hasChecked: true
            });
        }
    }, [user?.fp_score, user?.fp_score_tier, user?.fp_score_updated_at]);

    // Lock body scrolling when info popup modal is open
    useEffect(() => {
        if (showInfoModal) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [showInfoModal]);

    const isChecked = scoreData.hasChecked;
    const currentScore = isChecked ? scoreData.score : null;
    const isNumericScore = typeof currentScore === "number";
    const frac = isChecked && isNumericScore ? Math.max(0, Math.min(1, (currentScore - 300) / 600)) : 0.5;

    const radius = 80;
    const strokeWidth = 13;

    // Helper to generate SVG arc path given start & end angles in degrees (from left = 180deg to right = 0deg)
    const getArcPath = (startDeg, endDeg) => {
        const startRad = (startDeg * Math.PI) / 180;
        const endRad = (endDeg * Math.PI) / 180;
        const x1 = 100 + radius * Math.cos(startRad);
        const y1 = 100 - radius * Math.sin(startRad);
        const x2 = 100 + radius * Math.cos(endRad);
        const y2 = 100 - radius * Math.sin(endRad);
        return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
    };

    // 4 Distinct Segments matching CIBIL gauge with 10deg wide white gaps
    const segments = [
        { color: "#ef4444", startDeg: 174, endDeg: 140 },    // Red (Poor / Risk)
        { color: "#f97316", startDeg: 128, endDeg: 94 },     // Orange (Fair)
        { color: "#eab308", startDeg: 82, endDeg: 48 },      // Yellow (Good)
        { color: "#10b981", startDeg: 36, endDeg: 2 },       // Green (Excellent)
    ];

    const tierColors = {
        PERFECT: "#10b981",
        "VERY GOOD": "#3b82f6",
        GOOD: "#eab308",
        FAIR: "#f97316",
        "BELOW AVERAGE": "#f43f5e",
        POOR: "#ef4444",
        "NO HISTORY": "#94a3b8"
    };
    const tierColor = isChecked ? (tierColors[scoreData.tier] || "#94a3b8") : "#94a3b8";

    // Compute indicator position along the arc (174deg on left down to 2deg on right)
    const currentAngleDeg = 174 - frac * (174 - 2);
    const currentAngleRad = (currentAngleDeg * Math.PI) / 180;
    const indX = 100 + radius * Math.cos(currentAngleRad);
    const indY = 100 - radius * Math.sin(currentAngleRad);

    return (
        <section className="mt-5 sm:mt-6">
            <div
                className="rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 relative overflow-hidden border backdrop-blur-2xl transition-all duration-300"
                style={{
                    background: isLight
                        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(243, 244, 246, 0.45) 100%)'
                        : 'linear-gradient(135deg, rgba(28, 31, 43, 0.65) 0%, rgba(15, 23, 42, 0.45) 100%)',
                    borderColor: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.12)',
                    boxShadow: isLight
                        ? '0 20px 40px -15px rgba(99, 102, 241, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.9)'
                        : '0 20px 40px -15px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
                }}
            >
                {/* Decorative Ambient Glass Glow Orbs */}
                <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-8">

                    {/* ── Left Side: CIBIL Speedometer Half-Circle Arc Gauge ── */}
                    <div className="flex flex-col items-center justify-center relative shrink-0">
                        <div className="relative w-48 sm:w-56 h-28 sm:h-32 flex items-end justify-center overflow-visible">
                            <svg viewBox="0 0 200 115" className="w-48 sm:w-56 h-28 sm:h-32 overflow-visible">
                                {/* 4 Distinct Segmented Color Arcs with white gaps */}
                                {segments.map((seg, idx) => (
                                    <path
                                        key={idx}
                                        d={getArcPath(seg.startDeg, seg.endDeg)}
                                        fill="none"
                                        stroke={seg.color}
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                        opacity={isChecked && isNumericScore ? 1 : 0.35}
                                        className="transition-all duration-500"
                                    />
                                ))}

                                {/* Dial Ring Indicator at current score position (only when checked and numeric) */}
                                {isChecked && isNumericScore && (
                                    <g className="transition-all duration-1000 ease-out">
                                        <circle cx={indX} cy={indY} r="10" fill={tierColor} stroke="#ffffff" strokeWidth="3" className="drop-shadow-md" />
                                        <circle cx={indX} cy={indY} r="3.5" fill="#ffffff" />
                                    </g>
                                )}
                            </svg>

                            {/* Center Score Number / N/A */}
                            <div className="absolute bottom-1 flex flex-col items-center justify-center">
                                <span 
                                    className={currentScore === "N/A" ? "text-3xl sm:text-4xl md:text-5xl font-black tracking-tight" : "text-4xl sm:text-5xl md:text-6xl font-black tracking-tight"} 
                                    style={{ fontFamily: "'Manrope', sans-serif", color: isChecked && !isNumericScore ? '#94a3b8' : 'var(--st-text-primary)' }}
                                >
                                    {isChecked ? currentScore : "---"}
                                </span>
                            </div>
                        </div>

                        {/* Min & Max Scale Numbers */}
                        <div className="w-48 sm:w-56 flex justify-between text-xs sm:text-sm font-extrabold px-2 sm:px-3 mt-1" style={{ color: 'var(--st-text-muted)' }}>
                            <span>300</span>
                            <span>900</span>
                        </div>
                    </div>

                    {/* ── Right Side: Score Rating & Action Details ── */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-2.5 sm:space-y-3.5 flex-1">
                        <div className="space-y-1 sm:space-y-1.5">
                            <div 
                                onClick={() => setShowInfoModal(true)}
                                className="flex items-center justify-center md:justify-start gap-2 cursor-pointer group/rating hover:opacity-90 transition-opacity"
                                title="Click to understand FP Score rating"
                            >
                                <span className="text-xs sm:text-base font-extrabold uppercase tracking-wider" style={{ color: 'var(--st-text-secondary)' }}>
                                    Rating:
                                </span>
                                {isChecked ? (
                                    <span
                                        className="text-xs sm:text-base font-black uppercase tracking-wider underline-offset-4 group-hover/rating:underline"
                                        style={{ color: tierColor }}
                                    >
                                        {scoreData.tier}
                                    </span>
                                ) : (
                                    <span className="text-xs sm:text-base font-bold" style={{ color: 'var(--st-text-muted)' }}>
                                        ---
                                    </span>
                                )}

                                {/* Info (i) Button */}
                                <button
                                    type="button"
                                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 group-hover/rating:bg-[#3b82f6] group-hover/rating:text-white flex items-center justify-center transition-all shadow-xs border border-slate-200 dark:border-white/10 ml-0.5"
                                >
                                    <span className="material-symbols-outlined text-xs sm:text-sm font-bold">info</span>
                                </button>
                            </div>
                            <p className="text-xs sm:text-sm font-semibold" style={{ color: 'var(--st-text-muted)' }}>
                                Updated: <span className="font-bold" style={{ color: 'var(--st-text-primary)' }}>{isChecked ? scoreData.updatedAt : "Not Checked Yet"}</span>
                            </p>
                            <p className="text-[11px] sm:text-xs font-semibold tracking-wide opacity-85" style={{ color: 'var(--st-text-secondary)' }}>
                                FP Score • Powered by Future Point
                            </p>
                        </div>

                        {/* Refresh / Check Score Button */}
                        <button
                            onClick={handleCalculateScore}
                            disabled={calculating}
                            className="inline-flex items-center gap-2 px-6 sm:px-7 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-extrabold text-white bg-[#3b82f6] hover:bg-[#2563eb] active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
                            style={{ fontFamily: "'Inter', sans-serif" }}
                        >
                            <span className={`material-symbols-outlined text-sm sm:text-base ${calculating ? 'animate-spin' : ''}`}>
                                {isChecked ? 'refresh' : 'insights'}
                            </span>
                            <span>{calculating ? "Analyzing..." : isChecked ? "Refresh Score" : "Check FP Score"}</span>
                        </button>
                    </div>

                </div>
            </div>

            {/* ── FP Score Info Breakdown Modal (GPay CIBIL Style Glassmorphism via React Portal) ── */}
            {showInfoModal && createPortal(
                <div 
                    className="fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn"
                    style={{
                        backgroundColor: isLight ? 'rgba(15, 23, 42, 0.22)' : 'rgba(0, 0, 0, 0.65)'
                    }}
                >
                    <div 
                        className="w-full max-w-md rounded-[32px] p-5 sm:p-6 space-y-3 relative overflow-hidden shadow-2xl border backdrop-blur-3xl transition-all"
                        style={{
                            background: isLight
                                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.88) 0%, rgba(240, 244, 249, 0.72) 100%)'
                                : 'linear-gradient(135deg, rgba(30, 35, 48, 0.82) 0%, rgba(15, 20, 32, 0.72) 100%)',
                            borderColor: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.14)',
                            boxShadow: isLight
                                ? '0 30px 60px -12px rgba(0, 0, 0, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.9)'
                                : '0 30px 60px -12px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
                            color: isLight ? '#1f2937' : '#f3f4f6'
                        }}
                    >
                        {/* Decorative Ambient Glass Glow Spheres */}
                        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
                        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

                        {/* Modal Title & Intro Text */}
                        <div className="space-y-1.5 relative z-10">
                            <h3 className="text-xl sm:text-2xl font-black tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                Understand FP score
                            </h3>
                            <p className="text-xs sm:text-sm leading-relaxed font-medium" style={{ color: isLight ? '#4b5563' : '#9ca3af' }}>
                                Your FP score is a 3 digit number that appears on your tuition punctuality report. The usual range is between 300 and 900.
                            </p>
                        </div>

                        {/* Score Ranges & Rating List */}
                        <div className="space-y-2 pt-1 relative z-10">
                            {/* Poor */}
                            <div className="flex items-center justify-between font-bold text-xs sm:text-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-3 h-3 rounded-full bg-[#ef4444] shrink-0" />
                                    <span>300 – 499</span>
                                </div>
                                <span style={{ color: isLight ? '#1f2937' : '#f3f4f6' }}>Poor</span>
                            </div>

                            {/* Below Average */}
                            <div className="flex items-center justify-between font-bold text-xs sm:text-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-3 h-3 rounded-full bg-[#f43f5e] shrink-0" />
                                    <span>500 – 599</span>
                                </div>
                                <span style={{ color: isLight ? '#1f2937' : '#f3f4f6' }}>Below average</span>
                            </div>

                            {/* Fair */}
                            <div className="flex items-center justify-between font-bold text-xs sm:text-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-3 h-3 rounded-full bg-[#f97316] shrink-0" />
                                    <span>600 – 699</span>
                                </div>
                                <span style={{ color: isLight ? '#1f2937' : '#f3f4f6' }}>Fair</span>
                            </div>

                            {/* Good */}
                            <div className="flex items-center justify-between font-bold text-xs sm:text-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-3 h-3 rounded-full bg-[#eab308] shrink-0" />
                                    <span>700 – 779</span>
                                </div>
                                <span style={{ color: isLight ? '#1f2937' : '#f3f4f6' }}>Good</span>
                            </div>

                            {/* Very Good */}
                            <div className="flex items-center justify-between font-bold text-xs sm:text-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-3 h-3 rounded-full bg-[#3b82f6] shrink-0" />
                                    <span>780 – 849</span>
                                </div>
                                <span style={{ color: isLight ? '#1f2937' : '#f3f4f6' }}>Very good</span>
                            </div>

                            {/* Perfect */}
                            <div className="flex items-center justify-between font-bold text-xs sm:text-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-3 h-3 rounded-full bg-[#10b981] shrink-0" />
                                    <span>850 – 900</span>
                                </div>
                                <span style={{ color: isLight ? '#1f2937' : '#f3f4f6' }}>Perfect</span>
                            </div>
                        </div>

                        {/* Disclaimer Text */}
                        <p className="text-[11px] sm:text-xs leading-relaxed font-normal pt-1 opacity-80 relative z-10" style={{ color: isLight ? '#6b7280' : '#9ca3af' }}>
                            The broad-classification of the FP scores within different ranges (i.e. perfect, very good, fair etc.) is solely based on tuition fee payment punctuality details (and not any other external parameters). These are based on Future Point's own criteria to classify student tuition payment timeliness for educational purposes.
                        </p>

                        {/* Got It Action Button (Bottom Right) */}
                        <div className="flex justify-end pt-0 relative z-10">
                            <button
                                onClick={() => setShowInfoModal(false)}
                                className="px-5 py-1.5 rounded-full font-extrabold text-sm text-[#2563eb] hover:bg-blue-500/10 active:scale-95 transition-all cursor-pointer"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </section>
    );
}

export default function StudentDashboard() {
    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <StudentLayout>
                <StudentDashboardContent />
            </StudentLayout>
        </ProtectedRoute>
    );
}

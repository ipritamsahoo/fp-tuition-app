import { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import ProtectedRoute from "@/components/ProtectedRoute";
import StudentLayout from "@/components/StudentLayout";
import ProfilePicture from "@/components/ProfilePicture";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { getYearOptions } from "@/lib/yearOptions";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { StudentLeaderboardGatewaySkeleton, StudentLeaderboardButtonSkeleton, GenericListSkeleton } from "@/components/Skeletons";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatTime(isoString) {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
    } catch { return ""; }
}

// ── Marquee Auto-Scrolling Text for Overflowing Student Names ──
function MarqueeText({ text, className = "", style = {} }) {
    const containerRef = useRef(null);
    const textRef = useRef(null);
    const [overflow, setOverflow] = useState(0);

    useEffect(() => {
        const check = () => {
            if (containerRef.current && textRef.current) {
                const diff = textRef.current.scrollWidth - containerRef.current.clientWidth;
                setOverflow(diff > 2 ? diff : 0);
            }
        };
        check();
        const timer = setTimeout(check, 150);
        window.addEventListener("resize", check);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", check);
        };
    }, [text]);

    return (
        <>
            <style>{`
                @keyframes marqueeBounce {
                    0%, 25% { transform: translateX(0); }
                    75%, 100% { transform: translateX(var(--marquee-dist)); }
                }
            `}</style>
            <div ref={containerRef} className={`overflow-hidden whitespace-nowrap max-w-full relative ${className}`} style={style}>
                <div
                    ref={textRef}
                    className="inline-block"
                    style={
                        overflow > 0
                            ? {
                                  animation: `marqueeBounce ${Math.max(4.5, overflow * 0.14)}s ease-in-out infinite alternate`,
                                  "--marquee-dist": `-${overflow + 6}px`,
                              }
                            : {}
                    }
                >
                    {text}
                </div>
            </div>
        </>
    );
}

// ── Podium Avatar (Fully Responsive Mobile + Desktop) ──
function PodiumAvatar({ entry, rank, size = "lg" }) {
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    // Responsive Avatar Pixel Dimensions: Compact on mobile, expansive on desktop
    const isLg = size === "lg";

    const borderGradients = {
        1: isLight ? "from-[#7c3aed] via-[#0d9488] to-[#6d28d9]" : "from-[#c799ff] via-[#4af8e3] to-[#bc87fe]",
        2: isLight ? "from-slate-400 via-slate-300 to-slate-400" : "from-slate-300 via-slate-400 to-slate-500",
        3: isLight ? "from-[#fb899c] via-[#ff9dac] to-[#fb899c]" : "from-[#ff9dac] via-[#f472b6] to-[#ff9dac]",
    };

    const rankBadges = {
        1: isLight
            ? "bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white ring-2 sm:ring-4 ring-[#eef2ff]"
            : "bg-gradient-to-br from-[#c799ff] to-[#bc87fe] text-[#340064] ring-2 sm:ring-4 ring-[#0c0e17]",
        2: isLight
            ? "bg-slate-400 text-white ring-2 ring-[#eef2ff]"
            : "bg-slate-400 text-slate-900 ring-2 ring-[#0c0e17]",
        3: isLight
            ? "bg-[#fb899c] text-white ring-2 ring-[#eef2ff]"
            : "bg-[#fb899c] text-[#5b0a22] ring-2 ring-[#0c0e17]",
    };

    const rankShadows = {
        1: isLight ? "shadow-[#7c3aed]/25" : "shadow-[#c799ff]/30",
        2: isLight ? "shadow-slate-400/30" : "shadow-slate-400/40",
        3: isLight ? "shadow-[#fb899c]/25" : "shadow-[#ff9dac]/30",
    };

    const avatarSizes = {
        1: "w-[84px] h-[84px] sm:w-[100px] sm:h-[100px]",
        2: "w-[72px] h-[72px] sm:w-[80px] sm:h-[80px]",
        3: "w-[64px] h-[64px] sm:w-[74px] sm:h-[74px]",
    };

    const profilePicPx = {
        1: 96,
        2: 80,
        3: 72,
    };

    return (
        <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div className={`relative ${rank === 1 ? "scale-105 sm:scale-110" : ""}`}>
                {/* Crown for #1 */}
                {rank === 1 && (
                    <div className="absolute -top-3.5 sm:-top-4 left-1/2 -translate-x-1/2 z-10">
                        <span className="material-symbols-outlined text-2xl sm:text-3xl" style={{ fontVariationSettings: "'FILL' 1", color: isLight ? '#7c3aed' : '#c799ff' }}>
                            workspace_premium
                        </span>
                    </div>
                )}
                {/* Responsive Gradient Ring Container */}
                <div 
                    className={`rounded-full p-[3px] bg-gradient-to-b ${borderGradients[rank]} shadow-lg ${rankShadows[rank]} ${avatarSizes[rank]}`}
                >
                    <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center" style={{ border: `2px solid ${isLight ? '#eef2ff' : '#0c0e17'}` }}>
                        <ProfilePicture size={profilePicPx[rank]} picUrl={entry.profile_pic_url} name={entry.student_name} />
                    </div>
                </div>
                {/* Rank badge */}
                <div className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full font-bold
                    ${rankBadges[rank]}
                    ${rank === 1 ? "w-6 h-6 sm:w-8 sm:h-8 text-[10px] sm:text-xs" : "w-5 h-5 sm:w-6 sm:h-6 text-[9px] sm:text-[10px]"}`}>
                    {rank}
                </div>
            </div>
            <div className="text-center w-full px-0.5">
                <div className={`max-w-[85px] sm:max-w-[110px] mx-auto ${rank === 1 ? "text-xs sm:text-sm font-extrabold" : "text-[11px] sm:text-xs font-bold"}`}
                    style={{
                        color: 'var(--st-text-primary)',
                        ...(rank === 1 ? { textShadow: isLight ? '0 0 15px rgba(124,58,237,0.3)' : '0 0 15px rgba(199,153,255,0.5)' } : {})
                    }}>
                    <MarqueeText text={entry.student_name} />
                </div>
            </div>
        </div>
    );
}


// ── Main Content ──
function StudentLeaderboardContent() {
    const { user } = useAuth();
    const { theme } = useStudentTheme();
    const isLight = theme === "light";
    
    // Reveal State: persist in sessionStorage for current app session
    const [isRevealed, setIsRevealed] = useState(() => {
        try {
            return sessionStorage.getItem("student_leaderboard_revealed") === "true";
        } catch {
            return false;
        }
    });
    const [isRevealing, setIsRevealing] = useState(false);
    const [revealProgress, setRevealProgress] = useState(0);
    const [month, setMonth] = useState(() => {
        try {
            const saved = sessionStorage.getItem("student_leaderboard_month");
            return saved ? Number(saved) : null;
        } catch {
            return null;
        }
    });
    const [year, setYear] = useState(() => {
        try {
            const saved = sessionStorage.getItem("student_leaderboard_year");
            return saved ? Number(saved) : null;
        } catch {
            return null;
        }
    });
    const [hasInit, setHasInit] = useState(false);

    // Get cached data if already fetched
    const cacheKey = `student_leaderboard_${month}_${year}`;
    const cachedData = getCache(cacheKey);

    const [data, setData] = useState(cachedData || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchLeaderboard = useCallback(async (m, y, force = false) => {
        if (!m || !y) return;
        const fetchCacheKey = `student_leaderboard_${m}_${y}`;
        const currentCache = getCache(fetchCacheKey);
        
        setError("");
        
        // If data is already cached in memory for this month & year, use cached data & skip API call
        if (currentCache && !force) {
            setData(currentCache);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const params = `?month=${m}&year=${y}`;
            const result = await api.get(`/api/student/leaderboard${params}`);
            
            setData(result);
            setCache(fetchCacheKey, result);
            
            setHasInit(prev => {
                if (!prev) {
                    setMonth(result.month);
                    setYear(result.year);
                    try {
                        sessionStorage.setItem("student_leaderboard_month", result.month.toString());
                        sessionStorage.setItem("student_leaderboard_year", result.year.toString());
                    } catch {}
                    return true;
                }
                return prev;
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Sync any month/year dropdown selection to sessionStorage for the current session
    useEffect(() => {
        if (month && year) {
            try {
                sessionStorage.setItem("student_leaderboard_month", month.toString());
                sessionStorage.setItem("student_leaderboard_year", year.toString());
            } catch {}
        }
    }, [month, year]);

    // Fetch default batch billing month from backend on mount ONLY if not already saved in session
    useEffect(() => {
        const savedMonth = sessionStorage.getItem("student_leaderboard_month");
        const savedYear = sessionStorage.getItem("student_leaderboard_year");
        if (savedMonth && savedYear) return;

        api.get("/api/student/leaderboard")
            .then(res => {
                if (res.month && res.year) {
                    setMonth(res.month);
                    setYear(res.year);
                    const fetchCacheKey = `student_leaderboard_${res.month}_${res.year}`;
                    setCache(fetchCacheKey, res);
                    try {
                        sessionStorage.setItem("student_leaderboard_month", res.month.toString());
                        sessionStorage.setItem("student_leaderboard_year", res.year.toString());
                    } catch {}
                }
            })
            .catch(() => {});
    }, []);

    // Fetch data ONLY when revealed & user changes month/year filters later!
    useEffect(() => {
        if (!isRevealed || isRevealing || !month || !year) return;

        const fetchCacheKey = `student_leaderboard_${month}_${year}`;
        const cached = getCache(fetchCacheKey);
        if (cached) {
            setData(cached);
            setLoading(false);
        } else {
            setData(null);
            setLoading(true);
        }
        fetchLeaderboard(month, year);
    }, [isRevealed, isRevealing, month, year, fetchLeaderboard]);

    // Handle Watch Rank Reveal click with inline button progress loader (Zero Skeleton Flicker!)
    const handleReveal = async () => {
        if (isRevealing) return;
        setIsRevealing(true);
        setRevealProgress(18);

        // Smooth progress ticker while API request is in-flight
        let currentProgress = 18;
        const progressInterval = setInterval(() => {
            currentProgress = Math.min(currentProgress + Math.floor(Math.random() * 16 + 10), 92);
            setRevealProgress(currentProgress);
        }, 130);

        try {
            const fetchCacheKey = `student_leaderboard_${month}_${year}`;
            let result = getCache(fetchCacheKey);
            
            if (!result) {
                result = await api.get(`/api/student/leaderboard?month=${month}&year=${year}`);
                setCache(fetchCacheKey, result);
            }

            if (result.month && result.year) {
                setMonth(result.month);
                setYear(result.year);
                try {
                    sessionStorage.setItem("student_leaderboard_month", result.month.toString());
                    sessionStorage.setItem("student_leaderboard_year", result.year.toString());
                } catch {}
            }

            clearInterval(progressInterval);
            setRevealProgress(100);
            setData(result);
            setHasInit(true);

            // Celebration Confetti
            try {
                confetti({
                    particleCount: 80,
                    spread: 85,
                    origin: { y: 0.6 },
                    colors: ["#7c3aed", "#f59e0b", "#4af8e3", "#ff6e84", "#ffffff"],
                    zIndex: 100000,
                });
            } catch {
                // Ignore if canvas-confetti is not available
            }

            // Smooth delay to show 100% completion before revealing directly with ZERO skeleton
            setTimeout(() => {
                try {
                    sessionStorage.setItem("student_leaderboard_revealed", "true");
                } catch {}
                setIsRevealed(true);
                setIsRevealing(false);
                setRevealProgress(0);
            }, 250);
        } catch (err) {
            clearInterval(progressInterval);
            setIsRevealing(false);
            setRevealProgress(0);
            setError(err.message || "Failed to load leaderboard");
            try {
                sessionStorage.setItem("student_leaderboard_revealed", "true");
            } catch {}
            setIsRevealed(true);
        }
    };

    const yearOptions = getYearOptions();
    const primaryColor = isLight ? '#7c3aed' : '#c799ff';

    // ── INITIAL GATEWAY VIEW (0 Firestore Reads - Spotify Wrapped Style) ──
    if (!isRevealed) {
        return (
            <div className="min-h-[calc(100vh-200px)] flex flex-col justify-center items-center w-full max-w-md mx-auto select-none py-3 px-2 sm:px-0">
                <div className="w-full space-y-4 sm:space-y-5 flex flex-col items-center">
                    {/* ── Ultra-Premium Wrapped Style Hero Reveal Content (Card background removed) ── */}
                    <div className="w-full relative text-center group py-2 sm:py-4 flex flex-col items-center justify-center">
                        <div className="relative z-10 space-y-4 sm:space-y-6 flex flex-col items-center justify-center">
                            
                            {/* Top Micro Text Header */}
                            <div className="flex items-center justify-center gap-2.5 sm:gap-3 select-none -mt-16 sm:mt-0 mb-8 sm:mb-0">
                                <svg 
                                    className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 -translate-y-[2px] sm:-translate-y-[3px]" 
                                    viewBox="0 0 24 24" 
                                    fill="currentColor"
                                    style={{ color: '#f59e0b', filter: 'drop-shadow(0 2px 8px rgba(245, 158, 11, 0.45))' }}
                                >
                                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                                </svg>
                                <span 
                                    className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-widest leading-none"
                                    style={{ color: '#f59e0b' }}
                                >
                                    HALL OF FAME
                                </span>
                            </div>

                            {/* Golden Winner Trophy Stage with Spotlight Aura */}
                            <div className="relative flex items-center justify-center my-0.5 sm:my-1">
                                {/* Radiant Golden Halo Spotlight */}
                                <div 
                                    className="absolute w-28 sm:w-36 h-28 sm:h-36 rounded-full blur-2xl pointer-events-none"
                                    style={{
                                        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.45) 0%, rgba(217, 119, 6, 0.15) 50%, transparent 75%)',
                                    }}
                                />

                                {/* Floating Trophy Image */}
                                <div className="relative transform group-hover:scale-108 group-hover:-translate-y-1 transition-transform duration-500 ease-out select-none pointer-events-none">
                                    <img 
                                        src="/golden-trophy.png" 
                                        alt="Golden Winner Trophy" 
                                        className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain select-none pointer-events-none"
                                        style={{
                                            filter: 'drop-shadow(0 12px 20px rgba(245, 158, 11, 0.4)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25))',
                                        }}
                                        draggable="false"
                                        onDoubleClick={(e) => e.preventDefault()}
                                    />
                                </div>
                            </div>

                            {/* Main Headline & Description */}
                            <div className="space-y-2 sm:space-y-3 max-w-md mx-auto px-1">
                                <h2 
                                    className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide leading-snug"
                                    style={{
                                        fontFamily: "'Caveat', 'Dancing Script', cursive",
                                        color: isLight ? '#171435' : '#ffffff',
                                        textShadow: isLight ? '0 2px 10px rgba(124, 58, 237, 0.12)' : '0 2px 20px rgba(199, 153, 255, 0.35)',
                                    }}
                                >
                                    Who were the <span className="font-extrabold text-[#38bdf8]" style={{ textShadow: '0 0 16px rgba(56, 189, 248, 0.5)' }}>fastest payers</span> in your batch?
                                </h2>
                                {!month || !year ? (
                                    <StudentLeaderboardGatewaySkeleton />
                                ) : (
                                    <p 
                                        className="text-xs sm:text-sm font-medium leading-relaxed"
                                        style={{ color: isLight ? '#64748b' : '#94a3b8' }}
                                    >
                                        Discover the{' '}
                                        <span className="font-bold text-amber-500">
                                            {MONTH_FULL[month - 1]} {year}
                                        </span>{' '}
                                        billing cycle champions & check your rank!
                                    </p>
                                )}
                            </div>

                            {/* Flagship 3D Shimmer Action Button with Inline Progress Loader */}
                            <div className="pt-1 sm:pt-2 w-full sm:w-auto">
                                {!month || !year ? (
                                    <StudentLeaderboardButtonSkeleton />
                                ) : (
                                    <button
                                        onClick={handleReveal}
                                        disabled={isRevealing}
                                        className="w-full sm:w-auto relative inline-flex items-center justify-center gap-2 sm:gap-2.5 px-6 sm:px-8 py-3.5 rounded-full font-black text-xs sm:text-sm md:text-base text-white shadow-2xl active:scale-95 hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden group/btn disabled:opacity-95 disabled:cursor-wait"
                                        style={{
                                            background: isRevealing
                                                ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%)'
                                                : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #4f46e5 100%)',
                                            boxShadow: '0 12px 30px -4px rgba(99, 102, 241, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                                        }}
                                    >
                                        {/* Shimmer Sweep Overlay (active when ready) */}
                                        {!isRevealing && (
                                            <div 
                                                className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none"
                                                style={{
                                                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                                                }}
                                            />
                                        )}

                                        {/* Animated Line Progress Bar along the bottom */}
                                        {isRevealing && (
                                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30 overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-300 transition-all duration-200 ease-out shadow-xs"
                                                    style={{ width: `${revealProgress}%` }}
                                                />
                                            </div>
                                        )}

                                        {isRevealing ? (
                                            <div className="flex items-center gap-2 sm:gap-2.5 tracking-wider text-xs sm:text-sm font-black">
                                                <span className="material-symbols-outlined text-base animate-spin text-amber-300">
                                                    progress_activity
                                                </span>
                                                <span>UNLOCKING RANKINGS... {revealProgress}%</span>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="tracking-wide">REVEAL LEADERBOARD</span>
                                                <span 
                                                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] sm:text-xs group-hover/btn:translate-x-1 transition-transform"
                                                    style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3)' }}
                                                >
                                                    ➔
                                                </span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── REVEALED LOADING STATE ──
    if (loading) {
        return (
            <div className="p-6">
                <GenericListSkeleton />
            </div>
        );
    }

    // ── REVEALED ERROR STATE ──
    if (error) {
        return (
            <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl text-sm"
                    style={{ backgroundColor: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(255,110,132,0.1)', border: `1px solid ${isLight ? 'rgba(239,68,68,0.15)' : 'rgba(255,110,132,0.2)'}`, color: isLight ? '#ef4444' : '#ff9dac' }}
                >
                    {error}
                </div>
                <button onClick={() => fetchLeaderboard(month, year)}
                    className="px-6 py-2 rounded-full font-bold text-sm cursor-pointer"
                    style={{ backgroundColor: isLight ? '#7c3aed' : '#c799ff', color: isLight ? 'white' : '#440080' }}
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data) return null;

    const top3 = (data.top5 || []).filter(e => e.rank <= 3);
    const rank4and5 = (data.top5 || []).filter(e => e.rank > 3);
    const podiumOrder = [
        { rank: 2, entry: top3.find(e => e.rank === 2) },
        { rank: 1, entry: top3.find(e => e.rank === 1) },
        { rank: 3, entry: top3.find(e => e.rank === 3) },
    ];
    
    const hasAnyPodium = top3.length > 0;

    return (
        <div className="space-y-8 pt-2 md:pt-0 pb-6">
            {/* Date Filters */}
            <div className="flex flex-wrap items-center justify-center gap-2 relative z-20">
                <ModernSelect
                    theme={theme}
                    icon="calendar_month"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    options={MONTH_FULL.map((m, i) => ({ value: i + 1, label: MONTH_NAMES[i] }))}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium cursor-pointer transition-all min-w-[120px]"
                    style={{ backgroundColor: 'var(--st-icon-bg)', border: `1px solid var(--st-input-border)`, color: 'var(--st-text-primary)' }}
                />
                <ModernSelect
                    theme={theme}
                    icon="event"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    options={yearOptions}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium cursor-pointer transition-all min-w-[100px]"
                    style={{ backgroundColor: 'var(--st-icon-bg)', border: `1px solid var(--st-input-border)`, color: 'var(--st-text-primary)' }}
                />
            </div>

            {/* Hero Section */}
            <section className="text-center space-y-2">
                <h2 className="text-4xl font-extrabold tracking-tight"
                    style={{
                        fontFamily: "'Manrope', sans-serif",
                        color: 'var(--st-text-primary)',
                        textShadow: isLight ? '0 0 15px rgba(124,58,237,0.3)' : '0 0 15px rgba(199,153,255,0.5)',
                    }}>
                    Fastest Payers
                </h2>
                <p className="text-sm font-medium" style={{ color: 'var(--st-text-secondary)' }}>
                    {MONTH_FULL[month - 1]} {year} Billing Cycle
                </p>
            </section>

            {/* Podium / Top 3 */}
            {hasAnyPodium ? (
                <section className="grid grid-cols-3 gap-2 sm:gap-4 items-end pb-4 max-w-md mx-auto">
                    {podiumOrder.map((slot) => (
                        <div key={slot.rank}>
                            {slot.entry ? (
                                <PodiumAvatar entry={slot.entry} rank={slot.rank} size={slot.rank === 1 ? "lg" : "md"} />
                            ) : (
                                <div className="flex flex-col items-center justify-end h-28 sm:h-32 opacity-20">
                                    <div className="w-14 sm:w-16 h-14 sm:h-16 rounded-full border border-dashed" style={{ borderColor: 'var(--st-input-border)' }} />
                                </div>
                            )}
                        </div>
                    ))}
                </section>
            ) : (
                <section className="text-center py-8 sm:py-10">
                    <span className="material-symbols-outlined text-5xl sm:text-6xl mb-3 block" style={{ color: 'var(--st-text-muted)' }}>emoji_events</span>
                    <p className="text-base sm:text-lg font-medium" style={{ color: 'var(--st-text-secondary)' }}>No paid entries yet</p>
                    <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--st-text-muted)' }}>Be the first to pay and claim the #1 spot!</p>
                </section>
            )}

            {/* Ranking Details (#4, #5) */}
            {rank4and5.length > 0 && (
                <section className="space-y-3 sm:space-y-4">
                    <div className="space-y-2.5 sm:space-y-3">
                        {rank4and5.map((entry) => (
                            <div key={entry.rank}
                                className="glass-card-student rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 transition-all"
                                style={{
                                    transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden"
                                }}>
                                <span className="font-bold w-5 sm:w-6 text-xs sm:text-sm" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-secondary)' }}>
                                    #{entry.rank}
                                </span>
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: isLight ? '#e2e8f0' : '#222532' }}>
                                    <ProfilePicture size={56} picUrl={entry.profile_pic_url} name={entry.student_name} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <MarqueeText
                                        text={entry.student_name}
                                        className="font-bold text-xs sm:text-sm"
                                        style={{ color: 'var(--st-text-primary)' }}
                                    />
                                </div>
                                <div className="flex items-center gap-1 shrink-0 select-none">
                                    {entry.rank <= 5 && (
                                        <span className="material-symbols-outlined text-xs sm:text-sm font-bold" style={{ color: 'var(--st-accent)' }}>trending_up</span>
                                    )}
                                    <span className="text-[10px] sm:text-xs font-extrabold tracking-wider" style={{ color: entry.rank <= 5 ? 'var(--st-accent)' : 'var(--st-text-secondary)' }}>
                                        {entry.rank <= 5 ? "TOP 5" : "LOCKED IN"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Your Current Position */}
            <section>
                {data.is_current_paid ? (
                    <div
                        className="p-4 rounded-3xl backdrop-blur-2xl"
                        style={{
                            background: isLight
                                ? 'linear-gradient(to right, rgba(124,58,237,0.1), rgba(13,148,136,0.08))'
                                : 'linear-gradient(to right, rgba(199,153,255,0.2), rgba(74,248,227,0.1))',
                            border: `1px solid ${isLight ? 'rgba(124,58,237,0.2)' : 'rgba(199,153,255,0.3)'}`,
                            boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.04)' : '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: isLight ? 'rgba(124,58,237,0.1)' : 'rgba(199,153,255,0.2)' }}>
                                    <span className="material-symbols-outlined" style={{ color: primaryColor }}>person_pin</span>
                                </div>
                                <div>
                                    <p className="text-xs font-medium" style={{ color: isLight ? '#6d28d9' : '#bc87fe' }}>Your Current Rank</p>
                                    <p className="text-lg font-bold" style={{ color: 'var(--st-text-primary)' }}>
                                        #{data.current_position}
                                        <span className="text-xs font-normal ml-2" style={{ color: 'var(--st-text-secondary)' }}>
                                            among {data.total_students} students
                                        </span>
                                    </p>
                                </div>
                            </div>
                            {data.current_position <= 5 && (
                                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1", color: 'var(--st-accent)' }}>
                                    emoji_events
                                </span>
                            )}
                        </div>
                    </div>
                ) : data.has_bill ? (
                    <div
                        className="p-4 rounded-3xl backdrop-blur-2xl"
                        style={{
                            backgroundColor: isLight ? 'rgba(239,68,68,0.06)' : 'rgba(255,110,132,0.1)',
                            border: `1px solid ${isLight ? 'rgba(239,68,68,0.15)' : 'rgba(255,110,132,0.3)'}`,
                            boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.04)' : '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: isLight ? 'rgba(239,68,68,0.1)' : 'rgba(255,110,132,0.2)' }}>
                                <span className="material-symbols-outlined" style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>lock</span>
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: isLight ? '#ef4444' : '#ff9dac' }}>Position Locked</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--st-text-secondary)' }}>
                                    Pay your bill first to see your ranking position
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        className="p-4 rounded-3xl backdrop-blur-2xl"
                        style={{
                            backgroundColor: 'var(--st-icon-bg)',
                            border: `1px solid var(--st-input-border)`,
                            boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.04)' : '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--st-icon-bg)' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--st-text-muted)' }}>info</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--st-text-secondary)' }}>No bill for this cycle</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--st-text-muted)' }}>You don't have a payment record for this month</p>
                            </div>
                        </div>
                    </div>
                )}
            </section>

        </div>
    );
}

export default function StudentLeaderboard() {
    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <StudentLayout>
                <StudentLeaderboardContent />
            </StudentLayout>
        </ProtectedRoute>
    );
}

import { useState, useEffect, useCallback } from "react";
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
import { GenericListSkeleton } from "@/components/Skeletons";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatTime(isoString) {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
    } catch { return ""; }
}

// ── Podium Avatar (Fully Responsive Mobile + Desktop) ──
function PodiumAvatar({ entry, rank, size = "lg" }) {
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    // Responsive Avatar Pixel Dimensions: Compact on mobile, expansive on desktop
    const isLg = size === "lg";

    const borderGradients = {
        1: isLight ? "from-[#7c3aed] via-[#0d9488] to-[#6d28d9]" : "from-[#c799ff] via-[#4af8e3] to-[#bc87fe]",
        2: "from-slate-400 to-transparent",
        3: "from-[#ff9dac] to-transparent",
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
                    className={`rounded-full ${rank === 1 ? "p-[2.5px] sm:p-[3px]" : "p-[2px]"} bg-gradient-to-b ${borderGradients[rank]} shadow-lg ${rank === 1 ? (isLight ? "shadow-[#7c3aed]/20" : "shadow-[#c799ff]/20") : rank === 3 ? "shadow-[#ff9dac]/20" : "shadow-slate-900/40"} ${isLg ? "w-[76px] h-[76px] sm:w-[92px] sm:h-[92px]" : "w-[56px] h-[56px] sm:w-[68px] sm:h-[68px]"}`}
                >
                    <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center" style={{ border: `${rank === 1 ? 3 : 2}px solid ${isLight ? '#eef2ff' : '#0c0e17'}` }}>
                        <ProfilePicture size={isLg ? 84 : 60} picUrl={entry.profile_pic_url} name={entry.student_name} />
                    </div>
                </div>
                {/* Rank badge */}
                <div className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full font-bold
                    ${rankBadges[rank]}
                    ${rank === 1 ? "w-6 h-6 sm:w-8 sm:h-8 text-[10px] sm:text-xs" : "w-5 h-5 sm:w-6 sm:h-6 text-[9px] sm:text-[10px]"}`}>
                    {rank}
                </div>
            </div>
            <div className="text-center w-full px-1">
                <p className={`font-bold truncate max-w-[85px] sm:max-w-[110px] mx-auto ${rank === 1 ? "text-xs sm:text-sm" : "text-[11px] sm:text-xs"}`}
                    style={{
                        color: 'var(--st-text-primary)',
                        ...(rank === 1 ? { textShadow: isLight ? '0 0 15px rgba(124,58,237,0.3)' : '0 0 15px rgba(199,153,255,0.5)' } : {})
                    }}>
                    {entry.student_name}
                </p>
            </div>
        </div>
    );
}


// ── Main Content ──
function StudentLeaderboardContent() {
    const { user } = useAuth();
    const { theme } = useStudentTheme();
    const isLight = theme === "light";
    
    // Dynamic Date Calculation: Previous completed month & Current live month
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Reveal State: false by default to save 100% of Firestore reads on initial visit!
    const [isRevealed, setIsRevealed] = useState(false);
    const [isRevealing, setIsRevealing] = useState(false);
    const [revealProgress, setRevealProgress] = useState(0);
    const [month, setMonth] = useState(prevMonth);
    const [year, setYear] = useState(prevYear);
    const [hasInit, setHasInit] = useState(false);

    // Get cached data if already fetched
    const cacheKey = `student_leaderboard_${month}_${year}`;
    const cachedData = getCache(cacheKey);

    const [data, setData] = useState(cachedData || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchLeaderboard = useCallback(async (m, y) => {
        const fetchCacheKey = `student_leaderboard_${m}_${y}`;
        const currentCache = getCache(fetchCacheKey);
        
        setError("");
        if (!currentCache) {
            setLoading(true);
        }
        
        try {
            const params = `?month=${m}&year=${y}`;
            const result = await api.get(`/api/student/leaderboard${params}`);
            
            if (JSON.stringify(currentCache) !== JSON.stringify(result)) {
                setData(result);
                setCache(fetchCacheKey, result);
            }
            
            setHasInit(prev => {
                if (!prev) {
                    setMonth(result.month);
                    setYear(result.year);
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

    // Fetch data ONLY when revealed & user changes month/year filters later!
    useEffect(() => {
        if (!isRevealed || isRevealing) return;

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
            const targetMonth = prevMonth;
            const targetYear = prevYear;
            setMonth(targetMonth);
            setYear(targetYear);

            const fetchCacheKey = `student_leaderboard_${targetMonth}_${targetYear}`;
            let result = getCache(fetchCacheKey);
            
            if (!result) {
                result = await api.get(`/api/student/leaderboard?month=${targetMonth}&year=${targetYear}`);
                setCache(fetchCacheKey, result);
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
                setIsRevealed(true);
                setIsRevealing(false);
                setRevealProgress(0);
            }, 250);
        } catch (err) {
            clearInterval(progressInterval);
            setIsRevealing(false);
            setRevealProgress(0);
            setError(err.message || "Failed to load leaderboard");
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
                    {/* ── Top Live Billing Status Tag ── */}
                    <div className="w-full flex justify-center">
                        <div 
                            className="inline-flex items-center justify-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider backdrop-blur-xl shadow-xs border text-center transition-all max-w-full"
                            style={{
                                backgroundColor: isLight ? 'rgba(124, 58, 237, 0.06)' : 'rgba(23, 25, 45, 0.75)',
                                color: isLight ? '#6d28d9' : '#c084fc',
                                borderColor: isLight ? 'rgba(124, 58, 237, 0.18)' : 'rgba(168, 85, 247, 0.3)',
                                boxShadow: isLight ? '0 2px 10px rgba(124, 58, 237, 0.08)' : '0 4px 16px rgba(0, 0, 0, 0.4)',
                            }}
                        >
                            <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="leading-tight">⚡ {MONTH_FULL[currentMonth - 1]} Billing Cycle is Live! Pay first to claim #1</span>
                        </div>
                    </div>

                    {/* ── Ultra-Premium Wrapped Style Hero Reveal Card ── */}
                    <div 
                        className="w-full relative rounded-[28px] sm:rounded-[36px] p-5 sm:p-8 md:p-10 overflow-hidden text-center transition-all duration-500 group border"
                        style={{
                            background: isLight
                                ? 'linear-gradient(160deg, #ffffff 0%, #fbfaff 40%, #f1ecfe 100%)'
                                : 'linear-gradient(160deg, #0e101d 0%, #18162f 45%, #0a0b14 100%)',
                            borderColor: isLight ? 'rgba(199, 210, 254, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                            boxShadow: isLight
                                ? '0 20px 50px -12px rgba(124, 58, 237, 0.16), 0 0 0 1px rgba(255, 255, 255, 0.8) inset'
                                : '0 24px 60px -12px rgba(0, 0, 0, 0.75), 0 0 30px rgba(124, 58, 237, 0.15), 0 1px 0 rgba(255, 255, 255, 0.12) inset',
                        }}
                    >
                    {/* Atmospheric Ambient Glows */}
                    <div 
                        className="absolute -top-16 -left-16 w-48 sm:w-56 h-48 sm:h-56 rounded-full blur-3xl pointer-events-none opacity-60"
                        style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, transparent 70%)' }}
                    />
                    <div 
                        className="absolute -bottom-16 -right-16 w-48 sm:w-56 h-48 sm:h-56 rounded-full blur-3xl pointer-events-none opacity-60"
                        style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, transparent 70%)' }}
                    />

                    {/* Subtle Inner Mesh Texture */}
                    <div 
                        className="absolute inset-0 opacity-[0.03] pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                            backgroundSize: '20px 20px',
                        }}
                    />

                    <div className="relative z-10 space-y-4 sm:space-y-6 flex flex-col items-center justify-center">
                        
                        {/* Top Micro Pill Badge */}
                        <div 
                            className="inline-flex items-center gap-1.5 px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest border backdrop-blur-md"
                            style={{
                                background: isLight ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                borderColor: 'rgba(245, 158, 11, 0.3)',
                            }}
                        >
                            <span>👑</span>
                            <span>HALL OF FAME</span>
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
                            <div className="relative transform group-hover:scale-108 group-hover:-translate-y-1 transition-transform duration-500 ease-out">
                                <img 
                                    src="/golden-trophy.png" 
                                    alt="Golden Winner Trophy" 
                                    className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain"
                                    style={{
                                        filter: 'drop-shadow(0 12px 20px rgba(245, 158, 11, 0.4)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25))',
                                    }}
                                    draggable="false"
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
                                Who was the <span className="font-extrabold text-[#38bdf8]" style={{ textShadow: '0 0 16px rgba(56, 189, 248, 0.5)' }}>fastest payer</span> in your batch?
                            </h2>
                            <p 
                                className="text-xs sm:text-sm font-medium leading-relaxed"
                                style={{ color: isLight ? '#64748b' : '#94a3b8' }}
                            >
                                Discover the completed{' '}
                                <span 
                                    className="inline-block px-2 sm:px-2.5 py-0.5 rounded-md font-bold text-amber-500 border border-amber-500/30"
                                    style={{ background: isLight ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.15)' }}
                                >
                                    {MONTH_FULL[prevMonth - 1]} {prevYear}
                                </span>{' '}
                                billing cycle champions & check your rank!
                            </p>
                        </div>

                        {/* Flagship 3D Shimmer Action Button with Inline Progress Loader */}
                        <div className="pt-1 sm:pt-2 w-full sm:w-auto">
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
                                        <span className="tracking-wide">⚡ REVEAL LEADERBOARD</span>
                                        <span 
                                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] sm:text-xs group-hover/btn:translate-x-1 transition-transform"
                                            style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3)' }}
                                        >
                                            ➔
                                        </span>
                                    </>
                                )}
                            </button>
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
            {/* Date Filters + Reset Reveal Button */}
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
                {/* Gateway Reset Icon Button */}
                <button
                    onClick={() => setIsRevealed(false)}
                    title="Return to Reveal Gateway"
                    className="flex items-center justify-center w-10 h-10 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{
                        backgroundColor: 'var(--st-icon-bg)',
                        border: '1px solid var(--st-input-border)',
                        color: 'var(--st-text-secondary)',
                    }}
                >
                    <span className="material-symbols-outlined text-lg">replay</span>
                </button>
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
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl overflow-hidden shrink-0" style={{ backgroundColor: isLight ? '#e2e8f0' : '#222532' }}>
                                    <ProfilePicture size={44} picUrl={entry.profile_pic_url} name={entry.student_name} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-xs sm:text-sm truncate" style={{ color: 'var(--st-text-primary)' }}>{entry.student_name}</p>
                                </div>
                                <div className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full shrink-0"
                                    style={{ backgroundColor: entry.rank <= 5 ? 'var(--st-accent-bg)' : 'var(--st-icon-bg)' }}
                                >
                                    {entry.rank <= 5 && (
                                        <span className="material-symbols-outlined text-xs" style={{ color: 'var(--st-accent)' }}>trending_up</span>
                                    )}
                                    <span className="text-[9px] sm:text-[10px] font-bold" style={{ color: entry.rank <= 5 ? 'var(--st-accent)' : 'var(--st-text-secondary)' }}>
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

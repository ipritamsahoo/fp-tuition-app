import { useState, useEffect, useCallback } from "react";
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

// ── Podium Avatar ──
function PodiumAvatar({ entry, rank, size = "lg" }) {
    const { theme } = useStudentTheme();
    const isLight = theme === "light";
    const sizeMap = { lg: 96, md: 64 };
    const px = sizeMap[size] || 64;

    const borderGradients = {
        1: isLight ? "from-[#7c3aed] via-[#0d9488] to-[#6d28d9]" : "from-[#c799ff] via-[#4af8e3] to-[#bc87fe]",
        2: "from-slate-400 to-transparent",
        3: "from-[#ff9dac] to-transparent",
    };

    const rankBadges = {
        1: isLight
            ? "bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white ring-4 ring-[#eef2ff]"
            : "bg-gradient-to-br from-[#c799ff] to-[#bc87fe] text-[#340064] ring-4 ring-[#0c0e17]",
        2: isLight
            ? "bg-slate-400 text-white ring-2 ring-[#eef2ff]"
            : "bg-slate-400 text-slate-900 ring-2 ring-[#0c0e17]",
        3: isLight
            ? "bg-[#fb899c] text-white ring-2 ring-[#eef2ff]"
            : "bg-[#fb899c] text-[#5b0a22] ring-2 ring-[#0c0e17]",
    };

    return (
        <div className="flex flex-col items-center space-y-3">
            <div className={`relative ${rank === 1 ? "scale-110" : ""}`}>
                {/* Crown for #1 */}
                {rank === 1 && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                        <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1", color: isLight ? '#7c3aed' : '#c799ff' }}>
                            workspace_premium
                        </span>
                    </div>
                )}
                {/* Gradient ring */}
                <div className={`rounded-full ${rank === 1 ? "p-[3px]" : "p-[2px]"} bg-gradient-to-b ${borderGradients[rank]} shadow-lg ${rank === 1 ? (isLight ? "shadow-[#7c3aed]/20" : "shadow-[#c799ff]/20") : rank === 3 ? "shadow-[#ff9dac]/20" : "shadow-slate-900/40"}`}
                    style={{ width: px + 6, height: px + 6 }}>
                    <div className="w-full h-full rounded-full overflow-hidden" style={{ border: `${rank === 1 ? 4 : 2}px solid ${isLight ? '#eef2ff' : '#0c0e17'}` }}>
                        <ProfilePicture size={px} picUrl={entry.profile_pic_url} name={entry.student_name} />
                    </div>
                </div>
                {/* Rank badge */}
                <div className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full font-bold
                    ${rankBadges[rank]}
                    ${rank === 1 ? "w-8 h-8 text-xs" : "w-6 h-6 text-[10px]"}`}>
                    {rank}
                </div>
            </div>
            <div className="text-center">
                <p className={`font-semibold truncate max-w-[100px] ${rank === 1 ? "text-sm" : "text-xs"}`}
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
    
    // Memory Cache
    const now = new Date();
    const defaultMonth = now.getMonth() + 1;
    const defaultYear = now.getFullYear();

    const [month, setMonth] = useState(defaultMonth);
    const [year, setYear] = useState(defaultYear);
    const [hasInit, setHasInit] = useState(false);

    // Get the cached value for the currently selected month and year
    const cacheKey = `student_leaderboard_${month}_${year}`;
    const cachedData = getCache(cacheKey);

    const [data, setData] = useState(cachedData || null);
    const [loading, setLoading] = useState(!cachedData);
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
    }, []); // Stable — no volatile state dependencies

    useEffect(() => {
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
    }, [month, year, fetchLeaderboard]);

    const yearOptions = getYearOptions();

    if (loading) {
        return (
            <div className="p-6">
                <GenericListSkeleton />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
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

    const top3 = data.top5.filter(e => e.rank <= 3);
    const rank4and5 = data.top5.filter(e => e.rank > 3);
    const podiumOrder = [
        { rank: 2, entry: top3.find(e => e.rank === 2) },
        { rank: 1, entry: top3.find(e => e.rank === 1) },
        { rank: 3, entry: top3.find(e => e.rank === 3) },
    ];
    
    const hasAnyPodium = top3.length > 0;
    const primaryColor = isLight ? '#7c3aed' : '#c799ff';

    return (
        <div className="space-y-8 pt-2 md:pt-0">
            {/* Date Filters */}
            <div className="flex flex-wrap justify-center gap-2 relative z-20">
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
                <section className="grid grid-cols-3 gap-4 items-end pb-4">
                    {podiumOrder.map((slot) => (
                        <div key={slot.rank}>
                            {slot.entry ? (
                                <PodiumAvatar entry={slot.entry} rank={slot.rank} size={slot.rank === 1 ? "lg" : "md"} />
                            ) : (
                                <div className="flex flex-col items-center justify-end h-32 opacity-20">
                                    <div className="w-16 h-16 rounded-full border border-dashed" style={{ borderColor: 'var(--st-input-border)' }} />
                                </div>
                            )}
                        </div>
                    ))}
                </section>
            ) : (
                <section className="text-center py-10">
                    <span className="material-symbols-outlined text-6xl mb-3 block" style={{ color: 'var(--st-text-muted)' }}>emoji_events</span>
                    <p className="text-lg font-medium" style={{ color: 'var(--st-text-secondary)' }}>No paid entries yet</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--st-text-muted)' }}>Be the first to pay and claim the #1 spot!</p>
                </section>
            )}

            {/* Ranking Details (#4, #5) */}
            {rank4and5.length > 0 && (
                <section className="space-y-4">
                    <div className="space-y-3">
                        {rank4and5.map((entry, idx) => (
                            <div key={entry.rank}
                                className="glass-card-student rounded-3xl p-4 flex items-center gap-4 transition-all"
                                style={{
                                    transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden"
                                }}>
                                <span className="font-bold w-6" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-secondary)' }}>
                                    #{entry.rank}
                                </span>
                                <div className="w-12 h-12 rounded-2xl overflow-hidden" style={{ backgroundColor: isLight ? '#e2e8f0' : '#222532' }}>
                                    <ProfilePicture size={48} picUrl={entry.profile_pic_url} name={entry.student_name} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold" style={{ color: 'var(--st-text-primary)' }}>{entry.student_name}</p>
                                </div>
                                <div className="flex items-center gap-1 px-3 py-1 rounded-full"
                                    style={{ backgroundColor: entry.rank <= 5 ? 'var(--st-accent-bg)' : 'var(--st-icon-bg)' }}
                                >
                                    {entry.rank <= 5 && (
                                        <span className="material-symbols-outlined text-xs" style={{ color: 'var(--st-accent)' }}>trending_up</span>
                                    )}
                                    <span className="text-[10px] font-bold" style={{ color: entry.rank <= 5 ? 'var(--st-accent)' : 'var(--st-text-secondary)' }}>
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

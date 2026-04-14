import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getYearOptions } from "@/lib/yearOptions";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Glass Card ──
function GlassCard({ children, className = "", style = {} }) {
    return (
        <div
            className={`rounded-[2rem] border border-white/[0.08] ${className}`}
            style={{
                background: "rgba(23, 25, 36, 0.4)",
                backdropFilter: "blur(24px) saturate(160%)",
                WebkitBackdropFilter: "blur(24px) saturate(160%)",
                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
                ...style,
            }}
        >
            {children}
        </div>
    );
}



// ── Student Initial Avatar ──
function InitialAvatar({ name, size = 36, className = "" }) {
    const initials = (name || "?")
        .split(" ")
        .map((w) => w.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase();
    const palettes = [
        { bg: "bg-[#3b82f6]/20", text: "text-[#3b82f6]", border: "border-[#3b82f6]/20" },
        { bg: "bg-[#4af8e3]/20", text: "text-[#4af8e3]", border: "border-[#4af8e3]/20" },
        { bg: "bg-[#ff9dac]/20", text: "text-[#ff9dac]", border: "border-[#ff9dac]/20" },
        { bg: "bg-[#464752]/20", text: "text-[#f0f0fd]", border: "border-[#464752]/20" },
        { bg: "bg-[#33e9d5]/20", text: "text-[#33e9d5]", border: "border-[#33e9d5]/20" },
    ];
    const p = palettes[(name || "").charCodeAt(0) % palettes.length];
    return (
        <div
            className={`rounded-full ${p.bg} ${p.text} ${p.border} border flex items-center justify-center font-bold backdrop-blur-md ${className}`}
            style={{ width: size, height: size, minWidth: size, fontSize: size * 0.3 }}
        >
            {initials}
        </div>
    );
}

function TeacherDistributionContent() {
    const { user } = useAuth();
    const now = new Date();
    
    // Attempt cache restoration based on default filters
    const defaultMonth = now.getMonth() + 1;
    const defaultYear = now.getFullYear();
    const [month, setMonth] = useState(defaultMonth);
    const [year, setYear] = useState(defaultYear);
    
    // We cannot fully predict the initial batch filter without making the first call,
    // but if we cached it before, we can use it.
    const cacheKeyInit = `teacher_distribution_${defaultMonth}_${defaultYear}_init`;
    const cachedData = getCache(cacheKeyInit);
    
    const [batchFilter, setBatchFilter] = useState("");
    const [data, setData] = useState(cachedData || null);
    const [loading, setLoading] = useState(!cachedData);
    const [error, setError] = useState("");
    const [expandedDate, setExpandedDate] = useState(null);
    const [activeTab, setActiveTab] = useState("datewise");

    const fetchDistribution = useCallback(async () => {
        const cacheKeyCall = `teacher_distribution_${month}_${year}_${batchFilter || 'init'}`;
        const currentCache = getCache(cacheKeyCall);

        if (currentCache) {
            setData(prev => JSON.stringify(prev) !== JSON.stringify(currentCache) ? currentCache : prev);
            setLoading(false);
        } else {
            setData(null);
            setLoading(true);
        }

        setError("");
        try {
            let url = `/api/teacher/distribution?month=${month}&year=${year}`;
            if (batchFilter) url += `&batch_id=${batchFilter}`;
            
            const res = await api.get(url);
            
            if (JSON.stringify(currentCache) !== JSON.stringify(res)) {
                setData(res);
                setCache(cacheKeyCall, res);
                if (!batchFilter) setCache(`teacher_distribution_${month}_${year}_init`, res);
            }
            
            // Auto-select first batch if none selected yet
            if (!batchFilter && res.batches && res.batches.length > 0) {
                setBatchFilter(res.batches[0].id);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [month, year, batchFilter]);

    useEffect(() => {
        fetchDistribution();
    }, [fetchDistribution]);

    const yearOptions = getYearOptions();

    const sortedDates = data?.dates ? [...data.dates].sort((a, b) => b.date.localeCompare(a.date)) : [];

    // Collect unique teacher names for the ledger
    const allTeachers = (() => {
        if (sortedDates.length === 0) return [];
        const map = new Map();
        for (const d of sortedDates) {
            for (const t of d.teachers) {
                if (!map.has(t.uid)) map.set(t.uid, t.name);
            }
        }
        return Array.from(map.entries()).map(([uid, name]) => ({ uid, name }));
    })();

    const formatDateStr = (dateStr) => {
        try {
            const d = new Date(dateStr + "T00:00:00");
            return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="space-y-6">
            {/* ── Title ── */}
            {/* ── Title ── */}
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-2 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        My Earnings
                    </h1>
                </div>
            </div>

            {/* ── Filters ── */}
            {/* ── Filters ── */}
            <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-5 transition-colors">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <ModernSelect
                        icon="calendar_month"
                        value={month}
                        options={MONTHS.map((m, i) => ({ value: i + 1, label: MONTHS_SHORT[i] }))}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="w-full"
                    />
                    <ModernSelect
                        icon="event"
                        value={year}
                        options={yearOptions}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="w-full"
                    />
                    {data && data.batches && data.batches.length > 0 && (
                        <ModernSelect
                            icon="school"
                            value={batchFilter}
                            options={data.batches}
                            onChange={(e) => setBatchFilter(e.target.value)}
                            className="col-span-2 w-full"
                        />
                    )}
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="p-4 rounded-2xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff9dac] text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError("")} className="ml-2 text-[#ff6e84] hover:text-white cursor-pointer">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}

            {loading ? (
                <div className="p-6">
                    <GenericListSkeleton />
                </div>
            ) : data ? (
                <>
                    {/* ── Summary Bento Grid ── */}
                    <section className="grid grid-cols-2 gap-4">
                        {/* My Earnings — Full Width */}
                        <GlassCard className="col-span-2 p-6 relative overflow-hidden group hover:border-[#4af8e3]/30 transition-colors" style={{ background: "linear-gradient(135deg, rgba(28, 31, 43, 0.8) 0%, rgba(28, 31, 43, 0.4) 100%)" }}>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[#4af8e3]/10 blur-[80px] -mr-32 -mt-32 group-hover:bg-[#4af8e3]/20 transition-all duration-700" />
                            <p className="text-[#aaaab7] text-xs font-bold uppercase tracking-[0.2em] mb-4 opacity-80">My Cumulative Earnings</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[#4af8e3] text-2xl font-bold">₹</span>
                                <span
                                    className="text-white font-extrabold text-5xl md:text-6xl tracking-tight drop-shadow-2xl"
                                    style={{ fontFamily: "'Manrope', sans-serif" }}
                                >
                                    {(data.my_total || 0).toLocaleString()}
                                </span>
                            </div>
                        </GlassCard>

                        {/* Total Collected */}
                        <GlassCard className="p-5 hover:bg-[#171924]/60 transition-colors border-white/5">
                            <p className="text-[#aaaab7] text-[10px] font-bold uppercase tracking-[0.15em] mb-3 opacity-70">Total Distributed</p>
                            <p className="text-[#f0f0fd] font-extrabold text-2xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                ₹{(data.total_collected || 0).toLocaleString()}
                            </p>
                            <div className="w-8 h-1 rounded-full bg-[#3b82f6]/40 mt-3" />
                        </GlassCard>

                        {/* Teachers Sharing */}
                        <GlassCard className="p-5 hover:bg-[#171924]/60 transition-colors border-white/5">
                            <p className="text-[#aaaab7] text-[10px] font-bold uppercase tracking-[0.15em] mb-3 opacity-70">Teachers Shared</p>
                            <p className="text-[#f0f0fd] font-extrabold text-2xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {data.total_teachers_shared || 0}
                            </p>
                            <div className="w-8 h-1 rounded-full bg-[#c799ff]/40 mt-3" />
                        </GlassCard>
                    </section>

                    {/* ═══ Tab Bar ═══ */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-6 p-1.5 rounded-[1.25rem] bg-[#171924]/60 backdrop-blur-[20px] border border-[#464752]/40" style={{ transform: "translateZ(0)", isolation: "isolate", willChange: "transform", backfaceVisibility: "hidden" }}>
                        <button
                            onClick={() => setActiveTab("datewise")}
                            className={`flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer flex items-center justify-center gap-2
                                ${activeTab === "datewise"
                                    ? "bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/20 shadow-[0_4px_15px_rgba(199,153,255,0.1)]"
                                    : "text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 border border-transparent"
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">calendar_month</span> Date-wise Distribution
                        </button>
                        <button
                            onClick={() => setActiveTab("earnings")}
                            className={`flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer flex items-center justify-center gap-2
                                ${activeTab === "earnings"
                                    ? "bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/20 shadow-[0_4px_15px_rgba(199,153,255,0.1)]"
                                    : "text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 border border-transparent"
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">account_balance_wallet</span> Teacher Earnings
                        </button>
                    </div>

                    {/* ═══ Tab 1: Date-wise Distribution ═══ */}
                    {activeTab === "datewise" && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    Distribution History
                                </h2>
                            </div>
                            {sortedDates.length > 0 ? (
                                <div className="space-y-4">
                                    {sortedDates.map((dist, distIdx) => {
                                        const isExpanded = expandedDate === dist.date;
                                        const formattedDate = formatDateStr(dist.date);
                                        return (
                                            <div key={dist.date} className={`relative bg-[#171924]/60 backdrop-blur-[20px] rounded-3xl overflow-hidden border transition-all ${dist.settled ? "border-[#4af8e3]/30 shadow-[0_4px_15px_rgba(74,248,227,0.05)]" : "border-[#737580]/10 hover:border-[#c799ff]/30 shadow-lg hover:shadow-[0_4px_15px_rgba(199,153,255,0.05)]"}`}>
                                                <button
                                                    onClick={() => setExpandedDate(isExpanded ? null : dist.date)}
                                                    className={`absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-[#aaaab7] transition-all duration-300 cursor-pointer hover:bg-white/10 hover:text-white z-10 ${isExpanded ? "rotate-180 bg-white/10 text-white border-white/10" : ""}`}>
                                                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                                                </button>
                                                <div className="flex flex-col md:flex-row md:items-center justify-between p-4 sm:p-6 pr-14 gap-3 md:gap-4">
                                                    <button
                                                        onClick={() => setExpandedDate(isExpanded ? null : dist.date)}
                                                        className="flex items-center gap-3 md:gap-4 cursor-pointer flex-1 min-w-0 group"
                                                    >
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${dist.settled
                                                            ? "bg-[#4af8e3]/10 text-[#4af8e3]"
                                                            : "bg-[#c799ff]/10 text-[#c799ff]"
                                                            }`}>
                                                            <span className="material-symbols-outlined text-[24px]">
                                                                {dist.settled ? "task_alt" : "event"}
                                                            </span>
                                                        </div>
                                                        <div className="text-left flex-1 min-w-0">
                                                            <p className="text-[#f0f0fd] font-bold text-sm md:text-lg tracking-wide truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>{formattedDate}</p>
                                                            <p className="text-[#aaaab7] text-[11px] md:text-xs font-medium tracking-wide mt-0.5 md:mt-1 flex items-center gap-1.5 md:gap-2 flex-wrap">
                                                                <span>{dist.payments_count} payment(s)</span>
                                                            </p>
                                                        </div>
                                                    </button>
                                                    <div className="flex items-center gap-2 border-t border-[#464752]/30 md:border-t-0 pt-3 md:pt-0">
                                                        <span className="px-3 md:px-4 py-1.5 rounded-full bg-[#4af8e3]/10 border border-[#4af8e3]/30 text-[#4af8e3] text-xs md:text-sm font-bold tracking-widest drop-shadow-md" style={{ boxShadow: "0 0 8px rgba(74,248,227,0.2)"}}>
                                                            ₹{dist.total.toLocaleString()}
                                                        </span>
                                                        {dist.settled ? (
                                                            <span className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-[#4af8e3]/5 border border-[#4af8e3]/20 text-[#4af8e3]/60 text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-1 md:gap-1.5 opacity-80">
                                                                <span className="material-symbols-outlined text-[14px] md:text-[16px]">lock</span> Settled
                                                            </span>
                                                        ) : (
                                                            <span className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-amber-400/5 border border-amber-400/20 text-amber-400/60 text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-1 md:gap-1.5 opacity-80">
                                                                <span className="material-symbols-outlined text-[14px] md:text-[16px]">hourglass_empty</span> Pending
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Expanded Content */}
                                                <div className={`transition-all overflow-hidden ${isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
                                                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 border-t border-[#464752]/30 pt-4 bg-black/10">
                                                        <p className="text-[#c799ff] text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-sm">group</span> Student Payments
                                                        </p>
                                                        <div className="space-y-4">
                                                            {/* Payments */}
                                                            <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5">
                                                                <table className="w-full text-left text-sm">
                                                                    <thead className="bg-white/5">
                                                                        <tr>
                                                                            <th className="px-4 py-2 text-[11px] font-bold text-[#aaaab7] uppercase tracking-widest">Student</th>
                                                                            <th className="px-4 py-2 text-[11px] font-bold text-[#aaaab7] uppercase tracking-widest text-right">Amount</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-white/5">
                                                                        {dist.payments.map((p, idx) => (
                                                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                                                <td className="px-4 py-3 text-[#f0f0fd]">{p.student_name}</td>
                                                                                <td className="px-4 py-3 text-[#4af8e3] font-bold text-right">₹{(p.amount || 0).toLocaleString()}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <GlassCard className="p-12 text-center flex flex-col items-center">
                                    <span className="material-symbols-outlined text-[64px] text-[#464752] mb-4">payments</span>
                                    <p className="text-[#f0f0fd] font-bold text-xl mb-1">No earnings in {MONTHS[month - 1]} {year}</p>
                                    <p className="text-[#aaaab7] text-sm">Earnings will appear once payments are approved.</p>
                                </GlassCard>
                            )}
                        </div>
                    )}

                    {/* ═══ Tab 2: Teacher Earnings Ledger ═══ */}
                    {activeTab === "earnings" && (
                        <div>
                            {data.dates && data.dates.length > 0 && allTeachers.length > 0 ? (
                                <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-3xl overflow-hidden shadow-xl" style={{ maxHeight: "calc(100vh - 380px)", display: "flex", flexDirection: "column" }}>
                                    <div className="overflow-auto flex-1 custom-scrollbar">
                                        <table className="w-full border-collapse min-w-[600px]">
                                            <thead className="bg-[#0c0e17]/80 backdrop-blur-xl sticky top-0 z-20">
                                                <tr className="border-b border-[#464752]/40">
                                                    <th className="px-5 py-4 text-left text-xs font-bold text-[#4af8e3] uppercase tracking-wider whitespace-nowrap border-r border-[#464752]/40 min-w-[140px] sticky left-0 bg-[#0c0e17]/80 backdrop-blur-xl z-30 shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                                                        Monthly Total
                                                    </th>
                                                    {allTeachers.map((t) => {
                                                        const teacherTotal = sortedDates.reduce((s, d) => {
                                                            const found = d.teachers.find((x) => x.uid === t.uid);
                                                            return s + (found ? found.amount : 0);
                                                        }, 0);
                                                        return (
                                                            <th key={t.uid} className="px-5 py-4 text-center text-sm font-bold text-[#4af8e3] tracking-widest border-r border-[#464752]/40 min-w-[130px]">
                                                                ₹{teacherTotal.toLocaleString()}
                                                            </th>
                                                        );
                                                    })}
                                                    <th className="px-5 py-4 min-w-[110px]"></th>
                                                </tr>
                                                <tr className="border-b border-[#464752]/40 bg-black/20">
                                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-[#aaaab7] uppercase tracking-widest whitespace-nowrap border-r border-[#464752]/40 sticky left-0 bg-[#0c0e17]/80 backdrop-blur-xl z-30 shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                                                        Date
                                                    </th>
                                                    {allTeachers.map((t) => (
                                                        <th key={t.uid} className="px-5 py-3 text-center text-[10px] font-bold text-[#aaaab7] uppercase tracking-widest border-r border-[#464752]/40">
                                                            {t.name}
                                                        </th>
                                                    ))}
                                                    <th className="px-5 py-3 text-center text-[10px] font-bold text-[#aaaab7] uppercase tracking-widest">
                                                        Status
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedDates.map((dist) => {
                                                    const formattedDate = formatDateStr(dist.date);
                                                    const teacherMap = {};
                                                    for (const t of dist.teachers) teacherMap[t.uid] = t.amount;
                                                    return (
                                                        <tr key={dist.date} className="border-b border-[#464752]/20 hover:bg-white/5 transition-colors group">
                                                            <td className="px-5 py-4 text-sm text-[#f0f0fd] font-bold whitespace-nowrap border-r border-[#464752]/40 sticky left-0 bg-[#171924]/80 backdrop-blur-xl group-hover:bg-[#1f2231]/80 transition-colors z-10 shadow-[4px_0_10px_rgba(0,0,0,0.15)]" style={{ fontFamily: "'Manrope', sans-serif" }}>{formattedDate}</td>
                                                            {allTeachers.map((t) => (
                                                                <td key={t.uid} className="px-5 py-4 border-r border-[#464752]/40 text-center bg-black/10 text-sm font-semibold text-[#c799ff] tracking-wide">
                                                                    {(teacherMap[t.uid] || 0) > 0 ? `₹${teacherMap[t.uid].toLocaleString()}` : <span className="text-[#aaaab7]/50 text-xs">—</span>}
                                                                </td>
                                                            ))}
                                                            <td className="px-5 py-4 text-center bg-black/10">
                                                                {dist.settled ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4af8e3]/10 border border-[#4af8e3]/30 text-[#4af8e3] text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                                                                        <span className="material-symbols-outlined text-[14px]">lock</span> Settled
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                                                                        <span className="material-symbols-outlined text-[14px]">hourglass_empty</span> Pending
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <GlassCard className="p-12 text-center flex flex-col items-center">
                                    <span className="material-symbols-outlined text-[64px] text-[#464752] mb-4">account_balance_wallet</span>
                                    <p className="text-[#f0f0fd] font-bold text-xl mb-1">No teacher earnings in {MONTHS[month - 1]} {year}</p>
                                    <p className="text-[#aaaab7] text-sm">Earnings will appear once payments are approved.</p>
                                </GlassCard>
                            )}
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
}

export default function TeacherDistribution() {
    return (
        <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherLayout>
                <style dangerouslySetInnerHTML={{__html: `
                    .custom-scrollbar::-webkit-scrollbar {
                        height: 8px;
                        width: 8px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: rgba(12, 14, 23, 0.5);
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(70, 71, 82, 0.8);
                        border-radius: 4px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: rgba(199, 153, 255, 0.8);
                    }
                `}} />
                <TeacherDistributionContent />
            </TeacherLayout>
        </ProtectedRoute>
    );
}

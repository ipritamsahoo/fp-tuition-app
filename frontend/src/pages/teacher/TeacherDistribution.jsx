import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useTeacherTheme } from "@/context/TeacherThemeContext";
import { getYearOptions, getPreviousMonth } from "@/lib/yearOptions";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { TeacherDistributionSkeleton, TeacherDistributionPageSkeleton } from "@/components/Skeletons";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const groupPayments = (payments) => {
    if (!payments) return [];
    const grouped = {};
    const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    payments.forEach(p => {
        const key = p.student_id || p.student_name;
        if (!grouped[key]) {
            grouped[key] = {
                student_name: p.student_name,
                amount: 0,
                billingCycles: []
            };
        }
        grouped[key].amount += (p.amount || 0);
        const cycle = p.month ? `${MONTHS_SHORT[p.month - 1]} ${p.year}` : "N/A";
        grouped[key].billingCycles.push(cycle);
    });

    return Object.values(grouped);
};

// ── Glass Card ──
function GlassCard({ children, className = "", style = {}, ...props }) {
    return (
        <div
            className={`rounded-[2rem] border ${className}`}
            style={{
                background: "var(--tt-card-bg, rgba(23, 25, 36, 0.4))",
                borderColor: "var(--tt-card-border, rgba(255, 255, 255, 0.08))",
                boxShadow: "var(--tt-card-shadow, 0 8px 32px 0 rgba(0, 0, 0, 0.37))",
                backdropFilter: "blur(24px) saturate(160%)",
                WebkitBackdropFilter: "blur(24px) saturate(160%)",
                ...style,
            }}
            {...props}
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
    const { theme } = useTeacherTheme();
    const isLight = theme === "light";

    const now = new Date();
    const defaultMonth = now.getMonth() + 1;
    const defaultYear = now.getFullYear();
    const [month, setMonth] = useState(defaultMonth);
    const [year, setYear] = useState(defaultYear);
    
    const cacheKeyBatches = "teacher_all_batches";
    const cachedBatches = getCache(cacheKeyBatches);
    const [batches, setBatches] = useState([]);
    const [batchesLoading, setBatchesLoading] = useState(true);
    const [batchFilter, setBatchFilter] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expandedDate, setExpandedDate] = useState(null);
    const [activeTab, setActiveTab] = useState("datewise");

    // Fetch batches for dropdown
    useEffect(() => {
        const cached = getCache(cacheKeyBatches);
        if (cached) {
            setBatches(cached);
            const timer = setTimeout(() => {
                setBatchesLoading(false);
            }, 200);
            return () => clearTimeout(timer);
        }
        setBatchesLoading(true);
        api.get("/api/teacher/batches").then((res) => {
            setBatches(res);
            setCache(cacheKeyBatches, res);
        }).catch(() => {}).finally(() => {
            setBatchesLoading(false);
        });
    }, [cacheKeyBatches]);

    const fetchDistribution = useCallback(async () => {
        if (!batchFilter) {
            setData(null);
            setLoading(false);
            return;
        }

        const cacheKeyCall = `teacher_distribution_${month}_${year}_${batchFilter}`;
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
            let url = `/api/teacher/distribution?month=${month}&year=${year}&batch_id=${batchFilter}`;
            const res = await api.get(url);
            
            if (JSON.stringify(currentCache) !== JSON.stringify(res)) {
                setData(res);
                setCache(cacheKeyCall, res);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message || "Failed to load distribution breakdown.");
            }
        } finally {
            setLoading(false);
        }
    }, [month, year, batchFilter]);

    useEffect(() => {
        fetchDistribution();
    }, [fetchDistribution]);

    const formatDateStr = (dateStr) => {
        if (!dateStr) return "—";
        try {
            const parts = dateStr.split("-");
            if (parts.length !== 3) return dateStr;
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return dateStr;
        }
    };

    const yearOptions = getYearOptions();
    const sortedDates = data?.dates ? [...data.dates].sort((a, b) => b.date.localeCompare(a.date)) : [];

    // Unique teachers across all records
    const allTeachers = [];
    if (data?.dates) {
        const seen = new Set();
        data.dates.forEach((d) => {
            d.teachers.forEach((t) => {
                if (!seen.has(t.uid)) {
                    seen.add(t.uid);
                    allTeachers.push(t);
                }
            });
        });
    }



    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                    My Earnings
                </h1>
            </div>

            {/* Filters */}
            <section>
                <div
                    className="rounded-[2rem] p-5 w-full border"
                    style={{
                        background: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(23, 25, 36, 0.6)',
                        borderColor: isLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(115, 117, 128, 0.1)',
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        transform: "translateZ(0)",
                        isolation: "isolate",
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden"
                    }}
                >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                        {/* Batch selection */}
                        <div className="col-span-2 md:order-3 md:col-span-2">
                            <ModernSelect
                                value={batchFilter}
                                options={batches}
                                placeholder="Select Batch"
                                onChange={(e) => { setBatchFilter(e.target.value); setData(null); }}
                                className="w-full"
                                theme={theme}
                            />
                        </div>

                        {/* Month selection */}
                        <div className="col-span-1 md:order-1">
                            <ModernSelect
                                value={month}
                                options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                                onChange={(e) => { setMonth(parseInt(e.target.value)); setData(null); }}
                                className="w-full"
                                theme={theme}
                            />
                        </div>

                        {/* Year selection */}
                        <div className="col-span-1 md:order-2">
                            <ModernSelect
                                value={year}
                                options={yearOptions}
                                onChange={(e) => { setYear(parseInt(e.target.value)); setData(null); }}
                                className="w-full"
                                theme={theme}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Error handling */}
            {error && (
                <div className="p-4 rounded-xl border text-sm flex items-center justify-between" style={{ backgroundColor: 'rgba(255, 110, 132, 0.1)', borderColor: 'rgba(255, 110, 132, 0.2)', color: 'var(--tt-error)' }}>
                    <span>{error}</span>
                    <button onClick={() => setError("")} className="ml-2 hover:opacity-80 transition-colors cursor-pointer text-current">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            )}

            {loading ? (
                <TeacherDistributionSkeleton />
            ) : !batchFilter ? (
                <GlassCard className="p-12 text-center flex flex-col items-center">
                    <span className="material-symbols-outlined text-[64px] mb-4" style={{ color: 'var(--tt-text-muted)' }}>account_balance_wallet</span>
                    <p className="font-bold text-xl mb-1" style={{ color: 'var(--tt-text-primary)' }}>Select Batch</p>
                    <p className="text-sm" style={{ color: 'var(--tt-text-secondary)' }}>Please select a batch to view its earnings and distribution breakdown.</p>
                </GlassCard>
            ) : data ? (
                <>
                    {/* ── Summary Bento Grid ── */}
                    <section className="grid grid-cols-2 gap-4">
                        {/* My Earnings — Full Width */}
                        <GlassCard className="col-span-2 p-6 relative overflow-hidden group hover:border-[#4af8e3]/30 transition-colors" style={{ background: isLight ? "linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.45) 100%)" : "linear-gradient(135deg, rgba(28, 31, 43, 0.8) 0%, rgba(28, 31, 43, 0.4) 100%)" }}>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[#4af8e3]/10 blur-[80px] -mr-32 -mt-32 group-hover:bg-[#4af8e3]/20 transition-all duration-700" />
                            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4 opacity-80" style={{ color: 'var(--tt-text-secondary)' }}>My Cumulative Earnings</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold" style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>₹</span>
                                <span
                                    className="font-extrabold text-5xl md:text-6xl tracking-tight drop-shadow-2xl"
                                    style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}
                                >
                                    {(data.my_total || 0).toLocaleString()}
                                </span>
                            </div>
                        </GlassCard>

                        {/* Total Distributed */}
                        <GlassCard className="p-5" style={{ background: isLight ? 'rgba(255,255,255,0.4)' : 'rgba(23, 25, 36, 0.4)', borderColor: isLight ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.05)' }}>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 opacity-70" style={{ color: 'var(--tt-text-secondary)' }}>Total Distributed</p>
                            <p className="font-extrabold text-2xl" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                                ₹{(data.total_collected || 0).toLocaleString()}
                            </p>
                            <div className="w-8 h-1 rounded-full bg-[#3b82f6]/40 mt-3" />
                        </GlassCard>

                        {/* Teachers Sharing */}
                        <GlassCard className="p-5" style={{ background: isLight ? 'rgba(255,255,255,0.4)' : 'rgba(23, 25, 36, 0.4)', borderColor: isLight ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.05)' }}>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 opacity-70" style={{ color: 'var(--tt-text-secondary)' }}>Teachers Shared</p>
                            <p className="font-extrabold text-2xl" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                                {data.total_teachers_shared || 0}
                            </p>
                            <div className="w-8 h-1 rounded-full bg-[#c799ff]/40 mt-3" />
                        </GlassCard>
                    </section>

                    {/* ═══ Tab Bar ═══ */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-6 p-1.5 rounded-[1.25rem] border" style={{ background: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(23, 25, 36, 0.6)', borderColor: isLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(70, 71, 82, 0.4)', transform: "translateZ(0)", isolation: "isolate", willChange: "transform", backfaceVisibility: "hidden" }}>
                        <button
                            onClick={() => setActiveTab("datewise")}
                            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
                            style={{
                                backgroundColor: activeTab === "datewise" ? (isLight ? 'rgba(124, 58, 237, 0.12)' : 'rgba(199, 153, 255, 0.1)') : 'transparent',
                                borderColor: activeTab === "datewise" ? (isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(199, 153, 255, 0.2)') : 'transparent',
                                borderWidth: 1,
                                borderStyle: 'solid',
                                color: activeTab === "datewise" ? (isLight ? '#7c3aed' : '#c799ff') : 'var(--tt-text-secondary)',
                                boxShadow: activeTab === "datewise" ? (isLight ? '0 4px 15px rgba(124, 58, 237, 0.08)' : '0 4px 15px rgba(199, 153, 255, 0.1)') : 'none',
                            }}
                        >
                            <span className="material-symbols-outlined text-lg">calendar_month</span> Date-wise Distribution
                        </button>
                        <button
                            onClick={() => setActiveTab("earnings")}
                            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
                            style={{
                                backgroundColor: activeTab === "earnings" ? (isLight ? 'rgba(124, 58, 237, 0.12)' : 'rgba(199, 153, 255, 0.1)') : 'transparent',
                                borderColor: activeTab === "earnings" ? (isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(199, 153, 255, 0.2)') : 'transparent',
                                borderWidth: 1,
                                borderStyle: 'solid',
                                color: activeTab === "earnings" ? (isLight ? '#7c3aed' : '#c799ff') : 'var(--tt-text-secondary)',
                                boxShadow: activeTab === "earnings" ? (isLight ? '0 4px 15px rgba(124, 58, 237, 0.08)' : '0 4px 15px rgba(199, 153, 255, 0.1)') : 'none',
                            }}
                        >
                            <span className="material-symbols-outlined text-lg">account_balance_wallet</span> Teacher Earnings
                        </button>
                    </div>

                    {/* ═══ Tab 1: Date-wise Distribution ═══ */}
                    {activeTab === "datewise" && (
                        <div>
                            {sortedDates.length > 0 ? (
                                <div className="space-y-4">
                                    {sortedDates.map((dist, distIdx) => {
                                        const isExpanded = expandedDate === dist.date;
                                        const formattedDate = formatDateStr(dist.date);
                                        return (
                                            <div 
                                                key={dist.date} 
                                                className="relative rounded-3xl overflow-hidden border transition-all"
                                                style={{
                                                    background: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(23, 25, 36, 0.6)',
                                                    borderColor: dist.settled 
                                                        ? (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)') 
                                                        : (isLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(115, 117, 128, 0.1)'),
                                                    borderWidth: 1,
                                                    borderStyle: 'solid',
                                                    backdropFilter: 'blur(20px)',
                                                    WebkitBackdropFilter: 'blur(20px)',
                                                    boxShadow: dist.settled 
                                                        ? (isLight ? '0 4px 15px rgba(13, 148, 136, 0.05)' : '0 4px 15px rgba(74, 248, 227, 0.05)') 
                                                        : '0 10px 25px rgba(0, 0, 0, 0.05)'
                                                }}
                                            >
                                                <button
                                                    onClick={() => setExpandedDate(isExpanded ? null : dist.date)}
                                                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 transition-all duration-300 cursor-pointer hover:bg-white/10 z-10"
                                                    style={{ color: 'var(--tt-text-secondary)', transform: isExpanded ? "rotate(180deg)" : "none" }}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                                                </button>
                                                <div className="flex flex-col md:flex-row md:items-center justify-between p-4 sm:p-6 pr-14 gap-3 md:gap-4">
                                                    <button
                                                        onClick={() => setExpandedDate(isExpanded ? null : dist.date)}
                                                        className="flex items-center gap-3 md:gap-4 cursor-pointer flex-1 min-w-0 group"
                                                    >
                                                        <div 
                                                            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                                                            style={{
                                                                backgroundColor: dist.settled
                                                                    ? (isLight ? 'rgba(13, 148, 136, 0.12)' : 'rgba(74, 248, 227, 0.1)')
                                                                    : (isLight ? 'rgba(124, 58, 237, 0.12)' : 'rgba(199, 153, 255, 0.1)'),
                                                                color: dist.settled
                                                                    ? (isLight ? '#0d9488' : '#4af8e3')
                                                                    : (isLight ? '#7c3aed' : '#c799ff')
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined text-[24px]">
                                                                {dist.settled ? "task_alt" : "event"}
                                                            </span>
                                                        </div>
                                                        <div className="text-left flex-1 min-w-0">
                                                            <p className="font-bold text-sm md:text-lg tracking-wide truncate" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>{formattedDate}</p>
                                                            <p className="text-[11px] md:text-xs font-medium tracking-wide mt-0.5 md:mt-1 flex items-center gap-1.5 md:gap-2 flex-wrap" style={{ color: 'var(--tt-text-secondary)' }}>
                                                                <span>{dist.payments ? groupPayments(dist.payments).length : 0} student payment(s)</span>
                                                            </p>
                                                        </div>
                                                    </button>
                                                    <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0" style={{ borderTopColor: 'var(--tt-divider)' }}>
                                                        <span 
                                                            className="px-3 md:px-4 py-1.5 rounded-full border text-xs md:text-sm font-bold tracking-widest drop-shadow-md" 
                                                            style={{ 
                                                                backgroundColor: isLight ? 'rgba(13, 148, 136, 0.1)' : 'rgba(74, 248, 227, 0.1)', 
                                                                borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)', 
                                                                color: isLight ? '#0d9488' : '#4af8e3',
                                                                boxShadow: isLight ? "0 0 8px rgba(13,148,136,0.1)" : "0 0 8px rgba(74,248,227,0.2)"
                                                            }}
                                                        >
                                                            ₹{dist.total.toLocaleString()}
                                                        </span>
                                                        {dist.settled ? (
                                                            <span 
                                                                className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl border text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-1 md:gap-1.5 opacity-80"
                                                                style={{ backgroundColor: isLight ? 'rgba(13, 148, 136, 0.05)' : 'rgba(74, 248, 227, 0.05)', borderColor: isLight ? 'rgba(13, 148, 136, 0.2)' : 'rgba(74, 248, 227, 0.2)', color: isLight ? '#0d9488' : '#4af8e3' }}
                                                            >
                                                                <span className="material-symbols-outlined text-[14px] md:text-[16px]">lock</span> Settled
                                                            </span>
                                                        ) : (
                                                            <span 
                                                                className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl border text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-1 md:gap-1.5 opacity-80"
                                                                style={{ backgroundColor: isLight ? 'rgba(217, 119, 6, 0.05)' : 'rgba(251, 191, 36, 0.05)', borderColor: isLight ? 'rgba(217, 119, 6, 0.2)' : 'rgba(251, 191, 36, 0.2)', color: isLight ? '#b45309' : '#fbbf24' }}
                                                            >
                                                                <span className="material-symbols-outlined text-[14px] md:text-[16px]">hourglass_empty</span> Pending
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
 
                                                {/* Expanded Content */}
                                                <div className={`transition-all overflow-hidden ${isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
                                                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 border-t pt-4" style={{ borderTopColor: 'var(--tt-divider)', backgroundColor: 'var(--tt-input-bg)' }}>
                                                        <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: isLight ? '#7c3aed' : '#c799ff' }}>
                                                            <span className="material-symbols-outlined text-sm">group</span> Student Payments
                                                        </p>
                                                        <div className="space-y-4">
                                                            <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)' }}>
                                                                <table className="w-full text-left text-sm">
                                                                    <thead style={{ backgroundColor: isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.05)' }}>
                                                                        <tr>
                                                                            <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--tt-text-secondary)' }}>Student</th>
                                                                            <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-center" style={{ color: 'var(--tt-text-secondary)' }}>Billing Cycle</th>
                                                                            <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-right" style={{ color: 'var(--tt-text-secondary)' }}>Amount</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {groupPayments(dist.payments).map((p, idx) => (
                                                                            <tr key={idx} 
                                                                                className="hover:bg-white/5 transition-colors border-b last:border-b-0"
                                                                                style={{ borderColor: isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.08)' }}
                                                                            >
                                                                                <td className="px-4 py-3 font-bold" style={{ color: 'var(--tt-text-primary)' }}>{p.student_name}</td>
                                                                                <td className="px-4 py-3 text-xs font-semibold text-center" style={{ color: 'var(--tt-text-secondary)' }}>
                                                                                    {p.billingCycles.join(", ")}
                                                                                </td>
                                                                                <td className="px-4 py-3 font-bold text-right" style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>₹{p.amount.toLocaleString()}</td>
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
                                    <span className="material-symbols-outlined text-[64px] mb-4" style={{ color: 'var(--tt-text-muted)' }}>account_tree</span>
                                    <p className="font-bold text-xl mb-1" style={{ color: 'var(--tt-text-primary)' }}>No earnings in {MONTHS[month - 1]} {year}</p>
                                    <p className="text-sm" style={{ color: 'var(--tt-text-secondary)' }}>Earnings will appear once payments are approved.</p>
                                </GlassCard>
                            )}
                        </div>
                    )}

                    {/* ═══ Tab 2: Teacher Earnings Ledger ═══ */}
                    {activeTab === "earnings" && (
                        <div>
                            {data.dates && data.dates.length > 0 && allTeachers.length > 0 ? (
                                <div 
                                    className="border rounded-3xl overflow-hidden shadow-xl" 
                                    style={{ 
                                        maxHeight: "calc(100vh - 380px)", 
                                        display: "flex", 
                                        flexDirection: "column",
                                        background: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(23, 25, 36, 0.6)',
                                        borderColor: isLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(115, 117, 128, 0.1)',
                                    }}
                                >
                                    <div className="overflow-auto flex-1 custom-scrollbar">
                                        <table className="w-full border-collapse min-w-[600px]">
                                            <thead style={{ backgroundColor: isLight ? 'rgba(238, 242, 255, 0.85)' : 'rgba(12, 14, 23, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }} className="sticky top-0 z-20">
                                                <tr style={{ borderBottom: '1px solid var(--tt-divider)' }}>
                                                    <th 
                                                        className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap sticky left-0 z-30 shadow-[4px_0_10px_rgba(0,0,0,0.1)]"
                                                        style={{ 
                                                            color: isLight ? '#0d9488' : '#4af8e3', 
                                                            borderRight: '1px solid var(--tt-divider)',
                                                            backgroundColor: isLight ? 'rgba(238, 242, 255, 0.95)' : 'rgba(12, 14, 23, 0.95)'
                                                        }}
                                                    >
                                                        Monthly Total
                                                    </th>
                                                    {allTeachers.map((t) => {
                                                        const teacherTotal = sortedDates.reduce((s, d) => {
                                                            const found = d.teachers.find((x) => x.uid === t.uid);
                                                            return s + (found ? found.amount : 0);
                                                        }, 0);
                                                        return (
                                                            <th key={t.uid} className="px-5 py-4 text-center text-sm font-bold tracking-widest" style={{ color: isLight ? '#0d9488' : '#4af8e3', borderRight: '1px solid var(--tt-divider)' }}>
                                                                ₹{teacherTotal.toLocaleString()}
                                                            </th>
                                                        );
                                                    })}
                                                    <th className="px-5 py-4 min-w-[110px]"></th>
                                                </tr>
                                                <tr style={{ borderBottom: '1px solid var(--tt-divider)', backgroundColor: isLight ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.03)' }}>
                                                    <th 
                                                        className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap sticky left-0 z-30 shadow-[4px_0_10px_rgba(0,0,0,0.1)]"
                                                        style={{ 
                                                            color: 'var(--tt-text-secondary)', 
                                                            borderRight: '1px solid var(--tt-divider)',
                                                            backgroundColor: isLight ? 'rgba(238, 242, 255, 0.95)' : 'rgba(12, 14, 23, 0.95)'
                                                        }}
                                                    >
                                                        Date
                                                    </th>
                                                    {allTeachers.map((t) => (
                                                        <th key={t.uid} className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tt-text-secondary)', borderRight: '1px solid var(--tt-divider)' }}>
                                                            {t.name}
                                                        </th>
                                                    ))}
                                                    <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tt-text-secondary)' }}>
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
                                                        <tr key={dist.date} className="hover:bg-white/5 transition-colors group" style={{ borderBottom: '1px solid var(--tt-divider)' }}>
                                                            <td 
                                                                className="px-5 py-4 text-sm font-bold whitespace-nowrap sticky left-0 transition-colors z-10 shadow-[4px_0_10px_rgba(0,0,0,0.05)]" 
                                                                style={{ 
                                                                    fontFamily: "'Manrope', sans-serif",
                                                                    color: 'var(--tt-text-primary)',
                                                                    borderRight: '1px solid var(--tt-divider)',
                                                                    backgroundColor: isLight ? 'rgba(248, 250, 252, 0.95)' : 'rgba(23, 25, 36, 0.95)'
                                                                }}
                                                            >
                                                                {formattedDate}
                                                            </td>
                                                            {allTeachers.map((t) => (
                                                                <td key={t.uid} className="px-5 py-4 text-center text-sm font-semibold tracking-wide" style={{ borderRight: '1px solid var(--tt-divider)', backgroundColor: 'var(--tt-hover-bg)', color: isLight ? '#7c3aed' : '#c799ff' }}>
                                                                    {(teacherMap[t.uid] || 0) > 0 ? `₹${teacherMap[t.uid].toLocaleString()}` : <span style={{ color: 'var(--tt-text-muted)', opacity: 0.5 }} className="text-xs">—</span>}
                                                                </td>
                                                            ))}
                                                            <td className="px-5 py-4 text-center" style={{ backgroundColor: 'var(--tt-hover-bg)' }}>
                                                                {dist.settled ? (
                                                                    <span 
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                                                                        style={{ backgroundColor: isLight ? 'rgba(13, 148, 136, 0.1)' : 'rgba(74, 248, 227, 0.1)', borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)', color: isLight ? '#0d9488' : '#4af8e3' }}
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px]">lock</span> Settled
                                                                    </span>
                                                                ) : (
                                                                    <span 
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                                                                        style={{ backgroundColor: isLight ? 'rgba(217, 119, 6, 0.1)' : 'rgba(251, 191, 36, 0.1)', borderColor: isLight ? 'rgba(217, 119, 6, 0.3)' : 'rgba(251, 191, 36, 0.3)', color: isLight ? '#b45309' : '#fbbf24' }}
                                                                    >
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
                                    <span className="material-symbols-outlined text-[64px] mb-4" style={{ color: 'var(--tt-text-muted)' }}>account_balance_wallet</span>
                                    <p className="font-bold text-xl mb-1" style={{ color: 'var(--tt-text-primary)' }}>No teacher earnings in {MONTHS[month - 1]} {year}</p>
                                    <p className="text-sm" style={{ color: 'var(--tt-text-secondary)' }}>Earnings will appear once payments are approved.</p>
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
                        background: var(--tt-page-bg);
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: var(--tt-logo-border);
                        border-radius: 4px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: var(--tt-primary);
                    }
                `}} />
                <TeacherDistributionContent />
            </TeacherLayout>
        </ProtectedRoute>
    );
}

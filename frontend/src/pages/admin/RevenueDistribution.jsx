import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, isSystemicError } from "@/lib/api";
import { getYearOptions, getPreviousMonth } from "@/lib/yearOptions";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { TeacherDistributionSkeleton, TeacherDistributionPageSkeleton } from "@/components/Skeletons";
import { useAdminTheme } from "@/context/AdminThemeContext";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

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

function DistributionContent() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    const now = new Date();
    const defaultMonth = now.getMonth() + 1;
    const defaultYear = now.getFullYear();

    const [month, setMonth] = useState(defaultMonth);
    const [year, setYear] = useState(defaultYear);
    const [batchFilter, setBatchFilter] = useState("");

    const cacheKeyBatches = "admin_distribution_batches";
    const cachedBatches = getCache(cacheKeyBatches);
    const [batches, setBatches] = useState([]);
    const [batchesLoading, setBatchesLoading] = useState(!cachedBatches);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expandedDate, setExpandedDate] = useState(null);
    const [settleLoading, setSettleLoading] = useState(null);
    const [activeTab, setActiveTab] = useState("datewise");
    const [confirmModal, setConfirmModal] = useState(null); // { date, paymentsCount }
    const [shareModalData, setShareModalData] = useState(null);
    const [copied, setCopied] = useState(false);

    const activeBatch = batches.find(b => String(b.id) === String(batchFilter) || String(b.value) === String(batchFilter));
    const activeBatchName = activeBatch
        ? (activeBatch.label || activeBatch.batch_name || activeBatch.name || "N/A")
        : "N/A";

    const generateShareText = (dist) => {
        if (!dist) return "";
        const formattedDate = (() => {
            try {
                const d = new Date(dist.date + "T00:00:00");
                return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
            } catch { return dist.date; }
        })();

        let text = `📊 Revenue Settlement Report\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `📅 Date: ${formattedDate}\n`;
        text += `📚 Batch: ${activeBatchName}\n`;
        text += `💰 Total Settled Revenue: ₹${dist.total.toLocaleString("en-IN")}\n\n`;

        text += `👨‍🎓👩‍🎓 Student Payments:\n`;
        text += `────────────────\n`;
        const grouped = groupPayments(dist.payments);
        if (grouped.length > 0) {
            grouped.forEach((p, idx) => {
                text += `${idx + 1}. ${p.student_name} (${p.billingCycles.join(", ")}): ₹${p.amount.toLocaleString("en-IN")}\n`;
            });
        } else {
            text += `No payments\n`;
        }

        text += `\n👨‍🏫 Teacher Distributions:\n`;
        text += `────────────────\n`;
        if (dist.teachers && dist.teachers.length > 0) {
            dist.teachers.forEach((t, idx) => {
                text += `• ${t.name}: ₹${(t.amount || 0).toLocaleString("en-IN")}\n`;
            });
        } else {
            text += `No teacher sharing\n`;
        }
        text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `⚡Powered by FP Finance`;

        return text;
    };


    const handleCopy = async () => {
        try {
            const text = generateShareText(shareModalData);
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Clipboard copy failed:", err);
        }
    };

    // Settle a date's distribution (one-time, irreversible)
    const handleSettle = (date, paymentsCount) => {
        setConfirmModal({ date, paymentsCount });
    };

    const confirmSettle = async () => {
        if (!confirmModal) return;
        const { date } = confirmModal;
        setConfirmModal(null);
        setSettleLoading(date);
        setError("");
        try {
            await api.post("/api/admin/settle-distribution", {
                date,
                month,
                year,
                batch_id: batchFilter || null,
            });
            fetchDistribution();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setSettleLoading(null);
        }
    };

    useEffect(() => {
        const cached = getCache(cacheKeyBatches);
        if (cached) {
            setBatches(cached);
            setBatchesLoading(false);
            return;
        }
        setBatchesLoading(true);
        api.get("/api/admin/batches").then((res) => {
            setBatches(res);
            setCache(cacheKeyBatches, res);
        }).catch(() => { }).finally(() => {
            setBatchesLoading(false);
        });
    }, [cacheKeyBatches]);

    // Disable body scroll when modal is open
    useEffect(() => {
        if (confirmModal || shareModalData) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [confirmModal, shareModalData]);

    const fetchDistribution = useCallback(async () => {
        if (!batchFilter) {
            setData(null);
            setLoading(false);
            return;
        }

        const fetchCacheKey = `admin_distribution_${month}_${year}_${batchFilter}`;
        const currentCache = getCache(fetchCacheKey);

        if (currentCache) {
            setData(prev => JSON.stringify(prev) !== JSON.stringify(currentCache) ? currentCache : prev);
            setLoading(false);
        } else {
            setData(null);
            setLoading(true);
        }

        setError("");
        try {
            let url = `/api/admin/distribution?month=${month}&year=${year}&batch_id=${batchFilter}`;
            const res = await api.get(url);
            if (JSON.stringify(currentCache) !== JSON.stringify(res)) {
                setCache(fetchCacheKey, res);
                setData(prev => JSON.stringify(prev) !== JSON.stringify(res) ? res : prev);
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

    // Collect unique teacher names from all dates for the ledger table
    const sortedDates = data?.dates ? [...data.dates].sort((a, b) => b.date.localeCompare(a.date)) : [];

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

    if (batchesLoading) {
        return <TeacherDistributionPageSkeleton />;
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                    Revenue Distribution
                </h1>
            </div>

            {/* Filters */}
            <div
                className="backdrop-blur-[20px] border rounded-[2rem] p-5 shadow-lg mb-6"
                style={{ 
                    transform: "translateZ(0)", 
                    isolation: "isolate", 
                    backfaceVisibility: "hidden", 
                    WebkitBackfaceVisibility: "hidden",
                    backgroundColor: 'var(--ad-card-bg)',
                    borderColor: 'var(--ad-card-border)'
                }}
            >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                    {/* Batch - First on mobile, 3rd on desktop */}
                    <div className="col-span-2 md:order-3 md:col-span-2">
                        {batches.length > 0 ? (
                            <ModernSelect
                                value={batchFilter}
                                options={batches}
                                placeholder="Select Batch"
                                onChange={(e) => setBatchFilter(e.target.value)}
                                className="w-full flex items-center justify-between border hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-sm"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
                            />
                        ) : (
                            <div className="border rounded-2xl w-full h-[46px] animate-pulse" style={{ backgroundColor: 'var(--ad-input-bg)', borderColor: 'var(--ad-input-border)' }} />
                        )}
                    </div>

                    {/* Month - Second on mobile, 1st on desktop */}
                    <div className="col-span-1 md:order-1">
                        <ModernSelect
                            value={month}
                            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="w-full flex items-center justify-between border hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-sm"
                            style={{
                                backgroundColor: 'var(--ad-input-bg)',
                                borderColor: 'var(--ad-input-border)',
                                color: 'var(--ad-text-primary)'
                            }}
                        />
                    </div>

                    {/* Year - Third on mobile, 2nd on desktop */}
                    <div className="col-span-1 md:order-2">
                        <ModernSelect
                            value={year}
                            options={yearOptions}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="w-full flex items-center justify-between border hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-sm"
                            style={{
                                backgroundColor: 'var(--ad-input-bg)',
                                borderColor: 'var(--ad-input-border)',
                                color: 'var(--ad-text-primary)'
                            }}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <TeacherDistributionSkeleton />
            ) : !batchFilter ? (
                <div className="backdrop-blur-[20px] border rounded-[2rem] p-12 text-center flex flex-col items-center shadow-lg"
                     style={{
                         backgroundColor: 'var(--ad-card-bg)',
                         borderColor: 'var(--ad-card-border)'
                     }}
                >
                    <span className="material-symbols-outlined text-[64px] mb-4" style={{ color: 'var(--ad-text-secondary)' }}>account_balance_wallet</span>
                    <p className="font-bold text-xl mb-1" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>Select Batch</p>
                    <p className="text-sm" style={{ color: 'var(--ad-text-secondary)' }}>Please select a batch to view its revenue distribution details.</p>
                </div>
            ) : data ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="backdrop-blur-[20px] border rounded-3xl p-5 shadow-sm"
                             style={{
                                 backgroundColor: 'var(--ad-card-bg)',
                                 borderColor: 'var(--ad-card-border)'
                             }}
                        >
                            <p className="text-xs font-bold uppercase tracking-widest mb-1 pointer-events-none text-opacity-80" style={{ color: 'var(--ad-text-secondary)' }}>Total Distributed</p>
                            <p className="text-3xl sm:text-4xl font-extrabold mt-2 drop-shadow-md" style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>₹{data.total_collected.toLocaleString()}</p>
                        </div>
                        <div className="backdrop-blur-[20px] border rounded-3xl p-5 shadow-sm"
                             style={{
                                 backgroundColor: 'var(--ad-card-bg)',
                                 borderColor: 'var(--ad-card-border)'
                             }}
                        >
                            <p className="text-xs font-bold uppercase tracking-widest mb-1 pointer-events-none text-opacity-80" style={{ color: 'var(--ad-text-secondary)' }}>Teachers Shared</p>
                            <p className="text-3xl sm:text-4xl font-extrabold mt-2 drop-shadow-md" style={{ color: isLight ? '#7c3aed' : '#c799ff' }}>{data.total_teachers_shared || 0}</p>
                        </div>
                    </div>

                    {/* ═══ Tab Bar ═══ */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-6 p-1.5 rounded-[1.25rem] border shadow-sm" 
                         style={{ 
                             transform: "translateZ(0)", 
                             isolation: "isolate", 
                             willChange: "transform", 
                             backfaceVisibility: "hidden",
                             backgroundColor: 'var(--ad-card-bg)',
                             borderColor: 'var(--ad-divider)'
                         }}
                    >
                        <button
                            onClick={() => setActiveTab("datewise")}
                            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 border border-transparent"
                            style={{
                                backgroundColor: activeTab === "datewise" ? (isLight ? 'rgba(59, 130, 246, 0.08)' : 'rgba(199, 153, 255, 0.1)') : 'transparent',
                                color: activeTab === "datewise" ? (isLight ? '#2563eb' : '#c799ff') : 'var(--ad-text-secondary)',
                                borderColor: activeTab === "datewise" ? (isLight ? 'rgba(59, 130, 246, 0.2)' : 'rgba(199, 153, 255, 0.2)') : 'transparent',
                            }}
                        >
                            <span className="material-symbols-outlined text-lg">calendar_month</span> Date-wise Distribution
                        </button>
                        <button
                            onClick={() => setActiveTab("earnings")}
                            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 border border-transparent"
                            style={{
                                backgroundColor: activeTab === "earnings" ? (isLight ? 'rgba(59, 130, 246, 0.08)' : 'rgba(199, 153, 255, 0.1)') : 'transparent',
                                color: activeTab === "earnings" ? (isLight ? '#2563eb' : '#c799ff') : 'var(--ad-text-secondary)',
                                borderColor: activeTab === "earnings" ? (isLight ? 'rgba(59, 130, 246, 0.2)' : 'rgba(199, 153, 255, 0.2)') : 'transparent',
                            }}
                        >
                            <span className="material-symbols-outlined text-lg">account_balance_wallet</span> Teacher Earnings
                        </button>
                    </div>

                    {/* ═══ Tab 1: Date-wise Distribution ═══ */}
                    {activeTab === "datewise" && (
                        <>
                            {sortedDates.length > 0 ? (
                                <div>
                                    <div className="space-y-4">
                                        {sortedDates.map((dist) => {
                                            const isExpanded = expandedDate === dist.date;
                                            const formattedDate = (() => {
                                                try {
                                                    const d = new Date(dist.date + "T00:00:00");
                                                    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
                                                } catch { return dist.date; }
                                            })();
                                            return (
                                                <div key={dist.date} 
                                                     className="relative backdrop-blur-[20px] rounded-3xl overflow-hidden border transition-all shadow-md"
                                                     style={{
                                                         backgroundColor: 'var(--ad-card-bg)',
                                                         borderColor: dist.settled 
                                                             ? (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)')
                                                             : 'var(--ad-card-border)'
                                                     }}
                                                >
                                                    {/* Expand/collapse arrow — top right corner */}
                                                    <button
                                                        onClick={() => setExpandedDate(isExpanded ? null : dist.date)}
                                                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl border transition-all duration-300 cursor-pointer z-10"
                                                        style={{
                                                            backgroundColor: 'var(--ad-icon-bg)',
                                                            borderColor: 'var(--ad-input-border)',
                                                            color: 'var(--ad-text-secondary)'
                                                        }}
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">expand_more</span>
                                                    </button>
                                                    {/* Row header — clickable */}
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 sm:p-6 pr-14 gap-3 md:gap-4">
                                                        <button
                                                            onClick={() => setExpandedDate(isExpanded ? null : dist.date)}
                                                            className="flex items-center gap-3 md:gap-4 cursor-pointer flex-1 min-w-0 group text-left"
                                                        >
                                                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                                                                 style={{
                                                                     backgroundColor: dist.settled
                                                                         ? (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)')
                                                                         : (isLight ? 'rgba(124, 58, 237, 0.08)' : 'rgba(199, 153, 255, 0.1)'),
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
                                                                <p className="font-bold text-sm md:text-lg tracking-wide truncate" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>{formattedDate}</p>
                                                                <p className="text-[11px] md:text-xs font-medium tracking-wide mt-0.5 md:mt-1 flex items-center gap-1.5 md:gap-2 flex-wrap" style={{ color: 'var(--ad-text-secondary)' }}>
                                                                    <span>{dist.payments ? groupPayments(dist.payments).length : 0} student payment(s)</span>
                                                                    {dist.settled && (
                                                                        <>
                                                                            <span className="w-1 h-1 rounded-full bg-[#4af8e3]/50"></span>
                                                                            <span className="text-[#4af8e3] hidden sm:inline">Permanently Settled</span>
                                                                            <span className="text-[#4af8e3] sm:hidden">Settled</span>
                                                                        </>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </button>
                                                        <div className="flex items-center gap-2 pt-3 md:pt-0">
                                                            <span className="px-3 md:px-4 py-1.5 rounded-full border text-xs md:text-sm font-bold tracking-widest drop-shadow-md"
                                                                  style={{ 
                                                                      backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)',
                                                                      borderColor: isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(74, 248, 227, 0.25)',
                                                                      color: isLight ? '#0d9488' : '#4af8e3'
                                                                  }}
                                                            >
                                                                ₹{dist.total.toLocaleString()}
                                                            </span>
                                                            {/* Settle button — only for unsettled dates */}
                                                            {dist.settled ? (
                                                                 <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setShareModalData(dist); }}
                                                                        className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl border text-[10px] md:text-xs font-bold tracking-widest uppercase transition-all cursor-pointer flex items-center gap-1 md:gap-1.5 group"
                                                                        style={{
                                                                            backgroundColor: isLight ? 'rgba(124, 58, 237, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                                                                            borderColor: isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(199, 153, 255, 0.25)',
                                                                            color: isLight ? '#7c3aed' : '#c799ff'
                                                                        }}
                                                                        title="Share settlement details"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px] md:text-[16px] group-hover:scale-110 transition-transform">share</span>
                                                                        <span>Share</span>
                                                                    </button>
                                                                    <span className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl border text-[10px] md:text-xs font-bold tracking-widest uppercase select-none flex items-center gap-1 md:gap-1.5 opacity-80"
                                                                          style={{
                                                                              backgroundColor: isLight ? 'rgba(13, 148, 136, 0.05)' : 'rgba(74, 248, 227, 0.05)',
                                                                              borderColor: isLight ? 'rgba(13, 148, 136, 0.15)' : 'rgba(74, 248, 227, 0.15)',
                                                                              color: isLight ? 'rgba(13, 148, 136, 0.7)' : 'rgba(74, 248, 227, 0.6)'
                                                                          }}
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px] md:text-[16px]">lock</span> Settled
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleSettle(dist.date, dist.payments ? groupPayments(dist.payments).length : 0); }}
                                                                    disabled={settleLoading === dist.date}
                                                                    className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl border text-[10px] md:text-xs font-bold tracking-widest uppercase transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 md:gap-1.5 group"
                                                                    style={{
                                                                        backgroundColor: isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 157, 172, 0.1)',
                                                                        borderColor: isLight ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 157, 172, 0.25)',
                                                                        color: isLight ? '#ef4444' : '#ff9dac'
                                                                    }}
                                                                    title="Lock this date's distribution permanently (irreversible)"
                                                                >
                                                                    {settleLoading === dist.date ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: isLight ? '#ef4444' : '#ff9dac' }} /> : <span className="material-symbols-outlined text-[14px] md:text-[16px] group-hover:scale-110 transition-transform">lock_open</span>}
                                                                    <span>{settleLoading === dist.date ? "..." : "Settle"}</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Expanded teacher breakdown */}
                                                    <div className={`transition-all overflow-hidden ${isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
                                                        <div className="px-5 pb-5 sm:px-6 sm:pb-6 border-t pt-4" style={{ borderColor: 'var(--ad-divider)' }}>
                                                            <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: isLight ? '#7c3aed' : '#c799ff' }}>
                                                                <span className="material-symbols-outlined text-sm">group</span> Student Payments
                                                                {dist.settled && (
                                                                    <span className="lowercase font-semibold text-[10px] px-2 py-0.5 rounded-full border ml-2 shadow-sm"
                                                                          style={{
                                                                              backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)',
                                                                              borderColor: isLight ? 'rgba(13, 148, 136, 0.2)' : 'rgba(74, 248, 227, 0.2)',
                                                                              color: isLight ? '#0d9488' : '#4af8e3'
                                                                          }}
                                                                    >
                                                                        frozen
                                                                    </span>
                                                                )}
                                                            </p>

                                                            <div className="rounded-2xl overflow-hidden border bg-black/5" style={{ borderColor: 'var(--ad-divider)' }}>
                                                                <table className="w-full text-left text-sm">
                                                                    <thead style={{ backgroundColor: 'var(--ad-surface)' }}>
                                                                        <tr className="border-b border-[var(--ad-divider)]">
                                                                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--ad-text-secondary)' }}>Student</th>
                                                                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-center" style={{ color: 'var(--ad-text-secondary)' }}>Billing Cycle</th>
                                                                            <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--ad-text-secondary)' }}>Amount</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-[var(--ad-divider)]">
                                                                        {dist.payments && groupPayments(dist.payments).map((p, idx) => (
                                                                            <tr key={idx} className="transition-colors hover:bg-white/[0.01]">
                                                                                <td className="px-4 py-3.5 text-sm font-medium" style={{ color: 'var(--ad-text-primary)' }}>{p.student_name}</td>
                                                                                <td className="px-4 py-3.5 text-xs font-semibold text-center" style={{ color: 'var(--ad-text-secondary)' }}>
                                                                                    {p.billingCycles.join(", ")}
                                                                                </td>
                                                                                <td className="px-4 py-3.5 text-sm font-bold text-right" style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>
                                                                                    ₹{p.amount.toLocaleString()}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        {(!dist.payments || dist.payments.length === 0) && (
                                                                            <tr>
                                                                                <td colSpan="3" className="px-4 py-6 text-sm text-center bg-black/5 font-medium" style={{ color: 'var(--ad-text-secondary)' }}>No payment details available.</td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="backdrop-blur-[20px] border rounded-[2rem] p-12 text-center flex flex-col items-center shadow-lg"
                                     style={{
                                         backgroundColor: 'var(--ad-card-bg)',
                                         borderColor: 'var(--ad-card-border)'
                                     }}
                                >
                                    <span className="material-symbols-outlined text-[64px] mb-4" style={{ color: 'var(--ad-text-secondary)' }}>date_range</span>
                                    <p className="font-bold text-xl mb-1" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>No payments confirmed in {MONTHS[month - 1]} {year}</p>
                                    <p className="text-sm" style={{ color: 'var(--ad-text-secondary)' }}>Payments will appear here once approved by admin.</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ═══ Tab 2: Teacher Earnings Ledger ═══ */}
                    {activeTab === "earnings" && (
                        <div>
                            {sortedDates.length > 0 && allTeachers.length > 0 ? (
                                <>
                                    {/* Ledger table (scrollable on mobile) */}
                                    <div className="backdrop-blur-[20px] border rounded-3xl overflow-hidden shadow-xl"
                                         style={{ 
                                             maxHeight: "calc(100vh - 380px)", 
                                             display: "flex", 
                                             flexDirection: "column",
                                             backgroundColor: 'var(--ad-card-bg)',
                                             borderColor: 'var(--ad-card-border)'
                                         }}
                                    >
                                        <div className="overflow-auto flex-1 custom-scrollbar">
                                            <table className="w-full border-collapse min-w-[600px]">
                                                <thead className="sticky top-0 z-20 backdrop-blur-xl" style={{ backgroundColor: 'var(--ad-surface)', borderBottom: '1px solid var(--ad-divider)' }}>
                                                    {/* Summary row: Total Distributed per teacher for the month */}
                                                    <tr className="border-b border-[var(--ad-divider)]">
                                                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap border-r min-w-[140px] sticky left-0 z-30 shadow-[4px_0_10px_rgba(0,0,0,0.02)]"
                                                            style={{
                                                                backgroundColor: 'var(--ad-surface)',
                                                                borderColor: 'var(--ad-divider)',
                                                                color: isLight ? '#0d9488' : '#4af8e3'
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
                                                                <th key={t.uid} className="px-5 py-4 text-center text-sm font-bold tracking-widest border-r min-w-[130px]"
                                                                    style={{
                                                                        borderColor: 'var(--ad-divider)',
                                                                        color: isLight ? '#0d9488' : '#4af8e3'
                                                                    }}
                                                                >
                                                                    ₹{teacherTotal.toLocaleString()}
                                                                </th>
                                                            );
                                                        })}
                                                        <th className="px-5 py-4 min-w-[110px]"></th>
                                                    </tr>
                                                    {/* Column headers */}
                                                    <tr className="border-b border-[var(--ad-divider)] bg-black/5">
                                                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap border-r sticky left-0 z-30 shadow-[4px_0_10px_rgba(0,0,0,0.02)]"
                                                            style={{
                                                                backgroundColor: 'var(--ad-surface)',
                                                                borderColor: 'var(--ad-divider)',
                                                                color: 'var(--ad-text-secondary)'
                                                            }}
                                                        >
                                                            Date
                                                        </th>
                                                        {allTeachers.map((t) => (
                                                            <th key={t.uid} className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest border-r"
                                                                style={{
                                                                    borderColor: 'var(--ad-divider)',
                                                                    color: 'var(--ad-text-secondary)'
                                                                }}
                                                            >
                                                                {t.name}
                                                            </th>
                                                        ))}
                                                        <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest"
                                                            style={{
                                                                color: 'var(--ad-text-secondary)'
                                                            }}
                                                        >
                                                            Status
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedDates.map((dist) => {
                                                        const formattedDate = (() => {
                                                            try {
                                                                const d = new Date(dist.date + "T00:00:00");
                                                                return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                                                            } catch { return dist.date; }
                                                        })();
                                                        const teacherMap = {};
                                                        for (const t of dist.teachers) teacherMap[t.uid] = t.amount;

                                                        return (
                                                            <tr key={dist.date} className="hover:bg-white/[0.01] transition-colors group border-b border-[var(--ad-divider)]">
                                                                <td className="px-5 py-4 text-sm font-bold whitespace-nowrap border-r sticky left-0 backdrop-blur-xl transition-colors z-10 shadow-[4px_0_10px_rgba(0,0,0,0.01)]" 
                                                                    style={{ 
                                                                        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(23, 25, 36, 0.9)',
                                                                        borderColor: 'var(--ad-divider)',
                                                                        color: 'var(--ad-text-primary)',
                                                                        fontFamily: "'Manrope', sans-serif" 
                                                                    }}
                                                                >
                                                                    {formattedDate}
                                                                </td>
                                                                {allTeachers.map((t) => (
                                                                    <td key={t.uid} className="px-5 py-4 border-r text-center bg-black/5 text-sm font-semibold tracking-wide"
                                                                        style={{ 
                                                                            borderColor: 'var(--ad-divider)',
                                                                            color: isLight ? '#7c3aed' : '#c799ff'
                                                                        }}
                                                                    >
                                                                        {(teacherMap[t.uid] || 0) > 0 ? `₹${teacherMap[t.uid].toLocaleString()}` : <span className="opacity-50 text-xs">—</span>}
                                                                    </td>
                                                                ))}
                                                                <td className="px-5 py-4 text-center bg-black/5">
                                                                    {dist.settled ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest whitespace-nowrap drop-shadow-md"
                                                                            style={{
                                                                                backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)',
                                                                                borderColor: isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(74, 248, 227, 0.25)',
                                                                                color: isLight ? '#0d9488' : '#4af8e3'
                                                                            }}
                                                                        >
                                                                            <span className="material-symbols-outlined text-[14px]">lock</span> Settled
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest whitespace-nowrap drop-shadow-md"
                                                                            style={{
                                                                                backgroundColor: isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 157, 172, 0.1)',
                                                                                borderColor: isLight ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 157, 172, 0.25)',
                                                                                color: isLight ? '#ef4444' : '#ff9dac'
                                                                            }}
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
                                </>
                            ) : (
                                <div className="backdrop-blur-[20px] border rounded-[2rem] p-12 text-center flex flex-col items-center shadow-lg"
                                     style={{
                                         backgroundColor: 'var(--ad-card-bg)',
                                         borderColor: 'var(--ad-card-border)'
                                     }}
                                >
                                    <span className="material-symbols-outlined text-[64px] mb-4" style={{ color: 'var(--ad-text-secondary)' }}>account_balance_wallet</span>
                                    <p className="font-bold text-xl mb-1" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>No teacher earnings in {MONTHS[month - 1]} {year}</p>
                                    <p className="text-sm" style={{ color: 'var(--ad-text-secondary)' }}>Earnings will appear once payments are confirmed.</p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : null
            }

            {/* ═══ Custom Confirmation Modal ═══ */}
            {confirmModal && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-6" onClick={() => setConfirmModal(null)} style={{ touchAction: "none" }}>
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    {/* Modal */}
                    <div
                        className="relative w-full max-w-sm rounded-3xl p-6 shadow-[0_24px_60px_rgba(0,0,0,0.2)] animate-[modalIn_0.3s_ease-out] z-10"
                        style={{
                            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.01)',
                            border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)'}`,
                            backdropFilter: 'blur(80px) saturate(2.5)',
                            WebkitBackdropFilter: 'blur(80px) saturate(2.5)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Warning icon */}
                        <div className="w-14 h-14 rounded-2xl bg-[#ff9dac]/10 border border-[#ff9dac]/20 flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-[28px] text-[#ff9dac]">warning</span>
                        </div>
                        <h3 className="text-lg font-bold text-center mb-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>Permanent Action</h3>
                        <p className="text-sm text-center leading-relaxed mb-1" style={{ color: 'var(--ad-text-secondary)' }}>
                            Settle distribution for <span className="font-semibold" style={{ color: 'var(--ad-text-primary)' }}>{confirmModal.date}</span>?
                        </p>
                        <p className="text-sm text-center leading-relaxed mb-2" style={{ color: 'var(--ad-text-secondary)' }}>
                            This will freeze <span className="font-semibold" style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>{confirmModal.paymentsCount} student payment(s)</span> and teacher shares permanently.
                        </p>
                        <div className="flex items-center gap-2 justify-center mb-5 mt-4">
                            <span className="material-symbols-outlined text-[14px] text-[#ff9dac]/70">info</span>
                            <p className="text-[#ff9dac]/70 text-xs font-semibold tracking-wide">This action CANNOT be undone.</p>
                        </div>
                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border text-sm font-bold transition-all cursor-pointer active:scale-95"
                                style={{ borderColor: 'var(--ad-divider)', color: 'var(--ad-text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSettle}
                                className="flex-1 px-4 py-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                                style={{ 
                                    backgroundColor: isLight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 157, 172, 0.1)',
                                    borderColor: isLight ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 157, 172, 0.3)',
                                    color: isLight ? '#ef4444' : '#ff9dac'
                                }}
                            >
                                <span className="material-symbols-outlined text-[16px]">lock</span> Settle
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ═══ Premium Share Modal with Glassmorphism ═══ */}
            {shareModalData && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-6" onClick={() => setShareModalData(null)} style={{ touchAction: "none" }}>
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
                    {/* Modal */}
                    <div
                        className="relative w-full max-w-md rounded-3xl p-6 shadow-[0_24px_60px_rgba(0,0,0,0.2)] animate-[modalIn_0.3s_ease-out] z-10"
                        style={{
                            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(25, 30, 45, 0.85)',
                            border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)'}`,
                            backdropFilter: 'blur(80px) saturate(2.5)',
                            WebkitBackdropFilter: 'blur(80px) saturate(2.5)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                                <span className="material-symbols-outlined" style={{ color: isLight ? 'var(--ad-accent)' : '#c799ff' }}>share</span> Share Settlement
                            </h3>
                            <button
                                onClick={() => setShareModalData(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl border text-[#aaaab7] transition-all cursor-pointer hover:opacity-80"
                                style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)' }}
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        {/* Quick Metadata Info */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border rounded-2xl px-4 py-3 mb-4 text-xs gap-3 sm:gap-4"
                             style={{
                                 backgroundColor: 'var(--ad-icon-bg)',
                                 borderColor: 'var(--ad-divider)',
                                 color: 'var(--ad-text-secondary)'
                             }}
                        >
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold" style={{ color: 'var(--ad-text-primary)' }}>Batch</p>
                                <p className="mt-0.5 break-words">{activeBatchName}</p>
                            </div>
                            <div className="sm:text-right border-t pt-2 sm:pt-0 sm:border-t-0 shrink-0" style={{ borderColor: 'var(--ad-divider)' }}>
                                <p className="font-semibold" style={{ color: 'var(--ad-text-primary)' }}>Date</p>
                                <p className="mt-0.5">
                                    {(() => {
                                        try {
                                            const d = new Date(shareModalData.date + "T00:00:00");
                                            return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                                        } catch { return shareModalData.date; }
                                    })()}
                                </p>
                            </div>
                        </div>

                        {/* Message Preview */}
                        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: isLight ? '#7c3aed' : '#c799ff' }}>Message Preview</p>
                        <div className="bg-black/10 border rounded-2xl p-4 font-mono text-[11px] max-h-[180px] overflow-y-auto custom-scrollbar select-all whitespace-pre-wrap leading-relaxed mb-5"
                             style={{ borderColor: 'var(--ad-divider)', color: 'var(--ad-text-primary)' }}
                        >
                            {generateShareText(shareModalData)}
                        </div>

                        {/* Action buttons grid */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all text-sm font-bold cursor-pointer active:scale-95 text-center"
                                    style={{
                                        backgroundColor: copied 
                                            ? (isLight ? 'rgba(13, 148, 136, 0.1)' : 'rgba(74, 248, 227, 0.1)')
                                            : (isLight ? 'rgba(124, 58, 237, 0.08)' : 'rgba(199, 153, 255, 0.1)'),
                                        borderColor: copied
                                            ? (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)')
                                            : (isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(199, 153, 255, 0.3)'),
                                        color: copied
                                            ? (isLight ? '#0d9488' : '#4af8e3')
                                            : (isLight ? '#7c3aed' : '#c799ff')
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {copied ? "check_circle" : "content_copy"}
                                    </span>
                                    <span>{copied ? "Copied!" : "Copy Details"}</span>
                                </button>
                                <a
                                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generateShareText(shareModalData))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all text-sm font-bold cursor-pointer active:scale-95 text-center"
                                    style={{
                                        backgroundColor: isLight ? 'rgba(13, 148, 136, 0.1)' : 'rgba(74, 248, 227, 0.1)',
                                        borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)',
                                        color: isLight ? '#0d9488' : '#4af8e3'
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[18px]">send</span>
                                    <span>WhatsApp</span>
                                </a>
                            </div>

                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div >
    );
}

export default function RevenueDistribution() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .custom-scrollbar::-webkit-scrollbar {
                        height: 8px;
                        width: 8px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: ${isLight ? 'rgba(0,0,0,0.03)' : 'rgba(12,14,23,0.5)'};
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(59,130,246,0.2)'};
                        border-radius: 4px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(59,130,246,0.5)'};
                    }
                    @keyframes modalIn {
                        from { opacity: 0; transform: scale(0.9) translateY(10px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                `}} />
                <DistributionContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, isSystemicError } from "@/lib/api";
import { getYearOptions, getPreviousMonth } from "@/lib/yearOptions";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { TeacherDistributionSkeleton, TeacherDistributionPageSkeleton } from "@/components/Skeletons";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function DistributionContent() {
    const { month: defaultMonth, year: defaultYear } = getPreviousMonth();

    const [month, setMonth] = useState(defaultMonth);
    const [year, setYear] = useState(defaultYear);
    const [batchFilter, setBatchFilter] = useState("");

    const cacheKeyBatches = "admin_distribution_batches";
    const [batches, setBatches] = useState([]);
    const [batchesLoading, setBatchesLoading] = useState(true);

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
        if (dist.payments && dist.payments.length > 0) {
            dist.payments.forEach((p, idx) => {
                text += `${idx + 1}. ${p.student_name}: ₹${(p.amount || 0).toLocaleString("en-IN")}\n`;
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
        text += `⚡Powered by FP Finance App`;

        return text;
    };

    const handlePrintReceipt = (dist) => {
        if (!dist) return;
        const formattedDate = (() => {
            try {
                const d = new Date(dist.date + "T00:00:00");
                return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
            } catch { return dist.date; }
        })();

        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            alert("Popup blocked! Please allow popups to print/save receipts.");
            return;
        }

        const studentRows = (dist.payments || []).map((p, idx) => `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td>${p.student_name}</td>
                <td style="text-align: right;">₹${(p.amount || 0).toLocaleString("en-IN")}</td>
            </tr>
        `).join("");

        const teacherRows = (dist.teachers || []).map((t, idx) => `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td>${t.name}</td>
                <td style="text-align: right;">₹${(t.amount || 0).toLocaleString("en-IN")}</td>
            </tr>
        `).join("");

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Settlement Receipt - ${formattedDate}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                        padding: 30px;
                        color: #1e293b;
                        background: #ffffff;
                        line-height: 1.5;
                    }
                    .receipt-container {
                        max-width: 700px;
                        margin: 0 auto;
                        border: 1px solid #e2e8f0;
                        padding: 40px;
                        border-radius: 12px;
                        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #334155;
                        padding-bottom: 20px;
                        margin-bottom: 25px;
                    }
                    .title {
                        font-size: 26px;
                        font-weight: 800;
                        letter-spacing: -0.025em;
                        color: #0f172a;
                        margin: 0;
                        text-transform: uppercase;
                    }
                    .subtitle {
                        font-size: 14px;
                        font-weight: 600;
                        color: #64748b;
                        margin-top: 5px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    .meta-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 15px;
                        margin-bottom: 30px;
                        font-size: 14px;
                        background: #f8fafc;
                        padding: 15px 20px;
                        border-radius: 8px;
                        border: 1px solid #f1f5f9;
                    }
                    .meta-item {
                        color: #475569;
                    }
                    .meta-item strong {
                        color: #0f172a;
                    }
                    .section-title {
                        font-size: 15px;
                        font-weight: 700;
                        color: #334155;
                        border-bottom: 1.5px solid #cbd5e1;
                        padding-bottom: 6px;
                        margin-top: 25px;
                        margin-bottom: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                        font-size: 14px;
                    }
                    th {
                        background-color: #f1f5f9;
                        color: #475569;
                        font-weight: 700;
                        text-transform: uppercase;
                        font-size: 11px;
                        letter-spacing: 0.05em;
                        padding: 10px 12px;
                        border: 1px solid #e2e8f0;
                    }
                    td {
                        padding: 10px 12px;
                        border: 1px solid #e2e8f0;
                        color: #334155;
                    }
                    .total-box {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: #f1f5f9;
                        padding: 15px 20px;
                        border-radius: 8px;
                        font-weight: 700;
                        font-size: 16px;
                        color: #0f172a;
                        margin-top: 30px;
                        border: 1px solid #e2e8f0;
                    }
                    .total-amount {
                        font-size: 20px;
                        color: #0284c7;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 40px;
                        font-size: 12px;
                        color: #94a3b8;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 20px;
                    }
                    @media print {
                        body {
                            padding: 0;
                            background: none;
                        }
                        .receipt-container {
                            border: none;
                            box-shadow: none;
                            padding: 0;
                            max-width: 100%;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    <div class="header">
                        <div class="title">Future Point</div>
                        <div class="subtitle">Revenue Settlement Report</div>
                    </div>
                    <div class="meta-grid">
                        <div class="meta-item">📅 <strong>Settlement Date:</strong> ${formattedDate}</div>
                        <div class="meta-item">📚 <strong>Batch Name:</strong> ${activeBatchName}</div>
                    </div>

                    <div class="section-title">👨‍🎓👩‍🎓 Student Payments Received</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 60px;">#</th>
                                <th>Student Name</th>
                                <th style="width: 150px; text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${studentRows || '<tr><td colspan="3" style="text-align: center; color: #94a3b8;">No payments recorded</td></tr>'}
                        </tbody>
                    </table>

                    <div class="section-title">👨&zwj;🏫 Teacher Distributions</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 60px;">#</th>
                                <th>Teacher Name</th>
                                <th style="width: 150px; text-align: right;">Distributed Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teacherRows || '<tr><td colspan="3" style="text-align: center; color: #94a3b8;">No distributions recorded</td></tr>'}
                        </tbody>
                    </table>

                    <div class="total-box">
                        <span>TOTAL SETTLED REVENUE:</span>
                        <span class="total-amount">₹${dist.total.toLocaleString("en-IN")}</span>
                    </div>

                    <div class="footer">
                        This is a computer-generated report of revenue settlement. All distributions are finalized.
                        <br/>&copy; ${new Date().getFullYear()} FP Finance. All rights reserved.
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
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

    // Fetch batches for the filter dropdown
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
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Revenue Distribution
                </h1>
            </div>

            {/* Filters */}
            <div
                className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-5 mb-6"
                style={{ transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
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
                                className="w-full"
                            />
                        ) : (
                            <div className="bg-[#222532]/50 border border-[#464752]/50 rounded-2xl w-full h-[46px] animate-pulse" />
                        )}
                    </div>

                    {/* Month - Second on mobile, 1st on desktop */}
                    <div className="col-span-1 md:order-1">
                        <ModernSelect
                            value={month}
                            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    {/* Year - Third on mobile, 2nd on desktop */}
                    <div className="col-span-1 md:order-2">
                        <ModernSelect
                            value={year}
                            options={yearOptions}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Inline error banner removed to prevent duplicate messages (handled by modal logic) */}

            {loading ? (
                <TeacherDistributionSkeleton />
            ) : !batchFilter ? (
                <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-12 text-center flex flex-col items-center shadow-lg">
                    <span className="material-symbols-outlined text-[64px] text-[#464752] mb-4">account_balance_wallet</span>
                    <p className="text-[#f0f0fd] font-bold text-xl mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Select Batch</p>
                    <p className="text-[#aaaab7] text-sm">Please select a batch to view its revenue distribution details.</p>
                </div>
            ) : data ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-3xl p-5 transition-colors hover:bg-[#171924]/80">
                            <p className="text-[#aaaab7] text-xs font-bold uppercase tracking-widest mb-1 pointer-events-none text-opacity-80">Total Distributed</p>
                            <p className="text-3xl sm:text-4xl font-extrabold text-[#4af8e3] mt-2 drop-shadow-md">₹{data.total_collected.toLocaleString()}</p>
                        </div>
                        <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-3xl p-5 transition-colors hover:bg-[#171924]/80">
                            <p className="text-[#aaaab7] text-xs font-bold uppercase tracking-widest mb-1 pointer-events-none text-opacity-80">Teachers Shared</p>
                            <p className="text-3xl sm:text-4xl font-extrabold text-[#c799ff] mt-2 drop-shadow-md">{data.total_teachers_shared || 0}</p>
                        </div>
                    </div>

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
                                                <div key={dist.date} className={`relative bg-[#171924]/60 backdrop-blur-[20px] rounded-3xl overflow-hidden border transition-all ${dist.settled ? "border-[#4af8e3]/30 shadow-[0_4px_15px_rgba(74,248,227,0.05)]" : "border-[#737580]/10 hover:border-[#c799ff]/30 shadow-lg hover:shadow-[0_4px_15px_rgba(199,153,255,0.05)]"}`}>
                                                    {/* Expand/collapse arrow — top right corner */}
                                                    <button
                                                        onClick={() => setExpandedDate(isExpanded ? null : dist.date)}
                                                        className={`absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-[#aaaab7] transition-all duration-300 cursor-pointer hover:bg-white/10 hover:text-white z-10 ${isExpanded ? "rotate-180 bg-white/10 text-white border-white/10" : ""}`}>
                                                        <span className="material-symbols-outlined text-[20px]">expand_more</span>
                                                    </button>
                                                    {/* Row header — clickable */}
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
                                                        <div className="flex items-center gap-2 border-t border-[#464752]/30 md:border-t-0 pt-3 md:pt-0">
                                                            <span className="px-3 md:px-4 py-1.5 rounded-full bg-[#4af8e3]/10 border border-[#4af8e3]/30 text-[#4af8e3] text-xs md:text-sm font-bold tracking-widest drop-shadow-md" style={{ boxShadow: "0 0 8px rgba(74,248,227,0.2)" }}>
                                                                ₹{dist.total.toLocaleString()}
                                                            </span>
                                                            {/* Settle button — only for unsettled dates */}
                                                            {dist.settled ? (
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setShareModalData(dist); }}
                                                                        className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-[#c799ff]/10 border border-[#c799ff]/30 text-[#c799ff] text-[10px] md:text-xs font-bold tracking-widest uppercase hover:bg-[#c799ff]/20 transition-all cursor-pointer flex items-center gap-1 md:gap-1.5 group"
                                                                        title="Share settlement details"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px] md:text-[16px] group-hover:scale-110 transition-transform">share</span>
                                                                        <span>Share</span>
                                                                    </button>
                                                                    <span className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-[#4af8e3]/5 border border-[#4af8e3]/20 text-[#4af8e3]/60 text-[10px] md:text-xs font-bold tracking-widest uppercase select-none flex items-center gap-1 md:gap-1.5 opacity-80">
                                                                        <span className="material-symbols-outlined text-[14px] md:text-[16px]">lock</span> Settled
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleSettle(dist.date, dist.payments_count); }}
                                                                    disabled={settleLoading === dist.date}
                                                                    className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-[#ff9dac]/10 border border-[#ff9dac]/30 text-[#ff9dac] text-[10px] md:text-xs font-bold tracking-widest uppercase hover:bg-[#ff9dac]/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 md:gap-1.5 group"
                                                                    title="Lock this date's distribution permanently (irreversible)"
                                                                >
                                                                    {settleLoading === dist.date ? <span className="w-4 h-4 rounded-full border-2 border-[#ff9dac]/30 border-t-[#ff9dac] animate-spin" /> : <span className="material-symbols-outlined text-[14px] md:text-[16px] group-hover:scale-110 transition-transform">lock_open</span>}
                                                                    <span>{settleLoading === dist.date ? "..." : "Settle"}</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Expanded teacher breakdown */}
                                                    <div className={`transition-all overflow-hidden ${isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
                                                        <div className="px-5 pb-5 sm:px-6 sm:pb-6 border-t border-[#464752]/30 pt-4">
                                                            <p className="text-[#c799ff] text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-sm">group</span> Student Payments
                                                                {dist.settled && <span className="text-[#4af8e3] lowercase font-semibold text-[10px] bg-[#4af8e3]/10 px-2 py-0.5 rounded-full border border-[#4af8e3]/20 ml-2 shadow-[0_0_8px_rgba(74,248,227,0.2)]">frozen</span>}
                                                            </p>

                                                            {/* Mobile view */}
                                                            <div className="space-y-3 md:hidden">
                                                                {dist.payments && dist.payments.map((p, idx) => (
                                                                    <div key={p.id || idx} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-[#464752]/30">
                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                            <div className="w-7 h-7 rounded-lg bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/20 flex items-center justify-center text-[11px] font-bold shrink-0">
                                                                                {idx + 1}
                                                                            </div>
                                                                            <p className="text-[#f0f0fd] text-sm truncate font-medium">{p.student_name}</p>
                                                                        </div>
                                                                        <p className="text-[#4af8e3] text-sm font-bold whitespace-nowrap ml-2">
                                                                            ₹{(p.amount || 0).toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                                {(!dist.payments || dist.payments.length === 0) && (
                                                                    <p className="text-[#aaaab7] text-sm py-3 text-center bg-black/10 rounded-xl border border-[#464752]/20">No payment details available.</p>
                                                                )}
                                                            </div>

                                                            {/* Desktop table */}
                                                            <div className="hidden md:block rounded-xl overflow-hidden border border-[#464752]/30">
                                                                <table className="w-full">
                                                                    <thead className="bg-[#0c0e17]/80">
                                                                        <tr className="border-b border-[#464752]/30">
                                                                            <th className="px-4 py-3 text-left text-[11px] font-bold text-[#aaaab7] uppercase tracking-widest w-12 text-center">#</th>
                                                                            <th className="px-4 py-3 text-left text-[11px] font-bold text-[#aaaab7] uppercase tracking-widest">Student</th>
                                                                            <th className="px-4 py-3 text-right text-[11px] font-bold text-[#aaaab7] uppercase tracking-widest">Amount</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {dist.payments && dist.payments.map((p, idx) => (
                                                                            <tr key={p.id || idx} className="border-b border-[#464752]/20 last:border-0 hover:bg-[#222532]/40 transition-colors bg-black/10">
                                                                                <td className="px-4 py-3.5 text-xs text-[#aaaab7] font-semibold text-center">{idx + 1}</td>
                                                                                <td className="px-4 py-3.5 text-sm text-[#f0f0fd] font-medium">{p.student_name}</td>
                                                                                <td className="px-4 py-3.5 text-sm text-[#4af8e3] font-bold text-right tracking-wide">
                                                                                    ₹{(p.amount || 0).toLocaleString()}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        {(!dist.payments || dist.payments.length === 0) && (
                                                                            <tr>
                                                                                <td colSpan="3" className="px-4 py-6 text-[#aaaab7] text-sm text-center bg-black/10 font-medium">No payment details available.</td>
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
                                <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-12 text-center flex flex-col items-center shadow-lg">
                                    <span className="material-symbols-outlined text-[64px] text-[#464752] mb-4">date_range</span>
                                    <p className="text-[#f0f0fd] font-bold text-xl mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>No payments confirmed in {MONTHS[month - 1]} {year}</p>
                                    <p className="text-[#aaaab7] text-sm">Payments will appear here once approved by admin.</p>
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
                                    <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-3xl overflow-hidden shadow-xl" style={{ maxHeight: "calc(100vh - 380px)", display: "flex", flexDirection: "column" }}>
                                        <div className="overflow-auto flex-1 custom-scrollbar">
                                            <table className="w-full border-collapse min-w-[600px]">
                                                <thead className="bg-[#0c0e17]/80 backdrop-blur-xl sticky top-0 z-20">
                                                    {/* Summary row: Total Distributed per teacher for the month */}
                                                    <tr className="border-b border-[#464752]/40">
                                                        <th className="px-5 py-4 text-left text-xs font-bold text-[#4af8e3] uppercase tracking-wider whitespace-nowrap border-r border-[#464752]/40 min-w-[140px] sticky left-0 bg-[#0c0e17]/80 backdrop-blur-xl z-30 shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                                                            Total Distributed
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
                                                    {/* Column headers */}
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
                                                        const formattedDate = (() => {
                                                            try {
                                                                const d = new Date(dist.date + "T00:00:00");
                                                                return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                                                            } catch { return dist.date; }
                                                        })();
                                                        const teacherMap = {};
                                                        for (const t of dist.teachers) teacherMap[t.uid] = t.amount;

                                                        return (
                                                            <tr key={dist.date} className="border-b border-[#464752]/20 hover:bg-white/5 transition-colors group">
                                                                <td className="px-5 py-4 text-sm text-[#f0f0fd] font-bold whitespace-nowrap border-r border-[#464752]/40 sticky left-0 bg-[#171924]/80 backdrop-blur-xl group-hover:bg-[#1f2231]/80 transition-colors z-10 shadow-[4px_0_10px_rgba(0,0,0,0.15)]" style={{ fontFamily: "'Manrope', sans-serif" }}>{formattedDate}</td>
                                                                {allTeachers.map((t) => (
                                                                    <td key={t.uid} className="px-5 py-4 border-r border-[#464752]/40 text-center bg-black/10 text-sm font-semibold text-[#c799ff] tracking-wide" style={{ textShadow: "0 0 8px rgba(199,153,255,0.4)" }}>
                                                                        {(teacherMap[t.uid] || 0) > 0 ? `₹${teacherMap[t.uid].toLocaleString()}` : <span className="text-[#aaaab7]/50 text-xs">—</span>}
                                                                    </td>
                                                                ))}
                                                                <td className="px-5 py-4 text-center bg-black/10">
                                                                    {dist.settled ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4af8e3]/10 border border-[#4af8e3]/30 text-[#4af8e3] text-[10px] font-bold uppercase tracking-widest whitespace-nowrap drop-shadow-md"
                                                                            style={{ boxShadow: "0 0 8px rgba(74,248,227,0.4), 0 0 2px rgba(74,248,227,0.2)" }}>
                                                                            <span className="material-symbols-outlined text-[14px]">lock</span> Settled
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff9dac]/10 border border-[#ff9dac]/30 text-[#ff9dac] text-[10px] font-bold uppercase tracking-widest whitespace-nowrap drop-shadow-md"
                                                                            style={{ boxShadow: "0 0 8px rgba(255,157,172,0.4), 0 0 2px rgba(255,157,172,0.2)" }}>
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
                                <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-12 text-center flex flex-col items-center shadow-lg">
                                    <span className="material-symbols-outlined text-[64px] text-[#464752] mb-4">account_balance_wallet</span>
                                    <p className="text-[#f0f0fd] font-bold text-xl mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>No teacher earnings in {MONTHS[month - 1]} {year}</p>
                                    <p className="text-[#aaaab7] text-sm">Earnings will appear once payments are confirmed.</p>
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
                        className="relative w-full max-w-sm bg-[#171924]/95 backdrop-blur-2xl border border-[#464752]/50 rounded-3xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] animate-[modalIn_0.3s_ease-out] z-10"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Warning icon */}
                        <div className="w-14 h-14 rounded-2xl bg-[#ff9dac]/10 border border-[#ff9dac]/20 flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-[28px] text-[#ff9dac]">warning</span>
                        </div>
                        <h3 className="text-[#f0f0fd] text-lg font-bold text-center mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>Permanent Action</h3>
                        <p className="text-[#aaaab7] text-sm text-center leading-relaxed mb-1">
                            Settle distribution for <span className="text-[#f0f0fd] font-semibold">{confirmModal.date}</span>?
                        </p>
                        <p className="text-[#aaaab7] text-sm text-center leading-relaxed mb-2">
                            This will freeze <span className="text-[#4af8e3] font-semibold">{confirmModal.paymentsCount} payment(s)</span> and teacher shares permanently.
                        </p>
                        <div className="flex items-center gap-2 justify-center mb-5 mt-4">
                            <span className="material-symbols-outlined text-[14px] text-[#ff9dac]/70">info</span>
                            <p className="text-[#ff9dac]/70 text-xs font-semibold tracking-wide">This action CANNOT be undone.</p>
                        </div>
                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border border-[#464752]/50 text-[#aaaab7] text-sm font-bold hover:bg-white/10 hover:text-white transition-all cursor-pointer active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSettle}
                                className="flex-1 px-4 py-3 rounded-2xl bg-[#ff9dac]/15 border border-[#ff9dac]/30 text-[#ff9dac] text-sm font-bold hover:bg-[#ff9dac]/25 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
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
                        className="relative w-full max-w-md bg-[#171924]/95 backdrop-blur-2xl border border-[#464752]/50 rounded-3xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] animate-[modalIn_0.3s_ease-out] z-10"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[#f0f0fd] text-lg font-bold flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                <span className="material-symbols-outlined text-[#c799ff]">share</span> Share Settlement
                            </h3>
                            <button
                                onClick={() => setShareModalData(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-[#aaaab7] hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        {/* Quick Metadata Info */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-[#222532]/40 border border-[#464752]/20 rounded-2xl px-4 py-3 mb-4 text-xs text-[#aaaab7] gap-3 sm:gap-4">
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-[#f0f0fd]">Batch</p>
                                <p className="mt-0.5 break-words">{activeBatchName}</p>
                            </div>
                            <div className="sm:text-right border-t border-[#464752]/10 pt-2 sm:pt-0 sm:border-t-0 shrink-0">
                                <p className="font-semibold text-[#f0f0fd]">Date</p>
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
                        <p className="text-xs font-bold text-[#c799ff] uppercase tracking-widest mb-2">Message Preview</p>
                        <div className="bg-black/40 border border-[#464752]/30 rounded-2xl p-4 font-mono text-[11px] text-[#aaaab7] max-h-[180px] overflow-y-auto custom-scrollbar select-all whitespace-pre-wrap leading-relaxed mb-5">
                            {generateShareText(shareModalData)}
                        </div>

                        {/* Action buttons grid */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleCopy}
                                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all text-sm font-bold cursor-pointer active:scale-95 ${copied
                                        ? "bg-[#4af8e3]/10 border-[#4af8e3]/30 text-[#4af8e3]"
                                        : "bg-[#c799ff]/10 border-[#c799ff]/30 text-[#c799ff] hover:bg-[#c799ff]/20"
                                        }`}
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
                                    className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#4af8e3]/10 border border-[#4af8e3]/30 text-[#4af8e3] hover:bg-[#4af8e3]/20 transition-all text-sm font-bold cursor-pointer active:scale-95 text-center"
                                >
                                    <span className="material-symbols-outlined text-[18px]">send</span>
                                    <span>WhatsApp</span>
                                </a>
                            </div>
                            <button
                                onClick={() => handlePrintReceipt(shareModalData)}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-[#464752]/50 text-[#f0f0fd] hover:bg-white/10 transition-all text-sm font-bold cursor-pointer active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[18px]">print</span>
                                <span>Print / Save PDF</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div >
    );
}

export default function RevenueDistribution() {
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
                        background: rgba(12, 14, 23, 0.5);
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(70, 71, 82, 0.8);
                        border-radius: 4px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: rgba(199, 153, 255, 0.8);
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

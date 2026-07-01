import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, isSystemicError } from "@/lib/api";
import { getYearOptions, getPreviousMonth } from "@/lib/yearOptions";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { TableSkeleton, TeacherPaymentsPageSkeleton } from "@/components/Skeletons";
import { useAdminTheme } from "@/context/AdminThemeContext";

const MONTHS = [
    { value: 1,  label: "January"   },
    { value: 2,  label: "February"  },
    { value: 3,  label: "March"     },
    { value: 4,  label: "April"     },
    { value: 5,  label: "May"       },
    { value: 6,  label: "June"      },
    { value: 7,  label: "July"      },
    { value: 8,  label: "August"    },
    { value: 9,  label: "September" },
    { value: 10, label: "October"   },
    { value: 11, label: "November"  },
    { value: 12, label: "December"  },
];

function PaymentsContent() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    const cacheKeyBatches = "admin_all_batches";
    const cachedBatches = getCache(cacheKeyBatches);

    const { month: prevMonth, year: prevYear } = getPreviousMonth();

    const [batches,     setBatches]     = useState([]);
    const [filterBatch, setFilterBatch] = useState("");
    const [filterYear,  setFilterYear]  = useState(prevYear);
    const [filterMonth, setFilterMonth] = useState(prevMonth);

    const [payments,  setPayments]  = useState([]);
    const [loading,   setLoading]   = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error,     setError]     = useState("");
    const [batchesLoading, setBatchesLoading] = useState(!cachedBatches);

    // Fetch batches once on mount — no payment fetch yet
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
        }).catch(() => {}).finally(() => {
            setBatchesLoading(false);
        });
    }, [cacheKeyBatches]);

    // Automatically fetch payments when filters change
    useEffect(() => {
        if (!filterBatch) {
            setPayments([]);
            setHasLoaded(false);
            return;
        }

        const fetchPayments = async () => {
            setLoading(true);
            setHasLoaded(false);
            setPayments([]);
            setError("");
            try {
                const res = await api.get(
                    `/api/admin/payments?batch_id=${filterBatch}&year=${filterYear}&month=${filterMonth}`
                );
                setPayments(res);
                setHasLoaded(true);
            } catch (err) {
                if (!isSystemicError(err.message)) {
                    setError(err.message);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchPayments();
    }, [filterBatch, filterYear, filterMonth]);

    // ── helpers ──────────────────────────────────────────
    const formatDate = (dateStr) => {
        if (!dateStr) return "—";
        try {
            const d = new Date(dateStr);
            return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
        } catch { return "—"; }
    };

    const statusMeta = (status) => {
        if (status === "Paid") {
            return {
                label: "Paid",
                cls: isLight ? "bg-[#0d9488]/10 border-[#0d9488]/20 text-[#0d9488]" : "bg-[#4af8e3]/10 border-[#4af8e3]/30 text-[#4af8e3]",
                glow: isLight ? "none" : "0 0 8px rgba(74,248,227,0.4)"
            };
        }
        if (status === "Pending_Verification") {
            return {
                label: "Pending",
                cls: isLight ? "bg-[#b45309]/10 border-[#b45309]/20 text-[#b45309]" : "bg-[#facc15]/10 border-[#facc15]/30 text-[#facc15]",
                glow: isLight ? "none" : "0 0 8px rgba(250,204,21,0.4)"
            };
        }
        if (status === "Rejected") {
            return {
                label: "Rejected",
                cls: isLight ? "bg-[#ef4444]/10 border-[#ef4444]/20 text-[#ef4444]" : "bg-[#ff6e84]/10 border-[#ff6e84]/30 text-[#ff6e84]",
                glow: isLight ? "none" : "0 0 8px rgba(255,110,132,0.4)"
            };
        }
        return {
            label: "Unpaid",
            cls: isLight ? "bg-[#c2410c]/10 border-[#c2410c]/20 text-[#c2410c]" : "bg-[#fb923c]/10 border-[#fb923c]/30 text-[#fb923c]",
            glow: isLight ? "none" : "0 0 8px rgba(251,146,60,0.4)"
        };
    };

    const yearOptions  = getYearOptions();
    const monthOptions = MONTHS;

    // Sort payments by student name
    const sorted = [...payments].sort((a, b) =>
        (a.student_name || "").localeCompare(b.student_name || "", undefined, { sensitivity: "base" })
    );

    const totalCollected = payments.reduce((s, p) => p.status === "Paid" ? s + (p.amount || 0) : s, 0);
    const selectedMonth = MONTHS.find(m => m.value === filterMonth)?.label || "";
    const selectedBatch = batches.find(b => b.id === filterBatch)?.batch_name || "";

    if (batchesLoading) {
        return <TeacherPaymentsPageSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold" style={{ color: 'var(--ad-text-primary)', fontFamily: "'Manrope', sans-serif" }}>
                    All Payments
                </h1>
            </div>

            {error && (
                <div className="p-4 rounded-xl border shadow-lg text-sm flex items-center gap-3"
                     style={{
                         backgroundColor: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(30, 41, 59, 0.85)',
                         borderColor: 'rgba(255, 110, 132, 0.3)',
                         color: isLight ? '#ef4444' : '#ff9dac'
                     }}
                >
                    <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                    <span className="flex-1 font-medium">{error}</span>
                    <button onClick={() => setError("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                </div>
            )}

            {/* Filters */}
            <div
                className="backdrop-blur-[20px] border rounded-[2rem] p-5 shadow-lg"
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
                    <div className="col-span-2 md:order-3 md:col-span-2 relative z-30">
                        <ModernSelect
                            value={filterBatch}
                            onChange={(e) => { setFilterBatch(e.target.value); setHasLoaded(false); setPayments([]); }}
                            options={batches}
                            placeholder="Select Batch"
                            className="w-full flex items-center justify-between border hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-sm"
                            style={{
                                backgroundColor: 'var(--ad-input-bg)',
                                borderColor: 'var(--ad-input-border)',
                                color: 'var(--ad-text-primary)'
                            }}
                        />
                    </div>
                    {/* Month - Second on mobile (left), 1st on desktop */}
                    <div className="col-span-1 md:order-1 relative z-20">
                        <ModernSelect
                            value={filterMonth}
                            onChange={(e) => { setFilterMonth(Number(e.target.value)); setHasLoaded(false); setPayments([]); }}
                            options={monthOptions.map(m => ({ id: m.value, batch_name: m.label }))}
                            className="w-full flex items-center justify-between border hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-sm"
                            style={{
                                backgroundColor: 'var(--ad-input-bg)',
                                borderColor: 'var(--ad-input-border)',
                                color: 'var(--ad-text-primary)'
                            }}
                        />
                    </div>
                    {/* Year - Third on mobile (right), 2nd on desktop */}
                    <div className="col-span-1 md:order-2 relative z-10">
                        <ModernSelect
                            value={filterYear}
                            onChange={(e) => { setFilterYear(Number(e.target.value)); setHasLoaded(false); setPayments([]); }}
                            options={yearOptions}
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


            {/* Total Collected */}
            {!loading && hasLoaded && totalCollected > 0 && (
                <div className="backdrop-blur-[20px] border rounded-2xl px-6 py-4 flex items-center gap-4 w-fit"
                     style={{
                         backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)',
                         borderColor: isLight ? 'rgba(13, 148, 136, 0.2)' : 'rgba(74, 248, 227, 0.2)',
                         boxShadow: isLight ? '0 8px 32px rgba(0, 0, 0, 0.03)' : '0 0 30px rgba(74,248,227,0.05)',
                     }}
                >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: isLight ? '#0d9488' : '#4af8e3' }} />
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--ad-text-secondary)' }}>Total Collected</span>
                    <span className="text-base font-extrabold tracking-wide" style={{ color: isLight ? '#0d9488' : '#4af8e3', fontFamily: "'Manrope', sans-serif" }}>₹{totalCollected.toLocaleString()}</span>
                </div>
            )}

            {/* Table */}
            <div
                className="backdrop-blur-[20px] border rounded-3xl overflow-hidden shadow-xl"
                style={{ 
                    transform: "translateZ(0)", 
                    isolation: "isolate", 
                    backfaceVisibility: "hidden", 
                    WebkitBackfaceVisibility: "hidden",
                    backgroundColor: 'var(--ad-card-bg)',
                    borderColor: 'var(--ad-card-border)'
                }}
            >
                {loading ? (
                    <TableSkeleton />
                ) : !hasLoaded ? (
                    <div className="flex flex-col items-center justify-center gap-4 p-14 text-center">
                        <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--ad-text-secondary)' }}>payments</span>
                        <p className="font-bold text-lg" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>Select Batch</p>
                        <p className="text-sm" style={{ color: 'var(--ad-text-secondary)' }}>Please select a batch to view its payments.</p>
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-14" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--ad-text-secondary)' }}>
                        <span className="material-symbols-outlined text-4xl opacity-30">payments</span>
                        <span>No payment records for <strong style={{ color: 'var(--ad-text-primary)' }}>{selectedBatch}</strong> — {selectedMonth} {filterYear}</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse min-w-[640px]">
                            <thead className="sticky top-0 z-20 backdrop-blur-xl" style={{ backgroundColor: 'var(--ad-surface)', borderBottom: '1px solid var(--ad-divider)' }}>
                                <tr>
                                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap w-0 sticky left-0 z-30 shadow-[4px_0_10px_rgba(0,0,0,0.03)] border-r"
                                        style={{
                                            backgroundColor: 'var(--ad-surface)',
                                            borderColor: 'var(--ad-divider)',
                                            color: 'var(--ad-text-secondary)'
                                        }}
                                    >
                                        Student Name
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-widest border-r"
                                        style={{
                                            borderColor: 'var(--ad-divider)',
                                            color: 'var(--ad-text-secondary)'
                                        }}
                                    >
                                        Amount
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-widest border-r"
                                        style={{
                                            borderColor: 'var(--ad-divider)',
                                            color: 'var(--ad-text-secondary)'
                                        }}
                                    >
                                        Status
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-widest border-r"
                                        style={{
                                            borderColor: 'var(--ad-divider)',
                                            color: 'var(--ad-text-secondary)'
                                        }}
                                    >
                                        Mode
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-widest border-r whitespace-nowrap"
                                        style={{
                                            borderColor: 'var(--ad-divider)',
                                            color: 'var(--ad-text-secondary)'
                                        }}
                                    >
                                        Cash Received By
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-widest"
                                        style={{
                                            color: 'var(--ad-text-secondary)'
                                        }}
                                    >
                                        Date
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((p) => {
                                    const sm = statusMeta(p.status);
                                    return (
                                        <tr key={p.id} className="hover:bg-white/[0.01] transition-colors group border-b" style={{ borderColor: 'var(--ad-divider)' }}>
                                            {/* Student name — sticky */}
                                            <td className="px-5 py-4 text-sm font-bold whitespace-nowrap sticky left-0 backdrop-blur-md transition-colors z-10 shadow-[4px_0_10px_rgba(0,0,0,0.01)] border-r" 
                                                style={{ 
                                                    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(23, 25, 36, 0.9)',
                                                    borderColor: 'var(--ad-divider)',
                                                    color: 'var(--ad-text-primary)',
                                                    fontFamily: "'Manrope', sans-serif" 
                                                }}
                                            >
                                                {p.student_name || "—"}
                                            </td>
                                            {/* Amount */}
                                            <td className="px-5 py-4 text-center border-r" style={{ borderColor: 'var(--ad-divider)' }}>
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-widest border"
                                                      style={{
                                                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                                          borderColor: 'rgba(59, 130, 246, 0.25)',
                                                          color: '#3b82f6',
                                                      }}
                                                >
                                                    ₹{(p.amount || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            {/* Status */}
                                            <td className="px-5 py-4 text-center border-r" style={{ borderColor: 'var(--ad-divider)' }}>
                                                <span
                                                    className={`inline-flex items-center justify-center px-3 py-1 rounded-full border text-[10px] uppercase font-bold tracking-widest ${sm.cls}`}
                                                    style={{ boxShadow: sm.glow }}
                                                >
                                                    {sm.label}
                                                </span>
                                            </td>
                                            {/* Mode */}
                                            <td className="px-5 py-4 text-center border-r" style={{ borderColor: 'var(--ad-divider)' }}>
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-widest border"
                                                      style={{
                                                          backgroundColor: 'var(--ad-icon-bg)',
                                                          borderColor: 'var(--ad-input-border)',
                                                          color: 'var(--ad-text-secondary)',
                                                      }}
                                                >
                                                    {p.mode ? p.mode.charAt(0).toUpperCase() + p.mode.slice(1) : "—"}
                                                </span>
                                            </td>
                                            {/* Cash Received By */}
                                            <td className="px-5 py-4 text-center border-r whitespace-nowrap" style={{ borderColor: 'var(--ad-divider)' }}>
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border"
                                                      style={{
                                                          backgroundColor: 'var(--ad-icon-bg)',
                                                          borderColor: 'var(--ad-input-border)',
                                                          color: 'var(--ad-text-secondary)',
                                                      }}
                                                >
                                                    {p.mode && p.mode.toLowerCase() === "offline" 
                                                        ? (p.teacher_name || "—") 
                                                        : (p.mode && p.mode.toLowerCase() === "online" ? "N/A" : "—")}
                                                </span>
                                            </td>
                                            {/* Date */}
                                            <td className="px-5 py-4 text-center">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-widest border"
                                                      style={{
                                                          backgroundColor: 'var(--ad-icon-bg)',
                                                          borderColor: 'var(--ad-input-border)',
                                                          color: 'var(--ad-text-primary)',
                                                      }}
                                                >
                                                    {p.status === "Paid" && p.updated_at ? formatDate(p.updated_at) : "—"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AllPayments() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <style dangerouslySetInnerHTML={{__html: `
                    .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: ${isLight ? 'rgba(0,0,0,0.03)' : 'rgba(12,14,23,0.5)'}; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(59,130,246,0.2)'}; border-radius: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(59,130,246,0.5)'}; }
                `}} />
                <PaymentsContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

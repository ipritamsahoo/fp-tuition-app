import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import { api, isSystemicError } from "@/lib/api";
import { getYearOptions, getPreviousMonth } from "@/lib/yearOptions";
import { useTeacherTheme } from "@/context/TeacherThemeContext";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { TableSkeleton, TeacherPaymentsPageSkeleton } from "@/components/Skeletons";

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
    const { month: prevMonth, year: prevYear } = getPreviousMonth();
    const cacheKeyBatches = "teacher_all_batches";
    const cachedBatches = getCache(cacheKeyBatches);

    const [batches,     setBatches]     = useState([]);
    const [filterBatch, setFilterBatch] = useState("");
    const [filterYear,  setFilterYear]  = useState(prevYear);
    const [filterMonth, setFilterMonth] = useState(prevMonth);

    const [payments,  setPayments]  = useState([]);
    const [loading,   setLoading]   = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error,     setError]     = useState("");
    const [batchesLoading, setBatchesLoading] = useState(true);

    const { theme } = useTeacherTheme();
    const isLight = theme === "light";

    // Fetch batches once on mount — no payment fetch yet
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
        api.get("/api/teacher/batches").then((data) => {
            setBatches(data);
            setCache(cacheKeyBatches, data);
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

        const runFetch = async () => {
            setLoading(true);
            setHasLoaded(false);
            setPayments([]);
            setError("");
            try {
                const res = await api.get(
                    `/api/teacher/all-payments?batch_id=${filterBatch}&year=${filterYear}&month=${filterMonth}`
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

        runFetch();
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
                cls: isLight ? "bg-[#0d9488]/10 border-[#0d9488]/30 text-[#0d9488]" : "bg-[#4af8e3]/10 border-[#4af8e3]/30 text-[#4af8e3]", 
                glow: isLight ? "0 0 8px rgba(13,148,136,0.15)" : "0 0 8px rgba(74,248,227,0.4)" 
            };
        }
        if (status === "Pending_Verification") {
            return { 
                label: "Pending", 
                cls: isLight ? "bg-[#b45309]/10 border-[#b45309]/30 text-[#b45309]" : "bg-[#facc15]/10 border-[#facc15]/30 text-[#facc15]", 
                glow: isLight ? "0 0 8px rgba(180,83,9,0.15)" : "0 0 8px rgba(250,204,21,0.4)"  
            };
        }
        if (status === "Rejected") {
            return { 
                label: "Rejected",
                cls: isLight ? "bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]" : "bg-[#ff6e84]/10 border-[#ff6e84]/30 text-[#ff6e84]", 
                glow: isLight ? "0 0 8px rgba(239,68,68,0.15)" : "0 0 8px rgba(255,110,132,0.4)" 
            };
        }
        return { 
            label: "Unpaid",  
            cls: isLight ? "bg-[#ea580c]/10 border-[#ea580c]/30 text-[#ea580c]" : "bg-[#fb923c]/10 border-[#fb923c]/30 text-[#fb923c]", 
            glow: isLight ? "0 0 8px rgba(234,88,12,0.15)" : "0 0 8px rgba(251,146,60,0.4)"  
        };
    };

    const yearOptions  = getYearOptions();

    // Sort by student name
    const sorted = [...payments].sort((a, b) =>
        (a.student_name || "").localeCompare(b.student_name || "", undefined, { sensitivity: "base" })
    );

    const totalCollected = payments.reduce((s, p) => p.status === "Paid" ? s + (p.amount || 0) : s, 0);

    const selectedMonth = MONTHS.find(m => m.value === filterMonth)?.label || "";
    const selectedBatch = batches.find(b => b.id === filterBatch)?.batch_name || "";



    return (
        <div className="space-y-6" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                    All Payments
                </h1>
            </div>

            {error && (
                <div className="p-4 rounded-xl border text-sm flex items-center gap-3" style={{ backgroundColor: 'rgba(255, 110, 132, 0.1)', borderColor: 'rgba(255, 110, 132, 0.2)', color: 'var(--tt-error)' }}>
                    <span className="material-symbols-outlined">error</span>
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError("")} className="ml-2 hover:opacity-80 transition-colors cursor-pointer text-current">✕</button>
                </div>
            )}

            {/* Filters + View button */}
            <div
                className="rounded-[2rem] p-5"
                style={{ 
                    background: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(23, 25, 36, 0.6)',
                    borderColor: isLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(115, 117, 128, 0.1)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    transform: "translateZ(0)", 
                    isolation: "isolate", 
                    backfaceVisibility: "hidden", 
                    WebkitBackfaceVisibility: "hidden" 
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
                            className="w-full"
                            theme={theme}
                        />
                    </div>
                    {/* Month - Second on mobile (left), 1st on desktop */}
                    <div className="col-span-1 md:order-1 relative z-20">
                        <ModernSelect
                            value={filterMonth}
                            onChange={(e) => { setFilterMonth(Number(e.target.value)); setHasLoaded(false); setPayments([]); }}
                            options={MONTHS.map(m => ({ id: m.value, batch_name: m.label }))}
                            className="w-full"
                            theme={theme}
                        />
                    </div>
                    {/* Year - Third on mobile (right), 2nd on desktop */}
                    <div className="col-span-1 md:order-2 relative z-10">
                        <ModernSelect
                            value={filterYear}
                            onChange={(e) => { setFilterYear(Number(e.target.value)); setHasLoaded(false); setPayments([]); }}
                            options={yearOptions}
                            className="w-full"
                            theme={theme}
                        />
                    </div>
                </div>
            </div>

            {/* Total Collected */}
            {!loading && hasLoaded && totalCollected > 0 && (
                <div 
                    className="border rounded-2xl px-6 py-4 flex items-center gap-4 w-fit"
                    style={{
                        background: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(23, 25, 36, 0.4)',
                        borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.1)',
                        boxShadow: isLight ? '0 0 30px rgba(13,148,136,0.05)' : '0 0 30px rgba(74,248,227,0.05)'
                    }}
                >
                    <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: 'var(--tt-secondary)', boxShadow: `0 0 8px ${isLight ? 'rgba(13,148,136,0.5)' : 'rgba(74,248,227,0.7)'}` }}
                    />
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--tt-text-secondary)' }}>Total Collected</span>
                    <span className="text-base font-extrabold tracking-wide" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-secondary)' }}>₹{totalCollected.toLocaleString()}</span>
                </div>
            )}

            {/* Table */}
            <div
                className="border rounded-3xl overflow-hidden shadow-xl"
                style={{ 
                    background: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(23, 25, 36, 0.6)',
                    borderColor: isLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(115, 117, 128, 0.1)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    transform: "translateZ(0)", 
                    isolation: "isolate", 
                    backfaceVisibility: "hidden", 
                    WebkitBackfaceVisibility: "hidden" 
                }}
            >
                {loading ? (
                    <TableSkeleton />
                ) : !hasLoaded ? (
                    <div className="flex flex-col items-center justify-center gap-4 p-14 text-center">
                        <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--tt-text-muted)' }}>payments</span>
                        <p className="font-bold text-lg" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>Select Batch</p>
                        <p className="text-sm" style={{ color: 'var(--tt-text-secondary)' }}>Please select a batch to view its payments.</p>
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-14" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--tt-text-secondary)' }}>
                        <span className="material-symbols-outlined text-4xl opacity-30">payments</span>
                        <span>No payment records for <strong style={{ color: 'var(--tt-text-primary)' }}>{selectedBatch}</strong> — {selectedMonth} {filterYear}</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse min-w-[560px]">
                            <thead style={{ backgroundColor: isLight ? 'rgba(238, 242, 255, 0.8)' : 'rgba(12, 14, 23, 0.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }} className="sticky top-0 z-20">
                                <tr style={{ borderBottom: '1px solid var(--tt-divider)' }}>
                                    <th 
                                        className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap w-0 sticky left-0 z-30"
                                        style={{ 
                                            backgroundColor: isLight ? 'rgba(238, 242, 255, 0.95)' : 'rgba(12, 14, 23, 0.95)',
                                            color: 'var(--tt-text-secondary)',
                                            borderRight: '1px solid var(--tt-divider)'
                                        }}
                                    >
                                        Student Name
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tt-text-secondary)', borderRight: '1px solid var(--tt-divider)' }}>
                                        Amount
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tt-text-secondary)', borderRight: '1px solid var(--tt-divider)' }}>
                                        Status
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tt-text-secondary)', borderRight: '1px solid var(--tt-divider)' }}>
                                        Mode
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--tt-text-secondary)', borderRight: '1px solid var(--tt-divider)' }}>
                                        Cash Received By
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tt-text-secondary)' }}>
                                        Date
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((p) => {
                                    const sm = statusMeta(p.status);
                                    return (
                                        <tr key={p.id} className="hover:bg-white/[0.03] transition-colors group" style={{ borderBottom: '1px solid var(--tt-divider)' }}>
                                            {/* Student name — sticky */}
                                            <td 
                                                className="px-5 py-4 text-sm font-bold whitespace-nowrap sticky left-0 transition-colors z-10" 
                                                style={{ 
                                                    fontFamily: "'Manrope', sans-serif",
                                                    backgroundColor: isLight ? 'rgba(248, 250, 252, 0.95)' : 'rgba(23, 25, 36, 0.95)',
                                                    color: 'var(--tt-text-primary)',
                                                    borderRight: '1px solid var(--tt-divider)'
                                                }}
                                            >
                                                {p.student_name || "—"}
                                            </td>
                                            {/* Amount */}
                                            <td className="px-5 py-4 text-center" style={{ borderRight: '1px solid var(--tt-divider)' }}>
                                                <span 
                                                    className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-widest"
                                                    style={{ backgroundColor: 'var(--tt-blue-bg)', border: '1px solid var(--tt-logo-border)', color: 'var(--tt-primary)', boxShadow: `0 0 10px var(--tt-logo-shadow)` }}
                                                >
                                                    ₹{(p.amount || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            {/* Status */}
                                            <td className="px-5 py-4 text-center" style={{ borderRight: '1px solid var(--tt-divider)' }}>
                                                <span
                                                    className={`inline-flex items-center justify-center px-3 py-1 rounded-full border text-[10px] uppercase font-bold tracking-widest ${sm.cls}`}
                                                    style={{ boxShadow: sm.glow }}
                                                >
                                                    {sm.label}
                                                </span>
                                            </td>
                                            {/* Mode */}
                                            <td className="px-5 py-4 text-center" style={{ borderRight: '1px solid var(--tt-divider)' }}>
                                                <span 
                                                    className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-widest"
                                                    style={{ backgroundColor: 'var(--tt-input-bg)', border: '1px solid var(--tt-divider)', color: 'var(--tt-text-secondary)' }}
                                                >
                                                    {p.mode ? p.mode.charAt(0).toUpperCase() + p.mode.slice(1) : "—"}
                                                </span>
                                            </td>
                                            {/* Cash Received By */}
                                            <td className="px-5 py-4 text-center whitespace-nowrap" style={{ borderRight: '1px solid var(--tt-divider)' }}>
                                                <span 
                                                    className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide"
                                                    style={{ backgroundColor: 'var(--tt-hover-bg)', border: '1px solid var(--tt-divider)', color: 'var(--tt-text-secondary)' }}
                                                >
                                                    {p.mode && p.mode.toLowerCase() === "offline" 
                                                        ? (p.teacher_name || "—") 
                                                        : (p.mode && p.mode.toLowerCase() === "online" ? "N/A" : "—")}
                                                </span>
                                            </td>
                                            {/* Date */}
                                            <td className="px-5 py-4 text-center">
                                                <span 
                                                    className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-widest opacity-80"
                                                    style={{ backgroundColor: 'var(--tt-card-bg)', border: '1px solid var(--tt-divider)', color: 'var(--tt-text-primary)' }}
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

export default function TeacherPayments() {
    return (
        <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherLayout>
                <style dangerouslySetInnerHTML={{__html: `
                    .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: var(--tt-page-bg); }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--tt-logo-border); border-radius: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--tt-primary); }
                `}} />
                <PaymentsContent />
            </TeacherLayout>
        </ProtectedRoute>
    );
}

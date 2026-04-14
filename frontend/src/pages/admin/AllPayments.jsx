import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, isSystemicError } from "@/lib/api";
import { getYearOptions } from "@/lib/yearOptions";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";

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
    const now = new Date();

    const cacheKeyBatches = "admin_all_batches";
    const cachedBatches = getCache(cacheKeyBatches);

    const [batches, setBatches] = useState(cachedBatches || []);
    const [filterBatch, setFilterBatch] = useState("");
    const [filterYear,  setFilterYear]  = useState(now.getFullYear());
    const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);

    const [payments,   setPayments]  = useState([]);
    const [loading,    setLoading]   = useState(false);
    const [hasLoaded,  setHasLoaded] = useState(false);
    const [error,      setError]     = useState("");

    // Fetch batches once on mount — no payment fetch yet
    useEffect(() => {
        const cached = getCache(cacheKeyBatches);
        if (cached) { setBatches(cached); return; }
        api.get("/api/admin/batches").then((res) => {
            setBatches(res);
            setCache(cacheKeyBatches, res);
        }).catch(() => {});
    }, []);

    // Called ONLY when View button is clicked
    const fetchPayments = useCallback(async () => {
        if (!filterBatch) return;
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
            // Only show local banner for validation errors (others handled by Global Modal)
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [filterBatch, filterYear, filterMonth]);

    const handleView = () => fetchPayments();

    // ── helpers ──────────────────────────────────────────
    const formatDate = (dateStr) => {
        if (!dateStr) return "—";
        try {
            const d = new Date(dateStr);
            return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
        } catch { return "—"; }
    };

    const statusMeta = (status) => {
        if (status === "Paid")                 return { label: "Paid",    cls: "bg-[#4af8e3]/10 border-[#4af8e3]/30 text-[#4af8e3]", glow: "0 0 8px rgba(74,248,227,0.4)" };
        if (status === "Pending_Verification") return { label: "Pending", cls: "bg-[#facc15]/10 border-[#facc15]/30 text-[#facc15]", glow: "0 0 8px rgba(250,204,21,0.4)"  };
        if (status === "Rejected")             return { label: "Rejected",cls: "bg-[#ff6e84]/10 border-[#ff6e84]/30 text-[#ff6e84]", glow: "0 0 8px rgba(255,110,132,0.4)" };
        return                                        { label: "Unpaid",  cls: "bg-[#fb923c]/10 border-[#fb923c]/30 text-[#fb923c]", glow: "0 0 8px rgba(251,146,60,0.4)"  };
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    All Payments
                </h1>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#ff6e84]/30 shadow-lg text-[#ff9dac] text-sm flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                </div>
            )}

            {/* Filters + View button */}
            <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-5">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    {/* Batch */}
                    <div className="relative flex-1 md:flex-none md:w-[220px] z-30">
                        <ModernSelect
                            value={filterBatch}
                            onChange={(e) => { setFilterBatch(e.target.value); setHasLoaded(false); setPayments([]); }}
                            options={[{ id: "", batch_name: "Select Batch" }, ...batches]}
                            placeholder="Select Batch"
                            className="w-full"
                        />
                    </div>
                    {/* Year & Month group */}
                    <div className="flex flex-row gap-3 flex-1 md:flex-none">
                        {/* Year */}
                        <div className="relative flex-1 md:w-[140px] z-20">
                            <ModernSelect
                                value={filterYear}
                                onChange={(e) => { setFilterYear(Number(e.target.value)); setHasLoaded(false); setPayments([]); }}
                                options={yearOptions}
                                className="w-full"
                            />
                        </div>
                        {/* Month */}
                        <div className="relative flex-1 md:w-[160px] z-10">
                            <ModernSelect
                                value={filterMonth}
                                onChange={(e) => { setFilterMonth(Number(e.target.value)); setHasLoaded(false); setPayments([]); }}
                                options={monthOptions.map(m => ({ id: m.value, batch_name: m.label }))}
                                className="w-full"
                            />
                        </div>
                    </div>
                    {/* View button */}
                    <button
                        onClick={handleView}
                        disabled={!filterBatch || loading}
                        className="px-6 py-3 rounded-xl bg-[#4af8e3]/10 text-[#4af8e3] border border-[#4af8e3]/30 text-sm font-bold uppercase tracking-widest
                        hover:bg-[#4af8e3]/20 hover:border-[#4af8e3]/50 transition-all duration-300 shadow-[0_4px_15px_rgba(74,248,227,0.10)]
                        disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap md:ml-auto"
                    >
                        {loading ? (
                            <span className="w-4 h-4 rounded-full border-2 border-[#4af8e3]/30 border-t-[#4af8e3] animate-spin" />
                        ) : (
                            <span className="material-symbols-outlined text-[16px]">search</span>
                        )}
                        {loading ? "Loading..." : "View"}
                    </button>
                </div>
            </div>


            {/* Total Collected */}
            {!loading && hasLoaded && totalCollected > 0 && (
                <div className="bg-[#171924]/40 backdrop-blur-[20px] border border-[#4af8e3]/10 rounded-2xl px-6 py-4 flex items-center gap-4 w-fit shadow-[0_0_30px_rgba(74,248,227,0.05)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#4af8e3] shadow-[0_0_8px_rgba(74,248,227,0.7)] flex-shrink-0" />
                    <span className="text-[#aaaab7] text-xs font-semibold uppercase tracking-widest">Total Collected</span>
                    <span className="text-[#4af8e3] text-base font-extrabold tracking-wide" style={{ fontFamily: "'Manrope', sans-serif" }}>₹{totalCollected.toLocaleString()}</span>
                </div>
            )}

            {/* Table */}
            <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-3xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-6"><GenericListSkeleton /></div>
                ) : !hasLoaded ? (
                    <div className="flex flex-col items-center justify-center gap-4 p-14 text-center">
                        <span className="material-symbols-outlined text-5xl text-[#464752]">payments</span>
                        <p className="text-[#f0f0fd] font-bold text-lg" style={{ fontFamily: "'Manrope', sans-serif" }}>Select filters and click View</p>
                        <p className="text-[#aaaab7] text-sm">No data is loaded until you click the View button.</p>
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-14 text-[#aaaab7]" style={{ fontFamily: "'Inter', sans-serif" }}>
                        <span className="material-symbols-outlined text-4xl opacity-30">payments</span>
                        <span>No payment records for <strong className="text-[#f0f0fd]">{selectedBatch}</strong> — {selectedMonth} {filterYear}</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse min-w-[640px]">
                            <thead className="bg-[#0c0e17]/80 backdrop-blur-xl sticky top-0 z-20">
                                <tr className="border-b border-[#464752]/40">
                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-[#aaaab7] uppercase tracking-widest whitespace-nowrap w-0 sticky left-0 bg-[#0c0e17]/80 backdrop-blur-md z-30 shadow-[4px_0_10px_rgba(0,0,0,0.3)] border-r border-[#464752]/40">
                                        Student Name
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold text-[#aaaab7] uppercase tracking-widest border-r border-[#464752]/40">
                                        Amount
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold text-[#aaaab7] uppercase tracking-widest border-r border-[#464752]/40">
                                        Status
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold text-[#aaaab7] uppercase tracking-widest border-r border-[#464752]/40">
                                        Mode
                                    </th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold text-[#aaaab7] uppercase tracking-widest">
                                        Date
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((p) => {
                                    const sm = statusMeta(p.status);
                                    return (
                                        <tr key={p.id} className="border-b border-[#464752]/20 hover:bg-white/[0.03] transition-colors group">
                                            {/* Student name — sticky */}
                                            <td className="px-5 py-4 text-sm font-bold text-[#f0f0fd] whitespace-nowrap sticky left-0 bg-[#171924]/60 backdrop-blur-md group-hover:bg-[#1f2231]/80 transition-colors z-10 shadow-[4px_0_10px_rgba(0,0,0,0.15)] border-r border-[#464752]/40" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                                {p.student_name || "—"}
                                            </td>
                                            {/* Amount */}
                                            <td className="px-5 py-4 text-center border-r border-[#464752]/40">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] text-xs font-bold tracking-widest shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                                                    ₹{(p.amount || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            {/* Status */}
                                            <td className="px-5 py-4 text-center border-r border-[#464752]/40">
                                                <span
                                                    className={`inline-flex items-center justify-center px-3 py-1 rounded-full border text-[10px] uppercase font-bold tracking-widest ${sm.cls}`}
                                                    style={{ boxShadow: sm.glow }}
                                                >
                                                    {sm.label}
                                                </span>
                                            </td>
                                            {/* Mode */}
                                            <td className="px-5 py-4 text-center border-r border-[#464752]/40">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#222532]/50 border border-[#464752]/50 text-[#aaaab7] text-xs font-bold tracking-widest">
                                                    {p.mode ? p.mode.charAt(0).toUpperCase() + p.mode.slice(1) : "—"}
                                                </span>
                                            </td>
                                            {/* Date */}
                                            <td className="px-5 py-4 text-center">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#171924]/60 border border-[#464752]/30 text-[#f0f0fd] text-xs font-bold tracking-widest opacity-80">
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
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <style dangerouslySetInnerHTML={{__html: `
                    .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(12,14,23,0.5); }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.2); border-radius: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.5); }
                `}} />
                <PaymentsContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

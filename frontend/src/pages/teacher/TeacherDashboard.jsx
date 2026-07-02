import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import ProfilePicture from "@/components/ProfilePicture";
import AnimatedGreeting from "@/components/AnimatedGreeting";
import CachedAvatar from "@/components/CachedAvatar";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useTeacherTheme } from "@/context/TeacherThemeContext";
import { db } from "@/lib/firebase";
import { getYearOptions, getPreviousMonth } from "@/lib/yearOptions";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import ModernSelect from "@/components/ModernSelect";
import { TeacherDashboardSkeleton, TeacherPaymentsListSkeleton } from "@/components/Skeletons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── Status Badge ──
function StatusBadge({ status }) {
    const { theme } = useTeacherTheme();
    const isLight = theme === "light";

    const config = {
        Paid: {
            bg: isLight ? "bg-[#0d9488]/10" : "bg-[#4af8e3]/10",
            text: isLight ? "text-[#0d9488]" : "text-[#4af8e3]",
            ring: isLight ? "ring-[#0d9488]/30" : "ring-[#4af8e3]/30",
            label: "PAID",
        },
        Pending_Verification: {
            bg: "bg-amber-400/10",
            text: "text-amber-400",
            ring: "ring-amber-400/30",
            label: "PENDING",
        },
        Unpaid: {
            bg: "bg-[#ff6e84]/10",
            text: "text-[#ff6e84]",
            ring: "ring-[#ff6e84]/30",
            label: "UNPAID",
        },
        Rejected: {
            bg: "bg-[#ff6e84]/10",
            text: "text-[#ff6e84]",
            ring: "ring-[#ff6e84]/30",
            label: "REJECTED",
        },
    };
    const c = config[status] || config.Unpaid;
    return (
        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-tight ring-1 ${c.bg} ${c.text} ${c.ring}`}>
            {c.label}
        </span>
    );
}

// ── Glass Card Component ──
function GlassCard({ children, className = "", style = {} }) {
    return (
        <div
            className={`rounded-[28px] border ${className}`}
            style={{
                background: "var(--tt-card-bg, rgba(28, 31, 43, 0.6))",
                borderColor: "var(--tt-card-border, rgba(255, 255, 255, 0.07))",
                boxShadow: "var(--tt-card-shadow)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                ...style,
            }}
        >
            {children}
        </div>
    );
}

// Global fetch lock to prevent StrictMode or concurrent duplicate calls
let GLOBAL_FETCHING_BATCHES = false;

// ── Main Content ──
function TeacherDashboardContent() {
    const { user } = useAuth();
    const { theme } = useTeacherTheme();
    const isLight = theme === "light";

    useEffect(() => {
        document.documentElement.classList.add("allow-overscroll");
        document.body.classList.add("allow-overscroll");
        return () => {
            document.documentElement.classList.remove("allow-overscroll");
            document.body.classList.remove("allow-overscroll");
        };
    }, []);
    
    const { month: prevMonth, year: prevYear } = getPreviousMonth();
    const [filterMonth, setFilterMonth] = useState(prevMonth);
    const [filterYear, setFilterYear] = useState(prevYear);

    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState("");
    const [payments, setPayments] = useState([]);
    const paymentsRef = useRef([]); // Mirror of payments state for reading in snapshot callbacks
    
    // Loading state for batches (on mount) and payments (on button click)
    const [loading, setLoading] = useState(false);
    const [batchesLoading, setBatchesLoading] = useState(true);
    
    const [error, setError] = useState("");
    const [offlineLoading, setOfflineLoading] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [warningModalData, setWarningModalData] = useState(null);
    const [warningConfirmText, setWarningConfirmText] = useState("");
    const [selectedDueIds, setSelectedDueIds] = useState([]);
    const [counts, setCounts] = useState({ total_students: 0, paid_count: 0, unpaid_count: 0 });
    const [hasLoaded, setHasLoaded] = useState(false);

    // Keep paymentsRef in sync so snapshot callbacks always see latest state
    useEffect(() => { paymentsRef.current = payments; }, [payments]);

    const fetchBatches = useCallback(async () => {
        if (GLOBAL_FETCHING_BATCHES) return;
        
        GLOBAL_FETCHING_BATCHES = true;
        try {
            const data = await api.get("/api/teacher/batches");
            setBatches(data);
        } catch (err) {
            // Handled globally
        } finally {
            GLOBAL_FETCHING_BATCHES = false;
            setBatchesLoading(false);
        }
    }, []);

    const fetchPayments = useCallback(async () => {
        if (!selectedBatch) return;
        
        setLoading(true);
        setError("");
        try {
            let url = `/api/teacher/payments?batch_id=${selectedBatch}&year=${filterYear}`;
            if (filterMonth) url += `&month=${filterMonth}`;
            const response = await api.get(url);
            
            const data = response.data || response;
            if (data.summary) {
                setCounts(data.summary);
                setPayments(data.records || []);
            } else {
                setPayments(data);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message || "Failed to fetch payments.");
            }
        } finally {
            setLoading(false);
        }
    }, [selectedBatch, filterMonth, filterYear]);

    useEffect(() => {
        fetchBatches();
    }, [fetchBatches]);

    useEffect(() => {
        const runFetch = async () => {
            setHasLoaded(false);
            await fetchPayments();
            setHasLoaded(true);
        };
        runFetch();
    }, [selectedBatch, filterMonth, filterYear, fetchPayments]);

    // ── Granular Real-Time Listener ──
    useEffect(() => {
        if (!selectedBatch || !hasLoaded) return;
        
        let isFirstSnapshot = true;
        const q = query(
            collection(db, "payments"),
            where("batch_id", "==", selectedBatch),
            where("month", "==", filterMonth),
            where("year", "==", filterYear)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (isFirstSnapshot) {
                isFirstSnapshot = false;
                return;
            }
            
            const changedDocs = [];
            for (const change of snapshot.docChanges()) {
                if (change.type === "modified" || change.type === "added") {
                    changedDocs.push({ id: change.doc.id, ...change.doc.data() });
                }
            }
            
            if (changedDocs.length === 0) return;
            
            const currentPayments = paymentsRef.current;
            const updatedPayments = [...currentPayments];
            let changed = false;
            let paidDelta = 0;

            for (const mod of changedDocs) {
                const idx = updatedPayments.findIndex(p => p.id === mod.id || p.student_id === mod.student_id);
                if (idx !== -1) {
                    const oldStatus = updatedPayments[idx].status;
                    const newStatus = mod.status;
                    if (oldStatus !== newStatus) {
                        if (newStatus === "Paid") {
                            updatedPayments.splice(idx, 1);
                            paidDelta += 1;
                        } else {
                            updatedPayments[idx] = { ...updatedPayments[idx], status: newStatus, mode: mod.mode };
                        }
                        changed = true;
                    }
                }
            }

            if (!changed) return;

            const newUnpaidCount = updatedPayments.filter(p => p.status === "Unpaid").length;

            setPayments(updatedPayments);
            setCounts(c => ({
                ...c,
                unpaid_count: newUnpaidCount,
                paid_count: (c.paid_count || 0) + paidDelta,
            }));
        });

        return () => unsubscribe();
    }, [selectedBatch, filterMonth, filterYear, hasLoaded]);

    const handlePreOfflineClick = async (payment) => {
        setError("");
        try {
            const data = await api.get(`/api/teacher/student-dues/${payment.student_id}`);
            if (data.length > 1) {
                setWarningConfirmText("");
                // Pre-select only the due matching the currently viewed month/year
                const matchingDue = data.find(d => d.month === filterMonth && d.year === filterYear);
                setSelectedDueIds(matchingDue ? [matchingDue.id] : [data[0].id]);
                setWarningModalData({ payment, dues: data });
            } else {
                handleBatchOfflineRequests(payment.student_id, [payment]);
            }
        } catch (err) {
            setError(err.message || "Verification check failed.");
        }
    };

    const handleBatchOfflineRequests = async (studentId, paymentsArray) => {
        const paymentIds = paymentsArray.map(p => p.id);
        const firstPaymentId = paymentIds[0];
        
        setOfflineLoading(firstPaymentId);
        setError("");
        
        try {
            await api.post("/api/payments/offline-batch", {
                student_id: studentId,
                payment_ids: paymentIds
            });
            
            const currentPayments = paymentsRef.current;
            const updated = currentPayments.filter(p => !paymentIds.includes(p.id));
            setPayments(updated);
            
            const countToSubtract = paymentsArray.filter(p => p.status === "Unpaid").length;
            setCounts(c => ({
                ...c,
                unpaid_count: Math.max(0, (c.unpaid_count || 0) - countToSubtract),
                paid_count: (c.paid_count || 0) + paymentsArray.length
            }));
        } catch (err) {
            if (!isSystemicError(err.message)) {
                const msg = err.message || "Failed to submit offline request.";
                setError(msg);
            }
        } finally {
            setOfflineLoading(null);
        }
    };

    // Summary stats
    const { total_students: totalStudents, paid_count: paidCount, unpaid_count: unpaidCount } = counts;

    const statusLabel = (s) => (s === "Pending_Verification" ? "Pending" : s || "—");
    const filteredPayments = payments.filter(p => 
        (p.student_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );



    const selectedBatchName = batches.find(b => b.id === selectedBatch)?.batch_name || "Select Batch";

    return (
        <div className="space-y-6">
            {/* ── Welcome ── */}
            <div>
                <h1
                    className="text-2xl md:text-3xl font-extrabold tracking-tight"
                    style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}
                >
                    <AnimatedGreeting name={user?.name || "Teacher"} />
                </h1>
            </div>

            {/* ── Current Filter ── */}
            <section>
                <div
                    className="rounded-[2rem] p-5 w-full border"
                    style={{ 
                        backgroundColor: 'var(--tt-card-bg)', 
                        borderColor: 'var(--tt-card-border)',
                        boxShadow: 'var(--tt-card-shadow)',
                        transform: "translateZ(0)", 
                        isolation: "isolate", 
                        backfaceVisibility: "hidden", 
                        WebkitBackfaceVisibility: "hidden" 
                    }}
                >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                        {/* Batch - First on mobile */}
                        <div className="col-span-2 md:order-3 md:col-span-2">
                            <ModernSelect
                                value={selectedBatch}
                                options={batches}
                                placeholder="Select Batch"
                                onChange={(e) => { setSelectedBatch(e.target.value); setHasLoaded(false); setPayments([]); }}
                                className="w-full"
                                theme={theme}
                            />
                        </div>

                        {/* Month */}
                        <div className="col-span-1 md:order-1">
                            <ModernSelect
                                value={filterMonth}
                                options={MONTH_FULL.map((m, i) => ({ value: i + 1, label: m }))}
                                onChange={(e) => { setFilterMonth(e.target.value); setHasLoaded(false); setPayments([]); }}
                                className="w-full"
                                theme={theme}
                            />
                        </div>

                        {/* Year */}
                        <div className="col-span-1 md:order-2">
                            <ModernSelect
                                value={filterYear}
                                options={getYearOptions()}
                                onChange={(e) => { setFilterYear(parseInt(e.target.value)); setHasLoaded(false); setPayments([]); }}
                                className="w-full"
                                theme={theme}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Summary Cards ── */}
            <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Total Students - Full width on mobile, 1 col on desktop */}
                <GlassCard className="col-span-2 md:col-span-1 p-6 relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--tt-text-secondary)' }}>
                                Total
                            </p>
                            <p className="text-3xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                                {totalStudents}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--tt-accent-bg)' }}>
                            <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--tt-primary)' }}>group</span>
                        </div>
                    </div>
                </GlassCard>

                {/* Paid - Side by side on mobile */}
                <GlassCard className="col-span-1 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>
                                Paid
                            </p>
                            <p className="text-3xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                                {paidCount}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: isLight ? 'rgba(13, 148, 136, 0.1)' : 'rgba(74, 248, 227, 0.1)' }}>
                            <span className="material-symbols-outlined text-2xl" style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>check_circle</span>
                        </div>
                    </div>
                </GlassCard>

                {/* Unpaid - Side by side on mobile */}
                <GlassCard className="col-span-1 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--tt-error)' }}>
                                Unpaid
                            </p>
                            <p className="text-3xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                                {unpaidCount}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--tt-error-bg, rgba(239, 68, 68, 0.1))' }}>
                            <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--tt-error)' }}>cancel</span>
                        </div>
                    </div>
                </GlassCard>
            </section>

            {/* ── Alerts ── */}
            {error && (
                <div className="p-4 rounded-2xl flex items-center justify-between border" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--tt-error)' }}>
                    <span className="text-sm font-medium">{error}</span>
                    <button onClick={() => setError("")} className="ml-2 cursor-pointer transition-opacity hover:opacity-80" style={{ color: 'var(--tt-error)' }}>
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}

            {/* ── Payment Status ── */}
            {loading ? (
                <div className="mt-6">
                    <TeacherPaymentsListSkeleton />
                </div>
            ) : !hasLoaded ? (
                /* ── Empty State: Not loaded yet ── */
                <section className="mt-8">
                    <GlassCard className="p-16 flex flex-col items-center justify-center text-center gap-4">
                        <span className="material-symbols-outlined text-5xl opacity-30" style={{ color: 'var(--tt-text-muted)' }}>payments</span>
                        <h3 className="font-bold text-lg" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>Select Batch</h3>
                        <p className="text-sm max-w-xs" style={{ color: 'var(--tt-text-secondary)' }}>Please select a batch to view its payments and pending actions.</p>
                    </GlassCard>
                </section>
            ) : (
                /* ── Card Layout ── */
                <section>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h2 className="font-bold text-lg" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                            Pending Actions
                        </h2>
                        {payments.length > 0 && (
                            <div className="relative w-full sm:w-64">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none" style={{ color: 'var(--tt-text-secondary)', opacity: 0.6 }}>search</span>
                                <input
                                    type="text"
                                    placeholder="Search Student"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-[var(--tt-primary)]/50 transition-colors"
                                    style={{
                                        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.02)',
                                        borderColor: 'var(--tt-input-border)',
                                        color: 'var(--tt-text-primary)'
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:text-[#ff6e84] transition-colors cursor-pointer w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/5"
                                        style={{ color: 'var(--tt-text-secondary)' }}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        {filteredPayments.length === 0 ? (
                            <GlassCard className="p-10 text-center">
                                {searchQuery ? (
                                    <>
                                        <span className="material-symbols-outlined text-5xl mb-3 block animate-pulse" style={{ color: 'var(--tt-primary)', opacity: 0.4 }}>search_off</span>
                                        <p className="font-bold text-sm" style={{ color: 'var(--tt-text-primary)' }}>No matching students found</p>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: 'var(--tt-primary)', opacity: 0.4 }}>verified</span>
                                        <p className="font-bold text-sm" style={{ color: 'var(--tt-text-primary)' }}>No Pending Actions! 🎉</p>
                                    </>
                                )}
                            </GlassCard>
                        ) : (
                            filteredPayments.map((p) => (
                                <GlassCard
                                    key={p.id}
                                    className="p-4 transition-all hover:bg-white/5"
                                    style={{ backgroundColor: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--tt-card-border)' }}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Avatar */}
                                        <CachedAvatar uid={p.student_id} name={p.student_name} profile_pic_url={p.profile_pic_url} pic_version={p.pic_version} size={48} />

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold truncate" style={{ color: 'var(--tt-text-primary)' }}>{p.student_name}</p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--tt-text-secondary)' }}>₹{p.amount}</p>
                                        </div>

                                        {/* Status */}
                                        <StatusBadge status={p.status} />
                                    </div>

                                    {/* Offline button for Unpaid or Rejected */}
                                    {(p.status === "Unpaid" || p.status === "Rejected") && (
                                        <button
                                            onClick={() => handlePreOfflineClick(p)}
                                            disabled={offlineLoading === p.id}
                                            className="w-full mt-3 py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                                            style={{
                                                background: isLight 
                                                    ? 'linear-gradient(to right, rgba(13, 148, 136, 0.15), rgba(13, 148, 136, 0.15))'
                                                    : 'linear-gradient(to right, rgba(74, 248, 227, 0.1), rgba(59, 130, 246, 0.1))',
                                                borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.2)',
                                                color: isLight ? '#0d9488' : '#4af8e3'
                                            }}
                                        >
                                            {offlineLoading === p.id ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)', borderTopColor: isLight ? '#0d9488' : '#4af8e3' }} />
                                                    Submitting...
                                                </span>
                                            ) : (
                                                "Mark Offline Paid"
                                            )}
                                        </button>
                                    )}
                                </GlassCard>
                            ))
                        )}
                    </div>
                </section>
            )}

            {/* Offline Due Warning Modal */}
            {warningModalData && createPortal(
                (() => {
                    const { payment, dues } = warningModalData;
                    const targetText = `I CONFIRM OFFLINE PAYMENT`;
                    
                    return (
                        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => setWarningModalData(null)} style={{ touchAction: "none" }}>
                            <div 
                                className="rounded-[32px] p-6 sm:p-8 w-full max-w-md border animate-modal-in"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(12, 14, 23, 0.95)',
                                    borderColor: isLight ? 'rgba(217, 119, 6, 0.3)' : 'rgba(251, 191, 36, 0.2)',
                                    boxShadow: isLight ? '0 20px 50px rgba(0,0,0,0.05)' : '0 20px 50px rgba(0,0,0,0.5)'
                                }}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-bold text-xl flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: isLight ? '#b45309' : '#fbbf24' }}>
                                        <span className="material-symbols-outlined">warning</span>
                                        Multiple Dues Found!
                                    </h3>
                                    <button onClick={() => setWarningModalData(null)} className="transition-colors cursor-pointer p-2 rounded-full hover:bg-white/5 flex items-center justify-center" style={{ color: 'var(--tt-text-secondary)' }}>
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                
                                <div className="space-y-4 mb-6" style={{ color: 'var(--tt-text-secondary)' }}>
                                    <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--tt-text-primary)' }}>
                                        <span className="font-bold" style={{ color: 'var(--tt-text-primary)' }}>{payment.student_name}</span> has {dues.length} unpaid dues. 
                                    </p>
                                    
                                    <div className="border p-4 rounded-2xl text-[13px] leading-relaxed" style={{ backgroundColor: isLight ? 'rgba(217, 119, 6, 0.05)' : 'rgba(251, 191, 36, 0.05)', borderColor: isLight ? 'rgba(217, 119, 6, 0.15)' : 'rgba(251, 191, 36, 0.1)' }}>
                                        <p className="font-bold mb-3 tracking-wide uppercase text-[11px]" style={{ color: isLight ? '#b45309' : '#fbbf24' }}>Select Months to Mark Paid:</p>
                                        <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                                            {dues.map(d => {
                                                const isChecked = selectedDueIds.includes(d.id);
                                                return (
                                                    <label 
                                                        key={d.id} 
                                                        className={`flex items-center gap-3 cursor-pointer select-none py-2 px-3 rounded-xl transition-all border ${
                                                            isChecked 
                                                                ? (isLight 
                                                                    ? 'bg-[#0d9488]/15 text-[#0d9488] font-bold border-[#0d9488]/30 shadow-[0_2px_10px_rgba(13,148,136,0.05)]' 
                                                                    : 'bg-[#4af8e3]/10 text-[#4af8e3] font-bold border-[#4af8e3]/20 shadow-[0_2px_10px_rgba(74,248,227,0.05)]') 
                                                                : 'border-transparent bg-white/[0.01]'
                                                        }`}
                                                        style={{ color: isChecked ? '' : 'var(--tt-text-secondary)' }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                if (isChecked) {
                                                                    setSelectedDueIds(selectedDueIds.filter(id => id !== d.id));
                                                                } else {
                                                                    setSelectedDueIds([...selectedDueIds, d.id]);
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded focus:ring-offset-0 focus:outline-none cursor-pointer"
                                                            style={{ accentColor: isLight ? '#0d9488' : '#4af8e3' }}
                                                        />
                                                        <span className="font-medium">
                                                            {MONTH_FULL[d.month - 1]} {d.year} (₹{d.amount})
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <p className="text-xs font-medium italic leading-snug" style={{ color: isLight ? '#b45309' : '#fbbf24' }}>
                                        Are you sure you want to exceptionally mark the selected months as Paid (Offline)?
                                    </p>
    
                                    <div className="mt-4">
                                        <label className="block text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--tt-text-secondary)' }}>
                                            Type <span className="font-black select-all cursor-pointer" style={{ color: isLight ? '#b45309' : '#fbbf24' }}>{targetText}</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={warningConfirmText}
                                            onChange={(e) => setWarningConfirmText(e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.03] border focus:ring-offset-0 text-sm font-medium focus:outline-none transition-all"
                                            style={{ backgroundColor: 'var(--tt-input-bg)', borderColor: 'var(--tt-input-border)', color: 'var(--tt-text-primary)' }}
                                            placeholder={targetText}
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>
    
                                <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8">
                                    <button onClick={() => setWarningModalData(null)} className="w-full sm:flex-1 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer" style={{ backgroundColor: 'var(--tt-hover-bg)', color: 'var(--tt-text-secondary)' }}>
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setWarningModalData(null);
                                            const duesToPay = dues.filter(d => selectedDueIds.includes(d.id));
                                            if (duesToPay.length > 0) {
                                                handleBatchOfflineRequests(payment.student_id, duesToPay);
                                            }
                                        }}
                                        disabled={warningConfirmText !== targetText || selectedDueIds.length === 0}
                                        className="w-full sm:flex-[1.5] py-3.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:scale-100 cursor-pointer flex items-center justify-center gap-2"
                                        style={{ backgroundColor: isLight ? '#0d9488' : '#4af8e3', color: isLight ? '#ffffff' : '#0c0e17', boxShadow: isLight ? '0 8px 20px rgba(13,148,136,0.2)' : '0 8px 20px rgba(74,248,227,0.2)' }}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">verified</span>
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })(),
                document.body
            )}
        </div>
    );
}

export default function TeacherDashboard() {
    return (
        <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherLayout>
                <TeacherDashboardContent />
            </TeacherLayout>
        </ProtectedRoute>
    );
}

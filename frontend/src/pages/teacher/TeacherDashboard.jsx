import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import ProfilePicture from "@/components/ProfilePicture";
import AnimatedGreeting from "@/components/AnimatedGreeting";
import CachedAvatar from "@/components/CachedAvatar";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { getYearOptions } from "@/lib/yearOptions";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import ModernSelect from "@/components/ModernSelect";
import { TeacherDashboardSkeleton } from "@/components/Skeletons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── Status Badge ──
function StatusBadge({ status }) {
    const config = {
        Paid: {
            bg: "bg-[#4af8e3]/10",
            text: "text-[#4af8e3]",
            ring: "ring-[#4af8e3]/30",
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

// ── Student Initial Avatar ──
// Removed in favor of CachedAvatar

// ── Glass Card Component ──
function GlassCard({ children, className = "", style = {} }) {
    return (
        <div
            className={`rounded-[28px] border border-white/[0.07] ${className}`}
            style={{
                background: "rgba(28, 31, 43, 0.6)",
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
    
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());

    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState("");
    const [payments, setPayments] = useState([]);
    const paymentsRef = useRef([]); // Mirror of payments state for reading in snapshot callbacks
    
    // Loading state for batches (on mount) and payments (on button click)
    const [loading, setLoading] = useState(false);
    const [batchesLoading, setBatchesLoading] = useState(true);
    
    const [error, setError] = useState("");
    const [offlineLoading, setOfflineLoading] = useState(null);
    const [warningModalData, setWarningModalData] = useState(null);
    const [warningConfirmText, setWarningConfirmText] = useState("");
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
            if (data.length > 0) {
                setSelectedBatch(prev => prev || data[0].id);
            }
        } catch (err) {
            // Handled globally
        } finally {
            GLOBAL_FETCHING_BATCHES = false;
            setBatchesLoading(false);
        }
    }, []); // Empty dependencies for stability

    const fetchPayments = useCallback(async () => {
        if (!selectedBatch) return;
        
        setLoading(true);
        setError("");
        try {
            let url = `/api/teacher/payments?batch_id=${selectedBatch}&year=${filterYear}`;
            if (filterMonth) url += `&month=${filterMonth}`;
            const response = await api.get(url);
            
            // Handle the new response structure { summary, records }
            const data = response.data || response;
            if (data.summary) {
                setCounts(data.summary);
                setPayments(data.records || []);
            } else {
                // Fallback for old API just in case (though we just updated it)
                setPayments(data);
                setCounts({
                    total_students: data.length,
                    paid_count: data.filter(p => p.status === "Paid").length,
                    unpaid_sum: data.filter(p => p.status !== "Paid").length
                });
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message || "Failed to fetch payments");
            }
        } finally {
            setLoading(false);
        }
    }, [selectedBatch, filterMonth, filterYear]);

    // Initial fetch for batches only — NO automatic payment fetch anymore
    useEffect(() => {
        if (user?.uid) {
            fetchBatches();
        }
        const handleOnline = () => {
            if (user?.uid) fetchBatches();
        };
        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, [user?.uid, fetchBatches]);

    // Track if the user has explicitly clicked View at least once for current filters

    const handleView = async () => {
        if (!selectedBatch) return;
        setHasLoaded(false);
        await fetchPayments();
        setHasLoaded(true);
    };

    // ── Granular Real-Time Listener ──
    // Tracks active specific query visually without heavy network refetches
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

            // Read from paymentsRef (always latest)
            const currentPayments = paymentsRef.current;
            const updatedPayments = [...currentPayments];
            let changed = false;
            let paidDelta = 0;

            for (const mod of changedDocs) {
                // Match by ID, OR by student_id to catch "virtual" Unpaid rows that don't have a real Firestore ID yet
                const idx = updatedPayments.findIndex(p => p.id === mod.id || p.student_id === mod.student_id);
                if (idx !== -1) {
                    const oldStatus = updatedPayments[idx].status;
                    const newStatus = mod.status;
                    if (oldStatus !== newStatus) {
                        if (newStatus === "Paid") {
                            // Remove from teacher list instantly — payment is done!
                            updatedPayments.splice(idx, 1);
                            paidDelta += 1;
                        } else {
                            // Update status in-place (e.g. Unpaid → Pending)
                            updatedPayments[idx] = { ...updatedPayments[idx], status: newStatus, mode: mod.mode };
                        }
                        changed = true;
                    }
                }
            }

            if (!changed) return;

            // unpaid_count: count directly from array (most reliable — no delta math)
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
        setOfflineLoading(payment.id);
        setError("");
        
        try {
            // Pre-check for previous dues
            const targetMonth = payment.month || filterMonth;
            const targetYear = payment.year || filterYear;
            
            const dueRecords = await api.get(`/api/teacher/student-dues/${payment.student_id}?before_month=${targetMonth}&before_year=${targetYear}`);

            
            if (dueRecords.length > 0) {
                setOfflineLoading(null);
                setWarningModalData({ payment, dues: dueRecords });
                setWarningConfirmText("");
                return; // Stop here, wait for modal unblock
            }
            
            // No dues found, proceed
            handleOfflineRequest(payment);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
            setOfflineLoading(null);
        }
    };

    const handleOfflineRequest = async (payment) => {
        setOfflineLoading(payment.id);
        setError("");

        try {
            await api.post("/api/teacher/offline-request", {
                student_id: payment.student_id,
                month: payment.month || filterMonth,
                year: payment.year || filterYear,
                batch_name: selectedBatchName,
                amount: payment.amount,
            });
            // ── No Optimistic UI here! ──
            // We rely completely on onSnapshot. The API call updates the DB,
            // the listener fetches the exact delta, updates the payments array with the REAL Firestore ID,
            // and mathematically updates unpaid_count perfectly in sync.
        } catch (err) {
            const msg = typeof err.message === "string" ? err.message : JSON.stringify(err.message);
            if (!isSystemicError(msg)) {
                setError(msg);
            }
        } finally {
            setOfflineLoading(null);
        }
    };

    // Summary stats
    const { total_students: totalStudents, paid_count: paidCount, unpaid_count: unpaidCount } = counts;

    const statusLabel = (s) => (s === "Pending_Verification" ? "Pending" : s || "—");
    const filteredPayments = payments; // Now filtered on the backend!

    if (batchesLoading) {
        return <div className="p-6"><TeacherDashboardSkeleton /></div>;
    }

    const selectedBatchName = batches.find(b => b.id === selectedBatch)?.batch_name || "Select Batch";

    return (
        <div className="space-y-6">
            {/* ── Welcome ── */}
            <div>
                <h1
                    className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#f0f0fd]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                    <AnimatedGreeting name={user?.name || "Teacher"} />
                </h1>
            </div>

            {/* ── Current Filter ── */}
            <section>
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Batch - First on mobile */}
                        <div className="col-span-2 md:order-3 md:col-span-2">
                            <ModernSelect
                                icon="school"
                                value={selectedBatch}
                                options={batches}
                                onChange={(e) => { setSelectedBatch(e.target.value); setHasLoaded(false); setPayments([]); }}
                                className="w-full"
                            />
                        </div>

                        {/* Month */}
                        <div className="col-span-1 md:order-1">
                            <ModernSelect
                                icon="calendar_month"
                                value={filterMonth}
                                options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                                onChange={(e) => { setFilterMonth(e.target.value); setHasLoaded(false); setPayments([]); }}
                                className="w-full"
                            />
                        </div>

                        {/* Year */}
                        <div className="col-span-1 md:order-2">
                            <ModernSelect
                                icon="event"
                                value={filterYear}
                                options={getYearOptions()}
                                onChange={(e) => { setFilterYear(parseInt(e.target.value)); setHasLoaded(false); setPayments([]); }}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleView}
                        disabled={!selectedBatch || loading}
                        className="px-8 py-3 rounded-2xl bg-[#4af8e3]/10 backdrop-blur-md border border-[#4af8e3]/30 text-[#4af8e3] text-sm font-bold uppercase tracking-widest hover:bg-[#4af8e3]/20 transition-all shadow-[0_4px_20px_rgba(74,248,227,0.1)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 h-[52px]"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <span className="material-symbols-outlined text-lg">search</span>
                        )}
                        View
                    </button>
                </div>
            </section>

            {/* ── Summary Cards ── */}
            <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Total Students - Full width on mobile, 1 col on desktop */}
                <GlassCard className="col-span-2 md:col-span-1 p-6 relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#aaaab7] font-bold mb-1">
                                Total
                            </p>
                            <p className="text-3xl font-extrabold text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {totalStudents}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#3b82f6] text-2xl">group</span>
                        </div>
                    </div>
                </GlassCard>

                {/* Paid - Side by side on mobile */}
                <GlassCard className="col-span-1 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#4af8e3] font-bold mb-1">
                                Paid
                            </p>
                            <p className="text-3xl font-extrabold text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {paidCount}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-[#4af8e3]/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#4af8e3] text-2xl">check_circle</span>
                        </div>
                    </div>
                </GlassCard>

                {/* Unpaid - Side by side on mobile */}
                <GlassCard className="col-span-1 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#ff6e84] font-bold mb-1">
                                Unpaid
                            </p>
                            <p className="text-3xl font-extrabold text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {unpaidCount}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-[#ff6e84]/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#ff6e84] text-2xl">cancel</span>
                        </div>
                    </div>
                </GlassCard>
            </section>

            {/* ── Alerts ── */}
            {error && (
                <div className="p-4 rounded-2xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError("")} className="ml-2 text-[#ff6e84] hover:text-white cursor-pointer">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}


            {/* ── Payment Status ── */}
            {loading ? (
                <div className="mt-6">
                    <TeacherDashboardSkeleton />
                </div>
            ) : !hasLoaded ? (
                /* ── Empty State: Not loaded yet ── */
                <section className="mt-8">
                    <GlassCard className="p-16 flex flex-col items-center justify-center text-center gap-4">
                        <span className="material-symbols-outlined text-5xl text-[#464752]">payments</span>
                        <h3 className="text-[#f0f0fd] font-bold text-lg" style={{ fontFamily: "'Manrope', sans-serif" }}>Select filters and click View</h3>
                        <p className="text-[#aaaab7] text-sm max-w-xs">No data is loaded until you click the View button.</p>
                    </GlassCard>
                </section>
            ) : (
                /* ── SINGLE MONTH — Card Layout ── */
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-lg text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            Pending Actions
                        </h2>
                    </div>
                    <div className="space-y-3">
                        {filteredPayments.length === 0 ? (
                            <GlassCard className="p-10 text-center">
                                <span className="material-symbols-outlined text-5xl text-[#3b82f6]/40 mb-3 block">verified</span>
                                <p className="text-[#f0f0fd] font-bold text-sm">No Pending Actions! 🎉</p>
                            </GlassCard>
                        ) : (
                            filteredPayments.map((p, idx) => (
                                <GlassCard
                                    key={p.id}
                                    className="p-4 hover:border-[#c799ff]/20 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Avatar */}
                                        <CachedAvatar uid={p.student_id} name={p.student_name} profile_pic_url={p.profile_pic_url} pic_version={p.pic_version} size={48} />

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-[#f0f0fd] truncate">{p.student_name}</p>
                                            <p className="text-xs text-[#aaaab7] mt-0.5">₹{p.amount}</p>
                                        </div>

                                        {/* Status */}
                                        <StatusBadge status={p.status} />
                                    </div>

                                    {/* Offline button for Unpaid or Rejected */}
                                    {(p.status === "Unpaid" || p.status === "Rejected") && (
                                        <button
                                            onClick={() => handlePreOfflineClick(p)}
                                            disabled={offlineLoading === p.id}
                                            className="w-full mt-3 py-3 rounded-2xl bg-gradient-to-r from-[#4af8e3]/10 to-[#c799ff]/10 border border-[#4af8e3]/20 text-[#4af8e3] text-xs font-bold uppercase tracking-wider hover:from-[#4af8e3]/20 hover:to-[#c799ff]/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                            {offlineLoading === p.id ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-[#4af8e3]/30 border-t-[#4af8e3] rounded-full animate-spin" />
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
                    const targetText = `I confirm to skip dues`;
                    const currentM = MONTH_FULL[(payment.month || filterMonth) - 1];
                    const currentY = payment.year || filterYear;
                    
                    return (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => setWarningModalData(null)}>
                            <div 
                                className="bg-[#0c0e17]/95 backdrop-blur-3xl rounded-[32px] p-6 sm:p-8 w-full max-w-md border border-amber-400/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative animate-modal-in"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-amber-400 font-bold text-xl flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                        <span className="material-symbols-outlined">warning</span>
                                        Previous Dues Found!
                                    </h3>
                                    <button onClick={() => setWarningModalData(null)} className="text-[#aaaab7] hover:text-white transition-colors cursor-pointer p-2 rounded-full hover:bg-white/5 flex items-center justify-center">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                
                                <div className="space-y-4 mb-6 text-[#aaaab7]">
                                    <p className="text-sm text-[#f0f0fd] font-medium leading-relaxed">
                                        <span className="font-bold text-white">{payment.student_name}</span> has unpaid dues for previous months. 
                                    </p>
                                    
                                    <div className="bg-amber-400/5 border border-amber-400/10 p-4 rounded-2xl text-[13px] leading-relaxed text-amber-200/80">
                                        <p className="font-bold mb-2 text-amber-400/90 tracking-wide uppercase text-[11px]">Unpaid Months:</p>
                                        <ul className="space-y-1.5 font-medium">
                                            {dues.map(d => (
                                                <li key={d.id} className="flex items-center gap-2">
                                                    <span className="w-1 h-1 rounded-full bg-amber-400/40" />
                                                    {MONTH_FULL[d.month - 1]} {d.year} (₹{d.amount})
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <p className="text-xs font-medium text-amber-400/70 italic leading-snug">
                                        Are you sure you want to exceptionally mark {currentM} {currentY} as Paid (Offline)?
                                    </p>
    
                                    <div className="mt-4">
                                        <label className="block text-[11px] font-bold tracking-widest uppercase mb-2 text-[#aaaab7]">
                                            Type <span className="text-amber-400 font-black select-all cursor-pointer">{targetText}</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={warningConfirmText}
                                            onChange={(e) => setWarningConfirmText(e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-amber-400/30 focus:border-amber-400/50 focus:ring-amber-400 text-[#f0f0fd] text-sm font-medium focus:outline-none transition-all placeholder:text-[#464752]"
                                            placeholder={targetText}
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>
    
                                <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8">
                                    <button onClick={() => setWarningModalData(null)} className="w-full sm:flex-1 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-widest text-[#aaaab7] bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setWarningModalData(null);
                                            handleOfflineRequest(payment);
                                        }}
                                        disabled={warningConfirmText !== targetText}
                                        className="w-full sm:flex-[1.5] py-3.5 rounded-2xl bg-amber-400 text-[#0c0e17] shadow-[0_8px_20px_rgba(251,191,36,0.2)] text-xs font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:scale-100 cursor-pointer flex items-center justify-center gap-2"
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

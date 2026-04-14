import { useState, useEffect, useCallback, useRef } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, isSystemicError } from "@/lib/api";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import ModernSelect from "@/components/ModernSelect";
import { StudentAvatarFallback } from "@/components/CachedAvatar";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function safeOptimizedUrl(url) {
    if (!url) return null;
    if (url.includes("res.cloudinary.com") && !url.includes("w_150")) {
        return url.replace("/upload/", "/upload/c_fill,h_150,w_150,q_auto,f_auto/");
    }
    return url;
}

function ApprovalContent() {
    const cacheKeyPending = "admin_pending_approvals";
    const cacheKeyBatches = "admin_approval_batches";
    const cachedPending = getCache(cacheKeyPending);
    const cachedBatches = getCache(cacheKeyBatches);

    const [pending, setPending] = useState(cachedPending || []);
    const [batches, setBatches] = useState(cachedBatches || []);
    const [filterBatch, setFilterBatch] = useState("");
    const [loading, setLoading] = useState(!cachedPending || !cachedBatches);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [actionLoading, setActionLoading] = useState(null);
    const [previewImg, setPreviewImg] = useState(null);
    const removedIdsRef = useRef(new Set());

    const fetchPending = useCallback(async () => {
        // Only show loading spinner if we have nothing cached yet
        if (!getCache("admin_pending_approvals") || !getCache("admin_approval_batches")) {
            setLoading(true);
        }
        
        try {
            const [pendingData, batchData] = await Promise.all([
                api.get("/api/admin/pending"),
                api.get("/api/admin/batches"),
            ]);
            
            if (JSON.stringify(getCache("admin_approval_batches")) !== JSON.stringify(batchData)) {
                setBatches(batchData);
                setCache("admin_approval_batches", batchData);
            }

            // Filter out any IDs we already optimistically removed
            const filteredPending = pendingData.filter(p => !removedIdsRef.current.has(p.id));
            
            if (JSON.stringify(getCache("admin_pending_approvals")) !== JSON.stringify(filteredPending)) {
                setPending(filteredPending);
                setCache("admin_pending_approvals", filteredPending);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, []); // ← No `loading` in deps — this prevents the re-render loop

    // Initial fetch — runs exactly ONCE on mount
    useEffect(() => { fetchPending(); }, [fetchPending]);

    // Real-time listener: Hydrate and inject only newly added pending payments individually
    useEffect(() => {
        let isFirstSnapshot = true;
        const q = query(
            collection(db, "payments"),
            where("status", "==", "Pending_Verification")
        );
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (isFirstSnapshot) {
                isFirstSnapshot = false;
                return; // Initial load is handled heavily by fetchPending
            }
            
            const toUpsert = [];
            const toRemove = [];

            for (const change of snapshot.docChanges()) {
                const paymentId = change.doc.id;
                
                if (change.type === "removed") {
                    toRemove.push(paymentId);
                    continue;
                }

                const data = change.doc.data();
                
                // ── KEY FIX ──
                // If a previously rejected payment is re-submitted as Pending_Verification,
                // it comes back as "added" in this query's scope.
                // We MUST clear it from removedIdsRef so it shows up again.
                if (data.status === "Pending_Verification" && removedIdsRef.current.has(paymentId)) {
                    removedIdsRef.current.delete(paymentId);
                }
                
                // Skip if still tracked as locally removed
                if (removedIdsRef.current.has(paymentId)) continue;
                
                // Fetch student and batch softly
                let studentName = data.student_name || "Unknown Student";
                let profilePicUrl = data.profile_pic_url || null;
                
                // If the backend didn't attach student info (e.g. online payloads), fetch manually via secure backend API
                // Offline payments have student_name but no profile_pic_url — so we always fetch when pic is missing
                if ((!data.student_name || !data.profile_pic_url) && data.student_id) {
                    try {
                        const userProfile = await api.get(`/api/admin/users/${data.student_id}`);
                        studentName = userProfile.name || studentName;
                        profilePicUrl = userProfile.profile_pic_url || null;
                    } catch (e) {
                        console.error("Failed to fetch user profile via API:", e);
                    }
                }

                let batchName = data.batch_name || "Unknown Batch";
                if (!data.batch_name && data.batch_id) {
                     const matchBatch = batches.find(b => b.id === data.batch_id);
                     if (matchBatch) batchName = matchBatch.batch_name;
                }
                
                toUpsert.push({
                    id: paymentId,
                    ...data,
                    student_name: studentName,
                    profile_pic_url: profilePicUrl,
                    batch_name: batchName,
                    teacher_name: data.teacher_name || "Instructor"
                });
            }
            
            if (toUpsert.length > 0 || toRemove.length > 0) {
                setPending(prev => {
                    let updated = [...prev];
                    
                    // 1. Process Removals
                    if (toRemove.length > 0) {
                        const removeSet = new Set(toRemove);
                        updated = updated.filter(p => !removeSet.has(p.id));
                    }
                    
                    // 2. Process Upserts (Additions/Modifications)
                    for (const item of toUpsert) {
                        const idx = updated.findIndex(p => p.id === item.id);
                        if (idx !== -1) {
                            // Already exists in view: overwrite it
                            updated[idx] = { ...updated[idx], ...item };
                        } else {
                            // Newly entered the pending queue: pop to the top
                            updated.unshift(item);
                        }
                    }
                    
                    setCache(cacheKeyPending, updated);
                    return updated;
                });
            }
        });
        
        return () => unsubscribe();
    }, [batches]);

    const filtered = filterBatch
        ? pending.filter((p) => p.batch_id === filterBatch)
        : pending;

    const handleApprove = async (paymentId) => {
        setActionLoading(paymentId);
        setError("");

        // Register to ignore future stale network reads
        removedIdsRef.current.add(paymentId);

        // Optimistic UI Update
        setPending(prev => {
            const updated = prev.filter(p => p.id !== paymentId);
            setCache(cacheKeyPending, updated);
            return updated;
        });

        try {
            await api.put(`/api/admin/approve/${paymentId}`);
            setSuccess("Payment approved!");
        } catch (err) { 
            if (!isSystemicError(err.message)) {
                setError(err.message); 
            }
            removedIdsRef.current.delete(paymentId); // Untrack on failure
            fetchPending(); // Revert on error
        }
        finally { setActionLoading(null); }
    };

    const handleReject = async (paymentId) => {
        setActionLoading(paymentId);
        setError("");

        // Register to ignore future stale network reads
        removedIdsRef.current.add(paymentId);

        // Optimistic UI Update
        setPending(prev => {
            const updated = prev.filter(p => p.id !== paymentId);
            setCache(cacheKeyPending, updated);
            return updated;
        });

        try {
            await api.put(`/api/admin/reject/${paymentId}`);
            setSuccess("Payment rejected.");
        } catch (err) { 
            if (!isSystemicError(err.message)) {
                setError(err.message); 
            }
            removedIdsRef.current.delete(paymentId); // Untrack on failure
            fetchPending(); // Revert on error
        }
        finally { setActionLoading(null); }
    };

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (loading) {
        return (
            <div className="p-6">
                <GenericListSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                <div className="space-y-1">
                    <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Approval Queue
                    </h1>
                </div>
                    <div className="relative z-10 w-full sm:w-auto min-w-[200px]">
                        <ModernSelect
                            value={filterBatch}
                            onChange={(e) => setFilterBatch(e.target.value)}
                            options={[{ id: "", batch_name: "All Batches" }, ...batches]}
                            placeholder="All Batches"
                            className="w-full flex items-center justify-between bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 text-[#f0f0fd] text-sm"
                        />
                    </div>
            </div>

            {error && (
                <div className="mb-4 p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#ff6e84]/30 shadow-lg text-[#ff9dac] text-sm flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#4af8e3]/30 shadow-lg text-[#dcfff8] text-sm flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#4af8e3]">check_circle</span>
                    <span className="flex-1">{success}</span>
                    <button onClick={() => setSuccess("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                </div>
            )}

            {filtered.length === 0 ? (
                <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-3xl p-10 sm:p-12 text-center">
                    <span className="text-5xl block mb-4 drop-shadow-md">🎉</span>
                    <p className="text-[#f0f0fd] text-xl font-bold" style={{ fontFamily: "'Manrope', sans-serif" }}>All clear!</p>
                    <p className="text-[#aaaab7] text-sm mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>No pending approvals at the moment.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((item, idx) => (
                        <div key={item.id} className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-5 sm:p-6 transition-colors hover:bg-[#171924]/80">
                            {/* Top: Name + Badges */}
                            <div className="flex items-center gap-4 mb-4 flex-wrap">
                                {item.profile_pic_url ? (
                                    <img src={safeOptimizedUrl(item.profile_pic_url)} alt="Avatar" className="w-[44px] h-[44px] min-w-[44px] rounded-2xl object-cover shrink-0 shadow-lg border border-white/10" loading="lazy" />
                                ) : (
                                    <StudentAvatarFallback name={item.student_name} size={44} />
                                )}
                                <h3 className="text-[#f0f0fd] font-bold text-base sm:text-lg truncate flex-1 min-w-0" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    {item.student_name || "Unknown Student"}
                                </h3>
                                <span className={`shrink-0 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border
                                    ${item.mode === "online" ? "bg-[#c799ff]/10 text-[#c799ff] border-[#c799ff]/30" : "bg-[#ff9dac]/10 text-[#ff9dac] border-[#ff9dac]/30"}`}>
                                    {item.mode === "online" ? "📱 Online" : "💵 Offline"}
                                </span>
                            </div>

                            {/* Details row */}
                            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm text-[#aaaab7] mb-6 font-medium">
                                <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[#c799ff] text-base">calendar_today</span> {MONTHS[item.month - 1]} {item.year}</span>
                                <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[#4af8e3] text-base">payments</span> ₹{item.amount}</span>
                                {item.batch_name && <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[#ff9dac] text-base">group</span> {item.batch_name}</span>}
                                {item.teacher_name && <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-white/70 text-base">person</span> {item.teacher_name}</span>}
                            </div>

                            {/* Screenshot + Actions */}
                            <div className="flex items-center justify-between gap-4">
                                {item.screenshot_url ? (
                                    <button onClick={() => setPreviewImg(item.screenshot_url)}
                                        className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-[#464752]/50 active:border-[#c799ff] transition-all cursor-pointer group relative">
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                            <span className="material-symbols-outlined text-white">zoom_in</span>
                                        </div>
                                        <img src={item.screenshot_url} alt="Screenshot" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    </button>
                                ) : <div />}

                                <div className="flex gap-2 sm:gap-3">
                                    <button onClick={() => handleApprove(item.id)} disabled={actionLoading === item.id}
                                        className="flex-1 sm:flex-none px-4 sm:px-6 py-3 rounded-xl bg-[#4af8e3]/10 border border-[#4af8e3]/30 text-[#4af8e3] text-xs sm:text-sm shadow-sm transition-all
                                            hover:bg-[#4af8e3]/20 hover:border-[#4af8e3]/50 disabled:opacity-50 cursor-pointer flex items-center gap-2 font-bold uppercase tracking-wider" style={{ fontFamily: "'Inter', sans-serif" }}>
                                        <span className="material-symbols-outlined text-base">check_circle</span>
                                        <span className="hidden sm:inline">Approve</span>
                                    </button>
                                    <button onClick={() => handleReject(item.id)} disabled={actionLoading === item.id}
                                        className="flex-1 sm:flex-none px-4 sm:px-6 py-3 rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/30 text-[#ff6e84] text-xs sm:text-sm shadow-sm transition-all
                                            hover:bg-[#ff6e84]/20 hover:border-[#ff6e84]/50 disabled:opacity-50 cursor-pointer flex items-center gap-2 font-bold uppercase tracking-wider" style={{ fontFamily: "'Inter', sans-serif" }}>
                                        <span className="material-symbols-outlined text-base">cancel</span>
                                        <span className="hidden sm:inline">Reject</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {previewImg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setPreviewImg(null)}>
                    <div className="relative max-w-2xl w-full max-h-[80vh] flex justify-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setPreviewImg(null)}
                            className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-[#171924] border border-white/10 text-white flex items-center justify-center hover:bg-white/10 cursor-pointer z-10 transition-colors shadow-xl">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                        <img src={previewImg} alt="Payment Screenshot" className="rounded-3xl max-h-[80vh] w-auto max-w-full object-contain border border-[#464752]/50 shadow-2xl shadow-black/80" />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminApprovals() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <ApprovalContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

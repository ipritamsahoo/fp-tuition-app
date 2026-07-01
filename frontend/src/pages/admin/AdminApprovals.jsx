import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, isSystemicError } from "@/lib/api";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import ModernSelect from "@/components/ModernSelect";
import { StudentAvatarFallback } from "@/components/CachedAvatar";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";
import { useAdminTheme } from "@/context/AdminThemeContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function safeOptimizedUrl(url) {
    if (!url) return null;
    if (url.includes("res.cloudinary.com") && !url.includes("w_150")) {
        return url.replace("/upload/", "/upload/c_fill,h_150,w_150,q_auto,f_auto/");
    }
    return url;
}

function ApprovalContent() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    const cacheKeyPending = "admin_pending_approvals";
    const cacheKeyBatches = "admin_approval_batches";
    const cachedPending = getCache(cacheKeyPending);
    const cachedBatches = getCache(cacheKeyBatches);

    const [pending, setPending] = useState(cachedPending || []);
    const [batches, setBatches] = useState(cachedBatches || []);
    const [filterBatch, setFilterBatch] = useState("");
    const [filterMode, setFilterMode] = useState("");
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

    // Disable body scroll when payment screenshot preview is open
    useEffect(() => {
        if (previewImg) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [previewImg]);

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

    const filtered = pending.filter((p) => {
        const matchesBatch = filterBatch ? p.batch_id === filterBatch : true;
        const matchesMode = filterMode ? p.mode === filterMode : true;
        return matchesBatch && matchesMode;
    });

    const handleApproveGroup = async (group) => {
        const paymentIds = group.payments.map(p => p.id);
        setActionLoading(group.id);
        setError("");

        // Register to ignore future stale network reads
        paymentIds.forEach(id => removedIdsRef.current.add(id));

        // Optimistic UI Update
        setPending(prev => {
            const updated = prev.filter(p => !paymentIds.includes(p.id));
            setCache(cacheKeyPending, updated);
            return updated;
        });

        try {
            await api.put(`/api/admin/approve/batch`, { payment_ids: paymentIds });
            setSuccess("Payments approved!");
        } catch (err) { 
            if (!isSystemicError(err.message)) {
                setError(err.message); 
            }
            paymentIds.forEach(id => removedIdsRef.current.delete(id)); // Untrack on failure
            fetchPending(); // Revert on error
        } finally { 
            setActionLoading(null); 
        }
    };

    const handleRejectGroup = async (group) => {
        const paymentIds = group.payments.map(p => p.id);
        setActionLoading(group.id);
        setError("");

        // Register to ignore future stale network reads
        paymentIds.forEach(id => removedIdsRef.current.add(id));

        // Optimistic UI Update
        setPending(prev => {
            const updated = prev.filter(p => !paymentIds.includes(p.id));
            setCache(cacheKeyPending, updated);
            return updated;
        });

        try {
            await api.put(`/api/admin/reject/batch`, { payment_ids: paymentIds });
            setSuccess("Payments rejected.");
        } catch (err) { 
            if (!isSystemicError(err.message)) {
                setError(err.message); 
            }
            paymentIds.forEach(id => removedIdsRef.current.delete(id)); // Untrack on failure
            fetchPending(); // Revert on error
        } finally { 
            setActionLoading(null); 
        }
    };

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (loading) {
        return (
            <div className="p-6">
                <GenericListSkeleton />
            </div>
        );
    }

    // Grouping the filtered list
    const groupedPending = [];
    const groups = {};

    filtered.forEach(p => {
        const key = p.screenshot_url ? `online-${p.student_id}-${p.screenshot_url}` : `offline-${p.student_id}`;
        if (!groups[key]) {
            groups[key] = {
                id: key,
                student_id: p.student_id,
                student_name: p.student_name,
                profile_pic_url: p.profile_pic_url,
                pic_version: p.pic_version,
                mode: p.mode,
                screenshot_url: p.screenshot_url,
                screenshot_public_id: p.screenshot_public_id,
                batch_id: p.batch_id,
                batch_name: p.batch_name,
                teacher_name: p.teacher_name,
                payments: [],
            };
            groupedPending.push(groups[key]);
        }
        groups[key].payments.push(p);
    });

    groupedPending.forEach(group => {
        group.payments.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });
        
        group.totalAmount = group.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        group.monthsLabel = group.payments.map(p => `${MONTHS[p.month - 1]} ${p.year}`).join(", ");
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                <div className="space-y-1">
                    <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                        Approval Queue
                    </h1>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative z-10 w-full sm:w-auto min-w-[150px]">
                        <ModernSelect
                            value={filterBatch}
                            onChange={(e) => setFilterBatch(e.target.value)}
                            options={[{ id: "", batch_name: "All Batches" }, ...batches]}
                            placeholder="All Batches"
                            className="w-full flex items-center justify-between border hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-sm"
                            style={{
                                backgroundColor: 'var(--ad-input-bg)',
                                borderColor: 'var(--ad-input-border)',
                                color: 'var(--ad-text-primary)'
                            }}
                        />
                    </div>
                    <div className="relative z-10 w-full sm:w-auto min-w-[150px]">
                        <ModernSelect
                            value={filterMode}
                            onChange={(e) => setFilterMode(e.target.value)}
                            options={[
                                { value: "", label: "All Modes" },
                                { value: "online", label: "📱 Online" },
                                { value: "offline", label: "💵 Offline" }
                            ]}
                            placeholder="All Modes"
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

            {error && (
                <div className="mb-4 p-4 rounded-xl border shadow-lg text-sm flex items-center gap-3"
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
            {success && (
                <div className="mb-4 p-4 rounded-xl border shadow-lg text-sm flex items-center gap-3"
                     style={{
                         backgroundColor: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(30, 41, 59, 0.85)',
                         borderColor: 'rgba(74, 248, 227, 0.3)',
                         color: isLight ? 'var(--ad-text-primary)' : '#dcfff8'
                     }}
                >
                    <span className="material-symbols-outlined text-[#4af8e3]">check_circle</span>
                    <span className="flex-1 font-medium">{success}</span>
                    <button onClick={() => setSuccess("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                </div>
            )}

            {groupedPending.length === 0 ? (
                <div className="backdrop-blur-[20px] border rounded-3xl p-10 sm:p-12 text-center shadow-lg"
                     style={{
                         backgroundColor: 'var(--ad-card-bg)',
                         borderColor: 'var(--ad-card-border)'
                     }}
                >
                    <span className="text-5xl block mb-4 drop-shadow-md">🎉</span>
                    <p className="text-xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>All clear!</p>
                    <p className="text-sm mt-1" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--ad-text-secondary)' }}>No pending approvals at the moment.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groupedPending.map((group, idx) => (
                        <div key={group.id} 
                             className="backdrop-blur-[20px] border rounded-[2rem] p-5 sm:p-6 transition-colors"
                             style={{
                                 backgroundColor: 'var(--ad-card-bg)',
                                 borderColor: 'var(--ad-card-border)',
                                 boxShadow: 'var(--ad-card-shadow)',
                             }}
                        >
                            {/* Top: Name + Badges */}
                            <div className="flex items-center gap-4 mb-4 flex-wrap">
                                {group.profile_pic_url ? (
                                    <img src={safeOptimizedUrl(group.profile_pic_url)} alt="Avatar" className="w-[44px] h-[44px] min-w-[44px] rounded-2xl object-cover shrink-0 shadow-lg border border-white/10" loading="lazy" />
                                ) : (
                                    <StudentAvatarFallback name={group.student_name} size={44} />
                                )}
                                <h3 className="font-bold text-base sm:text-lg truncate flex-1 min-w-0" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                                    {group.student_name || "Unknown Student"}
                                </h3>
                                <span className={`shrink-0 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border
                                    ${group.mode === "online" ? "bg-[#c799ff]/10 text-[#c799ff] border-[#c799ff]/30" : "bg-[#ff9dac]/10 text-[#ff9dac] border-[#ff9dac]/30"}`}>
                                    {group.mode === "online" ? "📱 Online" : "💵 Offline"}
                                </span>
                            </div>

                            {/* Details row */}
                            <div className="flex flex-wrap gap-3 mb-6">
                                {/* Billing Cycle */}
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                                     style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)' }}
                                >
                                    <span className="material-symbols-outlined text-[#c799ff] text-base shrink-0">calendar_today</span>
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ad-text-secondary)', opacity: 0.65 }}>Billing Cycle</span>
                                        <span className="text-xs font-semibold" style={{ color: 'var(--ad-text-primary)' }}>{group.monthsLabel}</span>
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                                     style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)' }}
                                >
                                    <span className="material-symbols-outlined text-[#4af8e3] text-base shrink-0">payments</span>
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ad-text-secondary)', opacity: 0.65 }}>Amount</span>
                                        <span className="text-xs font-semibold" style={{ color: 'var(--ad-text-primary)' }}>₹{group.totalAmount}</span>
                                    </div>
                                </div>

                                {/* Batch */}
                                {group.batch_name && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                                         style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)' }}
                                    >
                                        <span className="material-symbols-outlined text-[#ff9dac] text-base shrink-0">group</span>
                                        <div className="flex flex-col leading-tight">
                                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ad-text-secondary)', opacity: 0.65 }}>Batch</span>
                                            <span className="text-xs font-semibold" style={{ color: 'var(--ad-text-primary)' }}>{group.batch_name}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Teacher Name — offline only */}
                                {group.mode !== "online" && group.teacher_name && group.teacher_name !== "Instructor" && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                                         style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)' }}
                                    >
                                        <span className="material-symbols-outlined text-base shrink-0" style={{ color: isLight ? '#0d9488' : '#c799ff' }}>person</span>
                                        <div className="flex flex-col leading-tight">
                                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ad-text-secondary)', opacity: 0.65 }}>Requested By</span>
                                            <span className="text-xs font-semibold" style={{ color: 'var(--ad-text-primary)' }}>{group.teacher_name}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Screenshot + Actions */}
                            <div className="flex items-center justify-between gap-4">
                                {group.screenshot_url ? (
                                    <button onClick={() => setPreviewImg(group.screenshot_url)}
                                        className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border active:border-[#3b82f6] transition-all cursor-pointer group relative"
                                        style={{ borderColor: 'var(--ad-divider)' }}
                                    >
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                            <span className="material-symbols-outlined text-white">zoom_in</span>
                                        </div>
                                        <img src={group.screenshot_url} alt="Screenshot" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    </button>
                                ) : <div />}

                                <div className="flex gap-2 sm:gap-3">
                                    <button onClick={() => handleApproveGroup(group)} disabled={actionLoading === group.id}
                                        className="flex-1 sm:flex-none px-4 sm:px-6 py-3 rounded-xl border text-xs sm:text-sm shadow-sm transition-all
                                            hover:brightness-110 disabled:opacity-50 cursor-pointer flex items-center gap-2 font-bold uppercase tracking-wider" 
                                        style={{ 
                                            fontFamily: "'Inter', sans-serif",
                                            backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)',
                                            borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)',
                                            color: isLight ? '#0d9488' : '#4af8e3'
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-base">check_circle</span>
                                        <span className="hidden sm:inline">Approve</span>
                                    </button>
                                    <button onClick={() => handleRejectGroup(group)} disabled={actionLoading === group.id}
                                        className="flex-1 sm:flex-none px-4 sm:px-6 py-3 rounded-xl border text-xs sm:text-sm shadow-sm transition-all
                                            hover:brightness-110 disabled:opacity-50 cursor-pointer flex items-center gap-2 font-bold uppercase tracking-wider" 
                                        style={{ 
                                            fontFamily: "'Inter', sans-serif",
                                            backgroundColor: isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 110, 132, 0.1)',
                                            borderColor: isLight ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 110, 132, 0.3)',
                                            color: isLight ? '#ef4444' : '#ff6e84'
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-base">cancel</span>
                                        <span className="hidden sm:inline">Reject</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {previewImg && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setPreviewImg(null)} style={{ touchAction: "none" }}>
                    <div className="relative max-w-2xl w-full max-h-[80vh] flex justify-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setPreviewImg(null)}
                            className="absolute -top-10 sm:-top-4 right-1 sm:-right-4 w-10 h-10 rounded-full border flex items-center justify-center cursor-pointer z-10 transition-colors shadow-xl"
                            style={{
                                backgroundColor: 'var(--ad-surface-high)',
                                borderColor: 'var(--ad-divider)',
                                color: 'var(--ad-text-primary)'
                            }}
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                        <img src={previewImg} alt="Payment Screenshot" className="rounded-3xl max-h-[80vh] w-auto max-w-full object-contain border shadow-2xl shadow-black/80" style={{ borderColor: 'var(--ad-divider)' }} />
                    </div>
                </div>,
                document.body
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

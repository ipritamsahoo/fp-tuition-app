import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, isSystemicError } from "@/lib/api";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";
import { useAdminTheme } from "@/context/AdminThemeContext";

function BatchesContent() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    const cacheKeyBatches = "admin_batches";
    const cacheKeyTeachers = "admin_teachers";
    const cachedBatches = getCache(cacheKeyBatches);
    const cachedTeachers = getCache(cacheKeyTeachers);
    
    const [batches, setBatches] = useState(cachedBatches || []);
    const [teachers, setTeachers] = useState(cachedTeachers || []);
    const [loading, setLoading] = useState(!cachedBatches);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [deleteModalBatch, setDeleteModalBatch] = useState(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [form, setForm] = useState({ batch_name: "", teacher_ids: [], batch_fee: "" });
    const [formLoading, setFormLoading] = useState(false);

    const fetchData = useCallback(async () => {
        if (!getCache("admin_batches")) {
            setLoading(true);
        }
        
        try {
            const [b, t] = await Promise.all([
                api.get("/api/admin/batches"),
                api.get("/api/admin/teachers"),
            ]);
            
            if (JSON.stringify(getCache("admin_batches")) !== JSON.stringify(b)) {
                setBatches(b);
                setCache("admin_batches", b);
            }
            if (JSON.stringify(getCache("admin_teachers")) !== JSON.stringify(t)) {
                setTeachers(t);
                setCache("admin_teachers", t);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, []); // Stable reference to prevent infinite loops

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Disable body scroll when any modal is open
    useEffect(() => {
        const isModalOpen = !!showForm || !!deleteModalBatch;
        if (isModalOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [showForm, deleteModalBatch]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError("");
        try {
            const payload = {
                batch_name: form.batch_name,
                teacher_ids: form.teacher_ids,
                batch_fee: form.batch_fee !== "" ? parseFloat(form.batch_fee) : null,
            };
            if (editId) {
                await api.put(`/api/admin/batches/${editId}`, payload);
                setSuccess("Batch updated!");
            } else {
                await api.post("/api/admin/batches", payload);
                setSuccess("Batch created!");
            }
            setForm({ batch_name: "", teacher_ids: [], batch_fee: "" });
            setShowForm(false);
            setEditId(null);
            fetchData();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleEdit = (batch) => {
        setForm({ batch_name: batch.batch_name, teacher_ids: batch.teacher_ids || [], batch_fee: batch.batch_fee != null ? String(batch.batch_fee) : "" });
        setEditId(batch.id);
        setShowForm(true);
    };

    const openDeleteModal = (batch) => {
        setDeleteModalBatch(batch);
        setDeleteConfirmText("");
    };

    const confirmDelete = async () => {
        if (!deleteModalBatch) return;
        const id = deleteModalBatch.id;
        setDeleteModalBatch(null);
        setDeleting(id);
        try {
            await api.delete(`/api/admin/batches/${id}`);
            setSuccess("Batch deleted.");
            fetchData();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setDeleting(null);
        }
    };


    const toggleTeacher = (tid) => {
        setForm((prev) => ({
            ...prev,
            teacher_ids: prev.teacher_ids.includes(tid)
                ? prev.teacher_ids.filter((id) => id !== tid)
                : [...prev.teacher_ids, tid],
        }));
    };

    if (loading) {
        return (
            <div className="p-6">
                <GenericListSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                {/* Hide title on mobile as it's in the Sub-Page Header */}
                <div className="hidden md:block">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                        Manage Batches
                    </h1>
                </div>
                <button
                    onClick={() => { setShowForm(!showForm); setEditId(null); setError(""); setForm({ batch_name: "", teacher_ids: [], batch_fee: "" }); }}
                    className="mt-4 md:mt-0 px-6 py-3 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    style={{
                        backgroundColor: isLight ? 'rgba(59, 130, 246, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                        borderColor: isLight ? 'rgba(59, 130, 246, 0.3)' : 'rgba(199, 153, 255, 0.3)',
                        color: isLight ? '#2563eb' : '#c799ff'
                    }}
                >
                    <span className="material-symbols-outlined text-[18px]">
                        {showForm ? "close" : "add"}
                    </span>
                    {showForm ? "Cancel" : "Create Batch"}
                </button>
            </div>

            {error && !showForm && !deleteModalBatch && (
                <div className="mb-4 p-4 rounded-xl border shadow-lg text-sm flex items-center gap-3"
                     style={{
                         backgroundColor: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(30, 41, 59, 0.85)',
                         borderColor: 'rgba(255, 110, 132, 0.3)',
                         color: isLight ? '#ef4444' : '#ff9dac'
                     }}
                >
                    <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                    <span className="flex-1 font-medium">{error}</span>
                    <button onClick={() => setError("")} className="ml-2 hover:text-[#ff6e84] transition-colors cursor-pointer">✕</button>
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
                    <button onClick={() => setSuccess("")} className="ml-2 hover:text-[#4af8e3] transition-colors cursor-pointer">✕</button>
                </div>
            )}

            {/* Form Modal */}
            {showForm && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in animate-duration-200" onClick={() => { setShowForm(false); setEditId(null); setError(""); setForm({ batch_name: "", teacher_ids: [], batch_fee: "" }); }}>
                    <form 
                        onSubmit={handleSubmit} 
                        className="relative w-full max-w-lg rounded-[2rem] p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.2)] animate-modal-in m-auto border"
                        style={{
                            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(25, 30, 45, 0.85)',
                            borderColor: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)',
                            backdropFilter: 'blur(80px) saturate(2.5)',
                            WebkitBackdropFilter: 'blur(80px) saturate(2.5)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-xl flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                                <span className="material-symbols-outlined" style={{ color: editId ? (isLight ? '#7c3aed' : '#c799ff') : 'var(--ad-accent)' }}>
                                    {editId ? "edit" : "add_circle"}
                                </span>
                                {editId ? "Edit Batch" : "New Batch"}
                            </h3>
                            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setError(""); setForm({ batch_name: "", teacher_ids: [], batch_fee: "" }); }} 
                                    className="transition-colors cursor-pointer p-2 rounded-full flex items-center justify-center border hover:opacity-85"
                                    style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)', color: 'var(--ad-text-secondary)' }}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        {error && (
                            <div className="mb-6 p-4 rounded-xl border text-sm flex items-center gap-3"
                                 style={{
                                     backgroundColor: 'rgba(255, 110, 132, 0.08)',
                                     borderColor: 'rgba(255, 110, 132, 0.3)',
                                     color: isLight ? '#ef4444' : '#ff9dac'
                                 }}
                            >
                                <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                                <span className="flex-1 font-medium">{error}</span>
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                            <div>
                                <label className="block text-[11px] font-bold tracking-widest uppercase mb-1.5 ml-1" style={{ color: 'var(--ad-text-secondary)' }}>Batch Name</label>
                                <input
                                    placeholder="e.g. Batch A - Class 10"
                                    value={form.batch_name}
                                    onChange={(e) => setForm({ ...form, batch_name: e.target.value })}
                                    required
                                    className="w-full px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-all"
                                    style={{
                                        backgroundColor: 'var(--ad-input-bg)',
                                        borderColor: 'var(--ad-input-border)',
                                        color: 'var(--ad-text-primary)'
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold tracking-widest uppercase mb-1.5 ml-1" style={{ color: 'var(--ad-text-secondary)' }}>Batch Fee (optional)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold" style={{ color: 'var(--ad-text-secondary)' }}>₹</span>
                                    <input
                                        type="number"
                                        placeholder="Amount"
                                        value={form.batch_fee}
                                        onChange={(e) => setForm({ ...form, batch_fee: e.target.value })}
                                        min="0"
                                        step="any"
                                        className="w-full pl-8 pr-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        style={{
                                            backgroundColor: 'var(--ad-input-bg)',
                                            borderColor: 'var(--ad-input-border)',
                                            color: 'var(--ad-text-primary)'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mb-8">
                            <label className="block text-[11px] font-bold tracking-widest uppercase mb-3 ml-1" style={{ color: 'var(--ad-text-secondary)' }}>Assign Teachers</label>
                            <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                {teachers.map((t) => (
                                    <button
                                        key={t.uid || t.id}
                                        type="button"
                                        onClick={() => toggleTeacher(t.uid || t.id)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold tracking-wide border transition-all duration-300 cursor-pointer"
                                        style={{
                                            backgroundColor: form.teacher_ids.includes(t.uid || t.id)
                                                ? (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(199, 153, 255, 0.1)')
                                                : 'var(--ad-icon-bg)',
                                            borderColor: form.teacher_ids.includes(t.uid || t.id)
                                                ? (isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(199, 153, 255, 0.25)')
                                                : 'var(--ad-input-border)',
                                            color: form.teacher_ids.includes(t.uid || t.id)
                                                ? (isLight ? '#0d9488' : '#c799ff')
                                                : 'var(--ad-text-secondary)'
                                        }}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                                {teachers.length === 0 && <span className="text-[#ff9dac] text-xs font-medium italic p-2 bg-[#ff6e84]/5 rounded-xl border border-[#ff6e84]/10 w-full text-center">No teachers available. Add teachers first.</span>}
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t font-semibold" style={{ borderColor: 'var(--ad-divider)' }}>
                            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setError(""); setForm({ batch_name: "", teacher_ids: [], batch_fee: "" }); }} 
                                    className="w-full sm:flex-1 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-widest hover:opacity-85 transition-all cursor-pointer border"
                                    style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)', color: 'var(--ad-text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={formLoading}
                                className="w-full sm:flex-[1.5] py-3.5 rounded-2xl text-xs font-bold uppercase tracking-widest border transition-all disabled:opacity-30 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                                style={{
                                    backgroundColor: editId 
                                        ? (isLight ? 'rgba(124, 58, 237, 0.08)' : 'rgba(199, 153, 255, 0.1)')
                                        : (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)'),
                                    borderColor: editId 
                                        ? (isLight ? 'rgba(124, 58, 237, 0.3)' : 'rgba(199, 153, 255, 0.3)')
                                        : (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)'),
                                    color: editId 
                                        ? (isLight ? '#7c3aed' : '#c799ff')
                                        : (isLight ? '#0d9488' : '#4af8e3')
                                }}
                            >
                                {formLoading ? (
                                    <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: editId ? (isLight ? '#7c3aed' : '#c799ff') : (isLight ? '#0d9488' : '#4af8e3') }} />
                                ) : (
                                    <span className="material-symbols-outlined text-[18px]">{editId ? "save" : "add"}</span>
                                )}
                                {formLoading ? "Saving..." : editId ? "Save Changes" : "Create Batch"}
                            </button>
                        </div>
                    </form>
                </div>,
                document.body
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalBatch && (() => {
                const targetText = `I CONFIRM TO DELETE ${deleteModalBatch.batch_name.toUpperCase()} BATCH`;
                return createPortal(
                    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => { setDeleteModalBatch(null); setError(""); }}>
                        <div 
                            className="relative w-full max-w-[480px] rounded-[2rem] p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.2)] animate-modal-in m-auto border"
                            style={{
                                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(25, 30, 45, 0.85)',
                                borderColor: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)',
                                backdropFilter: 'blur(80px) saturate(2.5)',
                                WebkitBackdropFilter: 'blur(80px) saturate(2.5)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-xl flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: isLight ? '#ef4444' : '#ff4466' }}>
                                    <span className="material-symbols-outlined">warning</span>
                                    Delete Batch
                                </h3>
                                <button onClick={() => { setDeleteModalBatch(null); setError(""); }} 
                                        className="transition-colors cursor-pointer p-2 rounded-full flex items-center justify-center border hover:opacity-85"
                                        style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)', color: 'var(--ad-text-secondary)' }}
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            {error && (
                                <div className="mb-6 p-4 rounded-xl border text-sm flex items-center gap-3"
                                     style={{
                                         backgroundColor: 'rgba(255, 110, 132, 0.08)',
                                         borderColor: 'rgba(255, 110, 132, 0.3)',
                                         color: isLight ? '#ef4444' : '#ff9dac'
                                     }}
                                >
                                    <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                                    <span className="flex-1 font-medium">{error}</span>
                                </div>
                            )}
                            
                            <div className="space-y-4 mb-6" style={{ color: 'var(--ad-text-secondary)' }}>
                                <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--ad-text-primary)' }}>
                                    Are you sure you want to permanently delete the <span className="font-bold text-base" style={{ color: isLight ? '#ef4444' : '#ff4466' }}>{deleteModalBatch.batch_name}</span> batch?
                                </p>
                                
                                <div className="border p-5 rounded-2xl text-[13px] leading-relaxed"
                                     style={{
                                         backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                         borderColor: 'rgba(239, 68, 68, 0.15)',
                                         color: isLight ? '#ef4444' : '#ff9dac'
                                     }}
                                >
                                    <p className="font-bold mb-3 tracking-widest uppercase text-[11px] flex items-center gap-2" style={{ color: isLight ? '#ef4444' : '#ff4466' }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isLight ? '#ef4444' : '#ff4466' }} />
                                        Data to be deleted:
                                    </p>
                                    <ul className="space-y-2 font-medium">
                                        <li className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-[14px] mt-0.5" style={{ color: isLight ? '#ef4444' : '#ff4466' }}>cancel</span>
                                            All students assigned to this batch.
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-[14px] mt-0.5" style={{ color: isLight ? '#ef4444' : '#ff4466' }}>cancel</span>
                                            All payment records & receipts.
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-[14px] mt-0.5" style={{ color: isLight ? '#ef4444' : '#ff4466' }}>cancel</span>
                                            Revenue distribution snapshots.
                                        </li>
                                    </ul>
                                    <p className="mt-5 text-[10px] italic font-bold uppercase tracking-[0.15em] text-center border-t pt-4"
                                       style={{
                                           borderColor: 'rgba(239, 68, 68, 0.15)',
                                           color: isLight ? '#b91c1c' : '#fca5a5'
                                       }}
                                    >
                                        Teacher accounts remain safe.
                                    </p>
                                </div>
  
                                <div className="mt-5">
                                    <label className="block text-[11px] font-bold tracking-widest uppercase mb-2 ml-1" style={{ color: 'var(--ad-text-secondary)' }}>
                                        Type <span className="font-black select-all cursor-pointer px-1 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: isLight ? '#ef4444' : '#ff4466' }}>{targetText}</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                                        className="w-full px-4 py-4 rounded-2xl border text-sm font-medium focus:outline-none transition-all"
                                        style={{
                                            backgroundColor: 'var(--ad-input-bg)',
                                            borderColor: 'var(--ad-input-border)',
                                            color: 'var(--ad-text-primary)'
                                        }}
                                        placeholder={targetText}
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
  
                            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8 font-semibold">
                                <button onClick={() => { setDeleteModalBatch(null); setError(""); }} 
                                        className="w-full sm:flex-1 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:opacity-85 transition-all cursor-pointer border"
                                        style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)', color: 'var(--ad-text-secondary)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={deleteConfirmText !== targetText}
                                    className="w-full sm:flex-[1.5] py-4 rounded-2xl shadow-sm text-[11px] font-black uppercase tracking-widest transition-all hover:opacity-95 disabled:opacity-20 cursor-pointer flex items-center justify-center gap-2 group border"
                                    style={{
                                        backgroundColor: isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 68, 102, 0.1)',
                                        borderColor: isLight ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 68, 102, 0.3)',
                                        color: isLight ? '#ef4444' : '#ff4466'
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">delete_forever</span>
                                    Delete Permanently
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}

            {/* Batch cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {batches.map((batch, idx) => (
                    <div key={batch.id} 
                         className="backdrop-blur-[20px] border rounded-[2rem] p-6 flex flex-col transition-all hover:opacity-95"
                         style={{
                             backgroundColor: 'var(--ad-card-bg)',
                             borderColor: 'var(--ad-card-border)'
                         }}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <h3 className="font-bold text-lg leading-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>{batch.batch_name}</h3>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={() => handleEdit(batch)}
                                    className="w-9 h-9 rounded-xl border transition-all flex items-center justify-center cursor-pointer hover:opacity-85"
                                    style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)', color: 'var(--ad-text-secondary)' }}
                                >
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                    onClick={() => openDeleteModal(batch)}
                                    disabled={deleting === batch.id}
                                    className="w-9 h-9 rounded-xl border transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer hover:opacity-85"
                                    style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)', color: 'var(--ad-text-secondary)' }}
                                >
                                    {deleting === batch.id ? (
                                        <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ad-text-secondary)' }} />
                                    ) : (
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4 text-sm mt-auto">
                            <div className="flex items-center gap-3">
                                <p className="flex items-center gap-2" style={{ color: 'var(--ad-text-secondary)' }}>
                                    <span className="material-symbols-outlined text-lg" style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>school</span>
                                    <span className="font-bold" style={{ color: 'var(--ad-text-primary)' }}>{batch.student_count || 0}</span> students
                                </p>
                                {batch.batch_fee != null && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase border"
                                          style={{
                                              backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)',
                                              borderColor: isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(74, 248, 227, 0.25)',
                                              color: isLight ? '#0d9488' : '#4af8e3'
                                          }}
                                    >
                                        ₹{batch.batch_fee}/mo
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(batch.teacher_names || []).map((name, i) => (
                                    <span key={i} className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest whitespace-nowrap border"
                                          style={{
                                              backgroundColor: isLight ? 'rgba(124, 58, 237, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                                              borderColor: isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(199, 153, 255, 0.25)',
                                              color: isLight ? '#7c3aed' : '#c799ff'
                                          }}
                                    >
                                        {name}
                                    </span>
                                ))}
                                {(!batch.teacher_names || batch.teacher_names.length === 0) && (
                                    <span className="text-xs font-medium italic" style={{ color: 'var(--ad-text-secondary)' }}>No teachers assigned</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {batches.length === 0 && (
                    <div className="col-span-full backdrop-blur-[20px] rounded-[2rem] p-10 text-center border flex flex-col items-center justify-center gap-4"
                         style={{
                             backgroundColor: 'var(--ad-card-bg)',
                             borderColor: 'var(--ad-card-border)'
                         }}
                    >
                        <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--ad-text-secondary)' }}>inbox</span>
                        <p className="font-medium text-lg" style={{ color: 'var(--ad-text-secondary)' }}>No batches created yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ManageBatches() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <BatchesContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

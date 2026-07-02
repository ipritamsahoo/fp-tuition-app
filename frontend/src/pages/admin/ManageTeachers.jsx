import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import UserDevicesModal from "@/components/UserDevicesModal";
import { api, isSystemicError } from "@/lib/api";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";
import { useAdminTheme } from "@/context/AdminThemeContext";

function TeachersContent() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    const cacheKeyTeachers = "admin_teachers";
    const cacheKeyBatches = "admin_batches";
    const cachedTeachers = getCache(cacheKeyTeachers);
    const cachedBatches = getCache(cacheKeyBatches);

    const [teachers, setTeachers] = useState(cachedTeachers || []);
    const [batches, setBatches] = useState(cachedBatches || []);
    const [loading, setLoading] = useState(!cachedTeachers);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [form, setForm] = useState({ name: "", username: "", password: "", batch_ids: [] });
    const [formLoading, setFormLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Edit state
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [editForm, setEditForm] = useState({ name: "", username: "", batch_ids: [], password: "" });
    const [editLoading, setEditLoading] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);

    // Devices modal state
    const [devicesTeacher, setDevicesTeacher] = useState(null);

    // Delete confirmation state
    const [deleteModalTeacher, setDeleteModalTeacher] = useState(null);

    // Disable body scroll when any modal is open
    useEffect(() => {
        const isModalOpen = !!editingTeacher || !!deleteModalTeacher || !!devicesTeacher;
        if (isModalOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [editingTeacher, deleteModalTeacher, devicesTeacher]);

    const confirmDelete = async () => {
        if (!deleteModalTeacher) return;
        const uid = deleteModalTeacher.uid || deleteModalTeacher.id;
        setDeleteModalTeacher(null);
        setDeleting(uid);
        try {
            await api.delete(`/api/admin/teachers/${uid}`);
            setSuccess("Teacher removed successfully.");
            fetchData();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setDeleting(null);
        }
    };

    const fetchData = useCallback(async () => {
        if (!getCache("admin_teachers")) {
            setLoading(true);
        }
        
        try {
            const [t, b] = await Promise.all([
                api.get("/api/admin/teachers"),
                api.get("/api/admin/batches"),
            ]);
            
            if (JSON.stringify(getCache("admin_teachers")) !== JSON.stringify(t)) {
                setTeachers(t);
                setCache("admin_teachers", t);
            }
            if (JSON.stringify(getCache("admin_batches")) !== JSON.stringify(b)) {
                setBatches(b);
                setCache("admin_batches", b);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, []); // Empty dependencies to ensure stable function reference

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError("");
        try {
            await api.post("/api/admin/teachers", form);
            setSuccess("Teacher added successfully!");
            setForm({ name: "", username: "", password: "", batch_ids: [] });
            setShowPassword(false);
            setShowForm(false);
            fetchData();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setFormLoading(false);
        }
    };





    const toggleBatch = (batchId) => {
        setForm((prev) => ({
            ...prev,
            batch_ids: prev.batch_ids.includes(batchId)
                ? prev.batch_ids.filter((id) => id !== batchId)
                : [...prev.batch_ids, batchId],
        }));
    };

    const toggleEditBatch = (batchId) => {
        setEditForm((prev) => ({
            ...prev,
            batch_ids: prev.batch_ids.includes(batchId)
                ? prev.batch_ids.filter((id) => id !== batchId)
                : [...prev.batch_ids, batchId],
        }));
    };

    const startEdit = (teacher) => {
        setEditingTeacher(teacher.uid || teacher.id);
        setEditForm({
            name: teacher.name || "",
            username: teacher.username || "",
            batch_ids: (teacher.assigned_batches || []).map((b) => b.id),
            password: "",
        });
        setShowForm(false);
    };

    const cancelEdit = () => {
        setEditingTeacher(null);
        setError("");
        setEditForm({ name: "", username: "", batch_ids: [], password: "" });
        setShowEditPassword(false);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setEditLoading(true);
        setError("");
        try {
            const payload = {};
            if (editForm.name) payload.name = editForm.name;
            if (editForm.username) payload.username = editForm.username;
            payload.batch_ids = editForm.batch_ids;
            if (editForm.password && editForm.password.trim()) payload.password = editForm.password;

            await api.put(`/api/admin/teachers/${editingTeacher}`, payload);
            setSuccess("Teacher updated successfully!");
            cancelEdit();
            fetchData();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setEditLoading(false);
        }
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
            <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                    {/* Hide title on mobile as it's in the Sub-Page Header */}
                    <div className="hidden md:block">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                            Manage Teachers
                        </h1>
                    </div>
                    <button
                        onClick={() => { setShowForm(!showForm); cancelEdit(); setError(""); }}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        style={{
                            backgroundColor: isLight ? 'rgba(59, 130, 246, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                            borderColor: isLight ? 'rgba(59, 130, 246, 0.3)' : 'rgba(199, 153, 255, 0.3)',
                            color: isLight ? '#2563eb' : '#c799ff'
                        }}
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            {showForm ? "close" : "add"}
                        </span>
                        {showForm ? "Cancel" : "Add Teacher"}
                    </button>
                </div>

                {error && !showForm && !editingTeacher && !devicesTeacher && (
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

                {/* Add Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} 
                          className="backdrop-blur-[20px] border rounded-[2rem] p-6 sm:p-8 mb-6 shadow-lg"
                          style={{
                              backgroundColor: 'var(--ad-card-bg)',
                              borderColor: 'var(--ad-card-border)'
                          }}
                    >
                        <h3 className="font-bold mb-6 text-lg flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                            <span className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold shadow-sm border"
                                  style={{
                                      backgroundColor: 'var(--ad-accent-bg)',
                                      borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                                      color: 'var(--ad-accent)'
                                  }}
                            >
                                <span className="material-symbols-outlined text-[16px]">person_add</span>
                            </span>
                            New Teacher
                        </h3>
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
                        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-5 mb-6">
                            <input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                                className="w-full px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
                            />
                            <input placeholder="Username or Mobile" type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required
                                className="w-full px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
                            />
                            <div className="relative">
                                <input placeholder="Password" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6}
                                    className="w-full pl-4 pr-12 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                                    style={{
                                        backgroundColor: 'var(--ad-input-bg)',
                                        borderColor: 'var(--ad-input-border)',
                                        color: 'var(--ad-text-primary)'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center p-1 rounded-full hover:bg-black/5 cursor-pointer"
                                    tabIndex="-1"
                                    style={{ color: 'var(--ad-text-secondary)' }}
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {showPassword ? "visibility_off" : "visibility"}
                                    </span>
                                </button>
                            </div>
                        </div>
                        <div className="mb-8">
                            <label className="block text-[13px] font-bold tracking-wide uppercase mb-3" style={{ color: 'var(--ad-text-secondary)' }}>Assign to Batches</label>
                            <div className="flex flex-wrap gap-2">
                                {batches.map((b) => (
                                    <button key={b.id} type="button" onClick={() => toggleBatch(b.id)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold tracking-wide border transition-all duration-300 cursor-pointer"
                                        style={{
                                            backgroundColor: form.batch_ids.includes(b.id)
                                                ? (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(199, 153, 255, 0.1)')
                                                : 'var(--ad-icon-bg)',
                                            borderColor: form.batch_ids.includes(b.id)
                                                ? (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(199, 153, 255, 0.3)')
                                                : 'var(--ad-input-border)',
                                            color: form.batch_ids.includes(b.id)
                                                ? (isLight ? '#0d9488' : '#c799ff')
                                                : 'var(--ad-text-secondary)'
                                        }}
                                    >
                                        {b.batch_name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button type="submit" disabled={formLoading}
                            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl border text-sm font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-3"
                            style={{
                                backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                                borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(199, 153, 255, 0.3)',
                                color: isLight ? '#0d9488' : '#c799ff'
                            }}
                        >
                            {formLoading ? (
                                <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: isLight ? '#0d9488' : '#c799ff' }} />
                            ) : (
                                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            )}
                            {formLoading ? "Adding Teacher..." : "Add Teacher"}
                        </button>
                    </form>
                )}

                {/* Edit Form Modal */}
                {editingTeacher && createPortal(
                    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
                        <form onSubmit={handleEditSubmit} 
                              className="relative w-full max-w-lg rounded-[2rem] p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.2)] animate-fade-in-up m-auto border"
                              style={{
                                  backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(25, 30, 45, 0.85)',
                                  borderColor: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)',
                                  backdropFilter: 'blur(80px) saturate(2.5)',
                                  WebkitBackdropFilter: 'blur(80px) saturate(2.5)'
                              }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-xl flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--ad-primary)' }}>edit</span>
                                    Edit Teacher
                                </h3>
                                <button type="button" onClick={cancelEdit} 
                                        className="transition-colors cursor-pointer p-2 rounded-full flex items-center justify-center border hover:opacity-80"
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
                            <div className="space-y-5 mb-8">
                                <div>
                                    <label className="block text-[13px] font-bold tracking-wide uppercase mb-2" style={{ color: 'var(--ad-text-secondary)' }}>Full Name</label>
                                    <input placeholder="Full Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-colors" 
                                        style={{
                                            backgroundColor: 'var(--ad-input-bg)',
                                            borderColor: 'var(--ad-input-border)',
                                            color: 'var(--ad-text-primary)'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold tracking-wide uppercase mb-2" style={{ color: 'var(--ad-text-secondary)' }}>Username or Mobile</label>
                                    <input placeholder="Username or Mobile" type="text" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-colors"
                                        style={{
                                            backgroundColor: 'var(--ad-input-bg)',
                                            borderColor: 'var(--ad-input-border)',
                                            color: 'var(--ad-text-primary)'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold tracking-wide uppercase mb-2" style={{ color: 'var(--ad-text-secondary)' }}>New Password (Optional)</label>
                                    <div className="relative">
                                        <input placeholder="Leave blank to keep current password" type={showEditPassword ? "text" : "password"} value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} minLength={editForm.password ? 6 : undefined}
                                            className="w-full pl-4 pr-12 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-colors"
                                            style={{
                                                backgroundColor: 'var(--ad-input-bg)',
                                                borderColor: 'var(--ad-input-border)',
                                                color: 'var(--ad-text-primary)'
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowEditPassword(!showEditPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center p-1 rounded-full hover:bg-black/5 cursor-pointer"
                                            tabIndex="-1"
                                            style={{ color: 'var(--ad-text-secondary)' }}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">
                                                {showEditPassword ? "visibility_off" : "visibility"}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold tracking-wide uppercase mb-3" style={{ color: 'var(--ad-text-secondary)' }}>Assigned Batches</label>
                                    <div className="flex flex-wrap gap-2">
                                        {batches.map((b) => (
                                            <button key={b.id} type="button" onClick={() => toggleEditBatch(b.id)}
                                                className="px-4 py-2 rounded-xl text-xs font-bold tracking-wide border transition-all duration-300 cursor-pointer"
                                                style={{
                                                    backgroundColor: editForm.batch_ids.includes(b.id)
                                                        ? (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(199, 153, 255, 0.1)')
                                                        : 'var(--ad-icon-bg)',
                                                    borderColor: editForm.batch_ids.includes(b.id)
                                                        ? (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(199, 153, 255, 0.3)')
                                                        : 'var(--ad-input-border)',
                                                    color: editForm.batch_ids.includes(b.id)
                                                        ? (isLight ? '#0d9488' : '#c799ff')
                                                        : 'var(--ad-text-secondary)'
                                                }}
                                            >
                                                {b.batch_name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-4 pt-6 border-t font-semibold" style={{ borderColor: 'var(--ad-divider)' }}>
                                <button type="button" onClick={cancelEdit} className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:opacity-85 transition-all cursor-pointer" style={{ color: 'var(--ad-text-secondary)' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={editLoading}
                                    className="px-6 py-3 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                    style={{
                                        backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                                        borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(199, 153, 255, 0.3)',
                                        color: isLight ? '#0d9488' : '#c799ff'
                                    }}
                                >
                                    {editLoading ? (
                                        <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: isLight ? '#0d9488' : '#c799ff' }} />
                                    ) : (
                                        <span className="material-symbols-outlined text-[18px]">save</span>
                                    )}
                                    {editLoading ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>,
                    document.body
                )}

                {/* Delete Confirmation Modal */}
                {deleteModalTeacher && createPortal(
                    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
                        <div className="relative w-full max-w-lg rounded-[2rem] p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.2)] animate-fade-in-up m-auto border"
                             style={{
                                 backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(25, 30, 45, 0.85)',
                                 borderColor: isLight ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 110, 132, 0.3)',
                                 backdropFilter: 'blur(80px) saturate(2.5)',
                                 WebkitBackdropFilter: 'blur(80px) saturate(2.5)'
                             }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-xl flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: isLight ? '#ef4444' : '#ff6e84' }}>
                                    <span className="material-symbols-outlined">delete</span>
                                    Remove Teacher
                                </h3>
                                <button onClick={() => setDeleteModalTeacher(null)} 
                                        className="transition-colors cursor-pointer p-2 rounded-full flex items-center justify-center border hover:opacity-80"
                                        style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-divider)', color: 'var(--ad-text-secondary)' }}
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="space-y-4 mb-6" style={{ color: 'var(--ad-text-secondary)' }}>
                                <p className="text-base font-medium" style={{ color: 'var(--ad-text-primary)' }}>Are you sure you want to remove <span className="font-bold" style={{ color: 'var(--ad-text-primary)' }}>{deleteModalTeacher.name}</span>?</p>
                                <div className="border p-4 rounded-xl text-sm leading-relaxed"
                                     style={{
                                         backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                         borderColor: 'rgba(239, 68, 68, 0.15)',
                                         color: isLight ? '#ef4444' : '#ff9dac'
                                     }}
                                >
                                    <p className="font-bold mb-1">If you remove this teacher:</p>
                                    <ul className="list-disc list-inside space-y-1 ml-1 font-medium">
                                        <li>They will be logged out of all devices immediately.</li>
                                        <li>They will no longer have access to the teacher portal.</li>
                                        <li>Their assigned batches will lose this instructor.</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="flex justify-end gap-4 pt-6 border-t font-semibold" style={{ borderColor: 'var(--ad-divider)' }}>
                                <button onClick={() => setDeleteModalTeacher(null)} className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:opacity-85 transition-all cursor-pointer" style={{ color: 'var(--ad-text-secondary)' }}>
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-6 py-3 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
                                    style={{
                                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                        borderColor: 'rgba(239, 68, 68, 0.25)',
                                        color: isLight ? '#ef4444' : '#ff6e84'
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Mobile: Card layout */}
                <div className="space-y-4 md:hidden">
                    {teachers.map((t, idx) => (
                        <div key={t.uid || t.id} 
                             className="backdrop-blur-[20px] border rounded-2xl p-5"
                             style={{
                                 backgroundColor: 'var(--ad-card-bg)',
                                 borderColor: 'var(--ad-card-border)'
                             }}
                        >
                            <div className="flex flex-col gap-4">
                                <div>
                                    <p className="font-bold text-lg truncate tracking-wide" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>{t.name}</p>
                                </div>
                                <div className="flex flex-wrap gap-2 -mt-1">
                                        {(t.assigned_batches || []).map((b) => (
                                            <span key={b.id} className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest whitespace-nowrap border"
                                                  style={{
                                                      backgroundColor: isLight ? 'rgba(124, 58, 237, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                                                      borderColor: isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(199, 153, 255, 0.25)',
                                                      color: isLight ? '#7c3aed' : '#c799ff'
                                                  }}
                                            >
                                                {b.batch_name}
                                            </span>
                                        ))}
                                        {(!t.assigned_batches || t.assigned_batches.length === 0) && (
                                            <span className="text-xs font-medium italic" style={{ color: 'var(--ad-text-secondary)' }}>No batches</span>
                                        )}
                                    </div>
                                <div className="flex gap-2 justify-end w-full border-t pt-4" style={{ borderColor: 'var(--ad-divider)' }}>
                                    <button onClick={() => setDevicesTeacher(t)}
                                        className="p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex-1 flex justify-center hover:opacity-80"
                                        style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">devices</span>
                                    </button>
                                    <button onClick={() => startEdit(t)}
                                        className="p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex-1 flex justify-center hover:opacity-80"
                                        style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                    </button>
                                    <button onClick={() => setDeleteModalTeacher(t)} disabled={deleting === (t.uid || t.id)}
                                        className="p-2.5 rounded-xl border text-xs transition-all disabled:opacity-50 cursor-pointer flex-1 flex justify-center hover:opacity-80"
                                        style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                    >
                                        {deleting === (t.uid || t.id) ? (
                                            <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ad-text-secondary)' }} />
                                        ) : (
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {teachers.length === 0 && (
                        <div className="backdrop-blur-[20px] rounded-[2rem] p-10 text-center border flex flex-col items-center justify-center gap-4"
                             style={{
                                 backgroundColor: 'var(--ad-card-bg)',
                                 borderColor: 'var(--ad-card-border)'
                             }}
                        >
                            <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--ad-text-secondary)' }}>group</span>
                            <p className="font-medium text-lg" style={{ color: 'var(--ad-text-secondary)' }}>No teachers found.</p>
                        </div>
                    )}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block backdrop-blur-[20px] border rounded-[2rem] overflow-hidden shadow-lg"
                     style={{
                         backgroundColor: 'var(--ad-card-bg)',
                         borderColor: 'var(--ad-card-border)'
                     }}
                >
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full">
                            <thead style={{ backgroundColor: 'var(--ad-surface)', borderBottom: '1px solid var(--ad-divider)' }}>
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--ad-text-secondary)' }}>Teacher Details</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--ad-text-secondary)' }}>Batches</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--ad-text-secondary)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--ad-divider)]">
                                {teachers.map((t) => (
                                    <tr key={t.uid || t.id} className="hover:bg-white/[0.01] transition-colors group">
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div>
                                                <p className="font-bold tracking-wide" style={{ color: 'var(--ad-text-primary)' }}>{t.name}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-wrap gap-2">
                                                {(t.assigned_batches || []).map((b) => (
                                                    <span key={b.id} className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest whitespace-nowrap border"
                                                          style={{
                                                              backgroundColor: isLight ? 'rgba(124, 58, 237, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                                                              borderColor: isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(199, 153, 255, 0.25)',
                                                              color: isLight ? '#7c3aed' : '#c799ff'
                                                          }}
                                                    >
                                                        {b.batch_name}
                                                    </span>
                                                ))}
                                                {(!t.assigned_batches || t.assigned_batches.length === 0) && (
                                                    <span className="text-xs font-medium italic" style={{ color: 'var(--ad-text-secondary)' }}>No batches assigned</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex justify-end gap-2 outline-none">
                                                <button onClick={() => setDevicesTeacher(t)}
                                                    className="px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2 hover:opacity-85"
                                                    style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">devices</span>
                                                    <span className="text-xs font-bold tracking-wide uppercase">Devices</span>
                                                </button>
                                                <button onClick={() => startEdit(t)}
                                                    className="px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2 hover:opacity-85"
                                                    style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                    <span className="text-xs font-bold tracking-wide uppercase">Edit</span>
                                                </button>
                                                <button onClick={() => setDeleteModalTeacher(t)} disabled={deleting === (t.uid || t.id)}
                                                    className="px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2 hover:opacity-85"
                                                    style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                                >
                                                    {deleting === (t.uid || t.id) ? (
                                                        <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ad-text-secondary)' }} />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    )}
                                                    <span className="text-xs font-bold tracking-wide uppercase">Remove</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {teachers.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8">
                                            <div className="flex flex-col items-center justify-center gap-3" style={{ color: 'var(--ad-text-secondary)' }}>
                                                <span className="material-symbols-outlined text-3xl">group</span>
                                                <p className="font-medium">No teachers found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Devices Modal */}
            {
                devicesTeacher && (
                    <UserDevicesModal
                        user={devicesTeacher}
                        onClose={() => setDevicesTeacher(null)}
                        onSessionDeleted={fetchData}
                    />
                )
            }
        </div>
    );
}

export default function ManageTeachers() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <TeachersContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

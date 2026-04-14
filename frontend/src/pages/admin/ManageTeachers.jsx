import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import UserDevicesModal from "@/components/UserDevicesModal";
import { api, isSystemicError } from "@/lib/api";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";

function TeachersContent() {
    const cacheKeyTeachers = "admin_teachers";
    const cacheKeyBatches = "admin_teacher_batches";
    const cachedTeachers = getCache(cacheKeyTeachers);
    const cachedBatches = getCache(cacheKeyBatches);

    const [teachers, setTeachers] = useState(cachedTeachers || []);
    const [batches, setBatches] = useState(cachedBatches || []);
    const [loading, setLoading] = useState(!cachedTeachers || !cachedBatches);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [form, setForm] = useState({ name: "", username: "", password: "", batch_ids: [] });
    const [formLoading, setFormLoading] = useState(false);

    // Edit state
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [editForm, setEditForm] = useState({ name: "", username: "", batch_ids: [], password: "" });
    const [editLoading, setEditLoading] = useState(false);

    // Devices modal state
    const [devicesTeacher, setDevicesTeacher] = useState(null);

    const fetchData = useCallback(async () => {
        if (!getCache("admin_teachers") || !getCache("admin_teacher_batches")) {
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
            if (JSON.stringify(getCache("admin_teacher_batches")) !== JSON.stringify(b)) {
                setBatches(b);
                setCache("admin_teacher_batches", b);
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

    const handleDelete = async (uid) => {
        if (!confirm("Are you sure you want to remove this teacher?")) return;
        setDeleting(uid);
        try {
            await api.delete(`/api/admin/teachers/${uid}`);
            setSuccess("Teacher removed.");
            fetchData();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setDeleting(null);
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
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#f0f0fd] tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            Manage Teachers
                        </h1>
                    </div>
                    <button
                        onClick={() => { setShowForm(!showForm); cancelEdit(); setError(""); }}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 text-sm font-bold uppercase tracking-widest
                        hover:bg-[#c799ff]/20 hover:border-[#c799ff]/50 transition-all duration-300 shadow-[0_4px_15px_rgba(199,153,255,0.15)] cursor-pointer flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            {showForm ? "close" : "add"}
                        </span>
                        {showForm ? "Cancel" : "Add Teacher"}
                    </button>
                </div>

                {error && !showForm && !editingTeacher && !devicesTeacher && (
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

                {/* Add Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 sm:p-8 mb-6 transition-colors hover:bg-[#171924]/80">
                        <h3 className="text-[#f0f0fd] font-bold mb-6 text-lg flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            <span className="w-8 h-8 rounded-xl bg-[#c799ff]/10 border border-[#c799ff]/30 flex items-center justify-center text-sm font-extrabold text-[#c799ff] shadow-[0_0_10px_rgba(199,153,255,0.2)]">
                                <span className="material-symbols-outlined text-[16px]">person_add</span>
                            </span>
                            New Teacher
                        </h3>
                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/30 text-[#ff9dac] text-sm flex items-center gap-3">
                                <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                                <span className="flex-1 font-medium">{error}</span>
                            </div>
                        )}
                        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-5 mb-6">
                            <input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                                className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors placeholder:text-[#aaaab7]/70" />
                            <input placeholder="Username or Mobile" type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required
                                className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors placeholder:text-[#aaaab7]/70" />
                            <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6}
                                className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors placeholder:text-[#aaaab7]/70" />
                        </div>
                        <div className="mb-8">
                            <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-3">Assign to Batches</label>
                            <div className="flex flex-wrap gap-2">
                                {batches.map((b) => (
                                    <button key={b.id} type="button" onClick={() => toggleBatch(b.id)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide border transition-all duration-300 cursor-pointer
                                        ${form.batch_ids.includes(b.id)
                                                ? "bg-[#c799ff]/10 border-[#c799ff]/30 text-[#c799ff] shadow-[0_0_10px_rgba(199,153,255,0.2)]"
                                                : "bg-[#222532]/50 border-[#464752]/50 text-[#aaaab7] hover:border-[#464752]"}`}>
                                        {b.batch_name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button type="submit" disabled={formLoading}
                            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 text-sm font-bold uppercase tracking-widest
                            hover:bg-[#c799ff]/20 hover:border-[#c799ff]/50 transition-all duration-300 shadow-[0_4px_15px_rgba(199,153,255,0.15)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-3">
                            {formLoading ? (
                                <span className="w-5 h-5 rounded-full border-2 border-[#c799ff]/30 border-t-[#c799ff] animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            )}
                            {formLoading ? "Adding Teacher..." : "Add Teacher"}
                        </button>
                    </form>
                )}

                {/* Edit Form Modal */}
                {editingTeacher && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
                        <form onSubmit={handleEditSubmit} className="bg-[#13151f]/90 backdrop-blur-[20px] rounded-[2rem] p-6 sm:p-8 w-full max-w-lg border border-[#737580]/20 shadow-2xl relative m-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-[#f0f0fd] font-bold text-xl flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    <span className="material-symbols-outlined text-[#c799ff]">edit</span>
                                    Edit Teacher
                                </h3>
                                <button type="button" onClick={cancelEdit} className="text-[#aaaab7] hover:text-[#ff6e84] transition-colors cursor-pointer p-2 rounded-full hover:bg-white/5 flex items-center justify-center">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            {error && (
                                <div className="mb-6 p-4 rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/30 text-[#ff9dac] text-sm flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                                    <span className="flex-1 font-medium">{error}</span>
                                </div>
                            )}
                            <div className="space-y-5 mb-8">
                                <div>
                                    <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-2">Full Name</label>
                                    <input placeholder="Full Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-2">Username or Mobile</label>
                                    <input placeholder="Username or Mobile" type="text" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-2">New Password (Optional)</label>
                                    <input placeholder="Leave blank to keep current password" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} minLength={editForm.password ? 6 : undefined}
                                        className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-3">Assigned Batches</label>
                                    <div className="flex flex-wrap gap-2">
                                        {batches.map((b) => (
                                            <button key={b.id} type="button" onClick={() => toggleEditBatch(b.id)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide border transition-all duration-300 cursor-pointer
                                                ${editForm.batch_ids.includes(b.id)
                                                        ? "bg-[#c799ff]/10 border-[#c799ff]/30 text-[#c799ff] shadow-[0_0_10px_rgba(199,153,255,0.2)]"
                                                        : "bg-[#222532]/50 border-[#464752]/50 text-[#aaaab7] hover:border-[#464752]"}`}>
                                                {b.batch_name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-4 pt-6 border-t border-[#464752]/30">
                                <button type="button" onClick={cancelEdit} className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 transition-all cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={editLoading}
                                    className="px-6 py-3 rounded-xl bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 text-sm font-bold uppercase tracking-widest
                                    hover:bg-[#c799ff]/20 hover:border-[#c799ff]/50 transition-all duration-300 shadow-[0_4px_15px_rgba(199,153,255,0.15)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                                    {editLoading ? (
                                        <span className="w-5 h-5 rounded-full border-2 border-[#c799ff]/30 border-t-[#c799ff] animate-spin" />
                                    ) : (
                                        <span className="material-symbols-outlined text-[18px]">save</span>
                                    )}
                                    {editLoading ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Mobile: Card layout */}
                <div className="space-y-4 md:hidden">
                    {teachers.map((t, idx) => (
                        <div key={t.uid || t.id} className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-2xl p-5">
                            <div className="flex flex-col gap-4">
                                <div>
                                    <p className="text-[#f0f0fd] font-bold text-lg truncate tracking-wide" style={{ fontFamily: "'Manrope', sans-serif" }}>{t.name}</p>
                                </div>
                                <div className="flex flex-wrap gap-2 -mt-1">
                                        {(t.assigned_batches || []).map((b) => (
                                            <span key={b.id} className="px-3 py-1 rounded-full bg-[#c799ff]/10 text-[#c799ff] text-[11px] border border-[#c799ff]/30 font-bold uppercase tracking-widest whitespace-nowrap">
                                                {b.batch_name}
                                            </span>
                                        ))}
                                        {(!t.assigned_batches || t.assigned_batches.length === 0) && (
                                            <span className="text-[#ff9dac] text-xs font-medium italic">No batches</span>
                                        )}
                                    </div>
                                <div className="flex gap-2 justify-end w-full border-t border-[#464752]/30 pt-4">
                                    <button onClick={() => setDevicesTeacher(t)}
                                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#aaaab7] hover:bg-[#4af8e3]/10 hover:border-[#4af8e3]/30 hover:text-[#4af8e3] transition-all cursor-pointer flex-1 flex justify-center">
                                        <span className="material-symbols-outlined text-[20px]">devices</span>
                                    </button>
                                    <button onClick={() => startEdit(t)}
                                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#aaaab7] hover:bg-[#c799ff]/10 hover:border-[#c799ff]/30 hover:text-[#c799ff] transition-all cursor-pointer flex-1 flex justify-center">
                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                    </button>
                                    <button onClick={() => handleDelete(t.uid || t.id)} disabled={deleting === (t.uid || t.id)}
                                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#aaaab7] hover:bg-[#ff6e84]/10 hover:border-[#ff6e84]/30 hover:text-[#ff6e84] transition-all disabled:opacity-50 cursor-pointer flex-1 flex justify-center">
                                        {deleting === (t.uid || t.id) ? (
                                            <span className="w-5 h-5 rounded-full border-2 border-[#ff6e84]/30 border-t-[#ff6e84] animate-spin" />
                                        ) : (
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {teachers.length === 0 && (
                        <div className="bg-[#171924]/60 backdrop-blur-[20px] rounded-[2rem] p-10 text-center text-[#aaaab7] border border-[#737580]/10 flex flex-col items-center justify-center gap-4">
                            <span className="material-symbols-outlined text-4xl text-[#464752]">group</span>
                            <p className="font-medium text-lg">No teachers found.</p>
                        </div>
                    )}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] overflow-hidden shadow-lg">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full">
                            <thead className="bg-[#222532]/50 border-b border-[#464752]/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#aaaab7] uppercase tracking-widest whitespace-nowrap">Teacher Details</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#aaaab7] uppercase tracking-widest whitespace-nowrap">Batches</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-[#aaaab7] uppercase tracking-widest whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#464752]/30">
                                {teachers.map((t) => (
                                    <tr key={t.uid || t.id} className="hover:bg-[#222532]/30 transition-colors group">
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div>
                                                <p className="text-[#f0f0fd] font-bold tracking-wide">{t.name}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-wrap gap-2">
                                                {(t.assigned_batches || []).map((b) => (
                                                    <span key={b.id} className="px-3 py-1 rounded-full bg-[#c799ff]/10 text-[#c799ff] text-[11px] border border-[#c799ff]/30 font-bold uppercase tracking-widest whitespace-nowrap">
                                                        {b.batch_name}
                                                    </span>
                                                ))}
                                                {(!t.assigned_batches || t.assigned_batches.length === 0) && (
                                                    <span className="text-[#ff9dac] text-xs font-medium italic">No batches assigned</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex justify-end gap-2 outline-none">
                                                <button onClick={() => setDevicesTeacher(t)}
                                                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#aaaab7] hover:text-[#4af8e3] hover:bg-[#4af8e3]/10 hover:border-[#4af8e3]/30 transition-all cursor-pointer flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[16px]">devices</span>
                                                    <span className="text-xs font-bold tracking-wide uppercase">Devices</span>
                                                </button>
                                                <button onClick={() => startEdit(t)}
                                                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#aaaab7] hover:text-[#c799ff] hover:bg-[#c799ff]/10 hover:border-[#c799ff]/30 transition-all cursor-pointer flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                    <span className="text-xs font-bold tracking-wide uppercase">Edit</span>
                                                </button>
                                                <button onClick={() => handleDelete(t.uid || t.id)} disabled={deleting === (t.uid || t.id)}
                                                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#aaaab7] hover:text-[#ff6e84] hover:bg-[#ff6e84]/10 hover:border-[#ff6e84]/30 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2">
                                                    {deleting === (t.uid || t.id) ? (
                                                        <span className="w-4 h-4 rounded-full border-2 border-[#ff6e84]/30 border-t-[#ff6e84] animate-spin" />
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
                                            <div className="flex flex-col items-center justify-center gap-3 text-[#aaaab7]">
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

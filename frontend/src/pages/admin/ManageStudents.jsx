import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import UserDevicesModal from "@/components/UserDevicesModal";
import { api, isSystemicError } from "@/lib/api";
import { getYearOptions } from "@/lib/yearOptions";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function StudentsContent() {
    const cacheKeyBatches = "admin_batches";
    const cachedBatches = getCache(cacheKeyBatches);

    // ── Tab: "list" | "add" ──────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState("list");

    // ── Batches (needed for dropdowns in both tabs) ──────────────────────
    const [batches, setBatches] = useState(cachedBatches || []);
    const [batchesLoading, setBatchesLoading] = useState(!cachedBatches);

    // ── Global messages ──────────────────────────────────────────────────
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // ── Add-student form ─────────────────────────────────────────────────
    const [form, setForm] = useState({ name: "", username: "", password: "", batch_id: "" });
    const [formLoading, setFormLoading] = useState(false);

    // ── List tab state ───────────────────────────────────────────────────
    const [selectedListBatch, setSelectedListBatch] = useState("");
    const [students, setStudents] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    // ── Edit modal ───────────────────────────────────────────────────────
    const [editingStudent, setEditingStudent] = useState(null);
    const [editForm, setEditForm] = useState({ name: "", username: "", batch_id: "", password: "" });
    const [editLoading, setEditLoading] = useState(false);

    // ── Fee-override modal ───────────────────────────────────────────────
    const [overrideStudent, setOverrideStudent] = useState(null);
    const [overrideType, setOverrideType] = useState("permanent");
    const [overrideAmount, setOverrideAmount] = useState("");
    const [overrideMonth, setOverrideMonth] = useState(new Date().getMonth() + 1);
    const [overrideYear, setOverrideYear] = useState(new Date().getFullYear());
    const [overrideLoading, setOverrideLoading] = useState(false);

    // ── Status-toggle modal ──────────────────────────────────────────────
    const [togglingStatus, setTogglingStatus] = useState(null);
    const [statusModalStudent, setStatusModalStudent] = useState(null);
    const [statusConfirmText, setStatusConfirmText] = useState("");

    // ── Devices modal ────────────────────────────────────────────────────
    const [devicesStudent, setDevicesStudent] = useState(null);

    // ── Fetch ONLY batches on mount ──────────────────────────────────────
    const fetchBatches = useCallback(async () => {
        const cached = getCache(cacheKeyBatches);
        if (cached) {
            setBatches(cached);
            setBatchesLoading(false);
            return;
        }
        try {
            const b = await api.get("/api/admin/batches");
            setBatches(b);
            setCache(cacheKeyBatches, b);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setBatchesLoading(false);
        }
    }, []);

    // ── Load students for selected batch (on demand only) ────────────────
    const loadStudents = useCallback(async (batchId) => {
        if (!batchId) return;
        setListLoading(true);
        setHasLoaded(false);
        setStudents([]);
        try {
            const s = await api.get(`/api/admin/students?batch_id=${batchId}`);
            setStudents(s);
            setHasLoaded(true);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setListLoading(false);
        }
    }, []);

    const handleViewStudents = () => loadStudents(selectedListBatch);

    useEffect(() => { fetchBatches(); }, [fetchBatches]);

    // ── Add student ──────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!form.batch_id) {
            setError("Please select a batch for the new student.");
            return;
        }

        setFormLoading(true);
        setError("");
        setSuccess("");
        try {
            await api.post("/api/admin/students", form);
            setSuccess("Student added successfully!");
            setForm({ name: "", username: "", password: "", batch_id: "" });
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setFormLoading(false);
        }
    };

    // After edit/status — refresh the currently viewed batch list
    const refreshList = () => {
        if (selectedListBatch && hasLoaded) loadStudents(selectedListBatch);
    };

    // ── Edit handlers (used from list tab modals) ────────────────────────
    const startEdit = (student) => {
        setEditingStudent(student.uid || student.id);
        setEditForm({
            name: student.name || "",
            username: student.username || "",
            batch_id: student.batch_id || "",
            password: "",
        });
        setOverrideStudent(null);
    };

    const cancelEdit = () => {
        setEditingStudent(null);
        setEditForm({ name: "", username: "", batch_id: "", password: "" });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setEditLoading(true);
        setError("");
        try {
            const payload = {};
            if (editForm.name) payload.name = editForm.name;
            if (editForm.username) payload.username = editForm.username;
            if (editForm.batch_id) payload.batch_id = editForm.batch_id;
            if (editForm.password && editForm.password.trim()) payload.password = editForm.password;
            await api.put(`/api/admin/students/${editingStudent}`, payload);
            setSuccess("Student updated!");
            
            // Optimistic UI update instead of full list refresh
            setStudents((prev) => prev.map((s) => 
                (s.uid || s.id) === editingStudent ? { ...s, ...payload } : s
            ));
            
            cancelEdit();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setEditLoading(false);
        }
    };

    // ── Fee-override handlers ────────────────────────────────────────────
    const startOverride = (student) => {
        setOverrideStudent(student);
        setOverrideAmount(student.custom_fee != null ? String(student.custom_fee) : "");
        setOverrideType("permanent");
        cancelEdit();
    };

    const cancelOverride = () => {
        setOverrideStudent(null);
        setOverrideAmount("");
    };

    const handleOverrideSubmit = async (e) => {
        e.preventDefault();
        setOverrideLoading(true);
        setError("");
        try {
            const uid = overrideStudent.uid || overrideStudent.id;
            if (overrideType === "permanent") {
                if (overrideAmount === "") {
                    await api.put(`/api/admin/students/${uid}`, { clear_custom_fee: true });
                } else {
                    await api.post("/api/admin/fee-override", {
                        student_id: uid,
                        mode: "all-time",
                        amount: parseFloat(overrideAmount),
                    });
                }
                setSuccess(overrideAmount === "" ? "Custom fee removed." : `Custom fee set to ₹${overrideAmount}.`);
                
                // Optimistic UI update for custom_fee
                setStudents((prev) => prev.map((s) => 
                    (s.uid || s.id) === uid ? { ...s, custom_fee: overrideAmount === "" ? null : parseFloat(overrideAmount) } : s
                ));
            } else {
                await api.post("/api/admin/fee-override", {
                    student_id: uid,
                    mode: "specific-month",
                    amount: parseFloat(overrideAmount),
                    month: overrideMonth,
                    year: overrideYear,
                });
                setSuccess(`Fee for ${MONTHS[overrideMonth - 1]} ${overrideYear} updated to ₹${overrideAmount}.`);
            }
            cancelOverride();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setOverrideLoading(false);
        }
    };

    // ── Status-toggle handlers ───────────────────────────────────────────
    const handleToggleStatus = (student) => {
        setStatusModalStudent(student);
        setStatusConfirmText("");
    };

    const confirmStatusToggle = async () => {
        if (!statusModalStudent) return;
        const uid = statusModalStudent.uid || statusModalStudent.id;
        const newStatus = !statusModalStudent.is_disabled;
        setStatusModalStudent(null);
        setTogglingStatus(uid);
        try {
            await api.put(`/api/admin/students/${uid}/status`, { is_disabled: newStatus });
            setSuccess(`Student ${newStatus ? "disabled" : "enabled"} successfully.`);
            
            // Optimistic UI update
            setStudents((prev) => prev.map((s) => 
                (s.uid || s.id) === uid ? { ...s, is_disabled: newStatus } : s
            ));
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setTogglingStatus(null);
        }
    };

    // ── Loading skeleton (only while batches load) ───────────────────────
    if (batchesLoading) {
        return (
            <div className="p-6">
                <GenericListSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* ── Tab control ─────────────────────────────────────────── */}
            <div className="flex items-center gap-1 p-1 bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab("list")}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center gap-2
                        ${activeTab === "list"
                            ? "bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 shadow-[0_0_15px_rgba(199,153,255,0.15)]"
                            : "text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 border border-transparent"}`}
                >
                    <span className="material-symbols-outlined text-[16px]">group</span>
                    View Students
                </button>
                <button
                    onClick={() => setActiveTab("add")}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center gap-2
                        ${activeTab === "add"
                            ? "bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 shadow-[0_0_15px_rgba(199,153,255,0.15)]"
                            : "text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 border border-transparent"}`}
                >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    Add Student
                </button>
            </div>

            {/* ── Messages ────────────────────────────────────────────── */}
            {error && !editingStudent && !overrideStudent && !statusModalStudent && (
                <div className="p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#ff6e84]/30 shadow-lg text-[#ff9dac] text-sm flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                </div>
            )}
            {success && (
                <div className="p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#4af8e3]/30 shadow-lg text-[#dcfff8] text-sm flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#4af8e3]">check_circle</span>
                    <span className="flex-1">{success}</span>
                    <button onClick={() => setSuccess("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 1 — VIEW STUDENTS (lazy-loaded by batch)
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === "list" && (
                <div className="space-y-5">
                    {/* Batch selector row */}
                    <div className="flex flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
                        <div className="w-[65%] sm:w-auto sm:flex-1 sm:max-w-xs">
                            <ModernSelect
                                value={selectedListBatch}
                                onChange={(e) => { setSelectedListBatch(e.target.value); setHasLoaded(false); setStudents([]); }}
                                options={batches}
                                placeholder="Select Batch"
                                className="w-full h-full flex items-center justify-between px-3 sm:px-4 py-3 rounded-xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors"
                            />
                        </div>
                        <button
                            onClick={handleViewStudents}
                            disabled={!selectedListBatch || listLoading}
                            className="w-[35%] sm:w-auto px-2 sm:px-6 py-3 rounded-xl bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 text-xs sm:text-sm font-bold uppercase tracking-widest
                            hover:bg-[#c799ff]/20 hover:border-[#c799ff]/50 transition-all duration-300 shadow-[0_4px_15px_rgba(199,153,255,0.15)]
                            disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap"
                        >
                            {listLoading ? (
                                <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-[#c799ff]/30 border-t-[#c799ff] animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined text-[16px]">search</span>
                            )}
                            <span className="hidden sm:inline">{listLoading ? "Loading..." : "View Students"}</span>
                            <span className="sm:hidden">{listLoading ? "WAIT" : "VIEW"}</span>
                        </button>
                    </div>

                    {/* Loading skeleton */}
                    {listLoading && <GenericListSkeleton />}

                    {/* Empty state — no batch selected or no data */}
                    {!listLoading && !hasLoaded && (
                        <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-16 flex flex-col items-center justify-center gap-4 text-center">
                            <span className="material-symbols-outlined text-5xl text-[#464752]">group</span>
                            <p className="text-[#f0f0fd] font-bold text-lg" style={{ fontFamily: "'Manrope', sans-serif" }}>Select a batch and click View</p>
                            <p className="text-[#aaaab7] text-sm">No unnecessary database reads until you choose a batch.</p>
                        </div>
                    )}

                    {!listLoading && hasLoaded && students.length === 0 && (
                        <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-12 flex flex-col items-center justify-center gap-4 text-center">
                            <span className="material-symbols-outlined text-4xl text-[#464752]">person_off</span>
                            <p className="text-[#aaaab7] font-medium">No students found in this batch.</p>
                        </div>
                    )}

                    {/* ── Mobile: Card layout ───────────────────────────── */}
                    {!listLoading && hasLoaded && students.length > 0 && (
                        <>
                            <div className="mb-4 md:hidden px-2 text-[#aaaab7] text-xs font-bold uppercase tracking-widest">
                                {students.length} student{students.length !== 1 ? "s" : ""} · {batches.find(b => b.id === selectedListBatch)?.batch_name || ""}
                            </div>
                            <div className="space-y-4 md:hidden">
                                {students.map((s) => (
                                    <div key={s.uid || s.id} className={`bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-2xl p-5 transition-all ${s.is_disabled ? "opacity-60 grayscale-[0.3]" : ""}`}>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[#f0f0fd] font-bold text-lg truncate tracking-wide" style={{ fontFamily: "'Manrope', sans-serif" }}>{s.name}</p>
                                                {s.is_disabled && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-[#ff6e84]/10 text-[#ff6e84] text-[10px] font-black uppercase tracking-tighter border border-[#ff6e84]/30 shadow-[0_0_10px_rgba(255,110,132,0.2)]">Disabled</span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2 -mt-1">
                                                {s.custom_fee != null && (
                                                    <span className="px-3 py-1 rounded-full bg-[#f5c542]/10 text-[#f5c542] text-[11px] border border-[#f5c542]/30 font-bold uppercase tracking-widest whitespace-nowrap">₹{s.custom_fee}/mo</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2 justify-end w-full border-t border-[#464752]/30 pt-4">
                                                <button onClick={() => setDevicesStudent(s)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#aaaab7] hover:bg-[#4af8e3]/10 hover:border-[#4af8e3]/30 hover:text-[#4af8e3] transition-all cursor-pointer flex-1 flex justify-center">
                                                    <span className="material-symbols-outlined text-[20px]">devices</span>
                                                </button>
                                                <button onClick={() => startOverride(s)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#aaaab7] hover:bg-[#f5c542]/10 hover:border-[#f5c542]/30 hover:text-[#f5c542] transition-all cursor-pointer flex-1 flex justify-center">
                                                    <span className="material-symbols-outlined text-[20px]">payments</span>
                                                </button>
                                                <button onClick={() => startEdit(s)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#aaaab7] hover:bg-[#c799ff]/10 hover:border-[#c799ff]/30 hover:text-[#c799ff] transition-all cursor-pointer flex-1 flex justify-center">
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                                <button onClick={() => handleToggleStatus(s)} disabled={togglingStatus === (s.uid || s.id)}
                                                    className={`p-2.5 rounded-xl border transition-all disabled:opacity-50 cursor-pointer flex-1 flex justify-center
                                                    ${s.is_disabled ? "bg-[#4af8e3]/5 border-[#4af8e3]/10 text-[#4af8e3]/60 hover:bg-[#4af8e3]/10 hover:border-[#4af8e3]/30 hover:text-[#4af8e3]" : "bg-white/5 border-white/10 text-[#aaaab7] hover:bg-[#ff6e84]/10 hover:border-[#ff6e84]/30 hover:text-[#ff6e84]"}`}>
                                                    {togglingStatus === (s.uid || s.id)
                                                        ? <span className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                                        : <span className="material-symbols-outlined text-[20px]">{s.is_disabled ? "person_check" : "person_off"}</span>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ── Desktop: Table layout ──────────────────── */}
                            <div className="hidden md:block bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] overflow-hidden shadow-lg">
                                <div className="px-6 py-4 border-b border-[#464752]/30 flex items-center justify-between">
                                    <span className="text-[#aaaab7] text-xs font-bold uppercase tracking-widest">
                                        {students.length} student{students.length !== 1 ? "s" : ""} · {batches.find(b => b.id === selectedListBatch)?.batch_name || ""}
                                    </span>
                                </div>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full">
                                        <thead className="bg-[#222532]/50 border-b border-[#464752]/50">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-[#aaaab7] uppercase tracking-widest whitespace-nowrap">Student</th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-[#aaaab7] uppercase tracking-widest whitespace-nowrap">Custom Fee</th>
                                                <th className="px-6 py-4 text-right text-xs font-bold text-[#aaaab7] uppercase tracking-widest whitespace-nowrap">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#464752]/30">
                                            {students.map((s) => (
                                                <tr key={s.uid || s.id} className={`hover:bg-[#222532]/30 transition-colors group ${s.is_disabled ? "opacity-50 grayscale-[0.5]" : ""}`}>
                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                        <p className="text-[#f0f0fd] font-bold tracking-wide flex items-center gap-2">
                                                            {s.name}
                                                            {s.is_disabled && (
                                                                <span className="px-1.5 py-0.5 rounded bg-[#ff6e84]/10 text-[#ff6e84] text-[9px] font-black uppercase tracking-tighter border border-[#ff6e84]/20">OFF</span>
                                                            )}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {s.custom_fee != null ? (
                                                            <span className="px-3 py-1 rounded-full bg-[#f5c542]/10 text-[#f5c542] text-[11px] border border-[#f5c542]/30 font-bold uppercase tracking-widest whitespace-nowrap">₹{s.custom_fee}</span>
                                                        ) : (
                                                            <span className="text-[#aaaab7] text-xs font-bold tracking-widest uppercase">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setDevicesStudent(s)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#aaaab7] hover:text-[#4af8e3] hover:bg-[#4af8e3]/10 hover:border-[#4af8e3]/30 transition-all cursor-pointer flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[16px]">devices</span>
                                                                <span className="text-xs font-bold tracking-wide uppercase">Devices</span>
                                                            </button>
                                                            <button onClick={() => startOverride(s)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#aaaab7] hover:text-[#f5c542] hover:bg-[#f5c542]/10 hover:border-[#f5c542]/30 transition-all cursor-pointer flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[16px]">payments</span>
                                                                <span className="text-xs font-bold tracking-wide uppercase">Fee</span>
                                                            </button>
                                                            <button onClick={() => startEdit(s)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#aaaab7] hover:text-[#c799ff] hover:bg-[#c799ff]/10 hover:border-[#c799ff]/30 transition-all cursor-pointer flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                                                <span className="text-xs font-bold tracking-wide uppercase">Edit</span>
                                                            </button>
                                                            <button onClick={() => handleToggleStatus(s)} disabled={togglingStatus === (s.uid || s.id)}
                                                                className={`px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2
                                                                ${s.is_disabled ? "bg-[#4af8e3]/5 border-[#4af8e3]/10 text-[#4af8e3]/60 hover:text-[#4af8e3] hover:bg-[#4af8e3]/10 hover:border-[#4af8e3]/30" : "bg-white/5 border-white/10 text-[#aaaab7] hover:text-[#ff6e84] hover:bg-[#ff6e84]/10 hover:border-[#ff6e84]/30"}`}>
                                                                {togglingStatus === (s.uid || s.id)
                                                                    ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                                                    : <span className="material-symbols-outlined text-[16px]">{s.is_disabled ? "person_check" : "person_off"}</span>}
                                                                <span className="text-xs font-bold tracking-wide uppercase">{s.is_disabled ? "Enable" : "Disable"}</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 2 — ADD STUDENT
                No student list, no counts — just the form.
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === "add" && (
                <form
                    onSubmit={handleSubmit}
                    className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 sm:p-8 transition-colors hover:bg-[#171924]/80"
                >
                    <h3 className="text-[#f0f0fd] font-bold mb-6 text-lg flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        <span className="w-8 h-8 rounded-xl bg-[#c799ff]/10 border border-[#c799ff]/30 flex items-center justify-center text-sm font-extrabold text-[#c799ff] shadow-[0_0_10px_rgba(199,153,255,0.2)]">
                            <span className="material-symbols-outlined text-[16px]">person_add</span>
                        </span>
                        New Student
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                        <input
                            placeholder="Full Name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                            className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors placeholder:text-[#aaaab7]/70"
                        />
                        <input
                            placeholder="Username or Mobile"
                            type="text"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            required
                            className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors placeholder:text-[#aaaab7]/70"
                        />
                        <input
                            placeholder="Password"
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required
                            minLength={6}
                            className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors placeholder:text-[#aaaab7]/70"
                        />
                        <ModernSelect
                            value={form.batch_id}
                            onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
                            options={batches}
                            placeholder="Select Batch"
                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={formLoading}
                        className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 text-sm font-bold uppercase tracking-widest
                        hover:bg-[#c799ff]/20 hover:border-[#c799ff]/50 transition-all duration-300 shadow-[0_4px_15px_rgba(199,153,255,0.15)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-3"
                    >
                        {formLoading ? (
                            <span className="w-5 h-5 rounded-full border-2 border-[#c799ff]/30 border-t-[#c799ff] animate-spin" />
                        ) : (
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                        )}
                        {formLoading ? "Adding..." : "Add Student"}
                    </button>
                </form>
            )}

            {/* ═══════════════════════════════════════════════════════════
                MODALS (shared between both tabs — used by list actions)
            ══════════════════════════════════════════════════════════════ */}

            {/* Edit Student Modal */}
            {editingStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
                    <form onSubmit={handleEditSubmit} className="bg-[#13151f]/90 backdrop-blur-[20px] rounded-[2rem] p-6 sm:p-8 w-full max-w-lg border border-[#737580]/20 shadow-2xl relative animate-fade-in-up m-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[#f0f0fd] font-bold text-xl flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                <span className="material-symbols-outlined text-[#c799ff]">edit</span>
                                Edit Student
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
                                <input
                                    placeholder="Full Name"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-2">Username or Mobile</label>
                                <input
                                    placeholder="Username or Mobile"
                                    type="text"
                                    value={editForm.username}
                                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                    className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-2">New Password (Optional)</label>
                                <input
                                    placeholder="Leave blank to keep current"
                                    type="password"
                                    value={editForm.password}
                                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                    minLength={editForm.password ? 6 : undefined}
                                    className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-2">Batch</label>
                                <ModernSelect
                                    value={editForm.batch_id}
                                    onChange={(e) => setEditForm({ ...editForm, batch_id: e.target.value })}
                                    options={batches}
                                    placeholder="Select Batch"
                                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-4 pt-6 border-t border-[#464752]/30">
                            <button type="button" onClick={cancelEdit} className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 transition-all cursor-pointer">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={editLoading}
                                className="px-6 py-3 rounded-xl bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 text-sm font-bold uppercase tracking-widest hover:bg-[#c799ff]/20 hover:border-[#c799ff]/50 transition-all duration-300 shadow-[0_4px_15px_rgba(199,153,255,0.15)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                            >
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

            {/* Fee Override Modal */}
            {overrideStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
                    <form onSubmit={handleOverrideSubmit} className="bg-[#13151f]/90 backdrop-blur-[20px] rounded-[2rem] p-6 sm:p-8 w-full max-w-lg border border-[#f5c542]/20 shadow-2xl relative animate-fade-in-up m-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[#f0f0fd] font-bold text-xl flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                <span className="material-symbols-outlined text-[#f5c542]">payments</span>
                                Override: {overrideStudent.name}
                            </h3>
                            <button type="button" onClick={cancelOverride} className="text-[#aaaab7] hover:text-[#ff6e84] transition-colors cursor-pointer p-2 rounded-full hover:bg-white/5 flex items-center justify-center">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/30 text-[#ff9dac] text-sm flex items-center gap-3">
                                <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                                <span className="flex-1 font-medium">{error}</span>
                            </div>
                        )}
                        <div className="flex gap-3 mb-6">
                            <button type="button" onClick={() => setOverrideType("permanent")}
                                className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest border transition-all duration-300 cursor-pointer
                                ${overrideType === "permanent" ? "bg-[#c799ff]/10 border-[#c799ff]/50 text-[#c799ff] shadow-[0_0_15px_rgba(199,153,255,0.2)]" : "bg-[#222532]/50 border-[#464752]/50 text-[#aaaab7] hover:bg-[#222532]/80"}`}>
                                All-Time
                            </button>
                            <button type="button" onClick={() => setOverrideType("monthly")}
                                className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest border transition-all duration-300 cursor-pointer
                                ${overrideType === "monthly" ? "bg-[#4af8e3]/10 border-[#4af8e3]/50 text-[#4af8e3] shadow-[0_0_15px_rgba(74,248,227,0.2)]" : "bg-[#222532]/50 border-[#464752]/50 text-[#aaaab7] hover:bg-[#222532]/80"}`}>
                                Specific Month
                            </button>
                        </div>
                        <div className="space-y-5 mb-8">
                            <div>
                                <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-2">Custom Fee (₹)</label>
                                <input
                                    type="number"
                                    value={overrideAmount}
                                    onChange={(e) => setOverrideAmount(e.target.value)}
                                    placeholder="Leave blank to reset"
                                    className="w-full px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#f5c542]/50 transition-colors placeholder:text-[#aaaab7]/50"
                                />
                            </div>
                            {overrideType === "monthly" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-2">Month</label>
                                        <ModernSelect
                                            value={overrideMonth}
                                            onChange={(e) => setOverrideMonth(Number(e.target.value))}
                                            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#f5c542]/50 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[#aaaab7] text-[13px] font-bold tracking-wide uppercase mb-2">Year</label>
                                        <ModernSelect
                                            value={overrideYear}
                                            onChange={(e) => setOverrideYear(Number(e.target.value))}
                                            options={getYearOptions()}
                                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#f5c542]/50 transition-colors"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-4 pt-6 border-t border-[#464752]/30">
                            <button type="button" onClick={cancelOverride} className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 transition-all cursor-pointer">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={overrideLoading}
                                className="px-6 py-3 rounded-xl bg-[#f5c542]/10 text-[#f5c542] border border-[#f5c542]/30 text-sm font-bold uppercase tracking-widest hover:bg-[#f5c542]/20 hover:border-[#f5c542]/50 transition-all duration-300 shadow-[0_4px_15px_rgba(245,197,66,0.15)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                            >
                                {overrideLoading ? (
                                    <span className="w-5 h-5 rounded-full border-2 border-[#f5c542]/30 border-t-[#f5c542] animate-spin" />
                                ) : (
                                    <span className="material-symbols-outlined text-[18px]">save</span>
                                )}
                                {overrideLoading ? "Saving..." : "Set Fee Override"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Status Toggle Modal */}
            {statusModalStudent && (() => {
                const isDisabling = !statusModalStudent.is_disabled;
                const actionText = isDisabling ? "disable" : "enable";
                const targetText = `I confirm to ${actionText} ${statusModalStudent.name}`;
                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
                        <div className={`bg-[#13151f]/90 backdrop-blur-[20px] rounded-[2rem] p-6 sm:p-8 w-full max-w-lg border ${isDisabling ? "border-[#ff6e84]/30 shadow-[0_0_40px_rgba(255,110,132,0.15)]" : "border-[#4af8e3]/30 shadow-[0_0_40px_rgba(74,248,227,0.15)]"} relative animate-fade-in-up m-auto`}>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className={`${isDisabling ? "text-[#ff6e84]" : "text-[#4af8e3]"} font-bold text-xl flex items-center gap-2`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    <span className="material-symbols-outlined">{isDisabling ? "person_off" : "person_check"}</span>
                                    {isDisabling ? "Disable Student" : "Enable Student"}
                                </h3>
                                <button onClick={() => setStatusModalStudent(null)} className="text-[#aaaab7] hover:text-white transition-colors cursor-pointer p-2 rounded-full hover:bg-white/5 flex items-center justify-center">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            {error && (
                                <div className="mb-6 p-4 rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/30 text-[#ff9dac] text-sm flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                                    <span className="flex-1 font-medium">{error}</span>
                                </div>
                            )}
                            <div className="space-y-4 mb-6 text-[#aaaab7]">
                                <p className="text-base text-[#f0f0fd] font-medium">Are you sure you want to {actionText} <span className="font-bold text-white">{statusModalStudent.name}</span>?</p>
                                {isDisabling ? (
                                    <div className="bg-[#ff6e84]/10 border border-[#ff6e84]/20 p-4 rounded-xl text-sm leading-relaxed text-[#ff9dac]">
                                        <p className="font-bold mb-1">If you disable this student:</p>
                                        <ul className="list-disc list-inside space-y-1 ml-1 font-medium">
                                            <li>They will be logged out of all devices immediately.</li>
                                            <li>They will not be able to log in to their account.</li>
                                            <li>Auto-generation of new monthly payments will be paused for them.</li>
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="bg-[#4af8e3]/10 border border-[#4af8e3]/20 p-4 rounded-xl text-sm leading-relaxed text-[#dcfff8]">
                                        <p className="font-bold mb-1">If you enable this student:</p>
                                        <ul className="list-disc list-inside space-y-1 ml-1 font-medium">
                                            <li>They will be able to log in to their account again.</li>
                                            <li>Auto-generation of new monthly payments will resume.</li>
                                            <li>Their previous records remain intact.</li>
                                        </ul>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-[13px] font-bold tracking-wide uppercase mb-2">
                                        Please type <span className={`${isDisabling ? "text-[#ff6e84]" : "text-[#4af8e3]"} select-all`}>{targetText}</span> to verify
                                    </label>
                                    <input
                                        type="text"
                                        value={statusConfirmText}
                                        onChange={(e) => setStatusConfirmText(e.target.value)}
                                        className={`w-full px-4 py-3.5 rounded-xl bg-[#222532]/50 border border-[#464752]/50 ${isDisabling ? "hover:border-[#ff6e84]/50 focus:border-[#ff6e84] focus:ring-[#ff6e84]" : "hover:border-[#4af8e3]/50 focus:border-[#4af8e3] focus:ring-[#4af8e3]"} text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-1 transition-colors`}
                                        placeholder={targetText}
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-4 pt-6 border-t border-[#464752]/30">
                                <button onClick={() => setStatusModalStudent(null)} className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 transition-all cursor-pointer">
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmStatusToggle}
                                    disabled={statusConfirmText !== targetText}
                                    className={`px-6 py-3 rounded-xl ${isDisabling ? "bg-[#ff6e84]/10 text-[#ff6e84] border-[#ff6e84]/30 hover:bg-[#ff6e84]/20 hover:border-[#ff6e84]/50 shadow-[0_4px_15px_rgba(255,110,132,0.15)]" : "bg-[#4af8e3]/10 text-[#4af8e3] border-[#4af8e3]/30 hover:bg-[#4af8e3]/20 hover:border-[#4af8e3]/50 shadow-[0_4px_15px_rgba(74,248,227,0.15)]"} border text-sm font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{isDisabling ? "person_off" : "person_check"}</span>
                                    {isDisabling ? "Disable" : "Enable"}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Devices Modal */}
            {devicesStudent && (
                <UserDevicesModal
                    user={devicesStudent}
                    onClose={() => setDevicesStudent(null)}
                    onSessionDeleted={() => {}}
                />
            )}
        </div>
    );
}

export default function ManageStudents() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <StudentsContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

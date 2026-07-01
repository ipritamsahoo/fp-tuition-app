import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import UserDevicesModal from "@/components/UserDevicesModal";
import { api, isSystemicError } from "@/lib/api";
import { getYearOptions, getPreviousMonth } from "@/lib/yearOptions";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";
import { useAdminTheme } from "@/context/AdminThemeContext";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function StudentsContent() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
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
    const { month: prevMonth, year: prevYear } = getPreviousMonth();
    const [overrideMonth, setOverrideMonth] = useState(prevMonth);
    const [overrideYear, setOverrideYear] = useState(prevYear);
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

    useEffect(() => {
        if (selectedListBatch) {
            loadStudents(selectedListBatch);
        } else {
            setStudents([]);
            setHasLoaded(false);
        }
    }, [selectedListBatch, loadStudents]);

    useEffect(() => { fetchBatches(); }, [fetchBatches]);

    // Disable body scroll when any modal is open
    useEffect(() => {
        const isModalOpen = !!editingStudent || !!overrideStudent || !!statusModalStudent || !!devicesStudent;
        if (isModalOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [editingStudent, overrideStudent, statusModalStudent, devicesStudent]);

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
            <div className="flex items-center gap-1 p-1 border rounded-2xl w-fit"
                 style={{
                     backgroundColor: 'var(--ad-card-bg)',
                     borderColor: 'var(--ad-divider)'
                 }}
            >
                <button
                    onClick={() => setActiveTab("list")}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center gap-2 border border-transparent"
                    style={{
                        backgroundColor: activeTab === "list" ? (isLight ? 'rgba(59, 130, 246, 0.08)' : 'rgba(199, 153, 255, 0.1)') : 'transparent',
                        color: activeTab === "list" ? (isLight ? '#2563eb' : '#c799ff') : 'var(--ad-text-secondary)',
                        borderColor: activeTab === "list" ? (isLight ? 'rgba(59, 130, 246, 0.25)' : 'rgba(199, 153, 255, 0.25)') : 'transparent',
                    }}
                >
                    <span className="material-symbols-outlined text-[16px]">group</span>
                    View Students
                </button>
                <button
                    onClick={() => setActiveTab("add")}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center gap-2 border border-transparent"
                    style={{
                        backgroundColor: activeTab === "add" ? (isLight ? 'rgba(59, 130, 246, 0.08)' : 'rgba(199, 153, 255, 0.1)') : 'transparent',
                        color: activeTab === "add" ? (isLight ? '#2563eb' : '#c799ff') : 'var(--ad-text-secondary)',
                        borderColor: activeTab === "add" ? (isLight ? 'rgba(59, 130, 246, 0.25)' : 'rgba(199, 153, 255, 0.25)') : 'transparent',
                    }}
                >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    Add Student
                </button>
            </div>

            {/* ── Messages ────────────────────────────────────────────── */}
            {error && !editingStudent && !overrideStudent && !statusModalStudent && (
                <div className="p-4 rounded-xl border shadow-lg text-sm flex items-center gap-3"
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
                <div className="p-4 rounded-xl border shadow-lg text-sm flex items-center gap-3"
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

            {/* ═══════════════════════════════════════════════════════════
                TAB 1 — VIEW STUDENTS (lazy-loaded by batch)
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === "list" && (
                <div className="space-y-5">
                    {/* Batch selector row */}
                    <div className="flex flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
                        <div className="w-full sm:flex-1 sm:max-w-xs">
                            <ModernSelect
                                value={selectedListBatch}
                                onChange={(e) => setSelectedListBatch(e.target.value)}
                                options={batches}
                                placeholder="Select Batch"
                                className="w-full flex items-center justify-between px-3 sm:px-4 py-3 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Loading skeleton */}
                    {listLoading && <GenericListSkeleton />}

                    {/* Empty state — no batch selected or no data */}
                    {!listLoading && !hasLoaded && (
                        <div className="backdrop-blur-[20px] border rounded-[2rem] p-16 flex flex-col items-center justify-center gap-4 text-center"
                             style={{
                                 backgroundColor: 'var(--ad-card-bg)',
                                 borderColor: 'var(--ad-card-border)'
                             }}
                        >
                            <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--ad-text-secondary)' }}>group</span>
                            <p className="font-bold text-lg" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>Select Batch</p>
                            <p className="text-sm" style={{ color: 'var(--ad-text-secondary)' }}>Please select a batch to view its students.</p>
                        </div>
                    )}

                    {!listLoading && hasLoaded && students.length === 0 && (
                        <div className="backdrop-blur-[20px] border rounded-[2rem] p-12 flex flex-col items-center justify-center gap-4 text-center"
                             style={{
                                 backgroundColor: 'var(--ad-card-bg)',
                                 borderColor: 'var(--ad-card-border)'
                             }}
                        >
                            <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--ad-text-secondary)' }}>person_off</span>
                            <p className="font-medium" style={{ color: 'var(--ad-text-secondary)' }}>No students found in this batch.</p>
                        </div>
                    )}

                    {/* ── Mobile: Card layout ───────────────────────────── */}
                    {!listLoading && hasLoaded && students.length > 0 && (
                        <>
                            <div className="mb-4 md:hidden px-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--ad-text-secondary)' }}>
                                {students.length} student{students.length !== 1 ? "s" : ""} · {batches.find(b => b.id === selectedListBatch)?.batch_name || ""}
                            </div>
                            <div className="space-y-4 md:hidden">
                                {students.map((s) => (
                                    <div key={s.uid || s.id} 
                                         className={`backdrop-blur-[20px] border rounded-2xl p-5 transition-all ${s.is_disabled ? "opacity-60 grayscale-[0.3]" : ""}`}
                                         style={{
                                             backgroundColor: 'var(--ad-card-bg)',
                                             borderColor: 'var(--ad-card-border)'
                                         }}
                                    >
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-lg truncate tracking-wide" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>{s.name}</p>
                                                {s.is_disabled && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-[#ff6e84]/10 text-[#ff6e84] text-[10px] font-black uppercase tracking-tighter border border-[#ff6e84]/30 shadow-[0_0_10px_rgba(255,110,132,0.2)]">Disabled</span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2 -mt-1">
                                                {s.custom_fee != null && (
                                                    <span className="px-3 py-1 rounded-full bg-[#f5c542]/10 text-[#f5c542] text-[11px] border border-[#f5c542]/30 font-bold uppercase tracking-widest whitespace-nowrap">₹{s.custom_fee}/mo</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2 justify-end w-full border-t pt-4" style={{ borderColor: 'var(--ad-divider)' }}>
                                                <button onClick={() => setDevicesStudent(s)} 
                                                        className="p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex-1 flex justify-center hover:opacity-80"
                                                        style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">devices</span>
                                                </button>
                                                <button onClick={() => startOverride(s)} 
                                                        className="p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex-1 flex justify-center hover:opacity-80"
                                                        style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">payments</span>
                                                </button>
                                                <button onClick={() => startEdit(s)} 
                                                        className="p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex-1 flex justify-center hover:opacity-80"
                                                        style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                                <button onClick={() => handleToggleStatus(s)} disabled={togglingStatus === (s.uid || s.id)}
                                                    className="p-2.5 rounded-xl border transition-all disabled:opacity-50 cursor-pointer flex-1 flex justify-center hover:opacity-80"
                                                    style={{ 
                                                        backgroundColor: s.is_disabled ? 'rgba(74, 248, 227, 0.05)' : 'var(--ad-icon-bg)', 
                                                        borderColor: s.is_disabled ? 'rgba(74, 248, 227, 0.15)' : 'var(--ad-input-border)', 
                                                        color: s.is_disabled ? '#4af8e3' : 'var(--ad-text-secondary)' 
                                                    }}
                                                >
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
                            <div className="hidden md:block backdrop-blur-[20px] border rounded-[2rem] overflow-hidden shadow-lg"
                                 style={{
                                     backgroundColor: 'var(--ad-card-bg)',
                                     borderColor: 'var(--ad-card-border)'
                                 }}
                            >
                                <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--ad-divider)' }}>
                                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--ad-text-secondary)' }}>
                                        {students.length} student{students.length !== 1 ? "s" : ""} · {batches.find(b => b.id === selectedListBatch)?.batch_name || ""}
                                    </span>
                                </div>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full">
                                        <thead style={{ backgroundColor: 'var(--ad-surface)', borderBottom: '1px solid var(--ad-divider)' }}>
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--ad-text-secondary)' }}>Student</th>
                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--ad-text-secondary)' }}>Custom Fee</th>
                                                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--ad-text-secondary)' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--ad-divider)]">
                                            {students.map((s) => (
                                                <tr key={s.uid || s.id} className={`hover:bg-white/[0.01] transition-colors group ${s.is_disabled ? "opacity-50 grayscale-[0.5]" : ""}`}>
                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                        <p className="font-bold tracking-wide flex items-center gap-2" style={{ color: 'var(--ad-text-primary)' }}>
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
                                                            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--ad-text-secondary)' }}>—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setDevicesStudent(s)} 
                                                                    className="px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2 hover:opacity-85"
                                                                    style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">devices</span>
                                                                <span className="text-xs font-bold tracking-wide uppercase">Devices</span>
                                                            </button>
                                                            <button onClick={() => startOverride(s)} 
                                                                    className="px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2 hover:opacity-85"
                                                                    style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">payments</span>
                                                                <span className="text-xs font-bold tracking-wide uppercase">Fee</span>
                                                            </button>
                                                            <button onClick={() => startEdit(s)} 
                                                                    className="px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2 hover:opacity-85"
                                                                    style={{ backgroundColor: 'var(--ad-icon-bg)', borderColor: 'var(--ad-input-border)', color: 'var(--ad-text-secondary)' }}
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                                                <span className="text-xs font-bold tracking-wide uppercase">Edit</span>
                                                            </button>
                                                            <button onClick={() => handleToggleStatus(s)} disabled={togglingStatus === (s.uid || s.id)}
                                                                className="px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2 hover:opacity-85"
                                                                style={{ 
                                                                    backgroundColor: s.is_disabled ? 'rgba(74, 248, 227, 0.05)' : 'var(--ad-icon-bg)', 
                                                                    borderColor: s.is_disabled ? 'rgba(74, 248, 227, 0.15)' : 'var(--ad-input-border)', 
                                                                    color: s.is_disabled ? '#4af8e3' : 'var(--ad-text-secondary)' 
                                                                }}
                                                            >
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
                    className="backdrop-blur-[20px] border rounded-[2rem] p-6 sm:p-8 shadow-lg"
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
                        New Student
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                        <input
                            placeholder="Full Name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                            className="w-full px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                            style={{
                                backgroundColor: 'var(--ad-input-bg)',
                                borderColor: 'var(--ad-input-border)',
                                color: 'var(--ad-text-primary)'
                            }}
                        />
                        <input
                            placeholder="Username or Mobile"
                            type="text"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            required
                            className="w-full px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                            style={{
                                backgroundColor: 'var(--ad-input-bg)',
                                borderColor: 'var(--ad-input-border)',
                                color: 'var(--ad-text-primary)'
                            }}
                        />
                        <input
                            placeholder="Password"
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required
                            minLength={6}
                            className="w-full px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                            style={{
                                backgroundColor: 'var(--ad-input-bg)',
                                borderColor: 'var(--ad-input-border)',
                                color: 'var(--ad-text-primary)'
                            }}
                        />
                        <ModernSelect
                            value={form.batch_id}
                            onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
                            options={batches}
                            placeholder="Select Batch"
                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                            style={{
                                backgroundColor: 'var(--ad-input-bg)',
                                borderColor: 'var(--ad-input-border)',
                                color: 'var(--ad-text-primary)'
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={formLoading}
                        className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-3 border hover:opacity-85"
                        style={{
                            backgroundColor: 'var(--ad-accent-bg)',
                            borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                            color: 'var(--ad-accent)'
                        }}
                    >
                        {formLoading ? (
                            <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ad-accent)', borderTopColor: 'transparent' }} />
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
            {editingStudent && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
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
                                Edit Student
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
                                <input
                                    placeholder="Full Name"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
                                <input
                                    placeholder="Username or Mobile"
                                    type="text"
                                    value={editForm.username}
                                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
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
                                <input
                                    placeholder="Leave blank to keep current"
                                    type="password"
                                    value={editForm.password}
                                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                    minLength={editForm.password ? 6 : undefined}
                                    className="w-full px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-colors"
                                    style={{
                                        backgroundColor: 'var(--ad-input-bg)',
                                        borderColor: 'var(--ad-input-border)',
                                        color: 'var(--ad-text-primary)'
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-[13px] font-bold tracking-wide uppercase mb-2" style={{ color: 'var(--ad-text-secondary)' }}>Batch</label>
                                <ModernSelect
                                    value={editForm.batch_id}
                                    onChange={(e) => setEditForm({ ...editForm, batch_id: e.target.value })}
                                    options={batches}
                                    placeholder="Select Batch"
                                    className="w-full flex items-cols-between px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-colors"
                                    style={{
                                        backgroundColor: 'var(--ad-input-bg)',
                                        borderColor: 'var(--ad-input-border)',
                                        color: 'var(--ad-text-primary)'
                                    }}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-4 pt-6 border-t font-semibold" style={{ borderColor: 'var(--ad-divider)' }}>
                            <button type="button" onClick={cancelEdit} 
                                    className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:opacity-85 transition-all cursor-pointer"
                                    style={{ color: 'var(--ad-text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={editLoading}
                                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 border hover:opacity-85"
                                style={{
                                    backgroundColor: 'var(--ad-accent-bg)',
                                    borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                                    color: 'var(--ad-accent)'
                                }}
                            >
                                {editLoading ? (
                                    <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ad-accent)', borderTopColor: 'transparent' }} />
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

            {/* Fee Override Modal */}
            {overrideStudent && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
                    <form onSubmit={handleOverrideSubmit} 
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
                                <span className="material-symbols-outlined text-[#f5c542]">payments</span>
                                Override: {overrideStudent.name}
                            </h3>
                            <button type="button" onClick={cancelOverride} 
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
                        <div className="flex gap-3 mb-6">
                            <button type="button" onClick={() => setOverrideType("permanent")}
                                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest border transition-all duration-300 cursor-pointer"
                                style={{
                                    backgroundColor: overrideType === "permanent" ? (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(199, 153, 255, 0.1)') : 'var(--ad-icon-bg)',
                                    borderColor: overrideType === "permanent" ? (isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(199, 153, 255, 0.25)') : 'var(--ad-input-border)',
                                    color: overrideType === "permanent" ? (isLight ? '#0d9488' : '#c799ff') : 'var(--ad-text-secondary)'
                                }}
                            >
                                All-Time
                            </button>
                            <button type="button" onClick={() => setOverrideType("monthly")}
                                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest border transition-all duration-300 cursor-pointer"
                                style={{
                                    backgroundColor: overrideType === "monthly" ? (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)') : 'var(--ad-icon-bg)',
                                    borderColor: overrideType === "monthly" ? (isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(74, 248, 227, 0.25)') : 'var(--ad-input-border)',
                                    color: overrideType === "monthly" ? (isLight ? '#0d9488' : '#4af8e3') : 'var(--ad-text-secondary)'
                                }}
                            >
                                Specific Month
                            </button>
                        </div>
                        <div className="space-y-5 mb-8">
                            <div>
                                <label className="block text-[13px] font-bold tracking-wide uppercase mb-2" style={{ color: 'var(--ad-text-secondary)' }}>Custom Fee (₹)</label>
                                <input
                                    type="number"
                                    value={overrideAmount}
                                    onChange={(e) => setOverrideAmount(e.target.value)}
                                    placeholder="Leave blank to reset"
                                    className="w-full px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-colors"
                                    style={{
                                        backgroundColor: 'var(--ad-input-bg)',
                                        borderColor: 'var(--ad-input-border)',
                                        color: 'var(--ad-text-primary)'
                                    }}
                                />
                            </div>
                            {overrideType === "monthly" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-bold tracking-wide uppercase mb-2" style={{ color: 'var(--ad-text-secondary)' }}>Month</label>
                                        <ModernSelect
                                            value={overrideMonth}
                                            onChange={(e) => setOverrideMonth(Number(e.target.value))}
                                            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-colors"
                                            style={{
                                                backgroundColor: 'var(--ad-input-bg)',
                                                borderColor: 'var(--ad-input-border)',
                                                color: 'var(--ad-text-primary)'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-bold tracking-wide uppercase mb-2" style={{ color: 'var(--ad-text-secondary)' }}>Year</label>
                                        <ModernSelect
                                            value={overrideYear}
                                            onChange={(e) => setOverrideYear(Number(e.target.value))}
                                            options={getYearOptions()}
                                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-colors"
                                            style={{
                                                backgroundColor: 'var(--ad-input-bg)',
                                                borderColor: 'var(--ad-input-border)',
                                                color: 'var(--ad-text-primary)'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-4 pt-6 border-t font-semibold" style={{ borderColor: 'var(--ad-divider)' }}>
                            <button type="button" onClick={cancelOverride} 
                                    className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:opacity-85 transition-all cursor-pointer"
                                    style={{ color: 'var(--ad-text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={overrideLoading}
                                className="px-6 py-3 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 hover:opacity-85"
                                style={{
                                    backgroundColor: isLight ? 'rgba(217, 119, 6, 0.08)' : 'rgba(245, 197, 66, 0.1)',
                                    borderColor: isLight ? 'rgba(217, 119, 6, 0.25)' : 'rgba(245, 197, 66, 0.3)',
                                    color: isLight ? '#d97706' : '#f5c542'
                                }}
                            >
                                {overrideLoading ? (
                                    <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: isLight ? '#d97706' : '#f5c542', borderTopColor: 'transparent' }} />
                                ) : (
                                    <span className="material-symbols-outlined text-[18px]">save</span>
                                )}
                                {overrideLoading ? "Saving..." : "Set Fee Override"}
                            </button>
                        </div>
                    </form>
                </div>,
                document.body
            )}

            {/* Status Toggle Modal */}
            {statusModalStudent && (() => {
                const isDisabling = !statusModalStudent.is_disabled;
                const actionText = isDisabling ? "DISABLE" : "ENABLE";
                const targetText = `I CONFIRM TO ${actionText} ${statusModalStudent.name.toUpperCase()}`;
                return createPortal(
                    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
                        <div className="relative w-full max-w-lg rounded-[2rem] p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.2)] animate-fade-in-up m-auto border"
                             style={{
                                 backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(25, 30, 45, 0.85)',
                                 borderColor: isDisabling 
                                     ? (isLight ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 110, 132, 0.3)')
                                     : (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)'),
                                 backdropFilter: 'blur(80px) saturate(2.5)',
                                 WebkitBackdropFilter: 'blur(80px) saturate(2.5)'
                             }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-xl flex items-center gap-2" 
                                    style={{ 
                                        fontFamily: "'Manrope', sans-serif",
                                        color: isDisabling ? (isLight ? '#ef4444' : '#ff6e84') : (isLight ? '#0d9488' : '#4af8e3')
                                    }}
                                >
                                    <span className="material-symbols-outlined">{isDisabling ? "person_off" : "person_check"}</span>
                                    {isDisabling ? "Disable Student" : "Enable Student"}
                                </h3>
                                <button onClick={() => setStatusModalStudent(null)} 
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
                            <div className="space-y-4 mb-6" style={{ color: 'var(--ad-text-secondary)' }}>
                                <p className="text-base font-medium" style={{ color: 'var(--ad-text-primary)' }}>Are you sure you want to {actionText} <span className="font-bold" style={{ color: 'var(--ad-text-primary)' }}>{statusModalStudent.name}</span>?</p>
                                {isDisabling ? (
                                    <div className="border p-4 rounded-xl text-sm leading-relaxed"
                                         style={{
                                             backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                             borderColor: 'rgba(239, 68, 68, 0.15)',
                                             color: isLight ? '#ef4444' : '#ff9dac'
                                         }}
                                    >
                                        <p className="font-bold mb-1">If you disable this student:</p>
                                        <ul className="list-disc list-inside space-y-1 ml-1 font-medium">
                                            <li>They will be logged out of all devices immediately.</li>
                                            <li>They will not be able to log in to their account.</li>
                                            <li>Auto-generation of new monthly payments will be paused for them.</li>
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="border p-4 rounded-xl text-sm leading-relaxed"
                                         style={{
                                             backgroundColor: 'rgba(13, 148, 136, 0.05)',
                                             borderColor: 'rgba(13, 148, 136, 0.15)',
                                             color: isLight ? '#0d9488' : '#dcfff8'
                                         }}
                                    >
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
                                        Please type <span className="select-all" style={{ color: isDisabling ? (isLight ? '#ef4444' : '#ff6e84') : (isLight ? '#0d9488' : '#4af8e3') }}>{targetText}</span> to verify
                                    </label>
                                    <input
                                        type="text"
                                        value={statusConfirmText}
                                        onChange={(e) => setStatusConfirmText(e.target.value.toUpperCase())}
                                        className="w-full px-4 py-3.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-1 transition-colors"
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
                            <div className="flex justify-end gap-4 pt-6 border-t font-semibold" style={{ borderColor: 'var(--ad-divider)' }}>
                                <button onClick={() => setStatusModalStudent(null)} 
                                        className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:opacity-85 transition-all cursor-pointer"
                                        style={{ color: 'var(--ad-text-secondary)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmStatusToggle}
                                    disabled={statusConfirmText !== targetText}
                                    className="px-6 py-3 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                    style={{
                                        backgroundColor: isDisabling ? 'rgba(239, 68, 68, 0.08)' : 'rgba(13, 148, 136, 0.08)',
                                        borderColor: isDisabling ? 'rgba(239, 68, 68, 0.25)' : 'rgba(13, 148, 136, 0.25)',
                                        color: isDisabling ? '#ef4444' : '#0d9488'
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{isDisabling ? "person_off" : "person_check"}</span>
                                    {isDisabling ? "Disable" : "Enable"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
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

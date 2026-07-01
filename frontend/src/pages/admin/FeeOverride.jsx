import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
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

function FeeOverrideContent() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    const { month: prevMonth, year: prevYear } = getPreviousMonth();
    const yearOptions = getYearOptions();

    const [filterBatch, setFilterBatch] = useState("");

    const cacheKeyStudents = `admin_fee_override_students_${filterBatch}`;
    const cacheKeyBatches = "admin_fee_override_batches";
    const cachedStudents = getCache(cacheKeyStudents);
    const cachedBatches = getCache(cacheKeyBatches);

    const [students, setStudents] = useState(cachedStudents || []);
    const [batches, setBatches] = useState(cachedBatches || []);
    const [loading, setLoading] = useState(!cachedStudents || !cachedBatches);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Form state
    const [studentId, setStudentId] = useState("");
    const [mode, setMode] = useState("all-time");
    const [amount, setAmount] = useState("");
    const [month, setMonth] = useState(prevMonth);
    const [year, setYear] = useState(prevYear);


    const fetchStudents = useCallback(async () => {
        const cKeyStudents = `admin_fee_override_students_${filterBatch}`;
        const cKeyBatches = "admin_fee_override_batches";
        
        if (!getCache(cKeyStudents) || !getCache(cKeyBatches)) {
            setLoading(true);
        }
        
        try {
            const [s, b] = await Promise.all([
                api.get("/api/admin/students" + (filterBatch ? `?batch_id=${filterBatch}` : "")),
                api.get("/api/admin/batches"),
            ]);
            
            if (JSON.stringify(getCache(cKeyStudents)) !== JSON.stringify(s)) {
                setStudents(s);
                setCache(cKeyStudents, s);
            }
            if (JSON.stringify(getCache(cKeyBatches)) !== JSON.stringify(b)) {
                setBatches(b);
                setCache(cKeyBatches, b);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [filterBatch]); // Stable reference to prevent infinite loops (depends on filterBatch only)

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    // Get selected student info
    const selectedStudent = students.find((s) => (s.uid || s.id) === studentId);
    const selectedBatch = selectedStudent?.batch_id
        ? batches.find((b) => b.id === selectedStudent.batch_id)
        : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!studentId) { setError("Please select a student."); return; }
        if (!amount || parseFloat(amount) < 0) { setError("Please enter a valid amount."); return; }

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            const payload = {
                student_id: studentId,
                mode,
                amount: parseFloat(amount),
            };
            if (mode === "specific-month") {
                payload.month = month;
                payload.year = year;
            }
            const res = await api.post("/api/admin/fee-override", payload);
            setSuccess(res.message || "Fee override applied successfully!");
            fetchStudents(); // refresh student data
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setStudentId("");
        setMode("all-time");
        setAmount("");
        setMonth(prevMonth);
        setYear(prevYear);
        setError("");
        setSuccess("");
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
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                    Fee Override <span className="text-2xl drop-shadow-md">⚡</span>
                </h1>
                <p className="text-sm mt-1 font-medium" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--ad-text-secondary)' }}>
                    Adjust fees permanently or for a specific month
                </p>
            </div>

            {error && (
                <div className="mb-4 p-4 rounded-xl border shadow-lg text-sm flex items-center gap-3 animate-fade-in-up"
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
                <div className="mb-4 p-4 rounded-xl border shadow-lg text-sm animate-fade-in-up"
                     style={{
                         backgroundColor: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(30, 41, 59, 0.85)',
                         borderColor: 'rgba(74, 248, 227, 0.3)',
                         color: isLight ? 'var(--ad-text-primary)' : '#dcfff8'
                     }}
                >
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[#4af8e3]">check_circle</span>
                        <span className="flex-1 font-medium">{success}</span>
                    </div>
                    <button onClick={resetForm}
                        className="mt-4 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2"
                        style={{
                            backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)',
                            borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)',
                            color: isLight ? '#0d9488' : '#4af8e3'
                        }}
                    >
                        <span className="material-symbols-outlined text-[16px]">refresh</span> Apply Another Override
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Step 1: Select Student */}
                <div className="backdrop-blur-[20px] border rounded-[2rem] p-6 shadow-sm"
                     style={{
                         backgroundColor: 'var(--ad-card-bg)',
                         borderColor: 'var(--ad-card-border)'
                     }}
                >
                    <h3 className="font-bold mb-5 flex items-center gap-3 text-lg" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                        <span className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold shadow-sm border"
                              style={{
                                  backgroundColor: 'var(--ad-icon-bg)',
                                  borderColor: 'var(--ad-divider)',
                                  color: 'var(--ad-text-primary)'
                              }}
                        >
                            1
                        </span>
                        Select Student
                    </h3>
                    <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4 relative">
                        <div className="relative z-20">
                            <ModernSelect
                                value={filterBatch}
                                onChange={(e) => { setFilterBatch(e.target.value); setStudentId(""); setLoading(true); }}
                                options={[{ id: "", batch_name: "All Batches" }, ...batches]}
                                placeholder="All Batches"
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
                            />
                        </div>
                        <div className="relative z-10">
                            <ModernSelect
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                options={students.map(s => ({ value: s.uid || s.id, label: `${s.name} ${s.custom_fee != null ? `(Custom: ₹${s.custom_fee})` : ""}` }))}
                                placeholder="Select Student"
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Selected student info card */}
                    {selectedStudent && (
                        <div className="mt-5 p-4 rounded-2xl border"
                             style={{
                                 backgroundColor: 'var(--ad-icon-bg)',
                                 borderColor: 'var(--ad-divider)'
                             }}
                        >
                            <div className="flex flex-wrap gap-2 items-center text-sm">
                                <span className="font-bold tracking-wide" style={{ color: 'var(--ad-text-primary)' }}>{selectedStudent.name}</span>
                                <span className="text-[#aaaab7]" style={{ color: 'var(--ad-text-secondary)' }}>•</span>
                                <span className="font-medium" style={{ color: 'var(--ad-text-secondary)' }}>{selectedStudent.email}</span>
                                {selectedBatch && (
                                    <>
                                        <span className="text-[#aaaab7]" style={{ color: 'var(--ad-text-secondary)' }}>•</span>
                                        <span className="px-3 py-1 rounded-full text-xs font-bold border tracking-widest shadow-sm"
                                              style={{
                                                  backgroundColor: isLight ? 'rgba(59, 130, 246, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                                                  borderColor: isLight ? 'rgba(59, 130, 246, 0.3)' : 'rgba(199, 153, 255, 0.3)',
                                                  color: isLight ? '#2563eb' : '#c799ff'
                                              }}
                                        >
                                            {selectedBatch.batch_name}
                                        </span>
                                    </>
                                )}
                                {selectedStudent.custom_fee != null && (
                                    <span className="px-3 py-1 rounded-full text-xs border font-bold tracking-widest shadow-sm"
                                          style={{
                                              backgroundColor: isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 157, 172, 0.1)',
                                              borderColor: isLight ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 157, 172, 0.3)',
                                              color: isLight ? '#ef4444' : '#ff9dac'
                                          }}
                                    >
                                        Custom: ₹{selectedStudent.custom_fee}
                                    </span>
                                )}
                                {selectedBatch?.batch_fee != null && (
                                    <span className="px-3 py-1 rounded-full text-xs border font-bold tracking-widest shadow-sm"
                                          style={{
                                              backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)',
                                              borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)',
                                              color: isLight ? '#0d9488' : '#4af8e3'
                                          }}
                                    >
                                        Batch: ₹{selectedBatch.batch_fee}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Step 2: Choose Mode */}
                <div className="backdrop-blur-[20px] border rounded-[2rem] p-6 shadow-sm"
                     style={{
                         backgroundColor: 'var(--ad-card-bg)',
                         borderColor: 'var(--ad-card-border)'
                     }}
                >
                    <h3 className="font-bold mb-5 flex items-center gap-3 text-lg" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                        <span className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold shadow-sm border"
                              style={{
                                  backgroundColor: 'var(--ad-icon-bg)',
                                  borderColor: 'var(--ad-divider)',
                                  color: 'var(--ad-text-primary)'
                              }}
                        >
                            2
                        </span>
                        Override Mode
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button type="button" onClick={() => setMode("all-time")}
                            className="p-5 rounded-2xl border-2 text-left transition-all duration-300 cursor-pointer"
                            style={{
                                backgroundColor: mode === "all-time"
                                    ? (isLight ? 'rgba(59, 130, 246, 0.08)' : 'rgba(199, 153, 255, 0.1)')
                                    : 'var(--ad-icon-bg)',
                                borderColor: mode === "all-time"
                                    ? (isLight ? 'rgba(59, 130, 246, 0.3)' : 'rgba(199, 153, 255, 0.3)')
                                    : 'var(--ad-input-border)'
                            }}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <span className="material-symbols-outlined"
                                      style={{ color: mode === "all-time" ? (isLight ? '#2563eb' : '#c799ff') : 'var(--ad-text-secondary)' }}
                                >
                                    all_inclusive
                                </span>
                                <span className="font-bold text-sm tracking-wide"
                                      style={{ color: mode === "all-time" ? (isLight ? '#2563eb' : '#c799ff') : 'var(--ad-text-secondary)' }}
                                >
                                    All-Time Override
                                </span>
                            </div>
                            <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--ad-text-secondary)' }}>
                                Permanently changes the student's fee. Updates all unpaid records and applies to all future months.
                            </p>
                        </button>
                        <button type="button" onClick={() => setMode("specific-month")}
                            className="p-5 rounded-2xl border-2 text-left transition-all duration-300 cursor-pointer"
                            style={{
                                backgroundColor: mode === "specific-month"
                                    ? (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)')
                                    : 'var(--ad-icon-bg)',
                                borderColor: mode === "specific-month"
                                    ? (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)')
                                    : 'var(--ad-input-border)'
                            }}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <span className="material-symbols-outlined"
                                      style={{ color: mode === "specific-month" ? (isLight ? '#0d9488' : '#4af8e3') : 'var(--ad-text-secondary)' }}
                                >
                                    calendar_month
                                </span>
                                <span className="font-bold text-sm tracking-wide"
                                      style={{ color: mode === "specific-month" ? (isLight ? '#0d9488' : '#4af8e3') : 'var(--ad-text-secondary)' }}
                                >
                                    Specific Month Only
                                </span>
                            </div>
                            <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--ad-text-secondary)' }}>
                                One-time adjustment for a single month. Does not change the student's profile or affect other months.
                            </p>
                        </button>
                    </div>
                </div>

                {/* Step 3: Amount + Month/Year (conditional) */}
                <div className="backdrop-blur-[20px] border rounded-[2rem] p-6 shadow-sm"
                     style={{
                         backgroundColor: 'var(--ad-card-bg)',
                         borderColor: 'var(--ad-card-border)'
                     }}
                >
                    <h3 className="font-bold mb-5 flex items-center gap-3 text-lg" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                        <span className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold shadow-sm border"
                              style={{
                                  backgroundColor: 'var(--ad-icon-bg)',
                                  borderColor: 'var(--ad-divider)',
                                  color: 'var(--ad-text-primary)'
                              }}
                        >
                            3
                        </span>
                        {mode === "specific-month" ? "Target & Amount" : "New Amount"}
                    </h3>
                    <div className={`space-y-4 sm:space-y-0 sm:grid sm:gap-4 ${mode === "specific-month" ? "sm:grid-cols-3" : "sm:grid-cols-1 sm:max-w-sm"}`}>
                        {mode === "specific-month" && (
                            <>
                                <div className="relative z-20">
                                    <ModernSelect
                                        value={month}
                                        onChange={(e) => setMonth(Number(e.target.value))}
                                        options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                                        style={{
                                            backgroundColor: 'var(--ad-input-bg)',
                                            borderColor: 'var(--ad-input-border)',
                                            color: 'var(--ad-text-primary)'
                                        }}
                                    />
                                </div>
                                <div className="relative z-20">
                                    <ModernSelect
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        options={yearOptions}
                                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-colors"
                                        style={{
                                            backgroundColor: 'var(--ad-input-bg)',
                                            borderColor: 'var(--ad-input-border)',
                                            color: 'var(--ad-text-primary)'
                                        }}
                                    />
                                </div>
                            </>
                        )}
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold" style={{ color: 'var(--ad-text-secondary)' }}>₹</span>
                            <input type="number" placeholder="Amount" value={amount}
                                onChange={(e) => setAmount(e.target.value)} required min="0" step="any"
                                className="w-full pl-8 pr-4 py-3.5 rounded-2xl border text-sm font-bold focus:outline-none focus:ring-2 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex flex-col sm:flex-row gap-4 font-semibold">
                    <button type="submit" disabled={submitting}
                        className="flex-1 sm:flex-none px-8 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 cursor-pointer shadow-md flex items-center justify-center gap-2 group border"
                        style={{
                            backgroundColor: mode === "all-time"
                                ? (isLight ? 'rgba(59, 130, 246, 0.08)' : 'rgba(199, 153, 255, 0.1)')
                                : (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)'),
                            borderColor: mode === "all-time"
                                ? (isLight ? 'rgba(59, 130, 246, 0.3)' : 'rgba(199, 153, 255, 0.3)')
                                : (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)'),
                            color: mode === "all-time"
                                ? (isLight ? '#2563eb' : '#c799ff')
                                : (isLight ? '#0d9488' : '#4af8e3')
                        }}
                    >
                        {submitting ? (
                            <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: mode === 'all-time' ? (isLight ? '#2563eb' : '#c799ff') : (isLight ? '#0d9488' : '#4af8e3') }} />
                        ) : (
                            <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">
                                {mode === "all-time" ? "bolt" : "event"}
                            </span>
                        )}
                        {submitting ? "Applying..." : mode === "all-time" ? "Apply Permanent Override" : "Apply Month Override"}
                    </button>
                    <button type="button" onClick={resetForm}
                        className="px-8 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 border"
                        style={{
                            backgroundColor: 'var(--ad-icon-bg)',
                            borderColor: 'var(--ad-divider)',
                            color: 'var(--ad-text-secondary)'
                        }}
                    >
                        <span className="material-symbols-outlined text-[18px]">restart_alt</span> Reset
                    </button>
                </div>
            </form>

            {/* Info Panel */}
            <div className="backdrop-blur-[20px] border rounded-[2rem] p-6 shadow-sm"
                 style={{
                     backgroundColor: 'var(--ad-card-bg)',
                     borderColor: 'var(--ad-card-border)'
                 }}
            >
                <h3 className="font-bold mb-4 text-sm flex items-center gap-2 tracking-wide" style={{ color: isLight ? '#2563eb' : '#ff9dac' }}>
                    <span className="material-symbols-outlined">info</span> How Fee Override Works
                </h3>
                <div className="space-y-4 text-[13px] leading-relaxed font-medium" style={{ color: 'var(--ad-text-secondary)' }}>
                    <div className="flex gap-3">
                        <span className="material-symbols-outlined shrink-0 text-lg" style={{ color: isLight ? '#2563eb' : '#c799ff' }}>all_inclusive</span>
                        <p><strong style={{ color: 'var(--ad-text-primary)' }}>All-Time:</strong> Sets a permanent custom fee on the student's profile. All current unpaid months are updated, and all future billing will use this rate.</p>
                    </div>
                    <div className="flex gap-3">
                        <span className="material-symbols-outlined shrink-0 text-lg" style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>calendar_month</span>
                        <p><strong style={{ color: 'var(--ad-text-primary)' }}>Specific Month:</strong> A one-time correction for a single month (e.g., half-month fees). It does not affect the profile, other months, or future billing.</p>
                    </div>
                    <div className="flex gap-3">
                        <span className="material-symbols-outlined text-emerald-500 shrink-0 text-lg">security</span>
                        <p><strong style={{ color: 'var(--ad-text-primary)' }}>Safety:</strong> Paid records are never modified by either mode. To revert a permanent override, clear the custom fee from the Manage Students page.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function FeeOverride() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <FeeOverrideContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

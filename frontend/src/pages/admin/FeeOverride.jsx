import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, isSystemicError } from "@/lib/api";
import { getYearOptions } from "@/lib/yearOptions";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function FeeOverrideContent() {
    const now = new Date();
    
    // We already have "admin_approval_batches" or "admin_batches", 
    // but just in case, we will use a separate key or share one. Let's use "admin_fee_override_batches" and "admin_fee_override_students".
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
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const yearOptions = getYearOptions();

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
        setMonth(now.getMonth() + 1);
        setYear(now.getFullYear());
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
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#f0f0fd] tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Fee Override <span className="text-2xl drop-shadow-md">⚡</span>
                </h1>
                <p className="text-[#aaaab7] text-sm mt-1 font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Adjust fees permanently or for a specific month
                </p>
            </div>

            {error && (
                <div className="mb-4 p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#ff6e84]/30 shadow-lg text-[#ff9dac] text-sm flex items-center gap-3 animate-fade-in-up">
                    <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#4af8e3]/30 shadow-lg text-[#dcfff8] text-sm animate-fade-in-up">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[#4af8e3]">check_circle</span>
                        <span className="flex-1">{success}</span>
                    </div>
                    <button onClick={resetForm}
                        className="mt-4 px-4 py-2 rounded-xl bg-[#4af8e3]/10 border border-[#4af8e3]/30 text-[#4af8e3] text-xs font-bold uppercase tracking-widest
                            hover:bg-[#4af8e3]/20 transition-all cursor-pointer flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">refresh</span> Apply Another Override
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Step 1: Select Student */}
                <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 transition-colors hover:bg-[#171924]/80">
                    <h3 className="text-[#f0f0fd] font-bold mb-5 flex items-center gap-3 text-lg" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        <span className="w-8 h-8 rounded-xl bg-[#c799ff]/10 border border-[#c799ff]/30 flex items-center justify-center text-sm font-extrabold text-[#c799ff] shadow-[0_0_10px_rgba(199,153,255,0.2)]">1</span>
                        Select Student
                    </h3>
                    <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4 relative">
                        <div className="relative z-20">
                            <ModernSelect
                                value={filterBatch}
                                onChange={(e) => { setFilterBatch(e.target.value); setStudentId(""); setLoading(true); }}
                                options={[{ id: "", batch_name: "All Batches" }, ...batches]}
                                placeholder="All Batches"
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors"
                            />
                        </div>
                        <div className="relative z-10">
                            <ModernSelect
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                options={students.map(s => ({ value: s.uid || s.id, label: `${s.name} ${s.custom_fee != null ? `(Custom: ₹${s.custom_fee})` : ""}` }))}
                                placeholder="Select Student"
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm focus:outline-none focus:ring-2 focus:ring-[#c799ff]/50 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Selected student info card */}
                    {selectedStudent && (
                        <div className="mt-5 p-4 rounded-2xl bg-black/20 border border-[#464752]/30">
                            <div className="flex flex-wrap gap-2 items-center text-sm">
                                <span className="text-[#f0f0fd] font-bold tracking-wide">{selectedStudent.name}</span>
                                <span className="text-[#aaaab7]">•</span>
                                <span className="text-[#aaaab7] font-medium">{selectedStudent.email}</span>
                                {selectedBatch && (
                                    <>
                                        <span className="text-[#aaaab7]">•</span>
                                        <span className="px-3 py-1 rounded-full bg-[#c799ff]/10 text-[#c799ff] text-xs font-bold border border-[#c799ff]/30 tracking-widest shadow-[0_0_8px_rgba(199,153,255,0.2)]">
                                            {selectedBatch.batch_name}
                                        </span>
                                    </>
                                )}
                                {selectedStudent.custom_fee != null && (
                                    <span className="px-3 py-1 rounded-full bg-[#ff9dac]/10 text-[#ff9dac] text-xs border border-[#ff9dac]/30 font-bold tracking-widest shadow-[0_0_8px_rgba(255,157,172,0.2)]">
                                        Custom: ₹{selectedStudent.custom_fee}
                                    </span>
                                )}
                                {selectedBatch?.batch_fee != null && (
                                    <span className="px-3 py-1 rounded-full bg-[#4af8e3]/10 text-[#4af8e3] text-xs border border-[#4af8e3]/30 font-bold tracking-widest shadow-[0_0_8px_rgba(74,248,227,0.2)]">
                                        Batch: ₹{selectedBatch.batch_fee}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Step 2: Choose Mode */}
                <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 transition-colors hover:bg-[#171924]/80">
                    <h3 className="text-[#f0f0fd] font-bold mb-5 flex items-center gap-3 text-lg" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        <span className="w-8 h-8 rounded-xl bg-[#c799ff]/10 border border-[#c799ff]/30 flex items-center justify-center text-sm font-extrabold text-[#c799ff] shadow-[0_0_10px_rgba(199,153,255,0.2)]">2</span>
                        Override Mode
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button type="button" onClick={() => setMode("all-time")}
                            className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 cursor-pointer ${mode === "all-time"
                                ? "border-[#c799ff]/50 bg-[#c799ff]/10 shadow-[0_4px_20px_rgba(199,153,255,0.15)]"
                                : "border-[#464752]/40 bg-black/10 hover:border-[#464752] hover:bg-black/20"
                                }`}>
                            <div className="flex items-center gap-3 mb-3">
                                <span className={`material-symbols-outlined ${mode === "all-time" ? "text-[#c799ff]" : "text-[#aaaab7]"}`}>all_inclusive</span>
                                <span className={`font-bold text-sm tracking-wide ${mode === "all-time" ? "text-[#c799ff]" : "text-[#aaaab7]"}`}>
                                    All-Time Override
                                </span>
                            </div>
                            <p className="text-xs text-[#aaaab7] leading-relaxed font-medium">
                                Permanently changes the student's fee. Updates all unpaid records and applies to all future months.
                            </p>
                        </button>
                        <button type="button" onClick={() => setMode("specific-month")}
                            className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 cursor-pointer ${mode === "specific-month"
                                ? "border-[#4af8e3]/50 bg-[#4af8e3]/10 shadow-[0_4px_20px_rgba(74,248,227,0.15)]"
                                : "border-[#464752]/40 bg-black/10 hover:border-[#464752] hover:bg-black/20"
                                }`}>
                            <div className="flex items-center gap-3 mb-3">
                                <span className={`material-symbols-outlined ${mode === "specific-month" ? "text-[#4af8e3]" : "text-[#aaaab7]"}`}>calendar_month</span>
                                <span className={`font-bold text-sm tracking-wide ${mode === "specific-month" ? "text-[#4af8e3]" : "text-[#aaaab7]"}`}>
                                    Specific Month Only
                                </span>
                            </div>
                            <p className="text-xs text-[#aaaab7] leading-relaxed font-medium">
                                One-time adjustment for a single month. Does not change the student's profile or affect other months.
                            </p>
                        </button>
                    </div>
                </div>

                {/* Step 3: Amount + Month/Year (conditional) */}
                <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 transition-colors hover:bg-[#171924]/80">
                    <h3 className="text-[#f0f0fd] font-bold mb-5 flex items-center gap-3 text-lg" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        <span className="w-8 h-8 rounded-xl bg-[#c799ff]/10 border border-[#c799ff]/30 flex items-center justify-center text-sm font-extrabold text-[#c799ff] shadow-[0_0_10px_rgba(199,153,255,0.2)]">3</span>
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
                                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm focus:outline-none focus:ring-2 focus:ring-[#4af8e3]/50 transition-colors"
                                    />
                                </div>
                                <div className="relative z-20">
                                    <ModernSelect
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        options={yearOptions}
                                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm focus:outline-none focus:ring-2 focus:ring-[#4af8e3]/50 transition-colors"
                                    />
                                </div>
                            </>
                        )}
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#aaaab7] text-lg font-bold">₹</span>
                            <input type="number" placeholder="Amount" value={amount}
                                onChange={(e) => setAmount(e.target.value)} required min="0" step="any"
                                className={`w-full pl-8 pr-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 text-[#f0f0fd] text-sm font-bold focus:outline-none focus:ring-2 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${mode === "specific-month" ? "focus:ring-[#4af8e3]/50 hover:border-[#4af8e3]/30" : "focus:ring-[#c799ff]/50 hover:border-[#c799ff]/30"}`} />
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <button type="submit" disabled={submitting}
                        className={`flex-1 sm:flex-none px-8 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 cursor-pointer shadow-lg flex items-center justify-center gap-2 group ${mode === "all-time"
                            ? "bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 hover:bg-[#c799ff]/20 hover:border-[#c799ff]/50 shadow-[0_4px_15px_rgba(199,153,255,0.15)]"
                            : "bg-[#4af8e3]/10 text-[#4af8e3] border border-[#4af8e3]/30 hover:bg-[#4af8e3]/20 hover:border-[#4af8e3]/50 shadow-[0_4px_15px_rgba(74,248,227,0.15)]"
                            }`}>
                        {submitting ? (
                            <span className={`w-5 h-5 rounded-full border-2 border-t-transparent animate-spin ${mode === 'all-time' ? 'border-[#c799ff]' : 'border-[#4af8e3]'}`} />
                        ) : (
                            <span className={`material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform ${mode === 'all-time' ? 'text-[#c799ff]' : 'text-[#4af8e3]'}`}>
                                {mode === "all-time" ? "bolt" : "event"}
                            </span>
                        )}
                        {submitting ? "Applying..." : mode === "all-time" ? "Apply Permanent Override" : "Apply Month Override"}
                    </button>
                    <button type="button" onClick={resetForm}
                        className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-[#aaaab7] text-[13px] font-bold uppercase tracking-widest
                            hover:bg-white/10 hover:text-white transition-all duration-300 cursor-pointer flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">restart_alt</span> Reset
                    </button>
                </div>
            </form>

            {/* Info Panel */}
            <div className="mt-10 bg-[#171924]/60 backdrop-blur-[20px] border border-[#ff9dac]/10 rounded-[2rem] p-6">
                <h3 className="text-[#ff9dac] font-bold mb-4 text-sm flex items-center gap-2 tracking-wide">
                    <span className="material-symbols-outlined">info</span> How Fee Override Works
                </h3>
                <div className="space-y-4 text-[13px] text-[#aaaab7] leading-relaxed font-medium">
                    <div className="flex gap-3">
                        <span className="material-symbols-outlined text-[#c799ff] shrink-0 text-lg">all_inclusive</span>
                        <p><strong className="text-[#f0f0fd]">All-Time:</strong> Sets a permanent custom fee on the student's profile. All current unpaid months are updated, and all future billing will use this rate.</p>
                    </div>
                    <div className="flex gap-3">
                        <span className="material-symbols-outlined text-[#4af8e3] shrink-0 text-lg">calendar_month</span>
                        <p><strong className="text-[#f0f0fd]">Specific Month:</strong> A one-time correction for a single month (e.g., half-month fees). It does not affect the profile, other months, or future billing.</p>
                    </div>
                    <div className="flex gap-3">
                        <span className="material-symbols-outlined text-emerald-400 shrink-0 text-lg">security</span>
                        <p><strong className="text-[#f0f0fd]">Safety:</strong> Paid records are never modified by either mode. To revert a permanent override, clear the custom fee from the Manage Students page.</p>
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

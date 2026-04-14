import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import AnimatedGreeting from "@/components/AnimatedGreeting";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { getYearOptions } from "@/lib/yearOptions";
import { collection, onSnapshot } from "firebase/firestore";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function SkeletonBentoCard() {
    return (
        <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 p-5 rounded-3xl flex flex-col justify-between h-36 animate-pulse">
            <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-white/5"></div>
            </div>
            <div>
                <div className="h-8 w-16 bg-white/5 rounded mt-2"></div>
                <div className="h-4 w-20 bg-white/5 rounded mt-1"></div>
            </div>
        </div>
    );
}

function BentoStatCard({ label, value, icon, iconDivClass }) {
    return (
        <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 p-5 rounded-3xl flex flex-col justify-between h-36 transition-all duration-300 hover:bg-[#171924]/80">
            <div className="flex justify-between items-start">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconDivClass}`}>
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
            </div>
            <div>
                <div className="text-2xl font-bold text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>{value}</div>
                <div className="text-xs text-[#aaaab7] font-medium uppercase tracking-widest mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>{label}</div>
            </div>
        </div>
    );
}

function AdminDashboardContent() {
    const { user } = useAuth();
    const cachedStats = getCache("admin_stats");
    const cachedBatches = getCache("admin_batches");
    const [stats, setStats] = useState(cachedStats || null);
    const [batches, setBatches] = useState(cachedBatches || []);
    const [loading, setLoading] = useState(!cachedStats || !cachedBatches);
    const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
    const [genYear, setGenYear] = useState(new Date().getFullYear());
    const [genAmount, setGenAmount] = useState(500);
    const [genBatch, setGenBatch] = useState("");
    const [generating, setGenerating] = useState(false);
    const [undoing, setUndoing] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const fetchStats = useCallback(async () => {
        try {
            const [statsData, batchData] = await Promise.all([
                api.get("/api/admin/stats"),
                api.get("/api/admin/batches"),
            ]);
            
            if (JSON.stringify(getCache("admin_stats")) !== JSON.stringify(statsData)) {
                setStats(statsData);
                setCache("admin_stats", statsData);
            }
            if (JSON.stringify(getCache("admin_batches")) !== JSON.stringify(batchData)) {
                setBatches(batchData);
                setCache("admin_batches", batchData);
            }
        } catch (err) {
            // Handled globally
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();

        const handleOnline = () => {
            fetchStats();
        };
        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, [fetchStats]);

    // Removed resource-intensive onSnapshot listener for entire payments collection

    const handleGenerate = async () => {
        setGenerating(true);
        setMessage("");
        setError("");
        try {
            const payload = {
                month: genMonth,
                year: genYear,
                amount: genAmount,
            };
            if (genBatch) payload.batch_id = genBatch;
            const data = await api.post("/api/admin/generate-monthly", payload);
            setMessage(data.message);
            fetchStats();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleUndo = async () => {
        const monthName = MONTHS[genMonth - 1];
        if (!window.confirm(`Are you sure you want to undo fee generation for ${monthName} ${genYear}?\n\nThis will delete only "Unpaid" records. Paid and pending payments are safe.`)) return;
        setUndoing(true);
        setMessage("");
        setError("");
        try {
            const payload = { month: genMonth, year: genYear };
            if (genBatch) payload.batch_id = genBatch;
            const data = await api.post("/api/admin/undo-monthly", payload);
            setMessage(data.message);
            fetchStats();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setUndoing(false);
        }
    };

    return (
        <>
            <section className="mb-10">
                <h2
                    className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#f0f0fd]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                    <AnimatedGreeting name={user?.name || "Admin"} />
                </h2>

            </section>

            {/* Messages */}
            <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {error && (
                    <div className="toast-enter pointer-events-auto p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#ff6e84]/30 shadow-lg text-[#ff9dac] text-sm flex items-center gap-3 w-80">
                        <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                        <p className="flex-1">{error}</p>
                        <button onClick={() => setError("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                    </div>
                )}
                {message && (
                    <div className="toast-enter pointer-events-auto p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#4af8e3]/30 shadow-lg text-[#dcfff8] text-sm flex flex-col gap-1 w-80">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[#4af8e3]">check_circle</span>
                            <p className="flex-1 text-[#f0f0fd]">{message}</p>
                            <button onClick={() => setMessage("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                        </div>
                        {!message.startsWith("Removed") && (
                            <p className="text-[10px] text-[#aaaab7] pl-8 mt-1">
                                Generated by mistake? <button onClick={handleUndo} className="underline hover:text-[#ff9dac] transition-colors cursor-pointer">Click Undo</button>
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Stats Grid (Bento Style) */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {loading ? (
                    <>
                        <SkeletonBentoCard />
                        <SkeletonBentoCard />
                        <SkeletonBentoCard />
                        <SkeletonBentoCard />
                    </>
                ) : stats ? (
                    <>
                        <BentoStatCard label="Students" value={stats.total_students} icon="person" iconDivClass="bg-[#3b82f6]/10 text-[#3b82f6]" />
                        <BentoStatCard label="Teachers" value={stats.total_teachers} icon="school" iconDivClass="bg-[#4af8e3]/10 text-[#4af8e3]" />
                        <BentoStatCard label="Batches" value={stats.total_batches} icon="group" iconDivClass="bg-[#ff9dac]/10 text-[#ff9dac]" />
                        <BentoStatCard label="Pending" value={stats.total_pending} icon="timer" iconDivClass="bg-[#ff6e84]/10 text-[#ff6e84]" />
                    </>
                ) : null}
            </section>

            {/* Payments Panel */}
            <section className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 md:p-8 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 md:opacity-10 pointer-events-none">
                    <span className="material-symbols-outlined text-8xl md:text-6xl">payments</span>
                </div>
                
                <h3 className="text-xl font-bold flex items-center gap-2 text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Generate Monthly Payments
                </h3>

                <div className="space-y-5 relative z-10">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[#aaaab7] ml-1">Batch</label>
                        <div className="relative z-30">
                            <ModernSelect
                                value={genBatch}
                                onChange={(e) => setGenBatch(e.target.value)}
                                options={[{ id: "", batch_name: "All Batches" }, ...batches]}
                                placeholder="All Batches"
                                className="w-full flex items-center justify-between bg-[#222532]/50 border border-[#464752]/50 hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-[#f0f0fd] text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[#aaaab7] ml-1">Month</label>
                            <div className="relative z-20">
                                <ModernSelect
                                    value={genMonth}
                                    onChange={(e) => setGenMonth(parseInt(e.target.value))}
                                    options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                                    className="w-full flex items-center justify-between bg-[#222532]/50 border border-[#464752]/50 hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-[#f0f0fd] text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[#aaaab7] ml-1">Year</label>
                            <div className="relative z-10">
                                <ModernSelect
                                    value={genYear}
                                    onChange={(e) => setGenYear(parseInt(e.target.value))}
                                    options={getYearOptions()}
                                    className="w-full flex items-center justify-between bg-[#222532]/50 border border-[#464752]/50 hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-[#f0f0fd] text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 col-span-2 lg:col-span-1">
                            <label className="text-xs font-medium text-[#aaaab7] ml-1 flex justify-between">
                                Default Amount (₹) <span className="opacity-50">Fallback</span>
                            </label>
                            <input
                                type="number"
                                value={genAmount}
                                onChange={(e) => setGenAmount(parseInt(e.target.value))}
                                className="w-full bg-[#222532]/50 border border-[#464752]/50 hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-[#f0f0fd] text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 relative z-10">
                    <button
                        onClick={handleGenerate}
                        disabled={generating || undoing}
                        className={`flex-1 py-4 text-white font-bold rounded-full shadow-lg shadow-[#3b82f6]/20 active:scale-95 transition-all cursor-pointer 
                            ${generating
                                ? 'bg-white/10 text-white/50 cursor-not-allowed shadow-none'
                                : 'bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:shadow-[#3b82f6]/40 hover:brightness-110'}`}
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                        {generating ? "Generating..." : "Generate Monthly Payments"}
                    </button>
                    <button
                        onClick={handleUndo}
                        disabled={undoing || generating}
                        className={`px-6 py-4 rounded-full font-bold active:scale-95 transition-all text-sm flex items-center justify-center cursor-pointer 
                            ${undoing
                                ? 'bg-white/5 text-[#aaaab7]/50 cursor-not-allowed border border-transparent'
                                : 'bg-[#171924] text-[#ff6e84] border border-[#ff6e84]/30 hover:bg-[#ff6e84]/10 hover:border-[#ff6e84]/50'}`}
                        title="Undo last generation (removes only Unpaid records)"
                    >
                        <span className="material-symbols-outlined text-[18px] mr-2">undo</span>
                        {undoing ? "Undoing..." : "Undo"}
                    </button>
                </div>
            </section>
        </>
    );
}

export default function AdminDashboard() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <AdminDashboardContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

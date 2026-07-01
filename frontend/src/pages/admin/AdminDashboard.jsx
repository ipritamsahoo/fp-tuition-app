import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import AnimatedGreeting from "@/components/AnimatedGreeting";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { getYearOptions, getPreviousMonth } from "@/lib/yearOptions";
import { collection, onSnapshot } from "firebase/firestore";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { useAdminTheme } from "@/context/AdminThemeContext";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function SkeletonBentoCard() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    return (
        <div className="backdrop-blur-[20px] p-5 rounded-3xl flex flex-col justify-between h-36 animate-pulse border"
             style={{
                 backgroundColor: 'var(--ad-card-bg)',
                 borderColor: 'var(--ad-card-border)'
             }}
        >
            <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: 'var(--ad-icon-bg)' }}></div>
            </div>
            <div>
                <div className="h-8 w-16 rounded mt-2" style={{ backgroundColor: 'var(--ad-icon-bg)' }}></div>
                <div className="h-4 w-20 rounded mt-1" style={{ backgroundColor: 'var(--ad-icon-bg)' }}></div>
            </div>
        </div>
    );
}

function BentoStatCard({ label, value, icon }) {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    
    const colorMap = {
        Students: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' },
        Teachers: { bg: isLight ? 'rgba(13, 148, 136, 0.1)' : 'rgba(74, 248, 227, 0.15)', text: isLight ? '#0d9488' : '#4af8e3' },
        Batches: { bg: isLight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 157, 172, 0.15)', text: isLight ? '#ef4444' : '#ff9dac' },
        Pending: { bg: isLight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 110, 132, 0.15)', text: isLight ? '#ef4444' : '#ff6e84' },
    };
    
    const colors = colorMap[label] || { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' };
    
    return (
        <div className="backdrop-blur-[20px] p-5 rounded-3xl flex flex-col justify-between h-36 transition-all duration-300 border shadow-[0_8px_30px_rgba(0,0,0,0.01)]"
             style={{
                 backgroundColor: 'var(--ad-card-bg)',
                 borderColor: 'var(--ad-card-border)'
             }}
        >
            <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                     style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
            </div>
            <div>
                <div className="text-2xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>{value}</div>
                <div className="text-xs font-medium uppercase tracking-widest mt-1" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--ad-text-secondary)' }}>{label}</div>
            </div>
        </div>
    );
}

function AdminDashboardContent() {
    const { user } = useAuth();
    const { theme } = useAdminTheme();
    const isLight = theme === "light";

    useEffect(() => {
        document.documentElement.classList.add("allow-overscroll");
        document.body.classList.add("allow-overscroll");
        return () => {
            document.documentElement.classList.remove("allow-overscroll");
            document.body.classList.remove("allow-overscroll");
        };
    }, []);

    const cachedStats = getCache("admin_stats");
    const cachedBatches = getCache("admin_batches");
    const [stats, setStats] = useState(cachedStats || null);
    const [batches, setBatches] = useState(cachedBatches || []);
    const [loading, setLoading] = useState(!cachedStats || !cachedBatches);
    const { month: prevMonth, year: prevYear } = getPreviousMonth();
    const [genMonth, setGenMonth] = useState(prevMonth);
    const [genYear, setGenYear] = useState(prevYear);
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
        if (!genBatch) {
            setError("Please select a batch first.");
            return;
        }
        setGenerating(true);
        setMessage("");
        setError("");
        try {
            const payload = {
                month: genMonth,
                year: genYear,
                amount: genAmount,
                batch_id: genBatch,
            };
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
        if (!genBatch) {
            setError("Please select a batch first.");
            return;
        }
        const monthName = MONTHS[genMonth - 1];
        if (!window.confirm(`Are you sure you want to undo fee generation for ${monthName} ${genYear}?\n\nThis will delete only "Unpaid" records. Paid and pending payments are safe.`)) return;
        setUndoing(true);
        setMessage("");
        setError("");
        try {
            const payload = { month: genMonth, year: genYear, batch_id: genBatch };
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
                    className="text-2xl md:text-3xl font-extrabold tracking-tight"
                    style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}
                >
                    <AnimatedGreeting name={user?.name || "Admin"} />
                </h2>
            </section>

            {/* Messages */}
            <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {error && (
                    <div className="toast-enter pointer-events-auto p-4 rounded-xl border shadow-lg text-sm flex items-center gap-3 w-80"
                         style={{
                             backgroundColor: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(30, 41, 59, 0.85)',
                             borderColor: 'rgba(255, 110, 132, 0.3)',
                             color: isLight ? '#ef4444' : '#ff9dac'
                         }}
                    >
                        <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                        <p className="flex-1 font-medium">{error}</p>
                        <button onClick={() => setError("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                    </div>
                )}
                {message && (
                    <div className="toast-enter pointer-events-auto p-4 rounded-xl border shadow-lg text-sm flex flex-col gap-1 w-80"
                         style={{
                             backgroundColor: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(30, 41, 59, 0.85)',
                             borderColor: 'rgba(74, 248, 227, 0.3)',
                             color: isLight ? 'var(--ad-text-primary)' : '#dcfff8'
                         }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[#4af8e3]">check_circle</span>
                            <p className="flex-1 font-medium">{message}</p>
                            <button onClick={() => setMessage("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                        </div>
                        {!message.startsWith("Removed") && (
                            <p className="text-[10px] pl-8 mt-1" style={{ color: 'var(--ad-text-secondary)' }}>
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
                        <BentoStatCard label="Students" value={stats.total_students} icon="person" />
                        <BentoStatCard label="Teachers" value={stats.total_teachers} icon="school" />
                        <BentoStatCard label="Batches" value={stats.total_batches} icon="group" />
                        <BentoStatCard label="Pending" value={stats.total_pending} icon="timer" />
                    </>
                ) : null}
            </section>

            {/* Payments Panel */}
            <section className="backdrop-blur-[20px] border rounded-[2rem] p-6 md:p-8 space-y-6 relative overflow-hidden"
                     style={{
                         backgroundColor: 'var(--ad-card-bg)',
                         borderColor: 'var(--ad-card-border)',
                         boxShadow: 'var(--ad-card-shadow)',
                     }}
            >
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none" style={{ color: 'var(--ad-text-secondary)' }}>
                    <span className="material-symbols-outlined text-8xl md:text-6xl">payments</span>
                </div>
                
                <h3 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                    Generate Monthly Payments
                </h3>

                <div className="space-y-5 relative z-10">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium ml-1" style={{ color: 'var(--ad-text-secondary)' }}>Batch</label>
                        <div className="relative z-30">
                            <ModernSelect
                                value={genBatch}
                                onChange={(e) => setGenBatch(e.target.value)}
                                options={batches}
                                placeholder="Select Batch"
                                className="w-full flex items-center justify-between border hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-sm"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium ml-1" style={{ color: 'var(--ad-text-secondary)' }}>Month</label>
                            <div className="relative z-20">
                                <ModernSelect
                                    value={genMonth}
                                    onChange={(e) => setGenMonth(parseInt(e.target.value))}
                                    options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                                    className="w-full flex items-center justify-between border hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-sm"
                                    style={{
                                        backgroundColor: 'var(--ad-input-bg)',
                                        borderColor: 'var(--ad-input-border)',
                                        color: 'var(--ad-text-primary)'
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium ml-1" style={{ color: 'var(--ad-text-secondary)' }}>Year</label>
                            <div className="relative z-10">
                                <ModernSelect
                                    value={genYear}
                                    onChange={(e) => setGenYear(parseInt(e.target.value))}
                                    options={getYearOptions()}
                                    className="w-full flex items-center justify-between border hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-sm"
                                    style={{
                                        backgroundColor: 'var(--ad-input-bg)',
                                        borderColor: 'var(--ad-input-border)',
                                        color: 'var(--ad-text-primary)'
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 col-span-2 lg:col-span-1">
                            <label className="text-xs font-medium ml-1 flex justify-between" style={{ color: 'var(--ad-text-secondary)' }}>
                                Default Amount (₹) <span className="opacity-50">Fallback</span>
                            </label>
                            <input
                                type="number"
                                value={genAmount}
                                onChange={(e) => setGenAmount(parseInt(e.target.value))}
                                className="w-full border hover:border-[#3b82f6]/50 transition-colors rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 text-sm"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
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
                        className={`px-6 py-4 rounded-full font-bold active:scale-95 transition-all text-sm flex items-center justify-center cursor-pointer`}
                        style={{
                            backgroundColor: undoing ? 'rgba(0,0,0,0.05)' : 'var(--ad-hover-bg)',
                            color: '#ff6e84',
                            border: '1px solid rgba(255, 110, 132, 0.3)',
                        }}
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

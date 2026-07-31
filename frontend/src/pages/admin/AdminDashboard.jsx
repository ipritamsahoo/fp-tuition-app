import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
        <div className="p-5 sm:p-6 rounded-[28px] flex flex-col justify-between h-36 animate-pulse border backdrop-blur-md"
             style={{
                 backgroundColor: isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(30, 41, 59, 0.6)',
                 borderColor: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)'
             }}
        >
            <div className="w-10 h-10 rounded-2xl bg-slate-300/40 dark:bg-slate-700/40"></div>
            <div>
                <div className="h-3 w-16 rounded bg-slate-300/40 dark:bg-slate-700/40 mb-2"></div>
                <div className="h-8 w-12 rounded-lg bg-slate-300/40 dark:bg-slate-700/40"></div>
            </div>
        </div>
    );
}

function BentoStatCard({ label, value, icon }) {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";

    const configMap = {
        Students: {
            bgLight: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
            bgDark: 'linear-gradient(135deg, rgba(14, 116, 144, 0.25) 0%, rgba(30, 58, 138, 0.25) 100%)',
            borderLight: 'rgba(186, 230, 253, 0.8)',
            borderDark: 'rgba(56, 189, 248, 0.2)',
            iconBgLight: '#3b82f6',
            iconBgDark: '#2563eb',
            iconColor: '#ffffff',
            accentColor: isLight ? '#1e40af' : '#60a5fa',
            subtextColor: isLight ? '#1e3a8a' : '#93c5fd',
        },
        Teachers: {
            bgLight: 'linear-gradient(135deg, #f3e8ff 0%, #fae8ff 100%)',
            bgDark: 'linear-gradient(135deg, rgba(126, 34, 206, 0.25) 0%, rgba(88, 28, 135, 0.25) 100%)',
            borderLight: 'rgba(233, 213, 255, 0.8)',
            borderDark: 'rgba(192, 132, 252, 0.2)',
            iconBgLight: '#a855f7',
            iconBgDark: '#9333ea',
            iconColor: '#ffffff',
            accentColor: isLight ? '#6b21a8' : '#c084fc',
            subtextColor: isLight ? '#581c87' : '#e9d5ff',
        },
        Batches: {
            bgLight: 'linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%)',
            bgDark: 'linear-gradient(135deg, rgba(180, 83, 9, 0.25) 0%, rgba(120, 53, 15, 0.25) 100%)',
            borderLight: 'rgba(253, 230, 138, 0.8)',
            borderDark: 'rgba(251, 191, 36, 0.2)',
            iconBgLight: '#f59e0b',
            iconBgDark: '#d97706',
            iconColor: '#ffffff',
            accentColor: isLight ? '#92400e' : '#fbbf24',
            subtextColor: isLight ? '#78350f' : '#fde68a',
        },
        Pending: {
            bgLight: 'linear-gradient(135deg, #ffe4e6 0%, #ffedd5 100%)',
            bgDark: 'linear-gradient(135deg, rgba(225, 29, 72, 0.25) 0%, rgba(159, 18, 57, 0.25) 100%)',
            borderLight: 'rgba(254, 205, 211, 0.8)',
            borderDark: 'rgba(251, 113, 133, 0.2)',
            iconBgLight: '#f43f5e',
            iconBgDark: '#e11d48',
            iconColor: '#ffffff',
            accentColor: isLight ? '#9f1239' : '#fb7185',
            subtextColor: isLight ? '#881337' : '#fecdd3',
        }
    };

    const cfg = configMap[label] || configMap.Students;

    return (
        <div 
            className="p-5 sm:p-6 rounded-[28px] flex flex-col justify-between h-36 transition-all duration-300 border shadow-sm relative overflow-hidden group hover:scale-[1.02]"
            style={{
                background: isLight ? cfg.bgLight : cfg.bgDark,
                borderColor: isLight ? cfg.borderLight : cfg.borderDark,
            }}
        >
            {/* Top Row: Icon Badge */}
            <div className="flex items-center justify-between relative z-10">
                <div 
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: isLight ? cfg.iconBgLight : cfg.iconBgDark, color: cfg.iconColor }}
                >
                    <span className="material-symbols-outlined text-xl font-bold">{icon}</span>
                </div>
            </div>

            {/* Bottom Row: Title on Left, Count Value on Right */}
            <div className="flex items-end justify-between relative z-10">
                <div className="text-xs sm:text-sm font-bold tracking-wide pr-2" style={{ fontFamily: "'Inter', sans-serif", color: cfg.subtextColor }}>
                    {label === "Students" ? "Total Students" : label === "Teachers" ? "Active Teachers" : label === "Batches" ? "Total Batches" : "Pending Approvals"}
                </div>
                <div className="text-4xl sm:text-5xl font-black tracking-tight shrink-0" style={{ fontFamily: "'Manrope', sans-serif", color: cfg.accentColor }}>
                    {value}
                </div>
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

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(""), 4000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(""), 4000);
            return () => clearTimeout(timer);
        }
    }, [error]);

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
            {createPortal(
                <div className="fixed z-50 flex flex-col gap-2 pointer-events-none items-center w-full max-w-md left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 top-20 px-4">
                    {error && (
                        <div className="toast-enter pointer-events-auto p-4 rounded-xl border shadow-lg text-sm flex items-center gap-3 w-full md:w-80"
                             style={{
                                 backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(30, 41, 59, 0.95)',
                                 borderColor: 'rgba(255, 110, 132, 0.3)',
                                 color: isLight ? '#ef4444' : '#ff9dac'
                             }}
                        >
                            <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                            <p className="flex-1 font-medium">{error}</p>
                            <button onClick={() => setError("")} className="ml-2 hover:text-[#ef4444] dark:hover:text-[#ff9dac] transition-colors cursor-pointer">✕</button>
                        </div>
                    )}
                    {message && (
                        <div className="toast-enter pointer-events-auto p-4 rounded-xl border shadow-lg text-sm flex flex-col gap-1 w-full md:w-80"
                             style={{
                                 backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(30, 41, 59, 0.95)',
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
                </div>,
                document.body
            )}

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
            <section 
                className="backdrop-blur-[24px] border rounded-[2.25rem] p-6 md:p-8 space-y-6 relative overflow-hidden transition-all duration-300 shadow-xl"
                style={{
                    background: isLight 
                        ? 'linear-gradient(135deg, rgba(238, 242, 255, 0.85) 0%, rgba(243, 232, 255, 0.85) 50%, rgba(224, 242, 254, 0.85) 100%)' 
                        : 'linear-gradient(135deg, rgba(23, 25, 36, 0.85) 0%, rgba(30, 27, 75, 0.6) 50%, rgba(15, 23, 42, 0.85) 100%)',
                    borderColor: isLight ? 'rgba(199, 210, 254, 0.8)' : 'rgba(99, 102, 241, 0.25)',
                    boxShadow: isLight ? '0 20px 40px -15px rgba(99, 102, 241, 0.12)' : '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
                }}
            >
                <div className="flex items-center gap-3">
                    <div 
                        className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md text-white shrink-0"
                        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)' }}
                    >
                        <span className="material-symbols-outlined text-xl">payments</span>
                    </div>
                    <h3 className="text-xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                        Generate Monthly Payments
                    </h3>
                </div>

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
                        className="flex-1 py-4 text-white font-bold rounded-full shadow-lg shadow-[#3b82f6]/20 active:scale-95 transition-all cursor-pointer bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:shadow-[#3b82f6]/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:brightness-100"
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

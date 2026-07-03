import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, apiFetch, isSystemicError } from "@/lib/api";
import { getYearOptions, getPreviousMonth } from "@/lib/yearOptions";
import { auth } from "@/lib/firebase";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";
import { useAdminTheme } from "@/context/AdminThemeContext";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function ReportExportContent() {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    const { month: prevMonth, year: prevYear } = getPreviousMonth();
    const yearOptions = getYearOptions();

    // We can use the admin_batches cache
    const cacheKeyBatches = "admin_batches";
    const cachedBatches = getCache(cacheKeyBatches);

    const [batches, setBatches] = useState(cachedBatches || []);
    const [batchId, setBatchId] = useState(cachedBatches?.length > 0 ? cachedBatches[0].id : "");
    const [year, setYear] = useState(prevYear);
    const [selectedMonths, setSelectedMonths] = useState([prevMonth]);
    const [reportType, setReportType] = useState("student"); // "student" or "teacher"
    const [loading, setLoading] = useState(!cachedBatches);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Fetch batches — runs once on mount
    useEffect(() => {
        api.get("/api/admin/batches")
            .then((data) => {
                if (JSON.stringify(getCache(cacheKeyBatches)) !== JSON.stringify(data)) {
                    setBatches(data);
                    setCache(cacheKeyBatches, data);
                    if (data.length > 0 && !batchId) {
                        setBatchId(data[0].id);
                    }
                }
            })
            .catch((err) => {
                if (!isSystemicError(err.message)) {
                    setError(err.message);
                }
            })
            .finally(() => setLoading(false));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleMonth = (m) => {
        setSelectedMonths((prev) =>
            prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)
        );
    };

    const selectAllMonths = () => {
        if (selectedMonths.length === 12) {
            setSelectedMonths([]);
        } else {
            setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        }
    };

    const handleExport = async () => {
        if (!batchId) { setError("Please select a batch."); return; }
        if (selectedMonths.length === 0) { setError("Please select at least one month."); return; }

        setExporting(true);
        setError("");
        setSuccess("");

        try {
            // Get auth token
            let token = null;
            if (auth.currentUser) {
                token = await auth.currentUser.getIdToken();
            } else {
                token = localStorage.getItem("idToken");
            }

            const monthsParam = selectedMonths.join(",");
            const url = `${API_BASE}/api/admin/report-export?batch_id=${batchId}&year=${year}&months=${monthsParam}&report_type=${reportType}`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Export failed" }));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }

            // Download the PDF
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);

            // Reconstruct filename locally to bypass browser CORS Content-Disposition blocks
            const batchName = batches.find((b) => b.id === batchId)?.batch_name || "Batch";
            const monthLabels = selectedMonths.map((m) => MONTHS[m - 1]);
            const monthStr = monthLabels.join(" ");
            const safeBatch = batchName;

            let filename = "";
            if (reportType === "teacher") {
                filename = `${monthStr} ${year} - ${safeBatch} - Collection & Distribution Report.pdf`;
            } else {
                filename = `${monthStr} ${year} - ${safeBatch} - Student Payments Report.pdf`;
            }

            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            const monthNames = selectedMonths.map((m) => MONTHS[m - 1]).join(", ");
            const reportName = reportType === "teacher" ? "Collection & Distribution Report" : "Student Payments Report";
            setSuccess(`${reportName} exported: ${batchName} — ${monthNames} ${year}`);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message || "Failed to export report.");
            }
        } finally {
            setExporting(false);
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
            {/* Header - Hidden on mobile as it's in the Sub-Page Header */}
            <div className="mb-6 hidden md:block">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                    Export PDF Reports
                </h1>
            </div>

            {/* Error */}
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

            {/* Success */}
            {success && (
                <div className="mb-4 p-4 rounded-xl border shadow-lg text-sm flex items-center gap-3 animate-fade-in-up"
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

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Step 1: Select Report Type */}
                    <div className="backdrop-blur-[20px] border rounded-[2rem] p-6 shadow-sm"
                        style={{
                            backgroundColor: 'var(--ad-card-bg)',
                            borderColor: 'var(--ad-card-border)'
                        }}
                    >
                        <h3 className="font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                            Report Type
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setReportType("student")}
                                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer text-center border"
                                style={{
                                    backgroundColor: reportType === "student"
                                        ? (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(199, 153, 255, 0.1)')
                                        : 'var(--ad-icon-bg)',
                                    borderColor: reportType === "student"
                                        ? (isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(199, 153, 255, 0.25)')
                                        : 'var(--ad-input-border)',
                                    color: reportType === "student"
                                        ? (isLight ? '#0d9488' : '#c799ff')
                                        : 'var(--ad-text-secondary)'
                                }}
                            >
                                Student Payments
                            </button>
                            <button
                                onClick={() => setReportType("teacher")}
                                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer text-center border"
                                style={{
                                    backgroundColor: reportType === "teacher"
                                        ? (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(199, 153, 255, 0.1)')
                                        : 'var(--ad-icon-bg)',
                                    borderColor: reportType === "teacher"
                                        ? (isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(199, 153, 255, 0.25)')
                                        : 'var(--ad-input-border)',
                                    color: reportType === "teacher"
                                        ? (isLight ? '#0d9488' : '#c799ff')
                                        : 'var(--ad-text-secondary)'
                                }}
                            >
                                Collection & Distribution
                            </button>
                        </div>
                    </div>

                    {/* Step 2: Select Batch */}
                    <div className="backdrop-blur-[20px] border rounded-[2rem] p-6 shadow-sm"
                        style={{
                            backgroundColor: 'var(--ad-card-bg)',
                            borderColor: 'var(--ad-card-border)'
                        }}
                    >
                        <h3 className="font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                            Select Batch
                        </h3>
                        <div className="relative z-20">
                            <ModernSelect
                                value={batchId}
                                onChange={(e) => setBatchId(e.target.value)}
                                options={[{ id: "", batch_name: "Select Batch" }, ...batches]}
                                placeholder="Select Batch"
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-colors"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Step 3: Select Year */}
                    <div className="backdrop-blur-[20px] border rounded-[2rem] p-6 shadow-sm"
                        style={{
                            backgroundColor: 'var(--ad-card-bg)',
                            borderColor: 'var(--ad-card-border)'
                        }}
                    >
                        <h3 className="font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                            Select Year
                        </h3>
                        <div className="relative z-10">
                            <ModernSelect
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                options={yearOptions}
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ad-primary)]/50 transition-colors"
                                style={{
                                    backgroundColor: 'var(--ad-input-bg)',
                                    borderColor: 'var(--ad-input-border)',
                                    color: 'var(--ad-text-primary)'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Step 3: Select Month(s) */}
                <div className="backdrop-blur-[20px] border rounded-[2rem] p-6 shadow-sm"
                    style={{
                        backgroundColor: 'var(--ad-card-bg)',
                        borderColor: 'var(--ad-card-border)'
                    }}
                >
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                            Select Month(s)
                        </h3>
                        <button
                            onClick={selectAllMonths}
                            className="text-xs transition-colors cursor-pointer font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border"
                            style={{
                                backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)',
                                borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)',
                                color: isLight ? '#0d9488' : '#4af8e3'
                            }}
                        >
                            {selectedMonths.length === 12 ? "Deselect All" : "Select All"}
                        </button>
                    </div>
                    <p className="text-xs font-medium mb-6" style={{ color: 'var(--ad-text-secondary)' }}>Each month will act as a separate page in the generated PDF</p>

                    <div className="flex flex-wrap gap-3 mb-4">
                        {MONTHS.map((m, i) => {
                            const monthNum = i + 1;
                            const isSelected = selectedMonths.includes(monthNum);
                            return (
                                <button
                                    key={monthNum}
                                    onClick={() => toggleMonth(monthNum)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 cursor-pointer border"
                                    style={{
                                        backgroundColor: isSelected
                                            ? (isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)')
                                            : 'var(--ad-icon-bg)',
                                        borderColor: isSelected
                                            ? (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)')
                                            : 'var(--ad-input-border)',
                                        color: isSelected
                                            ? (isLight ? '#0d9488' : '#4af8e3')
                                            : 'var(--ad-text-secondary)'
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        {isSelected && <span className="material-symbols-outlined text-[16px]">check</span>}
                                        {m.slice(0, 3)}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Export Button */}
                <div>
                    <button
                        onClick={handleExport}
                        disabled={exporting || !batchId || selectedMonths.length === 0}
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-3 group border"
                        style={{
                            backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(74, 248, 227, 0.1)',
                            borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)',
                            color: isLight ? '#0d9488' : '#4af8e3'
                        }}
                    >
                        {exporting ? (
                            <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: isLight ? '#0d9488' : '#4af8e3' }} />
                        ) : (
                            <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">picture_as_pdf</span>
                        )}
                        {exporting ? "Generating PDF..." : "Export Report"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ReportExport() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <ReportExportContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

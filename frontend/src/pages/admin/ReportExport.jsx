import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, apiFetch, isSystemicError } from "@/lib/api";
import { getYearOptions } from "@/lib/yearOptions";
import { auth } from "@/lib/firebase";
import ModernSelect from "@/components/ModernSelect";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function ReportExportContent() {
    const now = new Date();
    
    // We can use the admin_batches cache
    const cacheKeyBatches = "admin_batches";
    const cachedBatches = getCache(cacheKeyBatches);

    const [batches, setBatches] = useState(cachedBatches || []);
    const [batchId, setBatchId] = useState(cachedBatches?.length > 0 ? cachedBatches[0].id : "");
    const [year, setYear] = useState(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState([now.getMonth() + 1]);
    const [loading, setLoading] = useState(!cachedBatches);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const yearOptions = getYearOptions();

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
            const url = `${API_BASE}/api/admin/report-export?batch_id=${batchId}&year=${year}&months=${monthsParam}`;

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

            // Extract filename from Content-Disposition header
            const disposition = res.headers.get("Content-Disposition");
            let filename = "report.pdf";
            if (disposition) {
                const match = disposition.match(/filename=(.+)/);
                if (match) filename = match[1].replace(/"/g, "");
            }

            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            const batchName = batches.find((b) => b.id === batchId)?.batch_name || "Batch";
            const monthNames = selectedMonths.map((m) => MONTHS[m - 1]).join(", ");
            setSuccess(`Report exported: ${batchName} — ${monthNames} ${year}`);
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

    const selectedBatch = batches.find((b) => b.id === batchId);

    return (
        <div className="space-y-6">
            {/* Header - Hidden on mobile as it's in the Sub-Page Header */}
            <div className="mb-6 hidden md:block">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#f0f0fd] tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Report Export
                </h1>
                <p className="text-[#aaaab7] text-sm mt-1 font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Export Collection & Distribution report as PDF
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#ff6e84]/30 shadow-lg text-[#ff9dac] text-sm flex items-center gap-3 animate-fade-in-up">
                    <span className="material-symbols-outlined text-[#ff6e84]">error</span>
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                </div>
            )}

            {/* Success */}
            {success && (
                <div className="mb-4 p-4 rounded-xl bg-[#171924]/80 backdrop-blur-[20px] border border-[#4af8e3]/30 shadow-lg text-[#dcfff8] text-sm flex items-center gap-3 animate-fade-in-up">
                    <span className="material-symbols-outlined text-[#4af8e3]">check_circle</span>
                    <span className="flex-1">{success}</span>
                    <button onClick={() => setSuccess("")} className="ml-2 hover:text-white transition-colors cursor-pointer">✕</button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {/* Step 1: Select Batch */}
                <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 transition-colors hover:bg-[#171924]/80">
                    <h3 className="text-[#f0f0fd] font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Select Batch
                    </h3>
                    <div className="relative z-20">
                        <ModernSelect
                            value={batchId}
                            onChange={(e) => setBatchId(e.target.value)}
                            options={[{ id: "", batch_name: "Select Batch" }, ...batches]}
                            placeholder="Select Batch"
                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4af8e3]/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Step 2: Select Year */}
                <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 transition-colors hover:bg-[#171924]/80">
                    <h3 className="text-[#f0f0fd] font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Select Year
                    </h3>
                    <div className="relative z-10">
                        <ModernSelect
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            options={yearOptions}
                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#222532]/50 border border-[#464752]/50 hover:border-[#464752] text-[#f0f0fd] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4af8e3]/50 transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* Step 3: Select Month(s) */}
            <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 mb-8 transition-colors hover:bg-[#171924]/80">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-[#f0f0fd] font-bold flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Select Month(s)
                    </h3>
                    <button
                        onClick={selectAllMonths}
                        className="text-xs text-[#4af8e3] hover:text-white transition-colors cursor-pointer font-bold uppercase tracking-widest bg-[#4af8e3]/10 px-3 py-1.5 rounded-lg border border-[#4af8e3]/30"
                    >
                        {selectedMonths.length === 12 ? "Deselect All" : "Select All"}
                    </button>
                </div>
                <p className="text-[#aaaab7] text-xs font-medium mb-6">Each month will act as a separate page in the generated PDF</p>

                <div className="flex flex-wrap gap-3 mb-4">
                    {MONTHS.map((m, i) => {
                        const monthNum = i + 1;
                        const isSelected = selectedMonths.includes(monthNum);
                        return (
                            <button
                                key={monthNum}
                                onClick={() => toggleMonth(monthNum)}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 cursor-pointer
                                    ${isSelected
                                        ? "bg-[#4af8e3]/10 text-[#4af8e3] border border-[#4af8e3]/50 shadow-[0_4px_15px_rgba(74,248,227,0.15)]"
                                        : "bg-[#222532]/50 border border-[#464752]/50 text-[#aaaab7] hover:border-[#464752] hover:bg-[#222532]/80"
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    {isSelected && <span className="material-symbols-outlined text-[16px]">check</span>}
                                    {m.slice(0, 3)}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {selectedMonths.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2 pt-5 border-t border-[#464752]/30">
                        <span className="text-xs text-[#aaaab7] w-full mb-1 font-bold tracking-widest uppercase">Selected:</span>
                        {selectedMonths.map((m) => (
                            <span key={m} className="px-3 py-1 rounded-lg bg-[#4af8e3]/10 border border-[#4af8e3]/30 text-[#4af8e3] text-[11px] font-bold tracking-widest uppercase">
                                {MONTHS[m - 1]}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Export Button */}
            <div>
                <button
                    onClick={handleExport}
                    disabled={exporting || !batchId || selectedMonths.length === 0}
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-widest transition-all duration-300
                        bg-[#4af8e3]/10 text-[#4af8e3] border border-[#4af8e3]/30 hover:bg-[#4af8e3]/20 hover:border-[#4af8e3]/50 shadow-[0_4px_15px_rgba(74,248,227,0.15)]
                        disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-3 group"
                >
                    {exporting ? (
                        <span className="w-5 h-5 rounded-full border-2 border-[#4af8e3]/30 border-t-[#4af8e3] animate-spin" />
                    ) : (
                        <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">picture_as_pdf</span>
                    )}
                    {exporting ? "Generating PDF..." : "Export PDF Report"}
                </button>
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

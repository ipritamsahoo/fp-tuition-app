import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { api, apiFetch, isSystemicError } from "@/lib/api";
import { getYearOptions, getPreviousMonth } from "@/lib/yearOptions";
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
    const { month: prevMonth, year: prevYear } = getPreviousMonth();
    const yearOptions = getYearOptions();

    // We can use the admin_batches cache
    const cacheKeyBatches = "admin_batches";
    const cachedBatches = getCache(cacheKeyBatches);

    const [activeTab, setActiveTab] = useState("pdf"); // "pdf" or "backup"
    const [batches, setBatches] = useState(cachedBatches || []);
    const [batchId, setBatchId] = useState(cachedBatches?.length > 0 ? cachedBatches[0].id : "");
    const [year, setYear] = useState(prevYear);
    const [selectedMonths, setSelectedMonths] = useState([prevMonth]);
    const [reportType, setReportType] = useState("student"); // "student" or "teacher"
    const [loading, setLoading] = useState(!cachedBatches);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Database Backup Tab State
    const [lastBackupTime, setLastBackupTime] = useState(null);
    const [fetchingBackupInfo, setFetchingBackupInfo] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [restoring, setRestoring] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);

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

        fetchBackupInfo();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchBackupInfo = () => {
        setFetchingBackupInfo(true);
        api.get("/api/admin/backup/info")
            .then((res) => {
                setLastBackupTime(res.last_backup_time);
            })
            .catch((err) => {
                console.error("Failed to fetch backup info:", err);
            })
            .finally(() => setFetchingBackupInfo(false));
    };

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
            const monthStr = monthLabels.join("-");
            const safeBatch = batchName.replace(/\s+/g, "_");

            let filename = "";
            if (reportType === "teacher") {
                filename = `${monthStr}_${year}_${safeBatch}_collection_and_distribution.pdf`;
            } else {
                filename = `${monthStr}_${year}_${safeBatch}_student_payments_report.pdf`;
            }

            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            const monthNames = selectedMonths.map((m) => MONTHS[m - 1]).join(", ");
            const reportName = reportType === "teacher" ? "Teacher Report" : "Student Report";
            setSuccess(`${reportName} exported: ${batchName} — ${monthNames} ${year}`);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message || "Failed to export report.");
            }
        } finally {
            setExporting(false);
        }
    };

    const handleDownloadBackup = async (mode) => {
        setDownloading(true);
        setError("");
        setSuccess("");

        try {
            let token = null;
            if (auth.currentUser) {
                token = await auth.currentUser.getIdToken();
            } else {
                token = localStorage.getItem("idToken");
            }

            const res = await fetch(`${API_BASE}/api/admin/backup/export?mode=${mode}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Export failed" }));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 4)], { type: "application/json" });
            const blobUrl = URL.createObjectURL(blob);

            const now = new Date();
            const dateStr = now.toISOString().split("T")[0];
            const pad = (num) => String(num).padStart(2, '0');
            const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
            const filename = `firestore_backup_${mode}_${dateStr}_${timeStr}.json`;

            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            setSuccess(`Database ${mode} backup downloaded successfully!`);
            fetchBackupInfo();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message || "Failed to download backup.");
            }
        } finally {
            setDownloading(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleRestoreSubmit = (e) => {
        e.preventDefault();
        if (!selectedFile) return;
        setShowRestoreModal(true);
    };

    const handleConfirmRestore = async () => {
        if (!selectedFile) return;
        setRestoring(true);
        setError("");
        setSuccess("");
        setShowRestoreModal(false);

        try {
            const formData = new FormData();
            formData.append("file", selectedFile);

            let token = null;
            if (auth.currentUser) {
                token = await auth.currentUser.getIdToken();
            } else {
                token = localStorage.getItem("idToken");
            }

            const res = await fetch(`${API_BASE}/api/admin/backup/import`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Restore failed" }));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }

            const result = await res.json();
            setSuccess(result.message || "Database restored successfully!");
            setSelectedFile(null);
            // Reset file input element manually
            const fileInput = document.getElementById("backup-file-input");
            if (fileInput) fileInput.value = "";
            fetchBackupInfo();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message || "Failed to restore database.");
            }
        } finally {
            setRestoring(false);
        }
    };

    const formatBackupTime = (ts) => {
        if (!ts) return "Never";
        try {
            const date = new Date(ts);
            return date.toLocaleString();
        } catch (e) {
            return ts;
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
                    Export & Backup Manager
                </h1>
                <p className="text-[#aaaab7] text-sm mt-1 font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Export PDF Reports or manage Firestore Database Backups
                </p>
            </div>

            {/* Tab control */}
            <div className="flex items-center gap-1 p-1 bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab("pdf")}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center gap-2
                        ${activeTab === "pdf"
                            ? "bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 shadow-[0_0_15px_rgba(199,153,255,0.15)]"
                            : "text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 border border-transparent"}`}
                >
                    <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                    PDF Reports
                </button>
                <button
                    onClick={() => setActiveTab("backup")}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center gap-2
                        ${activeTab === "backup"
                            ? "bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 shadow-[0_0_15px_rgba(199,153,255,0.15)]"
                            : "text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 border border-transparent"}`}
                >
                    <span className="material-symbols-outlined text-[16px]">database</span>
                    Database Backup
                </button>
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

            {/* TAB: PDF REPORTS */}
            {activeTab === "pdf" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

                        {/* Step 3: Select Report Type */}
                        <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 transition-colors hover:bg-[#171924]/80">
                            <h3 className="text-[#f0f0fd] font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                Report Type
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setReportType("student")}
                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer text-center border
                                        ${reportType === "student"
                                            ? "bg-[#c799ff]/10 text-[#c799ff] border-[#c799ff]/50 shadow-[0_0_15px_rgba(199,153,255,0.15)]"
                                            : "bg-[#222532]/50 border-[#464752]/50 text-[#aaaab7] hover:border-[#464752]"}`}
                                >
                                    Student Payments
                                </button>
                                <button
                                    onClick={() => setReportType("teacher")}
                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer text-center border
                                        ${reportType === "teacher"
                                            ? "bg-[#c799ff]/10 text-[#c799ff] border-[#c799ff]/50 shadow-[0_0_15px_rgba(199,153,255,0.15)]"
                                            : "bg-[#222532]/50 border-[#464752]/50 text-[#aaaab7] hover:border-[#464752]"}`}
                                >
                                    Collection & Distribution
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Select Month(s) */}
                    <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 transition-colors hover:bg-[#171924]/80">
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
                            {exporting ? "Generating PDF..." : "Export Report"}
                        </button>
                    </div>
                </div>
            )}

            {/* TAB: DATABASE BACKUP */}
            {activeTab === "backup" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Downloader Card */}
                        <div className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 flex flex-col justify-between transition-colors hover:bg-[#171924]/80">
                            <div>
                                <h3 className="text-[#f0f0fd] font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    <span className="material-symbols-outlined text-[#4af8e3]">download</span>
                                    Export JSON Backup
                                </h3>
                                <p className="text-[#aaaab7] text-xs font-medium mb-4">
                                    Download a JSON file containing all users, batches, notes, settlements, and payments.
                                </p>
                                <div className="mt-4 p-4 rounded-2xl bg-[#222532]/40 border border-[#464752]/30 flex flex-col gap-1 text-[13px]">
                                    <span className="text-[#aaaab7]">Last Backup Timestamp:</span>
                                    <span className="text-white font-mono font-bold">
                                        {fetchingBackupInfo ? "Fetching..." : formatBackupTime(lastBackupTime)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                <button
                                    onClick={() => handleDownloadBackup("incremental")}
                                    disabled={downloading}
                                    className="flex-1 px-5 py-3.5 rounded-xl bg-[#4af8e3]/10 text-[#4af8e3] border border-[#4af8e3]/30 text-xs font-bold uppercase tracking-widest hover:bg-[#4af8e3]/20 hover:border-[#4af8e3]/50 transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {downloading ? (
                                        <span className="w-4 h-4 rounded-full border-2 border-[#4af8e3]/30 border-t-[#4af8e3] animate-spin" />
                                    ) : (
                                        <span className="material-symbols-outlined text-[16px]">update</span>
                                    )}
                                    Incremental Backup
                                </button>
                                <button
                                    onClick={() => handleDownloadBackup("full")}
                                    disabled={downloading}
                                    className="flex-1 px-5 py-3.5 rounded-xl bg-[#c799ff]/10 text-[#c799ff] border border-[#c799ff]/30 text-xs font-bold uppercase tracking-widest hover:bg-[#c799ff]/20 hover:border-[#c799ff]/50 transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {downloading ? (
                                        <span className="w-4 h-4 rounded-full border-2 border-[#c799ff]/30 border-t-[#c799ff] animate-spin" />
                                    ) : (
                                        <span className="material-symbols-outlined text-[16px]">database</span>
                                    )}
                                    Full Backup
                                </button>
                            </div>
                        </div>

                        {/* Restorer Card */}
                        <form onSubmit={handleRestoreSubmit} className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-6 flex flex-col justify-between transition-colors hover:bg-[#171924]/80">
                            <div>
                                <h3 className="text-[#f0f0fd] font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    <span className="material-symbols-outlined text-[#ff6e84]">upload</span>
                                    Restore from JSON Backup
                                </h3>
                                <p className="text-[#aaaab7] text-xs font-medium mb-4">
                                    Restore database records from a previously downloaded JSON backup file.
                                </p>
                                <div className="mt-4 p-4 rounded-2xl bg-[#ff6e84]/5 border border-[#ff6e84]/20 flex items-center gap-3 text-xs text-[#ff9dac]">
                                    <span className="material-symbols-outlined text-[20px] text-[#ff6e84] shrink-0">warning</span>
                                    <span>
                                        WARNING: Uploading a backup will overwrite matching records in the database.
                                    </span>
                                </div>
                            </div>
                            <div className="mt-6 space-y-4">
                                <input
                                    type="file"
                                    id="backup-file-input"
                                    accept=".json"
                                    onChange={handleFileChange}
                                    required
                                    className="w-full text-xs text-[#aaaab7] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-wider file:bg-white/5 file:text-white hover:file:bg-white/10 file:transition-colors file:cursor-pointer"
                                />
                                <button
                                    type="submit"
                                    disabled={restoring || !selectedFile}
                                    className="w-full px-5 py-3.5 rounded-xl bg-[#ff6e84]/10 text-[#ff6e84] border border-[#ff6e84]/30 text-xs font-bold uppercase tracking-widest hover:bg-[#ff6e84]/20 hover:border-[#ff6e84]/50 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {restoring ? (
                                        <span className="w-4 h-4 rounded-full border-2 border-[#ff6e84]/30 border-t-[#ff6e84] animate-spin" />
                                    ) : (
                                        <span className="material-symbols-outlined text-[16px]">restore</span>
                                    )}
                                    Restore Database
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Restore Confirmation Modal */}
            {showRestoreModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#13151f]/90 backdrop-blur-[20px] rounded-[2rem] p-6 sm:p-8 w-full max-w-md border border-[#ff6e84]/20 shadow-2xl relative animate-fade-in-up">
                        <div className="flex items-center gap-3 text-[#ff6e84] mb-4">
                            <span className="material-symbols-outlined text-[32px]">warning</span>
                            <h3 className="font-extrabold text-xl tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>Confirm Restore</h3>
                        </div>
                        <p className="text-[#aaaab7] text-sm leading-relaxed mb-6">
                            Are you sure you want to restore the database from <span className="text-white font-bold">{selectedFile?.name}</span>? 
                            This will overwrite existing documents with the same IDs. This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3 border-t border-[#464752]/30 pt-4">
                            <button
                                onClick={() => setShowRestoreModal(false)}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-[#aaaab7] hover:text-[#f0f0fd] hover:bg-white/5 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmRestore}
                                className="px-5 py-2.5 rounded-xl bg-[#ff6e84]/15 text-[#ff6e84] border border-[#ff6e84]/30 hover:bg-[#ff6e84]/25 hover:border-[#ff6e84]/50 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                            >
                                Overwrite & Restore
                            </button>
                        </div>
                    </div>
                </div>
            )}
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

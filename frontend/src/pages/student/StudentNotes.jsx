import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import StudentLayout from "@/components/StudentLayout";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { auth } from "@/lib/firebase";

function GlassCard({ children, className = "", style = {} }) {
    return (
        <div
            className={`rounded-[28px] border border-white/[0.07] ${className}`}
            style={{
                background: "var(--st-card-bg, rgba(28, 31, 43, 0.6))",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                ...style,
            }}
        >
            {children}
        </div>
    );
}

function StudentNotesSkeleton() {
    const { theme } = useStudentTheme();
    const isLight = theme === "light";
    const bgStyle = { backgroundColor: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.05)" };

    // Different widths for each card skeleton to make it look like actual dynamic data loading
    const cardStyles = [
        { title: "w-[50%]", filename: "w-[40%]", by: "w-[45%]", date: "w-[30%]" },
        { title: "w-[65%]", filename: "w-[30%]", by: "w-[55%]", date: "w-[25%]" },
        { title: "w-[40%]", filename: "w-[50%]", by: "w-[35%]", date: "w-[35%]" },
        { title: "w-[55%]", filename: "w-[45%]", by: "w-[50%]", date: "w-[28%]" },
    ];

    return (
        <div className="space-y-6 animate-pulse">
            {/* Header */}
            <div>
                <h1
                    className="text-2xl md:text-3xl font-extrabold tracking-tight"
                    style={{ fontFamily: "'Manrope', sans-serif", color: "var(--st-text-primary)" }}
                >
                    Study Notes
                </h1>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cardStyles.map((style, i) => (
                    <GlassCard
                        key={i}
                        className="p-4 flex flex-col justify-between gap-3 border border-white/[0.03]"
                    >
                        {/* Top row */}
                        <div className="flex items-center gap-3">
                            {/* Icon placeholder */}
                            <div
                                className="w-10 h-10 rounded-xl shrink-0"
                                style={bgStyle}
                            />
                            {/* Text lines with exact measured sizes */}
                            <div className="flex-1 space-y-2">
                                {/* Title: text-sm matches h-[14px] */}
                                <div className={`h-[14px] rounded-md ${style.title}`} style={bgStyle} />
                                {/* Filename: text-[10px] matches h-[10px] */}
                                <div className={`h-[10px] rounded-md ${style.filename}`} style={bgStyle} />
                            </div>
                        </div>

                        {/* Divider + Footer */}
                        <div className="border-t border-[var(--st-divider)] pt-3 flex items-center justify-between mt-1">
                            {/* Metadata */}
                            <div className="space-y-2 flex-1 pr-4">
                                {/* By name: text-[10px] matches h-[10px] */}
                                <div className={`h-[10px] rounded-md ${style.by}`} style={bgStyle} />
                                {/* Date: text-[9px] matches h-[8px] */}
                                <div className={`h-[8px] rounded-md ${style.date}`} style={bgStyle} />
                            </div>
                            {/* Download Button placeholder: w-[88px] h-8 matches compact buttons */}
                            <div
                                className="h-8 rounded-xl shrink-0"
                                style={{ width: "88px", ...bgStyle }}
                            />
                        </div>
                    </GlassCard>
                ))}
            </div>
        </div>
    );
}

function StudentNotesContent() {
    const { user } = useAuth();
    const { theme } = useStudentTheme();
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageLoading, setPageLoading] = useState(false);
    const [downloadingNotes, setDownloadingNotes] = useState({});

    const isLight = theme === "light";

    const handleDownload = async (noteId, fileName, e) => {
        e.preventDefault();
        setDownloadingNotes(prev => ({ ...prev, [noteId]: true }));
        try {
            const token = localStorage.getItem("idToken") || (auth.currentUser ? await auth.currentUser.getIdToken() : null);
            const headers = {};
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const response = await fetch(
                `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/notes/${noteId}/download`,
                { headers }
            );

            if (!response.ok) {
                throw new Error("Download request failed");
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = fileName || "note";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error("Download error:", err);
            alert("Failed to download note. Please try again.");
        } finally {
            setDownloadingNotes(prev => ({ ...prev, [noteId]: false }));
        }
    };

    const fetchNotes = useCallback(async (page = 1) => {
        const batchId = user?.batchId;
        if (!batchId) {
            setLoading(false);
            return;
        }

        if (page === 1) setLoading(true);
        else setPageLoading(true);
        setError("");
        try {
            const response = await api.get(`/api/notes/batch/${batchId}?page=${page}&limit=4`);
            setNotes(response.notes || []);
            setTotalPages(response.total_pages || 1);
            setCurrentPage(response.current_page || 1);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message || "Failed to fetch study notes");
            }
        } finally {
            setLoading(false);
            setPageLoading(false);
        }
    }, [user?.batchId]);

    useEffect(() => {
        if (user?.batchId) {
            fetchNotes(1);
        } else {
            setLoading(false);
        }
    }, [user?.batchId, fetchNotes]);

    const getFileIcon = (filename) => {
        if (!filename) return "insert_drive_file";
        const ext = filename.split('.').pop().toLowerCase();
        if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"].includes(ext)) return "image";
        if (ext === "pdf") return "picture_as_pdf";
        if (["doc", "docx"].includes(ext)) return "description";
        if (["xls", "xlsx", "csv"].includes(ext)) return "table_chart";
        if (["ppt", "pptx"].includes(ext)) return "slideshow";
        if (["txt", "md"].includes(ext)) return "article";
        if (["zip", "rar", "7z"].includes(ext)) return "folder_zip";
        return "insert_drive_file";
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        try {
            const date = new Date(dateStr);
            return date.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
            });
        } catch (e) {
            return "";
        }
    };

    if (loading) {
        return <StudentNotesSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1
                    className="text-2xl md:text-3xl font-extrabold tracking-tight"
                    style={{ fontFamily: "'Manrope', sans-serif", color: "var(--st-text-primary)" }}
                >
                    Study Notes
                </h1>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 rounded-2xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] text-sm">
                    {error}
                </div>
            )}

            {/* Content list */}
            {!user?.batchId ? (
                <GlassCard className="p-16 flex flex-col items-center justify-center text-center gap-4">
                    <span className="material-symbols-outlined text-5xl text-[var(--st-text-secondary)]">warning</span>
                    <h3 className="font-bold text-lg" style={{ fontFamily: "'Manrope', sans-serif", color: "var(--st-text-primary)" }}>
                        No Batch Assigned
                    </h3>
                    <p className="text-[var(--st-text-secondary)] text-sm max-w-xs">
                        You need to be assigned to a batch to see study notes. Please contact your teacher.
                    </p>
                </GlassCard>
            ) : notes.length === 0 ? (
                <div className="p-16 flex flex-col items-center justify-center text-center gap-4">
                    <span className="material-symbols-outlined text-5xl text-[var(--st-text-secondary)]">edit_document</span>
                    <h3 className="font-bold text-lg" style={{ fontFamily: "'Manrope', sans-serif", color: "var(--st-text-primary)" }}>
                        No Notes Shared Yet
                    </h3>
                    <p className="text-[var(--st-text-secondary)] text-sm max-w-xs">
                        Your teacher hasn't shared any notes yet.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-200 ${pageLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        {notes.map((note) => (
                            <GlassCard
                                key={note.id}
                                className="p-4 flex flex-col justify-between gap-3 hover:border-[#3b82f6]/20 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    {/* File Type Icon */}
                                    <div className="w-10 h-10 rounded-xl bg-[var(--st-icon-bg)] flex items-center justify-center text-[var(--st-text-secondary)] shrink-0">
                                        <span className="material-symbols-outlined text-xl">
                                            {getFileIcon(note.file_name)}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3
                                            className="font-bold truncate text-sm leading-snug"
                                            style={{ color: "var(--st-text-primary)" }}
                                        >
                                            {note.title}
                                        </h3>
                                        <p className="text-[10px] text-[var(--st-text-secondary)]/70 mt-0.5 truncate">
                                            {note.file_name}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer info & Action button */}
                                <div className="flex items-center justify-between border-t border-[var(--st-divider)] pt-3">
                                    <div className="text-[10px] text-[var(--st-text-secondary)] leading-tight min-w-0 flex-1 pr-2">
                                        <p className="font-semibold text-[var(--st-text-primary)] truncate">By {note.uploaded_by_name}</p>
                                        <p className="text-[9px] text-[var(--st-text-secondary)]/80 mt-0.5">{formatDate(note.created_at)}</p>
                                    </div>

                                    <button
                                        onClick={(e) => handleDownload(note.id, note.file_name, e)}
                                        disabled={downloadingNotes[note.id]}
                                        className="relative overflow-hidden px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0 disabled:cursor-not-allowed"
                                        style={{
                                            backgroundColor: isLight ? "#0d9488" : "#3b82f6",
                                            color: "#ffffff",
                                            border: "none",
                                            boxShadow: isLight
                                                ? "0 2px 8px rgba(13,148,136,0.15)"
                                                : "0 2px 8px rgba(59,130,246,0.2)",
                                        }}
                                    >
                                        {downloadingNotes[note.id] && (
                                            <div className="wave-container">
                                                <div className="wave-layer one" />
                                                <div className="wave-layer two" />
                                            </div>
                                        )}
                                        <span className="relative z-10 flex items-center gap-1.5">
                                            {downloadingNotes[note.id] ? (
                                                <>
                                                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                                                        <g className="animate-spin" style={{ transformOrigin: '12px 12px', animationDuration: '2s' }}>
                                                            <circle 
                                                                cx="12" 
                                                                cy="12" 
                                                                r="9" 
                                                                stroke="currentColor" 
                                                                strokeWidth="2" 
                                                                strokeDasharray="3 3" 
                                                            />
                                                        </g>
                                                        <path 
                                                            d="M12 6V16M12 16L8 12M12 16L16 12" 
                                                            stroke="currentColor" 
                                                            strokeWidth="2" 
                                                            strokeLinecap="round" 
                                                            strokeLinejoin="round" 
                                                        />
                                                    </svg>
                                                    Downloading...
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-sm">download</span>
                                                    Get Note
                                                </>
                                            )}
                                        </span>
                                    </button>
                                </div>
                            </GlassCard>
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                                onClick={() => fetchNotes(currentPage - 1)}
                                disabled={currentPage === 1 || pageLoading}
                                className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                style={{
                                    backgroundColor: 'var(--st-icon-bg)',
                                    borderColor: 'var(--st-input-border)',
                                    color: 'var(--st-text-primary)'
                                }}
                            >
                                <span className="material-symbols-outlined text-base">chevron_left</span>
                            </button>

                            {(() => {
                                const pages = [];
                                const delta = 1; // pages to show around current
                                const left = currentPage - delta;
                                const right = currentPage + delta;
                                let lastPushed = 0;

                                for (let p = 1; p <= totalPages; p++) {
                                    if (p === 1 || p === totalPages || (p >= left && p <= right)) {
                                        if (lastPushed && p - lastPushed > 1) {
                                            pages.push('...' + p); // ellipsis key
                                        }
                                        pages.push(p);
                                        lastPushed = p;
                                    }
                                }

                                return pages.map((item) => {
                                    if (typeof item === 'string') {
                                        return (
                                            <span
                                                key={item}
                                                className="w-9 h-9 flex items-center justify-center text-xs font-bold"
                                                style={{ color: 'var(--st-text-secondary)' }}
                                            >
                                                ···
                                            </span>
                                        );
                                    }
                                    const isActive = currentPage === item;
                                    return (
                                        <button
                                            key={item}
                                            onClick={() => fetchNotes(item)}
                                            disabled={pageLoading}
                                            className="w-9 h-9 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95"
                                            style={{
                                                backgroundColor: isActive
                                                    ? (isLight ? '#0d9488' : '#3b82f6')
                                                    : 'var(--st-icon-bg)',
                                                color: isActive ? '#ffffff' : 'var(--st-text-primary)',
                                                border: isActive
                                                    ? `1px solid ${isLight ? '#0d9488' : '#3b82f6'}`
                                                    : '1px solid var(--st-input-border)',
                                                boxShadow: isActive
                                                    ? (isLight ? '0 4px 12px rgba(13,148,136,0.3)' : '0 4px 12px rgba(59,130,246,0.3)')
                                                    : 'none'
                                            }}
                                        >
                                            {item}
                                        </button>
                                    );
                                });
                            })()}

                            <button
                                onClick={() => fetchNotes(currentPage + 1)}
                                disabled={currentPage === totalPages || pageLoading}
                                className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                style={{
                                    backgroundColor: 'var(--st-icon-bg)',
                                    borderColor: 'var(--st-input-border)',
                                    color: 'var(--st-text-primary)'
                                }}
                            >
                                <span className="material-symbols-outlined text-base">chevron_right</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function StudentNotes() {
    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <StudentLayout>
                <StudentNotesContent />
            </StudentLayout>
        </ProtectedRoute>
    );
}

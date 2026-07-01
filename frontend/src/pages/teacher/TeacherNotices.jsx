import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import ModernSelect from "@/components/ModernSelect";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useTeacherTheme } from "@/context/TeacherThemeContext";
import { TeacherNoticesPageSkeleton, TeacherNoticesSkeleton } from "@/components/Skeletons";

function GlassCard({ children, className = "", style = {}, ...props }) {
    return (
        <div
            className={`rounded-[24px] border ${className}`}
            style={{
                background: "var(--tt-card-bg, rgba(28, 31, 43, 0.6))",
                borderColor: "var(--tt-card-border, rgba(255, 255, 255, 0.07))",
                boxShadow: "var(--tt-card-shadow)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                ...style,
            }}
            {...props}
        >
            {children}
        </div>
    );
}

function NoticeCard({ notice, user, onDelete, onLike, deletingId, formatDateTime }) {
    const { theme } = useTeacherTheme();
    const isLight = theme === "light";

    const [showReaders, setShowReaders] = useState(false);

    const studentReaders = (notice.readers || []).filter(r => r.uid !== notice.published_by);
    const isOwner = notice.published_by === user.uid;

    return (
        <GlassCard 
            className="p-5 flex flex-col gap-3 relative overflow-hidden group shadow-md transition-all hover:bg-white/5"
            style={{
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(28, 31, 43, 0.6)',
                borderColor: isLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.07)',
            }}
        >
            {/* Accent left line for important notices */}
            {notice.is_important && (
                <div 
                    className="absolute top-0 left-0 bottom-0 w-1 rounded-l-2xl" 
                    style={{ 
                        backgroundColor: 'var(--tt-primary)', 
                        boxShadow: isLight ? '0 0 10px rgba(37,99,235,0.4)' : '0 0 15px rgba(99,102,241,0.8)' 
                    }}
                />
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                        <span className="font-extrabold text-sm tracking-tight leading-none" style={{ color: 'var(--tt-text-primary)' }}>
                            {notice.published_by_name}
                        </span>
                        {notice.is_important && (
                            <span 
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0"
                                style={{ backgroundColor: 'var(--tt-accent-bg)', borderColor: 'var(--tt-logo-border)', color: 'var(--tt-primary)' }}
                            >
                                <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                                Important
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] mt-1 block" style={{ color: 'var(--tt-text-secondary)' }}>
                        {formatDateTime(notice.created_at)}
                    </span>
                </div>

                {/* Delete Button */}
                {isOwner && (
                    <button
                        onClick={() => onDelete(notice.id)}
                        disabled={deletingId === notice.id}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
                        style={{ color: 'var(--tt-error)', backgroundColor: 'var(--tt-hover-bg)' }}
                        title="Delete Notice"
                    >
                        <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                )}
            </div>

            {/* Content Body */}
            <p className="text-sm leading-relaxed whitespace-pre-wrap select-text pl-1" style={{ color: 'var(--tt-text-primary)' }}>
                {notice.content}
            </p>

            {/* Footer Row */}
            {isOwner && (
                <div className="flex items-center gap-4 pt-3 mt-1 border-t" style={{ borderTopColor: 'var(--tt-divider)' }}>
                    {/* Seen By Count */}
                    <div 
                        onClick={() => setShowReaders(!showReaders)}
                        className="text-[10px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors select-none"
                        style={{ color: 'var(--tt-text-secondary)' }}
                    >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        <span>Seen by {studentReaders.length}</span>
                        <span className="material-symbols-outlined text-xs transition-transform duration-200" style={{ transform: showReaders ? "rotate(180deg)" : "none" }}>
                            expand_more
                        </span>
                    </div>
                </div>
            )}

            {/* Readers Dropdown List */}
            {isOwner && showReaders && (
                <div className="mt-2 rounded-xl p-3 space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar animate-fade-in border" style={{ backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)' }}>
                    {studentReaders.length === 0 ? (
                        <p className="text-[10px] italic" style={{ color: 'var(--tt-text-secondary)', opacity: 0.5 }}>No student acknowledgments yet</p>
                    ) : (
                        studentReaders.map((reader, index) => (
                            <div key={index} className="flex justify-between items-center text-[10px]">
                                <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--tt-text-primary)' }}>
                                    {reader.name}
                                    {reader.role === "teacher" && (
                                        <span 
                                            className="text-[8px] px-1.5 py-0.5 rounded-md font-bold border shrink-0"
                                            style={{ backgroundColor: 'var(--tt-accent-bg)', borderColor: 'var(--tt-logo-border)', color: 'var(--tt-primary)' }}
                                        >
                                            Teacher
                                        </span>
                                    )}
                                </span>
                                <span style={{ color: 'var(--tt-text-secondary)', opacity: 0.8 }}>
                                    {formatDateTime(reader.read_at)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </GlassCard>
    );
}

function TeacherNoticesContent() {
    const { user } = useAuth();
    const { theme } = useTeacherTheme();
    const isLight = theme === "light";

    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState("");
    const [notices, setNotices] = useState([]);
    const [batchesLoading, setBatchesLoading] = useState(true);
    const [noticesLoading, setNoticesLoading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [content, setContent] = useState("");
    const [isImportant, setIsImportant] = useState(false);

    const [alertError, setAlertError] = useState("");
    const [alertSuccess, setAlertSuccess] = useState("");
    const [listError, setListError] = useState("");

    const fetchBatches = useCallback(async () => {
        try {
            const data = await api.get("/api/teacher/batches");
            setBatches(data);
        } catch (err) {
            // silent
        } finally {
            setBatchesLoading(false);
        }
    }, []);

    const fetchNotices = useCallback(async (batchId, page = 1) => {
        if (!batchId) return;
        setNoticesLoading(true);
        setListError("");
        try {
            const response = await api.get(`/api/notices/batch/${batchId}?page=${page}&limit=5`);
            setNotices(response.notices || []);
            setTotalPages(response.total_pages || 1);
            setCurrentPage(response.current_page || 1);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setListError(err.message || "Failed to fetch notices");
            }
        } finally {
            setNoticesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBatches();
    }, [fetchBatches]);

    useEffect(() => {
        if (selectedBatch) {
            fetchNotices(selectedBatch, 1);
        } else {
            setNotices([]);
        }
    }, [selectedBatch, fetchNotices]);

    const handlePublish = async (e) => {
        e.preventDefault();
        if (!content.trim() || !selectedBatch) return;

        setPublishing(true);
        setAlertError("");
        setAlertSuccess("");

        try {
            await api.post("/api/notices", {
                batch_id: selectedBatch,
                content: content.trim(),
                is_important: isImportant
            });

            setContent("");
            setIsImportant(false);
            setAlertSuccess("Notice published successfully!");
            fetchNotices(selectedBatch, 1);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setAlertError(err.message || "Failed to publish notice");
            }
        } finally {
            setPublishing(false);
        }
    };

    const handleDeleteNotice = async (noticeId) => {
        if (!window.confirm("Are you sure you want to delete this notice?")) return;
        setDeletingId(noticeId);
        setListError("");
        try {
            await api.delete(`/api/notices/${noticeId}`);
            setNotices(prev => prev.filter(n => n.id !== noticeId));
            if (notices.length === 1 && currentPage > 1) {
                fetchNotices(selectedBatch, currentPage - 1);
            } else {
                fetchNotices(selectedBatch, currentPage);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setListError(err.message || "Failed to delete notice");
            }
        } finally {
            setDeletingId(null);
        }
    };

    const handleLikeNotice = async (noticeId) => {
        // Liked status is not actively used in teacher portals, but endpoint is supported
        try {
            await api.post(`/api/notices/${noticeId}/like`);
            fetchNotices(selectedBatch, currentPage);
        } catch (err) {
            // silent
        }
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return "";
        try {
            const d = new Date(dateString);
            const rtf = new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short"
            });
            return rtf.format(d);
        } catch {
            return dateString;
        }
    };



    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center md:items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                        Notice Board
                    </h1>
                </div>

                {/* Batch Selector */}
                <div className="w-full sm:w-64 relative z-40 md:mt-10">
                    <ModernSelect
                        value={selectedBatch}
                        options={batches}
                        placeholder="Select Batch"
                        onChange={(e) => {
                            setSelectedBatch(e.target.value);
                            setAlertError("");
                            setAlertSuccess("");
                        }}
                        className="w-full"
                        theme={theme}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Left Column: Create Form & Alerts */}
                <div className="md:col-span-5 space-y-4 md:sticky md:top-24">
                    {/* Create Notice Card */}
                    <GlassCard className="p-5 shadow-lg">
                        <h2 className="text-base font-bold tracking-tight mb-4" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                            Publish New Notice
                        </h2>
                        {/* Form Input Area */}
                        <form onSubmit={handlePublish} className="flex flex-col gap-3 w-full animate-fade-in">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                maxLength={500}
                                placeholder="Write a notice..."
                                className="w-full h-24 md:h-40 px-4 py-3 rounded-2xl border text-sm focus:outline-none transition-all leading-relaxed resize-none focus:ring-offset-0 focus:ring-0"
                                style={{ backgroundColor: 'var(--tt-input-bg)', borderColor: 'var(--tt-input-border)', color: 'var(--tt-text-primary)' }}
                            />

                            {/* Toolbar and Submit */}
                            <div className="flex items-center justify-end border-t pt-3 mt-1" style={{ borderTopColor: 'var(--tt-divider)' }}>
                                {/* Publish Button */}
                                <button
                                    type="submit"
                                    disabled={publishing || !selectedBatch || !content.trim()}
                                    className="w-32 h-9 justify-center whitespace-nowrap text-xs font-bold px-4 rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shrink-0"
                                    style={{ backgroundColor: isLight ? '#0d9488' : '#10b981', color: '#ffffff', boxShadow: isLight ? '0 4px 12px rgba(13,148,136,0.2)' : '0 4px 12px rgba(16,185,129,0.2)' }}
                                >
                                    {publishing ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            Publishing...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-sm">send</span>
                                            Publish
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </GlassCard>

                    {/* Error/Success alerts for publishing */}
                    {alertError && (
                        <div className="p-3 text-xs rounded-xl border animate-fade-in" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--tt-error)' }}>
                            {alertError}
                        </div>
                    )}
                    {alertSuccess && (
                        <div className="p-3 text-xs rounded-xl border animate-fade-in" style={{ backgroundColor: isLight ? 'rgba(13, 148, 136, 0.12)' : 'rgba(74, 248, 227, 0.1)', borderColor: isLight ? 'rgba(13, 148, 136, 0.2)' : 'rgba(74, 248, 227, 0.2)', color: isLight ? '#0d9488' : '#4af8e3' }}>
                            {alertSuccess}
                        </div>
                    )}
                </div>

                {/* Right Column: Notices List */}
                <div className="md:col-span-7 space-y-4">
                    {/* Notices List */}
                    {listError && (
                        <div className="p-3 text-xs rounded-xl border animate-fade-in" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--tt-error)' }}>
                            {listError}
                        </div>
                    )}

                    {!selectedBatch ? (
                        <div className="p-16 border rounded-[24px] flex flex-col items-center justify-center text-center gap-3" style={{ borderColor: 'var(--tt-divider)', backgroundColor: 'var(--tt-hover-bg)' }}>
                            <span className="material-symbols-outlined text-4xl opacity-30" style={{ color: 'var(--tt-text-muted)' }}>school</span>
                            <p className="text-xs font-bold" style={{ color: 'var(--tt-text-secondary)' }}>Select a batch to load active notices</p>
                        </div>
                    ) : noticesLoading ? (
                        <TeacherNoticesSkeleton />
                    ) : notices.length === 0 ? (
                        <div className="p-16 border rounded-[24px] flex flex-col items-center justify-center text-center gap-3" style={{ borderColor: 'var(--tt-divider)', backgroundColor: 'var(--tt-hover-bg)' }}>
                            <span className="material-symbols-outlined text-4xl opacity-30" style={{ color: 'var(--tt-text-muted)' }}>campaign</span>
                            <p className="text-xs font-bold" style={{ color: 'var(--tt-text-secondary)' }}>No active notices found in this batch</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {notices.map((notice) => (
                                <NoticeCard
                                    key={notice.id}
                                    notice={notice}
                                    user={user}
                                    onDelete={handleDeleteNotice}
                                    onLike={handleLikeNotice}
                                    deletingId={deletingId}
                                    formatDateTime={formatDateTime}
                                />
                            ))}

                            {/* Pagination Controls */}
                            {selectedBatch && totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t" style={{ borderTopColor: 'var(--tt-divider)', transform: "translateZ(0)", isolation: "isolate" }}>
                                    <button
                                        onClick={() => fetchNotices(selectedBatch, currentPage - 1)}
                                        disabled={currentPage === 1 || noticesLoading}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                        style={{ backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)', color: 'var(--tt-text-secondary)' }}
                                    >
                                        <span className="material-symbols-outlined text-base">chevron_left</span>
                                    </button>

                                    {(() => {
                                        const pages = [];
                                        const delta = 1;
                                        const left = currentPage - delta;
                                        const right = currentPage + delta;
                                        let lastPushed = 0;

                                        for (let p = 1; p <= totalPages; p++) {
                                            if (p === 1 || p === totalPages || (p >= left && p <= right)) {
                                                if (lastPushed && p - lastPushed > 1) {
                                                    pages.push('...' + p);
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
                                                        style={{ color: 'var(--tt-text-muted)' }}
                                                    >
                                                        ···
                                                    </span>
                                                );
                                            }
                                            const isActive = currentPage === item;
                                            return (
                                                <button
                                                    key={item}
                                                    onClick={() => fetchNotices(selectedBatch, item)}
                                                    disabled={notesLoading}
                                                    className="w-9 h-9 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95"
                                                    style={{
                                                        backgroundColor: isActive 
                                                            ? (isLight ? 'rgba(13, 148, 136, 0.15)' : 'rgba(99, 102, 241, 0.15)') 
                                                            : 'var(--tt-hover-bg)',
                                                        color: isActive 
                                                            ? (isLight ? '#0d9488' : '#818cf8') 
                                                            : 'var(--tt-text-secondary)',
                                                        borderColor: isActive 
                                                            ? (isLight ? 'rgba(13, 148, 136, 0.35)' : 'rgba(99, 102, 241, 0.35)') 
                                                            : 'var(--tt-divider)',
                                                        borderWidth: 1,
                                                        borderStyle: 'solid'
                                                    }}
                                                >
                                                    {item}
                                                </button>
                                            );
                                        });
                                    })()}

                                    <button
                                        onClick={() => fetchNotices(selectedBatch, currentPage + 1)}
                                        disabled={currentPage === totalPages || noticesLoading}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                        style={{ backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)', color: 'var(--tt-text-secondary)' }}
                                    >
                                        <span className="material-symbols-outlined text-base">chevron_right</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

export default function TeacherNotices() {
    return (
        <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherLayout>
                <TeacherNoticesContent />
            </TeacherLayout>
        </ProtectedRoute>
    );
}

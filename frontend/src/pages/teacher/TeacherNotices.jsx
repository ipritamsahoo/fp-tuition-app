import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import ModernSelect from "@/components/ModernSelect";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TeacherNoticesPageSkeleton, TeacherNoticesSkeleton } from "@/components/Skeletons";

function GlassCard({ children, className = "", style = {}, ...props }) {
    return (
        <div
            className={`rounded-[24px] border border-white/[0.07] ${className}`}
            style={{
                background: "rgba(28, 31, 43, 0.6)",
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
    const [showReaders, setShowReaders] = useState(false);

    // Filter publisher out of the readers list to only count actual student/teacher viewers
    const studentReaders = (notice.readers || []).filter(r => r.uid !== notice.published_by);
    const isOwner = notice.published_by === user.uid;

    return (
        <GlassCard 
            className="p-5 flex flex-col gap-3 relative overflow-hidden group shadow-md hover:border-white/10 hover:bg-white/[0.04] transition-all"
        >
            {/* Accent left line for important notices */}
            {notice.is_important && (
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#6366f1] rounded-l-2xl shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                        <span className="font-extrabold text-[#f0f0fd] text-sm tracking-tight leading-none">
                            {notice.published_by_name}
                        </span>
                        {notice.is_important && (
                            <span className="inline-flex items-center gap-1 bg-[#6366f1]/15 text-[#a5b4fc] px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-[#6366f1]/25 shrink-0">
                                <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                                Important
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-[#aaaab7] mt-1 block">
                        {formatDateTime(notice.created_at)}
                    </span>
                </div>

                {/* Delete Button */}
                {isOwner && (
                    <button
                        onClick={() => onDelete(notice.id)}
                        disabled={deletingId === notice.id}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#ff6e84]/70 hover:text-[#ff6e84] hover:bg-[#ff6e84]/10 transition-all cursor-pointer disabled:opacity-40"
                        title="Delete Notice"
                    >
                        <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                )}
            </div>

            {/* Content Body */}
            <p className="text-xs text-[#f0f0fd] leading-relaxed whitespace-pre-wrap select-text pl-1">
                {notice.content}
            </p>

            {/* Footer Row */}
            {isOwner && (
                <div className="flex items-center gap-4 border-t border-white/5 pt-3 mt-1">
                    {/* Seen By Count */}
                    <div 
                        onClick={() => setShowReaders(!showReaders)}
                        className="text-[10px] text-[#aaaab7] font-semibold flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors select-none"
                    >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        <span>Seen by {studentReaders.length}</span>
                        <span className={`material-symbols-outlined text-xs transition-transform duration-200 ${showReaders ? "rotate-180" : ""}`}>
                            expand_more
                        </span>
                    </div>
                </div>
            )}

            {/* Readers Dropdown List */}
            {isOwner && showReaders && (
                <div className="mt-2 rounded-xl bg-black/20 border border-white/5 p-3 space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar animate-fade-in">
                    {studentReaders.length === 0 ? (
                        <p className="text-[10px] text-[#aaaab7]/50 italic">No student acknowledgments yet</p>
                    ) : (
                        studentReaders.map((reader, index) => (
                            <div key={index} className="flex justify-between items-center text-[10px]">
                                <span className="font-semibold text-white/90 flex items-center gap-1.5">
                                    {reader.name}
                                    {reader.role === "teacher" && (
                                        <span className="text-[8px] bg-[#6366f1]/15 text-[#a5b4fc] px-1.5 py-0.5 rounded-md font-bold border border-[#6366f1]/25 shrink-0">
                                            Teacher
                                        </span>
                                    )}
                                </span>
                                <span className="text-[#aaaab7]/80">
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
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState("");
    const [notices, setNotices] = useState([]);
    const [batchesLoading, setBatchesLoading] = useState(true);
    const [noticesLoading, setNoticesLoading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Form inputs
    const [content, setContent] = useState("");
    const [isImportant, setIsImportant] = useState(false);

    // Alerts
    const [alertError, setAlertError] = useState("");
    const [alertSuccess, setAlertSuccess] = useState("");
    const [listError, setListError] = useState("");

    const fetchBatches = useCallback(async () => {
        try {
            const data = await api.get("/api/teacher/batches");
            setBatches(data);
        } catch (err) {
            console.error("Failed to load batches", err);
        } finally {
            setBatchesLoading(false);
        }
    }, []);

    const fetchNotices = useCallback(async (batchId, page = 1) => {
        if (!batchId) return;
        setNoticesLoading(true);
        setListError("");
        try {
            const data = await api.get(`/api/notices/batch/${batchId}?page=${page}&limit=5`);
            let noticesList = [];
            if (data && data.notices !== undefined) {
                noticesList = data.notices || [];
                setNotices(noticesList);
                setTotalPages(data.total_pages || 1);
                setCurrentPage(data.current_page || 1);
            } else {
                noticesList = data || [];
                setNotices(noticesList);
                setTotalPages(1);
                setCurrentPage(1);
            }

            // Automatically trigger read marking for any unread notices published by others in the background
            const unreadList = noticesList.filter(n => n.published_by !== user?.uid && (!n.read_by || !n.read_by.includes(user?.uid)));
            if (unreadList.length > 0 && user?.uid) {
                Promise.all(unreadList.map(notice => 
                    api.post(`/api/notices/${notice.id}/read`)
                        .catch(err => console.error(`Failed to mark read notice ${notice.id}`, err))
                ));
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setListError(err.message || "Failed to fetch notices");
            }
        } finally {
            setNoticesLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        if (user?.uid) {
            fetchBatches();
        }
    }, [user?.uid, fetchBatches]);

    useEffect(() => {
        if (selectedBatch) {
            fetchNotices(selectedBatch, 1);
        } else {
            setNotices([]);
            setTotalPages(1);
            setCurrentPage(1);
        }
    }, [selectedBatch, fetchNotices]);

    const handlePublish = async (e) => {
        e.preventDefault();
        if (!selectedBatch) {
            setAlertError("Please select a batch first.");
            return;
        }
        if (!content.trim()) {
            setAlertError("Please fill in the notice text.");
            return;
        }

        setPublishing(true);
        setAlertError("");
        setAlertSuccess("");

        try {
            await api.post("/api/notices/", {
                content: content.trim(),
                batch_id: selectedBatch,
                is_important: isImportant
            });
            setAlertSuccess("Notice published successfully!");
            setTimeout(() => {
                setAlertSuccess("");
            }, 2000);
            setContent("");
            setIsImportant(false);
            fetchNotices(selectedBatch, 1);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setAlertError(err.message || "Failed to publish notice.");
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
            fetchNotices(selectedBatch, currentPage);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setListError(err.message || "Failed to delete notice.");
            }
        } finally {
            setDeletingId(null);
        }
    };

    const handleLikeNotice = async (noticeId) => {
        try {
            const res = await api.post(`/api/notices/${noticeId}/like`);
            setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, likes: res.likes } : n));
        } catch (err) {
            console.error("Failed to toggle like on notice", err);
        }
    };

    const formatDateTime = (dateStr) => {
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

    if (batchesLoading) {
        return <TeacherNoticesPageSkeleton />;
    }

    return (
        <div className="w-full pb-20 space-y-6">
            {/* Title Header & Batch Selector */}
            <div className="flex flex-col gap-4 mt-4">
                <div>
                    <h1
                        className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#f0f0fd]"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                        Notice Board
                    </h1>
                </div>

                {/* Batch Selector at the top */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">
                    <div className="md:col-span-5 flex items-center gap-3 shrink-0 w-full">
                        <ModernSelect
                            value={selectedBatch}
                            placeholder="Select a batch"
                            options={batches}
                            onChange={(e) => {
                                setSelectedBatch(e.target.value);
                                setAlertError("");
                                setAlertSuccess("");
                                setListError("");
                            }}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Left Column: Create Form & Alerts */}
                <div className="md:col-span-5 space-y-4 md:sticky md:top-24">
                    {/* Create Notice Card */}
                    <GlassCard className="p-5 shadow-lg">
                        <h2 className="text-base font-bold text-white tracking-tight mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            Publish New Notice
                        </h2>
                        {/* Form Input Area */}
                        <form onSubmit={handlePublish} className="flex flex-col gap-3 w-full animate-fade-in">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                maxLength={500}
                                placeholder="Write a notice..."
                                className="w-full h-24 md:h-40 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 focus:border-[#6366f1]/30 focus:ring-1 focus:ring-[#6366f1]/30 text-white text-sm focus:outline-none transition-all placeholder:text-[#aaaab7]/40 leading-relaxed resize-none"
                            />

                            {/* Toolbar and Submit */}
                            <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-3 mt-1">
                                {/* Publish Button */}
                                <button
                                    type="submit"
                                    disabled={publishing || !selectedBatch || !content.trim()}
                                    className="w-32 h-9 justify-center whitespace-nowrap bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold px-4 rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-emerald-600/20 shrink-0"
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
                        <div className="p-3 text-xs rounded-xl bg-[#ff6e84]/15 border border-[#ff6e84]/20 text-[#ff6e84] animate-fade-in">
                            {alertError}
                        </div>
                    )}
                    {alertSuccess && (
                        <div className="p-3 text-xs rounded-xl bg-[#4af8e3]/15 border border-[#4af8e3]/20 text-[#4af8e3] animate-fade-in">
                            {alertSuccess}
                        </div>
                    )}
                </div>

                {/* Right Column: Notices List */}
                <div className="md:col-span-7 space-y-4">
                    {/* Notices List */}
                    {listError && (
                        <div className="p-3 text-xs rounded-xl bg-[#ff6e84]/15 border border-[#ff6e84]/20 text-[#ff6e84]">
                            {listError}
                        </div>
                    )}

                    {!selectedBatch ? (
                        <div className="p-16 border border-white/5 bg-white/[0.01] rounded-[24px] flex flex-col items-center justify-center text-center gap-3">
                            <span className="material-symbols-outlined text-4xl text-[#aaaab7]/20">school</span>
                            <p className="text-xs font-bold text-[#aaaab7]">Select a batch to load active notices</p>
                        </div>
                    ) : noticesLoading ? (
                        <TeacherNoticesSkeleton />
                    ) : notices.length === 0 ? (
                        <div className="p-16 border border-white/5 bg-white/[0.01] rounded-[24px] flex flex-col items-center justify-center text-center gap-3">
                            <span className="material-symbols-outlined text-4xl text-[#aaaab7]/20">campaign</span>
                            <p className="text-xs font-bold text-[#aaaab7]">No active notices found in this batch</p>
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
                                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-white/5" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                                    <button
                                        onClick={() => fetchNotices(selectedBatch, currentPage - 1)}
                                        disabled={currentPage === 1 || noticesLoading}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 text-[#aaaab7] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 hover:bg-white/10"
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
                                                        style={{ color: '#aaaab7' }}
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
                                                    disabled={noticesLoading}
                                                    className="w-9 h-9 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95"
                                                    style={{
                                                        backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                                        color: isActive ? '#818cf8' : '#aaaab7',
                                                        border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
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
                                        className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 text-[#aaaab7] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 hover:bg-white/10"
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

import { useState, useEffect, useCallback, useRef } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import StudentLayout from "@/components/StudentLayout";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { StudentNoticesSkeleton } from "@/components/Skeletons";

function GlassCard({ children, className = "", style = {}, ...props }) {
    return (
        <div
            className={`rounded-[24px] border border-white/[0.07] ${className}`}
            style={{
                background: "var(--st-card-bg, rgba(28, 31, 43, 0.6))",
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


function StudentNoticeCard({ notice, user, formatDateTime }) {
    const { theme } = useStudentTheme();
    const isLight = theme === "light";
    const isUnread = !notice.read_by || !notice.read_by.includes(user.uid);

    const accentLineClass = isLight
        ? "bg-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.8)]"
        : "bg-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.8)]";

    const newBadgeClass = isLight
        ? "bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.4)]"
        : "bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.4)]";

    return (
        <GlassCard 
            className="p-5 flex flex-col gap-3 relative overflow-hidden group shadow-md hover:border-[#3b82f6]/30 transition-all duration-300"
        >
            {/* Unread glow border overlay or important accent line */}
            {notice.is_important ? (
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#6366f1] rounded-l-2xl shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
            ) : isUnread ? (
                <div className={`absolute top-0 left-0 bottom-0 w-1 animate-pulse ${accentLineClass}`} />
            ) : null}

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                        <span className="font-extrabold text-[#f0f0fd] text-sm tracking-tight leading-none" style={{ color: "var(--st-text-primary)" }}>
                            {notice.published_by_name}
                        </span>
                        {notice.is_important && (
                            <span className="inline-flex items-center gap-1 bg-[#6366f1]/15 text-[#a5b4fc] px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-[#6366f1]/25 shrink-0">
                                <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                                Important
                            </span>
                        )}
                        {isUnread && (
                            <span className={`text-[8px] font-bold uppercase tracking-widest text-white px-1.5 py-0.5 rounded-full animate-pulse shrink-0 ${newBadgeClass}`}>
                                New
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-[#aaaab7] mt-1 block" style={{ color: "var(--st-text-secondary)" }}>
                        {formatDateTime(notice.created_at)}
                    </span>
                </div>
            </div>

            {/* Content Body */}
            <p 
                className="text-xs text-[#f0f0fd] leading-relaxed whitespace-pre-wrap select-text pl-1"
                style={{ color: "var(--st-text-primary)" }}
            >
                {notice.content}
            </p>

        </GlassCard>
    );
}

function StudentNoticesContent() {
    const { user } = useAuth();
    const { theme } = useStudentTheme();
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const isLight = theme === "light";

    const fetchNotices = useCallback(async (page = 1) => {
        const batchId = user?.batchId;
        if (!batchId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");
        try {
            const data = await api.get(`/api/notices/batch/${batchId}?page=${page}&limit=5`);
            let noticesList = [];
            if (data && data.notices !== undefined) {
                noticesList = data.notices || [];
                setTotalPages(data.total_pages || 1);
                setCurrentPage(data.current_page || 1);
            } else {
                noticesList = data || [];
                setTotalPages(1);
                setCurrentPage(1);
            }
            setNotices(noticesList);

            // Automatically trigger read marking for any unread notices in the background
            const unreadList = noticesList.filter(n => !n.read_by || !n.read_by.includes(user.uid));
            if (unreadList.length > 0) {
                Promise.all(unreadList.map(notice => 
                    api.post(`/api/notices/${notice.id}/read`)
                        .catch(err => console.error(`Failed to mark read notice ${notice.id}`, err))
                )).then(() => {
                    // Dispatch custom event to refresh layout counters
                    window.dispatchEvent(new CustomEvent("notices-read"));
                });
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message || "Failed to fetch notices");
            }
        } finally {
            setLoading(false);
        }
    }, [user?.batchId, user?.uid, user?.name]);

    useEffect(() => {
        if (user?.batchId) {
            fetchNotices(1);
        } else {
            setLoading(false);
        }
    }, [user?.batchId, fetchNotices]);


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

    if (loading) {
        return <StudentNoticesSkeleton />;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Error Message */}
            {error && (
                <div className="p-4 rounded-2xl bg-[#ff6e84]/15 border border-[#ff6e84]/20 text-[#ff6e84] text-sm">
                    {error}
                </div>
            )}

            {/* Feed Section Header */}
            <div className="flex items-center justify-between">
                <h2 
                    className="text-base font-bold tracking-tight" 
                    style={{ fontFamily: "'Manrope', sans-serif", color: "var(--st-text-primary)" }}
                >
                    All Notices
                </h2>
            </div>

            {/* Content feed */}
            {!user?.batchId ? (
                <div className="p-16 rounded-[24px] border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-[#aaaab7]/20">warning</span>
                    <h3 className="font-bold text-sm" style={{ color: "var(--st-text-primary)" }}>
                        No Batch Assigned
                    </h3>
                    <p className="text-xs max-w-xs" style={{ color: "var(--st-text-secondary)" }}>
                        You need to be assigned to a batch to see notices. Please contact your teacher.
                    </p>
                </div>
            ) : notices.length === 0 ? (
                <div className="p-16 rounded-[24px] border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-[#aaaab7]/25">campaign</span>
                    <h3 className="font-bold text-sm" style={{ color: "var(--st-text-primary)" }}>
                        No Active Notices
                    </h3>
                    <p className="text-xs max-w-xs" style={{ color: "var(--st-text-secondary)" }}>
                        Your teacher hasn't shared any notices in the last 7 days.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {notices.map((notice) => (
                        <StudentNoticeCard
                            key={notice.id}
                            notice={notice}
                            user={user}
                            formatDateTime={formatDateTime}
                        />
                    ))}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-white/5" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                            <button
                                onClick={() => fetchNotices(currentPage - 1)}
                                disabled={currentPage === 1 || loading}
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
                                            onClick={() => fetchNotices(item)}
                                            disabled={loading}
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
                                onClick={() => fetchNotices(currentPage + 1)}
                                disabled={currentPage === totalPages || loading}
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

export default function StudentNotices() {
    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <StudentLayout>
                <StudentNoticesContent />
            </StudentLayout>
        </ProtectedRoute>
    );
}

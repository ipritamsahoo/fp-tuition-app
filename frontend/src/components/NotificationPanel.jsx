import { useRef, useEffect } from "react";
import { useNotifications } from "@/context/NotificationContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { useTeacherTheme } from "@/context/TeacherThemeContext";
import { useAdminTheme } from "@/context/AdminThemeContext";
import { useAuth } from "@/context/AuthContext";

function getConfig(type, prefix = "--st-") {
    const config = {
        payment_approved: { icon: "✅", accent: "text-emerald-500", bg: "bg-emerald-500/10", label: "Approved" },
        payment_rejected: { icon: "❌", accent: "text-red-500", bg: "bg-red-500/10", label: "Rejected" },
        payment_pending: { icon: "⏳", accent: "text-amber-500", bg: "bg-amber-500/10", label: "Pending" },
        bill_generated: { icon: "💰", accent: "text-blue-500", bg: "bg-blue-500/10", label: "Bill" },
        distribution_settled: { icon: "💸", accent: "text-violet-500", bg: "bg-violet-500/10", label: "Settled" },
        new_approval: { icon: "🔔", accent: "text-cyan-500", bg: "bg-cyan-500/10", label: "New Request" },
    };
    return config[type] || { icon: "🔔", accent: `text-[var(${prefix}text-muted)]`, bg: `bg-[var(${prefix}icon-bg)]`, label: "Alert" };
}

/**
 * Relative time string (e.g., "2m ago", "1h ago", "3d ago").
 */
function timeAgo(dateStr) {
    if (!dateStr) return "";
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Premium notification panel dropdown.
 */
export default function NotificationPanel({ isOpen, onClose }) {
    const { notifications, unreadCount, markRead, markAllRead, dismiss, clearAll } = useNotifications();
    const { user } = useAuth();
    const studentThemeContext = useStudentTheme();
    const teacherThemeContext = useTeacherTheme();
    const adminThemeContext = useAdminTheme();
    
    const isTeacher = user?.role === "teacher";
    const isAdmin = user?.role === "admin";
    
    // Choose appropriate theme
    let theme = "dark";
    if (isTeacher) {
        theme = teacherThemeContext?.theme || "dark";
    } else if (isAdmin) {
        theme = adminThemeContext?.theme || "dark";
    } else {
        theme = studentThemeContext?.theme || "dark";
    }
    const isLight = theme === "light";
    const prefix = isAdmin ? "--ad-" : (isTeacher ? "--tt-" : "--st-");
    const activeColor = isLight ? "#0d9488" : "#3861fb";
    
    const panelRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={panelRef}
            data-theme={theme}
            className="fixed top-16 left-4 right-4 w-auto z-[100] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96 sm:z-50 rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up border"
            style={{ 
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(15, 17, 23, 0.95)',
                borderColor: isLight ? 'rgba(255, 255, 255, 0.65)' : 'rgba(26, 31, 46, 0.6)',
                backdropFilter: 'blur(40px) saturate(2.0)',
                WebkitBackdropFilter: 'blur(40px) saturate(2.0)',
                transform: "translateZ(0)", 
                isolation: "isolate" 
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: `var(${prefix}divider)` }}>
                <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm tracking-tight" style={{ color: `var(${prefix}text-primary)`, fontFamily: "'Manrope', sans-serif" }}>Notifications</h3>
                    {unreadCount > 0 && (
                        <span 
                            className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg"
                            style={{
                                backgroundColor: activeColor,
                                boxShadow: isLight ? '0 4px 12px rgba(13, 148, 136, 0.25)' : '0 4px 12px rgba(56, 97, 251, 0.25)'
                            }}
                        >
                            {unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="text-xs font-bold transition-colors cursor-pointer hover:opacity-85"
                            style={{ color: activeColor }}
                        >
                            Mark all read
                        </button>
                    )}
                    {notifications.some((n) => n.is_read) && (
                        <button
                            onClick={clearAll}
                            className="text-xs font-medium hover:text-red-500 transition-colors cursor-pointer"
                            style={{ color: `var(${prefix}text-muted)` }}
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[400px] overflow-y-auto overscroll-contain custom-scrollbar">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 border" style={{ backgroundColor: `var(${prefix}icon-bg)`, borderColor: `var(${prefix}divider)` }}>
                            <span className="material-symbols-outlined text-3xl" style={{ color: `var(${prefix}text-muted)` }}>notifications_off</span>
                        </div>
                        <p className="font-bold text-sm" style={{ color: `var(${prefix}text-primary)` }}>No notifications yet</p>
                        <p className="text-xs mt-1" style={{ color: `var(${prefix}text-muted)` }}>You're all caught up!</p>
                    </div>
                ) : (
                    notifications.map((n) => {
                        const cfg = getConfig(n.type, prefix);
                        return (
                            <div
                                key={n.id}
                                className={`group flex items-start gap-4 px-6 py-4 transition-all cursor-pointer relative
                                    ${n.is_read ? "opacity-60" : ""}`}
                                style={{ 
                                    borderBottom: `1px solid var(${prefix}divider)`,
                                    backgroundColor: !n.is_read 
                                        ? (isLight ? 'rgba(13, 148, 136, 0.05)' : 'rgba(56, 97, 251, 0.05)') 
                                        : 'transparent'
                                }}
                                onClick={() => !n.is_read && markRead(n.id)}
                            >
                                {/* Active Indicator Bar */}
                                {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: activeColor }} />}

                                {/* Icon */}
                                <div className={`mt-0.5 w-10 h-10 rounded-[14px] ${cfg.bg} ${cfg.accent} flex items-center justify-center text-lg shrink-0 border border-current opacity-80`}>
                                    {cfg.icon}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            {n.title && (
                                                <p className="text-sm font-bold leading-snug truncate mb-0.5" style={{ color: `var(${prefix}text-primary)` }}>
                                                    {n.title}
                                                </p>
                                            )}
                                            <p className={`leading-snug font-medium ${n.title ? "text-xs" : "text-sm"}`} style={{ color: n.title ? `var(${prefix}text-muted)` : `var(${prefix}text-primary)` }}>
                                                {n.message}
                                            </p>
                                        </div>
                                        {/* Dismiss */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                                            style={{ color: `var(${prefix}text-muted)` }}
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${cfg.accent} ${cfg.bg}`} style={{ borderColor: 'currentColor' }}>
                                            {cfg.label}
                                        </span>
                                        <span className="text-[10px] font-medium" style={{ color: `var(${prefix}text-muted)` }}>
                                            {timeAgo(n.created_at)}
                                        </span>
                                        {!n.is_read && (
                                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeColor }} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            
            {/* View All Footer */}
            {notifications.length > 0 && (
                <div className="p-3 text-center border-t" style={{ borderColor: `var(${prefix}divider)` }}>
                    <button onClick={onClose} className="text-[10px] font-bold uppercase tracking-[0.2em] transition-colors cursor-pointer hover:opacity-80" style={{ color: `var(${prefix}text-muted)` }}>
                        Close Panel
                    </button>
                </div>
            )}
        </div>
    );
}

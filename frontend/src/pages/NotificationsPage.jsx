import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";

/**
 * Notification type → icon & color mapping.
 */
const TYPE_CONFIG = {
    payment_approved: { icon: "✅", accent: "text-emerald-500", bg: "bg-emerald-500/10", label: "Approved" },
    payment_rejected: { icon: "❌", accent: "text-red-500", bg: "bg-red-500/10", label: "Rejected" },
    payment_pending: { icon: "⏳", accent: "text-amber-500", bg: "bg-amber-500/10", label: "Pending" },
    bill_generated: { icon: "💰", accent: "text-blue-500", bg: "bg-blue-500/10", label: "Bill" },
    distribution_settled: { icon: "💸", accent: "text-violet-500", bg: "bg-violet-500/10", label: "Settled" },
    new_approval: { icon: "🔔", accent: "text-cyan-500", bg: "bg-cyan-500/10", label: "New Request" },
};

function getConfig(type, prefix = "--st-") {
    return TYPE_CONFIG[type] || { icon: "🔔", accent: `text-[var(${prefix}text-muted)]`, bg: `bg-[var(${prefix}icon-bg)]`, label: "Alert" };
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

export default function NotificationsPage() {
    const navigate = useNavigate();
    const { notifications, unreadCount, markRead, markAllRead, dismiss, clearAll } = useNotifications();
    const { user } = useAuth();
    
    // Determine theme based on user role and local storage since this page is outside the main layout provider
    const [theme, setTheme] = useState("light");
    useEffect(() => {
        if (user?.role === "student") {
            try {
                const savedTheme = localStorage.getItem("fp_student_theme_v2") || "light";
                setTheme(savedTheme);
            } catch (e) {
                setTheme("light");
            }
        } else if (user?.role === "teacher") {
            try {
                const savedTheme = localStorage.getItem("fp_teacher_theme_v2") || "light";
                setTheme(savedTheme);
            } catch (e) {
                setTheme("light");
            }
        } else if (user?.role === "admin") {
            try {
                const savedTheme = localStorage.getItem("fp_admin_theme_v2") || "light";
                setTheme(savedTheme);
            } catch (e) {
                setTheme("light");
            }
        } else {
            setTheme("light");
        }
    }, [user?.role]);

    const isLight = theme === "light";
    const prefix = user?.role === "admin" ? "--ad-" : (user?.role === "teacher" ? "--tt-" : "--st-");
    const activeColor = isLight ? "#0d9488" : "#3b82f6";

    return (
        <div data-theme={theme} className="min-h-screen flex flex-col" style={{ backgroundColor: `var(${prefix}surface)` }}>
            {/* Header */}
            <header 
                className="sticky top-0 z-40 border-b" 
                style={{ 
                    backgroundColor: isLight ? 'rgba(255,255,255,0.4)' : 'rgba(15, 17, 23, 0.85)',
                    borderColor: `var(${prefix}divider)`,
                    backdropFilter: 'blur(32px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
                    transform: "translateZ(0)", isolation: "isolate"
                }}
            >
                <div className="flex items-center px-4 h-16 gap-4">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="w-10 h-10 flex items-center justify-center rounded-2xl transition-all active:scale-90 cursor-pointer border"
                        style={{ backgroundColor: `var(${prefix}icon-bg)`, color: `var(${prefix}text-primary)`, borderColor: `var(${prefix}input-border)` }}
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="font-extrabold text-xl tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: `var(${prefix}text-primary)` }}>Notifications</h1>
                    <div className="ml-auto flex items-center gap-2">
                        {unreadCount > 0 && (
                            <span 
                                className="text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center"
                                style={{
                                    backgroundColor: activeColor,
                                    boxShadow: isLight ? '0 0 10px rgba(13, 148, 136, 0.5)' : '0 0 10px rgba(59, 130, 246, 0.5)'
                                }}
                            >
                                {unreadCount}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {/* Content actions */}
            {notifications.length > 0 && (
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: `var(${prefix}divider)` }}>
                    <div className="text-sm font-bold opacity-60" style={{ color: `var(${prefix}text-secondary)` }}>
                        {notifications.length} {notifications.length === 1 ? 'Notification' : 'Notifications'}
                    </div>
                    <div className="flex items-center gap-4">
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-sm font-bold transition-colors cursor-pointer hover:opacity-85"
                                style={{ color: activeColor }}
                            >
                                Mark all read
                            </button>
                        )}
                        {notifications.some((n) => n.is_read) && (
                            <button
                                onClick={clearAll}
                                className="text-sm font-medium hover:text-red-500 transition-colors cursor-pointer"
                                style={{ color: `var(${prefix}text-muted)` }}
                            >
                                Clear read
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto custom-scrollbar">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 px-6">
                        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 border" style={{ backgroundColor: `var(${prefix}icon-bg)`, borderColor: `var(${prefix}divider)` }}>
                            <span className="material-symbols-outlined text-4xl" style={{ color: `var(${prefix}text-muted)` }}>notifications_off</span>
                        </div>
                        <p className="font-bold text-lg" style={{ color: `var(${prefix}text-primary)` }}>No notifications yet</p>
                        <p className="text-sm mt-1" style={{ color: `var(${prefix}text-muted)` }}>You're all caught up!</p>
                    </div>
                ) : (
                    notifications.map((n) => {
                        const cfg = getConfig(n.type, prefix);
                        return (
                            <div
                                key={n.id}
                                className={`group flex items-start gap-4 px-6 py-5 border-b transition-all cursor-pointer relative
                                    ${n.is_read ? "opacity-60" : ""}`}
                                style={{ 
                                    borderColor: `var(${prefix}divider)`,
                                    backgroundColor: !n.is_read ? (isLight ? 'rgba(13, 148, 136, 0.05)' : 'rgba(56, 97, 251, 0.05)') : 'transparent'
                                }}
                                onClick={() => !n.is_read && markRead(n.id)}
                            >
                                {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: activeColor }} />}

                                {/* Icon */}
                                <div className={`mt-0.5 w-12 h-12 rounded-2xl ${cfg.bg} ${cfg.accent} flex items-center justify-center text-xl shrink-0 border border-current opacity-80`}>
                                    {cfg.icon}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            {n.title && (
                                                <p className="text-sm sm:text-base font-bold leading-snug truncate mb-0.5" style={{ color: `var(${prefix}text-primary)` }}>
                                                    {n.title}
                                                </p>
                                            )}
                                            <p className={`leading-snug font-medium ${n.title ? "text-xs sm:text-sm" : "text-sm sm:text-base font-bold"}`} style={{ color: n.title ? `var(${prefix}text-muted)` : `var(${prefix}text-primary)` }}>
                                                {n.message}
                                            </p>
                                        </div>
                                        {/* Dismiss */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                                            style={{ color: `var(${prefix}text-muted)` }}
                                        >
                                            <span className="material-symbols-outlined text-base">close</span>
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className="text-[10px] sm:text-xs font-bold" style={{ color: `var(${prefix}text-muted)` }}>
                                            {timeAgo(n.created_at)}
                                        </span>
                                        {!n.is_read && (
                                            <span className="w-2 h-2 rounded-full animate-pulse ml-1" style={{ backgroundColor: activeColor }} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            
            {/* Bottom spacing */}
            <div className="h-10"></div>
        </div>
    );
}

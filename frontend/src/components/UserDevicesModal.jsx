import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdminTheme } from "@/context/AdminThemeContext";

export default function UserDevicesModal({ user, onClose, onSessionDeleted }) {
    const { theme } = useAdminTheme();
    const isLight = theme === "light";
    const [deletingId, setDeletingId] = useState(null);
    const [activeSessions, setActiveSessions] = useState(user?.active_sessions || []);

    useEffect(() => {
        const uid = user?.uid || user?.id;
        if (!uid) return;

        const unsub = onSnapshot(doc(db, "users", uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setActiveSessions(data.active_sessions || []);
            }
        });

        return () => unsub();
    }, [user]);

    const handleLogoutSession = async (sessionId) => {
        if (!confirm("Are you sure you want to log out this device?")) return;
        setDeletingId(sessionId);
        try {
            await api.delete(`/api/admin/users/${user.uid || user.id}/sessions/${sessionId}`);
            onSessionDeleted?.();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const getDeviceIcon = (deviceName) => {
        const iconName = (deviceName === "Android" || deviceName === "iOS") ? "smartphone" : "desktop_windows";
        return (
            <span className="material-symbols-outlined" style={{ color: 'var(--ad-primary)' }}>{iconName}</span>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto" onClick={onClose}>
            <div className="w-full max-w-lg rounded-[2.5rem] border shadow-2xl flex flex-col max-h-[85vh] animate-modal-in overflow-hidden m-auto"
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(25, 30, 45, 0.85)',
                    borderColor: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(80px) saturate(2.5)',
                    WebkitBackdropFilter: 'blur(80px) saturate(2.5)',
                    transform: "translateZ(0)",
                    isolation: "isolate"
                }}
            >

                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b relative" style={{ borderColor: 'var(--ad-divider)' }}>
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <h3 className="font-extrabold text-2xl tracking-tight flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                                <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--ad-primary)' }}>devices</span>
                                Active Devices
                            </h3>
                            <p className="text-sm mt-1 font-medium" style={{ color: 'var(--ad-text-secondary)' }}>
                                Sessions for <span className="font-bold" style={{ color: 'var(--ad-primary)' }}>{user.name}</span>
                            </p>
                        </div>
                        <button onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full border transition-all cursor-pointer group"
                            style={{
                                backgroundColor: 'var(--ad-icon-bg)',
                                borderColor: 'var(--ad-divider)',
                                color: 'var(--ad-text-secondary)'
                            }}
                        >
                            <span className="material-symbols-outlined transition-transform group-hover:rotate-90">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6 overflow-y-auto flex-1 custom-scrollbar">
                    {activeSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-16 animate-fade-in">
                            <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 relative"
                                 style={{
                                     backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                                     border: isLight ? '1px solid rgba(13, 148, 136, 0.25)' : '1px solid rgba(199, 153, 255, 0.25)',
                                     color: isLight ? '#0d9488' : '#c799ff'
                                 }}
                            >
                                <span className="material-symbols-outlined text-5xl">devices</span>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border flex items-center justify-center"
                                     style={{
                                         backgroundColor: 'var(--ad-input-bg)',
                                         borderColor: 'var(--ad-divider)'
                                     }}
                                >
                                    <span className="material-symbols-outlined text-sm text-[#ff6e84]">block</span>
                                </div>
                            </div>
                            <p className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>No Active Devices</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeSessions.map((session, idx) => {
                                const dateStr = new Date(session.last_active || session.created_at).toLocaleString('en-IN', {
                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                });
                                return (
                                    <div key={idx}
                                        className="rounded-[2.5rem] p-6 border transition-all group animate-fade-in-up shadow-lg"
                                        style={{
                                            animationDelay: `${idx * 100}ms`,
                                            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.02)',
                                            borderColor: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)'
                                        }}
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 rounded-3xl flex items-center justify-center shrink-0 border transition-all"
                                                 style={{
                                                     backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(199, 153, 255, 0.1)',
                                                     borderColor: isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(199, 153, 255, 0.25)',
                                                     color: isLight ? '#0d9488' : '#c799ff',
                                                     boxShadow: isLight ? '0 0 20px rgba(13,148,136,0.08)' : '0 0 20px rgba(199,153,255,0.15)'
                                                 }}
                                            >
                                                {getDeviceIcon(session.device_name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-base font-bold truncate tracking-wide" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                                                        {session.device_name || "Unknown Device"}
                                                    </span>
                                                </div>
                                                <p className="text-xs mt-1 font-medium flex items-center gap-1" style={{ color: 'var(--ad-text-secondary)' }}>
                                                    <span className="material-symbols-outlined text-[14px]">devices</span>
                                                    {session.platform || "Unknown"}
                                                </p>
                                                <p className="text-[10px] mt-2 font-bold uppercase tracking-tighter flex items-center gap-1" style={{ color: 'var(--ad-text-muted)' }}>
                                                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                    Last active: {dateStr}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-5 flex justify-end">
                                            <button
                                                onClick={() => handleLogoutSession(session.session_id)}
                                                disabled={deletingId === session.session_id}
                                                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#ff6e84]/10 text-[#ff6e84] border border-[#ff6e84]/30 text-[11px] font-bold uppercase tracking-widest hover:bg-[#ff6e84]/20 hover:border-[#ff6e84]/50 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                                                {deletingId === session.session_id ? (
                                                    <span className="w-4 h-4 rounded-full border-2 border-[#ff6e84]/30 border-t-[#ff6e84] animate-spin" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-[16px]">logout</span>
                                                )}
                                                {deletingId === session.session_id ? "Removing..." : "Terminate Session"}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

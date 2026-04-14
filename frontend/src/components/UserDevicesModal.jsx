import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function UserDevicesModal({ user, onClose, onSessionDeleted }) {
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
            <span className="material-symbols-outlined text-[#3b82f6]">{iconName}</span>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto" onClick={onClose}>
            <div className="w-full max-w-lg bg-[#13151f]/90 backdrop-blur-[20px] rounded-[2.5rem] border border-[#737580]/20 shadow-2xl flex flex-col max-h-[85vh] animate-modal-in overflow-hidden m-auto"
                onClick={(e) => e.stopPropagation()}
                style={{ transform: "translateZ(0)", isolation: "isolate" }}
            >

                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b border-[#464752]/30 relative">
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <h3 className="text-[#f0f0fd] font-extrabold text-2xl tracking-tight flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                <span className="material-symbols-outlined text-3xl text-[#3b82f6]">devices</span>
                                Active Devices
                            </h3>
                            <p className="text-[#aaaab7] text-sm mt-1 font-medium">
                                Sessions for <span className="text-[#3b82f6] font-bold">{user.name}</span>
                            </p>
                        </div>
                        <button onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-[#aaaab7] hover:text-[#ff6e84] hover:bg-[#ff6e84]/10 hover:border-[#ff6e84]/30 transition-all cursor-pointer group">
                            <span className="material-symbols-outlined transition-transform group-hover:rotate-90">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6 overflow-y-auto flex-1 custom-scrollbar">
                    {activeSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-16 animate-fade-in">
                            <div className="w-20 h-20 rounded-[2rem] bg-[#3b82f6]/5 border border-[#3b82f6]/10 flex items-center justify-center mb-6 text-[#3b82f6]/40 relative">
                                <span className="material-symbols-outlined text-5xl">devices</span>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#0c0e17] border border-[#737580]/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-sm text-[#ff6e84]">block</span>
                                </div>
                            </div>
                            <p className="text-[#f0f0fd] text-xl font-bold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>No Active Devices</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeSessions.map((session, idx) => {
                                const dateStr = new Date(session.last_active || session.created_at).toLocaleString('en-IN', {
                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                });
                                return (
                                    <div key={idx}
                                        className="rounded-[2.5rem] p-6 bg-[#171924]/60 border border-[#737580]/10 hover:bg-[#171924]/80 hover:border-[#3b82f6]/20 transition-all group animate-fade-in-up shadow-lg"
                                        style={{ animationDelay: `${idx * 100}ms` }}>
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 rounded-3xl bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.15)] group-hover:shadow-[0_0_25px_rgba(59,130,246,0.25)] transition-all">
                                                {getDeviceIcon(session.device_name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[#f0f0fd] text-base font-bold truncate tracking-wide" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                                        {session.device_name || "Unknown Device"}
                                                    </span>
                                                </div>
                                                <p className="text-[#aaaab7] text-xs mt-1 font-medium flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">devices</span>
                                                    {session.platform || "Unknown"}
                                                </p>
                                                <p className="text-[#737580] text-[10px] mt-2 font-bold uppercase tracking-tighter flex items-center gap-1">
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

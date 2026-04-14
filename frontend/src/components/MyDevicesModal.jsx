import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { createPortal } from "react-dom";

export default function MyDevicesModal({ onClose }) {
    const { user } = useAuth();
    const { theme: studentTheme } = useStudentTheme();
    
    // For teachers and admins, we force dark theme. For students, we follow their chosen theme.
    const isStaff = user?.role === "teacher" || user?.role === "admin";
    const theme = isStaff ? "dark" : (studentTheme || "dark");
    const isLight = theme === "light";

    // The user object in AuthContext has activeSessions
    const activeSessions = user?.activeSessions || [];
    const currentSessionId = localStorage.getItem("current_device_session_id");

    const getDeviceIcon = (deviceName) => {
        const iconName = (deviceName === "Android" || deviceName === "iOS") ? "smartphone" : "desktop_windows";
        return (
            <span className="material-symbols-outlined text-[#3b82f6] text-2xl">{iconName}</span>
        );
    };

    return createPortal(
        <div 
            data-theme={theme}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto" 
            onClick={onClose}
            style={{
                backgroundColor: isLight ? 'rgba(238,242,255,0.4)' : 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
            }}
        >
            <div 
                className="w-full max-w-lg rounded-[2.5rem] flex flex-col max-h-[85vh] animate-modal-in overflow-hidden m-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{ 
                    backgroundColor: isLight ? 'rgba(255,255,255,0.25)' : 'rgba(19,21,31,0.9)',
                    border: `1px solid ${isLight ? 'rgba(255,255,255,0.6)' : 'rgba(115,117,128,0.2)'}`,
                    backdropFilter: 'blur(40px) saturate(2.0)',
                    WebkitBackdropFilter: 'blur(40px) saturate(2.0)',
                    transform: "translateZ(0)", 
                    isolation: "isolate" 
                }}
            >

                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b relative" style={{ borderColor: 'var(--st-divider)' }}>
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <h3 className="font-extrabold text-2xl tracking-tight flex items-center gap-3" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                <span className="material-symbols-outlined text-3xl text-[#3b82f6]">devices</span>
                                My Devices
                            </h3>
                        </div>
                        <button onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer group"
                            style={{ backgroundColor: 'var(--st-icon-bg)', border: '1px solid var(--st-input-border)', color: 'var(--st-text-secondary)' }}>
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
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border flex items-center justify-center" style={{ backgroundColor: 'var(--st-surface)', borderColor: 'var(--st-card-border)' }}>
                                    <span className="material-symbols-outlined text-sm text-[#ff6e84]">block</span>
                                </div>
                            </div>
                            <p className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>No Active Devices</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeSessions.map((session, idx) => {
                                const isCurrent = session.session_id === currentSessionId;
                                const dateStr = new Date(session.last_active || session.created_at).toLocaleString('en-IN', {
                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                });
                                return (
                                    <div key={idx}
                                        className={`rounded-[2.5rem] p-6 border transition-all animate-fade-in-up relative overflow-hidden group shadow-lg ${
                                            isCurrent 
                                            ? "border-[#3b82f6]/30" 
                                            : "hover:border-[#3b82f6]/20"
                                        }`}
                                        style={{ 
                                            animationDelay: `${idx * 100}ms`,
                                            backgroundColor: isCurrent 
                                                ? (isLight ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.1)') 
                                                : (isLight ? 'rgba(255,255,255,0.15)' : 'var(--st-icon-bg)'),
                                            borderColor: isCurrent ? 'rgba(59,130,246,0.3)' : 'var(--st-input-border)',
                                            backdropFilter: isLight ? 'blur(8px)' : 'none',
                                            WebkitBackdropFilter: isLight ? 'blur(8px)' : 'none',
                                        }}>
                                        
                                        {isCurrent && (
                                            <div className="absolute top-0 right-0 px-4 py-1.5 bg-[#3b82f6] text-white text-[9px] font-bold uppercase tracking-widest rounded-bl-2xl shadow-lg">
                                                This Device
                                            </div>
                                        )}

                                        <div className="flex items-center gap-5">
                                            <div className={`w-14 h-14 rounded-3xl flex items-center justify-center shrink-0 transition-all border ${
                                                isCurrent 
                                                ? "bg-[#3b82f6]/20 border-[#3b82f6]/40 shadow-[0_0_20px_rgba(59,130,246,0.25)]" 
                                                : "bg-[#3b82f6]/10 border-[#3b82f6]/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] group-hover:shadow-[0_0_25px_rgba(59,130,246,0.25)]"
                                            }`}>
                                                {getDeviceIcon(session.device_name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-base font-bold truncate tracking-wide" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                                        {session.device_name || "Unknown Device"}
                                                    </span>
                                                    {isCurrent && (
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0d9488] bg-[#0d9488]/10 px-2 py-0.5 rounded-md border border-[#0d9488]/20 animate-pulse">
                                                            Online
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs mt-1 font-medium flex items-center gap-1" style={{ color: 'var(--st-text-secondary)' }}>
                                                    <span className="material-symbols-outlined text-[14px]">devices</span>
                                                    {session.platform || "Unknown"}
                                                </p>
                                                <p className={`text-[10px] mt-2 font-bold uppercase tracking-tighter flex items-center gap-1 ${isCurrent ? "text-[#3b82f6]/80" : ""}`} style={{ color: isCurrent ? '#3b82f6' : 'var(--st-text-muted)' }}>
                                                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                    {isCurrent ? "Current Session" : `Last active: ${dateStr}`}
                                                </p>
                                            </div>
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

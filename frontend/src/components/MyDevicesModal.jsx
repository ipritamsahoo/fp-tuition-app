import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { useTeacherTheme } from "@/context/TeacherThemeContext";
import { createPortal } from "react-dom";

export default function MyDevicesModal({ onClose }) {
    const { user } = useAuth();
    const studentThemeContext = useStudentTheme();
    const teacherThemeContext = useTeacherTheme();
    
    const isTeacher = user?.role === "teacher";
    const isAdmin = user?.role === "admin";

    // Choose appropriate theme
    let theme = "dark";
    if (isTeacher) {
        theme = teacherThemeContext?.theme || "dark";
    } else if (isAdmin) {
        theme = "dark";
    } else {
        theme = studentThemeContext?.theme || "dark";
    }
    const isLight = theme === "light";
    const prefix = isTeacher ? "--tt-" : "--st-";

    const activeSessions = user?.activeSessions || [];
    const currentSessionId = localStorage.getItem("current_device_session_id");

    const accentColor = isLight ? "#0d9488" : "#3b82f6";
    const activeColor = isLight ? "rgba(13, 148, 136, 0.12)" : "rgba(59, 130, 246, 0.15)";
    const activeBorderColor = isLight ? "rgba(13, 148, 136, 0.3)" : "rgba(59, 130, 246, 0.3)";

    const getDeviceIcon = (deviceName) => {
        const iconName = (deviceName === "Android" || deviceName === "iOS") ? "smartphone" : "desktop_windows";
        return (
            <span className="material-symbols-outlined text-2xl" style={{ color: accentColor }}>{iconName}</span>
        );
    };

    return createPortal(
        <div 
            data-theme={theme}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto" 
            onClick={onClose}
            style={{
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(16px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(16px) saturate(1.5)'
            }}
        >
            <div 
                className="w-full max-w-lg rounded-[2.5rem] flex flex-col max-h-[85vh] animate-modal-in overflow-hidden m-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{ 
                    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.01)',
                    borderColor: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    backdropFilter: 'blur(80px) saturate(2.5)',
                    WebkitBackdropFilter: 'blur(80px) saturate(2.5)',
                    boxShadow: isLight
                        ? '0 32px 64px rgba(0,0,0,0.05), inset 0 0 32px rgba(255,255,255,0.6)'
                        : '0 32px 64px rgba(0,0,0,0.6), inset 0 0 32px rgba(255,255,255,0.05)',
                    transform: "translateZ(0)", 
                    isolation: "isolate" 
                }}
            >

                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b relative" style={{ borderColor: `var(${prefix}divider)` }}>
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <h3 className="font-extrabold text-2xl tracking-tight flex items-center gap-3" style={{ fontFamily: "'Manrope', sans-serif", color: `var(${prefix}text-primary)` }}>
                                <span className="material-symbols-outlined text-3xl" style={{ color: accentColor }}>devices</span>
                                My Devices
                            </h3>
                        </div>
                        <button onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer group"
                            style={{ 
                                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                                border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`,
                                color: `var(${prefix}text-secondary)` 
                            }}>
                            <span className="material-symbols-outlined transition-transform group-hover:rotate-90">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6 overflow-y-auto flex-1 custom-scrollbar">
                    {activeSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-16 animate-fade-in">
                            <div 
                                className="w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 relative border"
                                style={{
                                    backgroundColor: `var(${prefix}blue-bg)`,
                                    borderColor: `var(${prefix}logo-border)`,
                                    color: accentColor
                                }}
                            >
                                <span className="material-symbols-outlined text-5xl">devices</span>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border flex items-center justify-center" style={{ backgroundColor: `var(${prefix}surface)`, borderColor: `var(${prefix}card-border)` }}>
                                    <span className="material-symbols-outlined text-sm text-[#ff6e84]">block</span>
                                </div>
                            </div>
                            <p className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: `var(${prefix}text-primary)` }}>No Active Devices</p>
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
                                        className="rounded-[2.5rem] p-6 border transition-all animate-fade-in-up relative overflow-hidden group shadow-lg"
                                        style={{ 
                                            animationDelay: `${idx * 100}ms`,
                                            backgroundColor: isCurrent 
                                                ? activeColor 
                                                : (isLight ? 'rgba(255,255,255,0.15)' : `var(${prefix}icon-bg)`),
                                            borderColor: isCurrent ? activeBorderColor : `var(${prefix}input-border)`,
                                            backdropFilter: isLight ? 'blur(8px)' : 'none',
                                            WebkitBackdropFilter: isLight ? 'blur(8px)' : 'none',
                                        }}>
                                        
                                        {isCurrent && (
                                            <div className="absolute top-0 right-0 px-4 py-1.5 text-white text-[9px] font-bold uppercase tracking-widest rounded-bl-2xl shadow-lg" style={{ backgroundColor: accentColor }}>
                                                This Device
                                            </div>
                                        )}

                                        <div className="flex items-center gap-5">
                                            <div 
                                                className="w-14 h-14 rounded-3xl flex items-center justify-center shrink-0 transition-all border shadow-[0_0_15px_rgba(13,148,136,0.15)] group-hover:shadow-[0_0_25px_rgba(13,148,136,0.25)]"
                                                style={{
                                                    backgroundColor: isCurrent ? activeColor : `var(${prefix}icon-bg)`,
                                                    borderColor: isCurrent ? activeBorderColor : `var(${prefix}input-border)`,
                                                }}
                                            >
                                                {getDeviceIcon(session.device_name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-base font-bold truncate tracking-wide" style={{ fontFamily: "'Manrope', sans-serif", color: `var(${prefix}text-primary)` }}>
                                                        {session.device_name || "Unknown Device"}
                                                    </span>
                                                    {isCurrent && (
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0d9488] bg-[#0d9488]/10 px-2 py-0.5 rounded-md border border-[#0d9488]/20 animate-pulse">
                                                            Online
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs mt-1 font-medium flex items-center gap-1" style={{ color: `var(${prefix}text-secondary)` }}>
                                                    <span className="material-symbols-outlined text-[14px]">devices</span>
                                                    {session.platform || "Unknown"}
                                                </p>
                                                <p className="text-[10px] mt-2 font-bold uppercase tracking-tighter flex items-center gap-1" style={{ color: isCurrent ? accentColor : `var(${prefix}text-muted)` }}>
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

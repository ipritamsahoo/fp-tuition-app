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
                <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6 border-b relative" style={{ borderColor: `var(${prefix}divider)` }}>
                    <div className="flex items-start sm:items-center justify-between gap-3 relative z-10">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-extrabold text-xl sm:text-2xl tracking-tight flex items-center gap-2.5 sm:gap-3" style={{ fontFamily: "'Manrope', sans-serif", color: `var(${prefix}text-primary)` }}>
                                <span className="material-symbols-outlined text-2xl sm:text-3xl shrink-0" style={{ color: accentColor }}>devices</span>
                                <span className="truncate">My Devices</span>
                            </h3>
                            <p className="text-[11px] sm:text-xs mt-1.5 font-medium flex items-center gap-1.5 leading-tight" style={{ color: `var(${prefix}text-muted)` }}>
                                <span className="material-symbols-outlined text-[14px] sm:text-[15px] opacity-75 shrink-0">info</span>
                                <span>Old sessions are automatically terminated after 15 days of inactivity</span>
                            </p>
                        </div>
                        <button onClick={onClose}
                            className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 aspect-square flex items-center justify-center rounded-full transition-all cursor-pointer group active:scale-95"
                            style={{ 
                                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                                border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`,
                                color: `var(${prefix}text-secondary)`,
                                aspectRatio: '1 / 1'
                            }}
                            aria-label="Close modal"
                        >
                            <span className="material-symbols-outlined text-lg sm:text-xl transition-transform group-hover:rotate-90">close</span>
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
                                        className="rounded-[28px] sm:rounded-[32px] p-5 sm:p-6 border transition-all animate-fade-in-up relative overflow-hidden group shadow-md"
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
                                            <div className="absolute top-0 right-0 px-4 py-1 text-white text-[9px] font-bold uppercase tracking-widest rounded-bl-2xl shadow-md" style={{ backgroundColor: accentColor }}>
                                                This Device
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 sm:gap-5">
                                            <div 
                                                className="w-12 h-12 sm:w-14 sm:h-14 rounded-[20px] flex items-center justify-center shrink-0 transition-all border shadow-[0_0_15px_rgba(13,148,136,0.15)] group-hover:shadow-[0_0_25px_rgba(13,148,136,0.25)]"
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
                                                        {session.platform && (
                                                            <span className="text-sm font-medium ml-1.5 opacity-75" style={{ color: `var(${prefix}text-secondary)` }}>
                                                                ({session.platform})
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] mt-1.5 font-bold uppercase tracking-tighter flex items-center gap-1" style={{ color: isCurrent ? accentColor : `var(${prefix}text-muted)` }}>
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

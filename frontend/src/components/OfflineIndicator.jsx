import { useState, useEffect } from "react";

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [theme, setTheme] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("fp_admin_theme_v2") ||
                   localStorage.getItem("fp_teacher_theme_v2") ||
                   localStorage.getItem("fp_student_theme_v2") ||
                   "dark";
        }
        return "dark";
    });

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        const handleThemeChange = (e) => {
            setTheme(e.detail);
        };
        window.addEventListener("fp-student-theme-change", handleThemeChange);
        window.addEventListener("fp-teacher-theme-change", handleThemeChange);
        window.addEventListener("fp-admin-theme-change", handleThemeChange);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("fp-student-theme-change", handleThemeChange);
            window.removeEventListener("fp-teacher-theme-change", handleThemeChange);
            window.removeEventListener("fp-admin-theme-change", handleThemeChange);
        };
    }, []);

    if (isOnline) return null;

    const isLight = theme === "light";

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 backdrop-blur-md animate-fade-in" 
             style={{ 
                 backgroundColor: isLight ? "rgba(0, 0, 0, 0.25)" : "rgba(0, 0, 0, 0.65)"
             }}>
            <div 
                className="w-full max-w-sm rounded-[32px] p-8 flex flex-col items-center text-center animate-fade-in-scale border shadow-2xl backdrop-blur-xl"
                style={{
                    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(28, 31, 43, 0.65)',
                    borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
                }}
            >
                {/* Visual Icon */}
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#3b82f6]/20 to-[#3b82f6]/5 flex items-center justify-center mb-8 ring-1 ring-[#3b82f6]/20 shadow-[0_0_40px_rgba(59,130,246,0.15)] relative">
                    <span className="material-symbols-outlined text-[#3b82f6] text-5xl font-bold opacity-80">
                        wifi_off
                    </span>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#ff6e84] flex items-center justify-center border-2 animate-pulse"
                         style={{ borderColor: isLight ? '#ffffff' : '#1c1f2b' }}>
                        <span className="material-symbols-outlined text-white text-[14px] font-bold">priority_high</span>
                    </div>
                </div>

                <h2 className="text-2xl font-extrabold mb-3 tracking-tight" 
                    style={{ 
                        fontFamily: "'Manrope', sans-serif",
                        color: isLight ? '#0f172a' : '#f0f0fd'
                    }}>
                    No Internet Connection
                </h2>
                <p className="text-[15px] leading-relaxed mb-10"
                   style={{
                       color: isLight ? '#475569' : '#aaaab7'
                   }}>
                    We've detected that you're currently offline. Please check your connection to continue.
                </p>

                {/* Status Indicator */}
                <div className="flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest border"
                     style={{
                         backgroundColor: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                         borderColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.1)',
                         color: isLight ? '#475569' : '#aaaab7'
                     }}>
                    <div className="w-2 h-2 rounded-full bg-[#ff6e84] animate-pulse" />
                    Waiting for Reconnect
                </div>
            </div>
        </div>
    );
}

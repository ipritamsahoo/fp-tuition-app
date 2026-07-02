import { useError } from "@/context/ErrorContext";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { useTeacherTheme } from "@/context/TeacherThemeContext";
import { useAdminTheme } from "@/context/AdminThemeContext";

/**
 * Premium glassmorphism error modal.
 */
export default function GlobalErrorModal() {
    const { error, clear } = useError();
    const { user } = useAuth();
    
    const studentTheme = useStudentTheme();
    const teacherTheme = useTeacherTheme();
    const adminTheme = useAdminTheme();

    if (!error) return null;

    const handleRetry = () => {
        if (error.onRetry) error.onRetry();
        clear();
    };

    const handleDismiss = () => {
        if (error.onDismiss) error.onDismiss();
        clear();
    };

    const isTeacher = user?.role === "teacher";
    const isAdmin = user?.role === "admin";
    const prefix = isAdmin ? "--ad-" : isTeacher ? "--tt-" : "--st-";
    const cardClass = isAdmin ? "glass-card-admin" : isTeacher ? "glass-card-teacher" : "glass-card-student";
    
    let activeTheme = "dark";
    if (isAdmin) {
        activeTheme = adminTheme?.theme || "dark";
    } else if (isTeacher) {
        activeTheme = teacherTheme?.theme || "dark";
    } else {
        activeTheme = studentTheme?.theme || "dark";
    }
    const isLight = activeTheme === "light";
    const accentColor = isLight 
        ? (isAdmin ? "#0d9488" : isTeacher ? "var(--tt-accent)" : "#0891b2") 
        : `var(${prefix}primary)`;

    return (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-6 backdrop-blur-md animate-fade-in" 
            style={{ 
                backgroundColor: isLight ? "rgba(0, 0, 0, 0.25)" : "rgba(0, 0, 0, 0.65)"
            }}
        >
            <div 
                className={`w-full max-w-sm ${cardClass} rounded-[32px] p-8 flex flex-col items-center text-center animate-fade-in-scale shadow-2xl border backdrop-blur-xl`}
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.85)' : `var(${prefix}card-bg)`,
                    borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : `var(${prefix}card-border)`
                }}
            >
                {/* Icon Wrapper */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#ff6e84]/20 to-[#ff6e84]/5 flex items-center justify-center mb-6 ring-1 ring-[#ff6e84]/20 shadow-[0_0_30px_rgba(255,110,132,0.1)]">
                    <span className="material-symbols-outlined text-[#ff6e84] text-4xl font-bold">
                        {error.icon || "error"}
                    </span>
                </div>

                {/* Content */}
                <h2 className="text-2xl font-extrabold mb-3 tracking-tight" 
                    style={{ 
                        fontFamily: "'Manrope', sans-serif", 
                        color: isLight ? '#0f172a' : `var(${prefix}text-primary)` 
                    }}>
                    {error.title}
                </h2>
                <p className="text-[15px] leading-relaxed mb-8" 
                   style={{ 
                       color: isLight ? '#475569' : `var(${prefix}text-secondary)` 
                   }}>
                    {error.message}
                </p>

                {/* Actions */}
                <div className="flex flex-col w-full gap-3">
                    {error.onRetry && (
                        <button
                            onClick={handleRetry}
                            className="w-full py-3.5 rounded-full font-bold text-sm active:scale-95 transition-all cursor-pointer text-white"
                            style={{
                                backgroundColor: accentColor,
                                boxShadow: `0 8px 20px ${isLight ? (isAdmin ? 'rgba(13, 148, 136, 0.3)' : 'rgba(8, 145, 178, 0.3)') : 'rgba(59, 130, 246, 0.3)'}`
                            }}
                        >
                            Try Again
                        </button>
                    )}
                    <button
                        onClick={handleDismiss}
                        className="w-full py-3.5 rounded-full font-bold text-sm active:scale-95 transition-all border cursor-pointer"
                        style={{
                            backgroundColor: isLight ? 'rgba(0, 0, 0, 0.03)' : `var(${prefix}icon-bg)`,
                            color: isLight ? '#475569' : `var(${prefix}text-primary)`,
                            borderColor: isLight ? 'rgba(0, 0, 0, 0.06)' : `var(${prefix}input-border)`
                        }}
                    >
                        {error.onRetry ? "Dismiss" : "Got it"}
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useError } from "@/context/ErrorContext";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { useTeacherTheme } from "@/context/TeacherThemeContext";

/**
 * Premium glassmorphism error modal.
 */
export default function GlobalErrorModal() {
    const { error, clear } = useError();
    const { user } = useAuth();
    
    const studentTheme = useStudentTheme();
    const teacherTheme = useTeacherTheme();

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
    const prefix = isTeacher ? "--tt-" : "--st-";
    const cardClass = isTeacher ? "glass-card-teacher" : "glass-card-student";
    
    let activeTheme = "dark";
    if (isTeacher) {
        activeTheme = teacherTheme?.theme || "dark";
    } else {
        activeTheme = studentTheme?.theme || "dark";
    }
    const isLight = activeTheme === "light";
    const accentColor = isLight ? "#0d9488" : "#3b82f6";

    return (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-fade-in" 
            style={{ 
                backgroundColor: isLight ? "rgba(238, 242, 255, 0.45)" : "rgba(0, 0, 0, 0.75)", 
                backdropFilter: "blur(8px)" 
            }}
        >
            <div 
                className={`w-full max-w-sm ${cardClass} rounded-[32px] p-8 flex flex-col items-center text-center animate-fade-in-scale shadow-lg border`}
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: `var(${prefix}card-bg)`,
                    borderColor: `var(${prefix}card-border)`
                }}
            >
                {/* Icon Wrapper */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#ff6e84]/20 to-[#ff6e84]/5 flex items-center justify-center mb-6 ring-1 ring-[#ff6e84]/20 shadow-[0_0_30px_rgba(255,110,132,0.1)]">
                    <span className="material-symbols-outlined text-[#ff6e84] text-4xl font-bold">
                        {error.icon || "error"}
                    </span>
                </div>

                {/* Content */}
                <h2 className="text-2xl font-extrabold mb-3 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: `var(${prefix}text-primary)` }}>
                    {error.title}
                </h2>
                <p className="text-[15px] leading-relaxed mb-8" style={{ color: `var(${prefix}text-secondary)` }}>
                    {error.message}
                </p>

                {/* Actions */}
                <div className="flex flex-col w-full gap-3">
                    {error.onRetry && (
                        <button
                            onClick={handleRetry}
                            className="w-full py-3.5 rounded-full font-bold text-sm active:scale-95 transition-all cursor-pointer"
                            style={{
                                backgroundColor: accentColor,
                                color: "#ffffff",
                                boxShadow: `0 8px 20px ${isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                            }}
                        >
                            Try Again
                        </button>
                    )}
                    <button
                        onClick={handleDismiss}
                        className="w-full py-3.5 rounded-full font-bold text-sm active:scale-95 transition-all border cursor-pointer"
                        style={{
                            backgroundColor: `var(${prefix}icon-bg)`,
                            color: `var(${prefix}text-primary)`,
                            borderColor: `var(${prefix}input-border)`
                        }}
                    >
                        {error.onRetry ? "Dismiss" : "Got it"}
                    </button>
                </div>
            </div>
        </div>
    );
}

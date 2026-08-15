import { useAuth } from "@/context/AuthContext";
import logoSrc from "@/assets/logo.png";

/**
 * Shared About content — used in both AboutPage (mobile full-page)
 * and StudentSettings/TeacherSettings desktop modal.
 * Uses responsive classes: default (mobile) is more spacious, 
 * md: (desktop screen/modal) is more compact to fit without scroll.
 * Maximum Glassmorphism for Dark Mode: Ultra-transparent + Ultra-blur.
 */
export default function AboutContent({ isLight, accentColor, onFeedbackClick, prefix = "--st-" }) {
    const { user } = useAuth();

    return (
        <div className="flex flex-col items-center w-full gap-8 md:gap-4 text-center animate-fade-in">

             {/* Logo */}
            <div
                className="w-24 h-24 md:w-16 md:h-16 rounded-full flex items-center justify-center overflow-hidden animate-slide-up relative select-none"
                style={{
                    backgroundColor: isLight ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.02)",
                    border: `2px solid ${isLight ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.12)"}`,
                    backdropFilter: "blur(24px) saturate(2.0)",
                    WebkitBackdropFilter: "blur(24px) saturate(2.0)",
                    boxShadow: `0 0 40px ${accentColor}${isLight ? '40' : '20'}, inset 0 0 15px rgba(255,255,255,${isLight ? '0.1' : '0.05'})`,
                    animation: "slide-up 0.8s ease-out forwards",
                    animationDelay: "100ms"
                }}
                onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}
            >
                <img
                    src={logoSrc}
                    alt="FP Finance Logo"
                    className="w-full h-full object-cover scale-120 pointer-events-none select-none"
                    draggable="false"
                />

                {/* Visual Glass Overlay */}
                <div className="absolute inset-0 pointer-events-none rounded-full"
                    style={{
                        background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.05) 100%)"
                    }}
                />
            </div>

            {/* App Name + Version */}
            <div className="space-y-2 md:space-y-1.5 animate-slide-up" style={{ animationDelay: "200ms" }}>
                <h2
                    className="text-4xl md:text-xl font-black tracking-tight"
                    style={{ fontFamily: "'Manrope', sans-serif", color: `var(${prefix}text-primary)` }}
                >
                    FP Finance
                </h2>
                <p
                    className="text-xs md:text-[11px] font-bold tracking-widest uppercase"
                    style={{ color: accentColor }}
                >
                    Version {__APP_VERSION__}
                </p>
            </div>

            {/* Description Card */}
            <div
                className="w-full p-5 sm:p-6 md:p-4 rounded-3xl md:rounded-2xl text-center animate-slide-up"
                style={{
                    backgroundColor: isLight ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.015)",
                    border: `1px solid ${isLight ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.06)"}`,
                    backdropFilter: "blur(32px) saturate(2.0)",
                    WebkitBackdropFilter: "blur(32px) saturate(2.0)",
                    animationDelay: "300ms"
                }}
            >
                <p className="text-xs sm:text-sm md:text-xs leading-relaxed text-center font-medium" style={{ color: `var(${prefix}text-secondary)` }}>
                    FP Finance is Future Point's official learning and tuition management platform for students and educators. Seamlessly access study materials & class notices, manage fee payments, track punctuality insights, and stay updated in one unified workspace.
                </p>
            </div>

            {/* Developers */}
            <div
                className="w-full p-5 sm:p-6 md:p-4 rounded-3xl md:rounded-2xl text-left animate-slide-up"
                style={{
                    backgroundColor: isLight ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.008)",
                    border: `1px solid ${isLight ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.04)"}`,
                    backdropFilter: "blur(32px) saturate(2.0)",
                    WebkitBackdropFilter: "blur(32px) saturate(2.0)",
                    animationDelay: "400ms"
                }}
            >
                <p className="text-[11px] md:text-[9px] uppercase tracking-widest font-extrabold mb-5 md:mb-3" style={{ color: `var(${prefix}text-muted)` }}>
                    Developed By
                </p>
                <div className="flex flex-col gap-5 md:gap-2.5">
                    <div className="flex items-center gap-4 md:gap-3">
                        <img
                            src="/suman.png"
                            alt="Suman Maji"
                            className="w-11 h-11 md:w-8 md:h-8 rounded-full object-cover shadow-lg shrink-0 border border-white/10 pointer-events-none select-none"
                            draggable="false"
                            onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}
                        />
                        <div>
                            <p className="font-extrabold text-lg md:text-sm" style={{ color: `var(${prefix}text-primary)` }}>Suman Maji</p>
                            <p className="text-xs md:text-[10px]" style={{ color: `var(${prefix}text-muted)` }}>Co-Developer • COSH 2023–2027</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-3">
                        <img
                            src="/pritam.png"
                            alt="Pritam Sahoo"
                            className="w-11 h-11 md:w-8 md:h-8 rounded-full object-cover shadow-lg shrink-0 border border-white/10 pointer-events-none select-none"
                            draggable="false"
                            onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}
                        />
                        <div>
                            <p className="font-extrabold text-lg md:text-sm" style={{ color: `var(${prefix}text-primary)` }}>Pritam Sahoo</p>
                            <p className="text-xs md:text-[10px]" style={{ color: `var(${prefix}text-muted)` }}>Co-Developer • COSH 2023–2027</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feedback Button */}
            <button
                onClick={onFeedbackClick}
                disabled={user?.role !== "student"}
                className={`w-full flex items-center justify-center gap-3 py-4.5 md:py-3 px-6 md:px-4 rounded-[24px] md:rounded-[14px] font-bold text-base md:text-sm transition-all animate-slide-up shadow-xl ${user?.role !== "student" ? "opacity-30 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
                style={{
                    backgroundColor: isLight ? "rgba(13, 148, 136, 0.15)" : "rgba(59, 130, 246, 0.12)",
                    border: `1px solid ${accentColor}${isLight ? '40' : '30'}`,
                    color: accentColor,
                    backdropFilter: "blur(16px) saturate(1.8)",
                    WebkitBackdropFilter: "blur(16px) saturate(1.8)",
                    boxShadow: `0 8px 32px ${accentColor}${isLight ? '15' : '10'}`,
                    animationDelay: "500ms"
                }}
            >
                <span className="material-symbols-outlined text-[22px] md:text-[17px]">rate_review</span>
                Give Feedback
            </button>

            {/* Copyright */}
            <p className="text-[10px] md:text-[9px] uppercase tracking-[0.3em] font-bold animate-fade-in pt-2" style={{ color: `var(${prefix}text-muted)`, animationDelay: "600ms" }}>
                © {new Date().getFullYear()} FP Finance. All rights reserved.
            </p>
        </div>
    );
}

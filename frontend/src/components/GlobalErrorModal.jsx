import { useError } from "@/context/ErrorContext";

/**
 * Premium glassmorphism error modal.
 */
export default function GlobalErrorModal() {
    const { error, clear } = useError();

    if (!error) return null;

    const handleRetry = () => {
        if (error.onRetry) error.onRetry();
        clear();
    };

    const handleDismiss = () => {
        if (error.onDismiss) error.onDismiss();
        clear();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-fade-in" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}>
            <div 
                className="w-full max-w-sm glass-card-student rounded-[32px] p-8 flex flex-col items-center text-center animate-fade-in-scale shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon Wrapper */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#ff6e84]/20 to-[#ff6e84]/5 flex items-center justify-center mb-6 ring-1 ring-[#ff6e84]/20 shadow-[0_0_30px_rgba(255,110,132,0.1)]">
                    <span className="material-symbols-outlined text-[#ff6e84] text-4xl font-bold">
                        {error.icon || "error"}
                    </span>
                </div>

                {/* Content */}
                <h2 className="text-[#f0f0fd] text-2xl font-extrabold mb-3 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {error.title}
                </h2>
                <p className="text-[#aaaab7] text-[15px] leading-relaxed mb-8">
                    {error.message}
                </p>

                {/* Actions */}
                <div className="flex flex-col w-full gap-3">
                    {error.onRetry && (
                        <button
                            onClick={handleRetry}
                            className="w-full py-3.5 rounded-full bg-[#3b82f6] text-white font-bold text-sm hover:bg-[#2563eb] active:scale-95 transition-all shadow-[0_8px_20px_rgba(59,130,246,0.3)] cursor-pointer"
                        >
                            Try Again
                        </button>
                    )}
                    <button
                        onClick={handleDismiss}
                        className="w-full py-3.5 rounded-full bg-white/5 text-[#f0f0fd] font-bold text-sm hover:bg-white/10 active:scale-95 transition-all ring-1 ring-white/10 cursor-pointer"
                    >
                        {error.onRetry ? "Dismiss" : "Got it"}
                    </button>
                </div>
            </div>
        </div>
    );
}

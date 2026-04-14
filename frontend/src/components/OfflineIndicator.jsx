import { useState, useEffect } from "react";

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 animate-fade-in" style={{ backgroundColor: "rgba(10, 10, 18, 0.8)", backdropFilter: "blur(12px)" }}>
            <div 
                className="w-full max-w-sm glass-card-student rounded-[32px] p-8 flex flex-col items-center text-center animate-fade-in-scale shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10"
            >
                {/* Visual Icon */}
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#3b82f6]/20 to-[#3b82f6]/5 flex items-center justify-center mb-8 ring-1 ring-[#3b82f6]/20 shadow-[0_0_40px_rgba(59,130,246,0.15)] relative">
                    <span className="material-symbols-outlined text-[#3b82f6] text-5xl font-bold opacity-80">
                        wifi_off
                    </span>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#ff6e84] flex items-center justify-center ring-2 ring-[#0a0a12] animate-pulse">
                        <span className="material-symbols-outlined text-white text-[14px] font-bold">priority_high</span>
                    </div>
                </div>

                <h2 className="text-[#f0f0fd] text-2xl font-extrabold mb-3 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    No Internet Connection
                </h2>
                <p className="text-[#aaaab7] text-[15px] leading-relaxed mb-10">
                    We've detected that you're currently offline. Please check your connection to continue.
                </p>

                {/* Status Indicator */}
                <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-[#aaaab7]">
                    <div className="w-2 h-2 rounded-full bg-[#ff6e84] animate-pulse" />
                    Waiting for Reconnect
                </div>
            </div>
        </div>
    );
}

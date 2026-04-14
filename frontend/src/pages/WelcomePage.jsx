import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LightRays from "@/components/LightRays/LightRays";

export default function WelcomePage() {
    const navigate = useNavigate();
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [stage, setStage] = useState(0);
    // stage 0: only spotlight visible
    // stage 1+: words appear one by one (1=Welcome, 2=to, 3=Future, 4=Point)
    // stage 5: subtitle
    // stage 6: install button
    // stage 7: get started button

    useEffect(() => {
        // Check if already running as installed PWA
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone;
        if (isStandalone) setIsInstalled(true);

        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        const handleAppInstalled = () => {
            setDeferredPrompt(null);
            setIsInstalled(true);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstall);
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
            window.removeEventListener("appinstalled", handleAppInstalled);
        };
    }, []);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        const handler = (e) => setIsMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    // Staged animation timeline
    useEffect(() => {
        const delays = [
            800,   // stage 1: "Welcome"  (after 800ms of spotlight only)
            300,   // stage 2: "to"
            300,   // stage 3: "Future"
            300,   // stage 4: "Point"
            400,   // stage 5: subtitle
            400,   // stage 6: install button
            250,   // stage 7: get started button
        ];

        const timers = [];
        let cumulative = 0;

        delays.forEach((delay, i) => {
            cumulative += delay;
            timers.push(setTimeout(() => setStage(i + 1), cumulative));
        });

        return () => timers.forEach(clearTimeout);
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === "accepted") {
                setDeferredPrompt(null);
                setIsInstalled(true);
            }
        } else {
            // Platform-specific PWA install guidance
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            if (isIOS) {
                alert("To install this app:\n1. Tap the Share button (↑) at the bottom\n2. Scroll down and tap \"Add to Home Screen\"\n3. Tap \"Add\" to install");
            } else {
                alert("To install this app:\n1. Open browser menu (⋮)\n2. Tap \"Install App\" or \"Install FP Finance\"");
            }
        }
    };

    const wordClass = (minStage) =>
        `inline-block transition-all duration-500 ease-out ${stage >= minStage
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-6 scale-90"
        }`;

    const btnClass = (minStage) =>
        `transition-all duration-500 ease-out ${stage >= minStage
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-8 scale-95"
        }`;

    return (
        <div className="min-h-[100dvh] flex flex-col items-center relative overflow-hidden select-none">
            {/* ── Background layers ── */}
            <div className="absolute inset-0 bg-[#0a0a12]" />

            {/* LightRays WebGL spotlight */}
            <div className="absolute inset-0" style={isMobile ? { filter: 'brightness(2.5)' } : undefined}>
                <LightRays
                    raysOrigin="top-center"
                    raysColor="#ffffff"
                    raysSpeed={1}
                    lightSpread={isMobile ? 3 : 1}
                    rayLength={2}
                    pulsating={false}
                    fadeDistance={isMobile ? 1.5 : 1}
                    saturation={isMobile ? 5 : 2}
                    followMouse={!isMobile}
                    mouseInfluence={0.1}
                    noiseAmount={0}
                    distortion={0}
                />
            </div>

            {/* Grid overlay */}
            <div className="absolute inset-0 welcome-grid opacity-[0.07]" />

            {/* ── Top spacer ── */}
            <div className="relative z-10 pt-10 sm:pt-12 flex-shrink-0" />

            {/* ── Hero ── */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
                {/* Main heading — each word pops in separately */}
                <h1 className="text-[2.4rem] sm:text-[3.2rem] leading-[1.1] font-bold tracking-tight">
                    <span className={`${wordClass(1)} welcome-text-glow`}>Welcome</span>
                    {" "}
                    <span className={`${wordClass(2)} welcome-text-glow`}>to</span>
                    <br />
                    <span className={`${wordClass(3)} bg-gradient-to-r from-white via-[#a8b8ff] to-[#3861fb] bg-clip-text text-transparent welcome-text-glow`}>
                        Future
                    </span>
                    {" "}
                    <span className={`${wordClass(4)} bg-gradient-to-r from-[#a8b8ff] to-[#3861fb] bg-clip-text text-transparent welcome-text-glow`}>
                        Point
                    </span>
                </h1>

                {/* Subtitle */}
                <p className={`mt-3 sm:mt-4 text-[#8a8f98] text-sm sm:text-base max-w-[260px] sm:max-w-[280px] leading-relaxed transition-all duration-600 ease-out ${stage >= 5 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}>
                    Where your future finds its direction
                </p>
            </div>

            {/* ── Buttons ── */}
            <div className="relative z-10 w-full px-6 sm:px-8 pb-8 sm:pb-12 flex flex-col gap-3 max-w-md mx-auto flex-shrink-0" style={{ paddingBottom: `max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))` }}>
                {/* Install button */}
                {!isInstalled && (
                    <button
                        onClick={handleInstall}
                        className={`w-full py-3.5 sm:py-4 rounded-full bg-white text-[#0a0a12] font-semibold text-sm sm:text-base
                            shadow-lg shadow-white/10 hover:shadow-white/20
                            active:scale-[0.98] cursor-pointer ${btnClass(6)}`}
                    >
                        Install
                    </button>
                )}

                {/* Get Started */}
                <button
                    onClick={() => navigate("/login")}
                    className={`w-full py-3.5 sm:py-4 rounded-full bg-transparent border border-white/25 text-white font-semibold text-sm sm:text-base
                        hover:bg-white/[0.05] hover:border-white/40
                        active:scale-[0.98] cursor-pointer ${btnClass(7)}`}
                >
                    Get Started
                </button>
            </div>
        </div>
    );
}

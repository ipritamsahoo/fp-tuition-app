import { useState, useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { useStudentTheme } from "@/context/StudentThemeContext";

const STAGES = [
    { key: "requested", label: "Requested", sub: "Receipt Uploaded", icon: "check" },
    { key: "verifying", label: "Verifying", sub: "Admin Review", icon: "hourglass_top" },
    { key: "approved", label: "Approved", sub: "Payment Settled", icon: "check_circle" },
];

// ── Confetti Burst ─────────────────────────────────────────
function createConfetti(container, isLight) {
    if (!container) return;
    const colors = isLight
        ? ["#0d9488", "#059669", "#3b82f6", "#7c3aed", "#1a1a2e", "#ef4444"]
        : ["#4af8e3", "#20B2AA", "#3b82f6", "#c799ff", "#fff", "#ff9dac"];
    const particles = [];

    for (let i = 0; i < 28; i++) {
        const dot = document.createElement("span");
        dot.className = "confetti-particle";
        dot.style.background = colors[Math.floor(Math.random() * colors.length)];
        dot.style.width = `${3 + Math.random() * 5}px`;
        dot.style.height = dot.style.width;
        container.appendChild(dot);
        particles.push(dot);
    }

    gsap.fromTo(
        particles,
        { x: 0, y: 0, scale: 1, opacity: 1 },
        {
            x: () => (Math.random() - 0.5) * 120,
            y: () => (Math.random() - 0.5) * 90,
            scale: () => Math.random() * 0.5,
            opacity: 0,
            duration: 0.9,
            ease: "power2.out",
            stagger: { each: 0.015, from: "center" },
            onComplete: () => {
                particles.forEach((p) => p.remove());
            },
        }
    );
}

// ── Main Component ─────────────────────────────────────────
export default function PaymentProgressTracker({ status, mode, month, year, paused }) {
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    const trackFillRef = useRef(null);
    const nodesRef = useRef([]);
    const confettiAnchorRef = useRef(null);
    const containerRef = useRef(null);
    const pulseAnimRef = useRef(null);

    const isRejected = status === "Rejected";

    // Which step are we actually at data-wise?
    const activeStep =
        status === "Paid" ? 2 : isRejected ? 2 : status === "Pending_Verification" ? 1 : 0;

    // Visual step determines what classes are applied.
    // Starts 1 step behind so GSAP can animate the fill first.
    const [visualStep, setVisualStep] = useState(
        activeStep > 0 ? activeStep - 1 : 0
    );

    const setNodeRef = useCallback((el, idx) => {
        nodesRef.current[idx] = el;
    }, []);

    // Determine target fill width based on status
    const targetFill = activeStep >= 2 ? "100%" : activeStep >= 1 ? "50%" : "0%";

    // Pulse glow color based on theme
    const pulseColor = isLight ? "rgba(13,148,136,0.35)" : "rgba(16,185,129,0.45)";
    const pulseColorDim = isLight ? "rgba(13,148,136,0.1)" : "rgba(16,185,129,0.15)";

    useEffect(() => {
        if (paused) return;

        const fill = trackFillRef.current;
        const nodes = nodesRef.current;
        if (!fill) return;

        // Current width in DOM to determine whether we need to animate
        const currentWidthStr = fill.style.width || "0%";
        const wPct = parseFloat(currentWidthStr);

        if (!fill.style.width) {
            gsap.set(fill, { width: "0%" });
        }

        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

        // End pulse if we are moving past verifying
        if (activeStep >= 2 && pulseAnimRef.current) {
            pulseAnimRef.current.kill();
            pulseAnimRef.current = null;
        }

        if (activeStep === 1) {
            if (wPct < 50) {
                // Play 0 -> 50%
                tl.to(fill, { width: "50%", duration: 3.0, ease: "power2.inOut" });

                if (nodes[0]) {
                    tl.to(nodes[0], { scale: 1.15, duration: 0.3, ease: "back.out(2)" }, 0.1);
                    tl.to(nodes[0], { scale: 1, duration: 0.2 }, 0.4);
                }

                if (nodes[1]) {
                    tl.to(nodes[1], { scale: 1.15, duration: 0.3, ease: "back.out(2)" }, 3.0);
                    tl.to(nodes[1], { scale: 1, duration: 0.2 }, 3.3);

                    tl.call(() => {
                        setVisualStep(1);
                        pulseAnimRef.current = gsap.to(nodes[1], {
                            boxShadow: `0 0 18px 6px ${pulseColor}, 0 0 40px 12px ${pulseColorDim}`,
                            duration: 1.2,
                            yoyo: true,
                            repeat: -1,
                            ease: "sine.inOut",
                        });
                    }, null, 3.0);
                }
            } else {
                // Already at 50%
                setVisualStep(1);
                if (!pulseAnimRef.current && nodes[1]) {
                    pulseAnimRef.current = gsap.to(nodes[1], {
                        boxShadow: `0 0 18px 6px ${pulseColor}, 0 0 40px 12px ${pulseColorDim}`,
                        duration: 1.2,
                        yoyo: true,
                        repeat: -1,
                        ease: "sine.inOut",
                    });
                }
            }
        }
        else if (activeStep >= 2) {
            // Instantly ensure node 1 is green if we skipped stage 1
            if (visualStep < 1) setVisualStep(1);

            if (wPct < 100) {
                // Play towards 100%
                tl.to(fill, { width: "100%", duration: 1.5, ease: "power2.out" });

                if (nodes[2]) {
                    tl.to(nodes[2], { scale: 1.3, duration: 0.35, ease: "back.out(3)" }, "-=0.3");
                    tl.to(nodes[2], { scale: 1, duration: 0.25 });
                }

                tl.call(() => {
                    setVisualStep(2);
                    if (!isRejected) {
                        createConfetti(confettiAnchorRef.current, isLight);
                    }
                }, null, "-=0.2");
            } else {
                setVisualStep(activeStep);
            }
        }

        return () => {
            tl.kill();
        };
    }, [activeStep, paused]);

    // Don't render tracker for Unpaid
    if (status === "Unpaid") return null;

    // Node colors based on theme
    const activeNodeGradient = isLight
        ? "linear-gradient(to bottom right, #0d9488, #059669)"
        : "linear-gradient(to bottom right, #4af8e3, #20B2AA)";
    const activeNodeBorder = isLight ? "rgba(13,148,136,0.5)" : "rgba(74,248,227,0.5)";
    const activeNodeShadow = isLight ? "0 0 12px 3px rgba(13,148,136,0.2)" : "0 0 12px 3px rgba(74,248,227,0.3)";

    const verifyingNodeGradient = isLight
        ? "linear-gradient(to bottom right, #059669, #047857)"
        : "linear-gradient(to bottom right, #10b981, #059669)";
    const verifyingNodeBorder = isLight ? "rgba(5,150,105,0.6)" : "rgba(16,185,129,0.8)";

    const approvedNodeGradient = isLight
        ? "linear-gradient(to bottom right, #059669, #047857)"
        : "linear-gradient(to bottom right, #20B2AA, #008B8B)";
    const approvedNodeBorder = isLight ? "#0d9488" : "#4af8e3";

    const rejectedNodeGradient = isLight
        ? "linear-gradient(to bottom right, #ef4444, #be123c)"
        : "linear-gradient(to bottom right, #ff4b4b, #991b1b)";
    const rejectedNodeBorder = isLight ? "#ef4444" : "#ff4b4b";
    const rejectedNodeShadow = isLight ? "0 0 15px 4px rgba(239, 68, 68, 0.4)" : "0 0 20px 5px rgba(255, 75, 75, 0.5)";

    const fillGradient = isLight
        ? (isRejected ? "linear-gradient(90deg, #0d9488 0%, #059669 50%, #ef4444 50%, #ef4444 100%)" : "linear-gradient(90deg, #0d9488, #059669, #10b981)")
        : (isRejected ? "linear-gradient(90deg, #4af8e3 0%, #20B2AA 50%, #ff4b4b 50%, #ff4b4b 100%)" : "linear-gradient(90deg, #4af8e3, #20B2AA, #10b981)");

    const labelActiveColor = isLight ? '#0d9488' : '#4af8e3';
    const labelActiveSubColor = isLight ? 'rgba(13,148,136,0.5)' : 'rgba(74,248,227,0.6)';

    return (
        <div ref={containerRef} className="w-full mt-1">
            {/* ── Glassmorphism Tracker Container ── */}
            <div className="glass-tracker rounded-2xl sm:rounded-3xl px-4 sm:px-8 pt-6 sm:pt-8 pb-5 sm:pb-7">
                {/* ── Track ── */}
                <div className="relative flex items-center justify-between w-full">
                    {/* Background track line (contains the fill as a child) */}
                    <div
                        className="absolute top-[18px] sm:top-[22px] left-[16.66%] right-[16.66%] h-[3px] rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--st-tracker-track)' }}
                    >
                        {/* Animated fill line — width % is now relative to the track */}
                        <div
                            ref={trackFillRef}
                            className="h-full rounded-full"
                            style={{ background: fillGradient }}
                        />
                    </div>

                    {/* ── Nodes ── */}
                    {STAGES.map((stage, idx) => {
                        const isActive = idx <= visualStep;
                        const isCurrent = idx === visualStep && activeStep === visualStep;
                        const isApprovedDone = idx === 2 && visualStep >= 2;
                        
                        const stageLabel = (isRejected && idx === 2) ? "Rejected" : stage.label;
                        const stageSub = (isRejected && idx === 2) ? "Payment Declined" : stage.sub;
                        const stageIcon = (isRejected && idx === 2) ? "close" : stage.icon;

                        let nodeStyle = {};
                        if (isActive && idx < 1) {
                            nodeStyle = {
                                background: activeNodeGradient,
                                borderColor: activeNodeBorder,
                                boxShadow: activeNodeShadow,
                            };
                        } else if (isActive && idx === 1) {
                            nodeStyle = {
                                background: verifyingNodeGradient,
                                borderColor: verifyingNodeBorder,
                            };
                        } else if (!isActive) {
                            nodeStyle = {
                                backgroundColor: 'var(--st-tracker-node-inactive-bg)',
                                borderColor: 'var(--st-tracker-node-inactive-border)',
                            };
                        }

                        if (isApprovedDone) {
                            if (isRejected) {
                                nodeStyle = {
                                    background: rejectedNodeGradient,
                                    borderColor: rejectedNodeBorder,
                                    boxShadow: rejectedNodeShadow,
                                };
                            } else {
                                nodeStyle = {
                                    background: approvedNodeGradient,
                                    borderColor: approvedNodeBorder,
                                };
                            }
                        }

                        return (
                            <div
                                key={stage.key}
                                className="flex flex-col items-center z-10 relative"
                                style={{ flex: "0 0 auto", width: "33.33%" }}
                            >
                                {/* Node circle */}
                                <div
                                    ref={(el) => setNodeRef(el, idx)}
                                    className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-2 transition-colors duration-500 relative"
                                    style={nodeStyle}
                                >
                                    {isActive ? (
                                        <span className="material-symbols-outlined text-white text-base sm:text-lg material-symbols-filled drop-shadow-md">
                                            {idx === 1 && visualStep === 1 ? "hourglass_top" : (isRejected && idx === 2 ? "close" : "check")}
                                        </span>
                                    ) : (
                                        <span className="material-symbols-outlined text-base sm:text-lg" style={{ color: 'var(--st-tracker-label-inactive)' }}>
                                            {stageIcon}
                                        </span>
                                    )}

                                    {/* Confetti anchor (on Approved node) */}
                                    {idx === 2 && (
                                        <div
                                            ref={confettiAnchorRef}
                                            className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible"
                                        />
                                    )}
                                </div>

                                {/* Labels */}
                                <span
                                    className="mt-2 text-[10px] sm:text-xs font-bold tracking-wide leading-tight text-center"
                                    style={{ color: isActive ? (isRejected && idx === 2 ? (isLight ? '#ef4444' : '#ff6b81') : labelActiveColor) : 'var(--st-tracker-label-inactive)' }}
                                >
                                    {stageLabel}
                                </span>
                                <span
                                    className="text-[8px] sm:text-[10px] leading-tight text-center mt-0.5"
                                    style={{ color: isActive ? (isRejected && idx === 2 ? (isLight ? 'rgba(239,68,68,0.8)' : 'rgba(255,107,129,0.8)') : labelActiveSubColor) : 'var(--st-tracker-label-inactive)' }}
                                >
                                    {idx === 0
                                        ? (mode === "offline" ? "Offline Mode" : "Screenshot Uploaded")
                                        : stageSub}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Status Message ── */}
            {status === "Pending_Verification" && (
                <div className="mt-3 flex items-start sm:items-center gap-2 px-1">
                    <span className="material-symbols-outlined text-sm mt-0.5 sm:mt-0 shrink-0" style={{ color: labelActiveSubColor }}>info</span>
                    <p className="text-[11px] sm:text-xs leading-relaxed" style={{ color: 'var(--st-text-secondary)' }}>
                        Your payment for{" "}
                        <span className="font-semibold" style={{ color: 'var(--st-text-primary)' }}>
                            {month} {year}
                        </span>{" "}
                        is undergoing verification. Track progress above.
                    </p>
                </div>
            )}

            {status === "Paid" && (
                <div className="mt-3 flex items-start sm:items-center gap-2 px-1">
                    <span className="material-symbols-outlined text-[15px] sm:text-base mt-0.5 sm:mt-0 shrink-0 material-symbols-filled" style={{ color: 'var(--st-accent)' }}>verified</span>
                    <p className="text-[11px] sm:text-xs leading-relaxed font-medium" style={{ color: 'var(--st-accent)' }}>
                        Payment for{" "}
                        <span className="font-bold" style={{ color: 'var(--st-text-primary)' }}>
                            {month} {year}
                        </span>{" "}
                        has been verified and settled!
                    </p>
                </div>
            )}

            {isRejected && (
                <div className="mt-3 flex items-start sm:items-center gap-2 px-1">
                    <span className="material-symbols-outlined text-[15px] sm:text-base mt-0.5 sm:mt-0 shrink-0 material-symbols-filled text-red-500">error</span>
                    <p className="text-[11px] sm:text-xs leading-relaxed font-medium text-red-500">
                        Payment for{" "}
                        <span className="font-bold" style={{ color: 'var(--st-text-primary)' }}>
                            {month} {year}
                        </span>{" "}
                        has been rejected. Please contact support.
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * BadgeCelebrationOverlay.jsx
 * ─────────────────────────────────────────────
 * Full-screen immersive celebration animation that plays when a student
 * earns a badge (Prime / Golden / Silver). Uses canvas-confetti for
 * particle bursts and GSAP for choreographed motion.
 *
 * Sequence: Confetti → Profile pop → Badge orbit → Text reveal → Graceful exit
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import confetti from "canvas-confetti";
import ProfilePicture from "@/components/ProfilePicture";
import { api } from "@/lib/api";

// ── Badge visual definitions ──
const BADGE_CONFIG = {
    prime: {
        label: "Prime",
        icon: <span className="material-symbols-outlined" style={{ fontSize: "inherit", fontVariationSettings: "'FILL' 1" }}>bolt</span>,
        gradient: "linear-gradient(135deg, #00e5ff 0%, #651fff 50%, #00e5ff 100%)",
        glowColor: "rgba(0, 229, 255, 0.5)",
        glowColorAlt: "rgba(101, 31, 255, 0.35)",
        particleColors: ["#00e5ff", "#651fff", "#18ffff", "#b388ff", "#ffffff"],
        ringColor1: "#00e5ff",
        ringColor2: "#651fff",
    },
    golden: {
        label: "Golden",
        icon: <span className="material-symbols-outlined" style={{ fontSize: "inherit", fontVariationSettings: "'FILL' 1" }}>star</span>,
        gradient: "linear-gradient(135deg, #ffd700 0%, #ff8c00 50%, #ffd700 100%)",
        glowColor: "rgba(255, 215, 0, 0.5)",
        glowColorAlt: "rgba(255, 140, 0, 0.35)",
        particleColors: ["#ffd700", "#ff8c00", "#ffeb3b", "#ff6f00", "#ffffff"],
        ringColor1: "#ffd700",
        ringColor2: "#ff8c00",
    },
    silver: {
        label: "Silver",
        icon: <span className="material-symbols-outlined" style={{ fontSize: "inherit", fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>,
        gradient: "linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 50%, #a0a0a0 100%)",
        glowColor: "rgba(192, 192, 192, 0.45)",
        glowColorAlt: "rgba(160, 160, 160, 0.3)",
        particleColors: ["#c0c0c0", "#e8e8e8", "#a0a0a0", "#d4d4d4", "#ffffff"],
        ringColor1: "#c0c0c0",
        ringColor2: "#e8e8e8",
    },
};

// ── Confetti launcher ──
function launchCelebration(colors) {
    const duration = 3000;
    const end = Date.now() + duration;

    // Initial big burst
    confetti({
        particleCount: 150,
        spread: 180,
        origin: { y: 0.35 },
        colors,
        startVelocity: 45,
        gravity: 0.8,
        ticks: 300,
        shapes: ["circle", "square"],
        scalar: 1.2,
        zIndex: 100000,
    });

    // Side cannons
    setTimeout(() => {
        confetti({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.5 }, colors, startVelocity: 50, ticks: 250, zIndex: 100000 });
        confetti({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.5 }, colors, startVelocity: 50, ticks: 250, zIndex: 100000 });
    }, 300);

    // Continuous sparkle loop
    const interval = setInterval(() => {
        if (Date.now() > end) { clearInterval(interval); return; }
        confetti({
            particleCount: 8,
            spread: 360,
            origin: { x: Math.random(), y: Math.random() * 0.4 },
            colors,
            startVelocity: 15,
            gravity: 0.6,
            ticks: 200,
            scalar: 0.8,
            zIndex: 100000,
        });
    }, 200);

    return interval;
}


export default function BadgeCelebrationOverlay({ badgeTier, user, onComplete }) {
    const overlayRef = useRef(null);
    const centerGroupRef = useRef(null);
    const profileRef = useRef(null);
    const orbitContainerRef = useRef(null);
    const badgeIconRef = useRef(null);
    const glowRef = useRef(null);
    const titleRef = useRef(null);
    const subtitleRef = useRef(null);
    const sparkleIntervalRef = useRef(null);
    const [dismissed, setDismissed] = useState(false);
    const hasStartedRef = useRef(false);

    const config = useMemo(
        () => BADGE_CONFIG[badgeTier] || BADGE_CONFIG.silver,
        [badgeTier]
    );

    // Keep latest callbacks in a ref so they don't re-trigger the effect
    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    const clearBadgeFlag = useCallback(async () => {
        try {
            await api.patch("/api/student/badge-celebrated");
        } catch (err) {
            console.error("Failed to clear badge animation flag:", err);
        }
    }, []);

    useEffect(() => {
        if (dismissed) return;

        const overlay = overlayRef.current;
        const centerGroup = centerGroupRef.current;
        const profile = profileRef.current;
        const orbitContainer = orbitContainerRef.current;
        const badgeIcon = badgeIconRef.current;
        const glow = glowRef.current;
        const title = titleRef.current;
        const subtitle = subtitleRef.current;

        if (!overlay || !profile || !badgeIcon || !glow) return;

        // ── Kill any in-flight tweens on these elements ──
        gsap.killTweensOf([overlay, centerGroup, profile, orbitContainer, badgeIcon, glow, title, subtitle]);

        // ── Set initial states ──
        gsap.set(overlay, { opacity: 0 });
        gsap.set(centerGroup, { scale: 0.8, opacity: 0 });
        gsap.set(profile, { scale: 0, opacity: 0 });
        gsap.set(glow, { scale: 0.3, opacity: 0 });
        gsap.set(orbitContainer, { opacity: 0, scale: 0.5, rotation: 0 });
        gsap.set(badgeIcon, { scale: 0, opacity: 0, rotation: 0 });
        gsap.set(title, { opacity: 0, y: 40 });
        gsap.set(subtitle, { opacity: 0, y: 25 });

        const tl = gsap.timeline();

        // ─── Phase 1: Fade in backdrop (0s) ───
        tl.to(overlay, { opacity: 1, duration: 0.5, ease: "power2.out" });

        // ─── Confetti burst after overlay is visible ───
        tl.call(() => {
            sparkleIntervalRef.current = launchCelebration(config.particleColors);
        }, null, 0.15);

        // ─── Phase 2: Glow bloom ───
        tl.to(glow, { scale: 1, opacity: 0.7, duration: 1.0, ease: "back.out(1.2)" }, 0.3);

        // ─── Phase 3: Profile picture pops into center ───
        tl.to(centerGroup, { scale: 1, opacity: 1, duration: 0.5, ease: "power2.out" }, 0.5);
        tl.to(profile, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(2.5)" }, 0.6);

        // ─── Phase 4: Orbit ring + badge enters ───
        tl.to(orbitContainer, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.5)" }, 1.4);
        tl.to(badgeIcon, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(3)" }, 1.6);

        // Bounce
        tl.to(badgeIcon, { scale: 1.3, duration: 0.12, ease: "power2.out" }, 2.1);
        tl.to(badgeIcon, { scale: 1.0, duration: 0.25, ease: "elastic.out(1, 0.4)" }, 2.22);

        // ─── Phase 5: Text reveals ───
        tl.to(title, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 2.0);
        tl.to(subtitle, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 2.3);

        // ─── Start infinite loops only AFTER elements are fully visible ───
        tl.call(() => {
            gsap.to(orbitContainer, {
                rotation: 360,
                duration: 6,
                repeat: -1,
                ease: "none",
            });
            gsap.to(badgeIcon, {
                rotation: -360,
                duration: 6,
                repeat: -1,
                ease: "none",
            });
            gsap.to(glow, {
                scale: 1.12,
                opacity: 0.5,
                duration: 2.5,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
            });
        }, null, 2.5);

        // Stay alive — user must tap to dismiss (no auto-exit)

        return () => {
            tl.kill();
            gsap.killTweensOf([orbitContainer, badgeIcon, glow]);
            if (sparkleIntervalRef.current) clearInterval(sparkleIntervalRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dismissed]);

    if (dismissed) return null;

    // Sizes
    const profileSize = 140;
    const orbitRadius = 105; // orbit circle radius (distance from center to badge)
    const ringDiameter = orbitRadius * 2 + 10; // visible ring diameter

    return createPortal(
        <div
            ref={overlayRef}
            onClick={() => {
                if (sparkleIntervalRef.current) clearInterval(sparkleIntervalRef.current);
                gsap.to(overlayRef.current, {
                    opacity: 0,
                    duration: 0.5,
                    ease: "power2.in",
                    onComplete: () => {
                        setDismissed(true);
                        clearBadgeFlag();
                        if (onCompleteRef.current) onCompleteRef.current();
                    },
                });
            }}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "radial-gradient(ellipse at center, rgba(12,14,23,0.96) 0%, rgba(5,5,12,0.99) 100%)",
                cursor: "pointer",
                overflow: "hidden",
                opacity: 0,
            }}
        >
            {/* Ambient particles */}
            <div className="badge-celebration-particles" />

            {/* Glow bloom */}
            <div
                ref={glowRef}
                style={{
                    position: "absolute",
                    width: 420,
                    height: 420,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${config.glowColor} 0%, ${config.glowColorAlt} 40%, transparent 70%)`,
                    filter: "blur(50px)",
                    pointerEvents: "none",
                }}
            />

            {/* ── Central Group: profile + orbit ring + badge ── */}
            <div
                ref={centerGroupRef}
                style={{
                    position: "relative",
                    width: ringDiameter,
                    height: ringDiameter,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {/* Profile picture — dead center */}
                <div
                    ref={profileRef}
                    style={{
                        position: "absolute",
                        width: profileSize,
                        height: profileSize,
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "4px solid rgba(255,255,255,0.15)",
                        boxShadow: `0 0 40px ${config.glowColor}, 0 0 80px ${config.glowColorAlt}`,
                        zIndex: 3,
                    }}
                >
                    <ProfilePicture
                        size={profileSize}
                        showBadge={false}
                    />
                </div>

                {/* Orbit container — this entire div rotates */}
                <div
                    ref={orbitContainerRef}
                    style={{
                        position: "absolute",
                        width: ringDiameter,
                        height: ringDiameter,
                        borderRadius: "50%",
                        border: `2px solid rgba(255,255,255,0.08)`,
                        boxShadow: `inset 0 0 20px ${config.glowColorAlt}, 0 0 30px ${config.glowColorAlt}`,
                        zIndex: 4,
                    }}
                >
                    {/* Badge icon — positioned at the top of the orbit circle */}
                    <div
                        ref={badgeIconRef}
                        style={{
                            position: "absolute",
                            top: -22,
                            left: "50%",
                            marginLeft: -22,
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            background: config.gradient,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 24,
                            boxShadow: `0 2px 20px ${config.glowColor}, 0 0 40px ${config.glowColorAlt}`,
                            border: "3px solid rgba(255,255,255,0.25)",
                            zIndex: 5,
                        }}
                    >
                        {config.icon}
                    </div>
                </div>
            </div>

            {/* Title */}
            <h2
                ref={titleRef}
                style={{
                    position: "relative",
                    zIndex: 2,
                    marginTop: 28,
                    fontSize: "clamp(26px, 6vw, 40px)",
                    fontWeight: 800,
                    fontFamily: "'Manrope', sans-serif",
                    letterSpacing: "-0.02em",
                    background: config.gradient,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    textAlign: "center",
                }}
            >
                {config.label} Badge Earned!
            </h2>

            {/* Subtitle */}
            <p
                ref={subtitleRef}
                style={{
                    position: "relative",
                    zIndex: 2,
                    marginTop: 8,
                    fontSize: "clamp(14px, 3vw, 18px)",
                    color: "rgba(240,240,253,0.7)",
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    textAlign: "center",
                }}
            >
                Congratulations, {user?.name?.split(" ")[0] || "Champion"}! 🎉
            </p>

            {/* Tap to dismiss */}
            <p
                style={{
                    position: "absolute",
                    bottom: 40,
                    fontSize: 13,
                    color: "rgba(170,170,183,0.5)",
                    fontWeight: 400,
                    letterSpacing: "0.05em",
                    animation: "badgeCelebPulse 2s ease-in-out infinite",
                }}
            >
                Tap anywhere to continue
            </p>
        </div>,
        document.body
    );
}

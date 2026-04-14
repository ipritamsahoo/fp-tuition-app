import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { StudentThemeProvider, useStudentTheme } from "@/context/StudentThemeContext";
import ProfilePicture from "./ProfilePicture";
import NotificationPanel from "./NotificationPanel";
import ProfilePicUpload from "./ProfilePicUpload";

// ── Heavy inertia cubic-bezier(0.85, 0, 0.15, 1) solver ──
const heavyInertia = (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    const x1 = 0.85, y1 = 0, x2 = 0.15, y2 = 1;
    let t = progress;
    for (let i = 0; i < 8; i++) {
        const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
        const x = ((ax * t + bx) * t + cx) * t - progress;
        const dx = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(x) < 1e-7) break;
        t = Math.max(0, Math.min(1, t - x / dx));
    }
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return ((ay * t + by) * t + cy) * t;
};
const studentNav = [
    { label: "Dashboard", href: "/student", icon: "dashboard" },
    { label: "Payments", href: "/student/payments", icon: "payments" },
    { label: "Leaderboard", href: "/student/leaderboard", icon: "emoji_events" },
    { label: "Settings", href: "/student/settings", icon: "settings" },
];

function StudentLayoutInner({ children }) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { unreadCount } = useNotifications();
    const { user } = useAuth();
    const { theme } = useStudentTheme();
    const [notifOpen, setNotifOpen] = useState(false);

    const isLight = theme === "light";

    // Show mandatory upload modal if student has no profile pic yet
    const needsProfilePic = user && !user.profilePicUrl;
    const isLight2 = isLight; // alias for use in portal

    // ── Bottom nav: kinetic sliding indicator ──
    const activeIdx = studentNav.findIndex(item => pathname === item.href);
    const prevIdxRef = useRef(activeIdx);
    const rafRef = useRef(null);
    const iconRefs = useRef([]);
    const isAnimatingRef = useRef(false);

    useEffect(() => {
        const from = prevIdxRef.current;
        const to = activeIdx;
        if (from !== -1 && from !== to && to >= 0) {
            isAnimatingRef.current = true;
            const start = performance.now();
            const duration = 1500;

            const tick = (now) => {
                const raw = Math.min((now - start) / duration, 1);
                const eased = heavyInertia(raw);
                const pos = from + (to - from) * eased;

                studentNav.forEach((_, i) => {
                    const el = iconRefs.current[i];
                    if (!el) return;
                    const prox = Math.max(0, 1 - Math.abs(pos - i) * 1.4);
                    if (isLight) {
                        el.style.color = prox > 0.25 ? `rgba(255,255,255,${Math.min(prox * 1.5, 1)})` : 'var(--st-nav-icon-inactive)';
                    } else {
                        el.style.color = prox > 0.25 ? `rgba(255,255,255,${Math.min(prox * 1.5, 1)})` : 'rgba(59,89,152,0.5)';
                    }
                    el.style.transform = `scale(${1 + 0.14 * prox})`;
                    el.style.fontVariationSettings = prox > 0.4 ? "'FILL' 1" : "'FILL' 0";
                });

                if (raw < 1) {
                    rafRef.current = requestAnimationFrame(tick);
                } else {
                    isAnimatingRef.current = false;
                    iconRefs.current.forEach(el => {
                        if (el) { el.style.color = ''; el.style.transform = ''; el.style.fontVariationSettings = ''; }
                    });
                }
            };
            rafRef.current = requestAnimationFrame(tick);
            prevIdxRef.current = to;
            return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
        }
        prevIdxRef.current = to;
    }, [activeIdx, isLight]);

    const isSubPageMobile = pathname !== "/student" && 
                            pathname !== "/student/payments" && 
                            pathname !== "/student/leaderboard" && 
                            pathname !== "/student/settings";

    const getSubPageTitle = () => {
        const item = studentNav.find(i => i.href !== "/student" && pathname.startsWith(i.href));
        if (pathname === "/notifications") return "Notifications";
        return item ? item.label : "Back";
    };

    return (
        <div
            data-theme={theme}
            className="min-h-[100dvh] w-full overflow-x-hidden relative isolate"
            style={{
                fontFamily: "'Inter', sans-serif",
                backgroundColor: 'var(--st-page-bg)',
                color: 'var(--st-text-primary)',
            }}
        >
            {/* ── Ambient Backgrounds ── */}
            <div className="student-ambient-bg fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ transform: "translateZ(0)" }}>
                {/* Blue blob — top-left */}
                <div
                    className="ambient-blob-1 absolute -top-[10%] -left-[10%] w-[65%] h-[65%] blur-[100px]"
                    style={{
                        background: isLight
                            ? 'radial-gradient(circle, rgba(99,165,255,0.55) 0%, rgba(147,197,253,0.20) 50%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
                        transform: "translateZ(0)", willChange: "transform"
                    }}
                />
                {/* Purple blob — bottom-right */}
                <div
                    className="ambient-blob-2 absolute -bottom-[10%] -right-[10%] w-[70%] h-[70%] blur-[100px]"
                    style={{
                        background: isLight
                            ? 'radial-gradient(circle, rgba(167,139,250,0.45) 0%, rgba(196,181,253,0.15) 50%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
                        transform: "translateZ(0)", willChange: "transform"
                    }}
                />
                {/* Light-mode extra blobs for richer glassmorphism */}
                {isLight && (
                    <>
                        {/* Pink/rose blob — center-right for warmth */}
                        <div
                            className="absolute top-[25%] right-[5%] w-[55%] h-[55%] blur-[120px]"
                            style={{
                                background: 'radial-gradient(circle, rgba(251,146,173,0.30) 0%, rgba(253,164,186,0.10) 50%, transparent 70%)',
                                transform: "translateZ(0)"
                            }}
                        />
                        {/* Cyan blob — center-left for depth */}
                        <div
                            className="absolute top-[50%] -left-[5%] w-[45%] h-[45%] blur-[110px]"
                            style={{
                                background: 'radial-gradient(circle, rgba(103,232,249,0.25) 0%, transparent 70%)',
                                transform: "translateZ(0)"
                            }}
                        />
                    </>
                )}
            </div>

            {/* ── Mobile TopAppBar (Main Pages) ── */}
            {!isSubPageMobile && (
                <div className="md:hidden fixed top-4 left-4 right-4 z-50 overflow-hidden rounded-[28px] isolate">
                    <header
                        className="flex justify-between items-center px-5 h-14 animate-fade-in overflow-hidden"
                        style={{
                            background: 'var(--st-nav-bg)',
                            border: '1px solid var(--st-nav-border)',
                            boxShadow: 'var(--st-nav-shadow)',
                            backdropFilter: 'blur(28px) saturate(1.8)',
                            WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
                            transform: "translateZ(0)", isolation: "isolate"
                        }}
                    >
                    <div className="flex items-center gap-3" onClick={() => navigate("/student")}>
                        <div
                            className="w-10 h-10 rounded-full overflow-hidden shadow-lg flex items-center justify-center p-0.5"
                            style={{
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: 'var(--st-logo-border)',
                                backgroundColor: isLight ? '#f0f4ff' : '#0c0e17',
                                boxShadow: `0 4px 12px var(--st-logo-shadow)`,
                            }}
                        >
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-[1.1]" />
                        </div>
                        <h1
                            className="text-xl font-bold tracking-tighter"
                            style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}
                        >
                            FP Finance
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate("/notifications")}
                            className="relative transition-all active:scale-95 duration-200 cursor-pointer"
                            style={{ color: 'var(--st-text-secondary)' }}
                        >
                            <span className="material-symbols-outlined">notifications</span>
                            {unreadCount > 0 && (
                                <span
                                    className="absolute -top-1 -right-1 min-w-[16px] h-[16px] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse"
                                    style={{
                                        backgroundColor: '#ff6e84',
                                        borderWidth: 1,
                                        borderColor: isLight ? '#eef2ff' : '#0c0e17',
                                    }}
                                >
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>
                        <div 
                            className="transition-all cursor-pointer"
                            onClick={() => navigate("/student/settings")}
                        >
                            <ProfilePicture size={34} />
                        </div>
                    </div>
                </header>
                </div>
            )}

            {/* ── Mobile Header (Sub-Pages) ── */}
            {isSubPageMobile && (
                <header
                    className="md:hidden fixed top-0 w-full backdrop-blur-3xl flex items-center px-4 h-16 z-50 animate-fade-in-down shadow-xl"
                    style={{
                        backgroundColor: isLight ? 'rgba(238,242,255,0.9)' : 'rgba(12,14,23,0.9)',
                        borderBottom: `1px solid var(--st-divider)`,
                        transform: "translateZ(0)", isolation: "isolate"
                    }}
                >
                    <button 
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl active:scale-90 transition-all mr-3"
                        style={{
                            backgroundColor: 'var(--st-icon-bg)',
                            color: 'var(--st-text-secondary)',
                        }}
                    >
                        <span className="material-symbols-outlined">arrow_back_ios_new</span>
                    </button>
                    <div>
                        <h1
                            className="text-lg font-bold tracking-tight leading-none"
                            style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}
                        >
                            {getSubPageTitle()}
                        </h1>
                    </div>
                </header>
            )}

            {/* ── Desktop Sidebar ── */}
            <aside
                className="hidden md:flex fixed top-0 left-0 h-full z-40 w-64 flex-col"
                style={{
                    backgroundColor: 'var(--st-sidebar-bg)',
                    borderRight: `1px solid var(--st-divider)`,
                    boxShadow: isLight
                        ? '4px 0 24px rgba(0,0,0,0.05), inset -1px 0 0 rgba(255,255,255,0.5)'
                        : '20px 0 40px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(32px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
                    transform: "translateZ(0)", isolation: "isolate"
                }}
            >
                {/* Logo Section */}
                <div className="p-6 relative overflow-hidden group" style={{ borderBottom: `1px solid var(--st-divider)` }}>
                    <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: `linear-gradient(to bottom right, ${isLight ? 'rgba(13,148,136,0.05)' : 'rgba(59,130,246,0.05)'}, transparent)` }}
                    />
                    <div className="relative z-10 flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded-full overflow-hidden shadow-lg group-hover:scale-110 transition-transform duration-300 flex items-center justify-center p-0.5"
                            style={{
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: 'var(--st-logo-border)',
                                backgroundColor: isLight ? '#f0f4ff' : '#0c0e17',
                                boxShadow: `0 4px 12px var(--st-logo-shadow)`,
                            }}
                        >
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-[1.1]" />
                        </div>
                        <div>
                            <h1
                                className="text-sm font-extrabold tracking-tight"
                                style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}
                            >
                                FP Finance
                            </h1>
                            <p className="text-[11px] font-medium uppercase tracking-widest opacity-70" style={{ color: 'var(--st-text-secondary)' }}>
                                Future Point
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation Scroll */}
                <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto custom-scrollbar">
                    {studentNav.map((item) => {
                        const isActive = pathname === item.href;
                        const activeColor = isLight ? '#0d9488' : '#3b82f6';
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 group"
                                style={{
                                    backgroundColor: isActive ? (isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)') : 'transparent',
                                    color: isActive ? activeColor : 'var(--st-text-secondary)',
                                    border: isActive ? `1px solid ${isLight ? 'rgba(13,148,136,0.2)' : 'rgba(59,130,246,0.2)'}` : '1px solid transparent',
                                    boxShadow: isActive ? `0 0 20px ${isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)'}` : 'none',
                                }}
                            >
                                <span className={`material-symbols-outlined text-[22px] transition-transform group-hover:scale-110 ${isActive ? "material-symbols-filled" : ""}`}>{item.icon}</span>
                                <span style={{ fontFamily: "'Manrope', sans-serif" }}>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

            </aside>

            {/* ── Desktop Top Nav (Notifications & Profile) ── */}
            <div className="hidden md:flex fixed top-0 right-0 z-50 p-6 items-center gap-5">
                {/* Notification Bell */}
                <div className="relative">
                    <button 
                        onClick={() => setNotifOpen(true)}
                        className="relative transition-all active:scale-95 duration-200 cursor-pointer w-10 h-10 flex items-center justify-center rounded-full shadow-lg"
                        style={{
                            color: 'var(--st-text-secondary)',
                            backgroundColor: isLight ? 'rgba(255,255,255,0.40)' : 'rgba(23,25,36,0.6)',
                            border: isLight ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(70,71,82,0.5)',
                            backdropFilter: 'blur(24px) saturate(1.6)',
                            WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
                            boxShadow: isLight
                                ? '0 4px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6)'
                                : '0 4px 12px rgba(0,0,0,0.3)',
                            transform: "translateZ(0)", isolation: "isolate"
                        }}
                    >
                        <span className="material-symbols-outlined text-[24px]">notifications</span>
                        {unreadCount > 0 && (
                            <span
                                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse"
                                style={{
                                    backgroundColor: '#ff6e84',
                                    boxShadow: '0 0 10px rgba(255,110,132,0.4)',
                                    borderWidth: 1,
                                    borderColor: isLight ? '#eef2ff' : '#0c0e17',
                                }}
                            >
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>
                    <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
                </div>

                {/* Profile Picture */}
                <div 
                    className="flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                    onClick={() => navigate("/student/settings")}
                >
                    <ProfilePicture size={40} />
                </div>
            </div>

            {/* ── Main Content ── */}
            <main 
                className={`relative z-10 md:ml-64 min-h-screen flex flex-col pt-28 ${!isSubPageMobile ? "pb-24" : "pb-12"} md:pt-8 md:pb-8 px-6 md:px-12`}
                style={{ transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", contain: "paint layout", scrollbarGutter: "stable" }}
            >
                <div className="max-w-4xl w-full mx-auto flex-1">
                    {children}
                </div>
            </main>

            {/* ── Mandatory Profile Pic Upload ── */}
            {/* Shown to students who have no profile picture yet. Non-dismissible. */}
            {needsProfilePic && (
                <ProfilePicUpload
                    isOpen={true}
                    onClose={() => {}}
                    mandatory={true}
                />
            )}

            {/* ── Mobile Bottom Navigation ── */}
            {!isSubPageMobile && (
                <div className="md:hidden fixed bottom-6 left-4 right-4 z-40 overflow-hidden rounded-[28px] isolate">
                    <nav
                        className="relative flex items-center overflow-hidden"
                        style={{
                            background: 'var(--st-nav-bg)',
                            border: '1px solid var(--st-nav-border)',
                            boxShadow: 'var(--st-nav-shadow)',
                            backdropFilter: 'blur(28px) saturate(1.8)',
                            WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
                            transform: "translateZ(0)", isolation: "isolate"
                        }}
                    >
                        {activeIdx >= 0 && (
                            <div
                                className="absolute top-1/2 -translate-y-1/2 z-0 flex items-center justify-center pointer-events-none will-change-[left]"
                                style={{
                                    width: `${100 / studentNav.length}%`,
                                    left: `${activeIdx * (100 / studentNav.length)}%`,
                                    transition: 'left 1500ms cubic-bezier(0.85, 0, 0.15, 1)',
                                }}
                            >
                                <div
                                    className="w-12 h-12 rounded-full"
                                    style={{
                                        backgroundColor: 'var(--st-nav-indicator)',
                                        boxShadow: `0 4px 20px ${isLight ? 'rgba(13,148,136,0.4)' : 'rgba(59,130,246,0.5)'}`,
                                    }}
                                />
                            </div>
                        )}
                        {studentNav.map((item, i) => {
                            const isActive = i === activeIdx;
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className="flex-1 relative z-10 flex items-center justify-center h-[60px] rounded-full active:scale-90"
                                >
                                    <span
                                        ref={el => iconRefs.current[i] = el}
                                        className="material-symbols-outlined text-[22px]"
                                        style={{
                                            color: isActive ? '#ffffff' : 'var(--st-nav-icon-inactive)',
                                            transform: isActive ? 'scale(1.14)' : 'scale(1)',
                                            fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                                            willChange: 'transform, color',
                                        }}
                                    >
                                        {item.icon}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            )}

            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: ${isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)'};
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${isLight ? 'rgba(13,148,136,0.3)' : 'rgba(59,130,246,0.3)'};
                }
                @keyframes fade-in-down {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-fade-in-down {
                    animation: fade-in-down 0.4s ease-out;
                }
            `}} />
        </div>
    );
}

export default function StudentLayout({ children }) {
    return (
        <StudentThemeProvider>
            <StudentLayoutInner>{children}</StudentLayoutInner>
        </StudentThemeProvider>
    );
}

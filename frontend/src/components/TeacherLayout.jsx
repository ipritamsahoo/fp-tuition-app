import { useState, useRef, useEffect } from "react";
import logoSrc from "@/assets/logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { TeacherThemeProvider, useTeacherTheme } from "@/context/TeacherThemeContext";
import ProfilePicture from "./ProfilePicture";
import NotificationPanel from "./NotificationPanel";

// ── Springy easeOutBack solver for bottom bar indicators ──
const easeOutBack = (x) => {
    const c1 = 1.2;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const teacherNav = [
    { label: "Dashboard", href: "/teacher", icon: "dashboard" },
    { label: "Payments", href: "/teacher/payments", icon: "payments" },
    { label: "Distribution", href: "/teacher/distribution", icon: "account_tree" },
    { label: "Notes", href: "/teacher/notes", icon: "edit_document" },
    { label: "Notices", href: "/teacher/notices", icon: "campaign" },
    { label: "Settings", href: "/teacher/settings", icon: "settings" },
];
const teacherBottomNav = [
    { label: "Dashboard", href: "/teacher", icon: "dashboard" },
    { label: "Payments", href: "/teacher/payments", icon: "payments" },
    { label: "Distribution", href: "/teacher/distribution", icon: "account_tree" },
    { label: "Notes", href: "/teacher/notes", icon: "edit_document" },
    { label: "Settings", href: "/teacher/settings", icon: "settings" },
];

function TeacherLayoutInner({ children }) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { unreadCount } = useNotifications();
    const { user } = useAuth();
    const { theme } = useTeacherTheme();
    const [notifOpen, setNotifOpen] = useState(false);

    const isLight = theme === "light";

    // ── Bottom nav: kinetic sliding indicator ──
    const activeIdx = teacherBottomNav.findIndex(item => pathname === item.href);

    // Retrieve previous active index from sessionStorage to animate across page mounts
    const savedPrevIdx = sessionStorage.getItem("prevActiveIdx_teacher");
    const initialPrevIdx = savedPrevIdx !== null ? Number(savedPrevIdx) : activeIdx;

    const [indicatorIdx, setIndicatorIdx] = useState(initialPrevIdx);
    const prevIdxRef = useRef(initialPrevIdx);
    const rafRef = useRef(null);
    const iconRefs = useRef([]);
    const isAnimatingRef = useRef(false);

    // Save active index to sessionStorage on change
    useEffect(() => {
        if (activeIdx >= 0) {
            sessionStorage.setItem("prevActiveIdx_teacher", activeIdx);
        }
    }, [activeIdx]);

    // Slide indicator position on activeIdx change
    useEffect(() => {
        if (indicatorIdx !== activeIdx && activeIdx >= 0) {
            const timer = setTimeout(() => {
                setIndicatorIdx(activeIdx);
            }, 30);
            return () => clearTimeout(timer);
        }
    }, [activeIdx, indicatorIdx]);

    useEffect(() => {
        const from = prevIdxRef.current;
        const to = activeIdx;
        if (from !== -1 && from !== to && to >= 0) {
            const timer = setTimeout(() => {
                isAnimatingRef.current = true;
                const start = performance.now();
                const duration = 500;

                const tick = (now) => {
                    const raw = Math.min((now - start) / duration, 1);
                    const eased = easeOutBack(raw);
                    const pos = from + (to - from) * eased;

                    teacherBottomNav.forEach((_, i) => {
                        const el = iconRefs.current[i];
                        if (!el) return;
                        const prox = Math.max(0, 1 - Math.abs(pos - i) * 1.4);
                        el.style.color = prox > 0.25 ? `rgba(255,255,255,${Math.min(prox * 1.5, 1)})` : 'var(--tt-nav-icon-inactive)';
                        el.style.transform = `scale(${1 + 0.14 * prox})`;
                        el.style.fontVariationSettings = prox > 0.4 ? "'FILL' 1" : "'FILL' 0";
                    });

                    if (raw < 1) {
                        rafRef.current = requestAnimationFrame(tick);
                    } else {
                        isAnimatingRef.current = false;
                        iconRefs.current.forEach((el, i) => {
                            if (!el) return;
                            if (i === to) {
                                el.style.color = '#ffffff';
                                el.style.transform = 'scale(1.14)';
                                el.style.fontVariationSettings = "'FILL' 1";
                            } else {
                                el.style.color = 'var(--tt-nav-icon-inactive)';
                                el.style.transform = 'scale(1)';
                                el.style.fontVariationSettings = "'FILL' 0";
                            }
                        });
                    }
                };
                rafRef.current = requestAnimationFrame(tick);
            }, 30);
            prevIdxRef.current = to;
            return () => {
                clearTimeout(timer);
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
            };
        }
        prevIdxRef.current = to;
    }, [activeIdx, isLight]);

    const isSubPageMobile = pathname !== "/teacher" &&
        pathname !== "/teacher/payments" &&
        pathname !== "/teacher/distribution" &&
        pathname !== "/teacher/notes" &&
        pathname !== "/teacher/settings";

    const isSettings = pathname === "/teacher/settings";

    const getSubPageTitle = () => {
        const item = teacherNav.find(i => i.href !== "/teacher" && pathname.startsWith(i.href));
        if (pathname === "/notifications") return "Notifications";
        return item ? item.label : "Back";
    };

    return (
        <div 
            data-theme={theme}
            className="min-h-[100dvh] w-full overflow-x-hidden relative isolate" 
            style={{ 
                fontFamily: "'Inter', sans-serif",
                backgroundColor: 'var(--tt-page-bg)',
                color: 'var(--tt-text-primary)'
            }}
        >
            {/* ── Ambient Backgrounds ── */}
            <div className="teacher-ambient-bg fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ transform: "translateZ(0)" }}>
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
                {/* Purple/other blob — bottom-right */}
                <div
                    className="ambient-blob-2 absolute -bottom-[10%] -right-[10%] w-[70%] h-[70%] blur-[100px]"
                    style={{
                        background: isLight
                            ? 'radial-gradient(circle, rgba(167,139,250,0.45) 0%, rgba(196,181,253,0.15) 50%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
                        transform: "translateZ(0)", willChange: "transform"
                    }}
                />
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
            {!isSubPageMobile && !isSettings && (
                <header
                    className="md:hidden fixed top-4 left-4 right-4 z-50 flex justify-between items-center pl-3 pr-5 h-14 backdrop-blur-2xl animate-fade-in overflow-hidden rounded-[28px]"
                    style={{ 
                        background: 'var(--tt-nav-bg)',
                        border: '1px solid var(--tt-nav-border)',
                        boxShadow: 'var(--tt-nav-shadow)',
                        transform: "translateZ(0)", 
                        isolation: "isolate" 
                    }}
                >
                    <div className="flex items-center gap-3" onClick={() => navigate("/teacher")}>
                        <div 
                            className="w-10 h-10 rounded-full overflow-hidden shadow-lg flex items-center justify-center"
                            style={{
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: 'var(--tt-logo-border)',
                                backgroundColor: isLight ? '#f0f4ff' : '#0c0e17',
                                boxShadow: `0 4px 12px var(--tt-logo-shadow)`,
                            }}
                        >
                            <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <h1 
                            className="text-xl font-bold tracking-tighter" 
                            style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}
                        >
                            FP Finance
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate("/teacher/notices")}
                            className="relative flex items-center justify-center transition-all active:scale-95 duration-200 cursor-pointer"
                            style={{ color: 'var(--tt-text-secondary)' }}
                        >
                            <span className="material-symbols-outlined">campaign</span>
                        </button>
                        <button
                            onClick={() => navigate("/notifications")}
                            className="relative flex items-center justify-center transition-all active:scale-95 duration-200 cursor-pointer"
                            style={{ color: 'var(--tt-text-secondary)' }}
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
                            onClick={() => navigate("/teacher/settings")}
                        >
                            <ProfilePicture size={34} />
                        </div>
                    </div>
                </header>
            )}

            {/* ── Mobile Header (Sub-Pages) ── */}
            {isSubPageMobile && (
                <header
                    className={`md:hidden fixed top-0 w-full flex items-center px-4 h-16 z-50 ${pathname === "/teacher/notices" ? "" : "animate-fade-in-down"}`}
                    style={{
                        background: 'var(--tt-nav-bg)',
                        borderBottom: '1px solid var(--tt-nav-border)',
                        boxShadow: 'var(--tt-nav-shadow)',
                        backdropFilter: 'blur(28px) saturate(1.8)',
                        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
                        transform: "translateZ(0)", isolation: "isolate"
                    }}
                >
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl active:scale-90 transition-all mr-3"
                        style={{
                            backgroundColor: 'var(--tt-icon-bg)',
                            color: 'var(--tt-text-secondary)',
                        }}
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 
                            className="text-lg font-bold tracking-tight leading-none" 
                            style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}
                        >
                            {getSubPageTitle()}
                        </h1>
                    </div>
                    <div className="flex-grow" />

                </header>
            )}

            {/* ── Desktop Sidebar ── */}
            <aside
                className="hidden md:flex fixed top-0 left-0 h-full z-40 w-64 flex-col"
                style={{ 
                    backgroundColor: 'var(--tt-sidebar-bg)',
                    borderRight: `1px solid var(--tt-divider)`,
                    boxShadow: isLight
                        ? '4px 0 24px rgba(0,0,0,0.05), inset -1px 0 0 rgba(255,255,255,0.5)'
                        : '20px 0 40px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(32px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
                    transform: "translateZ(0)", isolation: "isolate"
                }}
            >
                {/* Logo Section */}
                <div className="p-6 relative overflow-hidden group" style={{ borderBottom: `1px solid var(--tt-divider)` }}>
                    <div 
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
                        style={{ background: `linear-gradient(to bottom right, ${isLight ? 'rgba(13,148,136,0.05)' : 'rgba(59,130,246,0.05)'}, transparent)` }}
                    />
                    <div className="relative z-10 flex items-center gap-3">
                        <div 
                            className="w-12 h-12 rounded-full overflow-hidden shadow-lg group-hover:scale-110 transition-transform duration-300 flex items-center justify-center"
                            style={{
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: 'var(--tt-logo-border)',
                                backgroundColor: isLight ? '#f0f4ff' : '#0c0e17',
                                boxShadow: `0 4px 12px var(--tt-logo-shadow)`,
                            }}
                        >
                            <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h1 
                                className="text-sm font-extrabold tracking-tight" 
                                style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}
                            >
                                FP Finance
                            </h1>
                            <p 
                                className="text-[11px] font-medium uppercase tracking-widest opacity-70"
                                style={{ color: 'var(--tt-text-secondary)' }}
                            >
                                Future Point
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation Scroll */}
                <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto custom-scrollbar">
                    {teacherNav.map((item) => {
                        const isActive = pathname === item.href;
                        const activeColor = isLight ? '#0d9488' : '#3b82f6';
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 group"
                                style={{
                                    backgroundColor: isActive ? 'var(--tt-blue-bg)' : 'transparent',
                                    color: isActive ? activeColor : 'var(--tt-text-secondary)',
                                    border: isActive ? `1px solid ${isLight ? 'rgba(13,148,136,0.2)' : 'rgba(59,130,246,0.2)'}` : '1px solid transparent',
                                    boxShadow: isActive ? `0 0 20px ${isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)'}` : 'none',
                                }}
                            >
                                <span className={`material-symbols-outlined text-[22px] transition-transform group-hover:scale-110 ${isActive ? "material-symbols-filled" : ""}`}>
                                    {item.icon}
                                </span>
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
                            color: 'var(--tt-text-secondary)',
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
                    onClick={() => navigate("/teacher/settings")}
                >
                    <ProfilePicture size={40} />
                </div>
            </div>

            {/* ── Main Content ── */}
            <main
                className={`relative z-10 md:ml-64 min-h-screen flex flex-col ${isSettings ? "pt-8" : (isSubPageMobile ? "pt-20" : "pt-28")} ${!isSubPageMobile ? "pb-24" : "pb-12"} md:pt-8 md:pb-8 px-6 md:px-12`}
                style={{ scrollbarGutter: "stable" }}
            >
                <div className="max-w-7xl w-full mx-auto flex-1">
                    {children}
                </div>
            </main>

            {/* ── Mobile Bottom Navigation ── */}
            {!isSubPageMobile && (
                <nav
                    className="md:hidden fixed bottom-6 left-4 right-4 z-40 overflow-hidden rounded-[28px] isolate flex items-center"
                    style={{ 
                        background: 'var(--tt-nav-bg)',
                        border: '1px solid var(--tt-nav-border)',
                        boxShadow: 'var(--tt-nav-shadow)',
                        backdropFilter: 'blur(28px) saturate(1.8)',
                        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
                        transform: "translateZ(0)", isolation: "isolate" 
                    }}
                >
                    {activeIdx >= 0 && (
                        <div
                            className="absolute top-1/2 -translate-y-1/2 z-0 flex items-center justify-center pointer-events-none will-change-[left]"
                            style={{
                                width: `${100 / teacherBottomNav.length}%`,
                                left: `${indicatorIdx * (100 / teacherBottomNav.length)}%`,
                                transition: 'left 500ms cubic-bezier(0.34, 1.3, 0.64, 1)',
                            }}
                        >
                            <div 
                                className="w-12 h-12 rounded-full" 
                                style={{
                                    backgroundColor: 'var(--tt-nav-indicator)',
                                    boxShadow: `0 0 10px ${isLight ? 'rgba(13,148,136,0.4)' : 'rgba(59,130,246,0.4)'}`,
                                }}
                            />
                        </div>
                    )}
                    {teacherBottomNav.map((item, i) => {
                        const isActive = i === indicatorIdx;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                onClick={() => {
                                    if (navigator.vibrate) navigator.vibrate(40);
                                }}
                                className="flex-1 relative z-10 flex items-center justify-center h-[60px] rounded-full active:scale-90"
                            >
                                <span
                                    ref={el => iconRefs.current[i] = el}
                                    className="material-symbols-outlined text-[22px]"
                                    style={{
                                        color: isActive ? '#ffffff' : 'var(--tt-nav-icon-inactive)',
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
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
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

export default function TeacherLayout({ children }) {
    return (
        <TeacherThemeProvider>
            <TeacherLayoutInner>{children}</TeacherLayoutInner>
        </TeacherThemeProvider>
    );
}


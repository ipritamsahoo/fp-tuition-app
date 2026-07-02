import { useState, useRef, useEffect } from "react";
import logoSrc from "@/assets/logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import ProfilePicture from "./ProfilePicture";
import NotificationPanel from "./NotificationPanel";
import ProfilePicUpload from "./ProfilePicUpload";
import AppLockSetting from "./AppLockSetting";
import { AdminThemeProvider, useAdminTheme } from "@/context/AdminThemeContext";

// ── Springy easeOutBack solver for bottom bar indicators ──
const easeOutBack = (x) => {
    const c1 = 1.2;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// ── Custom Scroll Bounce Hook (only bounces content, not fixed nav) ──
function useScrollBounce(isDisabled) {
    const elementRef = useRef(null);
    const startYRef = useRef(0);
    const startXRef = useRef(0);
    const isAtTopRef = useRef(false);
    const isAtBottomRef = useRef(false);
    const isDraggingRef = useRef(false);
    const accumulatedBounceRef = useRef(0);
    const decayRafRef = useRef(null);

    useEffect(() => {
        if (isDisabled) return;

        const el = elementRef.current;
        if (!el) return;

        const getScrollMetrics = () => {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = document.documentElement.clientHeight;
            return { scrollTop, scrollHeight, clientHeight };
        };

        const handleTouchStart = (e) => {
            if (e.touches.length !== 1) return;
            if (!el.contains(e.target)) return;

            if (decayRafRef.current) {
                cancelAnimationFrame(decayRafRef.current);
                decayRafRef.current = null;
            }

            const { scrollTop, scrollHeight, clientHeight } = getScrollMetrics();
            startYRef.current = e.touches[0].clientY;
            startXRef.current = e.touches[0].clientX;
            isAtTopRef.current = scrollTop <= 1;
            isAtBottomRef.current = (scrollTop + clientHeight) >= (scrollHeight - 2);
            isDraggingRef.current = true;
            accumulatedBounceRef.current = 0;
            el.style.transition = "none";
        };

        const handleTouchMove = (e) => {
            if (!isDraggingRef.current) return;
            if (!el.contains(e.target)) return;

            const dy = e.touches[0].clientY - startYRef.current;
            const dx = e.touches[0].clientX - startXRef.current;

            if (Math.abs(dy) > Math.abs(dx)) {
                if (isAtTopRef.current && dy > 0) {
                    const bounce = Math.pow(dy, 0.7) * 1.5;
                    el.style.transform = `translate3d(0, ${bounce}px, 0)`;
                    accumulatedBounceRef.current = bounce;
                    if (e.cancelable) e.preventDefault();
                } else if (isAtBottomRef.current && dy < 0) {
                    const bounce = -Math.pow(-dy, 0.7) * 1.5;
                    el.style.transform = `translate3d(0, ${bounce}px, 0)`;
                    accumulatedBounceRef.current = bounce;
                    if (e.cancelable) e.preventDefault();
                }
            }
        };

        const handleTouchEnd = () => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            if (accumulatedBounceRef.current !== 0) {
                el.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
                el.style.transform = "translate3d(0, 0, 0)";
                accumulatedBounceRef.current = 0;
            }
        };

        const handleWheel = (e) => {
            if (!el.contains(e.target)) return;
            const { scrollTop, scrollHeight, clientHeight } = getScrollMetrics();
            const dy = e.deltaY;

            if ((scrollTop <= 1 && dy < 0) || ((scrollTop + clientHeight) >= (scrollHeight - 2) && dy > 0)) {
                if (decayRafRef.current) cancelAnimationFrame(decayRafRef.current);

                el.style.transition = "none";
                let targetBounce = accumulatedBounceRef.current - dy * 0.15;
                targetBounce = dy < 0 ? Math.min(80, targetBounce) : Math.max(-80, targetBounce);
                accumulatedBounceRef.current = targetBounce;
                el.style.transform = `translate3d(0, ${accumulatedBounceRef.current}px, 0)`;

                const decay = () => {
                    accumulatedBounceRef.current *= 0.82;
                    if (Math.abs(accumulatedBounceRef.current) < 0.5) {
                        accumulatedBounceRef.current = 0;
                        el.style.transform = "";
                    } else {
                        el.style.transform = `translate3d(0, ${accumulatedBounceRef.current}px, 0)`;
                        decayRafRef.current = requestAnimationFrame(decay);
                    }
                };
                decayRafRef.current = requestAnimationFrame(decay);
            }
        };

        window.addEventListener("touchstart", handleTouchStart, { passive: false });
        window.addEventListener("touchmove",  handleTouchMove,  { passive: false });
        window.addEventListener("touchend",   handleTouchEnd,   { passive: false });
        window.addEventListener("wheel",      handleWheel,      { passive: false });

        return () => {
            window.removeEventListener("touchstart", handleTouchStart);
            window.removeEventListener("touchmove",  handleTouchMove);
            window.removeEventListener("touchend",   handleTouchEnd);
            window.removeEventListener("wheel",      handleWheel);
            if (decayRafRef.current) cancelAnimationFrame(decayRafRef.current);
            if (el) { el.style.transform = ""; el.style.transition = ""; }
        };
    }, [isDisabled]);

    return elementRef;
}


const adminBottomNav = [
    { label: "Home", href: "/admin", icon: "home" },
    { label: "Approvals", href: "/admin/approvals", icon: "fact_check" },
    { label: "Payments", href: "/admin/payments", icon: "payments" },
    { label: "Distribution", href: "/admin/distribution", icon: "account_tree" },
];

const adminFabNav = [
    { label: "Students", href: "/admin/students", icon: "school" },
    { label: "Teachers", href: "/admin/teachers", icon: "person" },
    { label: "Batches", href: "/admin/batches", icon: "assignment" },
    { label: "Reports", href: "/admin/reports", icon: "description" },
];

// Combined flat nav for desktop sidebar
const adminSidebarNav = [...adminBottomNav, ...adminFabNav];

export function AdminLayoutInner({ children }) {
    const { theme, toggleTheme } = useAdminTheme();
    const isLight = theme === "light";
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { unreadCount, pushEnabled, togglePushNotifications } = useNotifications() || {};
    const { user, logout } = useAuth();
    const [fabOpen, setFabOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [desktopProfileOpen, setDesktopProfileOpen] = useState(false);
    const [picUploadOpen, setPicUploadOpen] = useState(false);
    const profileDropdownRef = useRef(null);

    const bounceRef = useScrollBounce(false);

    // Draggable FAB alignment states
    const [fabAlign, setFabAlign] = useState("right");
    const [dragX, setDragX] = useState(null);
    const dragStartRef = useRef({ x: 0, buttonX: 0 });
    const hasMovedRef = useRef(false);

    const handlePointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const actualWidth = 56;
        const untransformedLeft = rect.left + (rect.width - actualWidth) / 2;
        
        dragStartRef.current = {
            x: e.clientX,
            buttonX: untransformedLeft
        };
        hasMovedRef.current = false;
        setDragX(dragStartRef.current.buttonX);
    };

    const handlePointerMove = (e) => {
        if (dragX === null) return;
        const deltaX = e.clientX - dragStartRef.current.x;
        // If movement is more than 8 pixels, mark as drag
        if (Math.abs(deltaX) > 8) {
            hasMovedRef.current = true;
        }
        let newX = dragStartRef.current.buttonX + deltaX;
        const btnWidth = 56; // 14rem is 56px
        // Constrain within screen viewport (16px padding on edges)
        newX = Math.max(16, Math.min(newX, window.innerWidth - 16 - btnWidth));
        setDragX(newX);
    };

    const handlePointerUp = (e) => {
        if (dragX === null) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        
        if (hasMovedRef.current) {
            const btnWidth = 56;
            const midPoint = window.innerWidth / 2;
            const finalCenter = dragX + btnWidth / 2;
            
            // Snap to nearest side
            if (finalCenter < midPoint) {
                setFabAlign("left");
            } else {
                setFabAlign("right");
            }
        }
        setDragX(null);
    };

    const handlePointerCancel = (e) => {
        if (dragX === null) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        setDragX(null);
    };

    const handleFabClick = (e) => {
        if (hasMovedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        setFabOpen(!fabOpen);
    };

    // PWA manual update checking states
    const [updateChecking, setUpdateChecking] = useState(false);
    const [toast, setToast] = useState({ show: false, message: "", type: "" });

    const handleCheckUpdate = async () => {
        setDesktopProfileOpen(false);
        setUpdateChecking(true);
        const result = await window.checkForPwaUpdate();
        setUpdateChecking(false);

        if (result === "up_to_date") {
            window.dispatchEvent(new Event("pwa-up-to-date"));
        } else if (result === "error") {
            setToast({
                show: true,
                message: "Failed to check for updates. Try again later.",
                type: "error"
            });
            setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
        }
    };

    // Close profile dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setDesktopProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Disable body scroll when FAB menu is open on mobile
    useEffect(() => {
        if (fabOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [fabOpen]);

    // ── Bottom nav: kinetic sliding indicator ──
    const activeIdx = adminBottomNav.findIndex(item =>
        pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
    );
    
    // Retrieve previous active index from sessionStorage to animate across page mounts
    const savedPrevIdx = sessionStorage.getItem("prevActiveIdx_admin");
    const initialPrevIdx = savedPrevIdx !== null ? Number(savedPrevIdx) : activeIdx;
    
    const [indicatorIdx, setIndicatorIdx] = useState(initialPrevIdx);
    const prevIdxRef = useRef(initialPrevIdx);
    const rafRef = useRef(null);
    const iconRefs = useRef([]);
    const isAnimatingRef = useRef(false);

    // Save active index to sessionStorage on change
    useEffect(() => {
        if (activeIdx >= 0) {
            sessionStorage.setItem("prevActiveIdx_admin", activeIdx);
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

                    adminBottomNav.forEach((_, i) => {
                        const el = iconRefs.current[i];
                        if (!el) return;
                        const prox = Math.max(0, 1 - Math.abs(pos - i) * 1.4);
                        el.style.color = prox > 0.25 ? `rgba(255,255,255,${Math.min(prox * 1.5, 1)})` : 'rgba(59,89,152,0.5)';
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
                                el.style.color = 'rgba(59,89,152,0.5)';
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
    }, [activeIdx]);

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    // Close FAB when navigating
    const handleFabLink = (href) => {
        setFabOpen(false);
        navigate(href);
    };

    const isSubPageMobile = pathname !== "/admin" && 
                            pathname !== "/admin/approvals" && 
                            pathname !== "/admin/payments" && 
                            pathname !== "/admin/distribution";

    const getSubPageTitle = () => {
        if (pathname === "/admin/profile") return "Profile";
        const item = adminSidebarNav.find(i => i.href !== "/admin" && pathname.startsWith(i.href));
        return item ? item.label : "Back";
    };

    return (
        <div 
            data-theme={theme}
            className="min-h-[100dvh] w-full overflow-x-hidden relative isolate" 
            style={{ 
                fontFamily: "'Inter', sans-serif",
                backgroundColor: 'var(--ad-page-bg)',
                color: 'var(--ad-text-primary)'
            }}
        >
            {/* Custom PWA toast message */}
            {toast.show && (
                <div className="fixed top-20 right-4 z-[999] pointer-events-auto p-4 rounded-xl backdrop-blur-xl shadow-lg border text-sm flex items-center gap-3 w-80 animate-fade-in"
                    style={{
                        backgroundColor: isLight 
                            ? (toast.type === "success" ? "rgba(13, 148, 136, 0.08)" : "rgba(255, 255, 255, 0.95)")
                            : (toast.type === "success" ? "rgba(74, 248, 227, 0.15)" : "rgba(30, 41, 59, 0.95)"),
                        borderColor: isLight
                            ? (toast.type === "success" ? "rgba(13, 148, 136, 0.2)" : "rgba(0, 0, 0, 0.08)")
                            : (toast.type === "success" ? "rgba(74, 248, 227, 0.3)" : "rgba(255, 255, 255, 0.1)"),
                        color: isLight
                            ? (toast.type === "success" ? "#0d9488" : "var(--ad-text-primary)")
                            : (toast.type === "success" ? "#4af8e3" : "#f0f0fd"),
                    }}
                >
                    <span className="material-symbols-outlined">
                        {toast.type === "success" ? "check_circle" : "info"}
                    </span>
                    <p className="flex-1 font-medium">{toast.message}</p>
                    <button onClick={() => setToast({ ...toast, show: false })} className="ml-2 opacity-60 hover:opacity-100 cursor-pointer">✕</button>
                </div>
            )}
            {/* ── Ambient Backgrounds ── */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                {isLight ? (
                    <div className="absolute inset-0 admin-ambient-bg opacity-40">
                        <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] ambient-blob-1 blur-[100px]" />
                        <div className="absolute -bottom-[10%] -right-[10%] w-[70%] h-[70%] ambient-blob-2 blur-[100px]" />
                    </div>
                ) : (
                    <>
                        <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-[radial-gradient(circle,rgba(59,130,246,0.15)_0%,transparent_70%)] blur-[100px]" />
                        <div className="absolute -bottom-[10%] -right-[10%] w-[70%] h-[70%] bg-[radial-gradient(circle,rgba(59,130,246,0.1)_0%,transparent_70%)] blur-[100px]" />
                    </>
                )}
            </div>

            {/* ── Mobile TopAppBar (Main Pages) ── */}
            {!isSubPageMobile && (
                <header 
                    className="md:hidden fixed top-4 left-4 right-4 z-50 flex justify-between items-center pl-3 pr-3 h-14 backdrop-blur-2xl animate-fade-in overflow-hidden rounded-[28px]" 
                    style={{ 
                        transform: "translateZ(0)", 
                        isolation: "isolate",
                        backgroundColor: 'var(--ad-nav-bg)',
                        borderColor: 'var(--ad-nav-border)',
                        boxShadow: 'var(--ad-nav-shadow)',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                    }}
                >
                    <div className="flex items-center gap-3 select-none">
                        <div className="w-10 h-10 rounded-full overflow-hidden border bg-[#0c0e17] flex items-center justify-center" style={{ borderColor: 'var(--ad-logo-border)', boxShadow: '0 4px 12px var(--ad-logo-shadow)' }}>
                            <img 
                                src={logoSrc} 
                                alt="Logo" 
                                className="w-full h-full object-cover pointer-events-none select-none" 
                                draggable="false"
                                onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}
                            />
                        </div>
                        <h1 className="text-xl font-bold tracking-tighter" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>FP Finance</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate("/notifications")}
                            className="relative flex items-center justify-center transition-all active:scale-95 duration-200 cursor-pointer"
                            style={{ color: 'var(--ad-text-secondary)' }}
                        >
                            <span className="material-symbols-outlined">notifications</span>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-[#ff6e84] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border animate-pulse" style={{ borderColor: 'var(--ad-page-bg)' }}>
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>
                        <div 
                            className="transition-all cursor-pointer"
                            onClick={() => navigate("/admin/profile")}
                        >
                            <ProfilePicture size={34} />
                        </div>
                    </div>
                </header>
            )}

            {/* ── Mobile Header (Sub-Pages) ── */}
            {isSubPageMobile && (
                <header 
                    className="md:hidden fixed top-0 w-full z-50 border-b" 
                    style={{ 
                        transform: "translateZ(0)", 
                        isolation: "isolate",
                        backgroundColor: isLight ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 17, 23, 0.25)",
                        borderColor: isLight ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.08)",
                        backdropFilter: "blur(48px) saturate(2.0)",
                        WebkitBackdropFilter: "blur(48px) saturate(2.0)",
                    }}
                >
                    <div className="flex items-center px-4 h-16 gap-4">
                        <button 
                            onClick={() => navigate("/admin")}
                            className="w-10 h-10 flex items-center justify-center rounded-2xl transition-all active:scale-90 cursor-pointer border"
                            style={{
                                backgroundColor: isLight ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.05)",
                                borderColor: isLight ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.1)",
                                color: 'var(--ad-text-primary)',
                            }}
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h1 
                            className="font-extrabold text-xl tracking-tight" 
                            style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}
                        >
                            {getSubPageTitle() === "Reports" ? "Report Export" : 
                             getSubPageTitle() === "Profile" ? "Admin profile & Settings" : 
                             `Manage ${getSubPageTitle()}`}
                        </h1>
                    </div>
                </header>
            )}

            {/* ── Desktop Top Nav (Profile & Notifications) ── */}
            <div className="hidden md:flex fixed top-0 right-0 z-50 p-6 items-center gap-5">
                {/* Notification Bell */}
                <div className="relative">
                    <button 
                        onClick={() => setNotifOpen(true)}
                        className="relative transition-all active:scale-95 duration-200 cursor-pointer w-10 h-10 flex items-center justify-center rounded-full border shadow-lg"
                        style={{ 
                            transform: "translateZ(0)", 
                            isolation: "isolate",
                            backgroundColor: 'var(--ad-icon-bg)',
                            borderColor: 'var(--ad-input-border)',
                            color: 'var(--ad-text-secondary)'
                        }}
                    >
                        <span className="material-symbols-outlined text-[24px]">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#ff6e84] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-[0_0_10px_rgba(255,110,132,0.4)] animate-pulse border" style={{ borderColor: 'var(--ad-page-bg)' }}>
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>
                    <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
                </div>

                {/* Profile Picture & Dropdown */}
                <div className="relative" ref={profileDropdownRef}>
                    <div 
                        className="w-10 h-10 rounded-full overflow-hidden transition-all cursor-pointer shadow-lg"
                        style={{ backgroundColor: 'var(--ad-icon-bg)' }}
                        onClick={() => setDesktopProfileOpen(!desktopProfileOpen)}
                    >
                        <ProfilePicture size={40} />
                    </div>

                    {/* Profile Dropdown Popup */}
                    {desktopProfileOpen && (
                        <div 
                            className="absolute top-14 right-0 w-80 rounded-[2rem] shadow-[0_24px_60px_rgba(0,0,0,0.2)] overflow-hidden animate-[modalIn_0.2s_ease-out] z-50 p-4 space-y-4" 
                            style={{ 
                                transform: "translateZ(0)", 
                                isolation: "isolate",
                                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.01)',
                                border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)'}`,
                                backdropFilter: 'blur(80px) saturate(2.5)',
                                WebkitBackdropFilter: 'blur(80px) saturate(2.5)'
                            }}
                        >
                            {/* Profile Header Card */}
                            <div className="py-3.5 px-5 rounded-[1.5rem] border flex flex-col items-center text-center relative overflow-hidden" style={{ backgroundColor: 'var(--ad-accent-bg)', borderColor: 'var(--ad-divider)' }}>
                                <div className="absolute -top-4 -right-4 w-24 h-24 pointer-events-none blur-xl" style={{ backgroundImage: `radial-gradient(circle, ${isLight ? 'rgba(13,148,136,0.3)' : 'rgba(59,130,246,0.3)'} 0%, transparent 70%)` }} />
                                <div className="relative mb-2">
                                    <div className="absolute -inset-1 bg-gradient-to-tr from-[var(--ad-primary)] to-[#4af8e3] rounded-full blur-sm opacity-40" />
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[#0c0e17]">
                                        <ProfilePicture size={48} />
                                    </div>
                                </div>
                                <h3 className="text-base font-extrabold tracking-tight leading-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                                    {user?.name || "Admin User"}
                                </h3>
                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ad-text-secondary)' }}>{user?.email?.replace(/@fp\.com$/, "") || "admin"}</p>
                            </div>

                            {/* Settings List */}
                            <div className="space-y-2">
                                <button 
                                    onClick={() => { setDesktopProfileOpen(false); setPicUploadOpen(true); }}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--ad-accent)]/30"
                                    style={{ backgroundColor: 'var(--ad-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--ad-accent-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--ad-accent)' }}>photo_camera</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--ad-text-primary)' }}>Change Profile Photo</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>
                                
                                <AppLockSetting 
                                    accentColor={isLight ? "#0d9488" : "#3b82f6"} 
                                    isLight={isLight} 
                                    variant="dropdown" 
                                    onSelect={() => setDesktopProfileOpen(false)} 
                                />

                                {/* Theme Toggle */}
                                <button 
                                    onClick={toggleTheme}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--ad-accent)]/30"
                                    style={{ backgroundColor: 'var(--ad-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--ad-accent-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--ad-accent)' }}>
                                                {isLight ? 'light_mode' : 'dark_mode'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--ad-text-primary)' }}>Theme</span>
                                    </div>
                                    <div className="flex items-center">
                                        {/* Toggle switch */}
                                        <div
                                            className="w-11 h-6 rounded-full relative flex items-center px-1 transition-colors duration-300"
                                            style={{
                                                backgroundColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(115, 117, 128, 0.3)',
                                            }}
                                        >
                                            <div
                                                className="w-4 h-4 rounded-full shadow-sm transition-all duration-300 flex items-center justify-center"
                                                style={{
                                                    backgroundColor: isLight ? '#0d9488' : '#737580',
                                                    marginLeft: isLight ? 'auto' : '0',
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-[10px] text-white select-none">
                                                    {isLight ? 'light_mode' : 'dark_mode'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                {/* Push Notifications Toggle */}
                                <button 
                                    onClick={togglePushNotifications}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--ad-accent)]/30"
                                    style={{ backgroundColor: 'var(--ad-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--ad-accent-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--ad-accent)' }}>notifications</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--ad-text-primary)' }}>Push Notifications</span>
                                    </div>
                                    <div className="flex items-center">
                                        {/* Toggle switch */}
                                        <div
                                            className="w-11 h-6 rounded-full relative flex items-center px-1 transition-colors duration-300"
                                            style={{
                                                backgroundColor: pushEnabled ? (isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(59, 130, 246, 0.3)') : 'rgba(115, 117, 128, 0.3)',
                                            }}
                                        >
                                            <div
                                                className="w-4 h-4 rounded-full shadow-sm transition-all duration-300"
                                                style={{
                                                    backgroundColor: pushEnabled ? (isLight ? '#0d9488' : '#3b82f6') : '#737580',
                                                    marginLeft: pushEnabled ? 'auto' : '0',
                                                }}
                                            />
                                        </div>
                                    </div>
                                </button>
                                
                                <button 
                                    onClick={handleCheckUpdate}
                                    disabled={updateChecking}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--ad-accent)]/30 disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--ad-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--ad-accent-bg)' }}>
                                            <span className={updateChecking ? "material-symbols-outlined text-[18px] animate-spin" : "material-symbols-outlined text-[18px]"} style={{ color: 'var(--ad-accent)' }}>
                                                {updateChecking ? 'autorenew' : 'system_update'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--ad-text-primary)' }}>
                                            {updateChecking ? 'Checking for updates...' : 'Check for Updates'}
                                        </span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>
                                
                                <button 
                                    onClick={() => { setDesktopProfileOpen(false); handleLogout(); }}
                                    className="w-full flex items-center gap-3 p-3 bg-[#a70138]/10 transition-all rounded-2xl border border-[#ff6e84]/20 group cursor-pointer justify-center"
                                >
                                    <span className="material-symbols-outlined text-[18px] text-[#ff6e84] group-hover:-translate-x-1 transition-transform">logout</span>
                                    <span className="text-sm font-bold text-[#ff6e84] tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>Logout</span>
                                </button>
                            </div>

                            {/* App Version Footer */}
                            <div className="pt-2 text-center border-t" style={{ borderColor: 'var(--ad-divider)' }}>
                                {/* eslint-disable-next-line no-undef */}
                                <p className="text-[9px] uppercase tracking-[0.2em] opacity-60 font-bold" style={{ color: 'var(--ad-text-secondary)' }}>FP Finance v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.2.0'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Desktop Sidebar ── */}
            <aside 
                className="hidden md:flex fixed top-0 left-0 h-full z-40 w-64 flex-col border-r shadow-[20px_0_40px_rgba(0,0,0,0.05)]"
                style={{ 
                    transform: "translateZ(0)", 
                    isolation: "isolate",
                    backgroundColor: 'var(--ad-sidebar-bg)',
                    borderColor: 'var(--ad-divider)'
                }}
            >
                {/* Profile / Header */}
                <div className="p-6 border-b relative overflow-hidden group" style={{ borderColor: 'var(--ad-divider)' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-[#3b82f6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden border bg-[#0c0e17] shadow-lg group-hover:scale-110 transition-transform duration-300 flex items-center justify-center" style={{ borderColor: 'var(--ad-logo-border)', boxShadow: '0 4px 12px var(--ad-logo-shadow)' }}>
                            <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h1 className="text-sm font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>FP Finance</h1>
                            <p className="text-[11px] font-medium uppercase tracking-widest opacity-70" style={{ color: 'var(--ad-text-secondary)' }}>Future Point</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Scroll */}
                <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto custom-scrollbar">
                    {adminSidebarNav.map((item) => {
                        const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/admin");
                        return (
                            <Link 
                                key={item.href}
                                to={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 group active:scale-95`}
                                style={{
                                    backgroundColor: isActive ? 'var(--ad-accent-bg)' : 'transparent',
                                    color: isActive ? 'var(--ad-accent)' : 'var(--ad-text-secondary)',
                                    border: isActive ? `1px solid ${isLight ? 'rgba(13, 148, 136, 0.2)' : 'rgba(59, 130, 246, 0.2)'}` : '1px solid transparent',
                                    boxShadow: isActive ? `0 0 20px ${isLight ? 'rgba(13, 148, 136, 0.1)' : 'rgba(59, 130, 246, 0.05)'}` : 'none'
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


            {/* ── Main Content ── */}
            <main className={`relative z-10 pt-24 ${!isSubPageMobile ? "pb-24" : "pb-12"} md:pb-8 px-6 md:px-12 md:ml-64 space-y-8 flex-1`}>
                <div ref={bounceRef} className="max-w-7xl mx-auto" style={{ willChange: "transform" }}>
                    {children}
                </div>
            </main>

            {/* ── Mobile: FAB Menu Drawer ── */}
            {fabOpen && !isSubPageMobile && (
                <div 
                    className="md:hidden fixed bottom-[176px] z-[60] w-48 flex flex-col gap-3 animate-menu-card-in" 
                    style={{ 
                        left: fabAlign === "left" ? "24px" : "auto",
                        right: fabAlign === "right" ? "24px" : "auto",
                        transformOrigin: fabAlign === "left" ? "bottom left" : "bottom right"
                    }}
                >
                    <div className="rounded-3xl p-3 shadow-2xl border space-y-1" style={{ isolation: "isolate", backgroundColor: 'var(--ad-sidebar-bg)', borderColor: 'var(--ad-divider)' }}>
                        {adminFabNav.map((item) => (
                            <button 
                                key={item.href}
                                onClick={() => handleFabLink(item.href)}
                                className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-white/5 transition-colors group cursor-pointer text-left"
                                style={{ color: 'var(--ad-text-secondary)' }}
                            >
                                <span className="material-symbols-outlined" style={{ color: 'var(--ad-accent)' }}>{item.icon}</span>
                                <span className="font-semibold group-hover:text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Mobile: Overlay to close FAB ── */}
            {fabOpen && !isSubPageMobile && (
                <div 
                    className="md:hidden fixed inset-0 z-[55] bg-black/20 cursor-pointer animate-overlay-in"
                    onClick={() => setFabOpen(false)}
                    style={{ touchAction: "none" }}
                />
            )}

            {/* ── Mobile: Floating Action Button ── */}
            {!isSubPageMobile && (
                <button 
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onClick={handleFabClick}
                    className={`md:hidden fixed bottom-[110px] w-14 h-14 rounded-full flex items-center justify-center z-[60] active:scale-95 transition-all duration-300 cursor-pointer ${fabOpen ? "text-white rotate-45" : ""}`}
                    style={{
                        left: dragX !== null ? `${dragX}px` : (fabAlign === "left" ? "24px" : "auto"),
                        right: dragX !== null ? "auto" : (fabAlign === "right" ? "24px" : "auto"),
                        transition: dragX !== null ? "none" : "all 300ms cubic-bezier(0.25, 0.8, 0.25, 1)",
                        touchAction: "none",
                        backgroundColor: fabOpen ? '#ff6e84' : (isLight ? '#0d9488' : '#4af8e3'),
                        color: fabOpen ? '#ffffff' : (isLight ? '#ffffff' : '#005b51'),
                        boxShadow: fabOpen 
                            ? '0 10px 30px rgba(255, 110, 132, 0.3)' 
                            : (isLight ? '0 10px 30px rgba(13, 148, 136, 0.35)' : '0 10px 30px rgba(74, 248, 227, 0.3)')
                    }}
                >
                    {fabOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="select-none w-6 h-6">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="select-none w-6 h-6">
                            <rect x="3" y="3" width="7" height="7" rx="1.2" />
                            <circle cx="17.5" cy="6.5" r="3.5" />
                            <rect x="3" y="14" width="7" height="7" rx="1.2" />
                            <rect x="14" y="14" width="7" height="7" rx="1.2" />
                        </svg>
                    )}
                </button>
            )}

            {/* ── Mobile: Bottom Navigation Bar ── */}
            {!isSubPageMobile && (
                <div className="md:hidden fixed bottom-6 left-6 right-6 z-40 overflow-hidden rounded-full isolate">
                    <nav className="relative flex items-center backdrop-blur-2xl border overflow-hidden rounded-full" 
                         style={{ 
                             transform: "translateZ(0)", 
                             isolation: "isolate",
                             backgroundColor: 'var(--ad-nav-bg)',
                             borderColor: 'var(--ad-nav-border)',
                             boxShadow: 'var(--ad-nav-shadow)'
                         }}
                    >
                        {/* ── Sliding blue circle indicator ── */}
                        {activeIdx >= 0 && (
                            <div
                                className="absolute top-1/2 -translate-y-1/2 z-0 flex items-center justify-center pointer-events-none will-change-[left]"
                                style={{
                                    width: `${100 / adminBottomNav.length}%`,
                                    left: `${indicatorIdx * (100 / adminBottomNav.length)}%`,
                                    transition: 'left 500ms cubic-bezier(0.34, 1.3, 0.64, 1)',
                                }}
                            >
                                <div 
                                    className="w-[48px] h-[48px] rounded-full" 
                                    style={{
                                        backgroundColor: 'var(--ad-accent)',
                                        boxShadow: `0 0 10px ${isLight ? 'rgba(13,148,136,0.4)' : 'rgba(59,130,246,0.4)'}`
                                    }}
                                />
                            </div>
                        )}
                        {/* ── Nav items ── */}
                        {adminBottomNav.map((item, i) => {
                            const isActive = i === indicatorIdx;
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    onClick={() => {
                                        if (navigator.vibrate) navigator.vibrate(40);
                                    }}
                                    className="flex-1 relative z-10 flex items-center justify-center h-[66px] rounded-full active:scale-90"
                                >
                                    <span
                                        ref={el => iconRefs.current[i] = el}
                                        className="material-symbols-outlined text-[22px]"
                                        style={{
                                            color: isActive ? '#ffffff' : 'rgba(59,89,152,0.5)',
                                            transform: isActive ? 'scale(1.14)' : 'scale(1)',
                                            fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                                            willChange: 'transform, color',
                                        }}
                                    >{item.icon}</span>
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            )}
            <ProfilePicUpload isOpen={picUploadOpen} onClose={() => setPicUploadOpen(false)} />

            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: ${isLight ? 'rgba(13, 148, 136, 0.1)' : 'rgba(59, 130, 246, 0.1)'};
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(59, 130, 246, 0.3)'};
                }
                @keyframes fade-in-down {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-fade-in-down {
                    animation: fade-in-down 0.4s ease-out;
                }
                @keyframes overlay-fade-in {
                    from {
                        opacity: 0;
                        backdrop-filter: blur(0px);
                        -webkit-backdrop-filter: blur(0px);
                    }
                    to {
                        opacity: 1;
                        backdrop-filter: blur(4px);
                        -webkit-backdrop-filter: blur(4px);
                    }
                }
                .animate-overlay-in {
                    animation: overlay-fade-in 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes menu-card-in {
                    from {
                        transform: scale(0.8) translateY(20px);
                        opacity: 0;
                        backdrop-filter: blur(0px);
                        -webkit-backdrop-filter: blur(0px);
                    }
                    to {
                        transform: scale(1) translateY(0);
                        opacity: 1;
                        backdrop-filter: blur(64px);
                        -webkit-backdrop-filter: blur(64px);
                    }
                }
                .animate-menu-card-in {
                    animation: menu-card-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
            `}} />
        </div>
    );
}

export default function AdminLayout({ children }) {
    return (
        <AdminThemeProvider>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </AdminThemeProvider>
    );
}

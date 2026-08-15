import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import logoSrc from "@/assets/logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { TeacherThemeProvider, useTeacherTheme } from "@/context/TeacherThemeContext";
import ProfilePicture from "./ProfilePicture";
import NotificationPanel from "./NotificationPanel";
import ProfilePicUpload from "./ProfilePicUpload";
import AppLockSetting from "./AppLockSetting";
import MyDevicesModal from "./MyDevicesModal";
import AboutContent from "./AboutContent";
import { api } from "@/lib/api";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

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

const teacherNav = [
    { label: "Dashboard", href: "/teacher", icon: "dashboard" },
    { label: "Payments", href: "/teacher/payments", icon: "payments" },
    { label: "Distribution", href: "/teacher/distribution", icon: "account_tree" },
    { label: "Notes", href: "/teacher/notes", icon: "edit_document" },
    { label: "Notices", href: "/teacher/notices", icon: "campaign" },
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
    const { unreadCount, pushEnabled, togglePushNotifications } = useNotifications() || {};
    const { user, logout, refreshUser } = useAuth();
    const { theme, toggleTheme } = useTeacherTheme();
    const [notifOpen, setNotifOpen] = useState(false);
    const [desktopProfileOpen, setDesktopProfileOpen] = useState(false);
    const [picUploadOpen, setPicUploadOpen] = useState(false);
    const [devicesModalOpen, setDevicesModalOpen] = useState(false);
    const [aboutModalOpen, setAboutModalOpen] = useState(false);
    const [usernameModalOpen, setUsernameModalOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);

    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [credLoading, setCredLoading] = useState(false);
    const [credError, setCredError] = useState("");
    const [credSuccess, setCredSuccess] = useState("");

    const profileDropdownRef = useRef(null);
    const activeSessionCount = user?.activeSessions?.length || 0;

    // Lock body scroll using html.scroll-lock class (works on iOS Safari too)
    useEffect(() => {
        const isAnyOpen = Boolean(
            desktopProfileOpen ||
            notifOpen ||
            picUploadOpen ||
            devicesModalOpen ||
            aboutModalOpen ||
            usernameModalOpen ||
            passwordModalOpen
        );
        if (isAnyOpen) {
            document.documentElement.classList.add("scroll-lock");
            return () => {
                document.documentElement.classList.remove("scroll-lock");
            };
        }
    }, [desktopProfileOpen, notifOpen, picUploadOpen, devicesModalOpen, aboutModalOpen, usernameModalOpen, passwordModalOpen]);

    // Live username check states
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState({ available: null, reason: "" });
    const checkUsernameTimerRef = useRef(null);

    // Live debounced username check effect
    useEffect(() => {
        if (!usernameModalOpen) {
            setCheckingUsername(false);
            setUsernameStatus({ available: null, reason: "" });
            if (checkUsernameTimerRef.current) clearTimeout(checkUsernameTimerRef.current);
            return;
        }

        const trimmed = newUsername.trim().toLowerCase();
        if (checkUsernameTimerRef.current) clearTimeout(checkUsernameTimerRef.current);

        if (!trimmed) {
            setCheckingUsername(false);
            setUsernameStatus({ available: null, reason: "" });
            return;
        }

        if (trimmed.length < 3) {
            setCheckingUsername(false);
            setUsernameStatus({ available: false, reason: "Must be at least 3 characters." });
            return;
        }

        const currentUsername = (user?.username || user?.email?.replace(/@fp\.com$/, "") || "").trim().toLowerCase();
        if (trimmed === currentUsername) {
            setCheckingUsername(false);
            setUsernameStatus({ available: false, isCurrent: true, reason: "This is your current username." });
            return;
        }

        setCheckingUsername(true);
        setUsernameStatus({ available: null, reason: "Checking availability..." });

        checkUsernameTimerRef.current = setTimeout(async () => {
            try {
                const res = await api.get(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`);
                setUsernameStatus({
                    available: res.available,
                    isCurrent: res.is_current,
                    reason: res.reason
                });
            } catch (err) {
                setUsernameStatus({ available: false, reason: err.message || "Failed to check username" });
            } finally {
                setCheckingUsername(false);
            }
        }, 350);

        return () => {
            if (checkUsernameTimerRef.current) clearTimeout(checkUsernameTimerRef.current);
        };
    }, [newUsername, usernameModalOpen, user?.username, user?.email]);

    const closeCredModals = () => {
        setUsernameModalOpen(false);
        setPasswordModalOpen(false);
        setCredError("");
        setCredSuccess("");
        setNewUsername("");
        setNewPassword("");
        setConfirmPassword("");
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setCheckingUsername(false);
        setUsernameStatus({ available: null, reason: "" });
    };

    const handleUsernameSubmit = async (e) => {
        e.preventDefault();
        if (!newUsername.trim()) return;
        setCredLoading(true); setCredError(""); setCredSuccess("");
        try {
            const res = await api.put("/api/auth/update-credentials", { new_username: newUsername.trim() });
            if (res.custom_token) await signInWithCustomToken(auth, res.custom_token);
            if (refreshUser) await refreshUser();
            setCredSuccess("Username updated successfully!");
            setNewUsername("");
            setTimeout(() => closeCredModals(), 2000);
        } catch (err) { setCredError(err.message || "Failed to update."); }
        finally { setCredLoading(false); }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) { setCredError("Passwords do not match."); return; }
        if (newPassword.length < 6) { setCredError("Password must be at least 6 characters."); return; }
        if (!/[a-zA-Z]/.test(newPassword)) { setCredError("Must include at least one letter."); return; }
        if (!/[0-9]/.test(newPassword)) { setCredError("Must include at least one number."); return; }
        if (!/[^a-zA-Z0-9]/.test(newPassword)) { setCredError("Must include at least one special character."); return; }
        setCredLoading(true); setCredError(""); setCredSuccess("");
        try {
            const res = await api.put("/api/auth/update-credentials", { new_password: newPassword });
            if (res.custom_token) await signInWithCustomToken(auth, res.custom_token);
            if (refreshUser) await refreshUser();
            setCredSuccess("Password updated successfully!");
            setNewPassword(""); setConfirmPassword("");
            setTimeout(() => closeCredModals(), 2000);
        } catch (err) { setCredError(err.message || "Failed to update."); }
        finally { setCredLoading(false); }
    };

    // PWA manual update checking states
    const [updateChecking, setUpdateChecking] = useState(false);
    const [toast, setToast] = useState({ show: false, message: "", type: "" });

    const handleCheckUpdate = async () => {
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

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    // Close profile dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (event.target && (event.target.closest('.fixed.inset-0') || event.target.closest('[role="dialog"]'))) {
                return;
            }
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setDesktopProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isLight = theme === "light";
    const bounceRef = useScrollBounce(false);

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

    const isHomeMobile = pathname === "/teacher";
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
                            ? (toast.type === "success" ? "#0d9488" : "var(--tt-text-primary)")
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

            {/* ── Mobile TopAppBar (Homepage Only - Native App Style Header) ── */}
            {isHomeMobile && (
                <header
                    className="md:hidden flex justify-between items-center px-4 pt-3.5 pb-1 animate-fade-in relative z-50 select-none"
                    style={{
                        backgroundColor: 'transparent',
                        transform: "translateZ(0)", isolation: "isolate"
                    }}
                >
                    <div className="flex items-center gap-2.5 select-none">
                        <div 
                            className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
                            style={{
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: 'var(--tt-logo-border)',
                                backgroundColor: isLight ? '#f0f4ff' : '#0c0e17',
                            }}
                        >
                            <img 
                                src={logoSrc} 
                                alt="Logo" 
                                className="w-full h-full object-cover scale-125 pointer-events-none select-none" 
                                draggable="false"
                                onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}
                            />
                        </div>
                        <h1 
                            className="text-lg font-extrabold tracking-tight" 
                            style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}
                        >
                            FP Finance
                        </h1>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            onClick={() => navigate("/teacher/notices")}
                            className="relative flex items-center justify-center transition-all active:scale-95 duration-200 cursor-pointer p-1"
                            style={{ color: 'var(--tt-text-secondary)' }}
                        >
                            <span className="material-symbols-outlined text-[24px]">campaign</span>
                        </button>
                        <button
                            onClick={() => navigate("/notifications")}
                            className="relative flex items-center justify-center transition-all active:scale-95 duration-200 cursor-pointer p-1"
                            style={{ color: 'var(--tt-text-secondary)' }}
                        >
                            <span className="material-symbols-outlined text-[24px]">notifications</span>
                            {unreadCount > 0 && (
                                <span 
                                    className="absolute top-0 right-0 min-w-[15px] h-[15px] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse"
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
                            className="transition-all cursor-pointer active:scale-95 ml-1"
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
                        onClick={() => {
                            if (window.history.state && window.history.state.idx > 0) {
                                navigate(-1);
                            } else {
                                navigate("/teacher", { replace: true });
                            }
                        }}
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
                            className="w-12 h-12 rounded-full overflow-hidden shadow-lg flex items-center justify-center"
                            style={{
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: 'var(--tt-logo-border)',
                                backgroundColor: isLight ? '#f0f4ff' : '#0c0e17',
                                boxShadow: `0 4px 12px var(--tt-logo-shadow)`,
                            }}
                        >
                            <img 
                                src={logoSrc} 
                                alt="Logo" 
                                className="w-full h-full object-cover scale-120 pointer-events-none select-none" 
                                draggable="false"
                                onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}
                            />
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

                {/* Profile Picture & Dropdown */}
                <div className="relative" ref={profileDropdownRef}>
                    <div 
                        className="w-10 h-10 rounded-full overflow-hidden transition-all cursor-pointer shadow-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--tt-icon-bg)' }}
                        onClick={() => setDesktopProfileOpen(!desktopProfileOpen)}
                    >
                        <ProfilePicture size={40} />
                    </div>

                    {/* Profile Dropdown Popup */}
                    {desktopProfileOpen && (
                        <div 
                            className="absolute top-14 right-0 w-80 max-h-[85vh] flex flex-col rounded-[2rem] shadow-[0_24px_60px_rgba(0,0,0,0.2)] animate-[modalIn_0.2s_ease-out] z-50 p-4 gap-3 overflow-hidden" 
                            style={{ 
                                transform: "translateZ(0)", 
                                isolation: "isolate",
                                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.01)',
                                border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)'}`,
                                backdropFilter: 'blur(80px) saturate(2.5)',
                                WebkitBackdropFilter: 'blur(80px) saturate(2.5)'
                            }}
                        >
                            {/* Profile Header Card (Fixed at top) */}
                            <div className="shrink-0 p-4 rounded-[1.5rem] border flex items-center gap-4 text-left relative overflow-hidden" style={{ backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--tt-divider)' }}>
                                <div className="absolute -top-4 -right-4 w-24 h-24 pointer-events-none blur-xl" style={{ backgroundImage: `radial-gradient(circle, ${isLight ? 'rgba(13,148,136,0.3)' : 'rgba(59,130,246,0.3)'} 0%, transparent 70%)` }} />
                                
                                {/* Avatar Left with Gradient Glow */}
                                <div className="relative shrink-0">
                                    <div className="absolute -inset-1 bg-gradient-to-tr from-[#0d9488] via-[#3b82f6] to-[#4af8e3] rounded-full blur-sm opacity-60 dark:opacity-75" />
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden border flex items-center justify-center" style={{ borderColor: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.2)' }}>
                                        <ProfilePicture size={48} />
                                    </div>
                                </div>

                                {/* Details Right */}
                                <div className="flex flex-col justify-center min-w-0 flex-1">
                                    <h3 className="text-base font-extrabold tracking-tight leading-tight truncate" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                                        {user?.name || "Teacher"}
                                    </h3>
                                    <div className="flex items-center gap-1 mt-0.5 min-w-0 max-w-full">
                                        <span className="text-xs font-semibold truncate" style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>
                                            @{user?.email?.replace(/@fp\.com$/, "") || "teacher"}
                                        </span>
                                        <span className="material-symbols-outlined shrink-0 select-none leading-none flex items-center justify-center" style={{ fontSize: '13px', width: '13px', height: '13px', color: isLight ? "#0d9488" : "#3b82f6", fontVariationSettings: "'FILL' 1" }}>
                                            verified
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Settings Options List */}
                            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-2 pr-0.5">
                                {/* Change Profile Photo */}
                                <button 
                                    onClick={() => setPicUploadOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--tt-primary,#0d9488)]/30"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>photo_camera</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--tt-text-primary)' }}>Change Profile Photo</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>

                                {/* Change Username or Mobile */}
                                <button 
                                    onClick={() => setUsernameModalOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--tt-primary,#0d9488)]/30"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>person</span>
                                        </div>
                                        <span className="text-sm font-medium leading-snug" style={{ color: 'var(--tt-text-primary)' }}>Change Username</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>

                                {/* Change Password */}
                                <button 
                                    onClick={() => setPasswordModalOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--tt-primary,#0d9488)]/30"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>lock</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--tt-text-primary)' }}>Change Password</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>
                                


                                {/* Devices */}
                                <button 
                                    onClick={() => setDevicesModalOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--tt-primary,#0d9488)]/30"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>devices</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--tt-text-primary)' }}>Devices</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ color: 'var(--tt-text-secondary)', backgroundColor: 'var(--tt-icon-bg)' }}>
                                            {activeSessionCount} active
                                        </span>
                                        <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                    </div>
                                </button>

                                {/* Theme Toggle */}
                                <button 
                                    onClick={toggleTheme}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--tt-primary,#0d9488)]/30"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>
                                                {isLight ? 'light_mode' : 'dark_mode'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--tt-text-primary)' }}>Theme</span>
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
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--tt-primary,#0d9488)]/30"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>notifications</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--tt-text-primary)' }}>Push Notifications</span>
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

                                {/* Help & Support */}
                                <a 
                                    href="https://wa.me/917001637243"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--tt-primary,#0d9488)]/30"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>support_agent</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--tt-text-primary)' }}>Help & Support</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </a>
                                
                                {/* Check for Updates */}
                                <button 
                                    onClick={handleCheckUpdate}
                                    disabled={updateChecking}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--tt-primary,#0d9488)]/30 disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                            <span className={updateChecking ? "material-symbols-outlined text-[18px] animate-spin" : "material-symbols-outlined text-[18px]"} style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>
                                                {updateChecking ? 'autorenew' : 'system_update'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--tt-text-primary)' }}>
                                            {updateChecking ? 'Checking for updates...' : 'Check for Updates'}
                                        </span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>

                                {/* About */}
                                <button 
                                    onClick={() => setAboutModalOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--tt-primary,#0d9488)]/30"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>info</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--tt-text-primary)' }}>About</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>
                                
                                {/* Logout */}
                                <button 
                                    onClick={() => { setDesktopProfileOpen(false); handleLogout(); }}
                                    className="w-full flex items-center gap-3 p-3 bg-[#a70138]/10 transition-all rounded-2xl border border-[#ff6e84]/20 group cursor-pointer justify-center"
                                >
                                    <span className="material-symbols-outlined text-[18px] text-[#ff6e84] group-hover:-translate-x-1 transition-transform">logout</span>
                                    <span className="text-sm font-bold text-[#ff6e84] tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>Logout</span>
                                </button>
                            </div>


                        </div>
                    )}
                </div>

                {/* Profile Pic Upload Modal */}
                <ProfilePicUpload isOpen={picUploadOpen} onClose={() => setPicUploadOpen(false)} />

                {/* Devices Modal */}
                {devicesModalOpen && (
                    <MyDevicesModal onClose={() => setDevicesModalOpen(false)} />
                )}

                {/* Change Username Modal */}
                {usernameModalOpen && createPortal(
                    <div 
                        data-theme={theme}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4" 
                        onClick={closeCredModals}
                        style={{
                            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(16px) saturate(1.5)',
                            WebkitBackdropFilter: 'blur(16px) saturate(1.5)'
                        }}
                    >
                        <div
                            className="w-full max-w-sm rounded-[32px] p-8 animate-modal-in shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.01)',
                                border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)'}`,
                                backdropFilter: 'blur(80px) saturate(2.5)',
                                WebkitBackdropFilter: 'blur(80px) saturate(2.5)',
                                boxShadow: isLight
                                    ? '0 32px 64px rgba(0,0,0,0.05), inset 0 0 32px rgba(255,255,255,0.6)'
                                    : '0 32px 64px rgba(0,0,0,0.6), inset 0 0 32px rgba(255,255,255,0.05)',
                                transform: "translateZ(0)", isolation: "isolate"
                            }}
                        >
                            <h3 className="font-bold text-center text-2xl mb-6 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>Change Username</h3>
                            {credError && <div className="mb-3 p-2.5 rounded-2xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] text-xs">{credError}</div>}
                            {credSuccess && <div className="mb-3 p-2.5 rounded-2xl border text-xs" style={{ backgroundColor: 'var(--tt-accent-bg)', borderColor: 'var(--tt-logo-border)', color: 'var(--tt-primary)' }}>{credSuccess}</div>}
                            <form onSubmit={handleUsernameSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold mb-2 ml-1 uppercase tracking-widest" style={{ color: 'var(--tt-text-secondary)' }}>New Username</label>
                                    <div className="relative">
                                        <input
                                            type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                                            placeholder="Enter new username" required
                                            className="w-full pl-5 pr-12 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-all placeholder:text-gray-400"
                                            style={{
                                                backgroundColor: 'var(--tt-input-bg)',
                                                border: `1px solid ${
                                                    usernameStatus.available === true
                                                        ? (isLight ? '#0d9488' : '#4af8e3')
                                                        : usernameStatus.available === false && !usernameStatus.isCurrent && newUsername.trim().length >= 3
                                                        ? (isLight ? '#ef4444' : '#ff9dac')
                                                        : 'var(--tt-input-border)'
                                                }`,
                                                color: 'var(--tt-text-primary)'
                                            }}
                                        />
                                        {/* Right side live status indicator */}
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                                            {checkingUsername && (
                                                <span className="material-symbols-outlined text-[18px] animate-spin opacity-70" style={{ color: isLight ? "#0d9488" : "#3b82f6" }}>
                                                    progress_activity
                                                </span>
                                            )}
                                            {!checkingUsername && usernameStatus.available === true && (
                                                <span className="material-symbols-outlined text-[20px]" style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>
                                                    check_circle
                                                </span>
                                            )}
                                            {!checkingUsername && usernameStatus.available === false && !usernameStatus.isCurrent && newUsername.trim().length >= 3 && (
                                                <span className="material-symbols-outlined text-[20px]" style={{ color: isLight ? '#ef4444' : '#ff9dac' }}>
                                                    cancel
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Helper status text */}
                                    {newUsername.trim() && (
                                        <div className="mt-2.5 ml-1 text-xs font-semibold flex items-center gap-1.5 transition-all">
                                            {checkingUsername && (
                                                <span className="opacity-70 animate-pulse" style={{ color: 'var(--tt-text-secondary)' }}>
                                                    Checking availability...
                                                </span>
                                            )}
                                            {!checkingUsername && usernameStatus.available === true && (
                                                <span style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>
                                                    ✓ Username is available!
                                                </span>
                                            )}
                                            {!checkingUsername && usernameStatus.available === false && (
                                                <span style={{ color: usernameStatus.isCurrent ? 'var(--tt-text-secondary)' : (isLight ? '#ef4444' : '#ff9dac') }}>
                                                    {usernameStatus.isCurrent ? "ℹ This is your current username" : `✕ ${usernameStatus.reason}`}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={closeCredModals}
                                        className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95 border"
                                        style={{ backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)', color: 'var(--tt-text-secondary)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={credLoading || checkingUsername || usernameStatus.available !== true}
                                        className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 cursor-pointer active:scale-95 border"
                                        style={{ backgroundColor: 'var(--tt-blue-bg)', borderColor: 'var(--tt-logo-border)', color: 'var(--tt-primary)', boxShadow: '0 4px 20px var(--tt-logo-shadow)' }}
                                    >
                                        {credLoading ? "Updating..." : "Update"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Change Password Modal */}
                {passwordModalOpen && createPortal(
                    <div 
                        data-theme={theme}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4" 
                        onClick={closeCredModals}
                        style={{
                            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(16px) saturate(1.5)',
                            WebkitBackdropFilter: 'blur(16px) saturate(1.5)'
                        }}
                    >
                        <div
                            className="w-full max-w-sm rounded-[32px] p-8 animate-modal-in shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.01)',
                                border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)'}`,
                                backdropFilter: 'blur(80px) saturate(2.5)',
                                WebkitBackdropFilter: 'blur(80px) saturate(2.5)',
                                boxShadow: isLight
                                    ? '0 32px 64px rgba(0,0,0,0.05), inset 0 0 32px rgba(255,255,255,0.6)'
                                    : '0 32px 64px rgba(0,0,0,0.6), inset 0 0 32px rgba(255,255,255,0.05)',
                                transform: "translateZ(0)", isolation: "isolate"
                            }}
                        >
                            <h3 className="text-center font-bold text-2xl mb-6 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>Change Password</h3>
                            {credError && <div className="mb-3 p-2.5 rounded-2xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] text-xs">{credError}</div>}
                            {credSuccess && <div className="mb-3 p-2.5 rounded-2xl border text-xs" style={{ backgroundColor: 'var(--tt-accent-bg)', borderColor: 'var(--tt-logo-border)', color: 'var(--tt-primary)' }}>{credSuccess}</div>}
                            <form onSubmit={handlePasswordSubmit}>
                                <label className="block text-xs mb-1.5" style={{ color: 'var(--tt-text-secondary)' }}>New Password</label>
                                <div className="relative mb-3">
                                    <input
                                        type={showNewPassword ? "text" : "password"} 
                                        value={newPassword} 
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Min 6 characters" required minLength={6}
                                        className="w-full pl-4 pr-12 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-offset-0 focus:ring-0"
                                        style={{ backgroundColor: 'var(--tt-input-bg)', borderColor: 'var(--tt-input-border)', color: 'var(--tt-text-primary)' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                                        style={{ color: 'var(--tt-text-secondary)' }}
                                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                                    >
                                        {showNewPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.822 7.822L21 21m-2.228-2.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                <label className="block text-xs mb-1.5" style={{ color: 'var(--tt-text-secondary)' }}>Confirm Password</label>
                                <div className="relative mb-4">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"} 
                                        value={confirmPassword} 
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter password" required minLength={6}
                                        className="w-full pl-4 pr-12 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-offset-0 focus:ring-0"
                                        style={{ backgroundColor: 'var(--tt-input-bg)', borderColor: 'var(--tt-input-border)', color: 'var(--tt-text-primary)' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                                        style={{ color: 'var(--tt-text-secondary)' }}
                                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                    >
                                        {showConfirmPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.822 7.822L21 21m-2.228-2.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={closeCredModals}
                                        className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95 border"
                                        style={{ backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)', color: 'var(--tt-text-secondary)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={credLoading}
                                        className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer active:scale-95 border"
                                        style={{ backgroundColor: 'var(--tt-blue-bg)', borderColor: 'var(--tt-logo-border)', color: 'var(--tt-primary)', boxShadow: '0 4px 20px var(--tt-logo-shadow)' }}
                                    >
                                        {credLoading ? "Updating..." : "Update"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )}

                {/* About Modal */}
                {aboutModalOpen && createPortal(
                    <div
                        data-theme={theme}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                        onClick={() => setAboutModalOpen(false)}
                        style={{
                            backgroundColor: isLight ? 'rgba(238,242,255,0.5)' : 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                        }}
                    >
                        <div
                            className="w-full max-w-sm rounded-[32px] p-8 animate-modal-in shadow-2xl flex flex-col gap-5"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                                border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.05)'}`,
                                backdropFilter: 'blur(64px) saturate(2.2)',
                                WebkitBackdropFilter: 'blur(64px) saturate(2.2)',
                                transform: "translateZ(0)", isolation: "isolate",
                            }}
                        >
                            <div className="flex justify-between items-center">
                                <h3 className="font-extrabold text-xl tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                                    About
                                </h3>
                                <button
                                    onClick={() => setAboutModalOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
                                    style={{ 
                                        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                                        border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`,
                                        color: 'var(--tt-text-muted)' 
                                    }}
                                >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>
                            <AboutContent isLight={isLight} accentColor={isLight ? "#0d9488" : "#3b82f6"} />
                        </div>
                    </div>,
                    document.body
                )}
            </div>

            {/* ── Main Content ── */}
            <main
                className={`relative z-10 md:ml-64 min-h-screen flex flex-col ${isHomeMobile ? "pt-1.5" : (isSubPageMobile ? "pt-24" : "pt-6")} ${!isSubPageMobile ? "pb-24" : "pb-6"} md:pt-8 md:pb-8 px-3.5 sm:px-6 md:px-12`}
                style={{ scrollbarGutter: "stable" }}
            >
                <div ref={bounceRef} className="max-w-7xl w-full mx-auto flex-1" style={{ willChange: "transform" }}>
                    {children}
                </div>
            </main>

            {/* ── Mobile Bottom Navigation ── */}
            {!isSubPageMobile && (
                <nav
                    className="md:hidden fixed bottom-6 left-4 right-4 z-40 overflow-hidden rounded-full isolate flex items-center h-[60px]"
                    style={{ 
                        background: 'var(--tt-nav-bg)',
                        border: '1px solid var(--tt-nav-border)',
                        boxShadow: 'var(--tt-nav-shadow)',
                        backdropFilter: 'blur(28px) saturate(1.8)',
                        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
                        transform: "translateZ(0)", isolation: "isolate" 
                    }}
                >
                    {/* ── Sliding blue circle indicator ── */}
                    {activeIdx >= 0 && (
                        <div
                            className="absolute top-1/2 -translate-y-1/2 z-0 flex items-center justify-center pointer-events-none will-change-[left]"
                            style={{
                                width: '48px',
                                height: '48px',
                                left: `calc(6px + ${indicatorIdx} * ((100% - 60px) / ${teacherBottomNav.length - 1}))`,
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
                    {/* ── Nav items ── */}
                    {teacherBottomNav.map((item, i) => {
                        const isActive = i === indicatorIdx;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                onClick={() => {
                                    if (navigator.vibrate) navigator.vibrate(40);
                                }}
                                className="absolute top-0 bottom-0 z-10 flex items-center justify-center rounded-full active:scale-90"
                                style={{
                                    width: '48px',
                                    left: `calc(6px + ${i} * ((100% - 60px) / ${teacherBottomNav.length - 1}))`,
                                }}
                            >
                                <div className="relative flex items-center justify-center">
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
                                </div>
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


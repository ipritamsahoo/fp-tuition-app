import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import logoSrc from "@/assets/logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { StudentThemeProvider, useStudentTheme } from "@/context/StudentThemeContext";
import ProfilePicture from "./ProfilePicture";
import NotificationPanel from "./NotificationPanel";
import ProfilePicUpload from "./ProfilePicUpload";
import AppLockSetting from "./AppLockSetting";
import MyDevicesModal from "./MyDevicesModal";
import AboutContent from "./AboutContent";
import StudentFeedbackModal from "./StudentFeedbackModal";
import BadgeCelebrationOverlay from "./BadgeCelebrationOverlay";
import { api } from "@/lib/api";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

// ── Springy easeOutBack solver for bottom bar indicators ──
const easeOutBack = (x) => {
    const c1 = 1.2;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const studentNav = [
    { label: "Home", href: "/student", icon: "home" },
    { label: "Payments", href: "/student/payments", icon: "payments" },
    { label: "Leaderboard", href: "/student/leaderboard", icon: "emoji_events" },
    { label: "Notes", href: "/student/notes", icon: "edit_document" },
    { label: "Notices", href: "/student/notices", icon: "campaign" },
];
const studentBottomNav = [
    { label: "Home", href: "/student", icon: "home" },
    { label: "Payments", href: "/student/payments", icon: "payments" },
    { label: "Leaderboard", href: "/student/leaderboard", icon: "emoji_events" },
    { label: "Notes", href: "/student/notes", icon: "edit_document" },
    { label: "Settings", href: "/student/settings", icon: "settings" },
];

// ── Custom Scroll Bounce Hook ──
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

            // Safety check: do not bounce if touch starts inside a portal/modal
            if (!el.contains(e.target)) return;

            // Cancel any running decay animation
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

            // Remove transitions for immediate tracking
            el.style.transition = "none";
        };

        const handleTouchMove = (e) => {
            if (!isDraggingRef.current) return;
            if (!el.contains(e.target)) return;

            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const dy = currentY - startYRef.current;
            const dx = currentX - startXRef.current;

            // If it's primarily a vertical swipe
            if (Math.abs(dy) > Math.abs(dx)) {
                if (isAtTopRef.current && dy > 0) {
                    // Pulling down at top (scrolling up)
                    const bounce = Math.pow(dy, 0.7) * 1.5;
                    el.style.transform = `translate3d(0, ${bounce}px, 0)`;
                    accumulatedBounceRef.current = bounce;
                    if (e.cancelable) e.preventDefault();
                } else if (isAtBottomRef.current && dy < 0) {
                    // Pulling up at bottom (scrolling down)
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
                // Spring back
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
                if (decayRafRef.current) {
                    cancelAnimationFrame(decayRafRef.current);
                }

                el.style.transition = "none";

                // Limit maximum bounce to 80px
                let targetBounce = accumulatedBounceRef.current - dy * 0.15;
                if (dy < 0) {
                    targetBounce = Math.min(80, targetBounce);
                } else {
                    targetBounce = Math.max(-80, targetBounce);
                }

                accumulatedBounceRef.current = targetBounce;
                el.style.transform = `translate3d(0, ${accumulatedBounceRef.current}px, 0)`;
                if (e.cancelable) e.preventDefault();

                // Decay/spring back function
                const decay = () => {
                    accumulatedBounceRef.current *= 0.82; // damping factor
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

        // Add event listeners (must be non-passive to allow preventDefault)
        window.addEventListener("touchstart", handleTouchStart, { passive: false });
        window.addEventListener("touchmove", handleTouchMove, { passive: false });
        window.addEventListener("touchend", handleTouchEnd, { passive: false });
        window.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            window.removeEventListener("touchstart", handleTouchStart);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("touchend", handleTouchEnd);
            window.removeEventListener("wheel", handleWheel);
            if (decayRafRef.current) cancelAnimationFrame(decayRafRef.current);
            if (el) {
                el.style.transform = "";
                el.style.transition = "";
            }
        };
    }, [isDisabled]);

    return elementRef;
}

function StudentLayoutInner({ children }) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { unreadCount, pushEnabled, togglePushNotifications } = useNotifications() || {};
    const { user, logout, refreshUser } = useAuth();
    const { theme, toggleTheme } = useStudentTheme();
    const [notifOpen, setNotifOpen] = useState(false);
    const [desktopProfileOpen, setDesktopProfileOpen] = useState(false);
    const [picUploadOpen, setPicUploadOpen] = useState(false);
    const [devicesModalOpen, setDevicesModalOpen] = useState(false);
    const [aboutModalOpen, setAboutModalOpen] = useState(false);
    const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
    const [helpModalOpen, setHelpModalOpen] = useState(false);

    // Credential modals
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

    // Live username check states
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState({ available: null, reason: "" });
    const checkUsernameTimerRef = useRef(null);

    const profileDropdownRef = useRef(null);
    const [unreadNotices, setUnreadNotices] = useState(0);
    const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);
    const hasFetchedOnMount = useRef(false);

    // Batch info for dropdown header
    const [batchName, setBatchName] = useState(() => {
        try {
            return localStorage.getItem(`fp_student_batch_name_${user?.uid}`) || "";
        } catch {
            return "";
        }
    });

    useEffect(() => {
        if (!user?.uid || user.role !== "student") return;
        const fetchBatchInfo = async () => {
            try {
                const info = await api.get("/api/student/batch-info");
                const freshName = info.batch_name || "";
                setBatchName(freshName);
                localStorage.setItem(`fp_student_batch_name_${user.uid}`, freshName);
            } catch (err) {
                console.error("Failed to load batch info:", err);
            }
        };
        fetchBatchInfo();
    }, [user?.uid]);

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
            const res = await api.put("/api/auth/update-credentials", { new_email_prefix: newUsername.trim() });
            if (res.custom_token) await signInWithCustomToken(auth, res.custom_token);
            await refreshUser();
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
            await refreshUser();
            setCredSuccess("Password updated successfully!");
            setNewPassword(""); setConfirmPassword("");
            setTimeout(() => closeCredModals(), 2000);
        } catch (err) { setCredError(err.message || "Failed to update."); }
        finally { setCredLoading(false); }
    };

    // PWA manual update checking
    const [updateChecking, setUpdateChecking] = useState(false);
    const [toast, setToast] = useState({ show: false, message: "", type: "" });

    const handleCheckUpdate = async () => {
        setUpdateChecking(true);
        const result = await window.checkForPwaUpdate?.();
        setUpdateChecking(false);
        if (result === "up_to_date") {
            window.dispatchEvent(new Event("pwa-up-to-date"));
        } else if (result === "error") {
            setToast({ show: true, message: "Failed to check for updates. Try again later.", type: "error" });
            setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
        }
    };

    const handleLogout = async () => { try { await logout(); } catch {} };

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (event.target && (event.target.closest('.fixed.inset-0') || event.target.closest('[role="dialog"]'))) return;
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setDesktopProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (user?.badgeAnimationPending && user?.currentBadge) {
            setShowBadgeCelebration(true);
        }
    }, [user?.badgeAnimationPending, user?.currentBadge]);

    useEffect(() => {
        if (!user || user.role !== "student") return;

        // Reset on user change so count is always fetched for the current user
        hasFetchedOnMount.current = false;

        const fetchUnreadNotices = async () => {
            try {
                const res = await api.get("/api/notices/unread-count");
                setUnreadNotices(res.unread_count || 0);
            } catch (err) {
                console.error("Failed to fetch unread notices count", err);
            }
        };

        // Fetch once on mount / user change
        fetchUnreadNotices();
        hasFetchedOnMount.current = true;

        // Refresh when student reads notices (or new notice arrives)
        const handleNoticesRead = () => fetchUnreadNotices();

        // Refresh when app comes to foreground (covers background-notification + app-open case)
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                fetchUnreadNotices();
            }
        };

        window.addEventListener("notices-read", handleNoticesRead);
        window.addEventListener("notices-updated", handleNoticesRead);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            window.removeEventListener("notices-read", handleNoticesRead);
            window.removeEventListener("notices-updated", handleNoticesRead);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [user]);

    // Scroll lock when any modal/dropdown open
    useEffect(() => {
        const isAnyOpen = Boolean(
            notifOpen ||
            desktopProfileOpen ||
            picUploadOpen ||
            devicesModalOpen ||
            aboutModalOpen ||
            helpModalOpen ||
            usernameModalOpen ||
            passwordModalOpen
        );
        if (isAnyOpen) {
            document.documentElement.classList.add("scroll-lock");
            return () => document.documentElement.classList.remove("scroll-lock");
        }
    }, [notifOpen, desktopProfileOpen, picUploadOpen, devicesModalOpen, aboutModalOpen, helpModalOpen, usernameModalOpen, passwordModalOpen]);

    const isDashboard = pathname === "/student";
    const bounceRef = useScrollBounce(false);

    const isLight = theme === "light";
    const accentColor = isLight ? "#0d9488" : "#3b82f6";

    // Show mandatory upload modal if student has no profile pic yet
    const needsProfilePic = user && !user.profilePicUrl;
    const isLight2 = isLight; // alias for use in portal

    // ── Bottom nav: kinetic sliding indicator ──
    const activeIdx = studentBottomNav.findIndex(item => pathname === item.href);

    // Retrieve previous active index from sessionStorage to animate across page mounts
    const savedPrevIdx = sessionStorage.getItem("prevActiveIdx_student");
    const initialPrevIdx = savedPrevIdx !== null ? Number(savedPrevIdx) : activeIdx;

    const [indicatorIdx, setIndicatorIdx] = useState(initialPrevIdx);
    const prevIdxRef = useRef(initialPrevIdx);
    const rafRef = useRef(null);
    const iconRefs = useRef([]);
    const isAnimatingRef = useRef(false);

    // Save active index to sessionStorage on change
    useEffect(() => {
        if (activeIdx >= 0) {
            sessionStorage.setItem("prevActiveIdx_student", activeIdx);
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

                    studentBottomNav.forEach((_, i) => {
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
                        iconRefs.current.forEach((el, i) => {
                            if (!el) return;
                            if (i === to) {
                                el.style.color = '#ffffff';
                                el.style.transform = 'scale(1.14)';
                                el.style.fontVariationSettings = "'FILL' 1";
                            } else {
                                el.style.color = isLight ? 'var(--st-nav-icon-inactive)' : 'rgba(59,89,152,0.5)';
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

    const isSubPageMobile = pathname !== "/student" &&
        pathname !== "/student/payments" &&
        pathname !== "/student/leaderboard" &&
        pathname !== "/student/notes" &&
        pathname !== "/student/settings";

    const isHomeMobile = pathname === "/student";
    const isSettings = pathname === "/student/settings";

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
            {/* Global Badge Celebration Overlay — triggers on ANY student page when app is open */}
            {showBadgeCelebration && user?.currentBadge && (
                <BadgeCelebrationOverlay
                    badgeTier={user.currentBadge}
                    user={user}
                    onComplete={() => {
                        setShowBadgeCelebration(false);
                        if (refreshUser) refreshUser();
                    }}
                />
            )}
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

            {/* ── Mobile TopAppBar (Homepage Only) ── */}
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
                                borderColor: 'var(--st-logo-border)',
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
                            style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}
                        >
                            FP Finance
                        </h1>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            onClick={() => navigate("/student/notices")}
                            className="relative flex items-center justify-center transition-all active:scale-95 duration-200 cursor-pointer p-1"
                            style={{ color: 'var(--st-text-secondary)' }}
                        >
                            <span className="material-symbols-outlined text-[24px]">campaign</span>
                            {unreadNotices > 0 && (
                                <span
                                    className="absolute top-0 right-0 min-w-[15px] h-[15px] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse"
                                    style={{
                                        backgroundColor: '#ff6e84',
                                        borderWidth: 1,
                                        borderColor: isLight ? '#eef2ff' : '#0c0e17',
                                    }}
                                >
                                    {unreadNotices > 9 ? "9+" : unreadNotices}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => navigate("/notifications")}
                            className="relative flex items-center justify-center transition-all active:scale-95 duration-200 cursor-pointer p-1"
                            style={{ color: 'var(--st-text-secondary)' }}
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
                            className="transition-all cursor-pointer active:scale-95"
                            onClick={() => navigate("/student/settings")}
                        >
                            <ProfilePicture size={34} />
                        </div>
                    </div>
                </header>
            )}

            {/* ── Mobile Header (Sub-Pages) ── */}
            {isSubPageMobile && (
                <header
                    className={`md:hidden fixed top-0 w-full flex items-center px-4 h-16 z-50 ${pathname === "/student/notices" ? "" : "animate-fade-in-down"}`}
                    style={{
                        background: 'var(--st-nav-bg)',
                        borderBottom: `1px solid var(--st-nav-border)`,
                        boxShadow: 'var(--st-nav-shadow)',
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
                                navigate("/student", { replace: true });
                            }
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl active:scale-90 transition-all mr-3"
                        style={{
                            backgroundColor: 'var(--st-icon-bg)',
                            color: 'var(--st-text-secondary)',
                        }}
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1
                            className="text-lg font-bold tracking-tight leading-none"
                            style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}
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
                            className="w-12 h-12 rounded-full overflow-hidden shadow-lg group-hover:scale-110 transition-transform duration-300 flex items-center justify-center"
                            style={{
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: 'var(--st-logo-border)',
                                backgroundColor: isLight ? '#f0f4ff' : '#0c0e17',
                                boxShadow: `0 4px 12px var(--st-logo-shadow)`,
                            }}
                        >
                            <img 
                                src={logoSrc} 
                                alt="Logo" 
                                className="w-full h-full object-cover pointer-events-none select-none" 
                                draggable="false"
                                onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}
                            />
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
                                className="flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 group"
                                style={{
                                    backgroundColor: isActive ? (isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)') : 'transparent',
                                    color: isActive ? activeColor : 'var(--st-text-secondary)',
                                    border: isActive ? `1px solid ${isLight ? 'rgba(13,148,136,0.2)' : 'rgba(59,130,246,0.2)'}` : '1px solid transparent',
                                    boxShadow: isActive ? `0 0 20px ${isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)'}` : 'none',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`material-symbols-outlined text-[22px] transition-transform group-hover:scale-110 ${isActive ? "material-symbols-filled" : ""}`}>{item.icon}</span>
                                    <span style={{ fontFamily: "'Manrope', sans-serif" }}>{item.label}</span>
                                </div>
                                {item.href === "/student/notices" && unreadNotices > 0 && (
                                    <span
                                        className="min-w-[18px] h-[18px] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse shadow-[0_0_8px_rgba(255,110,132,0.6)]"
                                        style={{ backgroundColor: '#ff6e84' }}
                                    >
                                        {unreadNotices > 9 ? "9+" : unreadNotices}
                                    </span>
                                )}
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

                {/* Profile Picture & Dropdown */}
                <div className="relative" ref={profileDropdownRef}>
                    <div
                        className="relative flex items-center justify-center cursor-pointer"
                        onClick={() => setDesktopProfileOpen(!desktopProfileOpen)}
                    >
                        <ProfilePicture size={36} />
                    </div>

                    {/* Profile Dropdown Popup */}
                    {desktopProfileOpen && (
                        <div
                            className="absolute top-14 right-0 w-80 max-h-[85vh] flex flex-col rounded-[2rem] shadow-[0_24px_60px_rgba(0,0,0,0.2)] animate-[modalIn_0.2s_ease-out] z-50 p-3.5 gap-3 overflow-hidden"
                            style={{
                                transform: "translateZ(0)",
                                isolation: "isolate",
                                backgroundColor: isLight ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.01)',
                                border: `1px solid ${isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.15)'}`,
                                backdropFilter: 'blur(80px) saturate(2.5)',
                                WebkitBackdropFilter: 'blur(80px) saturate(2.5)',
                            }}
                        >
                            {/* Single Unified Profile Header Card */}
                            <div className="shrink-0 p-4 rounded-[1.5rem] border flex flex-col items-center text-center relative overflow-hidden gap-3" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.08)' : 'rgba(59,130,246,0.1)', borderColor: 'var(--st-divider)' }}>
                                <div className="absolute -top-4 -right-4 w-24 h-24 pointer-events-none blur-xl" style={{ backgroundImage: `radial-gradient(circle, ${isLight ? 'rgba(13,148,136,0.3)' : 'rgba(59,130,246,0.3)'} 0%, transparent 70%)` }} />
                                
                                {/* Photo, Name, Username Row */}
                                <div className="flex items-center justify-center gap-3.5 text-left w-full max-w-full">
                                    <div className="relative shrink-0">
                                        <ProfilePicture size={44} />
                                    </div>
                                    <div className="flex flex-col justify-center min-w-0 max-w-[calc(100%-3.5rem)]">
                                        <h3 className="text-base font-extrabold tracking-tight leading-tight truncate" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                            {user?.name || "Student"}
                                        </h3>
                                        <div className="flex items-center gap-1 mt-0.5 min-w-0 max-w-full">
                                            <span className="text-xs font-semibold truncate" style={{ color: accentColor }}>
                                                @{user?.email?.replace(/@fp\.com$/, "") || "student"}
                                            </span>
                                            <span className="material-symbols-outlined shrink-0 select-none leading-none flex items-center justify-center" style={{ fontSize: '13px', width: '13px', height: '13px', color: accentColor, fontVariationSettings: "'FILL' 1" }}>
                                                verified
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Batch Name & Badge (Inside same single box) */}
                                {(batchName || user?.currentBadge) && (
                                    <div className="w-full pt-2.5 border-t flex flex-col items-center justify-center gap-1.5" style={{ borderColor: 'var(--st-divider)' }}>
                                        {/* First: Batch Name */}
                                        {batchName && (
                                            <p
                                                className="text-xs font-semibold tracking-tight truncate max-w-full"
                                                style={{
                                                    color: isLight ? "#0d9488" : "#3b82f6",
                                                    fontFamily: "'Manrope', sans-serif"
                                                }}
                                            >
                                                BATCH: {batchName}
                                            </p>
                                        )}

                                        {/* Second: Current Badge */}
                                        {user?.currentBadge === "prime" && (
                                            <span
                                                className="px-3.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1"
                                                style={{
                                                    backgroundColor: 'rgba(168,85,247,0.15)',
                                                    color: isLight ? '#7c3aed' : '#c084fc',
                                                    border: `1px solid rgba(168,85,247,0.25)`,
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                                                Prime
                                            </span>
                                        )}
                                        {user?.currentBadge === "golden" && (
                                            <span
                                                className="px-3.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1"
                                                style={{
                                                    backgroundColor: 'rgba(245,158,11,0.15)',
                                                    color: isLight ? '#d97706' : '#fbbf24',
                                                    border: `1px solid rgba(245,158,11,0.25)`,
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                                Golden
                                            </span>
                                        )}
                                        {user?.currentBadge === "silver" && (
                                            <span
                                                className="px-3.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1"
                                                style={{
                                                    backgroundColor: 'rgba(148,163,184,0.15)',
                                                    color: isLight ? '#475569' : '#cbd5e1',
                                                    border: `1px solid rgba(148,163,184,0.25)`,
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                                                Silver
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Settings List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
                                {/* Change Profile Photo */}
                                <button
                                    onClick={() => setPicUploadOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--st-primary)]/30"
                                    style={{ backgroundColor: 'var(--st-icon-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: accentColor }}>photo_camera</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>Change Profile Photo</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>

                                {/* Change Username or Mobile */}
                                <button
                                    onClick={() => setUsernameModalOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--st-primary)]/30"
                                    style={{ backgroundColor: 'var(--st-icon-bg)' }}
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: accentColor }}>person</span>
                                        </div>
                                        <span className="text-sm font-medium truncate" style={{ color: 'var(--st-text-primary)' }}>Change Username</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>

                                {/* Change Password */}
                                <button
                                    onClick={() => setPasswordModalOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--st-primary)]/30"
                                    style={{ backgroundColor: 'var(--st-icon-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: accentColor }}>lock</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>Change Password</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>



                                {/* Devices */}
                                <button
                                    onClick={() => setDevicesModalOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--st-primary)]/30"
                                    style={{ backgroundColor: 'var(--st-icon-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: accentColor }}>devices</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>Devices</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ color: 'var(--st-text-secondary)', backgroundColor: 'var(--st-icon-bg)' }}>
                                            {user?.activeSessions?.length || 0} active
                                        </span>
                                        <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                    </div>
                                </button>

                                {/* Theme Toggle */}
                                <button
                                    onClick={toggleTheme}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--st-primary)]/30"
                                    style={{ backgroundColor: 'var(--st-icon-bg)' }}
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: accentColor }}>
                                                {isLight ? 'light_mode' : 'dark_mode'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>Theme</span>
                                    </div>
                                    <div className="w-11 h-6 rounded-full relative flex items-center px-1 transition-colors duration-300" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.3)' : 'rgba(115,117,128,0.3)' }}>
                                        <div className="w-4 h-4 rounded-full shadow-sm transition-all duration-300 flex items-center justify-center" style={{ backgroundColor: isLight ? '#0d9488' : '#737580', marginLeft: isLight ? 'auto' : '0' }}>
                                            <span className="material-symbols-outlined text-[10px] text-white select-none">{isLight ? 'light_mode' : 'dark_mode'}</span>
                                        </div>
                                    </div>
                                </button>

                                {/* Push Notifications */}
                                <button
                                    onClick={togglePushNotifications}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--st-primary)]/30"
                                    style={{ backgroundColor: 'var(--st-icon-bg)' }}
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: accentColor }}>notifications</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>Push Notifications</span>
                                    </div>
                                    <div className="w-11 h-6 rounded-full relative flex items-center px-1 transition-colors duration-300" style={{ backgroundColor: pushEnabled ? (isLight ? 'rgba(13,148,136,0.3)' : 'rgba(59,130,246,0.3)') : 'rgba(115,117,128,0.3)' }}>
                                        <div className="w-4 h-4 rounded-full shadow-sm transition-all duration-300" style={{ backgroundColor: pushEnabled ? (isLight ? '#0d9488' : '#3b82f6') : '#737580', marginLeft: pushEnabled ? 'auto' : '0' }} />
                                    </div>
                                </button>

                                {/* Help & Support */}
                                <button
                                    type="button"
                                    onClick={() => setHelpModalOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--st-primary)]/30"
                                    style={{ backgroundColor: 'var(--st-icon-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: accentColor }}>support_agent</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>Help & Support</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>

                                {/* Check for Updates */}
                                <button
                                    onClick={handleCheckUpdate}
                                    disabled={updateChecking}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--st-primary)]/30 disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--st-icon-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)' }}>
                                            <span className={updateChecking ? "material-symbols-outlined text-[18px] animate-spin" : "material-symbols-outlined text-[18px]"} style={{ color: accentColor }}>
                                                {updateChecking ? 'autorenew' : 'system_update'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>
                                            {updateChecking ? 'Checking for updates...' : 'Check for Updates'}
                                        </span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>

                                {/* About */}
                                <button
                                    onClick={() => setAboutModalOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-[var(--st-primary)]/30"
                                    style={{ backgroundColor: 'var(--st-icon-bg)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: isLight ? 'rgba(13,148,136,0.1)' : 'rgba(59,130,246,0.1)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: accentColor }}>info</span>
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>About</span>
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
            </div>

            {/* ── Main Content ── */}
            <main
                className={`relative z-10 md:ml-64 min-h-screen flex flex-col ${isHomeMobile ? "pt-1.5" : (isSubPageMobile ? "pt-24" : "pt-6")} ${!isSubPageMobile ? "pb-24" : "pb-6"} md:pt-8 md:pb-8 px-3.5 sm:px-6 md:px-12`}
                style={{ scrollbarGutter: "stable" }}
            >
                <div ref={bounceRef} className="max-w-4xl w-full mx-auto flex-1" style={{ willChange: "transform" }}>
                    {children}
                </div>
            </main>

            {/* ── Mandatory Profile Pic Upload ── */}
            {/* Shown to students who have no profile picture yet. Non-dismissible. */}
            {needsProfilePic && (
                <ProfilePicUpload
                    isOpen={true}
                    onClose={() => { }}
                    mandatory={true}
                />
            )}

            {/* ── Desktop Profile Pic Upload Modal ── */}
            {picUploadOpen && !needsProfilePic && createPortal(
                <ProfilePicUpload
                    isOpen={picUploadOpen}
                    onClose={() => setPicUploadOpen(false)}
                />,
                document.body
            )}

            {/* Devices Modal */}
            {devicesModalOpen && (
                <MyDevicesModal onClose={() => setDevicesModalOpen(false)} />
            )}

            {/* Help & Support Modal */}
            {helpModalOpen && createPortal(
                <div
                    data-theme={theme}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-fade-in"
                    onClick={() => setHelpModalOpen(false)}
                    style={{
                        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.5)',
                        backdropFilter: 'blur(16px) saturate(1.5)',
                        WebkitBackdropFilter: 'blur(16px) saturate(1.5)'
                    }}
                >
                    <div
                        className="relative w-full max-w-sm rounded-[32px] p-8 animate-modal-in shadow-2xl"
                        onClick={e => e.stopPropagation()}
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
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl flex items-center justify-center border"
                                    style={{
                                        backgroundColor: isLight ? 'rgba(37,211,102,0.1)' : 'rgba(37,211,102,0.15)',
                                        borderColor: isLight ? 'rgba(37,211,102,0.25)' : 'rgba(37,211,102,0.25)'
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[22px]" style={{ color: '#25d366' }}>support_agent</span>
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base leading-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>Help & Support</h3>
                                </div>
                            </div>
                            <button
                                onClick={() => setHelpModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl border transition-all cursor-pointer opacity-60 hover:opacity-100"
                                style={{ backgroundColor: 'var(--st-icon-bg)', borderColor: 'var(--st-input-border)' }}
                            >
                                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--st-text-secondary)' }}>close</span>
                            </button>
                        </div>

                        {/* Info message */}
                        <div className="rounded-2xl px-4 py-4 mb-5 border"
                            style={{
                                backgroundColor: isLight ? 'rgba(13,148,136,0.05)' : 'rgba(59,130,246,0.08)',
                                borderColor: isLight ? 'rgba(13,148,136,0.15)' : 'rgba(59,130,246,0.2)'
                            }}
                        >
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--st-text-secondary)' }}>
                                If you face any issue with the app, payments, or your account — just send a message in our <span className="font-bold" style={{ color: 'var(--st-text-primary)' }}>WhatsApp group</span> and we'll help you out as soon as possible.
                            </p>
                        </div>

                        {/* WhatsApp Group button */}
                        <a
                            href="https://chat.whatsapp.com/IZEGoCBUlIk8cXrtuApsnd"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl border font-bold text-sm transition-all active:scale-95 cursor-pointer"
                            style={{
                                backgroundColor: isLight ? 'rgba(37,211,102,0.1)' : 'rgba(37,211,102,0.12)',
                                borderColor: isLight ? 'rgba(37,211,102,0.3)' : 'rgba(37,211,102,0.3)',
                                color: '#25d366',
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#25d366" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                            </svg>
                            Join FP Help Desk Group
                        </a>

                        <p className="text-center text-[10px] mt-3 font-medium" style={{ color: 'var(--st-text-muted)' }}>
                            Tap the button above to open WhatsApp
                        </p>
                    </div>
                </div>,
                document.body
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
                        <h3 className="font-extrabold text-2xl mb-6 tracking-tight text-center" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>Change Username</h3>

                        {credError && (
                            <div className="mb-5 p-3 rounded-2xl text-xs font-bold text-center"
                                style={{
                                    backgroundColor: isLight ? 'rgba(239,68,68,0.1)' : 'rgba(255,110,132,0.1)',
                                    border: `1px solid ${isLight ? 'rgba(239,68,68,0.2)' : 'rgba(255,110,132,0.2)'}`,
                                    color: isLight ? '#ef4444' : '#ff9dac'
                                }}>
                                {credError}
                            </div>
                        )}

                        {credSuccess && (
                            <div className="mb-5 p-3 rounded-2xl text-xs font-bold text-center"
                                style={{
                                    backgroundColor: 'var(--st-accent-bg)',
                                    border: `1px solid ${isLight ? 'rgba(13,148,136,0.2)' : 'rgba(74,248,227,0.2)'}`,
                                    color: 'var(--st-accent)'
                                }}>
                                {credSuccess}
                            </div>
                        )}

                        <form onSubmit={handleUsernameSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold mb-2 ml-1 uppercase tracking-widest" style={{ color: 'var(--st-text-muted)' }}>New Username</label>
                                <div className="relative">
                                    <input
                                        type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                                        placeholder="Enter new username" required
                                        className="w-full pl-5 pr-12 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-all placeholder:text-gray-400"
                                        style={{
                                            backgroundColor: 'var(--st-icon-bg)',
                                            border: `1px solid ${
                                                usernameStatus.available === true
                                                    ? (isLight ? '#0d9488' : '#4af8e3')
                                                    : usernameStatus.available === false && !usernameStatus.isCurrent && newUsername.trim().length >= 3
                                                    ? (isLight ? '#ef4444' : '#ff9dac')
                                                    : 'var(--st-input-border)'
                                            }`,
                                            color: 'var(--st-text-primary)'
                                        }}
                                    />
                                    {/* Right side live status indicator */}
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                                        {checkingUsername && (
                                            <span className="material-symbols-outlined text-[18px] animate-spin opacity-70" style={{ color: accentColor }}>
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
                                            <span className="opacity-70 animate-pulse" style={{ color: 'var(--st-text-muted)' }}>
                                                Checking availability...
                                            </span>
                                        )}
                                        {!checkingUsername && usernameStatus.available === true && (
                                            <span style={{ color: isLight ? '#0d9488' : '#4af8e3' }}>
                                                ✓ Username is available!
                                            </span>
                                        )}
                                        {!checkingUsername && usernameStatus.available === false && (
                                            <span style={{ color: usernameStatus.isCurrent ? 'var(--st-text-muted)' : (isLight ? '#ef4444' : '#ff9dac') }}>
                                                {usernameStatus.isCurrent ? "ℹ This is your current username" : `✕ ${usernameStatus.reason}`}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={closeCredModals}
                                    className="flex-1 px-4 py-4 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95"
                                    style={{ backgroundColor: 'var(--st-icon-bg)', border: `1px solid var(--st-input-border)`, color: 'var(--st-text-secondary)' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={credLoading || checkingUsername || usernameStatus.available !== true}
                                    className={`flex-1 px-4 py-4 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 cursor-pointer active:scale-95 border shadow-lg ${isLight
                                        ? 'bg-[#0d9488]/10 border-[#0d9488]/30 text-[#0d9488] hover:bg-[#0d9488]/20'
                                        : 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/20'
                                        }`}
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
                        <h3 className="font-extrabold text-2xl mb-6 tracking-tight text-center" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>Change Password</h3>

                        {credError && (
                            <div className="mb-5 p-3 rounded-2xl text-xs font-bold text-center"
                                style={{
                                    backgroundColor: isLight ? 'rgba(239,68,68,0.1)' : 'rgba(255,110,132,0.1)',
                                    border: `1px solid ${isLight ? 'rgba(239,68,68,0.2)' : 'rgba(255,110,132,0.2)'}`,
                                    color: isLight ? '#ef4444' : '#ff9dac'
                                }}>
                                {credError}
                            </div>
                        )}

                        {credSuccess && (
                            <div className="mb-5 p-3 rounded-2xl text-xs font-bold text-center"
                                style={{
                                    backgroundColor: 'var(--st-accent-bg)',
                                    border: `1px solid ${isLight ? 'rgba(13,148,136,0.2)' : 'rgba(74,248,227,0.2)'}`,
                                    color: 'var(--st-accent)'
                                }}>
                                {credSuccess}
                            </div>
                        )}

                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-2 ml-1 uppercase tracking-widest" style={{ color: 'var(--st-text-muted)' }}>New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Min 6 characters" required minLength={6}
                                        className="w-full pl-5 pr-12 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-all placeholder:text-gray-400"
                                        style={{ backgroundColor: 'var(--st-icon-bg)', border: `1px solid var(--st-input-border)`, color: 'var(--st-text-primary)' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl transition-colors opacity-70 hover:opacity-100 cursor-pointer"
                                        style={{ backgroundColor: 'transparent' }}
                                    >
                                        <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--st-text-muted)' }}>
                                            {showNewPassword ? "visibility" : "visibility_off"}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold mb-2 ml-1 uppercase tracking-widest" style={{ color: 'var(--st-text-muted)' }}>Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter password" required minLength={6}
                                        className="w-full pl-5 pr-12 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-all placeholder:text-gray-400"
                                        style={{ backgroundColor: 'var(--st-icon-bg)', border: `1px solid var(--st-input-border)`, color: 'var(--st-text-primary)' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl transition-colors opacity-70 hover:opacity-100 cursor-pointer"
                                        style={{ backgroundColor: 'transparent' }}
                                    >
                                        <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--st-text-muted)' }}>
                                            {showConfirmPassword ? "visibility" : "visibility_off"}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-3">
                                <button type="button" onClick={closeCredModals}
                                    className="flex-1 px-4 py-4 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95"
                                    style={{ backgroundColor: 'var(--st-icon-bg)', border: `1px solid var(--st-input-border)`, color: 'var(--st-text-secondary)' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={credLoading}
                                    className={`flex-1 px-4 py-4 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 cursor-pointer active:scale-95 border shadow-lg ${isLight
                                        ? 'bg-[#0d9488]/10 border-[#0d9488]/30 text-[#0d9488] hover:bg-[#0d9488]/20'
                                        : 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/20'
                                        }`}
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
                            <h3 className="font-extrabold text-xl tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                About
                            </h3>
                            <button
                                onClick={() => setAboutModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
                                style={{
                                    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                                    border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`,
                                    color: 'var(--st-text-muted)'
                                }}
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        <AboutContent
                            isLight={isLight}
                            accentColor={accentColor}
                            onFeedbackClick={() => {
                                setAboutModalOpen(false);
                                setFeedbackModalOpen(true);
                            }}
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* Feedback Modal */}
            <StudentFeedbackModal
                isOpen={feedbackModalOpen}
                onClose={() => {
                    setFeedbackModalOpen(false);
                    setAboutModalOpen(true);
                }}
                isLight={isLight}
                accentColor={accentColor}
                theme={theme}
            />

            {/* ── Mobile Bottom Navigation ── */}
            {!isSubPageMobile && (
                <nav
                    className="md:hidden fixed bottom-6 left-4 right-4 z-40 overflow-hidden rounded-full isolate flex items-center h-[60px]"
                    style={{
                        background: 'var(--st-nav-bg)',
                        border: '1px solid var(--st-nav-border)',
                        boxShadow: 'var(--st-nav-shadow)',
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
                                left: `calc(6px + ${indicatorIdx} * ((100% - 60px) / ${studentBottomNav.length - 1}))`,
                                transition: 'left 500ms cubic-bezier(0.34, 1.3, 0.64, 1)',
                            }}
                        >
                            <div
                                className="w-12 h-12 rounded-full"
                                style={{
                                    backgroundColor: 'var(--st-nav-indicator)',
                                    boxShadow: `0 0 10px ${isLight ? 'rgba(13,148,136,0.4)' : 'rgba(59,130,246,0.4)'}`,
                                }}
                            />
                        </div>
                    )}
                    {/* ── Nav items ── */}
                    {studentBottomNav.map((item, i) => {
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
                                    left: `calc(6px + ${i} * ((100% - 60px) / ${studentBottomNav.length - 1}))`,
                                }}
                            >
                                <div className="relative flex items-center justify-center">
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

export default function StudentLayout({ children }) {
    return (
        <StudentThemeProvider>
            <StudentLayoutInner>{children}</StudentLayoutInner>
        </StudentThemeProvider>
    );
}

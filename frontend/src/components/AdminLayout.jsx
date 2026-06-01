import { useState, useRef, useEffect } from "react";
import logoSrc from "@/assets/logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import ProfilePicture from "./ProfilePicture";
import NotificationPanel from "./NotificationPanel";
import ProfilePicUpload from "./ProfilePicUpload";
import AppLockSetting from "./AppLockSetting";

// ── Springy easeOutBack solver for bottom bar indicators ──
const easeOutBack = (x) => {
    const c1 = 1.2;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

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

export default function AdminLayout({ children }) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { unreadCount } = useNotifications() || {};
    const { user, logout } = useAuth();
    const [fabOpen, setFabOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [desktopProfileOpen, setDesktopProfileOpen] = useState(false);
    const [picUploadOpen, setPicUploadOpen] = useState(false);
    const profileDropdownRef = useRef(null);

    // Draggable FAB alignment states
    const [fabAlign, setFabAlign] = useState("right");
    const [dragX, setDragX] = useState(null);
    const dragStartRef = useRef({ x: 0, buttonX: 0 });
    const hasMovedRef = useRef(false);

    const handlePointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStartRef.current = {
            x: e.clientX,
            buttonX: e.currentTarget.getBoundingClientRect().left
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
        if (window.confirm("Are you sure you want to logout?")) {
            await logout();
            navigate("/login");
        }
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
        <div className="min-h-[100dvh] w-full overflow-x-hidden bg-[#0c0e17] text-[#f0f0fd] relative isolate" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Custom PWA toast message */}
            {toast.show && (
                <div className="fixed top-20 right-4 z-[999] pointer-events-auto p-4 rounded-xl backdrop-blur-xl shadow-lg border text-sm flex items-center gap-3 w-80 animate-fade-in"
                    style={{
                        backgroundColor: toast.type === "success" ? "rgba(74, 248, 227, 0.15)" : "rgba(59, 130, 246, 0.15)",
                        borderColor: toast.type === "success" ? "rgba(74, 248, 227, 0.3)" : "rgba(59, 130, 246, 0.3)",
                        color: toast.type === "success" ? "#4af8e3" : "#f0f0fd",
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
                <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-[radial-gradient(circle,rgba(59,130,246,0.15)_0%,transparent_70%)] blur-[100px]" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[70%] h-[70%] bg-[radial-gradient(circle,rgba(59,130,246,0.1)_0%,transparent_70%)] blur-[100px]" />
            </div>

            {/* ── Mobile TopAppBar (Main Pages) ── */}
            {!isSubPageMobile && (
                <header 
                    className="md:hidden fixed top-4 left-4 right-4 z-50 flex justify-between items-center pl-3 pr-3 h-14 bg-[#111427]/70 backdrop-blur-2xl border border-[#2a3055]/50 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] animate-fade-in overflow-hidden rounded-[28px]" 
                    style={{ transform: "translateZ(0)", isolation: "isolate" }}
                >
                    <div className="flex items-center gap-3" onClick={() => navigate("/admin")}>
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-[#3b82f6]/40 bg-[#0c0e17] shadow-lg shadow-[#3b82f6]/20 flex items-center justify-center">
                            <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tighter text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>FP Finance</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate("/notifications")}
                            className="relative flex items-center justify-center text-[#aaaab7] hover:text-white transition-all active:scale-95 duration-200 cursor-pointer"
                        >
                            <span className="material-symbols-outlined">notifications</span>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-[#ff6e84] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border border-[#0c0e17] animate-pulse">
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
                <header className="md:hidden fixed top-0 w-full bg-[#0c0e17]/90 backdrop-blur-3xl flex items-center px-4 h-16 z-50 border-b border-white/5 animate-fade-in-down shadow-xl" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                    <button 
                        onClick={() => navigate("/admin")}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-[#aaaab7] active:scale-90 transition-all mr-3"
                    >
                        <span className="material-symbols-outlined">arrow_back_ios_new</span>
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight leading-none" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            {getSubPageTitle() === "Reports" ? "Report Export" : 
                             getSubPageTitle() === "Profile" ? "Admin Profile" : 
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
                        className="relative text-[#aaaab7] hover:text-white transition-all active:scale-95 duration-200 cursor-pointer w-10 h-10 flex items-center justify-center rounded-full bg-[#171924]/60 backdrop-blur-md border border-[#464752]/50 hover:border-[#3b82f6]/50 shadow-lg"
                        style={{ transform: "translateZ(0)", isolation: "isolate" }}
                    >
                        <span className="material-symbols-outlined text-[24px]">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#ff6e84] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-[0_0_10px_rgba(255,110,132,0.4)] animate-pulse border border-[#0c0e17]">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>
                    <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
                </div>

                {/* Profile Picture & Dropdown */}
                <div className="relative" ref={profileDropdownRef}>
                    <div 
                        className="w-10 h-10 rounded-full overflow-hidden transition-all cursor-pointer shadow-lg bg-[#171924]/60"
                        onClick={() => setDesktopProfileOpen(!desktopProfileOpen)}
                    >
                        <ProfilePicture size={40} />
                    </div>

                    {/* Profile Dropdown Popup */}
                    {desktopProfileOpen && (
                        <div className="absolute top-14 right-0 w-80 bg-[#0c0e17]/95 backdrop-blur-3xl border border-[#464752]/50 rounded-[2rem] shadow-[0_24px_60px_rgba(0,0,0,0.7)] overflow-hidden animate-[modalIn_0.2s_ease-out] z-50 p-4 space-y-4" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                            {/* Profile Header Card */}
                            <div className="bg-[#3b82f6]/10 p-5 rounded-[1.5rem] border border-white/5 flex flex-col items-center text-center relative overflow-hidden">
                                <div className="absolute -top-4 -right-4 w-24 h-24 bg-[radial-gradient(circle,rgba(59,130,246,0.3)_0%,transparent_70%)] blur-xl pointer-events-none" />
                                <div className="relative mb-3">
                                    <div className="absolute -inset-1 bg-gradient-to-tr from-[#3b82f6] to-[#4af8e3] rounded-full blur-sm opacity-40" />
                                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[#0c0e17]">
                                        <ProfilePicture size={64} />
                                    </div>
                                </div>
                                <h3 className="text-lg font-extrabold tracking-tight text-[#f0f0fd] leading-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    {user?.name || "Admin User"}
                                </h3>
                                <p className="text-[#aaaab7] text-xs mt-0.5">{user?.email?.replace(/@fp\.com$/, "") || "admin"}</p>
                            </div>

                            {/* Settings List */}
                            <div className="space-y-2">
                                <button 
                                    onClick={() => { setDesktopProfileOpen(false); setPicUploadOpen(true); }}
                                    className="w-full flex items-center justify-between p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group cursor-pointer border border-transparent hover:border-[#3b82f6]/30"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center bg-black/20 rounded-xl group-hover:bg-[#3b82f6]/20 transition-colors">
                                            <span className="material-symbols-outlined text-[18px] text-[#3b82f6]">photo_camera</span>
                                        </div>
                                        <span className="text-sm font-medium text-[#f0f0fd]">Change Profile Photo</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>
                                
                                <AppLockSetting 
                                    accentColor="#3b82f6" 
                                    isLight={false} 
                                    variant="dropdown" 
                                    onSelect={() => setDesktopProfileOpen(false)} 
                                />
                                
                                <button 
                                    onClick={handleCheckUpdate}
                                    disabled={updateChecking}
                                    className="w-full flex items-center justify-between p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group cursor-pointer border border-transparent hover:border-[#3b82f6]/30 disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center bg-black/20 rounded-xl group-hover:bg-[#3b82f6]/20 transition-colors">
                                            <span className={updateChecking ? "material-symbols-outlined text-[18px] text-[#3b82f6] animate-spin" : "material-symbols-outlined text-[18px] text-[#3b82f6]"}>
                                                {updateChecking ? 'autorenew' : 'system_update'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium text-[#f0f0fd]">
                                            {updateChecking ? 'Checking for updates...' : 'Check for Updates'}
                                        </span>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-[#737580] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>
                                
                                <button 
                                    onClick={() => { setDesktopProfileOpen(false); handleLogout(); }}
                                    className="w-full flex items-center gap-3 p-3 bg-[#a70138]/10 hover:bg-[#a70138]/20 transition-all rounded-2xl border border-[#ff6e84]/20 group cursor-pointer justify-center"
                                >
                                    <span className="material-symbols-outlined text-[18px] text-[#ff6e84] group-hover:-translate-x-1 transition-transform">logout</span>
                                    <span className="text-sm font-bold text-[#ff6e84] tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>Logout</span>
                                </button>
                            </div>

                            {/* App Version Footer */}
                            <div className="pt-2 text-center border-t border-white/5">
                                {/* eslint-disable-next-line no-undef */}
                                <p className="text-[9px] text-[#aaaab7] uppercase tracking-[0.2em] opacity-60 font-bold">FP Finance v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.2.0'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Desktop Sidebar ── */}
            <aside 
                className="hidden md:flex fixed top-0 left-0 h-full z-40 w-64 flex-col bg-[#0c0e17]/95 backdrop-blur-[40px] border-r border-white/5 shadow-[20px_0_40px_rgba(0,0,0,0.3)]"
                style={{ transform: "translateZ(0)", isolation: "isolate" }}
            >
                {/* Profile / Header */}
                <div className="p-6 border-b border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#3b82f6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-[#3b82f6]/40 bg-[#0c0e17] shadow-lg shadow-[#3b82f6]/20 group-hover:scale-110 transition-transform duration-300 flex items-center justify-center">
                            <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h1 className="text-sm font-extrabold text-white tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>FP Finance</h1>
                            <p className="text-[#aaaab7] text-[11px] font-medium uppercase tracking-widest opacity-70">Future Point</p>
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
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 group
                                    ${isActive 
                                        ? "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]" 
                                        : "text-[#aaaab7] hover:text-white hover:bg-white/5 active:scale-95"
                                    }`}
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
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>

            {/* ── Mobile: FAB Menu Drawer ── */}
            <div 
                className={`md:hidden fixed bottom-[176px] z-[60] w-48 flex flex-col gap-3 transition-all duration-300 transform ${
                    fabAlign === "left" ? "left-6 origin-bottom-left" : "right-6 origin-bottom-right"
                } ${fabOpen && !isSubPageMobile ? "scale-100 opacity-100 translate-y-0" : "scale-50 opacity-0 translate-y-10 pointer-events-none"}`} 
                style={{ 
                    transform: fabOpen ? "translateZ(0) scale(1) translateY(0)" : "translateZ(0) scale(0.5) translateY(40px)" 
                }}
            >
                <div className="bg-[#171924]/95 backdrop-blur-3xl rounded-3xl p-3 shadow-2xl border border-white/5 space-y-1" style={{ isolation: "isolate" }}>
                    {adminFabNav.map((item) => (
                        <button 
                            key={item.href}
                            onClick={() => handleFabLink(item.href)}
                            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-white/5 transition-colors group cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[#3b82f6]">{item.icon}</span>
                            <span className="font-semibold text-[#aaaab7] group-hover:text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Mobile: Overlay to close FAB ── */}
            {fabOpen && !isSubPageMobile && (
                <div 
                    className="md:hidden fixed inset-0 z-[55] bg-black/20 backdrop-blur-sm transition-opacity cursor-pointer"
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
                    className={`md:hidden fixed bottom-[110px] w-14 h-14 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(74,248,227,0.3)] z-[60] active:scale-95 transition-all duration-300 cursor-pointer ${fabOpen ? "bg-[#ff6e84] text-white rotate-45 shadow-[0_10px_30px_rgba(255,110,132,0.3)]" : "bg-[#4af8e3] text-[#005b51]"}`}
                    style={{
                        left: dragX !== null ? `${dragX}px` : (fabAlign === "left" ? "24px" : "auto"),
                        right: dragX !== null ? "auto" : (fabAlign === "right" ? "24px" : "auto"),
                        transition: dragX !== null ? "none" : "all 300ms cubic-bezier(0.25, 0.8, 0.25, 1)",
                        touchAction: "none"
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
                <div className="md:hidden fixed bottom-6 left-8 right-8 z-40 overflow-hidden rounded-[28px] isolate">
                    <nav className="relative flex items-center bg-[#111427]/70 backdrop-blur-2xl border border-[#2a3055]/50 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden rounded-[28px]" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
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
                                <div className="w-12 h-12 rounded-full bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
                            </div>
                        )}
                        {/* ── Nav items ── */}
                        {adminBottomNav.map((item, i) => {
                            const isActive = i === indicatorIdx;
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
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
                    background: rgba(59,130,246,0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(59,130,246,0.3);
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

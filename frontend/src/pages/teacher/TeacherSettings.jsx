import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import { useTeacherTheme } from "@/context/TeacherThemeContext";
import { useNavigate } from "react-router-dom";
import AboutContent from "@/components/AboutContent";
import { useNotifications } from "@/context/NotificationContext";
import { api } from "@/lib/api";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import ProfilePicture from "@/components/ProfilePicture";
import ProfilePicUpload from "@/components/ProfilePicUpload";
import MyDevicesModal from "@/components/MyDevicesModal";
import AppLockSetting from "@/components/AppLockSetting";

function TeacherSettingsContent() {
    const { user, logout, refreshUser } = useAuth();
    const { theme, toggleTheme } = useTeacherTheme();
    const isLight = theme === "light";
    const navigate = useNavigate();
    const { pushEnabled, togglePushNotifications } = useNotifications();
    const [picModalOpen, setPicModalOpen] = useState(false);
    const [devicesModalOpen, setDevicesModalOpen] = useState(false);
    const [aboutModalOpen, setAboutModalOpen] = useState(false);

    // Scrolling header micro-interactions state
    const [avatarHidden, setAvatarHidden] = useState(false);
    const [nameHidden, setNameHidden] = useState(false);
    const [usernameHidden, setUsernameHidden] = useState(false);

    const avatarElRef = useRef(null);
    const nameElRef = useRef(null);
    const usernameElRef = useRef(null);

    useEffect(() => {
        const handleScroll = () => {
            if (window.innerWidth >= 768) return; // Only on mobile view

            if (avatarElRef.current) {
                const rect = avatarElRef.current.getBoundingClientRect();
                setAvatarHidden(rect.bottom < 64);
            }
            if (nameElRef.current) {
                const rect = nameElRef.current.getBoundingClientRect();
                setNameHidden(rect.bottom < 64);
            }
            if (usernameElRef.current) {
                const rect = usernameElRef.current.getBoundingClientRect();
                setUsernameHidden(rect.bottom < 64);
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

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
    };

    const handleUsernameSubmit = async (e) => {
        e.preventDefault();
        if (!newUsername.trim()) return;
        setCredLoading(true); setCredError(""); setCredSuccess("");
        try {
            const res = await api.put("/api/auth/update-credentials", { new_username: newUsername.trim() });
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

    const displayUsername = user?.email?.replace(/@fp\.com$/, "") || "user";
    const activeSessionCount = user?.activeSessions?.length || 0;

    const handleAboutClick = () => {
        if (window.innerWidth < 768) {
            navigate("/about");
        } else {
            setAboutModalOpen(true);
        }
    };

    const accentColor = isLight ? "#0d9488" : "#3b82f6";

    return (
        <>
            {/* Sticky Scrolling Profile Header Navbar - portal to bypass will-change:transform ancestor */}
            {createPortal(
                <div
                    data-theme={theme}
                    className="fixed top-0 left-0 right-0 h-16 z-[55] flex items-center px-6 gap-3 md:hidden border-b"
                    style={{
                        backgroundColor: isLight ? 'rgba(238, 242, 255, 0.75)' : 'rgba(12, 14, 23, 0.55)',
                        borderColor: 'var(--tt-divider)',
                        backdropFilter: 'blur(20px) saturate(1.6)',
                        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
                        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
                        transform: avatarHidden ? 'translateY(0)' : 'translateY(-100%)',
                        opacity: avatarHidden ? 1 : 0,
                        pointerEvents: avatarHidden ? 'auto' : 'none',
                    }}
                >
                    {/* Profile Photo */}
                    <div
                        style={{
                            transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease',
                            transform: avatarHidden ? 'scale(1)' : 'scale(0.4)',
                            opacity: avatarHidden ? 1 : 0,
                            flexShrink: 0,
                        }}
                    >
                        <ProfilePicture size={38} className="border shadow-md" style={{ borderColor: 'var(--tt-card-border)' }} />
                    </div>

                    {/* Name & Username */}
                    <div className="flex flex-col justify-center min-w-0">
                        <span
                            className="font-extrabold text-base truncate leading-tight"
                            style={{
                                color: 'var(--tt-text-primary)',
                                transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease',
                                transform: nameHidden ? 'translateY(0)' : 'translateY(10px)',
                                opacity: nameHidden ? 1 : 0,
                            }}
                        >
                            {user?.name || "Teacher"}
                        </span>
                        <span
                            className="text-xs font-semibold truncate mt-0.5"
                            style={{
                                color: accentColor,
                                transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.45s ease',
                                transform: usernameHidden ? 'translateY(0)' : 'translateY(8px)',
                                opacity: usernameHidden ? 1 : 0,
                            }}
                        >
                            @{displayUsername}
                        </span>
                    </div>
                </div>,
                document.body
            )}

            <div className="space-y-8" style={{ isolation: "isolate" }}>
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

                {/* ── Profile Header Card ── */}
                <section className="relative" style={{ transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden" }}>
                    <div 
                        className="backdrop-blur-2xl p-8 rounded-[32px] border shadow-md flex flex-col items-center text-center" 
                        style={{ 
                            backgroundColor: isLight ? 'rgba(13, 148, 136, 0.08)' : 'rgba(59, 130, 246, 0.1)',
                            borderColor: isLight ? 'rgba(13, 148, 136, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                            boxShadow: isLight ? '0 20px 40px rgba(0,0,0,0.05)' : '0 20px 40px rgba(0,0,0,0.3)',
                            transform: "translateZ(0)", 
                            isolation: "isolate", 
                            backfaceVisibility: "hidden", 
                            outline: "1px solid transparent" 
                        }}
                    >
                        <div ref={avatarElRef} className="mb-4 flex items-center justify-center">
                            <ProfilePicture size={96} className="border-2" style={{ borderColor: 'var(--tt-card-border)' }} />
                        </div>
                        <h2 ref={nameElRef} className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                            {user?.name || "Teacher"}
                        </h2>
                        <p ref={usernameElRef} className="tracking-wider mt-1 text-sm font-semibold" style={{ color: accentColor }}>@{displayUsername}</p>
                    </div>
                </section>

                {/* ── Settings List ── */}
                <section className="space-y-6" style={{ transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                    {/* ── ACCOUNT ── */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest pl-2" style={{ color: 'var(--tt-text-secondary)' }}>Account</h3>
                        <div className="space-y-3">
                            {/* Change Profile Photo */}
                            <button
                                onClick={() => setPicModalOpen(true)}
                                className="w-full flex items-center justify-between p-4 glass-card-teacher rounded-2xl transition-all group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                        <span className="material-symbols-outlined" style={{ color: accentColor }}>photo_camera</span>
                                    </div>
                                    <span className="font-medium" style={{ color: 'var(--tt-text-primary)' }}>Change Profile Photo</span>
                                </div>
                                <span className="material-symbols-outlined" style={{ color: 'var(--tt-text-muted)' }}>chevron_right</span>
                            </button>

                            {/* Change Username or Mobile */}
                            <button
                                onClick={() => setUsernameModalOpen(true)}
                                className="w-full flex items-center justify-between p-4 glass-card-teacher rounded-2xl transition-all group cursor-pointer"
                            >
                                <div className="flex items-center gap-4 text-left">
                                    <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                        <span className="material-symbols-outlined" style={{ color: accentColor }}>person</span>
                                    </div>
                                    <span className="font-medium leading-snug" style={{ color: 'var(--tt-text-primary)' }}>Change Username or Mobile</span>
                                </div>
                                <span className="material-symbols-outlined" style={{ color: 'var(--tt-text-muted)' }}>chevron_right</span>
                            </button>
                        </div>
                    </div>

                    {/* ── SECURITY ── */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest pl-2" style={{ color: 'var(--tt-text-secondary)' }}>Security</h3>
                        <div className="space-y-3">
                            {/* Change Password */}
                            <button
                                onClick={() => setPasswordModalOpen(true)}
                                className="w-full flex items-center justify-between p-4 glass-card-teacher rounded-2xl transition-all group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                        <span className="material-symbols-outlined" style={{ color: accentColor }}>lock</span>
                                    </div>
                                    <span className="font-medium" style={{ color: 'var(--tt-text-primary)' }}>Change Password</span>
                                </div>
                                <span className="material-symbols-outlined" style={{ color: 'var(--tt-text-muted)' }}>chevron_right</span>
                            </button>

                            {/* App Lock (Biometric) */}
                            <AppLockSetting accentColor={accentColor} isLight={isLight} />

                            {/* Devices */}
                            <button
                                onClick={() => setDevicesModalOpen(true)}
                                className="w-full flex items-center justify-between p-4 glass-card-teacher rounded-2xl transition-all group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                        <span className="material-symbols-outlined" style={{ color: accentColor }}>devices</span>
                                    </div>
                                    <span className="font-medium" style={{ color: 'var(--tt-text-primary)' }}>Devices</span>
                                </div>
                                <span className="text-xs px-2 py-1 rounded" style={{ color: 'var(--tt-text-secondary)', backgroundColor: 'var(--tt-hover-bg)' }}>
                                    {activeSessionCount} active
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* ── PREFERENCES ── */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest pl-2" style={{ color: 'var(--tt-text-secondary)' }}>Preferences</h3>
                        <div className="space-y-3">
                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="w-full flex items-center justify-between p-4 glass-card-teacher rounded-2xl transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                        <span className="material-symbols-outlined" style={{ color: accentColor }}>
                                            {isLight ? "light_mode" : "dark_mode"}
                                        </span>
                                    </div>
                                    <span className="font-medium" style={{ color: 'var(--tt-text-primary)' }}>Theme</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs" style={{ color: 'var(--tt-text-secondary)' }}>
                                        {isLight ? 'Light mode' : 'Dark mode'}
                                    </span>
                                    {/* Toggle switch */}
                                    <div
                                        className="w-11 h-6 rounded-full relative flex items-center px-1 transition-colors duration-300"
                                        style={{
                                            backgroundColor: isLight ? 'rgba(13,148,136,0.3)' : 'rgba(59,130,246,0.3)',
                                        }}
                                    >
                                        <div
                                            className="w-4 h-4 rounded-full shadow-sm transition-all duration-300 flex items-center justify-center"
                                            style={{
                                                backgroundColor: isLight ? '#0d9488' : '#3b82f6',
                                                marginLeft: isLight ? 'auto' : '0',
                                            }}
                                        >
                                            <span className="material-symbols-outlined text-white text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                {isLight ? 'light_mode' : 'dark_mode'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </button>

                            {/* Push Notifications Toggle */}
                            <button
                                onClick={togglePushNotifications}
                                className="w-full flex items-center justify-between p-4 glass-card-teacher rounded-2xl transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-4 text-left">
                                    <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                        <span className="material-symbols-outlined" style={{ color: accentColor }}>notifications</span>
                                    </div>
                                    <span className="font-medium" style={{ color: 'var(--tt-text-primary)' }}>Push Notifications</span>
                                </div>
                                <div className="flex items-center">
                                    {/* Toggle switch */}
                                    <div
                                        className="w-11 h-6 rounded-full relative flex items-center px-1 transition-colors duration-300"
                                        style={{
                                            backgroundColor: pushEnabled
                                                ? (isLight ? 'rgba(13,148,136,0.3)' : 'rgba(59,130,246,0.3)')
                                                : 'rgba(115, 117, 128, 0.3)',
                                        }}
                                    >
                                        <div
                                            className="w-4 h-4 rounded-full shadow-sm transition-all duration-300"
                                            style={{
                                                backgroundColor: pushEnabled
                                                    ? (isLight ? '#0d9488' : '#3b82f6')
                                                    : '#737580',
                                                marginLeft: pushEnabled ? 'auto' : '0',
                                            }}
                                        />
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* ── SUPPORT ── */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest pl-2" style={{ color: 'var(--tt-text-secondary)' }}>Support</h3>
                        <div className="space-y-3">
                            {/* Help & Support */}
                            <a
                                href="https://wa.me/917001637243"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-between p-4 glass-card-teacher rounded-2xl transition-all group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                        <span className="material-symbols-outlined" style={{ color: accentColor }}>support_agent</span>
                                    </div>
                                    <span className="font-medium" style={{ color: 'var(--tt-text-primary)' }}>Help & Support</span>
                                </div>
                                <span className="material-symbols-outlined" style={{ color: 'var(--tt-text-muted)' }}>chevron_right</span>
                            </a>
                        </div>
                    </div>

                    {/* ── APP INFO ── */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest pl-2" style={{ color: 'var(--tt-text-secondary)' }}>App Info</h3>
                        <div className="space-y-3">
                            {/* Check for updates */}
                            <button
                                onClick={handleCheckUpdate}
                                disabled={updateChecking}
                                className="w-full flex items-center justify-between p-4 glass-card-teacher rounded-2xl transition-all group cursor-pointer disabled:opacity-50"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                        <span className={updateChecking ? "material-symbols-outlined animate-spin" : "material-symbols-outlined"} style={{ color: accentColor }}>
                                            {updateChecking ? 'autorenew' : 'system_update'}
                                        </span>
                                    </div>
                                    <span className="font-medium" style={{ color: 'var(--tt-text-primary)' }}>
                                        {updateChecking ? 'Checking for updates...' : 'Check for Updates'}
                                    </span>
                                </div>
                                <span className="material-symbols-outlined" style={{ color: 'var(--tt-text-muted)' }}>chevron_right</span>
                            </button>

                            {/* About */}
                            <button
                                onClick={handleAboutClick}
                                className="w-full flex items-center justify-between p-4 glass-card-teacher rounded-2xl transition-all group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--tt-icon-bg)' }}>
                                        <span className="material-symbols-outlined" style={{ color: accentColor }}>info</span>
                                    </div>
                                    <span className="font-medium" style={{ color: 'var(--tt-text-primary)' }}>About</span>
                                </div>
                                <span className="material-symbols-outlined" style={{ color: 'var(--tt-text-muted)' }}>chevron_right</span>
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── Footer ── */}
                <footer className="mt-4 md:mt-12 flex flex-col items-center gap-6">
                    <button
                        onClick={logout}
                        className="group flex items-center gap-3 px-8 py-3 transition-all rounded-full border cursor-pointer active:scale-95"
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--tt-error)' }}
                    >
                        <span className="material-symbols-outlined">logout</span>
                        <span className="font-bold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>Logout</span>
                    </button>
                </footer>

                {/* ══ Modals ══ */}

                {/* Profile Pic Upload */}
                <ProfilePicUpload isOpen={picModalOpen} onClose={() => setPicModalOpen(false)} />

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
                            <form onSubmit={handleUsernameSubmit}>
                                <label className="block text-xs mb-1.5" style={{ color: 'var(--tt-text-secondary)' }}>New Username or Mobile</label>
                                <input
                                    type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Enter new username or mobile" required
                                    className="w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-0 focus:ring-offset-0 mb-4"
                                    style={{ backgroundColor: 'var(--tt-input-bg)', borderColor: 'var(--tt-input-border)', color: 'var(--tt-text-primary)' }}
                                />
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
                            <h3 className="text-center font-bold text-2xl mb-1 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>Change Password</h3>
                            <p className="text-[10px] uppercase tracking-widest font-bold mb-6 text-center" style={{ color: 'var(--tt-text-secondary)' }}>Security update required</p>
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
                                        className="w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-offset-0 focus:ring-0"
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
                                        className="w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-offset-0 focus:ring-0"
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

                {/* Devices Modal */}
                {devicesModalOpen && (
                    <MyDevicesModal onClose={() => setDevicesModalOpen(false)} />
                )}

                {/* About Modal (Desktop only) */}
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
                            {/* Header row */}
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

                            {/* Shared content */}
                            <AboutContent isLight={isLight} accentColor={accentColor} />
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </>
    );
}

export default function TeacherSettings() {
    return (
        <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherLayout>
                <TeacherSettingsContent />
            </TeacherLayout>
        </ProtectedRoute>
    );
}

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import ProfilePicture from "@/components/ProfilePicture";
import ProfilePicUpload from "@/components/ProfilePicUpload";
import AppLockSetting from "@/components/AppLockSetting";
import { useNotifications } from "@/context/NotificationContext";
import { useAdminTheme } from "@/context/AdminThemeContext";

function AdminProfileContent() {
    const { user, logout } = useAuth();
    const [picModalOpen, setPicModalOpen] = useState(false);
    const { pushEnabled, togglePushNotifications } = useNotifications();
    const { theme, toggleTheme } = useAdminTheme();
    const isLight = theme === "light";

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

    return (
        <div className="space-y-8 max-w-lg mx-auto pt-4">
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
            {/* ── Profile Header Card ── */}
            <section className="relative">
                <div className="p-8 rounded-[32px] border flex flex-col items-center text-center shadow-lg"
                     style={{
                         backgroundColor: 'var(--ad-accent-bg)',
                         borderColor: 'var(--ad-divider)',
                     }}
                >
                    {/* Profile Picture with gradient glow */}
                    <div className="relative mb-4">
                        <div className="absolute -inset-1 bg-gradient-to-tr from-[var(--ad-primary)] to-[#4af8e3] rounded-full blur-sm opacity-50" />
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/20">
                            <ProfilePicture size={96} />
                        </div>
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--ad-text-primary)' }}>
                        {user?.name || "Admin User"}
                    </h2>
                    <p className="tracking-wider mt-1 text-sm" style={{ color: 'var(--ad-text-secondary)' }}>{user?.email?.replace(/@fp\.com$/, "") || "admin"}</p>
                </div>
            </section>

            {/* ── Settings List ── */}
            <section className="space-y-3">
                {/* Change Profile Photo */}
                <button
                    onClick={() => setPicModalOpen(true)}
                    className="w-full flex items-center justify-between p-4 glass-card-admin rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors group-hover:bg-[var(--ad-accent-bg)]"
                             style={{ backgroundColor: 'var(--ad-icon-bg)', color: 'var(--ad-primary)' }}
                        >
                            <span className="material-symbols-outlined">photo_camera</span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--ad-text-primary)' }}>Change Profile Photo</span>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--ad-text-muted)' }}>chevron_right</span>
                </button>

                {/* App Lock (Biometric) */}
                <AppLockSetting accentColor={isLight ? "#0d9488" : "#3b82f6"} isLight={isLight} />

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between p-4 glass-card-admin rounded-2xl transition-all cursor-pointer group"
                >
                    <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors group-hover:bg-[var(--ad-accent-bg)]"
                             style={{ backgroundColor: 'var(--ad-icon-bg)', color: 'var(--ad-primary)' }}
                        >
                            <span className="material-symbols-outlined">
                                {isLight ? 'light_mode' : 'dark_mode'}
                            </span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--ad-text-primary)' }}>Theme</span>
                    </div>
                    <div className="flex items-center">
                        {/* Toggle switch */}
                        <div
                            className="w-11 h-6 rounded-full relative flex items-center px-1 transition-colors duration-300"
                            style={{
                                backgroundColor: isLight ? 'rgba(13,148,136,0.3)' : 'rgba(115, 117, 128, 0.3)',
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
                    className="w-full flex items-center justify-between p-4 glass-card-admin rounded-2xl transition-all cursor-pointer group"
                >
                    <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors group-hover:bg-[var(--ad-accent-bg)]"
                             style={{ backgroundColor: 'var(--ad-icon-bg)', color: 'var(--ad-primary)' }}
                        >
                            <span className="material-symbols-outlined">notifications</span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--ad-text-primary)' }}>Push Notifications</span>
                    </div>
                    <div className="flex items-center">
                        {/* Toggle switch */}
                        <div
                            className="w-11 h-6 rounded-full relative flex items-center px-1 transition-colors duration-300"
                            style={{
                                backgroundColor: pushEnabled ? (isLight ? 'rgba(13,148,136,0.3)' : 'rgba(59,130,246,0.3)') : 'rgba(115, 117, 128, 0.3)',
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

                {/* Check for updates */}
                <button
                    onClick={handleCheckUpdate}
                    disabled={updateChecking}
                    className="w-full flex items-center justify-between p-4 glass-card-admin rounded-2xl transition-all group cursor-pointer disabled:opacity-50"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors group-hover:bg-[var(--ad-accent-bg)]"
                             style={{ backgroundColor: 'var(--ad-icon-bg)', color: 'var(--ad-primary)' }}
                        >
                            <span className={updateChecking ? "material-symbols-outlined animate-spin" : "material-symbols-outlined"}>
                                {updateChecking ? 'autorenew' : 'system_update'}
                            </span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--ad-text-primary)' }}>
                            {updateChecking ? 'Checking for updates...' : 'Check for Updates'}
                        </span>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--ad-text-muted)' }}>chevron_right</span>
                </button>
            </section>

            {/* ── Footer ── */}
            <footer className="mt-12 flex flex-col items-center gap-6">
                <button
                    onClick={logout}
                    className="group flex items-center gap-3 px-8 py-3 bg-[#a70138]/10 transition-all rounded-full border border-[#ff6e84]/20 active:scale-95 cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[#ff6e84]">logout</span>
                    <span className="font-bold text-[#ff6e84] tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>Logout</span>
                </button>
                <div className="text-center">
                    {/* eslint-disable-next-line no-undef */}
                    <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--ad-text-secondary)' }}>FP Finance v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.2'}</p>
                </div>
            </footer>

            {/* Profile Pic Upload Modal */}
            <ProfilePicUpload isOpen={picModalOpen} onClose={() => setPicModalOpen(false)} />
        </div>
    );
}

export default function AdminProfile() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
                <AdminProfileContent />
            </AdminLayout>
        </ProtectedRoute>
    );
}

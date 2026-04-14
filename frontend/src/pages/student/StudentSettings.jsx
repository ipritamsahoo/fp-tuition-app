import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { api } from "@/lib/api";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import ProfilePicture from "@/components/ProfilePicture";
import ProfilePicUpload from "@/components/ProfilePicUpload";
import MyDevicesModal from "@/components/MyDevicesModal";
import AboutContent from "@/components/AboutContent";
import StudentFeedbackModal from "@/components/StudentFeedbackModal";

function StudentSettingsContent() {
    const navigate = useNavigate();
    const { user, logout, refreshUser } = useAuth();
    const { theme, toggleTheme } = useStudentTheme();
    const isLight = theme === "light";
    const [picModalOpen, setPicModalOpen] = useState(false);
    const [devicesModalOpen, setDevicesModalOpen] = useState(false);
    const [aboutModalOpen, setAboutModalOpen] = useState(false);
    const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

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

    const accentColor = isLight ? '#0d9488' : '#3b82f6';

    return (
        <div className="space-y-8">
            {/* ── Profile Header Card ── */}
            <section className="relative" style={{ transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <div
                    className="backdrop-blur-2xl p-8 rounded-[32px] ring-1 flex flex-col items-center text-center"
                    style={{
                        backgroundColor: isLight ? 'rgba(13,148,136,0.06)' : 'rgba(59,130,246,0.1)',
                        boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.06)' : '0 20px 40px rgba(0,0,0,0.3)',
                        ringColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)',
                        borderWidth: 1, borderStyle: 'solid',
                        borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)',
                        transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden"
                    }}
                >
                    {/* Profile Picture */}
                    <div className="mb-4 flex items-center justify-center">
                        <ProfilePicture size={96} className="border-2 border-white/20" />
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                        {user?.name || "User"}
                    </h2>
                    <p className="tracking-wider mt-1 text-sm" style={{ color: 'var(--st-text-secondary)' }}>{displayUsername}</p>
                    <div className="mt-6 flex gap-2 flex-wrap justify-center">

                        {user?.currentBadge === "prime" && (
                            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1"
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
                            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1"
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
                            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1"
                                style={{
                                    backgroundColor: 'rgba(148,163,184,0.15)',
                                    color: isLight ? '#64748b' : '#cbd5e1',
                                    border: `1px solid rgba(148,163,184,0.25)`,
                                }}
                            >
                                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                                Silver
                            </span>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Settings List ── */}
            <section className="space-y-3" style={{ transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                {/* Change Profile Photo */}
                <button
                    onClick={() => setPicModalOpen(true)}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--st-icon-bg)' }}>
                            <span className="material-symbols-outlined" style={{ color: accentColor }}>photo_camera</span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--st-text-primary)' }}>Change Profile Photo</span>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--st-text-muted)' }}>chevron_right</span>
                </button>

                {/* Change Username or Mobile */}
                <button
                    onClick={() => setUsernameModalOpen(true)}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4 text-left">
                        <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--st-icon-bg)' }}>
                            <span className="material-symbols-outlined" style={{ color: accentColor }}>person</span>
                        </div>
                        <span className="font-medium leading-snug" style={{ color: 'var(--st-text-primary)' }}>Change Username or Mobile</span>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--st-text-muted)' }}>chevron_right</span>
                </button>

                {/* Change Password */}
                <button
                    onClick={() => setPasswordModalOpen(true)}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--st-icon-bg)' }}>
                            <span className="material-symbols-outlined" style={{ color: accentColor }}>lock</span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--st-text-primary)' }}>Change Password</span>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--st-text-muted)' }}>chevron_right</span>
                </button>

                {/* Devices */}
                <button
                    onClick={() => setDevicesModalOpen(true)}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--st-icon-bg)' }}>
                            <span className="material-symbols-outlined" style={{ color: accentColor }}>devices</span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--st-text-primary)' }}>Devices</span>
                    </div>
                    <span className="text-xs px-2 py-1 rounded" style={{ color: 'var(--st-text-secondary)', backgroundColor: 'var(--st-icon-bg)' }}>
                        {activeSessionCount} active
                    </span>
                </button>


                {/* ── Theme Toggle (Functional) ── */}
                <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all cursor-pointer group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--st-icon-bg)' }}>
                            <span className="material-symbols-outlined" style={{ color: accentColor }}>
                                {isLight ? 'light_mode' : 'dark_mode'}
                            </span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--st-text-primary)' }}>Theme</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: 'var(--st-text-secondary)' }}>
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

                {/* Help & Support */}
                <a
                    href="https://wa.me/917001637243"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--st-icon-bg)' }}>
                            <span className="material-symbols-outlined" style={{ color: accentColor }}>support_agent</span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--st-text-primary)' }}>Help & Support</span>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--st-text-muted)' }}>chevron_right</span>
                </a>

                {/* About */}
                <button
                    onClick={() => {
                        if (window.innerWidth >= 768) {
                            // Desktop: open modal
                            setAboutModalOpen(true);
                        } else {
                            // Mobile: route to AboutPage
                            navigate("/about");
                        }
                    }}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: 'var(--st-icon-bg)' }}>
                            <span className="material-symbols-outlined" style={{ color: accentColor }}>info</span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--st-text-primary)' }}>About</span>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--st-text-muted)' }}>chevron_right</span>
                </button>
            </section>

            {/* ── Footer ── */}
            <footer className="mt-4 md:mt-12 flex flex-col items-center gap-6">
                <button
                    onClick={logout}
                    className="group flex items-center gap-3 px-8 py-3 transition-all rounded-full active:scale-95 cursor-pointer"
                    style={{
                        backgroundColor: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(167,1,56,0.2)',
                        border: `1px solid ${isLight ? 'rgba(239,68,68,0.15)' : 'rgba(255,110,132,0.2)'}`,
                    }}
                >
                    <span className="material-symbols-outlined" style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>logout</span>
                    <span className="font-bold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: isLight ? '#ef4444' : '#ff6e84' }}>Logout</span>
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
                                <label className="block text-xs font-bold mb-2 ml-1 uppercase tracking-widest" style={{ color: 'var(--st-text-muted)' }}>New Username or Mobile</label>
                                <input
                                    type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Enter new username or mobile" required
                                    className="w-full px-5 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-all placeholder:text-gray-400"
                                    style={{ 
                                        backgroundColor: 'var(--st-icon-bg)', 
                                        border: `1px solid var(--st-input-border)`, 
                                        color: 'var(--st-text-primary)' 
                                    }}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={closeCredModals}
                                    className="flex-1 px-4 py-4 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95"
                                    style={{ backgroundColor: 'var(--st-icon-bg)', border: `1px solid var(--st-input-border)`, color: 'var(--st-text-secondary)' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={credLoading}
                                    className={`flex-1 px-4 py-4 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 cursor-pointer active:scale-95 border shadow-lg ${
                                        isLight
                                            ? 'bg-[#0d9488]/10 border-[#0d9488]/30 text-[#0d9488] hover:bg-[#0d9488]/20'
                                            : 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/20'
                                    }`}
                                >
                                    {credLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                            Updating...
                                        </span>
                                    ) : "Update"}
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
                        <h3 className="font-extrabold text-2xl mb-1 tracking-tight text-center" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>Change Password</h3>
                        <p className="text-[10px] uppercase tracking-widest font-bold mb-6 text-center" style={{ color: 'var(--st-text-muted)' }}>Security update required</p>
                        
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
                                    className={`flex-1 px-4 py-4 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 cursor-pointer active:scale-95 border shadow-lg ${
                                        isLight
                                            ? 'bg-[#0d9488]/10 border-[#0d9488]/30 text-[#0d9488] hover:bg-[#0d9488]/20'
                                            : 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/20'
                                    }`}
                                >
                                    {credLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                            Updating...
                                        </span>
                                    ) : "Update"}
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

            {/* ── Feedback Modal ── */}
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

            {/* ── About Modal (Desktop only) ── */}
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

                        {/* Shared content */}
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
        </div>
    );
}

export default function StudentSettings() {
    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <StudentLayout>
                <StudentSettingsContent />
            </StudentLayout>
        </ProtectedRoute>
    );
}

import { useState } from "react";
import { createPortal } from "react-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import AboutContent from "@/components/AboutContent";
import { api } from "@/lib/api";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import ProfilePicture from "@/components/ProfilePicture";
import ProfilePicUpload from "@/components/ProfilePicUpload";
import MyDevicesModal from "@/components/MyDevicesModal";

function TeacherSettingsContent() {
    const { user, logout, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [picModalOpen, setPicModalOpen] = useState(false);
    const [devicesModalOpen, setDevicesModalOpen] = useState(false);
    const [aboutModalOpen, setAboutModalOpen] = useState(false);

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

    const accentColor = "#3b82f6";

    return (
        <div data-theme="dark" className="space-y-8" style={{ isolation: "isolate" }}>
            {/* ── Profile Header Card ── */}
            <section className="relative" style={{ transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden" }}>
                <div className="bg-[#3b82f6]/10 backdrop-blur-2xl p-8 rounded-[32px] ring-1 ring-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.3)] flex flex-col items-center text-center" style={{ transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", outline: "1px solid transparent" }}>
                    <div className="mb-4 flex items-center justify-center">
                        <ProfilePicture size={96} className="border-2 border-white/20" />
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        {user?.name || "Teacher"}
                    </h2>
                    <p className="text-[#aaaab7] tracking-wider mt-1 text-sm">{displayUsername}</p>
                    <div className="mt-6 flex gap-2 flex-wrap justify-center">
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
                        <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl group-hover:bg-[#3b82f6]/20 transition-colors">
                            <span className="material-symbols-outlined text-[#3b82f6]">photo_camera</span>
                        </div>
                        <span className="font-medium text-[#f0f0fd]">Change Profile Photo</span>
                    </div>
                    <span className="material-symbols-outlined text-[#737580]">chevron_right</span>
                </button>

                {/* Change Username or Mobile */}
                <button
                    onClick={() => setUsernameModalOpen(true)}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4 text-left">
                        <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl group-hover:bg-[#3b82f6]/20 transition-colors">
                            <span className="material-symbols-outlined text-[#3b82f6]">person</span>
                        </div>
                        <span className="font-medium text-[#f0f0fd] leading-snug">Change Username or Mobile</span>
                    </div>
                    <span className="material-symbols-outlined text-[#737580]">chevron_right</span>
                </button>

                {/* Change Password */}
                <button
                    onClick={() => setPasswordModalOpen(true)}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl group-hover:bg-[#3b82f6]/20 transition-colors">
                            <span className="material-symbols-outlined text-[#3b82f6]">lock</span>
                        </div>
                        <span className="font-medium text-[#f0f0fd]">Change Password</span>
                    </div>
                    <span className="material-symbols-outlined text-[#737580]">chevron_right</span>
                </button>

                {/* Devices */}
                <button
                    onClick={() => setDevicesModalOpen(true)}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl group-hover:bg-[#3b82f6]/20 transition-colors">
                            <span className="material-symbols-outlined text-[#3b82f6]">devices</span>
                        </div>
                        <span className="font-medium text-[#f0f0fd]">Devices</span>
                    </div>
                    <span className="text-xs text-[#aaaab7] bg-white/5 px-2 py-1 rounded">
                        {activeSessionCount} active
                    </span>
                </button>


                {/* Theme */}
                <div className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl">
                            <span className="material-symbols-outlined text-[#3b82f6]">dark_mode</span>
                        </div>
                        <span className="font-medium text-[#f0f0fd]">Theme</span>
                    </div>
                    <span className="text-xs text-[#aaaab7]">Dark mode</span>
                </div>

                {/* Help & Support */}
                <a
                    href="https://wa.me/917001637243"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl group-hover:bg-[#3b82f6]/20 transition-colors">
                            <span className="material-symbols-outlined text-[#3b82f6]">support_agent</span>
                        </div>
                        <span className="font-medium text-[#f0f0fd]">Help & Support</span>
                    </div>
                    <span className="material-symbols-outlined text-[#737580]">chevron_right</span>
                </a>

                {/* About */}
                <button
                    onClick={handleAboutClick}
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
                    className="group flex items-center gap-3 px-8 py-3 bg-[#a70138]/20 hover:bg-[#a70138]/30 transition-all rounded-full ring-1 ring-[#ff6e84]/20 active:scale-95 cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[#ff6e84]">logout</span>
                    <span className="font-bold text-[#ff6e84] tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>Logout</span>
                </button>
            </footer>

            {/* ══ Modals ══ */}

            {/* Profile Pic Upload */}
            <ProfilePicUpload isOpen={picModalOpen} onClose={() => setPicModalOpen(false)} />

            {/* Change Username Modal */}
            {usernameModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeCredModals}>
                    <div
                        className="w-full max-w-sm rounded-[32px] p-8 animate-modal-in shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(64px) saturate(2.2)',
                            WebkitBackdropFilter: 'blur(64px) saturate(2.2)',
                            transform: "translateZ(0)", isolation: "isolate"
                        }}
                    >
                        <h3 className="text-[#f0f0fd] font-bold text-center text-2xl mb-6 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>Change Username</h3>
                        {credError && <div className="mb-3 p-2.5 rounded-2xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff9dac] text-xs">{credError}</div>}
                        {credSuccess && <div className="mb-3 p-2.5 rounded-2xl bg-[#4af8e3]/10 border border-[#4af8e3]/20 text-[#4af8e3] text-xs">{credSuccess}</div>}
                        <form onSubmit={handleUsernameSubmit}>
                            <label className="block text-[#aaaab7] text-xs mb-1.5">New Username or Mobile</label>
                            <input
                                type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="Enter new username or mobile" required
                                className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[#f0f0fd] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 mb-4 placeholder:text-[#737580]"
                            />
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={closeCredModals}
                                    className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95 bg-white/5 border border-white/10 text-[#aaaab7] hover:bg-white/10">
                                    Cancel
                                </button>
                                <button type="submit" disabled={credLoading}
                                    className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer active:scale-95 backdrop-blur-md border bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] shadow-[0_4px_20px_rgba(59,130,246,0.1)] hover:bg-[#3b82f6]/20">
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeCredModals}>
                    <div
                        className="w-full max-w-sm rounded-[32px] p-8 animate-modal-in shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(64px) saturate(2.2)',
                            WebkitBackdropFilter: 'blur(64px) saturate(2.2)',
                            transform: "translateZ(0)", isolation: "isolate"
                        }}
                    >
                        <h3 className="text-[#f0f0fd] text-center font-bold text-2xl mb-1 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>Change Password</h3>
                        <p className="text-[10px] uppercase tracking-widest font-bold mb-6 text-center text-[#aaaab7]">Security update required</p>
                        {credError && <div className="mb-3 p-2.5 rounded-2xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff9dac] text-xs">{credError}</div>}
                        {credSuccess && <div className="mb-3 p-2.5 rounded-2xl bg-[#4af8e3]/10 border border-[#4af8e3]/20 text-[#4af8e3] text-xs">{credSuccess}</div>}
                        <form onSubmit={handlePasswordSubmit}>
                            <label className="block text-[#aaaab7] text-xs mb-1.5">New Password</label>
                            <div className="relative mb-3">
                                <input
                                    type={showNewPassword ? "text" : "password"} 
                                    value={newPassword} 
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min 6 characters" required minLength={6}
                                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[#f0f0fd] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 placeholder:text-[#737580]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#737580] hover:text-[#3b82f6] transition-colors cursor-pointer"
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

                            <label className="block text-[#aaaab7] text-xs mb-1.5">Confirm Password</label>
                            <div className="relative mb-4">
                                <input
                                    type={showConfirmPassword ? "text" : "password"} 
                                    value={confirmPassword} 
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password" required minLength={6}
                                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[#f0f0fd] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 placeholder:text-[#737580]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#737580] hover:text-[#3b82f6] transition-colors cursor-pointer"
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
                                    className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95 bg-white/5 border border-white/10 text-[#aaaab7] hover:bg-white/10">
                                    Cancel
                                </button>
                                <button type="submit" disabled={credLoading}
                                    className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer active:scale-95 backdrop-blur-md border bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6] shadow-[0_4px_20px_rgba(59,130,246,0.1)] hover:bg-[#3b82f6]/20">
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
                    data-theme="dark"
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                    onClick={() => setAboutModalOpen(false)}
                    style={{
                        backgroundColor: "rgba(0,0,0,0.65)",
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                    }}
                >
                    <div
                        className="w-full max-w-sm rounded-[32px] p-8 animate-modal-in shadow-2xl flex flex-col gap-5"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: `1px solid rgba(255, 255, 255, 0.05)`,
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
                                    backgroundColor: 'var(--st-icon-bg)',
                                    border: `1px solid var(--st-input-border)`,
                                    color: 'var(--st-text-muted)' 
                                }}
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        {/* Shared content (Forced to Dark Mode for Teacher) */}
                        <AboutContent isLight={false} accentColor={accentColor} />
                    </div>
                </div>,
                document.body
            )}
        </div>
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

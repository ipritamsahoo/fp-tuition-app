import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { api } from "@/lib/api";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import ProfilePicture from "./ProfilePicture";
import ProfilePicUpload from "./ProfilePicUpload";
import NotificationPanel from "./NotificationPanel";
import MyDevicesModal from "./MyDevicesModal";

export default function TopHeader() {
    const { user, refreshUser } = useAuth();
    const { unreadCount } = useNotifications() || {};
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [picModalOpen, setPicModalOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [devicesModalOpen, setDevicesModalOpen] = useState(false);

    // Credential modals
    const [usernameModalOpen, setUsernameModalOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [credLoading, setCredLoading] = useState(false);
    const [credError, setCredError] = useState("");
    const [credSuccess, setCredSuccess] = useState("");

    const dropdownRef = useRef(null);
    const notifRef = useRef(null);

    const isNonAdmin = user && user.role !== "admin";

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleUsernameSubmit = async (e) => {
        e.preventDefault();
        if (!newUsername.trim()) return;
        setCredLoading(true);
        setCredError("");
        setCredSuccess("");
        try {
            const res = await api.put("/api/auth/update-credentials", { new_username: newUsername.trim() });
            // Re-authenticate with the custom token to keep session alive
            if (res.custom_token) await signInWithCustomToken(auth, res.custom_token);
            // Refresh user state to show updated username instantly
            await refreshUser();
            setCredSuccess("Username updated successfully!");
            setNewUsername("");
            setTimeout(() => closeCredModals(), 2000);
        } catch (err) {
            setCredError(err.message || "Failed to update username.");
        } finally {
            setCredLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!newPassword.trim()) return;
        if (newPassword !== confirmPassword) {
            setCredError("Passwords do not match.");
            return;
        }
        if (newPassword.length < 6) {
            setCredError("Password must be at least 6 characters.");
            return;
        }
        if (!/[a-zA-Z]/.test(newPassword)) {
            setCredError("Password must include at least one letter.");
            return;
        }
        if (!/[0-9]/.test(newPassword)) {
            setCredError("Password must include at least one number.");
            return;
        }
        if (!/[^a-zA-Z0-9]/.test(newPassword)) {
            setCredError("Password must include at least one special character.");
            return;
        }
        setCredLoading(true);
        setCredError("");
        setCredSuccess("");
        try {
            const res = await api.put("/api/auth/update-credentials", { new_password: newPassword });
            // Re-authenticate with the custom token to keep session alive
            if (res.custom_token) await signInWithCustomToken(auth, res.custom_token);
            await refreshUser();
            setCredSuccess("Password updated successfully!");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => closeCredModals(), 2000);
        } catch (err) {
            setCredError(err.message || "Failed to update password.");
        } finally {
            setCredLoading(false);
        }
    };

    const closeCredModals = () => {
        setUsernameModalOpen(false);
        setPasswordModalOpen(false);
        setCredError("");
        setCredSuccess("");
        setNewUsername("");
        setNewPassword("");
        setConfirmPassword("");
    };

    if (!user) return null;

    return (
        <div className="w-full hidden md:flex justify-end items-center px-4 md:px-8 pt-4 md:pt-6 pb-2 mb-2">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
                <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="relative p-2 rounded-full hover:bg-[#1a1f2e]/60 text-[#8a8f98] hover:text-white transition-colors mr-4 flex items-center justify-center cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-[#0a0a12] animate-pulse">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>
                <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>

            {/* Profile Section */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="rounded-full transition-all cursor-pointer hover:opacity-80"
                >
                    <ProfilePicture size={36} />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                    <div className="absolute top-full right-0 mt-3 w-72 bg-[#0f1117]/98 backdrop-blur-xl border border-[#1a1f2e]/60 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in-up">
                        {/* Profile Header */}
                        <div className="p-5 border-b border-[#1a1f2e]/60">
                            <div className="flex flex-col items-center">
                                <div className="relative group mb-3">
                                    <ProfilePicture size={64} className="border-2 border-[#1a1f2e] shadow-[0_0_15px_rgba(56,97,251,0.3)]" />
                                    <button
                                        onClick={() => { setPicModalOpen(true); setDropdownOpen(false); }}
                                        className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                                            <circle cx="12" cy="13" r="3" />
                                        </svg>
                                    </button>
                                </div>
                                <h3 className="text-white font-semibold text-lg">{user.name || "User"}</h3>
                                <p className="text-[#8a8f98] text-xs mt-0.5">{user.email?.replace(/@fp\.com$/, "") || "user"}</p>
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="p-3 space-y-1">
                            <button
                                onClick={() => { setPicModalOpen(true); setDropdownOpen(false); }}
                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                                        <circle cx="12" cy="13" r="3" />
                                    </svg>
                                    <span className="font-medium">Change Profile Photo</span>
                                </div>
                            </button>

                            {/* Change Username — only for non-admin */}
                            {isNonAdmin && (
                                <button
                                    onClick={() => { setUsernameModalOpen(true); setDropdownOpen(false); }}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                        </svg>
                                        <span className="font-medium">Change Username or Mobile</span>
                                    </div>
                                </button>
                            )}

                            {/* Change Password — only for non-admin */}
                            {isNonAdmin && (
                                <button
                                    onClick={() => { setPasswordModalOpen(true); setDropdownOpen(false); }}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                        <span className="font-medium">Change Password</span>
                                    </div>
                                </button>
                            )}

                            {/* Devices — only for non-admin */}
                            {isNonAdmin && (
                                <button
                                    onClick={() => { setDevicesModalOpen(true); setDropdownOpen(false); }}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                                            <line x1="12" y1="18" x2="12.01" y2="18"></line>
                                        </svg>
                                        <span className="font-medium">Devices</span>
                                    </div>
                                </button>
                            )}

                            <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                                    <span className="font-medium">Notifications</span>
                                </div>
                                <span className="text-xs text-[#3861fb] font-semibold bg-[#3861fb]/10 px-2 py-0.5 rounded text-nowrap">ON</span>
                            </button>

                            <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                                    <span className="font-medium">Theme</span>
                                </div>
                                <span className="text-xs text-[#8a8f98]">Dark mode</span>
                            </button>
                        </div>

                        {/* Support footer */}
                        <div className="p-3 border-t border-[#1a1f2e]/60 bg-[#0a0a12]/50">
                            {isNonAdmin && (
                                <a href="https://wa.me/917001637243" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
                                    <span className="font-medium">Help & Support</span>
                                </a>
                            )}
                            <p className="text-center text-[#4a4f5a] text-[10px] mt-2">FP Finance v{__APP_VERSION__}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Profile Pic Upload Modal */}
            <ProfilePicUpload isOpen={picModalOpen} onClose={() => setPicModalOpen(false)} />

            {/* Change Username Modal */}
            {usernameModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeCredModals}>
                    <div className="w-full max-w-sm mx-4 bg-[#0f1117] border border-[#1a1f2e]/60 rounded-2xl shadow-2xl p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-white font-semibold text-lg mb-4">Change Username or Mobile</h3>
                        {credError && <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{credError}</div>}
                        {credSuccess && <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">{credSuccess}</div>}
                        <form onSubmit={handleUsernameSubmit}>
                            <label className="block text-[#8a8f98] text-xs mb-1.5">New Username or Mobile</label>
                            <input
                                type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="Enter new username or mobile"
                                required
                                className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a12]/80 border border-[#1a1f2e]/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3861fb]/50 mb-4"
                            />
                            <div className="flex gap-2">
                                <button type="button" onClick={closeCredModals}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-[#1a1f2e]/50 text-[#8a8f98] text-sm font-medium hover:bg-[#1a1f2e]/80 transition-colors cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={credLoading}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#3861fb] to-[#2b4fcf] text-white text-sm font-medium hover:from-[#4a73ff] hover:to-[#3861fb] transition-all disabled:opacity-50 cursor-pointer">
                                    {credLoading ? "Updating..." : "Update"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {passwordModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeCredModals}>
                    <div className="w-full max-w-sm mx-4 bg-[#0f1117] border border-[#1a1f2e]/60 rounded-2xl shadow-2xl p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-white font-semibold text-lg mb-1">Change Password</h3>
                        <p className="text-[#8a8f98] text-xs mb-4">Must include letters, numbers & special characters.</p>
                        {credError && <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{credError}</div>}
                        {credSuccess && <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">{credSuccess}</div>}
                        <form onSubmit={handlePasswordSubmit}>
                            <label className="block text-[#8a8f98] text-xs mb-1.5">New Password</label>
                            <input
                                type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min 6 characters"
                                required minLength={6}
                                className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a12]/80 border border-[#1a1f2e]/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3861fb]/50 mb-3"
                            />
                            <label className="block text-[#8a8f98] text-xs mb-1.5">Confirm Password</label>
                            <input
                                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter password"
                                required minLength={6}
                                className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a12]/80 border border-[#1a1f2e]/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3861fb]/50 mb-4"
                            />
                            <div className="flex gap-2">
                                <button type="button" onClick={closeCredModals}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-[#1a1f2e]/50 text-[#8a8f98] text-sm font-medium hover:bg-[#1a1f2e]/80 transition-colors cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={credLoading}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#3861fb] to-[#2b4fcf] text-white text-sm font-medium hover:from-[#4a73ff] hover:to-[#3861fb] transition-all disabled:opacity-50 cursor-pointer">
                                    {credLoading ? "Updating..." : "Update"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Devices Modal */}
            {devicesModalOpen && (
                <MyDevicesModal onClose={() => setDevicesModalOpen(false)} />
            )}
        </div>
    );
}

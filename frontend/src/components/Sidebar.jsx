import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { signInWithCustomToken } from "firebase/auth";
import { useNotifications } from "@/context/NotificationContext";
import { api } from "@/lib/api";
import ProfilePicture from "./ProfilePicture";
import ProfilePicUpload from "./ProfilePicUpload";
import MyDevicesModal from "./MyDevicesModal";


const navItems = {
    admin: [
        { label: "Home", href: "/admin", icon: "🏠" },
        { label: "Approvals", href: "/admin/approvals", icon: "✅" },
        { label: "Students", href: "/admin/students", icon: "🎓" },
        { label: "Teachers", href: "/admin/teachers", icon: "👨‍🏫" },
        { label: "Batches", href: "/admin/batches", icon: "📋" },
        { label: "Payments", href: "/admin/payments", icon: "💰" },
        { label: "Distribution", href: "/admin/distribution", icon: "💸" },
        { label: "Reports", href: "/admin/reports", icon: "📊" },
    ],
    teacher: [
        { label: "Home", href: "/teacher", icon: "🏠" },
        { label: "Distribution", href: "/teacher/distribution", icon: "💸" },
    ],
    student: [
        { label: "Home", href: "/student", icon: "🏠" },
    ],
};

export default function Sidebar() {
    const { user, logout, refreshUser } = useAuth();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { unreadCount } = useNotifications() || {};
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [picModalOpen, setPicModalOpen] = useState(false);
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

    const isNonAdmin = user && user.role !== "admin";


    // Initial listener for admin counting pending approvals
    useEffect(() => {
        if (!user || user.role !== "admin") return;

        const q = query(
            collection(db, "payments"),
            where("status", "==", "Pending_Verification")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPendingCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [user]);


    if (!user) return null;

    const items = navItems[user.role] || [];

    return (
        <>

            {/* ═══════════════════════════════════════════
                 DESKTOP: Traditional sidebar (md+)
                 ═══════════════════════════════════════════ */}
            <aside className="hidden md:flex fixed top-0 left-0 h-full z-40
                w-64 bg-[#0f1117]/98 backdrop-blur-xl border-r border-[#1a1f2e]/60 flex-col">
                {/* Logo */}
                <div className="p-6 border-b border-[#1a1f2e]/60">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="FP Finance Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-[#3861fb]/25 object-cover" />
                        <div>
                            <h1 className="text-white font-bold text-lg tracking-tight">FP Finance</h1>
                            <p className="text-[#8a8f98] text-xs">Future Point</p>
                        </div>
                    </div>
                </div>



                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {items.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                    ${isActive
                                        ? "bg-gradient-to-r from-[#3861fb]/20 to-[#2b4fcf]/10 text-white border border-[#3861fb]/30 shadow-[0_0_15px_rgba(56,97,251,0.15)] relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent before:-translate-x-full before:animate-[shimmer_2s_infinite]"
                                        : "text-[#8a8f98] hover:text-white hover:bg-[#1a1f2e]/60 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:-translate-y-0.5"
                                    }`}
                            >
                                <span className="text-lg">{item.icon}</span>
                                {item.label}
                                {item.label === "Approvals" && pendingCount > 0 && (
                                    <span className="ml-auto bg-amber-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                                        {pendingCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}

                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-[#1a1f2e]/60">
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                            text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
                    >
                        🚪 Logout
                    </button>
                </div>
            </aside>

            {/* ═══════════════════════════════════════════
                 MOBILE: Top header bar + Bottom navigation
                 ═══════════════════════════════════════════ */}

            {/* Top bar */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0f1117]/95 backdrop-blur-xl border-b border-[#1a1f2e]/60">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-2.5">
                        <img src="/logo.png" alt="FP Finance Logo" className="w-8 h-8 rounded-lg shadow-lg shadow-[#3861fb]/25 object-cover" />
                        <span className="text-white font-bold text-base tracking-tight">FP Finance</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Main Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => navigate("/notifications")}
                                className="relative p-1.5 rounded-full hover:bg-[#1a1f2e]/60 text-[#8a8f98] hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border border-[#0a0a12] animate-pulse">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                        >
                            <ProfilePicture size={32} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile slide-down menu (for logout + user info) */}
            {sidebarOpen && (
                <>
                    <div className="md:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
                    <div className="md:hidden fixed top-14 left-0 right-0 z-40 bg-[#0f1117]/98 backdrop-blur-xl border-b border-[#1a1f2e]/60 animate-fade-in-up rounded-b-2xl shadow-2xl">

                        {/* Profile Header */}
                        <div className="p-5 border-b border-[#1a1f2e]/60">
                            <div className="flex flex-col items-center">
                                <div className="relative group mb-3">
                                    <ProfilePicture size={64} className="border-2 border-[#1a1f2e] shadow-[0_0_15px_rgba(56,97,251,0.3)]" />
                                    <button
                                        onClick={() => { setPicModalOpen(true); setSidebarOpen(false); }}
                                        className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
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
                                onClick={() => { setPicModalOpen(true); setSidebarOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                                    <circle cx="12" cy="13" r="3" />
                                </svg>
                                <span className="font-medium">Change Profile Photo</span>
                            </button>

                            {/* Change Username — only for non-admin */}
                            {isNonAdmin && (
                                <button
                                    onClick={() => { setUsernameModalOpen(true); setSidebarOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                    </svg>
                                    <span className="font-medium">Change Username or Mobile</span>
                                </button>
                            )}

                            {/* Change Password — only for non-admin */}
                            {isNonAdmin && (
                                <button
                                    onClick={() => { setPasswordModalOpen(true); setSidebarOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    <span className="font-medium">Change Password</span>
                                </button>
                            )}

                            {/* Devices — only for non-admin */}
                            {isNonAdmin && (
                                <button
                                    onClick={() => { setDevicesModalOpen(true); setSidebarOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                                    </svg>
                                    <span className="font-medium">Devices</span>
                                </button>
                            )}

                            <button onClick={() => { navigate("/notifications"); setSidebarOpen(false); }} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                                    <span className="font-medium">Notifications</span>
                                </div>
                                {unreadCount > 0 && <span className="text-xs text-white font-semibold bg-red-500 px-2 py-0.5 rounded text-nowrap">{unreadCount} New</span>}
                            </button>

                            <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                                    <span className="font-medium">Theme</span>
                                </div>
                                <span className="text-xs text-[#8a8f98]">Dark mode</span>
                            </button>

                            {isNonAdmin && (
                                <a href="https://wa.me/917001637243" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#c0c4cc] hover:text-white hover:bg-[#1a1f2e]/50 transition-colors group cursor-pointer">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
                                    <span className="font-medium">Help & Support</span>
                                </a>
                            )}
                        </div>

                        {/* Support footer with Logout */}
                        <div className="p-3 border-t border-[#1a1f2e]/60 bg-[#0a0a12]/50">
                            <button
                                onClick={() => { setSidebarOpen(false); logout(); }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
                            >
                                🚪 Logout
                            </button>
                            <p className="text-center text-[#4a4f5a] text-[10px] mt-2">FP Finance v{__APP_VERSION__}</p>
                        </div>
                    </div>
                </>
            )}

            {/* Bottom navigation bar */}
            <nav className="md:hidden bottom-nav">
                <div className="flex items-stretch justify-around">
                    {items.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={`bottom-nav-item flex-1 ${isActive ? "active" : ""} relative`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <span className="nav-icon mb-0.5">{item.icon}</span>
                                <span className="font-medium" style={{ fontSize: items.length > 4 ? "9px" : "10px" }}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#3861fb]" />
                                )}
                                {/* Mobile Bottom Nav Badge */}
                                {item.label === "Approvals" && pendingCount > 0 && (
                                    <span className="absolute top-1 right-1/4 transform translate-x-1/2 min-w-[16px] h-4 flex items-center justify-center bg-amber-500 text-slate-900 text-[9px] font-bold rounded-full px-1 border border-[#0f1117] shadow-sm animate-bounce">
                                        {pendingCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Profile Pic Upload Modal (for mobile) */}
            <ProfilePicUpload isOpen={picModalOpen} onClose={() => setPicModalOpen(false)} />

            {/* Change Username Modal (mobile) */}
            {usernameModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setUsernameModalOpen(false); setCredError(""); setCredSuccess(""); setNewUsername(""); }}>
                    <div className="w-full max-w-sm mx-4 bg-[#0f1117] border border-[#1a1f2e]/60 rounded-2xl shadow-2xl p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-white font-semibold text-lg mb-4">Change Username or Mobile</h3>
                        {credError && <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{credError}</div>}
                        {credSuccess && <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">{credSuccess}</div>}
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!newUsername.trim()) return;
                            setCredLoading(true); setCredError(""); setCredSuccess("");
                            try {
                                await api.put("/api/auth/update-credentials", { new_username: newUsername.trim() }).then(async (res) => {
                                    if (res.custom_token) await signInWithCustomToken(auth, res.custom_token);
                                });
                                await refreshUser();
                                setCredSuccess("Username updated successfully!");
                                setNewUsername("");
                                setTimeout(() => { setUsernameModalOpen(false); setCredError(""); setCredSuccess(""); }, 2000);
                            } catch (err) { setCredError(err.message || "Failed to update."); }
                            finally { setCredLoading(false); }
                        }}>
                            <label className="block text-[#8a8f98] text-xs mb-1.5">New Username or Mobile</label>
                            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Enter new username or mobile" required
                                className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a12]/80 border border-[#1a1f2e]/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3861fb]/50 mb-4" />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => { setUsernameModalOpen(false); setCredError(""); setCredSuccess(""); setNewUsername(""); }}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-[#1a1f2e]/50 text-[#8a8f98] text-sm font-medium hover:bg-[#1a1f2e]/80 transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" disabled={credLoading}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#3861fb] to-[#2b4fcf] text-white text-sm font-medium hover:from-[#4a73ff] hover:to-[#3861fb] transition-all disabled:opacity-50 cursor-pointer">
                                    {credLoading ? "Updating..." : "Update"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Password Modal (mobile) */}
            {passwordModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setPasswordModalOpen(false); setCredError(""); setCredSuccess(""); setNewPassword(""); setConfirmPassword(""); }}>
                    <div className="w-full max-w-sm mx-4 bg-[#0f1117] border border-[#1a1f2e]/60 rounded-2xl shadow-2xl p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-white font-semibold text-lg mb-1">Change Password</h3>
                        <p className="text-[#8a8f98] text-xs mb-4">Must include letters, numbers & special characters.</p>
                        {credError && <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{credError}</div>}
                        {credSuccess && <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">{credSuccess}</div>}
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (newPassword !== confirmPassword) { setCredError("Passwords do not match."); return; }
                            if (newPassword.length < 6) { setCredError("Password must be at least 6 characters."); return; }
                            if (!/[a-zA-Z]/.test(newPassword)) { setCredError("Must include at least one letter."); return; }
                            if (!/[0-9]/.test(newPassword)) { setCredError("Must include at least one number."); return; }
                            if (!/[^a-zA-Z0-9]/.test(newPassword)) { setCredError("Must include at least one special character."); return; }
                            setCredLoading(true); setCredError(""); setCredSuccess("");
                            try {
                                await api.put("/api/auth/update-credentials", { new_password: newPassword }).then(async (res) => {
                                    if (res.custom_token) await signInWithCustomToken(auth, res.custom_token);
                                });
                                await refreshUser();
                                setCredSuccess("Password updated successfully!");
                                setNewPassword(""); setConfirmPassword("");
                                setTimeout(() => { setPasswordModalOpen(false); setCredError(""); setCredSuccess(""); }, 2000);
                            } catch (err) { setCredError(err.message || "Failed to update."); }
                            finally { setCredLoading(false); }
                        }}>
                            <label className="block text-[#8a8f98] text-xs mb-1.5">New Password</label>
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6}
                                className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a12]/80 border border-[#1a1f2e]/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3861fb]/50 mb-3" />
                            <label className="block text-[#8a8f98] text-xs mb-1.5">Confirm Password</label>
                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" required minLength={6}
                                className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a12]/80 border border-[#1a1f2e]/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3861fb]/50 mb-4" />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => { setPasswordModalOpen(false); setCredError(""); setCredSuccess(""); setNewPassword(""); setConfirmPassword(""); }}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-[#1a1f2e]/50 text-[#8a8f98] text-sm font-medium hover:bg-[#1a1f2e]/80 transition-colors cursor-pointer">Cancel</button>
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
        </>
    );
}

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import ProfilePicture from "@/components/ProfilePicture";
import ProfilePicUpload from "@/components/ProfilePicUpload";
import AppLockSetting from "@/components/AppLockSetting";

function AdminProfileContent() {
    const { user, logout } = useAuth();
    const [picModalOpen, setPicModalOpen] = useState(false);

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
            {/* ── Profile Header Card ── */}
            <section className="relative">
                <div className="bg-[#3b82f6]/10 backdrop-blur-2xl p-8 rounded-[32px] ring-1 ring-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.3)] flex flex-col items-center text-center">
                    {/* Profile Picture with gradient glow */}
                    <div className="relative mb-4">
                        <div className="absolute -inset-1 bg-gradient-to-tr from-[#3b82f6] to-[#4af8e3] rounded-full blur-sm opacity-50" />
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/20">
                            <ProfilePicture size={96} />
                        </div>
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        {user?.name || "Admin User"}
                    </h2>
                    <p className="text-[#aaaab7] tracking-wider mt-1 text-sm">{user?.email?.replace(/@fp\.com$/, "") || "admin"}</p>
                </div>
            </section>

            {/* ── Settings List ── */}
            <section className="space-y-3">
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

                {/* App Lock (Biometric) */}
                <AppLockSetting accentColor="#3b82f6" isLight={false} />

                {/* Check for updates */}
                <button
                    onClick={handleCheckUpdate}
                    disabled={updateChecking}
                    className="w-full flex items-center justify-between p-4 glass-card-student rounded-2xl transition-all group cursor-pointer disabled:opacity-50"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl group-hover:bg-[#3b82f6]/20 transition-colors">
                            <span className={updateChecking ? "material-symbols-outlined animate-spin text-[#3b82f6]" : "material-symbols-outlined text-[#3b82f6]"}>
                                {updateChecking ? 'autorenew' : 'system_update'}
                            </span>
                        </div>
                        <span className="font-medium text-[#f0f0fd]">
                            {updateChecking ? 'Checking for updates...' : 'Check for Updates'}
                        </span>
                    </div>
                    <span className="material-symbols-outlined text-[#737580]">chevron_right</span>
                </button>
            </section>

            {/* ── Footer ── */}
            <footer className="mt-12 flex flex-col items-center gap-6">
                <button
                    onClick={logout}
                    className="group flex items-center gap-3 px-8 py-3 bg-[#a70138]/20 hover:bg-[#a70138]/30 transition-all rounded-full ring-1 ring-[#ff6e84]/20 active:scale-95 cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[#ff6e84]">logout</span>
                    <span className="font-bold text-[#ff6e84] tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>Logout</span>
                </button>
                <div className="text-center">
                    {/* eslint-disable-next-line no-undef */}
                    <p className="text-[10px] text-[#aaaab7] uppercase tracking-[0.2em]">FP Finance v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.2'}</p>
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

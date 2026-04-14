import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import ProfilePicture from "@/components/ProfilePicture";
import ProfilePicUpload from "@/components/ProfilePicUpload";

function AdminProfileContent() {
    const { user, logout } = useAuth();
    const [picModalOpen, setPicModalOpen] = useState(false);

    return (
        <div className="space-y-8 max-w-lg mx-auto pt-4">
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
                    className="w-full flex items-center justify-between p-4 bg-[#11131d]/60 backdrop-blur-md rounded-2xl hover:bg-[#1c1f2b] transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl group-hover:bg-[#3b82f6]/20 transition-colors">
                            <span className="material-symbols-outlined text-[#3b82f6]">photo_camera</span>
                        </div>
                        <span className="font-medium text-[#f0f0fd]">Change Profile Photo</span>
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

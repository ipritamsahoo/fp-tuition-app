import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const friendlyError = (err) => {
        const code = err?.code || "";
        const msg = err?.message || "";
        if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || msg.includes("INVALID_LOGIN_CREDENTIALS"))
            return "Invalid username or password. Please try again.";
        if (code === "auth/too-many-requests")
            return "Too many failed attempts. Please try again later.";
        if (code === "auth/user-disabled")
            return "This account has been disabled. Contact your teacher.";
        if (code === "auth/network-request-failed")
            return "Network error. Please check your internet connection.";
        if (msg.includes("User profile not found"))
            return "Account not found. Please contact your admin.";
        return "Something went wrong. Please try again.";
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await login(username, password);
            setTimeout(() => navigate("/"), 500);
        } catch (err) {
            setError(friendlyError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden px-4 py-6" style={{ paddingBottom: `max(1.5rem, env(safe-area-inset-bottom))` }}>
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a12] via-[#0d1025]/50 to-[#0a0a12]" />
            <div className="absolute top-1/4 -left-20 sm:-left-32 w-64 sm:w-96 h-64 sm:h-96 bg-[#3861fb]/15 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 sm:-right-32 w-64 sm:w-96 h-64 sm:h-96 bg-[#f5c542]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

            {/* Login card */}
            <div className="relative z-10 w-full max-w-md animate-fade-in-up">
                <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl shadow-[#3861fb]/10">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-6 sm:mb-8">
                        <img src="/logo.png" alt="FP Finance Logo" className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl shadow-lg shadow-[#3861fb]/30 mb-3 sm:mb-4 object-cover" />
                        <h1 className="text-2xl font-bold text-white">FP Finance</h1>
                        <p className="text-[#8a8f98] text-sm mt-1">Sign in to your account</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6 p-4 rounded-2xl bg-[#ff6e84]/10 border border-[#ff6e84]/30 text-[#ff9dac] text-[13px] font-medium flex items-center gap-3 animate-fade-in-scale">
                            <span className="material-symbols-outlined text-[20px] text-[#ff6e84]">error</span>
                            <span className="flex-1">{error}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                        <div>
                            <label className="block text-[#c0c4cc] text-sm font-medium mb-1.5">Username or Mobile</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                placeholder="e.g. ramdey or 9876543210"
                                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-[#0f1320]/60 border border-[#1a1f2e]/50 text-white placeholder-[#4a4f5a] focus:outline-none focus:ring-2 focus:ring-[#3861fb]/50 focus:border-[#3861fb]/50 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[#c0c4cc] text-sm font-medium mb-1.5">Password</label>
                            <div className="relative flex items-center">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 pr-12 rounded-xl bg-[#0f1320]/60 border border-[#1a1f2e]/50 text-white placeholder-[#4a4f5a] focus:outline-none focus:ring-2 focus:ring-[#3861fb]/50 focus:border-[#3861fb]/50 transition-all font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 text-[#4a4f5a] hover:text-[#c0c4cc] transition-colors flex items-center justify-center cursor-pointer p-1"
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 sm:py-3 rounded-xl bg-[#3861fb]/20 backdrop-blur-md border border-white/10 text-white font-semibold
                hover:bg-[#3861fb]/30 hover:border-white/20 transition-all duration-300 shadow-[0_8px_32px_rgba(56,97,251,0.2)]
                disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
                            {loading ? (
                                <span className="flex items-center justify-center gap-2 relative z-10">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in...
                                </span>
                            ) : (
                                <span className="relative z-10">Sign In</span>
                            )}
                        </button>
                    </form>


                </div>
            </div>
        </div>
    );
}

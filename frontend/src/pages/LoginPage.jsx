import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import logoSrc from "@/assets/logo.png";
import illustrationSrc from "@/assets/login.png";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const fromWelcome = location.state?.fromWelcome;
    const [isEntering, setIsEntering] = useState(fromWelcome ? true : false);
    const [isBtnHovered, setIsBtnHovered] = useState(false);

    useEffect(() => {
        if (fromWelcome) {
            const timer = setTimeout(() => {
                setIsEntering(false);
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [fromWelcome]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError("");
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const friendlyError = (err) => {
        const code = err?.code || "";
        const msg = err?.message || "";
        if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || msg.includes("INVALID_LOGIN_CREDENTIALS"))
            return "Invalid username/mobile or password. Please try again.";
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
            navigate("/");
        } catch (err) {
            setError(friendlyError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div 
            className="h-[100dvh] bg-[#0c0a21] text-white flex flex-col md:flex-row relative overflow-hidden select-none"
            style={{ 
                paddingBottom: `env(safe-area-inset-bottom)`
            }}
        >
            {/* Left Study Illustration (Desktop) / Top (Mobile) */}
            <div 
                className={`relative w-full h-[44dvh] sm:h-[48dvh] md:h-full md:w-[50vw] lg:w-[60vw] flex-shrink-0 overflow-hidden ${
                    isEntering ? "opacity-0 scale-105 filter blur-lg" : "opacity-100 scale-100 filter blur-0"
                }`}
                style={{
                    transition: "opacity 700ms cubic-bezier(0.16, 1, 0.3, 1), transform 700ms cubic-bezier(0.16, 1, 0.3, 1), filter 700ms cubic-bezier(0.16, 1, 0.3, 1)"
                }}
            >
                <img 
                    src={illustrationSrc} 
                    alt="Study Scene" 
                    className="w-full h-full object-cover object-center"
                />
                {/* Vignette / Edge Shadow Overlay to dim image edges */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0c0a21]/15 via-transparent to-[#0c0a21]/20 pointer-events-none z-10" />
                
                {/* Mobile-only bottom fade gradient (softer & lower height) */}
                <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-[#0c0a21] via-[#0c0a21]/75 to-transparent md:hidden pointer-events-none z-10" />
                
                {/* Desktop-only right fade gradient (wider & smoother) */}
                <div className="hidden md:block absolute inset-y-0 right-0 w-48 bg-gradient-to-r from-transparent via-[#0c0a21]/50 to-[#0c0a21] pointer-events-none z-10" />
                
                {/* Background glows */}
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#7c3aed]/15 rounded-full blur-[80px] pointer-events-none" />
            </div>

            <div 
                className={`w-full max-w-[420px] mx-auto px-7 flex flex-col justify-center flex-1 md:max-w-none md:w-[50vw] lg:w-[40vw] md:px-10 lg:px-12 xl:px-16 py-4 md:py-12 overflow-visible ${
                    isEntering ? "opacity-0 translate-y-6 filter blur-lg" : "opacity-100 translate-y-0 filter blur-0"
                }`}
                style={{
                    transition: "opacity 700ms cubic-bezier(0.16, 1, 0.3, 1), transform 700ms cubic-bezier(0.16, 1, 0.3, 1), filter 700ms cubic-bezier(0.16, 1, 0.3, 1)"
                }}
            >
                <div className="w-full max-w-[400px] mx-auto mt-[-40px] md:mt-0">
                    {/* Header */}
                    <div className="mb-2 md:mb-4">
                        <div className="flex items-center gap-4 mb-3">
                            <div 
                                className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden shadow-lg shadow-[#3861fb]/20 flex-shrink-0 select-none"
                                onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}
                            >
                                <img 
                                    src={logoSrc} 
                                    alt="FP Finance Logo" 
                                    className="w-full h-full object-cover scale-[1.25] pointer-events-none select-none" 
                                    draggable="false"
                                />
                            </div>
                            <h1 
                                className="text-[32px] md:text-[38px] font-bold italic text-white tracking-wide"
                                style={{ fontFamily: "'Poppins', sans-serif" }}
                            >
                                <span style={{ fontFamily: "'Playball', cursive", fontStyle: "normal", fontSize: "1.25em", marginRight: "0.15em" }}>FP</span> Finance
                            </h1>
                        </div>
                        <p className="text-slate-300 text-[17px] font-light">Please Sign in to continue.</p>
                    </div>

                    {/* Error display - reserved space to prevent layout shifts */}
                    <div className="h-6 mb-2 flex items-center px-1 text-[#ff6e84] text-[14px] font-medium">
                        {error && (
                            <div className="flex items-center gap-2 animate-fade-in-scale">
                                <span className="material-symbols-outlined text-[18px]">error</span>
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    {/* Form fields */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username Input Container */}
                        <div className="relative flex items-center w-full h-[60px] bg-[#0a0a15]/80 border border-[#1d1d36] rounded-[22px] px-5 transition-all duration-300 focus-within:border-[#7c3aed]/50 focus-within:shadow-[0_0_15px_rgba(124,58,237,0.15)]">
                            <span className="material-symbols-outlined text-[#8a8f98] mr-3.5 text-[22px] select-none">person</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                placeholder="Username or mobile"
                                className="w-full h-full bg-transparent border-0 outline-none text-white placeholder-[#505466] text-[15px] focus:ring-0 focus:outline-none"
                            />
                        </div>

                        {/* Password Input Container */}
                        <div className="relative flex items-center w-full h-[60px] bg-[#0a0a15]/80 border border-[#1d1d36] rounded-[22px] px-5 transition-all duration-300 focus-within:border-[#7c3aed]/50 focus-within:shadow-[0_0_15px_rgba(124,58,237,0.15)]">
                            <span className="material-symbols-outlined text-[#8a8f98] mr-3.5 text-[22px] select-none">lock</span>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Password"
                                className="w-full h-full bg-transparent border-0 outline-none text-white placeholder-[#505466] text-[15px] focus:ring-0 focus:outline-none font-sans"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="text-[#8a8f98] hover:text-white transition-colors cursor-pointer flex items-center justify-center p-1"
                            >
                                <span className="material-symbols-outlined text-[22px] select-none">
                                    {showPassword ? "visibility" : "visibility_off"}
                                </span>
                            </button>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-1">
                            <button
                                type="submit"
                                disabled={loading}
                                onMouseEnter={() => setIsBtnHovered(true)}
                                onMouseLeave={() => setIsBtnHovered(false)}
                                className="w-full h-[52px] rounded-[22px] border border-white/40 text-white font-semibold text-[18px] shadow-[0_8px_32px_rgba(58,87,246,0.2)] hover:border-white/70 active:scale-[0.98] transition-all relative flex items-center justify-center cursor-pointer disabled:opacity-50"
                                style={{
                                    background: isBtnHovered 
                                        ? 'linear-gradient(90deg, rgba(138, 36, 227, 0.65) 0%, rgba(138, 36, 227, 0.65) 8%, rgba(0, 145, 255, 0.65) 92%, rgba(0, 145, 255, 0.65) 100%)' 
                                        : 'linear-gradient(90deg, rgba(138, 36, 227, 0.5) 0%, rgba(138, 36, 227, 0.5) 8%, rgba(0, 145, 255, 0.5) 92%, rgba(0, 145, 255, 0.5) 100%)'
                                }}
                            >
                                {loading ? (
                                    <span>Signing in...</span>
                                ) : (
                                    <span>Sign In</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

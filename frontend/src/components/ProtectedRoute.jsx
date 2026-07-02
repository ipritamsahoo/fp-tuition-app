import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate("/login");
            } else if (allowedRoles && !allowedRoles.includes(user.role)) {
                navigate(`/${user.role}`);
            }
        }
    }, [user, loading, allowedRoles, navigate]);

    if (loading) {
        const activeTheme = (() => {
            if (typeof window !== "undefined") {
                const role = user?.role;
                if (role === "admin") return localStorage.getItem("fp_admin_theme_v2") || "light";
                if (role === "teacher") return localStorage.getItem("fp_teacher_theme_v2") || "light";
                return localStorage.getItem("fp_admin_theme_v2") || 
                       localStorage.getItem("fp_teacher_theme_v2") || 
                       localStorage.getItem("fp_student_theme_v2") || 
                       "light";
            }
            return "light";
        })();
        const isLight = activeTheme === "light";
        const isAdminOrTeacher = user?.role === "admin" || user?.role === "teacher";

        const spinnerBorderClass = isLight 
            ? (isAdminOrTeacher ? "border-[#0d9488]/20 border-t-[#0d9488]" : "border-indigo-500/20 border-t-indigo-600")
            : "border-indigo-500/30 border-t-indigo-500";

        return (
            <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${isLight ? "bg-[#f8fafc]" : "bg-slate-950"}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className={`w-12 h-12 border-4 rounded-full animate-spin ${spinnerBorderClass}`} />
                    <p className={`text-sm font-medium ${isLight ? "text-slate-500" : "text-slate-400"}`}>Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;
    if (allowedRoles && !allowedRoles.includes(user.role)) return null;

    return children;
}

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
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;
    if (allowedRoles && !allowedRoles.includes(user.role)) return null;

    return children;
}

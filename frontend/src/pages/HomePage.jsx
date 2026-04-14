import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function HomePage() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading) {
            if (user) {
                navigate(`/${user.role}`);
            } else {
                navigate("/welcome");
            }
        }
    }, [user, loading, navigate]);

    return (
        <div className="min-h-screen bg-[#0a0a12]" />
    );
}

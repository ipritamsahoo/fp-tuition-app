import { createContext, useContext, useState, useEffect } from "react";

const AdminThemeContext = createContext({ theme: "dark", toggleTheme: () => {} });

export function AdminThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem("fp_admin_theme_v2") || "dark";
        } catch {
            return "dark";
        }
    });

    useEffect(() => {
        try { 
            localStorage.setItem("fp_admin_theme_v2", theme); 
            window.dispatchEvent(new CustomEvent("fp-admin-theme-change", { detail: theme }));
            document.documentElement.setAttribute("data-theme", theme);
            document.body.setAttribute("data-theme", theme);
        } catch {}
        return () => {
            document.documentElement.removeAttribute("data-theme");
            document.body.removeAttribute("data-theme");
        };
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

    return (
        <AdminThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </AdminThemeContext.Provider>
    );
}

export function useAdminTheme() {
    return useContext(AdminThemeContext);
}

import { createContext, useContext, useState, useEffect } from "react";

const TeacherThemeContext = createContext({ theme: "light", toggleTheme: () => {} });

export function TeacherThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem("fp_teacher_theme_v2") || "light";
        } catch {
            return "light";
        }
    });

    useEffect(() => {
        try { 
            localStorage.setItem("fp_teacher_theme_v2", theme); 
            window.dispatchEvent(new CustomEvent("fp-teacher-theme-change", { detail: theme }));
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
        <TeacherThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </TeacherThemeContext.Provider>
    );
}

export function useTeacherTheme() {
    return useContext(TeacherThemeContext);
}

import { createContext, useContext, useState, useEffect } from "react";

const StudentThemeContext = createContext({ theme: "light", toggleTheme: () => {} });

export function StudentThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem("fp_student_theme_v2") || "light";
        } catch {
            return "light";
        }
    });

    useEffect(() => {
        try { localStorage.setItem("fp_student_theme_v2", theme); } catch {}
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

    return (
        <StudentThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </StudentThemeContext.Provider>
    );
}

export function useStudentTheme() {
    return useContext(StudentThemeContext);
}

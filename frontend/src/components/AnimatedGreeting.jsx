import { useState, useEffect, useMemo } from "react";

export default function AnimatedGreeting({ name, className = "" }) {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return "Good Morning";
        if (hour >= 12 && hour < 15) return "Good Noon";
        if (hour >= 15 && hour < 18) return "Good Afternoon";
        if (hour >= 18 && hour < 21) return "Good Evening";
        return "Good Night";
    };

    const fullText = useMemo(() => `${getGreeting()}, ${name}`, [name]);
    const [displayedText, setDisplayedText] = useState("");
    const [isTyping, setIsTyping] = useState(true);

    useEffect(() => {
        setDisplayedText("");
        setIsTyping(true);
        let i = 0;
        
        // Add a slight delay before typing starts for better effect
        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                setDisplayedText(fullText.substring(0, i + 1));
                i++;
                if (i >= fullText.length) {
                    clearInterval(interval);
                    setIsTyping(false);
                }
            }, 80); // Adjust speed here (80ms per char)
            
            return () => clearInterval(interval);
        }, 300);

        return () => clearTimeout(timeout);
    }, [fullText]);

    return (
        <span className={className}>
            {displayedText}
            {/* Blinking Cursor */}
            {isTyping && (
                <span 
                    className="ml-[2px] w-[3px] h-[0.9em] bg-current inline-block animate-pulse" 
                    style={{ verticalAlign: "baseline" }}
                />
            )}
        </span>
    );
}

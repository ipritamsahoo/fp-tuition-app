import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useStudentTheme } from "@/context/StudentThemeContext";

const MONTH_NAMES = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

export default function LeaderGallerySlider() {
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    const [champions, setChampions] = useState([]);
    const [month, setMonth] = useState(null);
    const [year, setYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [imageErrorMap, setImageErrorMap] = useState({});

    // Swipe / Drag state
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);
    const isDragging = useRef(false);

    // Auto-play timer ref
    const timerRef = useRef(null);

    // Load data from backend
    useEffect(() => {
        let isMounted = true;
        async function fetchGallery() {
            try {
                setLoading(true);
                const data = await api.get("/api/student/leader-gallery?month=1");
                if (isMounted) {
                    setChampions(data?.champions || []);
                    setMonth(data?.month || new Date().getMonth() + 1);
                    setYear(data?.year || new Date().getFullYear());
                }
            } catch (err) {
                console.error("Failed to load leader gallery:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchGallery();
        return () => { isMounted = false; };
    }, []);

    // Handle next & prev slide navigation
    const handleNext = useCallback(() => {
        if (champions.length <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % champions.length);
    }, [champions.length]);

    const handlePrev = useCallback(() => {
        if (champions.length <= 1) return;
        setCurrentIndex((prev) => (prev - 1 + champions.length) % champions.length);
    }, [champions.length]);

    // Auto-advance timer (5 seconds)
    useEffect(() => {
        if (loading || champions.length <= 1 || isPaused) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            handleNext();
        }, 5000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [loading, champions.length, isPaused, handleNext, currentIndex]);

    // Swipe / Drag Event Handlers
    const handleTouchStart = (e) => {
        touchStartX.current = e.touches ? e.touches[0].clientX : e.clientX;
        isDragging.current = true;
        setIsPaused(true);
    };

    const handleTouchMove = (e) => {
        if (!isDragging.current) return;
        touchEndX.current = e.touches ? e.touches[0].clientX : e.clientX;
    };

    const handleTouchEnd = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        setIsPaused(false);

        const distance = touchStartX.current - touchEndX.current;
        const minSwipeDistance = 40; // minimum threshold in px

        if (touchEndX.current !== 0) {
            if (distance > minSwipeDistance) {
                handleNext();
            } else if (distance < -minSwipeDistance) {
                handlePrev();
            }
        }

        touchStartX.current = 0;
        touchEndX.current = 0;
    };

    // Month Label
    const monthLabel = month ? (MONTH_NAMES[month - 1] || "BILLING CYCLE") : "MONTH";

    // ── Skeleton Loader ──
    if (loading) {
        return (
            <div
                className="relative w-full rounded-[28px] p-6 animate-pulse border overflow-hidden min-h-[220px] sm:min-h-[250px] flex flex-col justify-between"
                style={{
                    backgroundColor: isLight ? 'rgba(238, 242, 255, 0.7)' : 'rgba(30, 27, 75, 0.4)',
                    borderColor: isLight ? 'rgba(199, 210, 254, 0.6)' : 'rgba(99, 102, 241, 0.2)'
                }}
            >
                <div className="w-44 h-7 rounded-full bg-indigo-500/20" />
                <div className="space-y-3 max-w-xs mt-4">
                    <div className="w-32 h-5 rounded-md bg-amber-500/25" />
                    <div className="w-48 h-8 rounded-lg bg-indigo-500/20" />
                    <div className="w-36 h-4 rounded-md bg-indigo-500/15" />
                </div>
            </div>
        );
    }

    // ── Empty State ──
    if (!champions || champions.length === 0) {
        return null;
    }

    const currentChamp = champions[currentIndex] || champions[0];
    const hasValidPic = currentChamp?.profile_pic_url && !imageErrorMap[currentChamp.student_id];

    return (
        <section className="relative w-full select-none">
            {/* ── Main Shoutout Banner Container ── */}
            <div
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                className="relative w-full aspect-[16/9] min-h-[230px] max-h-[400px] sm:min-h-[260px] rounded-[28px] overflow-hidden transition-all duration-300 shadow-xl border flex items-center group cursor-grab active:cursor-grabbing"
                style={{
                    background: 'linear-gradient(135deg, #0c0e17 0%, #151928 50%, #07090e 100%)',
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 18px 40px -10px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.3)'
                }}
            >
                {/* ── RIGHT HALF: Large Prominent Champion Photo (50-55% Width) ── */}
                <div className="absolute right-0 top-0 bottom-0 w-[52%] sm:w-[55%] h-full overflow-hidden">
                    {hasValidPic ? (
                        <img
                            key={currentChamp.student_id}
                            src={currentChamp.profile_pic_url}
                            alt={currentChamp.student_name}
                            onError={() => setImageErrorMap(prev => ({ ...prev, [currentChamp.student_id]: true }))}
                            className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                    ) : (
                        /* Premium Shoutout Graphic Fallback */
                        <div className="w-full h-full bg-gradient-to-br from-purple-700 via-indigo-900 to-slate-950 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-400/20 via-transparent to-transparent animate-pulse" />
                            <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-4xl sm:text-6xl font-black text-white shadow-2xl border-4 border-amber-300/40">
                                {currentChamp.student_name ? currentChamp.student_name.charAt(0).toUpperCase() : "🏆"}
                            </div>
                        </div>
                    )}

                    {/* Gradient Fade connecting the Right Photo to Left Content */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'linear-gradient(to right, #0c0e17 0%, rgba(12,14,23,0.85) 20%, transparent 60%)'
                        }}
                    />
                </div>

                {/* ── LEFT HALF: Content Area (50-52% Width - ZERO OVERLAP ON FACE) ── */}
                <div className="relative z-10 w-[52%] sm:w-[50%] h-full p-4 sm:p-7 flex flex-col justify-between pointer-events-none">
                    {/* Top: ⭐ Badge */}
                    <div>
                        <div
                            className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[9px] sm:text-xs font-extrabold uppercase tracking-wider shadow-xs backdrop-blur-md"
                            style={{
                                backgroundColor: 'rgba(251, 191, 36, 0.12)',
                                color: '#fcd34d',
                                border: '1px solid rgba(251, 191, 36, 0.25)'
                            }}
                        >
                            <span className="text-amber-400 text-xs sm:text-sm animate-pulse">⭐</span>
                            <span className="truncate">{monthLabel} {year}</span>
                        </div>
                    </div>

                    {/* Middle / Bottom: Winner Shoutout Info */}
                    <div className="space-y-1 sm:space-y-2 my-auto text-left">
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white text-[9px] sm:text-xs font-black shadow-sm uppercase tracking-wide">
                            <span>🏆</span>
                            <span>BATCH #1 CHAMPION</span>
                        </div>

                        {/* Bold Student Name */}
                        <h2
                            className="text-base sm:text-2xl md:text-3xl font-extrabold tracking-tight truncate leading-tight text-white"
                            style={{
                                fontFamily: "'Manrope', sans-serif"
                            }}
                        >
                            {currentChamp.student_name}
                        </h2>

                        {/* Sub-text Batch Name */}
                        <p
                            className="text-xs sm:text-sm font-semibold flex items-center gap-1.5 truncate text-slate-300"
                        >
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-ping" />
                            <span className="truncate">{currentChamp.batch_name}</span>
                        </p>
                    </div>

                    {/* Pagination Dots */}
                    {champions.length > 1 && (
                        <div className="flex items-center gap-1.5 pointer-events-auto">
                            {champions.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentIndex(idx);
                                    }}
                                    className={`transition-all duration-300 rounded-full cursor-pointer ${
                                        idx === currentIndex
                                            ? "w-5 h-2 bg-gradient-to-r from-amber-500 to-orange-500 shadow-xs"
                                            : "w-2 h-2 bg-slate-400/40 dark:bg-white/30 hover:bg-slate-400 dark:hover:bg-white/60"
                                    }`}
                                    aria-label={`Go to slide ${idx + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Bottom Edge: Auto-Play Progress Bar (5 Seconds) ── */}
                {champions.length > 1 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/10 overflow-hidden pointer-events-none z-20">
                        <div
                            key={`${currentIndex}-${isPaused}`}
                            className="h-full bg-gradient-to-r from-amber-500 via-purple-500 to-indigo-500"
                            style={{
                                width: '100%',
                                animation: isPaused ? 'none' : 'galleryProgress 5000ms linear forwards'
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Keyframe animation */}
            <style>{`
                @keyframes galleryProgress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}</style>
        </section>
    );
}

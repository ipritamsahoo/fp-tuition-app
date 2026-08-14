import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useStudentTheme } from "@/context/StudentThemeContext";
import {
  getCachedProfilePic,
  setCachedProfilePic,
  shouldRefreshProfilePic,
} from "@/lib/profilePicCache";
import "./TopStudentCard.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Auto-marquee text component (scrolls ONLY when text overflows container)
function AutoMarqueeText({ text, className = "", tag: Tag = "span" }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    // Reset overflow state first so animation stops and transform resets for accurate measurement
    setIsOverflowing(false);
    setScrollDistance(0);

    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const cWidth = containerRef.current.clientWidth;
        const sWidth = textRef.current.scrollWidth;
        if (sWidth > cWidth + 2) {
          setIsOverflowing(true);
          setScrollDistance(sWidth - cWidth + 16);
        }
      }
    };

    const timer = setTimeout(checkOverflow, 80);
    window.addEventListener("resize", checkOverflow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [text]);

  return (
    <div ref={containerRef} className="marquee-container">
      <Tag
        ref={textRef}
        className={`marquee-text ${className} ${isOverflowing ? "animate-marquee" : ""}`}
        style={isOverflowing ? { "--marquee-dist": `-${scrollDistance}px` } : {}}
      >
        {text}
      </Tag>
    </div>
  );
}

// Skeleton Loader Component (Responsive Mobile + Desktop)
function TopStudentCardSkeleton({ currentTheme }) {
  return (
    <section className="relative w-full select-none">
      <div className={`top-student-card theme-${currentTheme} animate-pulse relative overflow-hidden`}>
        {/* Top-Right Background Watermark Skeleton */}
        <div className="rank-decoration opacity-20" aria-hidden="true">
          <div className="w-24 sm:w-40 h-24 sm:h-40 rounded-full border-4 border-amber-500/20 border-dashed animate-spin" style={{ animationDuration: '20s' }} />
        </div>

        {/* Top Center Ribbon Skeleton */}
        <div className="rank-ribbon-container">
          <div className="ribbon-front !bg-gradient-to-r !from-amber-500/30 !via-amber-400/40 !to-amber-500/30 border border-amber-500/40 shadow-none">
            <div className="w-24 sm:w-32 h-4 sm:h-5 bg-amber-200/40 rounded-md animate-pulse" />
          </div>
        </div>

        {/* Content Section (Photo + Info Layout) */}
        <div className="student-content">
          {/* Photo Section Skeleton */}
          <div className="student-photo-section">
            <div className="photo-ring-outer !border-amber-500/40 !bg-amber-500/5">
              <div className="photo-ring-inner !bg-amber-500/20">
                <div className="student-photo !bg-amber-500/15 animate-pulse" />
              </div>
              <div className="top-badge !bg-amber-500/30 !border-amber-400/50">
                <div className="top-badge-inner !bg-amber-500/20">
                  <div className="w-4 h-4 rounded-full bg-amber-400/50" />
                </div>
              </div>
            </div>
          </div>

          {/* Student Info Section Skeleton */}
          <div className="student-info">
            {/* Student Name Skeleton */}
            <div className="h-7 sm:h-9 w-44 sm:w-72 bg-amber-500/25 dark:bg-amber-400/20 rounded-lg animate-pulse" />

            {/* Underline Skeleton */}
            <div className="name-line !bg-gradient-to-r !from-amber-500/40 !to-transparent" />

            {/* Batch Item Skeleton */}
            <div className="info-item">
              <div className="info-divider !bg-amber-500/50" />
              <div className="info-content space-y-1.5 flex-1">
                <div className="h-2.5 w-12 bg-amber-500/20 rounded" />
                <div className="h-4 sm:h-5 w-36 sm:w-56 bg-amber-500/30 dark:bg-amber-400/25 rounded-md" />
              </div>
            </div>

            {/* Billing Cycle Item Skeleton */}
            <div className="info-item">
              <div className="info-divider !bg-amber-500/50" />
              <div className="info-content space-y-1.5 flex-1">
                <div className="h-2.5 w-16 bg-amber-500/20 rounded" />
                <div className="h-4 sm:h-5 w-24 sm:w-36 bg-amber-500/30 dark:bg-amber-400/25 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LeaderGallerySlider() {
  const { theme } = useStudentTheme();
  const currentTheme = theme === "dark" ? "dark" : "light";

  // Synchronous session cache initialization (Prevents skeleton loader flickers in same session)
  const [champions, setChampions] = useState(() => {
    try {
      const sessionData = sessionStorage.getItem("fp_leader_gallery_session");
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (parsed && Array.isArray(parsed.champions) && parsed.champions.length > 0) {
          return parsed.champions;
        }
      }
    } catch (e) {
      console.warn("Session storage init error:", e);
    }
    return [];
  });

  const [loading, setLoading] = useState(() => champions.length === 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imageErrorMap, setImageErrorMap] = useState({});
  const [cachedPhotoMap, setCachedPhotoMap] = useState({});

  // Asynchronously load and cache profile photos in localStorage
  useEffect(() => {
    if (!champions || champions.length === 0) return;

    champions.forEach(async (champ) => {
      const studentId = champ.student_id;
      const rawUrl = champ.profile_pic_url;
      const version = champ.pic_version || rawUrl;

      if (!studentId || !rawUrl) return;

      // 1. Check if cache is valid and up to date
      if (!shouldRefreshProfilePic(studentId, version)) {
        const cached = getCachedProfilePic(studentId);
        if (cached && cached.dataUrl) {
          setCachedPhotoMap((prev) => ({ ...prev, [studentId]: cached.dataUrl }));
          return;
        }
      }

      // 2. Otherwise fetch Cloudinary image, convert to base64, and store in localStorage
      let optimizedUrl = rawUrl;
      if (optimizedUrl.includes("res.cloudinary.com") && !optimizedUrl.includes("w_200")) {
        optimizedUrl = optimizedUrl.replace("/upload/", "/upload/c_fill,h_200,w_200,q_auto,f_auto/");
      }

      try {
        await setCachedProfilePic(studentId, optimizedUrl, version);
        const freshlyCached = getCachedProfilePic(studentId);
        if (freshlyCached && freshlyCached.dataUrl) {
          setCachedPhotoMap((prev) => ({ ...prev, [studentId]: freshlyCached.dataUrl }));
        } else {
          setCachedPhotoMap((prev) => ({ ...prev, [studentId]: optimizedUrl }));
        }
      } catch (err) {
        setCachedPhotoMap((prev) => ({ ...prev, [studentId]: optimizedUrl }));
      }
    });
  }, [champions]);

  // Swipe / Drag state
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isDragging = useRef(false);

  // Auto-play timer ref
  const timerRef = useRef(null);

  // Load data from backend with sessionStorage caching for the current app session
  useEffect(() => {
    let isMounted = true;
    async function fetchGallery() {
      // If we already have session champions loaded synchronously, no need to call API!
      if (champions && champions.length > 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await api.get("/api/student/leader-gallery");
        if (isMounted) {
          const champList = data?.champions || [];
          setChampions(champList);
          try {
            sessionStorage.setItem("fp_leader_gallery_session", JSON.stringify({ champions: champList }));
          } catch (e) {
            console.warn("Failed to save leader gallery to sessionStorage:", e);
          }
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

  // Auto-advance timer (4 seconds)
  useEffect(() => {
    if (loading || champions.length <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      handleNext();
    }, 4000);

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
    const minSwipeDistance = 40;

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

  // Skeleton Loader (Matches exact mobile + desktop TopStudentCard layout)
  if (loading) {
    return <TopStudentCardSkeleton currentTheme={currentTheme} />;
  }

  // Empty State
  if (!champions || champions.length === 0) {
    return null;
  }

  const currentChamp = champions[currentIndex] || champions[0];
  const rank = currentChamp?.rank || 1;
  const monthName = currentChamp?.month ? (MONTH_NAMES[currentChamp.month - 1] || "Billing Cycle") : "Billing Cycle";
  const year = currentChamp?.year || new Date().getFullYear();
  const billingCycleLabel = `${monthName} ${year}`;
  const studentName = currentChamp?.student_name || "STUDENT";
  const batchName = currentChamp?.batch_name || "BATCH";
  const currentStudentId = currentChamp?.student_id;
  const cachedUrl = currentStudentId ? cachedPhotoMap[currentStudentId] : null;
  const photoUrl = (cachedUrl && !imageErrorMap[currentStudentId])
    ? cachedUrl
    : (currentChamp?.profile_pic_url && !imageErrorMap[currentStudentId])
      ? currentChamp.profile_pic_url
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=d99a2d&color=fff&size=200`;

  return (
    <section className="relative w-full select-none">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        className={`top-student-card theme-${currentTheme} cursor-grab active:cursor-grabbing group`}
        aria-label="Top student card"
      >
        {/* Top-Right Background Laurel Wreath Image Decoration */}
        <div className="rank-decoration" aria-hidden="true">
          <img src="/laurel-wreath-leaf.png" alt="Laurel Wreath" className="rank-laurel-img" />
        </div>

        {/* 3D Folded Gold Ribbon */}
        <div className="rank-ribbon-container" aria-label="Fastest Payer">
          <div className="ribbon-tail ribbon-tail-left" />
          <div className="ribbon-fold ribbon-fold-left" />
          <div className="ribbon-front">
            <span className="ribbon-star">★</span>
            <strong>FASTEST PAYER</strong>
            <span className="ribbon-star">★</span>
          </div>
          <div className="ribbon-fold ribbon-fold-right" />
          <div className="ribbon-tail ribbon-tail-right" />
        </div>

        {/* Main Content */}
        <div className="student-content">

          {/* STUDENT PHOTO SECTION */}
          <div className="student-photo-section">
            <div className="photo-ring-outer">
              <div className="photo-ring-inner">
                <img
                  src={photoUrl}
                  alt={studentName}
                  className="student-photo pointer-events-none select-none"
                  draggable={false}
                  onDoubleClick={(e) => e.preventDefault()}
                  onError={() => setImageErrorMap(prev => ({ ...prev, [currentChamp.student_id]: true }))}
                />
              </div>
            </div>

            {/* TOP Crown Badge */}
            <div className="top-badge">
              <div className="top-badge-inner">
                <svg width="18" height="14" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 14.5H22V17H2V14.5ZM3.8 12.5L2 4L7.5 8L12 1.5L16.5 8L22 4L20.2 12.5H3.8Z" fill="#df9c20"/>
                </svg>
                <span>TOP</span>
              </div>
            </div>
          </div>

          {/* STUDENT INFORMATION SECTION */}
          <div className="student-info">
            <AutoMarqueeText text={studentName} tag="h1" />

            <div className="name-line" />

            {/* Batch Item */}
            <div className="info-item">
              <div className="info-divider" />

              <div className="info-content">
                <span className="info-label">BATCH</span>
                <AutoMarqueeText text={batchName} tag="strong" />
              </div>
            </div>

            {/* Billing Cycle Item */}
            <div className="info-item">
              <div className="info-divider" />

              <div className="info-content">
                <span className="info-label">BILLING CYCLE</span>
                <strong>{billingCycleLabel}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Slider Navigation Dots */}
        {champions.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 pointer-events-auto">
            {champions.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  idx === currentIndex
                    ? "w-6 h-2 bg-amber-500 shadow-md"
                    : "w-2 h-2 bg-amber-500/40 hover:bg-amber-500/80"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Desktop Hover Arrow Buttons */}
        {champions.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-amber-500/20 hover:bg-amber-500/60 text-amber-500 dark:text-amber-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs border border-amber-500/30 text-lg font-bold cursor-pointer"
              aria-label="Previous Slide"
            >
              ‹
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-amber-500/20 hover:bg-amber-500/60 text-amber-500 dark:text-amber-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs border border-amber-500/30 text-lg font-bold cursor-pointer"
              aria-label="Next Slide"
            >
              ›
            </button>
          </>
        )}

      </div>
    </section>
  );
}

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getCachedFile } from "../lib/mediaDb";

export default function MediaPreviewer({ note, initialIndex, onClose, getFileIcon, formatDateTime, hideUploaderName }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const files = note.files || [];
    const activeFile = files[currentIndex] || files[0];

    const [loading, setLoading] = useState(true);
    const [showSpinner, setShowSpinner] = useState(false);
    const [error, setError] = useState(null);
    const [localUrl, setLocalUrl] = useState(null);
    const [cachedUrls, setCachedUrls] = useState({}); // Keep track of blob URLs for all items to load thumbnails instantly too!

    // Prevent loading flash by delaying spinner visibility by 200ms
    useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => setShowSpinner(true), 200);
            return () => clearTimeout(timer);
        } else {
            setShowSpinner(false);
        }
    }, [loading]);

    // Zoom & Pinch states for images
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
    const [initialDistance, setInitialDistance] = useState(0);
    const [initialScale, setInitialScale] = useState(1);
    const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
    const [lastTap, setLastTap] = useState(0);
    const imageContainerRef = useRef(null);
    const cachedUrlsRef = useRef({});

    // Reset zoom state when navigating to another file
    useEffect(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, [currentIndex]);

    // Track touch & wheel events manually with { passive: false } to prevent default browser zooming/panning
    useEffect(() => {
        const container = imageContainerRef.current;
        if (!container) return;

        const onTouchStart = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                setInitialDistance(dist);
                setInitialScale(scale);
            } else if (e.touches.length === 1) {
                setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                setInitialPosition(position);
            }
        };

        const onTouchMove = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault(); // Stop native browser scaling
                if (initialDistance > 0) {
                    const dist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    const newScale = Math.min(Math.max(initialScale * (dist / initialDistance), 1), 4);
                    setScale(newScale);
                    if (newScale === 1) {
                        setPosition({ x: 0, y: 0 });
                    }
                }
            } else if (e.touches.length === 1 && scale > 1) {
                e.preventDefault(); // Stop native page scrolling/rubber-banding
                const dx = e.touches[0].clientX - touchStart.x;
                const dy = e.touches[0].clientY - touchStart.y;
                setPosition({
                    x: initialPosition.x + dx,
                    y: initialPosition.y + dy
                });
            }
        };

        const onTouchEnd = () => {
            setInitialDistance(0);
        };

        const onWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault(); // Stop native browser window zoom
                const newScale = Math.min(Math.max(scale - e.deltaY * 0.01, 1), 4);

                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX;
                const mouseY = e.clientY;

                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const ix = (mouseX - centerX - position.x) / scale;
                const iy = (mouseY - centerY - position.y) / scale;

                const newX = mouseX - centerX - ix * newScale;
                const newY = mouseY - centerY - iy * newScale;

                setScale(newScale);
                if (newScale === 1) {
                    setPosition({ x: 0, y: 0 });
                } else {
                    setPosition({ x: newX, y: newY });
                }
            }
        };

        container.addEventListener("touchstart", onTouchStart, { passive: false });
        container.addEventListener("touchmove", onTouchMove, { passive: false });
        container.addEventListener("touchend", onTouchEnd);
        container.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            container.removeEventListener("touchstart", onTouchStart);
            container.removeEventListener("touchmove", onTouchMove);
            container.removeEventListener("touchend", onTouchEnd);
            container.removeEventListener("wheel", onWheel);
        };
    }, [scale, position, touchStart, initialDistance, initialScale, initialPosition]);

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (scale > 1) {
            e.preventDefault();
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging && scale > 1) {
            e.preventDefault();
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleDoubleTap = (e) => {
        const now = Date.now();
        if (now - lastTap < 300) {
            if (scale > 1) {
                setScale(1);
                setPosition({ x: 0, y: 0 });
            } else {
                const targetScale = 2.5;
                const container = imageContainerRef.current;
                if (container) {
                    const rect = container.getBoundingClientRect();
                    const mouseX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : rect.left + rect.width / 2);
                    const mouseY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : rect.top + rect.height / 2);

                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;

                    const ix = (mouseX - centerX - position.x) / scale;
                    const iy = (mouseY - centerY - position.y) / scale;

                    const newX = mouseX - centerX - ix * targetScale;
                    const newY = mouseY - centerY - iy * targetScale;

                    setScale(targetScale);
                    setPosition({ x: newX, y: newY });
                } else {
                    setScale(targetScale);
                }
            }
        }
        setLastTap(now);
    };

    // 1. Preload all group files in the background to populate the thumbnail strip immediately
    useEffect(() => {
        if (!files.length) return;
        let active = true;

        const preloadAll = async () => {
            for (const file of files) {
                if (cachedUrls[file.file_id]) continue;
                try {
                    const cached = await getCachedFile(file.file_id);
                    if (cached && cached.blob && active) {
                        let blob = cached.blob;
                        if (isPDF(file.file_name) && blob.type !== "application/pdf") {
                            blob = blob.slice(0, blob.size, "application/pdf");
                        }
                        const url = URL.createObjectURL(blob);
                        setCachedUrls(prev => ({ ...prev, [file.file_id]: url }));
                    }
                } catch (err) {
                    console.error("Failed to preload file:", file.file_id, err);
                }
            }
        };

        preloadAll();

        return () => {
            active = false;
        };
    }, [files]);

    // 2. Manage loading state and URL for the active file
    useEffect(() => {
        if (!activeFile) return;

        let active = true;

        const loadActive = async () => {
            setLoading(true);
            setError(null);

            if (cachedUrls[activeFile.file_id]) {
                setLocalUrl(cachedUrls[activeFile.file_id]);
                setLoading(false);
                return;
            }

            try {
                const cached = await getCachedFile(activeFile.file_id);
                if (cached && cached.blob && active) {
                    let blob = cached.blob;
                    if (isPDF(activeFile.file_name) && blob.type !== "application/pdf") {
                        blob = blob.slice(0, blob.size, "application/pdf");
                    }
                    const url = URL.createObjectURL(blob);
                    setCachedUrls(prev => ({ ...prev, [activeFile.file_id]: url }));
                    setLocalUrl(url);
                    setLoading(false);
                    return;
                }

                if (active) {
                    setError("not_cached");
                    setLoading(false);
                }
            } catch (err) {
                console.error("Error loading active file:", err);
                if (active) {
                    setError("load_error");
                    setLoading(false);
                }
            }
        };

        loadActive();

        return () => {
            active = false;
        };
    }, [activeFile.file_id, cachedUrls[activeFile.file_id]]);


    // Sync cache ref to avoid dependency re-triggering cleanup on every cache update
    useEffect(() => {
        cachedUrlsRef.current = cachedUrls;
    }, [cachedUrls]);

    // Clean up created object URLs ONLY when the previewer is closed (unmounted)
    useEffect(() => {
        return () => {
            Object.values(cachedUrlsRef.current).forEach(url => {
                URL.revokeObjectURL(url);
            });
        };
    }, []);

    const isImage = (filename) => {
        if (!filename) return false;
        const ext = filename.split('.').pop().toLowerCase();
        return ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext);
    };

    const isPDF = (filename) => {
        if (!filename) return false;
        const ext = filename.split('.').pop().toLowerCase();
        return ext === "pdf";
    };

    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };

    const handlePrev = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? files.length - 1 : prev - 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === files.length - 1 ? 0 : prev + 1));
    };

    // Close on Escape / arrow navigation key listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") setCurrentIndex((prev) => (prev === 0 ? files.length - 1 : prev - 1));
            if (e.key === "ArrowRight") setCurrentIndex((prev) => (prev === files.length - 1 ? 0 : prev + 1));
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [files.length, onClose]);

    const handleDownload = (e) => {
        e.preventDefault();
        if (localUrl) {
            // Download directly from IndexedDB offline blob URL
            const link = document.createElement("a");
            link.href = localUrl;
            link.setAttribute("download", activeFile.file_name || "download");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // Fallback: download from backend if not cached locally
            const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
            const token = localStorage.getItem("idToken");
            let downloadUrl = `${baseUrl}/api/notes/${note.id}/download?file_id=${encodeURIComponent(activeFile.file_id)}`;
            if (token) {
                downloadUrl += `&token=${encodeURIComponent(token)}`;
            }
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", activeFile.file_name || "download");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (!activeFile) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-50 bg-[#0b0e11]/98 backdrop-blur-md flex flex-col justify-between text-white select-none">
            {/* Header / Top Bar */}
            <div className="flex items-center justify-between p-4 bg-[#0b0e11] border-b border-white/5 z-20 relative">
                <div className="flex items-center gap-3 min-w-0">
                    {/* Back Button on Top Left */}
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer shrink-0"
                        title="Back"
                    >
                        <span className="material-symbols-outlined text-2xl">arrow_back</span>
                    </button>
                    <div className="flex flex-col min-w-0">
                        <h2 className="text-sm font-bold text-[#f0f0fd] truncate">{activeFile.caption || activeFile.file_name}</h2>
                        <p className="text-[10px] text-[#aaaab7] mt-0.5">
                            {note.uploaded_by_name && !hideUploaderName ? `${note.uploaded_by_name} • ` : ""}
                            {formatDateTime(note.created_at)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownload}
                        className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
                        title="Download File"
                    >
                        <span className="material-symbols-outlined">download</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`flex-1 relative overflow-hidden flex items-center justify-center ${isPDF(activeFile.file_name) && localUrl ? 'p-0' : 'px-12'}`}>
                {/* Left navigation arrow */}
                {files.length > 1 && (
                    <button
                        onClick={handlePrev}
                        className="absolute left-6 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/80 hover:text-white transition-all border border-white/5 cursor-pointer z-10 animate-fade-in"
                        title="Previous File"
                    >
                        <span className="material-symbols-outlined text-2xl">chevron_left</span>
                    </button>
                )}

                {/* Viewport for preview content */}
                <div className={`${isPDF(activeFile.file_name) && localUrl ? 'w-full h-full' : 'max-w-[85vw] max-h-[68vh]'} flex flex-col items-center justify-center`}>
                    {showSpinner ? (
                        <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-white/[0.02] border border-white/5 max-w-sm">
                            <div className="w-10 h-10 border-2 border-[#4af8e3]/20 border-t-[#4af8e3] rounded-full animate-spin" />
                            <div className="text-center">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[#aaaab7]">Loading</h3>
                                <p className="text-[11px] text-[#aaaab7]/60 mt-1">Reading from cache…</p>
                            </div>
                        </div>
                    ) : loading ? null : error === "not_cached" ? (
                        <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center gap-4 max-w-sm">
                            <span className="material-symbols-outlined text-5xl text-[#4af8e3]/60">
                                download_for_offline
                            </span>
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-[#f0f0fd]">Not Saved Yet</h3>
                                <p className="text-xs text-[#aaaab7]/80">
                                    Press the <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/8 border border-white/10 text-[#4af8e3] text-[10px] font-semibold">
                                        <span className="material-symbols-outlined text-[12px]">download_for_offline</span> Save
                                    </span> icon on the note card first, then preview.
                                </p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center gap-4 max-w-sm">
                            <span className="material-symbols-outlined text-5xl text-red-400">
                                error
                            </span>
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-[#f0f0fd]">Download Failed</h3>
                                <p className="text-xs text-[#aaaab7]/80">{error}</p>
                            </div>
                            <button
                                onClick={handleDownload}
                                className="px-4 py-2 mt-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-wider text-[#4af8e3] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                            >
                                <span className="material-symbols-outlined text-sm">download</span>
                                Download File
                            </button>
                        </div>
                    ) : isImage(activeFile.file_name) && localUrl ? (
                        <div
                            ref={imageContainerRef}
                            className={`relative flex items-center justify-center ${scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'}`}
                            onClick={handleDoubleTap}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <img
                                src={localUrl}
                                alt={activeFile.caption || activeFile.file_name}
                                className="max-h-[68vh] max-w-[85vw] object-contain select-none origin-center"
                                style={{
                                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                    transition: scale === 1 && position.x === 0 && position.y === 0 ? 'transform 0.25s ease' : 'none',
                                    touchAction: 'none'
                                }}
                            />
                        </div>
                    ) : isPDF(activeFile.file_name) && localUrl ? (
                        isMobileDevice() ? (
                            <div className="flex items-center justify-center w-full h-full">
                                <button
                                    onClick={() => window.open(localUrl, "_blank")}
                                    className="px-6 py-3.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-lg shadow-[#3b82f6]/20"
                                >
                                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                                    Open in Browser
                                </button>
                            </div>
                        ) : (
                            <embed
                                src={`${localUrl}#toolbar=0&navpanes=0`}
                                type="application/pdf"
                                className="w-full h-full bg-[#323639] border-none"
                            />
                        )
                    ) : (
                        <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center gap-6 max-w-sm w-full mx-4 shadow-2xl backdrop-blur-md">
                            <div className="w-16 h-16 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                                <span className="material-symbols-outlined text-4xl">
                                    {getFileIcon(activeFile.file_name)}
                                </span>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-[#f0f0fd] truncate max-w-[280px]" title={activeFile.caption || activeFile.file_name}>
                                    {activeFile.caption || activeFile.file_name}
                                </h3>
                                <p className="text-xs text-[#aaaab7]">{activeFile.file_name}</p>
                                <p className="text-[11px] text-[#aaaab7]/60">Preview not available for this file type</p>
                            </div>
                            <button
                                onClick={handleDownload}
                                className="w-full py-3 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-[#3b82f6]/20"
                            >
                                <span className="material-symbols-outlined text-sm">download</span>
                                {isMobileDevice() ? "Open in App (Download)" : "Download File"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Right navigation arrow */}
                {files.length > 1 && (
                    <button
                        onClick={handleNext}
                        className="absolute right-6 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/80 hover:text-white transition-all border border-white/5 cursor-pointer z-10 animate-fade-in"
                        title="Next File"
                    >
                        <span className="material-symbols-outlined text-2xl">chevron_right</span>
                    </button>
                )}
            </div>

            {/* Bottom Thumbnail Strip */}
            {files.length > 1 && (
                <div className="bg-[#0b0e11] border-t border-white/5 p-4 flex flex-col items-center gap-2 z-20 relative">
                    <div className="flex items-center gap-2.5 overflow-x-auto max-w-full py-1 custom-scrollbar px-4">
                        {files.map((file, idx) => {
                            const active = idx === currentIndex;
                            const cachedBlobUrl = cachedUrls[file.file_id];
                            return (
                                <div
                                    key={file.file_id || idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`relative w-12 h-12 rounded-lg cursor-pointer overflow-hidden transition-all shrink-0 bg-white/5 border-2 flex items-center justify-center
                                        ${active ? 'border-[#4af8e3] scale-110' : 'border-transparent hover:border-white/20 hover:scale-105 opacity-60 hover:opacity-100'}
                                    `}
                                >
                                    {isImage(file.file_name) && cachedBlobUrl ? (
                                        <img
                                            src={cachedBlobUrl}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <span className="material-symbols-outlined text-lg text-white/70">
                                            {getFileIcon(file.file_name)}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}

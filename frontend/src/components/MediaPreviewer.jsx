import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getCachedFile, saveCachedFile } from "../lib/mediaDb";

export default function MediaPreviewer({ note, initialIndex, onClose, getFileIcon, formatDateTime, hideUploaderName, onFileCached }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const files = note.files || [];
    const activeFile = files[currentIndex] || files[0];

    const [loading, setLoading] = useState(true);
    const [showSpinner, setShowSpinner] = useState(false);
    const [error, setError] = useState(null);
    const [cachedUrls, setCachedUrls] = useState({}); // Keep track of blob URLs for all items

    // Derive URL and loaded status directly to prevent flashing on already-cached images
    const localUrl = cachedUrls[activeFile?.file_id] || null;
    const isLoaded = !!localUrl;

    // Prevent loading flash by delaying spinner visibility by 200ms
    useEffect(() => {
        if (loading && !isLoaded) {
            const timer = setTimeout(() => setShowSpinner(true), 200);
            return () => clearTimeout(timer);
        } else {
            setShowSpinner(false);
        }
    }, [loading, isLoaded]);

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
    const onFileCachedRef = useRef(onFileCached);

    const activeImageRef = useRef(null);
    const scaleRef = useRef(1);
    const positionRef = useRef({ x: 0, y: 0 });
    const initialMidpointRef = useRef({ x: 0, y: 0 });

    // Synchronize React state changes back to refs
    useEffect(() => {
        scaleRef.current = scale;
        positionRef.current = position;
    }, [scale, position]);

    // Swipe gestures states & refs
    const [dragOffset, setDragOffsetState] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const dragOffsetRef = useRef(0);
    const setDragOffset = (val) => {
        dragOffsetRef.current = val;
        setDragOffsetState(val);
    };

    const swipeStartXRef = useRef(0);
    const swipeStartYRef = useRef(0);
    const isSwipeDirectionDecided = useRef(false);
    const isHorizontalSwipe = useRef(false);
    const viewportRef = useRef(null);

    // Handle horizontal swipe gestures on mobile
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const handleTouchStart = (e) => {
            if (scale > 1) return;
            swipeStartXRef.current = e.touches[0].clientX;
            swipeStartYRef.current = e.touches[0].clientY;
            isSwipeDirectionDecided.current = false;
            isHorizontalSwipe.current = false;
            setIsSwiping(true);
        };

        const handleTouchMove = (e) => {
            if (scale > 1) return;
            const startX = swipeStartXRef.current;
            const startY = swipeStartYRef.current;
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = currentX - startX;
            const diffY = currentY - startY;

            if (!isSwipeDirectionDecided.current) {
                if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
                    isSwipeDirectionDecided.current = true;
                    if (Math.abs(diffX) > Math.abs(diffY)) {
                        isHorizontalSwipe.current = true;
                    }
                }
            }

            if (isSwipeDirectionDecided.current && isHorizontalSwipe.current) {
                e.preventDefault(); // Lock vertical scroll
                setDragOffset(diffX);
            }
        };

        const handleTouchEnd = () => {
            if (scale > 1) return;
            setIsSwiping(false);
            const finalDiffX = dragOffsetRef.current;
            setDragOffset(0);

            if (isSwipeDirectionDecided.current && isHorizontalSwipe.current) {
                const threshold = 80;
                if (finalDiffX > threshold) {
                    setCurrentIndex((prev) => (prev === 0 ? files.length - 1 : prev - 1));
                } else if (finalDiffX < -threshold) {
                    setCurrentIndex((prev) => (prev === files.length - 1 ? 0 : prev + 1));
                }
            }
        };

        viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
        viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
        viewport.addEventListener("touchend", handleTouchEnd, { passive: true });

        return () => {
            viewport.removeEventListener("touchstart", handleTouchStart);
            viewport.removeEventListener("touchmove", handleTouchMove);
            viewport.removeEventListener("touchend", handleTouchEnd);
        };
    }, [scale, files.length]);



    // Keep refs up-to-date to avoid stale closures in effects
    useEffect(() => {
        cachedUrlsRef.current = cachedUrls;
    }, [cachedUrls]);

    useEffect(() => {
        onFileCachedRef.current = onFileCached;
    }, [onFileCached]);

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
            const activeImage = activeImageRef.current;
            if (!activeImage) return;

            if (e.touches.length === 2) {
                e.preventDefault(); // Stop default browser zoom
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                setInitialDistance(dist);
                setInitialScale(scaleRef.current);
                initialMidpointRef.current = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2
                };
                setInitialPosition({ ...positionRef.current });
            } else if (e.touches.length === 1) {
                const t1 = e.touches[0];
                setTouchStart({ x: t1.clientX, y: t1.clientY });
                setInitialPosition({ ...positionRef.current });
            }
        };

        const onTouchMove = (e) => {
            const activeImage = activeImageRef.current;
            if (!activeImage) return;

            if (e.touches.length === 2) {
                e.preventDefault(); // Stop native browser scaling
                if (initialDistance > 0) {
                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                    
                    const currentMidpoint = {
                        x: (t1.clientX + t2.clientX) / 2,
                        y: (t1.clientY + t2.clientY) / 2
                    };

                    // Elastic zoom limits (0.7x to 5.5x)
                    const targetScale = initialScale * (dist / initialDistance);
                    const newScale = Math.min(Math.max(targetScale, 0.7), 5.5);

                    // Center-of-pinch scaling calculation with respect to image container center
                    const rect = container.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;

                    const ix = (initialMidpointRef.current.x - centerX - initialPosition.x) / initialScale;
                    const iy = (initialMidpointRef.current.y - centerY - initialPosition.y) / initialScale;

                    const rawX = currentMidpoint.x - centerX - ix * newScale;
                    const rawY = currentMidpoint.y - centerY - iy * newScale;

                    // Calculate limits based on scaled image width/height versus container bounds
                    const containerWidth = container.offsetWidth;
                    const containerHeight = container.offsetHeight;
                    const imgWidth = activeImage.offsetWidth || activeImage.naturalWidth || containerWidth;
                    const imgHeight = activeImage.offsetHeight || activeImage.naturalHeight || containerHeight;

                    const maxPosH = Math.max(0, (imgWidth * newScale - containerWidth) / 2);
                    const maxPosV = Math.max(0, (imgHeight * newScale - containerHeight) / 2);

                    // Apply logarithmic rubber-banding resistance
                    let targetX = rawX;
                    if (Math.abs(targetX) > maxPosH) {
                        const overflow = Math.abs(targetX) - maxPosH;
                        targetX = targetX > 0 ? maxPosH + overflow * 0.35 : -maxPosH - overflow * 0.35;
                    }
                    let targetY = rawY;
                    if (Math.abs(targetY) > maxPosV) {
                        const overflow = Math.abs(targetY) - maxPosV;
                        targetY = targetY > 0 ? maxPosV + overflow * 0.35 : -maxPosV - overflow * 0.35;
                    }

                    const newPosition = { x: targetX, y: targetY };

                    scaleRef.current = newScale;
                    positionRef.current = newPosition;

                    // Direct DOM manipulation for buttery smooth 60fps/120fps rendering
                    activeImage.style.transform = `translate3d(${newPosition.x}px, ${newPosition.y}px, 0) scale(${newScale})`;
                    activeImage.style.transition = 'none';
                }
            } else if (e.touches.length === 1 && scaleRef.current > 1) {
                e.preventDefault();
                const t1 = e.touches[0];
                const dx = t1.clientX - touchStart.x;
                const dy = t1.clientY - touchStart.y;
                const rawX = initialPosition.x + dx;
                const rawY = initialPosition.y + dy;

                const containerWidth = container.offsetWidth;
                const containerHeight = container.offsetHeight;
                const imgWidth = activeImage.offsetWidth || activeImage.naturalWidth || containerWidth;
                const imgHeight = activeImage.offsetHeight || activeImage.naturalHeight || containerHeight;
                const currentScale = scaleRef.current;

                const maxPosH = Math.max(0, (imgWidth * currentScale - containerWidth) / 2);
                const maxPosV = Math.max(0, (imgHeight * currentScale - containerHeight) / 2);

                // Apply logarithmic rubber-banding resistance
                let targetX = rawX;
                if (Math.abs(targetX) > maxPosH) {
                    const overflow = Math.abs(targetX) - maxPosH;
                    targetX = targetX > 0 ? maxPosH + overflow * 0.35 : -maxPosH - overflow * 0.35;
                }
                let targetY = rawY;
                if (Math.abs(targetY) > maxPosV) {
                    const overflow = Math.abs(targetY) - maxPosV;
                    targetY = targetY > 0 ? maxPosV + overflow * 0.35 : -maxPosV - overflow * 0.35;
                }

                const newPosition = { x: targetX, y: targetY };
                positionRef.current = newPosition;

                // Direct DOM translation update
                activeImage.style.transform = `translate3d(${newPosition.x}px, ${newPosition.y}px, 0) scale(${currentScale})`;
                activeImage.style.transition = 'none';
            }
        };

        const onTouchEnd = (e) => {
            setInitialDistance(0);
            const activeImage = activeImageRef.current;
            if (!activeImage) return;

            let finalScale = scaleRef.current;
            let finalPosition = { ...positionRef.current };

            if (finalScale < 1) {
                // Elastic snap back to 1x
                finalScale = 1;
                finalPosition = { x: 0, y: 0 };
            } else if (finalScale > 4) {
                // Limit maximum zoom level to 4x
                finalScale = 4;
            }

            // Snap panned position back to screen boundaries if out of bounds
            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;
            const imgWidth = activeImage.offsetWidth || activeImage.naturalWidth || containerWidth;
            const imgHeight = activeImage.offsetHeight || activeImage.naturalHeight || containerHeight;

            const maxPosH = Math.max(0, (imgWidth * finalScale - containerWidth) / 2);
            const maxPosV = Math.max(0, (imgHeight * finalScale - containerHeight) / 2);

            const clampedX = Math.min(Math.max(finalPosition.x, -maxPosH), maxPosH);
            const clampedY = Math.min(Math.max(finalPosition.y, -maxPosV), maxPosV);
            finalPosition = { x: clampedX, y: clampedY };

            scaleRef.current = finalScale;
            positionRef.current = finalPosition;

            // Commit back to React Virtual DOM
            setScale(finalScale);
            setPosition(finalPosition);

            // Apply snap transform transitions
            activeImage.style.transform = `translate3d(${finalPosition.x}px, ${finalPosition.y}px, 0) scale(${finalScale})`;
            activeImage.style.transition = 'transform 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)';

            // If one finger remains, initialize tracking for panning to prevent jumping
            if (e && e.touches && e.touches.length === 1) {
                const t1 = e.touches[0];
                setTouchStart({ x: t1.clientX, y: t1.clientY });
                setInitialPosition({ x: clampedX, y: clampedY });
            }
        };

        const onWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault(); // Stop native browser window zoom
                const newScale = Math.min(Math.max(scaleRef.current - e.deltaY * 0.01, 1), 4);

                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX;
                const mouseY = e.clientY;

                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const ix = (mouseX - centerX - positionRef.current.x) / scaleRef.current;
                const iy = (mouseY - centerY - positionRef.current.y) / scaleRef.current;

                const newX = mouseX - centerX - ix * newScale;
                const newY = mouseY - centerY - iy * newScale;

                scaleRef.current = newScale;
                positionRef.current = { x: newX, y: newY };

                setScale(newScale);
                setPosition({ x: newX, y: newY });
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
    }, [touchStart, initialDistance, initialScale, initialPosition, currentIndex]);

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
            const rawX = e.clientX - dragStart.x;
            const rawY = e.clientY - dragStart.y;

            const container = imageContainerRef.current;
            const activeImage = activeImageRef.current;
            if (container && activeImage) {
                const containerWidth = container.offsetWidth;
                const containerHeight = container.offsetHeight;
                const imgWidth = activeImage.offsetWidth || activeImage.naturalWidth || containerWidth;
                const imgHeight = activeImage.offsetHeight || activeImage.naturalHeight || containerHeight;
                const currentScale = scaleRef.current;

                const maxPosH = Math.max(0, (imgWidth * currentScale - containerWidth) / 2);
                const maxPosV = Math.max(0, (imgHeight * currentScale - containerHeight) / 2);

                // Apply rubber-banding horizontal limit
                let targetX = rawX;
                if (Math.abs(targetX) > maxPosH) {
                    const overflow = Math.abs(targetX) - maxPosH;
                    targetX = targetX > 0 ? maxPosH + overflow * 0.35 : -maxPosH - overflow * 0.35;
                }

                // Apply rubber-banding vertical limit
                let targetY = rawY;
                if (Math.abs(targetY) > maxPosV) {
                    const overflow = Math.abs(targetY) - maxPosV;
                    targetY = targetY > 0 ? maxPosV + overflow * 0.35 : -maxPosV - overflow * 0.35;
                }

                const newPosition = { x: targetX, y: targetY };
                positionRef.current = newPosition;

                if (activeImageRef.current) {
                    activeImageRef.current.style.transform = `translate3d(${newPosition.x}px, ${newPosition.y}px, 0) scale(${currentScale})`;
                    activeImageRef.current.style.transition = 'none';
                }
            }
        }
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);

            const container = imageContainerRef.current;
            const activeImage = activeImageRef.current;
            if (container && activeImage) {
                const containerWidth = container.offsetWidth;
                const containerHeight = container.offsetHeight;
                const imgWidth = activeImage.offsetWidth || activeImage.naturalWidth || containerWidth;
                const imgHeight = activeImage.offsetHeight || activeImage.naturalHeight || containerHeight;
                const currentScale = scaleRef.current;

                const maxPosH = Math.max(0, (imgWidth * currentScale - containerWidth) / 2);
                const maxPosV = Math.max(0, (imgHeight * currentScale - containerHeight) / 2);

                // Hard snap panned position inside horizontal and vertical boundaries
                const clampedX = Math.min(Math.max(positionRef.current.x, -maxPosH), maxPosH);
                const clampedY = Math.min(Math.max(positionRef.current.y, -maxPosV), maxPosV);
                const finalPosition = { x: clampedX, y: clampedY };

                positionRef.current = finalPosition;
                setPosition(finalPosition);

                if (activeImageRef.current) {
                    activeImageRef.current.style.transform = `translate3d(${finalPosition.x}px, ${finalPosition.y}px, 0) scale(${currentScale})`;
                    activeImageRef.current.style.transition = 'transform 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)';
                }
            }
        }
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

    // 1. Preload all group files in the background sequentially after a short delay (prioritizing network for active file)
    useEffect(() => {
        if (!files.length) return;
        let active = true;

        const preloadAll = async () => {
            const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
            const token = localStorage.getItem("idToken");

            for (const file of files) {
                if (!active) break;
                if (cachedUrlsRef.current[file.file_id]) continue;

                try {
                    const cached = await getCachedFile(file.file_id);
                    if (cached && cached.blob) {
                        if (active) {
                            let blob = cached.blob;
                            if (isPDF(file.file_name) && blob.type !== "application/pdf") {
                                blob = blob.slice(0, blob.size, "application/pdf");
                            }
                            const url = URL.createObjectURL(blob);
                            setCachedUrls(prev => ({ ...prev, [file.file_id]: url }));
                        }
                    } else {
                        // Cache miss: prefetch from network in background
                        let url = `${baseUrl}/api/notes/${note.id}/files/${file.file_id}/view`;
                        if (token) url += `?token=${encodeURIComponent(token)}`;

                        const response = await fetch(url);
                        if (response.ok && active) {
                            const arrayBuffer = await response.arrayBuffer();
                            let mimeType = response.headers.get("content-type") || "application/octet-stream";
                            const ext = (file.file_name || "").split(".").pop().toLowerCase();
                            if (ext === "pdf") mimeType = "application/pdf";

                            const blob = new Blob([arrayBuffer], { type: mimeType });
                            await saveCachedFile(file.file_id, blob, mimeType, file.file_name);
                            
                            if (active) {
                                onFileCachedRef.current?.();
                                const objectUrl = URL.createObjectURL(blob);
                                setCachedUrls(prev => ({ ...prev, [file.file_id]: objectUrl }));
                            }
                        }
                    }
                } catch (err) {
                    console.error("Failed to preload file:", file.file_id, err);
                }
            }
        };

        const timer = setTimeout(() => {
            preloadAll();
        }, 800);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [files, note.id]);

    // 2. Manage loading state and URL for the active file
    useEffect(() => {
        if (!activeFile) return;

        let active = true;

        const loadActive = async () => {
            if (cachedUrlsRef.current[activeFile.file_id]) {
                setLoading(false);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Try reading from local IndexedDB first
                const cached = await getCachedFile(activeFile.file_id);
                if (cached && cached.blob && active) {
                    let blob = cached.blob;
                    if (isPDF(activeFile.file_name) && blob.type !== "application/pdf") {
                        blob = blob.slice(0, blob.size, "application/pdf");
                    }
                    const url = URL.createObjectURL(blob);
                    setCachedUrls(prev => ({ ...prev, [activeFile.file_id]: url }));
                    setLoading(false);
                    return;
                }

                // If not cached, fetch directly from network API and save to IndexedDB
                if (active) {
                    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
                    const token = localStorage.getItem("idToken");
                    let url = `${baseUrl}/api/notes/${note.id}/files/${activeFile.file_id}/view`;
                    if (token) url += `?token=${encodeURIComponent(token)}`;

                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const arrayBuffer = await response.arrayBuffer();
                    let mimeType = response.headers.get("content-type") || "application/octet-stream";
                    const ext = (activeFile.file_name || "").split(".").pop().toLowerCase();
                    if (ext === "pdf") mimeType = "application/pdf";

                    const blob = new Blob([arrayBuffer], { type: mimeType });
                    
                    // Save in IndexedDB offline cache in background
                    saveCachedFile(activeFile.file_id, blob, mimeType, activeFile.file_name)
                        .then(() => {
                            onFileCachedRef.current?.();
                        })
                        .catch(err => console.error("Failed to save cached file in background:", err));

                    if (active) {
                        const url = URL.createObjectURL(blob);
                        setCachedUrls(prev => ({ ...prev, [activeFile.file_id]: url }));
                        setLoading(false);
                    }
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
    }, [activeFile.file_id, note.id]);

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
        <div className="fixed inset-0 z-[9999] bg-[#0b0e11]/98 backdrop-blur-md flex flex-col justify-between text-white select-none">
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

            {/* Main Content Area (Slider Viewport) */}
            <div 
                ref={viewportRef}
                className="flex-1 relative overflow-hidden flex items-center justify-center"
            >
                {/* Left navigation arrow */}
                {files.length > 1 && (
                    <button
                        onClick={handlePrev}
                        className="absolute left-6 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 hidden md:flex items-center justify-center text-white/80 hover:text-white transition-all border border-white/5 cursor-pointer z-30 animate-fade-in"
                        title="Previous File"
                    >
                        <span className="material-symbols-outlined text-2xl">chevron_left</span>
                    </button>
                )}

                {/* Sliding Flex Container */}
                <div 
                    className="flex w-full h-full z-10"
                    style={{ 
                        transform: `translate3d(calc(-${currentIndex * 100}% + ${dragOffset}px), 0, 0)`,
                        transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.1, 0.9, 0.2, 1)',
                        willChange: 'transform'
                    }}
                >
                    {files.map((file, idx) => {
                        const isCurrent = idx === currentIndex;
                        const isImg = isImage(file.file_name);
                        const isPdf = isPDF(file.file_name);
                        const url = cachedUrls[file.file_id];
                        const isLoaded = !!url;

                        return (
                            <div
                                key={file.file_id || idx}
                                className={`w-full h-full flex-shrink-0 flex items-center justify-center relative select-none ${isPdf && isLoaded ? 'p-0' : 'px-4 md:px-12'}`}
                                style={{ width: "100%" }}
                            >
                                {isCurrent && showSpinner ? (
                                    <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-white/[0.02] border border-white/5 max-w-sm">
                                        <div className="w-10 h-10 border-2 border-[#4af8e3]/20 border-t-[#4af8e3] rounded-full animate-spin" />
                                        <div className="text-center">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#aaaab7]">Loading</h3>
                                            <p className="text-[11px] text-[#aaaab7]/60 mt-1">Reading file…</p>
                                        </div>
                                    </div>
                                ) : isCurrent && loading && !isLoaded ? (
                                    null
                                ) : isCurrent && error ? (
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
                                ) : !isLoaded ? (
                                    <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-white/[0.02] border border-white/5 max-w-sm">
                                        <div className="w-10 h-10 border-2 border-[#4af8e3]/20 border-t-[#4af8e3] rounded-full animate-spin" />
                                        <div className="text-center">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#aaaab7]">Loading</h3>
                                            <p className="text-[11px] text-[#aaaab7]/60 mt-1">Fetching file…</p>
                                        </div>
                                    </div>
                                ) : isImg ? (
                                    <div
                                        ref={isCurrent ? imageContainerRef : null}
                                        className={`relative flex items-center justify-center ${isCurrent && scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'}`}
                                        onClick={isCurrent ? handleDoubleTap : null}
                                        onMouseDown={isCurrent ? handleMouseDown : null}
                                        onMouseMove={isCurrent ? handleMouseMove : null}
                                        onMouseUp={isCurrent ? handleMouseUp : null}
                                        onMouseLeave={isCurrent ? handleMouseUp : null}
                                    >
                                        <img
                                            ref={isCurrent ? activeImageRef : null}
                                            src={url}
                                            alt={file.caption || file.file_name}
                                            className="max-h-[68vh] max-w-[85vw] object-contain select-none origin-center"
                                            style={{
                                                transform: isCurrent ? `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})` : 'scale(1)',
                                                transition: isCurrent && scale === 1 && position.x === 0 && position.y === 0 ? 'transform 0.25s ease' : 'none',
                                                touchAction: 'none',
                                                willChange: 'transform'
                                            }}
                                        />
                                    </div>
                                ) : isPdf ? (
                                    isMobileDevice() ? (
                                        <div className="flex items-center justify-center w-full h-full">
                                            <button
                                                onClick={() => window.open(url, "_blank")}
                                                className="px-6 py-3.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-lg shadow-[#3b82f6]/20"
                                            >
                                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                Open in Browser
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center p-0">
                                            <embed
                                                src={`${url}#toolbar=0&navpanes=0`}
                                                type="application/pdf"
                                                className="w-full h-full bg-[#323639] border-none"
                                            />
                                        </div>
                                    )
                                ) : (
                                    <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center gap-6 max-w-sm w-full mx-4 shadow-2xl backdrop-blur-md">
                                        <div className="w-16 h-16 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                                            <span className="material-symbols-outlined text-4xl">
                                                {getFileIcon(file.file_name)}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-base font-bold text-[#f0f0fd] truncate max-w-[280px]" title={file.caption || file.file_name}>
                                                {file.caption || file.file_name}
                                            </h3>
                                            <p className="text-xs text-[#aaaab7]">{file.file_name}</p>
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
                        );
                    })}
                </div>

                {/* Right navigation arrow */}
                {files.length > 1 && (
                    <button
                        onClick={handleNext}
                        className="absolute right-6 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 hidden md:flex items-center justify-center text-white/80 hover:text-white transition-all border border-white/5 cursor-pointer z-30 animate-fade-in"
                        title="Next File"
                    >
                        <span className="material-symbols-outlined text-2xl">chevron_right</span>
                    </button>
                )}
            </div>

            {/* Bottom Thumbnail Strip */}
            {files.length > 1 && (
                <div className="hidden md:flex bg-[#0b0e11] border-t border-white/5 p-4 flex-col items-center gap-2 z-20 relative">
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

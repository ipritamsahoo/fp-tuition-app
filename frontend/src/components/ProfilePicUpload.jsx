import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import ProfilePicture from "./ProfilePicture";

/**
 * Profile picture upload modal with 1:1 circular crop & preview.
 * Steps: "select" → "crop" → "preview"
 */
export default function ProfilePicUpload({ isOpen, onClose, mandatory = false }) {
    const { user, updateProfilePic } = useAuth();
    const studentThemeContext = useStudentTheme();

    // For teachers and admins, we force dark theme. For students, we follow their context/preference.
    const isStaff = user?.role === "teacher" || user?.role === "admin";
    const theme = isStaff ? "dark" : (studentThemeContext?.theme || "dark");
    const isLight = theme === "light";

    // ── Step state ──
    const [step, setStep] = useState("select"); // "select" | "crop" | "preview"
    const [rawImage, setRawImage] = useState(null); // original dataURL
    const [croppedBlob, setCroppedBlob] = useState(null);
    const [croppedPreview, setCroppedPreview] = useState(null);

    // ── Upload state ──
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const fileRef = useRef(null);

    // ── Crop state ──
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const containerRef = useRef(null);

    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startOff: { x: 0, y: 0 } });
    const pinchRef = useRef({ active: false, startDist: 0, startZoom: 1 });

    // Reset all state
    const resetAll = useCallback(() => {
        setStep("select");
        setRawImage(null);
        setCroppedBlob(null);
        setCroppedPreview(null);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setError("");
        setStatus("");
        setUploading(false);
    }, []);

    if (!isOpen) return null;

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setError("Please select an image file");
            return;
        }
        setError("");
        const reader = new FileReader();
        reader.onload = (ev) => {
            setRawImage(ev.target.result);
            setZoom(1);
            setOffset({ x: 0, y: 0 });
            setStep("crop");
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const drawCropCanvas = () => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;

        const ctx = canvas.getContext("2d");
        const size = canvas.width;
        const circleR = size / 2 - 16;

        ctx.clearRect(0, 0, size, size);

        const imgAspect = img.naturalWidth / img.naturalHeight;
        let drawW, drawH;
        if (imgAspect > 1) {
            drawH = size * zoom;
            drawW = drawH * imgAspect;
        } else {
            drawW = size * zoom;
            drawH = drawW / imgAspect;
        }

        const dx = (size - drawW) / 2 + offset.x;
        const dy = (size - drawH) / 2 + offset.y;

        ctx.drawImage(img, dx, dy, drawW, drawH);

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.beginPath();
        ctx.rect(0, 0, size, size);
        ctx.arc(size / 2, size / 2, circleR, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, circleR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    };

    const handlePointerDown = (e) => {
        if (e.touches && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchRef.current = { active: true, startDist: Math.hypot(dx, dy), startZoom: zoom };
            return;
        }
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragRef.current = { dragging: true, startX: clientX, startY: clientY, startOff: { ...offset } };
    };

    const handlePointerMove = (e) => {
        if (e.touches && e.touches.length === 2 && pinchRef.current.active) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const scale = dist / pinchRef.current.startDist;
            setZoom(Math.max(0.5, Math.min(5, pinchRef.current.startZoom * scale)));
            return;
        }
        if (!dragRef.current.dragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setOffset({
            x: dragRef.current.startOff.x + (clientX - dragRef.current.startX),
            y: dragRef.current.startOff.y + (clientY - dragRef.current.startY),
        });
    };

    const handlePointerUp = () => {
        dragRef.current.dragging = false;
        pinchRef.current.active = false;
    };

    const handleCrop = () => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;

        const size = canvas.width;
        const circleR = size / 2 - 16;
        const outSize = 512;
        const outCanvas = document.createElement("canvas");
        outCanvas.width = outSize;
        outCanvas.height = outSize;
        const outCtx = outCanvas.getContext("2d");

        const imgAspect = img.naturalWidth / img.naturalHeight;
        let drawW, drawH;
        if (imgAspect > 1) {
            drawH = size * zoom;
            drawW = drawH * imgAspect;
        } else {
            drawW = size * zoom;
            drawH = drawW / imgAspect;
        }

        const dx = (size - drawW) / 2 + offset.x;
        const dy = (size - drawH) / 2 + offset.y;
        const cropX = size / 2 - circleR;
        const cropY = size / 2 - circleR;
        const cropSize = circleR * 2;
        const scaleRatio = outSize / cropSize;

        outCtx.drawImage(
            img,
            0, 0, img.naturalWidth, img.naturalHeight,
            (dx - cropX) * scaleRatio,
            (dy - cropY) * scaleRatio,
            drawW * scaleRatio,
            drawH * scaleRatio
        );

        outCanvas.toBlob(
            (blob) => {
                if (!blob) {
                    setError("Crop failed");
                    return;
                }
                setCroppedBlob(blob);
                setCroppedPreview(URL.createObjectURL(blob));
                setStep("preview");
            },
            "image/jpeg",
            0.92
        );
    };

    const handleUpload = async () => {
        if (!croppedBlob) return;
        setUploading(true);
        setError("");
        try {
            setStatus("compressing");
            const compressed = await compressImage(
                new File([croppedBlob], "profile.jpg", { type: "image/jpeg" }),
                150, 512
            );
            setStatus("uploading");
            const formData = new FormData();
            formData.append("file", compressed, "profile.jpg");
            const data = await api.upload("/api/auth/profile-pic", formData);
            await updateProfilePic(data.profile_pic_url, data.pic_version);
            setStatus("");
            resetAll();
            onClose();
        } catch (err) {
            setError(err.message || "Upload failed");
            setStatus("");
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async () => {
        setUploading(true);
        setError("");
        setStatus("removing");
        try {
            await api.delete("/api/auth/profile-pic");
            await updateProfilePic(null, null);
            resetAll();
            onClose();
        } catch (err) {
            setError(err.message || "Failed to remove");
        } finally {
            setStatus("");
            setUploading(false);
        }
    };

    const handleClose = () => {
        if (uploading) return;
        resetAll();
        onClose();
    };

    return createPortal(
        <div 
            data-theme={theme}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4" 
            onClick={mandatory ? undefined : handleClose}
            style={{ 
                backgroundColor: isLight ? 'rgba(238,242,255,0.4)' : 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
            }}
        >
            <div
                className="relative w-full max-w-sm rounded-[2.5rem] overflow-hidden animate-modal-in shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{ 
                    backgroundColor: isLight ? 'rgba(255,255,255,0.25)' : 'rgba(12,14,23,0.85)',
                    border: `1px solid ${isLight ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    backdropFilter: 'blur(40px) saturate(2.0)',
                    WebkitBackdropFilter: 'blur(40px) saturate(2.0)',
                    transform: "translateZ(0)", 
                    isolation: "isolate" 
                }}
            >
                {step === "select" && (
                    <div className="p-8 space-y-6">
                        <h3 className="font-extrabold text-2xl text-center tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                            Profile Picture
                        </h3>

                        <div className="flex flex-col items-center">
                            <div className="relative group">
                                <div className="absolute -inset-2 bg-gradient-to-tr from-[#3b82f6] to-[#4af8e3] rounded-full blur-md opacity-30" />
                                <div className="relative w-28 h-28 rounded-full overflow-hidden border-2" style={{ borderColor: 'var(--st-card-border)' }}>
                                    <ProfilePicture size={112} showBadge={false} />
                                </div>
                                <button
                                    onClick={() => fileRef.current?.click()}
                                    className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-[2px]"
                                >
                                    <span className="material-symbols-outlined text-white text-[32px]">photo_camera</span>
                                </button>
                            </div>
                        </div>

                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

                        {error && <p className="text-xs text-center font-bold" style={{ color: 'var(--st-error)' }}>{error}</p>}

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => fileRef.current?.click()}
                                className="w-full py-3.5 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] text-sm font-bold hover:bg-[#3b82f6]/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                                Choose Photo
                            </button>

                            {!mandatory && (
                                <button
                                    onClick={handleClose}
                                    className="w-full py-2.5 text-sm font-bold transition-colors cursor-pointer"
                                    style={{ color: 'var(--st-text-secondary)' }}
                                >
                                    Cancel
                                </button>
                            )}

                            {mandatory && (
                                <p className="text-center text-xs pt-1" style={{ color: 'var(--st-text-muted)' }}>
                                    A profile photo is required to continue.
                                </p>
                            )}
                        </div>

                        {status && (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm font-bold capitalize" style={{ color: 'var(--st-text-muted)' }}>{status}...</span>
                            </div>
                        )}
                    </div>
                )}

                {step === "crop" && (
                    <CropStep
                        rawImage={rawImage}
                        canvasRef={canvasRef}
                        imgRef={imgRef}
                        containerRef={containerRef}
                        zoom={zoom}
                        setZoom={setZoom}
                        offset={offset}
                        drawCropCanvas={drawCropCanvas}
                        handlePointerDown={handlePointerDown}
                        handlePointerMove={handlePointerMove}
                        handlePointerUp={handlePointerUp}
                        handleCrop={handleCrop}
                        onBack={() => { setStep("select"); setRawImage(null); }}
                    />
                )}

                {step === "preview" && (
                    <div className="p-8 space-y-6">
                        <h3 className="font-extrabold text-2xl text-center tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                            Preview
                        </h3>

                        <div className="flex flex-col items-center">
                            <div className="relative">
                                <div className="absolute -inset-2 bg-gradient-to-tr from-[#3b82f6] to-[#4af8e3] rounded-full blur-md opacity-30" />
                                <img
                                    src={croppedPreview}
                                    alt="Cropped preview"
                                    className="relative w-36 h-36 rounded-full object-cover shadow-2xl"
                                    style={{ border: `2px solid var(--st-card-border)` }}
                                />
                            </div>
                            <p className="text-xs mt-4 font-bold text-center" style={{ color: 'var(--st-text-muted)' }}>This is how your photo will look</p>
                        </div>

                        {error && <p className="text-xs text-center font-bold" style={{ color: 'var(--st-error)' }}>{error}</p>}

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setCroppedBlob(null); setCroppedPreview(null); setStep("crop"); }}
                                disabled={uploading}
                                className="flex-1 py-3.5 rounded-2xl transition-all disabled:opacity-50 cursor-pointer active:scale-95 text-sm font-bold"
                                style={{ backgroundColor: 'var(--st-icon-bg)', border: `1px solid var(--st-input-border)`, color: 'var(--st-text-secondary)' }}
                            >
                                Re-crop
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="flex-1 py-3.5 rounded-2xl bg-[#3b82f6]/20 border border-[#3b82f6]/40 text-[#3b82f6] text-sm font-bold hover:bg-[#3b82f6]/30 transition-all disabled:opacity-50 cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                                {uploading ? "..." : "Upload"}
                            </button>
                        </div>

                        {!mandatory && (
                            <button
                                onClick={handleClose}
                                disabled={uploading}
                                className="w-full py-2 text-sm font-bold transition-colors cursor-pointer"
                                style={{ color: 'var(--st-text-secondary)' }}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

function CropStep({
    rawImage, canvasRef, imgRef, containerRef,
    zoom, setZoom, offset,
    drawCropCanvas,
    handlePointerDown, handlePointerMove, handlePointerUp,
    handleCrop, onBack,
}) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const { theme: ctxTheme } = useStudentTheme();
    const { user } = useAuth();
    
    const isStaff = user?.role === "teacher" || user?.role === "admin";
    const theme = isStaff ? "dark" : (ctxTheme || "dark");

    useEffect(() => {
        if (imgLoaded) drawCropCanvas();
    }, [zoom, offset, imgLoaded, drawCropCanvas]);

    useEffect(() => {
        const resize = () => {
            const container = containerRef.current;
            const canvas = canvasRef.current;
            if (!container || !canvas) return;
            const w = container.clientWidth;
            canvas.width = w;
            canvas.height = w;
            if (imgLoaded) drawCropCanvas();
        };
        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, [imgLoaded, drawCropCanvas, containerRef, canvasRef]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-90 shadow-sm"
                    style={{ backgroundColor: 'var(--st-icon-bg)', color: 'var(--st-text-secondary)', border: '1px solid var(--st-input-border)' }}
                >
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <h3 className="font-extrabold text-xl tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                    Crop Photo
                </h3>
                <div className="w-10" />
            </div>

            <p className="text-xs text-center font-bold" style={{ color: 'var(--st-text-muted)' }}>Drag to reposition • Pinch to zoom</p>

            <img ref={imgRef} src={rawImage} alt="" className="hidden" onLoad={() => setImgLoaded(true)} />

            <div
                ref={containerRef}
                className="relative w-full aspect-square rounded-[2rem] overflow-hidden bg-black/10 cursor-grab active:cursor-grabbing touch-none select-none border"
                style={{ borderColor: 'var(--st-input-border)' }}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
            >
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>

            <div className="flex items-center gap-4 px-2">
                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--st-text-muted)' }}>zoom_out</span>
                <input
                    type="range"
                    min="0.5"
                    max="5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                    style={{ backgroundColor: 'var(--st-progress-bg)' }}
                />
                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--st-text-muted)' }}>zoom_in</span>
            </div>

            <button
                onClick={handleCrop}
                className="w-full py-4 rounded-2xl bg-[#3b82f6]/20 border border-[#3b82f6]/40 text-[#3b82f6] text-sm font-bold hover:bg-[#3b82f6]/30 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
                <span className="material-symbols-outlined text-[20px]">crop</span>
                Crop & Preview
            </button>
        </div>
    );
}

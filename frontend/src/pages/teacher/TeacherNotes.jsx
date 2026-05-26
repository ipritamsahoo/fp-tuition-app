import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import ModernSelect from "@/components/ModernSelect";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TeacherDashboardSkeleton } from "@/components/Skeletons";
import MediaPreviewer from "@/components/MediaPreviewer";
import { checkCachedFiles, saveCachedFile, getCachedFile } from "@/lib/mediaDb";

function GlassCard({ children, className = "", style = {}, ...props }) {
    return (
        <div
            className={`rounded-[28px] border border-white/[0.07] ${className}`}
            style={{
                background: "rgba(28, 31, 43, 0.6)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                ...style,
            }}
            {...props}
        >
            {children}
        </div>
    );
}

function TeacherNotesSkeleton() {
    // Generate varying widths to make the loading look like real dynamic content
    const items = [
        { title: "w-[40%]", meta: "w-[55%]" },
        { title: "w-[50%]", meta: "w-[45%]" },
        { title: "w-[30%]", meta: "w-[60%]" },
        { title: "w-[45%]", meta: "w-[50%]" },
    ];

    return (
        <div className="space-y-3 animate-pulse">
            {items.map((style, i) => (
                <div 
                    key={i}
                    className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Icon placeholder */}
                        <div className="w-10 h-10 rounded-xl bg-white/5 shrink-0" />
                        
                        {/* Text placeholder with measured heights */}
                        <div className="flex-1 space-y-2">
                            {/* h-[14px] matches text-sm font size */}
                            <div className={`h-[14px] bg-white/5 rounded-md ${style.title}`} />
                            {/* h-[10px] matches text-[10px] font size */}
                            <div className={`h-[10px] bg-white/5 rounded-md ${style.meta}`} />
                        </div>
                    </div>

                    {/* Actions placeholder with exact button dimensions */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* View Button placeholder */}
                        <div className="w-9 h-9 rounded-xl bg-white/5" />
                        {/* Delete Button placeholder - tinted red to match actual theme */}
                        <div className="w-9 h-9 rounded-xl bg-[#ff6e84]/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function TeacherNotesPageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Title Header Skeleton */}
            <div className="flex flex-col gap-4">
                <div className="h-8 bg-white/5 rounded-lg w-[200px]" />
            </div>

            {/* Main Layout Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left side: Upload Form Skeleton */}
                <div className="lg:col-span-5">
                    <GlassCard className="p-6 space-y-5 border border-white/[0.03] min-h-[400px]">
                        <div className="h-6 bg-white/5 rounded-md w-1/3" />
                        
                        <div className="space-y-4">
                            {/* Note Title Input Placeholder */}
                            <div className="space-y-2">
                                <div className="h-3.5 bg-white/5 rounded-md w-1/4" />
                                <div className="h-[46px] bg-white/[0.02] border border-white/5 rounded-2xl w-full" />
                            </div>

                            {/* File Upload Placeholder */}
                            <div className="space-y-2">
                                <div className="h-3.5 bg-white/5 rounded-md w-[40%]" />
                                <div className="h-[120px] bg-white/[0.01] border border-dashed border-white/10 rounded-2xl w-full" />
                            </div>

                            {/* Submit Button Placeholder */}
                            <div className="h-12 bg-white/5 rounded-2xl w-full mt-6" />
                        </div>
                    </GlassCard>
                </div>

                {/* Right side: Shared Notes List Skeleton */}
                <div className="lg:col-span-7">
                    <GlassCard className="p-6 min-h-[400px] flex flex-col border border-white/[0.03] space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="h-6 bg-white/5 rounded-md w-1/3" />
                        </div>
                        
                        {/* Nested list skeleton */}
                        <TeacherNotesSkeleton />
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}
function TeacherNoteCard({ note, deletingId, user, handleDeleteNote, getFileIcon, formatDateTime, onPreview, onSaveToCache, savingFiles }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [cachedFileIds, setCachedFileIds] = useState(new Set());

    const noteFiles = note.files || [];

    const currentFile = noteFiles[activeIndex] || noteFiles[0];
    const isPreviewable = (filename) => {
        if (!filename) return false;
        const ext = filename.split('.').pop().toLowerCase();
        return ["jpg", "jpeg", "png", "webp", "gif", "bmp", "pdf"].includes(ext);
    };
    const currentCached = cachedFileIds.has(currentFile.file_id);
    const isSaving = noteFiles.some(f => savingFiles?.[f.file_id]);

    useEffect(() => {
        const ids = noteFiles.map(f => f.file_id).filter(Boolean);
        checkCachedFiles(ids).then(setCachedFileIds);
    }, [note.id, savingFiles]); // Trigger check when savingFiles status changes

    const handlePrev = (e) => {
        e.stopPropagation();
        setActiveIndex((prev) => (prev === 0 ? noteFiles.length - 1 : prev - 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        setActiveIndex((prev) => (prev === noteFiles.length - 1 ? 0 : prev + 1));
    };

    const handleSave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSaveToCache(note, () => {
            const ids = noteFiles.map(f => f.file_id).filter(Boolean);
            setCachedFileIds(prev => new Set([...prev, ...ids]));
        });
    };

    const hasPreview = currentCached && isPreviewable(currentFile.file_name);

    const handleCardClick = async (e) => {
        // Ignore container clicks if clicking interactive buttons (carousel arrows, save/delete icon)
        if (e.target.closest('button') || e.target.closest('a')) return;

        if (!currentCached) {
            if (!isSaving) {
                onSaveToCache(note, () => {
                    const ids = noteFiles.map(f => f.file_id).filter(Boolean);
                    setCachedFileIds(prev => new Set([...prev, ...ids]));
                });
            }
            return;
        }

        if (hasPreview) {
            onPreview(note, activeIndex);
        } else {
            // Local download from IndexedDB cache
            try {
                const cached = await getCachedFile(currentFile.file_id);
                if (cached && cached.blob) {
                    const url = URL.createObjectURL(cached.blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.setAttribute("download", currentFile.file_name || "download");
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            } catch (err) {
                console.error("Local download failed:", err);
            }
        }
    };

    return (
        <div 
            onClick={handleCardClick}
            className={`p-4 rounded-2xl bg-white/[0.02] border border-white/5 transition-all flex flex-col justify-between gap-3 group cursor-pointer hover:border-white/20 hover:bg-white/[0.04] ${isSaving ? 'opacity-80 pointer-events-none' : ''}`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* File Type Icon */}
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/50 shrink-0">
                        <span className="material-symbols-outlined text-xl">
                            {getFileIcon(currentFile.file_name)}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        {/* File Caption / Name */}
                        <h3 className="text-sm font-bold text-[#f0f0fd] truncate" title={currentFile.caption || currentFile.file_name}>
                            {currentFile.caption || currentFile.file_name}
                        </h3>

                        {/* Original File Name if caption is used */}
                        {currentFile.caption && currentFile.caption !== currentFile.file_name && (
                            <p className="text-[10px] text-[#aaaab7]/80 mt-0.5 truncate" title={currentFile.file_name}>
                                {currentFile.file_name}
                            </p>
                        )}
                    </div>
                </div>

                {/* Carousel controls in top right */}
                {noteFiles.length > 1 && (
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                        <span className="text-[10px] text-[#aaaab7]/70 font-semibold mr-1">
                            {activeIndex + 1} of {noteFiles.length}
                        </span>
                        <button onClick={handlePrev} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-[#aaaab7] flex items-center justify-center transition-all cursor-pointer border border-white/5 active:scale-95" title="Previous File">
                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                        </button>
                        <button onClick={handleNext} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-[#aaaab7] flex items-center justify-center transition-all cursor-pointer border border-white/5 active:scale-95" title="Next File">
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Footer info & Action buttons */}
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div className="text-[10px] text-[#aaaab7] leading-tight min-w-0 flex-1 pr-2">
                    <p className="text-[10px] text-[#aaaab7]/80">{formatDateTime(note.created_at)}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {!currentCached && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-9 h-9 rounded-xl bg-white/5 text-[#aaaab7] hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Save Offline"
                        >
                            {isSaving ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined text-lg">download</span>
                            )}
                        </button>
                    )}

                    {/* Delete Note */}
                    {note.uploaded_by === user.uid && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNote(note.id);
                            }}
                            disabled={deletingId === note.id}
                            className="w-9 h-9 rounded-xl bg-[#ff6e84]/10 text-[#ff6e84] hover:bg-[#ff6e84]/20 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 border border-white/5"
                            title="Delete Note Group"
                        >
                            {deletingId === note.id ? (
                                <div className="w-4 h-4 border-2 border-[#ff6e84]/30 border-t-[#ff6e84] rounded-full animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined text-lg">delete</span>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}


function TeacherNotesContent() {
    const { user } = useAuth();
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState("");
    const [notes, setNotes] = useState([]);
    const [batchesLoading, setBatchesLoading] = useState(true);
    const [notesLoading, setNotesLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [deletingId, setDeletingId] = useState(null);
    const [previewData, setPreviewData] = useState(null); // { note, index }
    const [savingFiles, setSavingFiles] = useState({}); // { file_id: true/false }

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    // Form inputs
    const [selectedFiles, setSelectedFiles] = useState([]); // [{ id, file, caption }]

    // Alerts
    const [uploadError, setUploadError] = useState("");
    const [uploadSuccess, setUploadSuccess] = useState("");
    const [listError, setListError] = useState("");

    const fetchBatches = useCallback(async () => {
        try {
            const data = await api.get("/api/teacher/batches");
            setBatches(data);
        } catch (err) {
            // silent
        } finally {
            setBatchesLoading(false);
        }
    }, []);

    // Downloads all files of the note to IndexedDB for preview
    const handleSaveToCache = async (note, onDone) => {
        const files = note.files || [];
        if (!files.length) return;

        const fileIds = files.map(f => f.file_id);
        setSavingFiles(prev => {
            const next = { ...prev };
            fileIds.forEach(id => { next[id] = true; });
            return next;
        });

        try {
            const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
            const token = localStorage.getItem("idToken");

            await Promise.all(files.map(async (file) => {
                try {
                    let url = `${baseUrl}/api/notes/${note.id}/files/${file.file_id}/view`;
                    if (token) url += `?token=${encodeURIComponent(token)}`;

                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const arrayBuffer = await response.arrayBuffer();
                    let mimeType = response.headers.get("content-type") || "application/octet-stream";
                    const ext = (file.file_name || "").split(".").pop().toLowerCase();
                    if (ext === "pdf") mimeType = "application/pdf";

                    const blob = new Blob([arrayBuffer], { type: mimeType });
                    await saveCachedFile(file.file_id, blob, mimeType, file.file_name);
                } catch (err) {
                    console.error(`Failed to cache file ${file.file_name}:`, err);
                }
            }));
            onDone?.();
        } catch (err) {
            console.error("Save to cache failed:", err);
        } finally {
            setSavingFiles(prev => {
                const next = { ...prev };
                fileIds.forEach(id => { next[id] = false; });
                return next;
            });
        }
    };

    const fetchNotes = useCallback(async (batchId, page = 1) => {
        if (!batchId) return;
        setNotesLoading(true);
        setListError("");
        try {
            const response = await api.get(`/api/notes/batch/${batchId}?page=${page}&limit=4&uploaded_by=${user?.uid}`);
            setNotes(response.notes || []);
            setTotalPages(response.total_pages || 1);
            setCurrentPage(response.current_page || 1);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setListError(err.message || "Failed to fetch notes");
            }
        } finally {
            setNotesLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        if (user?.uid) {
            fetchBatches();
        }
    }, [user?.uid, fetchBatches]);

    useEffect(() => {
        if (selectedBatch) {
            fetchNotes(selectedBatch, 1);
        }
    }, [selectedBatch, fetchNotes]);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            setUploadError("");
            setUploadSuccess("");

            // Enforce restriction: multiple files are ONLY allowed if ALL of them are images.
            const totalFiles = [...selectedFiles.map(f => f.file), ...files];
            if (totalFiles.length > 1) {
                const allImages = totalFiles.every(file => file.type.startsWith("image/"));
                if (!allImages) {
                    setUploadError("You can only select multiple files if they are ALL images. Other documents (PDFs, etc.) must be sent one at a time.");
                    e.target.value = ""; // reset input
                    return;
                }
            }

            const newFiles = files.map((file) => {
                return {
                    id: Math.random().toString(36).substring(2, 9),
                    file: file,
                    caption: ""
                };
            });
            setSelectedFiles((prev) => [...prev, ...newFiles]);
        }
    };

    const handleDiscardFile = (id) => {
        setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const handleFileCaptionChange = (id, newCaption) => {
        setSelectedFiles((prev) =>
            prev.map((f) => (f.id === id ? { ...f, caption: newCaption } : f))
        );
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!selectedBatch || selectedFiles.length === 0) {
            setUploadError("Please select a batch and add at least one file.");
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setUploadError("");
        setUploadSuccess("");

        const formData = new FormData();
        formData.append("batch_id", selectedBatch);
        
        selectedFiles.forEach((fileItem) => {
            formData.append("files", fileItem.file);
            formData.append("file_captions", fileItem.caption);
        });

        let currentProgress = 0;
        let targetProgress = 0;
        setUploadProgress(0);

        const progressInterval = setInterval(() => {
            if (currentProgress < targetProgress) {
                const diff = targetProgress - currentProgress;
                const increment = Math.max(1, Math.min(3, Math.ceil(diff * 0.08)));
                currentProgress += increment;
                setUploadProgress(currentProgress);
            }
        }, 30);

        try {
            await api.upload("/api/notes/upload", formData, (progress) => {
                targetProgress = Math.round(progress * 0.95);
            });
            
            while (currentProgress < 92) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            clearInterval(progressInterval);
            setUploadProgress(100);
            await new Promise(resolve => setTimeout(resolve, 500));

            setUploadSuccess("Notes uploaded successfully!");
            const fileInput = document.getElementById("note-file-input");
            if (fileInput) {
                fileInput.value = "";
            }
            setSelectedFiles([]);
            fetchNotes(selectedBatch, 1);
        } catch (err) {
            clearInterval(progressInterval);
            if (!isSystemicError(err.message)) {
                setUploadError(err.message || "Failed to upload notes");
            }
        } finally {
            clearInterval(progressInterval);
            setUploading(false);
        }
    };
    const handleDeleteNote = async (noteId) => {
        if (!window.confirm("Are you sure you want to delete this note?")) return;

        setDeletingId(noteId);
        setListError("");

        try {
            await api.delete(`/api/notes/${noteId}`);
            fetchNotes(selectedBatch, currentPage);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setListError(err.message || "Failed to delete note");
            }
        } finally {
            setDeletingId(null);
        }
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return "";
        try {
            const date = new Date(dateStr);
            return date.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
            });
        } catch (e) {
            return "";
        }
    };

    const getFileIcon = (filename) => {
        if (!filename) return "insert_drive_file";
        const ext = filename.split('.').pop().toLowerCase();
        if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"].includes(ext)) return "image";
        if (ext === "pdf") return "picture_as_pdf";
        if (["doc", "docx"].includes(ext)) return "description";
        if (["xls", "xlsx", "csv"].includes(ext)) return "table_chart";
        if (["ppt", "pptx"].includes(ext)) return "slideshow";
        if (["txt", "md"].includes(ext)) return "article";
        if (["zip", "rar", "7z"].includes(ext)) return "folder_zip";
        if (["mp3", "wav", "m4a", "ogg", "aac", "flac"].includes(ext)) return "audiotrack";
        if (["mp4", "mkv", "avi", "mov", "webm", "flv", "3gp"].includes(ext)) return "video_file";
        return "insert_drive_file";
    };

    if (batchesLoading) {
        return <TeacherNotesPageSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Title Header */}
            <div className="flex flex-col gap-4">
                <div>
                    <h1
                        className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#f0f0fd]"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                        Share Study Notes
                    </h1>
                </div>

                {/* Batch Selector at the top */}
                <div className="flex items-center gap-3 shrink-0">
                    <ModernSelect
                        icon="school"
                        value={selectedBatch}
                        placeholder="Select Batch"
                        options={batches}
                        onChange={(e) => {
                            setSelectedBatch(e.target.value);
                            setUploadError("");
                            setUploadSuccess("");
                            setListError("");
                        }}
                        className="min-w-[180px]"
                    />
                </div>
            </div>

            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left side: Upload Form */}
                <div className="lg:col-span-5">
                    <GlassCard className="p-6 space-y-5">
                        <h2 className="text-lg font-bold text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>Upload New Note</h2>

                        <form onSubmit={handleUploadSubmit} className="space-y-4">

                            {/* File Upload Field */}
                            <div>
                                <label className="block text-[11px] font-bold tracking-widest uppercase mb-2 text-[#aaaab7]">
                                    Choose Files
                                </label>
                                {selectedFiles.length === 0 ? (
                                    <div className="relative group rounded-2xl border border-dashed border-white/15 hover:border-[#3b82f6]/40 p-4 transition-all bg-white/[0.01] hover:bg-[#3b82f6]/5 flex flex-col items-center justify-center cursor-pointer min-h-[120px]">
                                        <input
                                            id="note-file-input"
                                            type="file"
                                            accept="*"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            multiple
                                        />
                                        <span className="material-symbols-outlined text-3xl text-[#aaaab7] group-hover:text-[#3b82f6] transition-colors mb-2">
                                            cloud_upload
                                        </span>
                                        <span className="text-xs font-semibold text-[#f0f0fd] text-center">
                                            Select or drag files here
                                        </span>
                                        <span className="text-[10px] text-[#aaaab7] mt-1">PDF, Word, Excel, Image &amp; more</span>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-white/20 p-4 bg-white/[0.01] space-y-4">
                                        <div className="max-h-[260px] overflow-y-auto pr-1 custom-scrollbar space-y-3">
                                            {selectedFiles.length > 1 ? (
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#aaaab7] mb-1">Queue ({selectedFiles.length} images)</p>
                                            ) : (
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#aaaab7] mb-1">Selected File</p>
                                            )}
                                            {selectedFiles.map((fileItem) => (
                                                <div key={fileItem.id} className="rounded-xl border border-white/10 p-3 bg-white/[0.02] flex flex-col gap-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <span className="material-symbols-outlined text-lg text-white/50 shrink-0">
                                                                {getFileIcon(fileItem.file.name)}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold text-[#f0f0fd] truncate pr-2 max-w-[180px]" title={fileItem.file.name}>
                                                                    {fileItem.file.name}
                                                                </p>
                                                                <p className="text-[9px] text-[#aaaab7]">
                                                                    {(fileItem.file.size / (1024 * 1024)).toFixed(2)} MB
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDiscardFile(fileItem.id)}
                                                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-[#aaaab7] hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 border border-white/5"
                                                            title="Remove"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">close</span>
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={fileItem.caption}
                                                        onChange={(e) => handleFileCaptionChange(fileItem.id, e.target.value)}
                                                        className="w-full px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 focus:border-[#3b82f6]/30 focus:ring-1 focus:ring-[#3b82f6]/30 text-[#f0f0fd] text-xs focus:outline-none transition-all placeholder:text-[#464752]"
                                                        placeholder="File caption (optional)"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add more files button inside the dashed container */}
                                        {selectedFiles.every(f => f.file.type.startsWith("image/")) && (
                                            <div className="relative group rounded-xl border border-dashed border-white/10 hover:border-[#3b82f6]/30 py-2.5 transition-all bg-white/[0.01] hover:bg-[#3b82f6]/5 flex items-center justify-center cursor-pointer">
                                                <input
                                                    id="note-file-input-more"
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    multiple
                                                />
                                                <span className="material-symbols-outlined text-sm text-[#aaaab7] group-hover:text-[#3b82f6] transition-colors mr-1.5">
                                                    add
                                                </span>
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#aaaab7] group-hover:text-white transition-colors">
                                                    Add more images
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Status messages */}
                            {uploadError && (
                                <div className="p-3 text-xs rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84]">
                                    {uploadError}
                                </div>
                            )}

                            {uploadSuccess && (
                                <div className="p-3 text-xs rounded-xl bg-[#4af8e3]/10 border border-[#4af8e3]/20 text-[#4af8e3]">
                                    {uploadSuccess}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={uploading || selectedFiles.length === 0}
                                className={`relative overflow-hidden w-full py-4 rounded-2xl border text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                                    ${(selectedFiles.length === 0) && !uploading ? 'opacity-30 pointer-events-none' : 'cursor-pointer'}
                                    ${uploading ? 'border-[#4af8e3] text-white animate-pulse' : 'border-[#4af8e3]/30 text-[#4af8e3] hover:border-[#4af8e3]/50 active:scale-[0.98]'}
                                `}
                                style={{
                                    background: uploading 
                                        ? 'linear-gradient(to right, rgba(74, 248, 227, 0.4), rgba(199, 153, 255, 0.4))' 
                                        : 'linear-gradient(to right, rgba(74, 248, 227, 0.2), rgba(199, 153, 255, 0.2))',
                                    boxShadow: uploading 
                                        ? '0 0 25px rgba(74, 248, 227, 0.5), 0 0 50px rgba(199, 153, 255, 0.3), inset 0 0 15px rgba(255,255,255,0.2)' 
                                        : 'none'
                                }}
                            >
                                {/* Progress background fill overlay */}
                                {uploading && (
                                    <div 
                                        className={`absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#4af8e3]/35 to-[#c799ff]/35 transition-all duration-300 ease-out z-0 ${uploadProgress >= 95 ? 'animate-pulse' : ''}`}
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                )}

                                <div className="relative z-10 flex items-center justify-center gap-2">
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-[#4af8e3]/30 border-t-[#4af8e3] rounded-full animate-spin" />
                                            {uploadProgress >= 95 ? (
                                                <span className="animate-pulse">Processing...</span>
                                            ) : (
                                                `Uploading (${uploadProgress}%)...`
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-lg">cloud_upload</span>
                                            Upload Note
                                        </>
                                    )}
                                </div>
                            </button>
                        </form>
                    </GlassCard>
                </div>

                {/* Right side: List of Uploaded Notes */}
                <div className="lg:col-span-7">
                    <GlassCard className="p-6 min-h-[400px] flex flex-col">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between items-start gap-2 mb-4">
                            <h2 className="text-lg font-bold text-[#f0f0fd]" style={{ fontFamily: "'Manrope', sans-serif" }}>Your Shared Notes</h2>
                            {selectedBatch && (
                                <span className="text-xs font-bold text-[#aaaab7] bg-white/5 px-3 py-1 rounded-full border border-white/5 shrink-0">
                                    {batches.find(b => b.id === selectedBatch)?.batch_name || ""}
                                </span>
                            )}
                        </div>

                        {listError && (
                            <div className="mb-4 p-3 text-xs rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84]">
                                {listError}
                            </div>
                        )}

                        {!selectedBatch ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-3">
                                <span className="material-symbols-outlined text-5xl text-white/10">school</span>
                                <p className="text-sm font-bold text-[#f0f0fd]">No Batch Selected</p>
                            </div>
                        ) : notesLoading ? (
                            <TeacherNotesSkeleton />
                        ) : notes.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-3">
                                <span className="material-symbols-outlined text-5xl text-white/10">edit_document</span>
                                <p className="text-sm font-bold text-[#f0f0fd]">No notes shared yet</p>
                            </div>
                        ) : (
                            <div className="flex-grow space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                {notes.map((note) => (
                                    <TeacherNoteCard
                                        key={note.id}
                                        note={note}
                                        deletingId={deletingId}
                                        user={user}
                                        handleDeleteNote={handleDeleteNote}
                                        getFileIcon={getFileIcon}
                                        formatDateTime={formatDateTime}
                                        onPreview={(noteItem, index) => setPreviewData({ note: noteItem, index })}
                                        savingFiles={savingFiles}
                                        onSaveToCache={handleSaveToCache}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {selectedBatch && totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-white/5" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                                <button
                                    onClick={() => fetchNotes(selectedBatch, currentPage - 1)}
                                    disabled={currentPage === 1 || notesLoading}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 text-[#aaaab7] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 hover:bg-white/10"
                                >
                                    <span className="material-symbols-outlined text-base">chevron_left</span>
                                </button>

                                {(() => {
                                    const pages = [];
                                    const delta = 1;
                                    const left = currentPage - delta;
                                    const right = currentPage + delta;
                                    let lastPushed = 0;

                                    for (let p = 1; p <= totalPages; p++) {
                                        if (p === 1 || p === totalPages || (p >= left && p <= right)) {
                                            if (lastPushed && p - lastPushed > 1) {
                                                pages.push('...' + p);
                                            }
                                            pages.push(p);
                                            lastPushed = p;
                                        }
                                    }

                                    return pages.map((item) => {
                                        if (typeof item === 'string') {
                                            return (
                                                <span
                                                    key={item}
                                                    className="w-9 h-9 flex items-center justify-center text-xs font-bold"
                                                    style={{ color: '#aaaab7' }}
                                                >
                                                    ···
                                                </span>
                                            );
                                        }
                                        const isActive = currentPage === item;
                                        return (
                                            <button
                                                key={item}
                                                onClick={() => fetchNotes(selectedBatch, item)}
                                                disabled={notesLoading}
                                                className="w-9 h-9 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95"
                                                style={{
                                                    backgroundColor: isActive ? 'rgba(74, 248, 227, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                                    color: isActive ? '#4af8e3' : '#aaaab7',
                                                    border: isActive ? '1px solid rgba(74, 248, 227, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                                                }}
                                            >
                                                {item}
                                            </button>
                                        );
                                    });
                                })()}

                                <button
                                    onClick={() => fetchNotes(selectedBatch, currentPage + 1)}
                                    disabled={currentPage === totalPages || notesLoading}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 text-[#aaaab7] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 hover:bg-white/10"
                                >
                                    <span className="material-symbols-outlined text-base">chevron_right</span>
                                </button>
                            </div>
                        )}
                    </GlassCard>
                </div>

            </div>

            {previewData && (
                <MediaPreviewer
                    note={previewData.note}
                    initialIndex={previewData.index}
                    onClose={() => setPreviewData(null)}
                    getFileIcon={getFileIcon}
                    formatDateTime={formatDateTime}
                    hideUploaderName={true}
                />
            )}
        </div>
    );
}

export default function TeacherNotes() {
    return (
        <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherLayout>
                <TeacherNotesContent />
            </TeacherLayout>
        </ProtectedRoute>
    );
}

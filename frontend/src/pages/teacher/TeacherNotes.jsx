import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import ModernSelect from "@/components/ModernSelect";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useTeacherTheme } from "@/context/TeacherThemeContext";
import { TeacherNotesPageSkeleton, TeacherNotesSkeleton } from "@/components/Skeletons";
import MediaPreviewer from "@/components/MediaPreviewer";
import { checkCachedFiles, saveCachedFile, getCachedFile } from "@/lib/mediaDb";

function GlassCard({ children, className = "", style = {}, ...props }) {
    return (
        <div
            className={`rounded-[28px] border ${className}`}
            style={{
                background: "var(--tt-card-bg, rgba(28, 31, 43, 0.6))",
                borderColor: "var(--tt-card-border, rgba(255, 255, 255, 0.07))",
                boxShadow: "var(--tt-card-shadow)",
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

function TeacherNoteCard({ note, deletingId, user, handleDeleteNote, getFileIcon, formatDateTime, onPreview, onSaveToCache, savingFiles, cacheVersion }) {
    const { theme } = useTeacherTheme();
    const isLight = theme === "light";

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
    }, [note.id, savingFiles, cacheVersion]);

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

    const isImgOrPdf = isPreviewable(currentFile.file_name);

    const handleCardClick = async (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;

        if (isImgOrPdf) {
            onPreview(note, activeIndex);
        } else {
            if (!currentCached) {
                if (!isSaving) {
                    onSaveToCache(note, () => {
                        const ids = noteFiles.map(f => f.file_id).filter(Boolean);
                        setCachedFileIds(prev => new Set([...prev, ...ids]));
                    });
                }
                return;
            }

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
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 group cursor-pointer hover:bg-white/10 ${isSaving ? 'opacity-80 pointer-events-none' : ''}`}
            style={{
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.02)',
                borderColor: isLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.05)',
            }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* File Type Icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tt-icon-bg)', color: 'var(--tt-text-secondary)' }}>
                        <span className="material-symbols-outlined text-xl">
                            {getFileIcon(currentFile.file_name)}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        {/* File Caption / Name */}
                        <h3 className="text-sm font-bold truncate" title={currentFile.caption || currentFile.file_name} style={{ color: 'var(--tt-text-primary)' }}>
                            {currentFile.caption || currentFile.file_name}
                        </h3>

                        {/* Original File Name if caption is used */}
                        {currentFile.caption && currentFile.caption !== currentFile.file_name && (
                            <p className="text-[10px] mt-0.5 truncate" title={currentFile.file_name} style={{ color: 'var(--tt-text-secondary)', opacity: 0.8 }}>
                                {currentFile.file_name}
                            </p>
                        )}
                    </div>
                </div>

                {/* Carousel controls in top right */}
                {noteFiles.length > 1 && (
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                        <span className="text-[10px] font-semibold mr-1" style={{ color: 'var(--tt-text-secondary)', opacity: 0.7 }}>
                            {activeIndex + 1} of {noteFiles.length}
                        </span>
                        <button onClick={handlePrev} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-95" style={{ backgroundColor: 'var(--tt-icon-bg)', borderColor: 'var(--tt-divider)', color: 'var(--tt-text-secondary)', borderWidth: 1 }} title="Previous File">
                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                        </button>
                        <button onClick={handleNext} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-95" style={{ backgroundColor: 'var(--tt-icon-bg)', borderColor: 'var(--tt-divider)', color: 'var(--tt-text-secondary)', borderWidth: 1 }} title="Next File">
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Footer info & Action buttons */}
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderTopColor: 'var(--tt-divider)' }}>
                <div className="text-[10px] leading-tight min-w-0 flex-1 pr-2" style={{ color: 'var(--tt-text-secondary)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--tt-text-secondary)', opacity: 0.8 }}>{formatDateTime(note.created_at)}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {!currentCached && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border"
                            style={{ backgroundColor: 'var(--tt-icon-bg)', borderColor: 'var(--tt-divider)', color: 'var(--tt-text-secondary)' }}
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
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 border"
                            style={{ backgroundColor: 'var(--tt-error-bg, rgba(239, 68, 68, 0.1))', borderColor: isLight ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 110, 132, 0.2)', color: 'var(--tt-error)' }}
                            title="Delete Note Group"
                        >
                            {deletingId === note.id ? (
                                <div className="w-4 h-4 border-2 border-t-current rounded-full animate-spin" style={{ borderColor: isLight ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 110, 132, 0.3)' }} />
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
    const { theme } = useTeacherTheme();
    const isLight = theme === "light";

    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState("");
    const [notes, setNotes] = useState([]);
    const [batchesLoading, setBatchesLoading] = useState(true);
    const [notesLoading, setNotesLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [deletingId, setDeletingId] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [savingFiles, setSavingFiles] = useState({});
    const [cacheVersion, setCacheVersion] = useState(0);

    const triggerCacheRefresh = () => setCacheVersion(prev => prev + 1);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedFiles, setSelectedFiles] = useState([]);

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
        fetchBatches();
    }, [fetchBatches]);

    useEffect(() => {
        if (selectedBatch) {
            fetchNotes(selectedBatch, 1);
        } else {
            setNotes([]);
        }
    }, [selectedBatch, fetchNotes]);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const imageOnlyMode = selectedFiles.length > 0 && selectedFiles.every(f => f.file.type.startsWith("image/"));
        const newImagesOnly = files.every(f => f.type.startsWith("image/"));

        if (selectedFiles.length > 0 && !imageOnlyMode) {
            setUploadError("Multi-file uploads are only allowed for images.");
            return;
        }
        if (selectedFiles.length > 0 && imageOnlyMode && !newImagesOnly) {
            setUploadError("You can only append more images, other file types must be uploaded singly.");
            return;
        }

        if (files.length > 1 && !newImagesOnly) {
            setUploadError("Multi-file uploads are only allowed for images.");
            return;
        }

        const newItems = files.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            caption: ""
        }));

        if (newImagesOnly && (selectedFiles.length === 0 || imageOnlyMode)) {
            setSelectedFiles(prev => [...prev, ...newItems]);
        } else {
            setSelectedFiles(newItems);
        }
        setUploadError("");
        setUploadSuccess("");
    };

    const handleDiscardFile = (id) => {
        setSelectedFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleFileCaptionChange = (id, text) => {
        setSelectedFiles(prev => prev.map(f => f.id === id ? { ...f, caption: text } : f));
    };

    const handleDeleteNote = async (noteId) => {
        if (!window.confirm("Are you sure you want to delete this note? This action cannot be undone.")) return;
        setDeletingId(noteId);
        try {
            await api.delete(`/api/notes/${noteId}`);
            setNotes(prev => prev.filter(n => n.id !== noteId));
            if (notes.length === 1 && currentPage > 1) {
                fetchNotes(selectedBatch, currentPage - 1);
            } else {
                fetchNotes(selectedBatch, currentPage);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setListError(err.message || "Failed to delete note");
            }
        } finally {
            setDeletingId(null);
        }
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (selectedFiles.length === 0) return;
        if (!selectedBatch) {
            setUploadError("Please select a batch first.");
            return;
        }

        setUploading(true);
        setUploadError("");
        setUploadSuccess("");
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append("batch_id", selectedBatch);

            selectedFiles.forEach((fileItem, index) => {
                formData.append("files", fileItem.file);
                formData.append("captions", fileItem.caption || "");
            });

            const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
            const token = localStorage.getItem("idToken");

            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${baseUrl}/api/notes/upload`);

            if (token) {
                xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            }

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(percent);
                }
            };

            const responsePromise = new Promise((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch {
                            resolve(xhr.responseText);
                        }
                    } else {
                        try {
                            const errObj = JSON.parse(xhr.responseText);
                            reject(new Error(errObj.detail || `Upload failed with status ${xhr.status}`));
                        } catch {
                            reject(new Error(`Upload failed with status ${xhr.status}`));
                        }
                    }
                };
                xhr.onerror = () => reject(new Error("Network connection error."));
                xhr.onabort = () => reject(new Error("Upload aborted."));
            });

            xhr.send(formData);
            await responsePromise;

            setUploadSuccess("Notes uploaded successfully!");
            setSelectedFiles([]);
            fetchNotes(selectedBatch, 1);
        } catch (err) {
            setUploadError(err.message || "Something went wrong during upload.");
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const getFileIcon = (filename) => {
        if (!filename) return "description";
        const ext = filename.split(".").pop().toLowerCase();
        const iconMap = {
            pdf: "picture_as_pdf",
            doc: "description",
            docx: "description",
            xls: "table_chart",
            xlsx: "table_chart",
            ppt: "present_to_all",
            pptx: "present_to_all",
            png: "image",
            jpg: "image",
            jpeg: "image",
            webp: "image",
            gif: "gif",
            zip: "folder_zip",
            rar: "folder_zip",
            txt: "draft",
        };
        return iconMap[ext] || "description";
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return "";
        try {
            const d = new Date(dateString);
            const rtf = new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
            });
            return rtf.format(d);
        } catch {
            return dateString;
        }
    };



    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center md:items-start justify-between gap-4">
                <h1 className="text-2xl md:text-3xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>
                    Study Notes
                </h1>

                {/* Batch Selector */}
                <div className="w-full sm:w-64 relative z-40 md:mt-10">
                    <ModernSelect
                        value={selectedBatch}
                        options={batches}
                        placeholder="Select Batch"
                        onChange={(e) => setSelectedBatch(e.target.value)}
                        className="w-full"
                        theme={theme}
                    />
                </div>
            </div>

            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left side: Upload Form */}
                <div className="lg:col-span-5">
                    <GlassCard className="p-6 space-y-5">
                        <h2 className="text-lg font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>Upload New Note</h2>

                        <form onSubmit={handleUploadSubmit} className="space-y-4">

                            {/* File Upload Field */}
                            <div>
                                <label className="block text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--tt-text-secondary)' }}>
                                    Choose Files
                                </label>
                                {selectedFiles.length === 0 ? (
                                    <div 
                                        className="relative group rounded-2xl border border-dashed p-4 transition-all flex flex-col items-center justify-center cursor-pointer min-h-[120px]"
                                        style={{
                                            backgroundColor: 'var(--tt-input-bg)',
                                            borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(255, 255, 255, 0.15)',
                                        }}
                                    >
                                        <input
                                            id="note-file-input"
                                            type="file"
                                            accept="*"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            multiple
                                        />
                                        <span className="material-symbols-outlined text-3xl transition-colors mb-2" style={{ color: 'var(--tt-text-secondary)' }}>
                                            cloud_upload
                                        </span>
                                        <span className="text-xs font-semibold text-center" style={{ color: 'var(--tt-text-primary)' }}>
                                            Select or drag files here
                                        </span>
                                        <span className="text-[10px] mt-1" style={{ color: 'var(--tt-text-secondary)' }}>PDF, Word, Excel, Image &amp; more</span>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed p-4 space-y-4" style={{ backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)' }}>
                                        <div className="max-h-[260px] overflow-y-auto pr-1 custom-scrollbar space-y-3">
                                            {selectedFiles.length > 1 ? (
                                                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--tt-text-secondary)' }}>Queue ({selectedFiles.length} images)</p>
                                            ) : (
                                                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--tt-text-secondary)' }}>Selected File</p>
                                            )}
                                            {selectedFiles.map((fileItem) => (
                                                <div key={fileItem.id} className="rounded-xl border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--tt-divider)', backgroundColor: 'var(--tt-input-bg)' }}>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <span className="material-symbols-outlined text-lg shrink-0" style={{ color: 'var(--tt-text-secondary)' }}>
                                                                {getFileIcon(fileItem.file.name)}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold truncate pr-2 max-w-[180px]" title={fileItem.file.name} style={{ color: 'var(--tt-text-primary)' }}>
                                                                    {fileItem.file.name}
                                                                </p>
                                                                <p className="text-[9px]" style={{ color: 'var(--tt-text-secondary)' }}>
                                                                    {(fileItem.file.size / (1024 * 1024)).toFixed(2)} MB
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDiscardFile(fileItem.id)}
                                                            className="w-7 h-7 rounded-lg active:scale-95 flex items-center justify-center transition-all cursor-pointer shrink-0 border"
                                                            style={{ backgroundColor: 'var(--tt-icon-bg)', borderColor: 'var(--tt-divider)', color: 'var(--tt-text-secondary)' }}
                                                            title="Remove"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">close</span>
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={fileItem.caption}
                                                        onChange={(e) => handleFileCaptionChange(fileItem.id, e.target.value)}
                                                        className="w-full px-3 py-1.5 rounded-xl border focus:outline-none transition-all text-xs focus:ring-offset-0 focus:ring-0"
                                                        style={{ backgroundColor: 'var(--tt-input-bg)', borderColor: 'var(--tt-input-border)', color: 'var(--tt-text-primary)' }}
                                                        placeholder="File caption (optional)"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add more files button inside the dashed container */}
                                        {selectedFiles.every(f => f.file.type.startsWith("image/")) && (
                                            <div className="relative group rounded-xl border border-dashed py-2.5 transition-all flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)' }}>
                                                <input
                                                    id="note-file-input-more"
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    multiple
                                                />
                                                <span className="material-symbols-outlined text-sm transition-colors mr-1.5" style={{ color: 'var(--tt-text-secondary)' }}>
                                                    add
                                                </span>
                                                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--tt-text-secondary)' }}>
                                                    Add more images
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Status messages */}
                            {uploadError && (
                                <div className="p-3 text-xs rounded-xl border" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--tt-error)' }}>
                                    {uploadError}
                                </div>
                            )}

                            {uploadSuccess && (
                                <div className="p-3 text-xs rounded-xl border" style={{ backgroundColor: isLight ? 'rgba(13, 148, 136, 0.12)' : 'rgba(74, 248, 227, 0.1)', borderColor: isLight ? 'rgba(13, 148, 136, 0.2)' : 'rgba(74, 248, 227, 0.2)', color: isLight ? '#0d9488' : '#4af8e3' }}>
                                    {uploadSuccess}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={uploading || selectedFiles.length === 0}
                                className={`relative overflow-hidden w-full py-4 rounded-2xl border text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                                    ${(selectedFiles.length === 0) && !uploading ? 'opacity-30 pointer-events-none' : 'cursor-pointer'}
                                    ${uploading ? 'text-white animate-pulse' : 'active:scale-[0.98]'}
                                `}
                                style={{
                                    background: uploading 
                                        ? (isLight 
                                            ? 'linear-gradient(to right, rgba(13, 148, 136, 0.4), rgba(13, 148, 136, 0.4))'
                                            : 'linear-gradient(to right, rgba(74, 248, 227, 0.4), rgba(199, 153, 255, 0.4))')
                                        : (isLight 
                                            ? 'linear-gradient(to right, rgba(13, 148, 136, 0.15), rgba(13, 148, 136, 0.15))'
                                            : 'linear-gradient(to right, rgba(74, 248, 227, 0.2), rgba(199, 153, 255, 0.2))'),
                                    borderColor: isLight ? 'rgba(13, 148, 136, 0.35)' : 'rgba(74, 248, 227, 0.3)',
                                    color: isLight ? '#0d9488' : '#4af8e3',
                                    boxShadow: uploading 
                                        ? (isLight 
                                            ? '0 0 25px rgba(13, 148, 136, 0.4), 0 0 50px rgba(13, 148, 136, 0.2)' 
                                            : '0 0 25px rgba(74, 248, 227, 0.5), 0 0 50px rgba(199, 153, 255, 0.3)') 
                                        : 'none'
                                }}
                            >
                                {/* Progress background fill overlay */}
                                {uploading && (
                                    <div 
                                        className={`absolute top-0 left-0 bottom-0 transition-all duration-300 ease-out z-0 ${uploadProgress >= 95 ? 'animate-pulse' : ''}`}
                                        style={{ width: `${uploadProgress}%`, backgroundColor: isLight ? 'rgba(13, 148, 136, 0.25)' : 'rgba(74, 248, 227, 0.35)' }}
                                    />
                                )}

                                <div className="relative z-10 flex items-center justify-center gap-2">
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-t-current rounded-full animate-spin" style={{ borderColor: isLight ? 'rgba(13, 148, 136, 0.3)' : 'rgba(74, 248, 227, 0.3)' }} />
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
                            <h2 className="text-lg font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--tt-text-primary)' }}>Your Shared Notes</h2>
                            {selectedBatch && (
                                <span className="text-xs font-bold border px-3 py-1 rounded-full shrink-0" style={{ color: 'var(--tt-text-secondary)', backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)' }}>
                                    {batches.find(b => b.id === selectedBatch)?.batch_name || ""}
                                </span>
                            )}
                        </div>

                        {listError && (
                            <div className="mb-4 p-3 text-xs rounded-xl border" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--tt-error)' }}>
                                {listError}
                            </div>
                        )}

                        {!selectedBatch ? (
                            <div className="flex-grow flex flex-col items-center justify-center py-20 text-center gap-3">
                                <span className="material-symbols-outlined text-5xl opacity-30" style={{ color: 'var(--tt-text-muted)' }}>school</span>
                                <p className="text-sm font-bold" style={{ color: 'var(--tt-text-primary)' }}>No Batch Selected</p>
                            </div>
                        ) : notesLoading ? (
                            <TeacherNotesSkeleton />
                        ) : notes.length === 0 ? (
                            <div className="flex-grow flex flex-col items-center justify-center py-20 text-center gap-3">
                                <span className="material-symbols-outlined text-5xl opacity-30" style={{ color: 'var(--tt-text-muted)' }}>edit_document</span>
                                <p className="text-sm font-bold" style={{ color: 'var(--tt-text-primary)' }}>No notes shared yet</p>
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
                                        cacheVersion={cacheVersion}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {selectedBatch && totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t" style={{ borderTopColor: 'var(--tt-divider)', transform: "translateZ(0)", isolation: "isolate" }}>
                                <button
                                    onClick={() => fetchNotes(selectedBatch, currentPage - 1)}
                                    disabled={currentPage === 1 || notesLoading}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)', color: 'var(--tt-text-secondary)' }}
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
                                                    style={{ color: 'var(--tt-text-muted)' }}
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
                                                    backgroundColor: isActive 
                                                        ? (isLight ? 'rgba(13, 148, 136, 0.15)' : 'rgba(74, 248, 227, 0.15)') 
                                                        : 'var(--tt-hover-bg)',
                                                    color: isActive 
                                                        ? (isLight ? '#0d9488' : '#4af8e3') 
                                                        : 'var(--tt-text-secondary)',
                                                    borderColor: isActive 
                                                        ? (isLight ? 'rgba(13, 148, 136, 0.35)' : 'rgba(74, 248, 227, 0.35)') 
                                                        : 'var(--tt-divider)',
                                                    borderWidth: 1,
                                                    borderStyle: 'solid'
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
                                    className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                    style={{ backgroundColor: 'var(--tt-hover-bg)', borderColor: 'var(--tt-divider)', color: 'var(--tt-text-secondary)' }}
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
                    onClose={() => {
                        setPreviewData(null);
                        triggerCacheRefresh();
                    }}
                    getFileIcon={getFileIcon}
                    formatDateTime={formatDateTime}
                    hideUploaderName={true}
                    onFileCached={triggerCacheRefresh}
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

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherLayout from "@/components/TeacherLayout";
import ModernSelect from "@/components/ModernSelect";
import { api, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TeacherDashboardSkeleton } from "@/components/Skeletons";

function GlassCard({ children, className = "", style = {} }) {
    return (
        <div
            className={`rounded-[28px] border border-white/[0.07] ${className}`}
            style={{
                background: "rgba(28, 31, 43, 0.6)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                ...style,
            }}
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

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Form inputs
    const [noteTitle, setNoteTitle] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);

    // Alerts
    const [uploadError, setUploadError] = useState("");
    const [uploadSuccess, setUploadSuccess] = useState("");
    const [listError, setListError] = useState("");

    const fetchBatches = useCallback(async () => {
        try {
            const data = await api.get("/api/teacher/batches");
            setBatches(data);
        } catch (err) {
            console.error("Failed to fetch batches:", err);
        } finally {
            setBatchesLoading(false);
        }
    }, []);

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
        const file = e.target.files[0];
        if (file) {
            setUploadError("");
            setSelectedFile(file);
        }
    };

    const handleDiscardFile = () => {
        setSelectedFile(null);
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!selectedBatch || !noteTitle.trim() || !selectedFile) {
            setUploadError("Please fill in all fields (make sure to select a batch).");
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setUploadError("");
        setUploadSuccess("");

        const formData = new FormData();
        formData.append("title", noteTitle);
        formData.append("batch_id", selectedBatch);
        formData.append("file", selectedFile);

        let currentProgress = 0;
        let targetProgress = 0;
        setUploadProgress(0);

        const progressInterval = setInterval(() => {
            if (currentProgress < targetProgress) {
                const diff = targetProgress - currentProgress;
                // Increment smoothly by small steps
                const increment = Math.max(1, Math.min(3, Math.ceil(diff * 0.08)));
                currentProgress += increment;
                setUploadProgress(currentProgress);
            }
        }, 30);

        try {
            await api.upload("/api/notes/upload", formData, (progress) => {
                targetProgress = Math.round(progress * 0.95);
            });
            
            // Let the smooth animation catch up before showing 100%
            while (currentProgress < 92) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            clearInterval(progressInterval);
            setUploadProgress(100);
            await new Promise(resolve => setTimeout(resolve, 500));

            setUploadSuccess("Note uploaded successfully!");
            setNoteTitle("");
            const fileInput = document.getElementById("note-file-input");
            if (fileInput) {
                fileInput.value = "";
            }
            setSelectedFile(null);
            fetchNotes(selectedBatch, 1);
        } catch (err) {
            clearInterval(progressInterval);
            if (!isSystemicError(err.message)) {
                setUploadError(err.message || "Failed to upload note");
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

                            {/* Note Title */}
                            <div>
                                <label className="block text-[11px] font-bold tracking-widest uppercase mb-2 text-[#aaaab7]">
                                    Note Title
                                </label>
                                <input
                                    type="text"
                                    value={noteTitle}
                                    onChange={(e) => setNoteTitle(e.target.value)}
                                    className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 focus:border-[#3b82f6]/50 focus:ring-1 focus:ring-[#3b82f6]/50 text-[#f0f0fd] text-sm font-medium focus:outline-none transition-all placeholder:text-[#464752]"
                                    placeholder="e.g. C/C++ Notes"
                                    required
                                    autoComplete="off"
                                />
                            </div>

                            {/* File Upload Field */}
                            <div>
                                <label className="block text-[11px] font-bold tracking-widest uppercase mb-2 text-[#aaaab7]">
                                    Choose File
                                </label>
                                {!selectedFile ? (
                                    <div className="relative group rounded-2xl border border-dashed border-white/15 hover:border-[#3b82f6]/40 p-4 transition-all bg-white/[0.01] hover:bg-[#3b82f6]/5 flex flex-col items-center justify-center cursor-pointer min-h-[120px]">
                                        <input
                                            id="note-file-input"
                                            type="file"
                                            accept="*"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            required
                                        />
                                        <span className="material-symbols-outlined text-3xl text-[#aaaab7] group-hover:text-[#3b82f6] transition-colors mb-2">
                                            cloud_upload
                                        </span>
                                        <span className="text-xs font-semibold text-[#f0f0fd] text-center">
                                            Select or drag file here
                                        </span>
                                        <span className="text-[10px] text-[#aaaab7] mt-1">PDF, Word, Excel, Image &amp; more</span>
                                    </div>
                                ) : (
                                    <div className="relative rounded-2xl border border-white/10 p-4 bg-white/[0.02] flex items-center justify-between gap-3 min-h-[80px]">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/50 shrink-0">
                                                <span className="material-symbols-outlined text-xl">
                                                    {getFileIcon(selectedFile.name)}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-[#f0f0fd] truncate pr-2 max-w-[200px]">
                                                    {selectedFile.name}
                                                </p>
                                                <p className="text-[10px] text-[#aaaab7] mt-0.5">
                                                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleDiscardFile}
                                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-[#aaaab7] hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 border border-white/5"
                                            title="Discard File"
                                        >
                                            <span className="material-symbols-outlined text-base">close</span>
                                        </button>
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
                                disabled={uploading || !selectedFile || !noteTitle.trim()}
                                className={`relative overflow-hidden w-full py-4 rounded-2xl border text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                                    ${(!selectedFile || !noteTitle.trim()) && !uploading ? 'opacity-30 pointer-events-none' : 'cursor-pointer'}
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
                                    <div
                                        key={note.id}
                                        className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-4 group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/50 shrink-0">
                                                <span className="material-symbols-outlined text-xl">
                                                    {getFileIcon(note.file_name)}
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-sm font-bold text-[#f0f0fd] truncate">{note.title}</h3>
                                                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] text-[#aaaab7]">
                                                    <span className="truncate max-w-[200px]">{note.file_name}</span>
                                                    <span className="text-white/20">•</span>
                                                    <span className="shrink-0">{formatDateTime(note.created_at)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Open Link */}
                                            <a
                                                href={note.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-9 h-9 rounded-xl bg-white/5 text-[#aaaab7] hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                                                title="View File"
                                            >
                                                <span className="material-symbols-outlined text-lg">open_in_new</span>
                                            </a>

                                            {/* Delete Note */}
                                            {note.uploaded_by === user.uid && (
                                                <button
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    disabled={deletingId === note.id}
                                                    className="w-9 h-9 rounded-xl bg-[#ff6e84]/10 text-[#ff6e84] hover:bg-[#ff6e84]/20 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
                                                    title="Delete Note"
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

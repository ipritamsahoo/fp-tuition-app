import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import ProtectedRoute from "@/components/ProtectedRoute";
import StudentLayout from "@/components/StudentLayout";
import { api, apiFetch, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { generateReceiptPDF } from "@/lib/pdfUtils";
import { getCache, setCache } from "@/lib/memoryCache";
import { GenericListSkeleton } from "@/components/Skeletons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isMobile() {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
        || ("ontouchstart" in window && window.innerWidth < 768);
}

// ── Status Badge ──
function StatusBadge({ status }) {
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    const config = {
        Paid: {
            bg: isLight ? "rgba(13,148,136,0.1)" : "rgba(0,106,96,0.4)",
            text: isLight ? "#0d9488" : "#33e9d5",
            border: isLight ? "rgba(13,148,136,0.2)" : "rgba(74,248,227,0.2)",
            label: "Paid",
        },
        Unpaid: {
            bg: isLight ? "rgba(239,68,68,0.08)" : "rgba(255,110,132,0.15)",
            text: isLight ? "#ef4444" : "#ff6e84",
            border: isLight ? "rgba(239,68,68,0.15)" : "rgba(255,110,132,0.2)",
            label: "Unpaid",
        },
        Pending_Verification: {
            bg: isLight ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.15)",
            text: "#3b82f6",
            border: isLight ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.2)",
            label: "Pending",
        },
    };
    const c = config[status] || config.Unpaid;
    return (
        <div
            className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md"
            style={{
                backgroundColor: c.bg,
                color: c.text,
                borderWidth: 1, borderStyle: 'solid', borderColor: c.border,
                transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden"
            }}
        >
            {c.label}
        </div>
    );
}

// ── Pay Now Modal ──
function PayNowModal({ payment, upiData, onClose, onProceed }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [upiNotice, setUpiNotice] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        setFile(selected);
        setPreview(URL.createObjectURL(selected));
    };

    const handleRemoveFile = () => {
        if (preview) URL.revokeObjectURL(preview);
        setFile(null);
        setPreview(null);
    };

    const handleSubmit = async () => {
        if (!file) return;
        setSubmitting(true);
        try { await onProceed(payment.id, file); }
        finally { setSubmitting(false); }
    };

    useEffect(() => {
        return () => { if (preview) URL.revokeObjectURL(preview); };
    }, [preview]);

    if (!payment) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center"
            onClick={onClose}
            style={{
                backgroundColor: isLight ? '#eef2ff' : '#0c0e17',
                transform: "translateZ(0)", isolation: "isolate"
            }}
        >
            <div
                className="relative w-full h-full sm:h-auto sm:max-h-[85dvh] sm:max-w-md sm:rounded-[28px] flex flex-col"
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: isLight ? '#f8fafc' : '#0c0e17',
                    border: `1px solid var(--st-divider)`,
                    boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.08)' : '0 8px 32px rgba(0,0,0,0.5)',
                }}
            >
                {/* ── Header Bar ── */}
                <div
                    className="flex items-center gap-3 px-4 h-16 shrink-0"
                    style={{
                        borderBottom: `1px solid var(--st-divider)`,
                        background: isLight
                            ? 'linear-gradient(to right, #f8fafc, #f0f4ff, #f8fafc)'
                            : 'linear-gradient(to right, #0c0e17, #111427, #0c0e17)',
                    }}
                >
                    <button onClick={onClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                        style={{ color: 'var(--st-text-secondary)' }}
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex-1 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-lg leading-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>Secure Checkout</h3>
                            <p className="text-[11px] font-medium tracking-wide flex items-center gap-1" style={{ color: 'var(--st-accent)' }}>
                                <span className="material-symbols-outlined text-[12px] material-symbols-filled">verified</span> 100% SECURE
                            </p>
                        </div>
                        <div className="text-right">
                            <h3 className="font-extrabold text-xl leading-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>₹{payment.amount}</h3>
                            <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--st-text-secondary)' }}>{MONTHS[payment.month - 1]} {payment.year}</p>
                        </div>
                    </div>
                </div>

                {/* ── Scrollable Content ── */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4">

                <div className="mb-4" style={{ borderTop: `1px solid var(--st-divider)` }} />

                <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--st-text-primary)' }}>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ backgroundColor: 'var(--st-blue-bg)', color: 'var(--st-blue)' }}>1</span>
                        Make Payment
                    </p>
                    {upiData && (
                        <div className="text-center mb-5 mt-2">
                            <div className="relative inline-block mx-auto">
                                <div className="absolute -inset-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] rounded-[1.25rem] blur opacity-40"></div>
                                <div className="relative p-3.5 bg-white rounded-2xl shadow-xl flex flex-col items-center border border-white/20">
                                    <QRCodeSVG value={upiData.upi_link} size={160} level="H" includeMargin={false} />
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 w-full justify-center">
                                        <span className="text-[11px] font-extrabold text-gray-400 tracking-wider">BHIM UPI</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[13px] mt-4 font-medium" style={{ color: 'var(--st-text-muted)' }}>Scan with any UPI app to pay</p>
                        </div>
                    )}
                    {isMobile() && upiData && (
                        <button onClick={() => setUpiNotice(true)}
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl text-sm font-medium transition-all mb-2 cursor-pointer"
                            style={{ backgroundColor: 'var(--st-blue-bg)', border: `1px solid rgba(59,130,246,0.2)`, color: 'var(--st-blue)' }}
                        >
                            <span className="material-symbols-outlined text-lg">credit_card</span> Open UPI App
                        </button>
                    )}
                    {upiNotice && (
                        <div className="mb-4 p-3 rounded-2xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff9dac] text-xs leading-relaxed">
                            <span className="font-semibold">⚠️ This service is currently unavailable!</span><br />
                            Pay either via QR code or pay <span className="font-semibold text-[#ff6e84]">Mr. Soumya Sengupta</span> directly through your UPI app, then upload a screenshot here for verification.
                            <button onClick={() => setUpiNotice(false)} className="ml-2 text-[#ff6e84] hover:text-[#ff9dac] cursor-pointer">✕</button>
                        </div>
                    )}
                    {!upiData && (
                        <div className="flex items-center justify-center py-6">
                            <div className="w-6 h-6 border-3 border-[#3b82f6]/30 border-t-[#3b82f6] rounded-full animate-spin" />
                            <span className="text-sm ml-3" style={{ color: 'var(--st-text-secondary)' }}>Loading payment info...</span>
                        </div>
                    )}
                </div>

                <div className="my-4" style={{ borderTop: `1px solid var(--st-divider)` }} />

                <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--st-text-primary)' }}>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ backgroundColor: 'var(--st-blue-bg)', color: 'var(--st-blue)' }}>2</span>
                        Upload Payment Screenshot
                    </p>
                    {!preview ? (
                        <label
                            className="flex flex-col items-center justify-center w-full py-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer"
                            style={{ borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)', backgroundColor: 'var(--st-input-bg)' }}
                        >
                            <span className="material-symbols-outlined text-3xl mb-1" style={{ color: 'var(--st-text-secondary)' }}>cloud_upload</span>
                            <span className="text-sm" style={{ color: 'var(--st-text-secondary)' }}>Tap to upload screenshot</span>
                            <span className="text-xs mt-0.5" style={{ color: 'var(--st-text-muted)' }}>PNG, JPG up to 5MB</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </label>
                    ) : (
                        <div className="relative">
                            <div
                                className="relative group p-1 rounded-2xl transition-all cursor-zoom-in"
                                onClick={() => setShowPreviewModal(true)}
                                style={{ backgroundColor: 'var(--st-input-bg)', border: `1px solid var(--st-input-border)` }}
                            >
                                <img src={preview} alt="Preview" className="w-full h-auto max-h-48 object-cover rounded-xl" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl pointer-events-none">
                                    <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
                                </div>
                            </div>
                            <button onClick={handleRemoveFile}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#ff6e84]/80 text-white flex items-center justify-center hover:bg-[#ff6e84] cursor-pointer">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                            <p className="text-xs mt-2 text-center flex items-center justify-center gap-1" style={{ color: 'var(--st-accent)' }}>
                                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                Screenshot selected
                            </p>
                        </div>
                    )}
                </div>
                </div>

                {/* ── Sticky Proceed Button ── */}
                <div className="p-5 pt-3 shrink-0" style={{ borderTop: `1px solid var(--st-divider)`, backgroundColor: isLight ? '#f8fafc' : '#0c0e17' }}>
                    <button onClick={handleSubmit} disabled={!file || submitting}
                        className="w-full py-3 rounded-full bg-[#3b82f6] text-white font-bold text-sm hover:bg-[#2563eb] transition-all shadow-[0_4px_20px_rgba(59,130,246,0.4)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95">
                        {submitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...
                            </span>
                        ) : "Proceed — Send for Verification"}
                    </button>
                    {!file && <p className="text-xs text-center mt-1.5" style={{ color: 'var(--st-text-muted)' }}>Upload a screenshot to enable proceed</p>}
                </div>

                {/* ── Fullscreen Image Preview Modal ── */}
                {showPreviewModal && preview && (
                    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col" onClick={() => setShowPreviewModal(false)} style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                        <div className="flex justify-end p-5">
                            <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/20 active:scale-90 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
                            <img src={preview} alt="Fullscreen Preview" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Payments Content ──
function StudentPaymentsContent() {
    const { user } = useAuth();
    const { theme } = useStudentTheme();
    const isLight = theme === "light";
    
    // Memory Cache Key (Shared with Dashboard)
    const cacheKey = `student_global_payments_${user?.uid}`;
    const cachedData = getCache(cacheKey);

    const [payments, setPayments] = useState(cachedData || []);
    const [loading, setLoading] = useState(!cachedData);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [previewImg, setPreviewImg] = useState(null);

    // Pay Now modal
    const [payModalPayment, setPayModalPayment] = useState(null);
    const [payModalUpi, setPayModalUpi] = useState(null);

    const fetchPayments = useCallback(async () => {
        setError("");
        try {
            const data = await api.get("/api/student/payments");
            const currentCache = getCache(cacheKey);
            if (JSON.stringify(currentCache) !== JSON.stringify(data)) {
                setPayments(data);
                setCache(cacheKey, data);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [cacheKey]); // Stable dependencies (loading removed)

    useEffect(() => {
        if (user?.uid) {
            // Only fetch if memory cache is empty to save redundant reads when transitioning from Dashboard
            const cached = getCache(cacheKey);
            if (!cached || cached.length === 0) {
                fetchPayments();
            }
        }
        const handleOnline = () => { setError(""); if (user?.uid) fetchPayments(); };
        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, [user?.uid, fetchPayments, cacheKey]);

    useEffect(() => {
        if (!user?.uid) return;
        let isFirstSnapshot = true; // Skip initial snapshot — fetchPayments() already called on mount
        const q = query(collection(db, "payments"), where("student_id", "==", user.uid));
        const unsubscribe = onSnapshot(q, () => {
            if (isFirstSnapshot) { isFirstSnapshot = false; return; }
            fetchPayments();
        });
        return () => unsubscribe();
    }, [user?.uid, fetchPayments]);

    const openPayModal = async (payment) => {
        setPayModalPayment(payment);
        setPayModalUpi(null);
        try {
            const data = await api.get(`/api/student/upi-link?amount=${payment.amount}&month=${payment.month}&year=${payment.year}`);
            setPayModalUpi(data);
        } catch (err) { 
            if (!isSystemicError(err.message)) {
                setError(err.message); 
            }
        }
    };

    const closePayModal = () => { setPayModalPayment(null); setPayModalUpi(null); };

    const handleProceed = async (paymentId, file) => {
        try {
            const formData = new FormData();
            formData.append("file", file);
            await apiFetch(`/api/student/payments/${paymentId}/upload`, { method: "POST", body: formData });
            setSuccess("Verification request sent successfully! 🎉");
            closePayModal();
            // Note: No explicit fetchPayments() here.
            // onSnapshot listener fires automatically when backend updates
            // the Firestore payment document, triggering a fresh fetch.
        } catch (err) { 
            if (!isSystemicError(err.message)) {
                setError(err.message); 
            }
        }
    };

    if (loading) {
        return (
            <div className="px-4">
                <GenericListSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="mb-8" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                    History
                </h1>
            </div>

            {/* Alerts */}
            {error && (
                <div className="p-3 rounded-2xl text-sm flex items-center justify-between"
                    style={{ backgroundColor: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(255,110,132,0.1)', border: `1px solid ${isLight ? 'rgba(239,68,68,0.15)' : 'rgba(255,110,132,0.2)'}`, color: isLight ? '#ef4444' : '#ff9dac' }}
                >
                    <span>{error}</span>
                    <button onClick={() => setError("")} className="ml-2 cursor-pointer" style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}
            {success && (
                <div className="p-3 rounded-2xl text-sm flex items-center justify-between"
                    style={{ backgroundColor: 'var(--st-accent-bg)', border: `1px solid ${isLight ? 'rgba(13,148,136,0.2)' : 'rgba(74,248,227,0.2)'}`, color: 'var(--st-accent)' }}
                >
                    <span>{success}</span>
                    <button onClick={() => setSuccess("")} className="ml-2 cursor-pointer" style={{ color: 'var(--st-accent)' }}>
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}

                {/* Payment List */}
            <div className="space-y-4" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                {payments.filter(p => p.status === "Paid").map((p, idx) => (
                    <div key={p.id} className="relative group" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                        {/* Subtle glow behind card */}
                        <div
                            className="absolute inset-0 blur-sm rounded-3xl -z-10 transition-all"
                            style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.03)' }}
                        />

                        <div className="glass-card-student p-6 rounded-3xl flex flex-col gap-4" style={{ transform: "translateZ(0)", isolation: "isolate", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                            {/* Top row: Billing info + Amount + Status */}
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--st-text-secondary)' }}>Billing Cycle</span>
                                    <h3 className="text-xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                        {MONTHS[p.month - 1]} {p.year}
                                    </h3>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="text-2xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                        ₹{p.amount}
                                    </span>
                                    <StatusBadge status={p.status} />
                                </div>
                            </div>

                            {/* Action button */}
                            {p.status === "Paid" && (
                                <button
                                    onClick={() => generateReceiptPDF(p, user)}
                                    className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-full backdrop-blur-xl transition-colors active:scale-[0.98] cursor-pointer"
                                    style={{
                                        backgroundColor: 'var(--st-icon-bg)',
                                        border: `1px solid var(--st-input-border)`,
                                        color: 'var(--st-text-primary)',
                                        transform: "translateZ(0)", isolation: "isolate"
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[20px]">description</span>
                                    <span className="text-sm font-semibold">Download Receipt</span>
                                </button>
                            )}

                            {p.status === "Unpaid" && (
                                <button
                                    onClick={() => openPayModal(p)}
                                    className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-full bg-[#3b82f6] text-white font-bold text-sm shadow-[0_4px_20px_rgba(59,130,246,0.4)] active:scale-95 transition-transform cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[20px]">credit_card</span>
                                    Pay Now — ₹{p.amount}
                                </button>
                            )}

                            {p.status === "Pending_Verification" && (
                                <div
                                    className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-full backdrop-blur-md"
                                    style={{
                                        backgroundColor: 'var(--st-blue-bg)',
                                        border: `1px solid ${isLight ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.2)'}`,
                                        transform: "translateZ(0)", isolation: "isolate"
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[20px] text-[#3b82f6]" style={{ fontVariationSettings: "'FILL' 1" }}>hourglass_top</span>
                                    <span className="text-sm font-semibold text-[#3b82f6]">Verification Pending</span>
                                    {p.screenshot_url && (
                                        <button
                                            onClick={() => setPreviewImg(p.screenshot_url)}
                                            className="ml-auto transition-colors cursor-pointer"
                                            style={{ color: 'var(--st-text-secondary)' }}
                                        >
                                            <span className="material-symbols-outlined text-lg">visibility</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {payments.length === 0 && (
                    <div className="glass-card-student rounded-[32px] p-8 text-center">
                        <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: 'var(--st-text-muted)' }}>receipt_long</span>
                        <p className="text-lg font-medium" style={{ color: 'var(--st-text-secondary)' }}>No payment records yet</p>
                        <p className="text-sm mt-1" style={{ color: 'var(--st-text-muted)' }}>Your payment history will appear here</p>
                    </div>
                )}
            </div>

            {/* Decorative dots at bottom */}
            {payments.length > 0 && (
                <div className="py-6 flex justify-center opacity-30">
                    <div className="w-1 h-1 rounded-full mx-1" style={{ backgroundColor: 'var(--st-text-muted)' }} />
                    <div className="w-1 h-1 rounded-full mx-1" style={{ backgroundColor: 'var(--st-text-muted)' }} />
                    <div className="w-1 h-1 rounded-full mx-1" style={{ backgroundColor: 'var(--st-text-muted)' }} />
                </div>
            )}

            {/* Image preview modal */}
            {previewImg && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreviewImg(null)} style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                    <div className="relative max-w-2xl max-h-[80vh] mx-4" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setPreviewImg(null)}
                            className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 cursor-pointer z-10">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                        <img src={previewImg} alt="Receipt" className="rounded-2xl max-h-[80vh] object-contain border border-white/10" />
                    </div>
                </div>
            )}

            {/* Pay Now modal */}
            {payModalPayment && (
                <PayNowModal
                    payment={payModalPayment}
                    upiData={payModalUpi}
                    onClose={closePayModal}
                    onProceed={handleProceed}
                />
            )}
        </div>
    );
}

export default function StudentPayments() {
    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <StudentLayout>
                <StudentPaymentsContent />
            </StudentLayout>
        </ProtectedRoute>
    );
}

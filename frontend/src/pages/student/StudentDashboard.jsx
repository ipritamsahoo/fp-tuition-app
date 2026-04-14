import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import ProtectedRoute from "@/components/ProtectedRoute";
import StudentLayout from "@/components/StudentLayout";
import AnimatedGreeting from "@/components/AnimatedGreeting";
import PaymentProgressTracker from "@/components/PaymentProgressTracker";
import BadgeCelebrationOverlay from "@/components/BadgeCelebrationOverlay";
import { api, apiFetch, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { generateReceiptPDF } from "@/lib/pdfUtils";
import { getCache, setCache } from "@/lib/memoryCache";
import { StudentDashboardSkeleton } from "@/components/Skeletons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isMobile() {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
        || ("ontouchstart" in window && window.innerWidth < 768);
}

// ── Pay Now Modal (Nebula Theme) ──
function PayNowModal({ payment, upiData, onClose, onProceed }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [upiNotice, setUpiNotice] = useState(payment?.status === "Rejected");
    const [upiAppUnavailable, setUpiAppUnavailable] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        setFile(selected);
        const url = URL.createObjectURL(selected);
        setPreview(url);
    };

    const handleRemoveFile = () => {
        if (preview) URL.revokeObjectURL(preview);
        setFile(null);
        setPreview(null);
    };

    const handleSubmit = async () => {
        if (!file) return;
        setSubmitting(true);
        try {
            await onProceed(payment.id, file);
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        return () => { if (preview) URL.revokeObjectURL(preview); };
    }, [preview]);

    if (!payment) return null;

    return createPortal(
        <div
            data-theme={theme}
            className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center"
            onClick={onClose}
            style={{
                backgroundColor: isLight ? 'rgba(238,242,255,0.85)' : 'rgba(12,14,23,0.85)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                transform: "translateZ(0)", isolation: "isolate"
            }}
        >
            <div
                className="relative w-full h-full sm:h-auto sm:max-h-[85dvh] sm:max-w-md sm:rounded-[28px] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(12,14,23,0.7)',
                    border: isLight ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: isLight
                        ? '0 24px 48px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)'
                        : '0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(32px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
                    transform: "translateZ(0)", isolation: "isolate"
                }}
            >
                {/* ── Header Bar ── */}
                <div
                    className="flex items-center gap-3 px-4 h-16 shrink-0"
                    style={{
                        borderBottom: `1px solid var(--st-divider)`,
                        background: isLight
                            ? 'linear-gradient(to right, rgba(255,255,255,0.2), rgba(240,244,255,0.4), rgba(255,255,255,0.2))'
                            : 'linear-gradient(to right, rgba(12,14,23,0.4), rgba(17,20,39,0.6), rgba(12,14,23,0.4))',
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

                {/* Divider */}
                <div className="mb-4" style={{ borderTop: `1px solid var(--st-divider)` }} />

                {/* Step 1: Make Payment */}
                <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--st-text-primary)' }}>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ backgroundColor: 'var(--st-blue-bg)', color: 'var(--st-blue)' }}>1</span>
                        Make Payment
                    </p>

                    {upiData && (
                        <div className="text-center mb-5 mt-2">
                            <div className="relative inline-block mx-auto">
                                {/* Glowing backdrop */}
                                <div className="absolute -inset-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] rounded-[1.25rem] blur opacity-40"></div>
                                {/* QR Container */}
                                <div
                                    className="relative p-3.5 rounded-2xl shadow-xl flex flex-col items-center backdrop-blur-md"
                                    style={{
                                        backgroundColor: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.1)'}`
                                    }}
                                >
                                    <div className="flex items-center justify-center bg-white p-2.5 rounded-xl border border-gray-200">
                                        <QRCodeSVG value={upiData.upi_link} size={150} level="H" includeMargin={false} />
                                    </div>
                                    <div className="flex items-center gap-2 mt-3 pt-3 w-full justify-center" style={{ borderTop: `1px solid var(--st-divider)` }}>
                                        <span className="text-[11px] font-extrabold tracking-wider" style={{ color: 'var(--st-text-muted)' }}>BHIM UPI</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[13px] mt-4 font-medium" style={{ color: 'var(--st-text-muted)' }}>Scan with any UPI app to pay</p>
                        </div>
                    )}

                    {isMobile() && upiData && (
                        <>
                            <button
                                onClick={() => setUpiAppUnavailable(true)}
                                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl text-sm font-medium transition-all mb-2 cursor-pointer"
                                style={{
                                    backgroundColor: 'var(--st-blue-bg)',
                                    borderWidth: 1, borderStyle: 'solid',
                                    borderColor: isLight ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.2)',
                                    color: 'var(--st-blue)',
                                }}
                            >
                                <span className="material-symbols-outlined text-lg">credit_card</span>
                                Open UPI App
                            </button>

                            {upiAppUnavailable && (
                                <div
                                    className="mb-4 mt-1 p-3 rounded-2xl text-xs leading-relaxed relative"
                                    style={{
                                        backgroundColor: isLight ? 'rgba(245,158,11,0.08)' : 'rgba(251,191,36,0.1)',
                                        border: `1px solid ${isLight ? 'rgba(245,158,11,0.2)' : 'rgba(251,191,36,0.2)'}`,
                                        color: isLight ? '#b45309' : '#fde68a'
                                    }}
                                >
                                    <span className="font-bold flex items-center gap-1 mb-1" style={{ color: isLight ? '#d97706' : '#fbbf24' }}>
                                        <span className="material-symbols-outlined text-sm">info</span> Service Unavailable
                                    </span>
                                    This service is currently unavailable. Please pay either by scanning the QR code displayed on your screen, or by paying Mr. Soumya Sengupta directly via your UPI app, and then submit the screenshot here.
                                    <button onClick={() => setUpiAppUnavailable(false)} className="absolute top-2 right-2 cursor-pointer w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5" style={{ color: isLight ? '#d97706' : '#fbbf24' }}>
                                        <span className="material-symbols-outlined text-sm font-bold">close</span>
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {upiNotice && (
                        <div
                            className="mb-4 p-3 rounded-2xl text-xs leading-relaxed"
                            style={{
                                backgroundColor: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(255,110,132,0.1)',
                                border: `1px solid ${isLight ? 'rgba(239,68,68,0.2)' : 'rgba(255,110,132,0.2)'}`,
                                color: isLight ? '#b91c1c' : '#ff9dac'
                            }}
                        >
                            <span className="font-semibold" style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>⚠️ Payment Rejected!</span><br />
                            Your previous submission was rejected. Please ensure you upload a clear screenshot of the transaction showing the UTR/Transaction ID.
                            <button onClick={() => setUpiNotice(false)} className="ml-2 cursor-pointer font-bold" style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>✕</button>
                        </div>
                    )}

                    {!upiData && (
                        <div className="flex items-center justify-center py-6">
                            <div className="w-6 h-6 border-3 border-[#3b82f6]/30 border-t-[#3b82f6] rounded-full animate-spin" />
                            <span className="text-sm ml-3" style={{ color: 'var(--st-text-secondary)' }}>Loading payment info...</span>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="my-4" style={{ borderTop: `1px solid var(--st-divider)` }} />

                {/* Step 2: Upload Screenshot */}
                <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--st-text-primary)' }}>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ backgroundColor: 'var(--st-blue-bg)', color: 'var(--st-blue)' }}>2</span>
                        Upload Payment Screenshot
                    </p>

                    {!preview ? (
                        <label
                            className="flex flex-col items-center justify-center w-full py-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer"
                            style={{
                                borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
                                backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                            }}
                        >
                            <span className="material-symbols-outlined text-4xl mb-2" style={{ color: 'var(--st-text-secondary)' }}>cloud_upload</span>
                            <span className="text-sm" style={{ color: 'var(--st-text-secondary)' }}>Tap to upload screenshot</span>
                            <span className="text-xs mt-1" style={{ color: 'var(--st-text-muted)' }}>PNG, JPG up to 5MB</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </label>
                    ) : (
                        <div className="relative">
                            <div
                                className="relative group p-1 rounded-2xl transition-all cursor-zoom-in"
                                onClick={() => setShowPreviewModal(true)}
                                style={{
                                    backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                                    borderWidth: 1, borderStyle: 'solid',
                                    borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)',
                                }}
                            >
                                <img
                                    src={preview}
                                    alt="Payment screenshot preview"
                                    className="w-full h-auto max-h-48 object-cover rounded-xl"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl pointer-events-none">
                                    <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
                                </div>
                            </div>
                            <button
                                onClick={handleRemoveFile}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#ff6e84]/80 text-white flex items-center justify-center text-xs hover:bg-[#ff6e84] cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                            <p className="text-xs mt-2 text-center flex items-center justify-center gap-1" style={{ color: 'var(--st-accent)' }}>
                                <span className="material-symbols-outlined text-sm material-symbols-filled">check_circle</span>
                                Screenshot selected — review it above
                            </p>
                        </div>
                    )}
                </div>
                </div>

                {/* ── Sticky Proceed Button ── */}
                <div
                    className="p-5 pt-3 shrink-0"
                    style={{
                        borderTop: `1px solid var(--st-divider)`,
                        backgroundColor: isLight ? 'rgba(255,255,255,0.2)' : 'rgba(12,14,23,0.4)',
                    }}
                >
                    <button
                        onClick={handleSubmit}
                        disabled={!file || submitting}
                        className={`w-full py-3 rounded-full font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 border shadow-lg ${
                            isLight
                                ? 'bg-[#0d9488]/10 border-[#0d9488]/30 text-[#0d9488] hover:bg-[#0d9488]/20'
                                : 'bg-[#4af8e3]/10 border-[#4af8e3]/30 text-[#4af8e3] hover:bg-[#4af8e3]/20'
                        }`}
                        style={{
                            backdropFilter: 'blur(24px) saturate(2)',
                            WebkitBackdropFilter: 'blur(24px) saturate(2)',
                            transform: "translateZ(0)", isolation: "isolate"
                        }}
                    >
                        {submitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Sending...
                            </span>
                        ) : (
                            "Proceed — Send for Verification"
                        )}
                    </button>
                    {!file && (
                        <p className="text-xs text-center mt-1.5" style={{ color: 'var(--st-text-muted)' }}>Upload a screenshot to enable proceed</p>
                    )}
                </div>

                {/* ── Fullscreen Image Preview Modal ── */}
                {showPreviewModal && preview && (
                    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col" onClick={() => setShowPreviewModal(false)} style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                        <div className="flex justify-end p-5">
                            <button
                                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-all font-bold"
                                style={{
                                    backgroundColor: 'var(--st-icon-bg)',
                                    color: 'var(--st-text-secondary)',
                                    border: `1px solid var(--st-input-border)`
                                }}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
                            <img src={preview} alt="Fullscreen Preview" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}


// ── Main Dashboard Content ──
function StudentDashboardContent() {
    const { user, refreshUser } = useAuth();
    const { theme } = useStudentTheme();
    const isLight = theme === "light";
    
    // In-Memory Caching for instant load (Shared with Payments History)
    const cacheKey = `student_global_payments_${user?.uid}`;
    const cachedPayments = getCache(cacheKey);
    
    const [payments, setPayments] = useState(cachedPayments || []);
    const [loading, setLoading] = useState(!cachedPayments);
    const [success, setSuccess] = useState("");
    const [previewImg, setPreviewImg] = useState(null);
    const [showBadgeCelebration, setShowBadgeCelebration] = useState(() => 
        !!(user?.badgeAnimationPending && user?.currentBadge)
    );

    // Persist seen approvals across sessions to guarantee the student sees the animation
    const [seenApprovals, setSeenApprovals] = useState(new Set());
    const [seenRejections, setSeenRejections] = useState(new Set());

    const [isVisible, setIsVisible] = useState(document.visibilityState === "visible");

    useEffect(() => {
        const handleVisibilityChange = () => setIsVisible(document.visibilityState === "visible");
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    // Load seen states from localStorage once user.uid is available
    useEffect(() => {
        if (user?.uid) {
            try {
                const sR = localStorage.getItem(`fp_seen_rejections_${user.uid}`);
                const sA = localStorage.getItem(`fp_seen_approvals_${user.uid}`);
                if (sR) setSeenRejections(new Set(JSON.parse(sR)));
                if (sA) setSeenApprovals(new Set(JSON.parse(sA)));
            } catch (e) { console.error("Cache load error", e); }
        }
    }, [user?.uid]);

    // AUTO-SYNC: If a payment's status moves away from terminal (Paid/Rejected), 
    // remove it from seen sets so the student sees the new state.
    useEffect(() => {
        if (!user?.uid || payments.length === 0) return;

        let changedS = false;
        let newSR = new Set(seenRejections);
        let newSA = new Set(seenApprovals);

        payments.forEach(p => {
            if (p.status !== "Rejected" && newSR.has(p.id)) {
                newSR.delete(p.id);
                changedS = true;
            }
            if (p.status !== "Paid" && newSA.has(p.id)) {
                newSA.delete(p.id);
                changedS = true;
            }
        });

        if (changedS) {
            setSeenRejections(newSR);
            localStorage.setItem(`fp_seen_rejections_${user.uid}`, JSON.stringify(Array.from(newSR)));
            setSeenApprovals(newSA);
            localStorage.setItem(`fp_seen_approvals_${user.uid}`, JSON.stringify(Array.from(newSA)));
        }
    }, [payments, user?.uid]);

    // Pay Now modal state
    const [payModalPayment, setPayModalPayment] = useState(null);
    const [payModalUpi, setPayModalUpi] = useState(null);

    const fetchPayments = useCallback(async () => {
        try {
            const data = await api.get("/api/student/payments");
            
            // Optimization: Update state and cache only if data has changed
            const currentCache = getCache(cacheKey);
            if (JSON.stringify(currentCache) !== JSON.stringify(data)) {
                setPayments(data);
                setCache(cacheKey, data);
            }
        } catch (err) {
            if (!isSystemicError(err.message)) {
                // Handled globally for systemic, but we could set error here if needed
            }
        } finally {
            setLoading(false);
        }
    }, [cacheKey]); // Stable dependencies (loading removed)

    useEffect(() => {
        if (user?.uid) {
            fetchPayments();
        }
        const handleOnline = () => {
            if (user?.uid) fetchPayments();
        };
        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, [user?.uid, fetchPayments]);

    // Real-time: auto-refresh when payment status changes in Firestore
    useEffect(() => {
        if (!user?.uid) return;
        let isFirstSnapshot = true; // Skip initial snapshot — fetchPayments() already called on mount
        const q = query(
            collection(db, "payments"),
            where("student_id", "==", user.uid)
        );
        const unsubscribe = onSnapshot(q, () => {
            if (isFirstSnapshot) { isFirstSnapshot = false; return; }
            fetchPayments();
        });
        return () => unsubscribe();
    }, [user?.uid, fetchPayments]);

    // Handle manual dismissal of "Paid" payments
    const handleDismissPaid = useCallback((paymentId) => {
        if (!user?.uid) return;
        setSeenApprovals(prev => {
            const newSet = new Set(prev);
            newSet.add(paymentId);
            localStorage.setItem(`fp_seen_approvals_${user.uid}`, JSON.stringify([...newSet]));
            return newSet;
        });
    }, [user?.uid]);

    // Handle manual dismissal of "Rejected" payments — marks as seen so tracker disappears
    const handleDismissRejected = useCallback(async (paymentId) => {
        if (!user?.uid) return;
        
        setSeenRejections(prev => {
            const newSet = new Set(prev);
            newSet.add(paymentId);
            localStorage.setItem(`fp_seen_rejections_${user.uid}`, JSON.stringify([...newSet]));
            return newSet;
        });

        try {
            await api.post(`/api/student/payments/${paymentId}/acknowledge-rejection`);
            fetchPayments();
        } catch (err) {
            console.error("Failed to acknowledge rejection:", err);
        }
    }, [user?.uid, fetchPayments]);

    // Open Pay Now modal → fetch UPI link
    const openPayModal = async (payment) => {
        setPayModalPayment(payment);
        setPayModalUpi(null);
        try {
            const data = await api.get(`/api/student/upi-link?amount=${payment.amount}&month=${payment.month}&year=${payment.year}`);
            setPayModalUpi(data);
        } catch (err) {
            if (!isSystemicError(err.message)) {
                // Handled globally
            }
        }
    };

    const closePayModal = () => {
        setPayModalPayment(null);
        setPayModalUpi(null);
    };

    const handleProceed = async (paymentId, file) => {
        try {
            const formData = new FormData();
            formData.append("file", file);
            await apiFetch(`/api/student/payments/${paymentId}/upload`, {
                method: "POST",
                body: formData,
            });
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

    const totalDue = payments.filter((p) => p.status === "Unpaid").reduce((s, p) => s + (p.amount || 0), 0);
    const totalPaid = payments.filter((p) => p.status === "Paid").reduce((s, p) => s + (p.amount || 0), 0);
    const actionPayments = payments.filter((p) => 
        p.status === "Unpaid" || 
        p.status === "Pending_Verification" ||
        (p.status === "Paid" && !seenApprovals.has(p.id)) ||
        (p.status === "Rejected" && !seenRejections.has(p.id))
    );
    const paidProgress = totalPaid > 0 && (totalPaid + totalDue) > 0 ? (totalPaid / (totalPaid + totalDue)) * 100 : (totalDue === 0 && totalPaid > 0 ? 100 : 0);

    // Badge celebration trigger (must be before any early returns — Rules of Hooks)
    useEffect(() => {
        console.log("[BADGE_CELEB] user.badgeAnimationPending =", user?.badgeAnimationPending, "| user.currentBadge =", user?.currentBadge, "| showBadgeCelebration =", showBadgeCelebration);
        if (user?.badgeAnimationPending && user?.currentBadge) {
            console.log("[BADGE_CELEB] ✅ Triggering celebration!");
            setShowBadgeCelebration(true);
        }
    }, [user?.badgeAnimationPending, user?.currentBadge]);

    if (loading) {
        return (
            <div>
                <StudentDashboardSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Badge Celebration Overlay */}
            {showBadgeCelebration && user?.currentBadge && (
                <BadgeCelebrationOverlay
                    badgeTier={user.currentBadge}
                    user={user}
                    onComplete={() => {
                        setShowBadgeCelebration(false);
                        refreshUser();
                    }}
                />
            )}
            {/* ── Welcome Section ── */}
            <section className="space-y-1">
                <h1
                    className="text-2xl md:text-3xl font-extrabold tracking-tight"
                    style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}
                >
                    <AnimatedGreeting name={user?.name || "Student"} />
                </h1>
            </section>

            {/* ── Alerts ── */}
            {success && (
                <div
                    className="p-3 rounded-2xl text-sm flex items-center justify-between"
                    style={{
                        backgroundColor: 'var(--st-accent-bg)',
                        borderWidth: 1, borderStyle: 'solid',
                        borderColor: isLight ? 'rgba(13,148,136,0.2)' : 'rgba(74,248,227,0.2)',
                        color: 'var(--st-accent)',
                    }}
                >
                    <span>{success}</span>
                    <button onClick={() => setSuccess("")} className="ml-2 cursor-pointer" style={{ color: 'var(--st-accent)' }}>
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}

            {/* ── Summary Cards ── */}
            <section className="grid grid-cols-1 gap-4">
                {/* Total Paid Card */}
                <div className="glass-card-student rounded-[32px] p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-30 transition-opacity">
                        <span className="material-symbols-outlined text-6xl" style={{ fontVariationSettings: "'FILL' 1", color: 'var(--st-accent)' }}>check_circle</span>
                    </div>
                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined" style={{ color: 'var(--st-accent)' }}>payments</span>
                            <span className="font-medium" style={{ color: 'var(--st-text-secondary)' }}>Total Paid</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>₹{totalPaid.toLocaleString("en-IN")}</span>
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--st-accent)' }}>
                                {totalDue === 0 && totalPaid > 0 ? "Settled" : "Partial"}
                            </span>
                        </div>
                        <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--st-progress-bg)' }}>
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${paidProgress}%`,
                                    background: isLight
                                        ? 'linear-gradient(to right, #0d9488, #3b82f6)'
                                        : 'linear-gradient(to right, #4af8e3, #006a60)',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Due Amount Card */}
                <div className="glass-card-student rounded-[32px] p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-30 transition-opacity">
                        <span className="material-symbols-outlined text-6xl" style={{ color: 'var(--st-text-secondary)' }}>hourglass_empty</span>
                    </div>
                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined" style={{ color: 'var(--st-blue)' }}>info</span>
                            <span className="font-medium" style={{ color: 'var(--st-text-secondary)' }}>Due Amount</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>₹{totalDue.toLocaleString("en-IN")}</span>
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--st-accent)' }}>
                                {totalDue === 0 ? "No Action Needed" : `${actionPayments.filter(p => p.status === "Unpaid").length} Pending`}
                            </span>
                        </div>
                        <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--st-progress-bg)' }}>
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: totalDue > 0 ? "100%" : "0%",
                                    background: 'linear-gradient(to right, #3b82f6, #1e40af)',
                                }}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Action Required Section ── */}
            {actionPayments.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center">
                        <h2 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                            Action Required
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {actionPayments.map((p, idx) => (
                            <div key={p.id}
                                className="glass-card-student rounded-[32px]"
                            >
                                {p.status === "Unpaid" ? (
                                    /* ── Unpaid: Original horizontal layout with Pay Now ── */
                                    <div className="p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                                style={{
                                                    backgroundColor: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(255,110,132,0.1)',
                                                    borderWidth: 1, borderStyle: 'solid',
                                                    borderColor: isLight ? 'rgba(239,68,68,0.15)' : 'rgba(255,110,132,0.2)',
                                                }}
                                            >
                                                <span className="material-symbols-outlined" style={{ color: isLight ? '#ef4444' : '#ff6e84' }}>calendar_today</span>
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                                    {MONTHS[p.month - 1]} {p.year}
                                                </h3>
                                                <span
                                                    className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded"
                                                    style={{
                                                        backgroundColor: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(255,110,132,0.1)',
                                                        color: isLight ? '#ef4444' : '#ff6e84',
                                                    }}
                                                >
                                                    UNPAID
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => openPayModal(p)}
                                            className="px-6 py-2.5 bg-[#3b82f6] text-white rounded-full font-bold text-sm shadow-[0_4px_20px_rgba(59,130,246,0.4)] active:scale-95 transition-transform cursor-pointer whitespace-nowrap"
                                        >
                                            Pay Now
                                        </button>
                                    </div>
                                ) : (
                                    /* ── Pending Verification / Paid / Rejected: Vertical layout with Progress Tracker ── */
                                    <div className="p-5 space-y-3 relative">
                                        {p.status === "Paid" && (
                                            <button
                                                onClick={() => handleDismissPaid(p.id)}
                                                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer z-10"
                                                style={{
                                                    backgroundColor: 'var(--st-icon-bg)',
                                                    borderWidth: 1, borderStyle: 'solid',
                                                    borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)',
                                                    color: 'var(--st-text-secondary)',
                                                }}
                                                title="Dismiss"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        )}
                                        {p.status === "Rejected" && (
                                            <button
                                                onClick={() => handleDismissRejected(p.id)}
                                                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer z-10 active:scale-95"
                                                style={{
                                                    backgroundColor: isLight ? 'rgba(239,68,68,0.1)' : 'rgba(255,107,129,0.12)',
                                                    borderWidth: 1, borderStyle: 'solid',
                                                    borderColor: isLight ? 'rgba(239,68,68,0.25)' : 'rgba(255,107,129,0.25)',
                                                    color: isLight ? '#ef4444' : '#ff6b81',
                                                }}
                                                title="Acknowledge & Dismiss"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">check</span>
                                                <span className="text-[11px] font-semibold">Got it</span>
                                            </button>
                                        )}
                                        <div className="flex items-center gap-3 pr-8">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                style={{
                                                    backgroundColor: p.status === "Rejected"
                                                        ? (isLight ? 'rgba(239,68,68,0.08)' : 'rgba(255,107,129,0.1)')
                                                        : 'var(--st-accent-bg)',
                                                    borderWidth: 1, borderStyle: 'solid',
                                                    borderColor: p.status === "Rejected"
                                                        ? (isLight ? 'rgba(239,68,68,0.15)' : 'rgba(255,107,129,0.2)')
                                                        : (isLight ? 'rgba(13,148,136,0.15)' : 'rgba(74,248,227,0.2)'),
                                                }}
                                            >
                                                <span
                                                    className="material-symbols-outlined text-lg"
                                                    style={{ color: p.status === "Rejected" ? (isLight ? '#ef4444' : '#ff6b81') : 'var(--st-accent)' }}
                                                >
                                                    {p.status === "Rejected" ? "error" : "history"}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                                    {MONTHS[p.month - 1]} {p.year}
                                                </h3>
                                                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: p.status === "Rejected" ? (isLight ? '#ef4444' : '#ff6b84') : 'var(--st-accent)', opacity: 1.0 }}>
                                                    ₹{p.amount?.toLocaleString("en-IN")} • {p.status === "Paid" ? "Approved" : p.status === "Rejected" ? "REJECTED" : "In Progress"}
                                                </span>
                                            </div>
                                        </div>
                                        <PaymentProgressTracker
                                            status={p.status}
                                            mode={p.mode}
                                            month={MONTHS[p.month - 1]}
                                            year={p.year}
                                            paused={showBadgeCelebration}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}



            {/* No payments */}
            {payments.length === 0 && (
                <div className="glass-card-student rounded-[32px] p-8 text-center">
                    <span className="material-symbols-outlined text-5xl mb-3 block" style={{ color: 'var(--st-text-muted)' }}>receipt_long</span>
                    <p className="text-lg font-medium" style={{ color: 'var(--st-text-secondary)' }}>No payment records yet</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--st-text-muted)' }}>Your payment history will appear here</p>
                </div>
            )}

            {/* ── Image Preview Modal ── */}
            {previewImg && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreviewImg(null)}>
                    <div className="relative max-w-2xl max-h-[80vh] mx-4" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setPreviewImg(null)}
                            className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 cursor-pointer z-10">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                        <img src={previewImg} alt="Receipt" className="rounded-2xl max-h-[80vh] object-contain border border-white/10" />
                    </div>
                </div>
            )}

            {/* ── Pay Now Modal ── */}
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

export default function StudentDashboard() {
    return (
        <ProtectedRoute allowedRoles={["student"]}>
            <StudentLayout>
                <StudentDashboardContent />
            </StudentLayout>
        </ProtectedRoute>
    );
}

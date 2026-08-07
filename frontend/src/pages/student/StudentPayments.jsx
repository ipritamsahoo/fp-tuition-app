import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import ProtectedRoute from "@/components/ProtectedRoute";
import StudentLayout from "@/components/StudentLayout";
import PaymentProgressTracker from "@/components/PaymentProgressTracker";
import { api, apiFetch, isSystemicError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useStudentTheme } from "@/context/StudentThemeContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { generateReceiptPDF } from "@/lib/pdfUtils";
import { getCache, setCache } from "@/lib/memoryCache";
import { StudentPaymentsSkeleton } from "@/components/Skeletons";
import { get, del } from "idb-keyval";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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
            text: isLight ? "#0d9488" : "#4af8e3",
            label: "Paid",
        },
        Unpaid: {
            text: isLight ? "#ef4444" : "#ff6e84",
            label: "Unpaid",
        },
        Pending_Verification: {
            text: "#3b82f6",
            label: "Pending",
        },
    };
    const c = config[status] || config.Unpaid;
    return (
        <span
            className="text-[11px] font-extrabold uppercase tracking-wider opacity-90"
            style={{ color: c.text }}
        >
            {c.label}
        </span>
    );
}

// ── Pay Now Modal (Nebula Theme & Batch Multi-Month Support) ──
function PayNowModal({ payment, unpaidPayments = [], onClose, onProceed, initialFile }) {
    const [file, setFile] = useState(initialFile || null);
    const [preview, setPreview] = useState(initialFile ? URL.createObjectURL(initialFile) : null);
    const [submitting, setSubmitting] = useState(false);
    const [upiNotice, setUpiNotice] = useState(payment?.status === "Rejected");
    const [upiAppUnavailable, setUpiAppUnavailable] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    // Checklist state: initialize with all unpaid payments if available, else the clicked payment
    const [selectedIds, setSelectedIds] = useState(() => {
        if (unpaidPayments && unpaidPayments.length > 0) {
            return new Set(unpaidPayments.map(p => p.id));
        }
        return new Set(payment ? [payment.id] : []);
    });
    const [upiData, setUpiData] = useState(null);
    const [loadingUpi, setLoadingUpi] = useState(false);

    // Calculate total amount and selected list dynamically
    const selectedPayments = unpaidPayments.length > 0
        ? unpaidPayments.filter(p => selectedIds.has(p.id))
        : [payment];
    const totalAmount = selectedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const handleToggle = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                if (next.size > 1) {
                    next.delete(id);
                }
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Load UPI data dynamically when total amount changes
    useEffect(() => {
        let active = true;
        const fetchUpi = async () => {
            setLoadingUpi(true);
            try {
                const data = await api.get(`/api/student/upi-link?amount=${totalAmount}`);
                if (active) {
                    setUpiData(data);
                }
            } catch (err) {
                console.error("Failed to fetch UPI link:", err);
            } finally {
                if (active) setLoadingUpi(false);
            }
        };

        fetchUpi();
        return () => { active = false; };
    }, [totalAmount]);

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
            await onProceed(Array.from(selectedIds), file);
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
                            <p className="text-[10px] font-medium tracking-wide flex items-center gap-1" style={{ color: 'var(--st-accent)', marginTop: '2px' }}>
                                <span className="material-symbols-outlined text-[11px] material-symbols-filled">verified</span> 100% SECURE
                            </p>
                        </div>
                        <div className="text-right">
                            <h3 className="font-extrabold text-xl leading-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>₹{totalAmount}</h3>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--st-text-secondary)' }}>
                                {selectedPayments.length === 1 
                                    ? `${FULL_MONTHS[selectedPayments[0].month - 1]} ${selectedPayments[0].year}`
                                    : `${selectedPayments.length} Months`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Scrollable Content ── */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4">

                {unpaidPayments.length > 1 && (
                    <div 
                        className="mb-5 p-4 rounded-2xl border flex flex-col gap-2" 
                        style={{ 
                            borderColor: 'var(--st-divider)', 
                            backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' 
                        }}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-sm" style={{ color: 'var(--st-accent)' }}>event_repeat</span>
                            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--st-text-secondary)' }}>
                                Pay for Multiple Months
                            </label>
                        </div>
                        <div className="space-y-2">
                            {unpaidPayments.map(p => {
                                const isChecked = selectedIds.has(p.id);
                                return (
                                    <label key={p.id} className="flex items-center justify-between p-2 rounded-xl border cursor-pointer select-none transition-colors"
                                        style={{
                                            borderColor: isChecked ? 'var(--st-accent)' : 'var(--st-divider)',
                                            backgroundColor: isChecked 
                                                ? (isLight ? 'rgba(59,130,246,0.05)' : 'rgba(74,248,227,0.03)')
                                                : 'transparent'
                                        }}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <input 
                                                type="checkbox" 
                                                checked={isChecked}
                                                onChange={() => handleToggle(p.id)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                style={{ accentColor: "var(--st-accent)" }}
                                            />
                                            <span className="text-xs font-semibold" style={{ color: 'var(--st-text-primary)' }}>
                                                {FULL_MONTHS[p.month - 1]} {p.year}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold" style={{ color: 'var(--st-text-secondary)' }}>
                                            ₹{p.amount}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                        <p className="text-[10px]" style={{ color: 'var(--st-text-muted)' }}>
                            Check the months you want to pay for. Total amount will update automatically.
                        </p>
                    </div>
                )}

                {/* Divider */}
                <div className="mb-4" style={{ borderTop: `1px solid var(--st-divider)` }} />

                {/* Step 1: Make Payment */}
                <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--st-text-primary)' }}>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ backgroundColor: 'var(--st-blue-bg)', color: 'var(--st-blue)' }}>1</span>
                        Make Payment
                    </p>

                    {loadingUpi ? (
                        <div className="flex items-center justify-center py-6">
                            <div className="w-6 h-6 border-3 border-[#3b82f6]/30 border-t-[#3b82f6] rounded-full animate-spin" />
                            <span className="text-sm ml-3" style={{ color: 'var(--st-text-secondary)' }}>Loading payment info...</span>
                        </div>
                    ) : upiData ? (
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
                    ) : (
                        <div className="text-center py-6 text-xs text-rose-500">
                            Failed to load UPI payment details.
                        </div>
                    )}

                    {isMobile() && upiData && !loadingUpi && (
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
                {showPreviewModal && preview && createPortal(
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowPreviewModal(false)} style={{ touchAction: "none" }}>
                        <div className="relative max-w-2xl w-full max-h-[80vh] flex justify-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setShowPreviewModal(false)}
                                className="absolute -top-10 sm:-top-4 right-1 sm:-right-4 w-10 h-10 rounded-full border flex items-center justify-center cursor-pointer z-10 transition-colors shadow-xl"
                                style={{
                                    backgroundColor: 'var(--st-icon-bg)',
                                    borderColor: 'var(--st-input-border)',
                                    color: 'var(--st-text-primary)'
                                }}
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                            <img src={preview} alt="Fullscreen Preview" className="max-h-[80vh] w-auto max-w-full object-contain block shadow-2xl shadow-black/80" />
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </div>,
        document.body
    );
}

// ── Main Payments Content ──
function StudentPaymentsContent() {
    const { user } = useAuth();
    const { theme } = useStudentTheme();
    const isLight = theme === "light";
    
    // In-Memory Caching for instant load (Shared with Dashboard)
    const cacheKey = `student_global_payments_${user?.uid}`;
    const cachedPayments = getCache(cacheKey);

    const [payments, setPayments] = useState(cachedPayments || []);
    const [loading, setLoading] = useState(!cachedPayments);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [previewImg, setPreviewImg] = useState(null);
    const [sharedFile, setSharedFile] = useState(null);

    // Persist seen approvals across sessions to guarantee the student sees the animation
    const [seenApprovals, setSeenApprovals] = useState(new Set());
    const [seenRejections, setSeenRejections] = useState(new Set());

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
    const [payModalAllowMultiple, setPayModalAllowMultiple] = useState(false);

    // Expandable Receipt History Cards State
    const [expandedReceiptIds, setExpandedReceiptIds] = useState(new Set());
    const toggleExpandReceipt = (id) => {
        setExpandedReceiptIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Pagination State — History shows Paid bills
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 4;
    const paidPayments = payments.filter(p => p.status === "Paid");
    const totalPages = Math.max(1, Math.ceil(paidPayments.length / itemsPerPage));
    const activePage = Math.min(currentPage, totalPages);
    const currentPayments = paidPayments.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [paidPayments.length]);

    const fetchPayments = useCallback(async () => {
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
    }, [cacheKey]);

    useEffect(() => {
        if (user?.uid) {
            fetchPayments();
        }
        const handleOnline = () => { if (user?.uid) fetchPayments(); };
        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, [user?.uid, fetchPayments]);

    // Real-time: auto-refresh when payment status changes in Firestore
    useEffect(() => {
        if (!user?.uid) return;
        let isFirstSnapshot = true;
        const q = query(collection(db, "payments"), where("student_id", "==", user.uid));
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

    // Handle manual dismissal of "Rejected" payments
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

    // Open Pay Now modal
    const openPayModal = (payment) => {
        setPayModalPayment(payment);
        setPayModalAllowMultiple(false);
    };

    const openPayMultipleModal = () => {
        const unpaid = payments.filter((p) => p.status === "Unpaid");
        if (unpaid.length > 0) {
            const sortedUnpaid = [...unpaid].sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.month - b.month;
            });
            setPayModalPayment(sortedUnpaid[0]);
            setPayModalAllowMultiple(true);
        }
    };

    const closePayModal = () => {
        setPayModalPayment(null);
        setPayModalAllowMultiple(false);
    };

    const handleProceed = async (paymentIds, file) => {
        setError("");
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("payment_ids_json", JSON.stringify(paymentIds));
            await apiFetch(`/api/student/payments/batch/upload`, {
                method: "POST",
                body: formData,
            });
            setSuccess("Verification request sent successfully! 🎉");
            closePayModal();
        } catch (err) {
            if (!isSystemicError(err.message)) {
                setError(err.message);
            }
        }
    };

    // Check for shared payment screenshot from PWA Share Target
    useEffect(() => {
        if (loading) return;

        const handleSharedFile = async () => {
            try {
                const file = await get("shared_payment_screenshot");
                if (file) {
                    const unpaid = payments.filter((p) => p.status === "Unpaid");
                    if (unpaid.length > 0) {
                        const sortedUnpaid = [...unpaid].sort((a, b) => {
                            if (a.year !== b.year) return a.year - b.year;
                            return a.month - b.month;
                        });
                        setSharedFile(file);
                        setPayModalPayment(sortedUnpaid[0]);
                        setPayModalAllowMultiple(unpaid.length > 1);
                    } else if (payments.length > 0) {
                        setSharedFile(file);
                        setPayModalPayment(payments[0]);
                        setPayModalAllowMultiple(false);
                    } else {
                        setSharedFile(file);
                        setPayModalPayment({ id: 0, amount: 0, status: "Unpaid", month: new Date().getMonth() + 1, year: new Date().getFullYear() });
                        setPayModalAllowMultiple(false);
                    }
                    await del("shared_payment_screenshot");
                }
            } catch (err) {
                console.error("Failed to check shared screenshot:", err);
            }
        };

        handleSharedFile();
    }, [loading, payments]);

    const totalDue = payments.filter((p) => p.status === "Unpaid").reduce((s, p) => s + (p.amount || 0), 0);
    const totalPaid = payments.filter((p) => p.status === "Paid").reduce((s, p) => s + (p.amount || 0), 0);
    const actionPayments = payments.filter((p) => 
        p.status === "Unpaid" || 
        p.status === "Pending_Verification" ||
        (p.status === "Rejected" && !seenRejections.has(p.id))
    );
    const paidProgress = totalPaid > 0 && (totalPaid + totalDue) > 0 ? (totalPaid / (totalPaid + totalDue)) * 100 : (totalDue === 0 && totalPaid > 0 ? 100 : 0);

    if (loading) {
        return <StudentPaymentsSkeleton />;
    }

    return (
        <div className="space-y-8">
            {/* ── Page Header ── */}
            <div className="mb-6" style={{ transform: "translateZ(0)", isolation: "isolate" }}>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                    Tuition Payments
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--st-text-secondary)' }}>
                    Track fee status, make payments & download receipts
                </p>
            </div>



            {error && (
                <div
                    className="p-3 rounded-2xl text-sm flex items-center justify-between animate-fade-in"
                    style={{
                        backgroundColor: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(255,110,132,0.1)',
                        borderWidth: 1, borderStyle: 'solid',
                        borderColor: isLight ? 'rgba(239,68,68,0.2)' : 'rgba(255,110,132,0.2)',
                        color: isLight ? '#b91c1c' : '#ff9dac',
                    }}
                >
                    <span>{error}</span>
                    <button onClick={() => setError("")} className="ml-2 cursor-pointer" style={{ color: isLight ? '#b91c1c' : '#ff9dac' }}>
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}

            {/* ── Summary Card: Due Amount ── */}
            <section>
                <div
                    className="rounded-[2rem] border p-6 relative overflow-hidden group transition-all duration-500"
                    style={{
                        background: isLight
                            ? "linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.45) 100%)"
                            : "linear-gradient(135deg, rgba(28, 31, 43, 0.8) 0%, rgba(28, 31, 43, 0.4) 100%)",
                        borderColor: isLight
                            ? "rgba(255, 255, 255, 0.55)"
                            : "rgba(255, 255, 255, 0.08)",
                        boxShadow: isLight
                            ? "0 8px 32px 0 rgba(0, 0, 0, 0.06), 0 2px 8px 0 rgba(0, 0, 0, 0.03), inset 0 1px 0 0 rgba(255, 255, 255, 0.7)"
                            : "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
                        backdropFilter: "blur(24px) saturate(160%)",
                        WebkitBackdropFilter: "blur(24px) saturate(160%)",
                    }}
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#3b82f6]/10 blur-[80px] -mr-32 -mt-32 group-hover:bg-[#3b82f6]/20 transition-all duration-700 pointer-events-none" />
                    <p
                        className="text-xs font-bold uppercase tracking-[0.2em] mb-4 opacity-80"
                        style={{ color: isLight ? '#6b7280' : 'var(--st-text-secondary)' }}
                    >
                        DUE AMOUNT
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold" style={{ color: isLight ? '#0d9488' : '#3b82f6' }}>₹</span>
                        <span
                            className="font-extrabold text-5xl md:text-6xl tracking-tight drop-shadow-2xl"
                            style={{ fontFamily: "'Manrope', sans-serif", color: isLight ? '#1a1a2e' : 'var(--st-text-primary)' }}
                        >
                            {totalDue.toLocaleString("en-IN")}
                        </span>
                    </div>
                </div>
            </section>

            {/* ── Action Required Section ── */}
            {actionPayments.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-xl md:text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                            Action Required
                        </h2>
                        {payments.filter((p) => p.status === "Unpaid").length > 0 && (
                            <button
                                onClick={openPayMultipleModal}
                                className="px-6 py-3.5 sm:px-8 sm:py-4 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-full font-extrabold text-xs sm:text-sm shadow-[0_4px_20px_rgba(59,130,246,0.4)] transition-all active:scale-95 cursor-pointer uppercase tracking-wider min-h-[46px] sm:min-h-[50px] flex items-center justify-center"
                                style={{ fontFamily: "'Inter', sans-serif" }}
                            >
                                Pay Now
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {actionPayments.map((p) => (
                            <div key={p.id} className="glass-card-student rounded-[32px]">
                                {p.status === "Unpaid" ? (
                                    /* ── Unpaid: Clean layout ── */
                                    <div className="p-5 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--st-text-secondary)' }}>BILLING CYCLE</span>
                                            <h3 className="text-xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                                {MONTHS[p.month - 1]} {p.year}
                                            </h3>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className="text-xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                                ₹{p.amount?.toLocaleString("en-IN")}
                                            </span>
                                            <StatusBadge status={p.status} />
                                        </div>
                                    </div>
                                ) : (
                                    /* ── Pending Verification / Paid / Rejected: Progress Tracker ── */
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
                                        <div className="flex items-center justify-between pr-2">
                                            <div>
                                                <span className="block text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--st-text-secondary)' }}>BILLING CYCLE</span>
                                                <h3 className="text-lg font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                                    {MONTHS[p.month - 1]} {p.year}
                                                </h3>
                                                {p.status !== "Pending_Verification" && (
                                                    <span className="block mt-0.5 text-xs sm:text-sm font-extrabold tracking-wide" style={{ fontFamily: "'Manrope', sans-serif", color: p.status === "Rejected" ? (isLight ? '#ef4444' : '#ff6b84') : 'var(--st-accent)' }}>
                                                        ₹{p.amount?.toLocaleString("en-IN")}
                                                    </span>
                                                )}
                                            </div>
                                            {p.status === "Pending_Verification" && (
                                                <span className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                                    ₹{p.amount?.toLocaleString("en-IN")}
                                                </span>
                                            )}
                                        </div>
                                        <PaymentProgressTracker
                                            status={p.status}
                                            mode={p.mode}
                                            month={MONTHS[p.month - 1]}
                                            year={p.year}
                                            requestedAt={p.requested_at || p.created_at || p.timestamp}
                                            updatedAt={p.updated_at}
                                            rejectedAt={p.rejected_at || p.updated_at}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Payment History & Receipts Section ── */}
            <section className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl md:text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                        Payment History & Receipts
                    </h2>
                </div>

                <div className="space-y-4">
                    {currentPayments.map((p) => {
                        const isExpanded = expandedReceiptIds.has(p.id);
                        return (
                            <div key={p.id} className="glass-card-student p-5 rounded-[32px] flex flex-col gap-3 transition-all duration-300">
                                {/* Top row: Billing info + Amount + Status + Expand Arrow */}
                                <div
                                    className="flex justify-between items-center cursor-pointer select-none"
                                    onClick={() => toggleExpandReceipt(p.id)}
                                >
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--st-text-secondary)' }}>Billing Cycle</span>
                                        <h3 className="text-lg font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                            {MONTHS[p.month - 1]} {p.year}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--st-text-primary)' }}>
                                                ₹{p.amount?.toLocaleString("en-IN")}
                                            </span>
                                            <StatusBadge status={p.status} />
                                        </div>
                                        <button
                                            type="button"
                                            className="w-9 h-9 rounded-full flex items-center justify-center border transition-transform duration-300 cursor-pointer shrink-0"
                                            style={{
                                                backgroundColor: 'var(--st-icon-bg)',
                                                borderColor: 'var(--st-input-border)',
                                                color: 'var(--st-text-primary)',
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                            }}
                                            title={isExpanded ? "Collapse" : "Expand"}
                                        >
                                            <span className="material-symbols-outlined text-lg">expand_more</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Expandable Section: Progress Tracker with inline Download Receipt */}
                                {isExpanded && (
                                    <div className="pt-3 border-t animate-fade-in" style={{ borderColor: 'var(--st-divider)' }}>
                                        <PaymentProgressTracker
                                            status={p.status}
                                            mode={p.mode}
                                            month={MONTHS[p.month - 1]}
                                            year={p.year}
                                            requestedAt={p.requested_at || p.created_at || p.timestamp}
                                            updatedAt={p.updated_at}
                                            rejectedAt={p.rejected_at || p.updated_at}
                                            actionSlot={
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        generateReceiptPDF(p, user);
                                                    }}
                                                    className="flex items-center gap-2 py-2 px-4 rounded-xl backdrop-blur-xl transition-all active:scale-[0.98] cursor-pointer font-bold text-xs shadow-sm"
                                                    style={{
                                                        backgroundColor: 'var(--st-icon-bg)',
                                                        border: `1px solid var(--st-input-border)`,
                                                        color: 'var(--st-text-primary)',
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined text-base">description</span>
                                                    <span>Download Receipt</span>
                                                </button>
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {paidPayments.length === 0 && (
                        <div className="glass-card-student rounded-[32px] p-8 text-center md:col-span-2">
                            <span className="material-symbols-outlined text-4xl mb-2 block" style={{ color: 'var(--st-text-muted)' }}>receipt_long</span>
                            <p className="text-base font-medium" style={{ color: 'var(--st-text-secondary)' }}>No payment history yet</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--st-text-muted)' }}>Completed payments will appear here once verified</p>
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6 pb-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={activePage === 1}
                            className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                            style={{
                                backgroundColor: 'var(--st-icon-bg)',
                                borderColor: 'var(--st-input-border)',
                                color: 'var(--st-text-primary)'
                            }}
                        >
                            <span className="material-symbols-outlined text-lg">chevron_left</span>
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((item) => {
                            const isActive = activePage === item;
                            return (
                                <button
                                    key={item}
                                    onClick={() => setCurrentPage(item)}
                                    className="w-10 h-10 rounded-xl font-bold text-sm transition-all cursor-pointer active:scale-95"
                                    style={{
                                        backgroundColor: isActive ? (isLight ? '#0d9488' : '#3b82f6') : 'var(--st-icon-bg)',
                                        color: isActive ? '#ffffff' : 'var(--st-text-primary)',
                                        border: isActive ? `1px solid ${isLight ? '#0d9488' : '#3b82f6'}` : '1px solid var(--st-input-border)',
                                        boxShadow: isActive ? (isLight ? '0 4px 12px rgba(13,148,136,0.3)' : '0 4px 12px rgba(59,130,246,0.3)') : 'none'
                                    }}
                                >
                                    {item}
                                </button>
                            );
                        })}

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={activePage === totalPages}
                            className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                            style={{
                                backgroundColor: 'var(--st-icon-bg)',
                                borderColor: 'var(--st-input-border)',
                                color: 'var(--st-text-primary)'
                            }}
                        >
                            <span className="material-symbols-outlined text-lg">chevron_right</span>
                        </button>
                    </div>
                )}
            </section>

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
                    unpaidPayments={payModalAllowMultiple ? payments.filter((p) => p.status === "Unpaid") : []}
                    initialFile={sharedFile}
                    onClose={() => {
                        closePayModal();
                        setSharedFile(null);
                    }}
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

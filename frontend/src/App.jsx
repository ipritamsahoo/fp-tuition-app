import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ErrorProvider } from "@/context/ErrorContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { BiometricProvider } from "@/context/BiometricContext";
import OfflineIndicator from "@/components/OfflineIndicator";
import GlobalErrorModal from "@/components/GlobalErrorModal";
import PwaUpdateBanner from "@/components/PwaUpdateBanner";
import BiometricLockScreen from "@/components/BiometricLockScreen";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import WelcomePage from "@/pages/WelcomePage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminApprovals from "@/pages/admin/AdminApprovals";
import ManageStudents from "@/pages/admin/ManageStudents";
import ManageTeachers from "@/pages/admin/ManageTeachers";
import ManageBatches from "@/pages/admin/ManageBatches";
import AllPayments from "@/pages/admin/AllPayments";
import RevenueDistribution from "@/pages/admin/RevenueDistribution";
import ReportExport from "@/pages/admin/ReportExport";
import AdminProfile from "@/pages/admin/AdminProfile";
import StudentDashboard from "@/pages/student/StudentDashboard";
import StudentPayments from "@/pages/student/StudentPayments";
import StudentLeaderboard from "@/pages/student/StudentLeaderboard";
import StudentSettings from "@/pages/student/StudentSettings";
import TeacherDashboard from "@/pages/teacher/TeacherDashboard";
import TeacherPayments from "@/pages/teacher/TeacherPayments";
import TeacherDistribution from "@/pages/teacher/TeacherDistribution";
import TeacherSettings from "@/pages/teacher/TeacherSettings";
import TeacherNotes from "@/pages/teacher/TeacherNotes";
import StudentNotes from "@/pages/student/StudentNotes";
import TeacherNotices from "@/pages/teacher/TeacherNotices";
import StudentNotices from "@/pages/student/StudentNotices";
import NotificationsPage from "@/pages/NotificationsPage";
import AboutPage from "@/pages/AboutPage";
import FeedbackPage from "@/pages/FeedbackPage";
import ScrollToTop from "@/components/ScrollToTop";

/**
 * BiometricGate: reads the logged-in userId from AuthContext and provides
 * BiometricProvider with the correct userId so credentials are user-specific.
 */
function BiometricGate({ children }) {
    const { user } = useAuth();
    return (
        <BiometricProvider key={user?.uid || "anonymous"} userId={user?.uid || null}>
            {children}
        </BiometricProvider>
    );
}

export default function App() {
    const [pwaModal, setPwaModal] = useState({ 
        show: false, 
        mode: "update", 
        currentVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.2.0',
        newVersion: ""
    });

    useEffect(() => {
        const handleUpdateAvailable = async () => {
            console.log("PWA Update event received in React.");
            
            // Try to fetch version from waiting worker
            let newVer = "";
            if ("serviceWorker" in navigator) {
                try {
                    const reg = await navigator.serviceWorker.getRegistration();
                    if (reg && reg.waiting) {
                        newVer = await new Promise((resolve) => {
                            const channel = new MessageChannel();
                            channel.port1.onmessage = (event) => {
                                resolve(event.data.version);
                            };
                            reg.waiting.postMessage({ type: "GET_VERSION" }, [channel.port2]);
                            setTimeout(() => resolve(""), 800);
                        });
                    }
                } catch (e) {
                    console.warn("Could not get waiting worker version:", e);
                }
            }

            const currentVer = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.2.0';

            // Guard: if the waiting SW is the same version already running,
            // it's a stale waiting state (e.g. just after silent activation).
            // Don't show the banner — silently skip it.
            if (newVer && newVer !== "Unknown" && newVer === currentVer) {
                console.log("[PWA] Waiting SW is same version as current — skipping banner.");
                return;
            }

            setPwaModal({ 
                show: true, 
                mode: "update", 
                currentVersion: currentVer,
                newVersion: newVer || "New Version"
            });
        };

        const handleUpToDate = () => {
            console.log("PWA Up To Date event received in React.");
            setPwaModal({ 
                show: true, 
                mode: "up_to_date", 
                currentVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.2.0',
                newVersion: ""
            });
        };

        window.addEventListener("pwa-update-available", handleUpdateAvailable);
        window.addEventListener("pwa-up-to-date", handleUpToDate);

        // Step 5: Force Page Reload on controllerchange
        const handleControllerChange = () => {
            console.log("PWA controller changed. Reloading page.");
            window.location.reload();
        };

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
        }

        return () => {
            window.removeEventListener("pwa-update-available", handleUpdateAvailable);
            window.removeEventListener("pwa-up-to-date", handleUpToDate);
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
            }
        };
    }, []);

    // Step 4: Send the Skip Waiting Message
    const handleUpdateClick = async () => {
        if ("serviceWorker" in navigator) {
            try {
                // First try the registration controlling this page
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg && reg.waiting) {
                    console.log("Sending SKIP_WAITING to controlling registration's waiting worker.");
                    reg.waiting.postMessage({ type: "SKIP_WAITING" });
                    return;
                }

                // Fallback: search all registrations on this origin
                console.log("Checking all registrations for waiting worker...");
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const r of registrations) {
                    if (r.waiting) {
                        console.log("Sending SKIP_WAITING to waiting worker in list.");
                        r.waiting.postMessage({ type: "SKIP_WAITING" });
                    }
                }
            } catch (err) {
                console.error("Error sending skip waiting message:", err);
            }
        }
    };

    return (
        <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
                <ErrorProvider>
                    <NotificationProvider>
                        <BiometricGate>
                            <OfflineIndicator />
                            <GlobalErrorModal />
                            <PwaUpdateBanner 
                                show={pwaModal.show} 
                                mode={pwaModal.mode} 
                                currentVersion={pwaModal.currentVersion}
                                newVersion={pwaModal.newVersion}
                                onUpdate={handleUpdateClick} 
                                onClose={() => setPwaModal({ ...pwaModal, show: false })} 
                            />
                            <BiometricLockScreen />
                            <Routes>
                                <Route path="/" element={<HomePage />} />
                                <Route path="/welcome" element={<WelcomePage />} />
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/admin" element={<AdminDashboard />} />
                                <Route path="/admin/approvals" element={<AdminApprovals />} />
                                <Route path="/admin/students" element={<ManageStudents />} />
                                <Route path="/admin/teachers" element={<ManageTeachers />} />
                                <Route path="/admin/batches" element={<ManageBatches />} />
                                <Route path="/admin/payments" element={<AllPayments />} />
                                <Route path="/admin/distribution" element={<RevenueDistribution />} />
                                <Route path="/admin/reports" element={<ReportExport />} />
                                <Route path="/admin/profile" element={<AdminProfile />} />
                                <Route path="/student" element={<StudentDashboard />} />
                                <Route path="/student/payments" element={<StudentPayments />} />
                                <Route path="/student/leaderboard" element={<StudentLeaderboard />} />
                                <Route path="/student/notes" element={<StudentNotes />} />
                                <Route path="/student/notices" element={<StudentNotices />} />
                                <Route path="/student/settings" element={<StudentSettings />} />
                                <Route path="/teacher" element={<TeacherDashboard />} />
                                <Route path="/teacher/payments" element={<TeacherPayments />} />
                                <Route path="/teacher/distribution" element={<TeacherDistribution />} />
                                <Route path="/teacher/notes" element={<TeacherNotes />} />
                                <Route path="/teacher/notices" element={<TeacherNotices />} />
                                <Route path="/teacher/settings" element={<TeacherSettings />} />
                                <Route path="/notifications" element={<NotificationsPage />} />
                                <Route path="/about" element={<AboutPage />} />
                                <Route path="/feedback" element={<FeedbackPage />} />
                            </Routes>
                        </BiometricGate>
                    </NotificationProvider>
                </ErrorProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

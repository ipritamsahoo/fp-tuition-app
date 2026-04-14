import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorProvider } from "@/context/ErrorContext";
import { NotificationProvider } from "@/context/NotificationContext";
import OfflineIndicator from "@/components/OfflineIndicator";
import GlobalErrorModal from "@/components/GlobalErrorModal";
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
import NotificationsPage from "@/pages/NotificationsPage";
import AboutPage from "@/pages/AboutPage";
import FeedbackPage from "@/pages/FeedbackPage";
import ScrollToTop from "@/components/ScrollToTop";

export default function App() {
    return (
        <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
                <ErrorProvider>
                    <NotificationProvider>
                        <OfflineIndicator />
                        <GlobalErrorModal />
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
                            <Route path="/student/settings" element={<StudentSettings />} />
                            <Route path="/teacher" element={<TeacherDashboard />} />
                            <Route path="/teacher/payments" element={<TeacherPayments />} />
                            <Route path="/teacher/distribution" element={<TeacherDistribution />} />
                            <Route path="/teacher/settings" element={<TeacherSettings />} />
                            <Route path="/notifications" element={<NotificationsPage />} />
                            <Route path="/about" element={<AboutPage />} />
                            <Route path="/feedback" element={<FeedbackPage />} />
                        </Routes>
                    </NotificationProvider>
                </ErrorProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

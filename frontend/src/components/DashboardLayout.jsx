import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";

export default function DashboardLayout({ children }) {
    return (
        <div className="min-h-screen bg-[#0a0a12]">
            <Sidebar />
            <main className="md:ml-64 min-h-screen flex flex-col">
                <TopHeader />
                {/* pt-16 for mobile top bar (Sidebar), pb-20 for mobile bottom nav */}
                <div className="px-4 pt-16 pb-20 md:px-8 md:pt-2 md:pb-8 max-w-7xl w-full mx-auto flex-1">
                    {children}
                </div>
            </main>
        </div>
    );
}

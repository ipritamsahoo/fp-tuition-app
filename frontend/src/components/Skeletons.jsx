import { useStudentTheme } from "@/context/StudentThemeContext";

export function StudentDashboardSkeleton() {
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    const baseBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)';
    const pulseBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)';

    return (
        <div className="space-y-8 animate-pulse">
            {/* Welcome Section Skeleton */}
            <section className="space-y-2">
                <div className="h-8 w-48 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                <div className="h-4 w-32 rounded-lg" style={{ backgroundColor: baseBg }}></div>
            </section>

            {/* Summary Cards Skeleton */}
            <section className="grid grid-cols-1 gap-4">
                {/* Skeleton Card 1 */}
                <div className="glass-card-student rounded-[32px] p-6 relative overflow-hidden">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                            <div className="h-4 w-24 rounded-lg" style={{ backgroundColor: baseBg }}></div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div className="h-8 w-32 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                            <div className="h-3 w-16 rounded-lg" style={{ backgroundColor: baseBg }}></div>
                        </div>
                        <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: baseBg }}></div>
                    </div>
                </div>

                {/* Skeleton Card 2 */}
                <div className="glass-card-student rounded-[32px] p-6 relative overflow-hidden">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                            <div className="h-4 w-28 rounded-lg" style={{ backgroundColor: baseBg }}></div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div className="h-8 w-28 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                            <div className="h-3 w-20 rounded-lg" style={{ backgroundColor: baseBg }}></div>
                        </div>
                        <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: baseBg }}></div>
                    </div>
                </div>
            </section>

            {/* Action Required Section Skeleton */}
            <section className="space-y-4">
                <div className="h-8 w-40 rounded-lg" style={{ backgroundColor: pulseBg }}></div>

                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="glass-card-student rounded-[32px] p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl" style={{ backgroundColor: pulseBg }}></div>
                                <div className="space-y-2">
                                    <div className="h-5 w-24 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                                    <div className="h-3 w-16 rounded-lg" style={{ backgroundColor: baseBg }}></div>
                                </div>
                            </div>
                            <div className="w-24 h-10 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

export function TeacherDashboardSkeleton() {
    // Teacher panel is primarily dark themed, but we use the same base/pulse classes 
    // depending on context if needed. Here we stick to the dark theme styling used in Teacher panel.
    const baseBg = 'rgba(255,255,255,0.05)';
    const pulseBg = 'rgba(255,255,255,0.1)';

    return (
        <div className="space-y-6 animate-pulse">
            {/* Welcome Section Skeleton */}
            <section className="space-y-2">
                <div className="h-8 w-48 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
            </section>

            {/* Filters Skeleton */}
            <section>
                <div
                    className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-5 w-full"
                    style={{ transform: "translateZ(0)", isolation: "isolate" }}
                >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                        <div className="col-span-2 md:order-3 md:col-span-2 h-[46px] rounded-full" style={{ backgroundColor: pulseBg }}></div>
                        <div className="col-span-1 md:order-1 h-[46px] rounded-full" style={{ backgroundColor: pulseBg }}></div>
                        <div className="col-span-1 md:order-2 h-[46px] rounded-full" style={{ backgroundColor: pulseBg }}></div>
                    </div>
                </div>
            </section>

            {/* Summary Cards Skeleton */}
            <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Total Students - Full width on mobile, 1 col on desktop */}
                <div className="col-span-2 md:col-span-1 rounded-[28px] border border-white/[0.07] p-6 relative overflow-hidden"
                     style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="h-3 w-24 rounded mb-2" style={{ backgroundColor: baseBg }}></div>
                            <div className="h-10 w-16 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                        </div>
                        <div className="w-12 h-12 rounded-xl" style={{ backgroundColor: pulseBg }}></div>
                    </div>
                </div>

                {/* Paid */}
                <div className="col-span-1 rounded-[28px] border border-white/[0.07] p-6"
                     style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="h-3 w-16 rounded mb-2" style={{ backgroundColor: baseBg }}></div>
                            <div className="h-10 w-12 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                        </div>
                        <div className="w-12 h-12 rounded-xl" style={{ backgroundColor: pulseBg }}></div>
                    </div>
                </div>

                {/* Unpaid */}
                <div className="col-span-1 rounded-[28px] border border-white/[0.07] p-6"
                     style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="h-3 w-16 rounded mb-2" style={{ backgroundColor: baseBg }}></div>
                            <div className="h-10 w-12 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                        </div>
                        <div className="w-12 h-12 rounded-xl" style={{ backgroundColor: pulseBg }}></div>
                    </div>
                </div>
            </section>

            {/* Select Batch Empty State Skeleton */}
            <section className="mt-8">
                <div className="rounded-[28px] border border-white/[0.07] p-16 flex flex-col items-center justify-center text-center gap-4"
                     style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                    <div className="w-12 h-12 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                    <div className="h-6 w-32 rounded" style={{ backgroundColor: pulseBg }}></div>
                    <div className="h-4 w-48 rounded animate-pulse" style={{ backgroundColor: baseBg }}></div>
                </div>
            </section>
        </div>
    );
}

export function TeacherPaymentsListSkeleton() {
    const baseBg = 'rgba(255,255,255,0.05)';
    const pulseBg = 'rgba(255,255,255,0.1)';

    return (
        <div className="space-y-3 animate-pulse">
            <div className="h-6 w-32 rounded mb-4" style={{ backgroundColor: baseBg }}></div>
            {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-[28px] border border-white/[0.07] p-4 flex items-center gap-4"
                     style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                    <div className="w-12 h-12 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                    <div className="flex-1 space-y-2">
                         <div className="h-4 w-32 rounded" style={{ backgroundColor: pulseBg }}></div>
                         <div className="h-3 w-16 rounded" style={{ backgroundColor: baseBg }}></div>
                    </div>
                    <div className="w-16 h-6 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                </div>
            ))}
        </div>
    );
}

export function TableSkeleton() {
    const baseBg = 'rgba(255,255,255,0.05)';
    const pulseBg = 'rgba(255,255,255,0.1)';

    return (
        <div className="overflow-x-auto custom-scrollbar animate-pulse">
            <table className="w-full border-collapse min-w-[560px]">
                <thead className="bg-[#0c0e17]/80 backdrop-blur-xl">
                    <tr className="border-b border-[#464752]/40">
                        <th className="px-5 py-3.5 text-left border-r border-[#464752]/40 w-0 sticky left-0 bg-[#0c0e17]/80 backdrop-blur-md z-30 shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                            <div className="h-3 w-24 rounded" style={{ backgroundColor: baseBg }}></div>
                        </th>
                        <th className="px-5 py-3.5 border-r border-[#464752]/40">
                            <div className="h-3 w-16 mx-auto rounded" style={{ backgroundColor: baseBg }}></div>
                        </th>
                        <th className="px-5 py-3.5 border-r border-[#464752]/40">
                            <div className="h-3 w-20 mx-auto rounded" style={{ backgroundColor: baseBg }}></div>
                        </th>
                        <th className="px-5 py-3.5 border-r border-[#464752]/40">
                            <div className="h-3 w-16 mx-auto rounded" style={{ backgroundColor: baseBg }}></div>
                        </th>
                        <th className="px-5 py-3.5">
                            <div className="h-3 w-24 mx-auto rounded" style={{ backgroundColor: baseBg }}></div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={i} className="border-b border-[#464752]/20 last:border-0">
                            <td className="px-5 py-4 border-r border-[#464752]/40 sticky left-0 bg-[#171924]/60 backdrop-blur-md z-10 shadow-[4px_0_10px_rgba(0,0,0,0.15)]">
                                <div className="h-4 w-32 rounded" style={{ backgroundColor: pulseBg }}></div>
                            </td>
                            <td className="px-5 py-4 border-r border-[#464752]/40 text-center">
                                <div className="h-6 w-16 mx-auto rounded-full" style={{ backgroundColor: pulseBg }}></div>
                            </td>
                            <td className="px-5 py-4 border-r border-[#464752]/40 text-center">
                                <div className="h-6 w-20 mx-auto rounded-full" style={{ backgroundColor: pulseBg }}></div>
                            </td>
                            <td className="px-5 py-4 border-r border-[#464752]/40 text-center">
                                <div className="h-6 w-16 mx-auto rounded-full" style={{ backgroundColor: pulseBg }}></div>
                            </td>
                            <td className="px-5 py-4 text-center">
                                <div className="h-6 w-24 mx-auto rounded-full" style={{ backgroundColor: pulseBg }}></div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function TeacherDistributionSkeleton() {
    const baseBg = 'rgba(255,255,255,0.05)';
    const pulseBg = 'rgba(255,255,255,0.1)';

    return (
        <div className="space-y-6 animate-pulse">
            {/* Bento Grid Skeleton */}
            <section className="grid grid-cols-2 gap-4">
                {/* Cumulative Earnings */}
                <div className="col-span-2 rounded-[2rem] border border-white/[0.08] p-6"
                     style={{ background: "rgba(23, 25, 36, 0.4)", backdropFilter: "blur(24px)" }}>
                    <div className="h-3 w-36 rounded mb-4" style={{ backgroundColor: baseBg }}></div>
                    <div className="h-12 w-48 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                </div>
                {/* Total Distributed */}
                <div className="col-span-1 rounded-[2rem] border border-white/[0.08] p-5"
                     style={{ background: "rgba(23, 25, 36, 0.4)", backdropFilter: "blur(24px)" }}>
                    <div className="h-2.5 w-24 rounded mb-3" style={{ backgroundColor: baseBg }}></div>
                    <div className="h-7 w-20 rounded" style={{ backgroundColor: pulseBg }}></div>
                    <div className="w-8 h-1 rounded-full bg-white/5 mt-3" />
                </div>
                {/* Teachers Shared */}
                <div className="col-span-1 rounded-[2rem] border border-white/[0.08] p-5"
                     style={{ background: "rgba(23, 25, 36, 0.4)", backdropFilter: "blur(24px)" }}>
                    <div className="h-2.5 w-24 rounded mb-3" style={{ backgroundColor: baseBg }}></div>
                    <div className="h-7 w-12 rounded" style={{ backgroundColor: pulseBg }}></div>
                    <div className="w-8 h-1 rounded-full bg-white/5 mt-3" />
                </div>
            </section>

            {/* Tab Bar Skeleton */}
            <div className="h-[60px] rounded-[1.25rem] border border-[#464752]/40"
                 style={{ background: "rgba(23, 25, 36, 0.4)" }} />

            {/* List Header Skeleton */}
            <div className="h-6 w-36 rounded mb-4" style={{ backgroundColor: baseBg }}></div>

            {/* Distribution History list */}
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-3xl border border-white/[0.07] p-4 sm:p-6 flex items-center justify-between gap-4"
                         style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                        <div className="flex items-center gap-3 md:gap-4 flex-1">
                            <div className="w-12 h-12 rounded-xl" style={{ backgroundColor: pulseBg }}></div>
                            <div className="space-y-2">
                                <div className="h-4 w-32 rounded" style={{ backgroundColor: pulseBg }}></div>
                                <div className="h-3 w-16 rounded" style={{ backgroundColor: baseBg }}></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-20 h-8 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                            <div className="w-16 h-8 rounded-xl" style={{ backgroundColor: baseBg }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function TeacherNotesSkeleton() {
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
                    className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-3"
                >
                    {/* Header: Icon & Title */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Icon placeholder */}
                            <div className="w-10 h-10 rounded-xl bg-white/5 shrink-0" />
                            
                            {/* Text placeholder */}
                            <div className="flex-1 min-w-0">
                                <div className={`h-[14px] bg-white/5 rounded-md ${style.title}`} />
                            </div>
                        </div>
                    </div>

                    {/* Footer: Date & Actions */}
                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                        {/* Date placeholder */}
                        <div className="flex-1 min-w-0">
                            <div className={`h-[10px] bg-white/5 rounded-md ${style.meta}`} />
                        </div>

                        {/* Actions placeholder */}
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="w-9 h-9 rounded-xl bg-white/5" />
                            <div className="w-9 h-9 rounded-xl bg-[#ff6e84]/5" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function TeacherNotesPageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Title Header Skeleton */}
            <div className="flex flex-col gap-4">
                <div className="h-8 bg-white/5 rounded-lg w-[200px]" />
                
                {/* Batch Selector Placeholder */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                    <div className="lg:col-span-5 w-full">
                        <div className="h-[46px] bg-white/5 border border-white/5 rounded-2xl w-full" />
                    </div>
                </div>
            </div>

            {/* Main Layout Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left side: Upload Form Skeleton */}
                <div className="lg:col-span-5">
                    <div className="rounded-[28px] border border-white/[0.07] p-6 space-y-5 border border-white/[0.03] min-h-[400px]"
                         style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
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
                    </div>
                </div>

                {/* Right side: Shared Notes List Skeleton */}
                <div className="lg:col-span-7">
                    <div className="rounded-[28px] border border-white/[0.07] p-6 min-h-[400px] flex flex-col border border-white/[0.03] space-y-4"
                         style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="h-6 bg-white/5 rounded-md w-1/3" />
                        </div>
                        
                        {/* Nested list skeleton */}
                        <TeacherNotesSkeleton />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function GenericListSkeleton() {
    const baseBg = 'rgba(128,128,128,0.1)';
    const pulseBg = 'rgba(128,128,128,0.2)';

    return (
        <div className="space-y-4 animate-pulse mt-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-white/[0.05] p-5 flex items-center justify-between"
                     style={{ background: "rgba(128, 128, 128, 0.05)", backdropFilter: "blur(10px)" }}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                        <div className="space-y-2">
                             <div className="h-4 w-32 rounded" style={{ backgroundColor: pulseBg }}></div>
                             <div className="h-3 w-20 rounded" style={{ backgroundColor: baseBg }}></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function TeacherPaymentsPageSkeleton() {
    const baseBg = 'rgba(255,255,255,0.05)';
    const pulseBg = 'rgba(255,255,255,0.1)';

    return (
        <div className="space-y-6 animate-pulse">
            {/* Header */}
            <div>
                <div className="h-8 w-40 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
            </div>

            {/* Filters */}
            <div
                className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-5"
            >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                    <div className="col-span-2 md:order-3 md:col-span-2 h-[46px] rounded-full" style={{ backgroundColor: pulseBg }}></div>
                    <div className="col-span-1 md:order-1 h-[46px] rounded-full" style={{ backgroundColor: pulseBg }}></div>
                    <div className="col-span-1 md:order-2 h-[46px] rounded-full" style={{ backgroundColor: pulseBg }}></div>
                </div>
            </div>

            {/* Table Container */}
            <div
                className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-3xl overflow-hidden shadow-xl"
            >
                <TableSkeleton />
            </div>
        </div>
    );
}

export function TeacherDistributionPageSkeleton() {
    const baseBg = 'rgba(255,255,255,0.05)';
    const pulseBg = 'rgba(255,255,255,0.1)';

    return (
        <div className="space-y-6 animate-pulse">
            {/* Title Header */}
            <div>
                <div className="h-8 w-44 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
            </div>

            {/* Filters */}
            <div
                className="bg-[#171924]/60 backdrop-blur-[20px] border border-[#737580]/10 rounded-[2rem] p-5 w-full"
            >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                    <div className="col-span-2 md:order-3 md:col-span-2 h-[46px] rounded-full" style={{ backgroundColor: pulseBg }}></div>
                    <div className="col-span-1 md:order-1 h-[46px] rounded-full" style={{ backgroundColor: pulseBg }}></div>
                    <div className="col-span-1 md:order-2 h-[46px] rounded-full" style={{ backgroundColor: pulseBg }}></div>
                </div>
            </div>

            {/* Select Batch Empty Card Skeleton */}
            <div className="rounded-[2rem] border border-white/[0.08] p-12 flex flex-col items-center justify-center text-center gap-4"
                 style={{ background: "rgba(23, 25, 36, 0.4)", backdropFilter: "blur(24px)" }}>
                <div className="w-16 h-16 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                <div className="h-6 w-36 rounded" style={{ backgroundColor: pulseBg }}></div>
                <div className="h-4 w-64 rounded animate-pulse" style={{ backgroundColor: baseBg }}></div>
            </div>
        </div>
    );
}

export function TeacherNoticesSkeleton() {
    const baseBg = 'rgba(255,255,255,0.05)';
    const pulseBg = 'rgba(255,255,255,0.1)';

    const noticeCardStyles = [
        { width1: "w-[40%]", width2: "w-[85%]", width3: "w-[60%]" },
        { width1: "w-[30%]", width2: "w-[90%]", width3: "w-[40%]" },
        { width1: "w-[35%]", width2: "w-[75%]", width3: "w-[50%]" },
    ];

    return (
        <div className="space-y-4 animate-pulse">
            {noticeCardStyles.map((style, i) => (
                <div
                    key={i}
                    className="p-5 rounded-[24px] border border-white/[0.07] flex flex-col gap-3"
                    style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}
                >
                    {/* Header: Publisher Name and Metadata */}
                    <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-grow">
                            <div className={`h-[12px] rounded-md ${style.width1}`} style={{ backgroundColor: pulseBg }} />
                            <div className="h-[8px] rounded-md w-[80px] mt-1.5" style={{ backgroundColor: baseBg }} />
                        </div>
                    </div>

                    {/* Content body */}
                    <div className="space-y-2 mt-2">
                        <div className={`h-[10px] rounded-md ${style.width2}`} style={{ backgroundColor: baseBg }} />
                        <div className={`h-[10px] rounded-md ${style.width3}`} style={{ backgroundColor: baseBg }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function TeacherNoticesPageSkeleton() {
    const baseBg = 'rgba(255,255,255,0.05)';
    const pulseBg = 'rgba(255,255,255,0.1)';

    return (
        <div className="space-y-6 animate-pulse">
            {/* Title Header Skeleton */}
            <div className="flex flex-col gap-4 mt-4">
                <div className="h-8 bg-white/5 rounded-lg w-[200px]" style={{ backgroundColor: pulseBg }} />
                
                {/* Batch Selector Placeholder */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">
                    <div className="md:col-span-5 w-full">
                        <div className="h-[46px] bg-white/5 border border-white/5 rounded-2xl w-full" style={{ backgroundColor: baseBg }} />
                    </div>
                </div>
            </div>

            {/* Main Layout Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Left side: Upload Form Skeleton */}
                <div className="md:col-span-5">
                    <div className="rounded-[28px] border border-white/[0.07] p-5 space-y-4"
                         style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                        <div className="h-6 bg-white/5 rounded-md w-1/2" style={{ backgroundColor: pulseBg }} />
                        
                        <div className="space-y-3">
                            {/* Textarea Placeholder */}
                            <div className="h-24 md:h-40 bg-white/[0.02] border border-white/5 rounded-2xl w-full" style={{ backgroundColor: baseBg }} />

                            {/* Submit Button Placeholder */}
                            <div className="flex justify-end pt-3 border-t border-white/5">
                                <div className="h-8 bg-white/5 rounded-xl w-24" style={{ backgroundColor: pulseBg }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right side: Notices Feed Skeleton */}
                <div className="md:col-span-7">
                    <TeacherNoticesSkeleton />
                </div>
            </div>
        </div>
    );
}

export function StudentNoticesSkeleton() {
    const { theme } = useStudentTheme();
    const isLight = theme === "light";

    const baseBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)';
    const pulseBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)';

    const cardStyles = [
        { meta: "w-[40%]", content1: "w-[85%]", content2: "w-[50%]" },
        { meta: "w-[30%]", content1: "w-[90%]", content2: "w-[70%]" },
        { meta: "w-[35%]", content1: "w-[80%]", content2: "w-[60%]" },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
            <div className="space-y-4">
                {cardStyles.map((style, i) => (
                    <div
                        key={i}
                        className="p-5 flex flex-col gap-4 rounded-[24px] border border-white/[0.07]"
                        style={{
                            background: "var(--st-card-bg, rgba(28, 31, 43, 0.6))",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)"
                        }}
                    >
                        <div className="w-full space-y-2">
                            <div className="h-[12px] rounded-md" style={{ width: style.meta.replace("w-[", "").replace("]", ""), backgroundColor: pulseBg }} />
                            <div className="h-[8px] rounded-md w-[80px] mt-1.5" style={{ backgroundColor: baseBg }} />
                        </div>
                        <div className="space-y-2 mt-1">
                            <div className="h-[10px] rounded-md" style={{ width: style.content1.replace("w-[", "").replace("]", ""), backgroundColor: baseBg }} />
                            <div className="h-[10px] rounded-md" style={{ width: style.content2.replace("w-[", "").replace("]", ""), backgroundColor: baseBg }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

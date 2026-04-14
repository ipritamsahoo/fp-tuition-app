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

            {/* Summary Cards Skeleton */}
            <section className="space-y-4">
                {/* Total Students - Full Width */}
                <div className="rounded-[28px] border border-white/[0.07] p-6 relative overflow-hidden"
                     style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="h-3 w-24 rounded mb-2" style={{ backgroundColor: baseBg }}></div>
                            <div className="h-10 w-16 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                        </div>
                        <div className="w-14 h-14 rounded-2xl" style={{ backgroundColor: pulseBg }}></div>
                    </div>
                </div>

                {/* Paid + Unpaid - 2 Columns */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-[28px] border border-white/[0.07] p-5"
                         style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                         <div className="flex items-center gap-2 mb-3">
                             <div className="w-8 h-8 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                             <div className="h-4 w-12 rounded" style={{ backgroundColor: baseBg }}></div>
                         </div>
                         <div className="h-8 w-12 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                    </div>
                    <div className="rounded-[28px] border border-white/[0.07] p-5"
                         style={{ background: "rgba(28, 31, 43, 0.6)", backdropFilter: "blur(20px)" }}>
                         <div className="flex items-center gap-2 mb-3">
                             <div className="w-8 h-8 rounded-full" style={{ backgroundColor: pulseBg }}></div>
                             <div className="h-4 w-12 rounded" style={{ backgroundColor: baseBg }}></div>
                         </div>
                         <div className="h-8 w-12 rounded-lg" style={{ backgroundColor: pulseBg }}></div>
                    </div>
                </div>
            </section>

            {/* Filters Skeleton */}
            <section className="space-y-3">
                <div className="h-14 w-full rounded-2xl" style={{ backgroundColor: pulseBg }}></div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="h-14 w-full rounded-2xl" style={{ backgroundColor: pulseBg }}></div>
                    <div className="h-14 w-full rounded-2xl" style={{ backgroundColor: pulseBg }}></div>
                </div>
            </section>

            {/* Payment Status List Skeleton */}
            <section className="space-y-3">
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
            </section>
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

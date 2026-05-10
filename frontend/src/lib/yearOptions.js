/**
 * Dynamic year options for all filter dropdowns.
 * Start Year: 2026 (launch year)
 * End Year: Current Year + 2
 */
const LAUNCH_YEAR = 2026;

export function getYearOptions() {
    const endYear = 2099;
    const years = [];
    for (let y = LAUNCH_YEAR; y <= endYear; y++) {
        years.push(y);
    }
    return years;
}

/**
 * Returns { month, year } for the previous month.
 * Handles the January → December (prev year) edge case.
 * month is 1-indexed (1 = January, 12 = December).
 */
export function getPreviousMonth() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1–12
    if (currentMonth === 1) {
        return { month: 12, year: now.getFullYear() - 1 };
    }
    return { month: currentMonth - 1, year: now.getFullYear() };
}

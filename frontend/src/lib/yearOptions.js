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

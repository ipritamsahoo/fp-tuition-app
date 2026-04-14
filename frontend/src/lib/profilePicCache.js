/**
 * Profile picture cache utility using localStorage.
 * Stores profile pic as base64 to avoid redundant network requests.
 */

const CACHE_PREFIX = "fpfinance_profile_pic_";

/**
 * Get cached profile picture data for a user.
 * @param {string} uid
 * @returns {{ url: string, pic_version: string, dataUrl: string } | null}
 */
export function getCachedProfilePic(uid) {
    try {
        const raw = localStorage.getItem(`${CACHE_PREFIX}${uid}`);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Check if we need to refresh the cached profile picture.
 * @param {string} uid
 * @param {string|null} serverVersion - pic_version from server
 * @returns {boolean}
 */
export function shouldRefreshProfilePic(uid, serverVersion) {
    if (!serverVersion) return false; // No pic on server
    const cached = getCachedProfilePic(uid);
    if (!cached) return true; // No cache exists
    return cached.pic_version !== serverVersion;
}

/**
 * Fetch an image URL and convert to base64 dataUrl.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function urlToDataUrl(url) {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Cache a profile picture locally.
 * @param {string} uid
 * @param {string} url - Cloudinary URL
 * @param {string} pic_version - Version tag for cache busting
 */
export async function setCachedProfilePic(uid, url, pic_version) {
    try {
        const dataUrl = await urlToDataUrl(url);
        const entry = JSON.stringify({ url, pic_version, dataUrl });
        localStorage.setItem(`${CACHE_PREFIX}${uid}`, entry);
    } catch (e) {
        console.warn("Failed to cache profile pic:", e);
    }
}

/**
 * Clear cached profile picture for a user (on logout or deletion).
 * @param {string} uid
 */
export function clearCachedProfilePic(uid) {
    localStorage.removeItem(`${CACHE_PREFIX}${uid}`);
}

/**
 * Clear ALL cached profile pics (useful for admin operations).
 */
export function clearAllCachedProfilePics() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
}

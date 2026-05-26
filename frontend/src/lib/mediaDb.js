// IndexedDB Manager for local media caching (like WhatsApp Web)
const DB_NAME = "MediaCacheDB";
const STORE_NAME = "media-files";

export function initDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "fileId" });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function getCachedFile(fileId) {
    try {
        const db = await initDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(fileId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error("IndexedDB getCachedFile error:", err);
        return null;
    }
}

export async function saveCachedFile(fileId, blob, mimeType, fileName) {
    try {
        const db = await initDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const record = {
                fileId,
                blob,
                mimeType,
                fileName,
                timestamp: Date.now()
            };
            const request = store.put(record);
            request.onsuccess = () => resolve(record);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error("IndexedDB saveCachedFile error:", err);
        return null;
    }
}

/**
 * Given an array of fileIds, returns a Set containing the ones
 * that are already cached in IndexedDB. Fast: uses a single
 * read-only transaction.
 */
export async function checkCachedFiles(fileIds) {
    const cached = new Set();
    if (!fileIds || fileIds.length === 0) return cached;
    try {
        const db = await initDb();
        await Promise.all(
            fileIds.map(
                (id) =>
                    new Promise((resolve) => {
                        const tx = db.transaction(STORE_NAME, "readonly");
                        const req = tx.objectStore(STORE_NAME).get(id);
                        req.onsuccess = () => {
                            if (req.result && req.result.blob) cached.add(id);
                            resolve();
                        };
                        req.onerror = () => resolve(); // ignore errors per-file
                    })
            )
        );
    } catch (err) {
        console.error("IndexedDB checkCachedFiles error:", err);
    }
    return cached;
}


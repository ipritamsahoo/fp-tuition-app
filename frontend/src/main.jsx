import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Default fallback before service worker loads
window.checkForPwaUpdate = async () => "not_ready";

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/sw.js", { updateViaCache: "none" })
            .then((registration) => {
                console.log("[PWA] Service Worker registered:", registration);

                /**
                 * Show the update banner to the user.
                 * Called ONLY when:
                 *   1. The user manually presses "Check for Updates"
                 *   2. The 30-min periodic check finds a waiting SW
                 * NOT called on page load or background updatefound.
                 */
                const showUpdateBanner = () => {
                    console.log("[PWA] Dispatching pwa-update-available.");
                    window.dispatchEvent(new Event("pwa-update-available"));
                };

                // ── 1. Waiting SW on page load → activate silently ─────────────
                // If a new SW is already waiting when the page first loads,
                // skip it immediately so the user gets the new version on reload.
                // App.jsx's controllerchange listener handles the page reload.
                // No banner is shown — the update is transparent to the user.
                if (registration.waiting) {
                    console.log("[PWA] Waiting SW found on load — activating silently.");
                    registration.waiting.postMessage({ type: "SKIP_WAITING" });
                }

                // ── 2. Background updatefound → let SW install silently ────────
                // New SW installs in the background but we do NOT show the banner.
                // It will sit in "waiting" state until the 30-min interval or the
                // user's manual check picks it up and shows the banner.
                registration.addEventListener("updatefound", () => {
                    console.log("[PWA] New SW installing silently in background.");
                });

                // ── 3. Periodic background check (every 30 min) ────────────────
                // If a waiting SW is found, show the update banner.
                const periodicCheck = async () => {
                    console.log("[PWA] Periodic background update check.");
                    try {
                        await registration.update();
                    } catch {
                        return;
                    }
                    // Poll for up to 15s to see if a new SW enters waiting state
                    const startTime = Date.now();
                    const poll = () => {
                        if (registration.waiting) {
                            console.log("[PWA] Periodic check: new SW waiting — showing banner.");
                            window.dispatchEvent(new Event("pwa-update-available"));
                            return;
                        }
                        if (registration.installing && Date.now() - startTime < 15_000) {
                            setTimeout(poll, 300);
                        }
                    };
                    setTimeout(poll, 500);
                };
                setInterval(periodicCheck, 30 * 60 * 1000);

                // ── 4. Manual "Check for Updates" ──────────────────────────────
                window.checkForPwaUpdate = async () => {
                    try {
                        console.log("[PWA] Manual update check started.");

                        // If a waiting worker is already ready → show banner immediately
                        if (registration.waiting) {
                            console.log("[PWA] Already-waiting worker found instantly.");
                            showUpdateBanner();
                            return "update_available";
                        }

                        // Trigger a fresh network fetch of sw.js
                        await registration.update();

                        // Poll for the new SW to enter "waiting" state.
                        // More reliable than event listeners due to race conditions.
                        return await new Promise((resolve) => {
                            const startTime = Date.now();
                            const MAX_WAIT_MS = 15_000;
                            const POLL_INTERVAL_MS = 250;

                            const poll = () => {
                                // ✅ New SW is waiting — update found!
                                if (registration.waiting) {
                                    console.log("[PWA] New SW waiting — update detected.");
                                    showUpdateBanner();
                                    resolve("update_available");
                                    return;
                                }

                                // ⏳ Still installing — keep polling
                                if (registration.installing) {
                                    if (Date.now() - startTime < MAX_WAIT_MS) {
                                        setTimeout(poll, POLL_INTERVAL_MS);
                                    } else {
                                        console.log("[PWA] Timed out waiting for SW to install.");
                                        resolve("up_to_date");
                                    }
                                    return;
                                }

                                // ❌ Nothing installing or waiting — already up to date
                                console.log("[PWA] No new SW found. Already up to date.");
                                resolve("up_to_date");
                            };

                            // Give the browser 500ms head start to begin installing
                            setTimeout(poll, 500);
                        });

                    } catch (err) {
                        console.error("[PWA] Error during manual update check:", err);
                        return "error";
                    }
                };
            })
            .catch((error) => {
                console.error("[PWA] Service Worker registration failed:", error);
            });
    });
}

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <App />
    </StrictMode>
);

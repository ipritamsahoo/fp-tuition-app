import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
        console.log("New version detected! Forcing auto-update to fix cache issues.");
        updateSW(true);
    },
    onOfflineReady() {
        console.log("App ready to work offline");
    },
});

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <App />
    </StrictMode>
);

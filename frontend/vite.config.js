import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            strategies: "injectManifest",
            srcDir: "src",
            filename: "sw.js",
            registerType: "autoUpdate",
            injectRegister: false,
            includeAssets: ["favicon.png", "logo.png", "fp-badge-icon.png"],
            manifest: {
                name: "FP Finance",
                short_name: "FP Finance",
                description: "FP Finance by Future Point — Manage fees, track payments, payment verification, and financial insights.",
                theme_color: "#0c0e17",
                background_color: "#0c0e17",
                display: "standalone",
                display_override: ["standalone"],
                orientation: "portrait",
                scope: "/",
                start_url: "/",
                share_target: {
                    action: "/share-receiver",
                    method: "POST",
                    enctype: "multipart/form-data",
                    params: {
                        files: [
                            {
                                name: "screenshot",
                                accept: ["image/*"],
                            },
                        ],
                    },
                },
                icons: [
                    {
                        src: "/favicon.png",
                        sizes: "64x64",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
            injectManifest: {
                globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
        // Inline assets under 60KB as base64 data URIs (logo.png is ~54KB)
        // This eliminates the HTTP round-trip for the logo, making it
        // available instantly as part of the JS bundle — no network flash.
        assetsInlineLimit: 60000,
    },
});

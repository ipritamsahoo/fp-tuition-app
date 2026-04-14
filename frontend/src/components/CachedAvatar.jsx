import { useState, useEffect } from "react";
import {
    getCachedProfilePic,
    setCachedProfilePic,
    shouldRefreshProfilePic,
} from "@/lib/profilePicCache";

// ── Fallback Initial Avatar ──
export function StudentAvatarFallback({ name, size = 44 }) {
    const initial = (name || "?").charAt(0).toUpperCase();
    const colors = [
        "from-[#c799ff] to-[#7744b5]",
        "from-[#4af8e3] to-[#006a60]",
        "from-[#ff9dac] to-[#a70138]",
        "from-[#bc87fe] to-[#440080]",
        "from-[#33e9d5] to-[#005b51]",
    ];
    const colorIndex = (name || "").charCodeAt(0) % colors.length;
    return (
        <div
            className={`rounded-2xl bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-bold shadow-lg shrink-0 overflow-hidden`}
            style={{ width: size, height: size, minWidth: size, fontSize: size * 0.4 }}
        >
            {initial}
        </div>
    );
}

// ── Cached Avatar ──
export default function CachedAvatar({ uid, name, size = 44, profile_pic_url, pic_version }) {
    const [imgSrc, setImgSrc] = useState(null);

    useEffect(() => {
        if (!uid || !profile_pic_url) {
            setImgSrc(null);
            return;
        }

        const loadPic = async () => {
            // If we don't need a refresh, try to grab the cached version
            if (!shouldRefreshProfilePic(uid, pic_version)) {
                const cached = getCachedProfilePic(uid);
                if (cached && cached.dataUrl) {
                    setImgSrc(cached.dataUrl);
                    return;
                }
            }

            // Otherwise, we either need a refresh or the cache was missing/corrupt
            // Generate a small compressed version of the image using Cloudinary parameters
            // (assuming the URL is a Cloudinary URL)
            let optimizedUrl = profile_pic_url;
            if (optimizedUrl.includes("res.cloudinary.com") && !optimizedUrl.includes("w_150")) {
                optimizedUrl = optimizedUrl.replace("/upload/", "/upload/c_fill,h_150,w_150,q_auto,f_auto/");
            }

            try {
                // Fetch and save to cache
                await setCachedProfilePic(uid, optimizedUrl, pic_version);
                const freshlyCached = getCachedProfilePic(uid);
                if (freshlyCached && freshlyCached.dataUrl) {
                    setImgSrc(freshlyCached.dataUrl);
                } else {
                    setImgSrc(optimizedUrl); // fallback if caching inexplicably fails
                }
            } catch (err) {
                console.warn("Failed to load cached avatar:", err);
                // Last resort fallback directly to the optimized URL
                setImgSrc(optimizedUrl);
            }
        };

        loadPic();
    }, [uid, profile_pic_url, pic_version]);

    if (!profile_pic_url || !imgSrc) {
        return <StudentAvatarFallback name={name} size={size} />;
    }

    return (
        <img
            src={imgSrc}
            alt={name || "Avatar"}
            className="rounded-2xl object-cover shrink-0 shadow-lg border border-white/10"
            style={{ width: size, height: size, minWidth: size }}
            loading="lazy"
        />
    );
}

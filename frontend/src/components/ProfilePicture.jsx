import { useAuth } from "@/context/AuthContext";

/**
 * Badge configuration for each tier.
 */
const BADGE_CONFIG = {
    prime: {
        gradient: "from-[#a855f7] via-[#4af8e3] to-[#a855f7]",
        shadow: "shadow-[0_0_20px_rgba(168,85,247,1),0_0_50px_rgba(168,85,247,0.6),inset_0_0_15px_rgba(168,85,247,0.8)]",
        icon: "bolt",
        iconColor: "text-[#a855f7]",
        iconBg: "bg-[#a855f7]/90",
    },
    golden: {
        gradient: "from-[#f59e0b] via-[#fbbf24] to-[#f59e0b]",
        shadow: "shadow-[0_0_20px_rgba(245,158,11,0.7),inset_0_0_8px_rgba(245,158,11,0.4)]",
        icon: "star",
        iconColor: "text-[#f59e0b]",
        iconBg: "bg-[#f59e0b]/90",
    },
    silver: {
        gradient: "from-[#94a3b8] via-[#cbd5e1] to-[#94a3b8]",
        shadow: "shadow-[0_0_15px_rgba(148,163,184,0.6),inset_0_0_5px_rgba(148,163,184,0.3)]",
        icon: "workspace_premium",
        iconColor: "text-[#94a3b8]",
        iconBg: "bg-[#94a3b8]/90",
    },
};

/**
 * Reusable profile picture component with optional achievement badge ring.
 *
 * Props:
 *  - size: number (pixel size, default 36)
 *  - picUrl: optional override URL (for showing other users' pics)
 *  - name: optional override name (for other users)
 *  - className: additional CSS classes
 *  - showBadge: if false, suppresses badge ring even for the current user (default: true)
 */
export default function ProfilePicture({ size = 36, picUrl, name, className = "", showBadge = true }) {
    const { user } = useAuth();

    // If `name` is provided, we're rendering someone else's avatar.
    // In that case, ONLY use the provided `picUrl` — never fall back to the
    // logged-in user's own picture (which caused the same pic to appear for everyone).
    const isOtherUser = name !== undefined && name !== null;
    const displayUrl = isOtherUser
        ? (picUrl || null)
        : (picUrl ?? user?.profilePicDataUrl ?? user?.profilePicUrl);
    const displayName = name ?? user?.name ?? "U";
    const initial = displayName.charAt(0).toUpperCase() || "U";

    // Badge: only show for logged-in user's own avatar, never for other users
    const badge = (!isOtherUser && showBadge && user?.currentBadge) ? BADGE_CONFIG[user.currentBadge] : null;

    const sizeStyle = { width: size, height: size, minWidth: size, minHeight: size };

    // Render the core avatar (image or initial fallback)
    const avatarContent = displayUrl ? (
        <img
            src={displayUrl}
            alt={displayName}
            className="rounded-full object-cover w-full h-full"
            onError={(e) => {
                e.target.style.display = "none";
                if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
            }}
        />
    ) : null;

    const initialFallback = (
        <div
            className="rounded-full bg-gradient-to-tr from-[#3861fb] to-[#2b4fcf] flex items-center justify-center text-white font-bold shadow-sm w-full h-full"
            style={{ fontSize: size * 0.4, display: displayUrl ? "none" : "flex" }}
        >
            {initial}
        </div>
    );

    // No badge → render plain avatar (backward compatible)
    if (!badge) {
        return (
            <div className={`rounded-full overflow-hidden ${className}`} style={sizeStyle}>
                {avatarContent}
                {initialFallback}
            </div>
        );
    }

    // With badge → gradient ring + small badge icon
    const ringWidth = size >= 64 ? 3 : 2;
    const outerSize = size + ringWidth * 2 + 2;
    const iconSize = Math.max(14, Math.round(size * 0.32));

    return (
        <div className="relative inline-flex" style={{ width: outerSize, height: outerSize, isolation: "isolate", transform: "translateZ(0)" }}>
            {/* Animated gradient ring */}
            <div
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${badge.gradient} ${badge.shadow} animate-badge-ring`}
                style={{ padding: ringWidth }}
            >
                <div className="w-full h-full rounded-full bg-[#0c0e17] overflow-hidden flex items-center justify-center">
                    <div style={sizeStyle} className="rounded-full overflow-hidden">
                        {avatarContent}
                        {initialFallback}
                    </div>
                </div>
            </div>

            {/* Badge icon (bottom-right) */}
            <div
                className={`absolute flex items-center justify-center rounded-full ${badge.iconBg} border-2 border-[#0c0e17] z-10`}
                style={{
                    width: iconSize,
                    height: iconSize,
                    bottom: -1,
                    right: -1,
                }}
            >
                <span
                    className="material-symbols-outlined text-white"
                    style={{
                        fontSize: Math.max(9, iconSize - 5),
                        fontVariationSettings: "'FILL' 1",
                        lineHeight: 1,
                    }}
                >
                    {badge.icon}
                </span>
            </div>

            {/* CSS animation for the ring glow pulse */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes badge-ring-pulse {
                    0%, 100% { opacity: 0.85; filter: brightness(1); }
                    50% { opacity: 1; filter: brightness(1.15); }
                }
                .animate-badge-ring {
                    animation: badge-ring-pulse 3s ease-in-out infinite;
                }
            `}} />
        </div>
    );
}

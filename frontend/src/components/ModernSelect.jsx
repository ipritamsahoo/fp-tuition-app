import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export default function ModernSelect({ icon, value, onChange, options, placeholder = "Select...", className = "", theme }) {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);
    const [dropdownPos, setDropdownPos] = useState({ top: "auto", bottom: "auto", left: 0, width: 0 });

    // Find the current selected option to show its label
    const selectedOption = options.find(opt => {
        const optVal = opt.value !== undefined ? opt.value : opt.id !== undefined ? opt.id : opt;
        return String(optVal) === String(value);
    });

    const getLabel = (opt) => {
        if (typeof opt !== "object") return String(opt);
        return opt.label || opt.batch_name || opt.name || String(opt.value ?? opt.id ?? "");
    };

    const getValue = (opt) => {
        if (typeof opt !== "object") return opt;
        return opt.value !== undefined ? opt.value : opt.id;
    };

    const displayLabel = selectedOption ? getLabel(selectedOption) : placeholder;

    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const openUpwards = spaceBelow < 300 && spaceAbove > spaceBelow;

            const margin = 16;
            const screenWidth = window.innerWidth;
            const dropdownWidth = Math.max(rect.width, 200);
            const finalWidth = Math.min(dropdownWidth, screenWidth - margin * 2);

            let left = rect.left;
            if (left + finalWidth > screenWidth - margin) {
                left = screenWidth - finalWidth - margin;
            }
            if (left < margin) {
                left = margin;
            }

            setDropdownPos({
                top: openUpwards ? "auto" : rect.bottom + 8,
                bottom: openUpwards ? window.innerHeight - rect.top + 8 : "auto",
                left,
                width: finalWidth,
            });
        }
    }, []);

    const handleToggle = () => {
        if (!isOpen) {
            updatePosition();
        }
        setIsOpen(prev => !prev);
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (
                buttonRef.current && !buttonRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        // Removed scroll listener to prevent menu from closing when scrolling options

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [isOpen]);

    const dropdown = isOpen ? createPortal(
        <div
            ref={dropdownRef}
            data-theme={theme}
            className="modern-select-dropdown"
            style={{
                position: "fixed",
                top: dropdownPos.top,
                bottom: dropdownPos.bottom,
                left: dropdownPos.left,
                width: dropdownPos.width,
                zIndex: 99999,
            }}
        >
            <div
                style={{
                    background: theme === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'var(--st-surface-high, #1a1c28)',
                    border: `1px solid ${theme === 'light' ? 'rgba(255, 255, 255, 0.6)' : 'var(--st-nav-border, rgba(255, 255, 255, 0.12))'}`,
                    borderRadius: "20px",
                    boxShadow: theme === 'light' 
                        ? "0 20px 60px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)" 
                        : "0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
                    overflow: "hidden",
                    backdropFilter: "blur(32px) saturate(1.8)",
                    WebkitBackdropFilter: "blur(32px) saturate(1.8)",
                }}
            >
                <div
                    style={{
                        maxHeight: "280px",
                        overflowY: "auto",
                        padding: "6px 0",
                        pointerEvents: "auto",
                    }}
                    className="custom-scrollbar"
                >
                    {options.length === 0 ? (
                        <div style={{ padding: "12px 20px", color: "var(--st-text-muted, #737580)", fontSize: "13px", fontStyle: "italic" }}>
                            No options available
                        </div>
                    ) : options.map((opt, idx) => {
                        const val = getValue(opt);
                        const label = getLabel(opt);
                        const isSelected = String(value) === String(val);

                        return (
                            <div
                                key={idx}
                                onClick={() => {
                                    onChange({ target: { value: val } });
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: "14px 20px",
                                    fontSize: "14px",
                                    fontWeight: isSelected ? 800 : 600,
                                    color: isSelected ? "var(--st-primary, #c799ff)" : "var(--st-text-primary, #f0f0fd)",
                                    backgroundColor: isSelected 
                                        ? (theme === 'light' ? "rgba(124, 58, 237, 0.18)" : "rgba(199, 153, 255, 0.15)")
                                        : "transparent",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    transition: "all 0.15s ease",
                                    userSelect: "none",
                                }}
                                className={isSelected ? "" : (theme === 'light' ? "hover:bg-black/5" : "hover:bg-white/5")}
                            >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "12px" }}>
                                    {label}
                                </span>
                                {isSelected && (
                                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--st-primary, #c799ff)", flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>
                                        check_circle
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium cursor-pointer transition-all min-w-[120px] ${className}`}
                style={{
                    background: theme === 'light' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: theme === 'light' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.1)',
                    color: 'var(--st-text-primary)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                }}
            >
                {icon && <span className="material-symbols-outlined text-base" style={{ color: 'var(--st-text-secondary)' }}>{icon}</span>}
                <span className="flex-1 text-left truncate pr-2 font-bold">{displayLabel}</span>
                <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} style={{ color: 'var(--st-text-secondary)' }}>
                    expand_more
                </span>
            </button>
            {dropdown}
        </>
    );
}

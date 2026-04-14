import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { registerGlobalErrorHandler } from "@/lib/api";

const ErrorContext = createContext(null);

export const useError = () => {
    const context = useContext(ErrorContext);
    if (!context) {
        throw new Error("useError must be used within an ErrorProvider");
    }
    return context;
};

/**
 * Error types for categorization
 */
export const ERROR_TYPES = {
    NETWORK_ERROR: "NETWORK_ERROR",
    AUTH_ERROR: "AUTH_ERROR",
    SERVER_ERROR: "SERVER_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    DENIED_ERROR: "DENIED_ERROR",
};

/**
 * Error mapping for user-friendly messages
 */
const ERROR_MAPPINGS = {
    [ERROR_TYPES.NETWORK_ERROR]: {
        title: "Connection Lost",
        message: "We're having trouble reaching our servers. Please check your internet connection.",
        icon: "wifi_off",
    },
    [ERROR_TYPES.AUTH_ERROR]: {
        title: "Session Expired",
        message: "Your session has timed out. Please log in again to continue.",
        icon: "lock_clock",
    },
    [ERROR_TYPES.SERVER_ERROR]: {
        title: "Technical Hiccup",
        message: "Oops! Something went wrong on our end. We're looking into it!",
        icon: "error",
    },
    [ERROR_TYPES.VALIDATION_ERROR]: {
        title: "Something's Not Right",
        message: "Please check your input and try again.",
        icon: "warning",
    },
    [ERROR_TYPES.DENIED_ERROR]: {
        title: "Access Restricted",
        message: "You don't have permission for this action. Please contact the administrator.",
        icon: "verified_user",
    },
};

export function ErrorProvider({ children }) {
    const [error, setError] = useState(null);

    /**
     * show(type, options) — trigger the global error modal
     */
    const show = useCallback((type, options = {}) => {
        const mapping = ERROR_MAPPINGS[type] || {};
        setError({
            type,
            title: options.title || mapping.title || "Something Went Wrong",
            message: options.message || mapping.message || "An unexpected error occurred. Please try again.",
            icon: options.icon || mapping.icon || "error",
            onRetry: options.onRetry || null,
            onDismiss: options.onDismiss || null,
        });
    }, []);

    const clear = useCallback(() => {
        setError(null);
    }, []);

    // Register this provider's show function with the API library
    useEffect(() => {
        registerGlobalErrorHandler(show);
        return () => registerGlobalErrorHandler(null);
    }, [show]);

    return (
        <ErrorContext.Provider value={{ error, show, clear }}>
            {children}
        </ErrorContext.Provider>
    );
}

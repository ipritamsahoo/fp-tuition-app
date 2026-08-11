import { auth } from "./firebase";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

let globalErrorHandler = null;

/**
 * Register a global error handler (used by ErrorProvider)
 */
export function registerGlobalErrorHandler(handler) {
    globalErrorHandler = handler;
}

/**
 * Make an authenticated request to the FastAPI backend.
 */
export async function apiFetch(endpoint, options = {}) {
    let token = null;
    if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
        localStorage.setItem("idToken", token);
    } else {
        token = localStorage.getItem("idToken");
    }

    const headers = { ...options.headers };
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    let res;
    try {
        res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });
    } catch (err) {
        // Network-level failures (offline, timeout, server down)
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        } catch (retryErr) {
            if (globalErrorHandler) globalErrorHandler("NETWORK_ERROR");
            throw new Error("NETWORK_ERROR");
        }
    }

    if (!res.ok) {
        let errorType = "SERVER_ERROR";
        if (res.status === 401 || res.status === 403) errorType = "AUTH_ERROR";
        if (res.status === 400 || res.status === 422) errorType = "VALIDATION_ERROR";
        
        const errData = await res.json().catch(() => ({ detail: "Request failed" }));
        const errorMessage = errData.detail || `HTTP ${res.status}`;

        if (globalErrorHandler) {
            // Only trigger global modal for systemic failures (401, 500, etc.)
            // Validation errors (400, 422) are often better handled inline
            if (errorType !== "VALIDATION_ERROR") {
                globalErrorHandler(errorType, { message: errorMessage });
            }
        }

        throw new Error(errorMessage);
    }

    return res.json();
}

/**
 * Check if an error message represents a systemic error 
 * handled by the GlobalErrorModal (Network, Auth, Server 500).
 */
export function isSystemicError(errorMsg) {
    const systemic = ["NETWORK_ERROR", "AUTH_ERROR", "SERVER_ERROR"];
    return systemic.includes(errorMsg);
}

/**
 * Shorthand helpers
 */
export const api = {
    get: (url) => apiFetch(url),
    post: (url, data) =>
        apiFetch(url, { method: "POST", body: JSON.stringify(data) }),
    put: (url, data) =>
        apiFetch(url, { method: "PUT", body: JSON.stringify(data) }),
    patch: (url, data) =>
        apiFetch(url, { method: "PATCH", ...(data ? { body: JSON.stringify(data) } : {}) }),
    delete: (url, data) =>
        apiFetch(url, { method: "DELETE", ...(data ? { body: JSON.stringify(data) } : {}) }),
    upload: (url, formData, onProgress) => {
        const tokenPromise = auth.currentUser 
            ? auth.currentUser.getIdToken() 
            : Promise.resolve(localStorage.getItem("idToken"));

        return tokenPromise.then(token => {
            if (token) {
                localStorage.setItem("idToken", token);
            }
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", `${API_BASE}${url}`);

                if (token) {
                    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
                }

                if (onProgress && xhr.upload) {
                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                            const percentComplete = Math.round((event.loaded / event.total) * 100);
                            onProgress(percentComplete);
                        }
                    };
                }

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response);
                        } catch (e) {
                            resolve(xhr.responseText);
                        }
                    } else {
                        let errorMessage = `HTTP ${xhr.status}`;
                        try {
                            const errData = JSON.parse(xhr.responseText);
                            errorMessage = errData.detail || errorMessage;
                        } catch (e) {}
                        
                        const isValidationError = xhr.status === 400 || xhr.status === 422;
                        if (globalErrorHandler && !isValidationError) {
                            const errType = (xhr.status === 401 || xhr.status === 403) ? "AUTH_ERROR" : "SERVER_ERROR";
                            globalErrorHandler(errType, { message: errorMessage });
                        }
                        
                        reject(new Error(errorMessage));
                    }
                };

                xhr.onerror = () => {
                    if (globalErrorHandler) globalErrorHandler("NETWORK_ERROR");
                    reject(new Error("NETWORK_ERROR"));
                };

                xhr.send(formData);
            });
        });
    }
};

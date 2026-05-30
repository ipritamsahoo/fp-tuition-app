/**
 * biometricService.js
 * Handles WebAuthn (platform authenticator) registration and authentication
 * for the PWA app lock feature. Client-only — no server involvement.
 */

const RP_NAME = "FP Tuition App";
const RP_ID = window.location.hostname;
const CRED_KEY = "fp_biometric_cred_id";
const SETTINGS_KEY = "fp_applock_settings";

/** Check if WebAuthn platform authenticator is available on this device */
export async function isBiometricAvailable() {
    try {
        if (!window.PublicKeyCredential) {
            console.warn("[Biometric] PublicKeyCredential API not available in this browser.");
            return false;
        }
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        console.log("[Biometric] isUserVerifyingPlatformAuthenticatorAvailable →", available);
        return available;
    } catch (err) {
        console.warn("[Biometric] Availability check failed:", err);
        return false;
    }
}

/** Get stored app lock settings */
export function getAppLockSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { enabled: false, timeout: 0 }; // 0 = immediate
        return JSON.parse(raw);
    } catch {
        return { enabled: false, timeout: 0 };
    }
}

/** Save app lock settings */
export function saveAppLockSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Check if a credential is already registered */
export function hasRegisteredCredential() {
    return !!localStorage.getItem(CRED_KEY);
}

/** Get the stored credential ID (base64url) */
function getCredentialId() {
    return localStorage.getItem(CRED_KEY);
}

/** Convert base64url string to ArrayBuffer */
function base64urlToBuffer(base64url) {
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

/** Convert ArrayBuffer to base64url string */
function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Register a new biometric credential for app lock.
 * Uses residentKey: "discouraged" so it stays LOCAL to the device
 * and does NOT sync to Google Password Manager as a passkey.
 * Returns true on success, throws on failure.
 */
export async function registerBiometric(userId) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBuffer = new TextEncoder().encode(userId || "fp-user");

    const credential = await navigator.credentials.create({
        publicKey: {
            challenge,
            rp: { name: RP_NAME, id: RP_ID },
            user: {
                id: userIdBuffer,
                name: userId || "fp-user",
                displayName: "FP Biometric Lock",
            },
            pubKeyCredParams: [
                { type: "public-key", alg: -7 },   // ES256
                { type: "public-key", alg: -257 },  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform", // device-native only
                userVerification: "required",         // forces biometric/PIN
                residentKey: "discouraged",           // ← prevents passkey sync to cloud
                requireResidentKey: false,            // ← no Google Password Manager storage
            },
            timeout: 60000,
            attestation: "none",
        },
    });

    if (!credential) throw new Error("No credential returned");

    const credId = bufferToBase64url(credential.rawId);
    localStorage.setItem(CRED_KEY, credId);

    return true;
}

/**
 * Authenticate using registered biometric credential.
 * This triggers the device's native biometric prompt.
 * Returns true on success, throws on failure/cancel.
 */
export async function authenticateBiometric() {
    const credId = getCredentialId();
    if (!credId) throw new Error("No credential registered. Please set up biometric lock first.");

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge,
            rpId: RP_ID,
            allowCredentials: [
                {
                    type: "public-key",
                    id: base64urlToBuffer(credId),
                    transports: ["internal"],
                },
            ],
            userVerification: "required",
            timeout: 60000,
        },
    });

    if (!assertion) throw new Error("Authentication failed");
    return true;
}

/**
 * Remove the stored biometric credential and disable app lock.
 */
export function removeBiometricCredential() {
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(SETTINGS_KEY);
}

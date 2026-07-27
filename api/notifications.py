"""
FP Finance Notification Helper
========================
Functions to send FCM push messages. Notifications are stored locally
on the client side (localStorage) — no Firestore writes.
"""

from firebase_admin import messaging
from database import db

# Global cache for admin notification data (UIDs and tokens)
# This reduces Firestore reads whenever notify_admins is called.
_ADMIN_CACHE = {
    "data": [], # List of {"uid": str, "tokens": list}
    "last_fetch": 0
}


def _send_fcm(tokens: list, title: str, body: str, notif_type: str = "", target_uid: str = ""):
    """Send FCM data-only push notification to a list of device tokens.
    Silently ignores invalid/expired tokens and cleans them up."""
    if not tokens:
        return

    message = messaging.MulticastMessage(
        data={
            "title": title,
            "body": body,
            "type": notif_type,
            "target_uid": target_uid,
        },
        tokens=tokens,
    )

    try:
        response = messaging.send_each_for_multicast(message)
        # Clean up invalid tokens
        if response.failure_count > 0:
            for idx, send_response in enumerate(response.responses):
                if send_response.exception:
                    error_code = getattr(
                        send_response.exception, "code", ""
                    )
                    if error_code in (
                        "messaging/invalid-registration-token",
                        "messaging/registration-token-not-registered",
                        "NOT_FOUND",
                        "INVALID_ARGUMENT",
                    ):
                        # Remove stale token from all users who have it
                        _remove_stale_token(tokens[idx])
    except Exception as e:
        print(f"FCM send error: {e}")


def _remove_stale_token(token: str):
    """Remove a stale FCM token from any user that has it."""
    try:
        users = db.collection("users").where(
            "fcm_tokens", "array_contains", token
        ).stream()
        for u in users:
            db.collection("users").document(u.id).update({
                "fcm_tokens": [
                    t for t in (u.to_dict().get("fcm_tokens") or [])
                    if t != token
                ]
            })
    except Exception as e:
        print(f"Stale token cleanup error: {e}")


def _get_fcm_tokens(uid: str) -> list:
    """Get FCM tokens for a specific user."""
    doc = db.collection("users").document(uid).get()
    if doc.exists:
        return doc.to_dict().get("fcm_tokens") or []
    return []


def notify_user(uid: str, message: str, notif_type: str, title: str = "FP Finance", tokens: list = None):
    """Send FCM push notification to a single user."""
    if tokens is None:
        tokens = _get_fcm_tokens(uid)
    if tokens:
        _send_fcm(tokens, title, message, notif_type, target_uid=uid)


def notify_users(uids: list, message: str, notif_type: str, title: str = "FP Finance"):
    """Send FCM push notification to multiple users.
    Sends individually to ensure each recipient gets their own target_uid."""
    for uid in uids:
        # Optimization: We could batch this, but since we need a distinct target_uid
        # per user, we call _send_fcm per user. Firebase Admin SDK handles this efficiently.
        notify_user(uid, message, notif_type, title)


def notify_admins(message: str, notif_type: str, title: str = "FP Finance"):
    """Find all admin users and notify them via FCM. Optimized with caching."""
    import time
    from google.cloud.firestore_v1.base_query import FieldFilter
    
    now = time.time()
    # Cache for 10 minutes
    if not _ADMIN_CACHE["data"] or (now - _ADMIN_CACHE["last_fetch"] > 600):
        try:
            admins = db.collection("users").where(filter=FieldFilter("role", "==", "admin")).stream()
            _ADMIN_CACHE["data"] = []
            for a in admins:
                _ADMIN_CACHE["data"].append({
                    "uid": a.id,
                    "tokens": a.to_dict().get("fcm_tokens") or []
                })
            _ADMIN_CACHE["last_fetch"] = now
        except Exception as e:
            print(f"Error fetching admins for FCM: {e}")

    for admin in _ADMIN_CACHE["data"]:
        if admin["tokens"]:
            _send_fcm(admin["tokens"], title, message, notif_type, target_uid=admin["uid"])

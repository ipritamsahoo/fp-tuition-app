"""
FP Finance Dependencies
=================
Authentication and authorization dependencies for FastAPI endpoints.
"""

from typing import Optional
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth

from database import db

# ── Security scheme ──
security = HTTPBearer()


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    """Verify Firebase ID token and return user data from Firestore."""
    token = creds.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
        uid = decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Fetch user doc from Firestore
    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User profile not found")

    user_data = user_doc.to_dict()

    # Block access if user is disabled
    if user_data.get("is_disabled"):
        raise HTTPException(status_code=403, detail="Your account has been disabled. Please contact the administrator.")

    user_data["uid"] = uid
    return user_data


def require_role(*roles):
    """Dependency factory: ensures the current user has one of the specified roles."""
    def role_checker(user=Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker


def _verify_token_and_get_user(token: str):
    """Shared helper: verify a Firebase ID token and return Firestore user data."""
    try:
        decoded = firebase_auth.verify_id_token(token)
        uid = decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User profile not found")

    user_data = user_doc.to_dict()
    if user_data.get("is_disabled"):
        raise HTTPException(status_code=403, detail="Your account has been disabled.")

    user_data["uid"] = uid
    return user_data


def get_current_user_flexible(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
):
    """
    Flexible auth: accepts token from Authorization header OR ?token= query param.
    Needed for browser anchor-tag downloads where custom headers cannot be set.
    """
    token: Optional[str] = None

    # 1. Try Authorization header first
    if creds and creds.credentials:
        token = creds.credentials

    # 2. Fallback to ?token= query parameter
    if not token:
        token = request.query_params.get("token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return _verify_token_and_get_user(token)


def require_role_flexible(*roles):
    """Like require_role but accepts token from header OR query param."""
    def role_checker(user=Depends(get_current_user_flexible)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

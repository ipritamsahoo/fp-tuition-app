"""
FP Finance Auth Router
================
Endpoints: register, login, get current user profile, profile picture management.
"""

import httpx
import cloudinary.uploader
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request

from config import FIREBASE_API_KEY
from database import db
from schemas import (
    LoginRequest, RegisterRequest, SelfUpdateCredentials,
    SessionRegisterRequest, to_firebase_email
)
from dependencies import get_current_user, require_role
from utils import ts_now
from firebase_admin import auth as firebase_auth

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ──────────────────────────────────────────────
# POST /api/auth/register
# ──────────────────────────────────────────────
@router.post("/register")
def register(req: RegisterRequest, user=Depends(require_role("admin"))):
    """Admin-only: Create a new user in Firebase Auth + Firestore."""
    email = to_firebase_email(req.username)
    try:
        fb_user = firebase_auth.create_user(
            email=email,
            password=req.password,
            display_name=req.name,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=400, detail="Username already registered")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Set custom claims for role
    firebase_auth.set_custom_user_claims(fb_user.uid, {"role": req.role})

    # Create Firestore user document
    user_doc = {
        "name": req.name,
        "username": req.username.strip().lower(),
        "email": email,
        "role": req.role,
        "batch_id": req.batch_id,
        "created_at": ts_now(),
    }
    db.collection("users").document(fb_user.uid).set(user_doc)

    return {"uid": fb_user.uid, "message": f"User {req.name} created successfully"}


# ──────────────────────────────────────────────
# POST /api/auth/login
# ──────────────────────────────────────────────
@router.post("/login")
def login(req: LoginRequest):
    """Login via Firebase Auth REST API — returns ID token."""
    email = to_firebase_email(req.username)
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    with httpx.Client() as client:
        resp = client.post(url, json={
            "email": email,
            "password": req.password,
            "returnSecureToken": True,
        })

    if resp.status_code != 200:
        error_msg = resp.json().get("error", {}).get("message", "Login failed")
        raise HTTPException(status_code=401, detail=error_msg)

    data = resp.json()
    uid = data["localId"]

    # Fetch user profile from Firestore
    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User profile not found in database")

    profile = user_doc.to_dict()

    if profile.get("is_disabled"):
        raise HTTPException(status_code=403, detail="Your account has been disabled. Please contact the administrator.")

    return {
        "idToken": data["idToken"],
        "refreshToken": data["refreshToken"],
        "uid": uid,
        "email": data["email"],
        "username": profile.get("username", ""),
        "name": profile.get("name", ""),
        "role": profile.get("role", "student"),
        "batch_id": profile.get("batch_id"),
        "profile_pic_url": profile.get("profile_pic_url"),
        "pic_version": profile.get("pic_version"),
        "expiresIn": data["expiresIn"],
    }


# ──────────────────────────────────────────────
# GET /api/auth/me
# ──────────────────────────────────────────────
@router.get("/me")
def get_me(user=Depends(get_current_user)):
    """Get current user profile."""
    return {
        "uid": user["uid"],
        "email": user.get("email", ""),
        "username": user.get("username", ""),
        "name": user.get("name", ""),
        "role": user.get("role", ""),
        "batch_id": user.get("batch_id"),
        "profile_pic_url": user.get("profile_pic_url"),
        "pic_version": user.get("pic_version"),
    }


# ──────────────────────────────────────────────
# POST /api/auth/profile-pic  (upload own)
# ──────────────────────────────────────────────
@router.post("/profile-pic")
def upload_profile_pic(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload or replace the current user's profile picture via Cloudinary."""
    uid = user["uid"]

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = file.file.read()
    if len(contents) > 2 * 1024 * 1024:  # 2 MB server-side guard
        raise HTTPException(status_code=400, detail="Image too large (max 2MB)")

    try:
        import io
        result = cloudinary.uploader.upload(
            io.BytesIO(contents),
            folder="fpfinance/profile_pics",
            public_id=uid,
            overwrite=True,
            resource_type="image",
            transformation=[
                {"width": 256, "height": 256, "crop": "fill", "gravity": "face"},
                {"quality": "auto", "fetch_format": "auto"},
            ],
        )
        pic_url = result["secure_url"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    pic_version = ts_now()
    db.collection("users").document(uid).update({
        "profile_pic_url": pic_url,
        "pic_version": pic_version,
    })

    return {"profile_pic_url": pic_url, "pic_version": pic_version}


# ──────────────────────────────────────────────
# DELETE /api/auth/profile-pic  (remove own)
# ──────────────────────────────────────────────
@router.delete("/profile-pic")
def delete_profile_pic(user=Depends(get_current_user)):
    """Remove the current user's profile picture."""
    uid = user["uid"]

    # Delete from Cloudinary
    try:
        cloudinary.uploader.destroy(f"fpfinance/profile_pics/{uid}")
    except Exception as e:
        print(f"Cloudinary delete failed: {e}")

    db.collection("users").document(uid).update({
        "profile_pic_url": None,
        "pic_version": None,
    })

    return {"message": "Profile picture removed"}


# ──────────────────────────────────────────────
# FCM TOKEN MANAGEMENT
# ──────────────────────────────────────────────
from pydantic import BaseModel

class FCMTokenBody(BaseModel):
    token: str

@router.post("/fcm-token")
def register_fcm_token(body: FCMTokenBody, user=Depends(get_current_user)):
    """Register or update an FCM device token for push notifications."""
    uid = user["uid"]
    
    # 1. Remove this token from ANY other user to prevent cross-account notifications
    # on shared devices.
    other_users = db.collection("users").where("fcm_tokens", "array_contains", body.token).stream()
    for u in other_users:
        if u.id != uid:
            existing = u.to_dict().get("fcm_tokens") or []
            updated = [t for t in existing if t != body.token]
            db.collection("users").document(u.id).update({"fcm_tokens": updated})

    # 2. Add it to the current user
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()

    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    existing_tokens = user_doc.to_dict().get("fcm_tokens") or []
    if body.token not in existing_tokens:
        existing_tokens.append(body.token)
        user_ref.update({"fcm_tokens": existing_tokens})

    return {"message": "Token registered"}

@router.delete("/fcm-token")
def unregister_fcm_token(body: FCMTokenBody, user=Depends(get_current_user)):
    """Remove an FCM token (on logout or permission revoke)."""
    uid = user["uid"]
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()

    if user_doc.exists:
        existing_tokens = user_doc.to_dict().get("fcm_tokens") or []
        updated = [t for t in existing_tokens if t != body.token]
        user_ref.update({"fcm_tokens": updated})

    return {"message": "Token removed"}


# ──────────────────────────────────────────────
# PUT /api/auth/update-credentials
# ──────────────────────────────────────────────
@router.put("/update-credentials")
def update_own_credentials(req: SelfUpdateCredentials, user=Depends(get_current_user)):
    """Allow teachers and students to change their own username/mobile or password.
    Admin users are blocked from using this endpoint."""
    uid = user["uid"]
    role = user.get("role", "")

    if role == "admin":
        raise HTTPException(status_code=403, detail="Admins cannot use this endpoint.")

    auth_updates = {}
    firestore_updates = {}

    # Change username/mobile
    if req.new_username and req.new_username.strip():
        new_username = req.new_username.strip().lower()
        new_email = to_firebase_email(new_username)
        auth_updates["email"] = new_email
        firestore_updates["username"] = new_username
        firestore_updates["email"] = new_email

    # Change password
    if req.new_password and req.new_password.strip():
        if len(req.new_password.strip()) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        auth_updates["password"] = req.new_password.strip()

    if not auth_updates:
        raise HTTPException(status_code=400, detail="Nothing to update.")

    # Update Firebase Auth
    try:
        firebase_auth.update_user(uid, **auth_updates)
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=400, detail="This username or mobile number is already in use.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Update failed: {e}")

    # Update Firestore profile
    if firestore_updates:
        firestore_updates["updated_at"] = ts_now()
        db.collection("users").document(uid).update(firestore_updates)

    # Generate a fresh custom token so the frontend can re-authenticate
    # (update_user invalidates existing tokens)
    custom_token = firebase_auth.create_custom_token(uid).decode("utf-8")

    return {"message": "Credentials updated successfully.", "custom_token": custom_token}


# ──────────────────────────────────────────────
# POST /api/auth/session
# ──────────────────────────────────────────────
@router.post("/session")
def register_active_session(req: SessionRegisterRequest, request: Request, user=Depends(get_current_user)):
    """Register a new active device session. Cleans up old ghost sessions (>30 days)."""
    uid = user["uid"]
    session_data = {
        "session_id": req.session_id,
        "device_name": req.device_name,
        "platform": req.platform,
        "created_at": ts_now(),
        "last_active": ts_now(),
    }

    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()

    if user_doc.exists:
        data = user_doc.to_dict()
        active_sessions = data.get("active_sessions", [])

        # Lazy 30-day cleanup of ghost sessions
        now = datetime.fromisoformat(str(ts_now()).replace("Z", "+00:00"))
        valid_sessions = []
        for s in active_sessions:
            try:
                last_active_str = str(s.get("last_active", s.get("created_at", ""))).replace("Z", "+00:00")
                if last_active_str:
                    last_active_dt = datetime.fromisoformat(last_active_str)
                    if (now - last_active_dt).days <= 30:
                        valid_sessions.append(s)
            except Exception:
                pass

        valid_sessions.append(session_data)
        user_ref.update({"active_sessions": valid_sessions})

    return {"message": "Session registered successfully", "session": session_data}


# ──────────────────────────────────────────────
# DELETE /api/auth/session/{session_id}
# ──────────────────────────────────────────────
@router.delete("/session/{session_id}")
def delete_active_session(session_id: str, user=Depends(get_current_user)):
    """Allows a user to explicitly remove their own session (e.g. on logout)."""
    uid = user["uid"]
    target_doc = db.collection("users").document(uid).get()
    if not target_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    data = target_doc.to_dict()
    active_sessions = data.get("active_sessions", [])
    updated_sessions = [s for s in active_sessions if s.get("session_id") != session_id]

    db.collection("users").document(uid).update({
        "active_sessions": updated_sessions
    })

    return {"message": "Session removed successfully"}


# ──────────────────────────────────────────────
# PATCH /api/auth/session/{session_id}/heartbeat
# ──────────────────────────────────────────────
@router.patch("/session/{session_id}/heartbeat")
def session_heartbeat(session_id: str, user=Depends(get_current_user)):
    """Update last_active timestamp for a session. Called when app comes to foreground."""
    uid = user["uid"]
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()

    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    data = user_doc.to_dict()
    active_sessions = data.get("active_sessions", [])
    now = ts_now()

    updated = False
    for s in active_sessions:
        if s.get("session_id") == session_id:
            s["last_active"] = now
            updated = True
            break

    if updated:
        user_ref.update({"active_sessions": active_sessions})

    return {"message": "Heartbeat recorded", "last_active": now}

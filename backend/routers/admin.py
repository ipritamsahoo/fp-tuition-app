"""
FP Finance Admin Router
=================
Endpoints: dashboard stats, payment approval/rejection, batch/student/teacher
CRUD, monthly payment generation, all-payments listing, PDF backup, default admin init.
"""

import io
from datetime import datetime
from typing import Optional

import cloudinary.uploader

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth

from config import DEFAULT_FEE_AMOUNT
from database import db
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from schemas import (
    RegisterRequest, BatchCreate, StudentCreate, TeacherCreate,
    StudentUpdate, TeacherUpdate, GenerateMonthly, UndoMonthly, FeeOverride,
    SettleDistribution, AdminSeed, to_firebase_email, StudentStatusUpdate,
    EmergencyReset,
)
from dependencies import require_role
from utils import ts_now, serialize_doc
from notifications import notify_user, notify_users, notify_admins

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ══════════════════════════════════════════════
#  DASHBOARD
# ══════════════════════════════════════════════

@router.get("/stats")
def admin_stats(user=Depends(require_role("admin"))):
    """Dashboard stats: total students, pending, monthly revenue."""
    # Count students
    student_query = db.collection("users").where("role", "==", "student").count()
    total_students = student_query.get()[0][0].value

    # Count teachers
    teacher_query = db.collection("users").where("role", "==", "teacher").count()
    total_teachers = teacher_query.get()[0][0].value

    # Count batches
    batch_query = db.collection("batches").count()
    total_batches = batch_query.get()[0][0].value

    # Count pending payments
    pending_query = db.collection("payments").where("status", "==", "Pending_Verification").count()
    total_pending = pending_query.get()[0][0].value

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_batches": total_batches,
        "total_pending": total_pending,
    }


# ══════════════════════════════════════════════
#  PAYMENT REVIEW
# ══════════════════════════════════════════════

@router.get("/pending")
def admin_get_pending(user=Depends(require_role("admin"))):
    """Get all payments with Pending_Verification status."""
    payments = db.collection("payments") \
        .where("status", "==", "Pending_Verification") \
        .stream()

    results = []
    student_ids = set()

    for p in payments:
        data = serialize_doc(p)
        # Denormalized fields are already in `data` (batch_name, teacher_name)
        # Provide fallback if missing
        data["batch_name"] = data.get("batch_name", "")
        data["teacher_name"] = data.get("teacher_name", "")
        
        # We need to fetch latest user profile info (email, pip) without N+1 loops
        student_ids.add(data["student_id"])
        results.append(data)

    if student_ids:
        user_refs = [db.collection("users").document(sid) for sid in student_ids]
        student_details = {}
        for i in range(0, len(user_refs), 100):
            docs = db.get_all(user_refs[i:i+100])
            for doc in docs:
                if doc.exists:
                    d = doc.to_dict()
                    student_details[doc.id] = {
                        "student_name": d.get("name", "Unknown"),
                        "student_email": d.get("email", ""),
                        "profile_pic_url": d.get("profile_pic_url"),
                        "pic_version": d.get("pic_version"),
                    }
        
        for p in results:
            sid = p.get("student_id")
            if sid and sid in student_details:
                # Fill in dynamically fetched profile details
                p["student_name"] = p.get("student_name") or student_details[sid]["student_name"]
                p["student_email"] = student_details[sid]["student_email"]
                p["profile_pic_url"] = student_details[sid]["profile_pic_url"]
                p["pic_version"] = student_details[sid]["pic_version"]

    return results


@router.put("/approve/{payment_id}")
def admin_approve(payment_id: str, user=Depends(require_role("admin"))):
    """Approve a pending payment — sets status to Paid, calculates achievement badge,
    deletes the screenshot from Cloudinary."""
    payment_ref = db.collection("payments").document(payment_id)
    payment_doc = payment_ref.get()

    if not payment_doc.exists:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment = payment_doc.to_dict()
    if payment["status"] == "Paid":
        raise HTTPException(status_code=400, detail="Already approved")

    # Delete the screenshot from Cloudinary
    public_id = payment.get("screenshot_public_id", "")
    if public_id:
        try:
            cloudinary.uploader.destroy(public_id)
        except Exception as e:
            print(f"Cloudinary delete failed (approve): {e}")

    # ── Calculate Achievement Badge ──
    # Badge tier is determined by how quickly the student paid after the fee was generated:
    # Prime  → paid within 24 hours
    # Golden → paid within 5 days
    # Silver → paid after 5 days
    badge_tier = None
    created_at_raw = payment.get("created_at")
    requested_at_raw = payment.get("requested_at")
    if created_at_raw and requested_at_raw:
        try:
            # Parse created_at (T1)
            if isinstance(created_at_raw, str):
                t1 = datetime.fromisoformat(created_at_raw)
            elif hasattr(created_at_raw, "isoformat"):
                t1 = created_at_raw
            else:
                t1 = datetime.fromisoformat(str(created_at_raw))

            # Parse requested_at (T2)
            if isinstance(requested_at_raw, str):
                t2 = datetime.fromisoformat(requested_at_raw)
            elif hasattr(requested_at_raw, "isoformat"):
                t2 = requested_at_raw
            else:
                t2 = datetime.fromisoformat(str(requested_at_raw))

            diff_minutes = (t2 - t1).total_seconds() / 60

            if diff_minutes < 1440:      # within 24 hours → Prime
                badge_tier = "prime"
            elif diff_minutes < 7200:    # within 5 days → Golden
                badge_tier = "golden"
            else:                        # after 5 days → Silver
                badge_tier = "silver"
        except Exception as e:
            import traceback
            traceback.print_exc()

    # Fallback: if badge calculation failed for any reason, award silver
    if not badge_tier:
        badge_tier = "silver"

    payment_ref.update({
        "status": "Paid",
        "approved_by": user["uid"],
        "screenshot_url": None,
        "screenshot_public_id": None,
        "updated_at": ts_now(),
    })

    # Save badge on the student's user doc (AuthContext picks this up real-time)
    student_id = payment.get("student_id")
    if student_id:
        try:
            db.collection("users").document(student_id).update({
                "current_badge": badge_tier,
                "badge_month": payment.get("month"),
                "badge_year": payment.get("year"),
                "badge_animation_pending": True,
            })
        except Exception as e:
            print(f"Badge save to user doc failed: {e}")

    # Notify student
    if student_id:
        notify_user(student_id, "Success! Your payment has been approved.", "payment_approved")

    return {"message": "Payment approved", "payment_id": payment_id, "badge_tier": badge_tier}


@router.put("/reject/{payment_id}")
def admin_reject(payment_id: str, user=Depends(require_role("admin"))):
    """Reject a pending payment — resets status to Unpaid and deletes the screenshot from Cloudinary."""
    payment_ref = db.collection("payments").document(payment_id)
    payment_doc = payment_ref.get()

    if not payment_doc.exists:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment = payment_doc.to_dict()

    # Delete the screenshot from Cloudinary
    public_id = payment.get("screenshot_public_id", "")
    if public_id:
        try:
            cloudinary.uploader.destroy(public_id)
        except Exception as e:
            print(f"Cloudinary delete failed (reject): {e}")

    payment_ref.update({
        "status": "Rejected",
        "rejected_by": user["uid"],
        "rejected_at": ts_now(),
        "screenshot_url": None,
        "screenshot_public_id": None,
        "updated_at": ts_now(),
    })

    # Notify student
    student_id = payment.get("student_id")
    if student_id:
        notify_user(student_id, "Payment rejected. Please contact your teacher for details.", "payment_rejected")

    return {"message": "Payment rejected", "payment_id": payment_id}


# ══════════════════════════════════════════════
#  USER PROFILE HELPER
# ══════════════════════════════════════════════

@router.get("/users/{user_id}")
def admin_get_user_profile(user_id: str, user=Depends(require_role("admin"))):
    """Fetch specific user's basic profile details securely, bypassing frontend Firestore rules."""
    user_doc = db.collection("users").document(user_id).get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    d = user_doc.to_dict()
    return {
        "name": d.get("name", "Unknown"),
        "profile_pic_url": d.get("profile_pic_url"),
        "pic_version": d.get("pic_version")
    }

# ══════════════════════════════════════════════
#  PROFILE PIC (ADMIN)
# ══════════════════════════════════════════════

@router.delete("/user/{uid}/profile-pic")
def admin_delete_user_profile_pic(uid: str, user=Depends(require_role("admin"))):
    """Admin-only: Remove any user's profile picture."""
    target_doc = db.collection("users").document(uid).get()
    if not target_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        cloudinary.uploader.destroy(f"fpfinance/profile_pics/{uid}")
    except Exception as e:
        print(f"Cloudinary delete failed: {e}")

    db.collection("users").document(uid).update({
        "profile_pic_url": None,
        "pic_version": None,
    })

    return {"message": f"Profile picture removed for user {uid}"}


# ══════════════════════════════════════════════
#  ACTIVE SESSIONS (ADMIN)
# ══════════════════════════════════════════════

@router.delete("/users/{uid}/sessions/{session_id}")
def admin_delete_user_session(uid: str, session_id: str, user=Depends(require_role("admin"))):
    """Admin-only: Forcefully delete a specific active session from any user."""
    target_doc = db.collection("users").document(uid).get()
    if not target_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    data = target_doc.to_dict()
    active_sessions = data.get("active_sessions", [])
    updated_sessions = [s for s in active_sessions if s.get("session_id") != session_id]

    db.collection("users").document(uid).update({
        "active_sessions": updated_sessions
    })

    return {"message": "Session forcefully terminated"}


# ══════════════════════════════════════════════
#  BATCH MANAGEMENT
# ══════════════════════════════════════════════

@router.get("/batches")
def admin_list_batches(user=Depends(require_role("admin"))):
    """List all batches.
    student_count is read directly from the denormalized field on the batch
    document — no extra query per batch."""
    # Pre-fetch all teacher names into a dictionary to avoid N+1 reads
    teachers = db.collection("users").where("role", "==", "teacher").stream()
    teacher_map = {t.id: t.to_dict().get("name", t.id) for t in teachers}

    batches = db.collection("batches").stream()
    results = []
    for b in batches:
        data = serialize_doc(b)

        # Read pre-computed count — zero extra queries
        data["student_count"] = data.get("student_count", 0)

        # Get teacher names directly from local map
        teacher_names = []
        for tid in data.get("teacher_ids", []):
            teacher_names.append(teacher_map.get(tid, tid))

        data["teacher_names"] = teacher_names
        results.append(data)
    return results


@router.post("/batches")
def admin_create_batch(req: BatchCreate, user=Depends(require_role("admin"))):
    """Create a new batch."""
    batch_name_clean = req.batch_name.strip()
    
    # Check for duplicate
    existing = db.collection("batches").where("batch_name", "==", batch_name_clean).limit(1).stream()
    if any(existing):
        raise HTTPException(status_code=400, detail=f"A batch named '{batch_name_clean}' already exists.")

    batch_data = {
        "batch_name": batch_name_clean,
        "teacher_ids": req.teacher_ids,
        "created_at": ts_now(),
    }
    if req.batch_fee is not None:
        batch_data["batch_fee"] = req.batch_fee
    _, doc_ref = db.collection("batches").add(batch_data)
    return {"id": doc_ref.id, "message": f"Batch '{batch_name_clean}' created"}


@router.put("/batches/{batch_id}")
def admin_update_batch(batch_id: str, req: BatchCreate, user=Depends(require_role("admin"))):
    """Update a batch."""
    batch_ref = db.collection("batches").document(batch_id)
    if not batch_ref.get().exists:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch_name_clean = req.batch_name.strip()

    # Check for duplicate
    existing = db.collection("batches").where("batch_name", "==", batch_name_clean).limit(2).stream()
    for b in existing:
        if b.id != batch_id:
            raise HTTPException(status_code=400, detail=f"A batch named '{batch_name_clean}' already exists.")

    update_data = {
        "batch_name": batch_name_clean,
        "teacher_ids": req.teacher_ids,
    }
    if req.batch_fee is not None:
        update_data["batch_fee"] = req.batch_fee
    else:
        update_data["batch_fee"] = firestore.DELETE_FIELD
    batch_ref.update(update_data)
    return {"message": f"Batch '{batch_name_clean}' updated"}


@router.delete("/batches/{batch_id}")
def admin_delete_batch(batch_id: str, user=Depends(require_role("admin"))):
    """Delete a batch and all associated students, payments, and images."""
    batch_ref = db.collection("batches").document(batch_id)
    batch_doc = batch_ref.get()
    if not batch_doc.exists:
        raise HTTPException(status_code=404, detail="Batch not found")

    # 1. CLEANUP STUDENTS
    # Find all students in this batch
    students = db.collection("users") \
        .where("batch_id", "==", batch_id) \
        .where("role", "==", "student") \
        .stream()
    
    for s in students:
        uid = s.id
        # Delete profile picture from Cloudinary
        try:
            cloudinary.uploader.destroy(f"fpfinance/profile_pics/{uid}")
        except Exception as e:
            print(f"Cloudinary profile pic delete failed for {uid}: {e}")
        
        # Delete from Firebase Auth
        try:
            firebase_auth.delete_user(uid)
        except Exception as e:
            print(f"Firebase Auth delete failed for {uid}: {e}")
        
        # Delete Student document
        db.collection("users").document(uid).delete()

    # 2. CLEANUP PAYMENTS
    # Find all payments in this batch
    payments = db.collection("payments").where("batch_id", "==", batch_id).stream()
    for p in payments:
        pd = p.to_dict()
        # Delete screenshot from Cloudinary if exists
        pub_id = pd.get("screenshot_public_id")
        if pub_id:
            try:
                cloudinary.uploader.destroy(pub_id)
            except Exception as e:
                print(f"Cloudinary payment screenshot delete failed: {e}")
        
        # Delete payment document
        db.collection("payments").document(p.id).delete()

    # 3. CLEANUP DISTRIBUTION SNAPSHOTS
    snapshots = db.collection("distribution_snapshots").where("batch_id", "==", batch_id).stream()
    for snap in snapshots:
        db.collection("distribution_snapshots").document(snap.id).delete()

    # 4. FINALIZE: Delete the batch itself
    batch_ref.delete()

    return {"message": "Batch and all associated data deleted successfully"}


# ══════════════════════════════════════════════
#  STUDENT MANAGEMENT
# ══════════════════════════════════════════════

def _auto_generate_for_student(student_id: str, student_name: str, batch_id: str) -> int:
    """Auto-generate unpaid payment records for a student by looking at
    which (month, year) combos already exist for other students in the same batch.
    Uses the denormalized `generated_months` field on the batch document instead
    of scanning the entire payments collection — O(1) reads instead of O(N).
    Returns the number of records created."""
    if not batch_id:
        return 0

    # Single read: batch doc contains teachers + fee + generated_months
    batch_doc = db.collection("batches").document(batch_id).get()
    if not batch_doc.exists:
        return 0
    batch_data = batch_doc.to_dict()
    if not batch_data.get("teacher_ids"):
        return 0

    # Read pre-computed list of generated months — no payment scan needed
    generated_months = batch_data.get("generated_months", [])
    if not generated_months:
        return 0

    # Convert to set of (month, year) tuples
    existing_months = {(entry["month"], entry["year"]) for entry in generated_months}

    # Determine the fee (already have batch_data, no extra read needed)
    student_doc = db.collection("users").document(student_id).get()
    student_data = student_doc.to_dict() if student_doc.exists else {}

    if student_data.get("is_disabled"):
        return 0

    student_custom_fee = student_data.get("custom_fee")
    if student_custom_fee is not None:
        fee = student_custom_fee
    else:
        batch_fee = batch_data.get("batch_fee")
        fee = batch_fee if batch_fee is not None else DEFAULT_FEE_AMOUNT

    created = 0
    for (month, year) in existing_months:
        # Skip if this student already has a record for this month
        existing = list(
            db.collection("payments")
            .where("student_id", "==", student_id)
            .where("month", "==", month)
            .where("year", "==", year)
            .limit(1)
            .stream()
        )
        if existing:
            continue

        db.collection("payments").add({
            "student_id": student_id,
            "student_name": student_name,
            "batch_id": batch_id,
            "batch_name": batch_data.get("batch_name", "Unknown"),
            "month": month,
            "year": year,
            "amount": fee,
            "mode": None,
            "screenshot_url": None,
            "requested_by_teacher": None,
            "status": "Unpaid",
            "created_at": ts_now(),
            "updated_at": ts_now(),
        })
        created += 1

    return created


@router.get("/students")
def admin_list_students(
    batch_id: Optional[str] = None,
    user=Depends(require_role("admin")),
):
    """List all students, optionally filtered by batch."""
    # 1. Pre-fetch batches and create a map
    batch_map = {}
    for batch in db.collection("batches").stream():
        batch_map[batch.id] = batch.to_dict().get("batch_name", "")

    # 2. Query students
    query = db.collection("users").where("role", "==", "student")
    if batch_id:
        query = query.where("batch_id", "==", batch_id)

    students = query.stream()
    results = []
    for s in students:
        data = serialize_doc(s)
        data["uid"] = s.id
        
        # Fast lookup from the pre-fetched dictionary
        b_id = data.get("batch_id")
        data["batch_name"] = batch_map.get(b_id, "")
        
        results.append(data)

    # Sort students alphabetically by name
    results.sort(key=lambda x: x.get("name", "").lower())
    
    return results


@router.post("/students")
def admin_add_student(req: StudentCreate, user=Depends(require_role("admin"))):
    """Create a new student user."""
    email = to_firebase_email(req.username)
    try:
        fb_user = firebase_auth.create_user(
            email=email,
            password=req.password,
            display_name=req.name,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=400, detail="This username or mobile number is already in use.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    firebase_auth.set_custom_user_claims(fb_user.uid, {"role": "student"})

    user_doc = {
        "name": req.name,
        "username": req.username.strip().lower(),
        "email": email,
        "role": "student",
        "batch_id": req.batch_id,
        "created_at": ts_now(),
    }
    db.collection("users").document(fb_user.uid).set(user_doc)

    # Increment the denormalized student_count on the batch document
    if req.batch_id:
        db.collection("batches").document(req.batch_id).update({
            "student_count": firestore.Increment(1)
        })

    # Auto-generate payment records for months already generated in this batch
    auto_created = _auto_generate_for_student(fb_user.uid, req.name, req.batch_id)

    msg = f"Student '{req.name}' added"
    if auto_created > 0:
        msg += f" — {auto_created} payment record(s) auto-generated for existing months."
    return {"uid": fb_user.uid, "message": msg}


@router.put("/students/{uid}")
def admin_update_student(uid: str, req: StudentUpdate, user=Depends(require_role("admin"))):
    """Update a student's details. Optionally reset their password.
    When custom_fee changes, all Unpaid payment records are synced automatically."""
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")

    student_data = user_doc.to_dict()

    # Build Firestore update dict (only non-None fields)
    update_data = {}
    if req.name is not None:
        update_data["name"] = req.name
    if req.username is not None:
        new_email = to_firebase_email(req.username)
        update_data["username"] = req.username.strip().lower()
        update_data["email"] = new_email
    if req.batch_id is not None:
        update_data["batch_id"] = req.batch_id

    # Handle custom fee: clear or set
    fee_changed = False
    new_effective_fee = None

    if req.clear_custom_fee:
        update_data["custom_fee"] = firestore.DELETE_FIELD
        fee_changed = True
        # Revert to default
        new_effective_fee = DEFAULT_FEE_AMOUNT
    elif req.custom_fee is not None:
        update_data["custom_fee"] = req.custom_fee
        if req.custom_fee != student_data.get("custom_fee"):
            fee_changed = True
            new_effective_fee = req.custom_fee

    if update_data:
        user_ref.update(update_data)

    # Sync all Unpaid payment records to the new fee
    if fee_changed and new_effective_fee is not None:
        unpaid_payments = db.collection("payments") \
            .where("student_id", "==", uid) \
            .where("status", "==", "Unpaid") \
            .stream()
        for p in unpaid_payments:
            db.collection("payments").document(p.id).update({
                "amount": new_effective_fee,
                "updated_at": ts_now(),
            })

    # Update student_count on batch documents if batch changed
    auto_created = 0
    new_batch_id = req.batch_id
    old_batch_id = student_data.get("batch_id")
    if new_batch_id is not None and new_batch_id != old_batch_id:
        # Decrement old batch, increment new batch
        if old_batch_id:
            db.collection("batches").document(old_batch_id).update({
                "student_count": firestore.Increment(-1)
            })
        db.collection("batches").document(new_batch_id).update({
            "student_count": firestore.Increment(1)
        })
        student_name = req.name or student_data.get("name", "")
        auto_created = _auto_generate_for_student(uid, student_name, new_batch_id)

    # Update Firebase Auth (username/email, password, display_name)
    auth_updates = {}
    if req.name is not None:
        auth_updates["display_name"] = req.name
    if req.username is not None:
        auth_updates["email"] = to_firebase_email(req.username)
    if req.password is not None and req.password.strip():
        auth_updates["password"] = req.password

    if auth_updates:
        try:
            firebase_auth.update_user(uid, **auth_updates)
        except firebase_auth.EmailAlreadyExistsError:
            raise HTTPException(status_code=400, detail="This username or mobile number is already in use.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Firebase Auth update failed: {e}")

    msg = "Student updated successfully"
    if auto_created > 0:
        msg += f" — {auto_created} payment record(s) auto-generated for existing months."
    return {"message": msg}


@router.put("/students/{uid}/status")
def admin_update_student_status(uid: str, req: StudentStatusUpdate, user=Depends(require_role("admin"))):
    """Enable or disable a student account.
    Disabling also logs them out by clearing active_sessions."""
    user_ref = db.collection("users").document(uid)
    if not user_ref.get().exists:
        raise HTTPException(status_code=404, detail="Student not found")

    # Update Firestore
    update_data = {"is_disabled": req.is_disabled}

    # If disabling, terminate all sessions
    if req.is_disabled:
        update_data["active_sessions"] = []

    user_ref.update(update_data)

    # Update Firebase Auth status
    try:
        firebase_auth.update_user(uid, disabled=req.is_disabled)
    except Exception as e:
        print(f"Firebase Auth status update failed: {e}")

    status_txt = "disabled" if req.is_disabled else "enabled"
    return {"message": f"Student account {status_txt}"}





# ══════════════════════════════════════════════
#  TEACHER MANAGEMENT
# ══════════════════════════════════════════════

@router.get("/teachers")
def admin_list_teachers(user=Depends(require_role("admin"))):
    """List all teachers with their assigned batches."""
    # Pre-fetch all batches into memory
    all_batches = []
    for b in db.collection("batches").stream():
        b_data = b.to_dict()
        b_data["id"] = b.id
        all_batches.append(b_data)

    teachers = db.collection("users").where("role", "==", "teacher").stream()
    results = []
    for t in teachers:
        data = serialize_doc(t)
        data["uid"] = t.id
        
        # Find batches assigned to this teacher using local data
        assigned_batches = []
        for b in all_batches:
            if t.id in b.get("teacher_ids", []):
                assigned_batches.append({"id": b["id"], "batch_name": b.get("batch_name", "")})
                
        data["assigned_batches"] = assigned_batches
        results.append(data)
    return results


@router.post("/teachers")
def admin_add_teacher(req: TeacherCreate, user=Depends(require_role("admin"))):
    """Create a new teacher user and optionally assign to batches."""
    email = to_firebase_email(req.username)
    try:
        fb_user = firebase_auth.create_user(
            email=email,
            password=req.password,
            display_name=req.name,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=400, detail="This username or mobile number is already in use.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    firebase_auth.set_custom_user_claims(fb_user.uid, {"role": "teacher"})

    user_doc = {
        "name": req.name,
        "username": req.username.strip().lower(),
        "email": email,
        "role": "teacher",
        "batch_id": None,
        "created_at": ts_now(),
    }
    db.collection("users").document(fb_user.uid).set(user_doc)

    # Assign to batches
    for batch_id in req.batch_ids:
        batch_ref = db.collection("batches").document(batch_id)
        batch_doc = batch_ref.get()
        if batch_doc.exists:
            batch_data = batch_doc.to_dict()
            teacher_ids = batch_data.get("teacher_ids", [])
            if fb_user.uid not in teacher_ids:
                teacher_ids.append(fb_user.uid)
                batch_ref.update({"teacher_ids": teacher_ids})

    return {"uid": fb_user.uid, "message": f"Teacher '{req.name}' added"}


@router.put("/teachers/{uid}")
def admin_update_teacher(uid: str, req: TeacherUpdate, user=Depends(require_role("admin"))):
    """Update a teacher's details. Optionally reset their password."""
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="Teacher not found")

    # Build Firestore update dict
    update_data = {}
    if req.name is not None:
        update_data["name"] = req.name
    if req.username is not None:
        new_email = to_firebase_email(req.username)
        update_data["username"] = req.username.strip().lower()
        update_data["email"] = new_email

    if update_data:
        user_ref.update(update_data)

    # Handle batch reassignment
    if req.batch_ids is not None:
        # Remove teacher from all current batches
        current_batches = db.collection("batches") \
            .where("teacher_ids", "array_contains", uid) \
            .stream()
        for b in current_batches:
            batch_data = b.to_dict()
            teacher_ids = [tid for tid in batch_data.get("teacher_ids", []) if tid != uid]
            db.collection("batches").document(b.id).update({"teacher_ids": teacher_ids})

        # Add teacher to new batches
        for batch_id in req.batch_ids:
            batch_ref = db.collection("batches").document(batch_id)
            batch_doc = batch_ref.get()
            if batch_doc.exists:
                batch_data = batch_doc.to_dict()
                teacher_ids = batch_data.get("teacher_ids", [])
                if uid not in teacher_ids:
                    teacher_ids.append(uid)
                    batch_ref.update({"teacher_ids": teacher_ids})

    # Update Firebase Auth (username/email, password, display_name)
    auth_updates = {}
    if req.name is not None:
        auth_updates["display_name"] = req.name
    if req.username is not None:
        auth_updates["email"] = to_firebase_email(req.username)
    if req.password is not None and req.password.strip():
        auth_updates["password"] = req.password

    if auth_updates:
        try:
            firebase_auth.update_user(uid, **auth_updates)
        except firebase_auth.EmailAlreadyExistsError:
            raise HTTPException(status_code=400, detail="This username or mobile number is already in use.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Firebase Auth update failed: {e}")

    return {"message": "Teacher updated successfully"}


@router.delete("/teachers/{uid}")
def admin_remove_teacher(uid: str, user=Depends(require_role("admin"))):
    """Remove a teacher and unassign from all batches."""
    # Remove from all batches
    batches = db.collection("batches") \
        .where("teacher_ids", "array_contains", uid) \
        .stream()
    for b in batches:
        batch_data = b.to_dict()
        teacher_ids = batch_data.get("teacher_ids", [])
        teacher_ids = [tid for tid in teacher_ids if tid != uid]
        db.collection("batches").document(b.id).update({"teacher_ids": teacher_ids})

    # Delete Firestore doc
    db.collection("users").document(uid).delete()

    # Delete from Firebase Auth
    try:
        firebase_auth.delete_user(uid)
    except Exception:
        pass

    return {"message": "Teacher removed"}


# ══════════════════════════════════════════════
#  PAYMENT GENERATION
# ══════════════════════════════════════════════

@router.post("/generate-monthly")
def admin_generate_monthly(req: GenerateMonthly, user=Depends(require_role("admin"))):
    """Generate unpaid payment records for students for a given month/year.
    If batch_id is provided, only generate for that batch; otherwise for all students.
    Fee hierarchy: student.custom_fee → batch.batch_fee → req.amount → DEFAULT_FEE_AMOUNT."""

    # If a specific batch is selected, validate it has both teachers and students
    if req.batch_id:
        batch_check = db.collection("batches").document(req.batch_id).get()
        if batch_check.exists:
            batch_info = batch_check.to_dict()
            batch_name = batch_info.get("batch_name", "Unknown")
            has_teachers = bool(batch_info.get("teacher_ids"))

            student_count = sum(1 for _ in db.collection("users")
                .where("role", "==", "student")
                .where("batch_id", "==", req.batch_id)
                .stream())
            has_students = student_count > 0

            if not has_teachers and not has_students:
                return {
                    "message": f"Cannot generate fees for batch '{batch_name}' — no students and no teachers found. Add both first.",
                    "created": 0,
                    "skipped": 0,
                }
            if not has_teachers:
                return {
                    "message": f"Cannot generate fees for batch '{batch_name}' — no teachers assigned. Assign at least one teacher first.",
                    "created": 0,
                    "skipped": 0,
                }
            if not has_students:
                return {
                    "message": f"Cannot generate fees for batch '{batch_name}' — no students found. Add students first, and they will auto-receive payment records.",
                    "created": 0,
                    "skipped": 0,
                }

    fallback_amount = req.amount or DEFAULT_FEE_AMOUNT

    # ── Reset all student badges for the target scope ──
    # Only target ACTIVE students
    reset_query = db.collection("users") \
        .where("role", "==", "student")

    if req.batch_id:
        reset_query = reset_query.where("batch_id", "==", req.batch_id)

    # Note: We reset badges ONLY for active students to avoid unnecessary writes
    # and because disabled students shouldn't be in the badge calculation loop.
    badges_reset = 0
    for s in reset_query.stream():
        data = s.to_dict()
        if data.get("is_disabled"):
            continue

        if data.get("current_badge"):
            db.collection("users").document(s.id).update({
                "current_badge": None,
                "badge_month": None,
                "badge_year": None,
            })
            badges_reset += 1
    if badges_reset > 0:
        print(f"Badge reset: cleared {badges_reset} student badge(s)")

    # Filter students by batch if specified
    query = db.collection("users").where("role", "==", "student")
    if req.batch_id:
        query = query.where("batch_id", "==", req.batch_id)

    students = query.stream()
    student_list = list(students)

    created = 0
    skipped = 0

    batch_cache = {}
    notified_students = []

    for s in student_list:
        student = s.to_dict()
        student_id = s.id

        if student.get("is_disabled"):
            skipped += 1
            continue

        # Check if payment already exists
        existing = db.collection("payments") \
            .where("student_id", "==", student_id) \
            .where("month", "==", req.month) \
            .where("year", "==", req.year) \
            .limit(1) \
            .stream()

        if list(existing):
            skipped += 1
            continue

        # Determine fee using hierarchy: custom_fee → batch_fee → fallback
        student_custom_fee = student.get("custom_fee")
        student_batch_id = student.get("batch_id", "")
        batch_name_val = "Unknown"
        if student_custom_fee is not None:
            final_amount = student_custom_fee
        elif student_batch_id:
            if student_batch_id not in batch_cache:
                batch_doc = db.collection("batches").document(student_batch_id).get()
                batch_cache[student_batch_id] = batch_doc.to_dict() if batch_doc.exists else {}
            b_data = batch_cache[student_batch_id]
            batch_fee = b_data.get("batch_fee")
            batch_name_val = b_data.get("batch_name", "Unknown")
            final_amount = batch_fee if batch_fee is not None else fallback_amount
        else:
            final_amount = fallback_amount

        payment_data = {
            "student_id": student_id,
            "student_name": student.get("name", ""),
            "batch_id": student_batch_id,
            "batch_name": batch_name_val,
            "month": req.month,
            "year": req.year,
            "amount": final_amount,
            "mode": None,
            "screenshot_url": None,
            "requested_by_teacher": None,
            "status": "Unpaid",
            "created_at": ts_now(),
            "updated_at": ts_now(),
        }
        db.collection("payments").add(payment_data)
        created += 1
        
        # Track for notifications using already fetched data
        notified_students.append({
            "uid": student_id,
            "tokens": student.get("fcm_tokens", [])
        })

    batch_label = ""
    if req.batch_id:
        batch_doc = db.collection("batches").document(req.batch_id).get()
        if batch_doc.exists:
            batch_label = f" for batch '{batch_doc.to_dict().get('batch_name', '')}'"

    # Notify students who got new bills
    if notified_students:
        MONTHS_NOTIF = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]
        month_name = MONTHS_NOTIF[req.month - 1] if 1 <= req.month <= 12 else str(req.month)
        
        from notifications import notify_user
        for ns in notified_students:
            notify_user(
                ns["uid"],
                f"Your fee for {month_name} {req.year} has been generated.",
                "bill_generated",
                tokens=ns["tokens"]
            )

    # Update generated_months on the affected batch document(s)
    if created > 0:
        month_entry = {"month": req.month, "year": req.year}
        if req.batch_id:
            db.collection("batches").document(req.batch_id).update({
                "generated_months": firestore.ArrayUnion([month_entry])
            })
        else:
            # All batches that received new payment records
            affected_batch_ids = {
                s.to_dict().get("batch_id", "")
                for s in student_list
                if s.to_dict().get("batch_id")
            }
            for bid in affected_batch_ids:
                db.collection("batches").document(bid).update({
                    "generated_months": firestore.ArrayUnion([month_entry])
                })

    return {
        "message": f"Generated {created} payment records{batch_label}, skipped {skipped} existing",
        "created": created,
        "skipped": skipped,
    }


@router.post("/undo-monthly")
def admin_undo_monthly(req: UndoMonthly, user=Depends(require_role("admin"))):
    """Undo (delete) generated Unpaid payment records for a given month/year.
    Only removes records with status == 'Unpaid' so paid/pending records are safe."""

    query = db.collection("payments") \
        .where("month", "==", req.month) \
        .where("year", "==", req.year) \
        .where("status", "==", "Unpaid")

    if req.batch_id:
        query = query.where("batch_id", "==", req.batch_id)

    docs = list(query.stream())
    deleted = 0
    for doc in docs:
        doc.reference.delete()
        deleted += 1

    MONTH_NAMES = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    month_name = MONTH_NAMES[req.month - 1] if 1 <= req.month <= 12 else str(req.month)

    batch_label = ""
    if req.batch_id:
        batch_doc = db.collection("batches").document(req.batch_id).get()
        if batch_doc.exists:
            batch_label = f" for batch '{batch_doc.to_dict().get('batch_name', '')}'"

    # If ALL Unpaid records for this month/batch are deleted, remove from generated_months
    # Check: are there any remaining non-Unpaid records for this month in this batch?
    if req.batch_id and deleted > 0:
        remaining = list(
            db.collection("payments")
            .where("batch_id", "==", req.batch_id)
            .where("month", "==", req.month)
            .where("year", "==", req.year)
            .limit(1)
            .stream()
        )
        if not remaining:
            # No records left for this month — remove from generated_months
            db.collection("batches").document(req.batch_id).update({
                "generated_months": firestore.ArrayRemove([{"month": req.month, "year": req.year}])
            })

    return {
        "message": f"Removed {deleted} unpaid record(s) for {month_name} {req.year}{batch_label}",
        "deleted": deleted,
    }


# ══════════════════════════════════════════════
#  FEE OVERRIDE
# ══════════════════════════════════════════════

@router.post("/fee-override")
def admin_fee_override(req: FeeOverride, user=Depends(require_role("admin"))):
    """Override a student's fee in two modes:
    - 'all-time': Update profile custom_fee + sync all Unpaid records.
    - 'specific-month': Update only one targeted payment record.
    Paid records are never modified."""

    if req.mode not in ("all-time", "specific-month"):
        raise HTTPException(status_code=400, detail="Mode must be 'all-time' or 'specific-month'")

    # Verify the student exists
    student_ref = db.collection("users").document(req.student_id)
    student_doc = student_ref.get()
    if not student_doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")

    # ── MODE 1: ALL-TIME ──
    if req.mode == "all-time":
        # 1. Update the student's profile custom_fee
        student_ref.update({"custom_fee": req.amount})

        # 2. Sync all Unpaid payment records
        unpaid_payments = list(
            db.collection("payments")
            .where("student_id", "==", req.student_id)
            .where("status", "==", "Unpaid")
            .stream()
        )

        updated_count = 0
        for p in unpaid_payments:
            db.collection("payments").document(p.id).update({
                "amount": req.amount,
                "updated_at": ts_now(),
            })
            updated_count += 1

        return {
            "message": f"Permanent fee set to ₹{req.amount}. Updated {updated_count} unpaid record(s).",
            "custom_fee": req.amount,
            "records_updated": updated_count,
        }

    # ── MODE 2: SPECIFIC MONTH ──
    if req.month is None or req.year is None:
        raise HTTPException(
            status_code=400,
            detail="Month and year are required for 'specific-month' mode.",
        )

    # Find the targeted payment record
    target_payments = list(
        db.collection("payments")
        .where("student_id", "==", req.student_id)
        .where("month", "==", req.month)
        .where("year", "==", req.year)
        .limit(1)
        .stream()
    )

    if not target_payments:
        MONTHS = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]
        month_label = MONTHS[req.month - 1] if 1 <= req.month <= 12 else str(req.month)
        raise HTTPException(
            status_code=404,
            detail=f"No payment record found for {month_label} {req.year}. Generate the month first.",
        )

    payment = target_payments[0]
    payment_data = payment.to_dict()

    if payment_data.get("status") == "Paid":
        raise HTTPException(
            status_code=400,
            detail="Cannot modify a Paid record. Financial history is locked.",
        )

    # Update only this record's amount
    old_amount = payment_data.get("amount", 0)
    db.collection("payments").document(payment.id).update({
        "amount": req.amount,
        "updated_at": ts_now(),
    })

    MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    month_label = MONTHS[req.month - 1] if 1 <= req.month <= 12 else str(req.month)

    return {
        "message": f"Fee for {month_label} {req.year} updated from ₹{old_amount} to ₹{req.amount}.",
        "old_amount": old_amount,
        "new_amount": req.amount,
        "records_updated": 1,
    }


# ══════════════════════════════════════════════
#  ALL PAYMENTS
# ══════════════════════════════════════════════

@router.get("/payments")
def admin_all_payments(
    batch_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    user=Depends(require_role("admin")),
):
    """Get all payments with optional filters."""
    query = db.collection("payments")

    if batch_id:
        query = query.where("batch_id", "==", batch_id)
    if month:
        query = query.where("month", "==", month)
    if year:
        query = query.where("year", "==", year)
    if status:
        query = query.where("status", "==", status)

    payments = query.stream()
    results = [serialize_doc(p) for p in payments]

    # Rely completely on denormalized `student_name` already present inside the payment document.

    return results

# ══════════════════════════════════════════════
#  REVENUE DISTRIBUTION
# ══════════════════════════════════════════════

@router.get("/distribution")
def admin_distribution(
    month: int,
    year: int,
    batch_id: Optional[str] = None,
    user=Depends(require_role("admin")),
):
    """Calculate revenue distribution among teachers for a given fee month/year.
    Groups paid payments by batch and splits revenue among assigned teachers.
    Optionally filter by batch_id."""

    # 1. Query paid payments for this fee month/year (+ optional batch filter)
    # This is used for the individual date/payment listings
    query = db.collection("payments") \
        .where(filter=FieldFilter("status", "==", "Paid")) \
        .where(filter=FieldFilter("month", "==", month)) \
        .where(filter=FieldFilter("year", "==", year))
    if batch_id:
        query = query.where(filter=FieldFilter("batch_id", "==", batch_id))

    matching_payments = [serialize_doc(p) for p in query.stream()]

    # 2. Fetch settlement snapshots for summary aggregation
    snapshot_query = db.collection("distribution_snapshots") \
        .where(filter=FieldFilter("month", "==", month)) \
        .where(filter=FieldFilter("year", "==", year))
    if batch_id:
        snapshot_query = snapshot_query.where(filter=FieldFilter("batch_id", "==", batch_id))

    settled_dates = {}
    snapshots_list = []
    for snap in snapshot_query.stream():
        sd = snap.to_dict()
        settled_dates[sd["date"]] = sd
        snapshots_list.append(sd)

    # 3. Calculate Summary Totals from Snapshots ONLY
    total_collected = 0
    teacher_acc = {}  # uid -> { name, total }

    for snap in snapshots_list:
        total_collected = round(total_collected + snap.get("total", 0), 2)

        # Aggregate Teacher Totals
        for t in snap.get("teachers", []):
            tid = t["uid"]
            tname = t["name"]
            tamount = t["amount"]
            if tid not in teacher_acc:
                teacher_acc[tid] = {"uid": tid, "name": tname, "total": 0}
            teacher_acc[tid]["total"] = round(teacher_acc[tid]["total"] + tamount, 2)

    teacher_totals = list(teacher_acc.values())
    teacher_totals.sort(key=lambda t: t["total"], reverse=True)

    # 4. Build date-wise distribution (from all paid payments)
    payments_by_date = {}
    for p in matching_payments:
        updated_at = p.get("updated_at", "")
        date_key = str(updated_at)[:10] if updated_at else "unknown"
        payments_by_date.setdefault(date_key, []).append(p)

    date_results = []
    for date_str in sorted(payments_by_date.keys(), reverse=True):
        dp = payments_by_date[date_str]
        
        if date_str in settled_dates:
            snap = settled_dates[date_str]
            date_results.append({
                "date": date_str,
                "total": snap.get("total", 0),
                "payments_count": len(dp),
                "teachers": snap.get("teachers", []),
                "payments": dp,
                "settled": True,
                "settled_at": snap.get("settled_at", ""),
            })
        else:
            # Unsettled - Volume is student payments, but Teacher details are empty
            date_total = sum(x.get("amount", 0) for x in dp)
            date_results.append({
                "date": date_str,
                "total": date_total,
                "payments_count": len(dp),
                "teachers": [], # No teacher details if not settled
                "payments": dp,
                "settled": False,
            })

    # 5. Calculate total unique teachers shared in the current selection
    all_shared_teacher_ids = set()
    if batch_id and batch_id != "unassigned":
        b_doc = db.collection("batches").document(batch_id).get()
        if b_doc.exists:
            for tid in b_doc.to_dict().get("teacher_ids", []):
                all_shared_teacher_ids.add(tid)
    else:
        # If no specific batch filtered, fetch all teachers from all batches
        batches_stream = db.collection("batches").stream()
        for b in batches_stream:
            for tid in b.to_dict().get("teacher_ids", []):
                all_shared_teacher_ids.add(tid)
    
    total_teachers_shared = len(all_shared_teacher_ids)

    return {
        "total_collected": total_collected,
        "teacher_totals": teacher_totals,
        "total_teachers_shared": total_teachers_shared,
        "dates": date_results,
    }


# ══════════════════════════════════════════════
#  SETTLE / UNSETTLE DISTRIBUTION
# ══════════════════════════════════════════════

@router.post("/settle-distribution")
def admin_settle_distribution(req: SettleDistribution, user=Depends(require_role("admin"))):
    """Freeze a date's distribution as a permanent snapshot.
    Once settled, teacher changes won't affect this date's records."""
    from datetime import datetime
    from utils import IST
    
    # 1. Date Validation: Block same-day settlements
    today_str = datetime.now(IST).strftime("%Y-%m-%d")
    if req.date >= today_str:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot settle revenue for today ({req.date}). Please wait until tomorrow."
        )

    # Check if already settled
    existing = db.collection("distribution_snapshots") \
        .where(filter=FieldFilter("date", "==", req.date)) \
        .where(filter=FieldFilter("month", "==", req.month)) \
        .where(filter=FieldFilter("year", "==", req.year))
    if req.batch_id:
        existing = existing.where(filter=FieldFilter("batch_id", "==", req.batch_id))

    if list(existing.limit(1).stream()):
        raise HTTPException(status_code=400, detail="This date is already settled.")

    # Re-calculate distribution for this specific date using updated_at range
    # This drastically reduces reads by only bringing in today's payments.
    # It requires a Firebase Composite Index: Collection 'payments' -> 'status' (Asc) + 'updated_at' (Asc)
    query = db.collection("payments") \
        .where(filter=FieldFilter("status", "==", "Paid")) \
        .where(filter=FieldFilter("updated_at", ">=", req.date)) \
        .where(filter=FieldFilter("updated_at", "<=", f"{req.date}T23:59:59"))
        
    all_selected_payments = [serialize_doc(p) for p in query.stream()]
    
    # Filter by batch_id AND month/year in memory.
    # month+year filter is critical: the updated_at range query fetches ALL payments
    # approved on that date regardless of fee month. Without this filter, settling
    # April 13 while viewing "March 2026" would incorrectly include April 2026 fee
    # payments also approved that day — causing totals to conflict across months.
    date_payments = []
    for p in all_selected_payments:
        if req.batch_id and p.get("batch_id") != req.batch_id:
            continue
        if p.get("month") != req.month or p.get("year") != req.year:
            continue
        date_payments.append(p)

    if not date_payments:
        raise HTTPException(status_code=404, detail="No payments found for this date.")

    # Group by batch and calculate teacher shares
    date_by_batch = {}
    for p in date_payments:
        bid = p.get("batch_id", "unassigned")
        date_by_batch.setdefault(bid, []).append(p)

    date_total = sum(p.get("amount", 0) for p in date_payments)
    teacher_earnings = {}
    
    # Request-level cache to prevent duplicate reads for the same teacher or batch
    cache_batches = {}
    cache_users = {}

    for bid, bp in date_by_batch.items():
        bt = sum(x.get("amount", 0) for x in bp)
        tids = []
        if bid != "unassigned":
            if bid not in cache_batches:
                b_doc = db.collection("batches").document(bid).get()
                cache_batches[bid] = b_doc.to_dict() if b_doc.exists else {}
                
            tids = cache_batches[bid].get("teacher_ids", [])
            
        tc = len(tids)
        pt = round(bt / tc, 2) if tc > 0 else 0
        
        for tid in tids:
            if tid not in cache_users:
                t_doc = db.collection("users").document(tid).get()
                cache_users[tid] = t_doc.to_dict() if t_doc.exists else {}
                
            t_name = cache_users[tid].get("name", "Unknown")
            
            if tid not in teacher_earnings:
                teacher_earnings[tid] = {"name": t_name, "total": 0}
            teacher_earnings[tid]["total"] = round(
                teacher_earnings[tid]["total"] + pt, 2
            )

    teachers_snapshot = [
        {"uid": uid, "name": info["name"], "amount": info["total"]}
        for uid, info in teacher_earnings.items()
    ]
    teachers_snapshot.sort(key=lambda t: t["amount"], reverse=True)

    # Save the snapshot
    snapshot_data = {
        "date": req.date,
        "month": req.month,
        "year": req.year,
        "batch_id": req.batch_id,
        "total": date_total,
        "payments_count": len(date_payments),
        "teachers": teachers_snapshot,
        "settled_by": user["uid"],
        "settled_at": ts_now(),
        "permanently_settled": True,
    }
    db.collection("distribution_snapshots").add(snapshot_data)

    # Notify each teacher with their personalized earnings
    # Convert date from YYYY-MM-DD to DD.MM.YYYY
    parts = req.date.split("-")
    formatted_date = f"{parts[2]}.{parts[1]}.{parts[0]}" if len(parts) == 3 else req.date
    for t in teachers_snapshot:
        tid = t.get("uid")
        # Fetch tokens from request-scoped cache — never stored in Firestore
        tokens = cache_users.get(tid, {}).get("fcm_tokens", [])
        if tid and tokens:
            from notifications import _send_fcm
            _send_fcm(
                tokens, 
                "FP Finance", 
                f"The distribution for {formatted_date} has been successfully settled.", 
                "distribution_settled",
                target_uid=tid
            )

    return {
        "message": f"Distribution for {req.date} settled. {len(teachers_snapshot)} teacher(s) locked.",
        "snapshot": snapshot_data,
    }




# ══════════════════════════════════════════════
#  PDF BACKUP
# ══════════════════════════════════════════════

@router.get("/backup")
def admin_backup(
    month: Optional[int] = None,
    year: Optional[int] = None,
    user=Depends(require_role("admin")),
):
    """Export payment data as a PDF report, grouped by batch for a specific month/year."""
    from fpdf import FPDF
    from fastapi.responses import StreamingResponse

    # Default to current month/year if not provided
    now = datetime.utcnow()
    month = month or now.month
    year = year or now.year

    MONTHS_FULL = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    month_label = MONTHS_FULL[month - 1] if 1 <= month <= 12 else str(month)

    def safe_str(val):
        """Convert value to ASCII-safe string for PDF."""
        if val is None or val == "" or val == "None":
            return "-"
        text = str(val)
        text = text.replace("\u2014", "-").replace("\u2013", "-").replace("\u2019", "'")
        text = text.encode("latin-1", errors="replace").decode("latin-1")
        return text

    # ── Fetch data ──
    batches_list = [serialize_doc(b) for b in db.collection("batches").stream()]

    # Build user lookup  (uid → {name, email})
    all_users = {}
    for u in db.collection("users").stream():
        ud = u.to_dict()
        all_users[u.id] = {"name": ud.get("name", ""), "email": ud.get("email", "")}

    # Fetch payments for the requested month/year
    payments = [
        serialize_doc(p)
        for p in db.collection("payments")
        .where("month", "==", month)
        .where("year", "==", year)
        .stream()
    ]

    # Dynamically overlay latest student name
    for p in payments:
        sid = p.get("student_id", "")
        if sid in all_users:
            p["student_name"] = all_users[sid]["name"]

    # Group payments by batch_id
    payments_by_batch = {}
    for p in payments:
        bid = p.get("batch_id", "unassigned")
        payments_by_batch.setdefault(bid, []).append(p)

    # ── Build PDF ──
    pdf = FPDF(orientation="L")  # landscape for wider tables
    pdf.set_auto_page_break(auto=True, margin=15)

    # ── Title Page ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 22)
    pdf.cell(0, 20, "FP Finance Payment Report", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, f"{month_label} {year}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(
        0, 8,
        f"Generated: {now.strftime('%d %B %Y, %H:%M UTC')}  |  Batches: {len(batches_list)}  |  Payments: {len(payments)}",
        align="C", new_x="LMARGIN", new_y="NEXT",
    )
    pdf.ln(6)
    pdf.set_text_color(0, 0, 0)

    # ── Table drawing helper ──
    headers = ["#", "Student Name", "Email", "Amount", "Status", "Mode", "Date"]
    col_widths = [10, 55, 65, 30, 40, 30, 47]  # total ≈ 277 (landscape A4)

    def draw_header():
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(60, 60, 100)
        pdf.set_text_color(255, 255, 255)
        for i, h in enumerate(headers):
            pdf.cell(col_widths[i], 8, h, border=1, fill=True, align="C")
        pdf.ln()
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(0, 0, 0)

    # ── One table per batch ──
    for batch in batches_list:
        bid = batch.get("id", "")
        batch_name = batch.get("batch_name", "Unknown Batch")
        batch_payments = payments_by_batch.get(bid, [])

        # Get teacher names for subtitle
        teacher_ids = batch.get("teacher_ids", [])
        teacher_names = [all_users.get(tid, {}).get("name", tid[:12]) for tid in teacher_ids]

        pdf.add_page()

        # Batch title
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(50, 50, 150)
        pdf.cell(0, 10, safe_str(batch_name), new_x="LMARGIN", new_y="NEXT")

        # Batch subtitle
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(100, 100, 100)
        teacher_line = f"Teachers: {', '.join(teacher_names)}" if teacher_names else "No teachers assigned"
        pdf.cell(
            0, 6,
            f"{teacher_line}  |  {len(batch_payments)} payment(s) for {month_label} {year}",
            new_x="LMARGIN", new_y="NEXT",
        )
        pdf.ln(3)
        pdf.set_text_color(0, 0, 0)

        if not batch_payments:
            pdf.set_font("Helvetica", "I", 10)
            pdf.set_text_color(150, 150, 150)
            pdf.cell(0, 10, "No payment records for this period.", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(0, 0, 0)
            continue

        draw_header()

        for row_idx, p in enumerate(batch_payments):
            if row_idx % 2 == 0:
                pdf.set_fill_color(240, 240, 250)
            else:
                pdf.set_fill_color(255, 255, 255)

            # Page break with repeated header
            if pdf.get_y() > 185:  # landscape height is ~210
                pdf.add_page()
                draw_header()

            # Resolve student email from the user lookup
            student_id = p.get("student_id", "")
            student_info = all_users.get(student_id, {})
            student_email = student_info.get("email", "-")

            # Payment date
            updated = p.get("updated_at", p.get("created_at", ""))
            if updated and updated != "-":
                try:
                    dt = datetime.fromisoformat(str(updated))
                    date_str = dt.strftime("%d %b %Y")
                except Exception:
                    date_str = str(updated)[:10]
            else:
                date_str = "-"

            row = [
                str(row_idx + 1),
                p.get("student_name", "-"),
                student_email,
                f"Rs.{p.get('amount', 0)}",
                p.get("status", "-"),
                p.get("mode", "") or "-",
                date_str,
            ]

            for i, val in enumerate(row):
                text = safe_str(val)
                if len(text) > 30:
                    text = text[:28] + ".."
                pdf.cell(col_widths[i], 7, text, border=1, fill=True, align="C")
            pdf.ln()

        # Batch summary
        total_amt = sum(p.get("amount", 0) for p in batch_payments)
        paid_count = sum(1 for p in batch_payments if p.get("status") == "Paid")
        unpaid_count = sum(1 for p in batch_payments if p.get("status") == "Unpaid")
        pending_count = sum(1 for p in batch_payments if p.get("status") == "Pending_Verification")

        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(
            0, 7,
            f"Total: Rs.{total_amt}  |  Paid: {paid_count}  |  Unpaid: {unpaid_count}  |  Pending: {pending_count}",
            new_x="LMARGIN", new_y="NEXT",
        )

    # Handle unassigned payments (students without a batch)
    unassigned = payments_by_batch.get("unassigned", []) + payments_by_batch.get("", [])
    if unassigned:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(50, 50, 150)
        pdf.cell(0, 10, "Unassigned Students", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(0, 0, 0)
        pdf.ln(3)
        draw_header()
        for row_idx, p in enumerate(unassigned):
            if row_idx % 2 == 0:
                pdf.set_fill_color(240, 240, 250)
            else:
                pdf.set_fill_color(255, 255, 255)
            student_id = p.get("student_id", "")
            student_info = all_users.get(student_id, {})
            updated = p.get("updated_at", p.get("created_at", ""))
            try:
                date_str = datetime.fromisoformat(str(updated)).strftime("%d %b %Y")
            except Exception:
                date_str = "-"
            row = [
                str(row_idx + 1),
                p.get("student_name", "-"),
                student_info.get("email", "-"),
                f"Rs.{p.get('amount', 0)}",
                p.get("status", "-"),
                p.get("mode", "") or "-",
                date_str,
            ]
            for i, val in enumerate(row):
                text = safe_str(val)
                if len(text) > 30:
                    text = text[:28] + ".."
                pdf.cell(col_widths[i], 7, text, border=1, fill=True, align="C")
            pdf.ln()

    # ── Output PDF ──
    pdf_bytes = pdf.output()
    buffer = io.BytesIO(pdf_bytes)
    buffer.seek(0)

    filename = f"FPFinance_{month_label}_{year}_Report.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ══════════════════════════════════════════════
#  REPORT EXPORT (PDF)
# ══════════════════════════════════════════════

@router.get("/report-export")
def admin_report_export(
    batch_id: str,
    year: int,
    months: str,
    user=Depends(require_role("admin")),
):
    """Export a Collection & Distribution PDF report for a batch.
    `months` is a comma-separated list of month numbers, e.g. '1,2,3'.
    Each month gets its own page(s) with 4 tables:
      1. Student list (all payments)
      2. Status summary (Paid / Unpaid counts)
      3. Collection (paid students with dates)
      4. Distribution (teacher-wise split by confirmation date)
    """
    from fpdf import FPDF
    from fastapi.responses import StreamingResponse

    # ── Parse & validate ──
    try:
        month_list = sorted(set(int(m.strip()) for m in months.split(",") if m.strip()))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid months format. Use comma-separated numbers, e.g. '1,2,3'.")

    if not month_list or any(m < 1 or m > 12 for m in month_list):
        raise HTTPException(status_code=400, detail="Month values must be between 1 and 12.")

    # ── Fetch batch info ──
    batch_doc = db.collection("batches").document(batch_id).get()
    if not batch_doc.exists:
        raise HTTPException(status_code=404, detail="Batch not found.")
    batch_data = batch_doc.to_dict()
    batch_name = batch_data.get("batch_name", "Unknown Batch")
    teacher_ids = batch_data.get("teacher_ids", [])

    # ── Fetch teacher names ──
    teacher_map = {}  # uid -> name
    for tid in teacher_ids:
        t_doc = db.collection("users").document(tid).get()
        if t_doc.exists:
            teacher_map[tid] = t_doc.to_dict().get("name", "Unknown")
        else:
            teacher_map[tid] = "Unknown"

    # ── Build user lookup for latest student names ──
    all_users = {}
    for u in db.collection("users").where("role", "==", "student").where("batch_id", "==", batch_id).stream():
        ud = u.to_dict()
        all_users[u.id] = ud.get("name", "Unknown")

    MONTHS_FULL = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]

    def safe_str(val):
        """Convert value to PDF-safe ASCII string."""
        if val is None or val == "" or val == "None":
            return "-"
        text = str(val)
        text = text.replace("\u2014", "-").replace("\u2013", "-").replace("\u2019", "'")
        text = text.replace("\u20b9", "Rs.")
        text = text.encode("latin-1", errors="replace").decode("latin-1")
        return text

    def format_date(raw):
        """Parse an ISO datetime string to 'DD/MM/YYYY'."""
        if not raw or raw == "-":
            return "-"
        try:
            dt = datetime.fromisoformat(str(raw))
            return dt.strftime("%d/%m/%Y")
        except Exception:
            return str(raw)[:10]

    # ── Build PDF (Portrait A4) ──
    pdf = FPDF(orientation="P")
    pdf.set_auto_page_break(auto=True, margin=15)

    PAGE_W = 210
    MARGIN = 10
    USABLE_W = PAGE_W - 2 * MARGIN

    for month_num in month_list:
        month_label = MONTHS_FULL[month_num - 1] if 1 <= month_num <= 12 else str(month_num)

        # ── Fetch payments for this month ──
        payments_raw = list(
            db.collection("payments")
            .where("batch_id", "==", batch_id)
            .where("month", "==", month_num)
            .where("year", "==", year)
            .stream()
        )
        payments = []
        for p in payments_raw:
            d = p.to_dict()
            d["id"] = p.id
            # Overlay latest student name
            sid = d.get("student_id", "")
            if sid in all_users:
                d["student_name"] = all_users[sid]
            # Convert timestamps
            for k in ("created_at", "updated_at"):
                if hasattr(d.get(k), "isoformat"):
                    d[k] = d[k].isoformat()
            payments.append(d)

        # Sort by student name
        payments.sort(key=lambda x: (x.get("student_name") or "").lower())

        paid_payments = [p for p in payments if p.get("status") == "Paid"]
        unpaid_payments = [p for p in payments if p.get("status") != "Paid"]

        # ═══════════════════════════════════════
        #  NEW PAGE — Title
        # ═══════════════════════════════════════
        pdf.add_page()

        # Title: "Collection & Distribution Report"
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 10, "Collection & Distribution Report", align="C", new_x="LMARGIN", new_y="NEXT")

        # Subtitle: "BATCH NAME | Month, Year"
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(0, 7, safe_str(f"{batch_name}  |  {month_label}, {year}"), align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(6)

        # ═══════════════════════════════════════
        #  TABLE 1: Student List (All)
        # ═══════════════════════════════════════
        t1_cols = [12, 50, 28, 28, 28, 44]  # = 190
        t1_headers = ["Sr. No.", "Student Name", "Amount", "Status", "Mode", "Date"]

        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(50, 50, 70)
        pdf.set_text_color(255, 255, 255)
        for i, h in enumerate(t1_headers):
            pdf.cell(t1_cols[i], 7, h, border=1, fill=True, align="C")
        pdf.ln()

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(30, 30, 30)

        if payments:
            for idx, p in enumerate(payments):
                if pdf.get_y() > 265:
                    pdf.add_page()
                    # Redraw table 1 header on new page
                    pdf.set_font("Helvetica", "B", 9)
                    pdf.set_fill_color(50, 50, 70)
                    pdf.set_text_color(255, 255, 255)
                    for i, h in enumerate(t1_headers):
                        pdf.cell(t1_cols[i], 7, h, border=1, fill=True, align="C")
                    pdf.ln()
                    pdf.set_font("Helvetica", "", 8)
                    pdf.set_text_color(30, 30, 30)

                bg = (idx % 2 == 0)
                if bg:
                    pdf.set_fill_color(245, 245, 250)
                else:
                    pdf.set_fill_color(255, 255, 255)

                status = p.get("status", "-")
                mode = p.get("mode") or "-"
                pay_date = "-"
                if status == "Paid":
                    pay_date = format_date(p.get("updated_at"))
                elif status == "Pending_Verification":
                    pay_date = format_date(p.get("updated_at"))

                row = [
                    str(idx + 1),
                    safe_str(p.get("student_name", "-")),
                    safe_str(f"Rs.{p.get('amount', 0)}"),
                    safe_str(status.replace("_", " ")),
                    safe_str(mode),
                    safe_str(pay_date),
                ]
                for i, val in enumerate(row):
                    text = val[:25] + ".." if len(val) > 27 else val
                    pdf.cell(t1_cols[i], 6, text, border=1, fill=True, align="C")
                pdf.ln()
        else:
            pdf.set_font("Helvetica", "I", 9)
            pdf.set_text_color(120, 120, 120)
            pdf.cell(sum(t1_cols), 8, "No payment records for this period.", border=1, align="C")
            pdf.ln()
            pdf.set_text_color(30, 30, 30)

        pdf.ln(6)

        # ═══════════════════════════════════════
        #  TABLE 2: Status Summary
        # ═══════════════════════════════════════
        paid_count = len(paid_payments)
        unpaid_count = len(unpaid_payments)

        t2_cols = [50, 50]  # small table
        t2_x = MARGIN  # left-aligned

        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(50, 50, 70)
        pdf.set_text_color(255, 255, 255)
        pdf.set_x(t2_x)
        pdf.cell(t2_cols[0], 7, "Status", border=1, fill=True, align="C")
        pdf.cell(t2_cols[1], 7, "Count", border=1, fill=True, align="C")
        pdf.ln()

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(30, 30, 30)

        pdf.set_x(t2_x)
        pdf.set_fill_color(245, 245, 250)
        pdf.cell(t2_cols[0], 6, "Paid", border=1, fill=True, align="C")
        pdf.cell(t2_cols[1], 6, str(paid_count), border=1, fill=True, align="C")
        pdf.ln()

        pdf.set_x(t2_x)
        pdf.set_fill_color(255, 255, 255)
        pdf.cell(t2_cols[0], 6, "Unpaid", border=1, fill=True, align="C")
        pdf.cell(t2_cols[1], 6, str(unpaid_count), border=1, fill=True, align="C")
        pdf.ln()

        pdf.ln(8)

        # ═══════════════════════════════════════
        #  TABLE 3: Collection (Paid only)
        # ═══════════════════════════════════════
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 8, "Collection:", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

        t3_cols = [35, 60, 50, 45]  # = 190
        t3_headers = ["Date", "Student Name", "Amount", "Total"]

        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(50, 50, 70)
        pdf.set_text_color(255, 255, 255)
        for i, h in enumerate(t3_headers):
            pdf.cell(t3_cols[i], 7, h, border=1, fill=True, align="C")
        pdf.ln()

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(30, 30, 30)

        if paid_payments:
            # Sort by payment date, then group by date
            paid_sorted = sorted(paid_payments, key=lambda x: x.get("updated_at", "") or "")

            # Group payments by date string (DD/MM/YYYY)
            from collections import OrderedDict
            date_groups = OrderedDict()
            for p in paid_sorted:
                date_key = format_date(p.get("updated_at"))
                date_groups.setdefault(date_key, []).append(p)

            ROW_H = 6
            running_total = 0

            for date_str, group in date_groups.items():
                group_size = len(group)
                group_height = group_size * ROW_H

                # Page break check — if the group won't fit, start a new page
                if pdf.get_y() + group_height > 265:
                    pdf.add_page()
                    pdf.set_font("Helvetica", "B", 9)
                    pdf.set_fill_color(50, 50, 70)
                    pdf.set_text_color(255, 255, 255)
                    for i, h in enumerate(t3_headers):
                        pdf.cell(t3_cols[i], 7, h, border=1, fill=True, align="C")
                    pdf.ln()
                    pdf.set_font("Helvetica", "", 8)
                    pdf.set_text_color(30, 30, 30)

                group_start_y = pdf.get_y()

                # Calculate the total for this date group
                date_total = sum(p.get("amount", 0) for p in group)

                # ─── Draw the merged Date cell (left, tall) ───
                pdf.set_fill_color(245, 245, 250)
                pdf.cell(t3_cols[0], group_height, date_str, border=1, fill=True, align="C")

                # ─── Draw each student row (Student Name + Amount only) ───
                for g_idx, p in enumerate(group):
                    row_y = group_start_y + g_idx * ROW_H
                    pdf.set_xy(MARGIN + t3_cols[0], row_y)

                    if g_idx % 2 == 0:
                        pdf.set_fill_color(245, 245, 250)
                    else:
                        pdf.set_fill_color(255, 255, 255)

                    amt = p.get("amount", 0)

                    student_name = safe_str(p.get("student_name", "-"))
                    if len(student_name) > 28:
                        student_name = student_name[:26] + ".."

                    pdf.cell(t3_cols[1], ROW_H, student_name, border=1, fill=True, align="C")
                    pdf.cell(t3_cols[2], ROW_H, safe_str(f"Rs.{amt}"), border=1, fill=True, align="C")

                # ─── Draw the merged Total cell (right, tall) ───
                total_x = MARGIN + t3_cols[0] + t3_cols[1] + t3_cols[2]
                pdf.set_xy(total_x, group_start_y)
                pdf.set_fill_color(245, 245, 250)
                pdf.cell(t3_cols[3], group_height, safe_str(f"Rs.{date_total}"), border=1, fill=True, align="C")

                running_total += date_total

                # Move cursor below this date group
                pdf.set_y(group_start_y + group_height)

            # Total row
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_fill_color(230, 230, 240)
            merged_width = t3_cols[0] + t3_cols[1] + t3_cols[2]
            pdf.cell(merged_width, 7, "Total", border=1, fill=True, align="C")
            pdf.cell(t3_cols[3], 7, safe_str(f"Rs.{running_total}"), border=1, fill=True, align="C")
            pdf.ln()
        else:
            pdf.set_font("Helvetica", "I", 9)
            pdf.set_text_color(120, 120, 120)
            pdf.cell(sum(t3_cols), 8, "No payments collected this month.", border=1, align="C")
            pdf.ln()
            pdf.set_text_color(30, 30, 30)

        pdf.ln(8)

        # ═══════════════════════════════════════
        #  TABLE 4: Distribution (Teacher-wise)
        # ═══════════════════════════════════════

        # Check if we need a new page for distribution
        if pdf.get_y() > 220:
            pdf.add_page()

        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 8, "Distribution:", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

        teacher_count = len(teacher_ids)

        if teacher_count == 0 or not paid_payments:
            pdf.set_font("Helvetica", "I", 9)
            pdf.set_text_color(120, 120, 120)
            no_dist_msg = "No teachers assigned to this batch." if teacher_count == 0 else "No paid payments to distribute."
            pdf.cell(USABLE_W, 8, no_dist_msg, border=1, align="C")
            pdf.ln()
        else:
            # Group paid payments by date
            payments_by_date = {}
            for p in paid_payments:
                date_key = str(p.get("updated_at", ""))[:10]
                if not date_key or date_key == "None":
                    continue
                payments_by_date.setdefault(date_key, []).append(p)

            # Fetch snapshots for settled distribution
            snapshot_query = db.collection("distribution_snapshots") \
                .where("batch_id", "==", batch_id) \
                .where("month", "==", month_num) \
                .where("year", "==", year)
                
            settled_dates = {}
            for snap in snapshot_query.stream():
                sd = snap.to_dict()
                if "date" in sd:
                    settled_dates[sd["date"]] = sd

            sorted_dates = sorted(payments_by_date.keys())
            settled_sorted_dates = [d for d in sorted_dates if d in settled_dates]

            if not settled_sorted_dates:
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(120, 120, 120)
                pdf.cell(USABLE_W, 8, "No settled payments to distribute for this month.", border=1, align="C")
                pdf.ln()
            else:
                # Date column + teacher columns + total column
                date_col_w = 30
                total_col_w = 28
                remaining = USABLE_W - date_col_w - total_col_w
                teacher_col_w = max(25, remaining / teacher_count) if teacher_count > 0 else remaining

                # If too many teachers, reduce all columns proportionally
                actual_total_w = date_col_w + (teacher_col_w * teacher_count) + total_col_w
                if actual_total_w > USABLE_W:
                    teacher_col_w = (USABLE_W - date_col_w - total_col_w) / teacher_count

                t4_cols = [date_col_w] + [teacher_col_w] * teacher_count + [total_col_w]
                t4_headers = ["Date"] + [safe_str(teacher_map.get(tid, "?")) for tid in teacher_ids] + ["Total"]

                # Truncate long teacher names for header
                t4_display_headers = []
                for h in t4_headers:
                    max_chars = int(teacher_col_w / 2.2)
                    if len(h) > max_chars and h not in ("Date", "Total"):
                        t4_display_headers.append(h[:max_chars-1] + ".")
                    else:
                        t4_display_headers.append(h)

                pdf.set_font("Helvetica", "B", 7 if teacher_count > 3 else 8)
                pdf.set_fill_color(50, 50, 70)
                pdf.set_text_color(255, 255, 255)
                for i, h in enumerate(t4_display_headers):
                    pdf.cell(t4_cols[i], 7, h, border=1, fill=True, align="C")
                pdf.ln()

                pdf.set_font("Helvetica", "", 7 if teacher_count > 3 else 8)
                pdf.set_text_color(30, 30, 30)

                # Track teacher totals
                teacher_grand_totals = {tid: 0 for tid in teacher_ids}
                grand_total = 0

                for d_idx, date_str in enumerate(settled_sorted_dates):
                    if pdf.get_y() > 265:
                        pdf.add_page()
                        pdf.set_font("Helvetica", "B", 7 if teacher_count > 3 else 8)
                        pdf.set_fill_color(50, 50, 70)
                        pdf.set_text_color(255, 255, 255)
                        for i, h in enumerate(t4_display_headers):
                            pdf.cell(t4_cols[i], 7, h, border=1, fill=True, align="C")
                        pdf.ln()
                        pdf.set_font("Helvetica", "", 7 if teacher_count > 3 else 8)
                        pdf.set_text_color(30, 30, 30)

                    bg = (d_idx % 2 == 0)
                    pdf.set_fill_color(245, 245, 250) if bg else pdf.set_fill_color(255, 255, 255)

                    dp = payments_by_date[date_str]
                    date_total = sum(x.get("amount", 0) for x in dp)
                    
                    # Format base date
                    try:
                        dt = datetime.fromisoformat(date_str)
                        display_date = dt.strftime("%d/%m/%Y")
                    except Exception:
                        display_date = date_str

                    # Apply snapshot data (guaranteed to be settled)
                    snap = settled_dates[date_str]
                    date_total = snap.get("total", date_total)
                    settled_teacher_amounts = {t["uid"]: t["amount"] for t in snap.get("teachers", [])}

                    row_vals = [display_date]
                    for tid in teacher_ids:
                        amt = settled_teacher_amounts.get(tid, 0)
                        row_vals.append(safe_str(f"Rs.{amt}"))
                        teacher_grand_totals[tid] += amt
                        
                    row_vals.append(safe_str(f"Rs.{date_total}"))
                    grand_total += date_total

                    for i, val in enumerate(row_vals):
                        pdf.cell(t4_cols[i], 6, val, border=1, fill=True, align="C")
                    pdf.ln()

                # Total row
                pdf.set_font("Helvetica", "B", 7 if teacher_count > 3 else 8)
                pdf.set_fill_color(230, 230, 240)
                pdf.cell(t4_cols[0], 7, "Total", border=1, fill=True, align="C")
                for tid in teacher_ids:
                    pdf.cell(teacher_col_w, 7, safe_str(f"Rs.{round(teacher_grand_totals[tid], 2)}"), border=1, fill=True, align="C")
                pdf.cell(t4_cols[-1], 7, safe_str(f"Rs.{round(grand_total, 2)}"), border=1, fill=True, align="C")
                pdf.ln()

    # ── Output PDF ──
    pdf_bytes = pdf.output()
    buffer = io.BytesIO(pdf_bytes)
    buffer.seek(0)

    month_labels = [MONTHS_FULL[m - 1] for m in month_list if 1 <= m <= 12]
    filename = f"Report_{safe_str(batch_name).replace(' ', '_')}_{'-'.join(month_labels)}_{year}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ══════════════════════════════════════════════
#  INITIALISE DEFAULT ADMIN
# ══════════════════════════════════════════════

@router.post("/seed")
def seed_default_admin(req: AdminSeed):
    """Create an admin account with the given credentials.
    Only works if no admin account exists yet."""
    # Check if an admin already exists
    existing_admins = list(
        db.collection("users").where("role", "==", "admin").limit(1).stream()
    )
    if existing_admins:
        admin_data = existing_admins[0].to_dict()
        return {
            "message": "Admin account already exists",
            "admin": {"uid": existing_admins[0].id, "username": admin_data.get("username", ""), "new": False},
        }

    email = to_firebase_email(req.username)
    try:
        fb_user = firebase_auth.create_user(
            email=email,
            password=req.password,
            display_name=req.name,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    firebase_auth.set_custom_user_claims(fb_user.uid, {"role": "admin"})

    db.collection("users").document(fb_user.uid).set({
        "name": req.name,
        "username": req.username.strip().lower(),
        "email": email,
        "role": "admin",
        "batch_id": None,
        "created_at": ts_now(),
    })

    return {
        "message": "Admin account created",
        "admin": {"uid": fb_user.uid, "username": req.username.strip().lower(), "new": True},
    }


# ══════════════════════════════════════════════
#  ADMIN EMERGENCY RESET
# ══════════════════════════════════════════════

@router.post("/emergency-reset")
def reset_admin_account(req: EmergencyReset):
    """Emergency reset: Deletes all existing admins if the master key is correct. 
    Does not require authentication."""
    if req.master_key != "fpfinance-master-2026-ps-sm":
        raise HTTPException(status_code=403, detail="Invalid master key")
        
    existing_admins = list(db.collection("users").where("role", "==", "admin").stream())
    if not existing_admins:
        return {"message": "No admins found in the system to delete."}
        
    deleted_count = 0
    for ad in existing_admins:
        uid = ad.id
        try:
            firebase_auth.delete_user(uid)
        except Exception:
            pass # Just in case it was already deleted in auth
        db.collection("users").document(uid).delete()
        deleted_count += 1
        
    return {"message": f"Successfully deleted {deleted_count} admin accounts. The system is ready to be seeded again."}


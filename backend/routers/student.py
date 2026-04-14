import uuid
import asyncio
import random
from typing import Optional, List
from datetime import datetime

import requests
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from config import ADMIN_UPI_VPA, DEFAULT_FEE_AMOUNT
from database import db
from dependencies import require_role
from utils import ts_now, serialize_doc, IST
from notifications import notify_user, notify_admins

router = APIRouter(prefix="/api/student", tags=["Student"])
# ──────────────────────────────────────────────
# POST /api/student/feedback
# ──────────────────────────────────────────────
class FeedbackPayload(BaseModel):
    rating: int
    features: List[str]
    improvements: str
    has_issues: str           # "Yes" | "No"
    issue_details: str = ""


@router.post("/feedback")
async def student_submit_feedback(
    payload: FeedbackPayload,
    user=Depends(require_role("student")),
):
    """
    Backend proxy: Submits student feedback to Google Forms server-side.
    This avoids all browser CORS / auth restrictions.
    """
    # Resolve batch name for the form
    batch_id   = user.get("batch_id", "")
    batch_name = ""
    if batch_id:
        batch_doc = db.collection("batches").document(batch_id).get()
        if batch_doc.exists:
            batch_name = batch_doc.to_dict().get("batch_name", "")

    FORM_VIEW_URL = (
        "https://docs.google.com/forms/d/e/"
        "1FAIpQLSf97GaRIZBQ-zhagQ0IoTM9yPESZN12tmIuNoFwflykOoa8cg/viewform"
    )
    FORM_URL = (
        "https://docs.google.com/forms/d/e/"
        "1FAIpQLSf97GaRIZBQ-zhagQ0IoTM9yPESZN12tmIuNoFwflykOoa8cg/formResponse"
    )

    # Build form fields — checkboxes need one tuple per selected value
    # Google Forms also requires 3 internal hidden fields to accept the POST:
    #   fvv=1          → form version validator (always 1)
    #   pageHistory=0  → tracks which page was submitted
    #   fbzx           → a pseudo-random session token (any large number works)
    # If the Google Form has multiple pages/sections (e.g., Page 2 for Issue Details),
    # we must tell Google Forms that we visited Page 2, otherwise it ignores the field.
    page_history = "0,1" if payload.has_issues.lower() == "yes" else "0"

    fields: list[tuple[str, str]] = [
        ("fvv",         "1"),
        ("pageHistory", page_history),
        ("fbzx",        str(random.randint(-9_000_000_000_000_000_000, -1_000_000_000_000_000_000))),
        ("entry.384903082", user.get("name", "")),
        ("entry.694818161", batch_name),
        ("entry.1975545119", str(payload.rating)),
        ("entry.130196905", payload.improvements),
        ("entry.733110544", payload.has_issues.lower()),   # form uses lowercase yes/no
    ]
    for feature in payload.features:
        fields.append(("entry.577196034", feature))
    if payload.has_issues.lower() == "yes" and payload.issue_details:
        fields.append(("entry.260043703", payload.issue_details))

    BROWSER_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        def _submit():
            session = requests.Session()

            # Step 1: GET the form to obtain Google session cookies
            session.get(FORM_VIEW_URL, headers=BROWSER_HEADERS, timeout=15)

            # Step 2: POST with the same session (carries cookies) + browser-like headers
            return session.post(
                FORM_URL,
                data=fields,
                headers={
                    **BROWSER_HEADERS,
                    "Referer":      FORM_VIEW_URL,
                    "Origin":       "https://docs.google.com",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                allow_redirects=True,
                timeout=15,
            )

        resp = await asyncio.to_thread(_submit)

        # Google Forms returns 200 (after following redirects) on success
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Google Forms returned {resp.status_code}.")
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Network error: {exc}")

    return {"success": True}


@router.get("/batch-info")
def student_get_batch_info(user=Depends(require_role("student"))):
    """Return the batch name for the logged-in student (used for feedback form pre-fill)."""
    batch_id = user.get("batch_id")
    if not batch_id:
        return {"batch_id": None, "batch_name": ""}

    batch_doc = db.collection("batches").document(batch_id).get()
    if not batch_doc.exists:
        return {"batch_id": batch_id, "batch_name": ""}

    batch_name = batch_doc.to_dict().get("batch_name", "")
    return {"batch_id": batch_id, "batch_name": batch_name}


# ──────────────────────────────────────────────
# GET /api/student/payments
# ──────────────────────────────────────────────
@router.get("/payments")
def student_get_payments(user=Depends(require_role("student"))):
    """Get all payments for the logged-in student."""
    try:
        payments = db.collection("payments") \
            .where("student_id", "==", user["uid"]) \
            .stream()

        result = [serialize_doc(p) for p in payments]

        # Overlay with current user name
        name = user.get("name", "Unknown")
        for p in result:
            p["student_name"] = name

        # Sort in Python to avoid composite index requirement
        result.sort(key=lambda x: (x.get("year", 0), x.get("month", 0)), reverse=True)
        return result
    except Exception as e:
        print(f"Error fetching student payments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch payments: {str(e)}")


# ──────────────────────────────────────────────
# POST /api/student/payments/{payment_id}/upload
# ──────────────────────────────────────────────
@router.post("/payments/{payment_id}/upload")
def student_upload_screenshot(
    payment_id: str,
    file: UploadFile = File(...),
    user=Depends(require_role("student")),
):
    """Upload payment screenshot to Cloudinary and set status to Pending_Verification."""
    # Verify the payment belongs to this student
    payment_ref = db.collection("payments").document(payment_id)
    payment_doc = payment_ref.get()

    if not payment_doc.exists:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment = payment_doc.to_dict()
    if payment["student_id"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Not your payment record")

    if payment["status"] == "Paid":
        raise HTTPException(status_code=400, detail="Payment already verified")

    # Upload to Cloudinary
    contents = file.file.read()
    try:
        upload_result = cloudinary.uploader.upload(
            contents,
            folder="payment_screenshots",
            public_id=f"{payment_id}_{uuid.uuid4().hex[:8]}",
            resource_type="image",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload screenshot: {str(e)}")

    screenshot_url = upload_result["secure_url"]
    screenshot_public_id = upload_result["public_id"]

    # Update payment in Firestore
    payment_ref.update({
        "screenshot_url": screenshot_url,
        "screenshot_public_id": screenshot_public_id,
        "status": "Pending_Verification",
        "mode": "online",
        "requested_at": ts_now(),
        "updated_at": ts_now(),
    })

    # Notify student + admins
    student_name = user.get("name", "Student")
    notify_user(user["uid"], "Your payment is currently pending verification.", "payment_pending")
    notify_admins(f"New payment request from {student_name} (Online).", "new_approval")

    return {"message": "Screenshot uploaded", "screenshot_url": screenshot_url}


# ──────────────────────────────────────────────
# GET /api/student/upi-link
# ──────────────────────────────────────────────
@router.get("/upi-link")
def student_get_upi_link(
    amount: Optional[float] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    user=Depends(require_role("student")),
):
    """Generate UPI deep link for payment."""
    pay_amount = amount or DEFAULT_FEE_AMOUNT
    am_str = str(int(pay_amount)) if pay_amount == int(pay_amount) else f"{pay_amount:.2f}"

    upi_link = f"upi://pay?pa={ADMIN_UPI_VPA}&pn=Soumya%20Sengupta&am={am_str}&cu=INR"

    return {"upi_link": upi_link, "amount": pay_amount, "vpa": ADMIN_UPI_VPA}


# ──────────────────────────────────────────────
# GET /api/student/leaderboard
# ──────────────────────────────────────────────
@router.get("/leaderboard")
def student_get_leaderboard(
    month: Optional[int] = None,
    year: Optional[int] = None,
    user=Depends(require_role("student")),
):
    """Get fastest-payer leaderboard for a billing cycle.

    Ranks students by `requested_at` (payment request timestamp) ascending.
    Only students with status=Paid appear. Admin approval order is irrelevant.
    Returns top 5 fastest payers, current student's position, and stats.
    If month/year not provided, defaults to current month.
    """
    # Default to current month/year
    if not month or not year:
        now = datetime.now(IST)
        month = now.month
        year = now.year

    try:
        # ── Get student's batch ──
        student_batch_id = user.get("batch_id")
        if not student_batch_id:
             return {
                "month": month, "year": year, "top5": [], "current_position": None,
                "is_current_paid": False, "has_bill": False, "total_paid": 0,
                "total_students": 0, "cohort_progress": 0, "available_months": [],
            }

        # ── Fetch ONLY 'Paid' payments for this billing cycle and batch ──
        paid_payments_stream = db.collection("payments") \
            .where("month", "==", month) \
            .where("year", "==", year) \
            .where("batch_id", "==", student_batch_id) \
            .where("status", "==", "Paid") \
            .stream()

        paid_payments = []
        for p in paid_payments_stream:
            data = p.to_dict()
            data["id"] = p.id
            # Convert any datetime objects to ISO strings
            for k, v in data.items():
                if hasattr(v, "isoformat"):
                    data[k] = v.isoformat()
            paid_payments.append(data)

        # ── Total students in this specific batch (Current Headcount) ──
        batch_students_query = db.collection("users") \
            .where("batch_id", "==", student_batch_id) \
            .where("role", "==", "student") \
            .count()
        total_students = batch_students_query.get()[0][0].value
        
        total_paid = len(paid_payments)

        # ── Sort paid payments by requested_at ascending (fastest requester first) ──
        paid_payments.sort(key=lambda x: x.get("requested_at", "") or "9999")

        # ── Build top 5 with student profile info using batched fetch ──
        top5 = []
        top5_sliced = paid_payments[:5]
        if top5_sliced:
            user_refs = [db.collection("users").document(p["student_id"]) for p in top5_sliced]
            docs = db.get_all(user_refs)
            student_cache = {doc.id: doc.to_dict() for doc in docs if doc.exists}
            
            for i, p in enumerate(top5_sliced):
                student_data = student_cache.get(p["student_id"], {})
                top5.append({
                    "rank": i + 1,
                    "student_name": student_data.get("name", p.get("student_name", "Unknown")),
                    "student_id": p["student_id"],
                    "paid_at": p.get("updated_at", ""),
                    "profile_pic_url": student_data.get("profile_pic_url"),
                })

        # ── Find current student's position ──
        current_position = None
        is_current_paid = False
        for i, p in enumerate(paid_payments):
            if p["student_id"] == user["uid"]:
                current_position = i + 1
                is_current_paid = True
                break

        # Check if current student has a payment for this month at all
        has_bill_query = db.collection("payments") \
            .where("student_id", "==", user["uid"]) \
            .where("month", "==", month) \
            .where("year", "==", year) \
            .limit(1) \
            .get()
        has_bill = len(has_bill_query) > 0

        # ── Compute cohort progress percentage ──
        cohort_progress = round((total_paid / total_students * 100)) if total_students > 0 else 0

        # Note: available_months removed — frontend uses hardcoded month/year dropdowns
        # and does not consume this field. Removing saves N Firestore reads per call.
        return {
            "month": month,
            "year": year,
            "top5": top5,
            "current_position": current_position,
            "is_current_paid": is_current_paid,
            "has_bill": has_bill,
            "total_paid": total_paid,
            "total_students": total_students,
            "cohort_progress": cohort_progress,
        }

    except Exception as e:
        print(f"Error fetching leaderboard: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch leaderboard: {str(e)}")



# ──────────────────────────────────────────────
# POST /api/student/payments/{payment_id}/acknowledge-rejection
# ──────────────────────────────────────────────
@router.post("/payments/{payment_id}/acknowledge-rejection")
def student_acknowledge_rejection(
    payment_id: str,
    user=Depends(require_role("student")),
):
    """Student acknowledges a rejected payment — resets it back to Unpaid so they can pay again."""
    payment_ref = db.collection("payments").document(payment_id)
    payment_doc = payment_ref.get()

    if not payment_doc.exists:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment = payment_doc.to_dict()

    if payment["student_id"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Not your payment record")

    if payment["status"] != "Rejected":
        raise HTTPException(status_code=400, detail="Payment is not in Rejected state")

    payment_ref.update({
        "status": "Unpaid",
        "screenshot_url": None,
        "screenshot_public_id": None,
        "requested_at": None,
        "rejected_at": None,
        "rejection_reason": None,
        "updated_at": ts_now(),
    })

    return {"message": "Payment reset to Unpaid. You may now submit a new payment request."}


# ──────────────────────────────────────────────
# PATCH /api/student/badge-celebrated
# ──────────────────────────────────────────────
@router.patch("/badge-celebrated")
def student_badge_celebrated(user=Depends(require_role("student"))):
    """Mark badge celebration animation as seen, so it won't replay."""
    try:
        db.collection("users").document(user["uid"]).update({
            "badge_animation_pending": False,
        })
        return {"message": "Badge celebration acknowledged"}
    except Exception as e:
        print(f"Error clearing badge animation flag: {e}")
        raise HTTPException(status_code=500, detail=str(e))

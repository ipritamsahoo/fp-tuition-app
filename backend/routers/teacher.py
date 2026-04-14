"""
FP Finance Teacher Router
===================
Endpoints: view batches, view payments, submit offline request.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from config import DEFAULT_FEE_AMOUNT
from database import db
from schemas import OfflineRequest
from dependencies import require_role
from utils import ts_now, serialize_doc
from notifications import notify_user, notify_admins

router = APIRouter(prefix="/api/teacher", tags=["Teacher"])


# ──────────────────────────────────────────────
# GET /api/teacher/batches
# ──────────────────────────────────────────────
@router.get("/batches")
def teacher_get_batches(user=Depends(require_role("teacher"))):
    """Get batches assigned to this teacher, with student counts."""
    batches = db.collection("batches") \
        .where("teacher_ids", "array_contains", user["uid"]) \
        .stream()

    result = []
    for batch in batches:
        b = serialize_doc(batch)
        result.append(b)

    return result


# ──────────────────────────────────────────────
# GET /api/teacher/payments
# ──────────────────────────────────────────────
from google.cloud.firestore_v1.base_query import FieldFilter

@router.get("/payments")
def teacher_get_payments(
    batch_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    user=Depends(require_role("teacher")),
):
    """Get payment records and optimized summary for a batch."""
    # Verify teacher is assigned to this batch
    batch_doc = db.collection("batches").document(batch_id).get()
    if not batch_doc.exists:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch_data = batch_doc.to_dict()
    if user["uid"] not in batch_data.get("teacher_ids", []):
        raise HTTPException(status_code=403, detail="Not assigned to this batch")

    # Base query for this batch/period
    base_query = db.collection("payments").where(filter=FieldFilter("batch_id", "==", batch_id))
    if month:
        base_query = base_query.where(filter=FieldFilter("month", "==", month))
    if year:
        base_query = base_query.where(filter=FieldFilter("year", "==", year))

    # 1. Get summary counts using optimized count() queries
    total_count = base_query.count().get()[0][0].value
    paid_count = base_query.where(filter=FieldFilter("status", "==", "Paid")).count().get()[0][0].value
    unpaid_count = base_query.where(filter=FieldFilter("status", "==", "Unpaid")).count().get()[0][0].value
    
    # 2. Optimized Fetch: Only read documents for students who need action (Unpaid, Pending, Rejected)
    # We avoid base_query.stream() (which reads everyone) and use specific equality queries.
    # Firestore can often merge-join these without a manual composite index.
    pending_statuses = ["Unpaid", "Pending_Verification", "Rejected"]
    results = []
    
    # We fetch each non-paid status separately to minimize document reads
    for status in pending_statuses:
        status_docs = base_query.where(filter=FieldFilter("status", "==", status)).stream()
        for doc in status_docs:
            results.append(serialize_doc(doc))

    # 3. Inject student details for non-paid records ONLY
    student_ids = {p.get("student_id") for p in results if p.get("student_id")}
    if student_ids:
        user_refs = [db.collection("users").document(sid) for sid in student_ids]
        student_details = {}
        for i in range(0, len(user_refs), 100):
            docs = db.get_all(user_refs[i:i+100])
            for doc in docs:
                if doc.exists:
                    d = doc.to_dict()
                    student_details[doc.id] = {
                        "name": d.get("name", "Unknown"),
                        "profile_pic_url": d.get("profile_pic_url"),
                        "pic_version": d.get("pic_version"),
                    }
        for p in results:
            sid = p.get("student_id")
            if sid and sid in student_details:
                p["student_name"] = student_details[sid]["name"]
                p["profile_pic_url"] = student_details[sid]["profile_pic_url"]
                p["pic_version"] = student_details[sid]["pic_version"]

    results.sort(key=lambda x: x.get("student_name", "").lower())

    return {
        "summary": {
            "total_students": total_count,
            "paid_count": paid_count,
            "unpaid_count": unpaid_count
        },
        "records": results
    }


# ──────────────────────────────────────────────
# GET /api/teacher/all-payments
# ──────────────────────────────────────────────
@router.get("/all-payments")
def teacher_all_payments(
    batch_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    user=Depends(require_role("teacher")),
):
    """Get heavily optimized payment records for a batch, specifically for the main data table view."""
    # Verify teacher is assigned to this batch
    batch_doc = db.collection("batches").document(batch_id).get()
    if not batch_doc.exists:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch_data = batch_doc.to_dict()
    if user["uid"] not in batch_data.get("teacher_ids", []):
        raise HTTPException(status_code=403, detail="Not assigned to this batch")

    # Build query
    query = db.collection("payments").where("batch_id", "==", batch_id)
    if month:
        query = query.where("month", "==", month)
    if year:
        query = query.where("year", "==", year)

    payments = query.stream()
    results = [serialize_doc(p) for p in payments]

    # Rely completely on denormalized student_name. No user queries.
    results.sort(key=lambda x: x.get("student_name", "").lower())

    return results


# ──────────────────────────────────────────────
# GET /api/teacher/student-dues/{student_id}
# ──────────────────────────────────────────────
@router.get("/student-dues/{student_id}")
def teacher_student_dues(
    student_id: str,
    before_month: int,
    before_year: int,
    user=Depends(require_role("teacher")),
):
    """Get unpaid previous dues for a single student to check before offline approval."""
    query = db.collection("payments") \
        .where(filter=FieldFilter("student_id", "==", student_id)) \
        .where(filter=FieldFilter("status", "in", ["Unpaid", "Rejected"]))

    dues = query.stream()
    result = []
    
    for d in dues:
        p = serialize_doc(d)
        py = p.get("year", 0)
        pm = p.get("month", 0)
        
        if py < before_year or (py == before_year and pm < before_month):
            result.append(p)
            
    result.sort(key=lambda x: (x.get("year", 0), x.get("month", 0)))
    return result

# ──────────────────────────────────────────────
# POST /api/teacher/offline-request
# ──────────────────────────────────────────────
@router.post("/offline-request")
def teacher_offline_request(
    req: OfflineRequest,
    user=Depends(require_role("teacher")),
):
    """Submit an offline payment request on behalf of a student."""
    # Verify the student exists
    student_doc = db.collection("users").document(req.student_id).get()
    if not student_doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")

    student = student_doc.to_dict()
    if student.get("role") != "student":
        raise HTTPException(status_code=400, detail="User is not a student")

    # Check if payment record already exists for this month
    existing = db.collection("payments") \
        .where(filter=FieldFilter("student_id", "==", req.student_id)) \
        .where(filter=FieldFilter("month", "==", req.month)) \
        .where(filter=FieldFilter("year", "==", req.year)) \
        .limit(1) \
        .stream()

    existing_list = list(existing)

    if existing_list:
        # Update existing payment
        payment_ref = db.collection("payments").document(existing_list[0].id)
        current = existing_list[0].to_dict()
        if current["status"] == "Paid":
            raise HTTPException(status_code=400, detail="Payment already verified for this month")

        # Use batch_name from request for optimization (0 reads)
        teacher_name = user.get("name", "Teacher")
        student_name = student.get("name", "Student")
        batch_name = req.batch_name or "Unknown"

        payment_ref.update({
            "status": "Pending_Verification",
            "mode": "offline",
            "requested_by_teacher": user["uid"],
            "teacher_name": teacher_name,
            "student_name": student_name,
            "batch_name": batch_name,
            "requested_at": ts_now(),
            "updated_at": ts_now(),
        })
        # Notify student + admins
        student_tokens = student.get("fcm_tokens", [])
        notify_user(req.student_id, "Your payment is currently pending verification.", "payment_pending", tokens=student_tokens)
        notify_admins(f"New payment request for {student_name} (Offline) by {teacher_name}.", "new_approval")
        return {"message": "Offline request submitted", "payment_id": existing_list[0].id}
    else:
        # Create new payment record
        amount = req.amount or DEFAULT_FEE_AMOUNT
        
        teacher_name = user.get("name", "Teacher")
        student_name = student.get("name", "Student")
        batch_name = "Unknown"
        batch_id = student.get("batch_id")
        if batch_id:
            batch_doc = db.collection("batches").document(batch_id).get()
            if batch_doc.exists:
                batch_name = batch_doc.to_dict().get("batch_name", "Unknown")

        payment_data = {
            "student_id": req.student_id,
            "student_name": student_name,
            "batch_id": batch_id or "",
            "batch_name": batch_name,
            "month": req.month,
            "year": req.year,
            "amount": amount,
            "mode": "offline",
            "screenshot_url": None,
            "requested_by_teacher": user["uid"],
            "teacher_name": teacher_name,
            "status": "Pending_Verification",
            "requested_at": ts_now(),
            "created_at": ts_now(),
            "updated_at": ts_now(),
        }
        _, doc_ref = db.collection("payments").add(payment_data)
        # Notify student + admins
        student_tokens = student.get("fcm_tokens", [])
        notify_user(req.student_id, "Your payment is currently pending verification.", "payment_pending", tokens=student_tokens)
        notify_admins(f"New payment request for {student_name} (Offline) by {teacher_name}.", "new_approval")
        return {"message": "Offline request submitted", "payment_id": doc_ref.id}


# ──────────────────────────────────────────────
# GET /api/teacher/distribution
# ──────────────────────────────────────────────
@router.get("/distribution")
def teacher_distribution(
    month: int,
    year: int,
    batch_id: Optional[str] = None,
    user=Depends(require_role("teacher")),
):
    """Get revenue distribution for the teacher's assigned batches only.
    Scoped: teacher can only see batches they are assigned to.
    Optional batch_id filter to view a specific batch."""

    uid = user["uid"]

    # 1. Find batches assigned to this teacher
    teacher_batches = db.collection("batches") \
        .where("teacher_ids", "array_contains", uid) \
        .stream()

    batch_map = {}  # batch_id -> batch data
    for b in teacher_batches:
        bd = b.to_dict()
        batch_map[b.id] = {
            "batch_name": bd.get("batch_name", "Unknown"),
            "teacher_ids": bd.get("teacher_ids", []),
        }

    if not batch_map:
        return {
            "month": month, "year": year,
            "total_collected": 0, "my_total": 0,
            "teacher_totals": [], "dates": [],
            "batches": [],
        }

    # Build batch list for the dropdown BEFORE filtering
    all_teacher_batches = [
        {"id": bid, "batch_name": binfo["batch_name"]}
        for bid, binfo in batch_map.items()
    ]

    # If batch_id filter is provided, verify teacher has access
    if batch_id:
        if batch_id not in batch_map:
            raise HTTPException(status_code=403, detail="Not assigned to this batch")
        batch_map = {batch_id: batch_map[batch_id]}

    # 2. Query paid payments for assigned batches (to build the date list)
    all_payments = []
    batch_ids = list(batch_map.keys())
    
    # Firestore 'in' queries are limited to 10 items, so chunk the batch_ids
    for i in range(0, len(batch_ids), 10):
        chunk = batch_ids[i:i+10]
        payments = db.collection("payments") \
            .where("status", "==", "Paid") \
            .where("month", "==", month) \
            .where("year", "==", year) \
            .where("batch_id", "in", chunk) \
            .stream()
            
        for p in payments:
            data = serialize_doc(p)
            data["_batch_id"] = data.get("batch_id", "unknown")
            all_payments.append(data)

    # 3. Fetch settlement snapshots
    snapshot_query = db.collection("distribution_snapshots") \
        .where("month", "==", month) \
        .where("year", "==", year)
    if batch_id:
        snapshot_query = snapshot_query.where("batch_id", "==", batch_id)
    else:
        # If no batch_id filter, we need to filter snapshots manually for the teacher's batches
        # Or we can just let it fetch all for the month and filter in Python
        pass

    settled_dates = {}
    snapshots_list = []
    for snap in snapshot_query.stream():
        sd = snap.to_dict()
        # Verify if this snapshot belongs to one of the teacher's assigned batches
        if sd.get("batch_id") in batch_map:
            settled_dates[sd["date"]] = sd
            snapshots_list.append(sd)

    # 4. Calculate Summary Totals from Snapshots ONLY
    my_total = 0
    total_collected = 0
    teacher_acc = {} # uid -> {name, total}

    for snap in snapshots_list:
        total_collected += snap.get("total", 0)
        for t in snap.get("teachers", []):
            tid = t["uid"]
            tname = t["name"]
            tamount = t["amount"]
            if tid not in teacher_acc:
                teacher_acc[tid] = {"uid": tid, "name": tname, "total": 0}
            teacher_acc[tid]["total"] = round(teacher_acc[tid]["total"] + tamount, 2)
            if tid == uid:
                my_total = round(my_total + tamount, 2)

    teacher_totals = list(teacher_acc.values())
    teacher_totals.sort(key=lambda x: x["total"], reverse=True)

    # 5. Date-wise breakdown (from all paid payments)
    payments_by_date = {}
    for p in all_payments:
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
            # Unsettled - Volume is student payments, but Teacher details are empty as per request
            # "calculation hobe tokhon e jokhon settled... not collection"
            date_total = sum(x.get("amount", 0) for x in dp)
            date_results.append({
                "date": date_str,
                "total": date_total,
                "payments_count": len(dp),
                "teachers": [], # No teacher details if not settled
                "payments": dp,
                "settled": False,
            })

    # 6. Calculate total unique teachers shared (regardless of settlement)
    all_shared_teacher_ids = set()
    for binfo in batch_map.values():
        for tid in binfo.get("teacher_ids", []):
            all_shared_teacher_ids.add(tid)
    total_teachers_shared = len(all_shared_teacher_ids)

    # Return summary + list
    return {
        "total_collected": round(total_collected, 2),
        "my_total": round(my_total, 2),
        "teacher_totals": teacher_totals,
        "total_teachers_shared": total_teachers_shared,
        "dates": date_results,
        "batches": all_teacher_batches,
    }

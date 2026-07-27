"""
FP Finance Notices Router
===================
Endpoints: publish notices, retrieve batch notices, mark notices as read, delete notices.
All notices automatically expire (filtered from retrieval) after 7 days.
"""

from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel

from database import db
from dependencies import require_role
from utils import ts_now, serialize_doc, IST
from notifications import notify_users
from google.cloud.firestore_v1.base_query import FieldFilter
from backup_service import backup_document, delete_document_backup

router = APIRouter(prefix="/api/notices", tags=["Notices"])


# Request Schema
class NoticeCreate(BaseModel):
    content: str
    batch_id: str
    is_important: Optional[bool] = False


def cleanup_expired_notices() -> int:
    """Delete notices older than 7 days from the database."""
    cutoff_dt = datetime.now(IST) - timedelta(days=7)
    cutoff_str = cutoff_dt.isoformat()
    
    # Retrieve all notices (since the notices collection size is small,
    # client-side filtering prevents Firestore type query mismatch/missing index issues)
    notices_stream = db.collection("notices").stream()
    
    batch = db.batch()
    count = 0
    deleted_count = 0
    
    for doc in notices_stream:
        d = doc.to_dict()
        created_at_val = d.get("created_at")
        is_expired = False
        
        if not created_at_val:
            is_expired = True
        elif hasattr(created_at_val, "isoformat"):
            # It's a Datetime/Timestamp object
            val_dt = created_at_val
            if val_dt.tzinfo is None:
                val_dt = val_dt.replace(tzinfo=timezone.utc)
            is_expired = val_dt < cutoff_dt
        else:
            # It's a string
            is_expired = str(created_at_val) < cutoff_str
            
        if is_expired:
            batch.delete(doc.reference)
            delete_document_backup("notices", doc.id)
            count += 1
            deleted_count += 1
            if count >= 500:
                batch.commit()
                batch = db.batch()
                count = 0
                
    if count > 0:
        batch.commit()
        
    return deleted_count


# ──────────────────────────────────────────────
# POST /api/notices/
# ──────────────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_notice(
    req: NoticeCreate,
    background_tasks: BackgroundTasks,
    user=Depends(require_role("teacher"))
):
    """Publish a text-based notice to a single batch. Only assigned teachers allowed."""
    # 1. Verify batch exists
    batch_doc = db.collection("batches").document(req.batch_id).get()
    if not batch_doc.exists:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch_data = batch_doc.to_dict()

    # 2. Verify teacher is assigned to this batch
    if user["uid"] not in batch_data.get("teacher_ids", []):
        raise HTTPException(status_code=403, detail="Not assigned to this batch")

    # 3. Create notice document
    notice_data = {
        "content": req.content.strip(),
        "batch_id": req.batch_id,
        "batch_name": batch_data.get("batch_name", "Unknown"),
        "published_by": user["uid"],
        "published_by_name": user.get("name", "Teacher"),
        "created_at": ts_now(),
        "is_important": req.is_important,
        "likes": [],
        "read_by": [],
        "readers": [],
    }

    _, doc_ref = db.collection("notices").add(notice_data)
    notice_data["id"] = doc_ref.id
    backup_document("notices", doc_ref.id, notice_data, "create")

    # 4. Notify students and other teachers of this batch
    # Query students in this batch
    student_docs = db.collection("users") \
        .where(filter=FieldFilter("role", "==", "student")) \
        .where(filter=FieldFilter("batch_id", "==", req.batch_id)) \
        .stream()

    student_recipients = [doc.id for doc in student_docs]

    # Send notifications to students (Title: Teacher's Name, Body: Notice Content)
    if student_recipients:
        notify_users(
            uids=student_recipients,
            message=req.content.strip(),
            notif_type="notice",
            title=user.get("name", "Teacher")
        )

    # Query and send notifications to other teachers assigned to this batch (Title: Batch Name, Body: Teacher Name: Notice Content)
    other_teachers = [tid for tid in batch_data.get("teacher_ids", []) if tid != user["uid"]]
    if other_teachers:
        teacher_name = user.get("name", "Teacher")
        notify_users(
            uids=other_teachers,
            message=f"{teacher_name}: {req.content.strip()}",
            notif_type="notice",
            title=batch_data.get("batch_name", "Unknown Batch")
        )

    # Clean up expired notices in the background
    background_tasks.add_task(cleanup_expired_notices)

    return {"message": "Notice published successfully", "notice": notice_data}


# ──────────────────────────────────────────────
# GET /api/notices/batch/{batch_id}
# ──────────────────────────────────────────────
@router.get("/batch/{batch_id}")
def get_batch_notices(
    batch_id: str,
    page: int = 1,
    limit: Optional[int] = None,
    user=Depends(require_role("student", "teacher")),
):
    """Retrieve notices for a specific batch created in the last 7 days, with optional pagination."""
    # 1. Permissions check
    if user.get("role") == "student" and user.get("batch_id") != batch_id:
        raise HTTPException(status_code=403, detail="Access denied to this batch's notices")

    if user.get("role") == "teacher":
        batch_doc = db.collection("batches").document(batch_id).get()
        if not batch_doc.exists:
            raise HTTPException(status_code=404, detail="Batch not found")
        batch_data = batch_doc.to_dict()
        if user["uid"] not in batch_data.get("teacher_ids", []):
            raise HTTPException(status_code=403, detail="Not assigned to this batch")

    # 2. Expiry calculation (7 days ago)
    cutoff = (datetime.now(IST) - timedelta(days=7)).isoformat()

    # 3. Retrieve notices with query-level index fallback
    if limit is not None:
        # Count notices in the last 7 days for the batch
        count_query = db.collection("notices") \
            .where(filter=FieldFilter("batch_id", "==", batch_id)) \
            .where(filter=FieldFilter("created_at", ">=", cutoff))
        
        total_notices = count_query.count().get()[0][0].value
        total_pages = max(1, (total_notices + limit - 1) // limit)
        current_page = max(1, min(page, total_pages))
        offset = (current_page - 1) * limit

        from google.cloud import firestore
        notices_docs = db.collection("notices") \
            .where(filter=FieldFilter("batch_id", "==", batch_id)) \
            .where(filter=FieldFilter("created_at", ">=", cutoff)) \
            .order_by("created_at", direction=firestore.Query.DESCENDING) \
            .limit(limit) \
            .offset(offset) \
            .stream()
        notices_list = [serialize_doc(doc) for doc in notices_docs]

        # Scrub reader details for student/non-owner teacher users to prevent seen-by info leak
        if user.get("role") == "student":
            current_uid = user["uid"]
            for notice in notices_list:
                # Hide the full readers list
                notice["readers"] = []
                # Keep only the current student's status in read_by so frontend isUnread can check it
                if "read_by" in notice:
                    notice["read_by"] = [current_uid] if current_uid in notice["read_by"] else []
        elif user.get("role") == "teacher":
            current_uid = user["uid"]
            for notice in notices_list:
                # Only the teacher who published the notice can see the reader details and read_by array
                if notice.get("published_by") != current_uid:
                    notice["readers"] = []
                    notice["read_by"] = []

        return {
            "notices": notices_list,
            "total_notices": total_notices,
            "total_pages": total_pages,
            "current_page": current_page
        }

    # If limit is None (backward compatibility), retrieve all documents
    try:
        notices_docs = db.collection("notices") \
            .where(filter=FieldFilter("batch_id", "==", batch_id)) \
            .where(filter=FieldFilter("created_at", ">=", cutoff)) \
            .stream()
        notices_list = [serialize_doc(doc) for doc in notices_docs]
    except Exception as e:
        print(f"\n[FIRESTORE WARNING] Server-side notice query failed: {e}\n")
        notices_docs = db.collection("notices") \
            .where(filter=FieldFilter("batch_id", "==", batch_id)) \
            .stream()
        notices_list = []
        for doc in notices_docs:
            data = serialize_doc(doc)
            if data.get("created_at", "") >= cutoff:
                notices_list.append(data)

    notices_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    # Scrub reader details for student/non-owner teacher users to prevent seen-by info leak
    if user.get("role") == "student":
        current_uid = user["uid"]
        for notice in notices_list:
            notice["readers"] = []
            if "read_by" in notice:
                notice["read_by"] = [current_uid] if current_uid in notice["read_by"] else []
    elif user.get("role") == "teacher":
        current_uid = user["uid"]
        for notice in notices_list:
            if notice.get("published_by") != current_uid:
                notice["readers"] = []
                notice["read_by"] = []

    return notices_list


# ──────────────────────────────────────────────
# GET /api/notices/unread-count
# ──────────────────────────────────────────────
@router.get("/unread-count")
def get_unread_notices_count(user=Depends(require_role("student"))):
    """Get count of unread active notices (created in the last 7 days) for the logged-in student."""
    batch_id = user.get("batch_id")
    if not batch_id:
        return {"unread_count": 0}

    cutoff = (datetime.now(IST) - timedelta(days=7)).isoformat()

    notices_docs = db.collection("notices") \
        .where(filter=FieldFilter("batch_id", "==", batch_id)) \
        .where(filter=FieldFilter("created_at", ">=", cutoff)) \
        .stream()
    notices_list = [serialize_doc(doc) for doc in notices_docs]

    uid = user["uid"]
    unread_count = sum(1 for n in notices_list if uid not in n.get("read_by", []))
    return {"unread_count": unread_count}


# ──────────────────────────────────────────────
# POST /api/notices/{notice_id}/read
# ──────────────────────────────────────────────
@router.post("/{notice_id}/read")
def mark_notice_as_read(notice_id: str, user=Depends(require_role("student", "teacher"))):
    """Mark a notice as read by adding the user to the read_by list."""
    notice_ref = db.collection("notices").document(notice_id)
    notice_doc = notice_ref.get()

    if not notice_doc.exists:
        raise HTTPException(status_code=404, detail="Notice not found")

    notice_data = notice_doc.to_dict()

    # Creator teacher should not be added to readers list
    if notice_data.get("published_by") == user["uid"]:
        return {"message": "Creator teacher not added to readers list", "read_by": notice_data.get("read_by", [])}

    batch_id = notice_data.get("batch_id")

    # Access control
    if user.get("role") == "student" and user.get("batch_id") != batch_id:
        raise HTTPException(status_code=403, detail="Access denied to this notice")

    if user.get("role") == "teacher":
        batch_doc = db.collection("batches").document(batch_id).get()
        if not batch_doc.exists:
            raise HTTPException(status_code=404, detail="Associated batch not found")
        batch_data = batch_doc.to_dict()
        if user["uid"] not in batch_data.get("teacher_ids", []):
            raise HTTPException(status_code=403, detail="Not assigned to this batch")

    # Update list in Firestore
    read_by = notice_data.get("read_by", [])
    readers = notice_data.get("readers", [])
    if user["uid"] not in read_by:
        read_by.append(user["uid"])
        readers.append({
            "uid": user["uid"],
            "name": user.get("name", "User"),
            "role": user.get("role", "student"),
            "read_at": ts_now()
        })
        notice_ref.update({
            "read_by": read_by,
            "readers": readers
        })
        updated_data = notice_doc.to_dict()
        updated_data["read_by"] = read_by
        updated_data["readers"] = readers
        backup_document("notices", notice_id, updated_data)

    # For student role, only return their own read status to prevent leaking other students' read status
    if user.get("role") == "student":
        return {"message": "Notice marked as read", "read_by": [user["uid"]]}

    # For teachers, only return the full list if they are the publisher of the notice
    if user.get("role") == "teacher" and notice_data.get("published_by") != user["uid"]:
        return {"message": "Notice marked as read", "read_by": []}

    return {"message": "Notice marked as read", "read_by": read_by}


# ──────────────────────────────────────────────
# DELETE /api/notices/cleanup/expired
# ──────────────────────────────────────────────
@router.delete("/cleanup/expired")
def manual_cleanup_expired_notices(user=Depends(require_role("teacher", "admin"))):
    """Manually clean up expired notices (older than 7 days) from the database."""
    deleted_count = cleanup_expired_notices()
    return {"message": "Cleanup completed", "deleted_count": deleted_count}


# ──────────────────────────────────────────────
# DELETE /api/notices/{notice_id}
# ──────────────────────────────────────────────
@router.delete("/{notice_id}")
def delete_notice(notice_id: str, user=Depends(require_role("teacher"))):
    """Delete a notice. Only the teacher who published it can delete it."""
    notice_ref = db.collection("notices").document(notice_id)
    notice_doc = notice_ref.get()

    if not notice_doc.exists:
        raise HTTPException(status_code=404, detail="Notice not found")

    notice_data = notice_doc.to_dict()

    # Only the creator teacher can delete
    if notice_data.get("published_by") != user["uid"]:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this notice")

    notice_ref.delete()
    delete_document_backup("notices", notice_id)
    return {"message": "Notice deleted successfully"}


# ──────────────────────────────────────────────
# POST /api/notices/{notice_id}/like
# ──────────────────────────────────────────────
@router.post("/{notice_id}/like")
def toggle_like_notice(notice_id: str, user=Depends(require_role("student", "teacher"))):
    """Toggle like state on a notice."""
    notice_ref = db.collection("notices").document(notice_id)
    notice_doc = notice_ref.get()

    if not notice_doc.exists:
        raise HTTPException(status_code=404, detail="Notice not found")

    notice_data = notice_doc.to_dict()
    likes = notice_data.get("likes", [])
    uid = user["uid"]

    if uid in likes:
        likes.remove(uid)
    else:
        likes.append(uid)

    notice_ref.update({"likes": likes})
    backup_document("notices", notice_id, {**notice_data, "likes": likes})
    return {"message": "Like updated", "likes": likes}

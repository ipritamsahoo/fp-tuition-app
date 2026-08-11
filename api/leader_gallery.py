"""
leader_gallery.py
=================
Helpers for maintaining the `leader_gallery` Firestore collection.
One document per batch (keyed by batch_id) that stores the fastest-payer
champion for the most recent billing cycle.

Imported by:
  - api/routers/admin.py   (on payment approve / revert / batch rename / batch delete)
  - api/routers/student.py (GET /api/student/leader-gallery)
"""

from database import db
from utils import ts_now
from google.cloud.firestore_v1.base_query import FieldFilter
from backup_service import backup_document, delete_document_backup


def update_leader_gallery_champion(batch_id: str, batch_name: str, payment: dict):
    """Update or create the champion for a batch in the leader_gallery collection.

    Called every time a payment is marked Paid (single or batch approval).

    Logic:
      - No doc exists            → create with this student as champion.
      - New payment newer cycle  → replace champion (new billing month started).
      - New payment same cycle   → replace only if requested_at is earlier.
      - New payment older cycle  → no change (late payment for past month).

    Cost: 1 Read + 0 or 1 Write per call.
    """
    try:
        new_month = payment.get("month")
        new_year = payment.get("year")
        new_student_id = payment.get("student_id")
        new_student_name = payment.get("student_name", "")
        new_requested_at = str(payment.get("requested_at") or "9999")

        if not new_month or not new_year or not new_student_id:
            return

        gallery_ref = db.collection("leader_gallery").document(batch_id)
        gallery_doc = gallery_ref.get()

        should_update = False

        if not gallery_doc.exists:
            # No champion yet → set this student
            should_update = True
        else:
            existing = gallery_doc.to_dict()
            existing_month = existing.get("month", 0)
            existing_year = existing.get("year", 0)
            existing_requested_at = str(existing.get("requested_at") or "9999")

            new_period = (new_year, new_month)
            existing_period = (existing_year, existing_month)

            if new_period > existing_period:
                # Newer billing cycle → always replace
                should_update = True
            elif new_period == existing_period:
                # Same billing cycle → faster requested_at wins
                if new_requested_at < existing_requested_at:
                    should_update = True
            # new_period < existing_period → old month late payment → skip

        if should_update:
            doc_data = {
                "batch_id":      batch_id,
                "batch_name":    batch_name,
                "student_id":    new_student_id,
                "student_name":  new_student_name,
                "month":         new_month,
                "year":          new_year,
                "requested_at":  new_requested_at,
                "updated_at":    ts_now(),
            }
            gallery_ref.set(doc_data, merge=True)
            backup_document("leader_gallery", batch_id, doc_data)
            print(f"[leader_gallery] Champion updated for batch {batch_id}: {new_student_name} ({new_month}/{new_year})")

    except Exception as e:
        print(f"[leader_gallery] update_champion failed for batch {batch_id}: {e}")


def recalculate_leader_gallery(batch_id: str, batch_name: str, reverted_month: int, reverted_year: int):
    """Recalculate the champion after the current champion's payment is reverted.

    Searches backwards month-by-month (up to 12 months) for the next fastest
    Paid student. If none found, deletes the leader_gallery document.

    Called ONLY when the reverted payment belongs to the current champion
    (admin.py checks this before calling to avoid unnecessary reads).
    """
    try:
        check_month = reverted_month
        check_year = reverted_year

        for _ in range(12):
            paid_stream = db.collection("payments") \
                .where(filter=FieldFilter("batch_id", "==", batch_id)) \
                .where(filter=FieldFilter("month", "==", check_month)) \
                .where(filter=FieldFilter("year", "==", check_year)) \
                .where(filter=FieldFilter("status", "==", "Paid")) \
                .stream()

            paid_list = []
            for p in paid_stream:
                data = p.to_dict()
                data["id"] = p.id
                paid_list.append(data)

            if paid_list:
                # Sort by requested_at to find the fastest payer
                paid_list.sort(key=lambda x: str(x.get("requested_at") or "9999"))
                top = paid_list[0]

                # Fetch fresh student name (profile_pic is fetched at GET time)
                student_doc = db.collection("users").document(top["student_id"]).get()
                student_name = top.get("student_name", "")
                if student_doc.exists:
                    student_name = student_doc.to_dict().get("name", student_name)

                doc_data = {
                    "batch_id":     batch_id,
                    "batch_name":   batch_name,
                    "student_id":   top["student_id"],
                    "student_name": student_name,
                    "month":        check_month,
                    "year":         check_year,
                    "requested_at": str(top.get("requested_at") or ""),
                    "updated_at":   ts_now(),
                }
                db.collection("leader_gallery").document(batch_id).set(doc_data, merge=True)
                backup_document("leader_gallery", batch_id, doc_data)
                print(f"[leader_gallery] Recalculated champion for batch {batch_id}: {student_name} ({check_month}/{check_year})")
                return

            # Go back one month
            check_month -= 1
            if check_month == 0:
                check_month = 12
                check_year -= 1

        # No Paid payments found in the last 12 months → remove the document
        db.collection("leader_gallery").document(batch_id).delete()
        delete_document_backup("leader_gallery", batch_id)
        print(f"[leader_gallery] No Paid payments in last 12 months for batch {batch_id} — document deleted.")

    except Exception as e:
        print(f"[leader_gallery] recalculate failed for batch {batch_id}: {e}")

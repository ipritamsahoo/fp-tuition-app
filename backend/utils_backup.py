"""
FP Finance Database Backup & Restore Utility
============================================
Handles full and incremental exports of Firestore collections, serializes datetime 
objects, and provides batch importing/restoring capabilities.
"""

import re
from datetime import datetime
from google.cloud.firestore_v1.base_query import FieldFilter
from database import db
from utils import ts_now
from firebase_admin import auth as firebase_auth

ISO_DATE_REGEX = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}')
COLLECTIONS = ["users", "batches", "payments", "notes", "distribution_snapshots"]

def get_last_backup_time():
    """Fetch the last backup timestamp from Firestore metadata."""
    doc_ref = db.collection("metadata").document("backup_info").get()
    if doc_ref.exists:
        return doc_ref.to_dict().get("last_backup_time")
    return None

def set_last_backup_time(timestamp):
    """Save the last backup timestamp in Firestore metadata."""
    db.collection("metadata").document("backup_info").set({
        "last_backup_time": timestamp
    }, merge=True)

def serialize_value(v):
    """Recursively serialize datetime/Timestamp objects to ISO strings."""
    if hasattr(v, "isoformat"):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: serialize_value(val) for k, val in v.items()}
    if isinstance(v, list):
        return [serialize_value(item) for item in v]
    return v

def parse_iso_timestamps(data):
    """Recursively convert ISO date strings back into datetime objects."""
    if isinstance(data, dict):
        return {k: parse_iso_timestamps(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [parse_iso_timestamps(item) for item in data]
    elif isinstance(data, str) and ISO_DATE_REGEX.match(data):
        try:
            # Handle 'Z' suffix or offset mapping
            cleaned = data.replace('Z', '+00:00')
            return datetime.fromisoformat(cleaned)
        except ValueError:
            return data
    return data

def export_database(mode="full"):
    """Export all or modified documents from the database collections."""
    last_backup = None
    if mode == "incremental":
        last_backup = get_last_backup_time()
        
    export_time = ts_now()
    backup_data = {
        "metadata": {
            "mode": mode,
            "exported_at": export_time,
            "previous_backup_time": last_backup
        },
        "data": {}
    }

    for col in COLLECTIONS:
        ref = db.collection(col)
        # 'users' and 'batches' are configuration/profile lists and relatively small.
        # Since they do not consistently maintain 'updated_at' timestamps across all admin/internal modifications,
        # we always back them up fully to ensure no updates are missed, while payments, notes, and snapshots remain incremental.
        if last_backup and col not in ["users", "batches"]:
            # Determine appropriate filter field
            filter_field = "updated_at"
            if col == "notes":
                filter_field = "created_at"
            elif col == "distribution_snapshots":
                filter_field = "settled_at"
                
            docs = ref.where(filter=FieldFilter(filter_field, ">", last_backup)).stream()
        else:
            docs = ref.stream()
            
        col_data = {}
        for doc in docs:
            col_data[doc.id] = serialize_value(doc.to_dict())
            
        backup_data["data"][col] = col_data
        
    # If successful, save the timestamp
    set_last_backup_time(export_time)
    
    return backup_data

def import_database(backup_data):
    """Import and restore database documents from backup data using batch writes."""
    collections_data = backup_data.get("data", {})
    total_restored = 0

    for col_name in COLLECTIONS:
        col_docs = collections_data.get(col_name, {})
        if not col_docs:
            continue
            
        batch = db.batch()
        count = 0
        
        for doc_id, doc_fields in col_docs.items():
            # Convert ISO date strings back to native Python datetime objects
            cleaned_fields = parse_iso_timestamps(doc_fields)
            
            # If restoring users, ensure their Firebase Auth accounts are recreated if missing
            if col_name == "users":
                role = cleaned_fields.get("role")
                email = cleaned_fields.get("email")
                name = cleaned_fields.get("name")
                username = cleaned_fields.get("username", "tempuser")
                
                # Recreate students and teachers if deleted from Firebase Auth
                if role in ["student", "teacher"] and email:
                    try:
                        firebase_auth.get_user(doc_id)
                    except Exception:
                        # User not found in Firebase Auth, let's recreate them with their original UID
                        try:
                            # Use temporary password format: #username@123
                            temp_password = f"#{username.strip()}@123"
                                
                            firebase_auth.create_user(
                                uid=doc_id,
                                email=email,
                                password=temp_password,
                                display_name=name
                            )
                            # Set custom role claim
                            firebase_auth.set_custom_user_claims(doc_id, {"role": role})
                        except Exception as auth_err:
                            print(f"Failed to auto-recreate auth user {name}: {auth_err}")
            
            doc_ref = db.collection(col_name).document(doc_id)
            batch.set(doc_ref, cleaned_fields, merge=True)
            count += 1
            
            # Firestore batch write limit is 500
            if count % 500 == 0:
                batch.commit()
                batch = db.batch()
                
        batch.commit()
        total_restored += count

    return total_restored

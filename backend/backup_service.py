"""
FP Finance — Google Drive Backup Service
=========================================
Write-Through Backup: Instead of Firestore on_snapshot() listeners (which
cause bulk reads on every server startup), each API endpoint calls
backup_document() or delete_document_backup() directly after a Firestore
write. This results in ZERO extra reads triggered by server restarts.

Public API (for use in router files):
  backup_document(collection_name, doc_id, doc_data, operation="update")
  delete_document_backup(collection_name, doc_id)
"""

import io
import json
import time
import threading
from datetime import datetime

from utils import serialize_value
from gdrive import get_drive_service, _get_or_create_subfolder, GOOGLE_DRIVE_FOLDER_ID
from googleapiclient.http import MediaIoBaseUpload


from concurrent.futures import ThreadPoolExecutor

COLLECTIONS = ["users", "batches", "payments", "notes", "notices", "distribution_snapshots"]

# Limit concurrent uploads/deletes to 3 workers to prevent memory exhaustion and Google Drive rate limits
backup_executor = ThreadPoolExecutor(max_workers=3)

def get_iso_now():
    """Returns ISO format timestamp with Z suffix."""
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def run_in_background(func, *args, **kwargs):
    """Utility to run blocking tasks in a thread pool executor."""
    backup_executor.submit(func, *args, **kwargs)


def _find_existing_file(service, folder_id: str, filename: str) -> str | None:
    """
    Searches for an existing file by name inside a specific Drive folder.
    Returns the file ID if found, otherwise None.
    """
    escaped = filename.replace("'", "\\'")
    query = f"name = '{escaped}' and '{folder_id}' in parents and trashed = false"
    response = service.files().list(q=query, spaces='drive', fields='files(id)').execute()
    files = response.get('files', [])
    return files[0]['id'] if files else None


def upload_json_to_gdrive_sync(file_content: str, filename: str, path_in_backup: str):
    """
    Upserts a JSON backup file into Google Drive:
    - If a file with the same name already exists in the target subfolder, it is OVERWRITTEN.
    - If no file exists, a new one is created.
    This ensures each Firestore document maps to exactly ONE file in Google Drive.
    """
    service = get_drive_service()
    if not GOOGLE_DRIVE_FOLDER_ID:
        print("[Backup] GOOGLE_DRIVE_FOLDER_ID not set. Skipping upload.")
        return None

    # Resolve FP Finance Database Backup folder and its specific subfolder
    root_id = _get_or_create_subfolder(service, GOOGLE_DRIVE_FOLDER_ID, "FP Finance Database Backup")
    target_folder_id = _get_or_create_subfolder(service, root_id, path_in_backup)

    content_bytes = file_content.encode("utf-8")
    media = MediaIoBaseUpload(io.BytesIO(content_bytes), mimetype="application/json", resumable=True)

    existing_file_id = _find_existing_file(service, target_folder_id, filename)

    if existing_file_id:
        # OVERWRITE: update existing file content in-place (no new file created)
        service.files().update(
            fileId=existing_file_id,
            media_body=media
        ).execute()
        return existing_file_id
    else:
        # CREATE: first time this document is backed up
        file_metadata = {
            "name": filename,
            "parents": [target_folder_id]
        }
        created_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id"
        ).execute()
        file_id = created_file.get("id")

        # Make publicly readable (same as rest of gdrive.py)
        try:
            service.permissions().create(
                fileId=file_id,
                body={"role": "reader", "type": "anyone"},
            ).execute()
        except Exception as share_err:
            print(f"[Backup] Failed sharing file {filename}: {share_err}")

        return file_id


def upload_json_with_retry(file_content: str, filename: str, path_in_backup: str, max_retries=3):
    """Uploads JSON backup to Google Drive with exponential backoff on failure."""
    delay = 1
    for attempt in range(max_retries):
        try:
            file_id = upload_json_to_gdrive_sync(file_content, filename, path_in_backup)
            print(f"[Backup] Upserted '{filename}' in Google Drive subfolder '{path_in_backup}' (ID: {file_id})")
            return file_id
        except Exception as e:
            print(f"[Backup] Attempt {attempt + 1} failed for '{filename}': {e}")
            if attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 2
            else:
                print(f"[Backup] Exceeded maximum retries for '{filename}'. Backup failed.")
                return None


def delete_backup_from_gdrive_sync(filename: str, path_in_backup: str):
    """
    Deletes a backup file from Google Drive when the corresponding
    Firestore document is deleted. Keeps Drive clean and in sync with Firestore.
    """
    service = get_drive_service()
    if not GOOGLE_DRIVE_FOLDER_ID:
        return

    try:
        root_id = _get_or_create_subfolder(service, GOOGLE_DRIVE_FOLDER_ID, "FP Finance Database Backup")
        target_folder_id = _get_or_create_subfolder(service, root_id, path_in_backup)
        file_id = _find_existing_file(service, target_folder_id, filename)

        if file_id:
            service.files().delete(fileId=file_id).execute()
            print(f"[Backup] Deleted backup file '{filename}' from Google Drive subfolder '{path_in_backup}'")
        else:
            print(f"[Backup] No backup file found for '{filename}' — nothing to delete.")
    except Exception as e:
        print(f"[Backup] Error deleting backup file '{filename}': {e}")


def delete_backup_with_retry(filename: str, path_in_backup: str, max_retries=3):
    """Deletes a Drive backup file with exponential backoff retry on failure."""
    delay = 1
    for attempt in range(max_retries):
        try:
            delete_backup_from_gdrive_sync(filename, path_in_backup)
            return
        except Exception as e:
            print(f"[Backup] Delete attempt {attempt + 1} failed for '{filename}': {e}")
            if attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 2
            else:
                print(f"[Backup] Exceeded maximum retries for deleting '{filename}'.")


# ──────────────────────────────────────────────────────────────
# PUBLIC API — Called by router files after every Firestore write
# ──────────────────────────────────────────────────────────────

def backup_document(collection_name: str, doc_id: str, doc_data: dict, operation: str = "update"):
    """
    Call this after any Firestore create or update operation.
    Serializes the document and queues an async Drive upsert in a background thread.

    Args:
        collection_name: Firestore collection (e.g. "users", "payments")
        doc_id:          Firestore document ID
        doc_data:        Full document data dict (or partial update dict)
        operation:       "create" or "update" (for audit trail in the JSON file)
    """
    try:
        timestamp = get_iso_now()
        filename = f"{collection_name}_{doc_id}.json"
        serialized_data = serialize_value(doc_data)
        backup_payload = {
            "docId": doc_id,
            "collectionName": collection_name,
            "timestamp": timestamp,
            "operationType": operation,
            "data": serialized_data,
        }
        payload_str = json.dumps(backup_payload, indent=2)
        run_in_background(upload_json_with_retry, payload_str, filename, collection_name)
    except Exception as e:
        print(f"[Backup] Failed to queue backup for {collection_name}/{doc_id}: {e}")


def delete_document_backup(collection_name: str, doc_id: str):
    """
    Call this after any Firestore delete operation.
    Queues an async Drive file deletion in a background thread.

    Args:
        collection_name: Firestore collection (e.g. "users", "payments")
        doc_id:          Firestore document ID
    """
    try:
        filename = f"{collection_name}_{doc_id}.json"
        run_in_background(delete_backup_with_retry, filename, collection_name)
    except Exception as e:
        print(f"[Backup] Failed to queue delete backup for {collection_name}/{doc_id}: {e}")

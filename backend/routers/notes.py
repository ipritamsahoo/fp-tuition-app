from typing import Optional
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from database import db
from dependencies import require_role
from utils import ts_now, serialize_doc
from gdrive import upload_to_gdrive, delete_from_gdrive
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/notes", tags=["Notes"])

# ──────────────────────────────────────────────
# POST /api/notes/upload
# ──────────────────────────────────────────────
@router.post("/upload")
async def upload_note(
    title: str = Form(...),
    batch_id: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(require_role("teacher", "admin")),
):
    """Uploads notes (any file type) to Google Drive and saves metadata in Firestore."""
    # Verify the batch exists
    batch_doc = db.collection("batches").document(batch_id).get()
    if not batch_doc.exists:
        raise HTTPException(status_code=404, detail="Batch not found")
        
    batch_data = batch_doc.to_dict()
    
    # If the user is a teacher, verify they are assigned to this batch
    if user.get("role") == "teacher" and user["uid"] not in batch_data.get("teacher_ids", []):
        raise HTTPException(status_code=403, detail="Not assigned to this batch")
        
    # Read file content
    contents = await file.read()
        
    # Upload to Google Drive (inside a subfolder named after the batch)
    batch_name = batch_data.get("batch_name", "General Notes")
    try:
        drive_result = await upload_to_gdrive(
            file_content=contents,
            filename=file.filename,
            content_type=file.content_type,
            subfolder_name=batch_name
        )
    except Exception as e:
        print(f"Google Drive Upload Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload to Google Drive: {str(e)}")
        
    # Store metadata in Firestore "notes" collection
    note_data = {
        "title": title,
        "batch_id": batch_id,
        "batch_name": batch_data.get("batch_name", "Unknown"),
        "file_name": file.filename,
        "file_url": drive_result["file_url"],
        "file_id": drive_result["file_id"],
        "uploaded_by": user["uid"],
        "uploaded_by_name": user.get("name", "Teacher"),
        "created_at": ts_now(),
    }
    
    _, doc_ref = db.collection("notes").add(note_data)
    
    note_data["id"] = doc_ref.id
    return {"message": "Note uploaded successfully", "note": note_data}


# ──────────────────────────────────────────────
# GET /api/notes/batch/{batch_id}
# ──────────────────────────────────────────────
@router.get("/batch/{batch_id}")
def get_batch_notes(
    batch_id: str,
    page: int = 1,
    limit: Optional[int] = None,
    uploaded_by: Optional[str] = None,
    user=Depends(require_role("student", "teacher", "admin")),
):
    """Retrieve notes for a specific batch, with optional pagination and uploader filter."""
    # Auth checking:
    # 1. Students can only see their own batch's notes
    if user.get("role") == "student" and user.get("batch_id") != batch_id:
        raise HTTPException(status_code=403, detail="Access denied to this batch's notes")
        
    # 2. Teachers can only see batches they are assigned to
    if user.get("role") == "teacher":
        batch_doc = db.collection("batches").document(batch_id).get()
        if not batch_doc.exists:
            raise HTTPException(status_code=404, detail="Batch not found")
        batch_data = batch_doc.to_dict()
        if user["uid"] not in batch_data.get("teacher_ids", []):
            raise HTTPException(status_code=403, detail="Not assigned to this batch")

    # Fetch notes
    query = db.collection("notes").where(filter=FieldFilter("batch_id", "==", batch_id))
    
    if uploaded_by:
        query = query.where(filter=FieldFilter("uploaded_by", "==", uploaded_by))
        
    if limit is not None:
        try:
            # Try server-side ordering & pagination (requires composite index)
            # Get total count (optimally using Firestore count aggregation)
            total_notes = query.count().get()[0][0].value
            total_pages = max(1, (total_notes + limit - 1) // limit)
            current_page = max(1, min(page, total_pages))
            offset = (current_page - 1) * limit
            
            from google.cloud import firestore
            notes_docs = query.order_by("created_at", direction=firestore.Query.DESCENDING) \
                .limit(limit) \
                .offset(offset) \
                .stream()
                
            notes_list = [serialize_doc(doc) for doc in notes_docs]
            return {
                "notes": notes_list,
                "total_notes": total_notes,
                "total_pages": total_pages,
                "current_page": current_page
            }
        except Exception as e:
            # Fall back to python-side sorting & slicing if index is building/missing, print creation link
            print(f"\n[FIRESTORE WARNING] Server-side index query failed. If index is missing, please create it:\n{e}\n")
            
            notes_docs = query.stream()
            notes_list = [serialize_doc(doc) for doc in notes_docs]
            notes_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            
            total_notes = len(notes_list)
            total_pages = max(1, (total_notes + limit - 1) // limit)
            current_page = max(1, min(page, total_pages))
            offset = (current_page - 1) * limit
            
            return {
                "notes": notes_list[offset : offset + limit],
                "total_notes": total_notes,
                "total_pages": total_pages,
                "current_page": current_page
            }
    else:
        notes_docs = query.stream()
        notes_list = [serialize_doc(doc) for doc in notes_docs]
        # Sort in Python to avoid composite index requirement for unpaginated queries
        notes_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return notes_list

# ──────────────────────────────────────────────
# DELETE /api/notes/{note_id}
# ──────────────────────────────────────────────
@router.delete("/{note_id}")
def delete_note(
    note_id: str,
    user=Depends(require_role("teacher", "admin")),
):
    """Delete a note from Google Drive and Firestore."""
    note_ref = db.collection("notes").document(note_id)
    note_doc = note_ref.get()
    
    if not note_doc.exists:
        raise HTTPException(status_code=404, detail="Note not found")
        
    note_data = note_doc.to_dict()
    
    # Check permissions: Only the uploader teacher or an admin can delete
    if user.get("role") == "teacher" and note_data.get("uploaded_by") != user["uid"]:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this note")
        
    # Delete from Google Drive
    file_id = note_data.get("file_id")
    if file_id:
        delete_from_gdrive(file_id)
        
    # Delete from Firestore
    note_ref.delete()
    
    return {"message": "Note deleted successfully"}


# ──────────────────────────────────────────────
# GET /api/notes/{note_id}/download
# ──────────────────────────────────────────────
@router.get("/{note_id}/download")
def download_note_file(
    note_id: str,
    user=Depends(require_role("student", "teacher", "admin")),
):
    """Downloads a note's file directly from Google Drive and streams it to the user."""
    # 1. Fetch note metadata from Firestore
    note_ref = db.collection("notes").document(note_id)
    note_doc = note_ref.get()
    
    if not note_doc.exists:
        raise HTTPException(status_code=404, detail="Note not found")
        
    note_data = note_doc.to_dict()
    
    # 2. Permissions check
    # Student check: must belong to the note's batch
    if user.get("role") == "student" and user.get("batch_id") != note_data.get("batch_id"):
        raise HTTPException(status_code=403, detail="Access denied to this note")
        
    # Teacher check: must be assigned to the batch
    if user.get("role") == "teacher":
        batch_doc = db.collection("batches").document(note_data.get("batch_id", "")).get()
        if batch_doc.exists:
            batch_data = batch_doc.to_dict()
            if user["uid"] not in batch_data.get("teacher_ids", []):
                raise HTTPException(status_code=403, detail="Not assigned to this batch")
        else:
            raise HTTPException(status_code=404, detail="Batch associated with note not found")
            
    # 3. Get Google Drive file ID
    file_id = note_data.get("file_id")
    if not file_id:
        raise HTTPException(status_code=404, detail="Google Drive file ID not found for this note")
        
    try:
        from gdrive import get_drive_service
        service = get_drive_service()
        # Fetch file metadata from Google Drive to get the original MIME type
        drive_file = service.files().get(fileId=file_id, fields="mimeType").execute()
        mime_type = drive_file.get("mimeType", "application/octet-stream")
        
        # Download the file content from Google Drive
        file_bytes = service.files().get_media(fileId=file_id).execute()
        
        # Stream the response with Content-Disposition attachment to trigger download
        filename = note_data.get("file_name", "downloaded_note")
        
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        print(f"Error downloading from GDrive: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download file from Google Drive: {str(e)}")

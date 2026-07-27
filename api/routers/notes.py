from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from fastapi.responses import RedirectResponse
from database import db
from dependencies import require_role, require_role_flexible
from utils import ts_now, serialize_doc
from gdrive import upload_to_gdrive, delete_from_gdrive, download_from_gdrive, _download_sync
from google.cloud.firestore_v1.base_query import FieldFilter
from backup_service import backup_document, delete_document_backup

router = APIRouter(prefix="/api/notes", tags=["Notes"])

# ──────────────────────────────────────────────
# POST /api/notes/upload
# ──────────────────────────────────────────────
@router.post("/upload")
async def upload_note(
    batch_id: str = Form(...),
    files: List[UploadFile] = File(...),
    file_captions: List[str] = Form(default=[]),
    user=Depends(require_role("teacher", "admin")),
):
    """Uploads multiple files to Google Drive and saves metadata as a single document in Firestore."""
    # Verify the batch exists
    batch_doc = db.collection("batches").document(batch_id).get()
    if not batch_doc.exists:
        raise HTTPException(status_code=404, detail="Batch not found")
        
    batch_data = batch_doc.to_dict()
    
    # If the user is a teacher, verify they are assigned to this batch
    if user.get("role") == "teacher" and user["uid"] not in batch_data.get("teacher_ids", []):
        raise HTTPException(status_code=403, detail="Not assigned to this batch")

    batch_name = batch_data.get("batch_name", "General Notes")

    # Pad file_captions to match number of files (in case fewer captions were sent)
    padded_captions = list(file_captions) + [""] * (len(files) - len(file_captions))

    files_metadata = []
    
    for f, f_caption in zip(files, padded_captions):
        contents = await f.read()
        try:
            drive_result = await upload_to_gdrive(
                file_content=contents,
                filename=f.filename,
                content_type=f.content_type,
                subfolder_name=batch_name
            )
            files_metadata.append({
                "caption": f_caption.strip() or f.filename,
                "file_name": f.filename,
                "file_url": drive_result["file_url"],
                "file_id": drive_result["file_id"]
            })
        except Exception as e:
            print(f"Google Drive Upload Error for {f.filename}: {e}")
            # Clean up previously uploaded files in this request
            for uploaded_file in files_metadata:
                try:
                    delete_from_gdrive(uploaded_file["file_id"])
                except Exception as cleanup_err:
                    print(f"Cleanup error for {uploaded_file['file_name']}: {cleanup_err}")
            raise HTTPException(status_code=500, detail=f"Failed to upload {f.filename} to Google Drive: {str(e)}")
        
    # Store metadata in Firestore "notes" collection
    note_data = {
        "batch_id": batch_id,
        "batch_name": batch_data.get("batch_name", "Unknown"),
        "files": files_metadata,
        "uploaded_by": user["uid"],
        "uploaded_by_name": user.get("name", "Teacher"),
        "created_at": ts_now(),
    }
    
    _, doc_ref = db.collection("notes").add(note_data)
    
    note_data["id"] = doc_ref.id
    backup_document("notes", doc_ref.id, note_data, "create")
    return {"message": "Notes uploaded successfully", "note": note_data}


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
        
    # Delete all files from Google Drive
    files_list = note_data.get("files", [])
    if files_list:
        for f in files_list:
            file_id = f.get("file_id")
            if file_id:
                try:
                    delete_from_gdrive(file_id)
                except Exception as e:
                    print(f"Error deleting file {file_id} from GDrive: {e}")
    else:
        # Fallback for old single note format
        file_id = note_data.get("file_id")
        if file_id:
            try:
                delete_from_gdrive(file_id)
            except Exception as e:
                print(f"Error deleting file {file_id} from GDrive: {e}")
        
    # Delete from Firestore
    note_ref.delete()
    delete_document_backup("notes", note_id)
    
    return {"message": "Note deleted successfully"}


# ──────────────────────────────────────────────
# GET /api/notes/{note_id}/download
# ──────────────────────────────────────────────
@router.get("/{note_id}/download")
def download_note_file(
    note_id: str,
    file_id: Optional[str] = None,
    user=Depends(require_role_flexible("student", "teacher", "admin")),
):
    """Downloads a note's file by redirecting the browser directly to the Google Drive download url."""
    # 1. Fetch note metadata from Firestore
    note_ref = db.collection("notes").document(note_id)
    note_doc = note_ref.get()
    
    if not note_doc.exists:
        raise HTTPException(status_code=404, detail="Note not found")
        
    note_data = note_doc.to_dict()
    
    # 2. Permissions check
    if user.get("role") == "student" and user.get("batch_id") != note_data.get("batch_id"):
        raise HTTPException(status_code=403, detail="Access denied to this note")
        
    if user.get("role") == "teacher":
        batch_doc = db.collection("batches").document(note_data.get("batch_id", "")).get()
        if batch_doc.exists:
            batch_data = batch_doc.to_dict()
            if user["uid"] not in batch_data.get("teacher_ids", []):
                raise HTTPException(status_code=403, detail="Not assigned to this batch")
        else:
            raise HTTPException(status_code=404, detail="Batch associated with note not found")
            
    # 3. Get Google Drive file ID
    if file_id:
        files_list = note_data.get("files", [])
        matching_file = next((f for f in files_list if f.get("file_id") == file_id), None)
        if not matching_file:
            old_file_id = note_data.get("file_id")
            if old_file_id != file_id:
                raise HTTPException(status_code=404, detail="File not found in this note group")
    else:
        file_id = note_data.get("file_id")
        if not file_id:
            files_list = note_data.get("files", [])
            if files_list:
                file_id = files_list[0].get("file_id")
            
    if not file_id:
        raise HTTPException(status_code=404, detail="Google Drive file ID not found for this note")

    # Redirect to docs.google.com direct download link instead of drive.google.com
    # to prevent mobile Google Drive app from intercepting the request
    direct_download_url = f"https://docs.google.com/uc?export=download&id={file_id}"
    return RedirectResponse(url=direct_download_url, status_code=302)


# ──────────────────────────────────────────────
# GET /api/notes/{note_id}/files/{file_id}/view
# ──────────────────────────────────────────────
@router.get("/{note_id}/files/{file_id}/view")
def view_note_file(
    note_id: str,
    file_id: str,
    user=Depends(require_role_flexible("student", "teacher", "admin")),
):
    """Streams a file from Google Drive for inline viewing (preview)."""
    # 1. Fetch note metadata from Firestore
    note_ref = db.collection("notes").document(note_id)
    note_doc = note_ref.get()
    
    if not note_doc.exists:
        raise HTTPException(status_code=404, detail="Note not found")
        
    note_data = note_doc.to_dict()
    
    # 2. Permissions check
    if user.get("role") == "student" and user.get("batch_id") != note_data.get("batch_id"):
        raise HTTPException(status_code=403, detail="Access denied to this note")
        
    if user.get("role") == "teacher":
        batch_doc = db.collection("batches").document(note_data.get("batch_id", "")).get()
        if batch_doc.exists:
            batch_data = batch_doc.to_dict()
            if user["uid"] not in batch_data.get("teacher_ids", []):
                raise HTTPException(status_code=403, detail="Not assigned to this batch")
        else:
            raise HTTPException(status_code=404, detail="Batch associated with note not found")
            
    # 3. Verify file_id exists in note group
    files_list = note_data.get("files", [])
    matching_file = next((f for f in files_list if f.get("file_id") == file_id), None)
    if not matching_file:
        old_file_id = note_data.get("file_id")
        if old_file_id != file_id:
            raise HTTPException(status_code=404, detail="File not found in this note group")
            
    # 4. Download/Stream from Google Drive using credentials
    try:
        file_bytes, filename, mime_type = _download_sync(file_id)
        headers = {
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "max-age=3600"
        }
        return Response(content=file_bytes, media_type=mime_type, headers=headers)
    except Exception as e:
        print(f"Error streaming file {file_id} from GDrive: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve file content from storage")



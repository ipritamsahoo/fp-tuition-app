import io
import asyncio
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    GOOGLE_DRIVE_FOLDER_ID
)

_drive_service_cache = None

def get_drive_service():
    """Initializes Google Drive API service using refresh token authentication."""
    global _drive_service_cache
    if _drive_service_cache is not None:
        return _drive_service_cache

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REFRESH_TOKEN:
        raise ValueError("Google Drive credentials not set in environment variables.")

    creds = Credentials(
        token=None,
        refresh_token=GOOGLE_REFRESH_TOKEN,
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token"
    )
    _drive_service_cache = build('drive', 'v3', credentials=creds)
    return _drive_service_cache


def _get_or_create_subfolder(service, parent_folder_id: str, folder_name: str) -> str:
    """Gets an existing subfolder by name or creates a new one inside the parent folder."""
    # Escape single quotes in folder name for query safety
    escaped_name = folder_name.replace("'", "\\'")
    query = f"mimeType = 'application/vnd.google-apps.folder' and name = '{escaped_name}' and '{parent_folder_id}' in parents and trashed = false"
    
    response = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    files = response.get('files', [])
    
    if files:
        return files[0]['id']
        
    # Create the folder if it does not exist
    folder_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_folder_id]
    }
    new_folder = service.files().create(body=folder_metadata, fields='id').execute()
    new_folder_id = new_folder.get('id')
    
    # Share the subfolder publicly so files inside it are easily accessible
    try:
        service.permissions().create(
            fileId=new_folder_id,
            body={"role": "reader", "type": "anyone"},
        ).execute()
    except Exception as e:
        print(f"Error sharing subfolder '{folder_name}': {e}")
        
    return new_folder_id


def _upload_sync(file_content: bytes, filename: str, content_type: str, subfolder_name: str = None) -> dict:
    """
    Synchronous (blocking) Google Drive upload.
    Called via asyncio.to_thread() so it does NOT block FastAPI's event loop.
    """
    service = get_drive_service()

    # Sanitize content_type — Google Drive API rejects None or empty mimetype
    mime = content_type or "application/octet-stream"

    file_metadata = {"name": filename}
    
    # Resolve the destination folder
    parent_id = GOOGLE_DRIVE_FOLDER_ID
    if parent_id:
        if subfolder_name:
            try:
                parent_id = _get_or_create_subfolder(service, parent_id, subfolder_name)
            except Exception as folder_err:
                print(f"Error resolving subfolder '{subfolder_name}': {folder_err}")
                parent_id = GOOGLE_DRIVE_FOLDER_ID  # Fallback to root folder on error
        
        file_metadata["parents"] = [parent_id]

    media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime, resumable=True)

    uploaded_file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id, webViewLink, webContentLink"
    ).execute()

    file_id = uploaded_file.get("id")

    # Make the file publicly readable
    service.permissions().create(
        fileId=file_id,
        body={"role": "reader", "type": "anyone"},
    ).execute()

    # webContentLink gives a direct download URL for images/PDFs
    download_url = uploaded_file.get("webContentLink") or uploaded_file.get("webViewLink")

    return {"file_id": file_id, "file_url": download_url}


async def upload_to_gdrive(file_content: bytes, filename: str, content_type: str, subfolder_name: str = None) -> dict:
    """
    Async wrapper: runs the blocking Drive upload in a separate thread
    so FastAPI's event loop is never blocked.
    """
    return await asyncio.to_thread(_upload_sync, file_content, filename, content_type, subfolder_name)


def _delete_sync(file_id: str) -> bool:
    """Synchronous deletion from Google Drive."""
    try:
        service = get_drive_service()
        service.files().delete(fileId=file_id).execute()
        return True
    except Exception as e:
        print(f"Error deleting file {file_id} from Google Drive: {e}")
        return False


def delete_from_gdrive(file_id: str) -> bool:
    """Deletes a file from Google Drive (synchronous, safe to call from endpoints)."""
    return _delete_sync(file_id)


def delete_folder_from_gdrive(folder_name: str) -> bool:
    """
    Finds a subfolder by name inside the root Drive folder and permanently deletes it
    along with all its contents. Used when a batch is deleted.
    Returns True if deleted (or not found), False on error.
    """
    try:
        service = get_drive_service()
        escaped_name = folder_name.replace("'", "\\'")
        query = (
            f"mimeType = 'application/vnd.google-apps.folder' "
            f"and name = '{escaped_name}' "
            f"and '{GOOGLE_DRIVE_FOLDER_ID}' in parents "
            f"and trashed = false"
        )
        response = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        folders = response.get('files', [])

        if not folders:
            print(f"[GDrive] No folder found named '{folder_name}' — skipping folder delete.")
            return True  # Not an error — folder may not exist yet

        for folder in folders:
            service.files().delete(fileId=folder['id']).execute()
            print(f"[GDrive] Deleted folder '{folder_name}' (id={folder['id']})")

        return True
    except Exception as e:
        print(f"[GDrive] Error deleting folder '{folder_name}': {e}")
        return False


def _download_sync(file_id: str) -> tuple:
    """Synchronous file download from Google Drive."""
    import requests
    from google.auth.transport.requests import Request
    
    service = get_drive_service()
    creds = service._http.credentials
    
    if not creds.valid:
        creds.refresh(Request())
        
    headers = {
        "Authorization": f"Bearer {creds.token}"
    }
    
    # 1. Fetch metadata
    meta_url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
    meta_res = requests.get(meta_url, headers=headers)
    if meta_res.status_code != 200:
        raise Exception(f"Failed to fetch file metadata from GDrive: {meta_res.text}")
        
    metadata = meta_res.json()
    filename = metadata.get("name", "note")
    mime_type = metadata.get("mimeType", "application/octet-stream")
    
    # 2. Fetch media content
    media_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
    media_res = requests.get(media_url, headers=headers)
    if media_res.status_code != 200:
        raise Exception(f"Failed to fetch file content from GDrive: {media_res.text}")
        
    return media_res.content, filename, mime_type



async def download_from_gdrive(file_id: str) -> tuple:
    """Asynchronous wrapper for downloading file content from Google Drive."""
    return await asyncio.to_thread(_download_sync, file_id)

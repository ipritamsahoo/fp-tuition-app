import json
from database import db
from backup_service import COLLECTIONS, get_iso_now, upload_json_to_gdrive_sync
from utils import serialize_value

def run_full_backup():
    print("====================================================")
    print("  FP Finance — Full Google Drive Database Backup")
    print("====================================================")
    
    total_backed_up = 0
    
    for col in COLLECTIONS:
        print(f"\nFetching documents from Firestore collection: '{col}'...")
        try:
            docs = list(db.collection(col).stream())
            if not docs:
                print(f"No documents found in collection '{col}'. Skipping.")
                continue
                
            print(f"Found {len(docs)} documents. Uploading to Google Drive sequentially...")
            
            for index, doc in enumerate(docs, 1):
                doc_id = doc.id
                doc_data = doc.to_dict()
                
                # Format payload
                backup_payload = {
                    "docId": doc_id,
                    "collectionName": col,
                    "timestamp": get_iso_now(),
                    "operationType": "create",
                    "data": serialize_value(doc_data)
                }
                payload_str = json.dumps(backup_payload, indent=2)
                filename = f"{col}_{doc_id}.json"
                
                # Upload synchronously to prevent concurrent folder creation race conditions
                file_id = upload_json_to_gdrive_sync(payload_str, filename, col)
                if file_id:
                    print(f"  [{index}/{len(docs)}] Successfully backed up: {filename} (ID: {file_id})")
                else:
                    print(f"  [{index}/{len(docs)}] Failed to back up: {filename}")
                
                total_backed_up += 1
                
        except Exception as e:
            print(f"[Error] Failed to back up collection '{col}': {e}")
            
    print("\n====================================================")
    print("  Full Backup Complete!")
    print("====================================================")
    print(f"Successfully backed up {total_backed_up} documents to Google Drive.")

if __name__ == "__main__":
    run_full_backup()

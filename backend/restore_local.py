import os
import json
from firebase_admin import auth as firebase_auth
from database import db
from utils import parse_iso_timestamps

def run_local_restore():
    backup_root = "d:/My Projects/fp-tuition-app/FP Finance Database Backup"
    if not os.path.exists(backup_root):
        print(f"[Error] Local backup directory not found at: {backup_root}")
        return

    print("====================================================")
    print("  FP Finance — Standalone Local Database Restore")
    print("====================================================")
    print(f"Scanning local backup files in: {backup_root}")

    backups_map = {}
    file_count = 0

    # Walk recursively through local directories
    for root, dirs, files in os.walk(backup_root):
        for f in files:
            if not f.endswith(".json"):
                continue
            
            file_path = os.path.join(root, f)
            file_count += 1
            
            try:
                with open(file_path, "r", encoding="utf-8") as file:
                    backup_data = json.load(file)
            except Exception as e:
                print(f"  [Warning] Skipping corrupt file {f}: {e}")
                continue

            col_name = backup_data.get("collectionName")
            doc_id = backup_data.get("docId")
            timestamp = backup_data.get("timestamp")

            if not col_name or not doc_id or not timestamp:
                print(f"  [Warning] Skipping invalid backup payload in file {f}")
                continue

            key = (col_name, doc_id)
            backups_map.setdefault(key, []).append((timestamp, backup_data))

    print(f"Found {file_count} total backup files. Resolving latest versions...")

    # Resolve latest version for each document ID
    latest_documents = {}
    for key, versions in backups_map.items():
        versions.sort(key=lambda x: x[0])  # Sort by timestamp ascending
        latest_documents[key] = versions[-1][1]

    # Group by collection
    from collections import defaultdict
    docs_by_col = defaultdict(list)
    
    restored_count = 0
    recreated_auth_count = 0

    for (col_name, doc_id), backup_data in latest_documents.items():
        doc_fields = backup_data.get("data")
        if doc_fields is None:
            continue

        cleaned_fields = parse_iso_timestamps(doc_fields)
        docs_by_col[col_name].append((doc_id, cleaned_fields))

    print("\nWriting restored documents to Firestore...")
    for col_name, docs_list in docs_by_col.items():
        batch = db.batch()
        count = 0
        print(f"Restoring collection: '{col_name}' ({len(docs_list)} docs)...")

        for doc_id, cleaned_fields in docs_list:
            # Recreate Auth users if missing
            if col_name == "users":
                role = cleaned_fields.get("role")
                email = cleaned_fields.get("email")
                name = cleaned_fields.get("name")
                username = cleaned_fields.get("username", "tempuser")

                if role in ["student", "teacher", "admin"] and email:
                    try:
                        firebase_auth.get_user(doc_id)
                    except Exception:
                        try:
                            # Generate initials-based temporary password (e.g., Ram Das -> #rd@123)
                            if name:
                                name_parts = name.split()
                                initials = "".join([p[0].lower() for p in name_parts if p])
                                temp_password = f"#{initials}@123"
                            else:
                                temp_password = f"#{username.strip().lower()}@123"
                            
                            firebase_auth.create_user(
                                uid=doc_id,
                                email=email,
                                password=temp_password,
                                display_name=name
                            )
                            firebase_auth.set_custom_user_claims(doc_id, {"role": role})
                            recreated_auth_count += 1
                            print(f"  [Auth] Recreated auth user account: {email} ({role})")
                        except Exception as auth_err:
                            print(f"  [Auth Error] Failed to recreate auth for user {email}: {auth_err}")

            doc_ref = db.collection(col_name).document(doc_id)
            batch.set(doc_ref, cleaned_fields, merge=True)
            count += 1

            if count % 500 == 0:
                batch.commit()
                batch = db.batch()

        batch.commit()
        restored_count += count

    print("\n====================================================")
    print("  Local Database Restore Complete!")
    print("====================================================")
    print(f"Total documents restored/updated: {restored_count}")
    print(f"Firebase Auth accounts recreated: {recreated_auth_count}")
    print("Details by collection:")
    for col, count in docs_by_col.items():
        print(f"  - {col}: {len(count)}")

if __name__ == "__main__":
    run_local_restore()

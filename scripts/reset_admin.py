import sys
import os

# Add api/ directory to sys.path
api_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'api')
sys.path.insert(0, api_dir)

import firebase_admin
from firebase_admin import auth as firebase_auth
from google.cloud.firestore_v1.base_query import FieldFilter

from database import db
from backup_service import delete_document_backup
from config import MASTER_KEY

def reset_admins():
    print("=" * 60)
    print("      FP Finance - Emergency Admin Reset Script      ")
    print("=" * 60)
    print("WARNING: This will permanently delete ALL admin accounts!")

    if len(sys.argv) > 1:
        provided_key = sys.argv[1]
    else:
        provided_key = input("\nEnter Master Key: ").strip()

    if provided_key != MASTER_KEY:
        print("\n[ERROR] Invalid master key! Reset aborted.")
        return

    print("\nFetching existing admin accounts...")
    existing_admins = list(db.collection("users").where(filter=FieldFilter("role", "==", "admin")).stream())

    if not existing_admins:
        print("No admin accounts found in the system to delete.")
        return

    print(f"Found {len(existing_admins)} admin account(s):")
    for ad in existing_admins:
        d = ad.to_dict() or {}
        print(f"  - {d.get('name', 'Admin')} (@{d.get('username', '')}) [UID: {ad.id}]")

    confirm = input("\nAre you SURE you want to delete all admin accounts? (yes/no): ").strip().lower()
    if confirm not in ("yes", "y"):
        print("Emergency reset cancelled.")
        return

    print("\nDeleting admin accounts...")
    deleted_count = 0

    for ad in existing_admins:
        uid = ad.id
        try:
            firebase_auth.delete_user(uid)
            print(f"  Deleted Auth user for UID: {uid}")
        except Exception as e:
            print(f"  Auth delete warning for UID {uid}: {e}")

        try:
            db.collection("users").document(uid).delete()
            delete_document_backup("users", uid)
            print(f"  Deleted Firestore doc & backup for UID: {uid}")
            deleted_count += 1
        except Exception as e:
            print(f"  Firestore delete error for UID {uid}: {e}")

    print("=" * 60)
    print(f"SUCCESS! Deleted {deleted_count} admin account(s).")
    print("The system is now ready to be seeded with a new admin account.")
    print("Run: python scripts/seed_admin.py")
    print("=" * 60)

if __name__ == "__main__":
    reset_admins()

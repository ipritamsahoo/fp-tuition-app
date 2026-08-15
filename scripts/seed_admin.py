import sys
import os

# Add api/ directory to sys.path
api_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'api')
sys.path.insert(0, api_dir)

import firebase_admin
from firebase_admin import auth as firebase_auth
from google.cloud.firestore_v1.base_query import FieldFilter

from database import db
from schemas import to_firebase_email
from utils import ts_now
from backup_service import backup_document

def seed_admin():
    print("=" * 60)
    print("        FP Finance - Seed Admin Account Script        ")
    print("=" * 60)

    # Check if an admin already exists
    existing_admins = list(
        db.collection("users").where(filter=FieldFilter("role", "==", "admin")).limit(1).stream()
    )
    if existing_admins:
        admin_data = existing_admins[0].to_dict()
        print(f"\n[INFO] An admin account already exists:")
        print(f"       UID     : {existing_admins[0].id}")
        print(f"       Username: {admin_data.get('username', '')}")
        print(f"       Name    : {admin_data.get('name', '')}")
        print("\nNo new admin account was created.")
        return

    print("No existing admin found. Creating new Admin Account...\n")

    if len(sys.argv) >= 4:
        name = sys.argv[1]
        username = sys.argv[2]
        password = sys.argv[3]
    else:
        name = input("Enter Admin Full Name: ").strip()
        while not name:
            print("Name cannot be empty!")
            name = input("Enter Admin Full Name: ").strip()

        username = input("Enter Admin Username: ").strip().lower()
        while not username:
            print("Username cannot be empty!")
            username = input("Enter Admin Username: ").strip().lower()

        password = input("Enter Admin Password (min 6 chars): ").strip()
        while len(password) < 6:
            print("Password must be at least 6 characters long!")
            password = input("Enter Admin Password (min 6 chars): ").strip()

    email = to_firebase_email(username)
    print(f"\nCreating Firebase Auth user ({email})...")

    try:
        fb_user = firebase_auth.create_user(
            email=email,
            password=password,
            display_name=name,
        )
    except Exception as e:
        print(f"[ERROR] Failed to create Firebase Auth user: {e}")
        return

    # Set custom user claims for role authorization
    firebase_auth.set_custom_user_claims(fb_user.uid, {"role": "admin"})

    admin_doc = {
        "name": name,
        "username": username,
        "email": email,
        "role": "admin",
        "batch_id": None,
        "created_at": ts_now(),
    }

    db.collection("users").document(fb_user.uid).set(admin_doc)
    try:
        backup_document("users", fb_user.uid, admin_doc, "create")
    except Exception as e:
        print(f"[WARN] Cloud backup failed: {e}")

    print("=" * 60)
    print("SUCCESS! Admin account created successfully:")
    print(f"  UID     : {fb_user.uid}")
    print(f"  Name    : {name}")
    print(f"  Username: {username}")
    print(f"  Email   : {email}")
    print("=" * 60)

if __name__ == "__main__":
    seed_admin()

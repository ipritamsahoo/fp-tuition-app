import sys
import os

# Add the api/ directory to sys.path so we can import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from firebase_admin import auth as firebase_auth
from google.cloud.firestore_v1.base_query import FieldFilter
from database import db
from schemas import to_firebase_email
from utils import ts_now
from backup_service import backup_document, delete_document_backup, backup_executor

def create_test_students():
    batch_id = "8UHZKWFWW1LKpOqT1ENe"
    password = "#ts@123"
    
    # 1. Verify batch exists
    batch_ref = db.collection("batches").document(batch_id)
    batch_doc = batch_ref.get()
    if not batch_doc.exists:
        print(f"Error: Batch with ID '{batch_id}' not found.")
        sys.exit(1)
    
    batch_name = batch_doc.to_dict().get("batch_name", "Unknown Batch")
    print(f"Found batch: '{batch_name}' (ID: {batch_id})")
    
    for i in range(1, 21):
        name = f"Test Student ({i})"
        username = f"test-student-{i}"
        email = to_firebase_email(username)
        
        print(f"\nProcessing {name} (username: {username})...")
        
        # Check if user already exists in Firebase Auth by email
        existing_uid = None
        try:
            fb_user = firebase_auth.get_user_by_email(email)
            existing_uid = fb_user.uid
            print(f"Found existing Firebase Auth user with UID: {existing_uid}")
        except firebase_auth.UserNotFoundError:
            pass
        except Exception as e:
            print(f"Error checking user by email: {e}")
        
        # If user exists, delete them from Firebase Auth and Firestore to have a clean state
        if existing_uid:
            try:
                firebase_auth.delete_user(existing_uid)
                print(f"Deleted existing Firebase Auth user: {existing_uid}")
            except Exception as e:
                print(f"Failed to delete Firebase Auth user {existing_uid}: {e}")
            
            try:
                db.collection("users").document(existing_uid).delete()
                delete_document_backup("users", existing_uid)
                print(f"Deleted existing Firestore user document: {existing_uid}")
            except Exception as e:
                print(f"Failed to delete Firestore document: {e}")
        
        # Create user in Firebase Auth
        try:
            fb_user = firebase_auth.create_user(
                email=email,
                password=password,
                display_name=name,
            )
            uid = fb_user.uid
            print(f"Created Firebase Auth user with UID: {uid}")
        except Exception as e:
            print(f"Failed to create Firebase Auth user: {e}")
            continue
            
        # Set custom claims
        try:
            firebase_auth.set_custom_user_claims(uid, {"role": "student"})
            print(f"Set student role custom claims for {uid}")
        except Exception as e:
            print(f"Failed to set custom claims: {e}")
            
        # Create Firestore user doc
        user_doc = {
            "name": name,
            "username": username,
            "email": email,
            "role": "student",
            "batch_id": batch_id,
            "created_at": ts_now(),
            "is_disabled": False,
        }
        
        try:
            db.collection("users").document(uid).set(user_doc)
            backup_document("users", uid, user_doc, "create")
            print(f"Created Firestore document for student: {uid}")
        except Exception as e:
            print(f"Failed to save Firestore document: {e}")
            
    # 2. Update the batch student count
    print("\nRecalculating batch student count...")
    try:
        students_query = db.collection("users") \
            .where(filter=FieldFilter("batch_id", "==", batch_id)) \
            .where(filter=FieldFilter("role", "==", "student")) \
            .stream()
        
        student_list = list(students_query)
        actual_count = len(student_list)
        
        batch_ref.update({
            "student_count": actual_count
        })
        
        updated_batch_doc = batch_ref.get()
        if updated_batch_doc.exists:
            backup_document("batches", batch_id, updated_batch_doc.to_dict())
            
        print(f"Updated student_count on batch to {actual_count}.")
    except Exception as e:
        print(f"Failed to update batch student count: {e}")
        
    # Wait for all background backup tasks to complete
    print("\nWaiting for Google Drive backups to complete...")
    backup_executor.shutdown(wait=True)
    print("Done! All 20 students processed.")

if __name__ == "__main__":
    create_test_students()

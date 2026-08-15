import sys
import os

# Add api/ directory to sys.path so backend modules (database, notifications) import seamlessly
api_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'api')
sys.path.insert(0, api_dir)

from database import db
from notifications import _send_fcm

def send_broadcast():
    print("=" * 60)
    print("      FP Finance - Broadcast Push Notification Script      ")
    print("=" * 60)

    # Check CLI args or interactive mode
    if len(sys.argv) >= 3:
        # Check if --all flag is passed
        if "--all" in sys.argv:
            target_roles = ("student", "teacher", "admin")
            target_label = "All Users (Students, Teachers & Admins)"
            sys.argv.remove("--all")
        else:
            target_roles = ("student", "teacher")
            target_label = "Teachers & Students Only (Excludes Admins)"

        title = sys.argv[1]
        message = sys.argv[2]
        notif_type = sys.argv[3] if len(sys.argv) > 3 else "broadcast"
        target_url = sys.argv[4] if len(sys.argv) > 4 else ""
    else:
        print("Select Target Audience:")
        print("  1. All Users (Students, Teachers & Admins)")
        print("  2. Teachers & Students Only (Excludes Admins) [Default]")
        target_choice = input("Enter choice (1 or 2) [default: 2]: ").strip()

        if target_choice == "1":
            target_roles = ("student", "teacher", "admin")
            target_label = "All Users (Students, Teachers & Admins)"
        else:
            target_roles = ("student", "teacher")
            target_label = "Teachers & Students Only (Excludes Admins)"

        print("\n------------------------------------------------------------")
        title = input("Enter Title [default: FP Finance Notice]: ").strip()
        if not title:
            title = "FP Finance Notice"
        
        message = input("Enter Message: ").strip()
        while not message:
            print("Message cannot be empty!")
            message = input("Enter Message: ").strip()
        
        notif_type = input("Enter Notification Type [default: broadcast]: ").strip() or "broadcast"
        target_url = input("Enter Target URL (optional, e.g. /student/notices): ").strip()

    print(f"\nTarget Mode : {target_label}")
    print("Fetching recipients from Firestore...")
    
    # Stream all users from database
    users_stream = db.collection("users").stream()
    
    recipients = []
    student_count = 0
    teacher_count = 0
    admin_count = 0
    total_tokens = 0

    for doc in users_stream:
        user_data = doc.to_dict() or {}
        role = user_data.get("role")
        
        # Filter based on selected target roles
        if role in target_roles:
            tokens = user_data.get("fcm_tokens") or []
            if tokens:
                recipients.append({
                    "uid": doc.id,
                    "name": user_data.get("name") or user_data.get("student_name") or user_data.get("email", "User"),
                    "role": role,
                    "tokens": tokens
                })
                if role == "student":
                    student_count += 1
                elif role == "teacher":
                    teacher_count += 1
                elif role == "admin":
                    admin_count += 1
                total_tokens += len(tokens)

    breakdown = []
    if student_count: breakdown.append(f"{student_count} Students")
    if teacher_count: breakdown.append(f"{teacher_count} Teachers")
    if admin_count: breakdown.append(f"{admin_count} Admins")
    breakdown_str = ", ".join(breakdown) if breakdown else "0 users"

    print("-" * 60)
    print(f"Target      : {target_label}")
    print(f"Title       : {title}")
    print(f"Message     : {message}")
    print(f"Type        : {notif_type}")
    if target_url:
        print(f"Target URL  : {target_url}")
    print("-" * 60)
    print(f"Recipients  : {len(recipients)} users ({breakdown_str})")
    print(f"FCM Tokens  : {total_tokens} active device tokens")
    print("-" * 60)

    if len(recipients) == 0:
        print("No active devices found with FCM tokens for the selected audience.")
        return

    # Skip confirmation if args were passed in CLI mode
    if len(sys.argv) < 3:
        confirm = input("\nSend notification to all target users? (y/n): ").strip().lower()
        if confirm != 'y':
            print("Cancelled by user.")
            return

    print("\nSending notifications...")
    success_count = 0
    
    for idx, user in enumerate(recipients, 1):
        try:
            _send_fcm(
                tokens=user["tokens"],
                title=title,
                body=message,
                notif_type=notif_type,
                target_uid=user["uid"],
                target_url=target_url
            )
            success_count += 1
            print(f"[{idx}/{len(recipients)}] Sent to {user['role'].capitalize()}: {user['name']} ({len(user['tokens'])} devices)")
        except Exception as e:
            print(f"[{idx}/{len(recipients)}] Failed for {user['name']}: {e}")

    print("=" * 60)
    print(f"DONE! Successfully sent notifications to {success_count}/{len(recipients)} users.")
    print("=" * 60)

if __name__ == "__main__":
    send_broadcast()

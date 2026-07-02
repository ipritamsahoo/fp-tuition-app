"""
FP Finance — FastAPI Backend
=======================================================
Entry point: creates the FastAPI app, mounts middleware,
includes all routers, and starts the server.
"""

from pathlib import Path

import uvicorn
import cloudinary
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from config import HOST, PORT, CRON_SECRET
from config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
from routers import auth, student, teacher, admin, notes, notices


# ──────────────────────────────────────────────
# APP SETUP
# ──────────────────────────────────────────────
app = FastAPI(
    title="FP Finance",
    description="Role-based fee management with Firebase backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Cloudinary configuration
cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True,
)

# ──────────────────────────────────────────────
# ROUTERS
# ──────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(student.router)
app.include_router(teacher.router)
app.include_router(admin.router)
app.include_router(notes.router)
app.include_router(notices.router)

# ──────────────────────────────────────────────
# HEALTH / PING
# ──────────────────────────────────────────────
@app.head("/")
@app.get("/")
async def root_health_check():
    return {"status": "ok", "message": "FP Finance Backend API is running."}

@app.get("/health")
async def health_check(x_cron_secret: str = Header(None, alias="X-Cron-Secret")):
    if x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=403, detail="Invalid cron secret")
    return {"status": "ok", "message": "Server is active"}

def _run_due_reminders() -> int:
    from google.cloud.firestore_v1.base_query import FieldFilter
    from database import db
    from notifications import notify_user
    
    # Query all unpaid or rejected payments (projecting only student_id to save bandwidth)
    unpaid_payments = db.collection("payments") \
        .where(filter=FieldFilter("status", "in", ["Unpaid", "Rejected"])) \
        .select(["student_id"]) \
        .stream()
        
    student_dues = {}
    for doc in unpaid_payments:
        p = doc.to_dict()
        sid = p.get("student_id")
        if sid:
            student_dues.setdefault(sid, []).append(p)
            
    if not student_dues:
        return 0
        
    # Fetch details for all students who have dues
    uids = list(student_dues.keys())
    user_refs = [db.collection("users").document(uid) for uid in uids]
    
    users_details = {}
    for i in range(0, len(user_refs), 100):
        docs = db.get_all(user_refs[i:i+100])
        for doc in docs:
            if doc.exists:
                d = doc.to_dict()
                users_details[doc.id] = {
                    "name": d.get("name", "Student"),
                    "tokens": d.get("fcm_tokens") or []
                }
                
    notified_count = 0
    for uid, dues in student_dues.items():
        user_info = users_details.get(uid)
        if not user_info:
            continue
            
        tokens = user_info["tokens"]
        if not tokens:
            continue
            
        student_name = user_info["name"]
        message = f"Dear {student_name}, this is a gentle reminder that your tuition fee is currently pending. Kindly review the dues and complete your payment. Thank you."
        
        notify_user(
            uid,
            message,
            "bill_reminder",
            title="Tuition Fee Reminder",
            tokens=tokens
        )
        notified_count += 1
        
    return notified_count

@app.post("/cron/due-reminders")
@app.get("/cron/due-reminders")
async def daily_due_reminders(
    x_cron_secret: str = Header(None, alias="X-Cron-Secret")
):
    if x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=403, detail="Invalid cron secret")
        
    notified_count = _run_due_reminders()
    return {
        "status": "success",
        "message": f"Sent due reminder notifications to {notified_count} students."
    }


# ──────────────────────────────────────────────
# RUN
# ──────────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n🚀 FP Finance Backend running at http://{HOST}:{PORT}")
    print(f"📄 API Docs: http://{HOST}:{PORT}/docs\n")
    uvicorn.run(app, host=HOST, port=PORT)

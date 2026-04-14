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
from routers import auth, student, teacher, admin


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

# ──────────────────────────────────────────────
# STARTUP EVENT
# ──────────────────────────────────────────────

# ──────────────────────────────────────────────
# RUN
# ──────────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n🚀 FP Finance Backend running at http://{HOST}:{PORT}")
    print(f"📄 API Docs: http://{HOST}:{PORT}/docs\n")
    uvicorn.run(app, host=HOST, port=PORT)

"""
FP Finance Configuration
==================
Environment variables and application constants.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Firebase ──
FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS", "serviceAccountKey.json")
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY", "")

# ── Payment ──
ADMIN_UPI_VPA = os.getenv("ADMIN_UPI_VPA", "admin@upi")
DEFAULT_FEE_AMOUNT = int(os.getenv("DEFAULT_FEE_AMOUNT", "500"))

# ── Server ──
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# ── Security ──
CRON_SECRET = os.getenv("CRON_SECRET", "super-secret-key")

# ── Cloudinary ──
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

"""
FP Finance Database
=============
Firebase Admin SDK initialization and Firestore client.

Supports two methods of loading Firebase credentials:
  1. FIREBASE_CREDENTIALS_JSON env var (JSON string) — for cloud deployment (Render, etc.)
  2. FIREBASE_CREDENTIALS env var / file path         — for local development
"""

import json
import os

import firebase_admin
from firebase_admin import credentials, firestore

from config import FIREBASE_CREDENTIALS

# Initialize Firebase Admin SDK (runs once on import)
cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
if cred_json:
    # Cloud deployment: credentials from environment variable (JSON string)
    cred = credentials.Certificate(json.loads(cred_json))
else:
    # Local development: credentials from file path
    cred = credentials.Certificate(FIREBASE_CREDENTIALS)

firebase_admin.initialize_app(cred)

# Firestore client — import this wherever DB access is needed
db = firestore.client()

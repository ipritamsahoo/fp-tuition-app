import sys
import os

# Add the api/ directory to sys.path so we can import shared modules
api_dir = os.path.join(os.path.dirname(__file__), '..', 'api')
sys.path.insert(0, api_dir)

import firebase_admin
from firebase_admin import credentials, firestore
cred = credentials.Certificate(os.path.join(api_dir, 'serviceAccountKey.json'))
firebase_admin.initialize_app(cred)
db = firestore.client()
users = db.collection('users').get()
for u in users:
    d = u.to_dict()
    if d.get('role') == 'student':
        print(f"{u.id}: badge={d.get('current_badge')}, pending={d.get('badge_animation_pending')}")

import firebase_admin
from firebase_admin import credentials, firestore
cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred)
db = firestore.client()
users = db.collection('users').get()
for u in users:
    d = u.to_dict()
    if d.get('role') == 'student':
        print(f"{u.id}: badge={d.get('current_badge')}, pending={d.get('badge_animation_pending')}")

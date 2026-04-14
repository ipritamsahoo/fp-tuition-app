"""
FP Finance Utilities
==============
Shared helper functions used across the application.
"""

from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))


def ts_now():
    """Return current IST timestamp as ISO string."""
    return datetime.now(IST).isoformat()


def serialize_doc(doc):
    """Convert a Firestore document snapshot to a dict with its id."""
    data = doc.to_dict()
    data["id"] = doc.id
    # Convert any datetime/timestamp fields to ISO strings
    for k, v in data.items():
        if hasattr(v, "isoformat"):
            data[k] = v.isoformat()
    return data

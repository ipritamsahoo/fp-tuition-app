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


import re
from datetime import timezone

# Regular expression to match standard ISO datetime strings (e.g., 2026-07-02T18:00:00Z)
ISO_DATE_REGEX = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$"
)

def serialize_value(v):
    """Recursively serialize datetime/Timestamp objects to ISO strings."""
    if hasattr(v, "isoformat"):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: serialize_value(val) for k, val in v.items()}
    if isinstance(v, list):
        return [serialize_value(item) for item in v]
    return v

def parse_iso_timestamps(data):
    """Recursively convert ISO date strings back into datetime objects."""
    if isinstance(data, dict):
        return {k: parse_iso_timestamps(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [parse_iso_timestamps(item) for item in data]
    elif isinstance(data, str) and ISO_DATE_REGEX.match(data):
        try:
            # Handle 'Z' suffix or offset mapping
            if data.endswith("Z"):
                return datetime.fromisoformat(data[:-1]).replace(tzinfo=timezone.utc)
            return datetime.fromisoformat(data)
        except Exception:
            return data
    return data


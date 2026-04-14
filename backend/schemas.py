"""
FP Finance Schemas
============
Pydantic request/response models used across the API.
"""

from typing import Optional
from pydantic import BaseModel

FAKE_EMAIL_DOMAIN = "fp.com"


def to_firebase_email(username: str) -> str:
    """Convert a username or mobile number to a fake email for Firebase Auth.
    e.g. 'ramdey' -> 'ramdey@fp.com', '1234567890' -> '1234567890@fp.com'
    """
    username = username.strip().lower()
    return f"{username}@{FAKE_EMAIL_DOMAIN}"


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str
    role: str = "student"
    batch_id: Optional[str] = None


class BatchCreate(BaseModel):
    batch_name: str
    teacher_ids: list[str] = []
    batch_fee: Optional[float] = None


class StudentCreate(BaseModel):
    username: str
    password: str
    name: str
    batch_id: str


class TeacherCreate(BaseModel):
    username: str
    password: str
    name: str
    batch_ids: list[str] = []


class OfflineRequest(BaseModel):
    student_id: str
    month: int
    year: int
    amount: Optional[float] = None
    batch_name: Optional[str] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    batch_id: Optional[str] = None
    password: Optional[str] = None
    custom_fee: Optional[float] = None
    clear_custom_fee: bool = False


class StudentStatusUpdate(BaseModel):
    is_disabled: bool


class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    batch_ids: Optional[list[str]] = None
    password: Optional[str] = None


class GenerateMonthly(BaseModel):
    month: int
    year: int
    amount: Optional[float] = None
    batch_id: Optional[str] = None


class UndoMonthly(BaseModel):
    month: int
    year: int
    batch_id: Optional[str] = None


class FeeOverride(BaseModel):
    student_id: str
    mode: str                    # "all-time" or "specific-month"
    amount: float                # New fee amount
    month: Optional[int] = None  # Required for "specific-month"
    year: Optional[int] = None   # Required for "specific-month"


class SettleDistribution(BaseModel):
    date: str                    # "YYYY-MM-DD"
    month: int
    year: int
    batch_id: Optional[str] = None


class AdminSeed(BaseModel):
    username: str
    password: str
    name: str


class SelfUpdateCredentials(BaseModel):
    new_username: Optional[str] = None
    new_password: Optional[str] = None


class SessionRegisterRequest(BaseModel):
    session_id: str
    device_name: str
    platform: str


class EmergencyReset(BaseModel):
    master_key: str

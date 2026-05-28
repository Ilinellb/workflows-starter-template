from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, time, date, timedelta
from jose import JWTError, jwt
import os
import uuid
import logging
import hashlib
import bcrypt
from pathlib import Path
from dotenv import load_dotenv
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import schedule
import threading
import time as time_module
import math
import shutil
import json
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security (simplified for demo - in production use proper hashing)
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()

app = FastAPI(title="Employee Time Tracking System")
api_router = APIRouter(prefix="/api")


# Kubernetes liveness/readiness probe — must NOT be behind the /api prefix.
# Also expose at /api/health for symmetry with the rest of the API.
@app.get("/health")
async def health_check():
    return {"status": "ok"}


@api_router.get("/health")
async def api_health_check():
    return {"status": "ok"}

# Models
class UserRole(str):
    OPS_MANAGER = "ops_manager"
    ASSISTANT_MANAGER = "assistant_manager"
    ATTENDANT = "attendant"
    SUPER_ADMIN = "super_admin"

# Roles that have full management access (treat super_admin as a strict superset of ops_manager).
MANAGER_ROLES = [UserRole.SUPER_ADMIN, UserRole.OPS_MANAGER, UserRole.ASSISTANT_MANAGER]
FULL_ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.OPS_MANAGER]

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Employee specific fields
    start_time: Optional[time] = None
    workplace_lat: Optional[float] = None
    workplace_lng: Optional[float] = None
    geofence_radius: Optional[int] = None  # in meters
    manager_id: Optional[str] = None
    department: Optional[str] = None  # "business_operations", "daily_operations", "front_desk_operations"
    # Demographics
    date_of_birth: Optional[str] = None  # ISO date string
    gender: Optional[str] = None
    phone_number: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str
    start_time: Optional[str] = None  # "09:00"
    workplace_lat: Optional[float] = None
    workplace_lng: Optional[float] = None
    geofence_radius: Optional[int] = 100
    manager_id: Optional[str] = None
    department: Optional[str] = None

class UserUpdate(BaseModel):
    email: EmailStr
    name: str
    password: Optional[str] = None  # Optional for updates
    role: str
    start_time: Optional[str] = None  # "09:00"
    workplace_lat: Optional[float] = None
    workplace_lng: Optional[float] = None
    geofence_radius: Optional[int] = 100
    manager_id: Optional[str] = None
    department: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    name: str
    password: str
    confirm_password: str

class TimeEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    date: date
    punch_in_time: Optional[datetime] = None
    punch_out_time: Optional[datetime] = None
    punch_in_location: Optional[Dict[str, float]] = None  # {"lat": x, "lng": y}
    punch_out_location: Optional[Dict[str, float]] = None
    total_hours: Optional[float] = None
    status: str = "incomplete"  # complete, incomplete, missed_punch_in, missed_punch_out
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoomStatus(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_number: str
    status: str  # 'open_clean', 'occupied', 'occupied_out', 'needs_cleaning'
    employee_id: str
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    shift_date: date
    # Timing fields for occupied rooms
    check_in_time: Optional[datetime] = None
    duration_hours: Optional[int] = None  # Original duration in hours
    extended_hours: Optional[int] = 0  # Additional extended hours
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LaundryRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    count: int
    shift_date: date
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoomUpdateRequest(BaseModel):
    room_id: str
    status: str
    duration: Optional[int] = None  # Duration in hours for occupied rooms
    timestamp: str

class LaundryUpdateRequest(BaseModel):
    count: int
    timestamp: str

class PunchRequest(BaseModel):
    action: str  # "punch_in" or "punch_out"
    location: Optional[Dict[str, float]] = None  # {"lat": x, "lng": y} - optional for backward compatibility

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    message: str
    type: str  # "missed_punch", "reminder", "info"
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageAttachment(BaseModel):
    filename: str
    original_filename: str
    file_size: int
    file_type: str
    file_url: str

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    sender_name: str
    category: str  # "announcement", "direct", "group"
    recipients: List[str]  # User IDs
    subject: Optional[str] = None
    content: str
    attachments: List[MessageAttachment] = []
    thread_id: Optional[str] = None  # For grouping related messages
    parent_message_id: Optional[str] = None  # For replies
    is_read_by: List[str] = []  # User IDs who have read the message
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

class MessageCreate(BaseModel):
    category: str  # "announcement", "direct", "group"
    recipients: List[str]  # User IDs (empty for announcements to all)
    subject: Optional[str] = None
    content: str
    thread_id: Optional[str] = None
    parent_message_id: Optional[str] = None

# App Configuration Models
class TabConfig(BaseModel):
    id: str
    label: str
    icon: str
    category: str
    enabled: bool = True
    order: int

class AppConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Tab configurations for each role
    ops_manager_tabs: List[TabConfig] = []
    assistant_manager_tabs: List[TabConfig] = []
    attendant_tabs: List[TabConfig] = []
    # App settings
    company_name: str = "RSBC Workflow Pro"
    theme_primary_color: str = "#3b82f6"  # blue
    theme_accent_color: str = "#10b981"   # green
    # Workflow settings
    default_shift_hours: int = 8
    break_duration_minutes: int = 30
    overtime_threshold_hours: int = 40
    late_threshold_minutes: int = 15
    # Feature toggles
    enable_room_management: bool = True
    enable_time_off: bool = True
    enable_messages: bool = True
    enable_organization: bool = True
    enable_analytics: bool = True
    # Metadata
    published: bool = False
    draft_version: Optional[dict] = None
    published_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Time Off Models
class TimeOffRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    start_date: str  # ISO date string
    end_date: str  # ISO date string
    reason: str
    status: str = "pending"  # pending, approved, rejected
    notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TimeOffRequestCreate(BaseModel):
    start_date: str
    end_date: str
    reason: str
    notes: Optional[str] = None

# Scheduling Models
class ScheduleShift(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    date: str  # ISO date string
    shift_start: str  # HH:MM format
    shift_end: str  # HH:MM format
    break_duration: int = 30  # minutes
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScheduleShiftCreate(BaseModel):
    user_id: str
    date: str
    shift_start: str
    shift_end: str
    break_duration: int = 30
    notes: Optional[str] = None

# Utility Functions
def _is_bcrypt_hash(hashed: str) -> bool:
    return isinstance(hashed, str) and hashed.startswith("$2")

def verify_password(plain_password, hashed_password):
    """Verify password against bcrypt or legacy SHA-256 hash."""
    if not hashed_password:
        return False
    if _is_bcrypt_hash(hashed_password):
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except (ValueError, TypeError):
            return False
    # Legacy SHA-256 hex digest (pre-migration)
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

def get_password_hash(password):
    """Hash a password using bcrypt with a fresh salt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.now(timezone.utc).timestamp() + (ACCESS_TOKEN_EXPIRE_HOURS * 3600)})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in meters using Haversine formula"""
    R = 6371000  # Earth's radius in meters
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat/2) * math.sin(delta_lat/2) +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lon/2) * math.sin(delta_lon/2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def prepare_for_mongo(data):
    """Convert datetime and date objects to ISO strings for MongoDB"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, date):
                data[key] = value.isoformat()
            elif isinstance(value, time):
                data[key] = value.strftime('%H:%M:%S')
    return data

def parse_from_mongo(item):
    """Convert ISO strings back to Python objects"""
    if not item:
        return item
    
    # Handle date fields
    if 'date' in item and isinstance(item['date'], str):
        item['date'] = datetime.fromisoformat(item['date']).date()
    
    # Handle time fields
    if 'start_time' in item and isinstance(item['start_time'], str):
        item['start_time'] = datetime.strptime(item['start_time'], '%H:%M:%S').time()
    
    # Handle datetime fields
    datetime_fields = ['created_at', 'punch_in_time', 'punch_out_time', 'last_updated', 'check_in_time', 'timestamp']
    for field in datetime_fields:
        if field in item and isinstance(item[field], str):
            item[field] = datetime.fromisoformat(item[field])
    
    # Handle date fields specifically for room status
    if 'shift_date' in item and isinstance(item['shift_date'], str):
        item['shift_date'] = datetime.fromisoformat(item['shift_date']).date()
    
    return item

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"WebSocket connected for user: {user_id}")
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected for user: {user_id}")
    
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
                self.disconnect(user_id)
    
    async def broadcast_message(self, message: dict, user_ids: List[str] = None):
        """Broadcast to specific users or all connected users"""
        target_users = user_ids if user_ids else list(self.active_connections.keys())
        for user_id in target_users:
            await self.send_personal_message(message, user_id)

manager = ConnectionManager()

async def send_notification_email(to_email: str, subject: str, content: str):
    """Send email notification using SendGrid (Placeholder Implementation)"""
    try:
        sendgrid_key = os.environ.get('SENDGRID_API_KEY')
        sender_email = os.environ.get('SENDER_EMAIL', 'noreply@company.com')
        
        if not sendgrid_key:
            # Placeholder: Log email instead of sending
            logging.info(f"[PLACEHOLDER EMAIL] To: {to_email}, Subject: {subject}, Content: {content}")
            return True  # Simulate success
            
        message = Mail(
            from_email=sender_email,
            to_emails=to_email,
            subject=subject,
            html_content=content
        )
        
        sg = SendGridAPIClient(sendgrid_key)
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        logging.error(f"Failed to send email: {str(e)}")
        # Placeholder: Still return True to simulate success
        logging.info(f"[PLACEHOLDER EMAIL] To: {to_email}, Subject: {subject}")
        return True

async def create_notification(user_id: str, title: str, message: str, notification_type: str = "info"):
    """Create in-app notification"""
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type
    )
    await db.notifications.insert_one(prepare_for_mongo(notification.dict()))

# Authentication Routes
@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is inactive")

    # Auto-upgrade legacy SHA-256 hashes to bcrypt on successful login
    if not _is_bcrypt_hash(user["password_hash"]):
        new_hash = get_password_hash(user_data.password)
        await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": new_hash}})
        logger.info(f"Migrated password hash to bcrypt for user {user['email']}")

    access_token = create_access_token(data={"sub": user["id"]})
    user_obj = User(**parse_from_mongo(user))
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_obj.dict()
    }

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Validate password match
    if user_data.password != user_data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    # Validate password strength
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate email domain (add your organization's domains as needed)
    allowed_domains = ["company.com", "gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com"]
    email_domain = user_data.email.split('@')[1].lower()
    if email_domain not in allowed_domains:
        raise HTTPException(status_code=400, detail=f"Email domain '{email_domain}' not allowed for registration. Contact administrator for access.")
    
    # Create new user (default role: employee)
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=UserRole.ATTENDANT,  # New registrations default to employee
        is_active=True  # Auto-approve for now, you can change this to False for admin approval
    )
    
    user_dict = user.dict()
    user_dict["password_hash"] = get_password_hash(user_data.password)
    
    await db.users.insert_one(prepare_for_mongo(user_dict))
    
    # Create access token for immediate login
    access_token = create_access_token(data={"sub": user.id})
    
    return {
        "message": "Registration successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.dict()
    }

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# User Management Routes
@api_router.post("/users", dependencies=[Depends(get_current_user)])
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    # Check permissions
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Parse start time if provided
    start_time_obj = None
    if user_data.start_time:
        try:
            start_time_obj = datetime.strptime(user_data.start_time, "%H:%M").time()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        start_time=start_time_obj,
        workplace_lat=user_data.workplace_lat,
        workplace_lng=user_data.workplace_lng,
        geofence_radius=user_data.geofence_radius,
        manager_id=user_data.manager_id
    )
    
    user_dict = user.dict()
    user_dict["password_hash"] = get_password_hash(user_data.password)
    
    await db.users.insert_one(prepare_for_mongo(user_dict))
    return {"message": "User created successfully", "user_id": user.id}

@api_router.get("/users")
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ATTENDANT:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    query = {"is_active": True}
    
    # OPS Managers and Assistant Managers can see all attendants
    # This is needed for scheduling, team management, etc.
    if current_user.role in MANAGER_ROLES:
        # Return all users for ops managers, all attendants for assistant managers
        if current_user.role == UserRole.ASSISTANT_MANAGER:
            query["role"] = UserRole.ATTENDANT
    
    users = await db.users.find(query).to_list(1000)
    return [User(**parse_from_mongo(user)).dict() for user in users]

@api_router.get("/users/for-messaging")
async def get_users_for_messaging(current_user: User = Depends(get_current_user)):
    """Get all active users for messaging purposes (limited info)"""
    users = await db.users.find({"is_active": True}).to_list(1000)
    # Return only necessary info for messaging
    return [{
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"]
    } for user in users if user["id"] != current_user.id]  # Exclude current user

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, user_data: UserUpdate, current_user: User = Depends(get_current_user)):
    # Check permissions
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Find the user to update
    existing_user = await db.users.find_one({"id": user_id})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Only full admins (super_admin / ops_manager) can change roles
    if user_data.role != existing_user.get("role") and current_user.role not in FULL_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only OPS Manager or Super Admin can change roles")

    # Prevent demoting yourself out of an admin role (lockout protection)
    if user_id == current_user.id and user_data.role != existing_user.get("role"):
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    # Check if email is being changed and if it's already taken
    if user_data.email != existing_user["email"]:
        email_taken = await db.users.find_one({"email": user_data.email})
        if email_taken:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    # Parse start time if provided
    start_time_obj = None
    if user_data.start_time:
        try:
            start_time_obj = datetime.strptime(user_data.start_time, "%H:%M").time()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")
    
    # Prepare update data
    update_data = {
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "start_time": start_time_obj,
        "workplace_lat": user_data.workplace_lat,
        "workplace_lng": user_data.workplace_lng,
        "geofence_radius": user_data.geofence_radius,
        "manager_id": user_data.manager_id
    }
    
    # Only update password if provided
    if user_data.password:
        update_data["password_hash"] = get_password_hash(user_data.password)
    
    update_data = prepare_for_mongo(update_data)

    await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )

    # Audit log if role changed
    old_role = existing_user.get("role")
    if user_data.role != old_role:
        audit_entry = {
            "id": str(uuid.uuid4()),
            "target_user_id": user_id,
            "target_email": existing_user.get("email"),
            "target_name": existing_user.get("name"),
            "old_role": old_role,
            "new_role": user_data.role,
            "changed_by_id": current_user.id,
            "changed_by_email": current_user.email,
            "changed_by_name": current_user.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await db.role_audit_logs.insert_one(audit_entry)

    return {"message": "User updated successfully"}


@api_router.get("/users/role-audit")
async def get_role_audit_log(limit: int = 100, current_user: User = Depends(get_current_user)):
    """Return chronological history of role changes. Full admins only."""
    if current_user.role not in FULL_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only OPS Manager or Super Admin can view role history")
    limit = max(1, min(limit, 500))
    cursor = db.role_audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(length=limit)

@api_router.put("/profile/demographics")
async def update_profile_demographics(
    demographics: dict,
    current_user: User = Depends(get_current_user)
):
    """Update user's demographic information"""
    try:
        # Allowed demographic fields
        allowed_fields = [
            'date_of_birth', 'gender', 'phone_number',
            'address_street', 'address_city', 'address_state', 'address_zip',
            'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship'
        ]
        
        # Filter to only allowed fields
        update_data = {k: v for k, v in demographics.items() if k in allowed_fields}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid demographic fields provided")
        
        # Update the user's demographics
        result = await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": "Demographics updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating demographics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    # Check permissions
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Find the user to delete
    existing_user = await db.users.find_one({"id": user_id})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete the user
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

class BulkDeleteRequest(BaseModel):
    user_ids: List[str]

@api_router.post("/users/bulk-delete")
async def bulk_delete_users(
    payload: BulkDeleteRequest,
    current_user: User = Depends(get_current_user)
):
    # Check permissions
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if not payload.user_ids:
        raise HTTPException(status_code=400, detail="No user IDs provided")

    # Exclude the current user from the deletion list to prevent self-deletion
    target_ids = [uid for uid in payload.user_ids if uid != current_user.id]
    skipped_self = len(payload.user_ids) - len(target_ids)

    if not target_ids:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.users.delete_many({"id": {"$in": target_ids}})
    deleted_count = result.deleted_count
    not_found_count = len(target_ids) - deleted_count

    return {
        "message": f"Deleted {deleted_count} user(s)",
        "deleted_count": deleted_count,
        "not_found_count": not_found_count,
        "skipped_self": skipped_self,
        "requested_count": len(payload.user_ids),
    }

# Time Tracking Routes
@api_router.post("/time/punch")
async def punch_time(punch_data: PunchRequest, current_user: User = Depends(get_current_user)):
    # All roles can punch in/out (attendants, assistant managers, ops managers)
    
    today = date.today()
    
    # Get or create today's time entry
    time_entry = await db.time_entries.find_one({
        "employee_id": current_user.id,
        "date": today.isoformat()
    })
    
    if not time_entry:
        time_entry = TimeEntry(
            employee_id=current_user.id,
            date=today
        ).dict()
        time_entry = prepare_for_mongo(time_entry)
        await db.time_entries.insert_one(time_entry)
    
    # Geofencing disabled - simple punch in/out without location validation
    
    now = datetime.now(timezone.utc)
    update_data = {}
    
    if punch_data.action == "punch_in":
        if time_entry.get("punch_in_time"):
            raise HTTPException(status_code=400, detail="Already punched in today")
        
        update_data = {
            "punch_in_time": now.isoformat(),
            "punch_in_location": punch_data.location if punch_data.location else None,
            "status": "incomplete"
        }
    
    elif punch_data.action == "punch_out":
        if not time_entry.get("punch_in_time"):
            raise HTTPException(status_code=400, detail="Must punch in before punching out")
        
        if time_entry.get("punch_out_time"):
            raise HTTPException(status_code=400, detail="Already punched out today")
        
        # Calculate total hours
        punch_in = datetime.fromisoformat(time_entry["punch_in_time"])
        total_seconds = (now - punch_in).total_seconds()
        total_hours = round(total_seconds / 3600, 2)
        
        update_data = {
            "punch_out_time": now.isoformat(),
            "punch_out_location": punch_data.location if punch_data.location else None,
            "total_hours": total_hours,
            "status": "complete"
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    await db.time_entries.update_one(
        {"employee_id": current_user.id, "date": today.isoformat()},
        {"$set": update_data}
    )
    
    return {"message": f"Successfully {punch_data.action.replace('_', ' ')}!", "action": punch_data.action}

@api_router.get("/time/status")
async def get_time_status(current_user: User = Depends(get_current_user)):
    # All roles can check time status (attendants, assistant managers, ops managers)
    
    today = date.today()
    time_entry = await db.time_entries.find_one({
        "employee_id": current_user.id,
        "date": today.isoformat()
    })
    
    if not time_entry:
        return {
            "status": "not_started",
            "can_punch_in": True,
            "can_punch_out": False,
            "message": "Ready to start your day!"
        }
    
    time_entry = parse_from_mongo(time_entry)
    
    status = {
        "punch_in_time": time_entry.get("punch_in_time"),
        "punch_out_time": time_entry.get("punch_out_time"),
        "total_hours": time_entry.get("total_hours"),
        "can_punch_in": not time_entry.get("punch_in_time"),
        "can_punch_out": bool(time_entry.get("punch_in_time") and not time_entry.get("punch_out_time"))
    }
    
    if not time_entry.get("punch_in_time"):
        status["status"] = "not_started"
        status["message"] = "Ready to punch in!"
    elif not time_entry.get("punch_out_time"):
        status["status"] = "working"
        status["message"] = "Currently working - don't forget to punch out!"
    else:
        status["status"] = "complete"
        status["message"] = f"Day complete! Worked {time_entry.get('total_hours', 0)} hours"
    
    return status

@api_router.get("/time/entries")
async def get_time_entries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    employee_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    # Permission check
    if current_user.role == UserRole.ATTENDANT:
        query["employee_id"] = current_user.id
    elif current_user.role == UserRole.ASSISTANT_MANAGER and employee_id:
        # Verify employee belongs to this manager
        employee = await db.users.find_one({"id": employee_id, "manager_id": current_user.id})
        if not employee:
            raise HTTPException(status_code=403, detail="Employee not found or access denied")
        query["employee_id"] = employee_id
    elif current_user.role == UserRole.ASSISTANT_MANAGER:
        # Get all employees under this manager
        employees = await db.users.find({"manager_id": current_user.id}).to_list(1000)
        employee_ids = [emp["id"] for emp in employees]
        query["employee_id"] = {"$in": employee_ids}
    elif employee_id:
        query["employee_id"] = employee_id
    
    # Date filter
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    entries = await db.time_entries.find(query).sort("date", -1).to_list(1000)

    # Bulk-fetch employee names to avoid N+1
    employee_ids = list({entry["employee_id"] for entry in entries if entry.get("employee_id")})
    employee_map = {}
    if employee_ids:
        employees_docs = await db.users.find({"id": {"$in": employee_ids}}).to_list(len(employee_ids))
        employee_map = {emp["id"]: emp for emp in employees_docs}

    # Parse and enhance entries
    result = []
    for entry in entries:
        # Remove MongoDB ObjectId field
        if '_id' in entry:
            del entry['_id']

        entry = parse_from_mongo(entry)

        employee = employee_map.get(entry["employee_id"])
        entry["employee_name"] = employee.get("name", "Unknown") if employee else "Unknown"

        result.append(entry)

    return result

# Notification Routes
@api_router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifications = await db.notifications.find({
        "user_id": current_user.id
    }).sort("created_at", -1).to_list(100)
    
    return [Notification(**parse_from_mongo(notif)).dict() for notif in notifications]

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"is_read": True}}
    )
    return {"message": "Notification marked as read"}

# Room Management Routes
@api_router.post("/rooms/update-status")
async def update_room_status(
    room_data: RoomUpdateRequest, 
    current_user: User = Depends(get_current_user)
):
    # All roles can update room status (attendants, assistant managers, ops managers)
    
    today = date.today()
    
    # Create or update room status
    room_status = RoomStatus(
        room_number=room_data.room_id.replace('room-', ''),
        status=room_data.status,
        employee_id=current_user.id,
        shift_date=today,
        last_updated=datetime.fromisoformat(room_data.timestamp.replace('Z', '+00:00'))
    )
    
    # Add timing data for occupied rooms
    if room_data.status == 'occupied' and room_data.duration:
        room_status.check_in_time = datetime.fromisoformat(room_data.timestamp.replace('Z', '+00:00'))
        room_status.duration_hours = room_data.duration
        room_status.extended_hours = 0
    
    room_dict = prepare_for_mongo(room_status.dict())
    
    # Update existing or insert new - SHARED ACROSS ALL EMPLOYEES (no employee_id filter)
    await db.room_statuses.update_one(
        {
            "room_number": room_status.room_number,
            "shift_date": today.isoformat()
        },
        {"$set": room_dict},
        upsert=True
    )
    
    # Broadcast room status update via WebSocket to all connected users
    notification_data = {
        "type": "room_status_update",
        "room_number": room_status.room_number,
        "status": room_data.status,
        "updated_by": current_user.name
    }
    await manager.broadcast_message(notification_data)
    
    duration_msg = f" for {room_data.duration} hours" if room_data.duration else ""
    return {"message": f"Room {room_status.room_number} status updated to {room_data.status}{duration_msg}"}

@api_router.post("/rooms/extend")
async def extend_room_time(
    room_id: str,
    extend_hours: int = 1,
    current_user: User = Depends(get_current_user)
):
    # All roles can extend room time (attendants, assistant managers, ops managers)
    
    today = date.today()
    room_number = room_id.replace('room-', '')
    
    # Find and update the room - GLOBAL (no employee_id filter)
    # Any attendant can extend any occupied room
    result = await db.room_statuses.update_one(
        {
            "room_number": room_number,
            "shift_date": today.isoformat(),
            "status": {"$in": ["occupied", "occupied_out"]}  # Allow extension for both statuses
        },
        {
            "$inc": {"extended_hours": extend_hours},
            "$set": {
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "employee_id": current_user.id  # Update to track who extended it
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Room not found or not occupied")
    
    return {"message": f"Room {room_number} extended by {extend_hours} hour(s)"}

@api_router.get("/rooms/status")
async def get_room_statuses(current_user: User = Depends(get_current_user)):
    today = date.today()
    
    # ALL users see the same global room statuses (no employee_id filtering)
    query = {
        "shift_date": today.isoformat()
    }
    
    room_statuses = await db.room_statuses.find(query).to_list(100)

    # Bulk-fetch employee names to avoid N+1
    employee_ids = list({rs["employee_id"] for rs in room_statuses if rs.get("employee_id")})
    employee_map = {}
    if employee_ids:
        employees_docs = await db.users.find({"id": {"$in": employee_ids}}).to_list(len(employee_ids))
        employee_map = {emp["id"]: emp for emp in employees_docs}

    result = []
    for room_status in room_statuses:
        # Remove MongoDB ObjectId field
        if '_id' in room_status:
            del room_status['_id']

        room_status = parse_from_mongo(room_status)

        employee = employee_map.get(room_status["employee_id"])
        room_status["employee_name"] = employee.get("name", "Unknown") if employee else "Unknown"

        result.append(room_status)

    return result

@api_router.post("/laundry/record")
async def record_laundry(
    laundry_data: LaundryUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    # All roles can record laundry (attendants, assistant managers, ops managers)
    
    today = date.today()
    
    # Update laundry count for today
    laundry_record = LaundryRecord(
        employee_id=current_user.id,
        count=laundry_data.count,
        shift_date=today,
        timestamp=datetime.fromisoformat(laundry_data.timestamp.replace('Z', '+00:00'))
    )
    
    laundry_dict = prepare_for_mongo(laundry_record.dict())
    
    # Update existing record or create new
    await db.laundry_records.update_one(
        {
            "employee_id": current_user.id,
            "shift_date": today.isoformat()
        },
        {"$set": laundry_dict},
        upsert=True
    )
    
    return {"message": f"Laundry count updated to {laundry_data.count}"}

@api_router.get("/laundry/stats")
async def get_laundry_stats(
    date_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.ATTENDANT:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    target_date = date.today()
    if date_filter:
        target_date = datetime.fromisoformat(date_filter).date()
    
    query = {"shift_date": target_date.isoformat()}
    if current_user.role == UserRole.ASSISTANT_MANAGER:
        # Get employees under this manager
        employees = await db.users.find({"manager_id": current_user.id}).to_list(1000)
        employee_ids = [emp["id"] for emp in employees]
        query["employee_id"] = {"$in": employee_ids}
    
    laundry_records = await db.laundry_records.find(query).to_list(100)

    # Bulk-fetch employee names to avoid N+1
    employee_ids = list({r["employee_id"] for r in laundry_records if r.get("employee_id")})
    employee_map = {}
    if employee_ids:
        employees_docs = await db.users.find({"id": {"$in": employee_ids}}).to_list(len(employee_ids))
        employee_map = {emp["id"]: emp for emp in employees_docs}

    result = []
    for record in laundry_records:
        record = parse_from_mongo(record)

        employee = employee_map.get(record["employee_id"])
        record["employee_name"] = employee.get("name", "Unknown") if employee else "Unknown"

        result.append(record)

    return result

@api_router.get("/rooms/report")
async def get_room_report(
    date_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.ATTENDANT:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    target_date = date.today()
    if date_filter:
        target_date = datetime.fromisoformat(date_filter).date()
    
    # Get room statuses for the date
    query = {"shift_date": target_date.isoformat()}
    if current_user.role == UserRole.ASSISTANT_MANAGER:
        # Manager sees only their team's work
        employees = await db.users.find({"manager_id": current_user.id}).to_list(1000)
        employee_ids = [emp["id"] for emp in employees]
        query["employee_id"] = {"$in": employee_ids}
    
    room_statuses = await db.room_statuses.find(query).to_list(1000)

    # Get laundry stats
    laundry_stats = await db.laundry_records.find(query).to_list(100)

    # Bulk-fetch employee names for all employees appearing in either list
    emp_ids_in_report = list({
        rs["employee_id"] for rs in room_statuses if rs.get("employee_id")
    } | {
        lr["employee_id"] for lr in laundry_stats if lr.get("employee_id")
    })
    employee_map = {}
    if emp_ids_in_report:
        employees_docs = await db.users.find({"id": {"$in": emp_ids_in_report}}).to_list(len(emp_ids_in_report))
        employee_map = {emp["id"]: emp for emp in employees_docs}

    # Prepare report data
    employee_performance = {}

    # Process room data
    for room_status in room_statuses:
        room_status = parse_from_mongo(room_status)
        emp_id = room_status["employee_id"]

        if emp_id not in employee_performance:
            employee = employee_map.get(emp_id)
            employee_performance[emp_id] = {
                "employee_name": employee.get("name", "Unknown") if employee else "Unknown",
                "rooms_completed": 0,
                "rooms_pending": 0,
                "laundry_count": 0,
                "last_activity": room_status["last_updated"]
            }
        
        if room_status["status"] in ["open_clean"]:
            employee_performance[emp_id]["rooms_completed"] += 1
        elif room_status["status"] in ["needs_cleaning", "occupied_out"]:
            employee_performance[emp_id]["rooms_pending"] += 1
    
    # Process laundry data
    for laundry_record in laundry_stats:
        laundry_record = parse_from_mongo(laundry_record)
        emp_id = laundry_record["employee_id"]
        
        if emp_id in employee_performance:
            employee_performance[emp_id]["laundry_count"] = laundry_record["count"]
    
    return {
        "date": target_date.isoformat(),
        "employee_performance": list(employee_performance.values()),
        "room_summary": {
            "total_rooms": len(room_statuses),
            "status_breakdown": {}
        }
    }

# Excel Export Route
@api_router.get("/export/timesheet")
async def export_timesheet(
    start_date: str,
    end_date: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.ATTENDANT:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Get employees based on role
    if current_user.role == UserRole.ASSISTANT_MANAGER:
        employees = await db.users.find({"manager_id": current_user.id}).to_list(1000)
    else:
        employees = await db.users.find({"role": UserRole.ATTENDANT}).to_list(1000)
    
    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Timesheet Report"
    
    # Headers
    headers = ["Employee Name", "Email", "Date", "Punch In", "Punch Out", "Total Hours", "Status"]
    ws.append(headers)
    
    # Style headers
    header_font = Font(bold=True)
    for col in range(1, len(headers) + 1):
        ws.cell(row=1, column=col).font = header_font
    
    # Get time entries
    employee_ids = [emp["id"] for emp in employees]
    entries = await db.time_entries.find({
        "employee_id": {"$in": employee_ids},
        "date": {"$gte": start_date, "$lte": end_date}
    }).sort([("employee_id", 1), ("date", 1)]).to_list(10000)
    
    # Create employee lookup
    employee_lookup = {emp["id"]: emp for emp in employees}
    
    # Add data rows
    for entry in entries:
        entry = parse_from_mongo(entry)
        employee = employee_lookup.get(entry["employee_id"])
        
        row = [
            employee.get("name", "Unknown") if employee else "Unknown",
            employee.get("email", "Unknown") if employee else "Unknown",
            entry["date"].strftime("%Y-%m-%d") if entry.get("date") else "",
            entry["punch_in_time"].strftime("%H:%M:%S") if entry.get("punch_in_time") else "",
            entry["punch_out_time"].strftime("%H:%M:%S") if entry.get("punch_out_time") else "",
            entry.get("total_hours", 0),
            entry.get("status", "incomplete")
        ]
        ws.append(row)
    
    # Save to file
    filename = f"/app/timesheet_{start_date}_to_{end_date}.xlsx"
    wb.save(filename)
    
    return {"message": "Timesheet exported successfully", "filename": filename}

# ============ TIME OFF API ============

@api_router.get("/time-off/my-requests")
async def get_my_time_off_requests(current_user: User = Depends(get_current_user)):
    """Get time off requests for current user"""
    try:
        requests_list = await db.time_off_requests.find({"user_id": current_user.id}).sort([("created_at", -1)]).to_list(100)
        
        # Remove MongoDB ObjectId and parse dates
        result = []
        for req in requests_list:
            if '_id' in req:
                del req['_id']
            req = parse_from_mongo(req)
            result.append(req)
        
        return {"requests": result}
    except Exception as e:
        logger.error(f"Error fetching time off requests: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/time-off/request")
async def create_time_off_request(
    request_data: TimeOffRequestCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new time off request"""
    try:
        new_request = TimeOffRequest(
            user_id=current_user.id,
            user_name=current_user.name,
            start_date=request_data.start_date,
            end_date=request_data.end_date,
            reason=request_data.reason,
            notes=request_data.notes,
            status="pending"
        )
        
        request_dict = new_request.dict()
        await db.time_off_requests.insert_one(prepare_for_mongo(request_dict))
        
        return {"message": "Time off request submitted successfully", "request_id": new_request.id}
    except Exception as e:
        logger.error(f"Error creating time off request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/time-off/requests/all")
async def get_all_time_off_requests(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all time off requests (managers only)"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        requests_list = await db.time_off_requests.find(query).sort([("created_at", -1)]).to_list(1000)
        
        # Remove MongoDB ObjectId and parse dates
        result = []
        for req in requests_list:
            if '_id' in req:
                del req['_id']
            req = parse_from_mongo(req)
            result.append(req)
        
        return {"requests": result}
    except Exception as e:
        logger.error(f"Error fetching time off requests: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/time-off/requests/{request_id}/approve")
async def approve_time_off_request(
    request_id: str,
    approval_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Approve or reject time off request (managers only)"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        status = approval_data.get("status")  # "approved" or "rejected"
        notes = approval_data.get("notes", "")
        
        if status not in ["approved", "rejected"]:
            raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
        
        result = await db.time_off_requests.update_one(
            {"id": request_id},
            {"$set": {
                "status": status,
                "notes": notes,
                "reviewed_by": current_user.id,
                "reviewed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Time off request not found")
        
        return {"message": f"Time off request {status} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating time off request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============ SCHEDULING API ============

@api_router.get("/schedules/me")
async def get_my_schedules(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get the current user's own schedules (any authenticated role)."""
    try:
        query = {"user_id": current_user.id}
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}

        schedules = await db.schedules.find(query).sort([("date", 1)]).to_list(1000)

        result = []
        for schedule in schedules:
            if '_id' in schedule:
                del schedule['_id']
            schedule = parse_from_mongo(schedule)
            result.append(schedule)

        return {"schedules": result}
    except Exception as e:
        logger.error(f"Error fetching my schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/schedules/team")
async def get_team_schedules(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get team schedules (managers only)"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        query = {}
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        
        schedules = await db.schedules.find(query).sort([("date", 1)]).to_list(1000)
        
        # Remove MongoDB ObjectId and parse dates
        result = []
        for schedule in schedules:
            if '_id' in schedule:
                del schedule['_id']
            schedule = parse_from_mongo(schedule)
            result.append(schedule)
        
        return {"schedules": result}
    except Exception as e:
        logger.error(f"Error fetching schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/schedules/assign")
async def assign_schedule(
    schedule_data: ScheduleShiftCreate,
    current_user: User = Depends(get_current_user)
):
    """Assign schedule to user (managers only)"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get user name
        user = await db.users.find_one({"id": schedule_data.user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_schedule = ScheduleShift(
            user_id=schedule_data.user_id,
            user_name=user["name"],
            date=schedule_data.date,
            shift_start=schedule_data.shift_start,
            shift_end=schedule_data.shift_end,
            break_duration=schedule_data.break_duration,
            notes=schedule_data.notes,
            created_by=current_user.id
        )
        
        schedule_dict = new_schedule.dict()
        await db.schedules.insert_one(prepare_for_mongo(schedule_dict))
        
        return {"message": "Schedule assigned successfully", "schedule_id": new_schedule.id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/schedules/assign-recurring")
async def assign_recurring_schedule(
    schedule_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Assign recurring schedule (daily, weekly, monthly) to user (managers only)"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        user_id = schedule_data.get("user_id")
        start_date = schedule_data.get("date")
        end_date = schedule_data.get("end_date")
        shift_start = schedule_data.get("shift_start")
        shift_end = schedule_data.get("shift_end")
        break_duration = schedule_data.get("break_duration", 30)
        notes = schedule_data.get("notes", "")
        recurrence_type = schedule_data.get("recurrence_type")  # "daily", "weekly", "monthly"
        days_of_week = schedule_data.get("days_of_week", [])  # weekly: [0-6] Sunday=0

        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        anchor_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        final_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        if anchor_date > final_date:
            raise HTTPException(status_code=400, detail="End date must be after start date")

        schedules_to_create = []
        current_date = anchor_date
        while current_date <= final_date:
            if _should_create_schedule(recurrence_type, current_date, days_of_week, anchor_date):
                schedules_to_create.append(_build_recurring_schedule_dict(
                    user=user,
                    current_date=current_date,
                    shift_start=shift_start,
                    shift_end=shift_end,
                    break_duration=break_duration,
                    notes=notes,
                    recurrence_type=recurrence_type,
                ))
            current_date = _advance_recurring_date(recurrence_type, current_date, anchor_date)

        if schedules_to_create:
            await db.schedules.insert_many(schedules_to_create)

        created_count = len(schedules_to_create)
        return {
            "message": f"Successfully created {created_count} recurring schedules",
            "created_count": created_count,
            "recurrence_type": recurrence_type,
            "date_range": f"{start_date} to {end_date}",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating recurring schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _should_create_schedule(recurrence_type, current_date, days_of_week, anchor_date):
    """Decide whether a schedule entry should be created on current_date."""
    if recurrence_type == "daily":
        return True
    if recurrence_type == "weekly":
        # Convert Python's Monday=0 to Sunday=0 format
        day_index = (current_date.weekday() + 1) % 7
        return day_index in days_of_week
    if recurrence_type == "monthly":
        return current_date.day == anchor_date.day
    return False


def _build_recurring_schedule_dict(*, user, current_date, shift_start, shift_end,
                                    break_duration, notes, recurrence_type):
    suffix = f"Recurring: {recurrence_type}"
    return {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "date": current_date.isoformat(),
        "shift_start": shift_start,
        "shift_end": shift_end,
        "break_duration": break_duration,
        "notes": f"{notes} ({suffix})" if notes else suffix,
    }


def _advance_recurring_date(recurrence_type, current_date, anchor_date):
    """Return the next date to evaluate based on recurrence pattern."""
    if recurrence_type in ("daily", "weekly"):
        return current_date + timedelta(days=1)
    if recurrence_type == "monthly":
        return _next_monthly_anchor(current_date, anchor_date.day)
    # Unknown recurrence — advance by one day to avoid infinite loops
    return current_date + timedelta(days=1)


def _next_monthly_anchor(current_date, anchor_day):
    """Move to the same day in the next month, clamping to that month's last day."""
    year, month = current_date.year, current_date.month
    if month == 12:
        year, month = year + 1, 1
    else:
        month += 1
    # Compute last day of the target month
    if month == 12:
        next_first = date(year + 1, 1, 1)
    else:
        next_first = date(year, month + 1, 1)
    last_day_of_month = (next_first - timedelta(days=1)).day
    return date(year, month, min(anchor_day, last_day_of_month))


@api_router.post("/schedules/bulk-upload")
async def bulk_upload_schedules(
    schedules: List[ScheduleShiftCreate],
    current_user: User = Depends(get_current_user)
):
    """Bulk upload schedules from template (managers only)"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        created_count = 0
        errors = []
        
        for idx, schedule_data in enumerate(schedules):
            try:
                # Validate user exists
                user = await db.users.find_one({"email": schedule_data.user_id})  # user_id will contain email from CSV
                if not user:
                    errors.append(f"Row {idx + 2}: User with email '{schedule_data.user_id}' not found")
                    continue
                
                # Check if schedule already exists for this user and date
                existing = await db.schedules.find_one({
                    "user_id": user["id"],
                    "date": schedule_data.date.isoformat() if isinstance(schedule_data.date, date) else schedule_data.date
                })
                
                if existing:
                    # Update existing schedule
                    update_data = {
                        "shift_start": schedule_data.shift_start.strftime('%H:%M:%S') if isinstance(schedule_data.shift_start, time) else schedule_data.shift_start,
                        "shift_end": schedule_data.shift_end.strftime('%H:%M:%S') if isinstance(schedule_data.shift_end, time) else schedule_data.shift_end,
                        "break_duration": schedule_data.break_duration,
                        "notes": schedule_data.notes
                    }
                    await db.schedules.update_one(
                        {"id": existing["id"]},
                        {"$set": update_data}
                    )
                else:
                    # Create new schedule
                    schedule_id = str(uuid.uuid4())
                    schedule_dict = {
                        "id": schedule_id,
                        "user_id": user["id"],
                        "user_name": user["name"],
                        "date": schedule_data.date.isoformat() if isinstance(schedule_data.date, date) else schedule_data.date,
                        "shift_start": schedule_data.shift_start.strftime('%H:%M:%S') if isinstance(schedule_data.shift_start, time) else schedule_data.shift_start,
                        "shift_end": schedule_data.shift_end.strftime('%H:%M:%S') if isinstance(schedule_data.shift_end, time) else schedule_data.shift_end,
                        "break_duration": schedule_data.break_duration,
                        "notes": schedule_data.notes or ""
                    }
                    await db.schedules.insert_one(schedule_dict)
                
                created_count += 1
                
            except Exception as row_error:
                errors.append(f"Row {idx + 2}: {str(row_error)}")
                continue
        
        return {
            "message": f"Successfully processed {created_count} schedules",
            "created_count": created_count,
            "total_rows": len(schedules),
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error in bulk upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    schedule_data: ScheduleShiftCreate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing schedule (managers only)"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Check if schedule exists
        existing_schedule = await db.schedules.find_one({"id": schedule_id})
        if not existing_schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Get user name
        user = await db.users.find_one({"id": schedule_data.user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update schedule
        update_data = {
            "user_id": schedule_data.user_id,
            "user_name": user["name"],
            "date": schedule_data.date.isoformat() if isinstance(schedule_data.date, date) else schedule_data.date,
            "shift_start": schedule_data.shift_start.strftime('%H:%M:%S') if isinstance(schedule_data.shift_start, time) else schedule_data.shift_start,
            "shift_end": schedule_data.shift_end.strftime('%H:%M:%S') if isinstance(schedule_data.shift_end, time) else schedule_data.shift_end,
            "break_duration": schedule_data.break_duration,
            "notes": schedule_data.notes
        }
        
        await db.schedules.update_one(
            {"id": schedule_id},
            {"$set": update_data}
        )
        
        return {"message": "Schedule updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a schedule (managers only)"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Check if schedule exists
        existing_schedule = await db.schedules.find_one({"id": schedule_id})
        if not existing_schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Delete schedule
        result = await db.schedules.delete_one({"id": schedule_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        return {"message": "Schedule deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============ REPORTS API ============

@api_router.get("/reports/team")
async def get_team_reports(
    period: str = "week",  # week, month, quarter
    type: str = "all",  # all, time, rooms
    current_user: User = Depends(get_current_user)
):
    """Get team reports (managers only)"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Calculate date range based on period
        end_date = datetime.now(timezone.utc)
        if period == "week":
            start_date = end_date - timedelta(days=7)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        elif period == "quarter":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=7)
        
        # Get time entries
        time_entries = await db.time_entries.find({
            "date": {"$gte": start_date.isoformat()[:10], "$lte": end_date.isoformat()[:10]}
        }).to_list(10000)
        
        # Calculate summary (handle None values)
        total_hours = sum(entry.get("total_hours") or 0 for entry in time_entries)
        unique_employees = len(set(entry.get("employee_id") for entry in time_entries if entry.get("employee_id")))
        
        return {
            "period": period,
            "start_date": start_date.isoformat()[:10],
            "end_date": end_date.isoformat()[:10],
            "total_hours": total_hours,
            "total_employees": unique_employees,
            "average_hours": total_hours / unique_employees if unique_employees > 0 else 0,
            "entries_count": len(time_entries)
        }
    except Exception as e:
        logger.error(f"Error generating team report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reports/employee/{employee_id}/time-summary")
async def get_employee_time_summary(
    employee_id: str,
    period: str = "month",
    current_user: User = Depends(get_current_user)
):
    """Get employee time summary (managers only or own data)"""
    if current_user.role == UserRole.ATTENDANT and employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only view own data")
    
    try:
        # Calculate date range
        end_date = datetime.now(timezone.utc)
        if period == "week":
            start_date = end_date - timedelta(days=7)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        else:
            start_date = end_date - timedelta(days=30)
        
        # Get time entries
        time_entries = await db.time_entries.find({
            "employee_id": employee_id,
            "date": {"$gte": start_date.isoformat()[:10], "$lte": end_date.isoformat()[:10]}
        }).to_list(1000)
        
        total_hours = sum(entry.get("total_hours") or 0 for entry in time_entries)
        
        return {
            "employee_id": employee_id,
            "period": period,
            "total_hours": total_hours,
            "entries_count": len(time_entries),
            "average_daily_hours": total_hours / len(time_entries) if time_entries else 0
        }
    except Exception as e:
        logger.error(f"Error fetching employee time summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/time/my-reports")
async def get_my_reports(
    period: str = "month",
    current_user: User = Depends(get_current_user)
):
    """Get current user's time reports"""
    try:
        # Calculate date range
        end_date = datetime.now(timezone.utc)
        if period == "week":
            start_date = end_date - timedelta(days=7)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        elif period == "quarter":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)
        
        # Get time entries
        time_entries = await db.time_entries.find({
            "employee_id": current_user.id,
            "date": {"$gte": start_date.isoformat()[:10], "$lte": end_date.isoformat()[:10]}
        }).to_list(1000)
        
        total_hours = sum(entry.get("total_hours") or 0 for entry in time_entries)
        
        return {
            "period": period,
            "start_date": start_date.isoformat()[:10],
            "end_date": end_date.isoformat()[:10],
            "total_hours": total_hours,
            "entries_count": len(time_entries),
            "average_daily_hours": total_hours / len(time_entries) if time_entries else 0,
            "entries": [parse_from_mongo({k: v for k, v in entry.items() if k != '_id'}) for entry in time_entries]
        }
    except Exception as e:
        logger.error(f"Error fetching user reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============ MESSAGES API ============

@api_router.post("/messages/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload file attachment for messages (chunked upload support)"""
    try:
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save file in chunks
        async with aiofiles.open(file_path, 'wb') as f:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                await f.write(chunk)
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Store file metadata
        file_metadata = {
            "id": str(uuid.uuid4()),
            "filename": unique_filename,
            "original_filename": file.filename,
            "file_size": file_size,
            "file_type": file.content_type,
            "uploaded_by": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.file_uploads.insert_one(file_metadata)
        
        return {
            "filename": unique_filename,
            "original_filename": file.filename,
            "file_size": file_size,
            "file_type": file.content_type,
            "file_url": f"/api/messages/download/{unique_filename}"
        }
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@api_router.get("/messages/download/{filename}")
async def download_file(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Download file attachment"""
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        file_path,
        media_type='application/octet-stream',
        filename=filename
    )

@api_router.post("/messages")
async def create_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user)
):
    """Send a new message"""
    # Validate category
    if message_data.category not in ["announcement", "direct", "group"]:
        raise HTTPException(status_code=400, detail="Invalid message category")
    
    # For announcements, only managers/super_admin can send
    if message_data.category == "announcement" and current_user.role == UserRole.ATTENDANT:
        raise HTTPException(status_code=403, detail="Only managers can send announcements")
    
    # Determine recipients
    recipients = message_data.recipients
    if message_data.category == "announcement" and not recipients:
        # Send to all employees
        all_employees = await db.users.find({"role": UserRole.ATTENDANT, "is_active": True}).to_list(1000)
        recipients = [emp["id"] for emp in all_employees]
    elif message_data.category in ["direct", "group"] and not recipients:
        # Direct and group messages must have recipients
        raise HTTPException(status_code=400, detail="Recipients are required for direct and group messages")
    
    # Create thread_id if not provided
    thread_id = message_data.thread_id or str(uuid.uuid4())
    
    # Create message
    new_message = Message(
        sender_id=current_user.id,
        sender_name=current_user.name,
        category=message_data.category,
        recipients=recipients,
        subject=message_data.subject,
        content=message_data.content,
        thread_id=thread_id,
        parent_message_id=message_data.parent_message_id,
        attachments=[]
    )
    
    message_dict = new_message.dict()
    await db.messages.insert_one(prepare_for_mongo(message_dict))
    
    # Send real-time notification via WebSocket
    notification_data = {
        "type": "new_message",
        "message": message_dict
    }
    await manager.broadcast_message(notification_data, recipients)
    
    return {"message": "Message sent successfully", "message_id": new_message.id, "thread_id": thread_id}

@api_router.post("/messages/{message_id}/attachments")
async def add_message_attachments(
    message_id: str,
    attachments: List[Dict[str, Any]],
    current_user: User = Depends(get_current_user)
):
    """Add attachments to a message"""
    # Find message
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Check if user is the sender
    if message["sender_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Can only add attachments to your own messages")
    
    # Update message with attachments
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"attachments": attachments}}
    )
    
    return {"message": "Attachments added successfully"}

@api_router.get("/messages")
async def get_messages(
    category: Optional[str] = None,
    thread_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get messages for current user"""
    query = {
        "deleted_at": None,
        "$or": [
            {"sender_id": current_user.id},
            {"recipients": current_user.id}
        ]
    }
    
    if category:
        query["category"] = category
    
    if thread_id:
        query["thread_id"] = thread_id
    
    messages = await db.messages.find(query).sort([("created_at", -1)]).limit(limit).to_list(limit)
    
    # Parse datetime fields and remove MongoDB ObjectId
    result = []
    for msg in messages:
        # Remove MongoDB ObjectId field
        if '_id' in msg:
            del msg['_id']
        msg = parse_from_mongo(msg)
        result.append(msg)
    
    return {"messages": result}

@api_router.get("/messages/threads")
async def get_message_threads(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get unique message threads for current user"""
    query = {
        "deleted_at": None,
        "$or": [
            {"sender_id": current_user.id},
            {"recipients": current_user.id}
        ]
    }
    
    if category:
        query["category"] = category
    
    # Get all messages and group by thread_id
    messages = await db.messages.find(query).sort([("created_at", -1)]).to_list(1000)
    
    threads = {}
    for msg in messages:
        msg = parse_from_mongo(msg)
        thread_id = msg.get("thread_id")
        if thread_id and thread_id not in threads:
            # Get unread count
            unread_count = len([m for m in messages if m.get("thread_id") == thread_id and current_user.id not in m.get("is_read_by", [])])
            
            threads[thread_id] = {
                "thread_id": thread_id,
                "category": msg["category"],
                "subject": msg.get("subject", "No Subject"),
                "last_message": msg["content"][:100],
                "last_sender": msg["sender_name"],
                "last_updated": msg["created_at"],
                "unread_count": unread_count,
                "participants": list(set([msg["sender_id"]] + msg["recipients"]))
            }
    
    return {"threads": list(threads.values())}

@api_router.put("/messages/{message_id}/read")
async def mark_message_read(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark message as read"""
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Check if user is a recipient
    if current_user.id not in message.get("recipients", []):
        raise HTTPException(status_code=403, detail="Not a recipient of this message")
    
    # Add user to is_read_by list
    await db.messages.update_one(
        {"id": message_id},
        {"$addToSet": {"is_read_by": current_user.id}}
    )
    
    return {"message": "Message marked as read"}

class MessageEdit(BaseModel):
    content: str

@api_router.put("/messages/{message_id}")
async def edit_message(
    message_id: str,
    message_edit: MessageEdit,
    current_user: User = Depends(get_current_user)
):
    """Edit a message (only sender can edit)"""
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["sender_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Can only edit your own messages")
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"content": message_edit.content, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify recipients of edit via WebSocket
    notification_data = {
        "type": "message_edited",
        "message_id": message_id,
        "new_content": message_edit.content
    }
    await manager.broadcast_message(notification_data, message["recipients"])
    
    return {"message": "Message updated successfully"}

@api_router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft delete a message (only sender can delete)"""
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["sender_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own messages")
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify recipients via WebSocket
    notification_data = {
        "type": "message_deleted",
        "message_id": message_id
    }
    await manager.broadcast_message(notification_data, message["recipients"])
    
    return {"message": "Message deleted successfully"}

# Notification management endpoint
@api_router.post("/notifications/check-missed-punches")
async def check_missed_punches_endpoint(current_user: User = Depends(get_current_user)):
    """Manually trigger check for missed punches and send notifications"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get all employees
        employees = await db.users.find({"role": UserRole.ATTENDANT, "is_active": True}).to_list(1000)
        
        notifications_sent = 0
        current_time = datetime.now(timezone.utc)
        current_date = current_time.date()
        
        for employee in employees:
            # Check if employee has start_time configured
            if not employee.get('start_time'):
                continue
            
            # Parse start time
            start_time_str = employee.get('start_time')
            if isinstance(start_time_str, str):
                try:
                    start_time = datetime.strptime(start_time_str, '%H:%M:%S').time()
                except:
                    continue
            else:
                start_time = start_time_str
            
            # Check if current time is past start time + 15 minutes
            scheduled_start = datetime.combine(current_date, start_time)
            time_diff = (current_time - scheduled_start.replace(tzinfo=timezone.utc)).total_seconds() / 60
            
            # If more than 15 minutes late
            if time_diff > 15:
                # Check if already punched in today
                time_entry = await db.time_entries.find_one({
                    "employee_id": employee["id"],
                    "date": current_date.isoformat()
                })
                
                if not time_entry or not time_entry.get('punch_in_time'):
                    # Send notification
                    await create_notification(
                        employee["id"],
                        "Missed Punch In",
                        f"You haven't punched in yet. Scheduled start time was {start_time.strftime('%H:%M')}",
                        "missed_punch"
                    )
                    
                    # Send placeholder email
                    await send_notification_email(
                        employee["email"],
                        "Missed Punch In Reminder",
                        f"<p>Hello {employee['name']},</p><p>You haven't punched in yet. Your scheduled start time was {start_time.strftime('%H:%M')}.</p><p>Please punch in as soon as possible.</p>"
                    )
                    
                    notifications_sent += 1
        
        return {
            "message": f"Checked {len(employees)} employees, sent {notifications_sent} notifications",
            "notifications_sent": notifications_sent
        }
    except Exception as e:
        logging.error(f"Error checking missed punches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint for real-time messaging
@app.websocket("/api/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket connection for real-time messaging"""
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive and receive any client messages
            data = await websocket.receive_text()
            # Echo back for connection verification
            await websocket.send_json({"type": "pong", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(user_id)

# ============ APP CONFIGURATION API ============

@api_router.get("/config/app")
async def get_app_config():
    """Get current app configuration (published or draft)"""
    try:
        config = await db.app_config.find_one({}) or {}
        
        # If no config exists, return default
        if not config:
            default_config = {
                "id": str(uuid.uuid4()),
                "company_name": "RSBC Workflow Pro",
                "theme_primary_color": "#3b82f6",
                "theme_accent_color": "#10b981",
                "default_shift_hours": 8,
                "break_duration_minutes": 30,
                "overtime_threshold_hours": 40,
                "late_threshold_minutes": 15,
                "enable_room_management": True,
                "enable_time_off": True,
                "enable_messages": True,
                "enable_organization": True,
                "enable_analytics": True,
                "published": True,
                "ops_manager_tabs": [],
                "assistant_manager_tabs": [],
                "attendant_tabs": []
            }
            return default_config
        
        # Remove MongoDB _id field
        config.pop('_id', None)
        return config
    except Exception as e:
        logger.error(f"Error fetching app config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/config/app/draft")
async def get_app_config_draft(current_user: User = Depends(get_current_user)):
    """Get draft version of app config (OPS Manager only)"""
    if current_user.role != UserRole.OPS_MANAGER:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        config = await db.app_config.find_one({})
        
        if not config:
            # Return default config as draft
            return await get_app_config()
        
        # Return draft version if exists, otherwise return published
        if config.get('draft_version'):
            return config['draft_version']
        
        config.pop('_id', None)
        return config
    except Exception as e:
        logger.error(f"Error fetching draft config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/config/app/draft")
async def update_app_config_draft(
    config_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update draft version of app config (OPS Manager only)"""
    if current_user.role != UserRole.OPS_MANAGER:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Update or create draft version
        existing_config = await db.app_config.find_one({})
        
        config_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        if existing_config:
            # Store as draft version
            await db.app_config.update_one(
                {},
                {"$set": {"draft_version": config_data, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            # Create new config with draft
            new_config = {
                "id": str(uuid.uuid4()),
                "draft_version": config_data,
                "published": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.app_config.insert_one(new_config)
        
        return {"message": "Draft saved successfully"}
    except Exception as e:
        logger.error(f"Error updating draft config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/config/app/publish")
async def publish_app_config(current_user: User = Depends(get_current_user)):
    """Publish draft version to live (OPS Manager only)"""
    if current_user.role != UserRole.OPS_MANAGER:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        config = await db.app_config.find_one({})
        
        if not config or not config.get('draft_version'):
            raise HTTPException(status_code=400, detail="No draft version to publish")
        
        draft = config['draft_version']
        draft['published'] = True
        draft['published_at'] = datetime.now(timezone.utc).isoformat()
        
        # Move draft to published and clear draft
        await db.app_config.update_one(
            {},
            {
                "$set": draft,
                "$unset": {"draft_version": ""}
            }
        )
        
        return {"message": "Configuration published successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error publishing config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============ ORGANIZATION HIERARCHY API ============

@api_router.get("/organization/hierarchy")
async def get_organization_hierarchy(current_user: User = Depends(get_current_user)):
    """Get organization hierarchy with all users and their relationships"""
    try:
        # Fetch all active users
        users = await db.users.find({"is_active": True}).to_list(1000)
        
        # Organize by department and role
        hierarchy = {
            "business_operations": [],
            "daily_operations": [],
            "front_desk_operations": []
        }
        
        for user in users:
            user_data = {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "manager_id": user.get("manager_id"),
                "department": user.get("department", "front_desk_operations")  # Default department
            }
            
            dept = user.get("department", "front_desk_operations")
            if dept in hierarchy:
                hierarchy[dept].append(user_data)
        
        return {"hierarchy": hierarchy}
    except Exception as e:
        logger.error(f"Error fetching organization hierarchy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/organization/update-user")
async def update_user_organization(
    user_id: str,
    department: Optional[str] = None,
    manager_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Update user's department and/or manager"""
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        update_data = {}
        if department:
            update_data["department"] = department
        if manager_id is not None:
            update_data["manager_id"] = manager_id
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided")
        
        result = await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": "User organization updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user organization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Background task for checking missed punches (simplified version)
async def check_missed_punches():
    """Check for employees who haven't punched in 15 minutes after start time"""
    # This will be implemented as a separate scheduled job later
    pass

# Simplified scheduler (removed to fix startup issues)
# Background tasks will be implemented separately

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    # Create OPS Manager if doesn't exist
    ops_manager = await db.users.find_one({"role": UserRole.OPS_MANAGER})
    if not ops_manager:
        admin_user = User(
            email="admin@company.com",
            name="OPS Manager",
            role=UserRole.OPS_MANAGER
        )
        admin_dict = admin_user.dict()
        admin_dict["password_hash"] = get_password_hash("admin123")
        await db.users.insert_one(prepare_for_mongo(admin_dict))
        logger.info("OPS Manager created: admin@company.com / admin123")
    
    logger.info("Application started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
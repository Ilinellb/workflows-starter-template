from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, time, date
from jose import JWTError, jwt
import os
import uuid
import logging
import hashlib
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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

# Models
class UserRole(str):
    SUPER_ADMIN = "super_admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"

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

# Utility Functions
def verify_password(plain_password, hashed_password):
    # Simplified password verification using hashlib (demo only)
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

def get_password_hash(password):
    # Simplified password hashing using hashlib (demo only - not secure for production)
    return hashlib.sha256(password.encode()).hexdigest()

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

async def send_notification_email(to_email: str, subject: str, content: str):
    """Send email notification using SendGrid"""
    try:
        sendgrid_key = os.environ.get('SENDGRID_API_KEY')
        sender_email = os.environ.get('SENDER_EMAIL', 'noreply@company.com')
        
        if not sendgrid_key:
            logging.warning("SendGrid API key not configured")
            return False
            
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
        return False

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
        role=UserRole.EMPLOYEE,  # New registrations default to employee
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
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.MANAGER]:
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
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    query = {}
    if current_user.role == UserRole.MANAGER:
        # Managers can only see their employees
        query = {"manager_id": current_user.id}
    
    users = await db.users.find(query).to_list(1000)
    return [User(**parse_from_mongo(user)).dict() for user in users]

# Time Tracking Routes
@api_router.post("/time/punch")
async def punch_time(punch_data: PunchRequest, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Only employees can punch in/out")
    
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
    if current_user.role != UserRole.EMPLOYEE:
        return {"status": "not_employee"}
    
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
    if current_user.role == UserRole.EMPLOYEE:
        query["employee_id"] = current_user.id
    elif current_user.role == UserRole.MANAGER and employee_id:
        # Verify employee belongs to this manager
        employee = await db.users.find_one({"id": employee_id, "manager_id": current_user.id})
        if not employee:
            raise HTTPException(status_code=403, detail="Employee not found or access denied")
        query["employee_id"] = employee_id
    elif current_user.role == UserRole.MANAGER:
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
    
    # Parse and enhance entries
    result = []
    for entry in entries:
        # Remove MongoDB ObjectId field
        if '_id' in entry:
            del entry['_id']
            
        entry = parse_from_mongo(entry)
        
        # Get employee name
        employee = await db.users.find_one({"id": entry["employee_id"]})
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
    if current_user.role != UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Only employees can update room status")
    
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
    
    # Update existing or insert new
    await db.room_statuses.update_one(
        {
            "room_number": room_status.room_number,
            "shift_date": today.isoformat(),
            "employee_id": current_user.id
        },
        {"$set": room_dict},
        upsert=True
    )
    
    duration_msg = f" for {room_data.duration} hours" if room_data.duration else ""
    return {"message": f"Room {room_status.room_number} status updated to {room_data.status}{duration_msg}"}

@api_router.post("/rooms/extend")
async def extend_room_time(
    room_id: str,
    extend_hours: int = 1,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Only employees can extend room time")
    
    today = date.today()
    room_number = room_id.replace('room-', '')
    
    # Find and update the room (works for both occupied and occupied_out status)
    result = await db.room_statuses.update_one(
        {
            "room_number": room_number,
            "shift_date": today.isoformat(),
            "employee_id": current_user.id,
            "status": {"$in": ["occupied", "occupied_out"]}  # Allow extension for both statuses
        },
        {
            "$inc": {"extended_hours": extend_hours},
            "$set": {"last_updated": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Room not found or not occupied")
    
    return {"message": f"Room {room_number} extended by {extend_hours} hour(s)"}

@api_router.get("/rooms/status")
async def get_room_statuses(current_user: User = Depends(get_current_user)):
    today = date.today()
    
    if current_user.role == UserRole.EMPLOYEE:
        # Employee sees their own room statuses
        query = {
            "employee_id": current_user.id,
            "shift_date": today.isoformat()
        }
    else:
        # Managers see all room statuses
        query = {
            "shift_date": today.isoformat()
        }
    
    room_statuses = await db.room_statuses.find(query).to_list(100)
    
    result = []
    for room_status in room_statuses:
        # Remove MongoDB ObjectId field
        if '_id' in room_status:
            del room_status['_id']
            
        room_status = parse_from_mongo(room_status)
        
        # Get employee name for manager view
        if current_user.role != UserRole.EMPLOYEE:
            employee = await db.users.find_one({"id": room_status["employee_id"]})
            room_status["employee_name"] = employee.get("name", "Unknown") if employee else "Unknown"
        
        result.append(room_status)
    
    return result

@api_router.post("/laundry/record")
async def record_laundry(
    laundry_data: LaundryUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Only employees can record laundry")
    
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
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    target_date = date.today()
    if date_filter:
        target_date = datetime.fromisoformat(date_filter).date()
    
    query = {"shift_date": target_date.isoformat()}
    if current_user.role == UserRole.MANAGER:
        # Get employees under this manager
        employees = await db.users.find({"manager_id": current_user.id}).to_list(1000)
        employee_ids = [emp["id"] for emp in employees]
        query["employee_id"] = {"$in": employee_ids}
    
    laundry_records = await db.laundry_records.find(query).to_list(100)
    
    result = []
    for record in laundry_records:
        record = parse_from_mongo(record)
        
        # Get employee name
        employee = await db.users.find_one({"id": record["employee_id"]})
        record["employee_name"] = employee.get("name", "Unknown") if employee else "Unknown"
        
        result.append(record)
    
    return result

@api_router.get("/rooms/report")
async def get_room_report(
    date_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    target_date = date.today()
    if date_filter:
        target_date = datetime.fromisoformat(date_filter).date()
    
    # Get room statuses for the date
    query = {"shift_date": target_date.isoformat()}
    if current_user.role == UserRole.MANAGER:
        # Manager sees only their team's work
        employees = await db.users.find({"manager_id": current_user.id}).to_list(1000)
        employee_ids = [emp["id"] for emp in employees]
        query["employee_id"] = {"$in": employee_ids}
    
    room_statuses = await db.room_statuses.find(query).to_list(1000)
    
    # Get laundry stats
    laundry_stats = await db.laundry_records.find(query).to_list(100)
    
    # Prepare report data
    employee_performance = {}
    
    # Process room data
    for room_status in room_statuses:
        room_status = parse_from_mongo(room_status)
        emp_id = room_status["employee_id"]
        
        if emp_id not in employee_performance:
            employee = await db.users.find_one({"id": emp_id})
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
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Get employees based on role
    if current_user.role == UserRole.MANAGER:
        employees = await db.users.find({"manager_id": current_user.id}).to_list(1000)
    else:
        employees = await db.users.find({"role": UserRole.EMPLOYEE}).to_list(1000)
    
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
    # Create super admin if doesn't exist
    super_admin = await db.users.find_one({"role": UserRole.SUPER_ADMIN})
    if not super_admin:
        admin_user = User(
            email="admin@company.com",
            name="Super Admin",
            role=UserRole.SUPER_ADMIN
        )
        admin_dict = admin_user.dict()
        admin_dict["password_hash"] = get_password_hash("admin123")
        await db.users.insert_one(prepare_for_mongo(admin_dict))
        logger.info("Super admin created: admin@company.com / admin123")
    
    logger.info("Application started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
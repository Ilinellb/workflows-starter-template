#!/usr/bin/env python3
"""
Debug Room Management Issues
"""

import requests
import json
import os
from datetime import datetime, date
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://timeoff-portal-6.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

def authenticate(email, password):
    """Authenticate and return session with token"""
    session = requests.Session()
    
    login_data = {
        "email": email,
        "password": password
    }
    
    response = session.post(f"{API_BASE}/auth/login", json=login_data)
    if response.status_code == 200:
        data = response.json()
        token = data.get('access_token')
        user = data.get('user')
        
        session.headers.update({
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        })
        
        return session, user
    else:
        print(f"Auth failed for {email}: {response.text}")
        return None, None

def test_room_status_with_manager():
    """Test room status endpoint with manager account"""
    print("🔍 Testing room status endpoint with manager account...")
    
    # Try to authenticate as admin (who should have manager-like permissions)
    session, user = authenticate("admin@company.com", "admin123")
    if not session:
        print("❌ Cannot authenticate as admin")
        return False
    
    print(f"✅ Authenticated as: {user.get('name')} ({user.get('role')})")
    
    # Test room status endpoint
    try:
        response = session.get(f"{API_BASE}/rooms/status")
        print(f"Room status response: {response.status_code}")
        
        if response.status_code == 200:
            rooms = response.json()
            print(f"✅ Success: Retrieved {len(rooms)} room statuses")
            return True
        else:
            print(f"❌ Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def test_room_reports_with_manager():
    """Test room reports with manager account"""
    print("\n📈 Testing room reports with manager account...")
    
    # Try to authenticate as admin
    session, user = authenticate("admin@company.com", "admin123")
    if not session:
        print("❌ Cannot authenticate as admin")
        return False
    
    print(f"✅ Authenticated as: {user.get('name')} ({user.get('role')})")
    
    # Test room reports endpoint
    try:
        response = session.get(f"{API_BASE}/rooms/report")
        print(f"Room reports response: {response.status_code}")
        
        if response.status_code == 200:
            report = response.json()
            print(f"✅ Success: Room report generated")
            print(f"Report keys: {list(report.keys())}")
            return True
        else:
            print(f"❌ Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def check_database_data():
    """Check if room data exists in database by testing with employee"""
    print("\n🔍 Checking database data with employee account...")
    
    session, user = authenticate("john@company.com", "password123")
    if not session:
        print("❌ Cannot authenticate as employee")
        return False
    
    # Add a room status to ensure data exists
    update_data = {
        "room_id": "room-201",
        "status": "occupied",
        "duration": 2,
        "timestamp": datetime.now().isoformat() + "Z"
    }
    
    response = session.post(f"{API_BASE}/rooms/update-status", json=update_data)
    print(f"Room update response: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Room data added successfully")
        return True
    else:
        print(f"❌ Failed to add room data: {response.text}")
        return False

def main():
    print("🔧 DEBUGGING ROOM MANAGEMENT ISSUES")
    print("=" * 50)
    
    # Check if we can add room data
    check_database_data()
    
    # Test with manager permissions
    test_room_status_with_manager()
    test_room_reports_with_manager()

if __name__ == "__main__":
    main()
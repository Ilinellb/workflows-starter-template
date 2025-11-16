#!/usr/bin/env python3
"""
Specific endpoint testing to identify exact issues with failed endpoints
"""

import requests
import json
import os
from datetime import datetime, date
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://rsbc-platform.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

def test_organization_update_user():
    """Test the organization update user endpoint with correct parameters"""
    print("🔍 Testing Organization Update User Endpoint")
    
    # Authenticate as manager
    session = requests.Session()
    session.headers.update({'Content-Type': 'application/json'})
    
    login_data = {
        "email": "admin@company.com",
        "password": "admin123"
    }
    
    login_response = session.post(f"{API_BASE}/auth/login", json=login_data)
    if login_response.status_code != 200:
        print(f"❌ Manager authentication failed: {login_response.text}")
        return False
    
    manager_token = login_response.json().get('access_token')
    session.headers.update({'Authorization': f'Bearer {manager_token}'})
    
    # Get a user ID first
    users_response = session.get(f"{API_BASE}/users")
    if users_response.status_code != 200:
        print(f"❌ Failed to get users: {users_response.text}")
        return False
    
    users = users_response.json()
    if not users:
        print("❌ No users found")
        return False
    
    test_user_id = users[0]['id']
    print(f"   Using user ID: {test_user_id}")
    
    # Test 1: Query parameters (as per current implementation)
    print("\n   Testing with query parameters...")
    response = session.put(f"{API_BASE}/organization/update-user?user_id={test_user_id}&department=front_desk_operations")
    print(f"   Response status: {response.status_code}")
    print(f"   Response: {response.text}")
    
    # Test 2: JSON body
    print("\n   Testing with JSON body...")
    update_data = {
        "user_id": test_user_id,
        "department": "front_desk_operations"
    }
    response = session.put(f"{API_BASE}/organization/update-user", json=update_data)
    print(f"   Response status: {response.status_code}")
    print(f"   Response: {response.text}")
    
    return True

def test_missing_endpoints():
    """Test endpoints that returned 404 to see if they exist with different paths"""
    print("\n🔍 Testing Missing Endpoints")
    
    # Authenticate as manager
    session = requests.Session()
    session.headers.update({'Content-Type': 'application/json'})
    
    login_data = {
        "email": "admin@company.com",
        "password": "admin123"
    }
    
    login_response = session.post(f"{API_BASE}/auth/login", json=login_data)
    if login_response.status_code != 200:
        print(f"❌ Manager authentication failed: {login_response.text}")
        return False
    
    manager_token = login_response.json().get('access_token')
    session.headers.update({'Authorization': f'Bearer {manager_token}'})
    
    # Test various endpoint variations
    endpoints_to_test = [
        # Time off variations
        ("/time-off/requests", "GET", "Time off requests"),
        ("/timeoff/requests", "GET", "Timeoff requests (no dash)"),
        ("/time-off/my-requests", "GET", "My time off requests"),
        
        # Scheduling variations
        ("/schedule/team", "GET", "Team schedule (singular)"),
        ("/schedules", "GET", "Schedules base"),
        ("/scheduling/team", "GET", "Scheduling team"),
        
        # Reports variations
        ("/report/team", "GET", "Team report (singular)"),
        ("/reports", "GET", "Reports base"),
        ("/reporting/team", "GET", "Reporting team"),
        
        # Time tracking variations
        ("/time/reports", "GET", "Time reports"),
        ("/timesheet/reports", "GET", "Timesheet reports"),
    ]
    
    for endpoint, method, description in endpoints_to_test:
        print(f"\n   Testing {method} {endpoint} - {description}")
        try:
            if method == "GET":
                response = session.get(f"{API_BASE}{endpoint}")
            else:
                response = session.post(f"{API_BASE}{endpoint}", json={})
            
            print(f"   Status: {response.status_code}")
            if response.status_code != 404:
                print(f"   ✅ Found! Response: {response.text[:100]}...")
            else:
                print(f"   ❌ Not found")
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
    
    return True

def test_file_upload_properly():
    """Test file upload endpoint with proper multipart form data"""
    print("\n🔍 Testing File Upload Endpoint Properly")
    
    # Authenticate as employee
    session = requests.Session()
    
    login_data = {
        "email": "john@company.com",
        "password": "password123"
    }
    
    login_response = session.post(f"{API_BASE}/auth/login", json=login_data)
    if login_response.status_code != 200:
        print(f"❌ Employee authentication failed: {login_response.text}")
        return False
    
    employee_token = login_response.json().get('access_token')
    session.headers.update({'Authorization': f'Bearer {employee_token}'})
    
    # Create a test file
    test_content = b"This is a test file for upload"
    
    try:
        # Test with proper multipart form data
        files = {'file': ('test.txt', test_content, 'text/plain')}
        response = session.post(f"{API_BASE}/messages/upload", files=files)
        
        print(f"   Response status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            print("   ✅ File upload working correctly")
            return True
        else:
            print("   ❌ File upload failed")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False

def main():
    """Main test execution"""
    print("=" * 60)
    print("🔍 SPECIFIC ENDPOINT TESTING")
    print("=" * 60)
    print(f"🌐 Backend URL: {API_BASE}")
    
    # Test organization endpoint
    test_organization_update_user()
    
    # Test missing endpoints
    test_missing_endpoints()
    
    # Test file upload properly
    test_file_upload_properly()
    
    print(f"\n🕐 Test completed at: {datetime.now()}")

if __name__ == "__main__":
    main()
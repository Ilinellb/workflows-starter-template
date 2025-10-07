#!/usr/bin/env python3
"""
Backend Testing Suite for Room Management System
Tests all room management endpoints and functionality
"""

import requests
import json
import os
from datetime import datetime, date
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://roomflow-14.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class RoomManagementTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = None
        
    def authenticate(self, email="john@company.com", password="password123"):
        """Authenticate user and get access token"""
        print(f"\n🔐 Authenticating user: {email}")
        
        login_data = {
            "email": email,
            "password": password
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            print(f"Login response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('access_token')
                self.user_data = data.get('user')
                
                # Set authorization header for future requests
                self.session.headers.update({
                    'Authorization': f'Bearer {self.auth_token}',
                    'Content-Type': 'application/json'
                })
                
                print(f"✅ Authentication successful")
                print(f"   User: {self.user_data.get('name')} ({self.user_data.get('role')})")
                return True
            else:
                print(f"❌ Authentication failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def create_test_employee_if_needed(self):
        """Create test employee if it doesn't exist"""
        print(f"\n👤 Checking if test employee exists...")
        
        # First try to authenticate with existing credentials
        if self.authenticate():
            return True
            
        # If authentication fails, try to create the user
        print("🔧 Test employee not found, attempting to create...")
        
        # Try to authenticate as admin first
        admin_auth = self.authenticate("admin@company.com", "admin123")
        if not admin_auth:
            print("❌ Cannot authenticate as admin to create test user")
            return False
            
        # Create test employee
        employee_data = {
            "email": "john@company.com",
            "name": "John Doe",
            "password": "password123",
            "role": "employee",
            "start_time": "09:00",
            "workplace_lat": 40.7128,
            "workplace_lng": -74.0060,
            "geofence_radius": 100
        }
        
        try:
            response = self.session.post(f"{API_BASE}/users", json=employee_data)
            if response.status_code == 200:
                print("✅ Test employee created successfully")
                # Now authenticate as the new employee
                return self.authenticate("john@company.com", "password123")
            else:
                print(f"❌ Failed to create test employee: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating test employee: {str(e)}")
            return False
    
    def test_room_status_update(self, room_id, status, duration=None):
        """Test room status update endpoint"""
        print(f"\n🏠 Testing room status update: Room {room_id} -> {status}")
        
        update_data = {
            "room_id": f"room-{room_id}",
            "status": status,
            "timestamp": datetime.now().isoformat() + "Z"
        }
        
        if duration:
            update_data["duration"] = duration
            print(f"   Duration: {duration} hours")
        
        try:
            response = self.session.post(f"{API_BASE}/rooms/update-status", json=update_data)
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Success: {result.get('message')}")
                return True
            else:
                print(f"   ❌ Failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False
    
    def test_room_extend(self, room_id, extend_hours=1):
        """Test room time extension endpoint"""
        print(f"\n⏰ Testing room time extension: Room {room_id} + {extend_hours}h")
        
        try:
            response = self.session.post(f"{API_BASE}/rooms/extend?room_id=room-{room_id}&extend_hours={extend_hours}")
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Success: {result.get('message')}")
                return True
            else:
                print(f"   ❌ Failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False
    
    def test_get_room_status(self):
        """Test get room statuses endpoint"""
        print(f"\n📊 Testing get room statuses")
        
        try:
            response = self.session.get(f"{API_BASE}/rooms/status")
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                rooms = response.json()
                print(f"   ✅ Success: Retrieved {len(rooms)} room statuses")
                
                # Display room data structure
                if rooms:
                    print("   📋 Sample room data structure:")
                    sample_room = rooms[0]
                    for key, value in sample_room.items():
                        print(f"      {key}: {value}")
                
                return True, rooms
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, []
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, []
    
    def test_room_reports(self, date_filter=None):
        """Test room reports endpoint"""
        print(f"\n📈 Testing room reports")
        
        url = f"{API_BASE}/rooms/report"
        if date_filter:
            url += f"?date_filter={date_filter}"
            print(f"   Date filter: {date_filter}")
        
        try:
            response = self.session.get(url)
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                report = response.json()
                print(f"   ✅ Success: Room report generated")
                print(f"   📊 Report data:")
                print(f"      Date: {report.get('date')}")
                print(f"      Employee Performance: {len(report.get('employee_performance', []))} entries")
                print(f"      Total Rooms: {report.get('room_summary', {}).get('total_rooms', 0)}")
                return True, report
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, {}
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, {}
    
    def run_comprehensive_room_tests(self):
        """Run all room management tests in sequence"""
        print("=" * 60)
        print("🏨 ROOM MANAGEMENT SYSTEM - BACKEND TESTING")
        print("=" * 60)
        
        # Test authentication
        if not self.create_test_employee_if_needed():
            print("❌ Cannot proceed without authentication")
            return False
        
        test_results = {
            "authentication": True,
            "room_status_updates": [],
            "room_extension": False,
            "room_status_retrieval": False,
            "room_reports": False,
            "data_persistence": False
        }
        
        # Test room status updates (as per requirements)
        print("\n" + "=" * 40)
        print("🔄 TESTING ROOM STATUS UPDATES")
        print("=" * 40)
        
        # 1. Update room status from open_clean to occupied
        result1 = self.test_room_status_update("101", "occupied", duration=3)
        test_results["room_status_updates"].append(("open_clean_to_occupied", result1))
        
        # 2. Update room status to occupied_out (guest out)
        result2 = self.test_room_status_update("101", "occupied_out")
        test_results["room_status_updates"].append(("to_occupied_out", result2))
        
        # 3. Update room status back to occupied (guest return)
        result3 = self.test_room_status_update("101", "occupied")
        test_results["room_status_updates"].append(("back_to_occupied", result3))
        
        # 4. Update room status to needs_cleaning (checkout)
        result4 = self.test_room_status_update("101", "needs_cleaning")
        test_results["room_status_updates"].append(("to_needs_cleaning", result4))
        
        # 5. Test room extension
        print("\n" + "=" * 40)
        print("⏰ TESTING ROOM TIME EXTENSION")
        print("=" * 40)
        
        # First set room to occupied for extension test
        self.test_room_status_update("102", "occupied", duration=2)
        test_results["room_extension"] = self.test_room_extend("102", 1)
        
        # 6. Test room status retrieval and data structure
        print("\n" + "=" * 40)
        print("📊 TESTING ROOM STATUS RETRIEVAL")
        print("=" * 40)
        
        success, rooms_data = self.test_get_room_status()
        test_results["room_status_retrieval"] = success
        
        # Verify data persistence
        if success and rooms_data:
            print("\n🔍 Verifying data persistence...")
            room_101_found = any(room.get('room_number') == '101' for room in rooms_data)
            room_102_found = any(room.get('room_number') == '102' for room in rooms_data)
            
            if room_101_found or room_102_found:
                print("   ✅ Data persistence verified - room updates are stored")
                test_results["data_persistence"] = True
            else:
                print("   ❌ Data persistence issue - room updates not found")
        
        # 7. Test room reports
        print("\n" + "=" * 40)
        print("📈 TESTING ROOM REPORTS")
        print("=" * 40)
        
        success, report_data = self.test_room_reports()
        test_results["room_reports"] = success
        
        # Test with date filter
        today = date.today().isoformat()
        success_filtered, _ = self.test_room_reports(today)
        
        # Summary
        print("\n" + "=" * 60)
        print("📋 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        total_tests = 0
        passed_tests = 0
        
        print(f"✅ Authentication: {'PASS' if test_results['authentication'] else 'FAIL'}")
        total_tests += 1
        if test_results['authentication']:
            passed_tests += 1
        
        print(f"\n🔄 Room Status Updates:")
        for test_name, result in test_results['room_status_updates']:
            status = 'PASS' if result else 'FAIL'
            print(f"   {test_name}: {status}")
            total_tests += 1
            if result:
                passed_tests += 1
        
        print(f"\n⏰ Room Extension: {'PASS' if test_results['room_extension'] else 'FAIL'}")
        total_tests += 1
        if test_results['room_extension']:
            passed_tests += 1
        
        print(f"📊 Room Status Retrieval: {'PASS' if test_results['room_status_retrieval'] else 'FAIL'}")
        total_tests += 1
        if test_results['room_status_retrieval']:
            passed_tests += 1
        
        print(f"💾 Data Persistence: {'PASS' if test_results['data_persistence'] else 'FAIL'}")
        total_tests += 1
        if test_results['data_persistence']:
            passed_tests += 1
        
        print(f"📈 Room Reports: {'PASS' if test_results['room_reports'] else 'FAIL'}")
        total_tests += 1
        if test_results['room_reports']:
            passed_tests += 1
        
        print(f"\n🎯 OVERALL RESULT: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED - Room Management System is working correctly!")
            return True
        else:
            print("⚠️  SOME TESTS FAILED - Issues found in Room Management System")
            return False

def main():
    """Main test execution"""
    tester = RoomManagementTester()
    
    print(f"🌐 Backend URL: {API_BASE}")
    print(f"🕐 Test started at: {datetime.now()}")
    
    success = tester.run_comprehensive_room_tests()
    
    print(f"\n🕐 Test completed at: {datetime.now()}")
    
    if success:
        print("✅ Room Management Backend Testing: SUCCESS")
        exit(0)
    else:
        print("❌ Room Management Backend Testing: FAILED")
        exit(1)

if __name__ == "__main__":
    main()
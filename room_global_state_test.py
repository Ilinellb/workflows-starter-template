#!/usr/bin/env python3
"""
Room Management Global State Testing Suite
Tests the GLOBAL room management state implementation where all users see the same room state
"""

import requests
import json
import os
from datetime import datetime, date
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://ops-manager-hub-1.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class RoomGlobalStateTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = None
        
    def authenticate(self, email, password):
        """Authenticate user and get access token"""
        print(f"\n🔐 Authenticating user: {email}")
        
        login_data = {
            "email": email,
            "password": password
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            print(f"   Login response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('access_token')
                self.user_data = data.get('user')
                
                # Set authorization header for future requests
                self.session.headers.update({
                    'Authorization': f'Bearer {self.auth_token}',
                    'Content-Type': 'application/json'
                })
                
                print(f"   ✅ Authentication successful")
                print(f"   User: {self.user_data.get('name')} ({self.user_data.get('role')})")
                return True
            else:
                print(f"   ❌ Authentication failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ Authentication error: {str(e)}")
            return False
    
    def create_test_attendant_if_needed(self, email, name, password):
        """Create test attendant if it doesn't exist"""
        print(f"\n👤 Creating test attendant if needed: {email}")
        
        # First try to authenticate as admin
        admin_session = requests.Session()
        admin_session.headers.update({'Content-Type': 'application/json'})
        
        admin_login = {
            "email": "lbj1288@gmail.com",
            "password": "admin123"
        }
        
        try:
            admin_response = admin_session.post(f"{API_BASE}/auth/login", json=admin_login)
            if admin_response.status_code != 200:
                print(f"   ❌ Cannot authenticate as admin: {admin_response.text}")
                return False
            
            admin_token = admin_response.json().get('access_token')
            admin_session.headers.update({
                'Authorization': f'Bearer {admin_token}'
            })
            
            # Try to create the attendant
            attendant_data = {
                "email": email,
                "name": name,
                "password": password,
                "role": "attendant",
                "start_time": "09:00"
            }
            
            create_response = admin_session.post(f"{API_BASE}/users", json=attendant_data)
            if create_response.status_code == 200:
                print(f"   ✅ Test attendant created successfully")
                return True
            elif "already registered" in create_response.text:
                print(f"   ℹ️  Test attendant already exists")
                return True
            else:
                print(f"   ❌ Failed to create test attendant: {create_response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ Error creating test attendant: {str(e)}")
            return False
    
    def update_room_status(self, room_id, status, duration=None):
        """Update room status"""
        print(f"\n🏠 Updating room {room_id} status to {status}")
        
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
    
    def extend_room_time(self, room_id, extend_hours=1):
        """Extend room time"""
        print(f"\n⏰ Extending room {room_id} by {extend_hours} hour(s)")
        
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
    
    def get_room_statuses(self):
        """Get all room statuses"""
        print(f"\n📊 Getting room statuses")
        
        try:
            response = self.session.get(f"{API_BASE}/rooms/status")
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                rooms = response.json()
                print(f"   ✅ Success: Retrieved {len(rooms)} room statuses")
                return True, rooms
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, []
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, []
    
    def find_room_in_statuses(self, rooms, room_number):
        """Find specific room in room statuses"""
        for room in rooms:
            if room.get('room_number') == str(room_number):
                return room
        return None
    
    def test_multi_user_global_state(self):
        """Test that room state is global across all users"""
        print("\n" + "=" * 60)
        print("🌐 TESTING MULTI-USER GLOBAL STATE VERIFICATION")
        print("=" * 60)
        
        # Step 1: Login as Attendant 1 (john@company.com)
        print(f"\n👤 STEP 1: Login as Attendant 1")
        if not self.authenticate("john@company.com", "password123"):
            print("❌ Cannot authenticate as Attendant 1")
            return False
        
        attendant1_name = self.user_data.get('name')
        
        # Step 2: Update Room 1 to occupied with 2 hours duration
        print(f"\n🏠 STEP 2: Attendant 1 updates Room 1 to occupied")
        if not self.update_room_status("1", "occupied", duration=2):
            print("❌ Failed to update room status as Attendant 1")
            return False
        
        # Step 3: Verify update successful by getting room statuses
        print(f"\n📊 STEP 3: Verify Room 1 update as Attendant 1")
        success, rooms = self.get_room_statuses()
        if not success:
            print("❌ Failed to get room statuses as Attendant 1")
            return False
        
        room1_attendant1 = self.find_room_in_statuses(rooms, "1")
        if not room1_attendant1:
            print("❌ Room 1 not found in statuses")
            return False
        
        print(f"   Room 1 status: {room1_attendant1.get('status')}")
        print(f"   Updated by: {room1_attendant1.get('employee_name')}")
        print(f"   Duration: {room1_attendant1.get('duration_hours')} hours")
        
        if room1_attendant1.get('status') != 'occupied':
            print("❌ Room 1 status not updated correctly")
            return False
        
        # Step 4: Create and login as Attendant 2
        print(f"\n👤 STEP 4: Create and login as Attendant 2")
        attendant2_email = "attendant2@company.com"
        attendant2_name = "Attendant Two"
        attendant2_password = "password123"
        
        if not self.create_test_attendant_if_needed(attendant2_email, attendant2_name, attendant2_password):
            print("❌ Failed to create Attendant 2")
            return False
        
        if not self.authenticate(attendant2_email, attendant2_password):
            print("❌ Cannot authenticate as Attendant 2")
            return False
        
        # Step 5: Get room statuses as Attendant 2 and verify Room 1 shows occupied
        print(f"\n🌐 STEP 5: CRITICAL - Verify Attendant 2 sees Room 1 occupied by Attendant 1")
        success, rooms = self.get_room_statuses()
        if not success:
            print("❌ Failed to get room statuses as Attendant 2")
            return False
        
        room1_attendant2 = self.find_room_in_statuses(rooms, "1")
        if not room1_attendant2:
            print("❌ Room 1 not found in statuses for Attendant 2")
            return False
        
        print(f"   Room 1 status: {room1_attendant2.get('status')}")
        print(f"   Updated by: {room1_attendant2.get('employee_name')}")
        print(f"   Duration: {room1_attendant2.get('duration_hours')} hours")
        
        # CRITICAL VERIFICATION: Attendant 2 should see room status set by Attendant 1
        if room1_attendant2.get('status') == 'occupied' and room1_attendant2.get('employee_name') == attendant1_name:
            print("✅ CRITICAL SUCCESS: Attendant 2 sees Room 1 occupied by Attendant 1 - GLOBAL STATE CONFIRMED!")
            return True
        else:
            print("❌ CRITICAL FAILURE: Global state not working - Attendant 2 doesn't see Attendant 1's room update")
            return False
    
    def test_room_extension_by_different_user(self):
        """Test that any attendant can extend any occupied room"""
        print("\n" + "=" * 60)
        print("⏰ TESTING ROOM EXTENSION BY DIFFERENT USER")
        print("=" * 60)
        
        # Ensure we're logged in as Attendant 2 from previous test
        if not self.user_data or self.user_data.get('email') != 'attendant2@company.com':
            if not self.authenticate("attendant2@company.com", "password123"):
                print("❌ Cannot authenticate as Attendant 2")
                return False
        
        # Step 1: Extend Room 1 by 1 hour as Attendant 2
        print(f"\n⏰ STEP 1: Attendant 2 extends Room 1 by 1 hour")
        if not self.extend_room_time("1", 1):
            print("❌ Failed to extend room as Attendant 2")
            return False
        
        # Step 2: Login as Attendant 1 and verify extension
        print(f"\n👤 STEP 2: Login as Attendant 1 and verify extension")
        if not self.authenticate("john@company.com", "password123"):
            print("❌ Cannot authenticate as Attendant 1")
            return False
        
        # Step 3: Get room statuses and verify Room 1 shows extended_hours = 1
        print(f"\n📊 STEP 3: Verify Room 1 shows extended_hours = 1")
        success, rooms = self.get_room_statuses()
        if not success:
            print("❌ Failed to get room statuses")
            return False
        
        room1 = self.find_room_in_statuses(rooms, "1")
        if not room1:
            print("❌ Room 1 not found in statuses")
            return False
        
        extended_hours = room1.get('extended_hours', 0)
        print(f"   Room 1 extended_hours: {extended_hours}")
        print(f"   Original duration: {room1.get('duration_hours')} hours")
        print(f"   Last updated by: {room1.get('employee_name')}")
        
        if extended_hours == 1:
            print("✅ SUCCESS: Any attendant can extend any occupied room - GLOBAL EXTENSION CONFIRMED!")
            return True
        else:
            print("❌ FAILURE: Room extension not working globally")
            return False
    
    def test_manager_view_of_global_state(self):
        """Test that managers see all room statuses from all attendants"""
        print("\n" + "=" * 60)
        print("👔 TESTING MANAGER VIEW OF GLOBAL STATE")
        print("=" * 60)
        
        # Step 1: Login as OPS Manager
        print(f"\n👤 STEP 1: Login as OPS Manager")
        if not self.authenticate("lbj1288@gmail.com", "admin123"):
            print("❌ Cannot authenticate as OPS Manager")
            return False
        
        # Step 2: Get room statuses as manager
        print(f"\n📊 STEP 2: Get room statuses as manager")
        success, rooms = self.get_room_statuses()
        if not success:
            print("❌ Failed to get room statuses as manager")
            return False
        
        # Step 3: Verify manager sees ALL room statuses with employee names
        print(f"\n🌐 STEP 3: Verify manager sees all room statuses")
        print(f"   Total rooms retrieved: {len(rooms)}")
        
        # Find Room 1 that was updated by attendants
        room1 = self.find_room_in_statuses(rooms, "1")
        if room1:
            print(f"   Room 1 details:")
            print(f"      Status: {room1.get('status')}")
            print(f"      Employee Name: {room1.get('employee_name')}")
            print(f"      Duration: {room1.get('duration_hours')} hours")
            print(f"      Extended: {room1.get('extended_hours')} hours")
            print(f"      Last Updated: {room1.get('last_updated')}")
            
            if room1.get('employee_name'):
                print("✅ SUCCESS: Manager sees room status with employee name - GLOBAL MANAGER VIEW CONFIRMED!")
                return True
            else:
                print("❌ FAILURE: Manager doesn't see employee name who updated room")
                return False
        else:
            print("❌ Room 1 not found in manager's view")
            return False
    
    def test_room_status_transitions(self):
        """Test complete room status transition workflow"""
        print("\n" + "=" * 60)
        print("🔄 TESTING ROOM STATUS TRANSITIONS")
        print("=" * 60)
        
        # Use Room 2 for this test to avoid conflicts
        room_id = "2"
        
        # Login as Attendant 1
        if not self.authenticate("john@company.com", "password123"):
            print("❌ Cannot authenticate as Attendant 1")
            return False
        
        # Test transition sequence: open_clean → occupied → occupied_out → needs_cleaning → open_clean
        transitions = [
            ("open_clean", None),
            ("occupied", 3),
            ("occupied_out", None),
            ("needs_cleaning", None),
            ("open_clean", None)
        ]
        
        for i, (status, duration) in enumerate(transitions, 1):
            print(f"\n🔄 STEP {i}: Transition Room {room_id} to {status}")
            if not self.update_room_status(room_id, status, duration):
                print(f"❌ Failed to transition to {status}")
                return False
            
            # Verify the transition persisted
            success, rooms = self.get_room_statuses()
            if success:
                room = self.find_room_in_statuses(rooms, room_id)
                if room and room.get('status') == status:
                    print(f"   ✅ Room {room_id} successfully transitioned to {status}")
                else:
                    print(f"   ❌ Room {room_id} transition to {status} not persisted")
                    return False
        
        print("✅ SUCCESS: All room status transitions work correctly - GLOBAL PERSISTENCE CONFIRMED!")
        return True
    
    def run_comprehensive_global_state_tests(self):
        """Run all global state tests"""
        print("=" * 80)
        print("🌐 ROOM MANAGEMENT GLOBAL STATE - COMPREHENSIVE TESTING")
        print("=" * 80)
        
        test_results = {
            "multi_user_global_state": False,
            "room_extension_by_different_user": False,
            "manager_view_of_global_state": False,
            "room_status_transitions": False
        }
        
        # Test 1: Multi-User Global State Verification (CRITICAL)
        test_results["multi_user_global_state"] = self.test_multi_user_global_state()
        
        # Test 2: Room Extension by Different User
        test_results["room_extension_by_different_user"] = self.test_room_extension_by_different_user()
        
        # Test 3: Manager View of Global State
        test_results["manager_view_of_global_state"] = self.test_manager_view_of_global_state()
        
        # Test 4: Room Status Transitions
        test_results["room_status_transitions"] = self.test_room_status_transitions()
        
        # Summary
        print("\n" + "=" * 80)
        print("📋 GLOBAL STATE TEST RESULTS SUMMARY")
        print("=" * 80)
        
        total_tests = len(test_results)
        passed_tests = sum(1 for result in test_results.values() if result)
        
        for test_name, result in test_results.items():
            status = 'PASS' if result else 'FAIL'
            display_name = test_name.replace('_', ' ').title()
            icon = '✅' if result else '❌'
            print(f"{icon} {display_name}: {status}")
        
        print(f"\n🎯 OVERALL RESULT: {passed_tests}/{total_tests} tests passed")
        
        # Critical requirements verification
        print("\n" + "=" * 80)
        print("🎯 CRITICAL REQUIREMENTS VERIFICATION")
        print("=" * 80)
        
        requirements = [
            ("✅ All users see the same global room state" if test_results["multi_user_global_state"] else "❌ Global room state not working", test_results["multi_user_global_state"]),
            ("✅ Room updates by one user are visible to all users" if test_results["multi_user_global_state"] else "❌ Room updates not globally visible", test_results["multi_user_global_state"]),
            ("✅ Any attendant can extend any occupied room" if test_results["room_extension_by_different_user"] else "❌ Room extension not globally accessible", test_results["room_extension_by_different_user"]),
            ("✅ Managers see all room statuses with employee names" if test_results["manager_view_of_global_state"] else "❌ Manager global view not working", test_results["manager_view_of_global_state"]),
            ("✅ All room status transitions work correctly" if test_results["room_status_transitions"] else "❌ Room status transitions failing", test_results["room_status_transitions"])
        ]
        
        all_critical_passed = True
        for req_text, req_result in requirements:
            print(f"   {req_text}")
            if not req_result:
                all_critical_passed = False
        
        # Final verdict
        print(f"\n" + "=" * 80)
        if all_critical_passed:
            print("🎉 ROOM MANAGEMENT GLOBAL STATE: FULLY OPERATIONAL!")
            print("   ✅ All users share the same unified room state")
            print("   ✅ No employee_id filtering - truly global implementation")
            print("   ✅ Multi-user collaboration working correctly")
            return True
        else:
            print("⚠️  ROOM MANAGEMENT GLOBAL STATE: ISSUES FOUND!")
            print("   ❌ Global state implementation has problems")
            print("   ❌ Employee_id filtering may still be present")
            return False

def main():
    """Main test execution"""
    tester = RoomGlobalStateTester()
    
    print(f"🌐 Backend URL: {API_BASE}")
    print(f"🕐 Test started at: {datetime.now()}")
    
    success = tester.run_comprehensive_global_state_tests()
    
    print(f"\n🕐 Test completed at: {datetime.now()}")
    
    if success:
        print("✅ Room Management Global State Testing: SUCCESS")
        exit(0)
    else:
        print("❌ Room Management Global State Testing: FAILED")
        exit(1)

if __name__ == "__main__":
    main()
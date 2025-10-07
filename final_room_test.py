#!/usr/bin/env python3
"""
Final Comprehensive Room Management Backend Test
Tests all functionality with appropriate user roles
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

class ComprehensiveRoomTester:
    def __init__(self):
        self.employee_session = None
        self.manager_session = None
        
    def authenticate(self, email, password):
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
            return None, None
    
    def setup_sessions(self):
        """Setup both employee and manager sessions"""
        print("🔐 Setting up authentication sessions...")
        
        # Employee session
        self.employee_session, employee_user = self.authenticate("john@company.com", "password123")
        if not self.employee_session:
            print("❌ Failed to authenticate employee")
            return False
        print(f"✅ Employee authenticated: {employee_user.get('name')} ({employee_user.get('role')})")
        
        # Manager/Admin session
        self.manager_session, manager_user = self.authenticate("admin@company.com", "admin123")
        if not self.manager_session:
            print("❌ Failed to authenticate manager")
            return False
        print(f"✅ Manager authenticated: {manager_user.get('name')} ({manager_user.get('role')})")
        
        return True
    
    def test_room_status_updates(self):
        """Test all room status update scenarios"""
        print("\n" + "=" * 50)
        print("🔄 TESTING ROOM STATUS UPDATES (Employee)")
        print("=" * 50)
        
        test_results = []
        
        # Test scenarios as specified in requirements
        scenarios = [
            ("101", "occupied", 3, "open_clean to occupied"),
            ("101", "occupied_out", None, "to occupied_out (guest out)"),
            ("101", "occupied", None, "back to occupied (guest return)"),
            ("101", "needs_cleaning", None, "to needs_cleaning (checkout)")
        ]
        
        for room_id, status, duration, description in scenarios:
            print(f"\n🏠 Testing: {description}")
            
            update_data = {
                "room_id": f"room-{room_id}",
                "status": status,
                "timestamp": datetime.now().isoformat() + "Z"
            }
            
            if duration:
                update_data["duration"] = duration
                print(f"   Duration: {duration} hours")
            
            try:
                response = self.employee_session.post(f"{API_BASE}/rooms/update-status", json=update_data)
                if response.status_code == 200:
                    result = response.json()
                    print(f"   ✅ Success: {result.get('message')}")
                    test_results.append(True)
                else:
                    print(f"   ❌ Failed: {response.text}")
                    test_results.append(False)
            except Exception as e:
                print(f"   ❌ Error: {str(e)}")
                test_results.append(False)
        
        return all(test_results)
    
    def test_room_extension(self):
        """Test room time extension"""
        print("\n" + "=" * 50)
        print("⏰ TESTING ROOM TIME EXTENSION (Employee)")
        print("=" * 50)
        
        # First set up a room for extension
        update_data = {
            "room_id": "room-102",
            "status": "occupied",
            "duration": 2,
            "timestamp": datetime.now().isoformat() + "Z"
        }
        
        response = self.employee_session.post(f"{API_BASE}/rooms/update-status", json=update_data)
        if response.status_code != 200:
            print("❌ Failed to set up room for extension test")
            return False
        
        print("✅ Room 102 set to occupied for extension test")
        
        # Test extension
        try:
            response = self.employee_session.post(f"{API_BASE}/rooms/extend?room_id=room-102&extend_hours=1")
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Extension successful: {result.get('message')}")
                return True
            else:
                print(f"❌ Extension failed: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Extension error: {str(e)}")
            return False
    
    def test_room_status_retrieval(self):
        """Test room status retrieval with both employee and manager"""
        print("\n" + "=" * 50)
        print("📊 TESTING ROOM STATUS RETRIEVAL")
        print("=" * 50)
        
        results = {}
        
        # Test with employee
        print("\n👤 Testing with Employee account:")
        try:
            response = self.employee_session.get(f"{API_BASE}/rooms/status")
            if response.status_code == 200:
                rooms = response.json()
                print(f"✅ Employee view: Retrieved {len(rooms)} room statuses")
                results['employee'] = True
                
                if rooms:
                    print("📋 Sample room data structure:")
                    sample = rooms[0]
                    for key, value in sample.items():
                        print(f"   {key}: {value}")
            else:
                print(f"❌ Employee view failed: {response.text}")
                results['employee'] = False
        except Exception as e:
            print(f"❌ Employee view error: {str(e)}")
            results['employee'] = False
        
        # Test with manager
        print("\n👨‍💼 Testing with Manager account:")
        try:
            response = self.manager_session.get(f"{API_BASE}/rooms/status")
            if response.status_code == 200:
                rooms = response.json()
                print(f"✅ Manager view: Retrieved {len(rooms)} room statuses")
                results['manager'] = True
                
                # Check if employee names are included for manager view
                if rooms and 'employee_name' in rooms[0]:
                    print("✅ Employee names included in manager view")
                
            else:
                print(f"❌ Manager view failed: {response.text}")
                results['manager'] = False
        except Exception as e:
            print(f"❌ Manager view error: {str(e)}")
            results['manager'] = False
        
        return all(results.values())
    
    def test_room_reports(self):
        """Test room reports with manager permissions"""
        print("\n" + "=" * 50)
        print("📈 TESTING ROOM REPORTS (Manager)")
        print("=" * 50)
        
        results = {}
        
        # Test basic report
        print("\n📊 Testing basic room report:")
        try:
            response = self.manager_session.get(f"{API_BASE}/rooms/report")
            if response.status_code == 200:
                report = response.json()
                print(f"✅ Basic report successful")
                print(f"   Date: {report.get('date')}")
                print(f"   Employee Performance entries: {len(report.get('employee_performance', []))}")
                print(f"   Total Rooms: {report.get('room_summary', {}).get('total_rooms', 0)}")
                results['basic'] = True
            else:
                print(f"❌ Basic report failed: {response.text}")
                results['basic'] = False
        except Exception as e:
            print(f"❌ Basic report error: {str(e)}")
            results['basic'] = False
        
        # Test report with date filter
        print("\n📅 Testing report with date filter:")
        today = date.today().isoformat()
        try:
            response = self.manager_session.get(f"{API_BASE}/rooms/report?date_filter={today}")
            if response.status_code == 200:
                report = response.json()
                print(f"✅ Filtered report successful for {today}")
                results['filtered'] = True
            else:
                print(f"❌ Filtered report failed: {response.text}")
                results['filtered'] = False
        except Exception as e:
            print(f"❌ Filtered report error: {str(e)}")
            results['filtered'] = False
        
        # Test employee access to reports (should fail)
        print("\n🚫 Testing employee access to reports (should fail):")
        try:
            response = self.employee_session.get(f"{API_BASE}/rooms/report")
            if response.status_code == 403:
                print("✅ Employee correctly denied access to reports")
                results['permission_check'] = True
            else:
                print(f"❌ Employee access control failed: {response.status_code}")
                results['permission_check'] = False
        except Exception as e:
            print(f"❌ Permission check error: {str(e)}")
            results['permission_check'] = False
        
        return all(results.values())
    
    def run_comprehensive_test(self):
        """Run all tests"""
        print("=" * 70)
        print("🏨 COMPREHENSIVE ROOM MANAGEMENT BACKEND TESTING")
        print("=" * 70)
        
        if not self.setup_sessions():
            return False
        
        # Run all test categories
        test_results = {
            'room_status_updates': self.test_room_status_updates(),
            'room_extension': self.test_room_extension(),
            'room_status_retrieval': self.test_room_status_retrieval(),
            'room_reports': self.test_room_reports()
        }
        
        # Summary
        print("\n" + "=" * 70)
        print("📋 COMPREHENSIVE TEST RESULTS SUMMARY")
        print("=" * 70)
        
        total_tests = len(test_results)
        passed_tests = sum(test_results.values())
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name.replace('_', ' ').title()}: {status}")
        
        print(f"\n🎯 OVERALL RESULT: {passed_tests}/{total_tests} test categories passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED - Room Management System is fully functional!")
            return True
        else:
            print("⚠️  SOME TESTS FAILED - Issues found in Room Management System")
            return False

def main():
    """Main test execution"""
    tester = ComprehensiveRoomTester()
    
    print(f"🌐 Backend URL: {API_BASE}")
    print(f"🕐 Test started at: {datetime.now()}")
    
    success = tester.run_comprehensive_test()
    
    print(f"\n🕐 Test completed at: {datetime.now()}")
    
    if success:
        print("✅ Room Management Backend Testing: SUCCESS")
        exit(0)
    else:
        print("❌ Room Management Backend Testing: FAILED")
        exit(1)

if __name__ == "__main__":
    main()
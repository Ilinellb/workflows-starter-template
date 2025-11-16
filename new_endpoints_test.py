#!/usr/bin/env python3
"""
Backend Testing Suite for Newly Implemented Endpoints
Tests Time Off System, Scheduling System, and Reports System endpoints
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

class NewEndpointsTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = None
        self.employee_session = None
        self.manager_session = None
        
    def authenticate(self, email, password):
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
                auth_token = data.get('access_token')
                user_data = data.get('user')
                
                print(f"✅ Authentication successful")
                print(f"   User: {user_data.get('name')} ({user_data.get('role')})")
                return auth_token, user_data
            else:
                print(f"❌ Authentication failed: {response.text}")
                return None, None
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return None, None
    
    def setup_sessions(self):
        """Setup authenticated sessions for employee and manager"""
        print("=" * 60)
        print("🔐 SETTING UP AUTHENTICATED SESSIONS")
        print("=" * 60)
        
        # Setup employee session
        employee_token, employee_data = self.authenticate("john@company.com", "password123")
        if employee_token:
            self.employee_session = requests.Session()
            self.employee_session.headers.update({
                'Authorization': f'Bearer {employee_token}',
                'Content-Type': 'application/json'
            })
            print(f"✅ Employee session ready: {employee_data.get('name')}")
        else:
            print("❌ Failed to setup employee session")
            return False
        
        # Setup manager session
        manager_token, manager_data = self.authenticate("admin@company.com", "admin123")
        if manager_token:
            self.manager_session = requests.Session()
            self.manager_session.headers.update({
                'Authorization': f'Bearer {manager_token}',
                'Content-Type': 'application/json'
            })
            print(f"✅ Manager session ready: {manager_data.get('name')}")
        else:
            print("❌ Failed to setup manager session")
            return False
        
        return True
    
    # ============ TIME OFF SYSTEM TESTS ============
    
    def test_get_my_time_off_requests(self):
        """Test GET /api/time-off/my-requests (as employee)"""
        print(f"\n📋 Testing GET /api/time-off/my-requests (as employee)")
        
        try:
            response = self.employee_session.get(f"{API_BASE}/time-off/my-requests")
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                requests_list = result.get('requests', [])
                print(f"   ✅ Success: Retrieved {len(requests_list)} time off requests")
                
                if requests_list:
                    print("   📋 Sample request structure:")
                    sample_request = requests_list[0]
                    for key, value in sample_request.items():
                        print(f"      {key}: {value}")
                
                return True, requests_list
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, []
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, []
    
    def test_create_time_off_request(self):
        """Test POST /api/time-off/request (as employee)"""
        print(f"\n➕ Testing POST /api/time-off/request (as employee)")
        
        request_data = {
            "start_date": "2024-12-01",
            "end_date": "2024-12-03",
            "reason": "Vacation",
            "notes": "Family vacation trip"
        }
        
        try:
            response = self.employee_session.post(f"{API_BASE}/time-off/request", json=request_data)
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Success: {result.get('message')}")
                print(f"   Request ID: {result.get('request_id')}")
                return True, result.get('request_id')
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, None
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, None
    
    def test_get_all_time_off_requests(self):
        """Test GET /api/time-off/requests/all (as manager)"""
        print(f"\n👥 Testing GET /api/time-off/requests/all (as manager)")
        
        try:
            response = self.manager_session.get(f"{API_BASE}/time-off/requests/all")
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                requests_list = result.get('requests', [])
                print(f"   ✅ Success: Retrieved {len(requests_list)} time off requests")
                
                if requests_list:
                    print("   📋 Sample request structure:")
                    sample_request = requests_list[0]
                    for key, value in sample_request.items():
                        print(f"      {key}: {value}")
                
                return True, requests_list
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, []
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, []
    
    def test_approve_time_off_request(self, request_id):
        """Test PUT /api/time-off/requests/{id}/approve (as manager)"""
        print(f"\n✅ Testing PUT /api/time-off/requests/{request_id}/approve (as manager)")
        
        approval_data = {
            "status": "approved",
            "notes": "Approved by manager - enjoy your vacation!"
        }
        
        try:
            response = self.manager_session.put(f"{API_BASE}/time-off/requests/{request_id}/approve", json=approval_data)
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
    
    # ============ SCHEDULING SYSTEM TESTS ============
    
    def test_get_team_schedules(self):
        """Test GET /api/schedules/team (as manager)"""
        print(f"\n📅 Testing GET /api/schedules/team (as manager)")
        
        try:
            response = self.manager_session.get(f"{API_BASE}/schedules/team")
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                schedules_list = result.get('schedules', [])
                print(f"   ✅ Success: Retrieved {len(schedules_list)} team schedules")
                
                if schedules_list:
                    print("   📋 Sample schedule structure:")
                    sample_schedule = schedules_list[0]
                    for key, value in sample_schedule.items():
                        print(f"      {key}: {value}")
                
                return True, schedules_list
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, []
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, []
    
    def test_assign_schedule(self):
        """Test POST /api/schedules/assign (as manager)"""
        print(f"\n📝 Testing POST /api/schedules/assign (as manager)")
        
        # First get john@company.com user ID
        users_response = self.manager_session.get(f"{API_BASE}/users")
        if users_response.status_code != 200:
            print(f"   ❌ Cannot get users list: {users_response.text}")
            return False
        
        users = users_response.json()
        john_user = next((user for user in users if user.get('email') == 'john@company.com'), None)
        
        if not john_user:
            print(f"   ❌ Cannot find john@company.com user")
            return False
        
        schedule_data = {
            "user_id": john_user.get('id'),
            "date": "2024-12-01",
            "shift_start": "09:00",
            "shift_end": "17:00",
            "break_duration": 30,
            "notes": "Regular shift assignment"
        }
        
        try:
            response = self.manager_session.post(f"{API_BASE}/schedules/assign", json=schedule_data)
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Success: {result.get('message')}")
                print(f"   Schedule ID: {result.get('schedule_id')}")
                print(f"   Assigned to: {john_user.get('name')} ({john_user.get('email')})")
                return True, result.get('schedule_id')
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, None
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, None
    
    # ============ REPORTS SYSTEM TESTS ============
    
    def test_get_team_reports(self):
        """Test GET /api/reports/team (as manager)"""
        print(f"\n📊 Testing GET /api/reports/team (as manager)")
        
        try:
            response = self.manager_session.get(f"{API_BASE}/reports/team")
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Success: Team report generated")
                print(f"   📋 Report data:")
                for key, value in result.items():
                    print(f"      {key}: {value}")
                
                return True, result
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, {}
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, {}
    
    def test_get_employee_time_summary(self):
        """Test GET /api/reports/employee/{employee_id}/time-summary (as manager)"""
        print(f"\n👤 Testing GET /api/reports/employee/{{employee_id}}/time-summary (as manager)")
        
        # First get john@company.com user ID
        users_response = self.manager_session.get(f"{API_BASE}/users")
        if users_response.status_code != 200:
            print(f"   ❌ Cannot get users list: {users_response.text}")
            return False
        
        users = users_response.json()
        john_user = next((user for user in users if user.get('email') == 'john@company.com'), None)
        
        if not john_user:
            print(f"   ❌ Cannot find john@company.com user")
            return False
        
        employee_id = john_user.get('id')
        
        try:
            response = self.manager_session.get(f"{API_BASE}/reports/employee/{employee_id}/time-summary")
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Success: Employee time summary generated")
                print(f"   📋 Summary data:")
                for key, value in result.items():
                    print(f"      {key}: {value}")
                
                return True, result
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, {}
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, {}
    
    def test_get_my_reports(self):
        """Test GET /api/time/my-reports (as employee)"""
        print(f"\n📈 Testing GET /api/time/my-reports (as employee)")
        
        try:
            response = self.employee_session.get(f"{API_BASE}/time/my-reports")
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Success: Personal reports generated")
                print(f"   📋 Report data:")
                for key, value in result.items():
                    if key != 'entries':  # Don't print all entries, just summary
                        print(f"      {key}: {value}")
                    else:
                        print(f"      entries: {len(value)} entries")
                
                return True, result
            else:
                print(f"   ❌ Failed: {response.text}")
                return False, {}
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, {}
    
    def run_comprehensive_new_endpoints_tests(self):
        """Run all newly implemented endpoint tests"""
        print("=" * 60)
        print("🆕 NEWLY IMPLEMENTED ENDPOINTS - BACKEND TESTING")
        print("=" * 60)
        
        # Setup authenticated sessions
        if not self.setup_sessions():
            print("❌ Cannot proceed without authentication")
            return False
        
        test_results = {
            # Time Off System
            "time_off_my_requests": False,
            "time_off_create_request": False,
            "time_off_all_requests": False,
            "time_off_approve_request": False,
            # Scheduling System
            "schedules_team": False,
            "schedules_assign": False,
            # Reports System
            "reports_team": False,
            "reports_employee_summary": False,
            "reports_my_reports": False
        }
        
        created_request_id = None
        
        # ============ TIME OFF SYSTEM TESTS ============
        print("\n" + "=" * 50)
        print("🏖️ TESTING TIME OFF SYSTEM (4 ENDPOINTS)")
        print("=" * 50)
        
        # Test 1: GET /api/time-off/my-requests (as employee)
        print("\n" + "-" * 40)
        print("TEST 1: Employee Get My Time Off Requests")
        print("-" * 40)
        
        success, requests_list = self.test_get_my_time_off_requests()
        test_results["time_off_my_requests"] = success
        
        # Test 2: POST /api/time-off/request (as employee)
        print("\n" + "-" * 40)
        print("TEST 2: Employee Create Time Off Request")
        print("-" * 40)
        
        success, request_id = self.test_create_time_off_request()
        test_results["time_off_create_request"] = success
        if success:
            created_request_id = request_id
        
        # Test 3: GET /api/time-off/requests/all (as manager)
        print("\n" + "-" * 40)
        print("TEST 3: Manager Get All Time Off Requests")
        print("-" * 40)
        
        success, all_requests = self.test_get_all_time_off_requests()
        test_results["time_off_all_requests"] = success
        
        # Test 4: PUT /api/time-off/requests/{id}/approve (as manager)
        print("\n" + "-" * 40)
        print("TEST 4: Manager Approve Time Off Request")
        print("-" * 40)
        
        if created_request_id:
            success = self.test_approve_time_off_request(created_request_id)
            test_results["time_off_approve_request"] = success
        else:
            print("   ⚠️  Skipping approval test - no request ID available")
        
        # ============ SCHEDULING SYSTEM TESTS ============
        print("\n" + "=" * 50)
        print("📅 TESTING SCHEDULING SYSTEM (2 ENDPOINTS)")
        print("=" * 50)
        
        # Test 5: GET /api/schedules/team (as manager)
        print("\n" + "-" * 40)
        print("TEST 5: Manager Get Team Schedules")
        print("-" * 40)
        
        success, schedules_list = self.test_get_team_schedules()
        test_results["schedules_team"] = success
        
        # Test 6: POST /api/schedules/assign (as manager)
        print("\n" + "-" * 40)
        print("TEST 6: Manager Assign Schedule")
        print("-" * 40)
        
        success, schedule_id = self.test_assign_schedule()
        test_results["schedules_assign"] = success
        
        # ============ REPORTS SYSTEM TESTS ============
        print("\n" + "=" * 50)
        print("📊 TESTING REPORTS SYSTEM (3 ENDPOINTS)")
        print("=" * 50)
        
        # Test 7: GET /api/reports/team (as manager)
        print("\n" + "-" * 40)
        print("TEST 7: Manager Get Team Reports")
        print("-" * 40)
        
        success, team_report = self.test_get_team_reports()
        test_results["reports_team"] = success
        
        # Test 8: GET /api/reports/employee/{employee_id}/time-summary (as manager)
        print("\n" + "-" * 40)
        print("TEST 8: Manager Get Employee Time Summary")
        print("-" * 40)
        
        success, employee_summary = self.test_get_employee_time_summary()
        test_results["reports_employee_summary"] = success
        
        # Test 9: GET /api/time/my-reports (as employee)
        print("\n" + "-" * 40)
        print("TEST 9: Employee Get Own Reports")
        print("-" * 40)
        
        success, my_reports = self.test_get_my_reports()
        test_results["reports_my_reports"] = success
        
        # ============ SUMMARY ============
        print("\n" + "=" * 60)
        print("📋 NEW ENDPOINTS TEST RESULTS SUMMARY")
        print("=" * 60)
        
        total_tests = 0
        passed_tests = 0
        
        # Time Off System Results
        print("\n🏖️ TIME OFF SYSTEM (4 endpoints):")
        time_off_tests = [
            ("GET /api/time-off/my-requests", test_results["time_off_my_requests"]),
            ("POST /api/time-off/request", test_results["time_off_create_request"]),
            ("GET /api/time-off/requests/all", test_results["time_off_all_requests"]),
            ("PUT /api/time-off/requests/{id}/approve", test_results["time_off_approve_request"])
        ]
        
        for test_name, result in time_off_tests:
            status = 'PASS' if result else 'FAIL'
            print(f"   {'✅' if result else '❌'} {test_name}: {status}")
            total_tests += 1
            if result:
                passed_tests += 1
        
        # Scheduling System Results
        print("\n📅 SCHEDULING SYSTEM (2 endpoints):")
        scheduling_tests = [
            ("GET /api/schedules/team", test_results["schedules_team"]),
            ("POST /api/schedules/assign", test_results["schedules_assign"])
        ]
        
        for test_name, result in scheduling_tests:
            status = 'PASS' if result else 'FAIL'
            print(f"   {'✅' if result else '❌'} {test_name}: {status}")
            total_tests += 1
            if result:
                passed_tests += 1
        
        # Reports System Results
        print("\n📊 REPORTS SYSTEM (3 endpoints):")
        reports_tests = [
            ("GET /api/reports/team", test_results["reports_team"]),
            ("GET /api/reports/employee/{id}/time-summary", test_results["reports_employee_summary"]),
            ("GET /api/time/my-reports", test_results["reports_my_reports"])
        ]
        
        for test_name, result in reports_tests:
            status = 'PASS' if result else 'FAIL'
            print(f"   {'✅' if result else '❌'} {test_name}: {status}")
            total_tests += 1
            if result:
                passed_tests += 1
        
        print(f"\n🎯 OVERALL RESULT: {passed_tests}/{total_tests} endpoints working")
        
        # Key workflow verification
        print("\n" + "=" * 60)
        print("🔄 KEY WORKFLOW VERIFICATION")
        print("=" * 60)
        
        workflows = []
        
        # Time off workflow
        time_off_workflow = (
            test_results["time_off_create_request"] and 
            test_results["time_off_all_requests"] and 
            test_results["time_off_approve_request"]
        )
        workflows.append(("Time Off Request → Approval Workflow", time_off_workflow))
        
        # Scheduling workflow
        scheduling_workflow = (
            test_results["schedules_team"] and 
            test_results["schedules_assign"]
        )
        workflows.append(("Team Scheduling Workflow", scheduling_workflow))
        
        # Reports workflow
        reports_workflow = (
            test_results["reports_team"] and 
            test_results["reports_employee_summary"] and 
            test_results["reports_my_reports"]
        )
        workflows.append(("Reports Generation Workflow", reports_workflow))
        
        for workflow_name, result in workflows:
            status = 'WORKING' if result else 'BROKEN'
            print(f"   {'✅' if result else '❌'} {workflow_name}: {status}")
        
        # Success criteria: All 9 endpoints should return 200 (not 404)
        all_endpoints_working = passed_tests == total_tests
        
        if all_endpoints_working:
            print("\n🎉 ALL 9 NEWLY IMPLEMENTED ENDPOINTS ARE WORKING!")
            print("   ✅ Time off request creation and approval workflow operational")
            print("   ✅ Scheduling assignment workflow operational")
            print("   ✅ Reports generation workflow operational")
            return True
        else:
            failed_count = total_tests - passed_tests
            print(f"\n⚠️  {failed_count} ENDPOINTS STILL NEED ATTENTION")
            
            # List failed endpoints
            failed_endpoints = []
            for category, tests in [
                ("Time Off", time_off_tests),
                ("Scheduling", scheduling_tests),
                ("Reports", reports_tests)
            ]:
                for test_name, result in tests:
                    if not result:
                        failed_endpoints.append(f"{category}: {test_name}")
            
            if failed_endpoints:
                print("   ❌ Failed endpoints:")
                for endpoint in failed_endpoints:
                    print(f"      - {endpoint}")
            
            return False

def main():
    """Main test execution"""
    tester = NewEndpointsTester()
    
    print(f"🌐 Backend URL: {API_BASE}")
    print(f"🕐 Test started at: {datetime.now()}")
    
    success = tester.run_comprehensive_new_endpoints_tests()
    
    print(f"\n🕐 Test completed at: {datetime.now()}")
    
    if success:
        print("✅ New Endpoints Backend Testing: SUCCESS")
        exit(0)
    else:
        print("❌ New Endpoints Backend Testing: FAILED")
        exit(1)

if __name__ == "__main__":
    main()
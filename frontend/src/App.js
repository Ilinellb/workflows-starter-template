import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Components
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Label } from './components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      toast.success('Login successful!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Tab Configuration - Employee Success Focused
const getTabsForRole = (role) => {
  if (role === 'employee') {
    return [
      { id: 'timecard', label: 'Time Card', icon: '🕒', category: 'time' },
      { id: 'timeoff', label: 'Time Off Requests', icon: '🏖️', category: 'time' },
      { id: 'schedule', label: 'My Schedule', icon: '📅', category: 'planning' },
      { id: 'reports', label: 'Reports', icon: '📊', category: 'reports' },
      { id: 'benefits', label: 'Benefits', icon: '🏥', category: 'personal' },
      { id: 'performance', label: 'Performance', icon: '🎯', category: 'growth' },
      { id: 'training', label: 'Training', icon: '📚', category: 'growth' },
      { id: 'communication', label: 'Messages', icon: '💬', category: 'communication' },
      { id: 'profile', label: 'Profile', icon: '👤', category: 'personal' }
    ];
  }

  if (role === 'manager' || role === 'super_admin') {
    return [
      { id: 'overview', label: 'Team Overview', icon: '📈', category: 'management' },
      { id: 'timecards', label: 'Team Time Cards', icon: '🕒', category: 'time' },
      { id: 'timeoff-approvals', label: 'Time Off Approvals', icon: '✅', category: 'approvals' },
      { id: 'scheduling', label: 'Scheduling', icon: '📅', category: 'planning' },
      { id: 'team-reports', label: 'Team Reports', icon: '📊', category: 'reports' },
      { id: 'employee-mgmt', label: 'Employee Management', icon: '👥', category: 'management' },
      { id: 'performance-mgmt', label: 'Performance Reviews', icon: '🎯', category: 'reviews' },
      { id: 'communication', label: 'Team Messages', icon: '💬', category: 'communication' },
      ...(role === 'super_admin' ? [
        { id: 'admin', label: 'System Admin', icon: '⚙️', category: 'admin' },
        { id: 'analytics', label: 'Analytics', icon: '📈', category: 'admin' }
      ] : []),
      { id: 'profile', label: 'Profile', icon: '👤', category: 'personal' }
    ];
  }

  return [
    { id: 'timecard', label: 'Time Card', icon: '🕒', category: 'time' }
  ];
};

// Login Component
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = React.useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(email, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="login-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Employee Time Tracker Pro</CardTitle>
          <CardDescription className="text-center">
            Sign in to track your work hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="password-input"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              data-testid="login-button"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Demo Accounts:</p>
            <p className="text-xs text-gray-500">Admin: admin@company.com / admin123</p>
            <p className="text-xs text-gray-500">Employee: john@company.com / password123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Dashboard Tab Components
const DashboardTab = ({ user }) => {
  if (user.role === 'employee') {
    return <EmployeeDashboardContent />;
  } else {
    return <ManagerDashboardContent />;
  }
};

const EmployeeDashboardContent = () => {
  const [timeStatus, setTimeStatus] = useState(null);

  useEffect(() => {
    fetchTimeStatus();
  }, []);

  const fetchTimeStatus = async () => {
    try {
      const response = await axios.get(`${API}/time/status`);
      setTimeStatus(response.data);
    } catch (error) {
      toast.error('Failed to fetch time status');
    }
  };

  if (!timeStatus) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="employee-dashboard-tab">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Dashboard</h2>
        <Badge variant={timeStatus.status === 'working' ? 'default' : 'secondary'}>
          {timeStatus.status === 'working' ? 'Currently Working' : 'Not Working'}
        </Badge>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              timeStatus.status === 'working' ? 'bg-green-500' : 
              timeStatus.status === 'complete' ? 'bg-blue-500' : 'bg-gray-400'
            }`}></div>
            Today's Status
          </CardTitle>
          <CardDescription>{timeStatus.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Punch In</p>
              <p className="font-semibold" data-testid="dashboard-punch-in">
                {timeStatus.punch_in_time ? new Date(timeStatus.punch_in_time).toLocaleTimeString() : 'Not punched in'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Hours</p>
              <p className="font-semibold text-blue-600" data-testid="dashboard-total-hours">
                {timeStatus.total_hours || 0}h
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ManagerDashboardContent = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [employeesRes, entriesRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/time/entries`)
      ]);

      const employees = employeesRes.data.filter(u => u.role === 'employee');
      const entries = entriesRes.data;
      const today = new Date().toISOString().split('T')[0];
      
      const todayEntries = entries.filter(entry => entry.date === today);
      const activeToday = todayEntries.filter(entry => entry.punch_in_time).length;
      const completedToday = todayEntries.filter(entry => entry.status === 'complete').length;

      setStats({
        totalEmployees: employees.length,
        activeToday,
        completedToday,
        totalEntries: entries.length
      });
    } catch (error) {
      toast.error('Failed to fetch stats');
    }
  };

  if (!stats) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="manager-dashboard-tab">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Team Overview</h2>
        <Badge variant="secondary">Manager</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="dashboard-total-employees">{stats.totalEmployees}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="dashboard-active-today">{stats.activeToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="dashboard-completed-today">{stats.completedToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.totalEntries}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Time Tracking Tab
const TimeTrackingTab = () => {
  const [timeStatus, setTimeStatus] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTimeStatus();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Location error:', error);
          toast.error('Please enable location access for geofencing');
        }
      );
    }
  };

  const fetchTimeStatus = async () => {
    try {
      const response = await axios.get(`${API}/time/status`);
      setTimeStatus(response.data);
    } catch (error) {
      toast.error('Failed to fetch time status');
    }
  };

  const handlePunch = async (action) => {
    if (!location) {
      toast.error('Location required for punch in/out');
      getCurrentLocation();
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/time/punch`, {
        action,
        location
      });
      toast.success(response.data.message);
      fetchTimeStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Punch failed');
    } finally {
      setLoading(false);
    }
  };

  if (!timeStatus) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="timetracking-tab">
      <h2 className="text-2xl font-bold">Time Tracking</h2>

      <Card className="bg-gradient-to-r from-green-50 to-blue-50">
        <CardHeader>
          <CardTitle>Punch In/Out</CardTitle>
          <CardDescription>{timeStatus.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Punch In Time</p>
              <p className="font-semibold" data-testid="punch-in-time">
                {timeStatus.punch_in_time ? new Date(timeStatus.punch_in_time).toLocaleTimeString() : 'Not punched in'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Punch Out Time</p>
              <p className="font-semibold" data-testid="punch-out-time">
                {timeStatus.punch_out_time ? new Date(timeStatus.punch_out_time).toLocaleTimeString() : 'Not punched out'}
              </p>
            </div>
          </div>
          
          {timeStatus.total_hours && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">Total Hours Today</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="total-hours">
                {timeStatus.total_hours}h
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => handlePunch('punch_in')}
              disabled={loading || !timeStatus.can_punch_in}
              className="flex-1"
              data-testid="punch-in-button"
            >
              {loading ? 'Processing...' : 'Punch In'}
            </Button>
            <Button
              onClick={() => handlePunch('punch_out')}
              disabled={loading || !timeStatus.can_punch_out}
              variant="outline"
              className="flex-1"
              data-testid="punch-out-button"
            >
              {loading ? 'Processing...' : 'Punch Out'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Location Status</CardTitle>
        </CardHeader>
        <CardContent>
          {location ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Location enabled for geofencing</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-sm">Location required for geofencing</span>
              <Button size="sm" onClick={getCurrentLocation}>
                Enable Location
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Team Management Tab
const TeamManagementTab = () => {
  const [employees, setEmployees] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [showAddEmployee, setShowAddEmployee] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchTimeEntries();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setEmployees(response.data.filter(u => u.role === 'employee'));
    } catch (error) {
      toast.error('Failed to fetch employees');
    }
  };

  const fetchTimeEntries = async () => {
    try {
      const response = await axios.get(`${API}/time/entries`);
      setTimeEntries(response.data.slice(0, 20));
    } catch (error) {
      toast.error('Failed to fetch time entries');
    }
  };

  const exportTimesheet = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 14);
      const endDate = new Date();
      
      const response = await axios.get(`${API}/export/timesheet`, {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      });
      
      toast.success('Timesheet exported successfully!');
    } catch (error) {
      toast.error('Failed to export timesheet');
    }
  };

  return (
    <div className="space-y-6" data-testid="team-tab">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Team Management</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddEmployee(true)} data-testid="add-employee-button">
            Add Employee
          </Button>
          <Button variant="outline" onClick={exportTimesheet} data-testid="export-button">
            Export Timesheet
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employees ({employees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {employees.map((employee) => (
              <div key={employee.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{employee.name}</p>
                  <p className="text-sm text-gray-600">{employee.email}</p>
                </div>
                <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                  {employee.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AddEmployeeModal 
        isOpen={showAddEmployee} 
        onClose={() => setShowAddEmployee(false)}
        onSuccess={() => {
          setShowAddEmployee(false);
          fetchEmployees();
        }}
      />
    </div>
  );
};

// Other Tab Components (Placeholder)
const ReportsTab = () => (
  <div data-testid="reports-tab">
    <h2 className="text-2xl font-bold mb-4">Reports & Analytics</h2>
    <Card>
      <CardContent className="p-6">
        <p className="text-gray-600">Reports dashboard coming soon...</p>
      </CardContent>
    </Card>
  </div>
);

const NotificationsTab = () => (
  <div data-testid="notifications-tab">
    <h2 className="text-2xl font-bold mb-4">Notifications</h2>
    <Card>
      <CardContent className="p-6">
        <p className="text-gray-600">Notification center coming soon...</p>
      </CardContent>
    </Card>
  </div>
);

const AdminTab = () => (
  <div data-testid="admin-tab">
    <h2 className="text-2xl font-bold mb-4">Admin Settings</h2>
    <Card>
      <CardContent className="p-6">
        <p className="text-gray-600">Admin panel coming soon...</p>
      </CardContent>
    </Card>
  </div>
);

const ProfileTab = ({ user }) => (
  <div data-testid="profile-tab">
    <h2 className="text-2xl font-bold mb-4">Profile Settings</h2>
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <p className="font-medium">{user.name}</p>
          </div>
          <div>
            <Label>Email</Label>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <Label>Role</Label>
            <Badge>{user.role.replace('_', ' ')}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

// Add Employee Modal (keeping existing component)
const AddEmployeeModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    start_time: '09:00',
    workplace_lat: '',
    workplace_lng: '',
    geofence_radius: 100
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/users`, {
        ...formData,
        role: 'employee',
        workplace_lat: formData.workplace_lat ? parseFloat(formData.workplace_lat) : null,
        workplace_lng: formData.workplace_lng ? parseFloat(formData.workplace_lng) : null,
        geofence_radius: parseInt(formData.geofence_radius)
      });

      toast.success('Employee added successfully!');
      onSuccess();
      setFormData({
        name: '',
        email: '',
        password: '',
        start_time: '09:00',
        workplace_lat: '',
        workplace_lng: '',
        geofence_radius: 100
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add employee');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Create a new employee account with time tracking settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                data-testid="employee-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                data-testid="employee-email-input"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
                data-testid="employee-password-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => handleChange('start_time', e.target.value)}
                data-testid="employee-start-time-input"
              />
            </div>
          </div>

          <Separator />
          
          <div className="space-y-2">
            <Label>Geofencing (Optional)</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Latitude"
                value={formData.workplace_lat}
                onChange={(e) => handleChange('workplace_lat', e.target.value)}
                data-testid="employee-lat-input"
              />
              <Input
                placeholder="Longitude"
                value={formData.workplace_lng}
                onChange={(e) => handleChange('workplace_lng', e.target.value)}
                data-testid="employee-lng-input"
              />
              <Input
                placeholder="Radius (m)"
                type="number"
                value={formData.geofence_radius}
                onChange={(e) => handleChange('geofence_radius', e.target.value)}
                data-testid="employee-radius-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} data-testid="create-employee-button">
              {loading ? 'Creating...' : 'Create Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Main App Content with Tabbed Interface
const AppContent = () => {
  const { user, logout, loading } = React.useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const tabs = getTabsForRole(user.role);

  const renderTabContent = () => {
    switch (activeTab) {
      // Employee Tabs
      case 'timecard':
        return <TimeCardTab />;
      case 'timeoff':
        return <TimeOffRequestsTab />;
      case 'schedule':
        return <MyScheduleTab />;
      case 'reports':
        return user.role === 'employee' ? <MyReportsTab /> : <TeamReportsTab />;
      case 'benefits':
        return <BenefitsTab />;
      case 'performance':
        return <PerformanceTab />;
      case 'training':
        return <TrainingTab />;
      case 'communication':
        return <CommunicationTab />;
      
      // Manager Tabs  
      case 'overview':
        return <TeamOverviewTab />;
      case 'timecards':
        return <TeamTimeCardsTab />;
      case 'timeoff-approvals':
        return <TimeOffApprovalsTab />;
      case 'scheduling':
        return <TeamSchedulingTab />;
      case 'team-reports':
        return <TeamReportsTab />;
      case 'employee-mgmt':
        return <EmployeeManagementTab />;
      case 'performance-mgmt':
        return <PerformanceManagementTab />;
      
      // Admin Tabs
      case 'admin':
        return <SystemAdminTab />;
      case 'analytics':
        return <AnalyticsTab />;
      
      // Common Tabs
      case 'profile':
        return <ProfileTab user={user} />;
      
      default:
        return user.role === 'employee' ? <TimeCardTab /> : <TeamOverviewTab />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with Navigation Tabs */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900 mr-8" data-testid="app-title">
                Time Tracker Pro
              </h1>
              
              {/* Desktop Tabs */}
              <div className="hidden md:flex space-x-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                    data-testid={`tab-${tab.id}`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
              
              {/* Mobile Menu Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden ml-4"
                data-testid="mobile-menu-button"
              >
                ☰
              </Button>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700" data-testid="user-info">
                <span className="font-medium">{user.name}</span>
                <Badge variant="secondary" className="ml-2">
                  {user.role.replace('_', ' ')}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={logout} data-testid="logout-button">
                Logout
              </Button>
            </div>
          </div>
          
          {/* Mobile Tabs */}
          {isMobileMenuOpen && (
            <div className="md:hidden pb-4">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
                    }`}
                    data-testid={`mobile-tab-${tab.id}`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Tab Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="fade-in">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
};

// Main App
const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <AppContent />
          <ToastContainer 
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
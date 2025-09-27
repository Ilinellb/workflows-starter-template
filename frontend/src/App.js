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

// PWA Install Hook
const usePWAInstall = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
      toast.success('🎉 Time Tracker Pro installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    const result = await installPrompt.prompt();
    console.log('Install result:', result.outcome);
    
    setInstallPrompt(null);
    setIsInstallable(false);
  };

  return {
    isInstallable,
    isInstalled,
    handleInstall
  };
};

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

// ============ EMPLOYEE SUCCESS FOCUSED TAB COMPONENTS ============

// Time Card Tab - Primary employee interface with offline support
const TimeCardTab = () => {
  const [timeStatus, setTimeStatus] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentEntries, setRecentEntries] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    fetchTimeStatus();
    fetchRecentEntries();
    getCurrentLocation();

    // Listen for online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('🌐 Back online! Syncing data...');
      fetchTimeStatus();
      fetchRecentEntries();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('📵 You\'re offline. Actions will sync when reconnected.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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
      if (!isOnline) {
        // Try to get cached status from localStorage
        const cachedStatus = localStorage.getItem('timeStatus');
        if (cachedStatus) {
          setTimeStatus(JSON.parse(cachedStatus));
        }
      } else {
        toast.error('Failed to fetch time status');
      }
    }
  };

  const fetchRecentEntries = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
      const response = await axios.get(`${API}/time/entries`, {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      });
      
      setRecentEntries(response.data.slice(0, 5));
      // Cache entries for offline use
      localStorage.setItem('recentEntries', JSON.stringify(response.data.slice(0, 5)));
    } catch (error) {
      if (!isOnline) {
        const cachedEntries = localStorage.getItem('recentEntries');
        if (cachedEntries) {
          setRecentEntries(JSON.parse(cachedEntries));
        }
      } else {
        console.error('Failed to fetch recent entries');
      }
    }
  };

  const handlePunch = async (action) => {
    if (!location) {
      toast.error('Location required for punch in/out');
      getCurrentLocation();
      return;
    }

    setLoading(true);

    // Optimistic update for offline
    if (!isOnline) {
      // Store offline punch for later sync
      const offlinePunch = {
        id: Date.now(),
        action,
        location,
        timestamp: new Date().toISOString(),
        synced: false
      };

      const offlinePunches = JSON.parse(localStorage.getItem('offlinePunches') || '[]');
      offlinePunches.push(offlinePunch);
      localStorage.setItem('offlinePunches', JSON.stringify(offlinePunches));

      // Update UI optimistically
      const newStatus = { ...timeStatus };
      if (action === 'punch_in') {
        newStatus.punch_in_time = new Date().toISOString();
        newStatus.status = 'working';
        newStatus.can_punch_in = false;
        newStatus.can_punch_out = true;
        newStatus.message = 'Currently working (offline)';
      } else {
        newStatus.punch_out_time = new Date().toISOString();
        newStatus.status = 'complete';
        newStatus.can_punch_out = false;
        newStatus.message = 'Day complete (offline)';
      }

      setTimeStatus(newStatus);
      localStorage.setItem('timeStatus', JSON.stringify(newStatus));
      toast.success(`${action.replace('_', ' ')} recorded offline! Will sync when online.`);
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API}/time/punch`, {
        action,
        location
      });
      toast.success(response.data.message);
      fetchTimeStatus();
      fetchRecentEntries();

      // Clear any cached offline status since we got fresh data
      localStorage.removeItem('timeStatus');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Punch failed');
    } finally {
      setLoading(false);
    }
  };

  if (!timeStatus) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading time card...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="timecard-tab">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Time Card</h2>
        <div className="flex items-center gap-2">
          {/* Online/Offline Indicator */}
          <Badge 
            variant={isOnline ? 'default' : 'secondary'}
            className={`${isOnline ? 'bg-green-500' : 'bg-gray-500'} text-white`}
          >
            {isOnline ? '🌐 Online' : '📵 Offline'}
          </Badge>
          
          <Badge 
            variant={timeStatus.status === 'working' ? 'default' : 'secondary'}
            className={timeStatus.status === 'working' ? 'bg-green-500' : ''}
          >
            {timeStatus.status === 'working' ? '🟢 Currently Working' : '🔴 Not Working'}
          </Badge>
        </div>
      </div>

      {/* Current Status Card */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">⏰</span>
            Today's Time Card
          </CardTitle>
          <CardDescription className="text-lg">{timeStatus.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 font-medium">Punch In Time</p>
              <p className="text-xl font-bold text-green-600" data-testid="punch-in-time">
                {timeStatus.punch_in_time ? new Date(timeStatus.punch_in_time).toLocaleTimeString() : 'Not punched in'}
              </p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 font-medium">Punch Out Time</p>
              <p className="text-xl font-bold text-blue-600" data-testid="punch-out-time">
                {timeStatus.punch_out_time ? new Date(timeStatus.punch_out_time).toLocaleTimeString() : 'Working...'}
              </p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 font-medium">Hours Today</p>
              <p className="text-2xl font-bold text-purple-600" data-testid="total-hours">
                {timeStatus.total_hours || 0}h
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => handlePunch('punch_in')}
              disabled={loading || !timeStatus.can_punch_in}
              className="flex-1 h-14 text-lg"
              data-testid="punch-in-button"
            >
              {loading ? 'Processing...' : '🕐 Punch In'}
            </Button>
            <Button
              onClick={() => handlePunch('punch_out')}
              disabled={loading || !timeStatus.can_punch_out}
              variant="outline"
              className="flex-1 h-14 text-lg border-2"
              data-testid="punch-out-button"
            >
              {loading ? 'Processing...' : '🕐 Punch Out'}
            </Button>
          </div>

          {!isOnline && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700 font-medium">
                ⚠️ You're working offline. Time entries will sync automatically when reconnected.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location & Recent Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Location Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📍 Location Status</CardTitle>
          </CardHeader>
          <CardContent>
            {location ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-green-700">Location Enabled - Ready for geofencing</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="font-medium text-red-700">Location required for punch in/out</span>
                </div>
                <Button size="sm" onClick={getCurrentLocation} className="w-full">
                  📍 Enable Location Access
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Time Entries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📅 Recent Time Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEntries.length > 0 ? (
              <div className="space-y-2">
                {recentEntries.map((entry, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded border">
                    <div>
                      <p className="font-medium text-sm">{entry.date}</p>
                      <p className="text-xs text-gray-600">
                        {entry.punch_in_time && new Date(entry.punch_in_time).toLocaleTimeString()} - 
                        {entry.punch_out_time ? new Date(entry.punch_out_time).toLocaleTimeString() : ' Working'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={entry.status === 'complete' ? 'default' : 'secondary'} className="text-xs">
                        {entry.total_hours ? `${entry.total_hours}h` : entry.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent entries</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Time Off Requests Tab
const TimeOffRequestsTab = () => {
  const [requests, setRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);

  return (
    <div className="space-y-6" data-testid="timeoff-tab">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">🏖️ Time Off Requests</h2>
        <Button onClick={() => setShowRequestForm(true)}>
          ➕ New Request
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Time Off Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">15</p>
              <p className="text-sm text-gray-600">Vacation Days</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">8</p>
              <p className="text-sm text-gray-600">Sick Days</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">3</p>
              <p className="text-sm text-gray-600">Personal Days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">No time off requests yet. Create your first request above!</p>
        </CardContent>
      </Card>
    </div>
  );
};

// My Schedule Tab
const MyScheduleTab = () => (
  <div className="space-y-6" data-testid="schedule-tab">
    <h2 className="text-2xl font-bold">📅 My Schedule</h2>
    <Card>
      <CardContent className="p-6">
        <p className="text-gray-600 text-center">Schedule management coming soon...</p>
      </CardContent>
    </Card>
  </div>
);

// My Reports Tab  
const MyReportsTab = () => (
  <div className="space-y-6" data-testid="my-reports-tab">
    <h2 className="text-2xl font-bold">📊 My Reports</h2>
    <Card>
      <CardContent className="p-6">
        <p className="text-gray-600 text-center">Personal reports and timesheets coming soon...</p>
      </CardContent>
    </Card>
  </div>
);

// Benefits Tab
const BenefitsTab = () => (
  <div className="space-y-6" data-testid="benefits-tab">
    <h2 className="text-2xl font-bold">🏥 Benefits</h2>
    <Card>
      <CardContent className="p-6">
        <p className="text-gray-600 text-center">Benefits information coming soon...</p>
      </CardContent>
    </Card>
  </div>
);

// Performance Tab
const PerformanceTab = () => (
  <div className="space-y-6" data-testid="performance-tab">
    <h2 className="text-2xl font-bold">🎯 Performance</h2>
    <Card>
      <CardContent className="p-6">
        <p className="text-gray-600 text-center">Performance tracking coming soon...</p>
      </CardContent>
    </Card>
  </div>
);

// Training Tab
const TrainingTab = () => (
  <div className="space-y-6" data-testid="training-tab">
    <h2 className="text-2xl font-bold">📚 Training</h2>
    <Card>
      <CardContent className="p-6">
        <p className="text-gray-600 text-center">Training modules coming soon...</p>
      </CardContent>
    </Card>
  </div>
);

// Communication Tab
const CommunicationTab = () => (
  <div className="space-y-6" data-testid="communication-tab">
    <h2 className="text-2xl font-bold">💬 Messages</h2>
    <Card>
      <CardContent className="p-6">
        <p className="text-gray-600 text-center">Team communication coming soon...</p>
      </CardContent>
    </Card>
  </div>
);

// ============ MANAGER TAB COMPONENTS ============

// Team Overview Tab
const TeamOverviewTab = () => {
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
    <div className="space-y-6" data-testid="team-overview-tab">
      <h2 className="text-2xl font-bold">📈 Team Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.completedToday}</div>
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

// Team Time Cards Tab
const TeamTimeCardsTab = () => {
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

  return (
    <div className="space-y-6" data-testid="team-timecards-tab">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">🕒 Team Time Cards</h2>
        <Button onClick={() => setShowAddEmployee(true)} data-testid="add-employee-button">
          ➕ Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Employees ({employees.length})</CardTitle>
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

// Other Manager Tab Placeholders
const TimeOffApprovalsTab = () => (
  <div className="space-y-6" data-testid="timeoff-approvals-tab">
    <h2 className="text-2xl font-bold">✅ Time Off Approvals</h2>
    <Card><CardContent className="p-6"><p className="text-gray-600 text-center">Time off approval system coming soon...</p></CardContent></Card>
  </div>
);

const TeamSchedulingTab = () => (
  <div className="space-y-6" data-testid="team-scheduling-tab">
    <h2 className="text-2xl font-bold">📅 Team Scheduling</h2>
    <Card><CardContent className="p-6"><p className="text-gray-600 text-center">Team scheduling coming soon...</p></CardContent></Card>
  </div>
);

const TeamReportsTab = () => (
  <div className="space-y-6" data-testid="team-reports-tab">
    <h2 className="text-2xl font-bold">📊 Team Reports</h2>
    <Card><CardContent className="p-6"><p className="text-gray-600 text-center">Team reports coming soon...</p></CardContent></Card>
  </div>
);

const EmployeeManagementTab = () => (
  <div className="space-y-6" data-testid="employee-management-tab">
    <h2 className="text-2xl font-bold">👥 Employee Management</h2>
    <Card><CardContent className="p-6"><p className="text-gray-600 text-center">Employee management coming soon...</p></CardContent></Card>
  </div>
);

const PerformanceManagementTab = () => (
  <div className="space-y-6" data-testid="performance-management-tab">
    <h2 className="text-2xl font-bold">🎯 Performance Management</h2>
    <Card><CardContent className="p-6"><p className="text-gray-600 text-center">Performance management coming soon...</p></CardContent></Card>
  </div>
);

const SystemAdminTab = () => (
  <div className="space-y-6" data-testid="system-admin-tab">
    <h2 className="text-2xl font-bold">⚙️ System Administration</h2>
    <Card><CardContent className="p-6"><p className="text-gray-600 text-center">System admin panel coming soon...</p></CardContent></Card>
  </div>
);

const AnalyticsTab = () => (
  <div className="space-y-6" data-testid="analytics-tab">
    <h2 className="text-2xl font-bold">📈 Analytics</h2>
    <Card><CardContent className="p-6"><p className="text-gray-600 text-center">Advanced analytics coming soon...</p></CardContent></Card>
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

// Main App Content with Tabbed Interface and PWA
const AppContent = () => {
  const { user, logout, loading } = React.useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('timecard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isInstallable, isInstalled, handleInstall } = usePWAInstall();

  // Set default tab based on role
  useEffect(() => {
    if (user) {
      const defaultTab = user.role === 'employee' ? 'timecard' : 'overview';
      setActiveTab(defaultTab);
    }
  }, [user]);

  // Hide loading screen when app loads
  useEffect(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
  }, []);

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
              {/* PWA Install Button */}
              {isInstallable && !isInstalled && (
                <Button 
                  onClick={handleInstall} 
                  size="sm" 
                  variant="outline"
                  className="hidden sm:flex items-center gap-2"
                  data-testid="install-app-button"
                >
                  📱 Install App
                </Button>
              )}
              
              {/* App Status Indicator */}
              {isInstalled && (
                <Badge variant="secondary" className="hidden sm:flex items-center gap-1">
                  ✅ Installed
                </Badge>
              )}
              
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
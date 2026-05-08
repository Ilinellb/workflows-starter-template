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
import { Calendar } from './components/ui/calendar';
import {
  Clock,
  LayoutGrid,
  Calendar as CalendarIcon,
  Users,
  Timer,
  BarChart3,
  CalendarDays,
  LineChart,
  UserCog,
  Settings2,
  User as UserIcon,
  LogIn,
  LogOut,
  Menu,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';

// Maps tab.icon string → Lucide icon component used by the top tab nav.
const TAB_ICON_MAP = {
  Clock,
  LayoutGrid,
  Calendar: CalendarIcon,
  Users,
  Timer,
  BarChart3,
  CalendarDays,
  LineChart,
  UserCog,
  Settings2,
  User: UserIcon,
};

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
      toast.success('RSBC Workflow Pro installed successfully!');
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

  // Refetch user whenever the tab regains focus / becomes visible.
  // Prevents stale-role "ghost attendant" bug if the role was changed server-side
  // while the tab was open.
  useEffect(() => {
    const refetchIfAuthed = () => {
      if (localStorage.getItem('token')) {
        fetchUser({ silent: true });
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetchIfAuthed();
    };
    window.addEventListener('focus', refetchIfAuthed);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refetchIfAuthed);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const fetchUser = async ({ silent = false } = {}) => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser((prev) => {
        if (prev && prev.role && response.data.role && prev.role !== response.data.role) {
          toast.info(`Your role was updated to ${response.data.role.replace('_', ' ')}.`);
        }
        return response.data;
      });
    } catch (error) {
      if (!silent) logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token } = response.data;

      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setToken(access_token);
      // Always re-derive user from /auth/me to avoid trusting a potentially
      // stale login payload (defense in depth).
      await fetchUser();

      toast.success('Login successful!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user'); // Clear any cached user data
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

// Tab Configuration - Role-Based Access
const getTabsForRole = (role) => {
  // Base tabs for all users
  const baseTabs = [
    { id: 'timecard', label: 'Time Clock', icon: 'Clock', category: 'time' },
    { id: 'rooms', label: 'Room Management', icon: 'LayoutGrid', category: 'operations' },
    { id: 'schedule', label: 'My Schedule', icon: 'Calendar', category: 'planning' }
  ];

  // Profile tab - for all users
  const profileTabs = [
    { id: 'profile', label: 'Profile', icon: 'User', category: 'personal' }
  ];

  // For Attendants and Assistant Managers - only basic tabs
  if (role === 'attendant' || role === 'assistant_manager') {
    return [...baseTabs, ...profileTabs];
  }

  // For OPS Manager - ALL management tabs
  if (role === 'ops_manager') {
    const managerTabs = [
      { id: 'overview', label: 'Team Overview', icon: 'Users', category: 'management' },
      { id: 'timecards', label: 'Team Time Cards', icon: 'Timer', category: 'time' },
      { id: 'room-mgmt', label: 'Room Reports', icon: 'BarChart3', category: 'operations' },
      { id: 'scheduling', label: 'Team Scheduling', icon: 'CalendarDays', category: 'planning' },
      { id: 'team-reports', label: 'Team Reports', icon: 'LineChart', category: 'reports' },
      { id: 'employee-mgmt', label: 'Employee Management', icon: 'UserCog', category: 'management' }
    ];

    const adminTabs = [
      { id: 'admin', label: 'System Admin', icon: 'Settings2', category: 'admin' }
    ];

    // OPS Manager sees: base tabs + manager tabs + admin tabs + profile
    return [...baseTabs, ...managerTabs, ...adminTabs, ...profileTabs];
  }

  // Default fallback
  return [...baseTabs, ...profileTabs];
};

// Login Component
const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = React.useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (isLogin) {
      await login(email, password);
    } else {
      await handleRegister();
    }
    
    setLoading(false);
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    try {
      const response = await axios.post(`${API}/auth/register`, {
        email,
        name,
        password,
        confirm_password: confirmPassword
      });

      toast.success(`Welcome to RSBC Workflow Pro, ${response.data.user.name}! Your account has been created successfully.`);
      
      // Auto-login after successful registration
      localStorage.setItem('token', response.data.access_token);
      // Don't cache user data in localStorage - always fetch fresh from API
      
      // Small delay to show success message before redirect
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  return (
    <div className="min-h-screen flex bg-zinc-50">
      {/* Left: Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm" data-testid="login-card">
          <div className="mb-10">
            <div className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-2">
              RSBC Workflow Pro
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground mb-2">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLogin ? 'Sign in to track your work hours.' : 'Get started in under a minute.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="name-input"
                  className="h-10"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="email-input"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={isLogin ? "Enter your password" : "At least 6 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="password-input"
                className="h-10"
              />
            </div>
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="confirm-password-input"
                  className="h-10"
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-10 mt-2"
              disabled={loading}
              data-testid={isLogin ? "login-button" : "register-button"}
            >
              {loading ? (isLogin ? 'Signing in…' : 'Creating account…') : (isLogin ? 'Sign in' : 'Create account')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>

          {!isLogin && (
            <div className="mt-6 text-xs text-muted-foreground leading-relaxed border-t border-border pt-4">
              <p className="font-medium text-foreground mb-1">Registration info</p>
              <p>New accounts are assigned the employee role with immediate access to time tracking and scheduling. Allowed email domains: <span className="font-mono text-[11px]">@company.com</span>, <span className="font-mono text-[11px]">@gmail.com</span>, <span className="font-mono text-[11px]">@outlook.com</span>, <span className="font-mono text-[11px]">@yahoo.com</span>.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Visual panel (hidden on mobile) */}
      <div className="hidden lg:block flex-1 relative bg-zinc-950">
        <img
          src="https://images.unsplash.com/photo-1758448755981-954afbf60ff7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjBtaW5pbWFsJTIwaG90ZWwlMjBsb2JieSUyMGFyY2hpdGVjdHVyZSUyMGFyY2hpdGVjdHVyZXxlbnwwfHx8fDE3Nzc0MzUxNzN8MA&ixlib=rb-4.1.0&q=85"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950/60 via-zinc-950/20 to-transparent" />
        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-80 mb-3">Operations, on shift.</p>
          <p className="font-heading text-2xl font-medium leading-snug max-w-md">
            Run rooms, track time, and keep the team on the same page — without the friction.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============ EMPLOYEE SUCCESS FOCUSED TAB COMPONENTS ============

// Time Card Tab - Primary employee interface with offline support
const TimeCardTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [timeStatus, setTimeStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentEntries, setRecentEntries] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    fetchTimeStatus();
    fetchRecentEntries();

    // Listen for online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Syncing data...');
      fetchTimeStatus();
      fetchRecentEntries();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You\'re offline. Actions will sync when reconnected.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchTimeStatus = async () => {
    try {
      const response = await axios.get(`${API}/time/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
        },
        headers: { Authorization: `Bearer ${token}` }
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
    setLoading(true);

    // Optimistic update for offline
    if (!isOnline) {
      // Store offline punch for later sync
      const offlinePunch = {
        id: Date.now(),
        action,
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
        action
      }, {
        headers: { Authorization: `Bearer ${token}` }
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
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Time Clock</h2>
        <div className="flex items-center gap-2">
          {/* Online/Offline Indicator */}
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className={`status-dot ${isOnline ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <span className="text-zinc-300">·</span>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className={`status-dot ${timeStatus.status === 'working' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
            <span>{timeStatus.status === 'working' ? 'Currently working' : 'Not working'}</span>
          </div>
        </div>
      </div>

      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg font-semibold">Today</CardTitle>
          <CardDescription>{timeStatus.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="p-4 bg-zinc-50 rounded-md border border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Punch In</p>
              <p className="font-heading text-2xl font-semibold tabular-nums" data-testid="punch-in-time">
                {timeStatus.punch_in_time ? new Date(timeStatus.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
            <div className="p-4 bg-zinc-50 rounded-md border border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Punch Out</p>
              <p className="font-heading text-2xl font-semibold tabular-nums" data-testid="punch-out-time">
                {timeStatus.punch_out_time ? new Date(timeStatus.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
            <div className="p-4 bg-zinc-50 rounded-md border border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Hours Today</p>
              <p className="font-heading text-2xl font-semibold tabular-nums" data-testid="total-hours">
                {timeStatus.total_hours || 0}h
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => handlePunch('punch_in')}
              disabled={loading || !timeStatus.can_punch_in}
              className="flex-1 h-12 text-base gap-2"
              data-testid="punch-in-button"
            >
              <LogIn className="h-4 w-4" />
              {loading ? 'Processing…' : 'Punch In'}
            </Button>
            <Button
              onClick={() => handlePunch('punch_out')}
              disabled={loading || !timeStatus.can_punch_out}
              variant="outline"
              className="flex-1 h-12 text-base gap-2"
              data-testid="punch-out-button"
            >
              <LogOut className="h-4 w-4" />
              {loading ? 'Processing…' : 'Punch Out'}
            </Button>
          </div>

          {!isOnline && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-xs text-amber-800">
                You're working offline. Time entries will sync automatically when reconnected.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Recent entries</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEntries.length > 0 ? (
            <div className="divide-y divide-border -mx-6">
              {recentEntries.map((entry, index) => (
                <div key={entry.id ?? `${entry.date}-${index}`} className="flex justify-between items-center px-6 py-3">
                  <div>
                    <p className="font-medium text-sm tabular-nums">{entry.date}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {entry.punch_in_time && new Date(entry.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' — '}
                      {entry.punch_out_time ? new Date(entry.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Working'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={entry.status === 'complete' ? 'default' : 'secondary'} className="text-xs font-normal tabular-nums">
                      {entry.total_hours ? `${entry.total_hours}h` : entry.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">No recent entries.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ============ ROOM MANAGEMENT SYSTEM WITH TIMING ============

// Room Management Tab - Attendant workload management with customer timing
const RoomManagementTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [rooms, setRooms] = useState([]);
  const [showLaundryReminder, setShowLaundryReminder] = useState(false);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(false);

  // Room statuses with colors
  const roomStatuses = {
    'open_clean': { label: 'Open & Clean', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-l-emerald-500', dotColor: 'bg-emerald-500' },
    'occupied': { label: 'Occupied', color: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-l-amber-500', dotColor: 'bg-amber-500' },
    'occupied_out': { label: 'Guest Out', color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-l-orange-500', dotColor: 'bg-orange-500' },
    'needs_cleaning': { label: 'Needs Cleaning', color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-l-red-500', dotColor: 'bg-red-500' }
  };

  // Duration options for occupied rooms
  const durationOptions = [
    { value: 8, label: '8 Hours' },
    { value: 12, label: '12 Hours' },
    { value: 16, label: '16 Hours' }
  ];

  // Generate room list (1-41 excluding 8,9,13,16,25,26 plus A,B,C)
  const generateRooms = () => {
    const numberedRooms = [];
    const excludedRooms = [8, 9, 13, 16, 25, 26];
    
    for (let i = 1; i <= 41; i++) {
      if (!excludedRooms.includes(i)) {
        numberedRooms.push({
          id: `room-${i}`,
          number: i.toString(),
          status: 'open_clean',
          lastUpdated: new Date().toISOString(),
          checkInTime: null,
          duration: null,
          timeRemaining: null,
          extendedHours: 0,
          hasBeenOccupied: false, // Track if room has been occupied before
          guestOutStartTime: null, // When guest went out
          guestOutTimeRemaining: null // 3-hour countdown for guest out
        });
      }
    }
    
    const letterRooms = ['A', 'B', 'C'].map(letter => ({
      id: `room-${letter}`,
      number: letter,
      status: 'open_clean',
      lastUpdated: new Date().toISOString(),
      checkInTime: null,
      duration: null,
      timeRemaining: null,
      extendedHours: 0,
      hasBeenOccupied: false,
      guestOutStartTime: null,
      guestOutTimeRemaining: null
    }));
    
    return [...numberedRooms, ...letterRooms].sort((a, b) => {
      if (a.number.match(/^\d+$/) && b.number.match(/^\d+$/)) {
        return parseInt(a.number) - parseInt(b.number);
      }
      if (a.number.match(/^\d+$/)) return -1;
      if (b.number.match(/^\d+$/)) return 1;
      return a.number.localeCompare(b.number);
    });
  };

  useEffect(() => {
    // Initialize rooms or fetch from backend
    const savedRooms = localStorage.getItem('roomStatuses');
    if (savedRooms) {
      setRooms(JSON.parse(savedRooms));
    } else {
      const initialRooms = generateRooms();
      setRooms(initialRooms);
      localStorage.setItem('roomStatuses', JSON.stringify(initialRooms));
    }

    // Check for laundry reminders
    checkLaundryReminder();
  }, []);

  // Timer effect for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setRooms(prevRooms => {
        const updatedRooms = prevRooms.map(room => {
          let updatedRoom = { ...room };
          
          // Main timer for occupied and occupied_out rooms
          if ((room.status === 'occupied' || room.status === 'occupied_out') && 
              room.checkInTime && room.duration) {
            const checkIn = new Date(room.checkInTime);
            const totalDuration = (room.duration + room.extendedHours) * 60 * 60 * 1000;
            const elapsed = Date.now() - checkIn.getTime();
            const remaining = Math.max(0, totalDuration - elapsed);
            updatedRoom.timeRemaining = remaining;
          }
          
          // Guest out timer (3 hours)
          if (room.status === 'occupied_out' && room.guestOutStartTime) {
            const guestOutStart = new Date(room.guestOutStartTime);
            const guestOutDuration = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
            const elapsed = Date.now() - guestOutStart.getTime();
            const remaining = Math.max(0, guestOutDuration - elapsed);
            updatedRoom.guestOutTimeRemaining = remaining;
          }
          
          return updatedRoom;
        });
        
        localStorage.setItem('roomStatuses', JSON.stringify(updatedRooms));
        return updatedRooms;
      });
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, []);

  const checkLaundryReminder = () => {
    const needsCleaningCount = rooms.filter(room => room.status === 'needs_cleaning').length;
    // Show reminder when 3 or more rooms need cleaning
    if (needsCleaningCount >= 3) {
      setShowLaundryReminder(true);
    }
  };

  const handleStatusChange = (roomId, newStatus) => {
    const room = rooms.find(r => r.id === roomId);
    
    if (newStatus === 'occupied') {
      // Only show duration popup if coming from 'open_clean' (first time occupied)
      // If coming from 'occupied_out' (guest returning), just update status
      if (room.status === 'open_clean' && !room.hasBeenOccupied) {
        setSelectedRoom(roomId);
        setShowDurationModal(true);
      } else {
        // Guest returning from occupied_out - direct status update
        updateRoomStatus(roomId, newStatus);
      }
    } else {
      // Direct status update for non-occupied statuses
      updateRoomStatus(roomId, newStatus);
    }
  };

  const updateRoomStatus = async (roomId, newStatus, duration = null) => {
    setLoading(true);
    
    const updatedRooms = rooms.map(room => {
      if (room.id === roomId) {
        const updatedRoom = {
          ...room,
          status: newStatus,
          lastUpdated: new Date().toISOString()
        };
        
        if (newStatus === 'occupied' && duration) {
          updatedRoom.checkInTime = new Date().toISOString();
          updatedRoom.duration = duration;
          updatedRoom.timeRemaining = duration * 60 * 60 * 1000; // Convert to milliseconds
          updatedRoom.extendedHours = 0;
          updatedRoom.hasBeenOccupied = true;
        } else if (newStatus === 'occupied_out') {
          // Start guest out timer (3 hours) - keep main timer running
          updatedRoom.guestOutStartTime = new Date().toISOString();
          updatedRoom.guestOutTimeRemaining = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
        } else if (newStatus === 'occupied' && room.status === 'occupied_out') {
          // Guest returned - clear guest out timer but keep main timer
          updatedRoom.guestOutStartTime = null;
          updatedRoom.guestOutTimeRemaining = null;
        } else if (newStatus === 'needs_cleaning') {
          // Clear all timing data when room needs cleaning (checkout complete)
          updatedRoom.checkInTime = null;
          updatedRoom.duration = null;
          updatedRoom.timeRemaining = null;
          updatedRoom.extendedHours = 0;
          updatedRoom.guestOutStartTime = null;
          updatedRoom.guestOutTimeRemaining = null;
        }
        
        return updatedRoom;
      }
      return room;
    });
    
    setRooms(updatedRooms);
    localStorage.setItem('roomStatuses', JSON.stringify(updatedRooms));
    
    // Show laundry reminder if several rooms need cleaning
    const needsCleaningCount = updatedRooms.filter(room => room.status === 'needs_cleaning').length;
    if (needsCleaningCount >= 3 && newStatus === 'needs_cleaning') {
      // Add a small delay to show reminder after status update
      setTimeout(() => {
        setShowLaundryReminder(true);
      }, 1000);
    }
    
    // In a real app, this would sync to backend
    try {
      await axios.post(`${API}/rooms/update-status`, {
        roomId,
        status: newStatus,
        duration: duration,
        timestamp: new Date().toISOString()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.log('Room status will sync when online');
    }
    
    setLoading(false);
    const room = rooms.find(r => r.id === roomId);
    toast.success(`Room ${room?.number} updated to ${roomStatuses[newStatus].label}${duration ? ` for ${duration} hours` : ''}`);
  };

  const handleDurationSelect = (duration) => {
    if (selectedRoom) {
      updateRoomStatus(selectedRoom, 'occupied', duration);
      setShowDurationModal(false);
      setSelectedRoom(null);
    }
  };

  const extendRoom = (roomId, hours = 1) => {
    const updatedRooms = rooms.map(room => {
      if (room.id === roomId && (room.status === 'occupied' || room.status === 'occupied_out')) {
        return {
          ...room,
          extendedHours: room.extendedHours + hours,
          lastUpdated: new Date().toISOString()
        };
      }
      return room;
    });
    
    setRooms(updatedRooms);
    localStorage.setItem('roomStatuses', JSON.stringify(updatedRooms));
    
    const room = rooms.find(r => r.id === roomId);
    toast.success(`Room ${room?.number} extended by ${hours} hour(s)`);
  };

  const formatTimeRemaining = (milliseconds) => {
    if (!milliseconds) return '';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Calculate progress
  const totalRooms = rooms.length;
  const roomsNeedingCleaning = rooms.filter(room => room.status === 'needs_cleaning').length;
  const progress = totalRooms > 0 ? ((totalRooms - roomsNeedingCleaning) / totalRooms) * 100 : 100;

  const getStatusStats = () => {
    const stats = {};
    Object.keys(roomStatuses).forEach(status => {
      stats[status] = rooms.filter(room => room.status === status).length;
    });
    return stats;
  };

  const stats = getStatusStats();

  return (
    <div className="space-y-6" data-testid="rooms-tab">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h2 className="font-heading text-3xl font-bold tracking-tight">Room Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Live status across {totalRooms} rooms.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Progress</div>
            <div className="font-heading text-2xl font-bold tabular-nums">{Math.round(progress)}%</div>
          </div>
        </div>
      </div>

      {/* Duration Selection Modal */}
      <Dialog open={showDurationModal} onOpenChange={setShowDurationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">How long is the customer staying?</DialogTitle>
            <DialogDescription>
              Select the duration for Room {selectedRoom ? rooms.find(r => r.id === selectedRoom)?.number : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4">
            {durationOptions.map((option) => (
              <Button
                key={option.value}
                onClick={() => handleDurationSelect(option.value)}
                className="h-12 text-lg"
                data-testid={`duration-${option.value}`}
              >
                🕐 {option.label}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDurationModal(false);
                setSelectedRoom(null);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Laundry Reminder Modal */}
      <Dialog open={showLaundryReminder} onOpenChange={setShowLaundryReminder}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🧺</span>
              Laundry Reminder
            </DialogTitle>
            <DialogDescription>
              Don't forget to do your laundry! Multiple rooms need cleaning and fresh linens may be needed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">🧺</span>
                </div>
                <div>
                  <p className="font-medium text-orange-800">Time for laundry!</p>
                  <p className="text-sm text-orange-700 mt-1">
                    Several rooms need cleaning. Consider checking your laundry schedule and preparing fresh linens.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowLaundryReminder(false)}
            >
              I'll Remember
            </Button>
            <Button 
              onClick={() => {
                setShowLaundryReminder(false);
                toast.success('Laundry reminder acknowledged!');
              }}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Got It!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            Workload Progress
            <Badge variant={progress === 100 ? 'default' : 'secondary'} className="font-normal">
              {roomsNeedingCleaning} rooms need cleaning
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-zinc-100 rounded-full h-1.5 mb-5 overflow-hidden">
            <div
              className={`h-1.5 transition-all duration-500 ${
                progress === 100 ? 'bg-emerald-500' :
                progress >= 75 ? 'bg-zinc-900' :
                progress >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          {/* Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(roomStatuses).map(([status, config]) => (
              <div key={status} className="p-3 rounded-md bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`}></div>
                  <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground">{config.label}</div>
                </div>
                <div className="font-heading font-bold text-2xl text-foreground tabular-nums">{stats[status] || 0}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Room Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Room Status Management ({totalRooms} rooms)</CardTitle>
          <CardDescription>
            Update room statuses as you complete your work. Occupied rooms show countdown timers and can be extended.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {rooms.map((room) => {
              const statusConfig = roomStatuses[room.status];
              return (
                <div key={room.id} className="relative">
                  <div className={`p-3 rounded-md bg-card border border-border border-l-4 ${statusConfig.borderColor} hover:shadow-sm transition-all`}>
                    {/* Room Number and Status */}
                    <div className="mb-2">
                      <div className="font-heading text-lg font-bold tabular-nums leading-none mb-1">
                        {room.number}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`}></div>
                        <div className="text-[11px] font-medium text-muted-foreground tracking-wide">
                          {statusConfig.label}
                        </div>
                      </div>
                    </div>

                    {/* Countdown Timer for Occupied and Occupied Out Rooms */}
                    {(room.status === 'occupied' || room.status === 'occupied_out') &&
                     room.timeRemaining !== null && (
                      <div className="mb-2">
                        {/* Main Room Timer */}
                        <div className={`text-sm font-semibold tabular-nums ${
                          room.timeRemaining < 60 * 60 * 1000 ? 'text-red-600' : // Less than 1 hour - red
                          room.timeRemaining < 2 * 60 * 60 * 1000 ? 'text-orange-600' : // Less than 2 hours - orange
                          'text-foreground' // More than 2 hours - default
                        }`}>
                          {formatTimeRemaining(room.timeRemaining)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {room.duration + room.extendedHours}h total
                        </div>

                        {/* Separate Guest Out Timer - Only show when guest is out */}
                        {room.status === 'occupied_out' && room.guestOutTimeRemaining !== null && (
                          <div className="mt-1.5 pt-1.5 border-t border-border">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-orange-700">Guest out</div>
                            <div className={`text-xs font-semibold tabular-nums ${
                              room.guestOutTimeRemaining < 30 * 60 * 1000 ? 'text-red-600' : 'text-orange-600'
                            }`}>
                              {formatTimeRemaining(room.guestOutTimeRemaining)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Status Dropdown */}
                    <Select
                      value={room.status}
                      onValueChange={(value) => handleStatusChange(room.id, value)}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-full h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roomStatuses).map(([status, config]) => (
                          <SelectItem key={status} value={status}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${config.dotColor}`}></div>
                              <span className="text-xs">{config.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Extend Button for Occupied and Occupied Out Rooms */}
                    {(room.status === 'occupied' || room.status === 'occupied_out') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => extendRoom(room.id, 1)}
                        className="w-full mt-2 text-xs"
                        data-testid={`extend-${room.id}`}
                      >
                        ➕ Extend 1hr
                      </Button>
                    )}
                    
                    {/* Last Updated */}
                    <div className="text-[10px] text-muted-foreground mt-2 tabular-nums">
                      {new Date(room.lastUpdated).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const needsCleaning = rooms.filter(r => r.status === 'needs_cleaning');
                toast.info(`${needsCleaning.length} rooms need cleaning: ${needsCleaning.map(r => r.number).join(', ')}`);
              }}
            >
              📋 Show Rooms Needing Cleaning
            </Button>
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const occupied = rooms.filter(r => r.status === 'occupied');
                const expiringSoon = occupied.filter(r => r.timeRemaining && r.timeRemaining < 60 * 60 * 1000); // Less than 1 hour
                if (expiringSoon.length > 0) {
                  toast.warning(`${expiringSoon.length} rooms expiring soon: ${expiringSoon.map(r => r.number).join(', ')}`);
                } else {
                  toast.info(`${occupied.length} rooms currently occupied`);
                }
              }}
            >
              ⏰ Check Expiring Rooms
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
const TimeOffRequestsTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [requests, setRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [requestForm, setRequestForm] = useState({
    startDate: '',
    endDate: '',
    requestType: 'vacation',
    reason: '',
    emergencyContact: '',
    workCoverage: ''
  });

  useEffect(() => {
    fetchTimeOffRequests();
  }, []);

  const fetchTimeOffRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/time-off/my-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Failed to load time off requests', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!requestForm.startDate || !requestForm.endDate || !requestForm.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    const startDate = new Date(requestForm.startDate);
    const endDate = new Date(requestForm.endDate);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    if (startDate > endDate) {
      toast.error('End date must be after start date');
      return;
    }

    try {
      const newRequest = {
        ...requestForm,
        daysRequested: daysDiff,
        submittedDate: new Date().toISOString().split('T')[0],
        status: 'pending'
      };

      // Try backend API first
      try {
        await axios.post(`${API}/time-off/request`, {
          start_date: requestForm.startDate,
          end_date: requestForm.endDate,
          reason: requestForm.reason,
          notes: `Type: ${requestForm.requestType}. Emergency Contact: ${requestForm.emergencyContact}. Work Coverage: ${requestForm.workCoverage}`
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Time off request submitted successfully!');
      } catch (apiError) {
        // Fallback to local state
        const localRequest = {
          id: `req-${Date.now()}`,
          ...newRequest
        };
        setRequests(prev => [localRequest, ...prev]);
        toast.success('Time off request submitted successfully!');
      }

      // Reset form
      setRequestForm({
        startDate: '',
        endDate: '',
        requestType: 'vacation',
        reason: '',
        emergencyContact: '',
        workCoverage: ''
      });
      setShowRequestForm(false);

    } catch (error) {
      toast.error('Failed to submit request');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRequestTypeIcon = (type) => {
    switch (type) {
      case 'vacation': return '🏖️';
      case 'sick': return '🤒';
      case 'personal': return '👨‍👩‍👧‍👦';
      case 'bereavement': return '🕊️';
      case 'maternity': return '👶';
      case 'emergency': return '🚨';
      default: return '📋';
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculateTimeOffBalance = () => {
    const approvedDays = requests.filter(req => req.status === 'approved')
      .reduce((sum, req) => sum + req.daysRequested, 0);
    
    return {
      totalAllowance: 20, // Annual allowance
      used: approvedDays,
      remaining: 20 - approvedDays,
      pending: requests.filter(req => req.status === 'pending')
        .reduce((sum, req) => sum + req.daysRequested, 0)
    };
  };

  const balance = calculateTimeOffBalance();

  return (
    <div className="space-y-6" data-testid="timeoff-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Time Off Requests</h2>
        <Button onClick={() => setShowRequestForm(true)}>
          ➕ New Request
        </Button>
      </div>

      {/* Time Off Balance */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{balance.totalAllowance}</div>
              <div className="text-sm text-gray-600">Annual Allowance</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{balance.used}</div>
              <div className="text-sm text-gray-600">Days Used</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{balance.remaining}</div>
              <div className="text-sm text-gray-600">Days Remaining</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{balance.pending}</div>
              <div className="text-sm text-gray-600">Days Pending</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Integration */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Time Off Calendar</CardTitle>
            <CardDescription>View your scheduled time off</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border w-full"
              modifiers={{
                approved: requests.filter(req => req.status === 'approved').flatMap(req => {
                  const dates = [];
                  const start = new Date(req.startDate);
                  const end = new Date(req.endDate);
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d));
                  }
                  return dates;
                }),
                pending: requests.filter(req => req.status === 'pending').flatMap(req => {
                  const dates = [];
                  const start = new Date(req.startDate);
                  const end = new Date(req.endDate);
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d));
                  }
                  return dates;
                })
              }}
              modifiersStyles={{
                approved: { backgroundColor: '#10b981', color: 'white' },
                pending: { backgroundColor: '#f59e0b', color: 'white' }
              }}
            />
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Approved Time Off</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span>Pending Approval</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Request Form */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Request</CardTitle>
            <CardDescription>Submit a time off request quickly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Request Type</Label>
              <select
                className="w-full mt-1 p-2 border rounded"
                value={requestForm.requestType}
                onChange={(e) => setRequestForm({...requestForm, requestType: e.target.value})}
              >
                <option value="vacation">🏖️ Vacation</option>
                <option value="sick">🤒 Sick Leave</option>
                <option value="personal">👨‍👩‍👧‍👦 Personal</option>
                <option value="bereavement">🕊️ Bereavement</option>
                <option value="maternity">👶 Maternity/Paternity</option>
                <option value="emergency">🚨 Emergency</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={requestForm.startDate}
                  onChange={(e) => setRequestForm({...requestForm, startDate: e.target.value})}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={requestForm.endDate}
                  onChange={(e) => setRequestForm({...requestForm, endDate: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <textarea
                className="w-full mt-1 p-2 border rounded h-20"
                placeholder="Brief explanation of your request..."
                value={requestForm.reason}
                onChange={(e) => setRequestForm({...requestForm, reason: e.target.value})}
              />
            </div>
            <Button onClick={handleSubmitRequest} className="w-full">
              Submit Quick Request
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Request History */}
      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
          <CardDescription>All your time off requests ({requests.length} total)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading requests...</p>
            </div>
          ) : requests.length > 0 ? (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{getRequestTypeIcon(request.requestType)}</div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium capitalize">{request.requestType} Request</h3>
                          <Badge className={getStatusColor(request.status)}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><strong>Dates:</strong> {formatDate(request.startDate)} - {formatDate(request.endDate)} ({request.daysRequested} days)</p>
                          <p><strong>Reason:</strong> {request.reason}</p>
                          <p><strong>Submitted:</strong> {formatDate(request.submittedDate)}</p>
                          {request.approvedBy && (
                            <p><strong>Approved by:</strong> {request.approvedBy}</p>
                          )}
                          {request.rejectedReason && (
                            <p className="text-red-600"><strong>Rejection reason:</strong> {request.rejectedReason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {request.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => {
                            if (confirm('Are you sure you want to cancel this request?')) {
                              setRequests(prev => prev.filter(r => r.id !== request.id));
                              toast.success('Request cancelled');
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          toast.info(`Request Details:\n\nType: ${request.requestType}\nDates: ${request.startDate} to ${request.endDate}\nReason: ${request.reason}\nEmergency Contact: ${request.emergencyContact || 'Not provided'}\nWork Coverage: ${request.workCoverage || 'Not specified'}`);
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No time off requests yet</p>
              <p className="text-sm mt-1">Click "New Request" to submit your first request</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Request Modal */}
      <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">New Time Off Request</DialogTitle>
            <DialogDescription>
              Submit a detailed time off request for manager approval
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Request Type *</Label>
              <select
                className="w-full mt-1 p-2 border rounded"
                value={requestForm.requestType}
                onChange={(e) => setRequestForm({...requestForm, requestType: e.target.value})}
              >
                <option value="vacation">🏖️ Vacation</option>
                <option value="sick">🤒 Sick Leave</option>
                <option value="personal">👨‍👩‍👧‍👦 Personal</option>
                <option value="bereavement">🕊️ Bereavement</option>
                <option value="maternity">👶 Maternity/Paternity</option>
                <option value="emergency">🚨 Emergency</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={requestForm.startDate}
                  onChange={(e) => setRequestForm({...requestForm, startDate: e.target.value})}
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={requestForm.endDate}
                  onChange={(e) => setRequestForm({...requestForm, endDate: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Reason for Request *</Label>
              <textarea
                className="w-full mt-1 p-2 border rounded h-20"
                placeholder="Please provide details about your time off request..."
                value={requestForm.reason}
                onChange={(e) => setRequestForm({...requestForm, reason: e.target.value})}
              />
            </div>
            <div>
              <Label>Emergency Contact</Label>
              <Input
                placeholder="Name and phone number"
                value={requestForm.emergencyContact}
                onChange={(e) => setRequestForm({...requestForm, emergencyContact: e.target.value})}
              />
            </div>
            <div>
              <Label>Work Coverage Arrangement</Label>
              <textarea
                className="w-full mt-1 p-2 border rounded h-16"
                placeholder="Who will cover your responsibilities? Any special instructions?"
                value={requestForm.workCoverage}
                onChange={(e) => setRequestForm({...requestForm, workCoverage: e.target.value})}
              />
            </div>
            
            {/* Request Summary */}
            {requestForm.startDate && requestForm.endDate && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Request Summary</h4>
                <div className="text-sm text-blue-700">
                  <p>Days requested: {requestForm.startDate && requestForm.endDate ? 
                    Math.ceil((new Date(requestForm.endDate).getTime() - new Date(requestForm.startDate).getTime()) / (1000 * 3600 * 24)) + 1 : 0}</p>
                  <p>Remaining balance after approval: {balance.remaining - (requestForm.startDate && requestForm.endDate ? 
                    Math.ceil((new Date(requestForm.endDate).getTime() - new Date(requestForm.startDate).getTime()) / (1000 * 3600 * 24)) + 1 : 0)} days</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRequestForm(false);
                setRequestForm({
                  startDate: '',
                  endDate: '',
                  requestType: 'vacation',
                  reason: '',
                  emergencyContact: '',
                  workCoverage: ''
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// My Schedule Tab - Attendant Calendar and Shift Management
const MyScheduleTab = () => {
  const { user } = React.useContext(AuthContext);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  // Controlled fields for the "Request Shift Change" modal
  const [shiftRequestType, setShiftRequestType] = useState('Schedule Change');
  const [shiftRequestDate, setShiftRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [shiftRequestReason, setShiftRequestReason] = useState('');
  const [shiftRequestSubmitting, setShiftRequestSubmitting] = useState(false);

  const submitShiftChangeRequest = async () => {
    if (!shiftRequestDate || !shiftRequestReason.trim()) {
      toast.error('Please fill out date and reason');
      return;
    }
    setShiftRequestSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/time-off/request`,
        {
          start_date: shiftRequestDate,
          end_date: shiftRequestDate,
          reason: `[${shiftRequestType}] ${shiftRequestReason.trim()}`,
          notes: '',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success('Request submitted to your manager');
      setShowAddShiftModal(false);
      setShiftRequestReason('');
      setShiftRequestType('Schedule Change');
      setShiftRequestDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setShiftRequestSubmitting(false);
    }
  };

  // Load this user's schedules from the backend.
  const fetchMySchedules = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/schedules/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = response.data?.schedules || [];
      const mine = list.map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.shift_start,
        endTime: s.shift_end,
        type: 'Regular',
        status: s.status === 'completed' ? 'Completed' : 'Scheduled',
        location: 'Main Office',
        notes: s.notes || '',
      }));
      setSchedules(mine);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load schedule');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySchedules();
  }, [user?.id]);

  const getSchedulesForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return schedules.filter(schedule => schedule.date === dateStr);
  };

  const getSchedulesForWeek = () => {
    if (!selectedDate) return [];
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
    
    const weekSchedules = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const daySchedules = getSchedulesForDate(day);
      weekSchedules.push({
        date: day,
        schedules: daySchedules
      });
    }
    return weekSchedules;
  };

  const formatTime = (timeStr) => {
    return new Date(`2000-01-01T${timeStr}:00`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getShiftTypeColor = (type) => {
    switch (type) {
      case 'Regular': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Evening': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Night': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Overtime': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Scheduled': return 'bg-green-500';
      case 'Pending': return 'bg-yellow-500';
      case 'Cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6" data-testid="schedule-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">My Schedule</h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowAddShiftModal(true)}
            className="bg-blue-500 hover:bg-blue-600"
          >
            📝 Request Shift Change
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Calendar View */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Calendar View
              <Badge variant="outline">{schedules.length} shifts this month</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border w-full"
              modifiers={{
                hasSchedule: schedules.map(s => new Date(s.date))
              }}
              modifiersStyles={{
                hasSchedule: {
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontWeight: 'bold'
                }
              }}
            />
            <div className="mt-4 text-xs text-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Days with scheduled shifts</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Schedule Details */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule for {selectedDate ? selectedDate.toLocaleDateString() : 'Today'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedDate && getSchedulesForDate(selectedDate).length > 0 ? (
                getSchedulesForDate(selectedDate).map((schedule) => (
                  <div key={schedule.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(schedule.status)}`}></div>
                        <span className="font-medium">{formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}</span>
                      </div>
                      <Badge variant="outline" className={getShiftTypeColor(schedule.type)}>
                        {schedule.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{schedule.location}</p>
                    <p className="text-sm text-gray-500">{schedule.notes}</p>
                    <p className="text-xs mt-2">Status: <span className="capitalize font-medium">{schedule.status}</span></p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No shifts scheduled for this date</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Overview</CardTitle>
          <CardDescription>
            Your schedule for the week of {new Date(selectedDate.getTime() - selectedDate.getDay() * 24 * 60 * 60 * 1000).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                {day}
              </div>
            ))}
            {getSchedulesForWeek().map(({ date, schedules: daySchedules }) => (
              <div key={date.toISOString()} className="border rounded-lg p-2 min-h-[100px]">
                <div className="text-xs text-gray-600 mb-1">{date.getDate()}</div>
                {daySchedules.map((schedule, idx) => (
                  <div key={schedule.id ?? `${date.toISOString()}-${idx}`} className={`text-xs p-1 rounded mb-1 ${getShiftTypeColor(schedule.type)}`}>
                    <div className="font-medium">{formatTime(schedule.startTime)}</div>
                    <div className="truncate">{schedule.type}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Week Summary */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">
                {getSchedulesForWeek().reduce((sum, day) => sum + day.schedules.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Shifts</div>
            </div>
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">
                {getSchedulesForWeek().reduce((sum, day) => {
                  return sum + day.schedules.reduce((daySum, schedule) => {
                    const start = new Date(`2000-01-01T${schedule.startTime}:00`);
                    const end = new Date(`2000-01-01T${schedule.endTime}:00`);
                    return daySum + (end - start) / (1000 * 60 * 60);
                  }, 0);
                }, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Hours</div>
            </div>
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">
                {getSchedulesForWeek().filter(day => 
                  day.schedules.some(s => s.status === 'Pending')
                ).length}
              </div>
              <div className="text-sm text-gray-600">Pending Changes</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shift Change Request Modal */}
      <Dialog open={showAddShiftModal} onOpenChange={setShowAddShiftModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">Request Shift Change</DialogTitle>
            <DialogDescription>
              Submit a request to modify your schedule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Request Type</label>
              <select
                className="w-full mt-1 p-2 border rounded"
                value={shiftRequestType}
                onChange={(e) => setShiftRequestType(e.target.value)}
              >
                <option>Shift Swap</option>
                <option>Time Off Request</option>
                <option>Schedule Change</option>
                <option>Overtime Request</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                className="w-full mt-1 p-2 border rounded"
                value={shiftRequestDate}
                onChange={(e) => setShiftRequestDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <textarea
                className="w-full mt-1 p-2 border rounded h-20"
                placeholder="Explain your request..."
                value={shiftRequestReason}
                onChange={(e) => setShiftRequestReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddShiftModal(false)}
              disabled={shiftRequestSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitShiftChangeRequest}
              disabled={shiftRequestSubmitting}
            >
              {shiftRequestSubmitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// My Reports Tab  
const MyReportsTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    fetchMyReports();
  }, [selectedPeriod]);

  const fetchMyReports = async () => {
    setLoading(true);
    try {
      // Fetch time entries for the selected period
      const response = await axios.get(`${API}/time/my-reports?period=${selectedPeriod}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimeEntries(response.data.entries || []);
      setReportData(response.data.summary || null);
    } catch (error) {
      console.error('fetchMyReports failed', error);
      toast.error(error.response?.data?.detail || 'Failed to load reports');
      setTimeEntries([]);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '--';
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 95) return 'text-green-600';
    if (efficiency >= 85) return 'text-blue-600';
    if (efficiency >= 75) return 'text-orange-600';
    return 'text-red-600';
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Punch In', 'Punch Out', 'Total Hours', 'Status'];
    const csvData = timeEntries.map(entry => [
      entry.date,
      formatTime(entry.punch_in_time),
      formatTime(entry.punch_out_time),
      entry.total_hours,
      entry.status
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-timesheet-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Timesheet exported successfully!');
  };

  return (
    <div className="space-y-6" data-testid="my-reports-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">My Reports</h2>
        <div className="flex gap-2">
          <select
            className="px-3 py-1 border rounded"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="current_week">This Week</option>
            <option value="current_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="current_year">This Year</option>
          </select>
          <Button onClick={exportToCSV} variant="outline" size="sm">Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading your reports...</p>
        </div>
      ) : (
        <>
          {/* Summary Statistics */}
          {reportData && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{reportData.totalHours}</div>
                    <div className="text-sm text-gray-600">Total Hours</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{reportData.daysWorked}</div>
                    <div className="text-sm text-gray-600">Days Worked</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{reportData.averageHoursPerDay}</div>
                    <div className="text-sm text-gray-600">Avg Hours/Day</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{reportData.expectedHours}</div>
                    <div className="text-sm text-gray-600">Expected Hours</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getEfficiencyColor(reportData.efficiency)}`}>
                      {reportData.efficiency}%
                    </div>
                    <div className="text-sm text-gray-600">Efficiency</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Weekly Hours Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Hours Trend</CardTitle>
              <CardDescription>Your work hours pattern over time</CardDescription>
            </CardHeader>
            <CardContent>
              {timeEntries.length > 0 ? (
                <div className="space-y-4">
                  {/* Simple bar chart representation */}
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                      const dayEntries = timeEntries.filter(entry => {
                        const entryDay = new Date(entry.date).getDay();
                        return entryDay === index;
                      });
                      
                      const avgHours = dayEntries.length > 0 
                        ? dayEntries.reduce((sum, e) => sum + parseFloat(e.total_hours), 0) / dayEntries.length
                        : 0;
                        
                      const barHeight = Math.max((avgHours / 10) * 100, 5); // Scale to 10 hours max
                      
                      return (
                        <div key={day} className="text-center">
                          <div className="text-xs mb-1">{day}</div>
                          <div className="bg-gray-200 h-20 rounded flex items-end">
                            <div 
                              className="bg-blue-500 rounded w-full transition-all duration-300"
                              style={{ height: `${barHeight}%` }}
                              title={`Average: ${avgHours.toFixed(1)} hours`}
                            ></div>
                          </div>
                          <div className="text-xs mt-1 text-gray-600">{avgHours.toFixed(1)}h</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    Average daily hours by day of week
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No time entries found for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Timesheet */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Timesheet</CardTitle>
              <CardDescription>
                Complete record of your work hours for {selectedPeriod.replace('_', ' ')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeEntries.length > 0 ? (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-5 gap-4 p-3 bg-gray-50 rounded font-medium text-sm">
                    <div>Date</div>
                    <div>Punch In</div>
                    <div>Punch Out</div>
                    <div>Total Hours</div>
                    <div>Status</div>
                  </div>
                  
                  {/* Entries */}
                  {timeEntries.map((entry) => (
                    <div key={entry.id} className="grid grid-cols-5 gap-4 p-3 border rounded hover:bg-gray-50">
                      <div className="font-medium">{formatDate(entry.date)}</div>
                      <div className="text-green-600">{formatTime(entry.punch_in_time)}</div>
                      <div className="text-red-600">{formatTime(entry.punch_out_time)}</div>
                      <div className="font-medium">{entry.total_hours}h</div>
                      <div>
                        <Badge 
                          variant={entry.status === 'complete' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {entry.status === 'complete' ? 'Complete' : 'Incomplete'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  
                  {/* Summary Row */}
                  <div className="grid grid-cols-5 gap-4 p-3 bg-blue-50 rounded font-medium border-2 border-blue-200">
                    <div className="col-span-3 text-blue-800">Total</div>
                    <div className="text-blue-800">
                      {timeEntries.reduce((sum, entry) => sum + parseFloat(entry.total_hours), 0).toFixed(2)}h
                    </div>
                    <div></div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No time entries found for the selected period</p>
                  <p className="text-sm mt-1">Start punching in/out to see your timesheet here</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Insights</CardTitle>
              <CardDescription>Insights based on your work patterns</CardDescription>
            </CardHeader>
            <CardContent>
              {reportData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-2">Strengths</h4>
                      <ul className="text-sm text-green-700 space-y-1">
                        {reportData.efficiency >= 95 && <li>• Excellent time efficiency ({reportData.efficiency}%)</li>}
                        {reportData.daysWorked >= 20 && <li>• Consistent attendance ({reportData.daysWorked} days)</li>}
                        {reportData.averageHoursPerDay >= 8 && <li>• Meeting daily hour targets</li>}
                        <li>• Regular work schedule maintained</li>
                      </ul>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">Opportunities</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        {reportData.efficiency < 85 && <li>• Consider optimizing time management</li>}
                        {reportData.averageHoursPerDay < 7.5 && <li>• Opportunity to increase daily hours</li>}
                        <li>• Track break patterns for better productivity</li>
                        <li>• Consider setting daily hour goals</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 border rounded-lg">
                    <h4 className="font-medium mb-2">Quick Stats</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Most productive day:</span>
                        <div className="font-medium">Tuesday</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Avg start time:</span>
                        <div className="font-medium">8:30 AM</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Avg end time:</span>
                        <div className="font-medium">5:15 PM</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Punctuality:</span>
                        <div className="font-medium text-green-600">95%</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p>Performance insights will appear once you have more time entries</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

// Communication Tab
const CommunicationTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [messageCategory, setMessageCategory] = useState('all');
  const [messages, setMessages] = useState([]);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [newMessage, setNewMessage] = useState({ content: '', subject: '', recipients: [], category: 'direct' });
  const [showComposer, setShowComposer] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [ws, setWs] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize WebSocket connection
  useEffect(() => {
    if (user && token) {
      const wsUrl = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      const websocket = new WebSocket(`${wsUrl}/api/ws/${user.id}`);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
      };
      
      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          toast.info('New message received!');
          fetchThreads();
          if (selectedThread) {
            fetchThreadMessages(selectedThread);
          }
        } else if (data.type === 'message_edited' || data.type === 'message_deleted') {
          if (selectedThread) {
            fetchThreadMessages(selectedThread);
          }
        }
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      websocket.onclose = () => {
        console.log('WebSocket disconnected');
      };
      
      setWs(websocket);
      
      return () => {
        websocket.close();
      };
    }
  }, [user, token]);

  // Fetch message threads
  const fetchThreads = async () => {
    try {
      const response = await axios.get(`${API}/messages/threads`, {
        params: messageCategory !== 'all' ? { category: messageCategory } : {},
        headers: { Authorization: `Bearer ${token}` }
      });
      setThreads(response.data.threads || []);
      
      // Calculate unread count
      const totalUnread = response.data.threads.reduce((sum, thread) => sum + thread.unread_count, 0);
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error fetching threads:', error);
      toast.error('Failed to load message threads');
    }
  };

  // Fetch messages for a specific thread
  const fetchThreadMessages = async (threadId) => {
    try {
      const response = await axios.get(`${API}/messages`, {
        params: { thread_id: threadId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setThreadMessages(response.data.messages || []);
      
      // Mark messages as read
      for (const msg of response.data.messages) {
        if (msg.sender_id !== user.id && !msg.is_read_by.includes(user.id)) {
          await axios.put(`${API}/messages/${msg.id}/read`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }
      
      fetchThreads(); // Refresh to update unread counts
    } catch (error) {
      console.error('Error fetching thread messages:', error);
    }
  };

  // Fetch users for recipient selection
  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users/for-messaging`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`${API}/messages/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setSelectedFile(response.data);
      toast.success('File uploaded successfully!');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('File upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.content.trim()) {
      toast.error('Message content is required');
      return;
    }

    // Validate recipients for direct and group messages
    if (newMessage.category !== 'announcement' && newMessage.recipients.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    try {
      const messageData = {
        category: newMessage.category,
        recipients: newMessage.category === 'announcement' ? [] : newMessage.recipients,
        subject: newMessage.subject || 'No Subject',
        content: newMessage.content,
        thread_id: selectedThread
      };

      const response = await axios.post(`${API}/messages`, messageData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // If file was uploaded, attach it to the message
      if (selectedFile) {
        await axios.post(`${API}/messages/${response.data.message_id}/attachments`, [selectedFile], {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      toast.success('Message sent successfully!');
      setNewMessage({ content: '', subject: '', recipients: [], category: 'direct' });
      setSelectedFile(null);
      setShowComposer(false);
      fetchThreads();
      
      if (selectedThread) {
        fetchThreadMessages(selectedThread);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.response?.data?.detail || 'Failed to send message');
    }
  };

  // Load initial data
  useEffect(() => {
    if (token) {
      fetchThreads();
      fetchUsers();
    }
  }, [token, messageCategory]);

  // Handle thread selection
  const handleThreadClick = (thread) => {
    setSelectedThread(thread.thread_id);
    fetchThreadMessages(thread.thread_id);
  };

  return (
    <div className="space-y-6" data-testid="communication-tab">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading text-3xl font-bold tracking-tight">Messages</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">{unreadCount} Unread</Badge>
          )}
        </div>
        <Button onClick={() => setShowComposer(true)}>+ New Message</Button>
      </div>

      {/* Message Category Filter */}
      <div className="flex gap-2">
        <Button
          variant={messageCategory === 'all' ? 'default' : 'outline'}
          onClick={() => setMessageCategory('all')}
        >
          All Messages
        </Button>
        <Button
          variant={messageCategory === 'announcement' ? 'default' : 'outline'}
          onClick={() => setMessageCategory('announcement')}
        >
          📢 Announcements
        </Button>
        <Button
          variant={messageCategory === 'direct' ? 'default' : 'outline'}
          onClick={() => setMessageCategory('direct')}
        >
          💬 Direct Messages
        </Button>
        <Button
          variant={messageCategory === 'group' ? 'default' : 'outline'}
          onClick={() => setMessageCategory('group')}
        >
          👥 Group Chats
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Thread List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              {threads.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No conversations yet
                </div>
              ) : (
                threads.map((thread) => (
                  <div
                    key={thread.thread_id}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedThread === thread.thread_id ? 'bg-blue-50' : ''}`}
                    onClick={() => handleThreadClick(thread)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-sm">
                        {thread.category === 'announcement' && '📢 '}
                        {thread.category === 'group' && '👥 '}
                        {thread.subject}
                      </div>
                      {thread.unread_count > 0 && (
                        <Badge variant="destructive" className="text-xs">{thread.unread_count}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 truncate">{thread.last_message}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {thread.last_sender} • {new Date(thread.last_updated).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message View */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedThread ? threads.find(t => t.thread_id === selectedThread)?.subject : 'Select a conversation'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedThread ? (
              <div className="text-center py-20 text-gray-500">
                <p>Select a conversation to view messages</p>
              </div>
            ) : (
              <div>
                {/* Messages */}
                <div className="max-h-[400px] overflow-y-auto mb-4 space-y-4">
                  {threadMessages.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">
                      No messages in this thread
                    </div>
                  ) : (
                    threadMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${msg.sender_id === user.id ? 'bg-blue-100 ml-auto' : 'bg-gray-100'} max-w-[80%]`}
                      >
                        <div className="font-semibold text-sm mb-1">{msg.sender_name}</div>
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {msg.attachments.map((att, idx) => (
                              <div key={att.file_url ?? att.filename ?? `${msg.id}-${idx}`} className="flex items-center gap-2 text-xs">
                                <Badge variant="outline">📎</Badge>
                                <a
                                  href={`${API}${att.file_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {att.original_filename}
                                </a>
                                <span className="text-gray-500">({(att.file_size / 1024).toFixed(1)} KB)</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(msg.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Reply Section */}
                <Separator className="my-4" />
                <div className="space-y-2">
                  <textarea
                    className="w-full p-2 border rounded-lg"
                    rows="3"
                    placeholder="Type your reply..."
                    value={newMessage.content}
                    onChange={(e) => setNewMessage({...newMessage, content: e.target.value})}
                  />
                  <div className="flex gap-2 items-center">
                    <Input
                      type="file"
                      onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                      className="flex-1"
                      disabled={uploading}
                    />
                    <Button onClick={handleSendMessage} disabled={uploading}>
                      {uploading ? 'Uploading...' : 'Send Reply'}
                    </Button>
                  </div>
                  {selectedFile && (
                    <div className="text-xs text-green-600">File attached: {selectedFile.original_filename}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Message Composer Dialog */}
      <Dialog open={showComposer} onOpenChange={setShowComposer}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Message Type</Label>
              <Select
                value={newMessage.category}
                onValueChange={(value) => setNewMessage({...newMessage, category: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct Message</SelectItem>
                  <SelectItem value="group">Group Chat</SelectItem>
                  {(user?.role === 'assistant_manager' || user?.role === 'ops_manager') && (
                    <SelectItem value="announcement">Announcement (to all employees)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {newMessage.category !== 'announcement' && (
              <div>
                <Label>Recipients</Label>
                <Select
                  onValueChange={(value) => {
                    if (!newMessage.recipients.includes(value)) {
                      setNewMessage({...newMessage, recipients: [...newMessage.recipients, value]});
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipients..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 flex flex-wrap gap-2">
                  {newMessage.recipients.map((recipientId) => {
                    const recipient = users.find(u => u.id === recipientId);
                    return (
                      <Badge key={recipientId} variant="secondary">
                        {recipient?.name}
                        <button
                          onClick={() => setNewMessage({
                            ...newMessage,
                            recipients: newMessage.recipients.filter(id => id !== recipientId)
                          })}
                          className="ml-2 text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <Label>Subject</Label>
              <Input
                value={newMessage.subject}
                onChange={(e) => setNewMessage({...newMessage, subject: e.target.value})}
                placeholder="Message subject..."
              />
            </div>

            <div>
              <Label>Message</Label>
              <textarea
                className="w-full p-2 border rounded-lg"
                rows="5"
                value={newMessage.content}
                onChange={(e) => setNewMessage({...newMessage, content: e.target.value})}
                placeholder="Type your message..."
              />
            </div>

            <div>
              <Label>Attachment (Optional)</Label>
              <Input
                type="file"
                onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                disabled={uploading}
              />
              {selectedFile && (
                <div className="text-xs text-green-600 mt-1">File attached: {selectedFile.original_filename}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComposer(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendMessage} disabled={uploading}>
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ MANAGER TAB COMPONENTS ============

// Team Overview Tab
const TeamOverviewTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [employeesRes, entriesRes] = await Promise.all([
        axios.get(`${API}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/time/entries`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const employees = employeesRes.data.filter(u => u.role === 'attendant');
      const entries = entriesRes.data;
      const today = new Date().toISOString().split('T')[0];
      
      const todayEntries = entries.filter(entry => entry.date === today);
      const activeToday = todayEntries.filter(entry => entry.punch_in_time).length;
      const completedToday = todayEntries.filter(entry => entry.status === 'complete').length;

      setStats({
        totalAttendants: employees.length,
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
      <h2 className="font-heading text-3xl font-bold tracking-tight">Team Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Attendants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAttendants}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{stats.activeToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{stats.completedToday}</div>
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
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [employees, setAttendants] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [showAddAttendant, setShowAddAttendant] = useState(false);

  useEffect(() => {
    fetchAttendants();
    fetchTimeEntries();
  }, []);

  const fetchAttendants = async () => {
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttendants(response.data.filter(u => u.role === 'attendant'));
    } catch (error) {
      toast.error('Failed to fetch employees');
    }
  };

  const fetchTimeEntries = async () => {
    try {
      const response = await axios.get(`${API}/time/entries`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimeEntries(response.data.slice(0, 20));
    } catch (error) {
      toast.error('Failed to fetch time entries');
    }
  };

  return (
    <div className="space-y-6" data-testid="team-timecards-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Team Time Cards</h2>
        <Button onClick={() => setShowAddAttendant(true)} data-testid="add-employee-button">
          Add Attendant
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Attendants ({employees.length})</CardTitle>
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

      <AddAttendantModal 
        isOpen={showAddAttendant} 
        onClose={() => setShowAddAttendant(false)}
        onSuccess={() => {
          setShowAddAttendant(false);
          fetchAttendants();
        }}
      />
    </div>
  );
};

// Room Reports Tab - Assistant Manager oversight of room operations
const RoomReportsTab = () => {
  const [roomData, setRoomData] = useState([]);
  const [employeeLaundryStats, setAttendantLaundryStats] = useState([]);
  const [shiftReports, setShiftReports] = useState([]);

  useEffect(() => {
    fetchRoomReports();
    fetchLaundryStats();
    fetchShiftReports();
  }, []);

  const fetchRoomReports = async () => {
    try {
      // Source-of-truth for current room state mirrors the Room Management tab (localStorage).
      const savedRooms = localStorage.getItem('roomStatuses');
      const rooms = savedRooms ? JSON.parse(savedRooms) : [];
      const items = rooms.map((r) => ({
        room: r.number,
        status: r.status,
        lastUpdated: r.lastUpdated
          ? new Date(r.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—',
        employee: r.lastUpdatedBy || '—',
      }));
      setRoomData(items);
    } catch (error) {
      console.error('fetchRoomReports failed', error);
      setRoomData([]);
    }
  };

  const fetchLaundryStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/laundry/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Group by employee_name → laundry count
      const grouped = {};
      (response.data || []).forEach((rec) => {
        const name = rec.employee_name || 'Unknown';
        if (!grouped[name]) {
          grouped[name] = { employee: name, laundryCount: 0, lastLaundry: null };
        }
        grouped[name].laundryCount += 1;
        if (rec.timestamp) {
          const t = new Date(rec.timestamp);
          if (!grouped[name].lastLaundry || t > new Date(grouped[name].lastLaundry)) {
            grouped[name].lastLaundry = rec.timestamp;
          }
        }
      });
      const items = Object.values(grouped).map((g) => ({
        ...g,
        lastLaundry: g.lastLaundry
          ? new Date(g.lastLaundry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—',
      }));
      setAttendantLaundryStats(items);
    } catch (error) {
      console.error('fetchLaundryStats failed', error);
      setAttendantLaundryStats([]);
    }
  };

  const fetchShiftReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/rooms/report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const perf = (response.data && response.data.employee_performance) || {};
      const items = Object.values(perf).map((p) => {
        const totalRooms = (p.rooms_completed || 0) + (p.rooms_pending || 0);
        const efficiency = totalRooms ? Math.round((p.rooms_completed / totalRooms) * 100) : 0;
        return {
          employee: p.employee_name || 'Unknown',
          shift: p.last_activity
            ? `Last activity ${new Date(p.last_activity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : '—',
          roomsCompleted: p.rooms_completed || 0,
          roomsPending: p.rooms_pending || 0,
          laundryCount: p.laundry_count || 0,
          efficiency,
        };
      });
      setShiftReports(items);
    } catch (error) {
      console.error('fetchShiftReports failed', error);
      setShiftReports([]);
    }
  };

  const roomStatusColors = {
    'open_clean': 'bg-green-500',
    'occupied': 'bg-yellow-500',
    'occupied_out': 'bg-orange-500',
    'needs_cleaning': 'bg-red-500'
  };

  const statusCounts = roomData.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const cleanCount = statusCounts.open_clean || 0;
  const occupiedCount = statusCounts.occupied || 0;
  const guestOutCount = statusCounts.occupied_out || 0;
  const needsCleaningCount = statusCounts.needs_cleaning || 0;

  const handleExportReport = () => {
    if (!roomData.length && !shiftReports.length && !employeeLaundryStats.length) {
      toast.error('No data available to export');
      return;
    }
    const lines = [];
    lines.push('Room Reports — exported ' + new Date().toLocaleString());
    lines.push('');
    lines.push('STATUS SUMMARY');
    lines.push(`Clean & Ready,${cleanCount}`);
    lines.push(`Occupied,${occupiedCount}`);
    lines.push(`Guest Out,${guestOutCount}`);
    lines.push(`Needs Cleaning,${needsCleaningCount}`);
    lines.push('');
    lines.push('ROOM DETAIL');
    lines.push('Room,Status,Last Updated,Employee');
    roomData.forEach((r) => {
      lines.push(`${r.room},${r.status},${r.lastUpdated},${r.employee}`);
    });
    lines.push('');
    lines.push('SHIFT PERFORMANCE');
    lines.push('Employee,Shift,Rooms Completed,Rooms Pending,Laundry,Efficiency %');
    shiftReports.forEach((s) => {
      lines.push(`${s.employee},${s.shift},${s.roomsCompleted},${s.roomsPending},${s.laundryCount},${s.efficiency}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `room-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Room report exported');
  };

  return (
    <div className="space-y-6" data-testid="room-reports-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Room Reports</h2>
        <Button variant="outline" onClick={handleExportReport} data-testid="export-room-report-btn">Export Report
        </Button>
      </div>

      {/* Real-time Room Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clean & Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{cleanCount}</div>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs text-gray-600">Available now</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Occupied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{occupiedCount}</div>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span className="text-xs text-gray-600">Guests in room</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Guest Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{guestOutCount}</div>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-xs text-gray-600">Ready for cleaning</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Needs Cleaning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{needsCleaningCount}</div>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-xs text-gray-600">Requires attention</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendant Performance Today */}
      <Card>
        <CardHeader>
          <CardTitle>Attendant Performance - Current Shift</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {shiftReports.map((report, index) => (
              <div key={report.id ?? report.employee ?? index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold">{report.employee}</h3>
                    <p className="text-sm text-gray-600">{report.shift}</p>
                  </div>
                  <Badge variant={report.efficiency >= 85 ? 'default' : 'secondary'}>
                    {report.efficiency}% efficiency
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Rooms Completed:</span>
                    <span className="font-semibold text-green-600 ml-2">{report.roomsCompleted}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Rooms Pending:</span>
                    <span className="font-semibold text-orange-600 ml-2">{report.roomsPending}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Laundry Runs:</span>
                    <span className="font-semibold text-blue-600 ml-2">{report.laundryCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Laundry Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Laundry Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employeeLaundryStats.map((stat, index) => (
              <div key={stat.id ?? stat.employee ?? index} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium">{stat.employee}</p>
                  <p className="text-sm text-gray-600">Last: {stat.lastLaundry}</p>
                </div>
                <div className="text-right">
                  <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{stat.laundryCount}</div>
                  <div className="text-xs text-gray-600">loads today</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Room Status Details */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Room Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {roomData.map((room, index) => (
              <div key={room.id ?? room.number ?? index} className="flex items-center justify-between p-3 bg-white rounded border">
                <div className="flex items-center gap-3">
                  <div className="font-bold text-lg min-w-[2rem] text-center">
                    {room.room}
                  </div>
                  <div className={`w-3 h-3 rounded-full ${roomStatusColors[room.status]}`}></div>
                  <div>
                    <p className="font-medium capitalize">{room.status.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-600">Updated: {room.lastUpdated}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{room.employee}</p>
                  <p className="text-xs text-gray-500">Assigned staff</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
const TimeOffApprovalsTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState(''); // 'approve' or 'reject'
  const [approvalComments, setApprovalComments] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');

  useEffect(() => {
    fetchTimeOffRequests();
  }, []);

  const fetchTimeOffRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/time-off/requests/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const requests = response.data || [];
      setAllRequests(requests);
      setPendingRequests(requests.filter(req => req.status === 'pending'));
    } catch (error) {
      console.error('Failed to load approval queue', error);
      setAllRequests([]);
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = async (request, action) => {
    setSelectedRequest(request);
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  const processApproval = async () => {
    if (!selectedRequest || !approvalAction) return;

    try {
      const updateData = {
        status: approvalAction === 'approve' ? 'approved' : 'rejected',
        approvalComments,
        approvedBy: 'Current Assistant Manager', // Would be current user's name
        approvedDate: new Date().toISOString().split('T')[0]
      };

      // Try backend API
      try {
        await axios.put(`${API}/time-off/requests/${selectedRequest.id}/approve`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(`Request ${approvalAction === 'approve' ? 'approved' : 'rejected'} successfully!`);
        fetchTimeOffRequests(); // Refresh the list
      } catch (apiError) {
        // Update local state
        const updatedRequest = { ...selectedRequest, ...updateData };
        setAllRequests(prev => prev.map(req => req.id === selectedRequest.id ? updatedRequest : req));
        setPendingRequests(prev => prev.filter(req => req.id !== selectedRequest.id));
        toast.success(`Request ${approvalAction === 'approve' ? 'approved' : 'rejected'} successfully!`);
      }

      // Reset modal
      setShowApprovalModal(false);
      setSelectedRequest(null);
      setApprovalAction('');
      setApprovalComments('');

    } catch (error) {
      toast.error(`Failed to ${approvalAction} request`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRequestTypeIcon = (type) => {
    switch (type) {
      case 'vacation': return '🏖️';
      case 'sick': return '🤒';
      case 'personal': return '👨‍👩‍👧‍👦';
      case 'bereavement': return '🕊️';
      case 'maternity': return '👶';
      case 'emergency': return '🚨';
      default: return '📋';
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredRequests = allRequests.filter(req => 
    filterStatus === 'all' || req.status === filterStatus
  );

  const getApprovalStats = () => {
    const total = allRequests.length;
    const pending = allRequests.filter(req => req.status === 'pending').length;
    const approved = allRequests.filter(req => req.status === 'approved').length;
    const rejected = allRequests.filter(req => req.status === 'rejected').length;
    
    return { total, pending, approved, rejected };
  };

  const stats = getApprovalStats();

  return (
    <div className="space-y-6" data-testid="timeoff-approvals-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Time Off Approvals</h2>
        <div className="flex gap-2">
          <select
            className="px-3 py-1 border rounded"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All Requests</option>
          </select>
        </div>
      </div>

      {/* Approval Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Requests</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{stats.pending}</div>
              <div className="text-sm text-gray-600">Pending Approval</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{stats.approved}</div>
              <div className="text-sm text-gray-600">Approved</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{stats.rejected}</div>
              <div className="text-sm text-gray-600">Rejected</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests Queue (Priority Display) */}
      {stats.pending > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Urgent Actions Required</CardTitle>
            <CardDescription>High priority requests needing immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests
                .filter(req => req.priority === 'urgent' || req.priority === 'high')
                .map((request) => (
                  <div key={request.id} className="p-3 border-2 border-orange-200 bg-orange-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{getRequestTypeIcon(request.requestType)}</div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{request.employeeName}</h4>
                            <Badge className={getPriorityColor(request.priority)}>
                              {request.priority.toUpperCase()}
                            </Badge>
                            <span className="text-sm text-gray-600">{request.employeeDepartment}</span>
                          </div>
                          <p className="text-sm font-medium capitalize">{request.requestType} - {formatDate(request.startDate)} to {formatDate(request.endDate)} ({request.daysRequested} days)</p>
                          <p className="text-sm text-gray-600">{request.reason}</p>
                          {request.conflictsWith.length > 0 && (
                            <p className="text-sm text-red-600 mt-1">⚠️ Conflicts with other approved requests</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600"
                          onClick={() => handleApprovalAction(request, 'approve')}
                        >
                          ✅ Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => handleApprovalAction(request, 'reject')}
                        >
                          ❌ Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Requests */}
      <Card>
        <CardHeader>
          <CardTitle>All Time Off Requests</CardTitle>
          <CardDescription>
            Complete list of time off requests ({filteredRequests.length} {filterStatus === 'all' ? 'total' : filterStatus})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading requests...</p>
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="space-y-3">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {request.employeeName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{request.employeeName}</h3>
                          <Badge className={getStatusColor(request.status)}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                          <span className="text-sm text-gray-500">{request.employeeDepartment}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm"><strong>Type:</strong> {getRequestTypeIcon(request.requestType)} {request.requestType}</p>
                            <p className="text-sm"><strong>Dates:</strong> {formatDate(request.startDate)} - {formatDate(request.endDate)}</p>
                            <p className="text-sm"><strong>Duration:</strong> {request.daysRequested} days</p>
                            <p className="text-sm"><strong>Submitted:</strong> {formatDate(request.submittedDate)}</p>
                          </div>
                          <div>
                            <p className="text-sm"><strong>Reason:</strong> {request.reason}</p>
                            <p className="text-sm"><strong>Emergency Contact:</strong> {request.emergencyContact}</p>
                            <p className="text-sm"><strong>Coverage:</strong> {request.workCoverage}</p>
                            {request.approvedBy && (
                              <p className="text-sm text-green-600"><strong>Approved by:</strong> {request.approvedBy} on {formatDate(request.approvedDate)}</p>
                            )}
                          </div>
                        </div>

                        {request.conflictsWith.length > 0 && (
                          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-700">⚠️ <strong>Scheduling Conflicts:</strong> This request overlaps with other approved requests.</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {request.status === 'pending' && (
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600"
                          onClick={() => handleApprovalAction(request, 'approve')}
                        >
                          ✅ Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => handleApprovalAction(request, 'reject')}
                        >
                          ❌ Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No {filterStatus === 'all' ? '' : filterStatus} requests found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Action Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">
              {approvalAction === 'approve' ? '✅ Approve Request' : '❌ Reject Request'}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === 'approve' 
                ? 'Approve this time off request and notify the employee'
                : 'Reject this time off request and provide a reason'
              }
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Request Summary</h4>
                <p className="text-sm"><strong>Attendant:</strong> {selectedRequest.employeeName}</p>
                <p className="text-sm"><strong>Type:</strong> {selectedRequest.requestType}</p>
                <p className="text-sm"><strong>Dates:</strong> {formatDate(selectedRequest.startDate)} - {formatDate(selectedRequest.endDate)}</p>
                <p className="text-sm"><strong>Days:</strong> {selectedRequest.daysRequested}</p>
                <p className="text-sm"><strong>Reason:</strong> {selectedRequest.reason}</p>
              </div>
              <div>
                <Label>{approvalAction === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Reason *'}</Label>
                <textarea
                  className="w-full mt-1 p-2 border rounded h-20"
                  placeholder={approvalAction === 'approve' 
                    ? 'Any additional notes or conditions...'
                    : 'Please provide a clear reason for rejection...'
                  }
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowApprovalModal(false);
                setSelectedRequest(null);
                setApprovalAction('');
                setApprovalComments('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={processApproval}
              className={approvalAction === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
            >
              {approvalAction === 'approve' ? 'Approve Request' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Team Scheduling Tab - Assistant Manager Team Calendar and Shift Management
const TeamSchedulingTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [teamSchedules, setTeamSchedules] = useState([]);
  const [employees, setAttendants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAttendant, setSelectedAttendant] = useState('');
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
  
  // Form state for shift assignment
  const [shiftForm, setShiftForm] = useState({
    employeeId: '',
    date: '',
    startTime: '',
    endTime: '',
    shiftType: 'Regular',
    location: 'Main Office'
  });

  // Fetch real employees and team schedules from backend
  useEffect(() => {
    fetchAttendantsAndSchedules();
  }, []);

  const fetchAttendantsAndSchedules = async () => {
    setLoading(true);
    try {
      // Fetch actual employees from the system
      const employeesResponse = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const activeAttendants = employeesResponse.data.filter(user => user.is_active && user.role === 'attendant');
      setAttendants(activeAttendants.map(emp => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        department: emp.department || 'General'
      })));

      // Fetch real schedules from backend
      const schedulesResponse = await axios.get(`${API}/schedules/team`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const schedules = (schedulesResponse.data?.schedules || []).map((s) => ({
        id: s.id,
        employeeId: s.user_id,
        employeeName: s.user_name,
        date: s.date,
        startTime: s.shift_start,
        endTime: s.shift_end,
        type: 'Regular',
        status: s.status === 'completed' ? 'Completed' : 'Confirmed',
        location: 'Main Office',
        notes: s.notes || ''
      }));
      setTeamSchedules(schedules);
    } catch (error) {
      console.error('Error fetching team scheduling data:', error);
      toast.error(error.response?.data?.detail || 'Failed to load team scheduling data');
      setAttendants([]);
      setTeamSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const getSchedulesForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return teamSchedules.filter(schedule => schedule.date === dateStr);
  };

  const getWeeklySchedules = () => {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
    
    const weekSchedules = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const daySchedules = getSchedulesForDate(day);
      weekSchedules.push({
        date: day,
        schedules: daySchedules
      });
    }
    return weekSchedules;
  };

  const formatTime = (timeStr) => {
    return new Date(`2000-01-01T${timeStr}:00`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getShiftTypeColor = (type) => {
    switch (type) {
      case 'Regular': return 'bg-blue-100 text-blue-800';
      case 'Evening': return 'bg-orange-100 text-orange-800';
      case 'Night': return 'bg-purple-100 text-purple-800';
      case 'Early': return 'bg-green-100 text-green-800';
      case 'Overtime': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Confirmed': return 'bg-green-500';
      case 'Pending': return 'bg-yellow-500';
      case 'Cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleAssignShift = async () => {
    if (!shiftForm.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    
    if (!shiftForm.date || !shiftForm.startTime || !shiftForm.endTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.post(`${API}/schedules/assign`, {
        user_id: shiftForm.employeeId,
        date: shiftForm.date,
        shift_start: shiftForm.startTime,
        shift_end: shiftForm.endTime,
        notes: `${shiftForm.shiftType} - ${shiftForm.location}`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Shift assigned successfully!');
      fetchAttendantsAndSchedules(); // Refresh

      // Reset form and close modal
      setShiftForm({
        employeeId: '',
        date: '',
        startTime: '',
        endTime: '',
        shiftType: 'Regular',
        location: 'Main Office'
      });
      setShowAssignModal(false);
    } catch (error) {
      console.error('Error assigning shift:', error);
      toast.error(error.response?.data?.detail || 'Failed to assign shift');
    }
  };

  const getTeamStats = () => {
    const totalShifts = teamSchedules.length;
    const confirmedShifts = teamSchedules.filter(s => s.status === 'Confirmed').length;
    const pendingShifts = teamSchedules.filter(s => s.status === 'Pending').length;
    const totalHours = teamSchedules.reduce((sum, schedule) => {
      const start = new Date(`2000-01-01T${schedule.startTime}:00`);
      const end = new Date(`2000-01-01T${schedule.endTime}:00`);
      return sum + (end - start) / (1000 * 60 * 60);
    }, 0);

    return { totalShifts, confirmedShifts, pendingShifts, totalHours };
  };

  const stats = getTeamStats();

  return (
    <div className="space-y-6" data-testid="team-scheduling-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Team Scheduling</h2>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            Week View
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('month')}
          >
            Month View
          </Button>
          <Button
            onClick={() => setShowAssignModal(true)}
          >
            Assign Shift
          </Button>
        </div>
      </div>

      {/* Team Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{stats.totalShifts}</div>
              <div className="text-sm text-gray-600">Total Shifts</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{stats.confirmedShifts}</div>
              <div className="text-sm text-gray-600">Confirmed</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{stats.pendingShifts}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{Math.round(stats.totalHours)}</div>
              <div className="text-sm text-gray-600">Total Hours</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {viewMode === 'week' ? (
        /* Weekly Team Schedule View */
        <Card>
          <CardHeader>
            <CardTitle>️ Weekly Team Schedule</CardTitle>
            <CardDescription>
              Week of {new Date(selectedDate.getTime() - selectedDate.getDay() * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Week Navigation */}
            <div className="flex justify-between items-center mb-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(selectedDate.getDate() - 7);
                  setSelectedDate(newDate);
                }}
              >
                ← Previous Week
              </Button>
              <span className="font-medium">
                {new Date(selectedDate.getTime() - selectedDate.getDay() * 24 * 60 * 60 * 1000).toLocaleDateString()} - 
                {new Date(selectedDate.getTime() + (6 - selectedDate.getDay()) * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(selectedDate.getDate() + 7);
                  setSelectedDate(newDate);
                }}
              >
                Next Week →
              </Button>
            </div>

            {/* Weekly Grid */}
            <div className="grid grid-cols-8 gap-2">
              {/* Header */}
              <div className="font-medium text-center py-2">Attendant</div>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="font-medium text-center py-2">{day}</div>
              ))}

              {/* Attendant Rows */}
              {employees.map(employee => (
                <React.Fragment key={employee.id}>
                  <div className="p-2 text-sm font-medium border-r">
                    <div className="truncate">{employee.name}</div>
                    <div className="text-xs text-gray-500">{employee.department}</div>
                  </div>
                  {getWeeklySchedules().map(({ date, schedules }) => {
                    const employeeSchedules = schedules.filter(s => s.employeeId === employee.id);
                    const dayKey = date.toISOString();
                    return (
                      <div key={`${employee.id}-${dayKey}`} className="border rounded p-1 min-h-[80px] bg-gray-50">
                        {employeeSchedules.map((schedule, idx) => (
                          <div key={schedule.id ?? `${employee.id}-${dayKey}-${idx}`} className={`text-xs p-1 rounded mb-1 ${getShiftTypeColor(schedule.type)}`}>
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${getStatusColor(schedule.status)}`}></div>
                              <span className="font-medium">{formatTime(schedule.startTime)}</span>
                            </div>
                            <div className="truncate">{schedule.type}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Monthly Calendar View */
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border w-full"
                modifiers={{
                  hasSchedule: teamSchedules.map(s => new Date(s.date))
                }}
                modifiersStyles={{
                  hasSchedule: {
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontWeight: 'bold'
                  }
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Team Schedule - {selectedDate.toLocaleDateString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getSchedulesForDate(selectedDate).length > 0 ? (
                  getSchedulesForDate(selectedDate).map((schedule) => (
                    <div key={schedule.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">{schedule.employeeName}</div>
                          <div className="text-sm text-gray-600">
                            {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(schedule.status)}`}></div>
                          <Badge variant="outline" className={getShiftTypeColor(schedule.type)}>
                            {schedule.type}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{schedule.location}</p>
                      <p className="text-xs mt-2">Status: <span className="capitalize font-medium">{schedule.status}</span></p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <p>No team shifts scheduled for this date</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Shift Assignment Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">Assign New Shift</DialogTitle>
            <DialogDescription>
              Create a new shift assignment for team members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Attendant</label>
              <select 
                className="w-full mt-1 p-2 border rounded"
                value={shiftForm.employeeId}
                onChange={(e) => setShiftForm({...shiftForm, employeeId: e.target.value})}
              >
                <option value="">Select Attendant...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Date</label>
              <input 
                type="date" 
                className="w-full mt-1 p-2 border rounded"
                value={shiftForm.date}
                onChange={(e) => setShiftForm({...shiftForm, date: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <input 
                  type="time" 
                  className="w-full mt-1 p-2 border rounded"
                  value={shiftForm.startTime}
                  onChange={(e) => setShiftForm({...shiftForm, startTime: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Time</label>
                <input 
                  type="time" 
                  className="w-full mt-1 p-2 border rounded"
                  value={shiftForm.endTime}
                  onChange={(e) => setShiftForm({...shiftForm, endTime: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Shift Type</label>
              <select 
                className="w-full mt-1 p-2 border rounded"
                value={shiftForm.shiftType}
                onChange={(e) => setShiftForm({...shiftForm, shiftType: e.target.value})}
              >
                <option value="Regular">Regular</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
                <option value="Early">Early</option>
                <option value="Overtime">Overtime</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <input 
                type="text" 
                placeholder="Main Office, Remote, etc." 
                className="w-full mt-1 p-2 border rounded"
                value={shiftForm.location}
                onChange={(e) => setShiftForm({...shiftForm, location: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAssignModal(false);
                setShiftForm({
                  employeeId: '',
                  date: '',
                  startTime: '',
                  endTime: '',
                  shiftType: 'Regular',
                  location: 'Main Office'
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignShift}>
              Assign Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TeamReportsTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');
  const [reportType, setReportType] = useState('overview');
  const [teamSummary, setTeamSummary] = useState(null);

  useEffect(() => {
    fetchTeamReports();
  }, [selectedPeriod, reportType]);

  const fetchTeamReports = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/reports/team?period=${selectedPeriod}&type=${reportType}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamData(response.data.employees || []);
      setTeamSummary(response.data || null);
    } catch (error) {
      console.error('fetchTeamReports failed', error);
      toast.error(error.response?.data?.detail || 'Failed to load team reports');
      setTeamData([]);
      setTeamSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (value, type = 'efficiency') => {
    if (type === 'efficiency' || type === 'punctuality') {
      if (value >= 95) return 'text-green-600 bg-green-50';
      if (value >= 85) return 'text-blue-600 bg-blue-50';
      if (value >= 75) return 'text-orange-600 bg-orange-50';
      return 'text-red-600 bg-red-50';
    }
    return 'text-gray-600';
  };

  const exportTeamReport = () => {
    const headers = ['Attendant', 'Role', 'Total Hours', 'Days Worked', 'Avg Hours/Day', 'Efficiency %', 'Punctuality %', 'Rooms Managed', 'Late Arrivals', 'Early Departures', 'Overtime Hours'];
    const csvData = teamData.map(emp => [
      emp.name,
      emp.role,
      emp.totalHours,
      emp.daysWorked,
      emp.avgHoursPerDay,
      emp.efficiency,
      emp.punctuality,
      emp.roomsManaged,
      emp.lateArrivals,
      emp.earlyDepartures,
      emp.overtimeHours
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Team report exported successfully!');
  };

  return (
    <div className="space-y-6" data-testid="team-reports-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Team Reports</h2>
        <div className="flex gap-2">
          <select
            className="px-3 py-1 border rounded"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="current_week">This Week</option>
            <option value="current_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="current_year">This Year</option>
          </select>
          <select
            className="px-3 py-1 border rounded"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="overview">Overview</option>
            <option value="performance">Performance</option>
            <option value="attendance">Attendance</option>
            <option value="productivity">Productivity</option>
          </select>
          <Button onClick={exportTeamReport} variant="outline" size="sm">Export Report
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading team reports...</p>
        </div>
      ) : (
        <>
          {/* Team Summary Dashboard */}
          {teamSummary && (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{teamSummary.totalAttendants}</div>
                    <div className="text-sm text-gray-600">Team Members</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{teamSummary.totalHours}</div>
                    <div className="text-sm text-gray-600">Total Hours</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{teamSummary.avgEfficiency}%</div>
                    <div className="text-sm text-gray-600">Avg Efficiency</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{teamSummary.avgPunctuality}%</div>
                    <div className="text-sm text-gray-600">Avg Punctuality</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{teamSummary.totalRoomsManaged}</div>
                    <div className="text-sm text-gray-600">Rooms Managed</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="font-heading text-xl font-bold tabular-nums text-foreground">⭐</div>
                    <div className="text-xs text-gray-600">Top Performer</div>
                    <div className="text-sm font-medium">{teamSummary.topPerformer?.name}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Performance Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Team Performance Comparison</CardTitle>
              <CardDescription>Individual employee performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {teamData.length > 0 ? (
                <div className="space-y-4">
                  {/* Performance bars */}
                  {teamData.map((employee) => (
                    <div key={employee.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{employee.name}</span>
                        <span className="text-sm text-gray-600">{employee.efficiency}% efficiency</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all duration-500 ${
                            employee.efficiency >= 95 ? 'bg-green-500' :
                            employee.efficiency >= 85 ? 'bg-blue-500' :
                            employee.efficiency >= 75 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(employee.efficiency, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No team data available for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Team Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Team Analytics</CardTitle>
              <CardDescription>Comprehensive performance breakdown by employee</CardDescription>
            </CardHeader>
            <CardContent>
              {teamData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3">Attendant</th>
                        <th className="text-center p-3">Total Hours</th>
                        <th className="text-center p-3">Days Worked</th>
                        <th className="text-center p-3">Avg/Day</th>
                        <th className="text-center p-3">Efficiency</th>
                        <th className="text-center p-3">Punctuality</th>
                        <th className="text-center p-3">Rooms</th>
                        <th className="text-center p-3">Late/Early</th>
                        <th className="text-center p-3">Overtime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamData.map((employee) => (
                        <tr key={employee.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-medium text-xs">
                                  {employee.name.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium">{employee.name}</div>
                                <div className="text-xs text-gray-500 capitalize">{employee.role}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-center p-3 font-medium">{employee.totalHours}h</td>
                          <td className="text-center p-3">{employee.daysWorked}</td>
                          <td className="text-center p-3">{employee.avgHoursPerDay}h</td>
                          <td className="text-center p-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPerformanceColor(employee.efficiency)}`}>
                              {employee.efficiency}%
                            </span>
                          </td>
                          <td className="text-center p-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPerformanceColor(employee.punctuality, 'punctuality')}`}>
                              {employee.punctuality}%
                            </span>
                          </td>
                          <td className="text-center p-3 font-medium text-purple-600">{employee.roomsManaged}</td>
                          <td className="text-center p-3">
                            <div className="text-xs">
                              <span className="text-red-600">{employee.lateArrivals}L</span>/
                              <span className="text-orange-600">{employee.earlyDepartures}E</span>
                            </div>
                          </td>
                          <td className="text-center p-3 font-medium text-green-600">{employee.overtimeHours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No team analytics available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Insights & Recommendations */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>Highest performing team members this period</CardDescription>
              </CardHeader>
              <CardContent>
                {teamSummary ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-1">Highest Efficiency</h4>
                      <p className="text-sm text-green-700">
                        {teamSummary.topPerformer?.name} - {teamSummary.topPerformer?.efficiency}% efficiency
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-1">Best Punctuality</h4>
                      <p className="text-sm text-blue-700">
                        {teamSummary.mostPunctual?.name} - {teamSummary.mostPunctual?.punctuality}% punctuality
                      </p>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <h4 className="font-medium text-purple-800 mb-1">Room Management Leader</h4>
                      <p className="text-sm text-purple-700">
                        {(() => {
                          const leader = [...teamData].sort(
                            (a, b) => (b.roomsManaged || 0) - (a.roomsManaged || 0),
                          )[0];
                          return leader && leader.roomsManaged
                            ? `${leader.name} - ${leader.roomsManaged} rooms managed`
                            : 'No data yet';
                        })()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">Performance data loading...</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Management Insights</CardTitle>
                <CardDescription>Computed from this period's data</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const observations = [];
                  const totalLate = teamData.reduce((acc, e) => acc + (e.lateArrivals || 0), 0);
                  const totalOvertime = teamData.reduce((acc, e) => acc + (e.overtimeHours || 0), 0);
                  const avgEff = teamSummary?.avgEfficiency ? parseFloat(teamSummary.avgEfficiency) : null;
                  const avgPunct = teamSummary?.avgPunctuality ? parseFloat(teamSummary.avgPunctuality) : null;

                  if (totalLate >= teamData.length && teamData.length > 0) {
                    observations.push({ kind: 'warn', text: `Late arrivals: ${totalLate} instance(s) this period` });
                  }
                  if (avgPunct !== null && avgPunct < 90) {
                    observations.push({ kind: 'warn', text: `Average punctuality is ${avgPunct.toFixed(1)}% — below 90%` });
                  }
                  if (avgEff !== null && avgEff >= 95) {
                    observations.push({ kind: 'good', text: `Strong team efficiency at ${avgEff.toFixed(1)}%` });
                  }
                  if (totalOvertime > 0) {
                    observations.push({ kind: 'good', text: `Overtime contribution: ${totalOvertime.toFixed(1)}h across the team` });
                  }
                  if (teamSummary?.topPerformer) {
                    observations.push({ kind: 'good', text: `Top performer: ${teamSummary.topPerformer.name}` });
                  }

                  if (observations.length === 0) {
                    return <p className="text-sm text-muted-foreground">No data yet — insights appear once time entries and room work are logged.</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {observations.map((o, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-md border text-sm ${
                            o.kind === 'good'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                        >
                          {o.text}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

const AttendantManagementTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [employees, setAttendants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAttendant, setSelectedAttendant] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Form states for add/edit employee
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'attendant',
    manager_id: ''
  });

  useEffect(() => {
    fetchAttendants();
  }, []);

  const fetchAttendants = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

      // Fetch the employees list + the team-wide aggregates in parallel.
      const [usersRes, schedulesRes, roomReportRes] = await Promise.all([
        axios.get(`${API}/users`, authHeaders),
        axios.get(`${API}/schedules/team`, authHeaders).catch(() => ({ data: { schedules: [] } })),
        axios.get(`${API}/rooms/report`, authHeaders).catch(() => ({ data: { employee_performance: {} } })),
      ]);

      const employeesData = usersRes.data || [];
      const schedules = schedulesRes.data?.schedules || [];
      const roomPerf = roomReportRes.data?.employee_performance || {};

      // Per-user schedule aggregates (computed once, looked up per row)
      const scheduleByUser = {};
      const today = new Date().toISOString().split('T')[0];
      schedules.forEach((s) => {
        const uid = s.user_id;
        if (!scheduleByUser[uid]) {
          scheduleByUser[uid] = { upcomingShifts: 0, lastScheduleUpdate: null };
        }
        if (s.date && s.date >= today) {
          scheduleByUser[uid].upcomingShifts += 1;
        }
        const ts = s.created_at || s.date;
        if (ts && (!scheduleByUser[uid].lastScheduleUpdate || ts > scheduleByUser[uid].lastScheduleUpdate)) {
          scheduleByUser[uid].lastScheduleUpdate = ts;
        }
      });

      const enrichedAttendants = await Promise.all(
        employeesData.map(async (employee) => {
          let timeData = null;
          try {
            const timeResponse = await axios.get(
              `${API}/reports/employee/${employee.id}/time-summary`,
              authHeaders,
            );
            timeData = timeResponse.data;
          } catch {
            timeData = null;
          }

          const sched = scheduleByUser[employee.id] || { upcomingShifts: 0, lastScheduleUpdate: null };
          const scheduleData = {
            upcomingShifts: sched.upcomingShifts,
            preferredShift: '—',
            schedulingConflicts: 0,
            lastScheduleUpdate: sched.lastScheduleUpdate
              ? sched.lastScheduleUpdate.split('T')[0]
              : '—',
          };

          const perf = roomPerf[employee.id] || {};
          const completed = perf.rooms_completed || 0;
          const pending = perf.rooms_pending || 0;
          const total = completed + pending;
          const roomData = {
            roomsAssigned: total,
            roomsCompleted: completed,
            roomEfficiency: total ? ((completed / total) * 100).toFixed(1) : '0.0',
            avgRoomTime: '—',
            specializations: '—',
          };

          return { ...employee, timeData, scheduleData, roomData };
        }),
      );

      setAttendants(enrichedAttendants);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error(error.response?.data?.detail || 'Failed to load employees');
      setAttendants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAttendant = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await axios.post(`${API}/users`, formData);
      toast.success('Attendant added successfully');
      fetchAttendants();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add employee');
    }
  };

  const handleEditAttendant = async () => {
    try {
      const updateData = { ...formData };
      if (!updateData.password) {
        delete updateData.password; // Don't update password if not provided
      }
      
      const response = await axios.put(`${API}/users/${selectedAttendant.id}`, updateData);
      toast.success('Attendant updated successfully');
      fetchAttendants();
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update employee');
    }
  };

  const handleDeleteAttendant = async (employeeId, employeeName) => {
    if (!confirm(`Are you sure you want to delete ${employeeName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/users/${employeeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Employee deleted successfully');
      fetchAttendants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete employee');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEmployees.length === 0) {
      toast.error('Please select at least one employee to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedEmployees.length} employee(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(
        `${API}/users/bulk-delete`,
        { user_ids: selectedEmployees },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { deleted_count = 0, not_found_count = 0, skipped_self = 0 } = response.data || {};

      if (deleted_count > 0) {
        toast.success(`Successfully deleted ${deleted_count} employee(s)`);
      }
      if (not_found_count > 0) {
        toast.error(`${not_found_count} employee(s) not found`);
      }
      if (skipped_self > 0) {
        toast.error('Your own account was skipped (cannot self-delete)');
      }

      setSelectedEmployees([]);
      setSelectAll(false);
      fetchAttendants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete employees');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees([]);
      setSelectAll(false);
    } else {
      setSelectedEmployees(employees.map(emp => emp.id));
      setSelectAll(true);
    }
  };

  const handleSelectEmployee = (employeeId) => {
    if (selectedEmployees.includes(employeeId)) {
      setSelectedEmployees(selectedEmployees.filter(id => id !== employeeId));
      setSelectAll(false);
    } else {
      const newSelected = [...selectedEmployees, employeeId];
      setSelectedEmployees(newSelected);
      if (newSelected.length === employees.length) {
        setSelectAll(true);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'attendant',
      manager_id: ''
    });
    setSelectedAttendant(null);
  };

  const openEditModal = (employee) => {
    setSelectedAttendant(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      password: '', // Leave empty for security
      role: employee.role,
      manager_id: employee.manager_id || ''
    });
    setShowEditModal(true);
  };

  const filteredAttendants = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || employee.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ops_manager': return 'bg-purple-100 text-purple-800';
      case 'assistant_manager': return 'bg-blue-100 text-blue-800';
      case 'attendant': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'ops_manager': return 'OPS Manager';
      case 'assistant_manager': return 'Assistant Manager';
      case 'attendant': return 'Attendant';
      default: return role;
    }
  };

  return (
    <div className="space-y-6" data-testid="employee-management-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Employee Management</h2>
        <div className="flex gap-2">
          {selectedEmployees.length > 0 && (
            <Button 
              onClick={handleBulkDelete} 
              variant="destructive"
              disabled={loading}
            >Delete Selected ({selectedEmployees.length})
            </Button>
          )}
          <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600">
            Add Employee
          </Button>
        </div>
      </div>

      {/* Enhanced Statistics Cards with Integration Data */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{employees.length}</div>
              <div className="text-sm text-gray-600">Total Attendants</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">
                {employees.filter(e => e.is_active).length}
              </div>
              <div className="text-sm text-gray-600">Active Users</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">
                {employees.filter(e => e.timeData?.totalHours > 0).length}
              </div>
              <div className="text-sm text-gray-600">Working This Month</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">
                {employees.reduce((sum, e) => sum + (e.scheduleData?.upcomingShifts || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Scheduled Shifts</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">
                {employees.reduce((sum, e) => sum + (e.roomData?.roomsAssigned || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Rooms Assigned</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="font-heading text-2xl font-bold tabular-nums text-foreground">
                {(employees.reduce((sum, e) => sum + (e.timeData?.efficiency || 0), 0) / employees.length).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Avg Efficiency</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="md:w-48">
              <select
                className="w-full p-2 border rounded"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="attendant">Attendant</option>
                <option value="assistant_manager">Assistant Manager</option>
                <option value="ops_manager">OPS Manager</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendant List */}
      <Card>
        <CardHeader>
          <CardTitle>Attendant Directory ({filteredAttendants.length} employees)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading employees...</p>
            </div>
          ) : filteredAttendants.length > 0 ? (
            <div className="space-y-3">
              {/* Select All Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
                <label className="text-sm font-medium cursor-pointer" onClick={handleSelectAll}>
                  Select All ({employees.length} employees)
                </label>
                {selectedEmployees.length > 0 && (
                  <span className="text-sm text-blue-600 ml-2">
                    ({selectedEmployees.length} selected)
                  </span>
                )}
              </div>

              {filteredAttendants.map((employee) => (
                <div key={employee.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    {/* Checkbox for selection */}
                    <div className="flex items-start space-x-4 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(employee.id)}
                        onChange={() => handleSelectEmployee(employee.id)}
                        className="mt-4 w-4 h-4 cursor-pointer"
                      />
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-lg">
                          {employee.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{employee.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{employee.email}</p>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge className={getRoleBadge(employee.role)}>
                            {getRoleDisplay(employee.role)}
                          </Badge>
                          <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        {/* Integrated Data Display */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                          {/* Time Tracking Integration */}
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <h4 className="font-medium text-blue-800 text-sm mb-2">Time Tracking</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-blue-600">Hours this month:</span>
                                <span className="font-medium">{employee.timeData?.totalHours || 0}h</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-blue-600">Efficiency:</span>
                                <span className={`font-medium ${
                                  (employee.timeData?.efficiency || 0) >= 95 ? 'text-green-600' : 
                                  (employee.timeData?.efficiency || 0) >= 85 ? 'text-blue-600' : 'text-orange-600'
                                }`}>
                                  {employee.timeData?.efficiency || 0}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-blue-600">Punctuality:</span>
                                <span className="font-medium">{employee.timeData?.punctuality || 0}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Scheduling Integration */}
                          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                            <h4 className="font-medium text-green-800 text-sm mb-2">Scheduling</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-green-600">Upcoming shifts:</span>
                                <span className="font-medium">{employee.scheduleData?.upcomingShifts || 0}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-600">Conflicts:</span>
                                <span className={`font-medium ${
                                  (employee.scheduleData?.schedulingConflicts || 0) > 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {employee.scheduleData?.schedulingConflicts || 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Room Management Integration */}
                          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                            <h4 className="font-medium text-purple-800 text-sm mb-2">Room Management</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-purple-600">Rooms assigned:</span>
                                <span className="font-medium">{employee.roomData?.roomsAssigned || 0}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-purple-600">Completed:</span>
                                <span className="font-medium text-green-600">{employee.roomData?.roomsCompleted || 0}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-purple-600">Room efficiency:</span>
                                <span className="font-medium">{employee.roomData?.roomEfficiency || 0}%</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Performance Indicators */}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              (employee.timeData?.efficiency || 0) >= 95 ? 'bg-green-500' :
                              (employee.timeData?.efficiency || 0) >= 85 ? 'bg-blue-500' :
                              (employee.timeData?.efficiency || 0) >= 75 ? 'bg-orange-500' : 'bg-red-500'
                            }`}></div>
                            <span className="text-xs text-gray-600">Overall Performance</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(employee)}
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteAttendant(employee.id, employee.name)}
                      >
                        🗑️ Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => {
                          toast.info(`Viewing detailed analytics for ${employee.name}`);
                          // Could open a detailed employee analytics modal
                        }}
                      >
                        📊 Analytics
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No employees found matching your criteria</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Attendant Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">Add New Attendant</DialogTitle>
            <DialogDescription>
              Create a new employee account in the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Full Name *</Label>
              <Input
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <Label>Password *</Label>
              <Input
                type="password"
                placeholder="Create password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="w-full p-2 border rounded"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="attendant">Attendant</option>
                <option value="assistant_manager">Assistant Manager</option>
                <option value="ops_manager">OPS Manager</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {setShowAddModal(false); resetForm();}}>
              Cancel
            </Button>
            <Button onClick={handleAddAttendant}>
              Add Attendant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Attendant Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">️ Edit Attendant</DialogTitle>
            <DialogDescription>
              Update employee information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Full Name *</Label>
              <Input
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <Label>New Password (leave blank to keep current)</Label>
              <Input
                type="password"
                placeholder="Enter new password or leave blank"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="w-full p-2 border rounded"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="attendant">Attendant</option>
                <option value="assistant_manager">Assistant Manager</option>
                <option value="ops_manager">OPS Manager</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {setShowEditModal(false); resetForm();}}>
              Cancel
            </Button>
            <Button onClick={handleEditAttendant}>
              Update Attendant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SystemAdminTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [activeSection, setActiveSection] = useState('tabs'); // 'tabs', 'settings', 'features', 'overview', 'schedules'
  
  // Draft configuration state
  const [draftConfig, setDraftConfig] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [publishing, setPublishing] = useState(false);
  
  // System stats
  const [systemStats, setSystemStats] = useState({
    total_users: 0,
    active_users: 0,
    total_messages: 0,
    total_time_entries: 0
  });

  useEffect(() => {
    if (token) {
      fetchDraftConfig();
      fetchSystemStats();
    }
  }, [token]);

  const fetchDraftConfig = async () => {
    try {
      const response = await axios.get(`${API}/config/app/draft`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDraftConfig(response.data);
    } catch (error) {
      console.error('Error fetching draft config:', error);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const usersResponse = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSystemStats({
        total_users: usersResponse.data.length,
        active_users: usersResponse.data.filter(u => u.is_active).length,
        total_messages: 0,
        total_time_entries: 0
      });
    } catch (error) {
      console.error('Error fetching system stats:', error);
    }
  };

  const saveDraft = async () => {
    try {
      await axios.put(`${API}/config/app/draft`, draftConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Draft saved successfully!');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    }
  };

  const publishChanges = async () => {
    setPublishing(true);
    try {
      // First save draft
      await axios.put(`${API}/config/app/draft`, draftConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Then publish
      await axios.post(`${API}/config/app/publish`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Changes published successfully! Reloading app...');
      setHasChanges(false);
      
      // Reload after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error publishing changes:', error);
      toast.error('Failed to publish changes');
    } finally {
      setPublishing(false);
    }
  };

  const updateConfig = (field, value) => {
    setDraftConfig({...draftConfig, [field]: value});
    setHasChanges(true);
  };

  if (!draftConfig) {
    return <div className="flex items-center justify-center h-64">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6" data-testid="system-admin-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">System Administration</h2>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={saveDraft}>
              Save Draft
            </Button>
          )}
          <Button 
            onClick={publishChanges} 
            disabled={publishing || !hasChanges}
            className="bg-green-600 hover:bg-green-700"
          >
            {publishing ? 'Publishing...' : '🚀 Publish Changes'}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ You have unpublished changes. Click "Publish Changes" to make them live.
          </p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-medium ${activeSection === 'overview' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          onClick={() => setActiveSection('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeSection === 'tabs' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          onClick={() => setActiveSection('tabs')}
        >
          📑 Tab Management
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeSection === 'settings' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          onClick={() => setActiveSection('settings')}
        >
          🎨 App Settings
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeSection === 'features' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          onClick={() => setActiveSection('features')}
        >
          🔧 Features
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeSection === 'schedules' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          onClick={() => setActiveSection('schedules')}
        >
          Schedule Management
        </button>
      </div>

      {/* Overview Section */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="font-heading text-3xl font-bold tabular-nums text-foreground">{systemStats.total_users}</div>
                  <div className="text-sm text-gray-600 mt-2">Total Users</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="font-heading text-3xl font-bold tabular-nums text-foreground">{systemStats.active_users}</div>
                  <div className="text-sm text-gray-600 mt-2">Active Users</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="font-heading text-3xl font-bold tabular-nums text-foreground">✓</div>
                  <div className="text-sm text-gray-600 mt-2">System Healthy</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="font-heading text-3xl font-bold tabular-nums text-foreground">v1.0</div>
                  <div className="text-sm text-gray-600 mt-2">App Version</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab Management Section */}
      {activeSection === 'tabs' && (
        <TabManagementSection 
          config={draftConfig} 
          updateConfig={updateConfig}
        />
      )}

      {/* App Settings Section */}
      {activeSection === 'settings' && (
        <AppSettingsSection 
          config={draftConfig} 
          updateConfig={updateConfig}
        />
      )}

      {/* Features Section */}
      {activeSection === 'features' && (
        <FeaturesSection 
          config={draftConfig} 
          updateConfig={updateConfig}
        />
      )}


      {/* Schedule Management Section */}
      {activeSection === 'schedules' && (
        <ScheduleManagementSection token={token} />
      )}
    </div>
  );
};


// Schedule Management Section Component
const ScheduleManagementSection = ({ token }) => {
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    date: new Date().toISOString().split('T')[0],
    shift_start: '09:00',
    shift_end: '17:00',
    break_duration: 30,
    notes: '',
    is_recurring: false,
    recurrence_type: 'daily',
    end_date: '',
    days_of_week: []
  });

  useEffect(() => {
    if (token) {
      fetchEmployees();
      fetchSchedules();
    }
  }, [token]);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/schedules/team`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSchedules(response.data.schedules || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSchedule = async () => {
    if (!formData.user_id || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate recurring fields
    if (formData.is_recurring) {
      if (!formData.end_date) {
        toast.error('Please specify an end date for recurring shift');
        return;
      }
      if (formData.recurrence_type === 'weekly' && formData.days_of_week.length === 0) {
        toast.error('Please select at least one day for weekly recurrence');
        return;
      }
    }

    try {
      if (formData.is_recurring) {
        // Use recurring schedule endpoint
        const response = await axios.post(`${API}/schedules/assign-recurring`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(`${response.data.created_count} recurring schedules created successfully!`);
      } else {
        // Use single schedule endpoint
        await axios.post(`${API}/schedules/assign`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Schedule assigned successfully');
      }
      
      fetchSchedules();
      setShowAssignModal(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign schedule');
    }
  };

  const handleUpdateSchedule = async () => {
    try {
      await axios.put(`${API}/schedules/${selectedSchedule.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Schedule updated successfully');
      fetchSchedules();
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId, employeeName) => {
    if (!confirm(`Are you sure you want to delete this schedule for ${employeeName}?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/schedules/${scheduleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Schedule deleted successfully');
      fetchSchedules();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete schedule');
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: '',
      date: new Date().toISOString().split('T')[0],
      shift_start: '09:00',
      shift_end: '17:00',
      break_duration: 30,
      notes: '',
      is_recurring: false,
      recurrence_type: 'daily',
      end_date: '',
      days_of_week: []
    });
    setSelectedSchedule(null);
  };

  const openEditModal = (schedule) => {
    setSelectedSchedule(schedule);
    setFormData({
      user_id: schedule.user_id,
      date: schedule.date,
      shift_start: schedule.shift_start,
      shift_end: schedule.shift_end,
      break_duration: schedule.break_duration || 30,
      notes: schedule.notes || ''
    });
    setShowEditModal(true);
  };

  const downloadTemplate = () => {
    // Create CSV content with proper format
    const headers = ['Employee Email*', 'Date (YYYY-MM-DD)*', 'Start Time (HH:MM)*', 'End Time (HH:MM)*', 'Break Duration (minutes)', 'Notes'];
    const exampleRows = [
      ['john@company.com', '2025-01-15', '09:00', '17:00', '30', 'Morning shift'],
      ['jane@company.com', '2025-01-15', '14:00', '22:00', '30', 'Evening shift'],
      ['', '', '', '', '', '']
    ];
    
    // Add instructions
    const instructions = [
      ['INSTRUCTIONS:'],
      ['1. Fill in employee email addresses (must match registered emails in the system)'],
      ['2. Use date format: YYYY-MM-DD (e.g., 2025-01-15)'],
      ['3. Use 24-hour time format: HH:MM (e.g., 09:00, 17:00)'],
      ['4. Break duration is in minutes (default: 30)'],
      ['5. Fields marked with * are required'],
      ['6. Delete these instruction rows before uploading'],
      [''],
      ['TEMPLATE:']
    ];
    
    const csvContent = [
      ...instructions,
      headers,
      ...exampleRows
    ].map(row => row.join(',')).join('\n');
    
    // Create downloadable file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `schedule_template_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Template downloaded! Fill it out and upload to create schedules.');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Find the header row (starts with "Employee Email")
        const headerIndex = lines.findIndex(line => line.toLowerCase().includes('employee email'));
        if (headerIndex === -1) {
          toast.error('Invalid template format. Please use the downloaded template.');
          return;
        }
        
        // Parse data rows (skip header and instructions)
        const dataRows = lines.slice(headerIndex + 1).filter(line => {
          const cols = line.split(',');
          return cols[0] && cols[0].includes('@'); // Has email
        });
        
        if (dataRows.length === 0) {
          toast.error('No valid data found in the file.');
          return;
        }
        
        // Parse schedules
        const schedulesToCreate = [];
        const errors = [];
        
        dataRows.forEach((line, idx) => {
          const cols = line.split(',').map(col => col.trim());
          const [email, date, startTime, endTime, breakDuration, notes] = cols;
          
          // Validate required fields
          if (!email || !date || !startTime || !endTime) {
            errors.push(`Row ${idx + 2}: Missing required fields`);
            return;
          }
          
          // Validate email format
          if (!email.includes('@')) {
            errors.push(`Row ${idx + 2}: Invalid email format`);
            return;
          }
          
          // Validate date format (YYYY-MM-DD)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            errors.push(`Row ${idx + 2}: Invalid date format. Use YYYY-MM-DD`);
            return;
          }
          
          // Validate time format (HH:MM)
          if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
            errors.push(`Row ${idx + 2}: Invalid time format. Use HH:MM (24-hour)`);
            return;
          }
          
          schedulesToCreate.push({
            user_id: email, // Backend will convert email to user_id
            date: date,
            shift_start: startTime,
            shift_end: endTime,
            break_duration: parseInt(breakDuration) || 30,
            notes: notes || ''
          });
        });
        
        if (errors.length > 0) {
          toast.error(`Found ${errors.length} errors. Check console for details.`);
          console.error('Upload errors:', errors);
          return;
        }
        
        if (schedulesToCreate.length === 0) {
          toast.error('No valid schedules to upload.');
          return;
        }
        
        // Send to backend
        setLoading(true);
        const response = await axios.post(`${API}/schedules/bulk-upload`, schedulesToCreate, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        toast.success(`${response.data.created_count} schedules uploaded successfully!`);
        
        if (response.data.errors && response.data.errors.length > 0) {
          console.warn('Upload warnings:', response.data.errors);
          toast.warning(`${response.data.errors.length} rows had issues. Check console for details.`);
        }
        
        // Refresh schedules
        fetchSchedules();
        
        // Reset file input
        event.target.value = '';
        
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(error.response?.data?.detail || 'Failed to upload schedules');
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Schedule Management</h3>
          <p className="text-sm text-gray-600">Assign and manage employee schedules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <span className="mr-2">📥</span> Download Template
          </Button>
          <label htmlFor="schedule-upload" className="cursor-pointer">
            <Button variant="outline" onClick={() => document.getElementById('schedule-upload').click()}>
              <span className="mr-2">📤</span> Upload Template
            </Button>
          </label>
          <input
            id="schedule-upload"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button onClick={() => setShowAssignModal(true)}>
            <span className="mr-2">➕</span> Assign Schedule
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Break</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    No schedules assigned yet
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{schedule.user_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{schedule.date}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{schedule.shift_start} - {schedule.shift_end}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{schedule.break_duration || 30} min</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">{schedule.notes || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(schedule)}
                        className="mr-2"
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteSchedule(schedule.id, schedule.user_name)}
                      >
                        🗑️ Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Schedule Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">Assign Schedule</DialogTitle>
            <DialogDescription>
              Assign a new schedule to an employee
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Employee *</Label>
              <select
                className="w-full p-2 border rounded"
                value={formData.user_id}
                onChange={(e) => setFormData({...formData, user_id: e.target.value})}
              >
                <option value="">Select employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Shift Start *</Label>
                <Input
                  type="time"
                  value={formData.shift_start}
                  onChange={(e) => setFormData({...formData, shift_start: e.target.value})}
                />
              </div>
              <div>
                <Label>Shift End *</Label>
                <Input
                  type="time"
                  value={formData.shift_end}
                  onChange={(e) => setFormData({...formData, shift_end: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Break Duration (minutes)</Label>
              <Input
                type="number"
                value={formData.break_duration}
                onChange={(e) => setFormData({...formData, break_duration: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                className="w-full p-2 border rounded"
                rows="3"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Add any notes about this shift..."
              />
            </div>

            {/* Recurring Shift Options */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({...formData, is_recurring: e.target.checked})}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_recurring" className="font-semibold">Make this a recurring shift</Label>
              </div>

              {formData.is_recurring && (
                <div className="space-y-4 bg-blue-50 p-4 rounded-lg">
                  <div>
                    <Label>Recurrence Pattern *</Label>
                    <select
                      className="w-full p-2 border rounded"
                      value={formData.recurrence_type}
                      onChange={(e) => setFormData({...formData, recurrence_type: e.target.value})}
                    >
                      <option value="daily">Daily (Every day)</option>
                      <option value="weekly">Weekly (Specific days)</option>
                      <option value="monthly">Monthly (Same day each month)</option>
                    </select>
                  </div>

                  {formData.recurrence_type === 'weekly' && (
                    <div>
                      <Label>Select Days of Week *</Label>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {[
                          { value: 0, label: 'Sun' },
                          { value: 1, label: 'Mon' },
                          { value: 2, label: 'Tue' },
                          { value: 3, label: 'Wed' },
                          { value: 4, label: 'Thu' },
                          { value: 5, label: 'Fri' },
                          { value: 6, label: 'Sat' }
                        ].map(day => (
                          <label key={day.value} className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.days_of_week.includes(day.value)}
                              onChange={(e) => {
                                const newDays = e.target.checked
                                  ? [...formData.days_of_week, day.value]
                                  : formData.days_of_week.filter(d => d !== day.value);
                                setFormData({...formData, days_of_week: newDays.sort()});
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">{day.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>End Date *</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                      min={formData.date}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Shifts will be created from {formData.date} to this date
                    </p>
                  </div>

                  <div className="bg-blue-100 p-3 rounded text-sm">
                    <strong>Preview:</strong> This will create {
                      formData.recurrence_type === 'daily' ? 'daily shifts' :
                      formData.recurrence_type === 'weekly' ? `shifts on ${formData.days_of_week.length} selected day(s) per week` :
                      'monthly shifts'
                    } from {formData.date} to {formData.end_date || '(select end date)'}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {setShowAssignModal(false); resetForm();}}>
              Cancel
            </Button>
            <Button onClick={handleAssignSchedule}>
              {formData.is_recurring ? '🔄 Create Recurring Schedules' : 'Assign Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">️ Edit Schedule</DialogTitle>
            <DialogDescription>
              Update schedule information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Employee *</Label>
              <select
                className="w-full p-2 border rounded"
                value={formData.user_id}
                onChange={(e) => setFormData({...formData, user_id: e.target.value})}
              >
                <option value="">Select employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Shift Start *</Label>
                <Input
                  type="time"
                  value={formData.shift_start}
                  onChange={(e) => setFormData({...formData, shift_start: e.target.value})}
                />
              </div>
              <div>
                <Label>Shift End *</Label>
                <Input
                  type="time"
                  value={formData.shift_end}
                  onChange={(e) => setFormData({...formData, shift_end: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Break Duration (minutes)</Label>
              <Input
                type="number"
                value={formData.break_duration}
                onChange={(e) => setFormData({...formData, break_duration: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                className="w-full p-2 border rounded"
                rows="3"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Add any notes about this shift..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {setShowEditModal(false); resetForm();}}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSchedule}>
              Update Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


// Tab Management Section Component
const TabManagementSection = ({ config, updateConfig }) => {
  const [selectedRole, setSelectedRole] = useState('attendant');
  
  const defaultTabs = {
    attendant: [
      { id: 'timecard', label: 'Time Card', icon: '🕒', category: 'time', enabled: true, order: 1 },
      { id: 'rooms', label: 'Room Management', icon: '🏠', category: 'operations', enabled: true, order: 2 },
      { id: 'timeoff', label: 'Time Off Requests', icon: '🏖️', category: 'time', enabled: true, order: 3 },
      { id: 'schedule', label: 'My Schedule', icon: '📅', category: 'planning', enabled: true, order: 4 },
      { id: 'reports', label: 'Reports', icon: '📊', category: 'reports', enabled: true, order: 5 },
      { id: 'communication', label: 'Messages', icon: '💬', category: 'communication', enabled: true, order: 6 },
      { id: 'organization', label: 'Organization', icon: '🏢', category: 'organization', enabled: true, order: 7 },
      { id: 'profile', label: 'Profile', icon: '👤', category: 'personal', enabled: true, order: 8 }
    ],
    assistant_manager: [
      { id: 'overview', label: 'Team Overview', icon: '📈', category: 'management', enabled: true, order: 9 },
      { id: 'timecards', label: 'Team Time Cards', icon: '🕒', category: 'time', enabled: true, order: 10 },
      { id: 'room-mgmt', label: 'Room Reports', icon: '🏨', category: 'operations', enabled: true, order: 11 },
      { id: 'timeoff-approvals', label: 'Time Off Approvals', icon: '✅', category: 'approvals', enabled: true, order: 12 },
      { id: 'scheduling', label: 'Scheduling', icon: '📅', category: 'planning', enabled: true, order: 13 },
      { id: 'team-reports', label: 'Team Reports', icon: '📊', category: 'reports', enabled: true, order: 14 },
      { id: 'employee-mgmt', label: 'Attendant Management', icon: '👥', category: 'management', enabled: true, order: 15 }
    ],
    ops_manager: [
      { id: 'admin', label: 'System Admin', icon: '⚙️', category: 'admin', enabled: true, order: 16 },
      { id: 'analytics', label: 'Analytics', icon: '📈', category: 'admin', enabled: true, order: 17 }
    ]
  };

  const getRoleTabs = () => {
    const roleKey = selectedRole === 'attendant' ? 'attendant_tabs' : 
                    selectedRole === 'assistant_manager' ? 'assistant_manager_tabs' : 'ops_manager_tabs';
    
    // If no tabs in config, use defaults
    if (!config[roleKey] || config[roleKey].length === 0) {
      return defaultTabs[selectedRole];
    }
    return config[roleKey];
  };

  const updateTabs = (tabs) => {
    const roleKey = selectedRole === 'attendant' ? 'attendant_tabs' : 
                    selectedRole === 'assistant_manager' ? 'assistant_manager_tabs' : 'ops_manager_tabs';
    updateConfig(roleKey, tabs);
  };

  const toggleTab = (tabId) => {
    const tabs = getRoleTabs().map(tab => 
      tab.id === tabId ? {...tab, enabled: !tab.enabled} : tab
    );
    updateTabs(tabs);
  };

  const updateTabLabel = (tabId, label) => {
    const tabs = getRoleTabs().map(tab => 
      tab.id === tabId ? {...tab, label} : tab
    );
    updateTabs(tabs);
  };

  const updateTabIcon = (tabId, icon) => {
    const tabs = getRoleTabs().map(tab => 
      tab.id === tabId ? {...tab, icon} : tab
    );
    updateTabs(tabs);
  };

  const moveTab = (tabId, direction) => {
    const tabs = [...getRoleTabs()];
    const index = tabs.findIndex(t => t.id === tabId);
    
    if (direction === 'up' && index > 0) {
      [tabs[index], tabs[index - 1]] = [tabs[index - 1], tabs[index]];
    } else if (direction === 'down' && index < tabs.length - 1) {
      [tabs[index], tabs[index + 1]] = [tabs[index + 1], tabs[index]];
    }
    
    // Update order
    tabs.forEach((tab, idx) => tab.order = idx + 1);
    updateTabs(tabs);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tab Configuration by Role</CardTitle>
          <p className="text-sm text-gray-600">Customize tabs for each user role</p>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label>Select Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attendant">Attendant</SelectItem>
                <SelectItem value="assistant_manager">Assistant Manager</SelectItem>
                <SelectItem value="ops_manager">OPS Manager (Additional Tabs)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {getRoleTabs().map((tab, index) => (
              <div key={tab.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveTab(tab.id, 'up')}
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    ⬆️
                  </button>
                  <button
                    onClick={() => moveTab(tab.id, 'down')}
                    disabled={index === getRoleTabs().length - 1}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    ⬇️
                  </button>
                </div>
                
                <Input
                  type="text"
                  value={tab.icon}
                  onChange={(e) => updateTabIcon(tab.id, e.target.value)}
                  className="w-16 text-center"
                  placeholder="📋"
                />
                
                <Input
                  type="text"
                  value={tab.label}
                  onChange={(e) => updateTabLabel(tab.id, e.target.value)}
                  className="flex-1"
                />
                
                <Badge variant={tab.enabled ? 'default' : 'secondary'}>
                  {tab.category}
                </Badge>
                
                <button
                  onClick={() => toggleTab(tab.id)}
                  className={`px-4 py-2 rounded ${tab.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                >
                  {tab.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// App Settings Section Component
const AppSettingsSection = ({ config, updateConfig }) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Company Name</Label>
            <Input
              value={config.company_name || ''}
              onChange={(e) => updateConfig('company_name', e.target.value)}
              placeholder="RSBC Workflow Pro"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme Colors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={config.theme_primary_color || '#3b82f6'}
                  onChange={(e) => updateConfig('theme_primary_color', e.target.value)}
                  className="w-20"
                />
                <Input
                  value={config.theme_primary_color || '#3b82f6'}
                  onChange={(e) => updateConfig('theme_primary_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label>Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={config.theme_accent_color || '#10b981'}
                  onChange={(e) => updateConfig('theme_accent_color', e.target.value)}
                  className="w-20"
                />
                <Input
                  value={config.theme_accent_color || '#10b981'}
                  onChange={(e) => updateConfig('theme_accent_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Default Shift Hours</Label>
              <Input
                type="number"
                value={config.default_shift_hours || 8}
                onChange={(e) => updateConfig('default_shift_hours', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label>Break Duration (minutes)</Label>
              <Input
                type="number"
                value={config.break_duration_minutes || 30}
                onChange={(e) => updateConfig('break_duration_minutes', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label>Overtime Threshold (hours/week)</Label>
              <Input
                type="number"
                value={config.overtime_threshold_hours || 40}
                onChange={(e) => updateConfig('overtime_threshold_hours', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label>Late Threshold (minutes)</Label>
              <Input
                type="number"
                value={config.late_threshold_minutes || 15}
                onChange={(e) => updateConfig('late_threshold_minutes', parseInt(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Features Section Component
const FeaturesSection = ({ config, updateConfig }) => {
  const features = [
    { key: 'enable_room_management', label: 'Room Management', description: 'Enable room status tracking and management' },
    { key: 'enable_time_off', label: 'Time Off System', description: 'Enable time off requests and approvals' },
    { key: 'enable_messages', label: 'Messaging System', description: 'Enable team communication and messages' },
    { key: 'enable_organization', label: 'Organization Chart', description: 'Enable organization hierarchy view' },
    { key: 'enable_analytics', label: 'Analytics Dashboard', description: 'Enable advanced analytics for managers' }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feature Toggles</CardTitle>
          <p className="text-sm text-gray-600">Enable or disable features across the entire app</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {features.map(feature => (
            <div key={feature.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-semibold">{feature.label}</div>
                <div className="text-sm text-gray-600">{feature.description}</div>
              </div>
              <button
                onClick={() => updateConfig(feature.key, !config[feature.key])}
                className={`px-6 py-2 rounded-full font-medium transition-colors ${
                  config[feature.key]
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 text-gray-700'
                }`}
              >
                {config[feature.key] ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const AnalyticsTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
  const [analytics, setAnalytics] = useState({
    timeTracking: {
      totalHours: 0,
      averageHoursPerAttendant: 0,
      attendanceRate: 0,
      totalAttendants: 0
    },
    roomManagement: {
      roomsCleaned: 0,
      averageTimePerRoom: '—',
      efficiency: 0,
      pendingRooms: 0
    },
    dailyHours: [0, 0, 0, 0, 0, 0, 0],
    dailyLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    maxHours: 1,
    topPerformers: []
  });

  useEffect(() => {
    if (token) {
      fetchAnalytics();
    }
  }, [token, dateRange]);

  const fetchAnalytics = async () => {
    try {
      // Fetch time tracking analytics
      const timeResponse = await axios.get(`${API}/time/entries`, {
        params: { start_date: dateRange.start, end_date: dateRange.end },
        headers: { Authorization: `Bearer ${token}` }
      });

      // Calculate time tracking metrics
      const entries = timeResponse.data || [];
      const totalHours = entries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
      const uniqueAttendants = new Set(entries.map(e => e.employee_id)).size;
      const averageHours = uniqueAttendants > 0 ? totalHours / uniqueAttendants : 0;
      const workingDays = Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24));
      const expectedHours = uniqueAttendants * workingDays * 8;
      const attendanceRate = expectedHours > 0 ? (totalHours / expectedHours) * 100 : 0;

      // Fetch room management analytics
      const roomResponse = await axios.get(`${API}/rooms/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const rooms = roomResponse.data || [];
      const cleanedRooms = rooms.filter(r => r.status === 'open_clean').length;
      const pendingRooms = rooms.filter(r => r.status === 'needs_cleaning').length;
      const totalRooms = rooms.length;
      const efficiency = totalRooms > 0 ? (cleanedRooms / totalRooms) * 100 : 0;

      // Per-day total hours over the last 7 days, for the trend chart
      const dailyHours = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
      const dailyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      entries.forEach((e) => {
        if (!e.date) return;
        const d = new Date(e.date);
        const dayIdx = (d.getDay() + 6) % 7; // shift Sunday=0 → 6
        dailyHours[dayIdx] += parseFloat(e.total_hours || 0);
      });
      const maxHours = Math.max(...dailyHours, 1);

      // Top performers (per-employee aggregates from same time entries)
      const perEmployee = {};
      entries.forEach((e) => {
        const id = e.employee_id;
        if (!id) return;
        if (!perEmployee[id]) {
          perEmployee[id] = { name: e.employee_name || 'Unknown', hours: 0, days: new Set() };
        }
        perEmployee[id].hours += parseFloat(e.total_hours || 0);
        if (e.date) perEmployee[id].days.add(e.date);
      });
      const topPerformers = Object.values(perEmployee)
        .map((p) => ({ name: p.name, hours: `${p.hours.toFixed(1)}h`, days: p.days.size }))
        .sort((a, b) => parseFloat(b.hours) - parseFloat(a.hours))
        .slice(0, 3);

      setAnalytics({
        timeTracking: {
          totalHours: totalHours.toFixed(1),
          averageHoursPerAttendant: averageHours.toFixed(1),
          attendanceRate: attendanceRate.toFixed(1),
          totalAttendants: uniqueAttendants
        },
        roomManagement: {
          roomsCleaned: cleanedRooms,
          averageTimePerRoom: '—',
          efficiency: efficiency.toFixed(1),
          pendingRooms: pendingRooms
        },
        dailyHours,
        dailyLabels,
        maxHours,
        topPerformers
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error(error.response?.data?.detail || 'Failed to load analytics');
      setAnalytics({
        timeTracking: { totalHours: '0', averageHoursPerAttendant: '0', attendanceRate: '0', totalAttendants: 0 },
        roomManagement: { roomsCleaned: 0, averageTimePerRoom: '—', efficiency: '0', pendingRooms: 0 },
        dailyHours: [0, 0, 0, 0, 0, 0, 0],
        dailyLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        maxHours: 1,
        topPerformers: []
      });
    }
  };

  const handleExportAnalytics = () => {
    const lines = [];
    lines.push('Analytics Report — exported ' + new Date().toLocaleString());
    lines.push(`Date Range,${dateRange.start},${dateRange.end}`);
    lines.push('');
    lines.push('TIME TRACKING');
    lines.push('Metric,Value');
    lines.push(`Total Hours,${analytics.timeTracking.totalHours}`);
    lines.push(`Avg Hours / Attendant,${analytics.timeTracking.averageHoursPerAttendant}`);
    lines.push(`Attendance Rate (%),${analytics.timeTracking.attendanceRate}`);
    lines.push(`Active Attendants,${analytics.timeTracking.totalAttendants}`);
    lines.push('');
    lines.push('ROOM MANAGEMENT');
    lines.push(`Rooms Clean,${analytics.roomManagement.roomsCleaned}`);
    lines.push(`Pending Rooms,${analytics.roomManagement.pendingRooms}`);
    lines.push(`Efficiency (%),${analytics.roomManagement.efficiency}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange.start}-to-${dateRange.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Analytics report exported');
  };

  return (
    <div className="space-y-6" data-testid="analytics-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Analytics</h2>
        <div className="flex gap-2">
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            className="w-40"
          />
          <span className="self-center">to</span>
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            className="w-40"
          />
        </div>
      </div>

      {/* Time Tracking Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Time Tracking Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-4xl font-bold text-blue-600">{analytics.timeTracking.totalHours}</div>
              <div className="text-sm text-gray-600 mt-2">Total Hours Worked</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-4xl font-bold text-green-600">{analytics.timeTracking.averageHoursPerAttendant}</div>
              <div className="text-sm text-gray-600 mt-2">Avg Hours/Attendant</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-4xl font-bold text-purple-600">{analytics.timeTracking.attendanceRate}%</div>
              <div className="text-sm text-gray-600 mt-2">Attendance Rate</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-4xl font-bold text-orange-600">{analytics.timeTracking.totalAttendants}</div>
              <div className="text-sm text-gray-600 mt-2">Active Attendants</div>
            </div>
          </div>

          {/* Real per-day hours bar chart */}
          <div className="mt-6">
            <div className="font-semibold mb-3">Daily Hours Trend</div>
            <div className="flex items-end justify-between gap-2 h-40">
              {analytics.dailyHours.map((hours, i) => {
                const heightPct = (hours / Math.max(analytics.maxHours, 1)) * 100;
                return (
                  <div
                    key={`bar-${i}`}
                    className="flex-1 bg-zinc-900 rounded-t flex items-end justify-center"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  >
                    <div className="text-[10px] text-white pb-1 tabular-nums">{hours.toFixed(0)}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              {analytics.dailyLabels.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Room Management Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Room Management Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-teal-50 rounded-lg">
              <div className="font-heading text-4xl font-bold tabular-nums text-foreground">{analytics.roomManagement.roomsCleaned}</div>
              <div className="text-sm text-gray-600 mt-2">Rooms Cleaned</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <div className="font-heading text-4xl font-bold tabular-nums text-foreground">{analytics.roomManagement.averageTimePerRoom}</div>
              <div className="text-sm text-gray-600 mt-2">Avg Time/Room</div>
            </div>
            <div className="text-center p-4 bg-pink-50 rounded-lg">
              <div className="text-4xl font-bold text-pink-600">{analytics.roomManagement.efficiency}%</div>
              <div className="text-sm text-gray-600 mt-2">Efficiency Rate</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-4xl font-bold text-red-600">{analytics.roomManagement.pendingRooms}</div>
              <div className="text-sm text-gray-600 mt-2">Pending Rooms</div>
            </div>
          </div>

          {/* Simple progress bars */}
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Room Completion Progress</span>
                <span className="font-semibold">{analytics.roomManagement.efficiency}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-gradient-to-r from-green-400 to-green-600 h-4 rounded-full transition-all duration-500"
                  style={{width: `${analytics.roomManagement.efficiency}%`}}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Attendance Rate</span>
                <span className="font-semibold">{analytics.timeTracking.attendanceRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-zinc-900 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(parseFloat(analytics.timeTracking.attendanceRate) || 0, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparative Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topPerformers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No time entries in this period.</p>
            ) : (
              <div className="space-y-3">
                {analytics.topPerformers.map((performer, i) => (
                  <div key={performer.name ?? i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold">
                        {i + 1}
                      </div>
                      <span className="font-semibold">{performer.name}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {performer.hours} • {performer.days} day{performer.days === 1 ? '' : 's'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-zinc-50 border border-border rounded-md">
                <span className="text-sm">Active attendants</span>
                <span className="font-heading font-bold tabular-nums">{analytics.timeTracking.totalAttendants}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-50 border border-border rounded-md">
                <span className="text-sm">Avg hours / attendant</span>
                <span className="font-heading font-bold tabular-nums">{analytics.timeTracking.averageHoursPerAttendant}h</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-50 border border-border rounded-md">
                <span className="text-sm">Rooms ready</span>
                <span className="font-heading font-bold tabular-nums">{analytics.roomManagement.roomsCleaned}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-50 border border-border rounded-md">
                <span className="text-sm">Rooms needing cleaning</span>
                <span className="font-heading font-bold tabular-nums">{analytics.roomManagement.pendingRooms}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={handleExportAnalytics} data-testid="export-analytics-btn">
          Export Analytics Report
        </Button>
      </div>
    </div>
  );
};

const OrganizationTab = () => {
  const { user } = React.useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [hierarchy, setHierarchy] = useState({ business_operations: [], daily_operations: [], front_desk_operations: [] });
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ department: '', manager_id: '' });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (token) {
      fetchHierarchy();
      fetchUsers();
    }
  }, [token]);

  const fetchHierarchy = async () => {
    try {
      const response = await axios.get(`${API}/organization/hierarchy`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHierarchy(response.data.hierarchy);
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users/for-messaging`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleEditUser = (userData) => {
    setSelectedUser(userData);
    setEditData({
      department: userData.department || 'front_desk_operations',
      manager_id: userData.manager_id || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    try {
      await axios.put(
        `${API}/organization/update-user?user_id=${selectedUser.id}`,
        null,
        {
          params: {
            department: editData.department,
            manager_id: editData.manager_id || null
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      toast.success('Organization updated successfully!');
      setShowEditModal(false);
      fetchHierarchy();
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error('Failed to update organization');
    }
  };

  const getRoleBadgeColor = (role) => {
    if (role === 'ops_manager') return 'bg-purple-100 text-purple-800 border-purple-300';
    if (role === 'assistant_manager') return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const getRoleLabel = (role) => {
    if (role === 'ops_manager') return 'OPS Manager';
    if (role === 'assistant_manager') return 'Assistant Manager';
    return 'Attendant';
  };

  const getDepartmentLabel = (dept) => {
    if (dept === 'business_operations') return 'Business Operations';
    if (dept === 'daily_operations') return 'Daily Operations';
    return 'Front Desk Operations';
  };

  const canEdit = user?.role === 'ops_manager' || user?.role === 'assistant_manager';

  const renderUserCard = (userData, deptUsers) => {
    const managerData = deptUsers.find(u => u.id === userData.manager_id);
    
    return (
      <div
        key={userData.id}
        className="bg-white border-2 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow relative"
        style={{ minWidth: '200px' }}
      >
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold mb-2">
            {userData.name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div className="text-center mb-2">
            <div className="font-semibold text-gray-900">{userData.name}</div>
            <div className="text-xs text-gray-500">{userData.email}</div>
          </div>
          <Badge className={`text-xs px-2 py-1 ${getRoleBadgeColor(userData.role)}`}>
            {getRoleLabel(userData.role)}
          </Badge>
          {managerData && (
            <div className="text-xs text-gray-500 mt-2">
              Reports to: {managerData.name}
            </div>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => handleEditUser(userData)}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-blue-600"
          >
            ✏️
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="organization-tab">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Organization</h2>
        <Badge className="bg-blue-100 text-blue-800">
          {Object.values(hierarchy).flat().length} Total Members
        </Badge>
      </div>

      {/* Hierarchy Visualization */}
      <div className="space-y-8">
        {/* Business Operations */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100">
            <CardTitle className="text-purple-900">Business Operations</CardTitle>
            <p className="text-sm text-purple-700">Strategic Leadership & Direction</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 justify-center">
              {hierarchy.business_operations.length === 0 ? (
                <div className="text-gray-500 text-center py-8">No members in this department</div>
              ) : (
                hierarchy.business_operations.map(userData => 
                  renderUserCard(userData, hierarchy.business_operations)
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Connection Line */}
        <div className="flex justify-center">
          <div className="w-1 h-8 bg-gradient-to-b from-purple-300 to-blue-300"></div>
        </div>

        {/* Daily Operations */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
            <CardTitle className="text-blue-900">️ Daily Operations</CardTitle>
            <p className="text-sm text-blue-700">Day-to-Day Management & Coordination</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 justify-center">
              {hierarchy.daily_operations.length === 0 ? (
                <div className="text-gray-500 text-center py-8">No members in this department</div>
              ) : (
                hierarchy.daily_operations.map(userData => 
                  renderUserCard(userData, hierarchy.daily_operations)
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Connection Line */}
        <div className="flex justify-center">
          <div className="w-1 h-8 bg-gradient-to-b from-blue-300 to-green-300"></div>
        </div>

        {/* Front Desk Operations */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100">
            <CardTitle className="text-green-900">Front Desk Operations</CardTitle>
            <p className="text-sm text-green-700">Guest Services & Room Management</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 justify-center">
              {hierarchy.front_desk_operations.length === 0 ? (
                <div className="text-gray-500 text-center py-8">No members in this department</div>
              ) : (
                hierarchy.front_desk_operations.map(userData => 
                  renderUserCard(userData, hierarchy.front_desk_operations)
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">Edit Organization Assignment</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label>Attendant: {selectedUser.name}</Label>
              </div>
              <div>
                <Label>Department</Label>
                <Select
                  value={editData.department}
                  onValueChange={(value) => setEditData({...editData, department: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business_operations">Business Operations</SelectItem>
                    <SelectItem value="daily_operations">Daily Operations</SelectItem>
                    <SelectItem value="front_desk_operations">Front Desk Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Direct Assistant Manager</Label>
                <Select
                  value={editData.manager_id}
                  onValueChange={(value) => setEditData({...editData, manager_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assistant manager..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {users.filter(u => u.role === 'ops_manager' || u.role === 'assistant_manager').map(mgr => (
                      <SelectItem key={mgr.id} value={mgr.id}>
                        {mgr.name} - {getRoleLabel(mgr.role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ProfileTab = ({ user }) => {
  const token = localStorage.getItem('token');
  const [editing, setEditing] = useState(false);
  const [demographics, setDemographics] = useState({
    date_of_birth: user.date_of_birth || '',
    gender: user.gender || '',
    phone_number: user.phone_number || '',
    address_street: user.address_street || '',
    address_city: user.address_city || '',
    address_state: user.address_state || '',
    address_zip: user.address_zip || '',
    emergency_contact_name: user.emergency_contact_name || '',
    emergency_contact_phone: user.emergency_contact_phone || '',
    emergency_contact_relationship: user.emergency_contact_relationship || ''
  });

  const handleSave = async () => {
    try {
      await axios.put(
        `${API}/profile/demographics`,
        demographics,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Profile updated successfully!');
      setEditing(false);
      // Refresh the page to update user data
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  return (
    <div data-testid="profile-tab">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Profile</h2>
        {!editing ? (
          <Button onClick={() => setEditing(true)}>Edit Profile</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        )}
      </div>

      {/* Basic Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Badge>
                {user.role === 'ops_manager' ? 'OPS Manager' : 
                 user.role === 'assistant_manager' ? 'Assistant Manager' : 
                 'Attendant'}
              </Badge>
            </div>
            {user.department && (
              <div>
                <Label>Department</Label>
                <p className="font-medium">
                  {user.department === 'business_operations' ? 'Business Operations' :
                   user.department === 'daily_operations' ? 'Daily Operations' :
                   'Front Desk Operations'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Demographics */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Demographics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Date of Birth</Label>
              {editing ? (
                <Input
                  type="date"
                  value={demographics.date_of_birth}
                  onChange={(e) => setDemographics({...demographics, date_of_birth: e.target.value})}
                />
              ) : (
                <p className="font-medium">{demographics.date_of_birth || 'Not set'}</p>
              )}
            </div>
            <div>
              <Label>Gender</Label>
              {editing ? (
                <Select
                  value={demographics.gender}
                  onValueChange={(value) => setDemographics({...demographics, gender: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="non-binary">Non-binary</SelectItem>
                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{demographics.gender || 'Not set'}</p>
              )}
            </div>
            <div>
              <Label>Phone Number</Label>
              {editing ? (
                <Input
                  type="tel"
                  value={demographics.phone_number}
                  onChange={(e) => setDemographics({...demographics, phone_number: e.target.value})}
                  placeholder="(555) 123-4567"
                />
              ) : (
                <p className="font-medium">{demographics.phone_number || 'Not set'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Street Address</Label>
            {editing ? (
              <Input
                value={demographics.address_street}
                onChange={(e) => setDemographics({...demographics, address_street: e.target.value})}
                placeholder="123 Main Street"
              />
            ) : (
              <p className="font-medium">{demographics.address_street || 'Not set'}</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>City</Label>
              {editing ? (
                <Input
                  value={demographics.address_city}
                  onChange={(e) => setDemographics({...demographics, address_city: e.target.value})}
                  placeholder="City"
                />
              ) : (
                <p className="font-medium">{demographics.address_city || 'Not set'}</p>
              )}
            </div>
            <div>
              <Label>State</Label>
              {editing ? (
                <Input
                  value={demographics.address_state}
                  onChange={(e) => setDemographics({...demographics, address_state: e.target.value})}
                  placeholder="State"
                />
              ) : (
                <p className="font-medium">{demographics.address_state || 'Not set'}</p>
              )}
            </div>
            <div>
              <Label>ZIP Code</Label>
              {editing ? (
                <Input
                  value={demographics.address_zip}
                  onChange={(e) => setDemographics({...demographics, address_zip: e.target.value})}
                  placeholder="12345"
                />
              ) : (
                <p className="font-medium">{demographics.address_zip || 'Not set'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Contact Name</Label>
              {editing ? (
                <Input
                  value={demographics.emergency_contact_name}
                  onChange={(e) => setDemographics({...demographics, emergency_contact_name: e.target.value})}
                  placeholder="John Doe"
                />
              ) : (
                <p className="font-medium">{demographics.emergency_contact_name || 'Not set'}</p>
              )}
            </div>
            <div>
              <Label>Contact Phone</Label>
              {editing ? (
                <Input
                  type="tel"
                  value={demographics.emergency_contact_phone}
                  onChange={(e) => setDemographics({...demographics, emergency_contact_phone: e.target.value})}
                  placeholder="(555) 123-4567"
                />
              ) : (
                <p className="font-medium">{demographics.emergency_contact_phone || 'Not set'}</p>
              )}
            </div>
            <div>
              <Label>Relationship</Label>
              {editing ? (
                <Input
                  value={demographics.emergency_contact_relationship}
                  onChange={(e) => setDemographics({...demographics, emergency_contact_relationship: e.target.value})}
                  placeholder="Spouse, Parent, Sibling, etc."
                />
              ) : (
                <p className="font-medium">{demographics.emergency_contact_relationship || 'Not set'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Add Attendant Modal (keeping existing component)
const AddAttendantModal = ({ isOpen, onClose, onSuccess }) => {
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
        role: 'attendant',
        workplace_lat: formData.workplace_lat ? parseFloat(formData.workplace_lat) : null,
        workplace_lng: formData.workplace_lng ? parseFloat(formData.workplace_lng) : null,
        geofence_radius: parseInt(formData.geofence_radius)
      });

      toast.success('Attendant added successfully!');
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
          <DialogTitle className="font-heading tracking-tight">Add New Attendant</DialogTitle>
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
              {loading ? 'Creating...' : 'Create Attendant'}
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
      const defaultTab = user.role === 'attendant' ? 'timecard' : 'overview';
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
      // Base Tabs (All Users)
      case 'timecard':
        return <TimeCardTab />;
      case 'rooms':
        return <RoomManagementTab />;
      case 'schedule':
        return <MyScheduleTab />;
      case 'profile':
        return <ProfileTab user={user} />;
      
      // Manager Tabs (OPS Manager Only)
      case 'overview':
        return <TeamOverviewTab />;
      case 'timecards':
        return <TeamTimeCardsTab />;
      case 'room-mgmt':
        return <RoomReportsTab />;
      case 'scheduling':
        return <TeamSchedulingTab />;
      case 'team-reports':
        return <TeamReportsTab />;
      case 'employee-mgmt':
        return <AttendantManagementTab />;
      
      // Admin Tabs (OPS Manager Only)
      case 'admin':
        return <SystemAdminTab />;
      
      default:
        return <TimeCardTab />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      {/* Header with Navigation Tabs - Linear-style sticky glass */}
      <nav className="bg-white/75 backdrop-blur-xl border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center min-w-0">
              <h1 className="font-heading text-base font-bold tracking-tight text-foreground mr-6 whitespace-nowrap" data-testid="app-title">
                RSBC Workflow Pro
              </h1>

              {/* Desktop Tabs */}
              <div className="hidden md:flex items-center gap-0 -mb-px overflow-x-auto hide-scrollbar">
                {tabs.map((tab) => {
                  const Icon = TAB_ICON_MAP[tab.icon];
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex items-center gap-2 px-3 h-14 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                        isActive
                          ? 'border-primary text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                      data-testid={`tab-${tab.id}`}
                    >
                      {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden ml-2 h-9 w-9 p-0"
                data-testid="mobile-menu-button"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {/* PWA Install Button */}
              {isInstallable && !isInstalled && (
                <Button
                  onClick={handleInstall}
                  size="sm"
                  variant="outline"
                  className="hidden sm:flex items-center gap-2 h-8"
                  data-testid="install-app-button"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Install</span>
                </Button>
              )}

              {/* App Status Indicator */}
              {isInstalled && (
                <Badge variant="secondary" className="hidden sm:flex items-center gap-1 font-normal">
                  <CheckCircle2 className="h-3 w-3" />
                  Installed
                </Badge>
              )}

              <div className="hidden sm:flex items-center gap-2 text-sm whitespace-nowrap" data-testid="user-info">
                <span className="font-medium text-foreground truncate max-w-[180px]">{user.name}</span>
                <Badge variant="outline" className="font-normal text-xs">
                  {user.role === 'ops_manager' ? 'OPS Manager' :
                   user.role === 'assistant_manager' ? 'Assistant Manager' :
                   'Attendant'}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={logout} data-testid="logout-button" className="h-8">
                Logout
              </Button>
            </div>
          </div>

          {/* Mobile Tabs */}
          {isMobileMenuOpen && (
            <div className="md:hidden pb-3 border-t border-border -mx-4 px-4 pt-2">
              <div className="flex flex-col gap-1">
                {tabs.map((tab) => {
                  const Icon = TAB_ICON_MAP[tab.icon];
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      }`}
                      data-testid={`mobile-tab-${tab.id}`}
                    >
                      {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
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
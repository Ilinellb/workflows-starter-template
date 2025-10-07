// Service Worker for RSBC Workflow Pro PWA
const CACHE_NAME = 'time-tracker-pro-v1.0.0';
const API_CACHE = 'time-tracker-api-v1.0.0';

// Assets to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API endpoints that should be cached
const API_ENDPOINTS = [
  '/api/auth/me',
  '/api/time/status',
  '/api/users',
  '/api/notifications'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with Network First strategy
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    // Try network first for fresh data
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const responseClone = response.clone();
      
      // Only cache GET requests
      if (request.method === 'GET') {
        cache.put(request, responseClone);
      }
    }
    
    return response;
  } catch (error) {
    console.log('🔄 Network failed, trying cache for:', request.url);
    
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline message for failed API calls
    return new Response(
      JSON.stringify({
        error: 'Offline - Please check your internet connection',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static requests with Cache First strategy
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Not in cache, fetch from network
    const response = await fetch(request);
    
    // Cache the response if successful
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed and not in cache
    console.error('🚫 Failed to fetch:', request.url, error);
    
    // Return fallback for navigation requests
    if (request.destination === 'document') {
      const fallbackResponse = await cache.match('/');
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }
    
    // Generic fallback
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'punch-sync') {
    event.waitUntil(syncPunchData());
  }
  
  if (event.tag === 'timeoff-sync') {
    event.waitUntil(syncTimeOffRequests());
  }
});

// Sync punch data when back online
async function syncPunchData() {
  try {
    // Get stored offline punch actions
    const db = await openDB();
    const offlinePunches = await getOfflineActions(db, 'punches');
    
    for (const punch of offlinePunches) {
      try {
        const response = await fetch('/api/time/punch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': punch.headers.Authorization
          },
          body: JSON.stringify(punch.data)
        });
        
        if (response.ok) {
          await removeOfflineAction(db, 'punches', punch.id);
          console.log('✅ Synced punch data:', punch.id);
        }
      } catch (error) {
        console.error('❌ Failed to sync punch:', error);
      }
    }
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

// Sync time off requests when back online  
async function syncTimeOffRequests() {
  console.log('🔄 Syncing time off requests...');
  // Implementation for syncing time off requests
}

// IndexedDB helpers for offline storage
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TimeTrackerOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('punches')) {
        db.createObjectStore('punches', { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains('timeoff')) {
        db.createObjectStore('timeoff', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'time-tracker-notification',
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: '/icons/open-action.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss-action.png'
        }
      ],
      requireInteraction: true
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Time Tracker Pro', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notification closed');
  // Track notification dismissal analytics if needed
});

console.log('🚀 Time Tracker Pro Service Worker loaded');
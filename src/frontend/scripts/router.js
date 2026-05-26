window.__routes = (function() {
  const BASE = '/pages/';

  const ROUTE_CATEGORIES = {
    PUBLIC: 'public',
    AUTH: 'auth',
    ELEVATED: 'elevated',
    ADMIN: 'admin',
  };

  const ROUTE_CONFIG = [
    { path: '/', name: 'home', category: 'public', label: 'Home' },
    { path: BASE + 'login.html', name: 'login', category: 'public', label: 'Sign In' },
    { path: BASE + 'register.html', name: 'register', category: 'public', label: 'Sign Up' },
    { path: BASE + 'forgot-password.html', name: 'forgot-password', category: 'public', label: 'Forgot Password' },
    { path: BASE + 'auth-callback.html', name: 'auth-callback', category: 'public', label: 'Auth Callback' },
    { path: BASE + 'emergency.html', name: 'emergency', category: 'public', label: 'SOS Emergency' },

    { path: BASE + 'dashboard.html', name: 'dashboard', category: 'auth', label: 'Dashboard' },
    { path: BASE + 'map.html', name: 'map', category: 'auth', label: 'Live Map' },
    { path: BASE + 'report.html', name: 'report', category: 'auth', label: 'Report Hazard' },
    { path: BASE + 'track.html', name: 'track', category: 'auth', label: 'Track Report' },
    { path: BASE + 'profile.html', name: 'profile', category: 'auth', label: 'Profile' },
    { path: BASE + 'my-reports.html', name: 'my-reports', category: 'auth', label: 'My Reports' },
    { path: BASE + 'settings.html', name: 'settings', category: 'auth', label: 'Settings' },
    { path: BASE + 'notifications.html', name: 'notifications', category: 'auth', label: 'Notifications' },
    { path: BASE + 'ai-insights.html', name: 'ai-insights', category: 'auth', label: 'AI Insights' },
    { path: BASE + 'traffic-analytics.html', name: 'traffic-analytics', category: 'auth', label: 'Traffic Analytics' },
    { path: BASE + 'heatmaps.html', name: 'heatmaps', category: 'auth', label: 'Heatmaps' },

    { path: BASE + 'budget-infrastructure.html', name: 'budget', category: 'elevated', label: 'Budget & Infrastructure' },
    { path: BASE + 'contractors.html', name: 'contractors', category: 'elevated', label: 'Contractors & Tenders' },
    { path: BASE + 'authority-data.html', name: 'authority-data', category: 'elevated', label: 'Authority Data' },

    { path: BASE + 'admin-panel.html', name: 'admin-panel', category: 'admin', label: 'Admin Panel' },
  ];

  const ERROR_ROUTES = {
    404: '/pages/404.html',
    accessDenied: '/pages/access-denied.html',
    sessionExpired: '/pages/session-expired.html',
  };

  const NAV_ITEMS = {
    operations: [
      { path: BASE + 'dashboard.html', icon: 'fa-chart-bar', label: 'Dashboard' },
      { path: BASE + 'map.html', icon: 'fa-map', label: 'Live Map' },
      { path: BASE + 'report.html', icon: 'fa-plus-circle', label: 'Report Hazard' },
      { path: BASE + 'track.html', icon: 'fa-search', label: 'Track Report' },
    ],
    emergency: [
      { path: BASE + 'emergency.html', icon: 'fa-exclamation-triangle', label: 'SOS Emergency', highlight: true },
    ],
    intelligence: [
      { path: BASE + 'ai-insights.html', icon: 'fa-brain', label: 'AI Insights' },
      { path: BASE + 'traffic-analytics.html', icon: 'fa-chart-line', label: 'Traffic Analytics' },
      { path: BASE + 'heatmaps.html', icon: 'fa-fire', label: 'Heatmaps' },
    ],
    government: [
      { path: BASE + 'budget-infrastructure.html', icon: 'fa-coins', label: 'Budget & Infrastructure' },
      { path: BASE + 'contractors.html', icon: 'fa-user-tie', label: 'Contractors & Tenders' },
      { path: BASE + 'authority-data.html', icon: 'fa-building', label: 'Authority Data' },
    ],
    admin: [
      { path: BASE + 'admin-panel.html', icon: 'fa-shield-halved', label: 'Admin Panel' },
    ],
    account: [
      { path: BASE + 'profile.html', icon: 'fa-user', label: 'Profile' },
      { path: BASE + 'my-reports.html', icon: 'fa-file-alt', label: 'My Reports' },
      { path: BASE + 'settings.html', icon: 'fa-cog', label: 'Settings' },
    ],
  };

  const BOTTOM_NAV = [
    { path: BASE + 'dashboard.html', icon: 'fa-chart-bar', label: 'Dashboard' },
    { path: BASE + 'map.html', icon: 'fa-map', label: 'Map' },
    { path: BASE + 'report.html', icon: 'fa-plus-circle', label: 'Report' },
    { path: BASE + 'track.html', icon: 'fa-search', label: 'Track' },
    { path: BASE + 'emergency.html', icon: 'fa-exclamation-triangle', label: 'SOS', highlight: true, style: 'color:var(--red)' },
    { path: BASE + 'profile.html', icon: 'fa-user', label: 'Profile' },
  ];

  function getCurrentRoute() {
    const path = window.location.pathname;
    return ROUTE_CONFIG.find(r => r.path === path) || null;
  }

  function getRouteCategory(path) {
    const route = ROUTE_CONFIG.find(r => r.path === path);
    return route ? route.category : null;
  }

  function isPublicRoute(path) {
    const route = ROUTE_CONFIG.find(r => r.path === path);
    return route && route.category === 'public';
  }

  function isAuthRoute(path) {
    const route = ROUTE_CONFIG.find(r => r.path === path);
    return route && (route.category === 'auth' || route.category === 'elevated' || route.category === 'admin');
  }

  function isElevatedRoute(path) {
    const route = ROUTE_CONFIG.find(r => r.path === path);
    return route && route.category === 'elevated';
  }

  function isAdminRoute(path) {
    const route = ROUTE_CONFIG.find(r => r.path === path);
    return route && route.category === 'admin';
  }

  function matchPath(path, pattern) {
    return path === pattern || path.endsWith(pattern.split('/').pop());
  }

  function getRouteByName(name) {
    const route = ROUTE_CONFIG.find(r => r.name === name);
    return route ? route.path : '/';
  }

  function redirect(path) {
    window.location.href = path;
  }

  function safeRedirect(path) {
    if (window.location.pathname !== path) {
      window.location.href = path;
    }
  }

  function getRedirectParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || null;
  }

  function navigateToDashboard() {
    safeRedirect(BASE + 'dashboard.html');
  }

  function navigateToLogin() {
    safeRedirect(BASE + 'login.html');
  }

  function navigateToHome() {
    safeRedirect('/');
  }

  function getPageName(path) {
    const parts = path.split('/').filter(Boolean);
    const file = parts[parts.length - 1] || 'index.html';
    return file.replace('.html', '');
  }

  return {
    ROUTE_CATEGORIES,
    ROUTE_CONFIG,
    ERROR_ROUTES,
    NAV_ITEMS,
    BOTTOM_NAV,
    getCurrentRoute,
    getRouteCategory,
    isPublicRoute,
    isAuthRoute,
    isElevatedRoute,
    isAdminRoute,
    matchPath,
    getRouteByName,
    redirect,
    safeRedirect,
    getRedirectParam,
    navigateToDashboard,
    navigateToLogin,
    navigateToHome,
    getPageName,
    BASE,
  };
})();

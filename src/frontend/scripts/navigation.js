let __navInitialized = false;
let __routeGuardRunning = false;

function getEffectivePath() {
  return window.location.pathname;
}

function getProtectedRoutes() {
  return __routes.ROUTE_CONFIG
    .filter(r => r.category !== 'public')
    .map(r => r.path.split('/').pop().replace('.html', ''));
}

function getPublicRoutes() {
  return __routes.ROUTE_CONFIG
    .filter(r => r.category === 'public')
    .map(r => r.path.split('/').pop().replace('.html', ''));
}

function shouldProtectPage(path) {
  const pageName = __routes.getPageName(path);
  const protectedNames = getProtectedRoutes();
  return protectedNames.some(p => pageName.includes(p) || path.includes(p));
}

function shouldTreatAsPublic(path) {
  const pageName = __routes.getPageName(path);
  const publicNames = getPublicRoutes();
  return publicNames.some(p => pageName.includes(p) || path.includes(p));
}

async function routeGuard() {
  if (__routeGuardRunning) return;
  __routeGuardRunning = true;

  try {
    const state = getSession();
    const path = getEffectivePath();

    const isIndex = path === '/' || path.endsWith('index.html');
    const isProtected = shouldProtectPage(path);
    const isPublic = shouldTreatAsPublic(path) || isIndex;

    if (state.loading) {
      return;
    }

    const { user } = state;

    if (isProtected && !user) {
      const loginUrl = __routes.BASE + 'login.html';
      if (path !== loginUrl && !path.includes('login.html')) {
        const target = encodeURIComponent(path);
        __routes.safeRedirect(loginUrl + (target ? '?redirect=' + target : ''));
      }
      return;
    }

    if (isProtected && user) {
      const route = __routes.ROUTE_CONFIG.find(r => {
        const pageFile = r.path.split('/').pop();
        return path.includes(pageFile);
      });

      if (route) {
        if (route.category === 'admin' && !isAdmin()) {
          __routes.safeRedirect(__routes.BASE + 'access-denied.html');
          return;
        }
        if (route.category === 'elevated' && !isElevated()) {
          __routes.safeRedirect(__routes.BASE + 'access-denied.html');
          return;
        }
      }
    }

    if (isPublic && user && !isIndex) {
      __routes.safeRedirect(__routes.BASE + 'dashboard.html');
      return;
    }

    if (isIndex && user) {
      __routes.safeRedirect(__routes.BASE + 'dashboard.html');
      return;
    }
  } finally {
    __routeGuardRunning = false;
  }
}

function markActiveNav() {
  const path = getEffectivePath();
  const pageFile = path.split('/').pop() || 'index.html';

  document.querySelectorAll('.sidebar-link, .dock-nav a, .bottombar a, .user-menu a').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;

    a.classList.remove('active');

    const linkFile = href.split('/').pop();

    if (linkFile === pageFile) {
      a.classList.add('active');
    } else if (pageFile === 'index.html' && (href === '/' || href === '../index.html')) {
      a.classList.add('active');
    }
  });
}

function initUserMenu() {
  const btn = document.getElementById('user-menu-btn');
  const dropdown = document.getElementById('user-dropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open');
    dropdown.style.display = isOpen ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
      dropdown.classList.remove('open');
    }
  });

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await logoutUser();
      window.location.href = '/';
    });
  }

  const logoutTopBtn = document.getElementById('logout-btn-top');
  if (logoutTopBtn) {
    logoutTopBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await logoutUser();
      window.location.href = '/';
    });
  }
}

function initAuthUI() {
  const userMenuContainer = document.getElementById('user-menu-container');
  const nameDisplay = document.getElementById('user-name-display');
  const authButtons = document.getElementById('auth-buttons');
  const { user, profile } = getSession();

  if (!userMenuContainer) return;

  if (user) {
    userMenuContainer.style.display = 'block';
    if (authButtons) authButtons.style.display = 'none';

    if (nameDisplay) {
      nameDisplay.textContent = profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
    }

    const adminLink = document.getElementById('admin-panel-link');
    if (adminLink) adminLink.style.display = isAdmin() ? 'flex' : 'none';

    const dropdownAdminLink = document.getElementById('user-dropdown-admin');
    if (dropdownAdminLink) dropdownAdminLink.style.display = isAdmin() ? 'block' : 'none';
  } else {
    userMenuContainer.style.display = 'none';
    if (authButtons) authButtons.style.display = 'flex';
  }
}

function initNavMode(isPublic, isAuthPage) {
  const notifToggle = document.getElementById('notif-toggle');
  const authButtons = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu-container');
  const { user } = getSession();

  if (isPublic || isAuthPage) {
    if (notifToggle) notifToggle.style.display = 'none';
    if (user) {
      if (userMenu) userMenu.style.display = 'block';
    }
  } else {
    if (authButtons) authButtons.style.display = 'none';
    if (notifToggle) notifToggle.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'block';
  }
}

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  function open() { document.body.classList.add('nav-open'); }
  function closeNav() { document.body.classList.remove('nav-open'); }

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('#nav-toggle');
    if (toggle) { e.stopPropagation(); open(); return; }
  });

  document.addEventListener('click', (e) => {
    const close = e.target.closest('#sidebar-close');
    if (close) { closeNav(); return; }
  });

  document.addEventListener('click', (e) => {
    const overlay = e.target.closest('#nav-overlay');
    if (overlay) { closeNav(); return; }
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar-link');
    if (link && sidebar.contains(link)) { closeNav(); return; }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNav();
  });
}

function initRoleBasedUI() {
  const { user } = getSession();
  if (!user) return;

  const role = getUserRole();
  const elevated = isElevated();

  const adminLink = document.getElementById('admin-sidebar-link');
  const adminLabel = document.getElementById('admin-section-label');
  if (adminLink) adminLink.style.display = role === 'admin' ? 'flex' : 'none';
  if (adminLabel) adminLabel.style.display = role === 'admin' ? 'block' : 'none';

  const govLabel = document.getElementById('gov-sidebar-label');
  const govLinks = document.querySelectorAll('.gov-sidebar-link');
  if (govLabel) govLabel.style.display = elevated ? 'block' : 'none';
  if (govLinks.length) {
    govLinks.forEach(l => { l.style.display = elevated ? 'flex' : 'none'; });
  }
}

function handleAuthRedirect() {
  const redirectParam = __routes.getRedirectParam();
  if (redirectParam) {
    const { user } = getSession();
    if (user && getEffectivePath().includes('login.html')) {
      __routes.safeRedirect(redirectParam);
      return true;
    }
  }
  return false;
}

function __navigationInit() {
  if (__navInitialized) return;
  __navInitialized = true;

  const path = getEffectivePath();
  const isIndex = path === '/' || path.endsWith('index.html');
  const isPublic = shouldTreatAsPublic(path) || isIndex;

  onAuthStateChange(() => {
    handleAuthRedirect();
    routeGuard();
    initUserMenu();
    initAuthUI();
    initRoleBasedUI();
    initNavMode(isPublic, false);
  });

  if (typeof THREE !== 'undefined') initThreeBackground();
  initParticles();
  initSidebar();
  markActiveNav();

  waitForAuth().then(() => {
    handleAuthRedirect();
    routeGuard();
    initUserMenu();
    initAuthUI();
    initRoleBasedUI();
    initNavMode(isPublic, false);
    markActiveNav();
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (link && !link.getAttribute('href')?.startsWith('#')) {
      setTimeout(markActiveNav, 50);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', __navigationInit);
} else {
  __navigationInit();
}

window.__navUtils = {
  routeGuard,
  markActiveNav,
  initUserMenu,
  initAuthUI,
  initRoleBasedUI,
  handleAuthRedirect,
};

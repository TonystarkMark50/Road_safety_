# Shared layout partials

App chrome (sidebar, topbar, bottom bar) is standardized via consistent DOM IDs consumed by `scripts/navigation.js`.

When adding a new authenticated page, copy structure from `pages/dashboard.html` or migrate to a build step that injects `partials/app-chrome.html` (planned Vite MPA).

Required element IDs: `#sidebar`, `#nav-overlay`, `#topbar`, `#nav-toggle`, `#mobile-nav`, `#logout-btn`, `#user-menu-container`.

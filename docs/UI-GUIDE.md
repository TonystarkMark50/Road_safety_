# AccelerateZero UI Guide

## Design tokens

Defined in `src/frontend/styles/tokens.css` and `:root` in `main.css`:

- Surfaces: `--az-surface-0` … `--az-surface-3`
- Brand: `--az-accent-primary`, `--az-accent-secondary`
- Motion: `--az-motion-fast|base|slow`, `--az-ease-premium`
- Touch: `--az-touch-min` (44px)

## Component styles

- `styles/components/ops.css` — command center grids, skeletons, admin mobile bar
- `styles/components/chat.css` — AI assistant mobile sheet, streaming cursor

## Layout conventions

Authenticated pages use:

- Sidebar (`#sidebar`) + overlay + topbar + bottom bar (`#mobile-nav` ≤900px)
- `navigation.js` for route guard, role-based nav, particles, Three.js (auth pages)

See `src/frontend/partials/README.md` for required DOM IDs.

## Dashboard data

- Citizens: `fetchMyReports` on dashboard feed
- Elevated roles: `fetchReports` full list

## Chatbot

- Requires signed-in user (Bearer token on `/api/v1/ai/chat/stream`)
- Mobile: bottom sheet mode ≤480px

## Theming

Prefer `--accent` / `--accent-secondary` over legacy indigo (`#4f46e5`) for new UI.

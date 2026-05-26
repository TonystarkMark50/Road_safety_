# AccelerateZero Security Overview

## Authentication

- Supabase Auth JWTs validated on every protected API route via `get_current_user`.
- Login lockout after repeated failures (`LOGIN_LOCKOUT_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES`).
- Privileged roles (`admin`, `authority`, `emergency`) require MFA when devices are configured.
- Admin bootstrap uses `BOOTSTRAP_ADMIN_TOKEN` (set in production); avoid first-user race assignment in shared environments.

## Authorization

- Role checks enforced in FastAPI dependencies (`require_admin`, `require_elevated`).
- Report updates scoped by role and ownership (`domain/report_access.py`).
- Report list endpoints require elevated roles; public stats expose aggregates only.

## API protection

- Per-IP rate limiting on middleware paths.
- Dedicated limits for auth, AI, uploads, and SOS endpoints.
- Security headers + CSP on all HTTP responses.
- Trusted host validation in production.

## AI / Chatbot

- All AI routes require authentication.
- Input sanitization and allowlisted context keys.
- Output sanitization strips meta-instructions and chain-of-thought leakage.

## File uploads

- MIME allowlist + magic-byte verification.
- Files served via authenticated `/api/v1/media/{media_id}` (no public `/uploads` mount).

## Database

- Apply `supabase/migrations/20260601000000_rls_hardening.sql` for RLS alignment with `supabase_user_id`.
- Backend uses service role; never expose service keys to the client.

## Operations

- Set `APP_ENV=production`, strong `SECRET_KEY`, explicit `CORS_ORIGINS`.
- Configure `SENTRY_DSN` for error tracking.
- Rotate Supabase keys on compromise.

# RSBC Workflow Pro — Test Credentials

All verified working as of 2026-04-27. Test-data users were cleaned up; only real production accounts remain.

## OPS Managers (full access)
- `lbj1288@gmail.com` / `admin123`
- `admin@company.com` / `admin123`
- `admin@rsbc.com` — password not in docs; reset via OPS if needed

## Assistant Managers
- `lbj1288@outlook.com` / `admin123`
- `mark@rsbc.com` — password not in docs

## Attendants
- None remaining in DB. If testing an attendant flow is needed, create one via `POST /api/auth/register` (auto-assigned `employee`/`attendant` role) and delete after.

## Notes
- JWT auth. `POST /api/auth/login` → `{access_token, user}`.
- Pass as header: `Authorization: Bearer <token>`.
- DB: `time_tracker_db`. User identifier field is `id` (UUID).
- If UI shows a manager as "attendant," it is stale `localStorage` cache — logout/login refetches role from `/api/auth/me`.

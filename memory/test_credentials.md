# RSBC Workflow Pro — Test Credentials

All verified working as of 2026-04-23.

## OPS Manager (full access)
- Email: `lbj1288@gmail.com`
- Password: `admin123`

## Assistant Manager
- Email: `lbj1288@outlook.com`
- Password: `admin123`

## Attendant
- Email: `john@company.com`
- Password: `password123`

## Notes
- JWT-based auth. `POST /api/auth/login` returns `{access_token, user}`.
- Pass as header: `Authorization: Bearer <token>`.
- DB: `time_tracker_db`. User identifier field is `id` (UUID), not `_id`.
- No-token requests return HTTP 403 (FastAPI `HTTPBearer` default); that is expected, not an auth leak.

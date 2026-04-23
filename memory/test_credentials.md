# RSBC Workflow Pro — Test Credentials

## OPS Manager (full access)
- Email: `lbj1288@gmail.com`
- Password: `admin123`
- Also: `admin@company.com` / `admin123`

## Assistant Manager
- Email: `lbj1288@outlook.com`
- Password: `admin123`
- Note: Previously reported broken; re-verify via login before use. If login fails, use API to reset via OPS Manager account.

## Attendant
- Email: `john@company.com`
- Password: `password123`
- Secondary: `attendant2@company.com` / `password123`

## Notes
- JWT-based auth. Token returned as `access_token` from `POST /api/auth/login`.
- Pass in header: `Authorization: Bearer <token>`.
- DB: `time_tracker_db`. User identifier field is `id` (UUID), not `_id`.

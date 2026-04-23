# RSBC Workflow Pro — PRD

## Original Problem Statement
Progressive Web App for hotel/rooming-house operations. Supports time tracking, room management, scheduling, employee management, reports, and role-based access. Recent focus has been simplifying the tab set, globalizing the Room Management module, fixing Time Clock for managers, resolving stale-role caching, and upgrading Schedule Management (CSV template upload, recurring shifts, employee bulk delete).

## Personas / Roles
- **OPS Manager** — Full access to all 10 tabs (Time Clock, Room Management, My Schedule, Team Overview, Team Time Cards, Room Reports, Team Scheduling, Team Reports, Employee Management, System Admin, Profile).
- **Assistant Manager** — Manager-level, limited set (can delete users, manage rooms, punch in/out).
- **Attendant** — Base role: Time Clock, Room Management, My Schedule, Profile.

## Architecture
- Frontend: React monolith (`/app/frontend/src/App.js` ~7.7k lines), TailwindCSS + Shadcn UI.
- Backend: FastAPI monolith (`/app/backend/server.py` ~2.3k lines), Motor/Mongo.
- DB: MongoDB `time_tracker_db`. All IDs are UUID strings, never ObjectId.
- Auth: JWT (`POST /api/auth/login`, `GET /api/auth/me`).

## Key Endpoints
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/register`
- `GET/POST/PUT /api/users`, `DELETE /api/users/{id}`, **`POST /api/users/bulk-delete`** (new)
- `POST /api/time/punch`, `GET /api/time/status`, `GET /api/time/entries`
- `GET /api/rooms/status`, `POST /api/rooms/update-status`, `POST /api/rooms/extend`
- `GET /api/schedules/team`, `POST /api/schedules/assign`, `POST /api/schedules/upload`, `DELETE /api/schedules/{id}`
- `GET /api/reports/team`, `GET /api/reports/employee/{id}/time-summary`, `GET /api/time/my-reports`
- Messages/WebSocket: `/api/messages`, `/api/messages/upload`, `/api/messages/download/{file}`
- Config: `GET/PUT /api/config`
- Notifications: `POST /api/notifications/check-missed-punches`

## Data Model Highlights
- `users`: `{id, email, password_hash, name, role, department, demographics...}`
- `rooms`: `{id, room_number, status, timestamp, updated_by, ...}` — GLOBAL state, no per-user filter.
- `schedules`: `{id, user_id, date, start_time, end_time, status, recurring_pattern?, ...}`
- `time_entries`: `{id, employee_id, punch_in_time, punch_out_time, duration_hours, date, ...}`

## What's Implemented (up to 2026-04-23)
- All 10 tabs restored for OPS Manager
- Global Room Management state across all users
- Time Clock accessible to all roles (OPS, Assistant, Attendant)
- Stale-role cache fix (localStorage purge on role change)
- `start_time` removed from Add/Edit Employee modals
- Schedule Management: CSV/Excel template download + bulk upload parser
- Recurring shifts (daily, weekly, monthly)
- Employee Management: single delete + bulk delete (UI + dedicated backend endpoint)
- Messaging system with WebSocket real-time + file attachments
- Placeholder email notifications (MOCKED — logs to backend instead of sending)

## Backlog / Next
- P1: Wire real email sending (SendGrid integration is imported but not fully configured) — currently MOCKED.
- P1: Re-verify Assistant Manager login (`lbj1288@outlook.com`) — reported broken in last full audit.
- P2: Implement `GET/PUT /api/config` — reported 404 in last audit; verify if now fixed.
- P2: Enforce role-based permission checks on all manager-only endpoints (earlier audit found leaks).
- P3: Refactor monolithic `App.js` (7.7k LOC) into feature modules.
- P3: Refactor monolithic `server.py` into `/app/backend/routes` and `/app/backend/models`.

## Known Mocks
- `send_notification_email` — logs placeholder instead of sending (SendGrid not wired to real key).

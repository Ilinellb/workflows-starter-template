"""
RSBC Workflow Pro - Comprehensive Backend API Tests
Tests against preview URL from REACT_APP_BACKEND_URL.
Covers: health, auth (3 roles), schedules/me, time-off flow, bulk-delete,
single-delete, punch in/out, room status, role-based 403s.
"""
import os
import uuid
import datetime as dt
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to read frontend .env directly
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        pass

assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

API = f"{BASE_URL}/api"

OPS_EMAIL = "lbj1288@gmail.com"
OPS_PASS = "admin123"
AM_EMAIL = "lbj1288@outlook.com"
AM_PASS = "admin123"

# Attendant credentials (john@company.com not in DB; we register one)
ATT_EMAIL = f"qa-attendant-{uuid.uuid4().hex[:8]}@company.com"
ATT_PASS = "pass1234"
ATT_NAME = "QA Attendant"


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _login(s, email, password):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    return r


@pytest.fixture(scope="session")
def ops_token(s):
    r = _login(s, OPS_EMAIL, OPS_PASS)
    assert r.status_code == 200, f"OPS login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def am_token(s):
    r = _login(s, AM_EMAIL, AM_PASS)
    assert r.status_code == 200, f"AM login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def attendant_token(s):
    # Register an attendant for the duration of the suite
    r = s.post(
        f"{API}/auth/register",
        json={
            "email": ATT_EMAIL,
            "name": ATT_NAME,
            "password": ATT_PASS,
            "confirm_password": ATT_PASS,
        },
        timeout=15,
    )
    assert r.status_code == 200, f"Attendant register failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------

class TestHealth:
    def test_root_health(self, s):
        # Note: External ingress routes only /api/* to backend.
        # /health (no /api prefix) is reachable internally on backend but
        # publicly hits the frontend. This is documented infra behavior.
        r = s.get(f"{BASE_URL}/health", timeout=10)
        # Accept either backend JSON OR frontend HTML 200 (ingress behavior)
        assert r.status_code == 200
        if "application/json" in r.headers.get("content-type", ""):
            assert r.json().get("status") in ("ok", "healthy")

    def test_api_health(self, s):
        r = s.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") in ("ok", "healthy")


# ---------- Auth + role refresh ----------

class TestAuth:
    def test_ops_login(self, s):
        r = _login(s, OPS_EMAIL, OPS_PASS)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] in ("super_admin", "ops_manager")
        assert d["user"]["email"] == OPS_EMAIL
        assert isinstance(d["access_token"], str) and len(d["access_token"]) > 10

    def test_am_login(self, s):
        r = _login(s, AM_EMAIL, AM_PASS)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "assistant_manager"

    def test_invalid_login(self, s):
        r = _login(s, OPS_EMAIL, "wrong-password")
        assert r.status_code == 401

    def test_auth_me_ops(self, s, ops_token):
        r = s.get(f"{API}/auth/me", headers=_h(ops_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] in ("super_admin", "ops_manager")

    def test_auth_me_attendant(self, s, attendant_token):
        r = s.get(f"{API}/auth/me", headers=_h(attendant_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "attendant"


# ---------- Schedules /me for all 3 roles ----------

class TestSchedulesMe:
    def test_schedules_me_ops(self, s, ops_token):
        r = s.get(f"{API}/schedules/me", headers=_h(ops_token), timeout=10)
        assert r.status_code == 200
        assert "schedules" in r.json()

    def test_schedules_me_am(self, s, am_token):
        r = s.get(f"{API}/schedules/me", headers=_h(am_token), timeout=10)
        assert r.status_code == 200
        assert "schedules" in r.json()

    def test_schedules_me_attendant(self, s, attendant_token):
        r = s.get(f"{API}/schedules/me", headers=_h(attendant_token), timeout=10)
        assert r.status_code == 200
        assert "schedules" in r.json()
        # New attendant — should be empty list
        assert isinstance(r.json()["schedules"], list)

    def test_schedules_team_attendant_forbidden(self, s, attendant_token):
        r = s.get(f"{API}/schedules/team", headers=_h(attendant_token), timeout=10)
        assert r.status_code == 403

    def test_schedules_team_ops_ok(self, s, ops_token):
        r = s.get(f"{API}/schedules/team", headers=_h(ops_token), timeout=10)
        assert r.status_code == 200
        assert "schedules" in r.json()


# ---------- Time Punch ----------

class TestPunch:
    def test_punch_in_out(self, s, attendant_token):
        # Punch in
        r = s.post(
            f"{API}/time/punch",
            headers=_h(attendant_token),
            json={"action": "punch_in"},
            timeout=10,
        )
        assert r.status_code == 200, f"punch_in: {r.status_code} {r.text}"

        # Verify status
        r2 = s.get(f"{API}/time/status", headers=_h(attendant_token), timeout=10)
        assert r2.status_code == 200
        st = r2.json()
        # Should be punched in now
        assert st.get("punched_in") is True or st.get("status") == "working" or st.get("punch_in") is not None

        # Punch out
        r3 = s.post(
            f"{API}/time/punch",
            headers=_h(attendant_token),
            json={"action": "punch_out"},
            timeout=10,
        )
        assert r3.status_code == 200, f"punch_out: {r3.status_code} {r3.text}"


# ---------- Time-off request flow ----------

class TestTimeOff:
    def test_attendant_create_request_and_manager_sees_it(self, s, attendant_token, ops_token):
        today = dt.date.today().isoformat()
        r = s.post(
            f"{API}/time-off/request",
            headers=_h(attendant_token),
            json={
                "start_date": today,
                "end_date": today,
                "reason": "QA test request",
                "notes": "automated backend test",
            },
            timeout=10,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        request_id = r.json().get("request_id")
        assert request_id

        # GET /api/time-off/my-requests as attendant
        my = s.get(f"{API}/time-off/my-requests", headers=_h(attendant_token), timeout=10)
        assert my.status_code == 200
        ids = [x["id"] for x in my.json().get("requests", [])]
        assert request_id in ids, "Submitted request not present in my-requests"

        # GET /api/time-off/requests/all as OPS
        all_ = s.get(f"{API}/time-off/requests/all", headers=_h(ops_token), timeout=10)
        assert all_.status_code == 200
        all_ids = [x["id"] for x in all_.json().get("requests", [])]
        assert request_id in all_ids, "Submitted request not visible to manager queue"

    def test_attendant_cannot_view_all_requests(self, s, attendant_token):
        r = s.get(f"{API}/time-off/requests/all", headers=_h(attendant_token), timeout=10)
        assert r.status_code == 403


# ---------- Users CRUD + Bulk Delete ----------

class TestUsersCrudAndBulkDelete:
    def test_get_users_ops(self, s, ops_token):
        r = s.get(f"{API}/users", headers=_h(ops_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        # API returns list or dict-with-users
        users = data if isinstance(data, list) else data.get("users", [])
        assert isinstance(users, list)
        assert len(users) > 0
        # Verify no MongoDB _id leakage
        for u in users:
            assert "_id" not in u

    def test_create_and_single_delete(self, s, ops_token):
        email = f"qa-del-{uuid.uuid4().hex[:8]}@company.com"
        r = s.post(
            f"{API}/users",
            headers=_h(ops_token),
            json={
                "email": email,
                "name": "QA Delete",
                "password": "pass1234",
                "role": "attendant",
            },
            timeout=10,
        )
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        created = r.json()
        user_id = (
            created.get("user_id")
            or created.get("id")
            or (created.get("user") or {}).get("id")
        )
        assert user_id, f"No user_id in response: {created}"

        # DELETE
        d = s.delete(f"{API}/users/{user_id}", headers=_h(ops_token), timeout=10)
        assert d.status_code in (200, 204)

        # Verify gone — fetch all and ensure id absent
        r2 = s.get(f"{API}/users", headers=_h(ops_token), timeout=10)
        users = r2.json() if isinstance(r2.json(), list) else r2.json().get("users", [])
        assert user_id not in [u.get("id") for u in users]

    def test_bulk_delete_two_users(self, s, ops_token):
        ids = []
        for i in range(2):
            email = f"qa-bulk-{i}-{uuid.uuid4().hex[:6]}@company.com"
            r = s.post(
                f"{API}/users",
                headers=_h(ops_token),
                json={
                    "email": email,
                    "name": f"QA Bulk {i}",
                    "password": "pass1234",
                    "role": "attendant",
                },
                timeout=10,
            )
            assert r.status_code in (200, 201)
            uid = r.json().get("user_id") or r.json().get("id") or (r.json().get("user") or {}).get("id")
            assert uid, f"No user_id in response: {r.json()}"
            ids.append(uid)

        # Bulk delete
        bd = s.post(
            f"{API}/users/bulk-delete",
            headers=_h(ops_token),
            json={"user_ids": ids},
            timeout=10,
        )
        assert bd.status_code == 200, f"{bd.status_code} {bd.text}"
        body = bd.json()
        assert body.get("deleted_count") == 2, f"expected 2, got {body}"

    def test_attendant_cannot_bulk_delete(self, s, attendant_token, ops_token):
        # Create a throwaway user as OPS first
        email = f"qa-att-bd-{uuid.uuid4().hex[:6]}@company.com"
        r = s.post(
            f"{API}/users",
            headers=_h(ops_token),
            json={"email": email, "name": "TmpBD", "password": "pass1234", "role": "attendant"},
            timeout=10,
        )
        assert r.status_code in (200, 201)
        uid = r.json().get("user_id") or r.json().get("id") or (r.json().get("user") or {}).get("id")
        assert uid, f"No user_id: {r.json()}"

        # Attendant tries bulk-delete
        bd = s.post(
            f"{API}/users/bulk-delete",
            headers=_h(attendant_token),
            json={"user_ids": [uid]},
            timeout=10,
        )
        assert bd.status_code == 403

        # Cleanup
        s.delete(f"{API}/users/{uid}", headers=_h(ops_token), timeout=10)


# ---------- Room Management ----------

class TestRooms:
    def test_rooms_status_ops(self, s, ops_token):
        r = s.get(f"{API}/rooms/status", headers=_h(ops_token), timeout=10)
        assert r.status_code == 200

    def test_room_update_status_ops(self, s, ops_token):
        r = s.post(
            f"{API}/rooms/update-status",
            headers=_h(ops_token),
            json={
                "room_id": "room-99",
                "status": "needs_cleaning",
                "timestamp": dt.datetime.utcnow().isoformat() + "Z",
            },
            timeout=10,
        )
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"


# ---------- Reports ----------

class TestReports:
    def test_rooms_report(self, s, ops_token):
        r = s.get(f"{API}/rooms/report", headers=_h(ops_token), timeout=10)
        assert r.status_code == 200

    def test_team_report(self, s, ops_token):
        r = s.get(f"{API}/reports/team", headers=_h(ops_token), timeout=10)
        assert r.status_code == 200


# ---------- Bcrypt migration ----------

import pymongo

def _mongo_db():
    """Direct mongo connection to inspect password_hash field."""
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url:
        try:
            with open("/app/backend/.env") as f:
                for line in f:
                    if line.startswith("MONGO_URL"):
                        mongo_url = line.split("=", 1)[1].strip().strip('"')
                    if line.startswith("DB_NAME"):
                        db_name = line.split("=", 1)[1].strip().strip('"')
        except Exception:
            pass
    return pymongo.MongoClient(mongo_url)[db_name]


class TestBcryptMigration:
    def test_ops_hash_is_bcrypt_after_login(self, s, ops_token):
        # ops_token fixture triggered login; hash should now be bcrypt
        db = _mongo_db()
        u = db.users.find_one({"email": OPS_EMAIL})
        assert u is not None
        assert u["password_hash"].startswith("$2"), \
            f"Expected bcrypt prefix '$2', got {u['password_hash'][:8]}..."

    def test_am_hash_is_bcrypt_after_login(self, s, am_token):
        db = _mongo_db()
        u = db.users.find_one({"email": AM_EMAIL})
        assert u is not None
        assert u["password_hash"].startswith("$2")

    def test_subsequent_login_still_works(self, s, ops_token):
        # Login again after migration
        r = _login(s, OPS_EMAIL, OPS_PASS)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == OPS_EMAIL

    def test_wrong_password_returns_401_post_migration(self, s, ops_token):
        r = _login(s, OPS_EMAIL, "definitely-wrong-pw")
        assert r.status_code == 401


# ---------- Role Audit Log ----------

class TestRoleAuditLog:
    def _create_user(self, s, ops_token, role="attendant"):
        email = f"qa-audit-{uuid.uuid4().hex[:8]}@company.com"
        r = s.post(
            f"{API}/users",
            headers=_h(ops_token),
            json={"email": email, "name": "QA Audit", "password": "pass1234", "role": role},
            timeout=10,
        )
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        body = r.json()
        uid = body.get("user_id") or body.get("id") or (body.get("user") or {}).get("id")
        assert uid
        return uid, email

    def test_role_change_creates_audit_entry(self, s, ops_token):
        uid, email = self._create_user(s, ops_token, role="attendant")
        try:
            # Change role attendant -> assistant_manager
            up = s.put(
                f"{API}/users/{uid}",
                headers=_h(ops_token),
                json={
                    "email": email,
                    "name": "QA Audit",
                    "role": "assistant_manager",
                },
                timeout=10,
            )
            assert up.status_code == 200, f"{up.status_code} {up.text}"

            # Fetch audit log
            log = s.get(f"{API}/users/role-audit", headers=_h(ops_token), timeout=10)
            assert log.status_code == 200, f"{log.status_code} {log.text}"
            entries = log.json()
            assert isinstance(entries, list)
            matching = [e for e in entries if e.get("target_user_id") == uid]
            assert matching, "No audit entry created for role change"
            e = matching[0]
            for field in [
                "target_user_id", "target_email", "target_name",
                "old_role", "new_role", "changed_by_id",
                "changed_by_email", "changed_by_name", "timestamp",
            ]:
                assert field in e, f"Missing field {field} in audit entry: {e}"
            assert e["old_role"] == "attendant"
            assert e["new_role"] == "assistant_manager"
            assert e["changed_by_email"] == OPS_EMAIL
        finally:
            s.delete(f"{API}/users/{uid}", headers=_h(ops_token), timeout=10)

    def test_assistant_manager_cannot_change_role(self, s, ops_token, am_token):
        uid, email = self._create_user(s, ops_token, role="attendant")
        try:
            r = s.put(
                f"{API}/users/{uid}",
                headers=_h(am_token),
                json={"email": email, "name": "QA Audit", "role": "assistant_manager"},
                timeout=10,
            )
            assert r.status_code == 403, f"Expected 403 for AM role change, got {r.status_code} {r.text}"
        finally:
            s.delete(f"{API}/users/{uid}", headers=_h(ops_token), timeout=10)

    def test_self_role_change_returns_400(self, s, ops_token):
        # Ops tries to change their own role -> 400
        me = s.get(f"{API}/auth/me", headers=_h(ops_token), timeout=10)
        assert me.status_code == 200
        me_id = me.json()["id"]
        me_email = me.json()["email"]
        me_name = me.json()["name"]
        r = s.put(
            f"{API}/users/{me_id}",
            headers=_h(ops_token),
            json={"email": me_email, "name": me_name, "role": "attendant"},
            timeout=10,
        )
        assert r.status_code == 400, f"Expected 400 for self role change, got {r.status_code} {r.text}"

    def test_get_audit_log_chronological(self, s, ops_token):
        r = s.get(f"{API}/users/role-audit", headers=_h(ops_token), timeout=10)
        assert r.status_code == 200
        entries = r.json()
        assert isinstance(entries, list)
        # Most recent first
        if len(entries) >= 2:
            assert entries[0]["timestamp"] >= entries[1]["timestamp"]

    def test_assistant_manager_cannot_view_audit_log(self, s, am_token):
        r = s.get(f"{API}/users/role-audit", headers=_h(am_token), timeout=10)
        assert r.status_code == 403

    def test_attendant_cannot_view_audit_log(self, s, attendant_token):
        r = s.get(f"{API}/users/role-audit", headers=_h(attendant_token), timeout=10)
        assert r.status_code == 403

    def test_non_role_update_by_assistant_manager_works(self, s, ops_token, am_token):
        """Verify AM can still update non-role fields (name/email) -- MANAGER_ROLES preserved."""
        uid, email = self._create_user(s, ops_token, role="attendant")
        try:
            r = s.put(
                f"{API}/users/{uid}",
                headers=_h(am_token),
                json={"email": email, "name": "Renamed By AM", "role": "attendant"},
                timeout=10,
            )
            assert r.status_code == 200, f"AM non-role update should succeed: {r.status_code} {r.text}"
        finally:
            s.delete(f"{API}/users/{uid}", headers=_h(ops_token), timeout=10)


# ---------- Final cleanup ----------

@pytest.fixture(scope="session", autouse=True)
def _final_cleanup(s):
    yield
    # Clean up the throwaway attendant we registered
    try:
        ops = _login(s, OPS_EMAIL, OPS_PASS)
        if ops.status_code == 200:
            tok = ops.json()["access_token"]
            users_r = s.get(f"{API}/users", headers=_h(tok), timeout=10)
            data = users_r.json()
            users = data if isinstance(data, list) else data.get("users", [])
            for u in users:
                if u.get("email", "").startswith("qa-attendant-") or u.get("email", "").startswith("qa-"):
                    if u.get("email") != OPS_EMAIL:
                        s.delete(f"{API}/users/{u['id']}", headers=_h(tok), timeout=10)
    except Exception:
        pass

"""Short-lived sessions for the three classroom workspaces."""
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from database import DATABASE_URL, get_db_connection

DEMO_ENABLED = os.getenv("KRISHISETU_DEMO", "0" if DATABASE_URL else "1") == "1"
bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    role: str
    username: str
    full_name: str
    district: str
    farmer_id: int | None = None
    bank: str | None = None


def issue_session(user: Principal, email: str, provider: str):
    import json
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=4)
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM workspace_sessions WHERE expires_at <= ?", (datetime.now(timezone.utc).isoformat(),))
        conn.execute("INSERT INTO workspace_sessions (token_hash, principal, expires_at) VALUES (?, ?, ?)",
                     (hashlib.sha256(token.encode()).hexdigest(), json.dumps(asdict(user)), expires.isoformat()))
        conn.commit()
    finally:
        conn.close()
    return {"user": asdict(user), "email": email, "access_token": token, "auth_provider": provider, "status": "AUTHENTICATED"}


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    import json
    if credentials:
        conn = get_db_connection()
        try:
            row = conn.execute("SELECT principal FROM workspace_sessions WHERE token_hash = ? AND expires_at > ?",
                               (hashlib.sha256(credentials.credentials.encode()).hexdigest(), datetime.now(timezone.utc).isoformat())).fetchone()
        finally:
            conn.close()
        if row:
            return Principal(**json.loads(row[0]))
    raise HTTPException(401, "Please sign in to the workspace.")


def roles(*allowed):
    def required(user: Principal = Depends(current_user)):
        if user.role not in allowed:
            raise HTTPException(403, "This workspace requires a different role.")
        return user
    return required


farmer = roles("farmer")
bank = roles("bank_officer")
government = roles("govt_auditor")


def check_application(conn, app_id, user):
    row = conn.execute("SELECT farmer_id, bank_assigned FROM loan_applications WHERE id = ?", (app_id,)).fetchone()
    if not row or (user.role == "farmer" and row["farmer_id"] != user.farmer_id) or (user.role == "bank_officer" and row["bank_assigned"] != user.bank):
        raise HTTPException(404, "Application unavailable in this workspace.")

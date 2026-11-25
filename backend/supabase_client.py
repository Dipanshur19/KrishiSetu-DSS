"""Supabase authentication configuration; evidence is stored privately in the application database."""

import os
from typing import Optional, Dict, Any

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_KEY", "")).strip()
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            from supabase import create_client
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            return _supabase_client
        except Exception:
            return None
    return None

def get_backend_mode() -> Dict[str, Any]:
    sb = get_supabase_client()
    return {
        "database_backend": "supabase-postgresql" if DATABASE_URL else "sqlite-local",
        "auth_backend": "supabase-auth+rbac" if sb else "local-rbac-demo",
        "storage_backend": "private database attachments",
        "supabase_connected": bool(sb)
    }

"""
KrishiSetu DSS - Supabase Client & Cloud Storage / Auth Integration
Supports:
- Supabase PostgreSQL via DATABASE_URL (psycopg2) when configured
- Supabase Auth & Storage (`krishisetu-docs` bucket) when SUPABASE_URL + SUPABASE_KEY are set
- Seamless local SQLite + local disk `/uploads` fallback when running offline/without cloud keys
"""

import os
import uuid
from typing import Optional, Dict, Any

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_KEY", "")).strip()
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

LOCAL_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)

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
        "storage_backend": "supabase-storage" if sb else "local-disk-uploads",
        "supabase_connected": bool(sb)
    }

def upload_document_to_storage(filename: str, file_bytes: bytes, content_type: str = "application/octet-stream") -> Dict[str, Any]:
    """
    Uploads grievance documentation or geo-tagged crop sowing proof to Supabase Storage
    (`krishisetu-docs` bucket) if connected, or falls back to local disk `/uploads`.
    """
    ext = os.path.splitext(filename)[1] or ".bin"
    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"

    sb = get_supabase_client()
    if sb:
        try:
            res = sb.storage.from_("krishisetu-docs").upload(
                path=unique_name,
                file=file_bytes,
                file_options={"content-type": content_type}
            )
            public_url = sb.storage.from_("krishisetu-docs").get_public_url(unique_name)
            return {
                "storage": "supabase-storage",
                "filename": unique_name,
                "url": public_url
            }
        except Exception:
            pass

    local_path = os.path.join(LOCAL_UPLOAD_DIR, unique_name)
    with open(local_path, "wb") as f:
        f.write(file_bytes)
    return {
        "storage": "local-disk",
        "filename": unique_name,
        "url": f"/uploads/{unique_name}"
    }

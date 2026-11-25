"""
KrishiSetu DSS - Relational Database Schema & Dual-Engine Adapter (Supabase PostgreSQL + SQLite)
Aligned with Course Database-1.pdf and dms624.pdf specifications.
Automatically uses Supabase PostgreSQL when DATABASE_URL is set, or SQLite locally.
"""

import sqlite3
import os
import re
from typing import Any, Optional

DB_PATH = os.environ.get("KRISHISETU_DB_PATH") or os.path.join(os.path.dirname(__file__), "krishisetu.db")
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()


class DualRow(dict):
    """Dict subclass that also supports integer positional indexing like sqlite3.Row."""

    def __init__(self, mapping):
        super().__init__(mapping)
        self._vals = list(mapping.values())

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._vals[key]
        return super().__getitem__(key)


class PgCursorAdapter:
    """Wraps psycopg2 RealDictCursor to accept SQLite-style `?` placeholders and track `lastrowid`."""

    def __init__(self, cursor):
        self._cur = cursor
        self.lastrowid: Optional[int] = None

    def execute(self, query: str, params: Any = None):
        pg_query = query.replace("?", "%s")
        is_insert = pg_query.lstrip().upper().startswith("INSERT INTO")
        has_returning = "RETURNING" in pg_query.upper()
        if is_insert and not has_returning:
            pg_query = pg_query.rstrip().rstrip(";") + " RETURNING id;"

        if params is not None:
            self._cur.execute(pg_query, params)
        else:
            self._cur.execute(pg_query)

        if is_insert and self._cur.description:
            row = self._cur.fetchone()
            if row:
                self.lastrowid = row["id"] if isinstance(row, dict) else row[0]
        return self

    def executemany(self, query: str, seq_of_params):
        pg_query = query.replace("?", "%s")
        self._cur.executemany(pg_query, seq_of_params)
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        return DualRow(row) if row is not None else None

    def fetchall(self):
        return [DualRow(r) for r in self._cur.fetchall()]

    def __getattr__(self, name: str):
        return getattr(self._cur, name)


class PgConnectionAdapter:
    """Wraps psycopg2 connection with SQLite-compatible execute() and cursor() methods."""

    def __init__(self, dsn: str):
        import psycopg2
        from psycopg2.extras import RealDictCursor

        self._conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)

    def cursor(self) -> PgCursorAdapter:
        return PgCursorAdapter(self._conn.cursor())

    def execute(self, query: str, params: Any = None):
        cur = self.cursor()
        cur.execute(query, params)
        return cur

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_db_connection():
    if DATABASE_URL:
        return PgConnectionAdapter(DATABASE_URL)
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    if not DATABASE_URL:
        cursor.execute("PRAGMA foreign_keys = ON;")

    pk = "BIGSERIAL PRIMARY KEY" if DATABASE_URL else "INTEGER PRIMARY KEY AUTOINCREMENT"
    ts = "TIMESTAMPTZ DEFAULT NOW()" if DATABASE_URL else "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    real_t = "DOUBLE PRECISION" if DATABASE_URL else "REAL"
    bool_t = "BOOLEAN" if DATABASE_URL else "BOOLEAN"
    bool_true = "TRUE" if DATABASE_URL else "1"
    bool_false = "FALSE" if DATABASE_URL else "0"

    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS users_and_roles (
        id {pk},
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('farmer', 'bank_officer', 'govt_auditor', 'admin')),
        full_name TEXT NOT NULL,
        phone TEXT,
        district TEXT NOT NULL,
        branch_or_dept TEXT,
        created_at {ts}
    );
    """)

    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS farmer_profiles (
        id {pk},
        user_id INTEGER REFERENCES users_and_roles(id) ON DELETE SET NULL,
        farmer_uid TEXT UNIQUE NOT NULL,
        pmkisan_id TEXT UNIQUE,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        gender TEXT CHECK(gender IN ('M', 'F', 'Other')),
        social_category TEXT NOT NULL CHECK(social_category IN ('GEN', 'OBC', 'SC', 'ST', 'Minority', 'PWD', 'Women')),
        education TEXT,
        years_farming INTEGER DEFAULT 5,
        is_pmjdy {bool_t} DEFAULT {bool_true},
        is_pmsby {bool_t} DEFAULT {bool_true},
        is_pmjjby {bool_t} DEFAULT {bool_true},
        village TEXT NOT NULL,
        district TEXT NOT NULL,
        state TEXT DEFAULT 'Uttar Pradesh',
        created_at {ts}
    );
    """)

    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS land_and_allied_assets (
        id {pk},
        farmer_id INTEGER NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
        survey_khasra_no TEXT NOT NULL,
        ownership_type TEXT NOT NULL CHECK(ownership_type IN ('owned', 'registered_lease', 'oral_lease', 'sharecropper')),
        area_acres {real_t} NOT NULL,
        area_hectares {real_t} NOT NULL,
        irrigated_pct {real_t} DEFAULT 100.0,
        irrigation_source TEXT NOT NULL CHECK(irrigation_source IN ('Drip', 'Sprinkler', 'Canal', 'Well', 'Dry')),
        land_fragmentation_flag {bool_t} DEFAULT {bool_false},
        distance_to_mandi_km {real_t} DEFAULT 5.0,
        livestock_count INTEGER DEFAULT 0,
        fisheries_count INTEGER DEFAULT 0,
        movable_asset_val_k {real_t} DEFAULT 0.0,
        immovable_asset_val_l {real_t} DEFAULT 0.0,
        net_worth {real_t} DEFAULT 0.0,
        panchayat_cert_doc TEXT,
        created_at {ts}
    );
    """)

    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS existing_liabilities (
        id {pk},
        farmer_id INTEGER NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
        lender_name TEXT NOT NULL,
        lender_type TEXT NOT NULL CHECK(lender_type IN ('commercial_bank', 'cooperative', 'moneylender_informal')),
        outstanding_balance_m {real_t} DEFAULT 0.0,
        overdue_days INTEGER DEFAULT 0,
        is_npa {bool_t} DEFAULT {bool_false},
        is_wilful_default {bool_t} DEFAULT {bool_false},
        guarantor_liability {real_t} DEFAULT 0.0,
        created_at {ts}
    );
    """)

    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS loan_applications (
        id {pk},
        application_no TEXT UNIQUE NOT NULL,
        farmer_id INTEGER NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
        facility_type TEXT NOT NULL CHECK(facility_type IN ('Crop KCC', 'Flexi KCC', 'Allied KCC', 'Agri Term Loan')),
        requested_amount {real_t} NOT NULL,
        season TEXT DEFAULT 'Kharif',
        primary_crop TEXT NOT NULL,
        secondary_crop TEXT,
        marketing_tieup TEXT NOT NULL CHECK(marketing_tieup IN ('Direct', 'Cooperative', 'Government_Procurement', 'Corporate_Contract', 'None')),
        pmfby_optin {bool_t} DEFAULT {bool_true},
        status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted', 'under_review', 'approved', 'partial_approved', 'rejected', 'appealed')),
        bank_assigned TEXT DEFAULT 'State Bank of India',
        created_at {ts},
        updated_at {ts}
    );
    """)

    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS dss_evaluations (
        id {pk},
        application_id INTEGER UNIQUE NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
        farmer_classification TEXT NOT NULL,
        decision_tree_path TEXT NOT NULL,
        scale_of_finance_limit {real_t} NOT NULL,
        sanctioned_amount {real_t} NOT NULL,
        pd_score {real_t} NOT NULL,
        lgd_score {real_t} NOT NULL,
        dscr_ratio {real_t} NOT NULL,
        expected_revenue {real_t} NOT NULL,
        drought_stress_revenue {real_t} NOT NULL,
        equity_priority_score {real_t} NOT NULL,
        shap_reasons TEXT NOT NULL,
        allocated_in_batch {bool_t} DEFAULT {bool_false},
        evaluated_at {ts}
    );
    """)

    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS fund_tranches_and_usage (
        id {pk},
        application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
        tranche_no INTEGER NOT NULL,
        tranche_name TEXT NOT NULL,
        percentage {real_t} NOT NULL,
        amount {real_t} NOT NULL,
        status TEXT DEFAULT 'locked' CHECK(status IN ('locked', 'disbursed', 'redeemed')),
        voucher_code TEXT UNIQUE,
        qr_payload TEXT,
        merchant_name TEXT,
        redemption_timestamp {ts},
        geo_proof_photo TEXT,
        geo_lat {real_t},
        geo_long {real_t},
        created_at {ts}
    );
    """)

    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS grievances_and_policy_logs (
        id {pk},
        application_id INTEGER REFERENCES loan_applications(id) ON DELETE CASCADE,
        farmer_id INTEGER REFERENCES farmer_profiles(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK(category IN ('Incorrect land area', 'Unfair rejection', 'Collateral demanded under 2L', 'Delayed disbursal >14 days', 'Policy_Update', 'Other')),
        grievance_text TEXT NOT NULL,
        supporting_doc TEXT,
        bank_response TEXT,
        resolution_status TEXT DEFAULT 'open' CHECK(resolution_status IN ('open', 'resolved', 'escalated')),
        sla_deadline {ts},
        govt_directive TEXT,
        created_at {ts},
        updated_at {ts}
    );
    """)

    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS govt_policy_parameters (
        id {pk},
        smf_minimum_quota {real_t} DEFAULT 0.556,
        govt_first_loss_guarantee {real_t} DEFAULT 0.35,
        interest_subvention_pct {real_t} DEFAULT 3.0,
        miss_base_rate {real_t} DEFAULT 7.0,
        collateral_free_threshold {real_t} DEFAULT 200000.0,
        collateral_free_tieup_threshold {real_t} DEFAULT 300000.0,
        flexi_kcc_min {real_t} DEFAULT 10000.0,
        flexi_kcc_max {real_t} DEFAULT 50000.0,
        bank_max_npa_ceiling {real_t} DEFAULT 0.045,
        updated_by TEXT DEFAULT 'RBI / Ministry of Agriculture',
        updated_at {ts}
    );
    """)

    cursor.execute("SELECT COUNT(*) AS cnt FROM govt_policy_parameters;")
    row = cursor.fetchone()
    cnt = row["cnt"] if isinstance(row, dict) else row[0]
    if cnt == 0:
        cursor.execute("""
        INSERT INTO govt_policy_parameters (
            smf_minimum_quota, govt_first_loss_guarantee, interest_subvention_pct,
            miss_base_rate, collateral_free_threshold, collateral_free_tieup_threshold,
            flexi_kcc_min, flexi_kcc_max, bank_max_npa_ceiling
        ) VALUES (0.556, 0.35, 3.0, 7.0, 200000.0, 300000.0, 10000.0, 50000.0, 0.045);
        """)

    cursor.execute(f"""CREATE TABLE IF NOT EXISTS workspace_sessions (
        id {pk}, token_hash TEXT UNIQUE NOT NULL, principal TEXT NOT NULL, expires_at TEXT NOT NULL)""")
    cursor.execute(f"""CREATE TABLE IF NOT EXISTS application_intake (
        id {pk}, application_id INTEGER UNIQUE NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
        payload TEXT NOT NULL, district TEXT NOT NULL, social_category TEXT NOT NULL, full_name TEXT NOT NULL,
        area_acres {real_t} NOT NULL, net_worth {real_t} NOT NULL, review_reason TEXT NOT NULL,
        decision_note TEXT, policy_id INTEGER, request_key TEXT UNIQUE)""")
    cursor.execute(f"""CREATE TABLE IF NOT EXISTS review_decisions (
        id {pk}, application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
        actor TEXT NOT NULL, action TEXT NOT NULL, reason TEXT NOT NULL, created_at {ts})""")
    cursor.execute(f"""CREATE TABLE IF NOT EXISTS allocation_runs (
        id {pk}, bank TEXT NOT NULL, policy_id INTEGER NOT NULL, selected_ids TEXT NOT NULL,
        state TEXT NOT NULL, created_at {ts}, committed_by TEXT)""")
    cursor.execute(f"""CREATE TABLE IF NOT EXISTS evidence_files (
        id {pk}, reference TEXT UNIQUE NOT NULL, farmer_id INTEGER NOT NULL, media_type TEXT NOT NULL, content {"BYTEA" if DATABASE_URL else "BLOB"} NOT NULL)""")
    if DATABASE_URL:
        cursor.execute("ALTER TABLE users_and_roles ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE")
        cursor.execute('DROP POLICY IF EXISTS "Bank & Govt Read All Applications" ON loan_applications')
        cursor.execute('DROP POLICY IF EXISTS "Farmers Read Own Applications" ON loan_applications')
        for table in ("farmer_profiles","loan_applications","grievances_and_policy_logs","workspace_sessions","application_intake","allocation_runs","evidence_files","review_decisions",
                      "users_and_roles","land_and_allied_assets","existing_liabilities","dss_evaluations",
                      "fund_tranches_and_usage","govt_policy_parameters"):
            cursor.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    conn.commit()
    conn.close()
    print("KrishiSetu Database initialized successfully.")


if __name__ == "__main__":
    init_db()

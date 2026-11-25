"""
KrishiSetu DSS - Relational Database Schema & Helper Methods
Aligned with Course Database-1.pdf and dms624.pdf specifications.
8 Core Tables:
1. users_and_roles
2. farmer_profiles
3. land_and_allied_assets
4. existing_liabilities
5. loan_applications
6. dss_evaluations
7. fund_tranches_and_usage
8. grievances_and_policy_logs
"""

import sqlite3
import json
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "krishisetu.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # 1. users_and_roles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users_and_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('farmer', 'bank_officer', 'govt_auditor', 'admin')),
        full_name TEXT NOT NULL,
        phone TEXT,
        district TEXT NOT NULL,
        branch_or_dept TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. farmer_profiles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS farmer_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        farmer_uid TEXT UNIQUE NOT NULL,
        pmkisan_id TEXT UNIQUE,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        gender TEXT CHECK(gender IN ('M', 'F', 'Other')),
        social_category TEXT NOT NULL CHECK(social_category IN ('GEN', 'OBC', 'SC', 'ST', 'Minority', 'PWD', 'Women')),
        education TEXT,
        years_farming INTEGER DEFAULT 5,
        is_pmjdy BOOLEAN DEFAULT 1,
        is_pmsby BOOLEAN DEFAULT 1,
        is_pmjjby BOOLEAN DEFAULT 1,
        village TEXT NOT NULL,
        district TEXT NOT NULL,
        state TEXT DEFAULT 'Uttar Pradesh',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users_and_roles(id) ON DELETE SET NULL
    );
    """)

    # 3. land_and_allied_assets
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS land_and_allied_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farmer_id INTEGER NOT NULL,
        survey_khasra_no TEXT NOT NULL,
        ownership_type TEXT NOT NULL CHECK(ownership_type IN ('owned', 'registered_lease', 'oral_lease', 'sharecropper')),
        area_acres REAL NOT NULL,
        area_hectares REAL NOT NULL,
        irrigated_pct REAL DEFAULT 100.0,
        irrigation_source TEXT NOT NULL CHECK(irrigation_source IN ('Drip', 'Sprinkler', 'Canal', 'Well', 'Dry')),
        land_fragmentation_flag BOOLEAN DEFAULT 0,
        distance_to_mandi_km REAL DEFAULT 5.0,
        livestock_count INTEGER DEFAULT 0,
        fisheries_count INTEGER DEFAULT 0,
        movable_asset_val_k REAL DEFAULT 0.0,
        immovable_asset_val_l REAL DEFAULT 0.0,
        net_worth REAL DEFAULT 0.0,
        panchayat_cert_doc TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (farmer_id) REFERENCES farmer_profiles(id) ON DELETE CASCADE
    );
    """)

    # 4. existing_liabilities
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS existing_liabilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farmer_id INTEGER NOT NULL,
        lender_name TEXT NOT NULL,
        lender_type TEXT NOT NULL CHECK(lender_type IN ('commercial_bank', 'cooperative', 'moneylender_informal')),
        outstanding_balance_m REAL DEFAULT 0.0,
        overdue_days INTEGER DEFAULT 0,
        is_npa BOOLEAN DEFAULT 0,
        is_wilful_default BOOLEAN DEFAULT 0,
        guarantor_liability REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (farmer_id) REFERENCES farmer_profiles(id) ON DELETE CASCADE
    );
    """)

    # 5. loan_applications
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS loan_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_no TEXT UNIQUE NOT NULL,
        farmer_id INTEGER NOT NULL,
        facility_type TEXT NOT NULL CHECK(facility_type IN ('Crop KCC', 'Flexi KCC', 'Allied KCC', 'Agri Term Loan')),
        requested_amount REAL NOT NULL,
        season TEXT DEFAULT 'Kharif',
        primary_crop TEXT NOT NULL,
        secondary_crop TEXT,
        marketing_tieup TEXT NOT NULL CHECK(marketing_tieup IN ('Direct', 'Cooperative', 'Government_Procurement', 'Corporate_Contract', 'None')),
        pmfby_optin BOOLEAN DEFAULT 1,
        status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted', 'under_review', 'approved', 'partial_approved', 'rejected', 'appealed')),
        bank_assigned TEXT DEFAULT 'State Bank of India',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (farmer_id) REFERENCES farmer_profiles(id) ON DELETE CASCADE
    );
    """)

    # 6. dss_evaluations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dss_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER UNIQUE NOT NULL,
        farmer_classification TEXT NOT NULL,
        decision_tree_path TEXT NOT NULL,
        scale_of_finance_limit REAL NOT NULL,
        sanctioned_amount REAL NOT NULL,
        pd_score REAL NOT NULL,
        lgd_score REAL NOT NULL,
        dscr_ratio REAL NOT NULL,
        expected_revenue REAL NOT NULL,
        drought_stress_revenue REAL NOT NULL,
        equity_priority_score REAL NOT NULL,
        shap_reasons TEXT NOT NULL,
        allocated_in_batch BOOLEAN DEFAULT 0,
        evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE
    );
    """)

    # 7. fund_tranches_and_usage
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fund_tranches_and_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        tranche_no INTEGER NOT NULL,
        tranche_name TEXT NOT NULL,
        percentage REAL NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'locked' CHECK(status IN ('locked', 'disbursed', 'redeemed')),
        voucher_code TEXT UNIQUE,
        qr_payload TEXT,
        merchant_name TEXT,
        redemption_timestamp TIMESTAMP,
        geo_proof_photo TEXT,
        geo_lat REAL,
        geo_long REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE
    );
    """)

    # 8. grievances_and_policy_logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS grievances_and_policy_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER,
        farmer_id INTEGER,
        category TEXT NOT NULL CHECK(category IN ('Incorrect land area', 'Unfair rejection', 'Collateral demanded under 2L', 'Delayed disbursal >14 days', 'Policy_Update', 'Other')),
        grievance_text TEXT NOT NULL,
        supporting_doc TEXT,
        bank_response TEXT,
        resolution_status TEXT DEFAULT 'open' CHECK(resolution_status IN ('open', 'resolved', 'escalated')),
        sla_deadline TIMESTAMP,
        govt_directive TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
        FOREIGN KEY (farmer_id) REFERENCES farmer_profiles(id) ON DELETE CASCADE
    );
    """)

    # Government Policy Parameters Table (Versioned)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS govt_policy_parameters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        smf_minimum_quota REAL DEFAULT 0.556,
        govt_first_loss_guarantee REAL DEFAULT 0.35,
        interest_subvention_pct REAL DEFAULT 3.0,
        miss_base_rate REAL DEFAULT 7.0,
        collateral_free_threshold REAL DEFAULT 200000.0,
        collateral_free_tieup_threshold REAL DEFAULT 300000.0,
        flexi_kcc_min REAL DEFAULT 10000.0,
        flexi_kcc_max REAL DEFAULT 50000.0,
        bank_max_npa_ceiling REAL DEFAULT 0.045,
        updated_by TEXT DEFAULT 'RBI / Ministry of Agriculture',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Insert initial default policy if empty
    cursor.execute("SELECT COUNT(*) FROM govt_policy_parameters;")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO govt_policy_parameters (
            smf_minimum_quota, govt_first_loss_guarantee, interest_subvention_pct,
            miss_base_rate, collateral_free_threshold, collateral_free_tieup_threshold,
            flexi_kcc_min, flexi_kcc_max, bank_max_npa_ceiling
        ) VALUES (0.556, 0.35, 3.0, 7.0, 200000.0, 300000.0, 10000.0, 50000.0, 0.045);
        """)

    conn.commit()
    conn.close()
    print("KrishiSetu Database initialized successfully.")

if __name__ == "__main__":
    init_db()

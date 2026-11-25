-- ============================================================================
-- KrishiSetu DSS - Supabase PostgreSQL Schema, RBAC Policies & Storage Setup
-- Course: DMS624 / IME624 • Aligned with Database-1.pdf & dms624.pdf
-- Run this SQL inside Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- 1. users_and_roles (Role-Based Access Control: farmer, bank_officer, govt_auditor)
CREATE TABLE IF NOT EXISTS users_and_roles (
    id BIGSERIAL PRIMARY KEY,
    auth_uid UUID UNIQUE, -- Maps to Supabase auth.users(id)
    email TEXT UNIQUE,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('farmer', 'bank_officer', 'govt_auditor', 'admin')),
    full_name TEXT NOT NULL,
    phone TEXT,
    district TEXT NOT NULL,
    branch_or_dept TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. farmer_profiles
CREATE TABLE IF NOT EXISTS farmer_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users_and_roles(id) ON DELETE SET NULL,
    farmer_uid TEXT UNIQUE NOT NULL,
    pmkisan_id TEXT UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('M', 'F', 'Other')),
    social_category TEXT NOT NULL CHECK (social_category IN ('GEN', 'OBC', 'SC', 'ST', 'Minority', 'PWD', 'Women')),
    education TEXT,
    years_farming INTEGER DEFAULT 5,
    is_pmjdy BOOLEAN DEFAULT TRUE,
    is_pmsby BOOLEAN DEFAULT TRUE,
    is_pmjjby BOOLEAN DEFAULT TRUE,
    village TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT DEFAULT 'Uttar Pradesh',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. land_and_allied_assets
CREATE TABLE IF NOT EXISTS land_and_allied_assets (
    id BIGSERIAL PRIMARY KEY,
    farmer_id BIGINT NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
    survey_khasra_no TEXT NOT NULL,
    ownership_type TEXT NOT NULL CHECK (ownership_type IN ('owned', 'registered_lease', 'oral_lease', 'sharecropper')),
    area_acres DOUBLE PRECISION NOT NULL,
    area_hectares DOUBLE PRECISION NOT NULL,
    irrigated_pct DOUBLE PRECISION DEFAULT 100.0,
    irrigation_source TEXT NOT NULL CHECK (irrigation_source IN ('Drip', 'Sprinkler', 'Canal', 'Well', 'Dry')),
    land_fragmentation_flag BOOLEAN DEFAULT FALSE,
    distance_to_mandi_km DOUBLE PRECISION DEFAULT 5.0,
    livestock_count INTEGER DEFAULT 0,
    fisheries_count INTEGER DEFAULT 0,
    movable_asset_val_k DOUBLE PRECISION DEFAULT 0.0,
    immovable_asset_val_l DOUBLE PRECISION DEFAULT 0.0,
    net_worth DOUBLE PRECISION DEFAULT 0.0,
    panchayat_cert_doc TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. existing_liabilities
CREATE TABLE IF NOT EXISTS existing_liabilities (
    id BIGSERIAL PRIMARY KEY,
    farmer_id BIGINT NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
    lender_name TEXT NOT NULL,
    lender_type TEXT NOT NULL CHECK (lender_type IN ('commercial_bank', 'cooperative', 'moneylender_informal')),
    outstanding_balance_m DOUBLE PRECISION DEFAULT 0.0,
    overdue_days INTEGER DEFAULT 0,
    is_npa BOOLEAN DEFAULT FALSE,
    is_wilful_default BOOLEAN DEFAULT FALSE,
    guarantor_liability DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. loan_applications
CREATE TABLE IF NOT EXISTS loan_applications (
    id BIGSERIAL PRIMARY KEY,
    application_no TEXT UNIQUE NOT NULL,
    farmer_id BIGINT NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
    facility_type TEXT NOT NULL CHECK (facility_type IN ('Crop KCC', 'Flexi KCC', 'Allied KCC', 'Agri Term Loan')),
    requested_amount DOUBLE PRECISION NOT NULL,
    season TEXT DEFAULT 'Kharif',
    primary_crop TEXT NOT NULL,
    secondary_crop TEXT,
    marketing_tieup TEXT NOT NULL CHECK (marketing_tieup IN ('Direct', 'Cooperative', 'Government_Procurement', 'Corporate_Contract', 'None')),
    pmfby_optin BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'partial_approved', 'rejected', 'appealed')),
    bank_assigned TEXT DEFAULT 'State Bank of India',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. dss_evaluations
CREATE TABLE IF NOT EXISTS dss_evaluations (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT UNIQUE NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    farmer_classification TEXT NOT NULL,
    decision_tree_path TEXT NOT NULL,
    scale_of_finance_limit DOUBLE PRECISION NOT NULL,
    sanctioned_amount DOUBLE PRECISION NOT NULL,
    pd_score DOUBLE PRECISION NOT NULL,
    lgd_score DOUBLE PRECISION NOT NULL,
    dscr_ratio DOUBLE PRECISION NOT NULL,
    expected_revenue DOUBLE PRECISION NOT NULL,
    drought_stress_revenue DOUBLE PRECISION NOT NULL,
    equity_priority_score DOUBLE PRECISION NOT NULL,
    shap_reasons TEXT NOT NULL,
    allocated_in_batch BOOLEAN DEFAULT FALSE,
    evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. fund_tranches_and_usage
CREATE TABLE IF NOT EXISTS fund_tranches_and_usage (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    tranche_no INTEGER NOT NULL,
    tranche_name TEXT NOT NULL,
    percentage DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'disbursed', 'redeemed')),
    voucher_code TEXT UNIQUE,
    qr_payload TEXT,
    merchant_name TEXT,
    redemption_timestamp TIMESTAMPTZ,
    geo_proof_photo TEXT,
    geo_lat DOUBLE PRECISION,
    geo_long DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. grievances_and_policy_logs
CREATE TABLE IF NOT EXISTS grievances_and_policy_logs (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT REFERENCES loan_applications(id) ON DELETE CASCADE,
    farmer_id BIGINT REFERENCES farmer_profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('Incorrect land area', 'Unfair rejection', 'Collateral demanded under 2L', 'Delayed disbursal >14 days', 'Policy_Update', 'Other')),
    grievance_text TEXT NOT NULL,
    supporting_doc TEXT,
    bank_response TEXT,
    resolution_status TEXT DEFAULT 'open' CHECK (resolution_status IN ('open', 'resolved', 'escalated')),
    sla_deadline TIMESTAMPTZ,
    govt_directive TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versioned Govt Policy Parameters
CREATE TABLE IF NOT EXISTS govt_policy_parameters (
    id BIGSERIAL PRIMARY KEY,
    smf_minimum_quota DOUBLE PRECISION DEFAULT 0.556,
    govt_first_loss_guarantee DOUBLE PRECISION DEFAULT 0.35,
    interest_subvention_pct DOUBLE PRECISION DEFAULT 3.0,
    miss_base_rate DOUBLE PRECISION DEFAULT 7.0,
    collateral_free_threshold DOUBLE PRECISION DEFAULT 200000.0,
    collateral_free_tieup_threshold DOUBLE PRECISION DEFAULT 300000.0,
    flexi_kcc_min DOUBLE PRECISION DEFAULT 10000.0,
    flexi_kcc_max DOUBLE PRECISION DEFAULT 50000.0,
    bank_max_npa_ceiling DOUBLE PRECISION DEFAULT 0.045,
    updated_by TEXT DEFAULT 'RBI / Ministry of Agriculture',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Supabase Storage Buckets for Grievance Docs & Geo-Tagged Sowing Photos
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('krishisetu-docs', 'krishisetu-docs', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Row Level Security (RLS) & RBAC Policies
-- ============================================================================
ALTER TABLE farmer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE grievances_and_policy_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated service role or demo policies
DROP POLICY IF EXISTS "Bank & Govt Read All Applications" ON loan_applications;
CREATE POLICY "Bank & Govt Read All Applications" ON loan_applications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users_and_roles u
            WHERE u.auth_uid = auth.uid() AND u.role IN ('bank_officer', 'govt_auditor', 'admin')
        )
    );

DROP POLICY IF EXISTS "Farmers Read Own Applications" ON loan_applications;
CREATE POLICY "Farmers Read Own Applications" ON loan_applications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM farmer_profiles fp
            JOIN users_and_roles u ON fp.user_id = u.id
            WHERE fp.id = loan_applications.farmer_id AND u.auth_uid = auth.uid()
        )
    );

-- Seed default RBI / Ministry policy row if empty
INSERT INTO govt_policy_parameters (
    smf_minimum_quota, govt_first_loss_guarantee, interest_subvention_pct,
    miss_base_rate, collateral_free_threshold, collateral_free_tieup_threshold,
    flexi_kcc_min, flexi_kcc_max, bank_max_npa_ceiling
)
SELECT 0.556, 0.35, 3.0, 7.0, 200000.0, 300000.0, 10000.0, 50000.0, 0.045
WHERE NOT EXISTS (SELECT 1 FROM govt_policy_parameters);

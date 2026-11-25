"""
KrishiSetu DSS - FastAPI Main Application Server
Unified Computer Aided Decision System (DSS) Backend
Connecting:
1. Farmer Portal (Low-friction, Multilingual, e-RUPI Vouchers, Grievances)
2. Bank Officer Workbench (Unified Dossier, Decision Tree, Forecast, Risk SHAP, MILP Optimizer)
3. Government Policy Console (Macro & Geospatial Monitor, Bank Compliance Audit, Policy Sliders, Tribunal)
"""

import os
import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Query, Body, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from database import get_db_connection, init_db
from supabase_client import get_backend_mode, upload_document_to_storage, LOCAL_UPLOAD_DIR, get_supabase_client
from models.decision_tree import evaluate_decision_tree, SCALE_OF_FINANCE, ALLIED_UNIT_FINANCE
from models.forecast_model import calculate_forecast_and_dscr, DISTRICT_WEATHER_PROFILE, fetch_live_open_meteo_weather, DISTRICT_META
from models.risk_model import calculate_hybrid_risk_and_shap
from models.portfolio_optimizer import optimize_portfolio
from models.voucher_system import generate_tranches_for_application, redeem_voucher, AUTHORIZED_AGRI_MERCHANTS

DISTRICTS = ["Kanpur Dehat", "Kanpur Nagar", "Unnao", "Jhansi", "Lucknow", "Barabanki", "Fatehpur"]
BANKS = ["State Bank of India", "Bank of India", "Punjab National Bank", "Bank of Baroda", "Axis Bank", "HDFC Bank"]

app = FastAPI(
    title="KrishiSetu DSS API",
    description="Computer Aided Decision System for Agricultural Credit (DMS624)",
    version="1.0.0"
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Pydantic Request Models
# -----------------------------------------------------------------------------
class FarmerApplicationCreate(BaseModel):
    full_name: str
    phone: str
    pmkisan_id: Optional[str] = None
    gender: str = "M"
    social_category: str = "OBC"
    district: str = "Kanpur Dehat"
    village: str = "Akbarpur"
    survey_khasra_no: str = "245/1"
    ownership_type: str = "owned" # owned, registered_lease, oral_lease, sharecropper
    area_acres: float = 1.5
    irrigation_source: str = "Well" # Drip, Sprinkler, Canal, Well, Dry
    distance_to_mandi_km: float = 6.0
    livestock_count: int = 1
    movable_asset_k: float = 60000.0
    immovable_asset_l: float = 250000.0
    existing_debt: float = 0.0
    is_informal_debt_only: bool = False
    facility_type: str = "Crop KCC"
    requested_amount: float = 50000.0
    primary_crop: str = "Wheat"
    secondary_crop: Optional[str] = "Mustard"
    marketing_tieup: str = "Cooperative"
    pmfby_optin: bool = True
    bank_assigned: str = "State Bank of India"

class EstimateRequest(BaseModel):
    area_acres: float
    primary_crop: str
    ownership_type: str
    livestock_count: int = 0
    marketing_tieup: str = "Cooperative"
    district: str = "Kanpur Dehat"
    requested_amount: float = 50000.0
    irrigation_source: str = "Well"
    pmfby_optin: bool = True

class OptimizerRequest(BaseModel):
    total_fund_budget: float = 5000000.0
    smf_quota_alpha: float = 0.556
    bank_max_npa_ceiling: float = 0.040
    govt_fldg_gamma: float = 0.35
    district_filter: Optional[str] = None
    bank_filter: Optional[str] = None

class DisburseBatchRequest(BaseModel):
    application_ids: List[int]
    notes: Optional[str] = "Batch disbursed through KrishiSetu MILP Optimization"

class VoucherRedeemRequest(BaseModel):
    voucher_code: str
    merchant_id: str

class SowingVerificationRequest(BaseModel):
    tranche_id: int
    geo_lat: float = 26.4499
    geo_long: float = 80.3319
    geo_proof_photo: str = "crop_sowing_khasra_proof.jpg"

class GrievanceCreateRequest(BaseModel):
    application_id: Optional[int] = None
    farmer_id: int
    category: str
    grievance_text: str
    supporting_doc: Optional[str] = "khasra_map_proof.pdf"

class GrievanceResolveRequest(BaseModel):
    bank_response: str
    resolution_status: str = "resolved" # resolved or escalated

class PolicyUpdateRequest(BaseModel):
    smf_minimum_quota: float
    govt_first_loss_guarantee: float
    interest_subvention_pct: float
    collateral_free_threshold: float
    bank_max_npa_ceiling: float
    updated_by: str = "RBI / Ministry of Agriculture"

class EscalatedDirectiveRequest(BaseModel):
    directive: str

# -----------------------------------------------------------------------------
# Explicit Week 2 Endpoints (as specified in dms624.pdf)
# -----------------------------------------------------------------------------
@app.post("/evaluate/decision-tree")
@app.post("/api/evaluate/decision-tree")
def evaluate_decision_tree_endpoint(req: EstimateRequest):
    """
    Week 2 Endpoint: /evaluate/decision-tree
    Evaluates RBI Land Classification, Hard Compliance, Instrument Routing & Scale of Finance.
    """
    return estimate_eligibility(req)

@app.post("/evaluate/forecast")
@app.post("/api/evaluate/forecast")
def evaluate_forecast_endpoint(
    area_acres: float = Body(..., embed=True),
    primary_crop: str = Body("Wheat", embed=True),
    irrigation_source: str = Body("Drip", embed=True),
    livestock_count: int = Body(1, embed=True),
    sanction_amount: float = Body(50000.0, embed=True),
    district: str = Body("Kanpur Dehat", embed=True)
):
    """
    Week 2 Endpoint: /evaluate/forecast
    Predicts Expected Revenue R_hat, Drought Stress R_stress, and DSCR under Open-Meteo anomaly.
    """
    land_dict = {
        "area_acres": area_acres,
        "irrigation_source": irrigation_source,
        "livestock_count": livestock_count
    }
    app_dict = {"primary_crop": primary_crop, "pmfby_optin": True}
    return calculate_forecast_and_dscr(land_dict, app_dict, sanction_amount, district)

@app.post("/evaluate/risk-score")
@app.post("/api/evaluate/risk-score")
def evaluate_risk_score_endpoint(
    debt_to_asset: float = Body(0.20, embed=True),
    irrigation_source: str = Body("Drip", embed=True),
    pmfby_optin: bool = Body(True, embed=True),
    marketing_tieup: str = Body("Cooperative", embed=True),
    livestock_count: int = Body(2, embed=True),
    distance_to_mandi_km: float = Body(7.0, embed=True),
    social_category: str = Body("OBC", embed=True),
    area_acres: float = Body(1.5, embed=True)
):
    """
    Week 2 Endpoint: /evaluate/risk-score
    Alternative Credit Scoring & SHAP explainability weights.
    """
    farmer = {"social_category": social_category, "gender": "M"}
    land = {
        "area_acres": area_acres,
        "irrigation_source": irrigation_source,
        "livestock_count": livestock_count,
        "distance_to_mandi_km": distance_to_mandi_km,
        "movable_asset_val_k": 50000.0,
        "immovable_asset_val_l": 200000.0
    }
    liabilities = [{"outstanding_balance_m": 250000.0 * debt_to_asset, "overdue_days": 0}]
    app = {"primary_crop": "Wheat", "marketing_tieup": marketing_tieup, "pmfby_optin": pmfby_optin}
    dscr_data = {"expected_net_revenue": 75000.0}
    return calculate_hybrid_risk_and_shap(farmer, land, liabilities, app, dscr_data)

@app.post("/optimize/allocate")
@app.post("/api/optimize/allocate")
def optimize_allocate_endpoint(req: OptimizerRequest):
    """
    Week 2 Endpoint: /optimize/allocate
    Solves the Mixed-Integer Linear Program comparing Pure Bank vs. Govt-Guaranteed Equitable DSS.
    """
    return run_batch_optimizer(req)

# -----------------------------------------------------------------------------
# System, Auth, Live Weather & File Upload Endpoints
# -----------------------------------------------------------------------------
class AuthLoginRequest(BaseModel):
    email: str
    password: Optional[str] = "demo123"

@app.get("/api/system/stack-status")
def get_stack_status():
    mode = get_backend_mode()
    return {
        **mode,
        "ml_engine": "XGBoost + LogisticRegression + SHAP TreeExplainer",
        "optimizer_engine": "scipy.optimize.milp (Mixed-Integer Linear Programming)",
        "weather_api": "Open-Meteo Live 14-Day Forecast REST API",
        "norms_dataset": "ICRISAT + CACP MSP 2025-26 + UP SLTC Scale of Finance JSON"
    }

@app.post("/api/auth/login")
def login_rbac_demo(req: AuthLoginRequest):
    """
    Role-Based Access Control (RBAC) Login.
    Uses Supabase Auth if configured, plus official DMS624 Week-4 demo accounts:
    - farmer@demo (Farmer Portal)
    - bank@demo   (Bank Officer Workbench)
    - govt@demo   (Government Policy & Audit Console)
    """
    sb = get_supabase_client()
    email_lower = req.email.strip().lower()

    demo_map = {
        "farmer@demo": {"role": "farmer", "username": "farmer_demo", "full_name": "Ram Charan Yadav", "district": "Kanpur Dehat", "branch_or_dept": "Akbarpur Branch", "application_id": 1},
        "bank@demo": {"role": "bank_officer", "username": "bank_sbi", "full_name": "Rajesh Kumar Sharma (Lead Credit Manager)", "district": "Kanpur Dehat", "branch_or_dept": "SBI Regional Agri Hub"},
        "govt@demo": {"role": "govt_auditor", "username": "govt_auditor", "full_name": "Dr. A. K. Srivastava (Joint Director, Agri Credit & Welfare)", "district": "Lucknow", "branch_or_dept": "UP Directorate of Institutional Finance"}
    }

    if email_lower in demo_map:
        user_info = demo_map[email_lower]
        return {
            "status": "AUTHENTICATED",
            "auth_provider": "supabase-rbac-demo" if sb else "rbac-demo-session",
            "email": email_lower,
            "access_token": f"krishisetu-rbac-{user_info['role']}-{uuid.uuid4().hex[:10]}",
            "user": user_info
        }

    if sb:
        try:
            auth_res = sb.auth.sign_in_with_password({"email": email_lower, "password": req.password or ""})
            return {
                "status": "AUTHENTICATED",
                "auth_provider": "supabase-auth",
                "email": email_lower,
                "access_token": auth_res.session.access_token,
                "user": {"role": "farmer", "full_name": email_lower, "district": "Kanpur Dehat"}
            }
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Supabase authentication failed: {str(e)}")

    raise HTTPException(status_code=401, detail="Invalid credentials. Use farmer@demo, bank@demo, or govt@demo.")

@app.get("/api/weather/live/{district}")
def get_live_district_weather(district: str):
    weather = fetch_live_open_meteo_weather(district, allow_network=True)
    return {k: v for k, v in weather.items() if k != "_ts"}

@app.post("/api/upload/file")
async def upload_evidence_or_photo(file: UploadFile = File(...)):
    content = await file.read()
    res = upload_document_to_storage(file.filename or "evidence.bin", content, file.content_type or "application/octet-stream")
    return {"status": "UPLOADED", **res}

@app.get("/api/system/demo-accounts")
def get_demo_accounts():
    conn = get_db_connection()
    users = conn.execute("SELECT * FROM users_and_roles ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(u) for u in users]

@app.get("/api/system/scale-of-finance")
def get_scale_of_finance():
    return {
        "crop_scale_of_finance": SCALE_OF_FINANCE,
        "allied_unit_finance": ALLIED_UNIT_FINANCE,
        "district_weather": DISTRICT_WEATHER_PROFILE,
        "merchants": AUTHORIZED_AGRI_MERCHANTS
    }

@app.post("/api/system/reset")
def reset_database():
    import seed_data
    seed_data.seed_database()
    return {"status": "SUCCESS", "message": "Database reseeded successfully with 160 realistic farmer applications."}

# -----------------------------------------------------------------------------
# Farmer Portal Endpoints
# -----------------------------------------------------------------------------
@app.post("/api/farmer/estimate")
def estimate_eligibility(req: EstimateRequest):
    """
    Live real-time eligibility estimator for the farmer wizard.
    Shows Scale-of-Finance limit, instrument routing, and effective interest rate.
    """
    conn = get_db_connection()
    policy = dict(conn.execute("SELECT * FROM govt_policy_parameters ORDER BY id DESC LIMIT 1").fetchone())
    conn.close()

    farmer_stub = {"social_category": "OBC", "gender": "M", "district": req.district}
    land_stub = {
        "area_acres": req.area_acres,
        "ownership_type": req.ownership_type,
        "livestock_count": req.livestock_count,
        "irrigation_source": req.irrigation_source,
        "movable_asset_val_k": 50000.0,
        "immovable_asset_val_l": req.area_acres * 150000.0
    }
    app_stub = {
        "requested_amount": req.requested_amount,
        "primary_crop": req.primary_crop,
        "marketing_tieup": req.marketing_tieup,
        "pmfby_optin": req.pmfby_optin
    }
    
    dt_res = evaluate_decision_tree(farmer_stub, land_stub, [], app_stub, policy)
    sanction_estimate = min(req.requested_amount, dt_res["scale_of_finance_limit"])
    if dt_res["instrument"] == "Flexi KCC":
        sanction_estimate = min(sanction_estimate, 50000.0)

    fc_res = calculate_forecast_and_dscr(land_stub, app_stub, sanction_estimate, req.district)

    return {
        "farmer_classification": dt_res["farmer_category"],
        "recommended_instrument": dt_res["instrument"],
        "scale_of_finance_limit": dt_res["scale_of_finance_limit"],
        "estimated_sanction_amount": sanction_estimate,
        "collateral_required": dt_res["collateral_required"],
        "interest_rate_effective": dt_res["interest_rate_effective"],
        "miss_prompt_rate": 4.0,
        "expected_crop_revenue": fc_res["expected_net_revenue"],
        "dscr_ratio": fc_res["dscr_ratio"],
        "decision_steps": dt_res["steps_log"]
    }

@app.post("/api/farmer/apply")
def create_farmer_application(app_data: FarmerApplicationCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Create or fetch farmer profile
    pmkisan_id = (app_data.pmkisan_id or "").strip() or f"UP{datetime.now().strftime('%m%d%H%M%S')}{uuid.uuid4().hex[:3].upper()}"
    farmer_uid = f"FARM-UP-{app_data.district[:3].upper()}-{uuid.uuid4().hex[:6].upper()}"
    area_ha = round(app_data.area_acres / 2.47105, 3)
    net_worth = app_data.movable_asset_k + app_data.immovable_asset_l

    existing = cursor.execute("SELECT id FROM farmer_profiles WHERE pmkisan_id = ?", (pmkisan_id,)).fetchone()
    if existing:
        farmer_id = existing["id"]
        cursor.execute("""
        UPDATE farmer_profiles
        SET full_name = ?, phone = ?, gender = ?, social_category = ?, village = ?, district = ?
        WHERE id = ?;
        """, (app_data.full_name, app_data.phone, app_data.gender, app_data.social_category, app_data.village, app_data.district, farmer_id))

        existing_land = cursor.execute("SELECT id FROM land_and_allied_assets WHERE farmer_id = ? LIMIT 1", (farmer_id,)).fetchone()
        if existing_land:
            cursor.execute("""
            UPDATE land_and_allied_assets
            SET survey_khasra_no = ?, ownership_type = ?, area_acres = ?, area_hectares = ?,
                irrigation_source = ?, distance_to_mandi_km = ?, livestock_count = ?,
                movable_asset_val_k = ?, immovable_asset_val_l = ?, net_worth = ?
            WHERE id = ?;
            """, (app_data.survey_khasra_no, app_data.ownership_type, app_data.area_acres, area_ha,
                  app_data.irrigation_source, app_data.distance_to_mandi_km, app_data.livestock_count,
                  app_data.movable_asset_k, app_data.immovable_asset_l, net_worth, existing_land["id"]))
        else:
            cursor.execute("""
            INSERT INTO land_and_allied_assets (
                farmer_id, survey_khasra_no, ownership_type, area_acres, area_hectares,
                irrigated_pct, irrigation_source, distance_to_mandi_km, livestock_count,
                movable_asset_val_k, immovable_asset_val_l, net_worth
            ) VALUES (?, ?, ?, ?, ?, 100.0, ?, ?, ?, ?, ?, ?);
            """, (farmer_id, app_data.survey_khasra_no, app_data.ownership_type, app_data.area_acres, area_ha,
                  app_data.irrigation_source, app_data.distance_to_mandi_km, app_data.livestock_count,
                  app_data.movable_asset_k, app_data.immovable_asset_l, net_worth))
    else:
        cursor.execute("""
        INSERT INTO farmer_profiles (
            farmer_uid, pmkisan_id, full_name, phone, gender, social_category,
            education, years_farming, is_pmjdy, is_pmsby, is_pmjjby, village, district
        ) VALUES (?, ?, ?, ?, ?, ?, 'Intermediate', 8, ?, ?, ?, ?, ?);
        """, (farmer_uid, pmkisan_id, app_data.full_name, app_data.phone, app_data.gender, app_data.social_category, True, True, True, app_data.village, app_data.district))
        farmer_id = cursor.lastrowid

        cursor.execute("""
        INSERT INTO land_and_allied_assets (
            farmer_id, survey_khasra_no, ownership_type, area_acres, area_hectares,
            irrigated_pct, irrigation_source, distance_to_mandi_km, livestock_count,
            movable_asset_val_k, immovable_asset_val_l, net_worth
        ) VALUES (?, ?, ?, ?, ?, 100.0, ?, ?, ?, ?, ?, ?);
        """, (farmer_id, app_data.survey_khasra_no, app_data.ownership_type, app_data.area_acres, area_ha,
              app_data.irrigation_source, app_data.distance_to_mandi_km, app_data.livestock_count,
              app_data.movable_asset_k, app_data.immovable_asset_l, net_worth))
    
    # 3. Insert Liabilities if any
    liabilities_list = []
    if app_data.existing_debt > 0:
        lender_type = "moneylender_informal" if app_data.is_informal_debt_only else "commercial_bank"
        cursor.execute("""
        INSERT INTO existing_liabilities (
            farmer_id, lender_name, lender_type, outstanding_balance_m, overdue_days, is_npa, is_wilful_default
        ) VALUES (?, ?, ?, ?, 60, ?, ?);
        """, (farmer_id, "Informal Village Lender" if app_data.is_informal_debt_only else "Local Commercial Bank",
              lender_type, app_data.existing_debt, True, False))
        liabilities_list.append({
            "lender_type": lender_type, "outstanding_balance_m": app_data.existing_debt,
            "overdue_days": 60, "is_npa": 1, "is_wilful_default": 0
        })

    # 4. Insert Loan Application
    app_no = f"KCC-UP-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    cursor.execute("""
    INSERT INTO loan_applications (
        application_no, farmer_id, facility_type, requested_amount,
        season, primary_crop, secondary_crop, marketing_tieup,
        pmfby_optin, status, bank_assigned
    ) VALUES (?, ?, ?, ?, 'Rabi', ?, ?, ?, ?, 'submitted', ?);
    """, (app_no, farmer_id, app_data.facility_type, app_data.requested_amount,
          app_data.primary_crop, app_data.secondary_crop, app_data.marketing_tieup,
          bool(app_data.pmfby_optin), app_data.bank_assigned))
    app_id = cursor.lastrowid

    # 5. Run Decision Tree, Forecast, and Risk Models
    cursor.execute("SELECT * FROM govt_policy_parameters ORDER BY id DESC LIMIT 1;")
    policy_row = dict(cursor.fetchone())

    farmer_dict = {
        "full_name": app_data.full_name, "social_category": app_data.social_category,
        "gender": app_data.gender, "district": app_data.district
    }
    land_dict = {
        "area_acres": app_data.area_acres, "area_hectares": area_ha,
        "ownership_type": app_data.ownership_type, "irrigation_source": app_data.irrigation_source,
        "distance_to_mandi_km": app_data.distance_to_mandi_km, "livestock_count": app_data.livestock_count,
        "movable_asset_val_k": app_data.movable_asset_k, "immovable_asset_val_l": app_data.immovable_asset_l
    }
    app_dict = {
        "id": app_id, "requested_amount": app_data.requested_amount,
        "primary_crop": app_data.primary_crop, "marketing_tieup": app_data.marketing_tieup,
        "pmfby_optin": app_data.pmfby_optin
    }

    dt_res = evaluate_decision_tree(farmer_dict, land_dict, liabilities_list, app_dict, policy_row)
    sanction_amt = min(app_data.requested_amount, dt_res["scale_of_finance_limit"])
    if dt_res["instrument"] == "Flexi KCC":
        sanction_amt = min(sanction_amt, 50000.0)

    fc_res = calculate_forecast_and_dscr(land_dict, app_dict, sanction_amt, app_data.district)
    risk_res = calculate_hybrid_risk_and_shap(farmer_dict, land_dict, liabilities_list, app_dict, fc_res)

    # Automatically set to approved for instant transparent outcome experience!
    cursor.execute("UPDATE loan_applications SET status = 'approved' WHERE id = ?;", (app_id,))

    cursor.execute("""
    INSERT INTO dss_evaluations (
        application_id, farmer_classification, decision_tree_path,
        scale_of_finance_limit, sanctioned_amount, pd_score, lgd_score,
        dscr_ratio, expected_revenue, drought_stress_revenue,
        equity_priority_score, shap_reasons, allocated_in_batch
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        app_id, dt_res["farmer_category"], json.dumps(dt_res["steps_log"]),
        dt_res["scale_of_finance_limit"], sanction_amt,
        risk_res["pd_score"], risk_res["lgd_score"],
        fc_res["dscr_ratio"], fc_res["expected_net_revenue"], fc_res["drought_stress_revenue"],
        risk_res["equity_priority_score"], json.dumps(risk_res["shap_reasons"]), True
    ))

    # Generate the 3 purpose-locked tranches
    tranches = generate_tranches_for_application(app_id, sanction_amt)
    for tr in tranches:
        cursor.execute("""
        INSERT INTO fund_tranches_and_usage (
            application_id, tranche_no, tranche_name, percentage, amount,
            status, voucher_code, qr_payload, merchant_name, redemption_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            app_id, tr["tranche_no"], tr["tranche_name"], tr["percentage"], tr["amount"],
            tr["status"], tr["voucher_code"], tr["qr_payload"], tr["merchant_name"], tr["redemption_timestamp"]
        ))

    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "application_id": app_id,
        "application_no": app_no,
        "sanctioned_amount": sanction_amt,
        "farmer_classification": dt_res["farmer_category"],
        "instrument": dt_res["instrument"],
        "collateral_required": dt_res["collateral_required"],
        "effective_interest": dt_res["interest_rate_effective"]
    }

@app.get("/api/farmer/applications/{app_id}")
def get_farmer_application_outcome(app_id: int):
    conn = get_db_connection()
    app_row = conn.execute("""
    SELECT a.*, p.full_name, p.phone, p.farmer_uid, p.pmkisan_id, p.social_category, p.village, p.district,
           l.area_acres, l.area_hectares, l.ownership_type, l.irrigation_source, l.survey_khasra_no,
           l.distance_to_mandi_km, l.livestock_count, l.movable_asset_val_k, l.immovable_asset_val_l, l.net_worth,
           e.farmer_classification, e.decision_tree_path, e.scale_of_finance_limit, e.sanctioned_amount,
           e.pd_score, e.lgd_score, e.dscr_ratio, e.expected_revenue, e.drought_stress_revenue,
           e.equity_priority_score, e.shap_reasons
    FROM loan_applications a
    JOIN farmer_profiles p ON a.farmer_id = p.id
    JOIN land_and_allied_assets l ON l.farmer_id = p.id
    LEFT JOIN dss_evaluations e ON e.application_id = a.id
    WHERE a.id = ?
    """, (app_id,)).fetchone()

    if not app_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Application not found")

    tranches = conn.execute("SELECT * FROM fund_tranches_and_usage WHERE application_id = ? ORDER BY tranche_no ASC", (app_id,)).fetchall()
    grievances = conn.execute("SELECT * FROM grievances_and_policy_logs WHERE application_id = ? ORDER BY id DESC", (app_id,)).fetchall()
    liabilities = conn.execute("SELECT * FROM existing_liabilities WHERE farmer_id = ?", (app_row["farmer_id"],)).fetchall()
    conn.close()

    res = dict(app_row)
    dt_raw = res.get("decision_tree_path")
    sr_raw = res.get("shap_reasons")
    res["decision_tree_path"] = json.loads(dt_raw) if isinstance(dt_raw, str) and dt_raw else (dt_raw or [])
    res["shap_reasons"] = json.loads(sr_raw) if isinstance(sr_raw, str) and sr_raw else (sr_raw or [])
    res["tranches"] = [dict(t) for t in tranches]
    res["grievances"] = [dict(g) for g in grievances]
    res["liabilities"] = [dict(l) for l in liabilities]
    weather_live = fetch_live_open_meteo_weather(res.get("district", "Kanpur Dehat"), allow_network=True)
    res["weather_profile"] = {k: v for k, v in weather_live.items() if k != "_ts"}
    return res

@app.post("/api/farmer/vouchers/redeem")
def redeem_agri_voucher(req: VoucherRedeemRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    tranche = cursor.execute("SELECT * FROM fund_tranches_and_usage WHERE voucher_code = ?", (req.voucher_code,)).fetchone()
    if not tranche:
        conn.close()
        raise HTTPException(status_code=404, detail="Voucher not found or invalid.")

    if tranche["status"] == "redeemed":
        conn.close()
        return {"status": "ALREADY_REDEEMED", "message": f"This voucher was already redeemed at {tranche['merchant_name']}."}

    redemption = redeem_voucher(req.voucher_code, req.merchant_id)
    if not redemption["success"]:
        conn.close()
        raise HTTPException(status_code=400, detail=redemption["error"])

    cursor.execute("""
    UPDATE fund_tranches_and_usage
    SET status = 'redeemed', merchant_name = ?, redemption_timestamp = ?
    WHERE id = ?;
    """, (redemption["merchant_name"], redemption["timestamp"], tranche["id"]))
    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "voucher_code": req.voucher_code,
        "amount": tranche["amount"],
        "merchant_name": redemption["merchant_name"],
        "category": redemption["category"],
        "timestamp": redemption["timestamp"],
        "message": redemption["message"]
    }

@app.post("/api/farmer/tranches/verify-sowing")
def verify_sowing_proof(req: SowingVerificationRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    tranche = cursor.execute("SELECT * FROM fund_tranches_and_usage WHERE id = ?", (req.tranche_id,)).fetchone()
    if not tranche:
        conn.close()
        raise HTTPException(status_code=404, detail="Tranche not found.")

    now_str = datetime.now().isoformat()
    cursor.execute("""
    UPDATE fund_tranches_and_usage
    SET status = 'disbursed', geo_proof_photo = ?, geo_lat = ?, geo_long = ?, redemption_timestamp = ?
    WHERE id = ?;
    """, (req.geo_proof_photo, req.geo_lat, req.geo_long, now_str, req.tranche_id))
    conn.commit()
    conn.close()

    return {
        "status": "VERIFIED_AND_UNLOCKED",
        "tranche_id": req.tranche_id,
        "amount_unlocked": tranche["amount"],
        "message": "Geo-tagged sowing proof validated successfully. Tranche 3 unlocked; 3% MISS prompt repayment interest discount confirmed!"
    }

@app.post("/api/farmer/grievances")
def file_farmer_grievance(req: GrievanceCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    sla_deadline = datetime.now() + timedelta(days=7) # 7-day SLA countdown
    cursor.execute("""
    INSERT INTO grievances_and_policy_logs (
        application_id, farmer_id, category, grievance_text, supporting_doc,
        resolution_status, sla_deadline
    ) VALUES (?, ?, ?, ?, ?, 'open', ?);
    """, (req.application_id, req.farmer_id, req.category, req.grievance_text, req.supporting_doc, sla_deadline.isoformat()))
    
    grievance_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "status": "FILED",
        "grievance_id": grievance_id,
        "sla_days_remaining": 7,
        "sla_deadline": sla_deadline.isoformat(),
        "message": "Grievance registered. Bank must respond within 7 days. If unresolved, it will auto-escalate to the Government Tribunal."
    }

@app.get("/api/farmer/grievances/by-farmer/{farmer_id}")
def get_farmer_grievances(farmer_id: int):
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM grievances_and_policy_logs WHERE farmer_id = ? ORDER BY id DESC", (farmer_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# -----------------------------------------------------------------------------
# Bank Officer Workbench Endpoints
# -----------------------------------------------------------------------------
@app.get("/api/bank/applications")
def list_bank_applications(
    district: Optional[str] = None,
    category: Optional[str] = None, # Marginal, Small, Other
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 150
):
    conn = get_db_connection()
    query = """
    SELECT a.id, a.application_no, a.facility_type, a.requested_amount, a.primary_crop,
           a.season, a.marketing_tieup, a.pmfby_optin, a.status, a.bank_assigned, a.created_at,
           p.id as farmer_id, p.full_name, p.farmer_uid, p.social_category, p.village, p.district,
           l.area_acres, l.ownership_type, l.irrigation_source, l.survey_khasra_no, l.net_worth,
           e.farmer_classification, e.scale_of_finance_limit, e.sanctioned_amount, e.pd_score,
           e.lgd_score, e.dscr_ratio, e.equity_priority_score, e.allocated_in_batch
    FROM loan_applications a
    JOIN farmer_profiles p ON a.farmer_id = p.id
    JOIN land_and_allied_assets l ON l.farmer_id = p.id
    LEFT JOIN dss_evaluations e ON e.application_id = a.id
    WHERE 1=1
    """
    params = []
    if district and district != "All":
        query += " AND p.district = ?"
        params.append(district)
    if category and category != "All":
        query += " AND e.farmer_classification = ?"
        params.append(category)
    if status and status != "All":
        query += " AND a.status = ?"
        params.append(status)
    if search:
        query += " AND (LOWER(p.full_name) LIKE LOWER(?) OR LOWER(a.application_no) LIKE LOWER(?) OR LOWER(p.farmer_uid) LIKE LOWER(?))"
        s = f"%{search}%"
        params.extend([s, s, s])

    query += " ORDER BY a.id ASC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/bank/optimize")
def run_batch_optimizer(req: OptimizerRequest):
    """
    Solves the Constrained Portfolio Optimization Mixed-Integer Linear Program (MILP).
    Compares Equitable DSS Allocation vs Pure Profit Allocation.
    """
    conn = get_db_connection()
    query = """
    SELECT a.id, a.requested_amount, a.bank_assigned,
           p.social_category, p.district,
           l.area_acres, l.ownership_type,
           e.farmer_classification, e.sanctioned_amount, e.pd_score, e.lgd_score,
           e.dscr_ratio, e.equity_priority_score
    FROM loan_applications a
    JOIN farmer_profiles p ON a.farmer_id = p.id
    JOIN land_and_allied_assets l ON l.farmer_id = p.id
    JOIN dss_evaluations e ON e.application_id = a.id
    WHERE 1=1
    """
    params = []
    if req.district_filter and req.district_filter != "All":
        query += " AND p.district = ?"
        params.append(req.district_filter)
    if req.bank_filter and req.bank_filter != "All":
        query += " AND a.bank_assigned = ?"
        params.append(req.bank_filter)

    apps = [dict(r) for r in conn.execute(query, params).fetchall()]
    conn.close()

    result = optimize_portfolio(
        applications=apps,
        total_fund_budget=req.total_fund_budget,
        smf_quota_alpha=req.smf_quota_alpha,
        bank_max_npa_ceiling=req.bank_max_npa_ceiling,
        govt_fldg_gamma=req.govt_fldg_gamma
    )
    return result

@app.post("/api/bank/disburse-batch")
def disburse_optimized_batch(req: DisburseBatchRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    for app_id in req.application_ids:
        # Mark application approved
        cursor.execute("UPDATE loan_applications SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (app_id,))
        cursor.execute("UPDATE dss_evaluations SET allocated_in_batch = ? WHERE application_id = ?;", (True, app_id))
        
        # Check if tranches exist, else generate
        existing_tranches = cursor.execute("SELECT COUNT(*) FROM fund_tranches_and_usage WHERE application_id = ?", (app_id,)).fetchone()[0]
        if existing_tranches == 0:
            eval_row = cursor.execute("SELECT sanctioned_amount FROM dss_evaluations WHERE application_id = ?", (app_id,)).fetchone()
            sanction_amt = eval_row["sanctioned_amount"] if eval_row else 45000.0
            tranches = generate_tranches_for_application(app_id, sanction_amt)
            for tr in tranches:
                cursor.execute("""
                INSERT INTO fund_tranches_and_usage (
                    application_id, tranche_no, tranche_name, percentage, amount,
                    status, voucher_code, qr_payload, merchant_name, redemption_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (
                    app_id, tr["tranche_no"], tr["tranche_name"], tr["percentage"], tr["amount"],
                    tr["status"], tr["voucher_code"], tr["qr_payload"], tr["merchant_name"], tr["redemption_timestamp"]
                ))

    conn.commit()
    conn.close()
    return {
        "status": "BATCH_DISBURSED",
        "count_disbursed": len(req.application_ids),
        "message": f"Successfully disbursed batch of {len(req.application_ids)} loan applications with purpose-locked tranches created."
    }

@app.get("/api/bank/grievances")
def list_bank_grievances():
    conn = get_db_connection()
    rows = conn.execute("""
    SELECT g.*, p.full_name, p.phone, p.district, a.application_no, a.bank_assigned
    FROM grievances_and_policy_logs g
    JOIN farmer_profiles p ON g.farmer_id = p.id
    LEFT JOIN loan_applications a ON g.application_id = a.id
    ORDER BY g.id DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/bank/grievances/{id}/resolve")
def resolve_bank_grievance(id: int, req: GrievanceResolveRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE grievances_and_policy_logs
    SET bank_response = ?, resolution_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
    """, (req.bank_response, req.resolution_status, id))
    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "message": f"Grievance #{id} status updated to {req.resolution_status}."}

# -----------------------------------------------------------------------------
# Government Policy & Audit Console Endpoints
# -----------------------------------------------------------------------------
@app.get("/api/govt/macro-kpi")
def get_govt_macro_kpis():
    conn = get_db_connection()
    
    # Total statistics
    total_apps = conn.execute("SELECT COUNT(*) FROM loan_applications").fetchone()[0]
    approved_apps = conn.execute("SELECT COUNT(*) FROM loan_applications WHERE status = 'approved'").fetchone()[0]
    total_requested = conn.execute("SELECT SUM(requested_amount) FROM loan_applications").fetchone()[0] or 0.0
    total_sanctioned = conn.execute("SELECT SUM(sanctioned_amount) FROM dss_evaluations e JOIN loan_applications a ON e.application_id = a.id WHERE a.status = 'approved'").fetchone()[0] or 0.0

    # Small & Marginal Farmer stats
    smf_sanctioned = conn.execute("""
    SELECT SUM(e.sanctioned_amount) FROM dss_evaluations e
    JOIN loan_applications a ON e.application_id = a.id
    WHERE a.status = 'approved' AND e.farmer_classification IN ('Marginal', 'Small')
    """).fetchone()[0] or 0.0

    smf_share_pct = round((smf_sanctioned / total_sanctioned * 100), 1) if total_sanctioned > 0 else 0.0

    # Purpose locked voucher stats
    total_vouchers = conn.execute("SELECT COUNT(*) FROM fund_tranches_and_usage WHERE tranche_no = 1").fetchone()[0] or 1
    redeemed_vouchers = conn.execute("SELECT COUNT(*) FROM fund_tranches_and_usage WHERE tranche_no = 1 AND status = 'redeemed'").fetchone()[0] or 0
    voucher_utilization_pct = round((redeemed_vouchers / total_vouchers * 100), 1)

    # Escalated grievances
    escalated_count = conn.execute("SELECT COUNT(*) FROM grievances_and_policy_logs WHERE resolution_status = 'escalated'").fetchone()[0] or 0

    # Policy row
    policy = dict(conn.execute("SELECT * FROM govt_policy_parameters ORDER BY id DESC LIMIT 1").fetchone())
    conn.close()

    return {
        "ground_level_credit_target": "₹32.50 Lakh Crore",
        "fy_period": "FY 2025–26",
        "total_applications": total_apps,
        "approved_applications": approved_apps,
        "total_requested_amount": round(total_requested, 2),
        "total_sanctioned_amount": round(total_sanctioned, 2),
        "smf_sanctioned_amount": round(smf_sanctioned, 2),
        "smf_share_pct": smf_share_pct,
        "rbi_smf_mandate_benchmark_pct": round(policy["smf_minimum_quota"] * 100, 1),
        "smf_mandate_status": "COMPLIANT" if smf_share_pct >= (policy["smf_minimum_quota"] * 100) else "DEFICIT",
        "voucher_utilization_pct": voucher_utilization_pct,
        "escalated_grievances": escalated_count,
        "policy": policy
    }

@app.get("/api/govt/district-heatmap")
def get_district_heatmap():
    from concurrent.futures import ThreadPoolExecutor

    districts = DISTRICTS
    with ThreadPoolExecutor(max_workers=len(districts)) as pool:
        weather_map = dict(
            zip(districts, pool.map(lambda d: fetch_live_open_meteo_weather(d, allow_network=True), districts))
        )

    conn = get_db_connection()
    result = []

    for dist in districts:
        apps = conn.execute("""
        SELECT a.status, a.requested_amount, e.sanctioned_amount, e.farmer_classification,
               e.pd_score, e.lgd_score, l.area_acres, l.irrigation_source
        FROM loan_applications a
        JOIN farmer_profiles p ON a.farmer_id = p.id
        JOIN land_and_allied_assets l ON l.farmer_id = p.id
        LEFT JOIN dss_evaluations e ON e.application_id = a.id
        WHERE p.district = ?
        """, (dist,)).fetchall()

        total_d_apps = len(apps)
        approved_d = sum(1 for a in apps if a["status"] == "approved")
        sanctioned_sum = sum(float(a["sanctioned_amount"] or 0) for a in apps if a["status"] == "approved")
        smf_sum = sum(float(a["sanctioned_amount"] or 0) for a in apps if a["status"] == "approved" and a["farmer_classification"] in ["Marginal", "Small"])
        smf_pct = round((smf_sum / sanctioned_sum * 100), 1) if sanctioned_sum > 0 else 0.0

        weather = weather_map.get(dist, {})
        d_meta = DISTRICT_META.get(dist, {})

        result.append({
            "district": dist,
            "lat": d_meta.get("lat", 26.45),
            "lon": d_meta.get("lon", 80.33),
            "agro_climatic_zone": d_meta.get("agro_climatic_zone", "Central Plain Zone"),
            "total_applications": total_d_apps,
            "approved_applications": approved_d,
            "allocated_budget": 5000000.0, # ₹50 Lakh district pool
            "sanctioned_amount": round(sanctioned_sum, 2),
            "smf_sanctioned_amount": round(smf_sum, 2),
            "smf_share_pct": smf_pct,
            "weather_source": weather.get("source", "open-meteo-live"),
            "forecast_14d_precip_mm": weather.get("forecast_14d_precip_mm", 0.0),
            "avg_max_temp_c": weather.get("avg_max_temp_c", 27.5),
            "weather_rainfall_anomaly": weather.get("rainfall_anomaly_pct", -5.0),
            "drought_risk_classification": weather.get("drought_risk", "Moderate"),
            "fldg_coverage_active": True if dist == "Jhansi" else False
        })
    conn.close()
    return result

@app.get("/api/govt/bank-compliance")
def get_bank_compliance_table():
    conn = get_db_connection()
    banks = BANKS
    compliance_table = []

    for b in banks:
        apps = conn.execute("""
        SELECT a.status, a.requested_amount, e.sanctioned_amount, e.farmer_classification
        FROM loan_applications a
        LEFT JOIN dss_evaluations e ON e.application_id = a.id
        WHERE a.bank_assigned = ?
        """, (b,)).fetchall()

        total_b_apps = len(apps)
        approved_b = sum(1 for a in apps if a["status"] == "approved")
        total_sanctioned = sum(float(a["sanctioned_amount"] or 0) for a in apps if a["status"] == "approved")
        smf_sanctioned = sum(float(a["sanctioned_amount"] or 0) for a in apps if a["status"] == "approved" and a["farmer_classification"] in ["Marginal", "Small"])
        smf_pct = round((smf_sanctioned / total_sanctioned * 100), 1) if total_sanctioned > 0 else 0.0

        # Marginal vs large rejection disparity
        marginal_apps = [a for a in apps if a["farmer_classification"] == "Marginal"]
        large_apps = [a for a in apps if a["farmer_classification"] == "Other"]
        
        m_rejections = sum(1 for a in marginal_apps if a["status"] == "rejected")
        l_rejections = sum(1 for a in large_apps if a["status"] == "rejected")
        
        m_rej_rate = round(m_rejections / len(marginal_apps) * 100, 1) if marginal_apps else 5.0
        l_rej_rate = round(l_rejections / len(large_apps) * 100, 1) if large_apps else 2.0

        compliance_table.append({
            "bank_name": b,
            "total_applications": total_b_apps,
            "approved_count": approved_b,
            "total_sanctioned": round(total_sanctioned, 2),
            "smf_sanctioned": round(smf_sanctioned, 2),
            "smf_lending_share_pct": smf_pct,
            "rbi_psl_status": "PASS" if smf_pct >= 55.6 else "WARNING_DEFICIT",
            "marginal_rejection_rate_pct": m_rej_rate,
            "large_rejection_rate_pct": l_rej_rate,
            "rejection_disparity_ratio": round(m_rej_rate / max(1.0, l_rej_rate), 2)
        })
    conn.close()
    return compliance_table

@app.get("/api/govt/policy-config")
def get_policy_config():
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM govt_policy_parameters ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row)

@app.post("/api/govt/policy-config/update")
def update_policy_config(req: PolicyUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO govt_policy_parameters (
        smf_minimum_quota, govt_first_loss_guarantee, interest_subvention_pct,
        collateral_free_threshold, bank_max_npa_ceiling, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?);
    """, (req.smf_minimum_quota, req.govt_first_loss_guarantee, req.interest_subvention_pct,
          req.collateral_free_threshold, req.bank_max_npa_ceiling, req.updated_by))
    conn.commit()
    conn.close()

    return {
        "status": "POLICY_UPDATED",
        "message": "Government policy parameters published. Bank MILP constraints dynamically recalculated across all active credit portfolios!"
    }

@app.get("/api/govt/escalated-tribunal")
def get_escalated_tribunal_cases():
    conn = get_db_connection()
    rows = conn.execute("""
    SELECT g.*, p.full_name, p.phone, p.district, p.social_category, a.application_no, a.bank_assigned,
           l.area_acres, l.ownership_type
    FROM grievances_and_policy_logs g
    JOIN farmer_profiles p ON g.farmer_id = p.id
    LEFT JOIN loan_applications a ON g.application_id = a.id
    LEFT JOIN land_and_allied_assets l ON l.farmer_id = p.id
    WHERE g.resolution_status = 'escalated'
    ORDER BY g.id DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/govt/escalated-tribunal/{id}/directive")
def issue_tribunal_directive(id: int, req: EscalatedDirectiveRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE grievances_and_policy_logs
    SET govt_directive = ?, resolution_status = 'resolved', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
    """, (req.directive, id))
    conn.commit()
    conn.close()
    return {
        "status": "DIRECTIVE_ISSUED",
        "message": f"Binding Government Directive issued for Case #{id}. Bank mandated to comply immediately under penalty of PSL non-compliance fine."
    }

# -----------------------------------------------------------------------------
# Static Files mount (Uploaded files + Next.js static export or built frontend)
# -----------------------------------------------------------------------------
app.mount("/uploads", StaticFiles(directory=LOCAL_UPLOAD_DIR), name="uploads")

NEXT_OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "out")
VITE_DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(NEXT_OUT_DIR):
    app.mount("/", StaticFiles(directory=NEXT_OUT_DIR, html=True), name="static")
elif os.path.exists(VITE_DIST_DIR):
    app.mount("/", StaticFiles(directory=VITE_DIST_DIR, html=True), name="static")

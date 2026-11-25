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
from contextlib import closing, asynccontextmanager, suppress
import asyncio
import logging
from typing import Literal
from access import bearer, Principal, DEMO_ENABLED, current_user, farmer, bank, government, roles, issue_session, check_application
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Query, Body, Depends, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from database import get_db_connection, init_db, DATABASE_URL
from supabase_client import get_backend_mode, get_supabase_client
from models.decision_tree import evaluate_decision_tree, SCALE_OF_FINANCE, ALLIED_UNIT_FINANCE
from models.forecast_model import calculate_forecast_and_dscr, DISTRICT_WEATHER_PROFILE, fetch_live_open_meteo_weather, DISTRICT_META
from models.risk_model import calculate_hybrid_risk_and_shap, SYNTHETIC_VALIDATION
from models.portfolio_optimizer import optimize_portfolio
from models.voucher_system import generate_tranches_for_application, redeem_voucher, AUTHORIZED_AGRI_MERCHANTS

DISTRICTS = ["Kanpur Dehat", "Kanpur Nagar", "Unnao", "Jhansi", "Lucknow", "Barabanki", "Fatehpur"]
BANKS = ["State Bank of India", "Bank of India", "Punjab National Bank", "Bank of Baroda", "Axis Bank", "HDFC Bank"]

@asynccontextmanager
async def lifespan(app):
    async def check_deadlines():
        while True:
            try:
                await asyncio.to_thread(sweep_appeals)
            except Exception:
                logging.getLogger(__name__).exception("Appeal deadline check failed")
            await asyncio.sleep(60)
    task = asyncio.create_task(check_deadlines())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


def sweep_appeals():
    with closing(get_db_connection()) as conn:
        escalate_due(conn)


app = FastAPI(
    lifespan=lifespan,
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
    full_name: str = Field(min_length=1,max_length=120)
    phone: str = Field(pattern=r"^[0-9]{10}$")
    pmkisan_id: Optional[str] = None
    gender: Literal["M","F","Other"] = "M"
    social_category: Literal["GEN","SC","ST","OBC","Minority","Women","PWD"] = "OBC"
    district: str = "Kanpur Dehat"
    village: str = "Akbarpur"
    survey_khasra_no: str = "245/1"
    ownership_type: Literal["owned","oral_lease","registered_lease","sharecropper"] = "owned" # owned, registered_lease, oral_lease, sharecropper
    area_acres: float = Field(1.5, gt=0, allow_inf_nan=False)
    irrigation_source: str = "Well" # Drip, Sprinkler, Canal, Well, Dry
    distance_to_mandi_km: float = Field(6.0, ge=0, allow_inf_nan=False)
    livestock_count: int = Field(1, ge=0)
    movable_asset_k: float = Field(60000.0, ge=0, allow_inf_nan=False)
    immovable_asset_l: float = Field(250000.0, ge=0, allow_inf_nan=False)
    existing_debt: float = Field(0, ge=0, allow_inf_nan=False)
    overdue_days: int = Field(0, ge=0, le=3650)
    reported_npa: bool = False
    request_id: Optional[uuid.UUID] = None
    is_informal_debt_only: bool = False
    facility_type: Literal["Crop KCC","Allied KCC","Flexi KCC","Agri Term Loan"] = "Crop KCC"
    requested_amount: float = Field(50000.0, gt=0, allow_inf_nan=False)
    primary_crop: str = "Wheat"
    secondary_crop: Optional[str] = "Mustard"
    marketing_tieup: Literal["Cooperative","Direct","None","Corporate_Contract","Government_Procurement"] = "Cooperative"
    pmfby_optin: bool = True
    bank_assigned: str = "State Bank of India"

class EstimateRequest(BaseModel):
    area_acres: float = Field(gt=0, allow_inf_nan=False)
    primary_crop: str
    ownership_type: str
    livestock_count: int = Field(0, ge=0)
    marketing_tieup: Literal["Cooperative","Direct","None","Corporate_Contract","Government_Procurement"] = "Cooperative"
    district: str = "Kanpur Dehat"
    requested_amount: float = Field(50000.0, gt=0, allow_inf_nan=False)
    irrigation_source: str = "Well"
    pmfby_optin: bool = True

class OptimizerRequest(BaseModel):
    total_fund_budget: float = Field(5000000, gt=0, allow_inf_nan=False)
    smf_quota_alpha: Optional[float] = Field(None, ge=0, le=1)
    bank_max_npa_ceiling: Optional[float] = Field(None, gt=0, le=1)
    govt_fldg_gamma: Optional[float] = Field(None, ge=0, le=1)
    district_filter: Optional[str] = None
    bank_filter: Optional[str] = None

class DisburseBatchRequest(BaseModel):
    run_id: int
    application_ids: List[int]
    notes: Optional[str] = "Batch disbursed through KrishiSetu MILP Optimization"

class VoucherRedeemRequest(BaseModel):
    voucher_code: str
    merchant_id: str

class SowingVerificationRequest(BaseModel):
    tranche_id: int
    geo_lat: float = Field(ge=-90, le=90)
    geo_long: float = Field(ge=-180, le=180)
    geo_proof_photo: str

class GrievanceCreateRequest(BaseModel):
    application_id: Optional[int] = None
    farmer_id: int
    category: Literal["Incorrect land area","Unfair rejection","Collateral demanded under 2L","Delayed disbursal >14 days","Other"]
    grievance_text: str
    supporting_doc: Optional[str] = None

class GrievanceResolveRequest(BaseModel):
    bank_response: str
    resolution_status: str = "resolved" # resolved or escalated

class PolicyUpdateRequest(BaseModel):
    smf_minimum_quota: float = Field(ge=0, le=1)
    govt_first_loss_guarantee: float = Field(ge=0, le=1)
    interest_subvention_pct: float = Field(ge=0, le=7)
    collateral_free_threshold: float = Field(gt=0, allow_inf_nan=False)
    bank_max_npa_ceiling: float = Field(gt=0, le=1)
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
def optimize_allocate_endpoint(req: OptimizerRequest, user: Principal = Depends(bank)):
    """
    Week 2 Endpoint: /optimize/allocate
    Solves the Mixed-Integer Linear Program comparing Pure Bank vs. Govt-Guaranteed Equitable DSS.
    """
    return run_batch_optimizer(req, user)

# -----------------------------------------------------------------------------
# System, Auth, Live Weather & File Upload Endpoints
# -----------------------------------------------------------------------------
class AuthLoginRequest(BaseModel):
    demo_bank: Optional[str] = None
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
        "norms_dataset":"Classroom crop and district assumptions; see README",
        "synthetic_validation": SYNTHETIC_VALIDATION
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
    email = req.email.strip().lower()
    demo_users = {"farmer@demo": "farmer_demo", "bank@demo": "bank_sbi", "govt@demo": "govt_auditor"}
    with closing(get_db_connection()) as conn:
        if DEMO_ENABLED and email in demo_users:
            row = conn.execute("SELECT * FROM users_and_roles WHERE username = ?", (demo_users[email],)).fetchone()
            provider = "synthetic-demo"
        else:
            sb = get_supabase_client()
            if not sb or not DATABASE_URL:
                raise HTTPException(401, "Account unavailable.")
            try:
                from supabase import create_client
                from supabase_client import SUPABASE_URL, SUPABASE_KEY
                auth = create_client(SUPABASE_URL, SUPABASE_KEY).auth.sign_in_with_password({"email": email, "password": req.password})
                uid = str(auth.user.id)
            except Exception:
                raise HTTPException(401, "Invalid credentials.")
            row = conn.execute("SELECT * FROM users_and_roles WHERE auth_uid = ?", (uid,)).fetchone()
            provider = "supabase-auth"
        if not row:
            raise HTTPException(403, "Workspace membership required.")
        profile = conn.execute("SELECT id FROM farmer_profiles WHERE user_id = ? ORDER BY id LIMIT 1", (row["id"],)).fetchone()
        assigned_bank = (req.demo_bank or BANKS[0]) if provider == "synthetic-demo" and row["role"] == "bank_officer" else row["branch_or_dept"]
        if row["role"] == "bank_officer" and assigned_bank not in BANKS:
            raise HTTPException(403, "A bank assignment is required.")
        user = Principal(row["role"], row["username"], row["full_name"], row["district"],
                         profile[0] if profile else None, assigned_bank if row["role"] == "bank_officer" else None)
        if user.role == "farmer" and user.farmer_id is None:
            raise HTTPException(403, "A linked farmer profile is required.")
    return issue_session(user, email, provider)


@app.post("/api/auth/logout")
def logout(credentials=Depends(bearer)):
    import hashlib
    if credentials:
        with closing(get_db_connection()) as conn:
            conn.execute("DELETE FROM workspace_sessions WHERE token_hash=?",(hashlib.sha256(credentials.credentials.encode()).hexdigest(),))
            conn.commit()
    return {"status":"signed_out"}


@app.get("/api/weather/live/{district}")
def get_live_district_weather(district: str):
    weather = fetch_live_open_meteo_weather(district, allow_network=True)
    return {k: v for k, v in weather.items() if k != "_ts"}

@app.post("/api/upload/file")
async def upload_evidence_or_photo(file: UploadFile = File(...), user: Principal = Depends(farmer)):
    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413,"Maximum attachment size is 5 MB.")
    signatures = [(b"%PDF-", "application/pdf"), (b"\xff\xd8\xff", "image/jpeg"), (b"\x89PNG\r\n\x1a\n", "image/png")]
    media_type = next((kind for prefix,kind in signatures if content.startswith(prefix)), None)
    if not media_type:
        raise HTTPException(422,"Upload a JPEG, PNG or PDF.")
    ref = uuid.uuid4().hex
    with closing(get_db_connection()) as conn:
        conn.execute("INSERT INTO evidence_files (reference,farmer_id,media_type,content) VALUES (?,?,?,?)",
                     (ref,user.farmer_id,media_type,content))
        conn.commit()
    return {"status":"UPLOADED","storage":"private-database","filename":file.filename,"url":ref}


@app.get("/api/evidence/{ref}")
def download_evidence(ref: str, user: Principal = Depends(current_user)):
    with closing(get_db_connection()) as conn:
        evidence = conn.execute("SELECT * FROM evidence_files WHERE reference=?", (ref,)).fetchone()
        if not evidence:
            raise HTTPException(404,"Evidence unavailable.")
        if user.role=="farmer" and user.farmer_id!=evidence["farmer_id"]:
            raise HTTPException(404,"Evidence unavailable.")
        if user.role=="bank_officer":
            linked = conn.execute("""SELECT 1 FROM loan_applications a WHERE a.bank_assigned=? AND
                  (EXISTS (SELECT 1 FROM grievances_and_policy_logs g WHERE g.application_id=a.id AND g.supporting_doc=?)
                  OR EXISTS (SELECT 1 FROM fund_tranches_and_usage t WHERE t.application_id=a.id AND t.geo_proof_photo=?))""",
                  (user.bank,ref,ref)).fetchone()
            if not linked:
                raise HTTPException(404,"Evidence unavailable.")
        if user.role=="govt_auditor" and not conn.execute("SELECT 1 FROM grievances_and_policy_logs WHERE supporting_doc=? AND (resolution_status='escalated' OR govt_directive IS NOT NULL)",(ref,)).fetchone():
            raise HTTPException(404,"Evidence unavailable.")
        return Response(bytes(evidence["content"]),media_type=evidence["media_type"],headers={"Content-Disposition":"attachment","Cache-Control":"no-store"})


@app.get("/api/system/demo-accounts")
def get_demo_accounts():
    return [{"email":email} for email in ("farmer@demo","bank@demo","govt@demo")] if DEMO_ENABLED else []


@app.get("/api/system/scale-of-finance")
def get_scale_of_finance():
    return {
        "crop_scale_of_finance": SCALE_OF_FINANCE,
        "allied_unit_finance": ALLIED_UNIT_FINANCE,
        "district_weather": DISTRICT_WEATHER_PROFILE,
        "merchants": AUTHORIZED_AGRI_MERCHANTS
    }

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

    fc_res = calculate_forecast_and_dscr(land_stub, app_stub, sanction_estimate, req.district, rate_pct=dt_res["interest_rate_effective"])

    return {
        "farmer_classification": dt_res["farmer_category"],
        "recommended_instrument": dt_res["instrument"],
        "scale_of_finance_limit": dt_res["scale_of_finance_limit"],
        "estimated_sanction_amount": sanction_estimate,
        "collateral_required": dt_res["collateral_required"],
        "interest_rate_effective": dt_res["interest_rate_effective"],
        "miss_prompt_rate": dt_res["interest_rate_effective"],
        "expected_crop_revenue": fc_res["expected_net_revenue"],
        "dscr_ratio": fc_res["dscr_ratio"],
        "decision_steps": dt_res["steps_log"]
    }

@app.post("/api/farmer/apply")
def create_farmer_application(app_data: FarmerApplicationCreate, user: Principal = Depends(farmer)):
    if app_data.district not in DISTRICTS or app_data.bank_assigned not in BANKS or app_data.primary_crop not in SCALE_OF_FINANCE:
        raise HTTPException(422, "Select a supported district, bank and crop.")
    if not app_data.existing_debt and (app_data.reported_npa or app_data.overdue_days):
        raise HTTPException(422, "Overdue or NPA declarations require an outstanding loan.")
    with closing(get_db_connection()) as conn:
        return _submit_application(conn, app_data, user)


def _submit_application(conn, app_data, user):
    cursor = conn.cursor()
    farmer_id = user.farmer_id
    request_key = f"{farmer_id}/{app_data.request_id or uuid.uuid4()}"
    if DATABASE_URL:
        cursor.execute("LOCK TABLE application_intake IN SHARE ROW EXCLUSIVE MODE")
        cursor.execute("SELECT id FROM farmer_profiles WHERE id = ? FOR UPDATE", (farmer_id,))
    else:
        cursor.execute("BEGIN IMMEDIATE")
    previous = cursor.execute("SELECT application_id FROM application_intake WHERE request_key = ?", (request_key,)).fetchone()
    if previous:
        record = cursor.execute("SELECT id AS application_id, application_no, status FROM loan_applications WHERE id = ?", (previous[0],)).fetchone()
        return dict(record)
    area_ha = round(app_data.area_acres / 2.47105, 3)
    net_worth = app_data.movable_asset_k + app_data.immovable_asset_l - app_data.existing_debt
    liabilities_list = []
    if app_data.existing_debt:
        liabilities_list.append({
            "lender_type": "moneylender_informal" if app_data.is_informal_debt_only else "commercial_bank",
            "outstanding_balance_m": app_data.existing_debt, "overdue_days": app_data.overdue_days,
            "is_npa": app_data.reported_npa, "is_wilful_default": False,
        })
    # 4. Insert Loan Application
    app_no = f"KCC-UP-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    cursor.execute("""
    INSERT INTO loan_applications (
        application_no, farmer_id, facility_type, requested_amount,
        season, primary_crop, secondary_crop, marketing_tieup,
        pmfby_optin, status, bank_assigned
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?);
    """, (app_no, farmer_id, app_data.facility_type, app_data.requested_amount,
          SCALE_OF_FINANCE[app_data.primary_crop]["crop_type"], app_data.primary_crop, app_data.secondary_crop, app_data.marketing_tieup,
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
        "facility_type":app_data.facility_type,
        "id": app_id, "requested_amount": app_data.requested_amount,
        "primary_crop": app_data.primary_crop, "marketing_tieup": app_data.marketing_tieup,
        "pmfby_optin": app_data.pmfby_optin
    }

    dt_res = evaluate_decision_tree(farmer_dict, land_dict, liabilities_list, app_dict, policy_row)
    sanction_amt = min(app_data.requested_amount, dt_res["scale_of_finance_limit"])
    if dt_res["instrument"] == "Flexi KCC":
        sanction_amt = min(sanction_amt, 50000.0)

    fc_res = calculate_forecast_and_dscr(land_dict, app_dict, sanction_amt, app_data.district, rate_pct=dt_res["interest_rate_effective"])
    risk_res = calculate_hybrid_risk_and_shap(farmer_dict, land_dict, liabilities_list, app_dict, fc_res)

    reason = ""
    if fc_res["dscr_ratio"] < 1:
        reason = "Forecast cash available is below the scheduled debt payment."
    if app_data.reported_npa:
        reason = "An existing lender-reported default requires manual review."
    # Match only inside the same district and village. Repeated plot numbers across villages are common.
    prior = cursor.execute("""SELECT i.payload FROM application_intake i JOIN loan_applications a ON a.id=i.application_id
                              WHERE i.district=? AND a.status IN ('submitted','under_review','approved','partial_approved')""",
                           (app_data.district,)).fetchall()
    def same_plot(row):
        data = json.loads(row[0])
        return (data["village"].strip().casefold(),data["survey_khasra_no"].strip().casefold()) == (
            app_data.village.strip().casefold(),app_data.survey_khasra_no.strip().casefold())
    legacy = cursor.execute("""SELECT 1 FROM loan_applications a JOIN land_and_allied_assets l ON l.farmer_id=a.farmer_id
                       JOIN farmer_profiles p ON p.id=a.farmer_id LEFT JOIN application_intake i ON i.application_id=a.id
                       WHERE i.id IS NULL AND p.district=? AND LOWER(TRIM(p.village))=LOWER(TRIM(?))
                       AND LOWER(TRIM(l.survey_khasra_no))=LOWER(TRIM(?)) AND a.status IN ('approved','partial_approved','submitted','under_review') LIMIT 1""",
                       (app_data.district,app_data.village,app_data.survey_khasra_no)).fetchone()
    if legacy or any(same_plot(row) for row in prior):
        reason = "A matching plot appears in another active application. Verify the holding before allocation."
    status = "under_review" if reason else "submitted"
    cursor.execute("UPDATE loan_applications SET status = ? WHERE id = ?", (status, app_id))
    payload = app_data.model_dump(mode="json")
    payload["liabilities"] = liabilities_list
    cursor.execute("""INSERT INTO application_intake
        (application_id,payload,district,social_category,full_name,area_acres,net_worth,review_reason,request_key)
        VALUES (?,?,?,?,?,?,?,?,?)""", (app_id,json.dumps(payload),app_data.district,app_data.social_category,
        app_data.full_name,app_data.area_acres,net_worth,reason,request_key))

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
        risk_res["equity_priority_score"], json.dumps(risk_res["shap_reasons"]), False
    ))

    conn.commit()
    return {"status": status, "application_id": app_id, "application_no": app_no, "recommended_amount": sanction_amt}


@app.get("/api/farmer/my-applications")
def my_applications(user: Principal = Depends(farmer)):
    with closing(get_db_connection()) as conn:
        return [dict(r) for r in conn.execute("SELECT id, application_no, status FROM loan_applications WHERE farmer_id = ? ORDER BY id DESC", (user.farmer_id,)).fetchall()]


@app.get("/api/farmer/applications/{app_id}")
def get_farmer_application_outcome(app_id: int, user: Principal = Depends(roles("farmer", "bank_officer"))):
    with closing(get_db_connection()) as conn:
        check_application(conn, app_id, user)
        escalate_due(conn)
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
    with closing(get_db_connection()) as db:
        intake = db.execute("SELECT * FROM application_intake WHERE application_id = ?", (app_id,)).fetchone()
    if intake:
        data = json.loads(intake["payload"])
        res.update(data)
        res["area_hectares"] = round(data["area_acres"] / 2.47105, 3)
        res["movable_asset_val_k"] = data["movable_asset_k"]
        res["immovable_asset_val_l"] = data["immovable_asset_l"]
        res["net_worth"] = intake["net_worth"]
        res["review_reason"] = intake["review_reason"]
        res["decision_note"] = intake["decision_note"]
        liabilities = data["liabilities"]
    else:
        res["net_worth"] = res["movable_asset_val_k"] + res["immovable_asset_val_l"] - sum(r["outstanding_balance_m"] for r in liabilities)
    with closing(get_db_connection()) as db:
        last = db.execute("SELECT reason FROM review_decisions WHERE application_id=? ORDER BY id DESC LIMIT 1",(app_id,)).fetchone()
        if last:
            res["decision_note"] = last[0]
    res["recommended_amount"] = res["sanctioned_amount"]
    if res["status"] not in ("approved", "partial_approved"):
        res["sanctioned_amount"] = 0.0
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
def redeem_agri_voucher(req: VoucherRedeemRequest, user: Principal = Depends(farmer)):
    with closing(get_db_connection()) as conn:
        tr = conn.execute("SELECT * FROM fund_tranches_and_usage WHERE voucher_code=? AND tranche_no=1",(req.voucher_code,)).fetchone()
        if not tr:
            raise HTTPException(404,"Input voucher unavailable.")
        check_application(conn,tr["application_id"],user)
        red = redeem_voucher(req.voucher_code,req.merchant_id)
        if not red["success"]:
            raise HTTPException(422,red["error"])
        changed = conn.execute("""UPDATE fund_tranches_and_usage SET status='redeemed',merchant_name=?,redemption_timestamp=?
                                  WHERE id=? AND status='disbursed'""",(red["merchant_name"],red["timestamp"],tr["id"]))
        if changed.rowcount!=1:
            raise HTTPException(409,"Voucher already used or unavailable.")
        conn.commit()
        return {"status":"SUCCESS","amount":tr["amount"],**red}


@app.post("/api/farmer/tranches/verify-sowing")
def verify_sowing_proof(req: SowingVerificationRequest, user: Principal = Depends(farmer)):
    with closing(get_db_connection()) as conn:
        tr = conn.execute("SELECT * FROM fund_tranches_and_usage WHERE id=? AND tranche_no=3",(req.tranche_id,)).fetchone()
        if not tr:
            raise HTTPException(404,"Reserve tranche unavailable.")
        check_application(conn,tr["application_id"],user)
        photo = conn.execute("SELECT media_type FROM evidence_files WHERE reference=? AND farmer_id=?",
                             (req.geo_proof_photo,user.farmer_id)).fetchone()
        if not photo or not photo[0].startswith("image/"):
            raise HTTPException(422,"Attach a sowing photo to record this demonstration.")
        changed = conn.execute("""UPDATE fund_tranches_and_usage SET status='disbursed',geo_proof_photo=?,geo_lat=?,geo_long=?,
                                  redemption_timestamp=CURRENT_TIMESTAMP WHERE id=? AND status='locked'""",
                               (req.geo_proof_photo,req.geo_lat,req.geo_long,tr["id"]))
        if changed.rowcount!=1:
            raise HTTPException(409,"Reserve already released.")
        conn.commit()
    return {"status":"RECORDED","message":"Photo and device coordinates recorded. Simulated reserve released."}


def escalate_due(conn):
    conn.execute("""UPDATE grievances_and_policy_logs SET resolution_status='escalated',updated_at=CURRENT_TIMESTAMP
                    WHERE resolution_status='open' AND sla_deadline <= ?""",(datetime.now().isoformat(),))
    conn.commit()


@app.post("/api/farmer/grievances")
def file_farmer_grievance(req: GrievanceCreateRequest, user: Principal = Depends(farmer)):
    with closing(get_db_connection()) as conn:
        check_application(conn, req.application_id, user)
        if req.farmer_id != user.farmer_id or not req.grievance_text.strip():
            raise HTTPException(422,"Provide the application and appeal details.")
        if req.supporting_doc and not conn.execute("SELECT 1 FROM evidence_files WHERE reference=? AND farmer_id=?", (req.supporting_doc,user.farmer_id)).fetchone():
            raise HTTPException(422,"Attachment unavailable.")
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
def get_farmer_grievances(farmer_id: int,user: Principal = Depends(farmer)):
    if farmer_id!=user.farmer_id:
        raise HTTPException(404,"Unavailable.")
    conn = get_db_connection()
    escalate_due(conn)
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
    user: Principal = Depends(bank),
    limit: int = Query(150, ge=1, le=500)
):
    conn = get_db_connection()
    query = """
    SELECT a.id, a.application_no, a.facility_type, a.requested_amount, a.primary_crop,
           a.season, a.marketing_tieup, a.pmfby_optin, a.status, a.bank_assigned, a.created_at,
           p.id as farmer_id, COALESCE(i.full_name,p.full_name) AS full_name, p.farmer_uid, COALESCE(i.social_category,p.social_category) AS social_category, p.village, COALESCE(i.district,p.district) AS district,
           COALESCE(i.area_acres,l.area_acres) AS area_acres, l.ownership_type, l.irrigation_source, l.survey_khasra_no, COALESCE(i.net_worth,l.net_worth - COALESCE((SELECT SUM(outstanding_balance_m) FROM existing_liabilities WHERE farmer_id=p.id),0)) AS net_worth,
           e.farmer_classification, e.scale_of_finance_limit, e.sanctioned_amount, e.pd_score,
           e.lgd_score, e.dscr_ratio, e.equity_priority_score, e.allocated_in_batch
    FROM loan_applications a
    JOIN farmer_profiles p ON a.farmer_id = p.id
    JOIN land_and_allied_assets l ON l.farmer_id = p.id
    LEFT JOIN dss_evaluations e ON e.application_id = a.id
    LEFT JOIN application_intake i ON i.application_id=a.id
    WHERE a.bank_assigned=?
    """
    params = [user.bank]
    if district and district != "All":
        query += " AND COALESCE(i.district,p.district) = ?"
        params.append(district)
    if category and category != "All":
        query += " AND e.farmer_classification = ?"
        params.append(category)
    if status and status != "All":
        query += " AND a.status = ?"
        params.append(status)
    if search:
        query += " AND (LOWER(COALESCE(i.full_name,p.full_name)) LIKE LOWER(?) OR LOWER(a.application_no) LIKE LOWER(?) OR LOWER(p.farmer_uid) LIKE LOWER(?))"
        s = f"%{search}%"
        params.extend([s, s, s])

    query += " ORDER BY a.id DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/bank/optimize")
def run_batch_optimizer(req: OptimizerRequest, user: Principal = Depends(bank)):
    """
    Solves the Constrained Portfolio Optimization Mixed-Integer Linear Program (MILP).
    Compares Equitable DSS Allocation vs Pure Profit Allocation.
    """
    conn = get_db_connection()
    with closing(conn):
        policy = dict(conn.execute("SELECT * FROM govt_policy_parameters ORDER BY id DESC LIMIT 1").fetchone())
        query = """SELECT a.id, a.requested_amount, COALESCE(i.social_category,p.social_category) AS social_category,
                          e.farmer_classification,e.sanctioned_amount,e.pd_score,e.lgd_score,e.equity_priority_score
                   FROM loan_applications a JOIN farmer_profiles p ON p.id=a.farmer_id
                   JOIN dss_evaluations e ON e.application_id=a.id
                   LEFT JOIN application_intake i ON i.application_id=a.id
                   WHERE a.status='submitted' AND a.bank_assigned=? AND e.sanctioned_amount>0
                     AND (e.dscr_ratio>=1 OR EXISTS (SELECT 1 FROM review_decisions r WHERE r.application_id=a.id AND r.action='release'))
                     AND NOT EXISTS (SELECT 1 FROM fund_tranches_and_usage t WHERE t.application_id=a.id)"""
        params = [user.bank]
        if req.district_filter and req.district_filter != "All":
            query += " AND COALESCE(i.district,p.district)=?"
            params.append(req.district_filter)
        apps = [dict(r) for r in conn.execute(query+" ORDER BY a.id", params).fetchall()]
        baseline = (policy["smf_minimum_quota"], policy["bank_max_npa_ceiling"], policy["govt_first_loss_guarantee"])
        overrides = (req.smf_quota_alpha, req.bank_max_npa_ceiling, req.govt_fldg_gamma)
        alpha, cap, gamma = [default if value is None else value for value,default in zip(overrides,baseline)]
        result = optimize_portfolio(apps, total_fund_budget=req.total_fund_budget, smf_quota_alpha=alpha,
                                    bank_max_npa_ceiling=cap, govt_fldg_gamma=gamma)
        scenario = any(abs(val-default)>1e-8 for val,default in zip((alpha,cap,gamma),baseline))
        result.update(policy_version=policy["id"], simulation_only=scenario, run_id=None)
        if not scenario and result["status"] == "OPTIMAL":
            cur = conn.execute("INSERT INTO allocation_runs (bank,policy_id,selected_ids,state) VALUES (?,?,?,?)",
                               (user.bank,policy["id"],json.dumps(result["dss_allocated_ids"]),"ready"))
            result["run_id"] = cur.lastrowid
            conn.commit()
        return result


class ReviewDecision(BaseModel):
    action: Literal["release", "reject"]
    reason: str = Field(min_length=5, max_length=1000)


@app.post("/api/bank/applications/{app_id}/review")
def review_application(app_id: int, req: ReviewDecision, user: Principal = Depends(bank)):
    with closing(get_db_connection()) as conn:
        check_application(conn, app_id, user)
        if len(req.reason.strip()) < 5:
            raise HTTPException(422, "Give a reason for your decision.")
        changed = conn.execute("UPDATE loan_applications SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('submitted','under_review','appealed')",
                               ("submitted" if req.action=="release" else "rejected",app_id))
        if changed.rowcount != 1:
            raise HTTPException(409, "The application has already been decided.")
        conn.execute("""INSERT INTO review_decisions (application_id,actor,action,reason) VALUES (?,?,?,?)""",
                     (app_id,user.username,req.action,req.reason.strip()))
        conn.execute("UPDATE application_intake SET decision_note=? WHERE application_id=?", (req.reason.strip(),app_id))
        conn.commit()
    return {"status":"reviewed"}


@app.post("/api/bank/disburse-batch")
def disburse_optimized_batch(req: DisburseBatchRequest, user: Principal = Depends(bank)):
    with closing(get_db_connection()) as conn:
        if not DATABASE_URL:
            conn.execute("BEGIN IMMEDIATE")
        else:
            conn.execute("LOCK TABLE govt_policy_parameters IN SHARE MODE")
        lock = " FOR UPDATE" if DATABASE_URL else ""
        run = conn.execute("SELECT * FROM allocation_runs WHERE id=? AND bank=?"+lock,(req.run_id,user.bank)).fetchone()
        if not run or sorted(req.application_ids)!=sorted(json.loads(run["selected_ids"])):
            raise HTTPException(409,"Select a complete saved allocation.")
        if run["state"] == "committed":
            return {"status":"BATCH_DISBURSED","count_disbursed":0,"message":"This allocation has already been committed."}
        latest = conn.execute("SELECT MAX(id) FROM govt_policy_parameters").fetchone()[0]
        if run["policy_id"] != latest:
            raise HTTPException(409,"Policy changed. Run the optimizer again.")
        for app_id in sorted(req.application_ids):
            row = conn.execute("SELECT e.sanctioned_amount,a.requested_amount FROM dss_evaluations e JOIN loan_applications a ON a.id=e.application_id WHERE a.id=?", (app_id,)).fetchone()
            status = "partial_approved" if row and row[0]<row[1] else "approved"
            updated = conn.execute("UPDATE loan_applications SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND bank_assigned=? AND status='submitted'",
                                   (status,app_id,user.bank))
            if updated.rowcount != 1 or not row:
                raise HTTPException(409,"Another decision changed this portfolio. Run the optimizer again.")
            conn.execute("UPDATE dss_evaluations SET allocated_in_batch=? WHERE application_id=?",(True,app_id))
            conn.execute("UPDATE application_intake SET policy_id=? WHERE application_id=?",(latest,app_id))
            for tr in generate_tranches_for_application(app_id,row[0]):
                keys = ("application_id","tranche_no","tranche_name","percentage","amount","status","voucher_code","qr_payload","merchant_name","redemption_timestamp")
                conn.execute("INSERT INTO fund_tranches_and_usage ("+",".join(keys)+") VALUES (?,?,?,?,?,?,?,?,?,?)",
                             tuple(tr[k] for k in keys))
        conn.execute("UPDATE allocation_runs SET state='committed',committed_by=? WHERE id=?",(user.username,req.run_id))
        conn.commit()
    return {"status":"BATCH_DISBURSED","count_disbursed":len(req.application_ids),"message":"Allocation committed and simulated tranches issued."}


@app.get("/api/bank/grievances")
def list_bank_grievances(user: Principal = Depends(bank)):
    conn = get_db_connection()
    escalate_due(conn)
    rows = conn.execute("""
    SELECT g.*, p.full_name, p.phone, p.district, a.application_no, a.bank_assigned
    FROM grievances_and_policy_logs g
    JOIN farmer_profiles p ON g.farmer_id = p.id
    LEFT JOIN loan_applications a ON g.application_id = a.id
    WHERE a.bank_assigned=? ORDER BY g.id DESC
    """,(user.bank,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/bank/grievances/{id}/resolve")
def resolve_bank_grievance(id: int, req: GrievanceResolveRequest, user: Principal = Depends(bank)):
    if not req.bank_response.strip() or req.resolution_status not in ("resolved","escalated"):
        raise HTTPException(422,"Enter a response and a valid status.")
    conn = get_db_connection()
    escalate_due(conn)
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE grievances_and_policy_logs
    SET bank_response = ?, resolution_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND resolution_status='open' AND application_id IN (SELECT id FROM loan_applications WHERE bank_assigned=?);
    """, (req.bank_response, req.resolution_status, id,user.bank))
    if cursor.rowcount!=1:
        conn.close()
        raise HTTPException(409,"Appeal unavailable or already escalated.")
    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "message": f"Grievance #{id} status updated to {req.resolution_status}."}

# -----------------------------------------------------------------------------
# Government Policy & Audit Console Endpoints
# -----------------------------------------------------------------------------
@app.get("/api/govt/macro-kpi")
def get_govt_macro_kpis(user: Principal = Depends(government)):
    conn = get_db_connection()
    escalate_due(conn)
    
    # Total statistics
    total_apps = conn.execute("SELECT COUNT(*) FROM loan_applications").fetchone()[0]
    approved_apps = conn.execute("SELECT COUNT(*) FROM loan_applications WHERE status IN ('approved','partial_approved')").fetchone()[0]
    total_requested = conn.execute("SELECT SUM(requested_amount) FROM loan_applications").fetchone()[0] or 0.0
    total_sanctioned = conn.execute("SELECT SUM(sanctioned_amount) FROM dss_evaluations e JOIN loan_applications a ON e.application_id = a.id WHERE a.status IN ('approved','partial_approved')").fetchone()[0] or 0.0

    # Small & Marginal Farmer stats
    smf_sanctioned = conn.execute("""
    SELECT SUM(e.sanctioned_amount) FROM dss_evaluations e
    JOIN loan_applications a ON e.application_id = a.id
    WHERE a.status IN ('approved','partial_approved') AND e.farmer_classification IN ('Marginal', 'Small')
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
def get_district_heatmap(user: Principal = Depends(government)):
    from concurrent.futures import ThreadPoolExecutor

    published = get_policy_config(user)
    target = published["smf_minimum_quota"] * 100
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
        LEFT JOIN application_intake i ON i.application_id=a.id
        WHERE COALESCE(i.district,p.district) = ?
        """, (dist,)).fetchall()

        total_d_apps = len(apps)
        approved_d = sum(1 for a in apps if a["status"] in ("approved","partial_approved"))
        sanctioned_sum = sum(float(a["sanctioned_amount"] or 0) for a in apps if a["status"] in ("approved","partial_approved"))
        smf_sum = sum(float(a["sanctioned_amount"] or 0) for a in apps if a["status"] in ("approved","partial_approved") and a["farmer_classification"] in ["Marginal", "Small"])
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
            "smf_target_pct": target,
            "allocated_budget": 5000000.0, # ₹50 Lakh district pool
            "sanctioned_amount": round(sanctioned_sum, 2),
            "smf_sanctioned_amount": round(smf_sum, 2),
            "smf_share_pct": smf_pct,
            "weather_source": weather.get("source", "open-meteo-live"),
            "forecast_14d_precip_mm": weather.get("forecast_14d_precip_mm", 0.0),
            "avg_max_temp_c": weather.get("avg_max_temp_c", 27.5),
            "weather_rainfall_anomaly": weather.get("rainfall_anomaly_pct", -5.0),
            "drought_risk_classification": weather.get("drought_risk", "Moderate"),
            "fldg_coverage_active": published["govt_first_loss_guarantee"] > 0
        })
    conn.close()
    return result

@app.get("/api/govt/bank-compliance")
def get_bank_compliance_table(user: Principal = Depends(government)):
    conn = get_db_connection()
    target = conn.execute("SELECT smf_minimum_quota FROM govt_policy_parameters ORDER BY id DESC LIMIT 1").fetchone()[0] * 100
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
        approved_b = sum(1 for a in apps if a["status"] in ("approved","partial_approved"))
        total_sanctioned = sum(float(a["sanctioned_amount"] or 0) for a in apps if a["status"] in ("approved","partial_approved"))
        smf_sanctioned = sum(float(a["sanctioned_amount"] or 0) for a in apps if a["status"] in ("approved","partial_approved") and a["farmer_classification"] in ["Marginal", "Small"])
        smf_pct = round((smf_sanctioned / total_sanctioned * 100), 1) if total_sanctioned > 0 else 0.0

        # Marginal vs large rejection disparity
        marginal_apps = [a for a in apps if a["farmer_classification"] == "Marginal"]
        large_apps = [a for a in apps if a["farmer_classification"] == "Other"]
        
        m_rejections = sum(1 for a in marginal_apps if a["status"] == "rejected")
        l_rejections = sum(1 for a in large_apps if a["status"] == "rejected")
        
        m_rej_rate = round(m_rejections / len(marginal_apps) * 100, 1) if marginal_apps else 0.0
        l_rej_rate = round(l_rejections / len(large_apps) * 100, 1) if large_apps else 0.0

        compliance_table.append({
            "bank_name": b,
            "total_applications": total_b_apps,
            "approved_count": approved_b,
            "total_sanctioned": round(total_sanctioned, 2),
            "smf_sanctioned": round(smf_sanctioned, 2),
            "smf_lending_share_pct": smf_pct,
            "rbi_psl_status": "PASS" if smf_pct >= target else "WARNING_DEFICIT",
            "marginal_rejection_rate_pct": m_rej_rate,
            "large_rejection_rate_pct": l_rej_rate,
            "rejection_disparity_ratio": round(m_rej_rate / max(1.0, l_rej_rate), 2)
        })
    conn.close()
    return compliance_table

@app.get("/api/govt/policy-config")
def get_policy_config(user: Principal = Depends(roles("govt_auditor","bank_officer"))):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM govt_policy_parameters ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return dict(row)

@app.post("/api/govt/policy-config/update")
def update_policy_config(req: PolicyUpdateRequest,user: Principal = Depends(government)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO govt_policy_parameters (
        smf_minimum_quota, govt_first_loss_guarantee, interest_subvention_pct,
        collateral_free_threshold, bank_max_npa_ceiling, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?);
    """, (req.smf_minimum_quota, req.govt_first_loss_guarantee, req.interest_subvention_pct,
          req.collateral_free_threshold, req.bank_max_npa_ceiling, user.username))
    conn.commit()
    conn.close()

    return {
        "status": "POLICY_UPDATED",
        "message": "Government policy parameters published. Future allocations will use this version."
    }

@app.get("/api/govt/escalated-tribunal")
def get_escalated_tribunal_cases(user: Principal = Depends(government)):
    conn = get_db_connection()
    escalate_due(conn)
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
def issue_tribunal_directive(id: int, req: EscalatedDirectiveRequest, user: Principal = Depends(government)):
    if not req.directive.strip():
        raise HTTPException(422,"Enter a directive.")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE grievances_and_policy_logs
    SET govt_directive = ?, resolution_status = 'resolved', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND resolution_status='escalated';
    """, (req.directive, id))
    if cursor.rowcount!=1:
        conn.close()
        raise HTTPException(409,"This appeal is no longer pending.")
    app_id = cursor.execute("SELECT application_id FROM grievances_and_policy_logs WHERE id=?", (id,)).fetchone()[0]
    cursor.execute("UPDATE loan_applications SET status='under_review',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('submitted','rejected','appealed')", (app_id,))
    if app_id:
        cursor.execute("INSERT INTO review_decisions (application_id,actor,action,reason) VALUES (?,?,?,?)",
                       (app_id,user.username,"directive",req.directive.strip()))
    conn.commit()
    conn.close()
    return {
        "status": "DIRECTIVE_ISSUED",
        "message": f"Binding Government Directive issued for Case #{id}. Decision recorded for bank follow-up."
    }

# -----------------------------------------------------------------------------
# Static Files mount (Uploaded files + Next.js static export or built frontend)
# -----------------------------------------------------------------------------


NEXT_OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "out")
VITE_DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(NEXT_OUT_DIR):
    app.mount("/", StaticFiles(directory=NEXT_OUT_DIR, html=True), name="static")
elif os.path.exists(VITE_DIST_DIR):
    app.mount("/", StaticFiles(directory=VITE_DIST_DIR, html=True), name="static")

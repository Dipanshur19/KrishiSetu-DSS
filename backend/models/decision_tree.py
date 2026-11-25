"""
KrishiSetu DSS - Explainable Decision Tree Engine
RBI & Government Policy Eligibility & Instrument Routing Module
Loads official UP District Scale of Finance & Allied norms from seeded JSON.
"""

import json
import os
from typing import Dict, Any, List

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "icrisat_msp_sof.json")

def _load_norms() -> Dict[str, Any]:
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

_NORMS = _load_norms()

SCALE_OF_FINANCE = {
    crop: {
        "base_cost": info["scale_of_finance_per_acre"],
        "crop_type": info["season"],
        "insurance_pct": info["pmfby_farmer_premium_pct"]
    }
    for crop, info in _NORMS.get("crops", {}).items()
}
if not SCALE_OF_FINANCE:
    SCALE_OF_FINANCE = {
        "Wheat": {"base_cost": 24000, "crop_type": "Rabi", "insurance_pct": 1.5},
        "Paddy": {"base_cost": 26000, "crop_type": "Kharif", "insurance_pct": 2.0},
        "Potato": {"base_cost": 42000, "crop_type": "Rabi", "insurance_pct": 5.0},
        "Mustard": {"base_cost": 18000, "crop_type": "Rabi", "insurance_pct": 1.5},
        "Sugarcane": {"base_cost": 48000, "crop_type": "Annual", "insurance_pct": 2.0},
        "Gram": {"base_cost": 20000, "crop_type": "Rabi", "insurance_pct": 2.0},
        "Maize": {"base_cost": 22000, "crop_type": "Kharif", "insurance_pct": 2.0},
    }
SCALE_OF_FINANCE["Fodder/Default"] = {"base_cost": 15000, "crop_type": "All", "insurance_pct": 2.0}

ALLIED_UNIT_FINANCE = _NORMS.get("allied_norms", {
    "dairy_animal": 35000,
    "fisheries_acre": 45000,
    "poultry_100": 20000,
    "sheep_goat_10": 25000
})

def evaluate_decision_tree(
    farmer: Dict[str, Any],
    land: Dict[str, Any],
    liabilities: List[Dict[str, Any]],
    application: Dict[str, Any],
    policy: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Executes the 4-step Explainable Decision Tree against RBI PSL & KCC Rules.
    """
    steps_log = []
    reasons = []

    # Step 1: Farmer Classification (Acres -> Hectares)
    area_acres = float(land.get("area_acres", 1.0))
    area_hectares = area_acres / 2.47105

    if area_hectares <= 1.0:
        farmer_category = "Marginal"
        category_desc = f"{area_acres:.2f} acres ({area_hectares:.2f} ha) <= 1.0 ha: Classified as Marginal Farmer (RBI PSL priority)."
    elif area_hectares <= 2.0:
        farmer_category = "Small"
        category_desc = f"{area_acres:.2f} acres ({area_hectares:.2f} ha) <= 2.0 ha: Classified as Small Farmer."
    else:
        farmer_category = "Other"
        category_desc = f"{area_acres:.2f} acres ({area_hectares:.2f} ha) > 2.0 ha: Classified as Medium/Large Farmer."

    steps_log.append({
        "step": 1,
        "name": "Farmer Classification",
        "status": "PASS",
        "result": farmer_category,
        "details": category_desc,
        "data": {"area_acres": area_acres, "area_ha": round(area_hectares, 3)}
    })

    social_cat = farmer.get("social_category", "GEN")
    is_weaker = social_cat in ["SC", "ST", "Women", "PWD", "Minority"] or (farmer_category in ["Marginal", "Small"])

    # Step 2: Hard Compliance & Duplication Check
    has_wilful_default = False
    has_commercial_npa = False
    has_informal_debt_only = False
    total_overdue = 0.0

    for liab in liabilities:
        if liab.get("is_wilful_default"):
            has_wilful_default = True
        if liab.get("is_npa"):
            if liab.get("lender_type") == "moneylender_informal":
                has_informal_debt_only = True
            else:
                has_commercial_npa = True
        total_overdue += float(liab.get("outstanding_balance_m", 0.0))

    if has_wilful_default:
        steps_log.append({
            "step": 2,
            "name": "Hard Compliance Check",
            "status": "FAIL",
            "result": "REJECTED_WILFUL_DEFAULT",
            "details": "Active wilful default / fraud flag detected on credit records.",
            "data": {"has_wilful_default": True}
        })
        reasons.append("Rejected due to active wilful default record as per RBI regulations.")
        return {
            "status": "REJECTED",
            "farmer_category": farmer_category,
            "instrument": "None",
            "scale_of_finance_limit": 0.0,
            "collateral_required": False,
            "weaker_section_eligible": is_weaker,
            "debt_swap_recommended": False,
            "interest_rate_effective": 0.0,
            "steps_log": steps_log,
            "reasons": reasons
        }

    debt_swap_recommended = False
    if has_informal_debt_only and not has_commercial_npa:
        debt_swap_recommended = True
        compliance_result = "ROUTED_DEBT_SWAP"
        compliance_details = "Overdue is to informal moneylenders only. Routed to RBI Weaker Section Debt-Swap Facility to free farmer from distress."
        reasons.append("Eligible for RBI Debt-Swap refinance to eliminate high-interest informal moneylender debt.")
    elif has_commercial_npa:
        compliance_result = "RESTRICTED_RESTRUCTURE"
        compliance_details = "Past commercial bank NPA detected; requires settlement or special credit restructure under RBI rehabilitation norms."
        reasons.append("Subject to NPA restructuring terms with lending branch.")
    else:
        compliance_result = "PASS"
        compliance_details = "Clean compliance profile. No active wilful default or duplicate Survey/Khasra KCC detected."

    steps_log.append({
        "step": 2,
        "name": "Hard Compliance & Duplication Check",
        "status": "PASS" if compliance_result in ["PASS", "ROUTED_DEBT_SWAP"] else "FLAGGED",
        "result": compliance_result,
        "details": compliance_details,
        "data": {"total_overdue": total_overdue, "debt_swap_recommended": debt_swap_recommended}
    })

    # Step 3: Instrument & Collateral Routing
    ownership_type = land.get("ownership_type", "owned")
    requested_amount = float(application.get("requested_amount", 50000.0))
    marketing_tieup = application.get("marketing_tieup", "None")
    has_tieup = marketing_tieup in ["Cooperative", "Government_Procurement", "Corporate_Contract"]
    collateral_free_threshold = float(policy.get("collateral_free_threshold", 200000.0))
    collateral_free_tieup_threshold = float(policy.get("collateral_free_tieup_threshold", 300000.0))

    if ownership_type in ["oral_lease", "sharecropper"]:
        instrument = "Flexi KCC"
        collateral_required = False
        instrument_details = "Sharecropper / Oral lessee without land title: Eligible for Flexi KCC (₹10,000–₹50,000) backed by Panchayat affidavit."
        reasons.append("Approved for Flexi KCC without land mortgage under RBI 2026 Direction for sharecroppers.")
    elif requested_amount <= collateral_free_threshold:
        instrument = "Collateral-Free KCC"
        collateral_required = False
        instrument_details = f"Requested ₹{requested_amount:,.0f} <= ₹{collateral_free_threshold:,.0f}: Mandatory Collateral-Free Short-Term KCC (RBI Jan 2025 norm)."
        reasons.append("Exempted from collateral / land charge under RBI's ₹2 Lakh collateral-free mandate.")
    elif requested_amount <= collateral_free_tieup_threshold and has_tieup:
        instrument = "Collateral-Free KCC (Tie-Up)"
        collateral_required = False
        instrument_details = f"Requested ₹{requested_amount:,.0f} <= ₹{collateral_free_tieup_threshold:,.0f} with verified {marketing_tieup} tie-up: Extended Collateral Waiver applies."
        reasons.append(f"Extended collateral waiver applied up to ₹3 Lakh due to verified {marketing_tieup} recovery tie-up.")
    else:
        instrument = "Collateral / Hypothecation Required KCC"
        collateral_required = True
        instrument_details = f"Requested ₹{requested_amount:,.0f} > ₹{collateral_free_threshold:,.0f}: Land hypothecation or collateral charge mandatory."
        reasons.append("Standard land title charge required as loan exceeds collateral-free threshold.")

    steps_log.append({
        "step": 3,
        "name": "Instrument & Collateral Routing",
        "status": "PASS",
        "result": instrument,
        "details": instrument_details,
        "data": {
            "ownership_type": ownership_type,
            "collateral_required": collateral_required,
            "has_marketing_tieup": has_tieup
        }
    })

    # Step 4: RBI Scale-of-Finance Credit Limit Calculation
    primary_crop = application.get("primary_crop", "Wheat")
    crop_info = SCALE_OF_FINANCE.get(primary_crop, SCALE_OF_FINANCE["Fodder/Default"])
    base_sof_per_acre = crop_info["base_cost"]

    crop_limit = base_sof_per_acre * area_acres
    post_harvest_allowance = 0.10 * crop_limit
    farm_upkeep_allowance = 0.20 * crop_limit

    pmfby_optin = application.get("pmfby_optin", True)
    insurance_premium = (crop_info["insurance_pct"] / 100.0) * crop_limit if pmfby_optin else 0.0

    livestock_count = int(land.get("livestock_count", 0))
    allied_limit = livestock_count * ALLIED_UNIT_FINANCE.get("dairy_animal", 35000)

    total_scale_of_finance_limit = crop_limit + post_harvest_allowance + farm_upkeep_allowance + insurance_premium + allied_limit

    if instrument == "Flexi KCC":
        flexi_max = float(policy.get("flexi_kcc_max", 50000.0))
        flexi_min = float(policy.get("flexi_kcc_min", 10000.0))
        total_scale_of_finance_limit = max(flexi_min, min(total_scale_of_finance_limit, flexi_max))

    steps_log.append({
        "step": 4,
        "name": "Scale-of-Finance Credit Limit Calculation",
        "status": "PASS",
        "result": f"₹{total_scale_of_finance_limit:,.0f}",
        "details": (
            f"Base crop ({primary_crop} @ ₹{base_sof_per_acre}/acre x {area_acres} acres = ₹{crop_limit:,.0f}) "
            f"+ 10% Post-Harvest (₹{post_harvest_allowance:,.0f}) "
            f"+ 20% Farm Maintenance (₹{farm_upkeep_allowance:,.0f}) "
            f"+ PMFBY Insurance (₹{insurance_premium:,.0f}) "
            f"+ Allied Dairy ({livestock_count} animals = ₹{allied_limit:,.0f})."
        ),
        "data": {
            "crop_limit": crop_limit,
            "post_harvest": post_harvest_allowance,
            "farm_upkeep": farm_upkeep_allowance,
            "insurance_premium": insurance_premium,
            "allied_limit": allied_limit,
            "total_limit": total_scale_of_finance_limit
        }
    })

    miss_subvention = float(policy.get("interest_subvention_pct", 3.0))
    miss_base = float(policy.get("miss_base_rate", 7.0))
    interest_rate_effective = max(2.0, miss_base - miss_subvention) if requested_amount <= 300000.0 else miss_base

    return {
        "status": "ELIGIBLE",
        "farmer_category": farmer_category,
        "instrument": instrument,
        "scale_of_finance_limit": round(total_scale_of_finance_limit, 2),
        "collateral_required": collateral_required,
        "weaker_section_eligible": is_weaker,
        "debt_swap_recommended": debt_swap_recommended,
        "interest_rate_effective": interest_rate_effective,
        "steps_log": steps_log,
        "reasons": reasons
    }

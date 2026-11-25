"""
KrishiSetu DSS - Explainable Decision Tree Engine
RBI & Government Policy Eligibility & Instrument Routing Module
Aligned with:
- RBI Master Circular on Priority Sector Lending (PSL)
- RBI Master Directions - KCC (2025/2026 guidelines)
- Modified Interest Subvention Scheme (MISS)
"""

from typing import Dict, Any, Tuple, List

# Official Scale of Finance (₹ per acre) for key crops in UP districts (Kanpur, Unnao, Jhansi, etc.)
SCALE_OF_FINANCE = {
    "Wheat": {"base_cost": 24000, "crop_type": "Rabi", "insurance_pct": 1.5},
    "Paddy": {"base_cost": 26000, "crop_type": "Kharif", "insurance_pct": 2.0},
    "Potato": {"base_cost": 42000, "crop_type": "Rabi", "insurance_pct": 5.0},
    "Mustard": {"base_cost": 18000, "crop_type": "Rabi", "insurance_pct": 1.5},
    "Sugarcane": {"base_cost": 48000, "crop_type": "Annual", "insurance_pct": 2.0},
    "Gram": {"base_cost": 20000, "crop_type": "Rabi", "insurance_pct": 2.0},
    "Maize": {"base_cost": 22000, "crop_type": "Kharif", "insurance_pct": 2.0},
    "Vegetables": {"base_cost": 35000, "crop_type": "Zaid/Kharif", "insurance_pct": 5.0},
    "Fodder/Default": {"base_cost": 15000, "crop_type": "All", "insurance_pct": 2.0}
}

# Allied Sector Unit Finance norms (RBI KCC Allied Norms)
ALLIED_UNIT_FINANCE = {
    "dairy_animal": 35000,      # per cow/buffalo
    "fisheries_acre": 45000,    # per acre pond
    "poultry_100": 20000,       # per 100 birds
    "sheep_goat_10": 25000      # per unit of 10
}

def evaluate_decision_tree(
    farmer: Dict[str, Any],
    land: Dict[str, Any],
    liabilities: List[Dict[str, Any]],
    application: Dict[str, Any],
    policy: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Executes the 4-step Explainable Decision Tree:
    Returns {
        "status": "ELIGIBLE" | "REJECTED" | "ROUTED_DEBT_SWAP",
        "farmer_category": "Marginal" | "Small" | "Other",
        "instrument": "Flexi KCC" | "Collateral-Free KCC" | "Collateral Required KCC" | "Term Loan",
        "scale_of_finance_limit": float,
        "collateral_required": bool,
        "weaker_section_eligible": bool,
        "debt_swap_recommended": bool,
        "interest_rate_effective": float, # 4% with MISS vs 7%
        "steps_log": List[Dict[str, Any]],
        "reasons": List[str]
    }
    """
    steps_log = []
    reasons = []

    # ----------------------------------------------------
    # Step 1: Farmer Classification (Acres -> Hectares)
    # ----------------------------------------------------
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

    # Weaker section check (SC/ST, women, PWD, or debt distressed)
    social_cat = farmer.get("social_category", "GEN")
    is_weaker = social_cat in ["SC", "ST", "Women", "PWD", "Minority"] or (farmer_category in ["Marginal", "Small"])

    # ----------------------------------------------------
    # Step 2: Hard Compliance & Duplication Check
    # ----------------------------------------------------
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
        # Route to Weaker Section Debt-Swap tier
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

    # ----------------------------------------------------
    # Step 3: Instrument & Collateral Routing
    # ----------------------------------------------------
    ownership_type = land.get("ownership_type", "owned")
    requested_amount = float(application.get("requested_amount", 50000.0))
    marketing_tieup = application.get("marketing_tieup", "None")
    has_tieup = marketing_tieup in ["Cooperative", "Government_Procurement", "Corporate_Contract"]
    collateral_free_threshold = float(policy.get("collateral_free_threshold", 200000.0)) # ₹2 Lakh
    collateral_free_tieup_threshold = float(policy.get("collateral_free_tieup_threshold", 300000.0)) # ₹3 Lakh

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

    # ----------------------------------------------------
    # Step 4: RBI Scale-of-Finance Credit Limit Calculation
    # ----------------------------------------------------
    primary_crop = application.get("primary_crop", "Wheat")
    crop_info = SCALE_OF_FINANCE.get(primary_crop, SCALE_OF_FINANCE["Fodder/Default"])
    base_sof_per_acre = crop_info["base_cost"]
    
    # Scale of finance for crop component
    crop_limit = base_sof_per_acre * area_acres
    
    # 10% for post-harvest / household living expenses
    post_harvest_allowance = 0.10 * crop_limit
    
    # 20% for farm maintenance, repairs, and machinery upkeep
    farm_upkeep_allowance = 0.20 * crop_limit
    
    # PMFBY Insurance Premium component
    pmfby_optin = application.get("pmfby_optin", True)
    insurance_premium = (crop_info["insurance_pct"] / 100.0) * crop_limit if pmfby_optin else 0.0

    # Allied component
    livestock_count = int(land.get("livestock_count", 0))
    allied_limit = livestock_count * ALLIED_UNIT_FINANCE["dairy_animal"]

    total_scale_of_finance_limit = crop_limit + post_harvest_allowance + farm_upkeep_allowance + insurance_premium + allied_limit

    # Cap if Flexi KCC
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

    # Effective interest calculation (MISS: 7% base, 3% prompt repayment incentive = 4% net)
    interest_rate_effective = 4.0 if requested_amount <= 300000.0 else 7.0

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

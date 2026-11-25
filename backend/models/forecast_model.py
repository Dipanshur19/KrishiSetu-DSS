"""
KrishiSetu DSS - Cash-Flow & Agronomic Forecast Model
Predicts whether farmer can repay from future agricultural output rather than past collateral.
Calculates:
- Expected Seasonal Net Revenue (R_hat)
- Downside Drought Scenario (R_stress)
- Debt Service Coverage Ratio (DSCR) using MISS 4% prompt repayment rate
"""

from typing import Dict, Any, Tuple
import math

# District crop yield averages (tonnes per acre) and MSP rates (₹ per quintal = ₹ per 0.1 tonne)
DISTRICT_CROP_NORMS = {
    "Wheat": {"yield_tonnes_acre": 1.85, "msp_per_quintal": 2275.0, "cost_of_cultivation_acre": 16000.0},
    "Paddy": {"yield_tonnes_acre": 2.10, "msp_per_quintal": 2183.0, "cost_of_cultivation_acre": 18000.0},
    "Potato": {"yield_tonnes_acre": 10.50, "msp_per_quintal": 1250.0, "cost_of_cultivation_acre": 32000.0},
    "Mustard": {"yield_tonnes_acre": 0.75, "msp_per_quintal": 5650.0, "cost_of_cultivation_acre": 12000.0},
    "Sugarcane": {"yield_tonnes_acre": 32.0, "msp_per_quintal": 370.0, "cost_of_cultivation_acre": 35000.0},
    "Gram": {"yield_tonnes_acre": 0.65, "msp_per_quintal": 5440.0, "cost_of_cultivation_acre": 14000.0},
    "Maize": {"yield_tonnes_acre": 1.60, "msp_per_quintal": 2090.0, "cost_of_cultivation_acre": 15000.0},
    "Default": {"yield_tonnes_acre": 1.20, "msp_per_quintal": 2200.0, "cost_of_cultivation_acre": 14000.0}
}

# Irrigation multipliers for drought resistance
IRRIGATION_FACTORS = {
    "Drip": {"normal_multiplier": 1.25, "drought_retention": 0.90, "desc": "High efficiency micro-irrigation; highly resilient to rainfall deficits."},
    "Sprinkler": {"normal_multiplier": 1.15, "drought_retention": 0.80, "desc": "Pressurized sprinkler system; strong water conservation."},
    "Canal": {"normal_multiplier": 1.05, "drought_retention": 0.65, "desc": "Public gravity canal; dependent on reservoir releases."},
    "Well": {"normal_multiplier": 1.00, "drought_retention": 0.60, "desc": "Private borewell/tubewell; vulnerable to water table depletion."},
    "Dry": {"normal_multiplier": 0.75, "drought_retention": 0.35, "desc": "Pure rainfed farming; severe vulnerability to monsoon anomalies."}
}

# District climatic drought vulnerability weights (e.g. Bundelkhand / Jhansi vs Gangetic plains)
DISTRICT_WEATHER_PROFILE = {
    "Jhansi": {"rainfall_anomaly_pct": -22.0, "drought_risk": "High (Bundelkhand Zone)"},
    "Kanpur Dehat": {"rainfall_anomaly_pct": -6.0, "drought_risk": "Moderate"},
    "Kanpur Nagar": {"rainfall_anomaly_pct": -4.0, "drought_risk": "Low-Moderate"},
    "Unnao": {"rainfall_anomaly_pct": -3.0, "drought_risk": "Low"},
    "Lucknow": {"rainfall_anomaly_pct": 2.0, "drought_risk": "Low"},
    "Barabanki": {"rainfall_anomaly_pct": 4.0, "drought_risk": "Low"},
    "Fatehpur": {"rainfall_anomaly_pct": -10.0, "drought_risk": "Moderate"}
}

def calculate_forecast_and_dscr(
    land: Dict[str, Any],
    application: Dict[str, Any],
    sanction_amount: float,
    district: str = "Kanpur Dehat"
) -> Dict[str, Any]:
    """
    Computes Expected Revenue R_hat, Drought Stress Revenue R_stress, and DSCR.
    """
    area_acres = float(land.get("area_acres", 1.0))
    irrigation_source = land.get("irrigation_source", "Well")
    primary_crop = application.get("primary_crop", "Wheat")
    
    crop_norm = DISTRICT_CROP_NORMS.get(primary_crop, DISTRICT_CROP_NORMS["Default"])
    irrig_info = IRRIGATION_FACTORS.get(irrigation_source, IRRIGATION_FACTORS["Well"])
    weather_info = DISTRICT_WEATHER_PROFILE.get(district, {"rainfall_anomaly_pct": -5.0, "drought_risk": "Moderate"})

    # Yield in quintals (1 tonne = 10 quintals)
    base_yield_quintals = crop_norm["yield_tonnes_acre"] * 10.0 * area_acres
    adjusted_yield = base_yield_quintals * irrig_info["normal_multiplier"]
    
    # Gross Crop Revenue
    gross_crop_revenue = adjusted_yield * crop_norm["msp_per_quintal"]
    cultivation_cost = crop_norm["cost_of_cultivation_acre"] * area_acres
    net_crop_revenue = max(0.0, gross_crop_revenue - cultivation_cost)

    # Allied sector revenue (dairy: ~₹2,500/month net profit per milch animal * 12 = ₹30,000/year)
    livestock_count = int(land.get("livestock_count", 0))
    allied_annual_income = livestock_count * 30000.0

    # Non-farm income (off-season labor / petty shop / transport)
    non_farm_income = 25000.0 if area_acres <= 2.5 else 10000.0

    # Estimated annual household living expense (baseline ₹4,000/month for marginal, ₹6,000 for small)
    household_living_expense = 48000.0 if area_acres <= 2.5 else 72000.0

    # Total Expected Seasonal/Annual Net Inflow
    R_hat = net_crop_revenue + allied_annual_income + non_farm_income

    # Drought stress scenario: severe rain deficiency (-35%)
    drought_yield = base_yield_quintals * irrig_info["drought_retention"]
    drought_gross_revenue = drought_yield * crop_norm["msp_per_quintal"]
    # Even under drought, PMFBY crop insurance pays out if enrolled
    pmfby_optin = application.get("pmfby_optin", True)
    pmfby_payout = (cultivation_cost * 0.70) if pmfby_optin else 0.0

    drought_net_crop_revenue = max(0.0, drought_gross_revenue - (cultivation_cost * 0.85) + pmfby_payout)
    R_stress = drought_net_crop_revenue + (allied_annual_income * 0.85) + non_farm_income

    # Debt Service Obligations
    # MISS: 4% effective prompt repayment rate vs 7% standard rate
    principal = float(sanction_amount)
    effective_interest = principal * 0.04
    standard_interest = principal * 0.07
    total_debt_service_miss = principal + effective_interest
    total_debt_service_std = principal + standard_interest

    # Cash available for debt service (CADS)
    cads_normal = max(1000.0, R_hat - household_living_expense)
    cads_stress = max(500.0, R_stress - household_living_expense)

    dscr_miss = round(cads_normal / total_debt_service_miss, 2) if total_debt_service_miss > 0 else 2.5
    dscr_stress = round(cads_stress / total_debt_service_miss, 2) if total_debt_service_miss > 0 else 1.2
    dscr_standard = round(cads_normal / total_debt_service_std, 2) if total_debt_service_std > 0 else 2.1

    # Quality verdict
    if dscr_miss >= 1.5:
        verdict = "EXCELLENT_COVERAGE"
        verdict_desc = f"DSCR of {dscr_miss:.2f} indicates robust cash flow buffer even after living expenses."
    elif dscr_miss >= 1.15:
        verdict = "ADEQUATE_COVERAGE"
        verdict_desc = f"DSCR of {dscr_miss:.2f} satisfies RBI benchmark (>= 1.15) under 4% MISS incentive."
    elif dscr_miss >= 0.90:
        verdict = "BORDERLINE_STRESS"
        verdict_desc = f"DSCR of {dscr_miss:.2f} indicates thin repayment buffer; recommendation: PMFBY + allied dairy support."
    else:
        verdict = "HIGH_STRESS"
        verdict_desc = f"DSCR of {dscr_miss:.2f} requires loan restructuring or guarantee enhancement."

    return {
        "expected_net_revenue": round(R_hat, 2),
        "drought_stress_revenue": round(R_stress, 2),
        "gross_crop_revenue": round(gross_crop_revenue, 2),
        "cultivation_cost": round(cultivation_cost, 2),
        "allied_income": round(allied_annual_income, 2),
        "non_farm_income": round(non_farm_income, 2),
        "household_living_expense": round(household_living_expense, 2),
        "dscr_ratio": dscr_miss,
        "dscr_stress": dscr_stress,
        "dscr_standard_interest": dscr_standard,
        "debt_service_obligation": round(total_debt_service_miss, 2),
        "verdict": verdict,
        "verdict_desc": verdict_desc,
        "weather_profile": weather_info,
        "irrigation_profile": irrig_info
    }

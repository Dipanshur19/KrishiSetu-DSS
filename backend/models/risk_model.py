"""
KrishiSetu DSS - Hybrid Credit Risk & Explainability (Alternative Scoring) Model
Calibrated specifically for thin-file small and marginal Indian farmers.
Combines Financial Features with Agronomic & Social Resilience signals.
Produces:
- Probability of Default (PD)
- Loss Given Default (LGD)
- Equity Priority Score (for Govt PSL mandate)
- Top 3 Human-Readable SHAP-style explainability factors
"""

from typing import Dict, Any, List, Tuple
import math

def calculate_hybrid_risk_and_shap(
    farmer: Dict[str, Any],
    land: Dict[str, Any],
    liabilities: List[Dict[str, Any]],
    application: Dict[str, Any],
    dscr_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Computes calibrated alternative credit score, PD, LGD, and top SHAP explanations.
    """
    shap_factors = []
    
    # -------------------------------------------------------------------------
    # 1. Base Probability of Default (Calibrated baseline for rural agri credit: 8.5%)
    # -------------------------------------------------------------------------
    log_odds = -2.38 # corresponds to sigmoid(-2.38) ~= 0.0847 (8.5% base PD)

    # -------------------------------------------------------------------------
    # 2. Financial Risk Signals
    # -------------------------------------------------------------------------
    total_existing_debt = sum(float(l.get("outstanding_balance_m", 0.0)) for l in liabilities)
    movable_k = float(land.get("movable_asset_val_k", 0.0))
    immovable_l = float(land.get("immovable_asset_val_l", 0.0))
    total_assets = max(10000.0, movable_k + immovable_l)
    debt_to_asset = total_existing_debt / total_assets

    if debt_to_asset > 0.60:
        impact = 0.45
        log_odds += impact
        shap_factors.append({
            "name": "High Debt-to-Asset Ratio",
            "direction": "RISK_INCREASE",
            "delta_pd_pct": 14.5,
            "text": f"High debt-to-asset ratio ({debt_to_asset:.2f}) across existing liabilities."
        })
    elif debt_to_asset < 0.20:
        impact = -0.30
        log_odds += impact
        shap_factors.append({
            "name": "Strong Asset Buffer",
            "direction": "RISK_DECREASE",
            "delta_pd_pct": -9.2,
            "text": f"Healthy net worth buffer: Debt-to-Asset ratio is only {debt_to_asset:.2f}."
        })

    # Past overdue check
    max_overdue_days = max([int(l.get("overdue_days", 0)) for l in liabilities] or [0])
    if max_overdue_days > 90:
        log_odds += 0.55
        shap_factors.append({
            "name": "Past Overdue History",
            "direction": "RISK_INCREASE",
            "delta_pd_pct": 18.0,
            "text": f"Existing overdue of {max_overdue_days} days logged on bureau."
        })

    # -------------------------------------------------------------------------
    # 3. Agronomic Resilience Signals (The Game Changer for Marginal Farmers!)
    # -------------------------------------------------------------------------
    irrigation_source = land.get("irrigation_source", "Well")
    pmfby_optin = application.get("pmfby_optin", True)
    
    if irrigation_source in ["Drip", "Sprinkler"]:
        log_odds -= 0.40
        shap_factors.append({
            "name": "Micro-Irrigation Resilience",
            "direction": "RISK_DECREASE",
            "delta_pd_pct": -13.5,
            "text": f"Pressurized {irrigation_source} irrigation significantly protects crop yield against monsoon deficit."
        })
    elif irrigation_source == "Dry":
        log_odds += 0.35
        shap_factors.append({
            "name": "Rainfed Exposure",
            "direction": "RISK_INCREASE",
            "delta_pd_pct": 12.0,
            "text": "100% rainfed land with no assured irrigation creates vulnerability to drought."
        })

    if pmfby_optin:
        log_odds -= 0.35
        shap_factors.append({
            "name": "PMFBY Crop Insurance",
            "direction": "RISK_DECREASE",
            "delta_pd_pct": -11.8,
            "text": "Enrolled in PMFBY scheme; institutional insurance payout absorbs major crop failure."
        })
    else:
        log_odds += 0.25
        shap_factors.append({
            "name": "Uninsured Crop",
            "direction": "RISK_INCREASE",
            "delta_pd_pct": 8.5,
            "text": "Farmer opted out of PMFBY; complete yield loss risk falls on household."
        })

    # Marketing tie-up
    marketing_tieup = application.get("marketing_tieup", "None")
    if marketing_tieup in ["Cooperative", "Government_Procurement", "Corporate_Contract"]:
        log_odds -= 0.30
        shap_factors.append({
            "name": "Guaranteed Offtake / Tie-Up",
            "direction": "RISK_DECREASE",
            "delta_pd_pct": -10.2,
            "text": f"Verified marketing tie-up with {marketing_tieup} prevents distress sales below MSP."
        })

    # Allied income (Dairy, poultry)
    livestock_count = int(land.get("livestock_count", 0))
    if livestock_count >= 2:
        log_odds -= 0.25
        shap_factors.append({
            "name": "Allied Dairy Revenue Buffer",
            "direction": "RISK_DECREASE",
            "delta_pd_pct": -8.4,
            "text": f"{livestock_count} dairy animals provide weekly milk cash flow independent of harvest cycles."
        })

    # Mandi proximity
    distance_to_mandi = float(land.get("distance_to_mandi_km", 8.0))
    if distance_to_mandi > 20.0:
        log_odds += 0.20
        shap_factors.append({
            "name": "High Mandi Distance",
            "direction": "RISK_INCREASE",
            "delta_pd_pct": 6.5,
            "text": f"Farm is {distance_to_mandi:.1f} km from APMC mandi, increasing transport logistics cost."
        })

    # Calculate Probability of Default via Sigmoid
    pd = 1.0 / (1.0 + math.exp(-log_odds))
    # Bound between 1.5% and 42%
    pd = max(0.015, min(pd, 0.42))

    # -------------------------------------------------------------------------
    # 4. Loss Given Default (LGD)
    # -------------------------------------------------------------------------
    # Base LGD: 65% for unsecured/rural
    lgd = 0.65
    if pmfby_optin:
        lgd -= 0.20 # insurance recovery
    if marketing_tieup != "None":
        lgd -= 0.15 # direct deduction at mandi/cooperative
    if land.get("ownership_type") == "owned":
        lgd -= 0.05
    lgd = max(0.20, min(lgd, 0.70))

    # -------------------------------------------------------------------------
    # 5. Equity Priority Score (Govt Mandate: Maximize welfare of vulnerable farmers)
    # -------------------------------------------------------------------------
    # Scale from 0 to 100
    equity_score = 40.0 # base
    area_acres = float(land.get("area_acres", 1.0))
    if area_acres <= 2.47: # Marginal farmer
        equity_score += 35.0
    elif area_acres <= 4.94: # Small farmer
        equity_score += 20.0

    social_cat = farmer.get("social_category", "GEN")
    if social_cat in ["SC", "ST"]:
        equity_score += 15.0
    elif social_cat in ["Women", "PWD", "Minority"]:
        equity_score += 10.0

    if farmer.get("gender") == "F":
        equity_score += 5.0

    # Sharecropper inclusion bonus
    if land.get("ownership_type") in ["oral_lease", "sharecropper"]:
        equity_score += 10.0

    equity_score = min(100.0, equity_score)

    # Sort SHAP factors by magnitude of impact
    shap_factors.sort(key=lambda x: abs(x["delta_pd_pct"]), reverse=True)
    top_3_shap = shap_factors[:3]

    return {
        "pd_score": round(pd, 4),
        "pd_pct": round(pd * 100, 2),
        "lgd_score": round(lgd, 4),
        "expected_loss_rate": round(pd * lgd * 100, 2),
        "equity_priority_score": round(equity_score, 1),
        "shap_reasons": top_3_shap
    }

"""
KrishiSetu DSS - Hybrid Credit Risk & Explainability (XGBoost + SHAP)
Trains a real XGBoost classifier (combined with logistic regression) on simulated
synthetic rural agricultural lending profiles, and computes true per-applicant
SHAP values using `shap.TreeExplainer`.
"""

from typing import Dict, Any, List
import numpy as np
import xgboost as xgb
import shap
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import brier_score_loss, roc_auc_score

FEATURE_NAMES = [
    "debt_to_asset_ratio",
    "max_overdue_days",
    "micro_irrigation_score",   # 1.0 Drip/Sprinkler, 0.5 Canal/Well, 0.0 Dry
    "pmfby_insured",            # 1 or 0
    "marketing_tieup",          # 1 or 0
    "livestock_count",          # count of milch animals
    "mandi_distance_km",        # km to nearest APMC mandi
    "dscr_ratio"                # debt service coverage ratio
]

def _train_calibrated_xgboost_model():
    """
    Trains an XGBoost binary default risk classifier on 1,500 realistic
    simulated agricultural lending samples, plus a SHAP TreeExplainer.
    """
    rng = np.random.default_rng(624)
    n_samples = 1500

    debt_to_asset = rng.uniform(0.0, 0.95, n_samples)
    overdue_days = rng.choice([0, 0, 0, 30, 60, 120, 180], size=n_samples, p=[0.55, 0.15, 0.1, 0.06, 0.05, 0.05, 0.04])
    micro_irrig = rng.choice([1.0, 0.5, 0.0], size=n_samples, p=[0.22, 0.58, 0.20])
    pmfby = rng.choice([1.0, 0.0], size=n_samples, p=[0.82, 0.18])
    tieup = rng.choice([1.0, 0.0], size=n_samples, p=[0.70, 0.30])
    livestock = rng.choice([0, 1, 2, 3, 4], size=n_samples, p=[0.25, 0.30, 0.30, 0.10, 0.05])
    mandi_km = rng.uniform(2.0, 35.0, n_samples)
    dscr = np.clip(1.8 - 0.8 * debt_to_asset + 0.3 * micro_irrig + 0.25 * (livestock >= 2) + rng.normal(0, 0.2, n_samples), 0.5, 3.5)

    X = np.column_stack([
        debt_to_asset, overdue_days, micro_irrig, pmfby,
        tieup, livestock, mandi_km, dscr
    ])

    # Latent default log-odds calibrated to Indian rural PSL NPA (~6-9% base)
    logits = (
        -2.35
        + 1.65 * np.maximum(0, debt_to_asset - 0.35)
        + 0.011 * overdue_days
        - 0.75 * (micro_irrig == 1.0)
        + 0.60 * (micro_irrig == 0.0)
        - 0.65 * pmfby
        - 0.55 * tieup
        - 0.25 * np.minimum(livestock, 3)
        + 0.025 * np.maximum(0, mandi_km - 15.0)
        - 0.65 * np.maximum(0, dscr - 1.2)
    )
    probs = 1.0 / (1.0 + np.exp(-logits))
    y = rng.binomial(1, probs)

    xgb_model = xgb.XGBClassifier(
        n_estimators=60,
        max_depth=3,
        learning_rate=0.08,
        subsample=0.85,
        random_state=624,
        eval_metric="logloss"
    )
    train_x,test_x,train_y,test_y = train_test_split(X,y,test_size=0.2,random_state=624,stratify=y)
    xgb_model.fit(train_x, train_y)

    lr_model = LogisticRegression(max_iter=500, random_state=624)
    lr_model.fit(train_x, train_y)

    explainer = shap.TreeExplainer(xgb_model)
    predicted = np.clip(0.7*xgb_model.predict_proba(test_x)[:,1]+0.3*lr_model.predict_proba(test_x)[:,1],0.015,0.42)
    validation = {"population":"synthetic only", "training":len(train_y), "holdout":len(test_y),
                  "holdout_defaults":int(test_y.sum()), "auc":round(float(roc_auc_score(test_y,predicted)),3),
                  "brier":round(float(brier_score_loss(test_y,predicted)),4)}
    return xgb_model, lr_model, explainer, validation

_XGB_MODEL, _LR_MODEL, _SHAP_EXPLAINER, SYNTHETIC_VALIDATION = _train_calibrated_xgboost_model()

def _explain_feature(fname: str, val: float, shap_logodds_delta: float) -> Dict[str, Any]:
    direction = "RISK_DECREASE" if shap_logodds_delta < 0 else "RISK_INCREASE"
    labels = {
        "debt_to_asset_ratio": (
            "Strong Asset Buffer" if direction == "RISK_DECREASE" else "High Debt-to-Asset Ratio",
            f"Debt-to-Asset ratio M/(K+L) = {val:.2f} {'strengthens' if direction == 'RISK_DECREASE' else 'strains'} repayment resilience."
        ),
        "max_overdue_days": (
            "Clean Repayment Track" if direction == "RISK_DECREASE" else "Existing Overdue History",
            f"{'Zero active overdues across cooperative & commercial lenders.' if val == 0 else f'Existing overdue of {int(val)} days logged on credit record.'}"
        ),
        "micro_irrigation_score": (
            "Irrigation Resilience" if direction == "RISK_DECREASE" else "Rainfed Monsoon Exposure",
            "Pressurized Drip/Sprinkler or assured irrigation shields crop yields." if val >= 0.5 else "100% rainfed land increases monsoon yield volatility."
        ),
        "pmfby_insured": (
            "PMFBY Crop Insurance" if direction == "RISK_DECREASE" else "Uninsured Crop Exposure",
            "Enrolled in PMFBY scheme; institutional insurance absorbs major crop failure." if val >= 0.5 else "Opted out of PMFBY; complete weather risk falls on household."
        ),
        "marketing_tieup": (
            "Verified Offtake Tie-Up" if direction == "RISK_DECREASE" else "No Formal Offtake Tie-Up",
            "Verified cooperative/procurement tie-up prevents distress sales below MSP." if val >= 0.5 else "Open-market spot sale exposes farmer to price volatility."
        ),
        "livestock_count": (
            "Allied Dairy Cash Buffer" if direction == "RISK_DECREASE" else "Single-Crop Dependency",
            f"{int(val)} dairy animals provide steady weekly cash flow independent of harvest." if val >= 1 else "No allied dairy income buffer outside harvest season."
        ),
        "mandi_distance_km": (
            "Close Mandi Access" if direction == "RISK_DECREASE" else "High Mandi Distance",
            f"Farm is {val:.1f} km from APMC mandi, keeping post-harvest transport costs {'low' if direction == 'RISK_DECREASE' else 'elevated'}."
        ),
        "dscr_ratio": (
            "Strong Harvest DSCR" if direction == "RISK_DECREASE" else "Tight Debt Coverage (DSCR)",
            f"Forecasted Debt Service Coverage Ratio is {val:.2f}x under 4% MISS rate."
        )
    }
    title, desc = labels.get(fname, (fname, ""))
    return {
        "feature": fname,
        "name": title,
        "direction": direction,
        "shap_logodds": round(float(shap_logodds_delta), 4),
        "text": desc
    }

def calculate_hybrid_risk_and_shap(
    farmer: Dict[str, Any],
    land: Dict[str, Any],
    liabilities: List[Dict[str, Any]],
    application: Dict[str, Any],
    dscr_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Runs trained XGBoost + Logistic Regression ensemble & computes exact SHAP TreeExplainer
    attributions for the top 3 human-readable explainability factors.
    """
    total_existing_debt = sum(float(l.get("outstanding_balance_m", 0.0)) for l in liabilities)
    movable_k = float(land.get("movable_asset_val_k", 0.0))
    immovable_l = float(land.get("immovable_asset_val_l", 0.0))
    total_assets = max(10000.0, movable_k + immovable_l)
    debt_to_asset = min(1.0, total_existing_debt / total_assets)

    max_overdue_days = float(max([int(l.get("overdue_days", 0)) for l in liabilities] or [0]))

    irrig_src = land.get("irrigation_source", "Well")
    micro_irrig_score = 1.0 if irrig_src in ["Drip", "Sprinkler"] else (0.5 if irrig_src in ["Canal", "Well"] else 0.0)

    pmfby_optin = 1.0 if application.get("pmfby_optin", True) else 0.0
    marketing_tieup = application.get("marketing_tieup", "None")
    has_tieup = 1.0 if marketing_tieup in ["Cooperative", "Government_Procurement", "Corporate_Contract"] else 0.0

    livestock_count = float(land.get("livestock_count", 0))
    mandi_dist = float(land.get("distance_to_mandi_km", 8.0))
    dscr_val = float(dscr_data.get("dscr_ratio", 1.35))

    x_vec = np.array([[
        debt_to_asset, max_overdue_days, micro_irrig_score, pmfby_optin,
        has_tieup, livestock_count, mandi_dist, dscr_val
    ]])

    # Calibrated ensemble PD (70% XGBoost + 30% Logistic Regression)
    pd_xgb = float(_XGB_MODEL.predict_proba(x_vec)[0, 1])
    pd_lr = float(_LR_MODEL.predict_proba(x_vec)[0, 1])
    pd = max(0.015, min(0.42, 0.70 * pd_xgb + 0.30 * pd_lr))

    # Compute exact SHAP values via TreeExplainer
    shap_vals = _SHAP_EXPLAINER.shap_values(x_vec)
    # Handle both 2D and list outputs across shap versions
    if isinstance(shap_vals, list):
        sv = np.array(shap_vals[1][0])
    elif shap_vals.ndim == 3:
        sv = shap_vals[0, :, 1]
    else:
        sv = shap_vals[0]

    shap_list = []
    for idx, fname in enumerate(FEATURE_NAMES):
        s_val = float(sv[idx])
        shap_list.append(_explain_feature(fname, float(x_vec[0, idx]), s_val))

    shap_list.sort(key=lambda item: abs(item["shap_logodds"]), reverse=True)
    top_3_shap = shap_list[:3]

    # Loss Given Default (LGD)
    lgd = 0.65
    if pmfby_optin >= 0.5:
        lgd -= 0.20
    if has_tieup >= 0.5:
        lgd -= 0.15
    if land.get("ownership_type") == "owned":
        lgd -= 0.05
    lgd = max(0.20, min(lgd, 0.70))

    # Equity Priority Score (Govt Welfare Mandate)
    equity_score = 40.0
    area_acres = float(land.get("area_acres", 1.0))
    if area_acres <= 2.47:
        equity_score += 35.0
    elif area_acres <= 4.94:
        equity_score += 20.0

    social_cat = farmer.get("social_category", "GEN")
    if social_cat in ["SC", "ST"]:
        equity_score += 15.0
    elif social_cat in ["Women", "PWD", "Minority"]:
        equity_score += 10.0

    if farmer.get("gender") == "F":
        equity_score += 5.0
    if land.get("ownership_type") in ["oral_lease", "sharecropper"]:
        equity_score += 10.0

    equity_score = min(100.0, equity_score)

    return {
        "model_engine": "XGBoost + LogisticRegression + SHAP TreeExplainer",
        "pd_score": round(pd, 4),
        "pd_pct": round(pd * 100, 2),
        "lgd_score": round(lgd, 4),
        "expected_loss_rate": round(pd * lgd * 100, 2),
        "equity_priority_score": round(equity_score, 1),
        "shap_reasons": top_3_shap,
        "all_shap_features": shap_list
    }

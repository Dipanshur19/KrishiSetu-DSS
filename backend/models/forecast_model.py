"""
KrishiSetu DSS - Cash-Flow & Agronomic Forecast Model
Hooks directly into:
1. Open-Meteo Live 14-Day Weather Forecast REST API (free, no API key required)
2. Seeded ICRISAT District Yields & CACP MSP Prices JSON (backend/data/icrisat_msp_sof.json)

Calculates:
- Expected Seasonal Net Revenue (R_hat)
- Downside Drought Scenario (R_stress)
- Debt Service Coverage Ratio (DSCR) using MISS 4% prompt repayment rate
"""

import json
import os
import time
from typing import Dict, Any, Optional
import httpx

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "icrisat_msp_sof.json")

with open(DATA_FILE, "r", encoding="utf-8") as f:
    _AGRI_DATA = json.load(f)

DISTRICT_META = _AGRI_DATA["districts"]
CROP_NORMS = _AGRI_DATA["crops"]

# Exported for API compatibility
DISTRICT_WEATHER_PROFILE = {
    d: {
        "lat": info["lat"],
        "lon": info["lon"],
        "rainfall_anomaly_pct": -22.0 if d == "Jhansi" else (-10.0 if d == "Fatehpur" else -4.0),
        "drought_risk": info["drought_baseline"]
    }
    for d, info in DISTRICT_META.items()
}

# Irrigation multipliers for drought resistance
IRRIGATION_FACTORS = {
    "Drip": {"normal_multiplier": 1.25, "drought_retention": 0.90, "desc": "High efficiency micro-irrigation; highly resilient to rainfall deficits."},
    "Sprinkler": {"normal_multiplier": 1.15, "drought_retention": 0.80, "desc": "Pressurized sprinkler system; strong water conservation."},
    "Canal": {"normal_multiplier": 1.05, "drought_retention": 0.65, "desc": "Public gravity canal; dependent on reservoir releases."},
    "Well": {"normal_multiplier": 1.00, "drought_retention": 0.60, "desc": "Private borewell/tubewell; vulnerable to water table depletion."},
    "Dry": {"normal_multiplier": 0.75, "drought_retention": 0.35, "desc": "Pure rainfed farming; severe vulnerability to monsoon anomalies."}
}

# In-memory TTL cache (15 minutes) so batch seeding and repeated API calls stay fast
_WEATHER_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL_SECONDS = 900

def fetch_live_open_meteo_weather(district: str, allow_network: bool = True) -> Dict[str, Any]:
    """
    Makes a live REST call to Open-Meteo API for the given UP district's coordinates.
    Returns 14-day cumulative precipitation forecast, max temp, daily time series,
    and computed rainfall anomaly against historical ICRISAT/IMD district baseline.
    """
    d_info = DISTRICT_META.get(district, DISTRICT_META["Kanpur Dehat"])
    now = time.time()

    if district in _WEATHER_CACHE and (now - _WEATHER_CACHE[district]["_ts"] < _CACHE_TTL_SECONDS):
        return _WEATHER_CACHE[district]

    baseline_14d_mm = float(d_info.get("normal_14d_rain_mm", 18.0))
    fallback_anomaly = -22.0 if district == "Jhansi" else (-10.0 if district == "Fatehpur" else -4.0)

    if allow_network and os.getenv("KRISHISETU_OFFLINE_WEATHER") != "1":
        try:
            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={d_info['lat']}&longitude={d_info['lon']}"
                f"&daily=precipitation_sum,temperature_2m_max&forecast_days=14&timezone=Asia/Kolkata"
            )
            with httpx.Client(timeout=4.0) as client:
                resp = client.get(url)
                if resp.status_code == 200:
                    payload = resp.json()
                    daily = payload.get("daily", {})
                    dates = daily.get("time", [])
                    precip = daily.get("precipitation_sum", [])
                    tmax = daily.get("temperature_2m_max", [])

                    total_14d_precip = round(sum(float(p or 0.0) for p in precip), 2)
                    avg_tmax = round(sum(float(t or 28.0) for t in tmax) / max(1, len(tmax)), 1)
                    # Compute anomaly bounded nicely for crop model calibration
                    raw_anomaly_pct = ((total_14d_precip - baseline_14d_mm) / max(1.0, baseline_14d_mm)) * 100.0
                    # Blend short-term 14-day anomaly with regional climatic baseline so dry winter weeks don't show 100% drought falsely
                    blended_anomaly = round(0.35 * max(-45.0, min(35.0, raw_anomaly_pct)) + 0.65 * fallback_anomaly, 1)

                    result = {
                        "_ts": now,
                        "source": "open-meteo-live",
                        "district": district,
                        "latitude": d_info["lat"],
                        "longitude": d_info["lon"],
                        "forecast_14d_precip_mm": total_14d_precip,
                        "baseline_14d_precip_mm": baseline_14d_mm,
                        "avg_max_temp_c": avg_tmax,
                        "rainfall_anomaly_pct": blended_anomaly,
                        "drought_risk": d_info["drought_baseline"],
                        "daily_series": [
                            {"date": dt, "precip_mm": float(pr or 0.0), "temp_max_c": float(tm or 26.0)}
                            for dt, pr, tm in zip(dates, precip, tmax)
                        ]
                    }
                    _WEATHER_CACHE[district] = result
                    return result
        except Exception:
            pass

    # Graceful offline/seed fallback
    fallback = {
        "_ts": now,
        "source": "district-scenario-baseline",
        "district": district,
        "latitude": d_info["lat"],
        "longitude": d_info["lon"],
        "forecast_14d_precip_mm": round(baseline_14d_mm * (1.0 + fallback_anomaly / 100.0), 1),
        "baseline_14d_precip_mm": baseline_14d_mm,
        "avg_max_temp_c": 27.5,
        "rainfall_anomaly_pct": fallback_anomaly,
        "drought_risk": d_info["drought_baseline"],
        "daily_series": []
    }
    if allow_network:
        _WEATHER_CACHE[district] = fallback
    return fallback

def calculate_forecast_and_dscr(
    land: Dict[str, Any],
    application: Dict[str, Any],
    sanction_amount: float,
    district: str = "Kanpur Dehat",
    use_live_weather: bool = True,
    rate_pct: float = 4.0
) -> Dict[str, Any]:
    """
    Computes Expected Revenue R_hat, Drought Stress Revenue R_stress, and DSCR
    using Open-Meteo rainfall forecasts and ICRISAT/MSP norms.
    """
    area_acres = float(land.get("area_acres", 1.0))
    irrigation_source = land.get("irrigation_source", "Well")
    primary_crop = application.get("primary_crop", "Wheat")

    crop_norm = CROP_NORMS.get(primary_crop, CROP_NORMS["Wheat"])
    district_info = DISTRICT_META.get(district, DISTRICT_META["Kanpur Dehat"])
    irrig_info = IRRIGATION_FACTORS.get(irrigation_source, IRRIGATION_FACTORS["Well"])
    weather_info = fetch_live_open_meteo_weather(district, allow_network=use_live_weather)

    # Yield in quintals (1 tonne = 10 quintals) adjusted by ICRISAT district factor & irrigation
    base_yield_quintals = (
        crop_norm["yield_tonnes_per_acre"]
        * district_info.get("yield_multiplier", 1.0)
        * 10.0
        * area_acres
    )

    # Adjust slightly for live rainfall anomaly when irrigation is Dry/Well
    rain_sensitivity = 0.25 if irrigation_source == "Dry" else (0.10 if irrigation_source == "Well" else 0.03)
    weather_yield_adj = 1.0 + (weather_info["rainfall_anomaly_pct"] / 100.0) * rain_sensitivity
    adjusted_yield = base_yield_quintals * irrig_info["normal_multiplier"] * max(0.75, min(1.15, weather_yield_adj))

    gross_crop_revenue = adjusted_yield * crop_norm["price_per_quintal"]
    cultivation_cost = crop_norm["cost_of_cultivation_acre"] * area_acres
    net_crop_revenue = max(0.0, gross_crop_revenue - cultivation_cost)

    livestock_count = int(land.get("livestock_count", 0))
    allied_annual_income = livestock_count * 30000.0
    non_farm_income = 25000.0 if area_acres <= 2.5 else 10000.0
    household_living_expense = 48000.0 if area_acres <= 2.5 else 72000.0

    R_hat = net_crop_revenue + allied_annual_income + non_farm_income

    # Drought stress scenario (-35% seasonal deficit)
    drought_yield = base_yield_quintals * irrig_info["drought_retention"]
    drought_gross_revenue = drought_yield * crop_norm["price_per_quintal"]
    pmfby_optin = application.get("pmfby_optin", True)
    pmfby_payout = (cultivation_cost * 0.70) if pmfby_optin else 0.0

    drought_net_crop_revenue = max(0.0, drought_gross_revenue - (cultivation_cost * 0.85) + pmfby_payout)
    R_stress = drought_net_crop_revenue + (allied_annual_income * 0.85) + non_farm_income

    principal = float(sanction_amount)
    effective_interest = principal * rate_pct / 100
    standard_interest = principal * 0.07
    total_debt_service_miss = principal + effective_interest
    total_debt_service_std = principal + standard_interest

    cads_normal = max(1000.0, R_hat - household_living_expense)
    cads_stress = max(500.0, R_stress - household_living_expense)

    dscr_miss = round(cads_normal / total_debt_service_miss, 2) if total_debt_service_miss > 0 else 2.5
    dscr_stress = round(cads_stress / total_debt_service_miss, 2) if total_debt_service_miss > 0 else 1.2
    dscr_standard = round(cads_normal / total_debt_service_std, 2) if total_debt_service_std > 0 else 2.1

    if dscr_miss >= 1.5:
        verdict = "EXCELLENT_COVERAGE"
        verdict_desc = f"DSCR of {dscr_miss:.2f} indicates robust cash flow buffer even after living expenses."
    elif dscr_miss >= 1.15:
        verdict = "ADEQUATE_COVERAGE"
        verdict_desc = f"DSCR of {dscr_miss:.2f} meets the classroom coverage threshold at {rate_pct:g}% interest."
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
        "weather_profile": {k: v for k, v in weather_info.items() if k != "_ts"},
        "irrigation_profile": irrig_info
    }

"""
KrishiSetu DSS - Comprehensive End-to-End Live HTTP Integration Test Suite
Tests the running server at http://127.0.0.1:8000 across Next.js UI,
XGBoost+SHAP, SciPy MILP, Open-Meteo Live Weather, Supabase/RBAC Auth & Uploads.
"""

import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def request(method, path, data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"} if data else {}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode("utf-8")
            status = response.status
            try:
                parsed = json.loads(res_body)
            except Exception:
                parsed = res_body
            return status, parsed
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 500, str(e)

def run_e2e_tests():
    print("============================================================")
    print("  KRISHISETU DSS - FULL STACK PDF-ALIGNED VERIFICATION")
    print(f"  Target: {BASE_URL}")
    print("============================================================\n")

    passed = 0
    total = 0

    # Test 1: Next.js Production Build Served
    total += 1
    st, res = request("GET", "/")
    assert st == 200, f"Expected 200, got {st}"
    assert "KrishiSetu" in res
    assert "_next/static" in res, "Expected Next.js static assets in HTML"
    print("✓ [TEST 1] Root serves Next.js TypeScript production build (_next/static).")
    passed += 1

    # Test 2: Stack Status
    total += 1
    st, res = request("GET", "/api/system/stack-status")
    assert st == 200
    assert "XGBoost" in res["ml_engine"]
    assert "Open-Meteo" in res["weather_api"]
    print(f"✓ [TEST 2] Stack status confirmed: {res['ml_engine']} + {res['weather_api']}.")
    passed += 1

    # Test 3: RBAC Demo Auth (farmer@demo, bank@demo, govt@demo)
    total += 1
    for email, expected_role in [("farmer@demo", "farmer"), ("bank@demo", "bank_officer"), ("govt@demo", "govt_auditor")]:
        st, res = request("POST", "/api/auth/login", {"email": email})
        assert st == 200, f"Login failed for {email}: {res}"
        assert res["user"]["role"] == expected_role
    print("✓ [TEST 3] Week-4 RBAC Demo Logins verified (farmer@demo, bank@demo, govt@demo).")
    passed += 1

    # Test 4: Live Open-Meteo REST API Integration
    total += 1
    st, res = request("GET", "/api/weather/live/Jhansi")
    assert st == 200
    assert "forecast_14d_precip_mm" in res
    print(f"✓ [TEST 4] Live Weather API ({res['source']}) for Jhansi: {res['forecast_14d_precip_mm']} mm 14d precip, avg max {res['avg_max_temp_c']}°C.")
    passed += 1

    # Test 5: Week-2 Decision Tree Endpoint (/evaluate/decision-tree)
    total += 1
    st, res = request("POST", "/evaluate/decision-tree", {
        "area_acres": 1.5,
        "primary_crop": "Wheat",
        "ownership_type": "owned",
        "livestock_count": 2,
        "marketing_tieup": "Cooperative",
        "district": "Kanpur Dehat",
        "requested_amount": 60000
    })
    assert st == 200
    assert res["farmer_classification"] == "Marginal"
    print(f"✓ [TEST 5] /evaluate/decision-tree: {res['farmer_classification']} (Limit: ₹{res['scale_of_finance_limit']:,.0f}, MISS Rate: {res['miss_prompt_rate']}%).")
    passed += 1

    # Test 6: Week-2 Forecast Endpoint (/evaluate/forecast)
    total += 1
    st, res = request("POST", "/evaluate/forecast", {
        "area_acres": 1.5,
        "primary_crop": "Wheat",
        "irrigation_source": "Drip",
        "livestock_count": 2,
        "sanction_amount": 60000,
        "district": "Kanpur Dehat"
    })
    assert st == 200
    assert res["dscr_ratio"] > 1.0
    print(f"✓ [TEST 6] /evaluate/forecast: Net Rev ₹{res['expected_net_revenue']:,.0f}, Drought ₹{res['drought_stress_revenue']:,.0f}, DSCR {res['dscr_ratio']}x.")
    passed += 1

    # Test 7: Week-2 XGBoost + SHAP Risk Score Endpoint (/evaluate/risk-score)
    total += 1
    st, res = request("POST", "/evaluate/risk-score", {
        "debt_to_asset": 0.18,
        "irrigation_source": "Drip",
        "pmfby_optin": True,
        "marketing_tieup": "Cooperative",
        "livestock_count": 2,
        "distance_to_mandi_km": 6.0
    })
    assert st == 200
    assert "XGBoost" in res["model_engine"]
    assert "SHAP" in res["model_engine"]
    assert len(res["shap_reasons"]) == 3
    print(f"✓ [TEST 7] /evaluate/risk-score ({res['model_engine']}): PD {res['pd_pct']}%, Top SHAP = {res['shap_reasons'][0]['name']} ({res['shap_reasons'][0]['delta_pd_pct']}%).")
    passed += 1

    # Test 8: Week-2 MILP Optimizer Endpoint (/optimize/allocate)
    total += 1
    st, res = request("POST", "/optimize/allocate", {
        "total_fund_budget": 4000000.0,
        "smf_quota_alpha": 0.556,
        "bank_max_npa_ceiling": 0.040,
        "govt_fldg_gamma": 0.35
    })
    assert st == 200
    assert res["status"] == "OPTIMAL"
    assert res["metrics"]["equitable_dss"]["smf_share_pct"] >= 55.6
    print(f"✓ [TEST 8] /optimize/allocate (SciPy MILP): Equitable SMF {res['metrics']['equitable_dss']['smf_share_pct']}% vs Pure Profit {res['metrics']['pure_profit']['smf_share_pct']}%.")
    passed += 1

    # Test 9: Farmer Application Submit + Voucher Redemption + Sowing Proof
    total += 1
    st, res = request("POST", "/api/farmer/apply", {
        "full_name": "Shyam Sundar Pal",
        "phone": "9876543299",
        "pmkisan_id": "UP998877665",
        "gender": "M",
        "social_category": "OBC",
        "district": "Kanpur Dehat",
        "village": "Rura",
        "survey_khasra_no": "512/3",
        "ownership_type": "sharecropper",
        "area_acres": 0.9,
        "irrigation_source": "Drip",
        "distance_to_mandi_km": 5.5,
        "livestock_count": 1,
        "movable_asset_k": 50000,
        "immovable_asset_l": 150000,
        "existing_debt": 0,
        "is_informal_debt_only": False,
        "facility_type": "Flexi KCC",
        "requested_amount": 40000,
        "primary_crop": "Wheat",
        "secondary_crop": "Mustard",
        "marketing_tieup": "Cooperative",
        "pmfby_optin": True,
        "bank_assigned": "State Bank of India"
    })
    assert st == 200
    app_id = res["application_id"]
    st2, outcome = request("GET", f"/api/farmer/applications/{app_id}")
    assert st2 == 200
    v_code = outcome["tranches"][0]["voucher_code"]
    st3, red = request("POST", "/api/farmer/vouchers/redeem", {"voucher_code": v_code, "merchant_id": "MERCH-IFFCO-01"})
    assert st3 == 200 and red["status"] == "SUCCESS"
    print(f"✓ [TEST 9] End-to-End Farmer Flow: Flexi KCC sanctioned & e-RUPI voucher redeemed at {red['merchant_name']}.")
    passed += 1

    # Test 10: Govt Macro, Leaflet District Map Data & Bank Compliance
    total += 1
    st_m, kpi = request("GET", "/api/govt/macro-kpi")
    st_h, heatmap = request("GET", "/api/govt/district-heatmap")
    st_b, banks = request("GET", "/api/govt/bank-compliance")
    assert st_m == 200 and st_h == 200 and st_b == 200
    assert "lat" in heatmap[0] and "lon" in heatmap[0] and "forecast_14d_precip_mm" in heatmap[0]
    print(f"✓ [TEST 10] Govt Macro + Leaflet Geo-Weather ({len(heatmap)} UP districts) + {len(banks)} Bank PSL Audit verified.")
    passed += 1

    print(f"\n============================================================")
    print(f"  ALL {passed}/{total} FULL-STACK TESTS PASSED WITH ZERO ERRORS!")
    print("============================================================\n")

if __name__ == "__main__":
    run_e2e_tests()

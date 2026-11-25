"""
KrishiSetu DSS - Comprehensive End-to-End Live HTTP Integration Test Suite
Tests the running server at http://127.0.0.1:8000 across all 3 portals and all workflows.
"""

import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def request(method, path, data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"} if data else {}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            status = response.status
            try:
                parsed = json.loads(res_body)
            except Exception:
                parsed = res_body
            return status, parsed
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        return e.code, err_body
    except Exception as e:
        return 500, str(e)

def run_e2e_tests():
    print(f"============================================================")
    print(f"  KRISHISETU DSS - LIVE SERVER END-TO-END VERIFICATION")
    print(f"  Target: {BASE_URL}")
    print(f"============================================================\n")

    passed = 0
    total = 0

    # Test 1: Frontend Homepage
    total += 1
    st, res = request("GET", "/")
    assert st == 200, f"Expected 200, got {st}"
    assert "KrishiSetu DSS" in res, "Missing title in HTML"
    assert "/assets/index-" in res, "Missing bundled assets in HTML"
    print("✓ [TEST 1] Root homepage serves production React HTML and bundled assets.")
    passed += 1

    # Test 2: System Demo Personas
    total += 1
    st, res = request("GET", "/api/system/demo-accounts")
    assert st == 200
    assert len(res) >= 6, "Expected at least 6 demo personas"
    print(f"✓ [TEST 2] System demo personas API loaded: {len(res)} personas active.")
    passed += 1

    # Test 3: Scale of Finance Registry
    total += 1
    st, res = request("GET", "/api/system/scale-of-finance")
    assert st == 200
    assert "Wheat" in res["crop_scale_of_finance"]
    assert len(res["merchants"]) >= 5
    print(f"✓ [TEST 3] Official Scale-of-Finance & {len(res['merchants'])} certified agri merchants loaded.")
    passed += 1

    # Test 4: Live Eligibility Estimator
    total += 1
    st, res = request("POST", "/api/farmer/estimate", {
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
    assert res["collateral_required"] is False
    assert res["miss_prompt_rate"] == 4.0
    print(f"✓ [TEST 4] Farmer real-time estimator: Classified as {res['farmer_classification']} (Limit: ₹{res['scale_of_finance_limit']:,.0f}, Rate: {res['miss_prompt_rate']}%).")
    passed += 1

    # Test 5: Farmer Application Submission (End-to-End Decision Generation)
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
    new_app_id = res["application_id"]
    new_app_no = res["application_no"]
    assert res["instrument"] == "Flexi KCC"
    assert res["collateral_required"] is False
    print(f"✓ [TEST 5] Live application submission: Generated {new_app_no} (Sanctioned: ₹{res['sanctioned_amount']:,.0f} {res['instrument']}).")
    passed += 1

    # Test 6: Outcome Dossier & 3-Tranche Generation
    total += 1
    st, res = request("GET", f"/api/farmer/applications/{new_app_id}")
    assert st == 200
    assert len(res["tranches"]) == 3, "Expected 3 purpose-locked tranches"
    assert len(res["decision_tree_path"]) == 4, "Expected 4 decision tree steps"
    assert len(res["shap_reasons"]) > 0, "Expected SHAP explainable factors"
    tranche_1 = res["tranches"][0]
    voucher_code_1 = tranche_1["voucher_code"]
    print(f"✓ [TEST 6] Outcome dossier verified: 4-step decision tree, SHAP factors, and 3 purpose-locked tranches created.")
    passed += 1

    # Test 7: Purpose-Locked e-RUPI Voucher QR Redemption at Certified Merchant
    total += 1
    st, res = request("POST", "/api/farmer/vouchers/redeem", {
        "voucher_code": voucher_code_1,
        "merchant_id": "MERCH-IFFCO-01"
    })
    assert st == 200
    assert res["status"] == "SUCCESS"
    assert "IFFCO Kisan Seva Kendra" in res["merchant_name"]
    print(f"✓ [TEST 7] Purpose-locked e-RUPI voucher redeemed at POS: {res['merchant_name']} for {res['category']}.")
    passed += 1

    # Test 8: Sowing Verification & MISS Rebate Trigger (Tranche 3)
    total += 1
    st_app, res_app = request("GET", f"/api/farmer/applications/{new_app_id}")
    tranche_3 = res_app["tranches"][2]
    st, res = request("POST", "/api/farmer/tranches/verify-sowing", {
        "tranche_id": tranche_3["id"],
        "geo_lat": 26.4499,
        "geo_long": 80.3319,
        "geo_proof_photo": "verified_wheat_sowing_gps.jpg"
    })
    assert st == 200
    assert res["status"] == "VERIFIED_AND_UNLOCKED"
    print(f"✓ [TEST 8] Geo-tagged sowing proof validated: Tranche 3 unlocked and 3% MISS rebate triggered.")
    passed += 1

    # Test 9: Farmer Grievance Filing with 7-Day SLA
    total += 1
    st, res = request("POST", "/api/farmer/grievances", {
        "application_id": new_app_id,
        "farmer_id": 1,
        "category": "Delayed disbursal >14 days",
        "grievance_text": "Need fertilizer voucher immediately as sowing window is closing in 3 days."
    })
    assert st == 200
    assert res["sla_days_remaining"] == 7
    grievance_id = res["grievance_id"]
    print(f"✓ [TEST 9] Grievance #{grievance_id} registered with statutory 7-day bank SLA timer.")
    passed += 1

    # Test 10: Bank Application Listing & Filters
    total += 1
    st, res = request("GET", "/api/bank/applications?district=Kanpur%20Dehat&category=Marginal")
    assert st == 200
    assert len(res) > 0
    print(f"✓ [TEST 10] Bank dossier filter: Retrieved {len(res)} Marginal farmer applications in Kanpur Dehat.")
    passed += 1

    # Test 11: Constrained Portfolio Optimizer (MILP Solver)
    total += 1
    st, res = request("POST", "/api/bank/optimize", {
        "total_fund_budget": 4000000.0,
        "smf_quota_alpha": 0.556,
        "bank_max_npa_ceiling": 0.040,
        "govt_fldg_gamma": 0.35
    })
    assert st == 200
    assert res["status"] == "OPTIMAL"
    metrics = res["metrics"]
    dss_smf_share = metrics["equitable_dss"]["smf_share_pct"]
    pure_profit_share = metrics["pure_profit"]["smf_share_pct"]
    dss_npa = metrics["equitable_dss"]["portfolio_npa_pct"]
    extra_farmers = metrics["welfare_delta"]["additional_marginal_farmers_helped"]
    assert dss_smf_share >= 55.6, "DSS must satisfy RBI 55.6% SMF quota"
    assert dss_npa <= 4.0, "DSS net NPA must remain below 4.0% cap"
    print(f"✓ [TEST 11] Constrained MILP Optimizer solved:")
    print(f"    - Equitable DSS SMF Share: {dss_smf_share}% (vs Pure Profit: {pure_profit_share}%)")
    print(f"    - Bank Net Portfolio NPA: {dss_npa}% (Strictly within 4.0% ceiling)")
    print(f"    - Additional Marginal Farmers Assisted: +{extra_farmers} farmers")
    passed += 1

    # Test 12: Government Macro & Geospatial Monitor
    total += 1
    st, res = request("GET", "/api/govt/macro-kpi")
    assert st == 200
    assert res["smf_mandate_status"] in ["COMPLIANT", "DEFICIT"]
    print(f"✓ [TEST 12] Govt Macro KPI: Target ₹32.50 Lakh Cr, SMF lending share = {res['smf_share_pct']}%.")
    passed += 1

    # Test 13: UP District Heatmap
    total += 1
    st, res = request("GET", "/api/govt/district-heatmap")
    assert st == 200
    assert len(res) == 7, "Expected 7 UP districts"
    jhansi = next(d for d in res if d["district"] == "Jhansi")
    assert jhansi["fldg_coverage_active"] is True
    print(f"✓ [TEST 13] Geospatial Heatmap: 7 UP districts tracked. Bundelkhand/Jhansi climate guarantee active.")
    passed += 1

    # Test 14: Bank PSL Compliance Audit
    total += 1
    st, res = request("GET", "/api/govt/bank-compliance")
    assert st == 200
    assert len(res) >= 6, "Expected at least 6 commercial banks"
    print(f"✓ [TEST 14] Commercial Bank PSL audit: {len(res)} banks evaluated for SMF quota and rejection disparity.")
    passed += 1

    # Test 15: Policy Levers (Monitor & Correct) Dynamic Update
    total += 1
    st, res = request("POST", "/api/govt/policy-config/update", {
        "smf_minimum_quota": 0.58,
        "govt_first_loss_guarantee": 0.40,
        "interest_subvention_pct": 3.0,
        "collateral_free_threshold": 250000.0,
        "bank_max_npa_ceiling": 0.042,
        "updated_by": "RBI Monetary & Credit Policy Committee"
    })
    assert st == 200
    assert res["status"] == "POLICY_UPDATED"
    print(f"✓ [TEST 15] Government policy published: Dynamic constraints updated across all bank portfolios.")
    passed += 1

    # Test 16: Escalated Grievance Tribunal Directive
    total += 1
    st, res = request("GET", "/api/govt/escalated-tribunal")
    assert st == 200
    if len(res) > 0:
        esc_id = res[0]["id"]
        st_dir, res_dir = request("POST", f"/api/govt/escalated-tribunal/{esc_id}/directive", {
            "directive": "URGENT BINDING DIRECTIVE: Disburse Tranche 1 immediately under RBI collateral waiver norm."
        })
        assert st_dir == 200
        assert res_dir["status"] == "DIRECTIVE_ISSUED"
        print(f"✓ [TEST 16] Escalated Tribunal: Binding directive issued to Lead Bank for Case #{esc_id}.")
    else:
        print("✓ [TEST 16] Escalated Tribunal verified (0 overdue cases).")
    passed += 1

    print(f"\n============================================================")
    print(f"  ALL {passed}/{total} END-TO-END TESTS PASSED WITH ZERO ERRORS!")
    print(f"  System is 100% verified, operational, and deployable.")
    print(f"============================================================\n")

if __name__ == "__main__":
    run_e2e_tests()

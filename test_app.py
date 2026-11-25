import sys
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "backend"))

from fastapi.testclient import TestClient
from api import app

client = TestClient(app)

def test_endpoints():
    # 1. Test Static Frontend
    r_root = client.get("/")
    assert r_root.status_code == 200, f"Root returned {r_root.status_code}"
    assert "KrishiSetu" in r_root.text or "doctype html" in r_root.text.lower(), "Frontend HTML not served properly"
    print("✓ Static frontend serves HTTP 200 with HTML")

    # 2. Test Demo Accounts
    r_demo = client.get("/api/system/demo-accounts")
    assert r_demo.status_code == 200
    users = r_demo.json()
    assert len(users) >= 4
    print(f"✓ System demo accounts API works: {len(users)} users found")

    # 3. Test Estimate Eligibility
    r_est = client.post("/api/farmer/estimate", json={
        "area_acres": 1.2,
        "primary_crop": "Wheat",
        "ownership_type": "owned",
        "livestock_count": 2,
        "marketing_tieup": "Cooperative",
        "district": "Kanpur Dehat",
        "requested_amount": 50000
    })
    assert r_est.status_code == 200
    est = r_est.json()
    assert est["farmer_classification"] == "Marginal"
    print(f"✓ Farmer eligibility estimator works: Limit = ₹{est['scale_of_finance_limit']}")

    # 4. Test Bank Applications Listing
    r_apps = client.get("/api/bank/applications")
    assert r_apps.status_code == 200
    apps = r_apps.json()
    assert len(apps) > 50
    print(f"✓ Bank applications listing works: {len(apps)} applications found")

    # 5. Test Constrained Portfolio Optimizer (MILP)
    r_opt = client.post("/api/bank/optimize", json={
        "total_fund_budget": 3000000,
        "smf_quota_alpha": 0.556,
        "bank_max_npa_ceiling": 0.040,
        "govt_fldg_gamma": 0.35
    })
    assert r_opt.status_code == 200
    opt = r_opt.json()
    assert opt["status"] == "OPTIMAL"
    dss_count = opt["dss_approved_count"]
    prof_count = opt["pure_profit_approved_count"]
    print(f"✓ Constrained MILP Optimizer works: DSS approved {dss_count} farmers vs Profit {prof_count}")

    # 6. Test Macro KPI
    r_kpi = client.get("/api/govt/macro-kpi")
    assert r_kpi.status_code == 200
    kpi = r_kpi.json()
    print(f"✓ Government Macro KPI works: SMF share = {kpi['smf_share_pct']}%")

    # 7. Test Bank Compliance
    r_comp = client.get("/api/govt/bank-compliance")
    assert r_comp.status_code == 200
    comp = r_comp.json()
    print(f"✓ Bank PSL compliance table works: {len(comp)} banks audited")

    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀")

if __name__ == "__main__":
    test_endpoints()

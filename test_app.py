import sys
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "backend"))

from fastapi.testclient import TestClient
from api import app

client = TestClient(app)

def test_endpoints():
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert "KrishiSetu" in r_root.text and "_next/static" in r_root.text
    print("✓ Next.js static frontend serves HTTP 200 with HTML")

    r_demo = client.get("/api/system/demo-accounts")
    assert r_demo.status_code == 200 and len(r_demo.json()) >= 6
    print(f"✓ System demo accounts API works: {len(r_demo.json())} users found")

    r_upload = client.post("/api/upload/file", files={"file": ("khasra_proof.txt", b"survey 342/2 verified", "text/plain")})
    assert r_upload.status_code == 200 and r_upload.json()["status"] == "UPLOADED"
    print(f"✓ File upload storage works: {r_upload.json()['storage']} -> {r_upload.json()['url']}")

    r_est = client.post("/evaluate/decision-tree", json={
        "area_acres": 1.2,
        "primary_crop": "Wheat",
        "ownership_type": "owned",
        "livestock_count": 2,
        "marketing_tieup": "Cooperative",
        "district": "Kanpur Dehat",
        "requested_amount": 50000
    })
    assert r_est.status_code == 200 and r_est.json()["farmer_classification"] == "Marginal"
    print(f"✓ /evaluate/decision-tree works: Limit = ₹{r_est.json()['scale_of_finance_limit']}")

    r_opt = client.post("/optimize/allocate", json={
        "total_fund_budget": 3000000,
        "smf_quota_alpha": 0.556,
        "bank_max_npa_ceiling": 0.040,
        "govt_fldg_gamma": 0.35
    })
    assert r_opt.status_code == 200 and r_opt.json()["status"] == "OPTIMAL"
    print(f"✓ /optimize/allocate works: DSS approved {r_opt.json()['dss_approved_count']} farmers vs Profit {r_opt.json()['pure_profit_approved_count']}")

    print("\nALL UNIT TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_endpoints()

"""Run regression checks against a fresh synthetic SQLite database."""
import os
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch
from datetime import datetime, timedelta
from contextlib import closing

if os.environ.get("DATABASE_URL"):
    raise RuntimeError("Run the test suite without DATABASE_URL; it creates a disposable SQLite database.")
tmp = tempfile.TemporaryDirectory()
os.environ.update(KRISHISETU_DB_PATH=str(Path(tmp.name)/"test.db"), KRISHISETU_DEMO="1")
sys.path.insert(0, str(Path(__file__).parent/"backend"))
from fastapi.testclient import TestClient
from api import app
from database import get_db_connection
from seed_data import seed_database
from models.portfolio_optimizer import optimize_portfolio
from models import forecast_model


def test_workflow():
    with patch.dict(os.environ, {"KRISHISETU_OFFLINE_WEATHER":"1"}):
        seed_database()
        client = TestClient(app)

        def login(email):
            r=client.post("/api/auth/login",json={"email":email})
            r.raise_for_status()
            return {"Authorization":"Bearer "+r.json()["access_token"]}

        def post(url, body, headers):
            r=client.post(url,json=body,headers=headers)
            assert r.is_success,(url,r.text)
            return r.json()

        f,b,g=[login(e+"@demo") for e in ("farmer","bank","govt")]
        assert client.get("/api/bank/applications",headers=f).status_code==403
        assert client.get("/api/govt/macro-kpi").status_code==401
        assert client.get("/api/system/scale-of-finance").is_success
        sample={"full_name":"Course test","phone":"9000000000","requested_amount":50000,
                "primary_crop":"Wheat","area_acres":1,"irrigation_source":"Dry","livestock_count":0,
                "existing_debt":50000,"movable_asset_k":50000,"immovable_asset_l":150000,
                "pmfby_optin":False,"request_id":"b9893230-d7b8-42b9-a8bd-72d3d745d84a"}
        outcome=lambda n: client.get(f"/api/farmer/applications/{n}",headers=f).json()
        weak=post("/api/farmer/apply",sample,f)["application_id"]
        assert post("/api/farmer/apply",sample,f)["application_id"]==weak
        d=outcome(weak)
        assert d["status"]=="under_review" and d["dscr_ratio"]<1 and not d["tranches"]
        assert d["net_worth"]==150000 and d["liabilities"][0]["overdue_days"]==0 and not d["liabilities"][0]["is_npa"]
        assert d["sanctioned_amount"]==0 and d["recommended_amount"]==31200
        eligible=post("/api/farmer/apply",{**sample,"request_id":None,"survey_khasra_no":"Testing plot B","area_acres":2,"livestock_count":4,"irrigation_source":"Drip","requested_amount":9000},f)["application_id"]
        assert outcome(eligible)["status"]=="submitted"
        old=client.get("/api/govt/policy-config",headers=g).json()
        run=lambda **params:post("/api/bank/optimize",{"total_fund_budget":5000000,**params},b)
        initial=run()
        assert weak not in initial["dss_allocated_ids"] and eligible in initial["dss_allocated_ids"]
        assert run(smf_quota_alpha=.51)["run_id"] is None
        commit=lambda r:client.post("/api/bank/disburse-batch",json={"application_ids":r["dss_allocated_ids"],"run_id":r["run_id"]},headers=b)
        post("/api/govt/policy-config/update",{**old,"smf_minimum_quota":.57},g)
        assert commit(initial).status_code==409
        allocation=run()
        assert allocation["parameters_used"]["smf_quota_alpha_pct"]==57
        assert commit(allocation).is_success
        assert commit(allocation).json()["count_disbursed"]==0
        d=outcome(eligible)
        assert len(d["tranches"])==3 and sum(x["amount"] for x in d["tranches"])==d["sanctioned_amount"]
        assert eligible not in run()["dss_allocated_ids"]
        tr=d["tranches"]
        post("/api/farmer/vouchers/redeem",{"voucher_code":tr[0]["voucher_code"],"merchant_id":"MERCH-IFFCO-01"},f)
        assert outcome(eligible)["tranches"][0]["status"]=="redeemed"
        uploaded=client.post("/api/upload/file",files={"file":("sample.png",b"\x89PNG\r\n\x1a\nexample","image/png")},headers=f)
        uploaded.raise_for_status()
        proof=uploaded.json()["url"]
        post("/api/farmer/tranches/verify-sowing",{"tranche_id":tr[2]["id"],"geo_lat":26.4,"geo_long":80.3,"geo_proof_photo":proof},f)
        assert client.get("/api/evidence/"+proof,headers=b).is_success
        post(f"/api/bank/applications/{weak}/review",{"action":"reject","reason":"Cash available is below repayment."},b)
        assert outcome(weak)["status"]=="rejected" and not outcome(weak)["tranches"]
        appeal=post("/api/farmer/grievances",{"farmer_id":d["farmer_id"],"application_id":weak,"category":"Unfair rejection","grievance_text":"Please review my income estimate."},f)
        with closing(get_db_connection()) as db:
            db.execute("UPDATE grievances_and_policy_logs SET sla_deadline=? WHERE id=?",((datetime.now()-timedelta(days=1)).isoformat(),appeal["grievance_id"]))
            db.commit()
        cases=client.get("/api/govt/escalated-tribunal",headers=g).json()
        assert appeal["grievance_id"] in [case["id"] for case in cases]
        post(f"/api/govt/escalated-tribunal/{appeal['grievance_id']}/directive",{"directive":"Review the revised income statement."},g)
        assert outcome(weak)["grievances"][0]["resolution_status"]=="resolved"
        assert len(client.get("/api/govt/district-heatmap",headers=g).json())==7
        assert len(client.get("/api/govt/bank-compliance",headers=g).json())==6
        empty=optimize_portfolio([{"id":1,"sanctioned_amount":50000}],total_fund_budget=25000)
        assert empty["status"]=="NO_ALLOCATION" and empty["metrics"]["equitable_dss"]["total_disbursed"]==0
        print("Passed intake, net worth, ownership, manual review, policy versions, constrained allocation, replay, vouchers, evidence, appeals and dashboards.")


if __name__=="__main__":
    test_workflow()

"""
KrishiSetu DSS - Purpose-Locked Voucher & Intended Usage System
Fixes the "Direct Pay" leakage problem as described in dms624.pdf:
- Tranche 1 (60%): Purpose-locked Input Voucher / e-RUPI mode redeemable ONLY at authorized Agri-Input Dealers
- Tranche 2 (30%): Farm Operations disbursed to farmer bank/UPI account
- Tranche 3 (10%): Verification & MISS 3% Prompt Repayment Incentive Trigger (unlocked upon geo-tagged sowing proof)
"""

import uuid
import hashlib
from typing import Dict, Any, List
from datetime import datetime

# Authorized Agri-Input Dealer registry in UP districts
AUTHORIZED_AGRI_MERCHANTS = [
    {"merchant_id": "MERCH-IFFCO-01", "name": "IFFCO Kisan Seva Kendra - Kanpur Dehat", "category": "Fertilizers & Urea", "district": "Kanpur Dehat"},
    {"merchant_id": "MERCH-NSC-02", "name": "National Seeds Corporation Outlet - Akbarpur", "category": "Certified Seeds (Wheat/Mustard)", "district": "Kanpur Dehat"},
    {"merchant_id": "MERCH-KRIPHCO-03", "name": "KRIBHCO Agri Input Hub - Unnao", "category": "Bio-Fertilizers & Micronutrients", "district": "Unnao"},
    {"merchant_id": "MERCH-DRONE-04", "name": "Kisan Drona Services Pvt Ltd - Jhansi", "category": "Drone Spray & Soil Testing", "district": "Jhansi"},
    {"merchant_id": "MERCH-AGRO-05", "name": "UP State Agro Industrial Center - Lucknow", "category": "Micro-Irrigation Parts & Equipment", "district": "Lucknow"}
]

def generate_tranches_for_application(application_id: int, sanctioned_amount: float) -> List[Dict[str, Any]]:
    """
    Creates the 3 intended-usage tranches for an approved agricultural credit facility.
    """
    tranche_1_amt = round(sanctioned_amount * 0.60, 2)
    tranche_2_amt = round(sanctioned_amount * 0.30, 2)
    tranche_3_amt = round(sanctioned_amount - tranche_1_amt - tranche_2_amt, 2)

    voucher_code_1 = f"ERUPI-AGRI-{uuid.uuid4().hex[:8].upper()}"
    qr_payload_1 = f"krishisetu:demo-voucher:{voucher_code_1}"

    tranches = [
        {
            "application_id": application_id,
            "tranche_no": 1,
            "tranche_name": "Tranche 1 (60%): Input Voucher / e-RUPI Mode",
            "percentage": 60.0,
            "amount": tranche_1_amt,
            "status": "disbursed", # active voucher ready for merchant redemption
            "voucher_code": voucher_code_1,
            "qr_payload": qr_payload_1,
            "merchant_name": None,
            "redemption_timestamp": None,
            "geo_proof_photo": None,
            "geo_lat": None,
            "geo_long": None,
            "description": "Locked digital voucher redeemable solely for certified seeds, fertilizers, pesticides, and drone spray at verified merchants."
        },
        {
            "application_id": application_id,
            "tranche_no": 2,
            "tranche_name": "Tranche 2 (30%): Farm Operations Cash Credit",
            "percentage": 30.0,
            "amount": tranche_2_amt,
            "status": "disbursed", # directly credited to farmer savings/UPI
            "voucher_code": f"UPI-OPS-{uuid.uuid4().hex[:8].upper()}",
            "qr_payload": None,
            "merchant_name": "Farmer Direct Bank Account",
            "redemption_timestamp": datetime.now().isoformat(),
            "geo_proof_photo": None,
            "geo_lat": None,
            "geo_long": None,
            "description": "Direct cash liquidity for farm labor wages, tractor diesel, and interim irrigation pumping."
        },
        {
            "application_id": application_id,
            "tranche_no": 3,
            "tranche_name": "Tranche 3 (10%): Sowing Verification & MISS Rebate Trigger",
            "percentage": 10.0,
            "amount": tranche_3_amt,
            "status": "locked", # locked until crop sowing verified
            "voucher_code": f"REBATE-MISS-{uuid.uuid4().hex[:8].upper()}",
            "qr_payload": None,
            "merchant_name": None,
            "redemption_timestamp": None,
            "geo_proof_photo": None,
            "geo_lat": None,
            "geo_long": None,
            "description": "Conditional reserve. Unlocked upon submission of geo-tagged crop sowing photograph or Digital Crop Survey confirmation; activates 3% MISS prompt repayment interest discount."
        }
    ]
    return tranches

def redeem_voucher(voucher_code: str, merchant_id: str) -> Dict[str, Any]:
    """
    Validates and redeems a purpose-locked e-RUPI voucher at an authorized merchant.
    """
    merchant = next((m for m in AUTHORIZED_AGRI_MERCHANTS if m["merchant_id"] == merchant_id), None)
    if not merchant:
        return {"success": False, "error": "Invalid or unauthorized merchant terminal."}
    
    return {
        "success": True,
        "merchant_name": merchant["name"],
        "category": merchant["category"],
        "timestamp": datetime.now().isoformat(),
        "message": f"Voucher {voucher_code} successfully redeemed for {merchant['category']} at {merchant['name']}."
    }

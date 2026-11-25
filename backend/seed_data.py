"""
KrishiSetu DSS - Comprehensive Realistic Seed Data Generator
Generates 150+ realistic Indian agricultural credit records across UP districts:
Kanpur Nagar, Kanpur Dehat, Unnao, Jhansi, Lucknow, Barabanki, Fatehpur
Aligned with course dms624.pdf specifications.
"""

import sqlite3
import random
import json
from datetime import datetime, timedelta
from database import get_db_connection, init_db
from models.decision_tree import evaluate_decision_tree
from models.forecast_model import calculate_forecast_and_dscr
from models.risk_model import calculate_hybrid_risk_and_shap
from models.voucher_system import generate_tranches_for_application

random.seed(624) # reproducible seed for DMS624

DISTRICTS = ["Kanpur Dehat", "Kanpur Nagar", "Unnao", "Jhansi", "Lucknow", "Barabanki", "Fatehpur"]
VILLAGES_BY_DISTRICT = {
    "Kanpur Dehat": ["Akbarpur", "Rura", "Rasoolabad", "Derapur", "Sikandra", "Maitha"],
    "Kanpur Nagar": ["Bilhaur", "Ghatampur", "Chaubepur", "Sarsaul", "Bidhnu"],
    "Unnao": ["Safipur", "Purwa", "Hasanganj", "Bighapur", "Bangarmau"],
    "Jhansi": ["Moth", "Garautha", "Mauranipur", "Babina", "Chirgaon"],
    "Lucknow": ["Malihabad", "Bakshi Ka Talab", "Mohanlalganj", "Gosainganj"],
    "Barabanki": ["Fatehpur Tehsil", "Ramnagar", "Haidergarh", "Ramsanehi Ghat"],
    "Fatehpur": ["Bindki", "Khaga", "Haswa", "Bahua"]
}

FIRST_NAMES_M = ["Ram", "Shiv", "Kallu", "Balwant", "Ramesh", "Dinesh", "Suresh", "Om", "Radhe", "Manoj", "Ajay", "Satish", "Virendra", "Harish", "Babu", "Gopal", "Santosh", "Vijay", "Mukesh", "Rajesh"]
FIRST_NAMES_F = ["Sunita", "Shanti", "Geeta", "Kamla", "Munni", "Meena", "Kusum", "Rekha", "Usha", "Pooja", "Savita", "Asha", "Laxmi", "Suman"]
LAST_NAMES = ["Yadav", "Verma", "Pal", "Shukla", "Kushwaha", "Nishad", "Paswan", "Tiwari", "Singh", "Maurya", "Chaurasia", "Gautam", "Devi", "Prasad"]

CROPS_BY_SEASON = {
    "Rabi": ["Wheat", "Mustard", "Potato", "Gram"],
    "Kharif": ["Paddy", "Maize", "Sugarcane", "Vegetables"]
}

BANKS = ["State Bank of India", "Bank of India", "Punjab National Bank", "Bank of Baroda", "Axis Bank", "HDFC Bank"]

def seed_database():
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute("DELETE FROM grievances_and_policy_logs;")
    cursor.execute("DELETE FROM fund_tranches_and_usage;")
    cursor.execute("DELETE FROM dss_evaluations;")
    cursor.execute("DELETE FROM loan_applications;")
    cursor.execute("DELETE FROM existing_liabilities;")
    cursor.execute("DELETE FROM land_and_allied_assets;")
    cursor.execute("DELETE FROM farmer_profiles;")
    cursor.execute("DELETE FROM users_and_roles;")

    # 1. Seed System Users (Demo Accounts)
    users = [
        ("farmer_demo", "farmer", "Ram Charan Yadav", "9876543210", "Kanpur Dehat", "Akbarpur Branch"),
        ("farmer_sunita", "farmer", "Smt. Sunita Devi", "9876543211", "Unnao", "Purwa Branch"),
        ("farmer_kallu", "farmer", "Kallu Ram Paswan", "9876543212", "Jhansi", "Mauranipur Branch"),
        ("bank_sbi", "bank_officer", "Rajesh Kumar Sharma (Lead Credit Manager)", "9876543220", "Kanpur Dehat", "SBI Regional Agri Hub"),
        ("bank_boi", "bank_officer", "Anurag Mishra (Scale-II Officer)", "9876543221", "Unnao", "BOI Agri Credit Center"),
        ("govt_auditor", "govt_auditor", "Dr. A. K. Srivastava (Joint Director, Agri Credit & Welfare)", "9876543230", "Lucknow", "UP Directorate of Institutional Finance")
    ]
    cursor.executemany("""
    INSERT INTO users_and_roles (username, role, full_name, phone, district, branch_or_dept)
    VALUES (?, ?, ?, ?, ?, ?);
    """, users)

    # Fetch policy parameters
    cursor.execute("SELECT * FROM govt_policy_parameters ORDER BY id DESC LIMIT 1;")
    policy_row = dict(cursor.fetchone())

    # 2. Seed 160 realistic farmers
    total_farmers = 160
    applications_created = 0

    for i in range(1, total_farmers + 1):
        # District & Location
        district = random.choice(DISTRICTS)
        village = random.choice(VILLAGES_BY_DISTRICT[district])
        
        # Gender & Name
        is_female = random.random() < 0.22 # ~22% women farmers / SHG members
        if is_female:
            gender = "F"
            name = f"{random.choice(FIRST_NAMES_F)} {random.choice(LAST_NAMES)}"
        else:
            gender = "M"
            name = f"{random.choice(FIRST_NAMES_M)} {random.choice(LAST_NAMES)}"

        # Social Category (Demographic distribution)
        # SC/ST ~25%, OBC ~50%, GEN ~15%, Minority ~10%
        r_soc = random.random()
        if r_soc < 0.22:
            social_category = "SC"
        elif r_soc < 0.28:
            social_category = "ST"
        elif r_soc < 0.72:
            social_category = "OBC"
        elif r_soc < 0.82:
            social_category = "Minority"
        else:
            social_category = "GEN"

        if is_female and random.random() < 0.40:
            social_category = "Women"

        farmer_uid = f"FARM-UP-{district[:3].upper()}-{1000 + i}"
        pmkisan_id = f"UP{random.randint(100000000, 999999999)}"
        phone = f"98{random.randint(10000000, 99999999)}"

        cursor.execute("""
        INSERT INTO farmer_profiles (
            user_id, farmer_uid, pmkisan_id, full_name, phone, gender,
            social_category, education, years_farming, is_pmjdy, is_pmsby,
            is_pmjjby, village, district, state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Uttar Pradesh');
        """, (
            1 if i == 1 else (2 if i == 2 else (3 if i == 3 else None)),
            farmer_uid, pmkisan_id, name, phone, gender, social_category,
            random.choice(["Primary", "Middle School", "High School", "Intermediate", "Literate (Non-formal)"]),
            random.randint(3, 35),
            1, # 98% PMJDY
            1 if random.random() < 0.85 else 0,
            1 if random.random() < 0.75 else 0,
            village, district
        ))
        farmer_id = cursor.lastrowid

        # ---------------------------------------------------------------------
        # Land & Assets Profile
        # Distribution: ~65% Marginal (<= 2.47 acres), ~23% Small (2.47-4.94), ~12% Other
        # ---------------------------------------------------------------------
        r_land = random.random()
        if r_land < 0.65:
            # Marginal: 0.5 to 2.4 acres
            area_acres = round(random.uniform(0.6, 2.4), 2)
        elif r_land < 0.88:
            # Small: 2.5 to 4.8 acres
            area_acres = round(random.uniform(2.5, 4.8), 2)
        else:
            # Other: 5.0 to 14.0 acres
            area_acres = round(random.uniform(5.0, 14.0), 2)

        area_ha = round(area_acres / 2.47105, 3)

        # Land Ownership type
        r_owner = random.random()
        if r_owner < 0.15:
            ownership_type = "sharecropper"
        elif r_owner < 0.25:
            ownership_type = "oral_lease"
        elif r_owner < 0.35:
            ownership_type = "registered_lease"
        else:
            ownership_type = "owned"

        # Irrigation source
        # Bundelkhand / Jhansi has more dry/well, others more canal/tubewell/drip
        if district == "Jhansi":
            irrigation_source = random.choices(["Well", "Dry", "Sprinkler", "Canal"], weights=[0.45, 0.35, 0.15, 0.05])[0]
        else:
            irrigation_source = random.choices(["Canal", "Well", "Drip", "Sprinkler", "Dry"], weights=[0.40, 0.35, 0.12, 0.08, 0.05])[0]

        livestock_count = random.choices([0, 1, 2, 3, 4], weights=[0.25, 0.30, 0.30, 0.10, 0.05])[0]
        movable_asset_k = round(livestock_count * 35000.0 + random.uniform(20000, 150000), 2)
        immovable_asset_l = round(area_acres * (150000.0 if ownership_type == "owned" else 20000.0) + random.uniform(50000, 200000), 2)
        net_worth = round(movable_asset_k + immovable_asset_l, 2)

        khasra_no = f"{random.randint(101, 999)}/{random.randint(1, 4)}"

        cursor.execute("""
        INSERT INTO land_and_allied_assets (
            farmer_id, survey_khasra_no, ownership_type, area_acres, area_hectares,
            irrigated_pct, irrigation_source, land_fragmentation_flag,
            distance_to_mandi_km, livestock_count, fisheries_count,
            movable_asset_val_k, immovable_asset_val_l, net_worth
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            farmer_id, khasra_no, ownership_type, area_acres, area_ha,
            100.0 if irrigation_source != "Dry" else 0.0, irrigation_source,
            1 if random.random() < 0.30 else 0,
            round(random.uniform(2.5, 32.0), 1),
            livestock_count, 0,
            movable_asset_k, immovable_asset_l, net_worth
        ))
        land_id = cursor.lastrowid

        # ---------------------------------------------------------------------
        # Existing Liabilities
        # ---------------------------------------------------------------------
        r_debt = random.random()
        liabilities_list = []
        if r_debt < 0.45:
            # No existing debt
            pass
        elif r_debt < 0.70:
            # Small cooperative credit / SHG loan (performing)
            outstanding = round(random.uniform(8000, 35000), 2)
            liab = {
                "farmer_id": farmer_id, "lender_name": "District Central Co-op Bank",
                "lender_type": "cooperative", "outstanding_balance_m": outstanding,
                "overdue_days": 0, "is_npa": 0, "is_wilful_default": 0, "guarantor_liability": 0.0
            }
            cursor.execute("""
            INSERT INTO existing_liabilities (farmer_id, lender_name, lender_type, outstanding_balance_m, overdue_days, is_npa, is_wilful_default, guarantor_liability)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """, (farmer_id, liab["lender_name"], liab["lender_type"], liab["outstanding_balance_m"], 0, 0, 0, 0.0))
            liabilities_list.append(liab)
        elif r_debt < 0.90:
            # Informal village moneylender debt (distressed, candidate for Debt-Swap!)
            outstanding = round(random.uniform(15000, 60000), 2)
            liab = {
                "farmer_id": farmer_id, "lender_name": "Local Sahukar / Informal Moneylender",
                "lender_type": "moneylender_informal", "outstanding_balance_m": outstanding,
                "overdue_days": random.randint(30, 180), "is_npa": 1, "is_wilful_default": 0, "guarantor_liability": 0.0
            }
            cursor.execute("""
            INSERT INTO existing_liabilities (farmer_id, lender_name, lender_type, outstanding_balance_m, overdue_days, is_npa, is_wilful_default, guarantor_liability)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """, (farmer_id, liab["lender_name"], liab["lender_type"], liab["outstanding_balance_m"], liab["overdue_days"], 1, 0, 0.0))
            liabilities_list.append(liab)
        else:
            # Commercial bank loan with minor overdue or clean
            is_npa = 1 if random.random() < 0.25 else 0
            outstanding = round(random.uniform(25000, 120000), 2)
            liab = {
                "farmer_id": farmer_id, "lender_name": "Punjab National Bank",
                "lender_type": "commercial_bank", "outstanding_balance_m": outstanding,
                "overdue_days": 120 if is_npa else 0, "is_npa": is_npa, "is_wilful_default": 0, "guarantor_liability": 0.0
            }
            cursor.execute("""
            INSERT INTO existing_liabilities (farmer_id, lender_name, lender_type, outstanding_balance_m, overdue_days, is_npa, is_wilful_default, guarantor_liability)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """, (farmer_id, liab["lender_name"], liab["lender_type"], liab["outstanding_balance_m"], liab["overdue_days"], is_npa, 0, 0.0))
            liabilities_list.append(liab)

        # ---------------------------------------------------------------------
        # Loan Application
        # ---------------------------------------------------------------------
        app_no = f"KCC-UP-2026-{10000 + i}"
        season = random.choice(["Rabi", "Kharif"])
        primary_crop = random.choice(CROPS_BY_SEASON[season])
        secondary_crop = "Mustard" if primary_crop == "Wheat" else ("Gram" if primary_crop == "Potato" else None)

        if ownership_type in ["oral_lease", "sharecropper"]:
            facility_type = "Flexi KCC"
            requested_amount = round(random.uniform(15000, 48000), 2)
        elif area_acres <= 2.5:
            facility_type = "Crop KCC"
            requested_amount = round(random.uniform(30000, 110000), 2)
        elif area_acres <= 5.0:
            facility_type = "Crop KCC"
            requested_amount = round(random.uniform(90000, 220000), 2)
        else:
            facility_type = random.choice(["Crop KCC", "Agri Term Loan"])
            requested_amount = round(random.uniform(220000, 650000), 2)

        marketing_tieup = random.choices(
            ["Cooperative", "Government_Procurement", "Corporate_Contract", "Direct", "None"],
            weights=[0.35, 0.25, 0.15, 0.15, 0.10]
        )[0]
        pmfby_optin = 1 if random.random() < 0.88 else 0
        bank_assigned = random.choice(BANKS)

        cursor.execute("""
        INSERT INTO loan_applications (
            application_no, farmer_id, facility_type, requested_amount,
            season, primary_crop, secondary_crop, marketing_tieup,
            pmfby_optin, status, bank_assigned
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?);
        """, (
            app_no, farmer_id, facility_type, requested_amount,
            season, primary_crop, secondary_crop, marketing_tieup,
            pmfby_optin, bank_assigned
        ))
        app_id = cursor.lastrowid
        applications_created += 1

        # ---------------------------------------------------------------------
        # DSS Model Evaluation (Decision Tree, Forecast, Risk)
        # ---------------------------------------------------------------------
        farmer_dict = {
            "full_name": name, "social_category": social_category,
            "gender": gender, "district": district
        }
        land_dict = {
            "area_acres": area_acres, "area_hectares": area_ha,
            "ownership_type": ownership_type, "irrigation_source": irrigation_source,
            "distance_to_mandi_km": round(random.uniform(3, 25), 1),
            "livestock_count": livestock_count,
            "movable_asset_val_k": movable_asset_k,
            "immovable_asset_val_l": immovable_asset_l
        }
        app_dict = {
            "id": app_id, "requested_amount": requested_amount,
            "facility_type": facility_type, "primary_crop": primary_crop,
            "marketing_tieup": marketing_tieup, "pmfby_optin": bool(pmfby_optin)
        }

        dt_res = evaluate_decision_tree(farmer_dict, land_dict, liabilities_list, app_dict, policy_row)
        
        # Sanction amount: min of requested or scale of finance limit
        sanction_amt = min(requested_amount, dt_res["scale_of_finance_limit"])
        if dt_res["instrument"] == "Flexi KCC":
            sanction_amt = min(sanction_amt, 50000.0)

        # Forecast & DSCR
        fc_res = calculate_forecast_and_dscr(land_dict, app_dict, sanction_amt, district)

        # Risk Model & SHAP
        risk_res = calculate_hybrid_risk_and_shap(farmer_dict, land_dict, liabilities_list, app_dict, fc_res)

        cursor.execute("""
        INSERT INTO dss_evaluations (
            application_id, farmer_classification, decision_tree_path,
            scale_of_finance_limit, sanctioned_amount, pd_score, lgd_score,
            dscr_ratio, expected_revenue, drought_stress_revenue,
            equity_priority_score, shap_reasons, allocated_in_batch
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);
        """, (
            app_id, dt_res["farmer_category"], json.dumps(dt_res["steps_log"]),
            dt_res["scale_of_finance_limit"], sanction_amt,
            risk_res["pd_score"], risk_res["lgd_score"],
            fc_res["dscr_ratio"], fc_res["expected_net_revenue"], fc_res["drought_stress_revenue"],
            risk_res["equity_priority_score"], json.dumps(risk_res["shap_reasons"])
        ))

        # For the first 35 applications, mark them as 'approved' with generated tranches so the demo has ready vouchers
        if i <= 35:
            cursor.execute("UPDATE loan_applications SET status = 'approved' WHERE id = ?;", (app_id,))
            tranches = generate_tranches_for_application(app_id, sanction_amt)
            for tr in tranches:
                # If Ram Charan (i=1), leave voucher active ready for mock QR merchant redemption!
                cursor.execute("""
                INSERT INTO fund_tranches_and_usage (
                    application_id, tranche_no, tranche_name, percentage, amount,
                    status, voucher_code, qr_payload, merchant_name, redemption_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (
                    app_id, tr["tranche_no"], tr["tranche_name"], tr["percentage"], tr["amount"],
                    tr["status"], tr["voucher_code"], tr["qr_payload"], tr["merchant_name"], tr["redemption_timestamp"]
                ))

        # ---------------------------------------------------------------------
        # Seed 8 Sample Grievances across categories
        # ---------------------------------------------------------------------
        if i in [2, 5, 12, 19, 27, 44, 58, 71]:
            categories = [
                ("Collateral demanded under 2L", "Branch loan officer asked for land registry hypothecation for my ₹1.2 Lakh KCC loan, violating RBI's ₹2 Lakh collateral-free mandate.", "escalated", 8),
                ("Delayed disbursal >14 days", "Sanction letter was issued 18 days ago but Input Voucher / e-RUPI tranche has not been activated at the local IFFCO center.", "escalated", 9),
                ("Incorrect land area", "Patwari entered only 0.8 acres on portal while actual physical land holding with Khasra map is 1.6 acres, cutting my Scale of Finance limit.", "open", 4),
                ("Unfair rejection", "My Flexi KCC application was rejected citing lack of land title, even though I submitted Gram Panchayat Sarpanch sharecropper certificate.", "escalated", 10),
                ("Delayed disbursal >14 days", "Fertilizer sowing window is passing in 5 days; bank officer has not released Tranche 1 seeds voucher.", "resolved", 2)
            ]
            cat_choice = random.choice(categories)
            created_dt = datetime.now() - timedelta(days=cat_choice[3])
            sla_dt = created_dt + timedelta(days=7) # 7-day SLA
            
            cursor.execute("""
            INSERT INTO grievances_and_policy_logs (
                application_id, farmer_id, category, grievance_text, supporting_doc,
                bank_response, resolution_status, sla_deadline, govt_directive, created_at
            ) VALUES (?, ?, ?, ?, 'khasra_extract_proof.pdf', ?, ?, ?, ?, ?);
            """, (
                app_id, farmer_id, cat_choice[0], cat_choice[1],
                "Under review by Senior Branch Credit Manager." if cat_choice[2] != "resolved" else "Issue investigated and voucher credited.",
                cat_choice[2], sla_dt.isoformat(),
                "URGENT DIRECTIVE: Disburse immediately under collateral waiver guidelines; submit compliance proof within 24 hours." if cat_choice[2] == "escalated" else None,
                created_dt.isoformat()
            ))

    conn.commit()
    conn.close()
    print(f"Successfully seeded {total_farmers} farmers and {applications_created} loan applications into KrishiSetu DB.")

if __name__ == "__main__":
    seed_database()

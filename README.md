# KrishiSetu DSS: Computer Aided Decision System
**Course Project: DMS624 / IME624 (Computer Aided Decision Systems)**  
*Department of Industrial & Management Engineering, IIT Kanpur*

- **Live Deployed Application (Render):** [https://krishisetu-dss.onrender.com](https://krishisetu-dss.onrender.com)
- **GitHub Repository:** [https://github.com/Dipanshur19/KrishiSetu-DSS](https://github.com/Dipanshur19/KrishiSetu-DSS)

---

## 1. Executive Overview & Core Decision Conflict

**KrishiSetu DSS** is a three-sided Computer Aided Decision System resolving the structural conflict between **Government welfare mandates** and **Bank risk aversion** across India's **₹32.50 Lakh Crore** agricultural credit target (FY 2025–26).

- **Government (Welfare Mandate):** Prioritize Marginal Farmers ($\le 1\text{ ha}$, over 86% of Indian farmers), enforce RBI Priority Sector Lending (10% SMF sub-target / 55.6% of agri PSL), and prevent end-use leakage without arbitrary cash handouts.
- **Commercial Banks (Risk Aversion):** Keep portfolio NPAs strictly below regulatory ceilings while growing profitable lending.
- **Farmers (Credit Access):** Overcome fragmented bank paperwork, collateral barriers ($\le ₹2.00\text{ Lakh}$ RBI waiver + Flexi KCC for sharecroppers), and opaque rejections.

---

## 2. Full Production Tech Stack (Per `dms624.pdf`)

| Layer | Technology | Deployment |
|---|---|---|
| **Frontend (All 3 UIs)** | **Next.js 16 (React 19 + TypeScript) + Tailwind CSS + Recharts + Leaflet** + Hindi/English i18n + Web Speech API | Vercel (`frontend/vercel.json`) or single-host static export |
| **DSS Backend & Models** | **FastAPI + trained `XGBoost` + `scikit-learn` + `shap.TreeExplainer` + `scipy.optimize.milp`** | Render (`render.yaml`) |
| **Database & Auth** | **Supabase (PostgreSQL + RLS RBAC + Auth + Storage)** with automatic local SQLite + `/uploads` fallback | Supabase Cloud (`supabase/schema.sql`) |
| **Live External APIs** | **Open-Meteo API** (live 14-day precipitation & max temp REST call via `httpx`) + **ICRISAT / CACP MSP / UP SLTC Scale-of-Finance JSON** | Direct REST call from FastAPI |

---

## 3. Canonical DSS Subsystems

### A. Data Management Subsystem (`backend/database.py`, `supabase/schema.sql`)
Harmonizes Axis Bank (agronomic resilience), SBI (PM-KISAN & allied dairy), and Bank of India (social category & Net Worth $[(K+L)-M]$) into **8 normalized tables**, pre-seeded with **160 realistic synthetic applications** across 7 UP districts (*Kanpur Dehat, Kanpur Nagar, Unnao, Jhansi, Lucknow, Barabanki, Fatehpur*).

### B. Model Management Subsystem (`backend/models/`)
1. **Explainable Decision Tree (`decision_tree.py`, `/evaluate/decision-tree`):** 4-step RBI eligibility engine (land classification, informal moneylender debt-swap routing, Flexi KCC / collateral waiver routing, Scale-of-Finance credit limit).
2. **Cash-Flow & Agronomic Forecast (`forecast_model.py`, `/evaluate/forecast`):** Live Open-Meteo 14-day weather anomaly + ICRISAT district yields + CACP MSP prices $\to$ Expected Revenue $\hat{R}_i$, $-35\%$ Drought Stress $R_{\text{stress}, i}$, and DSCR at 4% MISS prompt repayment rate.
3. **Hybrid Credit Risk + SHAP (`risk_model.py`, `/evaluate/risk-score`):** Trained XGBoost + Logistic Regression ensemble with exact `shap.TreeExplainer` attributions.
4. **Constrained Portfolio Optimizer (`portfolio_optimizer.py`, `/optimize/allocate`):** Mixed-Integer Linear Program solved via `scipy.optimize.milp` with Government First-Loss Default Guarantee ($\gamma$) resolving the Bank vs. Government conflict.
5. **Intended-Usage Voucher System (`voucher_system.py`):** 3 tranches (60% e-RUPI seed/fertilizer QR voucher, 30% farm operations UPI credit, 10% geo-tagged sowing proof rebate unlock).

### C. Dialog Subsystem (`frontend/src/components/`)
- **Farmer Portal:** Bilingual English/Hindi 4-step wizard, Web Speech voice input, live Scale-of-Finance estimator, transparent SHAP explanation cards, e-RUPI QR wallet + POS scanner, geo-tagged sowing upload, and 7-day SLA grievance desk.
- **Bank Officer Workbench:** Unified dossier, Recharts revenue & SHAP waterfall visualizations, batch MILP optimizer with What-If sliders, and grievance queue.
- **Government Policy Console:** Interactive **Leaflet** district geospatial map with live Open-Meteo overlays, Recharts bank PSL compliance benchmark chart, live policy correction sliders, and escalated grievance tribunal.

---

## 4. Week-4 Demo Accounts (RBAC Login)

Use the **Demo Login** button in the top navigation bar:
- **Farmer:** `farmer@demo`
- **Bank Officer:** `bank@demo`
- **Government Auditor:** `govt@demo`

---

## 5. Local Quick Start & Verification

```powershell
# Start unified FastAPI + Next.js static server at http://localhost:8000
python run_server.py

# Run full verification suites
python test_app.py
python e2e_verify_live.py
```

# KrishiSetu DSS: Computer Aided Decision System
**Course Project: DMS624 / IME624 (Computer Aided Decision Systems)**  
*Department of Industrial & Management Engineering, IIT Kanpur*

---

## Executive Overview

**KrishiSetu DSS** is a full-fledged Computer Aided Decision System designed to resolve the structural conflict between **Government welfare mandates** and **Bank risk aversion** across India's **₹32.50 Lakh Crore** agricultural credit ecosystem (FY 2025–26).

```
   ┌─────────────────────────────────────────────────────────────┐
   │                   KrishiSetu DSS Ecosystem                  │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
   │ Farmer UI    │        │ Bank UI      │        │ Govt UI      │
   │ Mobile-first │        │ Underwriting │        │ Macro Policy │
   │ Voice input  │        │ MILP Solver  │        │ PSL Audit    │
   │ e-RUPI Wallet│        │ Risk Inspect │        │ Tribunal     │
   └──────────────┘        └──────────────┘        └──────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                  3 Canonical DSS Subsystems                 │
   │  1. Data Management (8 Normalized Relational Tables)        │
   │  2. Model Management (Decision Tree, Forecast, Risk, MILP)   │
   │  3. Dialog Subsystem (3 Role-Based Interfaces)              │
   └─────────────────────────────────────────────────────────────┘
```

---

## 1. The Core Decision Problem & Central Conflict

| Actor | Core Objective | Key Constraint / Pain Point | Required Interface (UI) |
|---|---|---|---|
| **Government** | Farmer welfare; ensure capital reaches high-risk Small & Marginal Farmers (SMFs) | Cannot use arbitrary direct pay (risk of end-use leakage); needs verifiable usage & continuous compliance tracking | Policy Monitor, PSL Compliance Audit & Live Policy Levers |
| **Commercial Banks** | Grow lending portfolio with sustainable interest margins | Strict risk aversion; wants to minimize non-performing loans (creates direct conflict with serving marginal farmers) | Unified Dossier, Interactive Model Inspector & Batch MILP Optimizer |
| **Farmers** | Access timely, affordable credit (Need Money) using land & allied assets | High weather volatility, thin credit history, fragmented paperwork, opaque rejections | Low-friction 4-step wizard, transparent XAI reason cards & e-RUPI wallet |

---

## 2. Deep Real-World Policy Grounding (RBI & Govt of India 2025–2026)

- **Small & Marginal Farmers (SMFs)**: Marginal Farmers hold $\le 1$ hectare ($\le 2.47$ acres); Small Farmers hold $1\text{ to }2$ hectares ($2.47\text{ to }4.94$ acres). Together they represent **over 86%** of India's agrarian workforce.
- **Mandatory Banking Quotas (RBI PSL Directions)**: Commercial banks must allocate **18%** of Adjusted Net Bank Credit (ANBC) to agriculture, with a mandatory **10% sub-target exclusively for SMFs** ($\approx 55.6\%$ of all agri lending).
- **RBI Collateral-Free Short-Term Agri Loan Limit**: Raised from ₹1.60 Lakh to **₹2.00 Lakh** (effective Jan 1, 2025), and up to **₹3.00 Lakh** with verified marketing tie-ups.
- **Modified Interest Subvention Scheme (MISS)**: Short-term KCC carries 7% base interest with a **3% Prompt Repayment Incentive**, bringing the effective net rate to **4.0% p.a.**
- **RBI KCC Directions 2026**: Introduces **Flexi KCC (₹10,000–₹50,000)** for oral lessees, sharecroppers, and tenant farmers assessed without requiring land title, backed by local Panchayat certificates.

---

## 3. The Three Canonical DSS Subsystems

### A. Data Management Subsystem
Harmonizes three real-world Indian agricultural bank application forms into **8 normalized relational tables**:
1. `users_and_roles`: Role-based access control (Farmer, Bank Officer, Govt Auditor).
2. `farmer_profiles`: Demographics, PM-KISAN ID, tokenized Aadhaar, social category (SC/ST/OBC/Women/PWD).
3. `land_and_allied_assets`: Khasra plot, acreage, irrigation (Drip/Sprinkler/Canal/Dry), mandi distance, livestock count, net worth $[(K + L) - M]$.
4. `existing_liabilities`: Commercial, cooperative, and informal moneylender debt segregation.
5. `loan_applications`: Facility type (Crop KCC, Flexi KCC, Allied KCC), requested amount, crops, marketing tie-up, PMFBY consent.
6. `dss_evaluations`: Decision tree execution paths, forecasted revenue, DSCR ratio, PD/LGD scores, SHAP explanations.
7. `fund_tranches_and_usage`: 3-tranche intended-usage tracking (60% e-RUPI voucher, 30% operations, 10% rebate reserve).
8. `grievances_and_policy_logs`: Farmer appeals, statutory 7-day SLA tracker, binding tribunal directives.

### B. Model Management Subsystem (The Decision Brain)
Builds all mathematical decision engines in Python:
1. **Explainable Decision Tree Engine (`models/decision_tree.py`)**:
   - Step 1: Land classification (acres $\to$ hectares; $\le 1$ ha tagged as Marginal).
   - Step 2: Hard compliance check (wilful default flag; informal debt routed to Weaker Section Debt-Swap).
   - Step 3: Instrument & collateral routing (Sharecroppers $\to$ Flexi KCC; $\le ₹2\text{L} \to$ Collateral-free).
   - Step 4: Scale-of-Finance Credit Limit calculation:
     $$\text{Limit}_i = (\text{Scale of Finance}_{d, c} \times \text{Area}_i) + 10\%\text{ Post-Harvest} + 20\%\text{ Upkeep} + \text{PMFBY} + \text{Allied Unit Cost}$$
2. **Cash-Flow & Agronomic Forecast Model (`models/forecast_model.py`)**:
   - Forecasts Expected Net Revenue $\hat{R}_i$ vs -35% Drought Stress Scenario $R_{\text{stress}, i}$.
   - Computes Debt Service Coverage Ratio (DSCR) using MISS 4% prompt repayment rate:
     $$\text{DSCR}_i = \frac{\hat{R}_i + \text{Allied Income}_i + \text{Non-Farm Income}_i - \text{Living Expense}_i}{\text{Principal}_i + \text{Effective Interest}_i}$$
3. **Hybrid Alternative Credit Risk Model with SHAP (`models/risk_model.py`)**:
   - Blends financial leverage with agronomic resilience (Drip irrigation, PMFBY insurance reduces LGD by up to 35%, dairy weekly cash buffer).
   - Outputs Probability of Default ($PD_i \in [0.015, 0.42]$), Loss Given Default ($LGD_i$), and top 3 human-readable SHAP factor cards.
4. **Constrained Portfolio Optimizer (`models/portfolio_optimizer.py`)**:
   - Mixed-Integer Linear Program (MILP) solved via SciPy:
     $$\max_{x} \sum_{i=1}^N x_i \cdot \left(w_1 \cdot \text{EquityScore}_i + w_2 \cdot \text{Return}_i - w_3 \cdot PD_i \cdot LGD_i^{\text{net}} \cdot L_i\right)$$
     $$\text{subject to:}$$
     1. $\sum L_i x_i \le X \quad \text{(Total Fund Budget)}$
     2. $\sum_{i \in \text{SMF}} L_i x_i \ge \alpha \sum L_i x_i \quad (\alpha \ge 55.6\% \text{ RBI Quota})$
     3. $\sum_{i \in \text{Weaker}} L_i x_i \ge \beta \sum L_i x_i \quad (\beta \ge 25\% \text{ Floor})$
     4. $\frac{\sum PD_i \cdot LGD_i^{\text{net}} \cdot L_i x_i}{\sum L_i x_i} \le \text{MaxNPA}_{\text{bank}}$
     5. $\sum_{i \in \text{SMF}} \gamma \cdot PD_i \cdot LGD_i \cdot L_i x_i \le G_{\text{govt}} \quad (\text{FLDG Guarantee Cap})$
5. **Purpose-Locked Voucher System (`models/voucher_system.py`)**:
   - **Tranche 1 (60%)**: Purpose-locked e-RUPI voucher redeemable strictly at certified seed/fertilizer merchant POS.
   - **Tranche 2 (30%)**: Liquid operational cash transferred to farmer UPI for labor & irrigation.
   - **Tranche 3 (10%)**: Conditional reserve unlocked upon geo-tagged crop sowing proof, confirming the 3% interest discount.

### C. Dialog Subsystem (User Interfaces)
- **Farmer Portal**: Multilingual (English/Hindi), Web Speech API voice input, 4-step progressive wizard, transparent XAI reason cards, e-RUPI QR wallet, and 7-day SLA grievance tracking.
- **Bank Officer Workbench**: Scannable dossier consolidating Axis, SBI, and BOI data points; interactive model inspector (visual decision tree, weather forecast chart, SHAP risk breakdown); batch MILP optimizer with side-by-side comparison.
- **Government Policy Console**: Geospatial district heatmap across central UP districts (Kanpur Nagar, Kanpur Dehat, Unnao, Jhansi, Lucknow, Barabanki, Fatehpur); bank PSL compliance audit; "Monitor & Correct" policy sliders; binding escalated grievance tribunal.

---

## 4. How to Run the Application

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ (tested on Node v24.15.0)

### Quick Start (Single Command Launcher)

```powershell
# 1. Start the unified full-stack server (FastAPI + built React frontend)
python run_server.py
```

The application will start immediately on **http://localhost:8000**.

### Development Mode (Optional)

```powershell
# Terminal 1: Backend API
cd backend
python -m uvicorn api:app --reload --port 8000

# Terminal 2: Frontend Vite Dev Server
cd frontend
npm run dev
```

---

## 5. Verification Suite

Run the automated test suite verifying all 7 subsystem layers:

```powershell
python test_app.py
```

Expected output:
```
✓ Static frontend serves HTTP 200 with HTML
✓ System demo accounts API works: 6 users found
✓ Farmer eligibility estimator works: Limit = ₹107872.0
✓ Bank applications listing works: 150 applications found
✓ Constrained MILP Optimizer works: DSS approved 61 farmers vs Profit 32
✓ Government Macro KPI works: SMF share = 54.6%
✓ Bank PSL compliance table works: 6 banks audited

ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀
```

---

## 6. Unslopped UI/UX Design Standards Applied

- **Grounded Institutional Palette**: Neutral cool graphite (`#0f172a`, `#1e293b`), Forest Emerald (`#047857`) for agriculture/PSL green, Institutional Navy (`#1e3a8a`) for banking governance, and Burnished Amber (`#d97706`) for climate warnings and FLDG guarantees.
- **Strict 4px Rhythm**: Spacing, padding, and layout bounds sit strictly on multiples of 4px.
- **Tabular Numbers**: Financial figures, acreages, and risk scores use `tabular-nums` for crisp ledger readability.
- **Zero AI Slop**: No floating emojis, no purple neon gradients, no meaningless sparkles, and no marketing fluff.
